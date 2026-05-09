/**
 * F4 backfill — assign Question.tags to historical rows that were created
 * before the AI generator started emitting them.
 *
 * Strategy: for each Question with empty tags[], call Sonnet 4.6 with a
 * tightly-scoped prompt that asks "given this stem (and options), pick
 * 1-3 tags from the controlled list". One-shot tool-use returns a JSON
 * array; the script writes it back via prisma.update.
 *
 * Cost cap: stops if cumulative spend exceeds BACKFILL_USD_CAP (default $5).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... npx ts-node scripts/backfill-question-tags.ts
 *   ANTHROPIC_API_KEY=... npx ts-node scripts/backfill-question-tags.ts --limit 50 --dry-run
 *
 * Real evidence: every run logs "scanned=N tagged=M skipped=K cost=$X.XX
 * tokens=A+B" so you can verify cost before approving the next batch.
 */
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

const prisma = new PrismaClient();

const PRICE_INPUT_PER_M = 3;
const PRICE_OUTPUT_PER_M = 15;
const MODEL = 'claude-sonnet-4-6';
const BACKFILL_USD_CAP = Number(process.env.BACKFILL_USD_CAP ?? 5);

const ALLOWED_TAGS = [
  'reading_detail',
  'inference',
  'matching',
  'tfng',
  'mcq_passage',
  'vocab',
  'collocation',
  'grammar',
  'cloze',
  'sentence_transformation',
  'short_answer',
  'summary_completion',
];

const SYSTEM_PROMPT = `你是一位英语教学语料标注员。给你一道英语题(stem + options),
你的工作是从下面这个固定列表中挑出 1-3 个最贴切的 tag,标记这道题主要考察什么。

允许的 tag (必须严格使用列表里的字符串):
${ALLOWED_TAGS.map((t) => `  - ${t}`).join('\n')}

规则:
- 不要新造 tag,只能从列表里挑;
- 只在你"非常确定"时才打;模棱两可的情况下,只返回 1 个 tag;
- 必须通过 submit_tags 工具返回,**不要**输出自由文本。`;

const TAG_TOOL: Anthropic.Tool = {
  name: 'submit_tags',
  description: 'Submit the chosen tags array.',
  input_schema: {
    type: 'object',
    required: ['tags'],
    properties: {
      tags: {
        type: 'array',
        items: { type: 'string', enum: ALLOWED_TAGS },
      },
    },
  },
};

interface CliOpts {
  limit: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliOpts {
  let limit = 200;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') limit = Number(argv[++i]);
    else if (a === '--dry-run') dryRun = true;
  }
  return { limit, dryRun };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-ant-replace')) {
    console.error('ANTHROPIC_API_KEY required');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });

  const candidates = await prisma.question.findMany({
    where: {
      tags: { isEmpty: true },
      status: 'active',
    },
    select: {
      id: true,
      content: true,
      options: true,
      questionType: true,
      sourceRef: true,
    },
    take: opts.limit,
  });
  console.log(`scanning ${candidates.length} untagged active questions (cap=$${BACKFILL_USD_CAP})`);

  let scanned = 0;
  let tagged = 0;
  let skipped = 0;
  let totalCost = 0;
  let totalIn = 0;
  let totalOut = 0;
  for (const q of candidates) {
    scanned++;
    if (totalCost >= BACKFILL_USD_CAP) {
      console.log(`hit cost cap (spent=$${totalCost.toFixed(4)}); stopping`);
      break;
    }
    const stem = (q.content as any)?.stem ?? '';
    const opts2 = Array.isArray(q.options) ? (q.options as any[]) : [];
    if (!stem) {
      skipped++;
      continue;
    }
    const userText =
      `Question type: ${q.questionType}\n` +
      (q.sourceRef ? `Source: ${q.sourceRef}\n` : '') +
      `Stem:\n${String(stem).slice(0, 1500)}\n` +
      (opts2.length > 0
        ? `Options: ${opts2.map((o: any) => `(${o.key}) ${o.text}`).join(' / ')}\n`
        : '') +
      `请用 submit_tags 工具返回 1-3 个 tag。`;
    let resp: Anthropic.Message;
    try {
      resp = await client.messages.create({
        model: MODEL,
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        tools: [TAG_TOOL],
        tool_choice: { type: 'tool', name: 'submit_tags' },
        messages: [{ role: 'user', content: userText }],
      });
    } catch (e: any) {
      console.warn(`skip Q ${q.id}: ${e?.message ?? e}`);
      skipped++;
      continue;
    }
    const block = resp.content.find((b) => b.type === 'tool_use') as any;
    const tagsRaw = block?.input?.tags;
    const tags: string[] = Array.isArray(tagsRaw)
      ? tagsRaw.filter((t: any): t is string => typeof t === 'string' && ALLOWED_TAGS.includes(t)).slice(0, 3)
      : [];
    const inT = resp.usage.input_tokens ?? 0;
    const outT = resp.usage.output_tokens ?? 0;
    totalIn += inT;
    totalOut += outT;
    totalCost += (inT * PRICE_INPUT_PER_M + outT * PRICE_OUTPUT_PER_M) / 1_000_000;
    if (tags.length === 0) {
      skipped++;
      continue;
    }
    if (opts.dryRun) {
      console.log(`[dry] Q ${q.id} → ${tags.join(', ')}`);
    } else {
      await prisma.question.update({
        where: { id: q.id },
        data: { tags },
      });
    }
    tagged++;
  }
  console.log(
    `done scanned=${scanned} tagged=${tagged} skipped=${skipped} ` +
      `cost=$${totalCost.toFixed(4)} tokens=${totalIn}+${totalOut}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
