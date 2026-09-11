/**
 * CONTENT01 一次性订正：p1_ielts_light_20260909_pq09 / _q09 的评分标准文字。
 *
 * ## 背景
 *
 * 09-09 雅思轻量档「What did Gandhi do in 1930, and why was it against the
 * law?」发布时 marks=1，评分标准却写「两分：行为（走到海边自制盐）与违法
 * 原因（英国垄断制盐）各 1 分。」——分值与评分标准自相矛盾。
 *
 * 只读核对生产（见 docs/audit-2026-09-11/ledger-pub.md CONTENT01）：这份
 * 卷子 totalMarksActual=13 与十题分值合计一致，marks=1 本身没有错，错的
 * 是评分标准文字（按 week2/ielts_light.js 的 buildDay() 设计，这四道简答
 * 题里排第三的那道本来就该是 1 分——07 tidal-power / 08 libraries /
 * rail-time / smell-of-rain 四天的第三道评分标准都正确写「一分」）。已有
 * 2 份 AnswerScript，均 marked、awardedMarks=1（满分），无申诉、无撤题
 * 记录——两个学生当时都拿了满分，**这里不改分、不改 marks、不重算任何
 * 学生的分数**，只把冻结快照里自相矛盾的评分标准文字，订正成内容文件
 * 里已经改好的那句（见 content/week2/ielts_light.js 的同一处改动）。
 *
 * ## 用法
 *
 *   # 1. dry-run（默认；不写库，只打印现状与将要写入的值）：
 *   railway run -s Postgres -e production -- npx ts-node apps/api/scripts/fix-20260909-gandhi-rubric-text.ts
 *
 *   # 2. 核对无误后，加确认串才真的写：
 *   P1_CONFIRM=S12M_FIX_20260909_RUBRIC_TEXT \
 *     railway run -s Postgres -e production -- npx ts-node apps/api/scripts/fix-20260909-gandhi-rubric-text.ts
 *
 * 未经当前会话之外的用户明确授权，不要加确认串执行第 2 步。
 */
import { PrismaClient } from '@prisma/client';

const PQ_ID = 'p1_ielts_light_20260909_pq09';
const Q_ID = 'p1_ielts_light_20260909_q09';
const OLD_RUBRIC = '两分：行为（走到海边自制盐）与违法原因（英国垄断制盐）各 1 分。';
const NEW_RUBRIC = '一分：写出「走到海边自制盐」或「打破了英国对制盐的垄断」任一点即可给分。';
const CONFIRM_TOKEN = 'S12M_FIX_20260909_RUBRIC_TEXT';

type AnswerJson = { text?: string; rubric?: string; evidence?: string; explanation?: string } | null;

function withRubric(json: AnswerJson, rubric: string) {
  return { ...(json ?? {}), rubric };
}

async function main() {
  const confirmed = process.env.P1_CONFIRM === CONFIRM_TOKEN;
  const prisma = new PrismaClient();
  try {
    const pq = await prisma.paperQuestion.findUnique({ where: { id: PQ_ID }, select: { id: true, marks: true, snapshotAnswer: true } });
    const q = await prisma.question.findUnique({ where: { id: Q_ID }, select: { id: true, marks: true, answerContent: true } });
    if (!pq || !q) throw new Error(`目标行不存在：pq=${!!pq} q=${!!q}（库里没有这两行，别往下走）`);

    const pqRubric = (pq.snapshotAnswer as AnswerJson)?.rubric ?? null;
    const qRubric = (q.answerContent as AnswerJson)?.rubric ?? null;

    console.log(`目标：${PQ_ID} / ${Q_ID}`);
    console.log(`marks（不改）：PaperQuestion.marks=${pq.marks}，Question.marks=${q.marks}`);
    console.log(`PaperQuestion.snapshotAnswer.rubric 现状：${JSON.stringify(pqRubric)}`);
    console.log(`Question.answerContent.rubric      现状：${JSON.stringify(qRubric)}`);
    console.log(`将写入的新文字：${JSON.stringify(NEW_RUBRIC)}`);

    if (pqRubric !== OLD_RUBRIC || qRubric !== OLD_RUBRIC) {
      throw new Error(
        '拒绝执行：当前库里的评分标准文字与预期的订正前文字不一致（可能已经被改过，或这不是同一份内容了）。' +
          '停下来，人工核对后再决定怎么处理，不要盲目覆盖。',
      );
    }

    if (!confirmed) {
      console.log('\n[dry-run] 没有写库。上面两行 rubric 就是将要发生的变化——只改这两个 JSON 里的 rubric 字段，');
      console.log('[dry-run] text / evidence / explanation 原样保留，marks 和任何学生的分数都不动。');
      console.log(`[dry-run] 确认无误后，加 P1_CONFIRM=${CONFIRM_TOKEN} 重跑本脚本才会真的写。`);
      return;
    }

    await prisma.$transaction([
      prisma.paperQuestion.update({ where: { id: PQ_ID }, data: { snapshotAnswer: withRubric(pq.snapshotAnswer as AnswerJson, NEW_RUBRIC) } }),
      prisma.question.update({ where: { id: Q_ID }, data: { answerContent: withRubric(q.answerContent as AnswerJson, NEW_RUBRIC) } }),
    ]);
    console.log('\n已写入。marks、AnswerScript.awardedMarks、StudentSubmission 分数均未改动——只订正了评分标准文字。');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('FAILED', e && e.message);
  process.exit(1);
});
