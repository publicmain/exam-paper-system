import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import { MorningQuizService } from '../src/morning-quiz/morning-quiz.service';
import { StudentService } from '../src/student/student.service';
import { QrService } from '../src/qr/qr.service';
import { MorningQuizCron } from '../src/morning-quiz/morning-quiz.cron';
import { MorningQuizStatus } from '@prisma/client';

/**
 * 第二作答窗（16:00–17:30）的端到端验证。
 *
 * 单元测试覆盖的是纯函数（开窗条件、两道门的判定）。这个脚本验证它们
 * 串起来之后**真的能跑**：扫码 → 暂存 → 答案被扣住 → 下午扫码退回可
 * 编辑 → 改答案 → 最终提交 → 答案出现。这条链跨了 4 个 service + 1 个
 * cron，任何一环字段没接上都不会被单元测试发现。
 *
 * **完全不碰真实数据**：自建临时班级 + 临时学生 + 临时场次，跑完全删。
 * 既有的 e2e-prepare.ts 是改真实场次的时间窗再恢复 —— 那正是
 * 2026-08-13 debug-activate 事故的形状，这里不采用。
 *
 *   DATABASE_URL=... npx ts-node apps/api/scripts/e2e-second-window.ts
 *   加 --keep 保留现场不清理（排查失败时用）
 */

const TAG = 'e2e-second-window';
const KEEP = process.argv.includes('--keep');

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    console.log(`  OK  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? '  -- ' + detail : ''}`);
  }
}

(async () => {
  process.env.BOOTSTRAP_CONTENT_DISABLED = 'true';
  // 让第二窗对"今天"生效，否则要等到生效日 8/24
  process.env.MORNING_QUIZ_SECOND_WINDOW = 'on';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const attendance = app.get(AttendanceService);
  const mq = app.get(MorningQuizService);
  const student = app.get(StudentService);
  const qr = app.get(QrService);
  const cron = app.get(MorningQuizCron);

  let classId = '';
  let paperId = '';
  let sessionId = '';

  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    });
    if (!admin) throw new Error('找不到 admin');
    const actor = { id: admin.id, role: 'admin', ip: null };

    // ── 搭台 ──
    const stamp = Date.now().toString(36).toUpperCase();
    const cls = await prisma.class.create({
      data: { name: `${TAG} 临时班级 ${stamp}`, classCode: `E2ESW${stamp}` },
    });
    classId = cls.id;
    const bcrypt = await import('bcryptjs');
    const u = await prisma.user.create({
      data: {
        email: `${TAG}-a-${Date.now().toString(36)}@e2e.local`,
        name: 'E2E第二窗学生A',
        role: 'student',
        passwordHash: await bcrypt.hash('e2e-no-login', 4),
        isActive: true,
      },
    });
    const userId = u.id;
    await prisma.classEnrollment.create({ data: { classId, userId, role: 'student' } });

    const todayIso = new Date().toISOString().slice(0, 10);
    // 终身去重按 classId 记，临时班级不影响真实班级的可选卷池
    paperId = await (mq as any).pickOlevelPaperAndCreatePaper(classId, todayIso, actor, {
      provenanceFilter: 'standard',
    });

    const session = await mq.createSession(
      {
        date: new Date(`${todayIso}T00:00:00.000Z`),
        classId,
        paperId,
        level: 'olevel' as any,
      },
      actor as any,
    );
    sessionId = session.id;

    // 把时间窗锚在此刻，让扫码立即落进正式窗
    const now = new Date();
    await prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        status: MorningQuizStatus.active,
        attendanceStart: new Date(now.getTime() - 60_000),
        attendanceEnd: new Date(now.getTime() + 5 * 60_000),
        lateCutoff: new Date(now.getTime() + 10 * 60_000),
        quizStart: new Date(now.getTime() - 60_000),
        quizEnd: new Date(now.getTime() + 15 * 60_000),
      },
    });
    console.log(`\n搭台完成  class=${classId}  session=${sessionId}\n`);

    const token = qr.staticTokenForClass(classId);
    const pqs = await prisma.paperQuestion.findMany({
      where: { paperId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, sortOrder: true },
    });

    // ══ 1. 早上扫码 ══
    console.log('1. 早上扫码进场');
    const scan1: any = await attendance.scanQr(
      token, u.name!, '127.0.0.1', 'e2e-device-a', 'e2e-agent', sessionId,
    );
    const subRow = await prisma.studentSubmission.findFirst({
      where: { studentId: userId, status: { not: 'practice' } },
      select: { id: true },
    });
    check('扫码建出答卷', !!subRow);
    if (!subRow) throw new Error('没有答卷，后续无法继续');
    const subId = subRow.id;
    void scan1;

    // ══ 2. 答两题后「先存着」 ══
    console.log('\n2. 答 2 题后暂存提交 final=false');
    await mq.saveAnswer(sessionId, { paperQuestionId: pqs[0].id, textAnswer: '早上写的第一题' }, userId);
    await mq.saveAnswer(sessionId, { paperQuestionId: pqs[1].id, textAnswer: '早上写的第二题' }, userId);
    await student.finalSubmit(
      subId, { id: userId, role: 'student', ip: null } as any, { deferAi: true, final: false },
    );
    const afterDraft = await prisma.studentSubmission.findUnique({ where: { id: subId } });
    check('状态翻成 submitted', afterDraft?.status === 'submitted', `实际 ${afterDraft?.status}`);
    check('finalSubmittedAt 为空（答案门的钥匙）', afterDraft?.finalSubmittedAt == null);

    // ══ 3. 暂存状态下答案必须被扣住 ══
    console.log('\n3. 暂存状态下学生看到什么');
    const r1: any = await mq.getStudentResult(sessionId, userId);
    check('answersPending = true', r1.answersPending === true);
    check('scoresPending = true', r1.scoresPending === true);
    const leaked = (r1.items ?? []).filter(
      (it: any) => it.correctAnswer != null || it.referenceAnswer != null || it.explanation != null,
    );
    check('逐题答案全为 null，没有一题泄露', leaked.length === 0, `泄露 ${leaked.length} 题`);

    let checkBlocked = false;
    try {
      await mq.checkAnswer(sessionId, { paperQuestionId: pqs[0].id, textAnswer: 'x' }, userId);
    } catch (e: any) {
      checkBlocked = (e?.response?.code ?? e?.message) === 'answers_pending_final_submit';
    }
    check('单题对答案接口也被挡住（答案的第二个出口）', checkBlocked);

    // ══ 4. 模拟 09:00 收卷 —— 今天有第二窗，应收成暂存 ══
    console.log('\n4. 模拟 09:00 收卷（今天还有第二窗）');
    // 把整个正式窗推到过去 —— 真实场景里下午扫码时 attendanceEnd(08:40)
    // 和 lateCutoff(08:59:59) 早已过期，扫码才会落进第二窗分支。只推
    // quizEnd 的话下午那次扫码会被判成「准时到场」，退回逻辑根本不触发。
    await prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        attendanceEnd: new Date(Date.now() - 3000),
        lateCutoff: new Date(Date.now() - 2000),
        quizEnd: new Date(Date.now() - 1000),
      },
    });
    await (cron as any).lockPastSessions(new Date());
    const afterLock = await prisma.studentSubmission.findUnique({ where: { id: subId } });
    check('收卷后 finalSubmittedAt 仍为空，答案继续扣住', afterLock?.finalSubmittedAt == null);
    const sessLocked = await prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
    check('场次已 locked', sessLocked?.status === 'locked', `实际 ${sessLocked?.status}`);

    // ══ 5. 开第二窗 → 下午扫码 ══
    console.log('\n5. 开第二作答窗，下午扫码回来续答');
    await prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        status: MorningQuizStatus.active,
        makeupStart: new Date(Date.now() - 60_000),
        makeupEnd: new Date(Date.now() + 30 * 60_000),
      },
    });
    const scan2: any = await attendance.scanQr(
      token, u.name!, '127.0.0.1', 'e2e-device-a', 'e2e-agent', sessionId,
    );
    const reopened = await prisma.studentSubmission.findUnique({ where: { id: subId } });
    check('答卷退回 in_progress（不退回则一个字也存不下）',
      reopened?.status === 'in_progress', `实际 ${reopened?.status}`);
    check('早上那次的自动分已清空（判的是旧答案）', reopened?.autoScore == null);

    let ttlMs = 0;
    try {
      const payload = String(scan2?.scanToken ?? '').split('.')[1];
      if (payload) {
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
        ttlMs = decoded.exp * 1000 - Date.now();
      }
    } catch { /* 下面按 0 判失败 */ }
    check('扫码令牌有效期 > 5 分钟（原实现会压成 60 秒）',
      ttlMs > 5 * 60_000, `实际 ${Math.round(ttlMs / 1000)} 秒`);

    // ══ 6. 改早上的答案 + 补答 ══
    console.log('\n6. 修改早上的答案并补答一题');
    await mq.saveAnswer(sessionId, { paperQuestionId: pqs[0].id, textAnswer: '下午改过的第一题' }, userId);
    await mq.saveAnswer(sessionId, { paperQuestionId: pqs[2].id, textAnswer: '下午补答的第三题' }, userId);
    const s1 = await prisma.answerScript.findFirst({
      where: { submissionId: subId, paperQuestionId: pqs[0].id },
    });
    check('早上的答案被成功改写', s1?.textAnswer === '下午改过的第一题', `实际「${s1?.textAnswer}」`);
    const scriptCount = await prisma.answerScript.count({ where: { submissionId: subId } });
    check('补答产生新行而非覆盖，>= 3 行', scriptCount >= 3, `实际 ${scriptCount} 行`);

    // ══ 7. 最终提交 → 答案必须出现 ══
    console.log('\n7. 点「交卷并看答案」');
    await student.finalSubmit(
      subId, { id: userId, role: 'student', ip: null } as any, { deferAi: true, final: true },
    );
    const afterFinal = await prisma.studentSubmission.findUnique({ where: { id: subId } });
    check('finalSubmittedAt 已盖上', afterFinal?.finalSubmittedAt != null);
    const r2: any = await mq.getStudentResult(sessionId, userId);
    check('answersPending = false', r2.answersPending === false);
    const withAnswer = (r2.items ?? []).filter(
      (it: any) => it.correctAnswer != null || it.referenceAnswer != null,
    );
    check('逐题答案已下发', withAnswer.length > 0, `${withAnswer.length}/${r2.items?.length} 题`);
    check('分数仍扣住（还没人工判分）', r2.scoresPending === true);

    // ══ 8. 17:30 收尾解锁 ══
    console.log('\n8. 17:30 收尾（模拟一名下午没回来的学生）');
    const u2 = await prisma.user.create({
      data: {
        email: `${TAG}-b-${Date.now().toString(36)}@e2e.local`,
        name: 'E2E第二窗学生B',
        role: 'student',
        passwordHash: await bcrypt.hash('e2e-no-login', 4),
        isActive: true,
      },
    });
    await prisma.classEnrollment.create({ data: { classId, userId: u2.id, role: 'student' } });
    const asg = await prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { paperAssignmentId: true },
    });
    const sub2 = await prisma.studentSubmission.create({
      data: {
        assignmentId: asg!.paperAssignmentId,
        studentId: u2.id,
        maxScore: 19,
        status: 'submitted',
        submittedAt: new Date(),
      },
    });
    check('B 同学处于暂存状态', sub2.finalSubmittedAt == null);

    await prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: { status: MorningQuizStatus.active, makeupEnd: new Date(Date.now() - 1000) },
    });
    await (cron as any).lockPastSessions(new Date());
    const sub2After = await prisma.studentSubmission.findUnique({ where: { id: sub2.id } });
    check('第二窗结束后 B 的答案被解锁（否则一辈子看不到）',
      sub2After?.finalSubmittedAt != null);
    const aAfter = await prisma.studentSubmission.findUnique({ where: { id: subId } });
    check('已最终提交的 A 时间戳没被改写',
      aAfter?.finalSubmittedAt?.getTime() === afterFinal?.finalSubmittedAt?.getTime());

    // ══ 9. 出勤确实没记 ══
    console.log('\n9. 出勤停用');
    const atts = await prisma.attendance.findMany({
      where: { sessionId },
      select: { status: true, makeupAt: true },
    });
    check('没有产生任何 absent 行',
      atts.every((a) => String(a.status) !== 'absent'),
      JSON.stringify(atts.map((a) => String(a.status))));
    check('第二窗扫码没盖 makeupAt（补考概念已废）', atts.every((a) => a.makeupAt == null));
  } catch (e: any) {
    fail++;
    console.log(`\nFAIL 脚本抛异常：${e?.response?.code ?? e?.message ?? e}`);
    console.log(String(e?.stack ?? '').split('\n').slice(0, 6).join('\n'));
  } finally {
    if (!KEEP && classId) {
      console.log('\n清理临时数据…');
      try {
        const subs = await prisma.studentSubmission.findMany({
          where: { assignment: { classId } },
          select: { id: true },
        });
        await prisma.answerScript.deleteMany({
          where: { submissionId: { in: subs.map((s) => s.id) } },
        });
        await prisma.attendance.deleteMany({ where: { session: { classId } } });
        await prisma.studentSubmission.deleteMany({ where: { assignment: { classId } } });
        await prisma.morningQuizSession.deleteMany({ where: { classId } });
        await prisma.paperAssignment.deleteMany({ where: { classId } });
        if (paperId) {
          await prisma.paperQuestion.deleteMany({ where: { paperId } });
          await prisma.paper.deleteMany({ where: { id: paperId } });
        }
        await prisma.classEnrollment.deleteMany({ where: { classId } });
        await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
        await prisma.class.deleteMany({ where: { id: classId } });
        console.log('清理完成 —— 真实数据一行未动。');
      } catch (e: any) {
        console.log(`清理失败，请手动删 class=${classId}：${e?.message ?? e}`);
      }
    } else if (KEEP) {
      console.log(`\n--keep：现场保留 class=${classId} session=${sessionId}`);
    }
  }

  console.log(`\n${'='.repeat(52)}\n结果：${pass} 通过 · ${fail} 失败\n`);
  await app.close();
  process.exit(fail > 0 ? 1 : 0);
})();
