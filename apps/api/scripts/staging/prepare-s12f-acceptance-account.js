/**
 * S12F —— **给用户建一个仿生产的合成验收账号**（staging 专用）。
 *
 * 阶段 12 的收尾项：用户要亲手从头到尾走一遍线性七步流程。走之前需要一个
 * **看起来像真的用了两周**的账号 —— 有历史成绩、有正式测试记录、有一本
 * 攒起来的生词、有一本带各种状态的错题，而**今天那一课一步都没被动过**。
 *
 * ## 与 t1–t8 的区别
 *
 * 那八个是**场景夹具**：每个只钉住一个边界（没分级、没内容、零到期词……），
 * 数据薄，且 t6 走的是 staging 免密按钮。这一个不同：
 *
 *   · **走普通的姓名 + PIN 登录**，不碰免密端点，不加任何鉴权旁路；
 *   · 数据是**厚的** —— 12 份阅读答卷、11 次正式测试、50 个生词、
 *     20 条错题、110+ 条复习流水；
 *   · **今天是干净的** —— 没有任务行、没有答卷、没有考勤、没有测试。
 *     第一个创建当天状态的人必须是用户本人。
 *
 * ## 安全闸门
 *
 * 前八道**在加载 Prisma 之前**跑完（见 `assertEnvGates`）：
 *
 *   1. `RAILWAY_PROJECT_ID` 逐字等于 staging 项目 id；
 *   2. `RAILWAY_PROJECT_NAME` === `exam-staging-manual`；
 *   3. `RAILWAY_ENVIRONMENT_NAME` === `production`；
 *   4. `RAILWAY_SERVICE_NAME` === `Postgres`；
 *   5. `DATABASE_PUBLIC_URL` 是合法的 PostgreSQL URL；
 *   6. 它的 **hostname 等于 `RAILWAY_TCP_PROXY_DOMAIN`**；
 *   7. 它的 **端口等于 `RAILWAY_TCP_PROXY_PORT`**；
 *   8. 逐字确认串 + `S12F_ACCEPTANCE_PIN` 恰好八位数字。
 *
 * 第 6、7 道是 S12E 返工 1/2 补上的那一条：项目 id 能证明「是不是那个
 * 项目」，证明不了「连过去的地址是不是那个项目的 Postgres 代理」。
 *
 * 其余三道要读库，放在事务里、在**任何写之前**（见 `runPreflight`）：
 *
 *   9. 通知全关（`NotificationConfig(enabled=true)` 与 `NotificationLog` 都是 0）；
 *  10. 库里的在读学生**正好**是 t1–t8，或者 t1–t8 加上本账号；
 *  11. 本脚本可能替换的每一行，id 都带 `s12f_` 前缀。
 *
 * ## PIN
 *
 * **仓库里没有默认 PIN，也不存在任何回退。** PIN 由调用方在内存里随机
 * 生成后经 `S12F_ACCEPTANCE_PIN` 传入；本文件只把它交给 bcrypt，
 * **不打印、不写日志、不写回执**。哈希同样不打印。
 *
 * ## 幂等与重跑保护
 *
 * 交接给用户**之前**可以安全重跑：脚本会先删掉自己拥有的 `s12f_` 行再重建。
 * 一旦出现**用户造出来的业务状态**（当天的任务行 / 答卷 / 逐题答案 /
 * 正式测试 / 复习流水 / 错题重练 / 申诉，或任何不带前缀的行），
 * **脚本拒绝执行** —— 那时重建等于毁掉用户的验收证据。
 *
 * t1–t8 的任何一行都**不在写入范围内**，无论哪条路径。
 *
 * ## 跑法
 *
 * ```bash
 * RAILWAY_PROJECT_ID=… RAILWAY_PROJECT_NAME=… RAILWAY_ENVIRONMENT_NAME=… \
 * RAILWAY_SERVICE_NAME=Postgres DATABASE_PUBLIC_URL=… \
 * RAILWAY_TCP_PROXY_DOMAIN=… RAILWAY_TCP_PROXY_PORT=… \
 * S12F_CONFIRM=S12F_CREATE_PRODUCTION_LIKE_ACCEPTANCE_ACCOUNT \
 * S12F_ACCEPTANCE_PIN=<内存里随机生成的八位数字> \
 *   node apps/api/scripts/staging/prepare-s12f-acceptance-account.js
 * ```
 *
 * 调用方负责把 Postgres 服务的变量取进**内存**再传进来 —— 不要落盘。
 */

'use strict';

// ⚠️ 顺序有意义：先拍环境快照，再加载任何会碰 dotenv 的东西。
// 本文件在闸门通过之前**不 require @prisma/client**。
const ENV_AT_STARTUP = {
  RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID || '',
  RAILWAY_PROJECT_NAME: process.env.RAILWAY_PROJECT_NAME || '',
  RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME || '',
  RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME || '',
  DATABASE_PUBLIC_URL: process.env.DATABASE_PUBLIC_URL || '',
  RAILWAY_TCP_PROXY_DOMAIN: process.env.RAILWAY_TCP_PROXY_DOMAIN || '',
  RAILWAY_TCP_PROXY_PORT: process.env.RAILWAY_TCP_PROXY_PORT || '',
  S12F_CONFIRM: process.env.S12F_CONFIRM || '',
  S12F_ACCEPTANCE_PIN: process.env.S12F_ACCEPTANCE_PIN || '',
};

// ─────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────

const CONFIRMATION = 'S12F_CREATE_PRODUCTION_LIKE_ACCEPTANCE_ACCOUNT';
const OWNED_PREFIX = 's12f_';

const EXPECTED_RAILWAY = {
  RAILWAY_PROJECT_ID: 'ed8c31c0-6499-4611-830a-64043189f7d0',
  RAILWAY_PROJECT_NAME: 'exam-staging-manual',
  RAILWAY_ENVIRONMENT_NAME: 'production',
  RAILWAY_SERVICE_NAME: 'Postgres',
};

/** 既有的八个场景夹具 —— 只用于「指错库」这道闸，**不在写入范围内**。 */
const FIXTURE_STUDENT_IDS = [
  't1_normal',
  't2_nolevel',
  't3_noatt',
  't4_newwords',
  't5_review',
  't6_done',
  't7_nocontent',
  't8_zero',
];

/** 沿用的既有资源（本脚本只作为外键指过去，一行都不改）。 */
const REUSED = {
  teacherId: 't_stgteacher',
  subjectId: 'stg_sub',
};

const ACCOUNT = {
  id: 's12f_acceptance_student',
  name: '验收学生林思远',
  email: 's12f.acceptance@example.invalid',
  englishLevel: 'ielts_authentic',
  classId: 's12f_class',
  className: '验收班 S12F',
  classCode: 'S12FACC',
};

/** 今天那份卷子里**留给用户查词**的那个单词：词典里有，本账号本子里没有。 */
const RESERVED_LOOKUP_WORD = 'blossom';

/** 今天那份卷子里指定给「填入第 N 题」的那道填空题（sortOrder）。 */
const FILL_TARGET_SORT_ORDER = 4;

// ─────────────────────────────────────────────────────────────
// 安全错误：只有本文件构造的错误才允许把 message 打出来
// ─────────────────────────────────────────────────────────────

const SAFE_ERRORS = new WeakSet();

class S12fSafeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'S12fSafeError';
    SAFE_ERRORS.add(this);
  }
}

const GENERIC_FAILURE = [
  'S12F 验收账号夹具未执行：运行期失败。',
  '细节被刻意隐去 —— 底层错误（Prisma / 连接 / SQL）的文本里可能含有',
  '数据库连接串、账号或主机名。请在你自己的终端里排查。',
].join('\n');

function reportFailure(e, log = console.error) {
  if (SAFE_ERRORS.has(e) && typeof e.message === 'string') {
    log(['', 'S12F 验收账号夹具未执行：', e.message, ''].join('\n'));
    return;
  }
  log(['', GENERIC_FAILURE, ''].join('\n'));
}

// ─────────────────────────────────────────────────────────────
// 闸门（前八道，全部在加载 Prisma 之前）
// ─────────────────────────────────────────────────────────────

/** 八位纯数字，且不是全同、不是顺子（与 pin.ts 的弱口令口径一致）。 */
function validateAcceptancePin(pin) {
  if (typeof pin !== 'string' || !/^\d{8}$/.test(pin)) return 'pin_must_be_8_digits';
  if (/^(\d)\1{7}$/.test(pin)) return 'pin_too_weak';
  const d = [...pin].map(Number);
  const asc = d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10);
  const desc = d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10);
  if (asc || desc) return 'pin_too_weak';
  return null;
}

/**
 * 八道环境闸门。**抛出的错误里只出现变量的名字，绝不出现取值。**
 *
 * 返回 `void`；任何一条不满足直接抛 `S12fSafeError`。
 */
function assertEnvGates(env = ENV_AT_STARTUP) {
  for (const key of Object.keys(EXPECTED_RAILWAY)) {
    if (env[key] !== EXPECTED_RAILWAY[key]) {
      throw new S12fSafeError(
        `拒绝执行：${key} 与 staging 的固定取值不符。\n` +
          '这道闸门保证脚本只可能打到 exam-staging-manual / production / Postgres 上。',
      );
    }
  }

  let url = null;
  try {
    const raw = env.DATABASE_PUBLIC_URL;
    if (typeof raw !== 'string' || raw.length === 0) throw new Error('empty');
    const parsed = new URL(raw);
    if (!/^postgres(ql)?:$/.test(parsed.protocol)) throw new Error('scheme');
    if (!parsed.hostname) throw new Error('host');
    if (!parsed.port) throw new Error('port');
    if (!parsed.pathname || parsed.pathname === '/') throw new Error('database');
    url = parsed;
  } catch (e) {
    // 不看这个异常的任何字段 —— 它可能把连接串原样带出来。
    throw new S12fSafeError(
      '拒绝执行：DATABASE_PUBLIC_URL 不是一个合法的 PostgreSQL 连接 URL。',
    );
  }

  if (!env.RAILWAY_TCP_PROXY_DOMAIN || url.hostname !== env.RAILWAY_TCP_PROXY_DOMAIN) {
    throw new S12fSafeError(
      '拒绝执行：DATABASE_PUBLIC_URL 的主机名不等于 RAILWAY_TCP_PROXY_DOMAIN。\n' +
        '项目 id 只能证明「是不是那个项目」，证明不了「连过去的地址是不是那个项目的\n' +
        'Postgres 代理」—— 这一条才是连接目标的身份。',
    );
  }
  if (!env.RAILWAY_TCP_PROXY_PORT || String(url.port) !== String(env.RAILWAY_TCP_PROXY_PORT)) {
    throw new S12fSafeError(
      '拒绝执行：DATABASE_PUBLIC_URL 的端口不等于 RAILWAY_TCP_PROXY_PORT。',
    );
  }

  if (typeof env.S12F_EXPORT_DIR !== 'string' || env.S12F_EXPORT_DIR.length === 0) {
    throw new S12fSafeError(
      '拒绝执行：S12F_EXPORT_DIR 没给。\n' +
        '重建之前要把现有账号整个导出成证据，没地方放就不该开始。',
    );
  }

  if (env.S12F_CONFIRM !== CONFIRMATION) {
    throw new S12fSafeError(
      `拒绝执行：需要逐字确认 S12F_CONFIRM=${CONFIRMATION}\n` +
        '这个脚本会新建一个学生账号和两周的合成历史数据。',
    );
  }

  const pinErr = validateAcceptancePin(env.S12F_ACCEPTANCE_PIN);
  if (pinErr) {
    throw new S12fSafeError(
      `拒绝执行：S12F_ACCEPTANCE_PIN 不合格（${pinErr}）。\n` +
        '必须是八位数字，且不能全同或顺子。**本脚本没有默认 PIN，也没有回退。**\n' +
        '取值不会被回显。',
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 日期
// ─────────────────────────────────────────────────────────────

/** 新加坡日历日（UTC+8），形如 `YYYY-MM-DD`。 */
function singaporeDay(nowMs = Date.now()) {
  return new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10);
}

/** 往前推 n 天的新加坡日历日。 */
function dayMinus(todayIso, n) {
  const t = Date.parse(`${todayIso}T00:00:00.000Z`);
  return new Date(t - n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * 日期**标签**：SGT 日历日对应的 UTC 午夜。
 * `MorningQuizSession.date` / `DailyLessonCompletion.date` /
 * `VocabQuizAttempt.date` 存的都是这个（与 lesson-rules.lessonDayKey 一致）。
 */
function dayLabel(dayIso) {
  return new Date(`${dayIso}T00:00:00.000Z`);
}

/** 某个 SGT 日历日的 `HH:MM:SS` 对应的真实 UTC 时刻。 */
function sgtInstant(dayIso, hhmmss) {
  return new Date(Date.parse(`${dayIso}T${hhmmss}.000Z`) - 8 * 3600_000);
}

/**
 * 「N 天前的那个钟点」——历史事实的时间戳**只能**用它算。
 *
 * 不能用 `now - N*24h`：那算出来的是一个**相对此刻**的瞬刻，
 * 晚上跑脚本时它会落进**今天的 SGT 日历日**。
 *
 * 2026-08-30 22:18 SGT 实测：`now - 1 天 + 3 小时` = 昨天 17:18Z，
 * 而今天的 SGT 零点是昨天 16:00Z —— 14 条复习流水因此落进了今天，
 * 学生还没动手就会看到「今天复习 14 次」，那几个词还会被拉进
 * 今天的队列。钉在日历日的钟点上就永远不会。
 */
function dayBefore(todayIso, daysAgo, hhmmss) {
  return sgtInstant(dayMinus(todayIso, Math.max(1, Math.round(daysAgo))), hhmmss);
}

// ─────────────────────────────────────────────────────────────
// 拥有的 id
// ─────────────────────────────────────────────────────────────

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 本脚本可能新建 / 替换的**每一个** id 都由这里产出。 */
function ownedIdsOf(plan) {
  const ids = [ACCOUNT.id, ACCOUNT.classId, `${OWNED_PREFIX}cel`, `${OWNED_PREFIX}enroll`];
  for (const d of plan.readingDays) {
    ids.push(d.paperId, d.assignmentId, d.sessionId, d.submissionId);
    for (const q of d.questions) ids.push(q.questionId, q.paperQuestionId);
    for (const s of d.scripts) ids.push(s.id);
  }
  for (const l of plan.lessonDays) ids.push(l.dlcId);
  for (const a of plan.attempts) ids.push(a.id);
  for (const w of plan.words) ids.push(w.id);
  for (const r of plan.reviewLogs) ids.push(r.id);
  for (const m of plan.mistakes) ids.push(m.id);
  for (const a of plan.appeals) ids.push(a.id);
  const t = plan.today;
  ids.push(t.paperId, t.assignmentId, t.sessionId);
  for (const q of t.questions) ids.push(q.questionId, q.paperQuestionId);
  return ids;
}

/** 每一个 id 都必须带前缀。这是「绝不碰别人的行」在代码里的表达。 */
function assertOwnedPrefix(ids) {
  const bad = ids.filter((id) => typeof id !== 'string' || !id.startsWith(OWNED_PREFIX));
  if (bad.length > 0) {
    throw new S12fSafeError(
      `内部错误：${bad.length} 个待写入的 id 没有 ${OWNED_PREFIX} 前缀：${bad.slice(0, 5).join(', ')}`,
    );
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// 数据计划（纯函数 —— 测试可以在没有数据库的情况下把分布钉死）
// ─────────────────────────────────────────────────────────────

/** 候选词表：全部 4–12 个纯字母，够 `isSpellable`；实际用哪 50 个由词典决定。 */
const CANDIDATE_WORDS = [
  'abandon', 'ability', 'absorb', 'abstract', 'accurate', 'achieve', 'acquire', 'adapt',
  'adequate', 'adjust', 'admire', 'advance', 'advocate', 'afford', 'agenda', 'alter',
  'ancient', 'annual', 'anxiety', 'apparent', 'appeal', 'approach', 'arrange', 'aspect',
  'assemble', 'assess', 'assume', 'attach', 'attempt', 'attitude', 'balance', 'barrier',
  'benefit', 'brief', 'burden', 'capable', 'capture', 'career', 'caution', 'certain',
  'challenge', 'channel', 'charity', 'circuit', 'client', 'climate', 'combine', 'comment',
  'commit', 'compare', 'compete', 'complex', 'concept', 'concern', 'conduct', 'confirm',
  'consist', 'constant', 'consume', 'contact', 'contain', 'context', 'contrast', 'convince',
  'crucial', 'culture', 'curious', 'decline', 'dedicate', 'defeat', 'define', 'deliver',
];

/** 例句模板 —— 一定包含词形本身（cloze / spelling 靠它定位）。 */
const SENTENCE_TEMPLATES = [
  (w) => `The writer explains why students should ${w} their notes before every lesson.`,
  (w) => `A good reader will ${w} the main idea long before the final paragraph.`,
  (w) => `In the second paragraph the ${w} of the rooftop garden is described in detail.`,
  (w) => `Our teacher asked us to ${w} the diagram and then compare it with the text.`,
  (w) => `Very few of the volunteers could ${w} the plan without extra help.`,
  (w) => `The passage says that the ${w} became clear only after the second season.`,
  (w) => `She had to ${w} her answer twice before the timer ran out.`,
  (w) => `Every ${w} in the report was checked by two different students.`,
];

const HIST_TASK_TYPES = [
  'true_false_not_given',
  'matching_features',
  'sentence_completion',
  'summary_completion',
  'short_answer',
  'multiple_choice',
];

const HIST_QUESTION_TYPES = ['mcq', 'mcq', 'short_answer', 'short_answer', 'short_answer', 'mcq'];
const HIST_MARKS = [1, 1, 1, 2, 2, 1];
const HIST_PAPER_MAX = HIST_MARKS.reduce((a, b) => a + b, 0); // 8

/**
 * 每一天六道题的答题形态。**`partial` 只出现在 2 分的题上**
 * （1 分的题没有「半对」这回事）。
 * 前两行是最近两天 —— 那两份还在等老师判，所以只有选择题有分。
 */
const SCRIPT_KIND_PATTERNS = [
  ['correct', 'wrong', 'correct', 'partial', 'correct', 'wrong'], // idx0 待判
  ['wrong', 'correct', 'correct', 'correct', 'partial', 'correct'], // idx1 待判
  ['wrong', 'wrong', 'wrong', 'wrong', 'wrong', 'blank'], // 0 分
  ['correct', 'correct', 'correct', 'correct', 'correct', 'correct'], // 满分
  ['correct', 'wrong', 'correct', 'partial', 'wrong', 'correct'],
  ['correct', 'correct', 'wrong', 'correct', 'partial', 'wrong'],
  ['wrong', 'correct', 'correct', 'partial', 'partial', 'blank'],
  ['correct', 'correct', 'correct', 'correct', 'wrong', 'correct'],
  ['wrong', 'wrong', 'correct', 'partial', 'correct', 'correct'],
  ['correct', 'wrong', 'wrong', 'correct', 'correct', 'blank'],
  ['correct', 'correct', 'correct', 'partial', 'partial', 'wrong'],
  ['wrong', 'correct', 'wrong', 'correct', 'partial', 'correct'],
];

// S12J —— 十二篇历史阅读的**真文章**（原文 / 题干 / 答案 / 证据句）。
// 夹具专用模块，不参与任何运行时路径。
const { HISTORICAL_PAPERS } = require('./s12f-reading-content');

const TFNG_OPTIONS = [
  { key: 'A', text: 'TRUE' },
  { key: 'B', text: 'FALSE' },
  { key: 'C', text: 'NOT GIVEN' },
];
const FEATURE_OPTIONS = [
  { key: 'A', text: 'the rooftop team' },
  { key: 'B', text: 'the science club' },
  { key: 'C', text: 'the city council' },
  { key: 'D', text: 'the neighbouring school' },
];
/** 十二天的篇目名 —— 取自内容模块，永远与原文对得上。 */
const HIST_TITLES = HISTORICAL_PAPERS.map((p) => p.title);

/**
 * 十道题的今日卷 —— 首题必须带 IELTS taskType（渲染器推断的兜底）。
 *
 * S12J：每题带一句 `evidence` —— 它必须是 `TODAY_PASSAGE` 里**逐字**
 * 存在的一段话，否则错题重练的高亮定位不上。同时修正了两道
 * 与原文对不上的题（花园是地理老师提的，不是学生；市政厅「除了批准
 * 什么都没出」是 FALSE 而不是 NOT GIVEN），改的是题干 —— 改答案键会让
 * 头三题都变成 FALSE。第 10 题的参考答案也换成原文真给得出的两条理由。
 */
const TODAY_QUESTIONS = [
  { taskType: 'true_false_not_given', questionType: 'mcq', marks: 1, options: TFNG_OPTIONS,
    stem: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.\nThe idea of using the roof came from a teacher.', answer: 'A',
    evidence: 'A teacher of geography, looking for somewhere to measure wind speed, asked whether her class might use it for a single term.' },
  { taskType: 'true_false_not_given', questionType: 'mcq', marks: 1, options: TFNG_OPTIONS,
    stem: 'The garden produced enough vegetables for the whole school in its first year.', answer: 'B',
    evidence: 'In a good season it supplies the school kitchen for perhaps two weeks — never, as one report claimed, for the whole year.' },
  { taskType: 'true_false_not_given', questionType: 'mcq', marks: 1, options: TFNG_OPTIONS,
    stem: 'The school kitchen pays the garden for the vegetables it receives.', answer: 'C',
    evidence: '' },
  { taskType: 'sentence_completion', questionType: 'short_answer', marks: 1, options: null,
    stem: 'Complete the sentence with ONE WORD ONLY from the passage.\nThe first beds were built from wood taken from an old ______.', answer: 'stage',
    evidence: 'from timber salvaged from an old stage that the drama club no longer used' },
  { taskType: 'sentence_completion', questionType: 'short_answer', marks: 1, options: null,
    stem: 'The gardeners water the beds early in the ______ to lose less water.', answer: 'morning',
    evidence: 'The gardeners now water early in the morning, when less is lost' },
  { taskType: 'sentence_completion', questionType: 'short_answer', marks: 1, options: null,
    stem: 'Each class keeps a written ______ of what it plants.', answer: 'record',
    evidence: 'Every class keeps a record of what it plants, when it waters and what survives' },
  { taskType: 'matching_features', questionType: 'mcq', marks: 1, options: FEATURE_OPTIONS,
    stem: 'Match the statement with the correct group.\nThey measured the temperature on the roof for a whole term.', answer: 'B',
    evidence: 'The science club began measuring the temperature on the roof every hour for a whole term' },
  { taskType: 'matching_features', questionType: 'mcq', marks: 1, options: FEATURE_OPTIONS,
    stem: 'They lent the school a set of rainwater barrels.', answer: 'D',
    evidence: 'A neighbouring school, which had abandoned a similar plan, lent the students a set of rainwater barrels' },
  { taskType: 'short_answer', questionType: 'short_answer', marks: 2, options: null,
    stem: 'Answer in NO MORE THAN THREE WORDS.\nWhat did the students plant along the north wall to block the wind?', answer: 'a row of hedges',
    evidence: 'a row of hedges was planted along the north wall to break the wind' },
  { taskType: 'short_answer', questionType: 'short_answer', marks: 2, options: null,
    stem: 'Give TWO reasons the writer gives for keeping a written record.', answer: 'later classes consult them; a new group starts from earlier mistakes',
    evidence: 'those notebooks are now consulted by classes that have not yet set foot on the roof' },
];

const TODAY_TITLE = 'The Rooftop Garden, Two Years On';

const TODAY_PASSAGE = [
  'When the rooftop of the science block was finally opened to students, nobody expected it to become the busiest classroom in the school. The roof had been closed for years: a flat grey rectangle with a locked door and a view of the car park. A teacher of geography, looking for somewhere to measure wind speed, asked whether her class might use it for a single term. Two years later, the same roof holds forty raised beds, three water tanks and a small weather station that reports to a screen in the entrance hall.',
  '',
  'The first beds were built in a week, from timber salvaged from an old stage that the drama club no longer used. They were deliberately shallow, because the engineers who checked the roof set a strict limit on weight. Soil was carried up in buckets, one class at a time, and the first crop — radishes, because they grow quickly enough to hold a twelve-year-old’s attention — appeared before the end of the term. The second crop failed completely. The roof, it turned out, was several degrees warmer than the ground and far windier, and the seedlings simply dried out.',
  '',
  'That failure changed the project. The science club began measuring the temperature on the roof every hour for a whole term, and found that the difference was largest on clear afternoons in the middle of the year. The gardeners now water early in the morning, when less is lost, and a row of hedges was planted along the north wall to break the wind. A neighbouring school, which had abandoned a similar plan, lent the students a set of rainwater barrels; the city council, often thanked in newspaper articles, in fact contributed nothing but permission.',
  '',
  'What the roof produces is modest. In a good season it supplies the school kitchen for perhaps two weeks — never, as one report claimed, for the whole year. Its real output is written rather than edible. Every class keeps a record of what it plants, when it waters and what survives, and those notebooks are now consulted by classes that have not yet set foot on the roof. When a new group arrives in September they do not begin with an empty roof; they begin with four years of somebody else’s mistakes.',
  '',
  'Visitors are usually shown the weather station first, then the compost bins, and only at the end the single apple tree in the south corner. It was planted in the first winter and has never fruited. The students keep it because, as one of them put it, a garden that only contains things that work is not really a garden. In late March its blossom is the first colour anyone sees when the door opens, and that, the gardeners argue, is a harvest of a kind.',
].join('\n');

/**
 * 生成整份数据计划。**确定性**：同样的输入产生同样的 id、日期与分布。
 *
 * @param {{ todayIso: string, words: string[] }} input
 *   `words` 是**词典里确实有**的 50 个词（由调用方查库选出，保持顺序）。
 */
function buildPlan(input) {
  const todayIso = input.todayIso;
  const words = input.words;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(todayIso))) {
    throw new S12fSafeError('内部错误：todayIso 必须是 YYYY-MM-DD');
  }
  if (!Array.isArray(words) || words.length !== 50) {
    throw new S12fSafeError(
      `拒绝执行：需要正好 50 个词典里存在的单词，实际拿到 ${Array.isArray(words) ? words.length : 0} 个。`,
    );
  }

  // ── 阅读历史：12 天（跳过第 11、13 天，看起来才像真的有请假 / 停课）──
  const readingOffsets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14];

  const readingDays = readingOffsets.map((off, idx) => {
    const dayIso = dayMinus(todayIso, off);
    const n = pad2(idx + 1);
    // idx 0/1 = 昨天与前天：老师还没判到，**诚实地留在待判**。
    const marked = idx >= 2;
    // S12J —— 内容来自 `s12f-reading-content`，**题型与分值的形状不变**
    // （总分与逐题记账都建立在这个形状上）。
    const paper = HISTORICAL_PAPERS[idx];
    const questions = HIST_TASK_TYPES.map((tt, qi) => {
      const src = paper.questions[qi];
      const options =
        tt === 'true_false_not_given'
          ? TFNG_OPTIONS
          : tt === 'matching_features'
            ? paper.features.map((text, k) => ({ key: 'ABCD'[k], text }))
            : tt === 'multiple_choice'
              ? paper.choices.map((text, k) => ({ key: 'ABCD'[k], text }))
              : null;
      // 选择题的「写错」= 同一道题里另一个**真实的干扰项**，
      // 不是凭空造的字串；换篇目就换一个，不会十二天都错同一个。
      const wrongKey = options
        ? options.filter((o) => o.key !== src.answer)[(idx + qi) % (options.length - 1)].key
        : null;
      const textOf = (key) => (options.find((o) => o.key === key) || {}).text || '';
      return {
        questionId: `${OWNED_PREFIX}q_h${n}_${qi + 1}`,
        paperQuestionId: `${OWNED_PREFIX}pq_h${n}_${qi + 1}`,
        sortOrder: qi + 1,
        taskType: tt,
        questionType: HIST_QUESTION_TYPES[qi],
        marks: HIST_MARKS[qi],
        options,
        stem: src.stem,
        /** 选项键（选择题）；主观题为 null。 */
        optionKey: options ? src.answer : null,
        wrongOptionKey: wrongKey,
        /** 展示用的正确答案文本。 */
        answerText: options ? textOf(src.answer) : src.answer,
        partialText: options ? textOf(src.answer) : src.partial || src.answer,
        wrongText: options ? textOf(wrongKey) : src.wrong,
        /** 本篇原文里的**逐字子串**；空串 = 没存定位。 */
        evidence: src.evidence || '',
      };
    });

    // 答案形态先定，得分由形态**推**出来 —— 反过来（先定总分再往回摊）
    // 会算出「半对却拿了满分」这种自相矛盾的逐题记账。
    const pattern = SCRIPT_KIND_PATTERNS[idx];
    const scripts = questions.map((q, qi) => {
      const kind = pattern[qi];
      const earned =
        kind === 'correct' ? q.marks : kind === 'partial' ? Math.ceil(q.marks / 2) : 0;
      const isMcq = q.questionType === 'mcq';
      return {
        id: `${OWNED_PREFIX}as_h${n}_${qi + 1}`,
        paperQuestionId: q.paperQuestionId,
        sortOrder: q.sortOrder,
        taskType: q.taskType,
        questionType: q.questionType,
        marks: q.marks,
        kind,
        blank: kind === 'blank',
        // 还没判的卷子：选择题已经自动判了，主观题**诚实地空着**
        awarded: marked ? earned : isMcq ? earned : null,
      };
    });
    const target = marked ? scripts.reduce((a, s) => a + (s.awarded || 0), 0) : null;

    return {
      dayIso,
      offset: off,
      index: idx,
      title: paper.title,
      passage: paper.passage,
      paperId: `${OWNED_PREFIX}paper_h${n}`,
      assignmentId: `${OWNED_PREFIX}asg_h${n}`,
      sessionId: `${OWNED_PREFIX}sess_h${n}`,
      submissionId: `${OWNED_PREFIX}sub_h${n}`,
      marked,
      totalScore: target,
      maxScore: HIST_PAPER_MAX,
      questions,
      scripts,
    };
  });

  // ── 课程任务行：13 天（比阅读多一天 —— 有纯背词 / 纯补段的日子）──
  const lessonOffsets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14];
  const lessonDays = lessonOffsets.map((off, idx) => {
    const dayIso = dayMinus(todayIso, off);
    const hasReading = readingOffsets.includes(off);
    // 九天走完整、四天只走了一半 —— 真实的账号不会天天满勤
    const partial = [3, 8, 13, 14].includes(off);
    return {
      dlcId: `${OWNED_PREFIX}dlc_${pad2(idx + 1)}`,
      dayIso,
      offset: off,
      hasReading,
      partial,
      readTarget: hasReading ? 1 : 0,
      readProgress: hasReading ? 1 : 0,
      // S12J —— **连续天数只认 `student` / `teacher`**（见 lesson-rules 的
      // `countsAsStudentDone`）。以前这里写的是 `lesson`，于是主页的连续
      // 天数恒为 0 —— 一个「用了两周」的账号看起来一天都没学过。
      // 学生自己交卷走完的那一天，来源就是 `student`。
      readSource: hasReading ? 'student' : null,
      vocabTarget: 4,
      vocabProgress: partial ? 2 : 4,
      drillTarget: 3,
      drillProgress: partial ? 0 : 3,
      stage: partial ? 'vocab_learn' : 'done',
    };
  });

  // ── 正式单词测试：11 次（跳过两天，且今天一定没有）──
  const attemptOffsets = [1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 14];
  const attemptScores = [
    { total: 4, correct: 4 },
    { total: 4, correct: 3 },
    { total: 4, correct: 0 },
    { total: 4, correct: 2 },
    { total: 4, correct: 3 },
    { total: 4, correct: 1 },
    { total: 4, correct: 4 },
    { total: 4, correct: 2 },
    { total: 4, correct: 3 },
    { total: 4, correct: 2 },
    { total: 4, correct: 1 },
  ];
  const QTYPES = ['spelling', 'cloze', 'word_to_meaning', 'meaning_to_word'];
  const attempts = attemptOffsets.map((off, idx) => {
    const dayIso = dayMinus(todayIso, off);
    const s = attemptScores[idx];
    const lesson = lessonDays.find((l) => l.offset === off);
    const items = QTYPES.map((qtype, qi) => ({
      qtype,
      headword: words[(idx * 4 + qi) % words.length],
      isCorrect: qi < s.correct,
    }));
    return {
      id: `${OWNED_PREFIX}att_${pad2(idx + 1)}`,
      dayIso,
      offset: off,
      dlcId: lesson ? lesson.dlcId : null,
      total: s.total,
      correct: s.correct,
      score: Math.round((s.correct / s.total) * 1000) / 10,
      items,
    };
  });

  // ── 生词本：50 个 ──
  // schema 的 VocabState 只有 new / learning / review / known 四个取值。
  // FSRS 的「relearning」在这个模型里 = **state=learning 且 lapses ≥ 1**
  // （复习失败掉回学习态的那一批）。加枚举值属于 schema 改动，本合同禁止。
  const SOURCES = ['click', 'wrong_answer', 'teacher_push'];
  const wordPlan = words.map((headword, i) => {
    let state;
    if (i < 10) state = 'new';
    else if (i < 22) state = 'learning';
    else if (i < 42) state = 'review';
    else state = 'known';

    const relearning = i >= 17 && i < 22; // 5 个「掉回学习态」的
    const taught = state !== 'new';

    // 到期分布：21 个此刻到期，29 个排在将来
    // S12J —— **到期队列里必须真的有没教过的词**。
    //
    // 之前只有两个，而服务端按 due 升序发卡 —— 学生开头碰到的
    // 几乎全是复习卡，S12I 刚做好的教学卡一次都验不到。
    // 现在前六个新词欠得最久（dueHours 最负），因此排在队列最前。
    //
    // 到期 / 将来的总数仍是 21 / 29：新词多出的四个到期名额，
    // 从 learning 那一档里同数量地让出去。
    let dueHours;
    if (i < 6) dueHours = -30 - i; // new：**没教过且最早到期**（六个）
    else if (i < 10) dueHours = 24 * (2 + (i % 10)); // new：将来（四个）
    else if (i < 18) dueHours = -2 - (i % 12) * 2; // learning：八个到期
    else if (i < 22) dueHours = 24 * (3 + (i % 4)); // learning：四个将来
    else if (i < 27) dueHours = -1 - (i % 5); // review：5 个到期
    else if (i < 42) dueHours = 24 * (1 + (i % 15)); // review：将来
    else if (i < 44) dueHours = -6 - (i % 2); // known：2 个到期
    else dueHours = 24 * (20 + (i % 6) * 8); // known：很远

    const reps = state === 'new' ? 0 : state === 'learning' ? (relearning ? 4 : 2) : state === 'review' ? 5 : 8;
    const lapses = relearning ? 2 : state === 'review' && i % 5 === 0 ? 1 : 0;

    return {
      id: `${OWNED_PREFIX}w_${pad2(i + 1)}`,
      headword,
      surfaceForm: headword,
      contextSentence: SENTENCE_TEMPLATES[i % SENTENCE_TEMPLATES.length](headword),
      sourcePassageTitle: HIST_TITLES[i % HIST_TITLES.length],
      sourceType: SOURCES[i % SOURCES.length],
      state,
      relearning,
      taught,
      dueHours,
      reps,
      lapses,
      stability: state === 'new' ? 0 : 1 + (i % 17),
      difficulty: state === 'new' ? 0 : 3 + (i % 5),
      scheduledDays: state === 'new' ? 0 : 1 + (i % 12),
      elapsedDays: state === 'new' ? 0 : i % 9,
      // 教过的词：首教在 3–17 天前
      firstTaughtDaysAgo: taught ? 3 + (i % 15) : null,
    };
  });

  // ── 复习流水：跨 ≥10 天，评分与用时都不一样 ──
  const RATINGS = ['again', 'hard', 'good', 'easy'];
  const reviewLogs = [];
  let logSeq = 0;
  wordPlan.forEach((w, i) => {
    if (!w.taught) return;
    for (let k = 0; k < w.reps; k++) {
      const daysAgo = 1 + ((i + k * 3) % 14);
      logSeq += 1;
      reviewLogs.push({
        id: `${OWNED_PREFIX}rl_${String(logSeq).padStart(4, '0')}`,
        wordId: w.id,
        seq: logSeq,
        daysAgo,
        // 掉回学习态的那批一定有 again；其余轮换
        rating: w.relearning && k === 0 ? 'again' : RATINGS[(i + k) % RATINGS.length],
        elapsedMs: 1800 + ((i * 7 + k * 13) % 9000),
      });
    }
  });

  // ── 错题本：20 条 ──
  const mistakes = [];
  for (let i = 0; i < 20; i++) {
    // 挂到历史卷的某一道题上；每条错题一个不同的 (submission, paperQuestion)
    // (答卷, 卷题) 组合必须唯一（MistakeEntry 上有这个唯一键），而且要**扫过
    // 全部六道题** —— 只挑前两道的话 2 分的长答题一道都进不来，
    // `long_answer` 这个收录原因就永远出不现。
    const day = readingDays[i % readingDays.length];
    const qIdx = (Math.floor(i / readingDays.length) + (i % readingDays.length)) % 6;
    const q = day.questions[qIdx];
    // S12J —— 错题的题型必须就是**它挂的那道题的题型**。
    // 以前按 i 轮换，于是一条实际是填空题的错题会标成「选择题」——
    // 错题本里的标签与展开的题目当场矛盾。
    const taskType = q.taskType;
    // 三种收录原因：长答题 → long_answer；词义题 → vocabulary；其余 → 反复错
    const reason = q.marks >= 2 ? 'long_answer' : i % 5 === 1 ? 'vocabulary' : 'repeated_tasktype';
    const resolved = i % 5 === 4; // 4 条已销账
    const practiceCount = i % 4; // 0,1,2,3 轮换
    const correctStreak = practiceCount === 0 ? 0 : i % 2;
    mistakes.push({
      id: `${OWNED_PREFIX}mk_${pad2(i + 1)}`,
      submissionId: day.submissionId,
      paperQuestionId: q.paperQuestionId,
      quizDay: day.dayIso,
      taskType,
      passageTitle: day.title,
      reason,
      resolved,
      resolvedDaysAgo: resolved ? 1 + (i % 5) : null,
      practiceCount,
      practicedDaysAgo: practiceCount > 0 ? 1 + (i % 6) : null,
      correctStreak,
      awarded: q.marks >= 2 ? 1 : 0,
      maxMarks: q.marks,
      vocabWord: reason === 'vocabulary' ? wordPlan[(i * 3) % wordPlan.length].headword : '',
    });
  }

  // ── 申诉：两条，历史的，明确标注是 staging 合成数据 ──
  const appeals = [
    {
      id: `${OWNED_PREFIX}ap_1`,
      submissionId: readingDays[3].submissionId,
      paperQuestionId: readingDays[3].questions[4].paperQuestionId,
      daysAgo: readingDays[3].offset,
      status: 'rejected',
    },
    {
      id: `${OWNED_PREFIX}ap_2`,
      submissionId: readingDays[6].submissionId,
      paperQuestionId: null,
      daysAgo: readingDays[6].offset,
      status: 'accepted',
    },
  ];

  // ── 今天：一份干净的 IELTS 阅读，谁都没碰过 ──
  const today = {
    dayIso: todayIso,
    title: TODAY_TITLE,
    passage: TODAY_PASSAGE,
    paperId: `${OWNED_PREFIX}paper_today`,
    assignmentId: `${OWNED_PREFIX}asg_today`,
    sessionId: `${OWNED_PREFIX}sess_today`,
    reservedWord: RESERVED_LOOKUP_WORD,
    fillTargetSortOrder: FILL_TARGET_SORT_ORDER,
    questions: TODAY_QUESTIONS.map((q, i) => ({
      ...q,
      questionId: `${OWNED_PREFIX}q_t${pad2(i + 1)}`,
      paperQuestionId: `${OWNED_PREFIX}pq_t${pad2(i + 1)}`,
      sortOrder: i + 1,
    })),
    maxScore: TODAY_QUESTIONS.reduce((a, q) => a + q.marks, 0),
  };

  return { todayIso, readingDays, lessonDays, attempts, words: wordPlan, reviewLogs, mistakes, appeals, today };
}

// ─────────────────────────────────────────────────────────────
// 分布校验 —— 合同里那些「至少 N 个」全部在这里钉死
// ─────────────────────────────────────────────────────────────

function distributionsOf(plan) {
  const w = plan.words;
  const scripts = plan.readingDays.flatMap((d) => d.scripts);
  return {
    lessonDays: plan.lessonDays.length,
    readingSubmissions: plan.readingDays.length,
    markedSubmissions: plan.readingDays.filter((d) => d.marked).length,
    pendingSubmissions: plan.readingDays.filter((d) => !d.marked).length,
    distinctTitles: new Set(plan.readingDays.map((d) => d.title)).size,
    taskTypes: new Set(plan.readingDays.flatMap((d) => d.questions.map((q) => q.taskType))).size,
    zeroScore: plan.readingDays.filter((d) => d.marked && d.totalScore === 0).length,
    highScore: plan.readingDays.filter((d) => d.marked && d.totalScore >= HIST_PAPER_MAX - 1).length,
    midScore: plan.readingDays.filter((d) => d.marked && d.totalScore > 0 && d.totalScore < HIST_PAPER_MAX - 1).length,
    scriptsCorrect: scripts.filter((s) => s.kind === 'correct').length,
    scriptsPartial: scripts.filter((s) => s.kind === 'partial').length,
    scriptsWrong: scripts.filter((s) => s.kind === 'wrong').length,
    scriptsBlank: scripts.filter((s) => s.kind === 'blank').length,

    attempts: plan.attempts.length,
    attemptZero: plan.attempts.filter((a) => a.correct === 0).length,
    attemptFull: plan.attempts.filter((a) => a.correct === a.total).length,
    attemptMid: plan.attempts.filter((a) => a.correct > 0 && a.correct < a.total).length,
    attemptQTypes: new Set(plan.attempts.flatMap((a) => a.items.map((i) => i.qtype))).size,
    attemptsLinked: plan.attempts.filter((a) => a.dlcId != null).length,
    attemptToday: plan.attempts.filter((a) => a.dayIso === plan.todayIso).length,

    words: w.length,
    wordsNew: w.filter((x) => x.state === 'new').length,
    wordsLearning: w.filter((x) => x.state === 'learning').length,
    wordsReview: w.filter((x) => x.state === 'review').length,
    wordsRelearning: w.filter((x) => x.relearning).length,
    wordsKnown: w.filter((x) => x.state === 'known').length,
    wordsDue: w.filter((x) => x.dueHours < 0).length,
    wordsFuture: w.filter((x) => x.dueHours > 0).length,
    wordSources: new Set(w.map((x) => x.sourceType)).size,
    wordsTaughtAndDue: w.filter((x) => x.taught && x.dueHours < 0).length,
    wordsQuizCapable: w.filter(
      (x) => x.taught && x.dueHours < 0 && x.reps > 0 &&
        /^[A-Za-z]{4,12}$/.test(x.surfaceForm) &&
        new RegExp(`\\b${x.surfaceForm}\\b`, 'i').test(x.contextSentence),
    ).length,

    reviewLogs: plan.reviewLogs.length,
    reviewLogDays: new Set(plan.reviewLogs.map((r) => r.daysAgo)).size,
    reviewRatings: new Set(plan.reviewLogs.map((r) => r.rating)).size,

    mistakes: plan.mistakes.length,
    mistakesUnresolved: plan.mistakes.filter((m) => !m.resolved).length,
    mistakesResolved: plan.mistakes.filter((m) => m.resolved).length,
    mistakeTaskTypes: new Set(plan.mistakes.map((m) => m.taskType)).size,
    mistakeReasons: new Set(plan.mistakes.map((m) => m.reason)).size,
    mistakeNeverPractised: plan.mistakes.filter((m) => m.practiceCount === 0).length,
    mistakeMaxPractice: Math.max(...plan.mistakes.map((m) => m.practiceCount)),
    mistakeStreaks: new Set(plan.mistakes.map((m) => m.correctStreak)).size,
    mistakeNonBlankAnswers: plan.mistakes.length,

    appeals: plan.appeals.length,
    todayQuestions: plan.today.questions.length,
    todayTaskTypes: new Set(plan.today.questions.map((q) => q.taskType)).size,
  };
}

/** 合同里的每一条「至少」。不满足就抛 —— 绝不「差不多就算了」。 */
function assertDistributions(plan) {
  const d = distributionsOf(plan);
  const need = [
    ['历史课程天数 12–14', d.lessonDays >= 12 && d.lessonDays <= 14],
    ['阅读答卷 ≥10', d.readingSubmissions >= 10],
    ['判完的答卷 ≥8', d.markedSubmissions >= 8],
    ['诚实待判的答卷 ≥2', d.pendingSubmissions >= 2],
    ['篇目标题各不相同', d.distinctTitles === d.readingSubmissions],
    ['题型 / 任务类型 ≥3 种', d.taskTypes >= 3],
    ['至少一份 0 分', d.zeroScore >= 1],
    ['至少一份高分', d.highScore >= 1],
    ['至少一份中间分', d.midScore >= 1],
    ['逐题答案有对的', d.scriptsCorrect >= 1],
    ['逐题答案有半对的', d.scriptsPartial >= 1],
    ['逐题答案有错但非空的', d.scriptsWrong >= 1],
    ['逐题答案有少量空白', d.scriptsBlank >= 1],
    ['正式测试 ≥10 次', d.attempts >= 10],
    ['至少一次 0 分', d.attemptZero >= 1],
    ['至少一次满分', d.attemptFull >= 1],
    ['有中间分', d.attemptMid >= 1],
    ['四种题型都出现过', d.attemptQTypes === 4],
    ['每次测试都挂在当天的任务行上', d.attemptsLinked === d.attempts],
    ['今天没有正式测试', d.attemptToday === 0],
    ['生词 40–60（目标 50）', d.words >= 40 && d.words <= 60],
    ['未开始 ≥8', d.wordsNew >= 8],
    ['学习中 ≥8', d.wordsLearning >= 8],
    ['复习中 ≥10', d.wordsReview >= 10],
    ['重新学习 ≥4', d.wordsRelearning >= 4],
    ['已掌握 ≥6', d.wordsKnown >= 6],
    ['此刻到期 ≥15', d.wordsDue >= 15],
    ['排在将来 ≥10', d.wordsFuture >= 10],
    ['来源不止一种', d.wordSources >= 2],
    ['今天开得出正式测试（教过且到期 ≥4）', d.wordsTaughtAndDue >= 4],
    ['四种题型出得来（可拼写 + 可挖空 ≥4）', d.wordsQuizCapable >= 4],
    ['复习流水跨 ≥10 天', d.reviewLogDays >= 10],
    ['评分不止一种', d.reviewRatings >= 3],
    ['错题 15–25（目标 20）', d.mistakes >= 15 && d.mistakes <= 25],
    ['有未销账的错题', d.mistakesUnresolved >= 5],
    ['有已销账的错题', d.mistakesResolved >= 1],
    ['错题题型 ≥5 种', d.mistakeTaskTypes >= 5],
    ['三种收录原因都有', d.mistakeReasons === 3],
    ['有从未练过的错题', d.mistakeNeverPractised >= 1],
    ['练习次数达到 3', d.mistakeMaxPractice >= 3],
    ['连对次数 0 和 1 都有', d.mistakeStreaks >= 2],
    ['申诉 ≤2', d.appeals <= 2],
    ['今天的卷子 ≥8 题', d.todayQuestions >= 8],
    ['今天的卷子 ≥2 种任务类型', d.todayTaskTypes >= 2],
  ];
  const failed = need.filter(([, ok]) => !ok).map(([label]) => label);
  if (failed.length > 0) {
    throw new S12fSafeError(`数据计划不满足验收分布：\n  · ${failed.join('\n  · ')}`);
  }
  return d;
}

// ─────────────────────────────────────────────────────────────
// 当天必须是干净的 / 重跑保护
// ─────────────────────────────────────────────────────────────

const PRISTINE_KEYS = [
  'dlcToday',
  'submissionsToday',
  'scriptsToday',
  'attendanceToday',
  'attemptsToday',
  'reviewLogsToday',
  'mistakePracticeToday',
  'appealsToday',
];

/** 当天必须一行都没有。返回违规的类别名（空数组 = 干净）。 */
function currentDayViolations(counts) {
  return PRISTINE_KEYS.filter((k) => Number(counts[k] || 0) !== 0);
}

function assertCurrentDayPristine(counts, where) {
  const bad = currentDayViolations(counts);
  if (bad.length > 0) {
    throw new S12fSafeError(
      `${where}：当天不是干净的 —— ${bad.join(', ')} 有数据。\n` +
        '第一个创建当天状态的人必须是用户本人。',
    );
  }
  return true;
}

/**
 * 交接之后还能不能重跑。
 *
 * @param {{ accountExists: boolean, foreignOwnedRows: number, currentDay: object }} state
 */
function assertRerunSafe(state) {
  if (!state.accountExists) return true; // 全新创建，没什么可保护的
  if (Number(state.foreignOwnedRows || 0) !== 0) {
    // S12J —— 用户那次失败的验收真的造出了不带前缀的行。
    // 以前这里无条件拒绝（于是账号根本重建不了）；现在改成：
    // **先把它导出去、并且写完读回来哈希对得上**，才允许删。
    // 导不出来就继续拒绝 —— 失败关闭，不是「尽量导一下」。
    const ev = state.evidenceExport;
    if (!ev || ev.verified !== true || typeof ev.sha256 !== 'string' || ev.sha256.length !== 64) {
      throw new S12fSafeError(
        `拒绝执行：这个账号名下有 ${state.foreignOwnedRows} 行不带 ${OWNED_PREFIX} 前缀的业务数据，\n` +
          '而它们还没被导出成一份验过哈希的证据文件。重建会毁掉它。',
      );
    }
    if (Number(ev.accountRows) < Number(state.foreignOwnedRows)) {
      throw new S12fSafeError(
        `拒绝执行：导出里只有 ${ev.accountRows} 行账号数据，少于要删的 ${state.foreignOwnedRows} 行。`,
      );
    }
  }
  assertCurrentDayPristine(state.currentDay, '拒绝重跑');
  return true;
}

// ─────────────────────────────────────────────────────────────
// 只读前置检查（事务内，任何写之前）
// ─────────────────────────────────────────────────────────────

async function runPreflight(tx, plan, evidenceExport = null) {
  const reads = [];

  const notify = await tx.$queryRawUnsafe(
    `/* s12f:notification-guards */
     SELECT (SELECT count(*) FROM "NotificationConfig" WHERE enabled = true)::int AS enabled_configs,
            (SELECT count(*) FROM "NotificationLog")::int                          AS sent_logs`,
  );
  reads.push('notifications');
  const g = notify[0] || {};
  if (Number(g.enabled_configs) !== 0 || Number(g.sent_logs) !== 0) {
    throw new S12fSafeError(
      '拒绝执行：目标库里有启用的通知配置或已发通知记录。夹具库不该往外发任何东西。',
    );
  }

  const students = await tx.$queryRawUnsafe(
    `/* s12f:student-roster */
     SELECT id FROM "User" WHERE role = 'student' ORDER BY id`,
  );
  reads.push('roster');
  const ids = students.map((r) => r.id);
  const allowed = new Set([...FIXTURE_STUDENT_IDS, ACCOUNT.id]);
  const foreign = ids.filter((id) => !allowed.has(id));
  if (foreign.length > 0) {
    throw new S12fSafeError(
      `拒绝执行：库里有 ${foreign.length} 个既不是 t1–t8、也不是本验收账号的学生。\n` +
        '这几乎一定意味着连错了库。',
    );
  }
  const missing = FIXTURE_STUDENT_IDS.filter((id) => !ids.includes(id));
  if (missing.length > 0) {
    throw new S12fSafeError(`拒绝执行：八个场景夹具里缺了：${missing.join(', ')}`);
  }
  const accountExists = ids.includes(ACCOUNT.id);

  const reused = await tx.$queryRawUnsafe(
    `/* s12f:reused-resources */
     SELECT (SELECT count(*) FROM "User" WHERE id = '${REUSED.teacherId}' AND role = 'teacher')::int AS teacher,
            (SELECT count(*) FROM "Subject" WHERE id = '${REUSED.subjectId}')::int                   AS subject`,
  );
  reads.push('reused');
  if (Number(reused[0].teacher) !== 1 || Number(reused[0].subject) !== 1) {
    throw new S12fSafeError(
      `拒绝执行：缺少沿用的既有资源（教师 ${REUSED.teacherId} / 科目 ${REUSED.subjectId}）。`,
    );
  }

  // 当天必须干净 —— 无论是全新创建还是重跑
  const day = plan.todayIso;
  const cur = await tx.$queryRawUnsafe(
    `/* s12f:current-day */
     SELECT
       (SELECT count(*) FROM "DailyLessonCompletion" WHERE "studentId" = '${ACCOUNT.id}'
          AND date = '${day}T00:00:00.000Z')::int AS "dlcToday",
       (SELECT count(*) FROM "StudentSubmission" s JOIN "PaperAssignment" a ON a.id = s."assignmentId"
          JOIN "MorningQuizSession" m ON m."paperAssignmentId" = a.id
          WHERE s."studentId" = '${ACCOUNT.id}' AND m.date = '${day}')::int AS "submissionsToday",
       (SELECT count(*) FROM "AnswerScript" sc JOIN "StudentSubmission" s ON s.id = sc."submissionId"
          JOIN "PaperAssignment" a ON a.id = s."assignmentId"
          JOIN "MorningQuizSession" m ON m."paperAssignmentId" = a.id
          WHERE s."studentId" = '${ACCOUNT.id}' AND m.date = '${day}')::int AS "scriptsToday",
       (SELECT count(*) FROM "Attendance" WHERE "studentId" = '${ACCOUNT.id}')::int AS "attendanceToday",
       (SELECT count(*) FROM "VocabQuizAttempt" WHERE "studentId" = '${ACCOUNT.id}'
          AND date = '${day}')::int AS "attemptsToday",
       -- 夹具自己造的行不算「用户活动」（重建时它们本就会被删掉），
       -- 否则一旦夹具自己写错了时间，它就再也修不好自己。
       -- 夹具自己写错时间这件事由 verifyAfterWrite 那一道拦。
       (SELECT count(*) FROM "WordReviewLog" l JOIN "StudentWord" w ON w.id = l."studentWordId"
          WHERE w."studentId" = '${ACCOUNT.id}' AND l.id NOT LIKE '${OWNED_PREFIX}%'
          AND l."reviewedAt" >= '${day}T00:00:00.000Z'::timestamptz - interval '8 hours')::int AS "reviewLogsToday",
       (SELECT count(*) FROM "MistakeEntry" WHERE "studentId" = '${ACCOUNT.id}'
          AND id NOT LIKE '${OWNED_PREFIX}%'
          AND "lastPracticedAt" >= '${day}T00:00:00.000Z'::timestamptz - interval '8 hours')::int AS "mistakePracticeToday",
       (SELECT count(*) FROM "GradeAppeal" g JOIN "StudentSubmission" s ON s.id = g."submissionId"
          WHERE s."studentId" = '${ACCOUNT.id}' AND g."createdAt" >= '${day}T00:00:00.000Z'::timestamptz - interval '8 hours')::int AS "appealsToday"`,
  );
  reads.push('current-day');
  const currentDay = cur[0];

  // 账号名下有没有**不是本脚本造的**行
  const strayRows = await tx.$queryRawUnsafe(
    `/* s12f:stray-rows */
     SELECT
       (SELECT count(*) FROM "DailyLessonCompletion" WHERE "studentId" = '${ACCOUNT.id}' AND id NOT LIKE '${OWNED_PREFIX}%')::int
     + (SELECT count(*) FROM "StudentSubmission" WHERE "studentId" = '${ACCOUNT.id}' AND id NOT LIKE '${OWNED_PREFIX}%')::int
     + (SELECT count(*) FROM "VocabQuizAttempt" WHERE "studentId" = '${ACCOUNT.id}' AND id NOT LIKE '${OWNED_PREFIX}%')::int
     + (SELECT count(*) FROM "StudentWord" WHERE "studentId" = '${ACCOUNT.id}' AND id NOT LIKE '${OWNED_PREFIX}%')::int
     + (SELECT count(*) FROM "MistakeEntry" WHERE "studentId" = '${ACCOUNT.id}' AND id NOT LIKE '${OWNED_PREFIX}%')::int
     + (SELECT count(*) FROM "WordReviewLog" l JOIN "StudentWord" w ON w.id = l."studentWordId"
          WHERE w."studentId" = '${ACCOUNT.id}' AND l.id NOT LIKE '${OWNED_PREFIX}%')::int
     + (SELECT count(*) FROM "GradeAppeal" g JOIN "StudentSubmission" s ON s.id = g."submissionId"
          WHERE s."studentId" = '${ACCOUNT.id}' AND g.id NOT LIKE '${OWNED_PREFIX}%')::int
       AS "foreignOwnedRows"`,
  );
  reads.push('stray-rows');

  const foreignOwnedRows = Number(strayRows[0].foreignOwnedRows);
  assertRerunSafe({ accountExists, foreignOwnedRows, currentDay, evidenceExport });
  assertCurrentDayPristine(currentDay, '前置检查');

  return { accountExists, currentDay, foreignOwnedRows, reads };
}

/** 词典能不能撑起这 50 个词 + 那个留给查词的词。 */
async function selectWords(tx) {
  const list = CANDIDATE_WORDS.map((w) => `'${w}'`).join(',');
  const rows = await tx.$queryRawUnsafe(
    `/* s12f:dictionary */
     SELECT word FROM "DictEntry"
     WHERE word IN (${list}) AND translation <> ''`,
  );
  const have = new Set(rows.map((r) => r.word));
  const usable = CANDIDATE_WORDS.filter((w) => have.has(w));
  if (usable.length < 50) {
    throw new S12fSafeError(
      `拒绝执行：候选词表里只有 ${usable.length} 个词在词典里，撑不起 50 个生词。`,
    );
  }
  const reserved = await tx.$queryRawUnsafe(
    `/* s12f:reserved-word */
     SELECT word FROM "DictEntry" WHERE word = '${RESERVED_LOOKUP_WORD}'`,
  );
  if (reserved.length !== 1) {
    throw new S12fSafeError(
      `拒绝执行：留给查词的 ${RESERVED_LOOKUP_WORD} 不在词典里，用户点了会查不到。`,
    );
  }
  const chosen = usable.slice(0, 50);
  if (chosen.includes(RESERVED_LOOKUP_WORD)) {
    throw new S12fSafeError(
      `内部错误：${RESERVED_LOOKUP_WORD} 不能同时在生词本里 —— 那样就不是「新词」了。`,
    );
  }
  return chosen;
}

// ─────────────────────────────────────────────────────────────
// 证据导出（S12J AC-06）
// ─────────────────────────────────────────────────────────────

/**
 * 要导出的范围。
 *
 * 分两类：`account` 是**挂在验收账号名下的业务行**（不看前缀 ——
 * 用户那次失败验收造出来的行恰恰一个前缀都没带）；`shared` 是夹具
 * 自己建的共享资源（卷子 / 题目 / 场次……），按 `s12f_` 前缀认。
 *
 * 这张表与删除语句是**配对的**：凡是重建会删的表，都得先在这里
 * 导出去（spec 里钉住了这个不变式）。
 */
function exportScopes(accountId = ACCOUNT.id, prefix = OWNED_PREFIX) {
  const A = accountId;
  const sub = (t) => `SELECT id FROM "${t}" WHERE "studentId" = '${A}'`;
  return [
    { table: 'User', kind: 'account', where: `id = '${A}'` },
    { table: 'DailyLessonCompletion', kind: 'account', where: `"studentId" = '${A}'` },
    { table: 'StudentSubmission', kind: 'account', where: `"studentId" = '${A}'` },
    { table: 'AnswerScript', kind: 'account', where: `"submissionId" IN (${sub('StudentSubmission')})` },
    { table: 'GradeAppeal', kind: 'account', where: `"submissionId" IN (${sub('StudentSubmission')})` },
    { table: 'VocabQuizAttempt', kind: 'account', where: `"studentId" = '${A}'` },
    { table: 'StudentWord', kind: 'account', where: `"studentId" = '${A}'` },
    { table: 'WordReviewLog', kind: 'account', where: `"studentWordId" IN (${sub('StudentWord')})` },
    { table: 'MistakeEntry', kind: 'account', where: `"studentId" = '${A}'` },
    { table: 'Attendance', kind: 'account', where: `"studentId" = '${A}'` },
    { table: 'StudentPageView', kind: 'account', where: `"studentId" = '${A}'` },
    { table: 'MorningQuizSession', kind: 'shared', where: `id LIKE '${prefix}%'` },
    { table: 'PaperAssignment', kind: 'shared', where: `id LIKE '${prefix}%'` },
    { table: 'PaperQuestion', kind: 'shared', where: `id LIKE '${prefix}%'` },
    { table: 'Paper', kind: 'shared', where: `id LIKE '${prefix}%'` },
    { table: 'Question', kind: 'shared', where: `id LIKE '${prefix}%'` },
  ];
}

/**
 * 凭据形状的字段一律遮掉。
 *
 * 导出文件是给人看的证据，不是备份 —— 密码哈希 / PIN 哈希 /
 * 令牌 / 二维码密钥一个都不能落到盘上。
 */
const CREDENTIAL_KEY = /(password|pin|token|secret|salt)/i;

function redactRow(row) {
  const out = {};
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (CREDENTIAL_KEY.test(k)) out[k] = v == null ? null : '[redacted]';
    else if (typeof v === 'bigint') out[k] = v.toString();
    else out[k] = v;
  }
  return out;
}

/**
 * 把现有账号整个导出成一个 JSON 文件，**写完再读回来对哈希**。
 *
 * 回执里只有路径 / 哈希 / 行数 —— 内容不进回执，也不进命令行输出
 * （合同：不得打印学生答案内容）。
 */
async function exportAccountEvidence(tx, dir, stamp) {
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');

  if (typeof dir !== 'string' || dir.length === 0) {
    throw new S12fSafeError('拒绝执行：S12F_EXPORT_DIR 没给 —— 没地方放导出就不该开始删。');
  }
  fs.mkdirSync(dir, { recursive: true });

  const tables = {};
  const counts = {};
  let accountRows = 0;
  let sharedRows = 0;
  for (const scope of exportScopes()) {
    const rows = await tx.$queryRawUnsafe(
      `/* s12f:export */ SELECT * FROM "${scope.table}" WHERE ${scope.where} ORDER BY id`,
    );
    const clean = rows.map(redactRow);
    tables[scope.table] = clean;
    counts[scope.table] = clean.length;
    if (scope.kind === 'account') accountRows += clean.length;
    else sharedRows += clean.length;
  }

  const payload = {
    what: 'S12F acceptance account, exported before the S12J rebuild',
    accountId: ACCOUNT.id,
    exportedAt: stamp,
    railwayProject: EXPECTED_RAILWAY.RAILWAY_PROJECT_NAME,
    note: 'Credential-shaped fields are [redacted]. This file is evidence, not a backup.',
    counts,
    tables,
  };
  const json = JSON.stringify(payload, null, 1);
  const file = path.join(dir, `s12f-account-export-${stamp.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, json, 'utf8');

  // 读回来再算一遍 —— 写出去了不等于落盘了。
  const back = fs.readFileSync(file, 'utf8');
  const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
  const sha256 = sha(json);
  if (sha(back) !== sha256) {
    throw new S12fSafeError('拒绝执行：导出文件读回来哈希对不上。');
  }
  const parsed = JSON.parse(back);
  const backRows = Object.values(parsed.counts).reduce((a, b) => a + Number(b), 0);
  if (backRows !== accountRows + sharedRows) {
    throw new S12fSafeError('拒绝执行：导出文件读回来行数对不上。');
  }

  return {
    verified: true,
    path: file,
    sha256,
    bytes: Buffer.byteLength(json, 'utf8'),
    counts,
    accountRows,
    sharedRows,
    exportedAt: stamp,
  };
}

// ─────────────────────────────────────────────────────────────
// 写入
// ─────────────────────────────────────────────────────────────

/**
 * 重建要删的行。纯函数 —— spec 不连库就能把它管住。
 *
 * 两种范围：
 *
 *   · `includeStray = false`（默认）—— 只删带 `s12f_` 前缀的行。
 *     交给用户之前的重跑走这一支，它碰不到用户造的任何行。
 *   · `includeStray = true` —— 按**学生 id** 删干净，不看前缀。
 *     只有在证据已导出并验过哈希之后才开（见 `assertRerunSafe`）。
 *
 * 两种范围都**只认验收账号自己的 id 与 `s12f_` 前缀**：
 * t1–t8 的行不可能被匹到。
 */
function wipeStatements(opts = {}) {
  const includeStray = opts.includeStray === true;
  const P = `${OWNED_PREFIX}%`;
  const A = ACCOUNT.id;
  const subSub = `SELECT id FROM "StudentSubmission" WHERE "studentId" = '${A}'`;
  const subWord = `SELECT id FROM "StudentWord" WHERE "studentId" = '${A}'`;

  // 挂在学生名下的业务行（叶 → 根）。
  const owned = includeStray
    ? [
        `DELETE FROM "WordReviewLog" WHERE "studentWordId" IN (${subWord})`,
        `DELETE FROM "StudentWord" WHERE "studentId" = '${A}'`,
        `DELETE FROM "MistakeEntry" WHERE "studentId" = '${A}'`,
        `DELETE FROM "GradeAppeal" WHERE "submissionId" IN (${subSub})`,
        `DELETE FROM "VocabQuizAttempt" WHERE "studentId" = '${A}'`,
        `DELETE FROM "DailyLessonCompletion" WHERE "studentId" = '${A}'`,
        `DELETE FROM "StudentPageView" WHERE "studentId" = '${A}'`,
        `DELETE FROM "Attendance" WHERE "studentId" = '${A}'`,
        `DELETE FROM "AnswerScript" WHERE "submissionId" IN (${subSub})`,
        `DELETE FROM "StudentSubmission" WHERE "studentId" = '${A}'`,
      ]
    : [
        `DELETE FROM "WordReviewLog" WHERE id LIKE '${P}'`,
        `DELETE FROM "StudentWord" WHERE "studentId" = '${A}' AND id LIKE '${P}'`,
        `DELETE FROM "MistakeEntry" WHERE "studentId" = '${A}' AND id LIKE '${P}'`,
        `DELETE FROM "GradeAppeal" WHERE id LIKE '${P}'`,
        `DELETE FROM "VocabQuizAttempt" WHERE "studentId" = '${A}' AND id LIKE '${P}'`,
        `DELETE FROM "DailyLessonCompletion" WHERE "studentId" = '${A}' AND id LIKE '${P}'`,
        `DELETE FROM "AnswerScript" WHERE id LIKE '${P}'`,
        `DELETE FROM "StudentSubmission" WHERE "studentId" = '${A}' AND id LIKE '${P}'`,
      ];

  // 夹具自己建的共享资源 —— 永远按前缀。
  return owned.concat([
    `DELETE FROM "MorningQuizSession" WHERE id LIKE '${P}'`,
    `DELETE FROM "PaperAssignment" WHERE id LIKE '${P}'`,
    `DELETE FROM "PaperQuestion" WHERE id LIKE '${P}'`,
    `DELETE FROM "Paper" WHERE id LIKE '${P}'`,
    `DELETE FROM "Question" WHERE id LIKE '${P}'`,
  ]);
}

/** 只删验收账号自己的行；顺序照外键从叶到根。 */
async function wipeOwned(tx, opts = {}) {
  for (const s of wipeStatements(opts)) await tx.$executeRawUnsafe(`/* s12f:wipe */ ${s}`);
}

/**
 * 学生当时写下的答案文本。
 *
 * S12J 之前这里是一张**按题型**查的硬表：不管哪一天、哪一篇，
 * 只要是填空题，正确答案就是 `rainwater`。于是错题本里十几条的
 * 「正确答案」一模一样，而且跟它自己的题目根本对不上。
 * 现在每一道题都带着自己的三个文本，这里只负责挑。
 */
function answerTextForKind(q, kind) {
  if (kind === 'correct') return q.answerText;
  if (kind === 'partial') return q.partialText;
  if (kind === 'wrong') return q.wrongText;
  return '';
}

const MARKER_COMMENTS = {
  correct: '很好，抓住了原文里的限定词。',
  partial: '方向对，但少写了一个要点 —— 再看一遍第三段。',
  wrong: '这题问的是原因，不是结果；下次先圈住题干里的疑问词。',
  blank: '这题空着了。哪怕只写一个词也比空着强。',
};

async function writeAll(tx, plan, pinHash, placeholderPasswordHash) {
  const now = new Date();
  const A = ACCOUNT.id;

  // ── 班级 + 分级 + 学生 ──
  await tx.class.upsert({
    where: { id: ACCOUNT.classId },
    update: { name: ACCOUNT.className, archivedAt: null },
    create: { id: ACCOUNT.classId, name: ACCOUNT.className, classCode: ACCOUNT.classCode },
  });
  await tx.classEnglishLevel.upsert({
    where: { id: `${OWNED_PREFIX}cel` },
    update: { level: ACCOUNT.englishLevel },
    create: {
      id: `${OWNED_PREFIX}cel`,
      classId: ACCOUNT.classId,
      level: ACCOUNT.englishLevel,
      effectiveFrom: new Date(Date.parse(`${dayMinus(plan.todayIso, 30)}T00:00:00.000Z`)),
    },
  });
  await tx.user.upsert({
    where: { id: A },
    update: {
      name: ACCOUNT.name,
      email: ACCOUNT.email,
      role: 'student',
      isActive: true,
      archivedAt: null,
      englishLevel: ACCOUNT.englishLevel,
      pinHash,
      pinSetAt: now,
      pinFailedCount: 0,
      pinLockedUntil: null,
      pinClaimOpenUntil: null,
      studentAuthVersion: 0,
    },
    create: {
      id: A,
      name: ACCOUNT.name,
      email: ACCOUNT.email,
      role: 'student',
      isActive: true,
      englishLevel: ACCOUNT.englishLevel,
      // 普通登录只认 pinHash；passwordHash 是个用不上的随机值，
      // 不是 PIN、也没有任何地方会拿它去登录。
      passwordHash: placeholderPasswordHash,
      pinHash,
      pinSetAt: now,
      studentAuthVersion: 0,
    },
  });
  await tx.classEnrollment.upsert({
    where: { classId_userId: { classId: ACCOUNT.classId, userId: A } },
    update: { role: 'student' },
    create: { id: `${OWNED_PREFIX}enroll`, classId: ACCOUNT.classId, userId: A, role: 'student' },
  });

  // ── 历史卷子 / 场次 / 答卷 / 逐题答案 ──
  for (const d of plan.readingDays) {
    await tx.paper.create({
      data: {
        id: d.paperId,
        name: d.title,
        subjectId: REUSED.subjectId,
        ownerId: REUSED.teacherId,
        status: 'published',
        durationMin: 30,
        totalMarksTarget: d.maxScore,
        totalMarksActual: d.maxScore,
        generatedSeed: 1,
        rendererKey: 'ielts_reading',
        config: { mode: 'passage_pick', passageTitle: d.title, synthetic: 'S12F staging fixture' },
      },
    });
    for (const q of d.questions) {
      const content = {
        taskType: q.taskType,
        passageTitle: d.title,
        passage: d.passage,
        stem: q.stem,
      };
      // `evidence` 是错题重练的定位依据（`answerExtras` 读它）。
      // 空串就不写 —— 客户端对「没存定位」有诚实的兜底支。
      const answer = q.evidence ? { text: q.answerText, evidence: q.evidence } : { text: q.answerText };
      await tx.question.create({
        data: {
          id: q.questionId,
          subjectId: REUSED.subjectId,
          createdById: REUSED.teacherId,
          questionType: q.questionType,
          sourceType: 'original_school',
          content,
          answerContent: answer,
          options: q.options ? q.options.map((o) => ({ ...o, correct: o.key === q.optionKey })) : undefined,
          marks: q.marks,
          estimatedTimeMin: q.marks * 1.5,
          difficulty: 3,
          status: 'active',
        },
      });
      await tx.paperQuestion.create({
        data: {
          id: q.paperQuestionId,
          paperId: d.paperId,
          questionId: q.questionId,
          sortOrder: q.sortOrder,
          snapshotContent: content,
          snapshotAnswer: answer,
          snapshotOptions: q.options ?? undefined,
          marks: q.marks,
        },
      });
    }
    await tx.paperAssignment.create({
      data: {
        id: d.assignmentId,
        paperId: d.paperId,
        classId: ACCOUNT.classId,
        assignedById: REUSED.teacherId,
        assignedAt: sgtInstant(d.dayIso, '07:30:00'),
        startAt: sgtInstant(d.dayIso, '08:30:00'),
        dueAt: sgtInstant(d.dayIso, '23:59:00'),
        status: 'closed',
      },
    });
    await tx.morningQuizSession.create({
      data: {
        id: d.sessionId,
        date: dayLabel(d.dayIso),
        classId: ACCOUNT.classId,
        paperAssignmentId: d.assignmentId,
        scheduledById: REUSED.teacherId,
        status: 'locked',
        level: ACCOUNT.englishLevel,
        attendanceStart: sgtInstant(d.dayIso, '08:00:00'),
        attendanceEnd: sgtInstant(d.dayIso, '08:40:00'),
        lateCutoff: sgtInstant(d.dayIso, '08:59:59'),
        quizStart: sgtInstant(d.dayIso, '08:30:00'),
        quizEnd: sgtInstant(d.dayIso, '23:59:00'),
        qrSecret: 's12f-fixture-qr-secret-not-used',
      },
    });

    const autoMarks = d.scripts
      .filter((s) => s.questionType === 'mcq')
      .reduce((a, s) => a + (s.awarded || 0), 0);
    const manualMarks = d.scripts
      .filter((s) => s.questionType !== 'mcq')
      .reduce((a, s) => a + (s.awarded || 0), 0);
    await tx.studentSubmission.create({
      data: {
        id: d.submissionId,
        assignmentId: d.assignmentId,
        studentId: A,
        startedAt: sgtInstant(d.dayIso, '08:32:00'),
        submittedAt: sgtInstant(d.dayIso, '08:51:00'),
        finalSubmittedAt: sgtInstant(d.dayIso, '08:51:00'),
        submitSource: 'student',
        status: d.marked ? 'marked' : 'submitted',
        autoScore: d.marked ? autoMarks : autoMarks,
        manualScore: d.marked ? manualMarks : null,
        totalScore: d.marked ? d.totalScore : null,
        maxScore: d.maxScore,
      },
    });
    for (const s of d.scripts) {
      const q = d.questions.find((x) => x.paperQuestionId === s.paperQuestionId);
      const isMcq = s.questionType === 'mcq';
      const text = answerTextForKind(q, s.kind);
      await tx.answerScript.create({
        data: {
          id: s.id,
          submissionId: d.submissionId,
          paperQuestionId: s.paperQuestionId,
          selectedOption: isMcq && !s.blank ? (s.kind === 'correct' ? q.optionKey : q.wrongOptionKey) : null,
          textAnswer: text,
          awardedMarks: d.marked ? s.awarded : isMcq ? s.awarded ?? 0 : null,
          markerComment: d.marked && !isMcq ? MARKER_COMMENTS[s.kind] : null,
          markedById: d.marked && !isMcq ? REUSED.teacherId : null,
          markedAt: d.marked && !isMcq ? sgtInstant(d.dayIso, '16:20:00') : null,
          autoCorrect: isMcq ? s.kind === 'correct' : null,
        },
      });
    }
  }

  // ── 历史课程任务行 ──
  for (const l of plan.lessonDays) {
    await tx.dailyLessonCompletion.create({
      data: {
        id: l.dlcId,
        studentId: A,
        date: dayLabel(l.dayIso),
        readTarget: l.readTarget,
        readProgress: l.readProgress,
        readDoneAt: l.readTarget ? sgtInstant(l.dayIso, '08:51:00') : null,
        readSource: l.readSource,
        vocabTarget: l.vocabTarget,
        vocabProgress: l.vocabProgress,
        vocabDoneAt: l.partial ? null : sgtInstant(l.dayIso, '09:05:00'),
        drillTarget: l.drillTarget,
        drillProgress: l.drillProgress,
        drillDoneAt: l.partial ? null : sgtInstant(l.dayIso, '09:12:00'),
        targetsFrozenAt: sgtInstant(l.dayIso, '08:30:00'),
        stage: l.stage,
        stageAt: sgtInstant(l.dayIso, '09:12:00'),
        vocabCursor: l.vocabProgress,
        // 历史任务的考试范围 —— 取**教过的**那批，跟当天真的考过的词一致
        vocabWords: plan.words.slice(10, 14).map((w) => w.headword),
      },
    });
  }

  // ── 历史正式测试 ──
  for (const a of plan.attempts) {
    await tx.vocabQuizAttempt.create({
      data: {
        id: a.id,
        studentId: A,
        date: dayLabel(a.dayIso),
        dailyLessonCompletionId: a.dlcId,
        status: 'submitted',
        startedAt: sgtInstant(a.dayIso, '09:06:00'),
        submittedAt: sgtInstant(a.dayIso, '09:10:00'),
        total: a.total,
        correct: a.correct,
        score: a.score,
        items: a.items.map((it, i) => ({
          index: i,
          qtype: it.qtype,
          headword: it.headword,
          isCorrect: it.isCorrect,
        })),
      },
    });
  }

  // ── 生词本 ──
  for (const w of plan.words) {
    await tx.studentWord.create({
      data: {
        id: w.id,
        studentId: A,
        headword: w.headword,
        surfaceForm: w.surfaceForm,
        sourceType: w.sourceType,
        sourcePassageTitle: w.sourcePassageTitle,
        contextSentence: w.contextSentence,
        state: w.state,
        // `due` 是**调度**字段，相对此刻算才对（到期 / 未到期）。
        due: new Date(now.getTime() + w.dueHours * 3600_000),
        stability: w.stability,
        difficulty: w.difficulty,
        elapsedDays: w.elapsedDays,
        scheduledDays: w.scheduledDays,
        reps: w.reps,
        lapses: w.lapses,
        // 下面两个是**历史事实**，必须钉在某个过去的日历日的钟点上。
        // 用 `now - N 天` 会在傍晚跑脚本时落进**今天**（见 dayBefore 的注释）。
        lastReview: w.taught ? dayBefore(plan.todayIso, 1 + (w.reps % 5), '19:00:00') : null,
        firstTaughtAt:
          w.firstTaughtDaysAgo == null ? null : dayBefore(plan.todayIso, w.firstTaughtDaysAgo, '08:45:00'),
      },
    });
  }

  // ── 复习流水 ──
  for (const r of plan.reviewLogs) {
    await tx.wordReviewLog.create({
      data: {
        id: r.id,
        studentWordId: r.wordId,
        rating: r.rating,
        // 复习流水必须整条落在**过去的日历日**里 —— 一条落进今天，学生
        // 还没动手就会看到「今天复习 N 次」，而且那些词会被拉进今天的队列。
        reviewedAt: new Date(
          dayBefore(plan.todayIso, r.daysAgo, '19:00:00').getTime() + (r.seq % 3600) * 1000,
        ),
        elapsedMs: r.elapsedMs,
      },
    });
  }

  // ── 错题本 ──
  for (const m of plan.mistakes) {
    const day = plan.readingDays.find((d) => d.submissionId === m.submissionId);
    const q = day.questions.find((x) => x.paperQuestionId === m.paperQuestionId);
    await tx.mistakeEntry.create({
      data: {
        id: m.id,
        studentId: A,
        submissionId: m.submissionId,
        paperQuestionId: m.paperQuestionId,
        taskType: m.taskType,
        passageTitle: m.passageTitle,
        stem: q.stem,
        studentAnswer: q.wrongText,
        correctAnswer: q.answerText,
        markerComment: MARKER_COMMENTS[m.awarded > 0 ? 'partial' : 'wrong'],
        awarded: m.awarded,
        maxMarks: m.maxMarks,
        vocabWord: m.vocabWord,
        reason: m.reason,
        resolved: m.resolved,
        resolvedAt: m.resolvedDaysAgo ? dayBefore(plan.todayIso, m.resolvedDaysAgo, '17:40:00') : null,
        practiceCount: m.practiceCount,
        correctStreak: m.correctStreak,
        lastPracticedAt: m.practicedDaysAgo
          ? dayBefore(plan.todayIso, m.practicedDaysAgo, '17:20:00')
          : null,
        quizDay: m.quizDay,
        createdAt: sgtInstant(day.dayIso, '16:30:00'),
      },
    });
  }

  // ── 申诉（两条，历史的）──
  for (const ap of plan.appeals) {
    await tx.gradeAppeal.create({
      data: {
        id: ap.id,
        submissionId: ap.submissionId,
        paperQuestionId: ap.paperQuestionId,
        studentMessage: '【STAGING SYNTHETIC · S12F】老师，这题我写的和答案意思一样，能麻烦再看一下吗？',
        status: ap.status,
        reviewerId: REUSED.teacherId,
        reviewerNote:
          ap.status === 'accepted'
            ? '【STAGING SYNTHETIC · S12F】说得对，这个说法也成立，已补分。'
            : '【STAGING SYNTHETIC · S12F】原文说的是「大部分」，不是「全部」，维持原判。',
        reviewedAt: dayBefore(plan.todayIso, ap.daysAgo, '20:30:00'),
        createdAt: dayBefore(plan.todayIso, ap.daysAgo, '18:00:00'),
      },
    });
  }

  // ── 今天：一份没人碰过的 IELTS 阅读 ──
  const t = plan.today;
  await tx.paper.create({
    data: {
      id: t.paperId,
      name: t.title,
      subjectId: REUSED.subjectId,
      ownerId: REUSED.teacherId,
      status: 'published',
      durationMin: 30,
      totalMarksTarget: t.maxScore,
      totalMarksActual: t.maxScore,
      generatedSeed: 1,
      rendererKey: 'ielts_reading',
      config: { mode: 'passage_pick', passageTitle: t.title, synthetic: 'S12F staging fixture' },
    },
  });
  for (const q of t.questions) {
    const content = {
      taskType: q.taskType,
      passageTitle: t.title,
      passage: t.passage,
      stem: q.stem,
    };
    // 第 3 题是 NOT GIVEN —— 原文里本就**没有**那句话可引，所以它没有证据句。
    const answer = q.evidence ? { text: q.answer, evidence: q.evidence } : { text: q.answer };
    await tx.question.create({
      data: {
        id: q.questionId,
        subjectId: REUSED.subjectId,
        createdById: REUSED.teacherId,
        questionType: q.questionType,
        sourceType: 'original_school',
        content,
        answerContent: answer,
        options: q.options ? q.options.map((o) => ({ ...o, correct: o.key === q.answer })) : undefined,
        marks: q.marks,
        estimatedTimeMin: q.marks * 1.5,
        difficulty: 3,
        status: 'active',
      },
    });
    await tx.paperQuestion.create({
      data: {
        id: q.paperQuestionId,
        paperId: t.paperId,
        questionId: q.questionId,
        sortOrder: q.sortOrder,
        snapshotContent: content,
        snapshotAnswer: answer,
        snapshotOptions: q.options ?? undefined,
        marks: q.marks,
      },
    });
  }
  await tx.paperAssignment.create({
    data: {
      id: t.assignmentId,
      paperId: t.paperId,
      classId: ACCOUNT.classId,
      assignedById: REUSED.teacherId,
      assignedAt: sgtInstant(t.dayIso, '07:30:00'),
      startAt: sgtInstant(t.dayIso, '00:01:00'),
      dueAt: sgtInstant(t.dayIso, '23:59:00'),
      status: 'open',
    },
  });
  await tx.morningQuizSession.create({
    data: {
      id: t.sessionId,
      date: dayLabel(t.dayIso),
      classId: ACCOUNT.classId,
      paperAssignmentId: t.assignmentId,
      scheduledById: REUSED.teacherId,
      status: 'active',
      level: ACCOUNT.englishLevel,
      attendanceStart: sgtInstant(t.dayIso, '00:01:00'),
      attendanceEnd: sgtInstant(t.dayIso, '08:40:00'),
      lateCutoff: sgtInstant(t.dayIso, '08:59:59'),
      // 作答窗**开一整天** —— 不依赖 MORNING_QUIZ_ALL_DAY 这个环境变量，
      // 本合同不许改 Railway 配置，而用户什么时候做验收是他自己的事。
      quizStart: sgtInstant(t.dayIso, '00:01:00'),
      quizEnd: sgtInstant(t.dayIso, '23:59:00'),
      qrSecret: 's12f-fixture-qr-secret-not-used',
    },
  });
}

/** 写完之后在**同一个事务里**回读 —— 数不对就整体回滚。 */
async function verifyAfterWrite(tx, plan) {
  const A = ACCOUNT.id;
  const day = plan.todayIso;
  const rows = await tx.$queryRawUnsafe(
    `/* s12f:readback */
     SELECT
       (SELECT count(*) FROM "StudentSubmission" WHERE "studentId" = '${A}')::int AS submissions,
       (SELECT count(*) FROM "StudentSubmission" WHERE "studentId" = '${A}' AND status = 'marked')::int AS marked,
       (SELECT count(*) FROM "StudentSubmission" WHERE "studentId" = '${A}' AND status = 'submitted')::int AS pending,
       (SELECT count(*) FROM "AnswerScript" sc JOIN "StudentSubmission" s ON s.id = sc."submissionId"
          WHERE s."studentId" = '${A}')::int AS scripts,
       (SELECT count(*) FROM "DailyLessonCompletion" WHERE "studentId" = '${A}')::int AS dlc,
       (SELECT count(*) FROM "VocabQuizAttempt" WHERE "studentId" = '${A}')::int AS attempts,
       (SELECT count(*) FROM "StudentWord" WHERE "studentId" = '${A}')::int AS words,
       (SELECT count(*) FROM "StudentWord" WHERE "studentId" = '${A}' AND due <= now())::int AS words_due,
       (SELECT count(*) FROM "StudentWord" WHERE "studentId" = '${A}' AND "firstTaughtAt" IS NOT NULL AND due <= now())::int AS words_quizzable,
       (SELECT count(*) FROM "WordReviewLog" l JOIN "StudentWord" w ON w.id = l."studentWordId"
          WHERE w."studentId" = '${A}')::int AS review_logs,
       (SELECT count(*) FROM "MistakeEntry" WHERE "studentId" = '${A}')::int AS mistakes,
       (SELECT count(*) FROM "MistakeEntry" WHERE "studentId" = '${A}' AND resolved = false)::int AS mistakes_open,
       (SELECT count(*) FROM "GradeAppeal" g JOIN "StudentSubmission" s ON s.id = g."submissionId"
          WHERE s."studentId" = '${A}')::int AS appeals,
       (SELECT count(*) FROM "DailyLessonCompletion" WHERE "studentId" = '${A}' AND date = '${day}T00:00:00.000Z')::int AS dlc_today,
       (SELECT count(*) FROM "VocabQuizAttempt" WHERE "studentId" = '${A}' AND date = '${day}')::int AS attempts_today,
       (SELECT count(*) FROM "Attendance" WHERE "studentId" = '${A}')::int AS attendance,
       (SELECT count(*) FROM "WordReviewLog" l JOIN "StudentWord" w ON w.id = l."studentWordId"
          WHERE w."studentId" = '${A}'
          AND l."reviewedAt" >= '${day}T00:00:00.000Z'::timestamptz - interval '8 hours')::int AS logs_today,
       (SELECT count(*) FROM "MistakeEntry" WHERE "studentId" = '${A}'
          AND "lastPracticedAt" >= '${day}T00:00:00.000Z'::timestamptz - interval '8 hours')::int AS practice_today,
       (SELECT count(*) FROM "StudentWord" WHERE "studentId" = '${A}'
          AND "lastReview" >= '${day}T00:00:00.000Z'::timestamptz - interval '8 hours')::int AS lastreview_today,
       (SELECT count(*) FROM "MorningQuizSession" WHERE id = '${plan.today.sessionId}' AND status = 'active')::int AS today_session,
       (SELECT count(*) FROM "PaperQuestion" WHERE "paperId" = '${plan.today.paperId}')::int AS today_questions`,
  );
  const r = rows[0];
  const expect = distributionsOf(plan);
  const checks = [
    ['答卷数', Number(r.submissions) === expect.readingSubmissions],
    ['判完的答卷数', Number(r.marked) === expect.markedSubmissions],
    ['待判的答卷数', Number(r.pending) === expect.pendingSubmissions],
    ['逐题答案数', Number(r.scripts) === expect.readingSubmissions * 6],
    ['任务行数', Number(r.dlc) === expect.lessonDays],
    ['正式测试数', Number(r.attempts) === expect.attempts],
    ['生词数', Number(r.words) === expect.words],
    ['到期生词 ≥15', Number(r.words_due) >= 15],
    ['教过且到期的词 ≥4', Number(r.words_quizzable) >= 4],
    ['复习流水数', Number(r.review_logs) === expect.reviewLogs],
    ['错题数', Number(r.mistakes) === expect.mistakes],
    ['未销账错题 ≥5', Number(r.mistakes_open) >= 5],
    ['申诉数', Number(r.appeals) === expect.appeals],
    ['当天没有任务行', Number(r.dlc_today) === 0],
    ['当天没有正式测试', Number(r.attempts_today) === 0],
    // 下面三条盯的是**夹具自己**有没有把历史时间戳写进今天。
    // 2026-08-30 22:18 SGT 的实跑就是这里漏了：14 条复习流水落进了今天。
    ['当天没有复习流水', Number(r.logs_today) === 0],
    ['当天没有错题重练', Number(r.practice_today) === 0],
    ['没有一个词的 lastReview 落在今天', Number(r.lastreview_today) === 0],
    ['一条考勤都没有', Number(r.attendance) === 0],
    ['今天的场次是 active', Number(r.today_session) === 1],
    ['今天的卷子题数', Number(r.today_questions) === expect.todayQuestions],
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([l]) => l);
  if (failed.length > 0) {
    throw new S12fSafeError(`回读校验不通过（事务将回滚）：\n  · ${failed.join('\n  · ')}`);
  }
  return r;
}

// ─────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────

async function main() {
  assertEnvGates();

  // 闸门过了才允许加载 Prisma。
  process.env.DATABASE_URL = ENV_AT_STARTUP.DATABASE_PUBLIC_URL;
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');
  const prisma = new PrismaClient({ log: [] });

  // PIN 只在这里出现一次：交给 bcrypt，然后从局部作用域里消失。
  // **不打印、不写回执、不进日志。**
  const pinHash = await bcrypt.hash(ENV_AT_STARTUP.S12F_ACCEPTANCE_PIN, 10);
  const placeholderPasswordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

  let receipt;
  try {
    receipt = await prisma.$transaction(
      async (tx) => {
        // ① 只读前置 —— 任何写之前
        const words = await selectWords(tx);
        const todayIso = singaporeDay();
        const plan = buildPlan({ todayIso, words });
        assertDistributions(plan);
        assertOwnedPrefix(ownedIdsOf(plan));
        // ② 先把现有账号导出成证据（写盘 + 读回来对哈希）。
        //     导出失败 = 整个事务滞回，一行也不删。
        const evidenceExport = await exportAccountEvidence(
          tx,
          ENV_AT_STARTUP.S12F_EXPORT_DIR,
          new Date().toISOString(),
        );

        const pre = await runPreflight(tx, plan, evidenceExport);

        // ③ 写。账号名下有用户造的行时，按**学生 id** 删干净；
        //     否则维持只删 `s12f_` 前缀的保守路径。
        await wipeOwned(tx, { includeStray: pre.foreignOwnedRows > 0 });
        await writeAll(tx, plan, pinHash, placeholderPasswordHash);

        // ③ 回读
        const after = await verifyAfterWrite(tx, plan);
        return {
          accountExisted: pre.accountExists,
          counts: after,
          plan,
          evidenceExport,
          strayRowsRemoved: pre.foreignOwnedRows,
        };
      },
      { maxWait: 30_000, timeout: 300_000 },
    );
  } finally {
    await prisma.$disconnect();
  }

  const d = distributionsOf(receipt.plan);
  console.log(
    [
      '',
      'S12F 验收账号已就绪（PIN 不在这里，也不在任何日志里）。',
      `  账号 id        : ${ACCOUNT.id}`,
      `  登录姓名        : ${ACCOUNT.name}`,
      `  班级            : ${ACCOUNT.classId} / ${ACCOUNT.className}`,
      `  分级            : ${ACCOUNT.englishLevel}`,
      `  之前是否已存在  : ${receipt.accountExisted ? '是（已重建）' : '否（全新）'}`,
      `  删掉的无前缀行: ${receipt.strayRowsRemoved}（用户那次失败验收留下的）`,
      '',
      '  删之前的证据导出（内容不进这份输出）：',
      `    路径            : ${receipt.evidenceExport.path}`,
      `    SHA-256         : ${receipt.evidenceExport.sha256}`,
      `    字节            : ${receipt.evidenceExport.bytes}`,
      `    账号行 / 共享行 : ${receipt.evidenceExport.accountRows} / ${receipt.evidenceExport.sharedRows}`,
      `    导出时刻        : ${receipt.evidenceExport.exportedAt}`,
      '',
      `  阅读答卷        : ${d.readingSubmissions}（判完 ${d.markedSubmissions} · 待判 ${d.pendingSubmissions}）`,
      `  历史任务行      : ${d.lessonDays}`,
      `  正式单词测试    : ${d.attempts}`,
      `  生词            : ${d.words}（新 ${d.wordsNew} · 学习 ${d.wordsLearning} · 复习 ${d.wordsReview} · 重学 ${d.wordsRelearning} · 已掌握 ${d.wordsKnown}）`,
      `  到期 / 将来     : ${d.wordsDue} / ${d.wordsFuture}`,
      `  复习流水        : ${d.reviewLogs}（跨 ${d.reviewLogDays} 天）`,
      `  错题            : ${d.mistakes}（未销账 ${d.mistakesUnresolved} · 已销账 ${d.mistakesResolved}）`,
      `  合成申诉        : ${d.appeals}`,
      `  今天的卷子      : ${d.todayQuestions} 题 · ${d.todayTaskTypes} 种任务类型 · 留给查词的词 = ${RESERVED_LOOKUP_WORD}`,
      `  今天的状态      : 任务行 0 · 答卷 0 · 正式测试 0 · 考勤 0  ← 干净`,
      '',
    ].join('\n'),
  );
}

module.exports = {
  CONFIRMATION,
  OWNED_PREFIX,
  EXPECTED_RAILWAY,
  FIXTURE_STUDENT_IDS,
  REUSED,
  ACCOUNT,
  RESERVED_LOOKUP_WORD,
  FILL_TARGET_SORT_ORDER,
  CANDIDATE_WORDS,
  TODAY_QUESTIONS,
  TODAY_PASSAGE,
  TODAY_TITLE,
  S12fSafeError,
  reportFailure,
  validateAcceptancePin,
  assertEnvGates,
  singaporeDay,
  dayMinus,
  dayLabel,
  sgtInstant,
  dayBefore,
  ownedIdsOf,
  assertOwnedPrefix,
  exportScopes,
  redactRow,
  wipeStatements,
  buildPlan,
  distributionsOf,
  assertDistributions,
  currentDayViolations,
  assertCurrentDayPristine,
  assertRerunSafe,
  runPreflight,
  selectWords,
  wipeOwned,
  writeAll,
  verifyAfterWrite,
  main,
};

if (require.main === module) {
  main().catch((e) => {
    reportFailure(e);
    process.exit(1);
  });
}
