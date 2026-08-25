import { PrismaClient } from '@prisma/client';
import { diffAnswer } from '../src/morning-quiz/answer-diff';
import { anonId } from '../src/common/anon-id';

/**
 * Dump today's marker queue — all submissions with ungraded short_answer
 * / structured / essay scripts — to stdout in a Claude-friendly format.
 *
 * Read-only. No JWT needed. Run on Railway:
 *   railway run -- npx ts-node apps/api/scripts/marker-dump.ts
 *
 * 默认输出**匿名代号**（S-1234）而非姓名 —— 这份 dump 会进外部对话，
 * 姓名不是判分所需。加 --with-names 才输出真实姓名。
 *
 * Per the [[ai-api-usage-policy]] — short-answer grading is done by
 * Claude in chat, NEVER via the API's evaluateBatch. This script
 * surfaces the data; pair with marker-apply.ts to write back.
 */

const prisma = new PrismaClient();

/**
 * 去标识化开关。默认**不输出真实姓名** —— 这份 dump 要交给外部对话
 * 判分，姓名+成绩+答案合起来是可识别的个人数据。
 * 需要人工核对身份时加 --with-names。
 */
const SHOW_NAMES = process.argv.includes('--with-names');


(async () => {
  const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
  const now = new Date();
  const localNow = new Date(now.getTime() + tzOff * 60_000);
  const today = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()),
  );
  const todayIso = today.toISOString().slice(0, 10);

  // 默认排今天的队列；补判 / 隔天判分时用 --dates 2026-08-19,2026-08-20
  // 明确指定。session.date 存的是 attendanceStart（00:30 UTC 挂钟），
  // 不是零点，所以只能按 [日期 00:00, 次日 00:00) 的范围查，不能拿
  // 日期字符串精确匹配。
  const datesArg = (() => {
    const i = process.argv.indexOf('--dates');
    return i >= 0 ? process.argv[i + 1] : undefined;
  })();
  const dateList = datesArg
    ? datesArg.split(',').map((x) => x.trim()).filter(Boolean).sort()
    : [todayIso];
  const rangeStart = new Date(`${dateList[0]}T00:00:00.000Z`);
  const rangeEnd = new Date(
    new Date(`${dateList[dateList.length - 1]}T00:00:00.000Z`).getTime() + 86_400_000,
  );
  const dateIso = dateList.join(', ');

  const sessions = (
    await prisma.morningQuizSession.findMany({
      where: { date: { gte: rangeStart, lt: rangeEnd } },
      select: {
        id: true,
        date: true,
        level: true,
        paperAssignmentId: true,
        class: { select: { name: true } },
      },
    })
  ).filter((s) => dateList.includes(s.date.toISOString().slice(0, 10)));
  const assignmentIds = sessions.map((s) => s.paperAssignmentId);

  const submissions = await prisma.studentSubmission.findMany({
    where: {
      assignmentId: { in: assignmentIds },
      status: 'submitted',
      scripts: {
        some: {
          awardedMarks: null,
          paperQuestion: {
            question: {
              questionType: { in: ['structured', 'short_answer', 'essay'] },
            },
          },
        },
      },
    },
    include: {
      student: { select: { name: true } },
      assignment: { include: { paper: { select: { name: true } } } },
      scripts: {
        include: {
          paperQuestion: {
            include: {
              question: {
                select: {
                  questionType: true,
                  content: true,
                  answerContent: true,
                  options: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: 'asc' },
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`MARKER QUEUE DUMP · ${dateIso} (SGT)`);
  console.log(`Sessions: ${sessions.length}`);
  console.log(`Submissions awaiting marker: ${submissions.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const sub of submissions) {
    const sess = sessions.find((s) => s.paperAssignmentId === sub.assignmentId);
    const ungraded = sub.scripts.filter(
      (sc) =>
        sc.awardedMarks == null &&
        ['structured', 'short_answer', 'essay'].includes(sc.paperQuestion.question.questionType),
    );
    if (ungraded.length === 0) continue;

    console.log('─'.repeat(60));
    console.log(`SUBMISSION ${sub.id}`);
    // 去标识化（2026-08-25 外部审查 P0-7）：判分只需要「哪份答卷、
    // 什么题、学生写了什么」，**不需要知道他叫什么**。默认输出匿名
    // 代号；真要核对身份时显式加 --with-names。
    //
    // 为什么这很重要：这份 dump 会被贴进对话交给 Claude 判分，姓名 +
    // 成绩 + 答题内容合起来是可识别的个人数据（PDPC 口径）。判分结果
    // 靠 scriptId 写回，全程不需要姓名参与。
    console.log(`  Student: ${SHOW_NAMES ? sub.student.name : anonId(sub.studentId)}`);
    console.log(`  Class:   ${sess?.class.name ?? '?'}  Level: ${sess?.level ?? '?'}`);
    console.log(`  Paper:   ${sub.assignment.paper.name}`);
    console.log(`  Auto score so far: ${sub.autoScore ?? 0} / ${sub.maxScore}`);
    console.log(`  Submitted at: ${sub.submittedAt?.toISOString() ?? '?'}`);
    console.log(`  Scripts to grade: ${ungraded.length}`);
    console.log('');

    for (const sc of ungraded) {
      const pq = sc.paperQuestion as any;
      const q = pq.question;
      const stem =
        // Prefer the snapshot (frozen at paper publication) for stability
        pq.snapshotContent?.stem ??
        q.content?.stem ??
        JSON.stringify(pq.snapshotContent ?? q.content ?? {}).slice(0, 200);
      const passage =
        pq.snapshotContent?.passage ??
        q.content?.passage ??
        null;
      const markScheme =
        pq.snapshotAnswer?.text ??
        pq.snapshotAnswer?.markScheme ??
        q.answerContent?.text ??
        q.answerContent?.markScheme ??
        JSON.stringify(pq.snapshotAnswer ?? q.answerContent ?? {}).slice(0, 200);
      const studentAns = sc.textAnswer ?? sc.selectedOption ?? '<blank>';

      console.log(`  ── Script ${sc.id}  [${q.questionType}]  maxMarks=${pq.marks}`);
      if (passage) {
        const trimmed = String(passage).replace(/\s+/g, ' ').trim();
        console.log(
          `    Passage: ${trimmed.length > 300 ? trimmed.slice(0, 300) + '…' : trimmed}`,
        );
      }
      console.log(`    Stem:        ${String(stem).replace(/\s+/g, ' ').trim()}`);
      console.log(`    Mark scheme: ${String(markScheme).replace(/\s+/g, ' ').trim()}`);
      console.log(`    Student ans: ${String(studentAns).replace(/\s+/g, ' ').trim()}`);
      // 机械差异分析（2026-08-24）。只对短答案有意义 —— 雅思填空里
      // 「culture / cultures」这类差异，人逐条肉眼比对既慢又容易看漏。
      // 它**只说差在哪，不给分**：雅思真考里单复数错就是错，让机器自动
      // 放行等于骗学生。判几分仍然由判分人决定。
      const dx = diffAnswer(
        typeof studentAns === 'string' ? studentAns : null,
        typeof markScheme === 'string' ? markScheme : null,
      );
      if (dx.kind !== 'long_answer') {
        console.log(
          `    ⟨差异⟩ ${dx.kind}${dx.wrongInExam ? ' · 真考算错' : ' · 真考不扣分'} — ${dx.note}`,
        );
      }
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`END DUMP — ${submissions.length} submission(s)`);
  await prisma.$disconnect();
})();
