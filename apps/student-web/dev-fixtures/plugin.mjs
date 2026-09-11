/**
 * 学生端的**开发期**假接口 —— 只为截图与走查（审计 IOS-12 / §8.2）。
 *
 * 用法（只在本机开发时）：
 *   STUDENT_FX=1 VITE_API_URL=/__fx npx vite --port 5273
 *   浏览器先开 /__fx/scenario?name=backlog&level=olevel 选场景，再开 /today。
 *
 * 边界：
 *   · vite.config 只在 `serve` 且 STUDENT_FX=1 时加载本插件；生产构建不包含它，
 *     `src/` 里没有任何代码引用它（契约测试照常扫 src）。
 *   · 数据全部是本仓库自己的内容（第三周原创文章、测试夹具），学生姓名是虚构的。
 *   · 场景可以注入失败：`fail=/vocab-v2/overview:500`、`offline=1`、`slow=1500`，用来截
 *     「局部失败」「断网」「慢网」这些状态。
 *
 * 状态只在内存里，重启即清空。
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const content = require(resolve(HERE, '../../api/scripts/pilot/content'));

const LEVEL_LABEL = {
  ielts_simplified: 'O-Level 基础',
  olevel_intermediate: 'O-Level 中级',
  olevel: 'O-Level 标准',
  ielts_light: '雅思轻量',
  ielts_authentic: '雅思 · 真题型',
};

// ── 场景 ─────────────────────────────────────────────────────
const DEFAULTS = {
  name: 'fresh',
  level: 'olevel',
  student: '林嘉怡',
  today: '2026-09-15',
  fail: '', // "/vocab-v2/overview:500,/lesson/today:503"
  offline: false,
  slow: 0,
  words: 64, // 生词本里有多少词
};
let S = { ...DEFAULTS };
let state = freshState();

function freshState() {
  return {
    reading: {}, // sessionId -> { answers: {pqId: {selectedOption,textAnswer,clientSeq}}, submitted, submittedAt }
    daily: {}, // date -> session
    tests: {}, // testId -> test session
    notebookRemoved: new Set(),
    pushSubs: new Set(),
  };
}

// ── 小工具 ───────────────────────────────────────────────────
const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((ok) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        ok(data ? JSON.parse(data) : {});
      } catch {
        ok({});
      }
    });
  });
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const teachingDaysBefore = (iso, n) => {
  const out = [];
  let d = iso;
  while (out.length < n) {
    d = addDays(d, -1);
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d);
  }
  return out;
};
const lessonFor = (date) => content.lessonFor(S.level, date) ?? content.lessonFor(S.level, content.DATES[content.DATES.length - 1]);
const sessionIdFor = (date) => `fx_ses_${S.level}_${date.replace(/-/g, '')}`;
const submissionIdFor = (date) => `fx_sub_${S.level}_${date.replace(/-/g, '')}`;
const dateOfSession = (sid) => {
  const m = /_(\d{4})(\d{2})(\d{2})$/.exec(sid);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : S.today;
};

function paperQuestions(date) {
  const l = lessonFor(date);
  return l.questions.map((q, i) => ({
    id: `fx_pq_${date.replace(/-/g, '')}_${i + 1}`,
    sortOrder: i + 1,
    marks: q.marks,
    questionType: q.questionType,
    snapshotContent: { taskType: q.taskType, passageTitle: l.title, passage: l.passage, stem: q.stem },
    snapshotOptions: q.options ? q.options.map((o) => ({ key: o.key, text: o.text })) : null,
    _answer: q.answer,
    _rubric: q.rubric,
    _evidence: q.evidence,
    _explanation: q.explanation,
  }));
}
const strip = (pq) => {
  const { _answer, _rubric, _evidence, _explanation, ...rest } = pq;
  return rest;
};

function card(w, i) {
  return {
    headword: w.headword,
    phonetic: w.phonetic ?? null,
    pos: (w.pos ?? '').replace(/\.$/, '') || 'n',
    senseKey: `${w.headword}#1`,
    translation: (w.translation ?? '').replace(/^[a-z]+\.\s*/i, ''),
    definition: w.definition ?? '',
    sentence: w.context ?? null,
    sentenceTranslation: w.contextTranslation ?? null,
    collocations: [],
    wordFamily: [],
    confusionWords: [],
    memoryHint: null,
    imageUrl: null,
    audioText: w.headword,
    list: 'NGSL',
    rank: 800 + i * 7,
    attribution: 'NGSL 1.2 (CC BY-SA 4.0)',
  };
}

function wordsFor(date, n = 10) {
  const all = content.DATES.flatMap((d) => (content.lessonFor(S.level, d)?.words ?? []));
  const seed = content.DATES.indexOf(date) >= 0 ? content.DATES.indexOf(date) : 3;
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(all[(seed * 10 + i) % all.length]);
  return out;
}

// ── 每日新词 ─────────────────────────────────────────────────
function dailySession(date, { completed = 0, status } = {}) {
  if (state.daily[date]) return state.daily[date];
  const ws = wordsFor(date);
  const items = ws.map((w, i) => ({
    id: `fx_it_${date}_${i}`,
    position: i,
    source: 'daily_pushed',
    masteryBefore: 0,
    status: i < completed ? 'completed' : 'pending',
    action: i < completed ? 'normal' : null,
    senseId: `fx_sense_${w.headword}`,
    card: card(w, i),
  }));
  const s = {
    id: `fx_daily_${date}`,
    version: 'v2',
    date,
    type: 'daily_learning',
    mode: 'learn',
    status: status ?? (completed >= ws.length ? 'completed' : completed > 0 ? 'in_progress' : 'not_started'),
    target: ws.length,
    cursor: completed,
    completed,
    learned: completed,
    deferred: 0,
    replaced: 0,
    pending: ws.length - completed,
    processed: completed,
    learningPhase: completed >= ws.length ? 'finished' : completed > 0 ? 'in_progress' : 'not_started',
    testNeeded: completed > 0,
    sourceSummary: { daily_pushed: ws.length },
    settings: {},
    deferredUntil: null,
    items,
  };
  state.daily[date] = s;
  return s;
}

function recount(s) {
  s.completed = s.items.filter((it) => it.status !== 'pending').length;
  s.learned = s.items.filter((it) => it.status === 'completed' && it.action !== 'skip').length;
  s.deferred = s.items.filter((it) => it.status === 'skipped').length;
  s.pending = s.items.filter((it) => it.status === 'pending').length;
  s.processed = s.completed;
  s.cursor = Math.min(s.completed, s.items.length - 1);
  s.status = s.completed >= s.items.length ? 'completed' : s.completed > 0 ? 'in_progress' : 'not_started';
  s.learningPhase = s.status === 'completed' ? 'finished' : s.status;
  s.testNeeded = s.learned > 0;
}

// ── 正式词测 ─────────────────────────────────────────────────
function testFor(daily, { answered = 0, submitted = false } = {}) {
  const id = `fx_test_${daily.date}`;
  if (state.tests[id]) return state.tests[id];
  const learned = daily.items.filter((it) => it.status === 'completed' && it.action !== 'skip');
  const review = wordsFor(addDays(daily.date, -7), 3).map((w, i) => card(w, 50 + i));
  const cards = [...learned.map((it) => it.card), ...review];
  const items = cards.map((c, i) => {
    const kind = i % 3;
    const others = cards.filter((x) => x.headword !== c.headword).slice(0, 3);
    const question =
      kind === 0
        ? { type: 'meaning_choice', prompt: `“${c.headword}” 的意思是：`, cue: null, options: shuffle([c.translation, ...others.map((o) => o.translation)], i) }
        : kind === 1
          ? { type: 'word_choice', prompt: '哪个词是这个意思？', cue: { pos: c.pos, translation: c.translation }, options: shuffle([c.headword, ...others.map((o) => o.headword)], i) }
          : { type: 'spelling', prompt: '写出这个词', cue: { pos: c.pos, translation: c.translation, audioText: '' }, options: [] };
    const isAnswered = i < answered;
    return {
      id: `fx_ti_${daily.date}_${i}`,
      position: i,
      status: isAnswered ? 'answered' : 'pending',
      question,
      response: isAnswered ? { value: kind === 2 ? c.headword : 0 } : null,
      isCorrect: isAnswered ? i % 5 !== 3 : null,
      card: isAnswered || submitted ? c : null,
      _answer: kind === 2 ? c.headword : question.options.indexOf(kind === 0 ? c.translation : c.headword),
      _review: i >= learned.length,
    };
  });
  const t = {
    id,
    version: 'v2',
    date: daily.date,
    type: 'formal_test',
    status: submitted ? 'completed' : answered > 0 ? 'in_progress' : 'not_started',
    total: items.length,
    answered,
    correct: submitted ? items.filter((it) => it.isCorrect).length : null,
    newCount: learned.length,
    reviewCount: review.length,
    newWords: learned.length,
    reviewWords: review.length,
    retry: null,
    items,
  };
  state.tests[id] = t;
  return t;
}
function shuffle(arr, seed) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = (seed * 31 + i * 17) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const publicTest = (t) => ({
  ...t,
  items: t.items.map(({ _answer, _review, ...it }) => it),
});

// ── 场景化的「今天」 ─────────────────────────────────────────
//
// 场景（/__fx/scenario?name=…）：
//   fresh        新的一天，什么都没开始
//   midday       阅读做了一半、新词学了 4 个、昨天的测试没做（卷子还没生成）
//   backlog      今天没开始，前几天欠阅读 / 新词 / 测试
//   test_pending 阅读已交卷待批 + 新词学完 + 正式测试还没做（UI14：不是全部完成）
//   no_reading   教学日但阅读没发布，新词照常可学可测（UI13）
//   all_deferred 新词全部延后：学词完成、测试「不需要」
//   done         三项都做完（阅读待老师批）
//   weekend      周末：三项都不适用
function scenario() {
  const today = S.today;
  const past = teachingDaysBefore(today, 6);
  const sc = S.name;
  const weekend = sc === 'weekend';
  const noReading = sc === 'no_reading';
  const reading = { status: 'todo', submitted: false, pending: false };
  let daily = state.daily[today] ?? null;
  let pendingTests = [];
  let readingBacklog = [];
  let learningBacklog = [];
  const notGenerated = (s) => ({ dailySessionId: s.id, testSessionId: null, date: s.date, generated: false, total: null, newWords: null, reviewWords: null, answered: 0, expectedNewWords: s.learned, reviewWordsMax: 3, status: 'not_started' });

  if (sc === 'midday') {
    reading.status = 'partial';
    daily = dailySession(today, { completed: 4 });
    const y = dailySession(past[0], { completed: 10, status: 'completed' });
    pendingTests = [notGenerated(y)];
  } else if (sc === 'backlog') {
    daily = dailySession(today, { completed: 0 });
    readingBacklog = past.slice(0, 5).map((d, i) => ({
      assignmentId: `fx_as_${d}`,
      sessionId: sessionIdFor(d),
      submissionId: i === 1 ? submissionIdFor(d) : null,
      date: d,
      title: lessonFor(d).title,
      status: i === 1 ? 'in_progress' : 'not_started',
      level: S.level,
      levelBasis: i === 1 ? 'submission' : 'level_log',
    }));
    learningBacklog = past.slice(0, 3).map((d, i) => {
      const s = dailySession(d, { completed: i === 0 ? 6 : 0 });
      return { sessionId: s.id, date: d, completed: s.completed, learned: s.learned, deferred: s.deferred, pending: s.pending, target: s.target, status: s.completed ? 'in_progress' : 'not_started' };
    });
    pendingTests = past.slice(3, 6).map((d, i) => {
      const s = dailySession(d, { completed: 10, status: 'completed' });
      if (i !== 0) return notGenerated(s);
      const t = testFor(s, { answered: 3 });
      return { dailySessionId: s.id, testSessionId: t.id, date: d, generated: true, total: t.total, newWords: t.newCount, reviewWords: t.reviewCount, answered: t.answered, status: 'in_progress' };
    });
  } else if (sc === 'test_pending') {
    reading.status = 'done';
    reading.submitted = true;
    reading.pending = true;
    daily = dailySession(today, { completed: 10, status: 'completed' });
    testFor(daily);
  } else if (sc === 'no_reading') {
    // 阅读没发布；新词不受影响
  } else if (sc === 'all_deferred') {
    reading.status = 'done';
    reading.submitted = true;
    daily = dailySession(today, { completed: 0 });
    for (const it of daily.items) {
      if (it.status === 'pending') {
        it.status = 'skipped';
        it.action = 'skip';
      }
    }
    recount(daily);
  } else if (sc === 'done') {
    reading.status = 'done';
    reading.submitted = true;
    reading.pending = true;
    daily = dailySession(today, { completed: 10, status: 'completed' });
    const t = testFor(daily, { answered: 13, submitted: true });
    t.status = 'completed';
  }
  // 今天的正式测试：学完就生成（与服务端「学完最后一张卡时自动生成」一致）；没交卷就挂在待测里
  if (daily && daily.status === 'completed' && daily.learned > 0 && daily.date === today) {
    const t = state.tests[`fx_test_${today}`] ?? testFor(daily);
    if (t.status !== 'completed') {
      pendingTests = [...pendingTests, { dailySessionId: daily.id, testSessionId: t.id, date: today, generated: true, total: t.total, newWords: t.newCount, reviewWords: t.reviewCount, answered: t.answered, status: t.answered > 0 ? 'in_progress' : 'not_started' }];
    }
  }
  return { today, past, weekend, noReading, reading, daily, pendingTests, readingBacklog, learningBacklog };
}

function lessonToday() {
  const sc = scenario();
  const l = lessonFor(sc.today);
  const sid = sessionIdFor(sc.today);
  const r = state.reading[sid];
  const readStatus = sc.weekend || sc.noReading ? 'none' : r?.submitted ? 'done' : r ? 'partial' : sc.reading.status;
  const submitted = r?.submitted || sc.reading.submitted;
  const nextKind = sc.weekend || sc.noReading
    ? 'no_content'
    : readStatus === 'todo'
      ? 'ready_to_start'
      : readStatus === 'partial'
        ? 'resume_reading'
        : sc.daily?.status === 'completed'
          ? 'summary'
          : 'learn_vocab';
  const labels = {
    ready_to_start: '开始今天的课程',
    resume_reading: '继续阅读',
    learn_vocab: '学习今天的新词',
    summary: '查看今日总结',
    no_content: '今天的课程还没有发布',
  };
  return {
    student: { id: 'fx_student', name: S.student },
    date: sc.today,
    nextAction: { kind: nextKind, label: labels[nextKind], href: null },
    rulesVersion: 3,
    completed: (readStatus === 'done' ? 1 : 0) + (sc.daily?.status === 'completed' ? 1 : 0),
    total: sc.weekend ? 0 : 2,
    allDone: false,
    streakDays: sc.name === 'fresh' ? 0 : 6,
    targetsFrozenAt: null,
    stage: readStatus === 'todo' ? 'not_started' : 'reading',
    stageAt: null,
    vocabCursor: 0,
    pendingVocabTest: null,
    segments: [
      {
        key: 'read',
        status: readStatus,
        label: readStatus === 'none' ? null : l.title,
        questionCount: readStatus === 'none' ? null : l.questions.length,
        typicalMinutes: 20,
        score: null,
        maxScore: l.questions.reduce((a, q) => a + q.marks, 0),
        scoresPending: Boolean(submitted),
        releasedScore: submitted ? { earned: 5, max: 6, count: 6 } : null,
        submissionId: submitted || r ? submissionIdFor(sc.today) : null,
        sessionId: readStatus === 'none' ? null : sid,
        autoClosed: false,
      },
      {
        key: 'vocab',
        status: sc.daily?.status === 'completed' ? 'done' : sc.daily?.completed ? 'partial' : 'todo',
        progress: sc.daily?.completed ?? 0,
        target: 10,
        typicalMinutes: 5,
        quizScore: { status: 'not_started' },
      },
      { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 0, available: false, unavailableReason: '错题本暂未开放 · 不计入今日完成' },
    ],
  };
}

/** 今天三项任务的状态 —— 与 vocabulary-v2.service overview 的 home 同一口径。 */
function homeFor(sc) {
  const d = sc.weekend ? null : state.daily[sc.today] ?? sc.daily;
  let reading;
  if (sc.weekend) reading = { state: 'not_applicable', reason: 'weekend' };
  else if (sc.noReading) reading = { state: 'not_generated', reason: 'no_session_published' };
  else {
    const sid = sessionIdFor(sc.today);
    const r = state.reading[sid];
    const submitted = r?.submitted || sc.reading.submitted;
    const st = submitted ? 'awaiting_marking' : r || sc.reading.status === 'partial' ? 'in_progress' : 'pending';
    reading = { state: st, assignmentId: `fx_as_${sc.today}`, sessionId: sid, submissionId: submitted || r ? submissionIdFor(sc.today) : null, title: lessonFor(sc.today).title, level: S.level };
  }
  let words;
  if (sc.weekend) words = { state: 'not_applicable', reason: 'weekend' };
  else if (!d) words = { state: 'not_generated', generation: { condition: '教学日（周一到周五，新加坡时间）', trigger: '学生点开学词' } };
  else words = { state: d.pending === 0 ? 'completed' : d.processed === 0 ? 'pending' : 'in_progress', sessionId: d.id, target: d.target, learned: d.learned, deferred: d.deferred, replaced: d.replaced ?? 0, pending: d.pending };
  let test;
  if (sc.weekend) test = { state: 'not_applicable', reason: 'weekend' };
  else if (!d) test = { state: 'not_generated', reason: 'no_word_task_yet' };
  else if (d.status !== 'completed') test = { state: 'not_generated', reason: 'learning_unfinished', generation: { trigger: '学完当天最后一张卡时自动生成' } };
  else if (d.learned === 0) test = { state: 'not_applicable', reason: 'nothing_learned' };
  else {
    const t = state.tests[`fx_test_${d.date}`];
    test = t
      ? { state: t.status === 'completed' ? 'completed' : t.answered > 0 ? 'in_progress' : 'pending', dailySessionId: d.id, testSessionId: t.id, total: t.total, newWords: t.newCount, reviewWords: t.reviewCount, answered: t.answered }
      : { state: 'not_generated', reason: 'ready_to_generate', dailySessionId: d.id, expectedNewWords: d.learned, reviewWordsMax: 3 };
  }
  const done = (x) => ['completed', 'awaiting_marking', 'auto_closed', 'not_applicable'].includes(x);
  return {
    date: sc.today,
    teachingDay: !sc.weekend,
    reading,
    words,
    test,
    allDone: (done(reading.state) || reading.state === 'not_generated') && done(words.state) && done(test.state),
  };
}

function overview() {
  const sc = scenario();
  const byDate = new Map();
  const bump = (date, k) => {
    if (!byDate.has(date)) byDate.set(date, { date, reading: 0, words: 0, test: 0 });
    byDate.get(date)[k] += 1;
  };
  for (const r of sc.readingBacklog) bump(r.date, 'reading');
  for (const w of sc.learningBacklog) bump(w.date, 'words');
  for (const t of sc.pendingTests) if (t.date < sc.today) bump(t.date, 'test');
  return {
    dailyTarget: 10,
    today: sc.weekend ? null : state.daily[sc.today] ?? sc.daily,
    readingBacklog: sc.readingBacklog,
    learningBacklog: sc.learningBacklog,
    pendingTests: sc.pendingTests,
    home: homeFor(sc),
    backlogByDate: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    backlogTotals: {
      reading: sc.readingBacklog.length,
      words: sc.learningBacklog.length,
      test: sc.pendingTests.filter((t) => t.date < sc.today).length,
    },
  };
}

// ── 阅读 ─────────────────────────────────────────────────────
function readingSession(sid) {
  const date = dateOfSession(sid);
  const r = state.reading[sid] ?? (state.reading[sid] = { answers: {}, submitted: false });
  return {
    sessionId: sid,
    submissionId: submissionIdFor(date),
    quizEnd: null,
    regularQuizEnd: null,
    secondWindowToday: false,
    level: S.level,
    paperMode: 'passage_pick',
    mode: 'test',
    rendererKey: 'ielts_reading',
    paperQuestions: paperQuestions(date).map(strip),
    existingAnswers: Object.fromEntries(
      Object.entries(r.answers).map(([k, v]) => [k, { selectedOption: v.selectedOption ?? null, textAnswer: v.textAnswer ?? null, clientSeq: v.clientSeq ?? null, flagged: false }]),
    ),
    submissionStatus: r.submitted ? 'submitted' : 'in_progress',
    finalSubmitted: r.submitted,
  };
}

function readingResult(sid, { released = false } = {}) {
  const date = dateOfSession(sid);
  const r = state.reading[sid] ?? { answers: {}, submitted: true };
  const pqs = paperQuestions(date);
  const items = pqs.map((pq) => {
    const a = r.answers[pq.id];
    const studentAnswer = a?.selectedOption ?? a?.textAnswer ?? (pq.sortOrder % 4 === 0 ? null : pq.snapshotOptions ? pq._answer : 'The narrator felt responsible for the costume.');
    const objective = pq.questionType === 'mcq';
    const correct = objective ? studentAnswer === pq._answer : null;
    return {
      paperQuestionId: pq.id,
      sortOrder: pq.sortOrder,
      marks: pq.marks,
      questionType: pq.questionType,
      snapshotContent: pq.snapshotContent,
      snapshotOptions: pq.snapshotOptions,
      studentAnswer,
      correctAnswer: objective ? pq._answer : null,
      referenceAnswer: objective ? null : String(pq._answer ?? ''),
      explanation: pq._explanation ?? null,
      evidence: pq._evidence ?? null,
      awardedMarks: objective ? (correct ? pq.marks : 0) : released ? Math.min(pq.marks, 1) : null,
      autoCorrect: objective ? correct : null,
      isCorrect: objective ? correct : released ? true : null,
      markerComment: !objective && released ? '要点答到一个，第二点没有写出原因。' : null,
      commentSource: !objective && released ? 'teacher' : null,
      gradingStatus: studentAnswer == null ? 'not_answered' : objective ? 'auto_graded' : released ? 'marked' : 'pending_marking',
      answerDisplay: objective
        ? { primaryKind: 'correct', primaryValue: pq._answer }
        : { primaryKind: 'reference', primaryValue: String(pq._answer ?? '') },
    };
  });
  const max = pqs.reduce((a, q) => a + q.marks, 0);
  const auto = items.filter((it) => it.gradingStatus === 'auto_graded');
  const earned = auto.reduce((a, it) => a + (it.awardedMarks ?? 0), 0);
  return {
    sessionId: sid,
    paperName: lessonFor(date).title,
    submissionId: submissionIdFor(date),
    status: released ? 'marked' : 'submitted',
    finalSubmittedAt: `${date}T08:40:00.000Z`,
    autoScore: earned,
    manualScore: released ? 3 : null,
    totalScore: released ? earned + 3 : null,
    maxScore: max,
    submittedAt: `${date}T08:40:00.000Z`,
    items,
    scoresPending: !released,
    answersPending: false,
    gradingSummary: {
      autoGraded: auto.length,
      marked: released ? items.filter((it) => it.gradingStatus === 'marked').length : 0,
      pendingMarking: items.filter((it) => it.gradingStatus === 'pending_marking').length,
      notAnswered: items.filter((it) => it.gradingStatus === 'not_answered').length,
      total: items.length,
    },
    releasedScore: { earned, max: auto.reduce((a, it) => a + it.marks, 0), count: auto.length },
  };
}

function readingHistory() {
  const past = teachingDaysBefore(S.today, 8);
  return {
    submissions: past.map((d, i) => {
      const l = lessonFor(d);
      const max = l.questions.reduce((a, q) => a + q.marks, 0);
      const released = i > 1;
      return {
        submissionId: submissionIdFor(d),
        answersPending: false,
        reopenable: false,
        sessionId: sessionIdFor(d),
        date: `${d}T00:00:00.000Z`,
        level: S.level,
        paperName: l.title,
        className: 'IAL27W',
        autoScore: 6,
        totalScore: released ? 9 + (i % 3) : null,
        maxScore: max,
        submittedAt: `${d}T09:12:00.000Z`,
        status: released ? 'marked' : 'submitted',
        scoresPending: !released,
        releasedScore: { earned: 6, max: 7, count: 6 },
      };
    }),
  };
}

// ── 我的单词 ─────────────────────────────────────────────────
function center(q) {
  const all = content.DATES.flatMap((d) => (content.lessonFor(S.level, d)?.words ?? []).map((w) => ({ w, d })));
  const pool = [];
  for (let i = 0; pool.length < S.words && i < all.length * 3; i += 1) {
    const { w, d } = all[i % all.length];
    const id = `fx_ss_${i}`;
    pool.push({
      studentSenseId: id,
      senseId: `fx_sense_${w.headword}_${i}`,
      headword: i >= all.length ? `${w.headword}${Math.floor(i / all.length) + 1}` : w.headword,
      phonetic: w.phonetic ?? null,
      pos: (w.pos ?? 'n.').replace(/\.$/, ''),
      translation: (w.translation ?? '').replace(/^[a-z]+\.\s*/i, ''),
      definition: w.definition ?? '',
      masteryStage: i % 9,
      due: `${d}T00:00:00.000Z`,
      source: ['level_gap', 'reading_lookup', 'search', 'teacher_list'][i % 4],
      sources: i % 7 === 0 ? ['level_gap', 'reading_lookup'] : [['level_gap', 'reading_lookup', 'search', 'teacher_list'][i % 4]],
      sourceTitle: i % 4 === 1 ? content.lessonFor(S.level, d)?.title ?? null : null,
      firstSeenAt: `${d}T08:00:00.000Z`,
      inNotebook: !state.notebookRemoved.has(id),
      skills: { recognition: 0.6, spelling: 0.4 },
      context: w.context ? { sentence: w.context, translation: w.contextTranslation ?? '' } : null,
    });
  }
  const qq = (q.get('q') ?? '').trim().toLowerCase();
  const source = q.get('source') ?? '';
  const stage = q.get('stage') ?? '';
  let items = pool.filter((it) => it.inNotebook);
  if (stage === 'removed') items = pool.filter((it) => !it.inNotebook);
  if (qq) items = items.filter((it) => it.headword.toLowerCase().includes(qq) || it.translation.includes(qq));
  if (source) items = items.filter((it) => it.sources.includes(source));
  const pageSize = 30;
  // UI03：游标分页（游标 = 下一批从第几个开始）
  const from = Math.max(0, Number(q.get('cursor') ?? 0) || 0);
  const page = Math.floor(from / pageSize) + 1;
  const next = from + pageSize < items.length ? String(from + pageSize) : null;
  return {
    stats: {
      total: pool.filter((it) => it.inNotebook).length,
      totalLearned: pool.length,
      removed: pool.filter((it) => !it.inNotebook).length,
      new: pool.filter((it) => it.inNotebook && it.masteryStage <= 1).length,
      learning: pool.filter((it) => it.inNotebook && it.masteryStage >= 2 && it.masteryStage < 8).length,
      mastered: pool.filter((it) => it.inNotebook && it.masteryStage === 8).length,
    },
    growth: [],
    filters: { sources: ['level_gap', 'teacher_list', 'reading_lookup', 'reading_error', 'search'], stages: ['new', 'learning', 'mastered', 'removed'], articles: [], topics: [], lists: [] },
    total: items.length,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(items.length / pageSize)),
    requestedPage: page,
    clamped: false,
    hasMore: next !== null,
    nextCursor: next,
    items: items.slice(from, from + pageSize),
  };
}

// ── 路由 ─────────────────────────────────────────────────────
async function handle(req, res, url) {
  const path = url.pathname.replace(/^\/__fx\/api/, '');
  const m = req.method;
  const body = m === 'GET' ? {} : await readBody(req);

  // 注入的失败
  for (const rule of S.fail.split(',').filter(Boolean)) {
    const [p, code] = rule.split(':');
    if (path.startsWith(p)) return json(res, Number(code || 500), { code: 'fx_injected', message: 'injected failure' });
  }
  if (S.offline) {
    res.socket?.destroy();
    return;
  }

  if (path === '/student-auth/me') {
    return json(res, 200, { id: 'fx_student', name: S.student, nickname: '', avatar: null, pinSet: true, englishLevel: S.level, appVersion: 'v2' });
  }
  if (path === '/student-auth/login' || path === '/student-auth/self-register') {
    return json(res, 200, { token: 'fx-token', student: { id: 'fx_student', name: body.name || S.student, nickname: '', avatar: null }, englishLevel: S.level, appVersion: 'v2' });
  }
  if (path === '/student-auth/registration-classes') {
    return json(res, 200, { classes: ['SGCE26W', 'SEC27W', 'OL26W', 'IAL27W', 'IAL27M', 'IAL26W', 'IAL26S2', 'IAL26S1', 'IAL28S'].map((n) => ({ id: `fx_c_${n}`, name: n })) });
  }
  if (path === '/student-auth/change-pin') return json(res, 200, { ok: true, token: 'fx-token' });
  if (path === '/student-auth/me/english-level') {
    S.level = body.englishLevel ?? S.level;
    return json(res, 200, { englishLevel: S.level, effective: 'next_unstarted_task' });
  }
  if (path === '/push/config') return json(res, 200, { enabled: true, publicKey: 'BFx-demo-public-key', reminderTime: '16:30' });
  if (path === '/push/subscribe' || path === '/push/unsubscribe') return json(res, 200, { ok: true });
  if (path === '/writing-check/status') return json(res, 200, { enabled: true });
  if (path === '/writing-check') return json(res, 200, { issues: [] });

  if (path === '/lesson/today') return json(res, 200, lessonToday());
  if (path === '/lesson/start') {
    const sid = sessionIdFor(S.today);
    state.reading[sid] = state.reading[sid] ?? { answers: {}, submitted: false };
    return json(res, 200, lessonToday());
  }

  let mm;
  if ((mm = /^\/morning-quiz\/sessions\/([^/]+)\/open$/.exec(path))) {
    const sid = decodeURIComponent(mm[1]);
    state.reading[sid] = state.reading[sid] ?? { answers: {}, submitted: false };
    return json(res, 200, { id: submissionIdFor(dateOfSession(sid)), status: 'in_progress' });
  }
  if ((mm = /^\/morning-quiz\/sessions\/([^/]+)\/answer$/.exec(path))) {
    const sid = decodeURIComponent(mm[1]);
    const r = state.reading[sid] ?? (state.reading[sid] = { answers: {}, submitted: false });
    r.answers[body.paperQuestionId] = { selectedOption: body.selectedOption, textAnswer: body.textAnswer, clientSeq: body.clientSeq };
    return json(res, 200, { applied: true, clientSeq: body.clientSeq, updatedAt: new Date().toISOString() });
  }
  if ((mm = /^\/morning-quiz\/sessions\/([^/]+)\/submit$/.exec(path))) {
    const sid = decodeURIComponent(mm[1]);
    const r = state.reading[sid] ?? (state.reading[sid] = { answers: {}, submitted: false });
    r.submitted = true;
    return json(res, 200, { id: submissionIdFor(dateOfSession(sid)), status: 'submitted' });
  }
  if ((mm = /^\/morning-quiz\/sessions\/([^/]+)$/.exec(path))) return json(res, 200, readingSession(decodeURIComponent(mm[1])));
  if ((mm = /^\/morning-quiz\/student-result\/([^/]+)$/.exec(path))) return json(res, 200, readingResult(decodeURIComponent(mm[1])));
  if (path === '/morning-quiz/history-by-name') return json(res, 200, readingHistory());
  if (path === '/morning-quiz/history-detail') {
    const sub = url.searchParams.get('submissionId') ?? '';
    const date = /_(\d{8})$/.exec(sub)?.[1];
    const iso = date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}` : S.today;
    return json(res, 200, readingResult(sessionIdFor(iso), { released: true }));
  }
  if (path === '/morning-quiz/appeals') return json(res, 200, { appealId: 'fx_ap_1', status: 'open' });

  if (path === '/vocab-v2/overview') return json(res, 200, overview());
  if (path === '/vocab-v2/profile') return json(res, 200, { dailyTarget: 10, taskMinutes: 5, audioAccent: 'en-GB', allowedDailyTargets: [5, 10, 15, 20] });
  // 直接打开学词页（没先经过首页）时，也要先把场景里的今天物化出来
  if (path.startsWith('/vocab-v2/daily') || path.startsWith('/vocab-v2/test')) scenario();
  if (path === '/vocab-v2/daily') {
    const date = url.searchParams.get('date') ?? S.today;
    return json(res, 200, state.daily[date] ?? null);
  }
  if (path === '/vocab-v2/daily/start') {
    const date = body.date ?? S.today;
    return json(res, 200, dailySession(date));
  }
  if (path === '/vocab-v2/daily/item') {
    const s = Object.values(state.daily).find((x) => x.id === body.sessionId);
    if (!s) return json(res, 404, { code: 'not_found' });
    const it = s.items.find((x) => x.id === body.itemId);
    if (it && it.status === 'pending') {
      it.status = body.action === 'skip' ? 'skipped' : 'completed';
      it.action = body.action;
    }
    recount(s);
    if (s.status === 'completed' && s.learned > 0) {
      const t = testFor(s);
      return json(res, 200, { ...s, generatedTestId: t.id, generatedTest: { total: t.total, newWords: t.newCount, reviewWords: t.reviewCount } });
    }
    return json(res, 200, s);
  }
  if (path === '/vocab-v2/daily/replace') {
    const s = Object.values(state.daily).find((x) => x.id === body.sessionId);
    const it = s?.items.find((x) => x.id === body.itemId);
    if (!s || !it) return json(res, 404, { code: 'not_found' });
    const old = it.card.headword;
    const next = wordsFor(addDays(s.date, 30), 1)[0];
    it.card = card(next, it.position + 90);
    return json(res, 200, { ...s, replacement: { position: it.position, oldHeadword: old, newHeadword: it.card.headword } });
  }
  if (path === '/vocab-v2/test/start') {
    const daily = Object.values(state.daily).find((x) => x.id === body.dailySessionId);
    if (!daily) return json(res, 404, { code: 'not_found' });
    return json(res, 200, publicTest(testFor(daily)));
  }
  if (path === '/vocab-v2/test') {
    const t = state.tests[url.searchParams.get('sessionId') ?? ''];
    if (!t) {
      const date = (url.searchParams.get('sessionId') ?? '').replace('fx_test_', '');
      const daily = dailySession(date, { completed: 10, status: 'completed' });
      return json(res, 200, publicTest(testFor(daily, { answered: 4 })));
    }
    return json(res, 200, publicTest(t));
  }
  if (path === '/vocab-v2/test/answer') {
    const t = state.tests[body.sessionId];
    const it = t?.items.find((x) => x.id === body.itemId);
    if (!t || !it) return json(res, 404, { code: 'not_found' });
    if (it.status === 'pending') {
      it.status = 'answered';
      it.response = { value: body.response };
      it.isCorrect = typeof it._answer === 'string' ? String(body.response).trim().toLowerCase() === it._answer.toLowerCase() : body.response === it._answer;
      it.card = t.items[it.position] ? it.card ?? null : null;
      t.answered = t.items.filter((x) => x.status === 'answered').length;
      t.status = 'in_progress';
    }
    return json(res, 200, publicTest(t));
  }
  if (path === '/vocab-v2/test/submit') {
    const t = state.tests[body.sessionId];
    if (!t) return json(res, 404, { code: 'not_found' });
    t.status = 'completed';
    t.correct = t.items.filter((x) => x.isCorrect).length;
    return json(res, 200, publicTest(t));
  }
  if (path === '/vocab-v2/custom-test/start') {
    const daily = dailySession(addDays(S.today, -20), { completed: 10, status: 'completed' });
    const t = testFor(daily);
    t.type = 'custom_test';
    return json(res, 200, publicTest(t));
  }
  if (path === '/vocab-v2/center') return json(res, 200, center(url.searchParams));
  if (path === '/vocab-v2/tests') {
    const done = Object.values(state.tests).filter((t) => t.type === 'formal_test' && t.status === 'completed')
      .map((t) => ({ sessionId: t.id, date: t.date, total: t.total, correct: t.correct ?? 0, completedAt: `${t.date}T10:00:00.000Z` }));
    return json(res, 200, {
      tests: [...done, ...teachingDaysBefore(S.today, 6).map((d, i) => ({ sessionId: `fx_test_${d}`, date: d, total: 10 + (i % 4), correct: 8 + (i % 3), completedAt: `${d}T10:00:00.000Z` }))],
    });
  }
  if (path === '/vocab-v2/collect') {
    return json(res, 200, { ok: true, action: body.action ?? 'add', added: body.action === 'add', sense: { id: 'fx_sense_x', headword: body.headword ?? 'word', senseKey: 'x#1', pos: 'n', phonetic: null, translation: '示例', definition: '' } });
  }
  if (path === '/vocab-v2/custom-test/cancel') return json(res, 200, { ok: true, cancelled: true });
  if (path === '/vocab-v2/test/audio') return json(res, 404, { code: 'v2_audio_not_available' });
  if (path === '/vocab-v2/daily/review') {
    const date = url.searchParams.get('date') ?? S.today;
    const d = state.daily[date];
    if (!d) return json(res, 200, null);
    const t = state.tests[`fx_test_${date}`];
    return json(res, 200, {
      readOnly: true, date, sessionId: d.id, status: d.status, mode: d.mode, learningPhase: d.learningPhase,
      target: d.target, learned: d.learned, deferred: d.deferred, replaced: d.replaced ?? 0, pending: d.pending,
      recite: d.items.filter((it) => it.status === 'completed').map((it) => ({ id: it.id, position: it.position, action: it.action, card: it.card })),
      deferredWords: d.items.filter((it) => it.status === 'skipped').map((it) => it.card.headword),
      pendingWords: d.items.filter((it) => it.status === 'pending').map((it) => it.card.headword),
      test: t ? { testSessionId: t.id, generated: true, status: t.status, total: t.total, newWords: t.newCount, reviewWords: t.reviewCount, answered: t.answered } : null,
    });
  }
  if (path === '/vocab-v2/daily/history') {
    return json(res, 200, { days: Object.values(state.daily).sort((a, b) => b.date.localeCompare(a.date)).map((d) => ({ date: d.date, sessionId: d.id, status: d.status, target: d.target, learned: d.learned, deferred: d.deferred, pending: d.pending, replaced: d.replaced ?? 0, processed: d.processed, test: null })) });
  }
  if (path === '/vocab-v2/notebook/remove' || path === '/vocab-v2/notebook/relearn' || path === '/vocab-v2/notebook/restore') {
    const remove = path.endsWith('remove');
    const id = body.studentSenseId ?? body.senseId;
    if (id) (remove ? state.notebookRemoved.add(id) : state.notebookRemoved.delete(id));
    return json(res, 200, { ok: true, senseId: body.senseId ?? id, headword: 'word', inNotebook: !remove });
  }
  if (path === '/vocab/lookup') {
    const word = url.searchParams.get('word') ?? '';
    const all = content.DATES.flatMap((d) => content.lessonFor(S.level, d)?.words ?? []);
    const hit = all.find((w) => w.headword === word.toLowerCase());
    if (!hit) return json(res, 200, { found: false, query: word });
    return json(res, 200, {
      found: true,
      entry: { headword: hit.headword, phonetic: hit.phonetic, pos: hit.pos, translation: hit.translation, definition: hit.definition, contextTranslation: hit.contextTranslation ?? null },
    });
  }
  return json(res, 404, { code: 'fx_not_mocked', path, method: m });
}

export function fixturePlugin() {
  return {
    name: 'student-dev-fixtures',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/__fx/')) return next();
        if (url.pathname === '/__fx/scenario') {
          S = { ...DEFAULTS };
          for (const [k, v] of url.searchParams) {
            if (k === 'offline') S.offline = v === '1';
            else if (k === 'slow' || k === 'words') S[k] = Number(v);
            else if (k in S) S[k] = v;
          }
          state = freshState();
          return json(res, 200, { ok: true, scenario: S, levels: LEVEL_LABEL });
        }
        if (S.slow) await new Promise((ok) => setTimeout(ok, S.slow));
        try {
          await handle(req, res, url);
        } catch (e) {
          json(res, 500, { code: 'fx_error', message: String(e?.message ?? e) });
        }
      });
    },
  };
}

// 供独立调试：node dev-fixtures/plugin.mjs 打印一份今天
if (process.argv[1] && process.argv[1].endsWith('plugin.mjs')) {
  S.name = process.argv[2] ?? 'backlog';
  console.log(JSON.stringify({ today: lessonToday().nextAction, overview: overview().pendingTests.length }, null, 1));
  void readFileSync;
}
