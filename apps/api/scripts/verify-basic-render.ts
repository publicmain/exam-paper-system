import { PrismaClient } from '@prisma/client';

/**
 * O-Level UI 渲染前置校验（10 项审计的最后一项）。
 *
 * 不起浏览器 —— 直接检查前端渲染器依赖的字段是否齐备：
 *   · QuestionTypeRegistry.pickRenderer 靠首题 snapshotContent.uiKind
 *     分派；O-Level 用 olevel_short_answer / olevel_multi_match，
 *     应落到 OLevelComprehension（有 passage 无 IELTS taskType）。
 *   · MCQ 必须有 snapshotOptions（空数组 = 学生看到空 RadioGroup，
 *     2026-05-26 就是这么翻车的）。
 *   · 结果页要能显示正确答案：MCQ 靠 options[].correct，短答靠
 *     answerContent.text。
 *
 * 只读。
 *   基础层：npx ts-node apps/api/scripts/verify-basic-render.ts
 *   标准层本批：... verify-basic-render.ts --tag ai_authored_olevel_1128 --set ai_authored_olevel_43,ai_authored_olevel_44
 */
const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
  const tag = arg('tag') ?? 'ai_authored_olevel_1128_basic';
  const sets = (arg('set') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const qs = await prisma.question.findMany({
    where: {
      provenanceTag: tag,
      status: 'active',
      // sourceRef 形如 OLEVEL/<setCode>/Paper2/Q1 —— 给了 --set 就只看这几套
      ...(sets.length ? { OR: sets.map((s) => ({ sourceRef: { startsWith: `OLEVEL/${s}` } })) } : {}),
    },
    orderBy: { sourceRef: 'asc' },
    select: {
      sourceRef: true,
      questionType: true,
      marks: true,
      content: true,
      options: true,
      answerContent: true,
    },
  });

  console.log(`\n=== 渲染字段校验（${qs.length} 题，tag=${tag}）===\n`);
  let bad = 0;
  const uiKinds = new Set<string>();

  // 每套卷的「正文」= 该卷内最长的 passage。标准层 exercise 2 的四道
  // 情绪流程 MCQ 只带一句「参见 Exercise 1」的引用段（既有 42 篇同样
  // 如此，480-571 字符），正文由首题的 passage 提供 —— 所以正文长度只
  // 对该卷最长的那个 passage 要求，其余题非空即可。
  const paperKey = (ref: string) => ref.split('/').slice(0, 3).join('/');
  const bodyLen = new Map<string, number>();
  for (const q of qs) {
    const len = String(((q.content ?? {}) as any).passage ?? '').length;
    const k = paperKey(q.sourceRef ?? '');
    if (len > (bodyLen.get(k) ?? 0)) bodyLen.set(k, len);
  }
  for (const [k, len] of bodyLen) {
    if (len < 300) console.log(`  ✗ ${k}: 正文只有 ${len} 字符`), bad++;
  }

  for (const q of qs) {
    const c = (q.content ?? {}) as any;
    const problems: string[] = [];
    uiKinds.add(c.uiKind);

    if (!c.uiKind) problems.push('缺 uiKind');
    if (!c.stem || String(c.stem).trim().length < 10) problems.push('stem 过短');
    if (!c.passage || !String(c.passage).trim()) problems.push('passage 为空');

    if (q.questionType === 'mcq') {
      const opts = Array.isArray(q.options) ? (q.options as any[]) : [];
      if (opts.length < 3) problems.push(`选项只有 ${opts.length} 个`);
      if (opts.filter((o) => o?.correct).length !== 1) problems.push('correct 不是恰好 1 个');
      if (opts.some((o) => !o?.key || !o?.text)) problems.push('选项缺 key/text');
    } else {
      const a = (q.answerContent ?? {}) as any;
      if (!a.text || String(a.text).trim().length === 0) problems.push('缺 answerContent.text');
    }

    if (problems.length) {
      bad++;
      console.log(`  ✗ ${q.sourceRef}: ${problems.join(' / ')}`);
    }
  }

  console.log(`  uiKind 分布: ${Array.from(uiKinds).join(', ')}`);
  // pickRenderer：有 passage 且首题 taskType 不属 IELTS 家族 → OLevelComprehension
  const first = (qs[0]?.content ?? {}) as any;
  const IELTS = new Set([
    'matching_information', 'matching_headings', 'matching_features',
    'true_false_not_given', 'yes_no_not_given', 'sentence_completion',
    'summary_completion',
  ]);
  const renderer = IELTS.has(first.taskType)
    ? 'IELTSReadingPassage (❌ 不应命中)'
    : first.passage
      ? 'OLevelComprehension ✓'
      : 'OLevelMcqList';
  console.log(`  首题 taskType=${first.taskType} → 渲染器 ${renderer}`);
  console.log(`\n结果：${bad} 题有问题 / 共 ${qs.length} 题\n`);

  await prisma.$disconnect();
  process.exit(bad > 0 ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
