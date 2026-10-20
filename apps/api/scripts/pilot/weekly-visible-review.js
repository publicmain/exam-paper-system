#!/usr/bin/env node
/**
 * 每周五发布前：把下周学生在 App 里**肉眼能看到的所有文字**导出来，给 agent 逐字审。
 *
 * ## 为什么有这个脚本
 *
 * 2026-10-20「What is oral sex?」事故后叶老师定的硬规则：
 *
 *   「每周五我都会准备下一周的内容，我需要你在部署之前，把下周学生能在 app 上看到的
 *    所有内容 —— 注意我说的是所有，单词例句文章文本，但凡出现在 app 里面的内容 ——
 *    都要全部筛一遍过检查。」
 *
 * 正则闸门（`school-safe-sentences.ts`）只拦想得到的词，事故当天就漏了 "bullshit"、
 * "Wife swapping is widespread there."、"I piss on the corpus."。所以这里不做判断，
 * 只负责**一个不漏地把文字摆出来**；判断交给读得懂语境的人（agent）。
 *
 * ## 覆盖哪些出口（对着学生端调的 API 盘过）
 *
 *   A. 文章课  `/lesson/*`          ← 内容包文件 weekN/*.js，五档 × 五天
 *        标题、正文、每道题的题干 / 选项 / 答案 / 可接受答案 / 解析 / 评分标准 / 原文依据，
 *        以及文章生词表（释义、英文定义、例句、例句中文）
 *   B. 每日单词 `/vocab-v2/daily*`   ← 生产库：每个活跃学生往后 60 个没见过的词，取并集
 *        中文释义、英文定义、搭配、词族、易混词、记忆提示、每条可推例句及其中文
 *   C. 单词测验 `/vocab-v2/test*`    ← 选项是同一次测验里**别的词**的释义 / 单词 / 搭配，
 *        和 B 是同一批字段，审 B 就覆盖了
 *   D. 老师警告弹窗 `/student-notices` ← 生产库 Notification 表里没读过的 effort_warning
 *   E. 学生反馈「这句有问题？」← 最近 14 天的 content_report。那句已经自动下架，要复核：
 *        真有问题就保持下架、给这个词重写；误报就放回来
 *
 * 不在这里的：界面文案、错误提示、徽章名（`medal-catalog.ts`）—— 跟着发版走，改代码时审。
 *
 * ## 用法（仓库根目录）
 *
 *   railway run -s Postgres -e production -- \
 *     node apps/api/scripts/pilot/weekly-visible-review.js --week=week9
 *
 *   --no-db     只导内容包（A），不连库
 *   --out=DIR   输出目录，默认 .local/review/<week>
 *   --approve   全部审完改完、最后一次导出也审过之后，写审核记录
 *               content/<week>/review-approval.json。发布脚本（prepare-pilot-week.js）
 *               从第九周起没有它、或内容审完又改过（指纹对不上）就拒绝发布。
 *
 * 只读：数据库查询全部包在 READ ONLY 事务里。输出切成每份 ~40KB 的文本，
 * 一份派一个 agent。每块都带可定位的编号（档位/日期/题号、senseId、contextId），
 * agent 报出来的问题可以直接按编号下架。
 *
 * ## 下架之后必须再跑一遍
 *
 * 例句一下架，content-producer 就把那个词当成「缺例句」重新去 Tatoeba 拉 ——
 * 拉回来的是**没审过的新句子**（10-20 当场踩到：清完一轮冒出 "sex offender"、
 * "addicted to crack"）。所以周五的流程是一个循环：导出 → 审 → 下架 → 等重新生成
 * 跑完 → 再导出 → 只审变了的 → 直到没有新内容。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { weekFingerprint, approvalPath } = require('./visible-fingerprint');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);

const week = args.week;
if (!week || !/^week\d+$/.test(week)) {
  console.error('用法：--week=week9（内容包目录名）');
  process.exit(2);
}

const CONTENT_DIR = path.join(__dirname, 'content', week);
if (!fs.existsSync(CONTENT_DIR)) {
  console.error(`没有内容包目录：${CONTENT_DIR}`);
  process.exit(2);
}

const OUT = path.resolve(args.out || path.join('.local', 'review', week));
fs.mkdirSync(OUT, { recursive: true });

const CHUNK_BYTES = 40_000;
const manifest = [];

// ─────────────────────────────────────────────────────────────
// 小工具
// ─────────────────────────────────────────────────────────────

const show = (v) => {
  if (v === undefined || v === null || v === '') return '(无)';
  if (Array.isArray(v)) return v.length ? v.map(show).join(' ｜ ') : '(无)';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/**
 * 把一组文本块切成大小**均匀**的若干份：先按 CHUNK_BYTES 算要几份，再按平均值切 ——
 * 不然最后常剩一份只有两三个词的小尾巴，白派一个 agent。单块超长也独占一份，不截断。
 */
function chunk(blocks) {
  const sizes = blocks.map((b) => Buffer.byteLength(b, 'utf8') + 2);
  const total = sizes.reduce((a, n) => a + n, 0);
  const target = total / Math.max(1, Math.ceil(total / CHUNK_BYTES));
  const parts = [];
  let cur = [];
  let size = 0;
  for (const [i, b] of blocks.entries()) {
    const n = sizes[i];
    if (cur.length && size + n / 2 > target) {
      parts.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(b);
    size += n;
  }
  if (cur.length) parts.push(cur);
  return parts;
}

function write(name, header, blocks) {
  const parts = chunk(blocks);
  parts.forEach((part, i) => {
    const file = parts.length > 1 ? `${name}-${i + 1}.txt` : `${name}.txt`;
    const body = `${header}\n\n${part.join('\n\n')}\n`;
    fs.writeFileSync(path.join(OUT, file), body, 'utf8');
    manifest.push({ file, blocks: part.length, bytes: Buffer.byteLength(body, 'utf8') });
  });
}

// ─────────────────────────────────────────────────────────────
// A. 文章课（内容包文件）
// ─────────────────────────────────────────────────────────────

function dumpArticles() {
  const pack = require(path.join(CONTENT_DIR, 'index.js'));
  const LEVELS = pack.LEVELS || pack;
  const levels = Object.keys(LEVELS).sort();
  let articleCount = 0;
  let questionCount = 0;
  let wordCount = 0;

  for (const level of levels) {
    const blocks = [];
    for (const day of LEVELS[level]) {
      articleCount += 1;
      const lines = [];
      lines.push(`### [文章] ${level} | ${day.date}`);
      lines.push(`标题: ${show(day.title)}`);
      lines.push('正文:');
      lines.push(String(day.passage ?? '(无)'));
      (day.questions || []).forEach((q, i) => {
        questionCount += 1;
        lines.push('');
        lines.push(`--- 题 ${i + 1}  [${show(q.taskType)} / ${show(q.questionType)} · ${show(q.marks)} 分]`);
        lines.push(`题干: ${show(q.stem)}`);
        if (q.options !== undefined) lines.push(`选项: ${show(q.options)}`);
        lines.push(`答案: ${show(q.answer)}`);
        if (q.accept !== undefined) lines.push(`可接受答案: ${show(q.accept)}`);
        if (q.explanation !== undefined) lines.push(`解析: ${show(q.explanation)}`);
        if (q.rubric !== undefined) lines.push(`评分标准: ${show(q.rubric)}`);
        if (q.evidence !== undefined) lines.push(`原文依据: ${show(q.evidence)}`);
      });
      if (day.words && day.words.length) {
        lines.push('');
        lines.push(`--- 文章生词表（${day.words.length} 个）`);
        for (const w of day.words) {
          wordCount += 1;
          lines.push(`· ${show(w.headword)}${w.surfaceForm && w.surfaceForm !== w.headword ? `（文中作 ${w.surfaceForm}）` : ''} ${show(w.phonetic)} ${show(w.pos)}`);
          lines.push(`  中文释义: ${show(w.translation)}`);
          lines.push(`  英文定义: ${show(w.definition)}`);
          lines.push(`  例句: ${show(w.context)}`);
          lines.push(`  例句中文: ${show(w.contextTranslation)}`);
        }
      }
      blocks.push(lines.join('\n'));
    }
    write(
      `A-article-${level}`,
      `# A. 文章课 · ${level} · ${week}\n# 学生在「今日阅读」里看到的全部文字：标题、正文、题目（含选项、答案、解析、评分标准），以及文章生词表。`,
      blocks,
    );
  }
  return { levels: levels.length, articleCount, questionCount, wordCount };
}

// ─────────────────────────────────────────────────────────────
// B / D. 生产库
// ─────────────────────────────────────────────────────────────

/**
 * 词级黑名单（`school-safe-words.ts`）里的词每日推送根本不取，导出来只会让审核白读 ——
 * 10-20 第一次跑时 `sperm`、`suicide` 就混进了「下周的词」。直接读 TS 源码里那张表，
 * 免得两处名单各改各的。
 */
function blockedHeadwords() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'vocab-v2', 'school-safe-words.ts'), 'utf8');
  const body = src.match(/SCHOOL_BLOCKED_HEADWORDS[^=]*=\s*\[([\s\S]*?)\]/);
  if (!body) throw new Error('school-safe-words.ts 里找不到 SCHOOL_BLOCKED_HEADWORDS');
  const words = [...body[1].matchAll(/'([^']+)'/g)].map((m) => m[1].trim().toLowerCase());
  if (!words.length) throw new Error('SCHOOL_BLOCKED_HEADWORDS 解析出来是空的');
  return words;
}

const EXCLUDE_SQL = `
  u.role = 'student'
  AND u.id NOT LIKE 'p1_qa_acc_%'
  AND u.id <> 'cmtqgmjl200u6stuq31xrad59'
  AND c.id NOT IN ('p1_class_qa', 'p1_class')`;

const NEXT_WEEK_VOCAB_SQL = `
WITH active AS (
  SELECT DISTINCT u.id FROM "User" u
  JOIN "ClassEnrollment" ce ON ce."userId" = u.id
  JOIN "Class" c ON c.id = ce."classId"
  WHERE ${EXCLUDE_SQL}
    AND EXISTS (SELECT 1 FROM "VocabularyV2Session" v WHERE v."studentId" = u.id AND v.date >= CURRENT_DATE - 21)),
stu_list AS (
  SELECT DISTINCT ON (v."studentId") v."studentId" AS sid, l."listName" AS lst
  FROM "VocabularyV2SessionItem" i
  JOIN "VocabularyV2Session" v ON v.id = i."sessionId"
  JOIN "VocabularySense" s ON s.id = i."senseId"
  JOIN "VocabularyLexeme" l ON l.id = s."lexemeId"
  WHERE v."studentId" IN (SELECT id FROM active) AND l."listName" IN ('ngsl', 'nawl')
  ORDER BY v."studentId", v.date DESC, i.position DESC),
seen AS (
  SELECT sv."studentId" AS sid, lower(l.headword) AS hw
  FROM "StudentVocabularySense" sv
  JOIN "VocabularySense" s ON s.id = sv."senseId"
  JOIN "VocabularyLexeme" l ON l.id = s."lexemeId"),
target AS (
  SELECT nxt.sense_id, count(*)::int AS students
  FROM stu_list sl
  CROSS JOIN LATERAL (
    SELECT s.id AS sense_id FROM "VocabularySense" s
    JOIN "VocabularyLexeme" l ON l.id = s."lexemeId"
    WHERE l."listName" = sl.lst AND s."qualityStatus" = 'ready'
      AND lower(l.headword) NOT IN (SELECT hw FROM seen WHERE sid = sl.sid)
      AND lower(l.headword) <> ALL ($1::text[])
    ORDER BY l.rank ASC LIMIT 60) nxt
  GROUP BY nxt.sense_id)
SELECT s.id AS "senseId", l.headword, l.phonetic, l."listName" AS list, l.rank, s.pos,
       s.translation, s.definition, s.collocations, s."wordFamily", s."confusionWords", s."memoryHint",
       t.students,
       COALESCE((
         SELECT json_agg(json_build_object('id', x.id, 'kind', x.kind, 'sentence', x.sentence, 'translation', x.translation)
                         ORDER BY x.kind, x.position)
         FROM "VocabularyContext" x WHERE x."senseId" = s.id AND x."qualityStatus" = 'ready'), '[]'::json) AS contexts
FROM target t
JOIN "VocabularySense" s ON s.id = t.sense_id
JOIN "VocabularyLexeme" l ON l.id = s."lexemeId"
ORDER BY l."listName", l.rank`;

const NOTICES_SQL = `
SELECT n.id, n.title, n.body, n."createdAt"::text AS created
FROM "Notification" n
JOIN "User" u ON u.id = n."userId"
JOIN "ClassEnrollment" ce ON ce."userId" = u.id
JOIN "Class" c ON c.id = ce."classId"
WHERE n.type = 'effort_warning' AND n."readAt" IS NULL AND ${EXCLUDE_SQL}
ORDER BY n."createdAt"`;

const REPORTS_SQL = `
SELECT DISTINCT ON (n.body) n.title, n.body, n."createdAt"::text AS created
FROM "Notification" n
WHERE n.type = 'content_report' AND n."createdAt" > now() - interval '14 days'
ORDER BY n.body, n."createdAt" DESC`;

async function readOnly(prisma, sql, ...params) {
  const [, rows] = await prisma.$transaction([
    prisma.$executeRawUnsafe('SET TRANSACTION READ ONLY'),
    prisma.$queryRawUnsafe(sql, ...params),
  ]);
  return rows;
}

async function dumpDatabase() {
  if (process.env.DATABASE_PUBLIC_URL) {
    const u = new URL(process.env.DATABASE_PUBLIC_URL);
    u.searchParams.set('connect_timeout', '30');
    u.searchParams.set('connection_limit', '1');
    u.searchParams.set('application_name', 'weekly-visible-review');
    process.env.DATABASE_URL = u.toString();
  }
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const vocab = await readOnly(prisma, NEXT_WEEK_VOCAB_SQL, blockedHeadwords());
    // 白名单下，下周要学的词里还没审过 / 没有例句的，要先走全库审查流水线审完写完：
    //   npx ts-node --transpile-only apps/api/scripts/vocab-v2/dump-review-queue.ts \
    //     --senses=<这个文件> --prefix=<week> --out=.local/review/<week>-queue
    // （B 节本身只列已经放行的内容。）
    fs.writeFileSync(path.join(OUT, 'B-sense-ids.txt'), vocab.map((r) => r.senseId).join('\n') + '\n', 'utf8');
    const blocks = vocab.map((r) => {
      const lines = [];
      lines.push(`### ${r.headword}  [senseId=${r.senseId} | ${r.list}@${r.rank} | ${r.pos} | 下周 ${r.students} 人会学到]`);
      lines.push(`音标: ${show(r.phonetic)}`);
      lines.push(`中文释义: ${show(r.translation)}`);
      lines.push(`英文定义: ${show(r.definition)}`);
      lines.push(`搭配: ${show(r.collocations)}`);
      lines.push(`词族: ${show(r.wordFamily)}`);
      lines.push(`易混词: ${show(r.confusionWords)}`);
      lines.push(`记忆提示: ${show(r.memoryHint)}`);
      const ctx = Array.isArray(r.contexts) ? r.contexts : [];
      if (!ctx.length) lines.push('例句: (无)');
      for (const x of ctx) {
        lines.push(`例句 [contextId=${x.id} · ${x.kind}]: ${show(x.sentence)}`);
        lines.push(`  中文: ${show(x.translation)}`);
      }
      return lines.join('\n');
    });
    write(
      'B-daily-vocab',
      `# B. 每日单词 · ${week}\n# 每个活跃学生往后 60 个没见过的词取并集。学生在单词卡上看到的全部字段；单词测验的选项也从这些字段里挑（同一次测验里别的词的释义 / 单词 / 搭配）。`,
      blocks,
    );

    const notices = await readOnly(prisma, NOTICES_SQL);
    write(
      'D-notices',
      `# D. 老师警告弹窗（未读的 effort_warning）\n# 学生下次打开 App 会看到。`,
      notices.length
        ? notices.map((n) => `### [通知] ${n.id} | ${n.created}\n标题: ${show(n.title)}\n正文: ${show(n.body)}`)
        : ['（没有未读的警告弹窗）'],
    );
    const reports = await readOnly(prisma, REPORTS_SQL);
    write(
      'E-student-reports',
      `# E. 学生反馈「这句有问题？」（最近 14 天）\n# 反馈的那句已经自动下架。逐条判断：真有问题就保持下架、给这个词重写；误报就放回来。`,
      reports.length
        ? reports.map((r) => `### [反馈] ${r.created}\n${show(r.title)}\n${show(r.body)}`)
        : ['（最近 14 天没有学生反馈）'],
    );
    return { senses: vocab.length, contexts: vocab.reduce((a, r) => a + (r.contexts?.length || 0), 0), notices: notices.length, reports: reports.length };
  } finally {
    await prisma.$disconnect();
  }
}

// ─────────────────────────────────────────────────────────────

/**
 * `--approve`：全部审完、改完、最后一次重新导出也审过之后，写审核记录
 * content/<week>/review-approval.json —— 发布脚本没有它、或指纹对不上就拒绝发布。
 *
 * 只认「最后一次导出时的指纹 == 现在内容的指纹」：导出之后又改过内容包，说明改动
 * 还没人看过，不给 approve。
 */
function approve() {
  const manifestFile = path.join(OUT, '00-manifest.txt');
  if (!fs.existsSync(manifestFile)) throw new Error(`没有导出过：${manifestFile} 不存在，先导出、审完再 --approve`);
  const exported = (fs.readFileSync(manifestFile, 'utf8').match(/^内容包指纹: ([0-9a-f]{64})$/m) || [])[1];
  const now = weekFingerprint(week);
  if (!exported) throw new Error('00-manifest.txt 里没有内容包指纹（旧版导出），重新导出一次');
  if (exported !== now) {
    throw new Error(`最后一次导出之后内容包又改过（导出时 ${exported.slice(0, 12)}…，现在 ${now.slice(0, 12)}…）——重新导出，把变了的部分审完再 --approve`);
  }
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.txt') && f !== '00-manifest.txt').sort();
  const record = {
    week,
    fingerprint: now,
    approvedAt: new Date().toISOString(),
    rule: '2026-10-20 硬规则：学生在 App 里能看到的所有文字，发布前派 agent 逐字审过',
    reviewedFiles: files,
  };
  fs.writeFileSync(approvalPath(week), JSON.stringify(record, null, 2) + '\n', 'utf8');
  console.log(`已写审核记录：${path.relative(process.cwd(), approvalPath(week))}\n指纹 ${now}`);
}

(async () => {
  if (args.approve) return approve();
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.txt')) fs.unlinkSync(path.join(OUT, f));

  const a = dumpArticles();
  const b = args['no-db'] ? null : await dumpDatabase();

  const lines = [
    `# ${week} 学生可见内容审查包`,
    `生成时间: ${new Date().toISOString()}`,
    `内容包指纹: ${weekFingerprint(week)}`,
    '',
    `A. 文章课：${a.levels} 档 · ${a.articleCount} 篇 · ${a.questionCount} 道题 · ${a.wordCount} 个文章生词`,
    b
      ? `B. 每日单词：${b.senses} 个词义 · ${b.contexts} 条例句（C. 测验选项随 B 覆盖）\nD. 警告弹窗：${b.notices} 条\nE. 学生反馈：${b.reports} 条`
      : 'B / C / D / E：已跳过（--no-db）',
    '',
    '文件（一份派一个 agent）：',
    ...manifest.map((m) => `  ${m.file.padEnd(34)} ${String(m.blocks).padStart(4)} 块  ${(m.bytes / 1024).toFixed(1).padStart(6)} KB`),
  ];
  fs.writeFileSync(path.join(OUT, '00-manifest.txt'), lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
  console.log(`\n输出目录：${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
