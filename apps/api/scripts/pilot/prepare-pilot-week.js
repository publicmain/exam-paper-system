/**
 * S12M —— 把**试点第一周某一天**的课程发布到 staging。
 *
 * ## 一次只发一天，这是有原因的
 *
 * S12L 之后课程学词**只教不考**，而教学卡刻意不写 FSRS。于是周一教过的
 * 21 个词到了周二**仍然「到期」** —— 队列会变成 42 个、被 `COURSE_QUEUE_MAX`
 * 截到 30，周一的词被重教，「今天 21 个词」从周二开始就不成立了。
 *
 * 所以这个脚本按天跑：发某一天时，把**那一天**的 21 个词设成当天到期，
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

// ─────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────

const CONFIRMATION = 'S12M_PUBLISH_PILOT_WEEK';
/** 这个脚本写的每一行都带它。 */
const PREFIX = 'p1_';

const EXPECTED_RAILWAY = {
  RAILWAY_PROJECT_ID: 'ed8c31c0-6499-4611-830a-64043189f7d0',
  RAILWAY_PROJECT_NAME: 'exam-staging-manual',
  RAILWAY_ENVIRONMENT_NAME: 'production',
  RAILWAY_SERVICE_NAME: 'Postgres',
};

/** 复用的既有资源 —— **只读引用，绝不改写**。 */
const REUSED = { subjectId: 'stg_sub', teacherId: 't_stgteacher' };

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

/** 往日试点词被推到哪一天（试点结束之后）。 */
const PARK_UNTIL = '2026-09-14';

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

/** 每一个 id 都必须带前缀 —— 漏一个就是一行没有归属的数据。 */
function assertPrefixed(ids) {
  const bad = ids.filter((id) => typeof id !== 'string' || !id.startsWith(PREFIX));
  if (bad.length > 0) {
    throw new PilotError(`内部错误：${bad.length} 个 id 没有 ${PREFIX} 前缀：${bad.slice(0, 3)}`);
  }
  return true;
}

/** 八道环境闸门。抛出的错误里**只出现变量名，绝不出现取值**。 */
function assertEnvGates(env = ENV_AT_STARTUP) {
  for (const key of Object.keys(EXPECTED_RAILWAY)) {
    if (env[key] !== EXPECTED_RAILWAY[key]) {
      throw new PilotError(
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
  if (env.P1_CONFIRM !== CONFIRMATION) {
    throw new PilotError(
      `拒绝执行：需要逐字确认 P1_CONFIRM=${CONFIRMATION}\n` +
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

async function upsertClassAndQa(tx, report) {
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
  const crypto = require('crypto');
  const bcrypt = require('bcryptjs');
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
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

async function upsertDictionary(tx, report) {
  // **别人的词条一个字都不改** —— 那可能是别的内容在用的释义，而这个脚本
  // 没有资格替它决定。自己写的那些则要能纠错，否则错别字就永久留在
  // 学生眼前。
  for (const w of content.allWords()) {
    const existing = await tx.dictEntry.findUnique({ where: { word: w.headword } });
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

async function upsertLesson(tx, level, dayIso, report) {
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

  const paperConfig = {
    mode: 'passage_pick',
    passageTitle: lesson.title,
    pilotWeek: 'W1',
    level,
    lessonWords: lesson.words,
  };
  await tx.paper.upsert({
    where: { id: ids.paperId },
    update: { name: lesson.title, config: paperConfig },
    create: {
      id: ids.paperId,
      name: lesson.title,
      subjectId: REUSED.subjectId,
      ownerId: REUSED.teacherId,
      status: 'published',
      durationMin: 30,
      totalMarksTarget: maxScore,
      totalMarksActual: maxScore,
      generatedSeed: 1,
      rendererKey: 'ielts_reading',
      config: paperConfig,
    },
  });
  report.bump('Paper');

  for (let i = 0; i < lesson.questions.length; i++) {
    const q = lesson.questions[i];
    const n = i + 1;
    const snapshotContent = {
      taskType: q.taskType,
      passageTitle: lesson.title,
      passage: lesson.passage,
      stem: q.stem,
    };
    // 客观题：正确项写在 options[].correct 上（`gradeMcq` 的第一顺位判据）。
    // 主观题：**不写任何自动分依据** —— 它必须诚实地进人工队列。
    const options = q.options
      ? q.options.map((o) => ({ ...o, correct: o.key === q.answer }))
      : undefined;
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

    await tx.question.upsert({
      where: { id: ids.questionId(n) },
      update: { content: snapshotContent, answerContent, options, marks: q.marks },
      create: {
        id: ids.questionId(n),
        subjectId: REUSED.subjectId,
        createdById: REUSED.teacherId,
        questionType: q.questionType,
        sourceType: 'original_school',
        content: snapshotContent,
        answerContent,
        options,
        marks: q.marks,
        estimatedTimeMin: q.marks * 1.5,
        difficulty: 3,
        status: 'active',
      },
    });
    report.bump('Question');

    await tx.paperQuestion.upsert({
      where: { id: ids.paperQuestionId(n) },
      update: { snapshotContent, snapshotAnswer: answerContent, snapshotOptions: options, marks: q.marks },
      create: {
        id: ids.paperQuestionId(n),
        paperId: ids.paperId,
        questionId: ids.questionId(n),
        sortOrder: n,
        snapshotContent,
        snapshotAnswer: answerContent,
        snapshotOptions: options,
        marks: q.marks,
      },
    });
    report.bump('PaperQuestion');
  }

  for (const klass of ALL_CLASSES) {
    const delivery = deliveryIdsFor(level, dayIso, klass);
    assertPrefixed([delivery.assignmentId, delivery.sessionId]);
    await tx.paperAssignment.upsert({
      where: { id: delivery.assignmentId },
      update: { status: 'open' },
      create: {
        id: delivery.assignmentId,
        paperId: ids.paperId,
        classId: klass.id,
        assignedById: REUSED.teacherId,
        assignedAt: sgtInstant(dayIso, '00:01:00'),
        startAt: sgtInstant(dayIso, '00:05:00'),
        dueAt: sgtInstant(dayIso, '23:59:00'),
        status: 'open',
      },
    });
    report.bump('PaperAssignment');

    await tx.morningQuizSession.upsert({
      where: { id: delivery.sessionId },
      update: { status: 'active' },
      create: {
        id: delivery.sessionId,
        date: dayLabel(dayIso),
        classId: klass.id,
        paperAssignmentId: delivery.assignmentId,
        scheduledById: REUSED.teacherId,
        status: 'active',
        level,
        // 试点是全天开放的 —— 学生什么时候有空什么时候做。
        attendanceStart: sgtInstant(dayIso, '00:05:00'),
        attendanceEnd: sgtInstant(dayIso, '23:59:00'),
        lateCutoff: sgtInstant(dayIso, '23:59:00'),
        quizStart: sgtInstant(dayIso, '00:05:00'),
        quizEnd: sgtInstant(dayIso, '23:59:00'),
        qrSecret: `${PREFIX}not-used-account-login-only`,
      },
    });
    report.bump('MorningQuizSession');
  }
}

/**
 * 给一个学生排今天的词。
 *
 * 三件事，顺序有意义：
 *   ① 今天这一档的 21 个词：没有就建，有就把 `due` 拉回今天；
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
  const todayHeads = new Set(lesson.words.map((w) => w.headword));

  for (const w of lesson.words) {
    const id = studentWordId(student.id, w.headword);
    assertPrefixed([id]);
    const existing = await tx.studentWord.findUnique({
      where: { studentId_headword: { studentId: student.id, headword: w.headword } },
    });
    if (!existing) {
      await tx.studentWord.create({
        data: {
          id,
          studentId: student.id,
          headword: w.headword,
          surfaceForm: w.surfaceForm,
          sourceType: 'teacher_push',
          sourcePassageTitle: lesson.title,
          contextSentence: w.context,
          state: 'new',
          due: dueAt,
        },
      });
      report.bump('StudentWord.created');
      continue;
    }
    // 已经有了。**只把到期时间拉回今天**，其余（FSRS 状态、复习历史、
    // 学生自己加的语境）一个字不动。
    if (existing.due.getTime() !== dueAt.getTime()) {
      await tx.studentWord.update({ where: { id: existing.id }, data: { due: dueAt } });
      report.bump('StudentWord.rescheduled');
    } else {
      report.bump('StudentWord.unchanged');
    }
  }

  // ② 往日的试点词让路 —— 只动这个脚本自己造的、且学生从没复习过的。
  const parked = await tx.studentWord.findMany({
    where: {
      studentId: student.id,
      id: { startsWith: `${PREFIX}w_` },
      headword: { notIn: [...todayHeads] },
      due: { lte: sgtInstant(dayIso, '23:59:59') },
      reviews: { none: {} },
    },
    select: { id: true },
  });
  for (const p of parked) {
    await tx.studentWord.update({
      where: { id: p.id },
      data: { due: sgtInstant(PARK_UNTIL, '00:05:00') },
    });
    report.bump('StudentWord.parked');
  }
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

// ─────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────

function makeReport() {
  const counts = {};
  const notes = [];
  return {
    bump: (k) => { counts[k] = (counts[k] ?? 0) + 1; },
    note: (s) => notes.push(s),
    counts,
    notes,
  };
}

async function main() {
  assertEnvGates();
  const day = parseDay(process.argv.slice(2));

  process.env.DATABASE_URL = ENV_AT_STARTUP.DATABASE_PUBLIC_URL;
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });

  let out;
  try {
    out = await prisma.$transaction(
      async (tx) => {
        // ① 只读前置
        const before = await snapshot(tx);
        await assertScopeFree(tx, day);

        // ② 写
        const report = makeReport();
        await upsertClassAndQa(tx, report);
        await upsertDictionary(tx, report);
        for (const level of Object.keys(content.LEVELS)) {
          await upsertLesson(tx, level, day, report);
        }

        // ③ 给试点班在册的每一个学生排今天的词
        const roster = await tx.classEnrollment.findMany({
          where: { classId: { in: ALL_CLASSES.map((klass) => klass.id) }, role: 'student' },
          select: { user: { select: { id: true, name: true, englishLevel: true } } },
        });
        for (const r of roster) await scheduleWordsFor(tx, r.user, day, report);

        // ④ 只读后置
        const after = await snapshot(tx);
        return { before, after, report, roster: roster.map((r) => r.user) };
      },
      { maxWait: 30_000, timeout: 300_000 },
    );
  } finally {
    await prisma.$disconnect();
  }

  const { before, after, report, roster } = out;
  const changed = Object.keys(after).filter((k) => String(before[k]) !== String(after[k]));
  const line = (k) => `    ${k.padEnd(22)} ${String(before[k]).padEnd(34)} → ${after[k]}`;

  console.log(
    [
      '',
      `试点第一周 · ${day} 已发布。`,
      `  班级        : ${REGISTRATION_CLASSES.map((klass) => klass.name).join(' · ')}（另保留内部冒烟班；每班五档齐全）`,
      `  在册学生    : ${roster.length}（${roster.map((r) => `${r.name}[${r.englishLevel ?? '未设置'}]`).join('、') || '无'}）`,
      '',
      '  写入统计（按类别）：',
      ...Object.entries(report.counts).sort().map(([k, v]) => `    ${k.padEnd(26)} ${v}`),
      ...(report.notes.length ? ['', '  备注：', ...report.notes.map((n) => `    · ${n}`)] : []),
      '',
      '  前 → 后（只列变了的）：',
      ...(changed.length ? changed.map(line) : ['    （没有任何计数发生变化 —— 这次是幂等重跑）']),
      '',
      '  不该动的：',
      `    答卷指纹    ${before.submissions_hash === after.submissions_hash ? '未变 ✓' : '**变了** ✗'}`,
      `    非试点生词  ${before.other_words_hash === after.other_words_hash ? '未变 ✓' : '**变了** ✗'}`,
      `    复习流水    ${before.reviews === after.reviews ? '未变 ✓' : '**变了** ✗'}`,
      `    错题 / 申诉 ${before.mistakes === after.mistakes && before.appeals === after.appeals ? '未变 ✓' : '**变了** ✗'}`,
      `    当日任务行  ${before.dlc === after.dlc ? '未变 ✓' : '**变了** ✗'}`,
      '',
    ].join('\n'),
  );

  // 硬断言：不该动的真的没动
  const violations = [];
  if (before.submissions_hash !== after.submissions_hash) violations.push('StudentSubmission');
  if (before.other_words_hash !== after.other_words_hash) violations.push('非试点 StudentWord');
  for (const k of ['submissions', 'scripts', 'attempts', 'reviews', 'mistakes', 'appeals', 'dlc', 's12f_words', 'fixture_words']) {
    if (before[k] !== after[k]) violations.push(k);
  }
  if (violations.length > 0) {
    throw new PilotError(`脚本动了不该动的东西：${violations.join(', ')}`);
  }
}

module.exports = {
  CONFIRMATION,
  PREFIX,
  EXPECTED_RAILWAY,
  REUSED,
  CLASS,
  REGISTRATION_CLASSES,
  ALL_CLASSES,
  QA_STUDENT,
  PARK_UNTIL,
  PilotError,
  writeScopes,
  neverTouched,
  dayLabel,
  sgtInstant,
  idsFor,
  deliveryIdsFor,
  studentWordId,
  assertPrefixed,
  assertEnvGates,
  parseDay,
  isOursToFix,
  dictDrift,
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
