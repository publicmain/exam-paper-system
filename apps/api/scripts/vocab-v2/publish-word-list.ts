import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { containsTarget, learningAssetQuality, wordCount } from '../../src/vocab-v2/content-quality';
import { OFFICIAL_WORDLIST_META, officialListVersion, searchOfficialWords, type OfficialWord } from '../../src/vocab-v2/official-wordlists';
import { canonicalPos, senseKey, translationForPos } from '../../src/vocab-v2/sense-content';
import { headwordKey, seenHeadwordSet } from '../../src/vocab-v2/unified-vocabulary-rules';
import {
  dayQuotas,
  distributeByPos,
  parseWordList,
  teachingDaysOfWeek,
  type ParsedWord,
} from '../../src/vocab-v2/word-list-plan';

/**
 * 老师词表一周发布流水线（2026-09-05）。
 *
 * 叶老师只给三样：词表、哪一周、（可选）哪几个班。其余这里做：
 *   清洗 → 查词（官方词表 / 库里已有 / ECDICT / 我手写的内容包）→ 按学生
 *   历史按拼写查重 → 按词性排天 → 发到所有班 → 对库核验 → 出一页确认单。
 *
 * 三个动作，默认只预览：
 *
 *   npx ts-node apps/api/scripts/vocab-v2/publish-word-list.ts \
 *     --week=2026-09-14 --words=apps/api/scripts/vocab-v2/wordlists/2026-09-14/words.txt \
 *     [--content=.../content.json] [--classes=all|IAL26S1,IAL27W] [--per-day=auto|8] [--title=…]
 *     [--preview | --publish | --verify]
 *
 *   --preview  只读。写 preview.md + needs-content.json（缺释义例句的词，
 *              我照着补成 content.json 再跑）。
 *   --publish  写库：内容包里的词建 lexeme / sense / 例句；每班每天建
 *              VocabularyV2Assignment。需要 WORDLIST_CONFIRM=PUBLISH_WORD_LIST_PRODUCTION，
 *              且 railway 目标必须是 glorious-motivation / production。
 *   --verify   只读。从库里读回这周的布置，写 confirm.md（给叶老师看的确认单）。
 *
 * 全程在仓库根目录用 `railway run -s Postgres -e production -- …` 跑；零 Anthropic API。
 *
 * 词表格式：一行一个词；`# 注释`；`word, 备注`；`*word` / `word!` = force
 * （见过的学生也照推）。词表外的词允许 —— 没有可发布内容的会列在
 * needs-content.json 里等我补。
 *
 * 内容包 content.json：
 *   { "plantation": { "pos": "noun", "phonetic": "plænˈteɪʃən",
 *       "definition": "a large farm where tea or rubber is grown",
 *       "translation": "n. 种植园",
 *       "examples": [ { "sentence": "…plantation…", "translation": "…" }, … ] } }
 *   例句必须含这个词（含常见变形）、4–35 词、带中文。官方词表里的词也可以
 *   放进内容包 —— 用来覆盖库里 Tatoeba 例句质量差的那几条。
 *
 * 去重口径：一个班里**所有**在册学生都见过、且不 force 的词，这个班不发
 * （没人会拿到）；部分学生见过的照发，学生开始当天任务时按拼写各自跳过
 * （见 vocabulary-v2.service createTeacherDailySession）。
 */

type Mode = 'preview' | 'publish' | 'verify';

interface ContentPackEntry {
  pos?: string;
  phonetic?: string;
  definition?: string;
  translation?: string;
  examples?: Array<{ sentence: string; translation: string }>;
}

interface ResolvedWord extends ParsedWord {
  pos: string;
  phonetic: string | null;
  definition: string;
  translation: string;
  /** official | stored | dict | pack | missing */
  source: 'official' | 'stored' | 'dict' | 'pack' | 'missing';
  official: OfficialWord | null;
  /** 库里已有的可发布 sense（官方词或已建过的词表外词）。 */
  senseId: string | null;
  /** 内容包提供的例句（发布时写成 contexts）。 */
  packExamples: Array<{ sentence: string; translation: string }>;
  /** 库里已有的可发布例句条数。 */
  storedContexts: number;
  /** 内容包里有这个词（释义 / 词性以内容包为准，发布时同步进 sense）。 */
  fromPack: boolean;
  problems: string[];
}

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const MODE: Mode = flag('publish') ? 'publish' : flag('verify') ? 'verify' : 'preview';
const WEEK = opt('week') ?? '';
const WORDS_FILE = opt('words') ?? '';
const CONTENT_FILE = opt('content');
const CLASSES = opt('classes') ?? 'all';
const PER_DAY_RAW = opt('per-day') ?? 'auto';
const PER_DAY: number | 'auto' = PER_DAY_RAW === 'auto' ? 'auto' : Number(PER_DAY_RAW);
const OUT_DIR = opt('out') ?? (WORDS_FILE ? dirname(resolve(process.cwd(), WORDS_FILE)) : process.cwd());
const TITLE_PREFIX = opt('title') ?? `老师词表 ${WEEK}`;
const CONFIRM_TOKEN = 'PUBLISH_WORD_LIST_PRODUCTION';
const TEACHER_LIST = { listName: 'teacher', listVersion: '1' } as const;
const PACK_PROVIDER = 'teacher_pack';

/** 与 scripts/pilot/prepare-pilot-week.js 同一批注册班（内部冒烟班 p1_class 不算）。 */
const LAUNCH_CLASS_CODES = ['SGCE26W', 'SEC27W', 'OL26W', 'IAL27W', 'IAL27M', 'IAL26W', 'IAL26S2', 'IAL26S1', 'IAL28S'];

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
});

function sgtToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function exactOfficial(headword: string): OfficialWord | null {
  const found = searchOfficialWords(headword, 10).filter((word) => word.headword === headword);
  return found.find((word) => word.list === 'ngsl') ?? found[0] ?? null;
}

/**
 * 官方词表的词性偶有错（NAWL 把 monopoly 标成 adv）。ECDICT 的 pos 是
 * 「n:90/v:10」这种占比串：官方词性在里面就信官方，不在就取 ECDICT 占比
 * 最高的那个。
 */
function reconcilePos(officialPos: string | null | undefined, dictPos: string | null | undefined): string {
  const official = canonicalPos(officialPos);
  const shares = String(dictPos ?? '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [label, share] = part.split(':');
      return { pos: canonicalPos(label), share: Number(share ?? 0) || 0 };
    })
    .filter((row) => row.pos !== 'other');
  if (!shares.length) return official;
  if (shares.some((row) => row.pos === official)) return official;
  return shares.sort((a, b) => b.share - a.share)[0].pos;
}

function loadContentPack(): Record<string, ContentPackEntry> {
  if (!CONTENT_FILE) return {};
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), CONTENT_FILE), 'utf8')) as Record<string, ContentPackEntry>;
  const pack: Record<string, ContentPackEntry> = {};
  for (const [key, value] of Object.entries(raw)) pack[headwordKey(key)] = value;
  return pack;
}

function validateExamples(headword: string, examples: Array<{ sentence: string; translation: string }> | undefined): { ok: Array<{ sentence: string; translation: string }>; problems: string[] } {
  const ok: Array<{ sentence: string; translation: string }> = [];
  const problems: string[] = [];
  for (const [index, example] of (examples ?? []).entries()) {
    const sentence = String(example?.sentence ?? '').replace(/\s+/g, ' ').trim();
    const translation = String(example?.translation ?? '').trim();
    const n = wordCount(sentence);
    if (!sentence || !translation) { problems.push(`例句 ${index + 1} 缺英文或中文`); continue; }
    if (n < 4 || n > 35) { problems.push(`例句 ${index + 1} 长度 ${n} 词（要 4–35）`); continue; }
    if (!containsTarget(sentence, headword)) { problems.push(`例句 ${index + 1} 里没有 ${headword}`); continue; }
    ok.push({ sentence, translation });
  }
  return { ok, problems };
}

async function resolveWord(word: ParsedWord, pack: Record<string, ContentPackEntry>): Promise<ResolvedWord> {
  const entry = pack[word.headword];
  const packExamples = validateExamples(word.headword, entry?.examples);
  const base: ResolvedWord = {
    ...word,
    pos: 'other',
    phonetic: null,
    definition: '',
    translation: '',
    source: 'missing',
    official: null,
    senseId: null,
    packExamples: packExamples.ok,
    storedContexts: 0,
    fromPack: Boolean(entry),
    problems: [...packExamples.problems],
  };

  const official = exactOfficial(word.headword);
  // 库里已有的 lexeme（官方 / teacher / personal 都算），带 ready 例句
  const stored = await prisma.vocabularyLexeme.findMany({
    where: { headword: word.headword },
    include: { senses: { include: { contexts: { where: { qualityStatus: 'ready' } } } } },
    orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
  });
  const storedReady = stored
    .flatMap((lexeme) => lexeme.senses.map((sense) => ({ lexeme, sense })))
    .filter(({ sense }) => sense.qualityStatus === 'ready')
    .sort((a, b) => (a.lexeme.listName === official?.list ? -1 : 0) - (b.lexeme.listName === official?.list ? -1 : 0));
  const best = storedReady[0] ?? null;
  const dict = await prisma.dictEntry.findUnique({ where: { word: word.headword } });

  if (official) {
    base.source = 'official';
    base.official = official;
    base.pos = reconcilePos(official.pos, dict?.pos);
    base.phonetic = official.phonetic || dict?.phonetic || null;
    base.definition = official.definition;
    base.translation = translationForPos(dict?.translation, base.pos);
  } else if (best) {
    base.source = 'stored';
    base.pos = best.sense.pos;
    base.phonetic = best.lexeme.phonetic;
    base.definition = best.sense.definition;
    base.translation = best.sense.translation;
  } else if (dict) {
    base.source = 'dict';
    base.pos = canonicalPos(dict.pos);
    base.phonetic = dict.phonetic ?? null;
    base.definition = dict.definition ?? '';
    base.translation = translationForPos(dict.translation, base.pos);
  }
  if (best) {
    base.senseId = best.sense.id;
    base.storedContexts = best.sense.contexts.filter((context) =>
      wordCount(context.sentence) >= 4 && wordCount(context.sentence) <= 35 && containsTarget(context.sentence, word.headword) && context.translation.trim().length > 0,
    ).length;
    if (!base.translation) base.translation = best.sense.translation;
    if (!base.definition) base.definition = best.sense.definition;
  }
  // 内容包覆盖一切（我手写的优先）
  if (entry) {
    if (entry.pos) base.pos = canonicalPos(entry.pos);
    if (entry.phonetic) base.phonetic = entry.phonetic;
    if (entry.definition) base.definition = entry.definition.trim();
    if (entry.translation) base.translation = entry.translation.trim();
    if (base.source === 'missing' || base.source === 'dict') base.source = 'pack';
  }

  if (!base.definition) base.problems.push('缺英文释义');
  if (!base.translation) base.problems.push('缺中文释义');
  if (base.storedContexts === 0 && base.packExamples.length === 0) base.problems.push('缺例句');
  return base;
}

async function loadClasses() {
  const codes = CLASSES === 'all' ? LAUNCH_CLASS_CODES : CLASSES.split(',').map((code) => code.trim()).filter(Boolean);
  const rows = await prisma.class.findMany({
    where: { classCode: { in: codes } },
    select: {
      id: true,
      name: true,
      classCode: true,
      enrollments: {
        where: { role: 'student', user: { archivedAt: null } },
        select: { userId: true },
      },
    },
    orderBy: { classCode: 'asc' },
  });
  const missing = codes.filter((code) => !rows.some((row) => row.classCode === code));
  if (missing.length) throw new Error(`找不到班级：${missing.join(', ')}`);
  return rows;
}

/** 每个学生见过的拼写集合（一次查完，按 studentId 分组）。 */
async function seenByStudent(studentIds: string[]): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (!studentIds.length) return result;
  const rows = await prisma.studentVocabularySense.findMany({
    where: { studentId: { in: studentIds } },
    select: { studentId: true, sense: { select: { lexeme: { select: { headword: true } } } } },
  });
  const grouped = new Map<string, Array<{ headword: string }>>();
  for (const row of rows) {
    if (!grouped.has(row.studentId)) grouped.set(row.studentId, []);
    grouped.get(row.studentId)!.push({ headword: row.sense.lexeme.headword });
  }
  for (const id of studentIds) result.set(id, seenHeadwordSet(grouped.get(id) ?? []));
  return result;
}

interface ClassPlan {
  classId: string;
  code: string;
  name: string;
  students: number;
  /** headword → 见过的学生数 */
  seenCount: Map<string, number>;
  /** 全班都见过、不 force → 这个班不发 */
  dropped: string[];
  days: Array<{ date: string; words: ResolvedWord[] }>;
}

function buildClassPlans(
  classes: Awaited<ReturnType<typeof loadClasses>>,
  seen: Map<string, Set<string>>,
  dayPlan: Array<{ date: string; words: ResolvedWord[] }>,
): ClassPlan[] {
  return classes.map((klass) => {
    const studentIds = klass.enrollments.map((row) => row.userId);
    const seenCount = new Map<string, number>();
    for (const day of dayPlan) for (const word of day.words) {
      seenCount.set(word.headword, studentIds.filter((id) => seen.get(id)?.has(word.headword)).length);
    }
    const dropped: string[] = [];
    const days = dayPlan.map((day) => ({
      date: day.date,
      words: day.words.filter((word) => {
        const all = studentIds.length > 0 && seenCount.get(word.headword) === studentIds.length;
        if (all && !word.force) { dropped.push(word.headword); return false; }
        return true;
      }),
    }));
    return { classId: klass.id, code: klass.classCode, name: klass.name, students: studentIds.length, seenCount, dropped, days };
  });
}

function md(lines: string[]) { return lines.join('\n') + '\n'; }

function previewMarkdown(input: {
  parsed: ReturnType<typeof parseWordList>;
  resolved: ResolvedWord[];
  dayPlan: Array<{ date: string; words: ResolvedWord[] }>;
  classPlans: ClassPlan[];
  skippedPastDays: string[];
}) {
  const { parsed, resolved, dayPlan, classPlans, skippedPastDays } = input;
  const blocked = resolved.filter((word) => word.problems.length);
  const lines: string[] = [];
  lines.push(`# 老师词表预览 · ${WEEK} 那一周`, '');
  lines.push(`- 词表：${basename(WORDS_FILE)}，收到 ${parsed.words.length} 个词；拒收 ${parsed.rejected.length}，重复 ${parsed.duplicates.length}`);
  lines.push(`- 可发布 ${resolved.length - blocked.length} 个，缺内容 ${blocked.length} 个（见 needs-content.json）`);
  lines.push(`- 排天：${dayPlan.map((day) => `${day.date.slice(5)}（${day.words.length}）`).join(' · ')}${skippedPastDays.length ? `；已过去的 ${skippedPastDays.join(', ')} 不排` : ''}`);
  lines.push(`- 班级：${classPlans.map((plan) => `${plan.code}（${plan.students} 人）`).join(' · ')}`, '');
  if (parsed.rejected.length) {
    lines.push('## 拒收的行', '');
    for (const row of parsed.rejected) lines.push(`- 第 ${row.line} 行「${row.raw}」：${row.reason}`);
    lines.push('');
  }
  if (parsed.duplicates.length) {
    lines.push('## 重复的词（只留第一次出现）', '');
    for (const row of parsed.duplicates) lines.push(`- 第 ${row.line} 行 ${row.headword}`);
    lines.push('');
  }
  if (blocked.length) {
    lines.push('## 缺内容的词（补进 content.json 再跑）', '');
    for (const word of blocked) lines.push(`- **${word.headword}**（${word.source}）：${word.problems.join('；')}`);
    lines.push('');
  }
  lines.push('## 每天的词', '');
  for (const day of dayPlan) {
    lines.push(`### ${day.date}（${day.words.length} 个）`, '');
    lines.push('| # | 词 | 词性 | 中文 | 来源 | 例句 | force |', '|---|---|---|---|---|---|---|');
    day.words.forEach((word, index) => {
      const examples = word.packExamples.length ? `内容包 ${word.packExamples.length} 句` : `库里 ${word.storedContexts} 句`;
      lines.push(`| ${index + 1} | ${word.headword} | ${word.pos} | ${word.translation.replace(/\|/g, '／')} | ${word.source} | ${examples} | ${word.force ? '✓' : ''} |`);
    });
    lines.push('');
  }
  lines.push('## 按班查重', '');
  for (const plan of classPlans) {
    const partial = [...plan.seenCount.entries()].filter(([headword, count]) => count > 0 && !plan.dropped.includes(headword));
    lines.push(`### ${plan.code}（${plan.students} 人）`, '');
    lines.push(plan.dropped.length ? `- 全班都见过、不发：${plan.dropped.join('、')}` : '- 全班都见过的：无');
    lines.push(partial.length ? `- 部分学生见过（照发，见过的学生自动跳过）：${partial.map(([headword, count]) => `${headword}（${count} 人）`).join('、')}` : '- 部分学生见过的：无');
    lines.push('');
  }
  return md(lines);
}

function needsContentSkeleton(resolved: ResolvedWord[]) {
  const out: Record<string, ContentPackEntry> = {};
  for (const word of resolved.filter((row) => row.problems.length)) {
    out[word.headword] = {
      pos: word.pos === 'other' ? '' : word.pos,
      phonetic: word.phonetic ?? '',
      definition: word.definition,
      translation: word.translation,
      examples: word.packExamples.length ? word.packExamples : [{ sentence: '', translation: '' }, { sentence: '', translation: '' }],
    };
  }
  return out;
}

function assertPublishGates() {
  const env = process.env;
  const problems: string[] = [];
  if (env.WORDLIST_CONFIRM !== CONFIRM_TOKEN) problems.push(`缺确认串 WORDLIST_CONFIRM=${CONFIRM_TOKEN}`);
  if (env.RAILWAY_PROJECT_NAME !== 'glorious-motivation' || env.RAILWAY_ENVIRONMENT_NAME !== 'production') {
    problems.push('railway 目标不是 glorious-motivation / production（要用 railway run -s Postgres -e production）');
  }
  try {
    const url = new URL(String(env.DATABASE_PUBLIC_URL ?? ''));
    if (!env.RAILWAY_TCP_PROXY_DOMAIN || url.hostname !== env.RAILWAY_TCP_PROXY_DOMAIN) problems.push('DATABASE_PUBLIC_URL 的主机名不等于 RAILWAY_TCP_PROXY_DOMAIN');
  } catch {
    problems.push('DATABASE_PUBLIC_URL 不是合法的连接串');
  }
  if (problems.length) throw new Error(`拒绝发布：\n  ${problems.join('\n  ')}`);
}

async function publish(resolved: ResolvedWord[], classPlans: ClassPlan[]) {
  assertPublishGates();
  const admin = await prisma.user.findFirst({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  if (!admin) throw new Error('库里没有 admin 用户');
  const weekDays = teachingDaysOfWeek(WEEK);

  // 1) 每个词落到一个 senseId：官方词补建；词表外的建 teacher lexeme；内容包例句写成 contexts
  const senseByHeadword = new Map<string, string>();
  for (const word of resolved) {
    let senseId = word.senseId;
    if (!senseId) {
      if (word.official) {
        const lexeme = await prisma.vocabularyLexeme.upsert({
          where: { listName_listVersion_headword: { listName: word.official.list, listVersion: officialListVersion(word.official.list), headword: word.headword } },
          create: { listName: word.official.list, listVersion: officialListVersion(word.official.list), rank: word.official.rank, headword: word.headword, phonetic: word.phonetic, attribution: OFFICIAL_WORDLIST_META.attribution },
          update: { phonetic: word.phonetic },
        });
        const sense = await prisma.vocabularySense.upsert({
          where: { lexemeId_senseKey: { lexemeId: lexeme.id, senseKey: senseKey(word.pos) } },
          create: { lexemeId: lexeme.id, senseKey: senseKey(word.pos), pos: word.pos, definition: word.definition, translation: word.translation, qualityStatus: 'ready' },
          update: { pos: word.pos, definition: word.definition, translation: word.translation, qualityStatus: 'ready' },
        });
        senseId = sense.id;
      } else {
        const lexeme = await prisma.vocabularyLexeme.upsert({
          where: { listName_listVersion_headword: { ...TEACHER_LIST, headword: word.headword } },
          create: { ...TEACHER_LIST, rank: 0, headword: word.headword, phonetic: word.phonetic, attribution: 'teacher word list + school teaching content' },
          update: { phonetic: word.phonetic },
        });
        const sense = await prisma.vocabularySense.upsert({
          where: { lexemeId_senseKey: { lexemeId: lexeme.id, senseKey: senseKey(word.pos) } },
          create: { lexemeId: lexeme.id, senseKey: senseKey(word.pos), pos: word.pos, definition: word.definition, translation: word.translation, qualityStatus: 'ready' },
          update: { pos: word.pos, definition: word.definition, translation: word.translation, qualityStatus: 'ready' },
        });
        senseId = sense.id;
      }
    } else if (word.fromPack) {
      // 内容包是我手写的，以它为准 → 同步进已有 sense
      await prisma.vocabularySense.update({ where: { id: senseId }, data: { pos: word.pos, definition: word.definition, translation: word.translation, qualityStatus: 'ready' } });
    }
    // 内容包例句：第一句 short_same_meaning#1，其余 alternate_topic#1..n（覆盖同位置旧句）
    for (const [index, example] of word.packExamples.entries()) {
      const kind = index === 0 ? 'short_same_meaning' : 'alternate_topic';
      const position = index === 0 ? 1 : index;
      await prisma.vocabularyContext.upsert({
        where: { senseId_kind_position: { senseId, kind, position } },
        create: { senseId, kind, position, sentence: example.sentence, translation: example.translation, difficulty: index === 0 ? 2 : 3, qualityStatus: 'ready', provider: PACK_PROVIDER, attribution: 'school teaching content (chat-authored)' },
        update: { sentence: example.sentence, translation: example.translation, qualityStatus: 'ready', provider: PACK_PROVIDER, attribution: 'school teaching content (chat-authored)' },
      });
    }
    // 发布前最后一道门：这个 sense 现在必须可发布
    const check = await prisma.vocabularySense.findUnique({ where: { id: senseId }, include: { lexeme: true, contexts: { where: { qualityStatus: 'ready' } } } });
    const quality = check ? learningAssetQuality({ headword: check.lexeme.headword, translation: check.translation, definition: check.definition, contexts: check.contexts }) : { publishable: false, errors: ['missing'] };
    if (!quality.publishable) throw new Error(`${word.headword} 写完仍不可发布：${quality.errors.join(', ')}`);
    senseByHeadword.set(word.headword, senseId);
  }

  // 2) 每班每天一条布置。这周里不在计划内、但标题是本流水线的旧布置删掉（重发时收缩天数）。
  let created = 0;
  let updated = 0;
  let removed = 0;
  for (const plan of classPlans) {
    await prisma.$transaction(async (tx) => {
      const planned = new Set(plan.days.filter((day) => day.words.length).map((day) => day.date));
      const stale = await tx.vocabularyV2Assignment.findMany({
        where: { classId: plan.classId, date: { in: weekDays.map((day) => new Date(`${day}T00:00:00.000Z`)) }, title: { startsWith: TITLE_PREFIX } },
        select: { id: true, date: true },
      });
      for (const row of stale) {
        if (!planned.has(row.date.toISOString().slice(0, 10))) {
          await tx.vocabularyV2Assignment.delete({ where: { id: row.id } });
          removed += 1;
        }
      }
      for (const [index, day] of plan.days.entries()) {
        if (!day.words.length) continue;
        const date = new Date(`${day.date}T00:00:00.000Z`);
        const title = `${TITLE_PREFIX} · 第 ${index + 1} 天`;
        const current = await tx.vocabularyV2Assignment.findUnique({ where: { classId_date: { classId: plan.classId, date } } });
        const saved = current
          ? await tx.vocabularyV2Assignment.update({ where: { id: current.id }, data: { title, assignedById: admin.id, status: 'published', version: { increment: 1 } } })
          : await tx.vocabularyV2Assignment.create({ data: { classId: plan.classId, date, title, assignedById: admin.id } });
        if (current) updated += 1; else created += 1;
        await tx.vocabularyV2AssignmentItem.deleteMany({ where: { assignmentId: saved.id } });
        await tx.vocabularyV2AssignmentItem.createMany({
          data: day.words.map((word, position) => ({ assignmentId: saved.id, senseId: senseByHeadword.get(word.headword)!, position: position + 1, force: word.force })),
        });
      }
    }, { timeout: 120_000 });
  }
  console.log(`\n已发布：新建 ${created} 条、更新 ${updated} 条、删掉过期 ${removed} 条布置；以 ${admin.name} 名义。`);
}

async function verify(classes: Awaited<ReturnType<typeof loadClasses>>) {
  const weekDays = teachingDaysOfWeek(WEEK);
  const rows = await prisma.vocabularyV2Assignment.findMany({
    where: { classId: { in: classes.map((klass) => klass.id) }, date: { in: weekDays.map((day) => new Date(`${day}T00:00:00.000Z`)) } },
    include: { items: { orderBy: { position: 'asc' }, include: { sense: { include: { lexeme: true, contexts: { where: { qualityStatus: 'ready' } } } } } } },
    orderBy: [{ classId: 'asc' }, { date: 'asc' }],
  });
  const lines: string[] = [];
  lines.push(`# 老师词表确认单 · ${WEEK} 那一周`, '', `核验时间 ${new Date().toISOString()}（从生产库读回）`, '');
  let problems = 0;
  const byClass = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!byClass.has(row.classId)) byClass.set(row.classId, []);
    byClass.get(row.classId)!.push(row);
  }
  // 每天的词 = 各班这一天的并集（个别班因全班见过而少发的，在下面的表里列出）
  type Item = (typeof rows)[number]['items'][number];
  const unionByDate = new Map<string, Map<string, Item>>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    if (!unionByDate.has(key)) unionByDate.set(key, new Map());
    for (const item of row.items) if (!unionByDate.get(key)!.has(item.sense.lexeme.headword)) unionByDate.get(key)!.set(item.sense.lexeme.headword, item);
  }
  const dates = [...unionByDate.keys()].sort();
  lines.push('## 每天的词', '');
  for (const date of dates) {
    const items = [...unionByDate.get(date)!.values()];
    lines.push(`### ${date}（${items.length} 个）`, '');
    items.forEach((item, index) => {
      const quality = learningAssetQuality({ headword: item.sense.lexeme.headword, translation: item.sense.translation, definition: item.sense.definition, contexts: item.sense.contexts });
      if (!quality.publishable) problems += 1;
      lines.push(`- ${index + 1}. **${item.sense.lexeme.headword}** ${item.sense.pos} — ${item.sense.translation}${item.force ? '（force）' : ''}${quality.publishable ? '' : ` ❌ ${quality.errors.join(',')}`}`);
    });
    lines.push('');
  }
  lines.push('## 各班', '');
  lines.push('| 班级 | 在册 | 天数 | 词数 | 比并集少的（全班都学过） |', '|---|---|---|---|---|');
  for (const klass of classes) {
    const list = byClass.get(klass.id) ?? [];
    const total = list.reduce((sum, row) => sum + row.items.length, 0);
    const diff: string[] = [];
    for (const date of dates) {
      const mine = list.find((row) => row.date.toISOString().slice(0, 10) === date);
      const myWords = new Set((mine?.items ?? []).map((item) => item.sense.lexeme.headword));
      const missing = [...unionByDate.get(date)!.keys()].filter((word) => !myWords.has(word));
      if (missing.length) diff.push(`${date.slice(5)} 少 ${missing.join('/')}`);
    }
    // 同一周内同一班不能有重复拼写
    const all = list.flatMap((row) => row.items.map((item) => item.sense.lexeme.headword));
    const dup = all.filter((word, index) => all.indexOf(word) !== index);
    if (dup.length) { problems += 1; diff.push(`重复：${dup.join('/')}`); }
    lines.push(`| ${klass.classCode} | ${klass.enrollments.length} | ${list.length} | ${total} | ${diff.join('；') || '—'} |`);
  }
  lines.push('', problems ? `❌ ${problems} 处问题` : '✅ 每个词都可发布，各班无重复');
  const text = md(lines);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, 'confirm.md'), text, 'utf8');
  console.log(text);
  console.log(`确认单已写到 ${resolve(OUT_DIR, 'confirm.md')}`);
  if (problems) process.exitCode = 1;
}

async function main() {
  if (!WEEK) throw new Error('缺 --week=YYYY-MM-DD（周一）');
  const classes = await loadClasses();
  if (MODE === 'verify') { await verify(classes); return; }
  if (!WORDS_FILE || !existsSync(resolve(process.cwd(), WORDS_FILE))) throw new Error('缺 --words=<词表文件>');

  const parsed = parseWordList(readFileSync(resolve(process.cwd(), WORDS_FILE), 'utf8'));
  if (!parsed.words.length) throw new Error('词表里一个词都没有');
  const pack = loadContentPack();
  const resolved: ResolvedWord[] = [];
  for (const word of parsed.words) resolved.push(await resolveWord(word, pack));
  const publishable = resolved.filter((word) => !word.problems.length);

  // 排天：只排今天及以后的教学日
  const today = sgtToday();
  const weekDays = teachingDaysOfWeek(WEEK);
  const usableDays = weekDays.filter((day) => day >= today);
  const skippedPastDays = weekDays.filter((day) => day < today);
  if (!usableDays.length) throw new Error(`${WEEK} 那一周已经过完了`);
  const quotas = dayQuotas(publishable.length, PER_DAY);
  if (quotas.length > usableDays.length) {
    throw new Error(`这周只剩 ${usableDays.length} 个教学日，装不下 ${publishable.length} 个词（需要 ${quotas.length} 天）；用 --per-day 调大每天的量`);
  }
  const dayPlan = distributeByPos(publishable, quotas).map((words, index) => ({ date: usableDays[index], words }));

  const seen = await seenByStudent(classes.flatMap((klass) => klass.enrollments.map((row) => row.userId)));
  const classPlans = buildClassPlans(classes, seen, dayPlan);

  mkdirSync(OUT_DIR, { recursive: true });
  const preview = previewMarkdown({ parsed, resolved, dayPlan, classPlans, skippedPastDays });
  writeFileSync(resolve(OUT_DIR, 'preview.md'), preview, 'utf8');
  const needs = needsContentSkeleton(resolved);
  if (Object.keys(needs).length) writeFileSync(resolve(OUT_DIR, 'needs-content.json'), JSON.stringify(needs, null, 2) + '\n', 'utf8');
  console.log(preview);
  console.log(`预览已写到 ${resolve(OUT_DIR, 'preview.md')}${Object.keys(needs).length ? `；缺内容清单 ${resolve(OUT_DIR, 'needs-content.json')}` : ''}`);

  if (MODE === 'publish') {
    if (resolved.length !== publishable.length) throw new Error(`还有 ${resolved.length - publishable.length} 个词缺内容，先补 content.json`);
    await publish(publishable, classPlans);
    await verify(classes);
  }
}

main()
  .catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
