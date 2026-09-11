/**
 * S12M —— 把**试点第一周某一天**的课程发布到已批准的 staging / production。
 *
 * ## 一次只发一天，这是有原因的
 *
 * S12L 之后课程学词**只教不考**，而教学卡刻意不写 FSRS。于是周一教过的
 * 12 个词到了周二**仍然「到期」** —— 队列会叠加、被 `COURSE_QUEUE_MAX`
 * 截到 30，周一的词被重教，「今天 21 个词」从周二开始就不成立了。
 *
 * 所以这个脚本按天跑：发某一天时，把**那一天**的 12 个主词设成当天到期，
 * 同时把**学生从没复习过的**往日试点词推到试点结束之后。
 *
 *   · 学生真的练过的词一个都不动 —— 那是 FSRS 自己的排期，比我们更懂；
 *   · 只动**这个脚本自己造的**试点词（`p1_w_` 前缀），别的词碰都不碰。
 *
 * ## 写入范围
 *
 * 一切都带 `p1_` 前缀（见 `writeScopes()`），外加两类按学生 id 限定的行：
 *
 *   · `StudentWord`：只给**试点班在册学生**建，id 恒为 `p1_w_<学生>_<词>`；
 *   · `DictEntry`：**只补录这一周五档内容实际用到的词**，
 *     而且**只在词典里没有时才插**，已有的一个字都不改。
 *     这不是「把生产词典导进 staging」—— 那是被明令禁止的另一件事。
 *
 * **绝不删除、绝不重写**任何答卷、正式测试、复习流水、申诉、错题或历史。
 *
 * ## 闸门
 *
 * 与 S12F 同一套（项目 id / 项目名 / 环境 / 服务 / 连接串 / 代理主机 /
 * 代理端口 / 逐字确认串），外加一条：`--day` 必须是内容包里公布过的日期。
 *
 * ## 跑法
 *
 * ```bash
 * railway run -p <projectId> -s Postgres -e production -- \
 *   node apps/api/scripts/pilot/prepare-pilot-week.js --day=2026-08-31
 * ```
 *
 * ## 已发布内容冻结、检查在提交之前（2026-09-11 审计 PUB01 / PUB02）
 *
 *   · 重跑同一天：库里已有的卷子 / 题 / 场次逐字段与内容包比对。
 *       - 一模一样 → 一行都不写（幂等）；
 *       - 不一样、而那份卷子**已经有学生开卷 / 交卷** → 拒绝，列出改了哪些题、
 *         影响几份答卷。已被使用的版本只能走人工纠错流程（见
 *         docs/audit-2026-09-11/ledger-pub.md），脚本不改；
 *       - 不一样、还没有任何学生开卷 → 默认拒绝；确认要改就加
 *         `--revise-unstarted` 重跑，改了哪些题会逐条打印。
 *     已有场次 / 作业的状态（例如老师取消了某一场）一律不动。
 *   · 发布前的内容门禁（`publish-gates.js`）、查重、发布后的全部约束
 *     （五档卷子与题、每班每档场次、词典、每个学生今天的词）和「不该动的
 *     没动」都在**同一个事务里、提交之前**核对；任何一条不过就整笔回滚。
 *     「已发布」只在事务提交之后打印。
 *   · `--check`：只读核对某一天是否已经完整发布（事务设为 READ ONLY，不需要
 *     确认串）。发布断线、不确定有没有成功时先跑它。
 */

'use strict';

// ⚠️ 顺序有意义：先拍环境快照，再加载任何会碰 dotenv 的东西。
const ENV_KEYS = [
  'RAILWAY_PROJECT_ID',
  'RAILWAY_PROJECT_NAME',
  'RAILWAY_ENVIRONMENT_NAME',
  'RAILWAY_SERVICE_NAME',
  'DATABASE_PUBLIC_URL',
  'RAILWAY_TCP_PROXY_DOMAIN',
  'RAILWAY_TCP_PROXY_PORT',
  'P1_CONFIRM',
];
const ENV_AT_STARTUP = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k] || '']));

const content = require('./content');
const { findNearDuplicate, questionItem } = require('./content-similarity');
const gates = require('./publish-gates');

// ─────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────

const CONFIRMATION = 'S12M_PUBLISH_PILOT_WEEK';
const PRODUCTION_CONFIRMATION = 'S12M_PUBLISH_PILOT_WEEK_PRODUCTION';
/** 这个脚本写的每一行都带它。 */
const PREFIX = 'p1_';
/** 每天真正教学、真正进入正式单词考试的固定数量。 */
const DAILY_WORD_TARGET = 12;
/** 同一篇文章里最多准备多少个可替换词。 */
const RESERVE_WORD_TARGET = 12;

const RESERVE_STOP_WORDS = new Set((
  'about after again against almost along also among another around because before being below between both ' +
  'could every first from have into itself more most other over same should some such than that their them ' +
  'then there these they this those through under very were what when where which while will with would your ' +
  'paragraph section question answer teacher school students people years today'
).split(/\s+/));

const EXPECTED_RAILWAY = {
  RAILWAY_PROJECT_ID: 'ed8c31c0-6499-4611-830a-64043189f7d0',
  RAILWAY_PROJECT_NAME: 'exam-staging-manual',
  RAILWAY_ENVIRONMENT_NAME: 'production',
  RAILWAY_SERVICE_NAME: 'Postgres',
};

/**
 * 生产发布是另一把钥匙：项目 id、项目名和逐字确认串均与 staging 不同。
 * 这里不接受“任意 Railway 项目”，因此即使有人复制脚本到别处也无法执行。
 */
const EXPECTED_PRODUCTION_RAILWAY = {
  RAILWAY_PROJECT_ID: 'c634fa12-fa7f-460b-a113-3bf4b9566c99',
  RAILWAY_PROJECT_NAME: 'glorious-motivation',
  RAILWAY_ENVIRONMENT_NAME: 'production',
  RAILWAY_SERVICE_NAME: 'Postgres',
};

const ALLOWED_TARGETS = [
  { name: 'staging', railway: EXPECTED_RAILWAY, confirmation: CONFIRMATION },
  {
    name: 'production',
    railway: EXPECTED_PRODUCTION_RAILWAY,
    confirmation: PRODUCTION_CONFIRMATION,
  },
];

/** 独立发布身份；密码为运行时随机值，任何人都无法用它登录。 */
const PUBLISHER = {
  examBoardId: `${PREFIX}board`,
  subjectId: `${PREFIX}subject`,
  teacherId: `${PREFIX}publisher`,
};

const CLASS = {
  id: `${PREFIX}class`,
  name: '试点班 W1',
  classCode: 'PILOTW1',
};

/** 学生实际选择的班级。班级与英语难度彼此独立；每个班都发布完整五档。 */
const REGISTRATION_CLASSES = [
  'SGCE26W',
  'SEC27W',
  'OL26W',
  'IAL27W',
  'IAL27M',
  'IAL26W',
  'IAL26S2',
  'IAL26S1',
  'IAL28S',
].map((code) => ({
  id: `${PREFIX}class_${code.toLowerCase()}`,
  name: code,
  classCode: code,
}));

/** 旧的内部冒烟班保留给既有账号；注册页会隐藏它。 */
const ALL_CLASSES = [CLASS, ...REGISTRATION_CLASSES];

/** 内部冒烟账号。**不是真学生**，也不是任何人的共用凭据。 */
const QA_STUDENT = {
  id: `${PREFIX}qa_student`,
  name: '内部冒烟账号',
  email: 'p1.qa@example.invalid',
  level: 'olevel',
};

/**
 * 往日试点词被推到哪一天 —— **内容包最后一个教学日之后**。
 *
 * 原来写死成 `2026-09-14`。当时内容包只有第一周（到 09-04），这个日期在
 * 教学日之外，没问题。内容包按周累加之后，写死的日期迟早会落进某一周的
 * 教学日里 —— 那时「推到以后」会把词推到一个学生正在上课的日子，而且没有
 * 任何报错。改成从内容包实际的最后一天推算，加三天避开周末。
 */
const PARK_UNTIL = (() => {
  const last = content.DATES[content.DATES.length - 1];
  const d = new Date(`${last}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 3);
  return d.toISOString().slice(0, 10);
})();

/**
 * 给发布用的连接串加两个参数（2026-09-11）。
 *
 * 09-11 上午两次发布都是**连接在事务中途被掐断**（Postgres 日志：
 * `unexpected EOF on client connection with an open transaction`），服务端
 * 当场回滚，客户端却一直等那条永远不会回来的查询，干等满 15 分钟事务预算
 * 才报错。`socket_timeout` 让单条查询 60 秒没回音就报错 —— 断线一分钟内
 * 失败，而不是十五分钟；正常的查询都在一秒以内。`connect_timeout` 反过来
 * 放宽：同一天实测建连要 3–14 秒，Prisma 默认 5 秒就放弃，第三次发布连库
 * 都没连上。`application_name` 让这个连接在 `pg_stat_activity` 里一眼认得
 * 出来。已经写了的参数不覆盖。
 */
function publishConnectionUrl(raw) {
  const url = new URL(raw);
  if (!url.searchParams.has('socket_timeout')) url.searchParams.set('socket_timeout', '60');
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '30');
  if (!url.searchParams.has('application_name')) url.searchParams.set('application_name', 'p1-publish');
  return url.toString();
}

class PilotError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'PilotError';
  }
}

// ─────────────────────────────────────────────────────────────
// 纯函数（导出给 spec 直接驱动）
// ─────────────────────────────────────────────────────────────

/**
 * 这个脚本**允许写**的范围。spec 拿它钉杀伤半径。
 *
 * `byPrefix` = id 必须以 `p1_` 开头的表；
 * `byPilotStudent` = 按试点班学生限定的表（id 仍然带前缀）；
 * `allowlisted` = 只按明确枚举的主键写的表（词典）。
 */
function writeScopes() {
  return [
    { table: 'Class', kind: 'byPrefix' },
    { table: 'ExamBoard', kind: 'byPrefix' },
    { table: 'Subject', kind: 'byPrefix' },
    { table: 'ClassEnglishLevel', kind: 'byPrefix' },
    { table: 'ClassEnrollment', kind: 'byPrefix' },
    { table: 'User', kind: 'byPrefix' },
    { table: 'Paper', kind: 'byPrefix' },
    { table: 'Question', kind: 'byPrefix' },
    { table: 'PaperQuestion', kind: 'byPrefix' },
    { table: 'PaperAssignment', kind: 'byPrefix' },
    { table: 'MorningQuizSession', kind: 'byPrefix' },
    { table: 'StudentWord', kind: 'byPilotStudent' },
    { table: 'DictEntry', kind: 'allowlisted' },
  ];
}

/** 这个脚本**永远不碰**的表。少一条就是一个可能被毁掉的学生记录。 */
function neverTouched() {
  return [
    'StudentSubmission',
    'AnswerScript',
    'VocabQuizAttempt',
    'WordReviewLog',
    'MistakeEntry',
    'GradeAppeal',
    'Attendance',
    'StudentPageView',
    'DailyLessonCompletion',
    'AuditLog',
    'NotificationConfig',
    'NotificationLog',
  ];
}

/** `YYYY-MM-DD` → 那个新加坡日历日对应的 UTC 午夜（与 `lessonDayKey` 一致）。 */
function dayLabel(dayIso) {
  return new Date(`${dayIso}T00:00:00.000Z`);
}

/** 某个新加坡日历日的 `HH:MM:SS` 对应的真实 UTC 时刻。 */
function sgtInstant(dayIso, hhmmss) {
  return new Date(Date.parse(`${dayIso}T${hhmmss}+08:00`));
}

/** 一天一档的全部 id。**纯函数** —— 换一天换一档，id 完全确定。 */
function idsFor(level, dayIso) {
  const d = dayIso.replace(/-/g, '');
  const base = `${PREFIX}${level}_${d}`;
  return {
    paperId: `${base}_paper`,
    assignmentId: `${base}_asg`,
    sessionId: `${base}_sess`,
    questionId: (n) => `${base}_q${String(n).padStart(2, '0')}`,
    paperQuestionId: (n) => `${base}_pq${String(n).padStart(2, '0')}`,
  };
}

/** 同一份卷可发给多个班；旧冒烟班沿用历史 id，真实班使用稳定后缀。 */
function deliveryIdsFor(level, dayIso, klass) {
  const ids = idsFor(level, dayIso);
  if (klass.id === CLASS.id) return ids;
  const suffix = klass.id.slice(PREFIX.length).replace(/[^a-z0-9_]/gi, '_');
  return {
    ...ids,
    assignmentId: `${ids.assignmentId}_${suffix}`,
    sessionId: `${ids.sessionId}_${suffix}`,
  };
}

/** 一个学生的一个词的 id。 */
function studentWordId(studentId, headword) {
  return `${PREFIX}w_${studentId}_${headword}`;
}

/** 只有发布脚本自己创建的词，才允许改例句或排期。 */
function isManagedStudentWord(row) {
  return typeof row?.id === 'string' && row.id.startsWith(`${PREFIX}w_`);
}

/**
 * 一篇文章的「今日 12 词 + 同文备用词」。
 *
 * 内容包里多出来的人工词优先；不够时只从**当天这篇文章**挖词，绝不拿
 * 别篇文章凑数。自动挖出的词等学生真正换到时才实时翻译。
 */
function lessonWordPlan(lesson) {
  const primary = lesson.words.slice(0, DAILY_WORD_TARGET);
  const blocked = new Set(primary.map((w) => w.headword.toLowerCase()));
  const reserves = [];
  for (const w of lesson.words.slice(DAILY_WORD_TARGET)) {
    const key = w.headword.toLowerCase();
    if (!blocked.has(key)) {
      blocked.add(key);
      reserves.push(w);
    }
  }

  const sentences = String(lesson.passage || '')
    .replace(/\bParagraph\s+\d+\s*/gi, '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const candidates = [];
  const seen = new Set();
  for (const sentence of sentences) {
    for (const surfaceForm of sentence.match(/[A-Za-z][A-Za-z'’-]{4,}/g) || []) {
      const headword = surfaceForm.toLowerCase().replace(/[’]/g, "'");
      if (blocked.has(headword) || seen.has(headword) || RESERVE_STOP_WORDS.has(headword)) continue;
      seen.add(headword);
      candidates.push({
        headword,
        surfaceForm,
        context: sentence.slice(0, 500),
        contextTranslation: '',
      });
    }
  }
  candidates.sort((a, b) => b.headword.length - a.headword.length || a.headword.localeCompare(b.headword));
  for (const w of candidates) {
    if (reserves.length >= RESERVE_WORD_TARGET) break;
    blocked.add(w.headword);
    reserves.push(w);
  }
  return { primary, reserves: reserves.slice(0, RESERVE_WORD_TARGET) };
}

/** 每一个 id 都必须带前缀 —— 漏一个就是一行没有归属的数据。 */
function assertPrefixed(ids) {
  const bad = ids.filter((id) => typeof id !== 'string' || !id.startsWith(PREFIX));
  if (bad.length > 0) {
    throw new PilotError(`内部错误：${bad.length} 个 id 没有 ${PREFIX} 前缀：${bad.slice(0, 3)}`);
  }
  return true;
}

/**
 * 八道环境闸门。抛出的错误里**只出现变量名，绝不出现取值**。
 *
 * `requireConfirmation: false` 只给 `--check`（只读核对）用：它不写库，
 * 不需要逐字确认串，其余七道一道不少。
 */
function assertEnvGates(env = ENV_AT_STARTUP, { requireConfirmation = true } = {}) {
  const target = ALLOWED_TARGETS.find(({ railway }) =>
    Object.entries(railway).every(([key, value]) => env[key] === value),
  );
  if (!target) {
    throw new PilotError(
      '拒绝执行：Railway 项目 / 环境 / 服务不属于已批准的固定目标。\n' +
        '这道闸门只允许 exam-staging-manual 或 glorious-motivation 的 production / Postgres。',
    );
  }
  let url = null;
  try {
    const raw = env.DATABASE_PUBLIC_URL;
    if (typeof raw !== 'string' || raw.length === 0) throw new Error('empty');
    const parsed = new URL(raw);
    if (!/^postgres(ql)?:$/.test(parsed.protocol)) throw new Error('scheme');
    if (!parsed.hostname || !parsed.port || !parsed.pathname || parsed.pathname === '/') {
      throw new Error('shape');
    }
    url = parsed;
  } catch {
    throw new PilotError('拒绝执行：DATABASE_PUBLIC_URL 不是一个合法的 PostgreSQL 连接 URL。');
  }
  if (!env.RAILWAY_TCP_PROXY_DOMAIN || url.hostname !== env.RAILWAY_TCP_PROXY_DOMAIN) {
    throw new PilotError('拒绝执行：DATABASE_PUBLIC_URL 的主机名不等于 RAILWAY_TCP_PROXY_DOMAIN。');
  }
  if (!env.RAILWAY_TCP_PROXY_PORT || String(url.port) !== String(env.RAILWAY_TCP_PROXY_PORT)) {
    throw new PilotError('拒绝执行：DATABASE_PUBLIC_URL 的端口不等于 RAILWAY_TCP_PROXY_PORT。');
  }
  if (requireConfirmation && env.P1_CONFIRM !== target.confirmation) {
    throw new PilotError(
      `拒绝执行：${target.name} 需要它自己的逐字确认串。\n` +
        '这个脚本会给试点班发布一天的课程内容。',
    );
  }
}

/** `--day=YYYY-MM-DD`，且必须是内容包里公布过的那几天之一。 */
function parseDay(argv) {
  const arg = argv.find((a) => a.startsWith('--day='));
  const day = arg ? arg.slice('--day='.length) : '';
  if (!content.DATES.includes(day)) {
    throw new PilotError(
      `拒绝执行：--day 必须是 ${content.DATES.join(' / ')} 之一，收到「${day || '(空)'}」。`,
    );
  }
  return day;
}

// ─────────────────────────────────────────────────────────────
// 写入
// ─────────────────────────────────────────────────────────────

async function upsertPublisherClassesAndQa(tx, report) {
  const crypto = require('crypto');
  const bcrypt = require('bcryptjs');
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

  await tx.examBoard.upsert({
    where: { id: PUBLISHER.examBoardId },
    update: { code: 'P1ENG', name: 'Pilot English' },
    create: { id: PUBLISHER.examBoardId, code: 'P1ENG', name: 'Pilot English' },
  });
  report.bump('ExamBoard');
  await tx.subject.upsert({
    where: { id: PUBLISHER.subjectId },
    update: { name: 'English Reading', code: 'ENG', level: 'MULTI_LEVEL' },
    create: {
      id: PUBLISHER.subjectId,
      examBoardId: PUBLISHER.examBoardId,
      code: 'ENG',
      name: 'English Reading',
      level: 'MULTI_LEVEL',
    },
  });
  report.bump('Subject');
  await tx.user.upsert({
    where: { id: PUBLISHER.teacherId },
    update: {},
    create: {
      id: PUBLISHER.teacherId,
      name: '试点内容发布器',
      email: 'p1.publisher@example.invalid',
      role: 'teacher',
      isActive: false,
      passwordHash: unusablePassword,
    },
  });
  report.bump('User');

  for (const klass of ALL_CLASSES) {
    await tx.class.upsert({
      where: { id: klass.id },
      update: { name: klass.name },
      create: { id: klass.id, name: klass.name, classCode: klass.classCode },
    });
    report.bump('Class');

    for (const level of Object.keys(content.LEVELS)) {
      const classKey = klass.id === CLASS.id ? '' : `_${klass.id.slice(PREFIX.length)}`;
      await tx.classEnglishLevel.upsert({
        where: { id: `${PREFIX}lvl${classKey}_${level}` },
        update: {},
        create: {
          id: `${PREFIX}lvl${classKey}_${level}`,
          classId: klass.id,
          level,
          effectiveFrom: sgtInstant(content.DATES[0], '00:00:00'),
        },
      });
      report.bump('ClassEnglishLevel');
    }
  }

  // 内部冒烟账号。
  //
  // **没有 PIN** —— `pinHash` 留空，跑冒烟的人自己去注册页设一个，走的是
  // 与真学生完全一样的那条路（`register` 认领的正是「有名字、还没设 PIN」
  // 的账号）。脚本从头到尾不碰任何凭据。
  //
  // `passwordHash` 是 schema 的必填项（那是**教师端**的密码字段，学生端
  // 用不到）。塞一个随机字节的 bcrypt —— 没有人知道它的原文，因此这个
  // 账号在密码这条路上是**登不进去的**。
  await tx.user.upsert({
    where: { id: QA_STUDENT.id },
    update: {},
    create: {
      id: QA_STUDENT.id,
      name: QA_STUDENT.name,
      email: QA_STUDENT.email,
      role: 'student',
      englishLevel: QA_STUDENT.level,
      isActive: true,
      passwordHash: unusablePassword,
    },
  });
  report.bump('User');
  await tx.classEnrollment.upsert({
    where: { id: `${PREFIX}enr_qa` },
    update: {},
    create: { id: `${PREFIX}enr_qa`, classId: CLASS.id, userId: QA_STUDENT.id, role: 'student' },
  });
  report.bump('ClassEnrollment');
}

/**
 * 一条词典记录**是不是这个脚本自己写进去的**。
 *
 * 判据只有 `pilot_w1` 这个标签 —— 它只由下面那个 `create` 打上。别人的
 * 词条（包括 staging 原有的 59 条）永远不带它，所以永远落不进「可以改」
 * 的那一边。
 */
function isOursToFix(existing) {
  return Array.isArray(existing.tag) && existing.tag.includes('pilot_w1');
}

/**
 * 需要改写的字段，以及**为什么值得改**。
 *
 * 释义里出现过错别字（`抄怨` / `浹死`）。学生看到的就是这一行，一个只能
 * 插不能改的发布脚本没法把它纠回来 —— 所以这里允许改，但**只改自己那些
 * 带 `pilot_w1` 的行**。
 */
function dictDrift(existing, w) {
  const fields = ['phonetic', 'pos', 'translation', 'definition'];
  const patch = {};
  for (const f of fields) {
    if (existing[f] !== w[f]) patch[f] = w[f];
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * 只补录**这一天**用到的词。
 *
 * 原来遍历 `content.allWords()`（内容包所有日期）。第一周四百多条还跑得动；
 * 内容包按周累加到两周就是七百多条，加上每条一次 `findUnique` 往返，
 * 直接把 Prisma 事务的五分钟预算跑爆 —— 抛出来的是
 * 「Transaction not found. Transaction ID is invalid…」，看着像连接问题，
 * 其实是超时。发一天只需要那一天的词，现在是一百条上下。
 *
 * 存在性检查也从「一词一次往返」改成一次 `findMany` 批量取回。
 */
async function upsertDictionary(tx, report, dayIso) {
  const words = content.wordsForDay(dayIso);
  const known = new Map(
    (
      await tx.dictEntry.findMany({
        where: { word: { in: words.map((w) => w.headword) } },
      })
    ).map((row) => [row.word, row]),
  );
  // **别人的词条一个字都不改** —— 那可能是别的内容在用的释义，而这个脚本
  // 没有资格替它决定。自己写的那些则要能纠错，否则错别字就永久留在
  // 学生眼前。
  for (const w of words) {
    const existing = known.get(w.headword);
    if (existing) {
      const patch = isOursToFix(existing) ? dictDrift(existing, w) : null;
      if (patch) {
        await tx.dictEntry.update({ where: { word: w.headword }, data: patch });
        report.bump('DictEntry.corrected');
      } else {
        report.bump('DictEntry.kept');
      }
      continue;
    }
    await tx.dictEntry.create({
      data: {
        word: w.headword,
        phonetic: w.phonetic,
        pos: w.pos,
        translation: w.translation,
        definition: w.definition,
        tag: ['pilot_w1'],
      },
    });
    report.bump('DictEntry.created');
  }
}

// ─────────────────────────────────────────────────────────────
// 课程内容：先算出「应该是什么样」，再和库里「现在是什么样」比
// （PUB01，2026-09-11）
//
// 原来这里对每一行 upsert，重跑同一天就把题面、答案、评分标准原样再写
// 一遍 —— 内容包在发布之后改过的话，已经开卷、交卷、判过分的学生手里那份
// 冻结快照就被悄悄换掉了；老师取消的场次也会被 `status: 'active'` 改回来。
//
// 现在分三步：`lessonRows` 算出应有的行（纯函数），`loadExisting` 一次性
// 读出库里已有的行和使用情况，`planDay` 逐字段比对、分出「新建 / 未变 /
// 改了」，`assertPlanAllowed` 按「有没有学生用过」决定放不放行。写入只写
// 新建的行（批量），以及 `--revise-unstarted` 明确放行的修订。
// ─────────────────────────────────────────────────────────────

/** 写进 Json 列、再读回来的样子：值为 undefined 的键消失。比较前两边都过一遍。 */
function asStored(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** 与键顺序无关的 JSON 相等（jsonb 会重排键）。 */
function sameJson(a, b) {
  return stableStringify(asStored(a)) === stableStringify(asStored(b));
}

/**
 * 一档一天**应该**落库的全部行。纯函数 —— 同样的内容包永远得到同样的行。
 *
 * 字段口径与原来的 upsert 一字不差：客观题的正确项写在 options[].correct；
 * 主观题不写任何自动分依据，options 为空。
 */
function lessonRows(level, dayIso) {
  const lesson = content.lessonFor(level, dayIso);
  if (!lesson) throw new PilotError(`内部错误：${level} 没有 ${dayIso} 的课`);
  const ids = idsFor(level, dayIso);
  const maxScore = lesson.questions.reduce((a, q) => a + q.marks, 0);

  assertPrefixed([
    ids.paperId,
    ids.assignmentId,
    ids.sessionId,
    ...lesson.questions.map((_, i) => ids.questionId(i + 1)),
    ...lesson.questions.map((_, i) => ids.paperQuestionId(i + 1)),
  ]);

  const wordPlan = lessonWordPlan(lesson);
  const paper = {
    id: ids.paperId,
    name: lesson.title,
    totalMarks: maxScore,
    config: {
      mode: 'passage_pick',
      passageTitle: lesson.title,
      pilotWeek: 'W1',
      level,
      lessonWords: wordPlan.primary,
      lessonWordReserves: wordPlan.reserves,
    },
  };

  const questions = [];
  const paperQuestions = [];
  lesson.questions.forEach((q, i) => {
    const n = i + 1;
    const snapshotContent = {
      taskType: q.taskType,
      passageTitle: lesson.title,
      passage: lesson.passage,
      stem: q.stem,
    };
    // 客观题：正确项写在 options[].correct 上（`gradeMcq` 的第一顺位判据）。
    // 主观题：**不写任何自动分依据** —— 它必须诚实地进人工队列。
    const options = q.options ? q.options.map((o) => ({ ...o, correct: o.key === q.answer })) : null;
    const answerContent =
      q.questionType === 'mcq'
        ? { text: (q.options.find((o) => o.key === q.answer) || {}).text ?? q.answer, evidence: q.evidence || undefined, explanation: q.explanation }
        : {
            text: q.answer,
            ...(q.accept ? { accept: q.accept } : {}),
            rubric: q.rubric,
            evidence: q.evidence || undefined,
            explanation: q.explanation,
          };
    questions.push({
      id: ids.questionId(n),
      questionType: q.questionType,
      content: snapshotContent,
      answerContent,
      options,
      marks: q.marks,
    });
    paperQuestions.push({
      id: ids.paperQuestionId(n),
      paperId: ids.paperId,
      questionId: ids.questionId(n),
      sortOrder: n,
      snapshotContent,
      snapshotAnswer: answerContent,
      snapshotOptions: options,
      marks: q.marks,
    });
  });

  const deliveries = ALL_CLASSES.map((klass) => {
    const delivery = deliveryIdsFor(level, dayIso, klass);
    assertPrefixed([delivery.assignmentId, delivery.sessionId]);
    return { classId: klass.id, assignmentId: delivery.assignmentId, sessionId: delivery.sessionId };
  });

  return { level, dayIso, paper, questions, paperQuestions, deliveries };
}

/** 这一天五档应有的行。 */
function dayRows(dayIso) {
  return Object.keys(content.LEVELS).map((level) => lessonRows(level, dayIso));
}

/**
 * 一次性读出这一天在库里已有的行，以及每份卷子**被学生用过没有**。
 *
 * 「用过」= 这份卷子挂的任何一份作业下有答卷（开卷就建答卷行，所以做到
 * 一半也算），或者卷子里任何一题有作答行。与去重口径「学生读过」一致。
 */
async function loadExisting(tx, plans) {
  const paperIds = plans.map((p) => p.paper.id);
  const questionIds = plans.flatMap((p) => p.questions.map((q) => q.id));
  const pqIds = plans.flatMap((p) => p.paperQuestions.map((q) => q.id));
  const asgIds = plans.flatMap((p) => p.deliveries.map((d) => d.assignmentId));
  const sessIds = plans.flatMap((p) => p.deliveries.map((d) => d.sessionId));

  const [papers, questions, paperQuestions, assignments, sessions, submissions] = await Promise.all([
    tx.paper.findMany({
      where: { id: { in: paperIds } },
      select: { id: true, name: true, config: true, totalMarksTarget: true, totalMarksActual: true },
    }),
    tx.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, questionType: true, content: true, answerContent: true, options: true, marks: true },
    }),
    tx.paperQuestion.findMany({
      where: { OR: [{ id: { in: pqIds } }, { paperId: { in: paperIds } }] },
      select: {
        id: true,
        paperId: true,
        questionId: true,
        sortOrder: true,
        snapshotContent: true,
        snapshotAnswer: true,
        snapshotOptions: true,
        marks: true,
      },
    }),
    tx.paperAssignment.findMany({
      where: { id: { in: asgIds } },
      select: { id: true, paperId: true, classId: true, status: true },
    }),
    tx.morningQuizSession.findMany({
      where: { id: { in: sessIds } },
      select: { id: true, date: true, classId: true, level: true, status: true, paperAssignmentId: true },
    }),
    tx.studentSubmission.findMany({
      where: { assignment: { paperId: { in: paperIds } } },
      select: { status: true, assignment: { select: { paperId: true } } },
    }),
  ]);

  const allPqIds = [...new Set([...pqIds, ...paperQuestions.map((r) => r.id)])];
  const scriptGroups = allPqIds.length
    ? await tx.answerScript.groupBy({
        by: ['paperQuestionId'],
        where: { paperQuestionId: { in: allPqIds } },
        _count: { _all: true },
      })
    : [];

  return {
    papers: new Map(papers.map((r) => [r.id, r])),
    questions: new Map(questions.map((r) => [r.id, r])),
    paperQuestions: new Map(paperQuestions.map((r) => [r.id, r])),
    paperQuestionsByPaper: paperQuestions.reduce((m, r) => m.set(r.paperId, [...(m.get(r.paperId) ?? []), r]), new Map()),
    assignments: new Map(assignments.map((r) => [r.id, r])),
    sessions: new Map(sessions.map((r) => [r.id, r])),
    submissions,
    scriptsByPaperQuestion: new Map(scriptGroups.map((g) => [g.paperQuestionId, g._count._all])),
  };
}

const PAPER_FIELDS = ['name', 'config', 'totalMarksTarget', 'totalMarksActual'];
const QUESTION_FIELDS = ['questionType', 'content', 'answerContent', 'options', 'marks'];
const PAPER_QUESTION_FIELDS = ['paperId', 'questionId', 'sortOrder', 'snapshotContent', 'snapshotAnswer', 'snapshotOptions', 'marks'];

function changedFields(expected, row, fields) {
  return fields.filter((f) => !sameJson(expected[f], row[f]));
}

/**
 * 逐档、逐行比对，分出每一档是「新建 / 未变 / 改了」，以及每份卷子的使用情况。
 *
 * 纯函数（输入是 `lessonRows` 与 `loadExisting` 的结果），spec 直接驱动。
 */
function planDay(plans, existing) {
  const levels = plans.map((p) => {
    const paperRow = existing.papers.get(p.paper.id) ?? null;
    const expectedPaper = { ...p.paper, totalMarksTarget: p.paper.totalMarks, totalMarksActual: p.paper.totalMarks };
    const changes = [];
    const create = { paper: null, questions: [], paperQuestions: [] };
    const update = { paper: null, questions: [], paperQuestions: [] };

    if (!paperRow) create.paper = p.paper;
    else {
      const fields = changedFields(expectedPaper, paperRow, PAPER_FIELDS);
      if (fields.length) {
        changes.push({ table: 'Paper', id: p.paper.id, fields });
        update.paper = p.paper;
      }
    }
    for (const q of p.questions) {
      const row = existing.questions.get(q.id);
      if (!row) {
        create.questions.push(q);
        if (paperRow) changes.push({ table: 'Question', id: q.id, fields: ['(缺行)'] });
        continue;
      }
      const fields = changedFields(q, row, QUESTION_FIELDS);
      if (fields.length) {
        changes.push({ table: 'Question', id: q.id, fields });
        update.questions.push(q);
      }
    }
    for (const pq of p.paperQuestions) {
      const row = existing.paperQuestions.get(pq.id);
      if (!row) {
        create.paperQuestions.push(pq);
        if (paperRow) changes.push({ table: 'PaperQuestion', id: pq.id, fields: ['(缺行)'] });
        continue;
      }
      const fields = changedFields(pq, row, PAPER_QUESTION_FIELDS);
      if (fields.length) {
        changes.push({ table: 'PaperQuestion', id: pq.id, fields });
        update.paperQuestions.push(pq);
      }
    }
    const expectedPqIds = new Set(p.paperQuestions.map((pq) => pq.id));
    const extra = (existing.paperQuestionsByPaper.get(p.paper.id) ?? [])
      .map((r) => r.id)
      .filter((id) => !expectedPqIds.has(id));

    const byStatus = {};
    for (const s of existing.submissions) {
      if (s.assignment?.paperId !== p.paper.id) continue;
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    }
    const pqIdsOfPaper = new Set([...expectedPqIds, ...extra]);
    let scripts = 0;
    for (const [pqId, n] of existing.scriptsByPaperQuestion) if (pqIdsOfPaper.has(pqId)) scripts += n;
    const submissions = Object.values(byStatus).reduce((a, b) => a + b, 0);

    const nothingExisted = !paperRow && create.questions.length === p.questions.length && create.paperQuestions.length === p.paperQuestions.length;
    // 卷子没了、题却还在：不是新的一天，也不是未变 —— 按「改了」处理
    if (!paperRow && !nothingExisted) changes.unshift({ table: 'Paper', id: p.paper.id, fields: ['(缺行)'] });
    const state = nothingExisted ? 'new' : changes.length === 0 && extra.length === 0 ? 'unchanged' : 'changed';
    return {
      level: p.level,
      paperId: p.paper.id,
      state,
      changes,
      extra,
      create,
      update,
      usage: { submissions, byStatus, scripts, used: submissions > 0 || scripts > 0 },
    };
  });

  const deliveries = { createAssignments: [], createSessions: [], keptAssignments: 0, keptSessions: 0, mismatched: [], notActive: [] };
  const dayDate = plans[0] ? dayLabel(plans[0].dayIso).getTime() : null;
  for (const p of plans) {
    for (const d of p.deliveries) {
      const asg = existing.assignments.get(d.assignmentId);
      if (!asg) deliveries.createAssignments.push({ ...d, paperId: p.paper.id, level: p.level, dayIso: p.dayIso });
      else {
        deliveries.keptAssignments += 1;
        if (asg.paperId !== p.paper.id || asg.classId !== d.classId) deliveries.mismatched.push(`作业 ${d.assignmentId} 挂在别的卷子 / 班上`);
      }
      const sess = existing.sessions.get(d.sessionId);
      if (!sess) deliveries.createSessions.push({ ...d, paperId: p.paper.id, level: p.level, dayIso: p.dayIso });
      else {
        deliveries.keptSessions += 1;
        const sameDay = new Date(sess.date).getTime() === dayDate;
        if (!sameDay || sess.classId !== d.classId || sess.level !== p.level || sess.paperAssignmentId !== d.assignmentId) {
          deliveries.mismatched.push(`场次 ${d.sessionId} 的日期 / 班 / 档 / 作业对不上`);
        }
        if (sess.status !== 'active') deliveries.notActive.push({ id: d.sessionId, status: sess.status });
      }
    }
  }
  return { levels, deliveries };
}

/**
 * 放不放行。任何一条不过都**在写第一行之前**抛出。
 *
 *   · 已被学生使用（开卷 / 交卷 / 有作答）的卷子，内容一个字都不许改 ——
 *     `--revise-unstarted` 也不行；
 *   · 没人用过的卷子，改了也要明确说 `--revise-unstarted`；
 *   · 卷子里多出内容包没有的题、作业 / 场次挂错了地方：脚本不删不挪，停下来。
 */
function assertPlanAllowed(plan, { revise = false } = {}) {
  const errors = [];
  const describe = (l) =>
    l.changes
      .slice(0, 12)
      .map((c) => `${c.id}（${c.fields.join('、')}）`)
      .join('；') + (l.changes.length > 12 ? ` …共 ${l.changes.length} 处` : '');
  for (const l of plan.levels) {
    if (l.extra.length) errors.push(`${l.paperId} 里有内容包没有的题：${l.extra.join('、')}。发布脚本不删题，需人工处理。`);
    if (l.state !== 'changed' || l.changes.length === 0) continue;
    if (l.usage.used) {
      const status = Object.entries(l.usage.byStatus).map(([k, v]) => `${k} ${v}`).join('、') || '无';
      errors.push(
        `${l.paperId} 已被学生使用（答卷 ${l.usage.submissions} 份：${status}；作答 ${l.usage.scripts} 条），` +
          `内容却与库里的冻结版本不同：${describe(l)}。已被使用的版本不能由发布脚本改写 —— ` +
          '需要纠错请走修订流程（先 dry-run 列出受影响答卷，经授权后单独执行并留审计），见 docs/audit-2026-09-11/ledger-pub.md。',
      );
    } else if (!revise) {
      errors.push(
        `${l.paperId} 的内容与已发布版本不同（尚无学生开始）：${describe(l)}。` +
          '确认要改，加 --revise-unstarted 重跑；否则先把内容包改回去。',
      );
    }
  }
  for (const m of plan.deliveries.mismatched) errors.push(m);
  if (errors.length) throw new PilotError(`拒绝执行：已发布的内容受保护 ——\n  · ${errors.join('\n  · ')}`);
}

/**
 * 按计划写：新建的行一次批量建，`--revise-unstarted` 放行的修订逐行改。
 * 未变的一行不写；已有作业 / 场次的状态一律不动。
 *
 * 原来每一档每一行一次 upsert（一天约 205 次往返）；新的一天现在是
 * 五条 createMany，重跑一天是零写入。
 */
async function writeDay(tx, plan, report, progress = () => {}) {
  const dbNull = () => require('@prisma/client').Prisma.DbNull;
  const levels = plan.levels;

  const papers = levels.flatMap((l) => (l.create.paper ? [l.create.paper] : []));
  if (papers.length) {
    await tx.paper.createMany({
      data: papers.map((p) => ({
        id: p.id,
        name: p.name,
        subjectId: PUBLISHER.subjectId,
        ownerId: PUBLISHER.teacherId,
        status: 'published',
        durationMin: 30,
        totalMarksTarget: p.totalMarks,
        totalMarksActual: p.totalMarks,
        generatedSeed: 1,
        rendererKey: 'ielts_reading',
        config: p.config,
      })),
    });
  }
  report.bump('Paper.created', papers.length);

  const questions = levels.flatMap((l) => l.create.questions);
  if (questions.length) {
    await tx.question.createMany({
      data: questions.map((q) => ({
        id: q.id,
        subjectId: PUBLISHER.subjectId,
        createdById: PUBLISHER.teacherId,
        questionType: q.questionType,
        sourceType: 'original_school',
        content: q.content,
        answerContent: q.answerContent,
        options: q.options ?? undefined,
        marks: q.marks,
        estimatedTimeMin: q.marks * 1.5,
        difficulty: 3,
        status: 'active',
      })),
    });
  }
  report.bump('Question.created', questions.length);

  const paperQuestions = levels.flatMap((l) => l.create.paperQuestions);
  if (paperQuestions.length) {
    await tx.paperQuestion.createMany({
      data: paperQuestions.map((pq) => ({
        id: pq.id,
        paperId: pq.paperId,
        questionId: pq.questionId,
        sortOrder: pq.sortOrder,
        snapshotContent: pq.snapshotContent,
        snapshotAnswer: pq.snapshotAnswer,
        snapshotOptions: pq.snapshotOptions ?? undefined,
        marks: pq.marks,
      })),
    });
  }
  report.bump('PaperQuestion.created', paperQuestions.length);

  // 修订：只有 assertPlanAllowed 放行（没人用过 + --revise-unstarted）才会走到这里
  for (const l of levels) {
    if (l.state !== 'changed') continue;
    if (l.update.paper) {
      const p = l.update.paper;
      await tx.paper.update({
        where: { id: p.id },
        data: { name: p.name, config: p.config, totalMarksTarget: p.totalMarks, totalMarksActual: p.totalMarks },
      });
      report.bump('Paper.revised');
    }
    for (const q of l.update.questions) {
      await tx.question.update({
        where: { id: q.id },
        data: {
          questionType: q.questionType,
          content: q.content,
          answerContent: q.answerContent,
          options: q.options ?? dbNull(),
          marks: q.marks,
          estimatedTimeMin: q.marks * 1.5,
        },
      });
      report.bump('Question.revised');
    }
    for (const pq of l.update.paperQuestions) {
      await tx.paperQuestion.update({
        where: { id: pq.id },
        data: {
          paperId: pq.paperId,
          questionId: pq.questionId,
          sortOrder: pq.sortOrder,
          snapshotContent: pq.snapshotContent,
          snapshotAnswer: pq.snapshotAnswer,
          snapshotOptions: pq.snapshotOptions ?? dbNull(),
          marks: pq.marks,
        },
      });
      report.bump('PaperQuestion.revised');
      report.note(`修订 ${pq.id}`);
    }
  }
  report.bump('Paper.unchanged', levels.filter((l) => l.state === 'unchanged').length);
  progress(
    `课程内容：新建 ${levels.filter((l) => l.state === 'new').length} 档 / 未变 ${levels.filter((l) => l.state === 'unchanged').length} 档 / 修订 ${levels.filter((l) => l.state === 'changed').length} 档`,
  );

  const { createAssignments, createSessions, notActive } = plan.deliveries;
  if (createAssignments.length) {
    await tx.paperAssignment.createMany({
      data: createAssignments.map((d) => ({
        id: d.assignmentId,
        paperId: d.paperId,
        classId: d.classId,
        assignedById: PUBLISHER.teacherId,
        assignedAt: sgtInstant(d.dayIso, '00:01:00'),
        startAt: sgtInstant(d.dayIso, '00:05:00'),
        dueAt: sgtInstant(d.dayIso, '23:59:00'),
        status: 'open',
      })),
    });
  }
  report.bump('PaperAssignment.created', createAssignments.length);
  report.bump('PaperAssignment.kept', plan.deliveries.keptAssignments);
  if (createSessions.length) {
    await tx.morningQuizSession.createMany({
      data: createSessions.map((d) => ({
        id: d.sessionId,
        date: dayLabel(d.dayIso),
        classId: d.classId,
        paperAssignmentId: d.assignmentId,
        scheduledById: PUBLISHER.teacherId,
        status: 'active',
        level: d.level,
        // 试点是全天开放的 —— 学生什么时候有空什么时候做。
        attendanceStart: sgtInstant(d.dayIso, '00:05:00'),
        attendanceEnd: sgtInstant(d.dayIso, '23:59:00'),
        lateCutoff: sgtInstant(d.dayIso, '23:59:00'),
        quizStart: sgtInstant(d.dayIso, '00:05:00'),
        quizEnd: sgtInstant(d.dayIso, '23:59:00'),
        qrSecret: `${PREFIX}not-used-account-login-only`,
      })),
    });
  }
  report.bump('MorningQuizSession.created', createSessions.length);
  report.bump('MorningQuizSession.kept', plan.deliveries.keptSessions);
  if (notActive.length) {
    report.note(`${notActive.length} 场已有场次不是 active（${notActive.slice(0, 5).map((s) => `${s.id}=${s.status}`).join('、')}${notActive.length > 5 ? ' …' : ''}），保持原状`);
  }
}

/**
 * 给一个学生排今天的词。
 *
 * 三件事，顺序有意义：
 *   ① 今天这一档的 12 个主词：没有就建，有就把 `due` 拉回今天；
 *   ② 往日的试点词：**只有学生从没复习过的**才推到试点结束之后；
 *   ③ 学生自己的词（查词加入、答错收录）**一个都不碰**。
 */
async function scheduleWordsFor(tx, student, dayIso, report) {
  const lesson = content.lessonFor(student.englishLevel, dayIso);
  if (!lesson) {
    report.note(`${student.id}：分级 ${student.englishLevel ?? '(未设置)'} 今天没有内容，跳过`);
    return;
  }
  const dueAt = sgtInstant(dayIso, '00:05:00');
  const { primary } = lessonWordPlan(lesson);
  const todayHeads = new Set(primary.map((w) => w.headword));

  // 往返次数是这一步的全部成本。跨洋公网连库一次往返约 0.44 秒（2026-09-11
  // 实测），原来逐词 findUnique / create、逐行 update，85 个学生光这一步就
  // 要三十多分钟，超过事务预算整笔回滚。现在一个学生固定三次往返：一次读出
  // 今天的词里已经有的，一次批量建缺的，一次整批让路；只有确实要改的行才
  // 单独 update（新的一天通常一行都没有）。判断规则与原来逐行版一字不差。
  const existingRows = await tx.studentWord.findMany({
    where: { studentId: student.id, headword: { in: [...todayHeads] } },
  });
  const existingByHead = new Map(existingRows.map((row) => [row.headword, row]));

  const toCreate = [];
  const queued = new Set();
  for (const w of primary) {
    const id = studentWordId(student.id, w.headword);
    assertPrefixed([id]);
    const existing = existingByHead.get(w.headword);
    if (!existing) {
      // 同一个主词在清单里出现两次：原来逐行版第二次会读到刚建的那行、
      // 算作 unchanged；批量版照此处理，不重复建。
      if (queued.has(w.headword)) {
        report.bump('StudentWord.unchanged');
        continue;
      }
      queued.add(w.headword);
      toCreate.push({
        id,
        studentId: student.id,
        headword: w.headword,
        surfaceForm: w.surfaceForm,
        sourceType: 'teacher_push',
        sourcePassageTitle: lesson.title,
        contextSentence: w.context,
        contextTranslation: w.contextTranslation,
        state: 'new',
        due: dueAt,
      });
      continue;
    }
    // 学生自己查词、答错收录或由新课程引擎按需创建的词，可能恰好与
    // 今天的主词同名。它仍属于学生自己的长期词本：发布脚本既不改 due，
    // 也不覆盖原来的语境。今天的固定 12 词范围来自课程 manifest，已经
    // 不再依赖 due 队列，因此完全没有必要为了开课去改这行。
    if (!isManagedStudentWord(existing)) {
      report.bump('StudentWord.personalKept');
      continue;
    }
    // 已经有了。到期时间按试点日程调整；这批脚本自己创建的课程词还要
    // 同步例句翻译。学生自己加的语境、FSRS 状态和复习历史一个字不动。
    const translationPatch = existing.contextSentence === w.context &&
      existing.contextTranslation !== w.contextTranslation
      ? { contextTranslation: w.contextTranslation }
      : {};
    if (existing.due.getTime() !== dueAt.getTime()) {
      await tx.studentWord.update({ where: { id: existing.id }, data: { due: dueAt, ...translationPatch } });
      report.bump('StudentWord.rescheduled');
    } else if (Object.keys(translationPatch).length > 0) {
      await tx.studentWord.update({ where: { id: existing.id }, data: translationPatch });
      report.bump('StudentWord.translationBackfilled');
    } else {
      report.bump('StudentWord.unchanged');
    }
  }
  if (toCreate.length > 0) {
    const created = await tx.studentWord.createMany({ data: toCreate });
    report.bump('StudentWord.created', created.count);
  }

  // ② 往日的试点词让路 —— 只动这个脚本自己造的、且学生从没复习过的。
  //    条件与原来的「先 findMany 再逐行 update」完全相同，只是合成一条语句。
  const parked = await tx.studentWord.updateMany({
    where: {
      studentId: student.id,
      id: { startsWith: `${PREFIX}w_` },
      headword: { notIn: [...todayHeads] },
      due: { lte: sgtInstant(dayIso, '23:59:59') },
      reviews: { none: {} },
    },
    data: { due: sgtInstant(PARK_UNTIL, '00:05:00') },
  });
  report.bump('StudentWord.parked', parked.count);
}

// ─────────────────────────────────────────────────────────────
// 只读前置 / 后置
// ─────────────────────────────────────────────────────────────

async function snapshot(tx) {
  const one = async (sql) => (await tx.$queryRawUnsafe(sql))[0];
  const n = (v) => Number(v);
  const r = await one(`/* p1:snapshot */ SELECT
    (SELECT count(*) FROM "User" WHERE role='student')::int                                  AS students,
    (SELECT count(*) FROM "Class")::int                                                      AS classes,
    (SELECT count(*) FROM "DictEntry")::int                                                  AS dict,
    (SELECT count(*) FROM "Paper" WHERE id LIKE '${PREFIX}%')::int                           AS p1_papers,
    (SELECT count(*) FROM "Question" WHERE id LIKE '${PREFIX}%')::int                        AS p1_questions,
    (SELECT count(*) FROM "PaperQuestion" WHERE id LIKE '${PREFIX}%')::int                   AS p1_paper_questions,
    (SELECT count(*) FROM "PaperAssignment" WHERE id LIKE '${PREFIX}%')::int                 AS p1_assignments,
    (SELECT count(*) FROM "MorningQuizSession" WHERE id LIKE '${PREFIX}%')::int              AS p1_sessions,
    (SELECT count(*) FROM "StudentWord" WHERE id LIKE '${PREFIX}%')::int                     AS p1_words,
    (SELECT count(*) FROM "StudentSubmission")::int                                          AS submissions,
    (SELECT count(*) FROM "AnswerScript")::int                                               AS scripts,
    (SELECT count(*) FROM "VocabQuizAttempt")::int                                           AS attempts,
    (SELECT count(*) FROM "WordReviewLog")::int                                              AS reviews,
    (SELECT count(*) FROM "MistakeEntry")::int                                               AS mistakes,
    (SELECT count(*) FROM "GradeAppeal")::int                                                AS appeals,
    (SELECT count(*) FROM "DailyLessonCompletion")::int                                      AS dlc,
    (SELECT count(*) FROM "StudentWord" WHERE "studentId" = 's12f_acceptance_student')::int  AS s12f_words,
    (SELECT count(*) FROM "StudentWord" WHERE "studentId" LIKE 't_%' OR "studentId" ~ '^t[0-9]_')::int AS fixture_words,
    (SELECT md5(string_agg(id || '|' || headword || '|' || state || '|' || due::text, ',' ORDER BY id))
       FROM "StudentWord" WHERE id NOT LIKE '${PREFIX}%')                                    AS other_words_hash,
    (SELECT md5(string_agg(id || '|' || status, ',' ORDER BY id)) FROM "StudentSubmission")  AS submissions_hash`);
  const out = {};
  for (const k of Object.keys(r)) out[k] = typeof r[k] === 'string' ? r[k] : n(r[k]);
  return out;
}

/** 这一天的范围里有没有**不是我们造的**东西占着位置。 */
async function assertScopeFree(tx, dayIso) {
  const classIds = ALL_CLASSES.map((klass) => klass.id);
  const [foreignSessions, foreignAssignments, foreignStudents] = await Promise.all([
    tx.morningQuizSession.count({
      where: {
        classId: { in: classIds },
        date: dayLabel(dayIso),
        NOT: { id: { startsWith: PREFIX } },
      },
    }),
    tx.paperAssignment.count({
      where: { classId: { in: classIds }, NOT: { id: { startsWith: PREFIX } } },
    }),
    tx.classEnrollment.count({
      where: {
        classId: { in: classIds },
        role: 'student',
        OR: [{ userId: { startsWith: 's12f' } }, { userId: { startsWith: 't' } }],
      },
    }),
  ]);
  const bad = [];
  if (foreignSessions > 0) bad.push(`这一天已经有 ${foreignSessions} 场不是试点造的场次`);
  if (foreignAssignments > 0) bad.push(`试点班上挂着 ${foreignAssignments} 份不是试点造的作业`);
  if (foreignStudents > 0) bad.push(`试点班里混进了 ${foreignStudents} 个夹具 / 验收账号`);
  if (bad.length > 0) {
    throw new PilotError(`拒绝执行：目标范围被别的东西占着 —— \n  · ${bad.join('\n  · ')}`);
  }
}

function allBundleTexts() {
  const passages = [];
  const questions = [];
  for (const [level, days] of Object.entries(content.LEVELS)) {
    for (const day of days) {
      passages.push({ id: `${level}/${day.date}`, text: day.passage });
      for (let index = 0; index < day.questions.length; index += 1) {
        questions.push({ id: `${level}/${day.date}/q${index + 1}`, text: questionItem(day.questions[index].stem) });
      }
    }
  }
  return { passages, questions };
}

/** 拒绝原因里说清楚：谁撞了谁、相似度多少、按什么规则。 */
function describeHit(hit, extra = '') {
  return (
    `${hit.candidateId} ≈ ${hit.previousId}（相似度 ${hit.similarity.toFixed(2)} ≥ ${hit.threshold}，` +
    `${hit.shingleSize} 词片段，${hit.algorithm}${extra}）`
  );
}

function assertBundleHasNoNearDuplicates() {
  const { passages, questions } = allBundleTexts();
  const passageHit = findNearDuplicate(passages, passages, 0.25, 5);
  if (passageHit) throw new PilotError(`内容包文章近似重复：${describeHit(passageHit)}`);
  const questionHit = findNearDuplicate(questions, questions, 0.8, 4);
  if (questionHit) throw new PilotError(`内容包题目近似重复：${describeHit(questionHit)}`);
}

/** 这一天的内容门禁（`publish-gates.js`）。有问题就在连库之前拒绝。 */
function dayContentProblems(dayIso, levelTools) {
  return Object.keys(content.LEVELS).flatMap((level) => {
    const lesson = content.lessonFor(level, dayIso);
    return lesson ? gates.lessonProblems(level, lesson, { levelTools }) : [`${level}：没有 ${dayIso} 的课`];
  });
}

/** 第三周起的日子要篇幅 / 超纲词检查器；加载失败就拒绝发布，不当作通过。 */
function levelToolsFor(dayIso, provided) {
  if (provided) return provided;
  if (dayIso < gates.GATES_FROM) return null;
  try {
    return gates.loadLevelTools();
  } catch (e) {
    throw new PilotError(`内容门禁：篇幅 / 超纲词检查器加载失败（${String(e && e.message).slice(0, 200)}），拒绝发布。`);
  }
}

function assertDayContentGates(dayIso, levelTools) {
  const problems = dayContentProblems(dayIso, levelToolsFor(dayIso, levelTools));
  if (problems.length) {
    throw new PilotError(`内容门禁没通过（一行都没写）：\n  · ${problems.slice(0, 30).join('\n  · ')}`);
  }
}

/** 一页取多少条历史。只影响往返次数，不影响比较范围。 */
const HISTORY_PAGE_SIZE = 2000;

/**
 * 查重的对照面是「**学生读过的**」，不是「题库里有的」。
 *
 * 原来对照的是全部非试点 Question。那口径答错了它想回答的问题：这道门
 * 存在的意义是「别让同一个学生把同一篇文章读两遍」，而题库里躺着一篇
 * 从没挂过作业的文章，对学生来说就是全新的。
 *
 * 实测差别很大：仓库的 fixture 库约一百篇，按「题库里有」算只剩 3 篇可用，
 * 按「学生读过」算有 17 篇 —— 差的那十几篇是历年出好了却从未发出去的。
 * 首发周的五档内容正是建立在这十几篇上。
 *
 * 判据是**这份卷子挂过作业，且那份作业下真有学生答卷**。答卷行在学生
 * 开卷时就建出来，所以「开了没交」也算读过。卷子后来归档（status /
 * archivedAt）不影响 —— 读过就是读过。
 *
 * 保守的一面仍然保留：曾经发给任何一个学生（包括早已毕业的班）都算读过，
 * 不按人分别计算。真要做到「按学生查重」，需要在发课时按人挑内容，那是
 * 另一件事；在那之前，宁可拦多。
 *
 * 2026-09-11（PUB03）两处改动：
 *
 *   · 原来 `take: 10000` 一次取完、不排序 —— 历史超过一万条之后，多出来的
 *     那些（按物理顺序，往往正是最新的）根本不参与比较。现在按 id 分页取完。
 *     生产当时 1,286 条，还没撞到上限，这是预防。
 *   · 原来整个排除 `p1_` 卷子，靠内容包自己两两比较来覆盖 —— 可内容包里
 *     改掉了的旧版本（发出去以后才换的）就谁都不比了。现在只排除**正在发布
 *     的这一天**自己的五份卷子，其余学生读过的 p1 卷子一并对照。
 */
async function deliveredHistory(tx, { excludePaperIds = [], pageSize = HISTORY_PAGE_SIZE } = {}) {
  const base = {
    ...(excludePaperIds.length ? { paperId: { notIn: excludePaperIds } } : {}),
    paper: { assignments: { some: { submissions: { some: {} } } } },
  };
  const rows = [];
  let pages = 0;
  let after = null;
  for (;;) {
    const page = await tx.paperQuestion.findMany({
      where: after ? { ...base, id: { gt: after } } : base,
      select: { id: true, snapshotContent: true },
      orderBy: { id: 'asc' },
      take: pageSize,
    });
    pages += 1;
    for (const row of page) rows.push({ id: row.id, content: row.snapshotContent });
    if (page.length < pageSize) break;
    after = page[page.length - 1].id;
  }
  return { rows, pages };
}

async function assertNoHistoricalNearDuplicates(tx, dayIso, { pageSize } = {}) {
  const ownPapers = Object.keys(content.LEVELS).map((level) => idsFor(level, dayIso).paperId);
  const { rows: existing, pages } = await deliveredHistory(tx, { excludePaperIds: ownPapers, pageSize });
  const historicalPassages = new Map();
  const historicalQuestions = [];
  for (const row of existing) {
    const body = row.content && typeof row.content === 'object' ? row.content : {};
    const passage = typeof body.passage === 'string' ? body.passage : '';
    const stem = typeof body.stem === 'string' ? body.stem : '';
    if (passage && !historicalPassages.has(passage)) historicalPassages.set(passage, { id: row.id, text: passage });
    if (stem) historicalQuestions.push({ id: row.id, text: questionItem(stem) });
  }
  const scope = `；对照学生读过的 ${existing.length} 条历史（${historicalPassages.size} 篇文章、${historicalQuestions.length} 道题）`;
  const candidates = Object.entries(content.LEVELS).map(([level]) => {
    const day = content.lessonFor(level, dayIso);
    return { level, day };
  }).filter((row) => row.day);
  const passageHit = findNearDuplicate(
    candidates.map(({ level, day }) => ({ id: `${level}/${dayIso}`, text: day.passage })),
    [...historicalPassages.values()],
    0.25,
    5,
  );
  if (passageHit) throw new PilotError(`文章与历史内容近似重复：${describeHit(passageHit, scope)}`);
  const questionHit = findNearDuplicate(
    candidates.flatMap(({ level, day }) => day.questions.map((question, index) => ({ id: `${level}/${dayIso}/q${index + 1}`, text: questionItem(question.stem) }))),
    historicalQuestions,
    0.8,
    4,
  );
  if (questionHit) throw new PilotError(`题目与历史内容近似重复：${describeHit(questionHit, scope)}`);
  return { rows: existing.length, pages, passages: historicalPassages.size, questions: historicalQuestions.length };
}

// ─────────────────────────────────────────────────────────────
// 发布后的约束：在事务里、提交之前核对（PUB02，2026-09-11）
//
// 原来的硬断言写在 `$transaction(...)` 返回、`$disconnect()` 之后 —— 断言
// 失败时事务早已提交，日志说「动了不该动的东西」，库却已经改了。现在所有
// 断言都在事务回调里，抛出即回滚。
// ─────────────────────────────────────────────────────────────

/** 发布完这一天，库里应当成立的全部约束。返回问题清单（空 = 通过）。 */
async function verifyDayPublished(tx, dayIso, plans, roster) {
  const problems = [];
  const paperIds = plans.map((p) => p.paper.id);
  const asgIds = plans.flatMap((p) => p.deliveries.map((d) => d.assignmentId));
  const sessIds = plans.flatMap((p) => p.deliveries.map((d) => d.sessionId));
  const [papers, pqs, asgs, sessions] = await Promise.all([
    tx.paper.findMany({ where: { id: { in: paperIds } }, select: { id: true, name: true, config: true, totalMarksActual: true } }),
    tx.paperQuestion.findMany({
      where: { paperId: { in: paperIds } },
      select: { id: true, paperId: true, questionId: true, sortOrder: true, snapshotContent: true, snapshotAnswer: true, snapshotOptions: true, marks: true },
    }),
    tx.paperAssignment.findMany({ where: { id: { in: asgIds } }, select: { id: true, paperId: true, classId: true } }),
    tx.morningQuizSession.findMany({
      where: { id: { in: sessIds } },
      select: { id: true, date: true, classId: true, level: true, paperAssignmentId: true },
    }),
  ]);
  const paperById = new Map(papers.map((r) => [r.id, r]));
  const pqById = new Map(pqs.map((r) => [r.id, r]));
  const asgById = new Map(asgs.map((r) => [r.id, r]));
  const sessById = new Map(sessions.map((r) => [r.id, r]));
  const dayTime = dayLabel(dayIso).getTime();

  for (const p of plans) {
    const paper = paperById.get(p.paper.id);
    if (!paper) {
      problems.push(`缺卷子 ${p.paper.id}`);
      continue;
    }
    if (paper.name !== p.paper.name || !sameJson(paper.config, p.paper.config)) problems.push(`卷子 ${p.paper.id} 的标题 / 词表与内容包不符`);
    const mine = pqs.filter((r) => r.paperId === p.paper.id);
    if (mine.length !== p.paperQuestions.length) problems.push(`卷子 ${p.paper.id} 有 ${mine.length} 题，应为 ${p.paperQuestions.length} 题`);
    const sum = mine.reduce((a, r) => a + r.marks, 0);
    if (sum !== paper.totalMarksActual || sum !== p.paper.totalMarks) {
      problems.push(`卷子 ${p.paper.id} 的总分对不上（题目合计 ${sum}，卷面 ${paper.totalMarksActual}，内容包 ${p.paper.totalMarks}）`);
    }
    for (const expected of p.paperQuestions) {
      const row = pqById.get(expected.id);
      if (!row) problems.push(`缺题 ${expected.id}`);
      else if (changedFields(expected, row, PAPER_QUESTION_FIELDS).length) problems.push(`题 ${expected.id} 的快照与内容包不符`);
    }
    for (const d of p.deliveries) {
      const asg = asgById.get(d.assignmentId);
      if (!asg) problems.push(`缺作业 ${d.assignmentId}`);
      else if (asg.paperId !== p.paper.id || asg.classId !== d.classId) problems.push(`作业 ${d.assignmentId} 挂错了卷子 / 班`);
      const sess = sessById.get(d.sessionId);
      if (!sess) problems.push(`缺场次 ${d.sessionId}`);
      else if (new Date(sess.date).getTime() !== dayTime || sess.classId !== d.classId || sess.level !== p.level || sess.paperAssignmentId !== d.assignmentId) {
        problems.push(`场次 ${d.sessionId} 的日期 / 班 / 档 / 作业对不上`);
      }
    }
  }

  // 词典：这一天用到的词都查得到
  const heads = content.wordsForDay(dayIso).map((w) => w.headword);
  if (heads.length) {
    const found = new Set((await tx.dictEntry.findMany({ where: { word: { in: heads } }, select: { word: true } })).map((r) => r.word));
    const missing = heads.filter((h) => !found.has(h));
    if (missing.length) problems.push(`词典缺 ${missing.length} 个今天的词：${missing.slice(0, 8).join(', ')}`);
  }

  // 每个有档位的在册学生：今天那一档的 12 个主词都在他的词本里（学生自己同名的词也算）
  const learners = roster.filter((s) => s && content.lessonFor(s.englishLevel, dayIso));
  if (learners.length) {
    const primaryByLevel = new Map();
    for (const s of learners) {
      if (!primaryByLevel.has(s.englishLevel)) {
        primaryByLevel.set(s.englishLevel, lessonWordPlan(content.lessonFor(s.englishLevel, dayIso)).primary.map((w) => w.headword));
      }
    }
    const allPrimary = [...new Set([...primaryByLevel.values()].flat())];
    const have = new Map();
    for (const r of await tx.studentWord.findMany({
      where: { studentId: { in: learners.map((s) => s.id) }, headword: { in: allPrimary } },
      select: { studentId: true, headword: true },
    })) {
      if (!have.has(r.studentId)) have.set(r.studentId, new Set());
      have.get(r.studentId).add(r.headword);
    }
    for (const s of learners) {
      const got = have.get(s.id) ?? new Set();
      const missing = primaryByLevel.get(s.englishLevel).filter((h) => !got.has(h));
      if (missing.length) problems.push(`学生 ${s.id}（${s.englishLevel}）缺今天的 ${missing.length} 个词：${missing.slice(0, 5).join(', ')}`);
    }
  }
  return problems;
}

/** 前后快照里「不该动的」有没有动。返回动了的项（空 = 没动）。 */
function foreignChanges(before, after) {
  const violations = [];
  if (before.submissions_hash !== after.submissions_hash) violations.push('StudentSubmission');
  if (before.other_words_hash !== after.other_words_hash) violations.push('非试点 StudentWord');
  for (const k of ['submissions', 'scripts', 'attempts', 'reviews', 'mistakes', 'appeals', 'dlc', 's12f_words', 'fixture_words']) {
    if (before[k] !== after[k]) violations.push(k);
  }
  return violations;
}

// ─────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────

function makeReport() {
  const counts = {};
  const notes = [];
  return {
    bump: (k, n = 1) => { if (n > 0) counts[k] = (counts[k] ?? 0) + n; },
    note: (s) => notes.push(s),
    counts,
    notes,
  };
}

/**
 * 发布一天。**一切检查都在返回之前完成**：返回了就是完整成功、已提交；
 * 抛出了就是整笔回滚、库里什么都没变。
 *
 * `prisma` 只需要 `$transaction`。
 */
async function publishDay(prisma, day, { revise = false, progress = () => {}, historyPageSize, levelTools } = {}) {
  // ① 不连库的前置：内容包自身查重 + 这一天的内容门禁
  assertBundleHasNoNearDuplicates();
  assertDayContentGates(day, levelTools);

  return prisma.$transaction(
    async (tx) => {
      // ② 只读前置
      progress('事务已开始');
      const before = await snapshot(tx);
      await assertScopeFree(tx, day);
      const history = await assertNoHistoricalNearDuplicates(tx, day, { pageSize: historyPageSize });
      const plans = dayRows(day);
      const plan = planDay(plans, await loadExisting(tx, plans));
      assertPlanAllowed(plan, { revise });
      progress(`前置检查完成（查重对照 ${history.rows} 条历史）`);

      // ③ 写
      const report = makeReport();
      await upsertPublisherClassesAndQa(tx, report);
      progress('班级与档位就绪');
      await upsertDictionary(tx, report, day);
      progress('词典补录完成');
      await writeDay(tx, plan, report, progress);
      progress('卷子与场次就绪');

      // ④ 给试点班在册的每一个学生排今天的词
      const roster = await tx.classEnrollment.findMany({
        where: { classId: { in: ALL_CLASSES.map((klass) => klass.id) }, role: 'student' },
        select: { user: { select: { id: true, name: true, englishLevel: true } } },
      });
      progress(`开始给 ${roster.length} 个学生排词`);
      for (const [i, r] of roster.entries()) {
        await scheduleWordsFor(tx, r.user, day, report);
        if ((i + 1) % 20 === 0) progress(`已排 ${i + 1} / ${roster.length}`);
      }
      progress('排词完成');

      // ⑤ 发布后约束 + 不该动的没动 —— 都在提交之前；任何一条不过就整笔回滚
      const problems = await verifyDayPublished(tx, day, plans, roster.map((r) => r.user));
      if (problems.length) {
        throw new PilotError(`发布后核对没通过（整笔回滚，库里什么都没变）：\n  · ${problems.slice(0, 30).join('\n  · ')}`);
      }
      const after = await snapshot(tx);
      const violations = foreignChanges(before, after);
      if (violations.length) {
        throw new PilotError(`脚本动了不该动的东西：${violations.join(', ')}（整笔回滚，库里什么都没变）`);
      }
      progress('发布后核对通过，提交');
      return { before, after, report, roster: roster.map((r) => r.user), plan, history };
    },
    // 事务预算：跨洋公网代理连库，一次往返几百毫秒，而这里有几百次
    // 顺序写。原来是 5 分钟，内容包变成两周后正好卡在边界上炸掉。
    // 词典补录已改成按天 + 批量取，这里再留一倍余量。
    { maxWait: 30_000, timeout: 900_000 },
  );
}

/**
 * 只读核对某一天发布得全不全（`--check`）。事务第一条就是 READ ONLY ——
 * 这条路径上即使有人误加了写，数据库也会拒绝。
 */
async function checkDay(prisma, day, { progress = () => {}, levelTools } = {}) {
  let contentProblems = [];
  try {
    contentProblems = dayContentProblems(day, levelToolsFor(day, levelTools));
  } catch (e) {
    contentProblems = [String(e && e.message)];
  }
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      progress('只读事务已开始');
      const plans = dayRows(day);
      const plan = planDay(plans, await loadExisting(tx, plans));
      const roster = await tx.classEnrollment.findMany({
        where: { classId: { in: ALL_CLASSES.map((klass) => klass.id) }, role: 'student' },
        select: { user: { select: { id: true, englishLevel: true } } },
      });
      const problems = await verifyDayPublished(tx, day, plans, roster.map((r) => r.user));
      return { plan, problems, contentProblems, roster: roster.length };
    },
    { maxWait: 30_000, timeout: 120_000 },
  );
}

function printPublished(day, out, t0, queries) {
  const { before, after, report, roster, plan, history } = out;
  const changed = Object.keys(after).filter((k) => String(before[k]) !== String(after[k]));
  const line = (k) => `    ${k.padEnd(22)} ${String(before[k]).padEnd(34)} → ${after[k]}`;
  const count = (state) => plan.levels.filter((l) => l.state === state).length;
  console.log(
    [
      '',
      // 内容包已经不止一周了，别再把每一天都报成「试点第一周」。
      `${day} 已发布（内容包第 ${content.DATES.indexOf(day) + 1} / ${content.DATES.length} 天；用时 ${Math.round((Date.now() - t0) / 1000)} 秒，${queries} 次查询）。`,
      `  班级        : ${REGISTRATION_CLASSES.map((klass) => klass.name).join(' · ')}（另保留内部冒烟班；每班五档齐全）`,
      `  在册学生    : ${roster.length}（${roster.map((r) => `${r.name}[${r.englishLevel ?? '未设置'}]`).join('、') || '无'}）`,
      `  课程内容    : 新建 ${count('new')} 档 · 未变 ${count('unchanged')} 档 · 修订 ${count('changed')} 档`,
      `  查重        : 对照学生读过的 ${history.rows} 条历史（${history.passages} 篇文章 / ${history.questions} 道题，${history.pages} 页）`,
      '',
      '  写入统计（按类别）：',
      ...Object.entries(report.counts).sort().map(([k, v]) => `    ${k.padEnd(26)} ${v}`),
      ...(report.notes.length ? ['', '  备注：', ...report.notes.map((n) => `    · ${n}`)] : []),
      '',
      '  前 → 后（只列变了的）：',
      ...(changed.length ? changed.map(line) : ['    （没有任何计数发生变化 —— 这次是幂等重跑）']),
      '',
      '  发布后核对（均在事务内、提交之前完成）：',
      '    五档卷子与题、每班每档场次、词典、每个学生今天的词   齐 ✓',
      '    答卷指纹 / 非试点生词 / 复习流水 / 错题申诉 / 当日任务行   未变 ✓',
      '',
    ].join('\n'),
  );
}

function printCheck(day, out) {
  const { plan, problems, contentProblems, roster } = out;
  const count = (state) => plan.levels.filter((l) => l.state === state).length;
  const used = plan.levels.filter((l) => l.usage.used);
  console.log(
    [
      '',
      `${day} 只读核对（没有写库）：`,
      `  课程内容    : 库里没有 ${count('new')} 档 · 与内容包一致 ${count('unchanged')} 档 · 与内容包不同 ${count('changed')} 档`,
      ...plan.levels
        .filter((l) => l.state === 'changed')
        .map((l) => `    · ${l.paperId}：${l.changes.slice(0, 6).map((c) => `${c.id}（${c.fields.join('、')}）`).join('；')}`),
      `  已被学生使用 : ${used.length ? used.map((l) => `${l.level}（答卷 ${l.usage.submissions}，作答 ${l.usage.scripts}）`).join('、') : '无'}`,
      `  场次        : 已有 ${plan.deliveries.keptSessions} / 缺 ${plan.deliveries.createSessions.length}` +
        (plan.deliveries.notActive.length ? `（${plan.deliveries.notActive.length} 场不是 active）` : ''),
      `  在册学生    : ${roster}`,
      `  内容门禁    : ${contentProblems.length ? `${contentProblems.length} 条问题` : '通过 ✓'}`,
      ...contentProblems.slice(0, 10).map((p) => `    · ${p}`),
      `  发布完整性  : ${problems.length ? `${problems.length} 条问题` : '完整 ✓'}`,
      ...problems.slice(0, 20).map((p) => `    · ${p}`),
      '',
    ].join('\n'),
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const revise = argv.includes('--revise-unstarted');
  assertEnvGates(ENV_AT_STARTUP, { requireConfirmation: !check });
  const day = parseDay(argv);
  if (check && revise) throw new PilotError('拒绝执行：--check 是只读核对，不能和 --revise-unstarted 一起用。');

  process.env.DATABASE_URL = publishConnectionUrl(ENV_AT_STARTUP.DATABASE_PUBLIC_URL);
  const { PrismaClient } = require('@prisma/client');
  // 只数次数，不打印查询内容 —— 往返次数就是这个脚本的耗时。
  const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
  let queries = 0;
  prisma.$on('query', () => { queries += 1; });
  // 脚本原来只在结束时打印；中途死掉时日志一片空白，看不出卡在哪一步。
  const t0 = Date.now();
  const progress = (what) =>
    process.stderr.write(`[${Math.round((Date.now() - t0) / 1000)}s · ${queries} 次查询] ${what}\n`);

  let out;
  try {
    out = check ? await checkDay(prisma, day, { progress }) : await publishDay(prisma, day, { revise, progress });
  } finally {
    await prisma.$disconnect();
  }

  // 走到这里：发布 = 事务已提交且全部核对通过；核对 = 只读结果
  if (check) {
    printCheck(day, out);
    if (out.problems.length || out.contentProblems.length) process.exitCode = 2;
    return;
  }
  printPublished(day, out, t0, queries);
}

module.exports = {
  CONFIRMATION,
  PRODUCTION_CONFIRMATION,
  PREFIX,
  EXPECTED_RAILWAY,
  EXPECTED_PRODUCTION_RAILWAY,
  PUBLISHER,
  CLASS,
  REGISTRATION_CLASSES,
  ALL_CLASSES,
  QA_STUDENT,
  DAILY_WORD_TARGET,
  RESERVE_WORD_TARGET,
  PARK_UNTIL,
  HISTORY_PAGE_SIZE,
  PilotError,
  writeScopes,
  neverTouched,
  dayLabel,
  sgtInstant,
  idsFor,
  deliveryIdsFor,
  studentWordId,
  isManagedStudentWord,
  lessonWordPlan,
  assertPrefixed,
  assertEnvGates,
  parseDay,
  isOursToFix,
  dictDrift,
  allBundleTexts,
  assertBundleHasNoNearDuplicates,
  assertNoHistoricalNearDuplicates,
  deliveredHistory,
  dayContentProblems,
  assertDayContentGates,
  scheduleWordsFor,
  makeReport,
  publishConnectionUrl,
  sameJson,
  lessonRows,
  dayRows,
  loadExisting,
  planDay,
  assertPlanAllowed,
  writeDay,
  verifyDayPublished,
  foreignChanges,
  publishDay,
  checkDay,
};

if (require.main === module) {
  main().catch((e) => {
    if (e instanceof PilotError) {
      console.error(`\n试点内容未发布：\n${e.message}\n`);
    } else {
      // 只回显**错误名与第一行**，并把任何连接串抹掉。一个字都不给的话
      // 调试无从下手；原样打出来又可能把凭据带到日志里。
      const raw = String((e && e.message) || '').replace(/\s+/g, ' ').trim().slice(0, 900);
      const safe = raw
        // 连接串与「主机:端口」都算连接元数据 —— 一个都不许进日志
        .replace(/postgres(ql)?:\/\/\S*/gi, '[redacted-connection-string]')
        .replace(/[A-Za-z0-9.-]+\.(rlwy\.net|railway\.app|up\.railway\.app):\d+/g, '[redacted-host]');
      console.error(`\n试点内容未发布：${(e && e.name) || 'Error'} — ${safe}\n`);
    }
    process.exit(1);
  });
}
