import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AttendanceSource, AttendanceStatus, MorningQuizStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';
import { createRealSubmissionSafe } from '../common/submission-create';
import type { StudentSubmission } from '@prisma/client';
import { isMakeupWindowOpen } from '../morning-quiz/morning-quiz.service';
import { levelPushesWordlist } from '../morning-quiz/level-registry';
import { resolveWordlistForPaperConfig } from '../morning-quiz/wordlist-source';
import { resolveWeeklyTrack } from '../morning-quiz/weekly-track';
import { canActOnClass } from '../common/roles';
import { QrService } from '../qr/qr.service';
import { ShuffleService } from '../shuffle/shuffle.service';

export interface ActorCtx {
  id: string;
  role: string;
  ip: string | null;
}

export interface ScanResult {
  attendance: {
    id: string;
    status: AttendanceStatus;
    scanTime: Date | null;
  };
  student: { id: string; name: string };
  /** Short-lived JWT scoped to this session — frontend stores it as
   *  auth_token so /morning-quiz/* calls authenticate via the existing
   *  AuthGuard with role='student'. Expires at session.quizEnd. */
  scanToken: string;
  quizUrl: string;
  remainingMinutes: number;
  /**
   * 这一场学生已经「交卷并看过答案」了，本场不能再作答。
   *
   * 第二作答窗（2026-08-20）里，主动最终提交过的学生仍然能扫码 ——
   * scanQr 不会把他的答卷退回可编辑（那等于让他照着已看到的答案改成
   * 满分）。但如果什么都不说，他会照常进到答题页、看到题目和自己的
   * 答案，以为能改，一保存才撞 submission_locked。扫码这一刻就讲清楚。
   */
  alreadyFinalSubmitted: boolean;
  /** 该生是否已设置登录 PIN（2026-08-25）—— 扫码成功页据此弹「设置 PIN」卡片 */
  pinSet: boolean;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger('AttendanceService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrService,
    private readonly shuffle: ShuffleService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Public roster lookup for the scan page. The live QR token is the
   * gate — we verify it and only return the student-name list while the
   * session is active, limiting exposure to the brief in-progress window.
   * Students are returned sorted by name.
   */
  async fetchRoster(qrToken: string) {
    const decoded = await this.qr.verify(qrToken);
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: decoded.sessionId },
      select: {
        id: true,
        classId: true,
        date: true,
        level: true,
        status: true,
        attendanceStart: true,
        attendanceEnd: true,
        lateCutoff: true,
        quizEnd: true,
        class: { select: { name: true } },
      },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    // Gate: only roster-leak the names while the session is *active*.
    // Without this, a stale QR replayed off-hours could harvest the
    // class roster — the active-status check scopes any leak to the
    // brief in-progress window.
    if (session.status !== MorningQuizStatus.active) {
      // r15-followup-29 — every failure here is a "学生扫码看到已结束"
      // incident. Log the FULL context so the next time it happens we
      // can grep Railway logs for the timestamps + sessionIds. Without
      // this the failures are completely silent. Token type is v1/v2 —
      // legacy rotating display QR vs v2 printable static QR.
      const tokenType = qrToken.startsWith('v2.') ? 'v2-static' : 'v1-rotating';
      const now = new Date();
      this.logger.warn(
        `fetchRoster denied — session_not_active. ` +
          `now=${now.toISOString()} sessionId=${session.id} status=${session.status} ` +
          `class=${session.class.name} (${session.classId}) level=${session.level} ` +
          `tokenType=${tokenType} ` +
          `attStart=${session.attendanceStart.toISOString()} quizEnd=${session.quizEnd.toISOString()} ` +
          `withinWindow=${now >= session.attendanceStart && now <= session.quizEnd}`,
      );
      // Also write to AuditLog so a SQL query can reconstruct who-was-
      // affected after the fact. action='attendance.scan_denied' keeps
      // it cleanly separable from successful attendance.scan rows.
      // Best-effort: don't let an audit-table write block the throw.
      this.audit
        .log({
          actorId: 'public',
          actorRole: 'public',
          action: 'attendance.scan_denied',
          entityType: 'MorningQuizSession',
          entityId: session.id,
          ip: null,
          metadata: {
            reason: 'session_not_active',
            status: session.status,
            classId: session.classId,
            level: session.level,
            tokenType,
            sessionAttStart: session.attendanceStart.toISOString(),
            sessionQuizEnd: session.quizEnd.toISOString(),
          },
        })
        .catch((e) => this.logger.warn(`audit write failed: ${e?.message ?? e}`));
      throw new GoneException({ code: 'session_not_active', status: session.status });
    }
    const enrollments = await this.prisma.classEnrollment.findMany({
      // isActive=false users (deactivated by admin) must not appear in the
      // roster — otherwise an old account could be picked and signed in as.
      where: { classId: session.classId, role: 'student', user: { isActive: true } },
      include: { user: { select: { id: true, name: true } } },
    });
    const students = enrollments
      .map((e) => ({ id: e.user.id, name: e.user.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    // R10 multi-level — when a class is running multiple difficulty bands
    // on the same day, every (classId, date, level) tuple has its own
    // session. The scan page uses this to render a level-picker before
    // the name input, so the operator only has to project ONE QR and
    // students self-select their band. Always includes the QR's own
    // session in the list so single-band classes still see one entry.
    const siblings = await this.prisma.morningQuizSession.findMany({
      where: {
        classId: session.classId,
        date: session.date,
        status: MorningQuizStatus.active,
      },
      select: { id: true, level: true },
      orderBy: { level: 'asc' },
    });
    return {
      sessionId: session.id,
      sessionStatus: session.status,
      className: session.class.name,
      level: session.level,
      siblingSessions: siblings.map((s) => ({ sessionId: s.id, level: s.level })),
      students,
    };
  }

  /**
   * Public four-gate scan. All gates run here:
   *   1. QR token verify (HMAC + freshness)
   *   2. Session is `status=active`
   *   3. studentId belongs to a real student enrolled in the session's class
   *   4. Current time is within the attendance window (on_time | late | absent)
   *
   * On success: upserts Attendance + StudentSubmission + ShuffleMap and
   * mints a short-lived "scan token" JWT carrying role='student' so the
   * frontend can drop it into auth_token and let the existing AuthGuard
   * authenticate the take/answer/submit calls.
   */
  async scanQr(
    qrToken: string,
    studentName: string,
    sourceIp: string | null,
    deviceUuid: string,
    userAgent: string | null,
    sessionIdOverride: string | null = null,
  ): Promise<ScanResult> {
    // Gate 2 — QR validity
    const decoded = await this.qr.verify(qrToken);

    // R10 multi-level — when the operator projects ONE QR per (class,day)
    // and the student picks their difficulty band on the scan page, the
    // chosen sessionId comes in as `sessionIdOverride`. The QR is still
    // the proof of "right place, right time" (HMAC + freshness via
    // qr.verify), but the sessionId we actually attach the attendance
    // row to may be a sibling of the QR's encoded session. We validate
    // the override is in the SAME (classId, date) family so a student
    // can't drop their attendance into another class.
    let resolvedSessionId = decoded.sessionId;
    if (sessionIdOverride && sessionIdOverride !== decoded.sessionId) {
      const qrSession = await this.prisma.morningQuizSession.findUnique({
        where: { id: decoded.sessionId },
        select: { classId: true, date: true },
      });
      if (!qrSession) throw new NotFoundException({ code: 'session_not_found' });
      const overrideSession = await this.prisma.morningQuizSession.findUnique({
        where: { id: sessionIdOverride },
        select: { classId: true, date: true, status: true },
      });
      if (!overrideSession) {
        throw new NotFoundException({ code: 'override_session_not_found' });
      }
      const sameClass = overrideSession.classId === qrSession.classId;
      const sameDay =
        overrideSession.date.toISOString().slice(0, 10) ===
        qrSession.date.toISOString().slice(0, 10);
      if (!sameClass || !sameDay) {
        throw new ForbiddenException({ code: 'override_class_or_date_mismatch' });
      }
      resolvedSessionId = sessionIdOverride;
    }

    // Gate 3 — session active
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: resolvedSessionId },
      include: {
        paperAssignment: { select: { id: true, paperId: true } },
        // 测试班旋转门要认班名（见下）
        class: { select: { name: true } },
      },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (session.status !== MorningQuizStatus.active) {
      // r15-followup-29 — mirror the fetchRoster diagnostic. Capture
      // the override scenario explicitly so we can tell apart "QR
      // resolved to a bad session" vs "student picked a sibling that
      // got cancelled between fetchRoster and submit".
      const tokenType = qrToken.startsWith('v2.') ? 'v2-static' : 'v1-rotating';
      const now = new Date();
      this.logger.warn(
        `scanQr denied — session_not_active. ` +
          `now=${now.toISOString()} sessionId=${session.id} status=${session.status} ` +
          `classId=${session.classId} ` +
          `tokenType=${tokenType} ` +
          `qrSessionId=${decoded.sessionId} override=${sessionIdOverride ?? '(none)'} ` +
          `studentNameLen=${studentName?.length ?? 0} deviceUuid=${deviceUuid?.slice(0, 8) ?? ''} ` +
          `attStart=${session.attendanceStart.toISOString()} quizEnd=${session.quizEnd.toISOString()}`,
      );
      this.audit
        .log({
          actorId: 'public',
          actorRole: 'public',
          action: 'attendance.scan_denied',
          entityType: 'MorningQuizSession',
          entityId: session.id,
          ip: sourceIp,
          metadata: {
            reason: 'session_not_active',
            status: session.status,
            classId: session.classId,
            tokenType,
            qrSessionId: decoded.sessionId,
            sessionIdOverride: sessionIdOverride ?? null,
            sessionAttStart: session.attendanceStart.toISOString(),
            sessionQuizEnd: session.quizEnd.toISOString(),
            studentName: studentName?.trim() ?? null,
            stage: 'scanQr.gate3',
          },
        })
        .catch((e) => this.logger.warn(`audit write failed: ${e?.message ?? e}`));
      throw new GoneException({ code: 'session_not_active', status: session.status });
    }

    // Gate 4 — resolve student by typed name within the session's class.
    // Roster lookup + enrollment check are folded into a single query: we
    // pull every ClassEnrollment for this session's class where the linked
    // user is a student matching the trimmed input. Exact match — no
    // partial / case fuzz so the student must type their full real name.
    const trimmedName = studentName.trim();
    const matches = await this.prisma.classEnrollment.findMany({
      where: {
        classId: session.classId,
        role: 'student',
        // isActive=false users are admin-deactivated; they must not be able
        // to sign in or be impersonated even if their name still matches.
        user: { name: trimmedName, role: 'student', isActive: true },
      },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
    if (matches.length === 0) {
      // R10 demo bypass — when MORNING_QUIZ_DEMO=true, auto-create the
      // student + enroll into the session's class instead of 404. Only
      // intended for in-house testing where the operator wants to scan
      // with arbitrary names without pre-seeding the roster. Production
      // bootstrap (main.ts) hard-fails when this is set with NODE_ENV=
      // production unless an explicit ALLOW_DEMO env is also set.
      if (process.env.MORNING_QUIZ_DEMO === 'true') {
        const bcrypt = await import('bcryptjs');
        const slug = trimmedName.replace(/[^a-zA-Z0-9一-龥]/g, '').slice(0, 16) || 'demo';
        const email = `demo-${slug}-${Date.now().toString(36)}@demo.local`;
        const passwordHash = await bcrypt.hash('demo-no-password', 4);
        const user = await this.prisma.user.create({
          data: { email, name: trimmedName, role: 'student', passwordHash, isActive: true },
        });
        await this.prisma.classEnrollment.create({
          data: { classId: session.classId, userId: user.id, role: 'student' },
        });
        // Re-issue the match so downstream code is unchanged.
        matches.push({
          id: 'demo',
          classId: session.classId,
          userId: user.id,
          role: 'student' as any,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        } as any);
      } else {
        throw new NotFoundException({ code: 'student_not_found', typed: trimmedName });
      }
    }
    if (matches.length > 1) {
      // Two students in the same class share an exact name — rare but
      // possible. Bail out and ask admin to disambiguate via the manual-
      // correction path; resolving it client-side would expose the dupe.
      throw new ForbiddenException({ code: 'multiple_students_with_same_name' });
    }
    const student = matches[0].user;
    const studentId = student.id;

    // Gate 5 — 时间窗。
    //
    // 2026-08-20 起早测**不再记录出勤**（校方决定）。原因是同一天开了
    // 两个作答窗、学生可任意选择，「几点到校」不再是这套系统该回答的
    // 问题。于是：
    //   · 准时 / 迟到 / 缺席的判定停用，扫码只负责认人 + 开卷
    //   · 09:00 不再给未扫码的学生插缺席行（见 cron 的 attendanceTracking）
    //   · 不再同步 Seiue
    // Attendance 行仍然写 —— 它挂着 submissionId，是「谁参加了这场」的
    // 索引，不写会连答卷都找不回来。status 统一记 on_time，含义退化成
    // 「参加了」；历史数据保持原样不动。
    //
    // 想恢复出勤：MORNING_QUIZ_ATTENDANCE_TRACKING=on，下面的判定分支
    // 原样还在。
    const now = new Date();
    const attendanceTracking = process.env.MORNING_QUIZ_ATTENDANCE_TRACKING === 'on';
    let attendanceStatus: AttendanceStatus;
    /** 这次扫码发生在第二作答窗内（16:00–17:30） */
    let isSecondWindowScan = false;
    /** 出勤停用后 makeupAt 不再写 —— 它是「缺席但补考了」的标记，
     *  而现在既没有缺席也没有补考的概念。 */
    let isMakeupScan = false;
    if (now < session.attendanceStart) {
      throw new GoneException({ code: 'attendance_window_not_open' });
    } else if (now <= session.attendanceEnd) {
      attendanceStatus = AttendanceStatus.on_time;
    } else if (now <= session.lateCutoff) {
      attendanceStatus = attendanceTracking ? AttendanceStatus.late : AttendanceStatus.on_time;
    } else if (isMakeupWindowOpen(session, now)) {
      // 第二作答窗（2026-08-20 新政）：16:00–17:30，早上没来的、来了
      // 没答完的、答完想再改的都能进，学生任意选择。
      //
      // 出勤开关打开时仍走旧的补考语义（照记 absent + makeupAt）——
      // 2026-08-13 那次事故的教训是补考绝不能洗白早上的缺席。关闭时
      // 统一记 on_time，只表示「参加了」。
      isSecondWindowScan = true;
      if (attendanceTracking) {
        attendanceStatus = AttendanceStatus.absent;
        isMakeupScan = true;
      } else {
        attendanceStatus = AttendanceStatus.on_time;
      }
    } else {
      // 两个窗都关了还来扫码。出勤停用后不再补一条缺席行 —— 记录
      // 「这人 11 点扫过码」对现在的系统没有任何用处，只会在面板上
      // 留一条谁也不看的 absent。开着出勤时保留原行为。
      if (attendanceTracking) {
        const existing = await this.prisma.attendance.findUnique({
          where: { sessionId_studentId: { sessionId: session.id, studentId } },
        });
        if (!existing) {
          await this.prisma.attendance.create({
            data: {
              sessionId: session.id,
              studentId,
              status: AttendanceStatus.absent,
              scanTime: now,
              sourceIp,
              deviceUuid,
              userAgent,
              source: AttendanceSource.qr_scan,
            },
          });
        }
      }
      throw new GoneException({ code: 'attendance_window_closed' });
    }

    // Anti-fraud: same physical device must not sign in as multiple
    // students in the same session. deviceUuid is required by the controller
    // schema so we always have a value here. If the same uuid was already
    // used by a *different* student in this session, reject hard. The
    // legitimate edge case (student A lent their phone to student B because
    // B's phone died) is handled by the existing manual_correction flow.
    const conflict = await this.prisma.attendance.findFirst({
      where: {
        sessionId: session.id,
        deviceUuid,
        studentId: { not: studentId },
      },
      include: { student: { select: { name: true } } },
    });
    if (conflict) {
      throw new ConflictException({
        code: 'device_already_used',
        conflictStudent: conflict.student.name,
      });
    }

    // R15-followup-10 — re-scan timestamp bug. Scenario: a student scans
    // at 08:31:54 (on_time), the page reloads or they back out, they
    // scan again at 08:36:01. The previous upsert UPDATE block always
    // overwrote scanTime=now AND re-computed status from `now`, so the
    // 8:36 scan flipped the record from on_time → late. Real student
    // got marked 迟到 on 2026-05-14 because of this.
    //
    // New behaviour: read the existing row first. If it's already a
    // legitimate present row (on_time / late), keep its scanTime AND
    // status — re-scans only refresh fingerprint metadata for forensics.
    // If it's `absent` (e.g. lockPastSessions seeded an absent row before
    // the session was re-activated), promote to the freshly-computed
    // status using `now`. This is the same upsert outcome the previous
    // code intended, just without overwriting on already-present rows.
    const existing = await this.prisma.attendance.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
      select: { id: true, status: true, qrVariant: true },
    });
    const isAlreadyPresent =
      !!existing && (existing.status === AttendanceStatus.on_time || existing.status === AttendanceStatus.late);
    const attendance = await this.prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
      create: {
        sessionId: session.id,
        studentId,
        status: attendanceStatus,
        // 补考扫码不写 scanTime —— scanTime 的语义是「早上到场的时刻」，
        // 写进 13:22 会让考勤报表以为这人早上 13:22 到了校。补考时刻
        // 记在 makeupAt。
        scanTime: isMakeupScan ? null : now,
        makeupAt: isMakeupScan ? now : null,
        sourceIp,
        deviceUuid,
        userAgent,
        // 扫的是哪一张贴墙码。墙上换了新标签而学生仍扫到旧标签，
        // 说明他用的是之前拍下来的照片，人不在墙前。
        qrVariant: decoded.qrVariant ?? null,
        source: AttendanceSource.qr_scan,
      },
      update: isAlreadyPresent
        ? {
            // Already-present row — keep scanTime + status, just refresh
            // forensic fingerprint fields.
            sourceIp,
            deviceUuid: deviceUuid ?? undefined,
            userAgent: userAgent ?? undefined,
            // 只在还没记过时写入：证据要的是**第一次**扫的那张码。
            // 覆盖式写入的话，学生再扫一次墙上的新码就把痕迹抹掉了。
            ...(existing?.qrVariant ? {} : { qrVariant: decoded.qrVariant ?? undefined }),
            // 早上来过的学生又在补考窗口扫了一次：不动出勤状态，
            // 只记一笔补考时间（他本来就不该出现在补考名单里，
            // 但记下来比默默忽略强）。
            ...(isMakeupScan ? { makeupAt: now } : {}),
          }
        : {
            // Absent (or other non-present) row — promote with current
            // timestamp + status. This is the original behaviour, scoped
            // to the case where it actually makes sense.
            status: attendanceStatus,
            sourceIp,
            // 补考不覆盖 scanTime（见 create 分支注释），只盖 makeupAt
            ...(isMakeupScan ? { makeupAt: now } : { scanTime: now }),
            deviceUuid: deviceUuid ?? undefined,
            userAgent: userAgent ?? undefined,
            ...(existing?.qrVariant ? {} : { qrVariant: decoded.qrVariant ?? undefined }),
          },
    });

    const paperId = session.paperAssignment.paperId;
    // R10-fix: pull paper.totalMarksActual so maxScore is correct from the
    // start. Was hard-coded to 0, then never updated by finalSubmit, so the
    // result page rendered "3 / 1" (front-end ||1 fallback over a 0 max).
    const paperForMax = await this.prisma.paper.findUnique({
      where: { id: paperId },
      // config 给下面的词表推送用（按 paperKey/passageRef 找到本篇词表）
      select: { totalMarksActual: true, config: true },
    });
    // R14 — upsert via findFirst+create/update since @@unique was dropped
    // for practice-mode coexistence. Non-practice subs are uniquely keyed
    // by (assignmentId, studentId, status!='practice') by service invariant.
    let submission = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignmentId,
        studentId,
        status: { not: 'practice' },
      },
    });
    // 【测试】旋转门（2026-08-26 教师要求）：测试班的卷子**永远可以重来**。
    // 交过卷再扫 → 旧答卷（含 AnswerScript，FK 级联）直接清掉、当新卷进。
    // 教师全流程测试不再受「已交卷不能再修改」限制，也不用每次喊人清场。
    // 真实班级绝不走这里 —— finalSubmittedAt 是答案门的地基。
    if (submission?.finalSubmittedAt != null && session.class.name.startsWith('【测试】')) {
      await this.prisma.studentSubmission.delete({ where: { id: submission.id } });
      this.logger.log(
        `test-class revolving door: wiped submission=${submission.id} student=${studentId}`,
      );
      submission = null;
    }
    if (!submission) {
      // P1 防线：partial unique + 撞墙自愈（双设备同扫的并发输家拿赢家那条）
      submission = await createRealSubmissionSafe<StudentSubmission>(this.prisma, {
        assignmentId: session.paperAssignmentId,
        studentId,
        maxScore: paperForMax?.totalMarksActual ?? 0,
      });
    } else if (
      isSecondWindowScan &&
      submission.status === 'submitted' &&
      submission.finalSubmittedAt == null
    ) {
      // 第二作答窗（2026-08-20 新政）：早上 09:00 被自动收卷的学生
      // 下午回来续答。把答卷退回 in_progress —— saveAnswer 和
      // finalSubmit 都硬性要求 in_progress，不退回的话学生进得来、
      // 一个字也存不下。
      //
      // 只退「暂存提交」的（finalSubmittedAt == null）。学生自己点过
      // 「交卷并查看答案」的已经看过答案，退回去就是让他照着答案改
      // 满分 —— 那种答卷这里一律不碰。
      //
      // autoScore / totalScore 清零：早上那次自动判分是针对旧答案的，
      // 学生改完后 finalSubmit 会整卷重判。留着旧分数的话，万一
      // 17:30 前他没再交，收尾流程盖的就是一份对不上答案的分数。
      const reopened = await this.prisma.studentSubmission.updateMany({
        where: { id: submission.id, status: 'submitted', finalSubmittedAt: null },
        data: { status: 'in_progress', autoScore: null, totalScore: null },
      });
      if (reopened.count > 0) {
        this.logger?.log?.(
          `second-window reopen submission=${submission.id} student=${studentId} session=${session.id}`,
        );
        submission = (await this.prisma.studentSubmission.findUnique({
          where: { id: submission.id },
        }))!;
      }
    }

    if (attendance.submissionId !== submission.id) {
      await this.prisma.attendance.update({
        where: { id: attendance.id },
        data: { submissionId: submission.id },
      });
    }

    // 短文层（雅思轻量 / O-Level 基础）的配套词表：**扫码时推给本人**。
    //
    // 原来是建场时推全班 —— 但学生选哪个难度是扫码这一刻才定的，班里
    // 五个层混坐，推全班意味着只做雅思真题的学生也收到基础层的词，
    // 卡片例句来自他从没读过的文章，「复习你自己读过的句子」这个核心
    // 承诺对他是破的。改到扫码时：谁坐进这一层、谁收这一层的词，例句
    // 就是他当天读的那篇。幂等（(studentId, headword) 唯一约束 +
    // skipDuplicates），第二窗再扫一次也安全。失败只记日志，绝不挡签到。
    if (levelPushesWordlist(session.level as any)) {
      await this.pushListToStudent(
        studentId,
        resolveWordlistForPaperConfig(paperForMax?.config as any),
        'wordlist',
      );
    }
    // 每周小主线（研究性分析 #3）：本周第一次扫码时把 15 个主线词推给
    // 本人；之后每天扫码重复推是幂等 no-op。只有在周表 json 里配了该
    // 层级轨道的层才会推（试点 = 两个轻量层），没配的层 resolve 返回
    // null 直接跳过。
    await this.pushListToStudent(
      studentId,
      resolveWeeklyTrack(session.level as any, new Date()),
      'weekly-track',
    );

    await this.shuffle.getOrCreate(studentId, paperId);

    // Mint scan token — same shape as the login JWT (so existing AuthGuard
    // accepts it without changes).
    //
    // 有效期 = **当天结束**（SGT 23:59:59），不再绑答题窗口。
    //
    // 原来绑 quizEnd(09:00)/makeupEnd(17:30)，因为那时 token 唯一的用途
    // 就是答题。2026-08-25 起它还是学生端**写操作的凭证**（加词、复习
    // 评分、撤销、错题销账 —— 见 student-identity.guard），而背单词/
    // 重做错题是全天可做的：token 17:30 过期会让晚上想背词的学生撞 403。
    //
    // 放长不放松：答题窗口由 morning-quiz 服务端独立校验，token 活得久
    // 并不等于能在窗口外答题；它只证明「今天扫过码的确实是这个人」。
    // 答题窗口何时关 —— 给学生显示「还剩几分钟」用。
    // 注意与下面的 token 有效期**分开**：窗口管的是「还能不能答题」，
    // token 管的是「你是谁」，两者的生命周期本就不同。
    const windowEndsAt =
      session.makeupEnd && session.makeupEnd.getTime() > session.quizEnd.getTime()
        ? session.makeupEnd
        : session.quizEnd;

    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const localNow = new Date(Date.now() + tzOff * 60_000);
    const endOfLocalDay = new Date(
      Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate(),
        23, 59, 59,
      ) - tzOff * 60_000,
    );
    const expSeconds = Math.max(60, Math.floor((endOfLocalDay.getTime() - Date.now()) / 1000));
    const scanToken = await this.jwt.signAsync(
      {
        id: student.id,
        email: student.email,
        role: 'student',
        name: student.name,
      },
      { expiresIn: expSeconds },
    );

    // Cross-device handoff token. Students scan on a phone but often want
    // to answer on a MacBook (bigger screen, real keyboard for the
    // short-answer items) by AirDropping the quiz link across. AirDrop
    // only carries the URL — not the phone's localStorage — so the second
    // device has no auth and the SPA bounces it to /my-history. We embed
    // this token in the quiz URL's hash fragment (never sent to the
    // server, so it stays out of logs/referrers) so the second device can
    // authenticate. It is scoped to THIS session only (scope='mq_handoff',
    // mqs=session.id) and the AuthGuard rejects it everywhere else, so a
    // mis-shared link can answer this one quiz and nothing more.
    const handoffToken = await this.jwt.signAsync(
      {
        id: student.id,
        email: student.email,
        role: 'student',
        name: student.name,
        scope: 'mq_handoff',
        mqs: session.id,
      },
      { expiresIn: expSeconds },
    );

    await this.audit.log({
      actorId: studentId,
      actorRole: 'student',
      action: 'attendance.scan',
      entityType: 'MorningQuizSession',
      entityId: session.id,
      ip: sourceIp,
      metadata: { attendanceStatus, paperId, source: 'roster_pick' },
    });

    // 剩余时间按「当天最后一个还开着的窗」算 —— 拿 quizEnd 减，第二窗
    // 内必然是负数，学生扫完码看到「剩余 0 分钟」。
    const remainingMs = windowEndsAt.getTime() - now.getTime();
    const finalSub = await this.prisma.studentSubmission.findUnique({
      where: { id: submission.id },
      select: { finalSubmittedAt: true },
    });
    // PIN 状态（2026-08-25）：没设过的学生在扫码成功页会看到「设置 PIN」
    // 卡片 —— 扫码时刻是设置 PIN 的信任根（人在教室、名字是自己选的）
    const pinRow = await this.prisma.user.findUnique({
      where: { id: student.id },
      select: { pinHash: true },
    });
    return {
      attendance: { id: attendance.id, status: attendanceStatus, scanTime: now },
      student: { id: student.id, name: student.name },
      alreadyFinalSubmitted: finalSub?.finalSubmittedAt != null,
      pinSet: pinRow?.pinHash != null,
      scanToken,
      // Hash fragment, not query: keeps the handoff token off the wire
      // (no server logs, no Referer leak) — the SPA reads it client-side
      // and strips it from the address bar after adopting.
      quizUrl: `/morning-quiz/${session.id}#h=${handoffToken}`,
      remainingMinutes: Math.max(0, Math.floor(remainingMs / 60_000)),
    };
  }

  /**
   * 把一份词表推进**一个学生**的生词本。当日文章词表与每周主线共用。
   *
   * 词表在入库/authoring 时已逐词核对过 ECDICT 存在性，这里只做一次
   * 存在性过滤兜底（词典变更/词表未审计时不至于塞进查不到释义的词）。
   * 幂等（(studentId, headword) 唯一约束 + skipDuplicates），第二窗
   * 再扫一次也安全。失败只记日志，**绝不挡签到**。
   */
  private async pushListToStudent(
    studentId: string,
    list: { story: string; items: Array<{ word: string; context: string }> } | null,
    tag: string,
  ): Promise<void> {
    if (!list?.items.length) return;
    try {
      const inDict = await this.prisma.dictEntry.findMany({
        where: { word: { in: list.items.map((i) => i.word.toLowerCase()) } },
        select: { word: true },
      });
      const ok = new Set(inDict.map((d) => d.word));
      const rows = list.items
        .filter((i) => ok.has(i.word.toLowerCase()))
        .map((i) => ({
          studentId,
          headword: i.word.toLowerCase(),
          surfaceForm: i.word.toLowerCase(),
          sourceType: 'teacher_push' as const,
          contextSentence: (i.context ?? '').slice(0, 500),
          sourcePassageTitle: list.story,
        }));
      if (!rows.length) return;
      const r = await this.prisma.studentWord.createMany({ data: rows, skipDuplicates: true });
      if (r.count > 0) {
        this.logger.log(
          `${tag} pushed at scan: story=${list.story} student=${studentId} created=${r.count}`,
        );
      }
    } catch (e: any) {
      this.logger.warn(`scan-time ${tag} push failed: ${e?.message ?? e}`);
    }
  }

  /**
   * Admin manual override. Allows class teachers to mark a student
   * present/late/absent outside the QR flow (forgot phone, dead battery,
   * arrived after late cutoff, etc.). Audit-logged with reason.
   */
  async correct(
    body: { sessionId: string; studentId: string; status: AttendanceStatus; note?: string },
    actor: ActorCtx,
  ) {
    if (!['admin', 'head_teacher'].includes(actor.role) && actor.role !== 'teacher') {
      throw new ForbiddenException({ code: 'admin_or_teacher_required' });
    }
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: body.sessionId },
      include: { paperAssignment: { select: { id: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });

    // Round 2 IDOR fix — a regular teacher must teach the target session's
    // class. Without this a teacher of any class could mutate any other
    // class's attendance by guessing sessionIds. Admin / head_teacher
    // are school-wide and always pass.
    if (!(await canActOnClass(this.prisma, actor, session.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }

    const enrollment = await this.prisma.classEnrollment.findUnique({
      where: { classId_userId: { classId: session.classId, userId: body.studentId } },
    });
    if (!enrollment || enrollment.role !== 'student') {
      throw new BadRequestException({ code: 'student_not_in_session_class' });
    }

    const before = await this.prisma.attendance.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: body.studentId } },
    });

    const after = await this.prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: body.studentId } },
      create: {
        sessionId: session.id,
        studentId: body.studentId,
        status: body.status,
        scanTime: null,
        source: AttendanceSource.manual_correction,
        correctedById: actor.id,
        correctedNote: body.note ?? null,
        sourceIp: actor.ip,
      },
      update: {
        status: body.status,
        source: AttendanceSource.manual_correction,
        correctedById: actor.id,
        correctedNote: body.note ?? null,
      },
    });

    // If the override marks the student present (on_time | late) and they have
    // no submission yet, open one so they can still take the quiz.
    if (after.status !== AttendanceStatus.absent && !after.submissionId) {
      // R10-fix: pull paper.totalMarksActual so the result page denominator
      // is right when this manually-corrected student eventually submits.
      const paperForMax = await this.prisma.paper.findUnique({
        where: { id: (await this.prisma.paperAssignment.findUnique({
          where: { id: session.paperAssignmentId }, select: { paperId: true },
        }))?.paperId ?? '' },
        select: { totalMarksActual: true },
      });
      // R14 — see attendance.service.ts:scanQr for the @@unique-drop note
      let submission = await this.prisma.studentSubmission.findFirst({
        where: {
          assignmentId: session.paperAssignmentId,
          studentId: body.studentId,
          status: { not: 'practice' },
        },
      });
      if (!submission) {
        // P1 防线：同 scanQr —— 教师补登与学生扫码并发时也不产双答卷
        submission = await createRealSubmissionSafe<StudentSubmission>(this.prisma, {
          assignmentId: session.paperAssignmentId,
          studentId: body.studentId,
          maxScore: paperForMax?.totalMarksActual ?? 0,
        });
      }
      await this.prisma.attendance.update({
        where: { id: after.id },
        data: { submissionId: submission.id },
      });
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'attendance.correct',
      entityType: 'Attendance',
      entityId: after.id,
      ip: actor.ip,
      diff: { before, after },
      metadata: { sessionId: session.id, studentId: body.studentId, note: body.note ?? null },
    });

    return after;
  }

  /**
   * F7 — bulk variant of `correct`. Iterates the same single-row logic
   * sequentially (not Promise.all) so a partial failure leaves a
   * deterministic prefix of successful rows and a per-row `errors[]`
   * for the failed ones. Returns `{ corrected: number, errors: [...] }`.
   * Each row reuses `correct()` (including its own audit log + class
   * ownership check) — duplicating that logic would risk drift.
   */
  async correctBulk(
    body: { sessionId: string; studentIds: string[]; status: AttendanceStatus; note: string },
    actor: ActorCtx,
  ) {
    let corrected = 0;
    const errors: Array<{ studentId: string; reason: string }> = [];
    for (const studentId of body.studentIds) {
      try {
        await this.correct(
          {
            sessionId: body.sessionId,
            studentId,
            status: body.status,
            note: body.note,
          },
          actor,
        );
        corrected += 1;
      } catch (e: any) {
        const reason =
          typeof e?.response === 'object' && e?.response?.code
            ? e.response.code
            : e?.message ?? 'unknown_error';
        errors.push({ studentId, reason });
      }
    }
    return { corrected, errors };
  }

  async historyForClass(actor: ActorCtx, classId: string, from?: Date, to?: Date) {
    // Round 2 IDOR fix — gate by class ownership. Without this a teacher
    // of class A could enumerate every attendance row of class B.
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    return this.prisma.attendance.findMany({
      where: {
        session: {
          classId,
          ...(from || to
            ? {
                date: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        session: { select: { id: true, date: true, status: true } },
      },
      orderBy: [{ session: { date: 'desc' } }, { status: 'asc' }],
    });
  }
}
