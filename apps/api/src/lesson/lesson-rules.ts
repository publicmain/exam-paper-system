/**
 * 每日一课的完成判定 —— 纯函数，可测（4.0 A0）。
 *
 * docs/PRD/morning-quiz-4.0-daily-lesson.md §2.3 / §5.2b
 *
 * ## 完成度要回答的唯一问题
 *
 * 「这孩子今天到底学没学」。所有规则都从这一句推出来：
 *
 *   · 系统代交不算完成 —— 否则完成度可以被系统凭空发放
 *   · 目标必须可达成 —— 积压 200 词的学生今天过完 20 张就是 100%，
 *     不欠账。定一个永远达不到的目标，完成度就变成另一笔只涨不落的债
 *   · 只看「做了」，不看「做得好」—— 分数另有去处
 *   · 今天没有的段落算完成，不算「无法完成」（错题队列空 = ✓）
 */

/**
 * 判定口径的版本号。**改任何一条判定规则都要递增。**
 *
 * 完成率是拿来做决策的指标。口径改过而历史数据不标版本，改口径前后的
 * 数字就不可比 —— 会得出「参与率涨了 8 个点」这种其实是尺子变了的结论。
 */
export const LESSON_RULES_VERSION = 3;

/** 谁最终提交的。只有 student / teacher 计入完成。 */
export type SubmitSource = 'student' | 'teacher' | 'system_eod';

export type SegmentStatus =
  /** 做完了 */
  | 'done'
  /** 做了一部分 */
  | 'partial'
  /** 一点没动 */
  | 'todo'
  /** 今天没有这一段（没场次 / 没到期词 / 没错题）—— 计入完成，不计入分母压力 */
  | 'none'
  /** 开了卷没自己交，被系统收尾了。**不是完成** */
  | 'auto_closed';

/**
 * 系统收尾**不算学生完成**。
 *
 * 这是整个 A0 的核心一条：把「完成」等同于 finalSubmittedAt 非空，再让
 * 收尾 cron 给所有开了卷没交的自动最终化，等于让系统替学生完成任务。
 */
export function countsAsStudentDone(source: SubmitSource | null | undefined): boolean {
  return source === 'student' || source === 'teacher';
}

/**
 * 背段的今日目标 = min(今日到期词数, 动态配额)。
 *
 * 配额就是现有的 reviewBatchSize（5–20 张）。积压 200 词的学生今天过完
 * 20 张就是 100% 完成 —— 目标可达成是完成度能起作用的前提。
 */
export function vocabTarget(dueCount: number, batchSize: number): number {
  const safeBatch = Number.isFinite(batchSize) && batchSize > 0 ? Math.floor(batchSize) : 20;
  return Math.max(0, Math.min(Math.floor(dueCount), safeBatch));
}

/** 段落状态。target=0 → 'none'（今天没有这一段，算完成）。 */
export function segmentStatus(progress: number, target: number): SegmentStatus {
  if (target <= 0) return 'none';
  if (progress >= target) return 'done';
  if (progress > 0) return 'partial';
  return 'todo';
}

/** 读段状态：多一个「被系统收卷」的分支。 */
export function readStatus(input: {
  hasSession: boolean;
  finalSubmitted: boolean;
  submitSource: SubmitSource | null | undefined;
  opened: boolean;
}): SegmentStatus {
  // 今天这个班没有场次 —— 不是学生的锅，算完成
  if (!input.hasSession) return 'none';
  if (input.finalSubmitted) {
    return countsAsStudentDone(input.submitSource) ? 'done' : 'auto_closed';
  }
  // 开了卷还没交 = 进行中
  return input.opened ? 'partial' : 'todo';
}

/** 这一段算不算「完成」（用于 x/3 计数与连续天数）。 */
export function isSegmentComplete(s: SegmentStatus): boolean {
  return s === 'done' || s === 'none';
}

export interface LessonSegments {
  read: SegmentStatus;
  vocab: SegmentStatus;
  drill: SegmentStatus;
}

/**
 * 今天这一课完成了几段 / 共几段。
 *
 * `total` 恒为 3 —— 「今天没有错题」显示的是 3/3 而不是 2/2。学生看到
 * 分母跳来跳去会以为系统坏了；而「今天没有这一段」本来就该算做完。
 */
export function lessonProgress(seg: LessonSegments): { completed: number; total: number } {
  const all = [seg.read, seg.vocab, seg.drill];
  return { completed: all.filter(isSegmentComplete).length, total: all.length };
}

/** 整节课完成 = 三段都完成。连续天数只认这个。 */
export function lessonComplete(seg: LessonSegments): boolean {
  const { completed, total } = lessonProgress(seg);
  return completed === total;
}

// ─────────────────────────────────────────────────────────────────────
// 收尾时刻（§5.2b 第 4 条）
// ─────────────────────────────────────────────────────────────────────

/** 开卷后至少给这么久，哪怕已经过了当天 23:59。 */
export const GRACE_MINUTES = 30;
/** 宽限的硬上限：次日 01:00。再晚就不是「今天的课」了。 */
export const GRACE_HARD_CAP_LOCAL_HOUR = 1;

/**
 * 这份卷子实际该在什么时候锁。
 *
 * 直接用 23:59 有两个问题：
 *   · **竞态** —— 600ms 的自动保存会和锁卷撞车，学生最后一次输入可能
 *     写在锁之后被拒
 *   · **不公平** —— 23:58 开卷的学生只有 2 分钟
 *
 * 规则：`max(当天 23:59, 开卷时刻 + 30 分钟)`，但不超过次日 01:00。
 */
export function effectiveLockAt(input: {
  /** 当天 23:59（调用方按 SGT 算好传进来） */
  dayEnd: Date;
  /** 首次打开卷子的时刻 */
  startedAt: Date | null | undefined;
}): Date {
  const dayEndMs = input.dayEnd.getTime();
  if (!input.startedAt) return input.dayEnd;
  const graceMs = input.startedAt.getTime() + GRACE_MINUTES * 60_000;
  if (graceMs <= dayEndMs) return input.dayEnd;
  // 次日 01:00 = dayEnd(23:59) + 61 分钟
  const cap = dayEndMs + (GRACE_HARD_CAP_LOCAL_HOUR * 60 + 1) * 60_000;
  return new Date(Math.min(graceMs, cap));
}

/**
 * 系统收尾时，这份卷子该不该产生「最终提交」记录。
 *
 * 一道没答的卷子当没开过 —— 不产生 AnswerScript、不落完成。现有实现
 * 已经是这个行为，这里把它写进契约，防止后续重构时被「顺手补齐」。
 */
export function shouldFinalizeOnEod(answeredCount: number): boolean {
  return answeredCount > 0;
}

// ─────────────────────────────────────────────────────────────────────
// 日期口径 —— 两个不同的东西，混过一次，这里分开命名
// ─────────────────────────────────────────────────────────────────────

/**
 * 日期**标签**：SGT 日历日对应的「UTC 午夜」。
 *
 * `MorningQuizSession.date` 存的就是这个（cron 里 `dateIso` 取自
 * `now + 8h`，再拼 `T00:00:00.000Z`）。它是个**日期**，不是时刻 ——
 * 8/25 那天永远是 `2026-08-25T00:00:00Z`，与真实的 SGT 零点差 8 小时。
 *
 * 第一版把它写成 `floor((now+8h)/1天)*1天 - 8h`（那是下面 sgtMidnight
 * 的算法），多减了一次时区，于是下午三点算出来的是**昨天** ——
 * 永远匹配不到今天的场次，读段恒显示「今天没有安排文章」。
 */
export function lessonDayKey(now: Date, tzOffsetMin = 8 * 60): Date {
  const local = new Date(now.getTime() + tzOffsetMin * 60_000);
  return new Date(`${local.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/**
 * 时间**瞬刻**：某个 SGT 自然日的真实零点。
 *
 * 用于 `reviewedAt >= ?` 这类时间戳比较。8/25 的 SGT 零点是
 * `2026-08-24T16:00:00Z`。与 vocab-review.service 的算法一致。
 */
export function sgtMidnightInstant(now: Date, tzOffsetMin = 8 * 60): Date {
  const off = tzOffsetMin * 60_000;
  return new Date(Math.floor((now.getTime() + off) / 86_400_000) * 86_400_000 - off);
}

// ─────────────────────────────────────────────────────────────────────
// 给学生看的文案
// ─────────────────────────────────────────────────────────────────────

/**
 * 补段的每日上限。
 *
 * 与背段同一条原则（PRD §2.3「完成判定必须可达成」）：积压 20 道错题的
 * 学生，今天练完 5 道就是 100%，剩下的明天再说。
 *
 * 第一版没有上限，课程页上真的出现了「0/20 道 · 约 20 分钟」—— 学生
 * 打开一看今天要练 20 道，最合理的反应就是不做。PRD 的示例是
 * 「3 道 · 约 3 分钟」，那才是会被打开的数字。
 */
export const DRILL_DAILY_CAP = 5;

export function drillTarget(queueLength: number): number {
  return Math.max(0, Math.min(Math.floor(queueLength), DRILL_DAILY_CAP));
}

/**
 * 把内部卷名变成学生看得懂的标题。
 *
 * 生产里的卷名长这样：
 *   `Morning Quiz OLEVEL/ai_authored_olevel_basic_05_the_queue_v1/Paper2 (2026-08-25)`
 *
 * 直接显示等于把内部 setCode 摔到学生脸上。剥掉前后缀、去掉出处前缀与
 * 版本号，剩下 `the_queue` → `The Queue`。认不出来就返回 null，让 UI
 * 干脆不显示标题 —— 显示一串内部编号比不显示更糟。
 */
/** 卷名里表示「出处/层级/编号」而不是标题的前缀词。 */
const TITLE_NOISE = new Set([
  'ai', 'authored', 'cambridge', 'ielts', 'olevel', 'mock', 'quiz', 'morning',
  'basic', 'simplified', 'light', 'intermediate', 'authentic', 'paper', 'set',
]);

export function readablePaperTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw.split('/');
  let core = parts.length >= 2 ? parts[1] : raw;
  core = core.replace(/\s*\(.*\)\s*$/, '').replace(/_v\d+$/i, '').trim();
  if (!core) return null;

  // 逐个丢掉开头的噪声词。用「丢前缀」而不是一条大正则，因为编号格式
  // 五花八门（0510 / s23 / 05），正则一收紧就漏、一放松就把标题吃掉。
  const tokens = core.split(/[_\s]+/).filter(Boolean);
  let i = 0;
  while (
    i < tokens.length &&
    (TITLE_NOISE.has(tokens[i].toLowerCase()) ||
      /^\d+$/.test(tokens[i]) ||
      /^[a-z]\d+$/i.test(tokens[i]))
  ) {
    i++;
  }
  const words = tokens.slice(i);
  if (!words.length) return null;
  return words.map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
}

// ─────────────────────────────────────────────────────────────────────
// 任务阶段（P3，docs/refactor-plan.md）
// ─────────────────────────────────────────────────────────────────────

/**
 * 学生当天走到哪一步。
 *
 * ## stage 是缓存，不是真相
 *
 * 真相永远是三段事实字段（doneAt / submitSource）与答卷本身；
 * `deriveStage` 每次从事实重算，只有**严格前进**时才写库。这样即使
 * stage 与事实短暂不一致（并发写、旧数据），下一次读就会被事实纠正 ——
 * 不会出现「stage 卡住导致学生进不去」的死锁。
 *
 * 转换：
 *   reading ──交卷(student/teacher)──▶ reading_done
 *   reading_done ──有新词要学──▶ vocab_learn
 *   vocab_learn ──新词学完──▶ vocab_test
 *   vocab_test ──测完/无可测词──▶ done
 *
 * `done` 单向不可逆（见 clampStage）。
 */
export type LessonStage =
  | 'reading'
  | 'reading_done'
  | 'vocab_learn'
  | 'vocab_test'
  | 'done';

/** 阶段序（用于单调钳制）。 */
export const STAGE_ORDER: LessonStage[] = [
  'reading',
  'reading_done',
  'vocab_learn',
  'vocab_test',
  'done',
];

export function stageRank(s: LessonStage | string | null | undefined): number {
  const i = STAGE_ORDER.indexOf(s as LessonStage);
  return i < 0 ? 0 : i;
}

/**
 * 单调钳制：阶段只前进不后退。
 *
 * 验收要求「任务完成后不可恢复到旧阶段」—— 学生做完一整天的课之后
 * 再打开翻卡页（自主加练），事实层面 vocab 又「未完成」了，但这不该
 * 把他打回 vocab_learn 让课程页显示「今天还没做完」。
 */
export function clampStage(
  stored: LessonStage | string | null | undefined,
  derived: LessonStage,
): LessonStage {
  return stageRank(derived) >= stageRank(stored) ? derived : (stored as LessonStage);
}

/**
 * 从事实推导阶段。纯函数 —— 输入是三段的既成事实，不看 stored.stage。
 * 调用方拿它的结果去 clampStage(stored, derived)。
 */
export function deriveStage(facts: {
  /** 读段是否算学生完成（none 也算，今天没场次不是学生的锅） */
  readSettled: boolean;
  /** 背段目标是否已达成（含 target=0 的 none） */
  vocabSettled: boolean;
  /**
   * 这次任务的**课程卡还没走完**（教学卡或复习卡，任意一种都算）。
   * 判据见 `coursePendingOf` —— 那里有完整的不变量说明。
   */
  hasPendingCourseCards: boolean;
  /** 补段是否已达成 */
  drillSettled: boolean;
}): LessonStage {
  if (!facts.readSettled) return 'reading';
  if (facts.hasPendingCourseCards) return 'vocab_learn';
  if (!facts.vocabSettled) return 'vocab_test';
  if (!facts.drillSettled) return 'vocab_test';
  return 'done';
}

/**
 * 这次任务的**课程卡还剩没剩**。学词段的入口与出口都只认这一条。
 *
 * ## 为什么不能再用「还有没教过的新词」
 *
 * 老判据是 `hasUnlearnedWords`。它只看**新词**，于是一整天的队列如果全是
 * 教过的复习词，`hasUnlearnedWords` 从一开始就是 false —— 阶段直接从
 * 「读完」跳到 `vocab_test`，`/lesson/vocab` 永远进不去，那四张复习卡
 * 一次都不会发出来。混合日也一样：最后一个新词教完的那一刻新词就没了，
 * 剩下的复习卡被整段跳过。
 *
 * ## 为什么也不能用 `!vocabSettled`
 *
 * 背段的 progress 数的是**当天的复习流水**，而首次教学**刻意不写 FSRS**。
 * 拿 `!vocabSettled` 当入口条件的话，纯新词日教完四张之后 progress 仍是 0，
 * 学生会被永远关在学词段里出不去 —— 那是 P5 那次 unlearned 死锁的翻版。
 *
 * ## 所以判据是「断点走到队列尽头没有」
 *
 * 三种队列共用同一条规则，不分新词旧词：
 *
 *   剩余 = 冻结队列 ∩ 学生真正拥有的词（保持队列顺序）
 *   还有卡 = 断点 < 剩余张数
 *
 * 教学与复习**都会推进断点**（`/lesson/vocab-taught` 与
 * `/lesson/vocab-cursor` 是同一个字段的两条写路径），所以这一条对纯新词、
 * 纯复习、混合三种日子都成立。
 *
 * ## 三条边界
 *
 * - **已经开考就不再回头**：这次任务名下已有 `VocabQuizAttempt` 时一律返回
 *   false。正式测试开出来之后把人拉回学词段，等于让他边考边学。
 * - **没有冻结队列的旧任务行**沿用旧信号（`legacyHasUnlearnedWords`），
 *   行为一个字不改 —— 那些行没有可信的队列快照，谈不上「课程卡」。
 * - **顺序是服务端的**：调用方传进来的 `courseCards` 已经由
 *   `lessonCardOrder` 按冻结队列排好，这里不重排、不过滤。
 */
export function coursePendingOf(input: {
  /** 冻结队列 ∩ 学生拥有的词，**已按队列顺序排好**（`lessonCardOrder` 的产物） */
  courseCards: readonly string[] | null;
  /** 落库的断点（原始值，不要传 `clampCursor` 的结果 —— 它把「走完」也压成 0） */
  cursor: number | null | undefined;
  /** 这次任务名下已经有正式测试了 */
  hasAttempt: boolean;
  /** 没有冻结队列时的兜底信号：当天还有没教过的新词 */
  legacyHasUnlearnedWords: boolean;
}): boolean {
  if (input.hasAttempt) return false;
  if (input.courseCards == null) return input.legacyHasUnlearnedWords;
  const total = input.courseCards.length;
  if (total === 0) return false;
  const raw = Number(input.cursor);
  const cursor = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  return cursor < total;
}

/**
 * 翻卡断点钳制。
 *
 * cursor 存的是「已翻到第几张」，但当日卡片列表会随 FSRS 调度变化
 * （评过的词不再到期、新词可能被加进来）。越界一律回 0 —— 最坏退化
 * 成今天的行为（从头翻），绝不让学生卡在一个不存在的下标上。
 */
export function clampCursor(cursor: number | null | undefined, cardCount: number): number {
  if (!Number.isFinite(cursor as number)) return 0;
  const c = Math.floor(cursor as number);
  if (c <= 0) return 0;
  if (c >= cardCount) return 0;
  return c;
}
