/**
 * 导出「待审队列」：白名单下还没审过的单词卡，切成一份份给审查 agent。
 *
 * 2026-10-20 改成白名单后，8148 条语料例句转成 pending_review，学生看不到。这个脚本把
 * 它们按词义摆出来 —— 连同这张卡上学生能看到的其余字段（中文释义、英文定义、搭配……）
 * 一起审 —— 审查结论用 apply-content-review.ts 落库。
 *
 * 排序：**学生最先会看到的在前**。
 *   1. 已经在学生生词本里的词（复习时就会出现），按学过的人数
 *   2. 其余按词表排名
 * 词级黑名单（school-safe-words.ts）里的词不推，不导。
 *
 * 用法（仓库根目录，只读）：
 *   railway run -s Postgres -e production -- npx ts-node apps/api/scripts/vocab-v2/dump-review-queue.ts \
 *     [--out=.local/review/library] [--limit=4000] [--chunk-kb=40]
 *     [--senses=<文件，每行一个 senseId>] [--include-ready] [--prefix=lib]
 *
 *   --senses         只导这些词义。每周五：下周要学、还没审过的词就这样导，审完写完再发布。
 *   --include-ready  已经放行的语料例句也拿出来复查（标「已上线，复查」，可以判 block）；
 *                    不加时只导待审的。配 --senses 修某一批已上线内容里的错。
 *   --prefix         文件名和 key 的前缀，默认 lib（另起一批用 fix / week9 之类，别和 lib 撞）。
 *
 * 每块带 senseId / contextId；agent 判 approve / block 时必须原样抄回句子，库里的句子
 * 审完后变过，落库脚本就不认。
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { SCHOOL_BLOCKED_HEADWORDS } from '../../src/vocab-v2/school-safe-words';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
})) as Record<string, string | true>;

const OUT = resolve(typeof args.out === 'string' ? args.out : join('.local', 'review', 'library'));
const LIMIT = Number(args.limit ?? 5000);
const CHUNK_BYTES = Number(args['chunk-kb'] ?? 40) * 1000;
const PREFIX = typeof args.prefix === 'string' && /^[a-z0-9]+$/.test(args.prefix) ? args.prefix : 'lib';
const INCLUDE_READY = args['include-ready'] === true;
const SENSE_IDS: string[] | null = typeof args.senses === 'string'
  ? readFileSync(args.senses, 'utf8').split(/\s+/).map((x) => x.trim()).filter(Boolean)
  : null;

const EXCLUDE = `
  u.role = 'student' AND u.id NOT LIKE 'p1_qa_acc_%' AND u.id <> 'cmtqgmjl200u6stuq31xrad59'
  AND NOT EXISTS (SELECT 1 FROM "ClassEnrollment" ce WHERE ce."userId" = u.id AND ce."classId" IN ('p1_class_qa', 'p1_class'))`;

const QUEUE_SQL = `
WITH learners AS (
  SELECT sv."senseId", count(DISTINCT sv."studentId")::int AS n
  FROM "StudentVocabularySense" sv JOIN "User" u ON u.id = sv."studentId"
  WHERE ${EXCLUDE}
  GROUP BY 1)
SELECT s.id AS "senseId", l.headword, l.phonetic, l."listName" AS list, l.rank, s.pos,
       s.translation, s.definition, s.collocations, s."wordFamily", s."confusionWords", s."memoryHint",
       COALESCE(le.n, 0) AS learners,
       COALESCE((SELECT json_agg(json_build_object('id', x.id, 'kind', x.kind, 'status', x."qualityStatus",
                   'sentence', x.sentence, 'translation', x.translation) ORDER BY x.kind, x.position)
                 FROM "VocabularyContext" x
                 WHERE x."senseId" = s.id AND x."qualityStatus" IN ('pending_review', 'ready')), '[]'::json) AS contexts
FROM "VocabularySense" s
JOIN "VocabularyLexeme" l ON l.id = s."lexemeId"
LEFT JOIN learners le ON le."senseId" = s.id
WHERE s."qualityStatus" = 'ready'
  AND lower(l.headword) <> ALL ($1::text[])
  AND ($3::text[] IS NULL OR s.id = ANY ($3::text[]))
  AND (
    $4::boolean
    OR EXISTS (SELECT 1 FROM "VocabularyContext" x WHERE x."senseId" = s.id AND x."qualityStatus" = 'pending_review')
    OR NOT EXISTS (SELECT 1 FROM "VocabularyContext" x WHERE x."senseId" = s.id AND x."qualityStatus" = 'ready' AND x.kind <> 'article_original')
  )
ORDER BY COALESCE(le.n, 0) DESC, CASE l."listName" WHEN 'ngsl' THEN 0 WHEN 'nawl' THEN 1 ELSE 2 END, l.rank ASC
LIMIT $2`;

const show = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '(无)';
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x)).join(' ｜ ') : '(无)';
  return String(v);
};

function chunk(blocks: string[]): string[][] {
  const sizes = blocks.map((b) => Buffer.byteLength(b, 'utf8') + 2);
  const total = sizes.reduce((a, n) => a + n, 0);
  const target = total / Math.max(1, Math.ceil(total / CHUNK_BYTES));
  const parts: string[][] = [];
  let cur: string[] = [];
  let size = 0;
  blocks.forEach((b, i) => {
    if (cur.length && size + sizes[i] / 2 > target) { parts.push(cur); cur = []; size = 0; }
    cur.push(b);
    size += sizes[i];
  });
  if (cur.length) parts.push(cur);
  return parts;
}

async function main() {
  if (process.env.DATABASE_PUBLIC_URL) {
    const u = new URL(process.env.DATABASE_PUBLIC_URL);
    u.searchParams.set('connection_limit', '1');
    u.searchParams.set('application_name', 'dump-review-queue');
    process.env.DATABASE_URL = u.toString();
  }
  const prisma = new PrismaClient();
  try {
    const blocked = SCHOOL_BLOCKED_HEADWORDS.map((w) => w.trim().toLowerCase());
    const [, rows] = await prisma.$transaction([
      prisma.$executeRawUnsafe('SET TRANSACTION READ ONLY'),
      prisma.$queryRawUnsafe<any[]>(QUEUE_SQL, blocked, LIMIT, SENSE_IDS, INCLUDE_READY),
    ]);

    const blocks = rows.map((r) => {
      const lines = [
        `### ${r.headword}  [senseId=${r.senseId} | ${r.list}@${r.rank} | ${r.pos} | 已有 ${r.learners} 个学生学过]`,
        `音标: ${show(r.phonetic)}`,
        `中文释义: ${show(r.translation)}`,
        `英文定义: ${show(r.definition)}`,
        `原搭配（从旧语料切的，多半是碎片）: ${show(r.collocations)}`,
        `词族: ${show(r.wordFamily)}`,
        `易混词: ${show(r.confusionWords)}`,
        `记忆提示: ${show(r.memoryHint)}`,
      ];
      const ctx: any[] = Array.isArray(r.contexts) ? r.contexts : [];
      const judge = ctx.filter((x) => x.kind !== 'article_original' && (x.status === 'pending_review' || (INCLUDE_READY && x.status === 'ready')));
      const done = INCLUDE_READY ? [] : ctx.filter((x) => x.kind !== 'article_original' && x.status === 'ready');
      const article = ctx.filter((x) => x.kind === 'article_original');
      for (const x of judge) lines.push(`待审例句${x.status === 'ready' ? '（已上线，复查）' : ''} [contextId=${x.id} · ${x.kind}]: ${x.sentence}\n  中文: ${show(x.translation)}`);
      for (const x of done) lines.push(`已审例句（只读）[${x.kind}]: ${x.sentence}`);
      for (const x of article) lines.push(`课程文章原句（只读）: ${x.sentence}`);
      if (!judge.length && !done.length) lines.push('（这个词目前没有可用例句 —— 需要新写）');
      return lines.join('\n');
    });

    mkdirSync(OUT, { recursive: true });
    for (const f of readdirSync(OUT)) if (f.startsWith(`${PREFIX}-`) && /-\d+\.txt$/.test(f)) unlinkSync(join(OUT, f));
    const parts = chunk(blocks);
    parts.forEach((part, i) => {
      const name = `${PREFIX}-${String(i + 1).padStart(3, '0')}.txt`;
      writeFileSync(join(OUT, name), `# 待审队列 ${name}（${part.length} 个词）\n\n${part.join('\n\n')}\n`, 'utf8');
    });
    const pending = rows.reduce((a, r) => a + (r.contexts as any[]).filter((x) => x.status === 'pending_review').length, 0);
    console.log(`待审词义 ${rows.length} 个 · 待审例句 ${pending} 条 · 切成 ${parts.length} 份 → ${OUT}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
