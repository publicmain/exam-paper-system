/**
 * 一次性订正（2026-09-17）：第三周已发布卷子里的**词表快照** —— 只改词性 / 中文 / 英文释义。
 *
 * ## 背景
 *
 * 第三周内容包的词表按 ECDICT 第一条义项生成，挑错了一批（sticker →「屠夫，尖刀」、
 * hawker →「饲鹰者」、sometimes 被还原成 sometime「改天」、人名 Richardson / Dewar
 * 当生词）。内容包已用 `content/week3/sense-overrides.js` 订正（77 处）。
 *
 * 发布时整份词表写进了 `Paper.config.lessonWords / lessonWordReserves`，所以内容包
 * 一改，`prepare-pilot-week.js --check` 就报「卷子的标题 / 词表与内容包不符」。
 * 这些卷子已经有学生做过，属于发布脚本不能改的冻结范围（PUB01），因此走本脚本。
 *
 * ## 影响范围（2026-09-17 只读核实）
 *
 *   · 应用只从这两个数组里读 headword / surfaceForm / context / contextTranslation
 *     （lesson.service 的 lessonWordsFromConfig、vocab.service 的例句人工翻译），
 *     **释义三字段没有任何代码读** —— 学生看到的东西不变；
 *   · 这些文章词从没上过学生的学习卡（StudentWord p1_w_ 的「教过 / 复习过」全是 0）。
 *   所以这是一次**记录订正**：让线上快照与内容包一致，以后核对不再误报。
 *
 * ## 只做什么
 *
 *   · 只动第三周五天、五档共 25 份 `p1_` 卷子的 `config` 这一个字段；
 *   · 数组里每个词只改 `pos` / `translation` / `definition`，其余字段（词、词形、
 *     例句、例句翻译、音标……）逐字核对必须与内容包一致，否则拒绝；
 *   · 改完之后整份 config 必须与内容包算出来的完全一致，否则拒绝；
 *   · 不碰任何答卷、分数、题目、学生生词、词典。
 *   · 写入与核对在同一个事务里，任何一步不过就整笔回滚。
 *
 * ## 用法
 *
 *   # 1. 预演（默认，不写库）：
 *   railway run -s Postgres -e production -- node apps/api/scripts/fix-20260917-week3-word-senses.js
 *
 *   # 2. 核对无误后，加确认串才写：
 *   P1_CONFIRM=S12M_FIX_20260917_WEEK3_WORD_SENSES \
 *     railway run -s Postgres -e production -- node apps/api/scripts/fix-20260917-week3-word-senses.js
 *
 * 2026-09-17 由用户「把第三周的错词也改掉」授权执行。
 */

'use strict';

const pilot = require('./pilot/prepare-pilot-week');

const CONFIRM_TOKEN = 'S12M_FIX_20260917_WEEK3_WORD_SENSES';
const DAYS = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'];
const FIELDS = ['pos', 'translation', 'definition'];

/** 逐词只换释义三字段；别的字段有任何不同就拒绝。 */
function patchList(stored, expected, where, samples) {
  if (!Array.isArray(stored) || !Array.isArray(expected) || stored.length !== expected.length) {
    throw new Error(`${where}：词数与内容包不一致，拒绝`);
  }
  let changed = 0;
  const out = stored.map((w, i) => {
    const e = expected[i];
    const keys = new Set([...Object.keys(w ?? {}), ...Object.keys(e ?? {})]);
    for (const k of keys) {
      if (FIELDS.includes(k)) continue;
      if (JSON.stringify(w?.[k] ?? null) !== JSON.stringify(e?.[k] ?? null)) {
        throw new Error(`${where}[${i}] 的 ${k} 与内容包不同 —— 本脚本只改释义，拒绝`);
      }
    }
    const next = { ...w };
    for (const k of FIELDS) {
      if (w?.[k] !== e?.[k]) {
        next[k] = e[k];
        changed += 1;
        if (k === 'translation' && samples.length < 12) samples.push(`${w.headword}：${w[k]}  →  ${e[k]}`);
      }
    }
    return next;
  });
  return { out, changed };
}

async function main() {
  pilot.assertEnvGates(undefined, { requireConfirmation: false });
  const write = process.env.P1_CONFIRM === CONFIRM_TOKEN;
  process.env.DATABASE_URL = pilot.publishConnectionUrl(process.env.DATABASE_PUBLIC_URL);
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const plans = DAYS.flatMap((d) => pilot.dayRows(d));
    const ids = plans.map((p) => p.paper.id);
    const rows = await prisma.paper.findMany({ where: { id: { in: ids } }, select: { id: true, config: true } });
    const byId = new Map(rows.map((r) => [r.id, r]));

    const updates = [];
    const samples = [];
    let total = 0;
    for (const p of plans) {
      const row = byId.get(p.paper.id);
      if (!row) throw new Error(`缺卷子 ${p.paper.id}，拒绝`);
      const cfg = row.config ?? {};
      const a = patchList(cfg.lessonWords, p.paper.config.lessonWords, `${p.paper.id}.lessonWords`, samples);
      const b = patchList(cfg.lessonWordReserves, p.paper.config.lessonWordReserves, `${p.paper.id}.lessonWordReserves`, samples);
      const next = { ...cfg, lessonWords: a.out, lessonWordReserves: b.out };
      if (!pilot.sameJson(next, p.paper.config)) {
        throw new Error(`${p.paper.id}：只换释义之后仍与内容包不一致（还有别的字段不同），拒绝`);
      }
      const n = a.changed + b.changed;
      total += n;
      if (n) updates.push({ id: p.paper.id, next });
      console.log(`${p.paper.id.padEnd(42)} ${n ? `${n} 个字段要订正` : '已一致'}`);
    }
    console.log(`\n合计 ${updates.length} 份卷子、${total} 个字段。中文释义样例：`);
    for (const s of samples) console.log(`  · ${s}`);

    if (!write) {
      console.log(`\n预演结束，没有写库。核对无误后加 P1_CONFIRM=${CONFIRM_TOKEN} 再跑。`);
      return;
    }

    await prisma.$transaction(
      async (tx) => {
        for (const u of updates) {
          await tx.paper.update({ where: { id: u.id }, data: { config: u.next } });
        }
        const after = await tx.paper.findMany({ where: { id: { in: ids } }, select: { id: true, config: true } });
        const afterById = new Map(after.map((r) => [r.id, r]));
        for (const p of plans) {
          if (!pilot.sameJson(afterById.get(p.paper.id)?.config, p.paper.config)) {
            throw new Error(`${p.paper.id}：写入后核对不一致，整笔回滚`);
          }
        }
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
    console.log(`\n已提交：${updates.length} 份卷子的词表快照与内容包一致。`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  const raw = String((e && e.message) || e).replace(/postgres(ql)?:\/\/\S*/gi, '[redacted]').slice(0, 600);
  console.error(`\n未订正：${raw}\n`);
  process.exit(1);
});
