import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import { MorningQuizService } from '../src/morning-quiz/morning-quiz.service';
import { QrService } from '../src/qr/qr.service';
import { MorningQuizCron } from '../src/morning-quiz/morning-quiz.cron';
import { MorningQuizStatus } from '@prisma/client';

/**
 * 第二作答窗的**浏览器**端到端验证 —— 搭台 / 推进 / 拆台。
 *
 * e2e-second-window.ts 直接调 service，验证的是后端链路。这个脚本
 * 验证的是学生真正会看到的东西：交卷弹窗有没有两个按钮、暂存后成绩
 * 页是不是扣着答案并给出「下午还能改」的提示、下午回来能不能改。
 *
 * 用法（全部只碰自建的临时班级，真实数据一行不动）：
 *   --setup    建临时班级/学生/场次，输出可直接打开的 URL
 *   --morning  模拟 09:00 收卷（暂存），之后可刷新页面看扣答案的效果
 *   --open     开第二作答窗，输出下午续答的 URL
 *   --close    模拟 17:30 收尾（把没最终提交的解锁）
 *   --drop     拆台，删掉本脚本建的一切
 *   --status   打印当前状态
 *
 *   DATABASE_URL=... npx ts-node apps/api/scripts/e2e-second-window-ui.ts --setup
 */

const TAG = 'e2e-sw-ui';
const WEB = process.env.WEB_ORIGIN ?? 'https://nurturing-radiance-production.up.railway.app';

const arg = (n: string) => process.argv.includes(`--${n}`);

(async () => {
  process.env.BOOTSTRAP_CONTENT_DISABLED = 'true';
  process.env.MORNING_QUIZ_SECOND_WINDOW = 'on';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const attendance = app.get(AttendanceService);
  const mq = app.get(MorningQuizService);
  const qr = app.get(QrService);
  const cron = app.get(MorningQuizCron);

  const findCls = () =>
    prisma.class.findFirst({ where: { name: { startsWith: TAG } }, select: { id: true, name: true } });

  async function status() {
    const cls = await findCls();
    if (!cls) return console.log('没有 e2e-sw-ui 现场。先跑 --setup。');
    const s = await prisma.morningQuizSession.findFirst({
      where: { classId: cls.id },
      select: { id: true, status: true, quizEnd: true, makeupStart: true, makeupEnd: true, paperAssignmentId: true },
    });
    console.log(`班级 ${cls.name}  session=${s?.id}  status=${s?.status}`);
    console.log(`  quizEnd=${s?.quizEnd?.toISOString()}  第二窗=${s?.makeupStart?.toISOString() ?? '未开'} → ${s?.makeupEnd?.toISOString() ?? ''}`);
    const subs = await prisma.studentSubmission.findMany({
      where: { assignmentId: s?.paperAssignmentId },
      select: { id: true, status: true, finalSubmittedAt: true, autoScore: true, student: { select: { name: true } } },
    });
    for (const x of subs) {
      console.log(
        `  ${x.student.name}  status=${x.status}  finalSubmittedAt=${x.finalSubmittedAt ? '有(答案已公布)' : '空(暂存,答案扣住)'}  autoScore=${x.autoScore}`,
      );
    }
  }

  try {
    if (arg('drop')) {
      const cls = await findCls();
      if (!cls) { console.log('没有现场可拆。'); }
      else {
        const subs = await prisma.studentSubmission.findMany({
          where: { assignment: { classId: cls.id } }, select: { id: true },
        });
        const papers = await prisma.paperAssignment.findMany({
          where: { classId: cls.id }, select: { paperId: true },
        });
        await prisma.answerScript.deleteMany({ where: { submissionId: { in: subs.map((s) => s.id) } } });
        await prisma.attendance.deleteMany({ where: { session: { classId: cls.id } } });
        await prisma.studentSubmission.deleteMany({ where: { assignment: { classId: cls.id } } });
        await prisma.morningQuizSession.deleteMany({ where: { classId: cls.id } });
        await prisma.paperAssignment.deleteMany({ where: { classId: cls.id } });
        for (const p of papers) {
          await prisma.paperQuestion.deleteMany({ where: { paperId: p.paperId } });
          await prisma.paper.deleteMany({ where: { id: p.paperId } });
        }
        await prisma.classEnrollment.deleteMany({ where: { classId: cls.id } });
        await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
        await prisma.class.deleteMany({ where: { id: cls.id } });
        console.log('已拆台 —— 真实数据一行未动。');
      }
    } else if (arg('setup')) {
      const admin = await prisma.user.findFirst({ where: { role: 'admin', isActive: true }, select: { id: true } });
      const actor = { id: admin!.id, role: 'admin', ip: null };
      const stamp = Date.now().toString(36).toUpperCase();
      const cls = await prisma.class.create({
        data: { name: `${TAG} 临时班级 ${stamp}`, classCode: `E2ESWUI${stamp}` },
      });
      const bcrypt = await import('bcryptjs');
      const u = await prisma.user.create({
        data: {
          email: `${TAG}-${stamp}@e2e.local`,
          name: `二窗验证同学${stamp.slice(-3)}`,
          role: 'student',
          passwordHash: await bcrypt.hash('e2e-no-login', 4),
          isActive: true,
        },
      });
      await prisma.classEnrollment.create({ data: { classId: cls.id, userId: u.id, role: 'student' } });

      const todayIso = new Date().toISOString().slice(0, 10);
      const paperId = await (mq as any).pickOlevelPaperAndCreatePaper(cls.id, todayIso, actor, {
        provenanceFilter: 'standard',
      });
      const session = await mq.createSession(
        { date: new Date(`${todayIso}T00:00:00.000Z`), classId: cls.id, paperId, level: 'olevel' as any },
        actor as any,
      );
      const now = new Date();
      await prisma.morningQuizSession.update({
        where: { id: session.id },
        data: {
          status: MorningQuizStatus.active,
          attendanceStart: new Date(now.getTime() - 60_000),
          attendanceEnd: new Date(now.getTime() + 30 * 60_000),
          lateCutoff: new Date(now.getTime() + 35 * 60_000),
          quizStart: new Date(now.getTime() - 60_000),
          quizEnd: new Date(now.getTime() + 40 * 60_000),
        },
      });
      const token = qr.staticTokenForClass(cls.id);
      const scan: any = await attendance.scanQr(
        token, u.name!, '127.0.0.1', 'e2e-ui-device', 'e2e-ui', session.id,
      );
      console.log('\n=== 现场已搭好（正式作答窗开着）===');
      console.log(`学生：${u.name}`);
      console.log(`班级：${cls.name}`);
      console.log(`session=${session.id}\n`);
      console.log('在浏览器打开这个链接开始答题：');
      console.log(`${WEB}${scan.quizUrl}\n`);
      console.log('成绩/复盘页（交卷后看这里）：');
      console.log(`${WEB}/my-history?name=${encodeURIComponent(u.name!)}\n`);
    } else if (arg('morning')) {
      const cls = await findCls();
      const s = await prisma.morningQuizSession.findFirst({ where: { classId: cls!.id } });
      await prisma.morningQuizSession.update({
        where: { id: s!.id },
        data: {
          attendanceEnd: new Date(Date.now() - 3000),
          lateCutoff: new Date(Date.now() - 2000),
          quizEnd: new Date(Date.now() - 1000),
        },
      });
      await (cron as any).lockPastSessions(new Date());
      console.log('已模拟 09:00 收卷。今天有第二窗 → 应收成「暂存提交」。');
      await status();
    } else if (arg('open')) {
      const cls = await findCls();
      const s = await prisma.morningQuizSession.findFirst({ where: { classId: cls!.id } });
      await prisma.morningQuizSession.update({
        where: { id: s!.id },
        data: {
          status: MorningQuizStatus.active,
          makeupStart: new Date(Date.now() - 60_000),
          makeupEnd: new Date(Date.now() + 45 * 60_000),
        },
      });
      const u = await prisma.user.findFirst({ where: { email: { startsWith: TAG } } });
      const token = qr.staticTokenForClass(cls!.id);
      const scan: any = await attendance.scanQr(
        token, u!.name!, '127.0.0.1', 'e2e-ui-device', 'e2e-ui', s!.id,
      );
      console.log('\n=== 第二作答窗已开 ===');
      console.log('下午回来续答，在浏览器打开：');
      console.log(`${WEB}${scan.quizUrl}\n`);
      await status();
    } else if (arg('close')) {
      const cls = await findCls();
      const s = await prisma.morningQuizSession.findFirst({ where: { classId: cls!.id } });
      await prisma.morningQuizSession.update({
        where: { id: s!.id },
        data: { status: MorningQuizStatus.active, makeupEnd: new Date(Date.now() - 1000) },
      });
      await (cron as any).lockPastSessions(new Date());
      console.log('已模拟 17:30 收尾 —— 未最终提交的应被解锁。');
      await status();
    } else {
      await status();
    }
  } catch (e: any) {
    console.log(`出错：${e?.response?.code ?? e?.message ?? e}`);
    console.log(String(e?.stack ?? '').split('\n').slice(0, 5).join('\n'));
  }

  await app.close();
  process.exit(0);
})();
