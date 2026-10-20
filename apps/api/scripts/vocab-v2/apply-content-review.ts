/**
 * 把 agent 的审查结论落库 —— 白名单（默认不上，审过的才放）唯一的放行入口。
 *
 * ## 两份文件，两个人
 *
 *   --review=lib-001.review.json   审查 agent 写的：
 *       · 每条待审例句 approve / block（必须原样抄回句子，库里的句子审完后变过就不认）
 *       · 例句不够的词，新写 1–2 条（newContexts），以及修正后的中文释义（translationFix）、
 *         新的搭配列表（collocations）—— 这三样都带 key
 *   --verify=lib-001.verify.json   另一个复核 agent 写的：对上面每个 key 给 approve / reject
 *
 * **agent 新写或改动的东西，必须有复核 agent 的 approve 才上线**；漏掉复核的 key 一律当
 * reject（fail closed）。已有例句由审查 agent 一人判即可 —— 他不是作者。
 *
 * ## 落库前的硬校验（任何一条不过就不写，并在报告里列出来）
 *
 *   · 句子 / 释义 / 搭配过一遍正则闸门（school-safe-sentences）—— 正则和人意见冲突时，拦
 *   · 新例句必须真的用到这个词（containsTarget，允许词形变化）、有中文、不超过 25 个词
 *   · approve 只认库里句子和审查时一字不差的那条；内容包课程文章（article_original）不经这里
 *
 * ## 落库之后
 *
 * 受影响的词里**还没做的题**（pending）：快照里没有例句的，补上刚放行的例句；搭配按白名单
 * 重新过滤。已经做过的历史题不动。
 *
 * ## 用法（仓库根目录）
 *
 *   railway run -s Postgres -e production -- npx ts-node apps/api/scripts/vocab-v2/apply-content-review.ts \
 *     --review=.local/review/library/lib-001.review.json --verify=.local/review/library/lib-001.verify.json
 *
 * 不加 --commit 是演练：照样校验、照样算出要写什么，然后回滚。
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { isSchoolUnsafeContext, isSchoolUnsafeText, keepSchoolSafeTexts } from '../../src/vocab-v2/school-safe-sentences';
import { containsTarget } from '../../src/vocab-v2/content-quality';
import { APPROVED_STATUS, collocationsBackedByApproved } from '../../src/vocab-v2/content-review';

type Verdict = 'approve' | 'block';
interface ContextDecision { contextId: string; sentence: string; verdict: Verdict; reason?: string }
interface NewContext { key: string; kind: string; sentence: string; translation: string; difficulty?: number }
interface Keyed<T> { key: string; value: T }
interface ReviewSense {
  senseId: string;
  headword: string;
  contexts?: ContextDecision[];
  newContexts?: NewContext[];
  translationFix?: Keyed<string> | null;
  collocations?: Keyed<string[]> | null;
}
interface ReviewFile { chunk: string; senses: ReviewSense[] }
interface VerifyFile {
  verdicts: Array<{ key: string; verdict: 'approve' | 'reject'; reason?: string }>;
  /** 复核 agent 对审查 agent「放行」的已有例句的否决：一票否决，按拦处理。 */
  overrides?: Array<{ contextId: string; sentence: string; reason?: string }>;
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
})) as Record<string, string | true>;

const NEW_KINDS = new Set(['short_same_meaning', 'alternate_topic']);
const AGENT_PROVIDER = 'agent_written';
const CJK = /[㐀-鿿]/u;
const wordsIn = (s: string) => (s.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []).length;

function load<T>(path: unknown, what: string): T {
  if (typeof path !== 'string') throw new Error(`缺 --${what}=<文件>`);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

async function main() {
  const review = load<ReviewFile>(args.review, 'review');
  const verify = load<VerifyFile>(args.verify, 'verify');
  const commit = args.commit === true;
  const approvedKeys = new Set(verify.verdicts.filter((v) => v.verdict === 'approve').map((v) => v.key));
  const knownKeys = new Set(verify.verdicts.map((v) => v.key));
  // 复核一票否决：只认原样抄回的句子，和审查那边同一个规矩
  const vetoed = new Map((verify.overrides ?? []).map((o) => [o.contextId, String(o.sentence ?? '').trim()]));

  if (process.env.DATABASE_PUBLIC_URL) {
    const u = new URL(process.env.DATABASE_PUBLIC_URL);
    u.searchParams.set('connection_limit', '1');
    u.searchParams.set('application_name', 'apply-content-review');
    process.env.DATABASE_URL = u.toString();
  }
  const prisma = new PrismaClient();

  const report = {
    approved: 0, blocked: 0, inserted: 0, glossFixed: 0, collocationsSet: 0, snapshotsFilled: 0,
    skipped: [] as string[],
  };
  const skip = (msg: string) => report.skipped.push(msg);

  const senseIds = review.senses.map((s) => s.senseId);
  const senses = await prisma.vocabularySense.findMany({
    where: { id: { in: senseIds } },
    include: { lexeme: true, contexts: true },
  });
  const byId = new Map(senses.map((s) => [s.id, s]));

  try {
    await prisma.$transaction(async (tx) => {
      for (const rs of review.senses) {
        const sense = byId.get(rs.senseId);
        if (!sense) { skip(`${rs.headword}: 库里没有 senseId ${rs.senseId}`); continue; }
        const headword = sense.lexeme.headword;
        if (rs.headword && rs.headword.toLowerCase() !== headword.toLowerCase()) {
          skip(`${rs.headword}: senseId 对应的是 ${headword}，整个词跳过`);
          continue;
        }

        // ── 已有例句：approve / block ──
        for (const d of rs.contexts ?? []) {
          const row = sense.contexts.find((c) => c.id === d.contextId);
          if (!row) { skip(`${headword}: 没有这条例句 ${d.contextId}`); continue; }
          if (row.kind === 'article_original') { skip(`${headword}: 课程文章原句不经这里 ${d.contextId}`); continue; }
          if (row.sentence.trim() !== String(d.sentence ?? '').trim()) {
            skip(`${headword}: 审完后句子变了，不认 —— 审的是「${d.sentence}」，库里是「${row.sentence}」`);
            continue;
          }
          const veto = vetoed.get(row.id);
          if (d.verdict === 'approve' && veto !== undefined && veto === row.sentence.trim()) {
            skip(`${headword}: 审查放行、复核否决，按拦处理 ——「${row.sentence}」`);
          } else if (d.verdict === 'approve') {
            if (isSchoolUnsafeContext(row)) { skip(`${headword}: 审查放行但闸门命中，按拦处理 ——「${row.sentence}」`); }
            else if (row.qualityStatus !== APPROVED_STATUS) {
              await tx.vocabularyContext.update({ where: { id: row.id }, data: { qualityStatus: APPROVED_STATUS } });
              row.qualityStatus = APPROVED_STATUS;
              report.approved += 1;
              continue;
            } else continue;
          }
          if (row.qualityStatus !== 'blocked_school') {
            await tx.vocabularyContext.update({ where: { id: row.id }, data: { qualityStatus: 'blocked_school' } });
            row.qualityStatus = 'blocked_school';
            report.blocked += 1;
          }
        }

        // ── agent 新写的例句：必须复核 approve，且过硬校验 ──
        for (const n of rs.newContexts ?? []) {
          if (!knownKeys.has(n.key)) { skip(`${headword}: 新例句 ${n.key} 没有复核结论，不上`); continue; }
          if (!approvedKeys.has(n.key)) continue;
          const problems: string[] = [];
          if (!NEW_KINDS.has(n.kind)) problems.push(`kind 只能是 short_same_meaning / alternate_topic，给的是 ${n.kind}`);
          if (!containsTarget(n.sentence, headword)) problems.push('句子里没有用到这个词');
          if (!CJK.test(n.translation ?? '')) problems.push('没有中文翻译');
          if (wordsIn(n.sentence) > 25) problems.push('超过 25 个词');
          if (isSchoolUnsafeContext({ sentence: n.sentence, translation: n.translation })) problems.push('闸门命中');
          if (problems.length) { skip(`${headword}: 新例句不上（${problems.join('；')}）——「${n.sentence}」`); continue; }
          const taken = sense.contexts.filter((c) => c.kind === n.kind).map((c) => c.position);
          const position = Math.max(10, ...taken.map((p) => p + 1));
          const created = await tx.vocabularyContext.create({
            data: {
              senseId: sense.id, kind: n.kind, position,
              sentence: n.sentence.trim(), translation: n.translation.trim(),
              difficulty: Math.max(1, Math.min(5, Math.round(n.difficulty ?? 2))),
              provider: AGENT_PROVIDER,
              attribution: `written for secondary-school learners; reviewed (${review.chunk})`,
              qualityStatus: APPROVED_STATUS,
            },
          });
          sense.contexts.push(created);
          report.inserted += 1;
        }

        // ── 释义修正 ──
        const fix = rs.translationFix;
        if (fix) {
          if (!knownKeys.has(fix.key)) skip(`${headword}: 释义修正 ${fix.key} 没有复核结论，不改`);
          else if (approvedKeys.has(fix.key)) {
            if (!CJK.test(fix.value) || isSchoolUnsafeText(fix.value)) skip(`${headword}: 释义修正不改（没有中文或闸门命中）——「${fix.value}」`);
            else if (fix.value.trim() !== sense.translation) {
              await tx.vocabularySense.update({ where: { id: sense.id }, data: { translation: fix.value.trim() } });
              sense.translation = fix.value.trim();
              report.glossFixed += 1;
            }
          }
        }

        // ── 搭配列表 ──
        const col = rs.collocations;
        if (col) {
          if (!knownKeys.has(col.key)) skip(`${headword}: 搭配 ${col.key} 没有复核结论，不改`);
          else if (approvedKeys.has(col.key)) {
            const value = keepSchoolSafeTexts(Array.isArray(col.value) ? col.value : []).slice(0, 6);
            await tx.vocabularySense.update({ where: { id: sense.id }, data: { collocations: value } });
            (sense as { collocations: unknown }).collocations = value;
            report.collocationsSet += 1;
          }
        }

        // ── 还没做的题：补例句、按白名单重滤搭配 ──
        const approved = sense.contexts
          .filter((c) => c.qualityStatus === APPROVED_STATUS)
          .sort((a, b) => a.difficulty - b.difficulty || a.position - b.position);
        const allCollocations = Array.isArray(sense.collocations) ? (sense.collocations as unknown[]).filter((x): x is string => typeof x === 'string') : [];
        const items = await tx.vocabularyV2SessionItem.findMany({
          where: { senseId: sense.id, status: 'pending' },
          select: { id: true, contextId: true, contentSnapshot: true },
        });
        for (const item of items) {
          const snap = { ...((item.contentSnapshot ?? {}) as Record<string, unknown>) };
          let contextId = item.contextId;
          let changed = false;
          if (!snap.sentence && approved.length) {
            const pick = approved.find((c) => c.id === item.contextId) ?? approved[0];
            snap.sentence = pick.sentence;
            snap.sentenceTranslation = pick.translation;
            snap.contextKind = pick.kind;
            contextId = pick.id;
            changed = true;
          }
          const filtered = keepSchoolSafeTexts(collocationsBackedByApproved(allCollocations, approved));
          if (JSON.stringify(snap.collocations ?? []) !== JSON.stringify(filtered)) {
            snap.collocations = filtered;
            changed = true;
          }
          if (changed) {
            await tx.vocabularyV2SessionItem.update({ where: { id: item.id }, data: { contentSnapshot: snap as object, contextId } });
            report.snapshotsFilled += 1;
          }
        }
      }
      if (!commit) throw new Error('__dry_run__');
    }, { timeout: 300_000, maxWait: 30_000 });
    console.log('== 已提交 ==');
  } catch (e) {
    if ((e as Error).message !== '__dry_run__') throw e;
    console.log('== 演练（已回滚，加 --commit 才写入）==');
  } finally {
    await prisma.$disconnect();
  }

  console.log(`块 ${review.chunk}：放行 ${report.approved} · 拦下 ${report.blocked} · 新例句上线 ${report.inserted} · 释义修正 ${report.glossFixed} · 搭配重设 ${report.collocationsSet} · 未做的题更新 ${report.snapshotsFilled}`);
  if (report.skipped.length) {
    console.log(`\n跳过 ${report.skipped.length} 处：`);
    for (const s of report.skipped) console.log(`  · ${s}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
