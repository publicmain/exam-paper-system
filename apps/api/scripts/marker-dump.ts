import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
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

// 本机通过 `railway run -s Postgres -e production` 跑：那里只有公网代理地址
// （DATABASE_PUBLIC_URL）能连上，DATABASE_URL 指向的 postgres.railway.internal
// 只在 Railway 内网可达。与 prepare-pilot-week.js 同一口径。
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
});

/**
 * 去标识化开关。默认**不输出真实姓名** —— 这份 dump 要交给外部对话
 * 判分，姓名+成绩+答案合起来是可识别的个人数据。
 * 需要人工核对身份时加 --with-names。
 */
const SHOW_NAMES = process.argv.includes('--with-names');

/**
 * `--json=<path>`：把同一份队列再写成 JSON（scriptId / 匿名代号 / 题干 /
 * 参考答案 / rubric / accept / 原文依据 / 学生答案），判分文件
 * （marker-apply.ts 的 --file）就照着它的 scriptId 写。默认只打印文本。
 */
const JSON_OUT = (() => {
  const hit = process.argv.find((a) => a.startsWith('--json='));
  if (hit) return hit.slice('--json='.length);
  const i = process.argv.indexOf('--json');
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : undefined;
})();

type DumpScript = {
  scriptId: string;
  questionType: string;
  maxMarks: number;
  stem: string;
  reference: string | null;
  accept: string[];
  rubric: string | null;
  evidence: string | null;
  studentAnswer: string | null;
};
type DumpSubmission = {
  submissionId: string;
  student: string;
  className: string;
  level: string | null;
  paper: string;
  autoScore: number;
  maxScore: number;
  scripts: DumpScript[];
};


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

  const jsonOut: { dates: string[]; passages: Record<string, string>; submissions: DumpSubmission[] } = {
    dates: dateList,
    passages: {},
    submissions: [],
  };

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

    const dumpSub: DumpSubmission = {
      submissionId: sub.id,
      student: SHOW_NAMES ? sub.student.name : anonId(sub.studentId),
      className: sess?.class.name ?? '?',
      level: sess?.level ?? null,
      paper: sub.assignment.paper.name,
      autoScore: sub.autoScore ?? 0,
      maxScore: sub.maxScore,
      scripts: [],
    };

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
      // 答案材料：快照优先，题库现值兜底。首发周内容包写的是
      // text / accept / rubric / evidence（见 prepare-pilot-week.js）；
      // 旧 fixture 只有 text / markScheme。
      const ansSrc = [pq.snapshotAnswer, q.answerContent].filter(
        (x) => x && typeof x === 'object' && !Array.isArray(x),
      ) as Array<Record<string, unknown>>;
      const pickStr = (...keys: string[]) => {
        for (const src of ansSrc) {
          for (const k of keys) {
            const v = src[k];
            if (typeof v === 'string' && v.trim()) return v;
          }
        }
        return null;
      };
      const markScheme =
        pickStr('text', 'markScheme') ??
        JSON.stringify(pq.snapshotAnswer ?? q.answerContent ?? {}).slice(0, 200);
      const rubric = pickStr('rubric');
      const evidence = pickStr('evidence');
      const accept = (() => {
        for (const src of ansSrc) {
          if (Array.isArray(src.accept)) return src.accept.map(String);
        }
        return [] as string[];
      })();
      const studentAns = sc.textAnswer ?? sc.selectedOption ?? '<blank>';

      console.log(`  ── Script ${sc.id}  [${q.questionType}]  maxMarks=${pq.marks}`);
      if (passage) {
        const trimmed = String(passage).replace(/\s+/g, ' ').trim();
        if (!jsonOut.passages[sub.assignment.paper.name]) {
          jsonOut.passages[sub.assignment.paper.name] = String(passage);
        }
        console.log(
          `    Passage: ${trimmed.length > 300 ? trimmed.slice(0, 300) + '…' : trimmed}`,
        );
      }
      console.log(`    Stem:        ${String(stem).replace(/\s+/g, ' ').trim()}`);
      console.log(`    Mark scheme: ${String(markScheme).replace(/\s+/g, ' ').trim()}`);
      if (accept.length > 1) console.log(`    Accept:      ${accept.join(' / ')}`);
      if (rubric) console.log(`    Rubric:      ${rubric.replace(/\s+/g, ' ').trim()}`);
      if (evidence) console.log(`    Evidence:    ${evidence.replace(/\s+/g, ' ').trim()}`);
      console.log(`    Student ans: ${String(studentAns).replace(/\s+/g, ' ').trim()}`);
      dumpSub.scripts.push({
        scriptId: sc.id,
        questionType: q.questionType,
        maxMarks: pq.marks,
        stem: String(stem),
        reference: typeof markScheme === 'string' ? markScheme : null,
        accept,
        rubric,
        evidence,
        studentAnswer: sc.textAnswer ?? sc.selectedOption ?? null,
      });
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
    jsonOut.submissions.push(dumpSub);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`END DUMP — ${submissions.length} submission(s)`);
  if (JSON_OUT) {
    const target = resolve(process.cwd(), JSON_OUT);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(jsonOut, null, 2) + '\n', 'utf8');
    console.log(`JSON 已写到 ${target}（${jsonOut.submissions.length} 份答卷）`);
  }
  await prisma.$disconnect();
})();
