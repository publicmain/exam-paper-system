import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AttendanceSource,
  AttendanceStatus,
  MorningQuizStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { applyRetractionCredits, autoGradeScripts } from '../student/student.service';
import { WechatNotifyService } from '../wechat-notify/wechat-notify.service';
import { combineLocal } from './morning-quiz.service';
import {
  SECOND_WINDOW_END_LOCAL,
  SECOND_WINDOW_START_LOCAL,
  secondWindowAppliesTo,
  shouldAutoOpenSecondWindow,
} from './second-window';
import { ShortAnswerEvaluatorService } from './short-answer-evaluator.service';


/**
 * Morning quiz lifecycle cron. Runs every minute and acts on three transitions:
 *
 *   T-30s before attendanceStart → status `scheduled` flips to `active` so
 *     /qr/current starts emitting a token and the gate at scan time sees
 *     the right status.
 *
 *   T == quizEnd → status `active` flips to `locked`. Any submission still in
 *     `in_progress` gets force-submitted with the auto-grade pass (mirrors
 *     student.service.finalSubmit). Enrolled students with no Attendance row
 *     get an `absent` row inserted so dashboards see a complete roster.
 *
 * The server-side time check inside attendance.service.scanQr is the hard
 * wall regardless — this cron is a convenience that prevents stale UI states.
 */
@Injectable()
export class MorningQuizCron {
  private readonly logger = new Logger('MorningQuizCron');

  constructor(
    private readonly prisma: PrismaService,
    // R10 — used so the 9:00 lockPastSessions auto-submit also runs the
    // Claude fallback for unsubmitted short_answer items, matching the
    // manual finalSubmit code path.
    private readonly evaluator: ShortAnswerEvaluatorService,
    // F3 + F4 — WeChat notifier for `score_ready` (per-submission, after
    // each AI-grade tx commits) and `mass_absence` (per-session, when
    // >=90% of a >=5-student roster failed to scan in — projector likely
    // died, alert teacher). Both fires are best-effort: try/catch so a
    // notify outage cannot break the lock cron.
    private readonly notify: WechatNotifyService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = new Date();
    await this.activateDueSessions(now);
    await this.lockPastSessions(now);
    await this.autoOpenSecondWindows(now);
  }

  /**
   * 每天 16:00–17:30 的第二作答窗（学校 2026-08-20 新政）。
   *
   * 早上 09:00 正常锁场、自动判客观题 —— 不受影响，只是收成「暂存
   * 提交」（不盖 finalSubmittedAt，答案扣住）。16:00 起当天场次自动
   * 开窗（status 翻回 active，学生扫墙上同一张码即可进入）。17:30 后
   * lockPastSessions 在下一跳重锁，此时 lockOne 认出 makeupEnd 已过，
   * 把还没最终提交的一律盖成最终提交并公布答案。
   *
   * makeupOpenedById 留空 —— 与老师手动开窗（有操作人）区分，报表上
   * 能看出哪天是自动场、哪天是手动加场。
   */
  private async autoOpenSecondWindows(now: Date) {
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const local = new Date(now.getTime() + tzOff * 60_000);
    const nowLocalHHMMSS = local.toISOString().slice(11, 19);
    // 时段外直接返回，不打库（一天 1410 分钟里只有 30 分钟需要查）
    if (nowLocalHHMMSS < SECOND_WINDOW_START_LOCAL || nowLocalHHMMSS >= SECOND_WINDOW_END_LOCAL) return;

    const dateIso = local.toISOString().slice(0, 10);
    const todayUtc = new Date(`${dateIso}T00:00:00.000Z`);
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: {
        date: todayUtc,
        status: MorningQuizStatus.locked,
        makeupStart: null,
        class: { archivedAt: null },
      },
      select: { id: true, classId: true, level: true, status: true, makeupStart: true },
    });
    for (const s of sessions) {
      const open = shouldAutoOpenSecondWindow({
        secondWindowEnv: process.env.MORNING_QUIZ_SECOND_WINDOW,
        dateIsoLocal: dateIso,
        nowLocalHHMMSS,
        weekdayLocal: local.getUTCDay(),
        sessionStatus: s.status,
        makeupStart: s.makeupStart,
      });
      if (!open) continue;
      await this.prisma.morningQuizSession.update({
        where: { id: s.id },
        data: {
          makeupStart: combineLocal(dateIso, SECOND_WINDOW_START_LOCAL, tzOff),
          makeupEnd: combineLocal(dateIso, SECOND_WINDOW_END_LOCAL, tzOff),
          // makeupOpenedById 留 null = 自动开
          status: MorningQuizStatus.active,
        },
      });
      this.logger.log(
        `auto-opened second window sessionId=${s.id} classId=${s.classId} ` +
          `level=${s.level} at=${now.toISOString()}`,
      );
    }
  }

  private async activateDueSessions(now: Date) {
    // r15-followup-30 — pre-activate 5 minutes (was 30s) before
    // attendanceStart. Why: cron only ticks at minute boundaries, so a
    // 30s buffer was ineffective — at the 08:29:00 tick, upper=08:29:30
    // and attendanceStart=08:30:00 > upper → not activated; activation
    // didn't actually happen until the 08:30:00 tick, putting the
    // window's effective open at exactly 08:30:00 sharp. Students who
    // scanned at 08:29:5x (phone camera + Chrome cold start lag) saw
    // "考勤窗口尚未开启" and panicked, then re-scanned with WeChat at
    // 08:30:0x and it worked — the 2026-05-28 report.
    //
    // 5min buffer means the 08:25:00 tick activates today's session
    // (upper=08:30:00, attendanceStart=08:30:00, lte matches). The
    // window of "scheduled" status is now only ~24h overnight instead
    // of the last anxious minute before 08:30. scanQr's gate 5 still
    // blocks submits before attendanceStart, so no extra attendance
    // can be banked early — only the roster lookup is permitted
    // sooner.
    const upper = new Date(now.getTime() + 5 * 60_000);
    const due = await this.prisma.morningQuizSession.findMany({
      where: {
        status: MorningQuizStatus.scheduled,
        attendanceStart: { lte: upper },
        // Don't pre-activate sessions that are already past their quiz end —
        // those should fall through to the lock pass instead.
        quizEnd: { gt: now },
      },
      select: { id: true, classId: true, level: true, attendanceStart: true },
    });
    if (due.length === 0) return;
    await this.prisma.morningQuizSession.updateMany({
      where: { id: { in: due.map((s) => s.id) } },
      data: { status: MorningQuizStatus.active },
    });
    // r15-followup-29 — log the EXACT (session, classId, level, attStart)
    // tuples so when a "学生扫码已结束" report comes in we can confirm
    // which sessions got activated and at what tick. Cron logs are
    // ephemeral; without this you can't reconstruct the morning.
    for (const s of due) {
      this.logger.log(
        `activated sessionId=${s.id} classId=${s.classId} level=${s.level} ` +
          `attStart=${s.attendanceStart.toISOString()} at=${now.toISOString()}`,
      );
    }
  }

  private async lockPastSessions(now: Date) {
    // R15-Audit#2 Finding #3 — exclude sessions whose class has been
    // archived. Otherwise the lock cron would still fire mass_absence
    // notifications for a class admins already retired.
    const expired = await this.prisma.morningQuizSession.findMany({
      where: {
        status: { in: [MorningQuizStatus.active, MorningQuizStatus.scheduled] },
        quizEnd: { lte: now },
        class: { archivedAt: null },
        // 补考窗口开着的场次先放过 —— 否则老师中午开了补考，这个
        // 每分钟跑的 cron 会立刻把它锁掉（quizEnd 早上 9 点就过了），
        // 补考窗口活不过一分钟。窗口一关，下一轮 tick 正常收尾。
        OR: [{ makeupEnd: null }, { makeupEnd: { lt: now } }],
      },
      include: {
        // F4: include class.name + paper.name so lockOne can populate the
        // mass_absence + score_ready payloads without an extra round-trip.
        paperAssignment: {
          select: {
            id: true,
            classId: true,
            class: { select: { name: true } },
            paper: { select: { name: true } },
          },
        },
      },
    });
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    for (const session of expired) {
      const dateIso = session.date.toISOString().slice(0, 10);
      // 这一次收卷，是收成「最终提交」（公布答案）还是「暂存提交」
      // （扣住答案，留着下午改）？
      //
      //   · makeupEnd 已过 = 第二窗刚结束，今天没有下一个窗了 → 最终
      //   · 今天根本不适用第二窗（停用 / 生效日前 / 周末）→ 最终，
      //     就是第二窗上线前的老行为
      //   · 否则 = 早上 09:00 收卷，下午还有窗 → 暂存
      //
      // 判断放在这里而不是靠 tick 里的调用顺序：lockPastSessions 跑在
      // autoOpenSecondWindows 之前，17:30 之后这两个都会命中同一场，
      // 依赖顺序的话很容易在某次重构里被悄悄改坏，学生的答案就永远
      // 解锁不了。
      const secondWindowToday = secondWindowAppliesTo({
        secondWindowEnv: process.env.MORNING_QUIZ_SECOND_WINDOW,
        dateIsoLocal: dateIso,
        weekdayLocal: new Date(new Date(session.date).getTime() + tzOff * 60_000).getUTCDay(),
      });
      const secondWindowOver = session.makeupEnd != null && session.makeupEnd <= now;
      const finalizeNow = !secondWindowToday || secondWindowOver;
      await this.lockOne(
        session.id,
        session.paperAssignmentId,
        session.paperAssignment.classId,
        {
          dateIso,
          className: session.paperAssignment.class?.name ?? '',
          paperName: session.paperAssignment.paper?.name ?? '',
        },
        finalizeNow,
      );
    }
  }

  /**
   * Lock + force-submit + mark no-shows.
   *
   * Structure (BUG 7 fix — mirrors `morning-quiz.service.regradeSession`):
   *   1. ONE small fast tx: flip session→locked, flip in_progress→submitted
   *      with autoScore=0 placeholder, insert roster `absent` rows.
   *   2. Load each just-flipped submission's scripts OUTSIDE any tx.
   *   3. Per-submission: run `autoGradeScripts` (slow Claude call,
   *      no tx held), then a tiny per-submission tx to write the
   *      autoScore + per-script awardedMarks. One failure logs + continues.
   *
   * Why — `autoGradeScripts` issues Claude API calls (~2-3s per short_answer
   * item). 30 students × 10 SA items easily exceeds Prisma's 5s interactive-tx
   * timeout, rolling back the entire lock and leaving sessions stuck `active`
   * past their quizEnd. Splitting the AI loop out of the tx eliminates that
   * failure mode.
   *
   * Auto-grading still uses the shared `autoGradeScripts` helper so this
   * branch and the on-time `student.service.finalSubmit` path apply
   * byte-identical grading rules.
   */
  private async lockOne(
    sessionId: string,
    paperAssignmentId: string,
    classId: string,
    // F3 + F4 — display strings + the date used for the dashboard
    // deep-link in mass_absence. Optional so the legacy test harness
    // (which calls lockOne directly) keeps compiling; in production
    // lockPastSessions always supplies them.
    meta?: { dateIso: string; className: string; paperName: string },
    /**
     * 这次收卷算不算「最终提交」。true → 盖 finalSubmittedAt 并公布
     * 答案；false → 暂存，学生 16:00-17:30 还能回来改，在此之前看不到
     * 答案。默认 true 是为了让直接调 lockOne 的既有测试保持原语义。
     */
    finalize = true,
  ) {
    // ── Phase 1: fast lock-and-flip tx ────────────────────────────────
    // Idempotent; subsequent ticks see status=locked and skip.
    // We pre-flip in_progress submissions to `submitted` with autoScore=0
    // so the session is in a consistent state immediately. The AI-grade
    // pass below upgrades autoScore in-place per submission.
    const { inProgressIds, totalRosterCount, claimedCount, isWeekendSession } = await this.prisma.$transaction(async (tx) => {
      await tx.morningQuizSession.update({
        where: { id: sessionId },
        data: { status: MorningQuizStatus.locked },
      });

      // Pull paper.totalMarksActual once for the maxScore back-fill below.
      // Same fix as student.finalSubmit — pre-R10 scanQr wrote maxScore=0
      // and lockPastSessions never corrected it.
      const paperRow = await tx.paperAssignment.findUnique({
        where: { id: paperAssignmentId },
        select: { paper: { select: { totalMarksActual: true } } },
      });
      const correctMax = paperRow?.paper?.totalMarksActual ?? 0;

      // Claim every still-in-progress submission atomically. We capture
      // their ids before flipping so the AI loop below operates only on
      // rows this cron actually transitioned (avoids racing with a
      // student that finalSubmits at the very same tick).
      const claimed = await tx.studentSubmission.findMany({
        where: { assignmentId: paperAssignmentId, status: 'in_progress' },
        select: { id: true },
      });
      if (claimed.length > 0) {
        await tx.studentSubmission.updateMany({
          where: { id: { in: claimed.map((s) => s.id) }, status: 'in_progress' },
          data: {
            submittedAt: new Date(),
            // 早上 09:00 收卷时这里是 undefined —— 刻意的，见上面
            // finalizeNow 的推导。答案门认的就是这一列。
            ...(finalize ? { finalSubmittedAt: new Date() } : {}),
            status: 'submitted',
            autoScore: 0,
            maxScore: correctMax,
          },
        });
      }

      // 17:30 收尾：早上暂存、下午没回来的学生，答卷还停在
      // finalSubmittedAt=null，答案被扣着。今天已经没有下一个窗了，
      // 到这里必须解锁，否则他们的答案永远看不到。
      //
      // 与上面那次 updateMany 是两拨人：上面收的是「此刻还在
      // in_progress」的（下午进来续答没交的），这里收的是「早上就已经
      // submitted 但从未最终提交」的。
      if (finalize) {
        await tx.studentSubmission.updateMany({
          where: {
            assignmentId: paperAssignmentId,
            finalSubmittedAt: null,
            status: { notIn: ['in_progress', 'practice'] },
          },
          data: { finalSubmittedAt: new Date() },
        });
      }

      // Mark roster no-shows as absent. createMany + skipDuplicates leans on
      // the (sessionId, studentId) unique constraint to ignore students who
      // already scanned, instead of N round-trips.
      // BUG 9 fix — exclude isActive=false (withdrawn) students, matching
      // attendance.service:71 so a deactivated account doesn't get a stale
      // `absent` row inserted on every morning-cron lock pass.
      //
      // R15-Audit#3 — a class with 3 levels (ielts_authentic, simplified,
      // olevel) has 3 sessions per day. A student picks ONE level when
      // scanning, so 1 student × 3 sessions = 1 scanned row + 2 absent
      // rows from this cron, EVERY DAY. The 47-student class above
      // produced 141 attendance rows/day and erroneously triggered
      // `mass_absence` on the 2 sibling levels (claimedCount=0 in
      // those sessions even though the student attended).
      //
      // Fix: only this-class-day's FIRST-to-lock session inserts absent
      // rows for the no-show roster. Sibling sessions that lock later
      // observe an already-locked sibling and skip the insert.
      // Dashboard dedupes by studentId so the single absent row covers
      // the whole day's no-show status correctly.
      const sessionRow = await tx.morningQuizSession.findUnique({
        where: { id: sessionId },
        select: { date: true },
      });
      // Defense-in-depth: never seed absent rows for a Sat/Sun session,
      // even if a legacy/manual path slipped one past the createSession
      // boundary guard. School doesn't run morning quiz on weekends,
      // so a "no-show" on those days is not a real absence — see the
      // 2026-05-10 (Sun) G11 incident.
      const sessionWeekday = sessionRow ? sessionRow.date.getUTCDay() : -1;
      const isWeekendSession = sessionWeekday === 0 || sessionWeekday === 6;
      let siblingAlreadyLocked = false;
      if (sessionRow) {
        const otherLocked = await tx.morningQuizSession.count({
          where: {
            classId,
            date: sessionRow.date,
            id: { not: sessionId },
            status: MorningQuizStatus.locked,
          },
        });
        siblingAlreadyLocked = otherLocked > 0;
      }
      const enrollments = await tx.classEnrollment.findMany({
        where: { classId, role: 'student', user: { isActive: true } },
        select: { userId: true },
      });
      // 2026-08-20：早测不再记录出勤（校方决定），停止给未扫码的学生
      // 插缺席行。这行 createMany 是全班缺席数据的唯一来源 —— 关掉它，
      // Attendance 表就只剩「实际扫过码的人」，语义正好是「谁参加了」。
      // 历史数据不动。MORNING_QUIZ_ATTENDANCE_TRACKING=on 可恢复。
      const attendanceTracking = process.env.MORNING_QUIZ_ATTENDANCE_TRACKING === 'on';
      if (attendanceTracking && enrollments.length > 0 && !siblingAlreadyLocked && !isWeekendSession) {
        // Also: skip absent insert for students who already have a
        // non-absent attendance row TODAY in ANY of this class's
        // sessions (covers the "I scanned into level X first, then
        // the OTHER level's cron locked second" ordering).
        const sessionsToday = sessionRow
          ? await tx.morningQuizSession.findMany({
              where: { classId, date: sessionRow.date },
              select: { id: true },
            })
          : [{ id: sessionId }];
        const scannedToday = await tx.attendance.findMany({
          where: {
            sessionId: { in: sessionsToday.map((s) => s.id) },
            status: { not: AttendanceStatus.absent },
          },
          select: { studentId: true },
          distinct: ['studentId'],
        });
        const scannedSet = new Set(scannedToday.map((a) => a.studentId));
        const noShowEnrollments = enrollments.filter(
          (e) => !scannedSet.has(e.userId),
        );
        if (noShowEnrollments.length > 0) {
          await tx.attendance.createMany({
            data: noShowEnrollments.map((e) => ({
              sessionId,
              studentId: e.userId,
              status: AttendanceStatus.absent,
              scanTime: null,
              source: AttendanceSource.qr_scan,
              sourceIp: null,
            })),
            skipDuplicates: true,
          });
        }
      }

      // F4 — measure the roster's claim ratio so the outer fn can decide
      // whether to fire `mass_absence`. R15-Audit#3: a multi-level
      // class has 3 sessions per day; a student scanning into ONE
      // level leaves the OTHER 2 sessions with claimedCount=0 →
      // mass_absence fired erroneously on the sibling levels every
      // morning. Count claims ACROSS the whole class-day, not just
      // this session. The "everyone absent" alarm should fire only
      // when NOBODY scanned anywhere today for this class.
      const claimedCount = sessionRow
        ? await tx.attendance.count({
            where: {
              session: { classId, date: sessionRow.date },
              status: { not: AttendanceStatus.absent },
            },
            // distinct by studentId would be more accurate but Prisma
            // doesn't support it in count(); the duplicate-scan
            // protection in scanQr keeps this approximately equal to
            // unique students.
          })
        : await tx.attendance.count({
            where: { sessionId, status: { not: AttendanceStatus.absent } },
          });

      return {
        inProgressIds: claimed.map((s) => s.id),
        totalRosterCount: enrollments.length,
        claimedCount,
        isWeekendSession,
      };
    });

    // F4 — projector-died guard. Fire BEFORE the (slow) AI-grade loop so
    // the teacher sees the WeChat ping immediately. Threshold: roster of
    // at least 5 and at least 90% of them no-shows. Try/catch isolates
    // notify failure from the cron's hot path.
    const absentCount = totalRosterCount - claimedCount;
    const absentRatio = totalRosterCount > 0 ? absentCount / totalRosterCount : 0;
    if (totalRosterCount >= 5 && absentRatio >= 0.9 && !isWeekendSession) {
      try {
        await this.notify.fire('mass_absence', {
          sessionId,
          classId,
          className: meta?.className ?? '',
          absentCount,
          rosterCount: totalRosterCount,
          paperName: meta?.paperName ?? '',
          dashboardUrl: meta?.dateIso
            ? `/morning-quiz/classes/${classId}/date/${meta.dateIso}/dashboard`
            : `/morning-quiz/sessions/${sessionId}/dashboard`,
        });
      } catch (e: any) {
        this.logger.warn(
          `mass_absence notify failed for session ${sessionId}: ${e?.message ?? e}`,
        );
      }
    }

    // ── Phase 2: AI-grade EVERY submission in the session, NO outer tx ─
    // R15-followup-20 — this is now the single batched AI-grading sweep.
    // The morning-quiz submit path (finalSubmit deferAi=true) scores MCQ
    // inline but parks short answers as pending, so the cohort that
    // submitted on time is sitting here un-AI-graded alongside the
    // stragglers this cron just force-submitted. Grade them all: one
    // batched Claude call per submission, drained sequentially — ~30
    // calls over a few minutes, comfortably under any rate limit.
    //
    // Re-grading an on-time submitter re-runs MCQ (idempotent, same
    // result) and fills in the short-answer scores. Load scripts outside
    // any tx; per submission: batched AI call (slow, no tx) → small
    // write tx. One failure logs + continues — never poison the cohort.
    // ⚠️ 排除 status='marked' —— 那是老师判完并定稿的卷子。
    //
    // 2026-08-13 事故：老师中午重新激活场次开补考，13:53 窗口关闭时
    // 这个 cron 又锁了一次，Phase 2 无条件重判**整场每一份**，而 AI
    // 判分按规定是关着的（走 deferAi），于是早上人工判好的 43 道短答
    // 题被重置回 awardedMarks=null + [ai-pending]，totalScore 也被
    // 覆盖成只算选择题的部分分。学生页面重新显示「待老师批改」。
    //
    // 锁场次必须对已定稿的卷子幂等。
    const allSubs = await this.prisma.studentSubmission.findMany({
      where: {
        assignmentId: paperAssignmentId,
        status: { notIn: ['practice', 'marked'] },
      },
      select: { id: true },
    });
    let graded = 0;
    let gradeFailed = 0;
    for (const { id: subId } of allSubs) {
      try {
        const sub = await this.prisma.studentSubmission.findUnique({
          where: { id: subId },
          include: {
            // F3 — pull student name so the score_ready payload can build
            // the `/my-history?name=...` deeplink without an extra query.
            student: { select: { name: true } },
            scripts: {
              include: {
                paperQuestion: {
                  // R10: include answerContent so autoGradeScripts can grade
                  // short_answer items against the canonical text answer.
                  include: { question: { select: { questionType: true, options: true, answerContent: true, content: true } } },
                },
              },
            },
          },
        });
        if (!sub) continue;

        // 2.0 — 短答是否交给 Claude 判，由环境变量决定，**默认关闭**。
        //
        // 关掉的理由：本校的铁律是零 Anthropic 调用（出题 / 审核 / 判分全部
        // 人工在 chat 里做）。而这里原本无条件把 this.evaluator 传下去，
        // ShortAnswerEvaluatorService 只要 ANTHROPIC_API_KEY 不是占位值就会
        // 建出真实 client —— 线上这个 key 是真的。也就是说每个考试日 09:00
        // 都会对每份含长参考答案短答的提交发一次真实请求，挡住它的只是
        // 「额度是空的」，不是任何开关。一旦充值就会静默开始自动判分。
        //
        // 现在默认走 deferAi：MCQ 照常即时判，短答一律 park 进人工队列，
        // 与老师每天排队判分的实际流程一致。要恢复 AI 判分，在 Railway 上
        // 设 MORNING_QUIZ_AI_GRADING=on 即可，无需改代码。
        const aiGradingOn = process.env.MORNING_QUIZ_AI_GRADING === 'on';
        const rawGrade = aiGradingOn
          ? await autoGradeScripts(sub.scripts, this.evaluator)
          : await autoGradeScripts(sub.scripts, undefined, { deferAi: true });
        // R15-followup-21 — without this sweep the 09:00 lock cron would
        // regrade retracted questions back to 0 (see helper for the
        // 5/26 TFNG case). Retraction always wins.
        const { autoScore, scriptUpdates } = await applyRetractionCredits(
          this.prisma,
          sub.scripts as any,
          rawGrade,
        );

        // Tiny atomic write — well under 5s even with N=20 scripts.
        await this.prisma.$transaction(async (tx) => {
          await tx.studentSubmission.update({
            where: { id: sub.id },
            // R15-followup-20 — also write totalScore. finalSubmit's
            // deferAi path left it at the MCQ-only partial; this sweep
            // produces the final number the marker/parent dashboards
            // read directly. manualScore is null pre-marking → equals
            // autoScore (mirrors finalSubmit / regradeSession).
            data: { autoScore, totalScore: autoScore },
          });
          for (const u of scriptUpdates) {
            // 人工判过的那一条永不覆盖：markedById 有值 = 老师写过分数
            // 和评语，自动流程再怎么跑都不能把它抹掉（同上 2026-08-13
            // 事故）。第二道防线，与上面按 submission 过滤互补 ——
            // 一份卷可能只有部分题被人工判过。
            const already = await tx.answerScript.findUnique({
              where: { id: u.id },
              select: { markedById: true },
            });
            if (already?.markedById) continue;
            await tx.answerScript.update({
              where: { id: u.id },
              data: {
                autoCorrect: u.autoCorrect,
                awardedMarks: u.awardedMarks,
                ...(u.aiReason ? { markerComment: `[ai-grade] ${u.aiReason}` } : {}),
              },
            });
          }
        });
        graded++;

        // F3 — score_ready fires AFTER the per-submission tx commits so a
        // notification can't beat the DB write. Dedup: a follow-up
        // teacher-regrade would re-enter this loop on the same submission
        // and we don't want the student to receive a second WeChat ping.
        // Lookup is per-submissionId on the NotificationLog payload JSON.
        // 2026-08-14 新政：deferAi 路径下 autoScore 只是 MCQ 部分分，
        // 学生分数要等人工判分定稿 —— 这时推「成绩已出」是假消息。
        // 只有 AI 判分真开着（分数即最终）才发。
        if (aiGradingOn) try {
          const prismaAny = this.prisma as any;
          const already = await prismaAny.notificationLog.findFirst({
            where: {
              event: 'score_ready',
              payload: { path: ['submissionId'], equals: sub.id },
            },
            select: { id: true },
          });
          if (!already) {
            const studentName = sub.student?.name ?? '';
            await this.notify.fire('score_ready', {
              submissionId: sub.id,
              studentId: sub.studentId,
              studentName,
              paperName: meta?.paperName ?? '',
              autoScore,
              maxScore: sub.maxScore,
              submittedAt: (sub.submittedAt ?? new Date()).toISOString(),
              resultUrl: `/my-history?name=${encodeURIComponent(studentName)}`,
            });
          }
        } catch (e: any) {
          this.logger.warn(
            `score_ready notify failed for submission ${sub.id}: ${e?.message ?? e}`,
          );
        }
      } catch (e: any) {
        gradeFailed++;
        this.logger.error(
          `auto-grade failed for submission ${subId} in session ${sessionId}: ${e?.message ?? e}`,
        );
        // Continue — submission stays as 'submitted' with autoScore=0
        // placeholder. An admin can regradeSession() to retry.
      }
    }

    this.logger.log(
      `locked session ${sessionId}: force-submitted ${inProgressIds.length} in-progress` +
        ` (auto-graded ${graded}, grade-failed ${gradeFailed}), marked roster no-shows absent`,
    );
  }
}
