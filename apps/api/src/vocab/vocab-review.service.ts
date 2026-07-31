import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from 'ts-fsrs';
import { PrismaService } from '../common/prisma.service';
import { StudentWordService } from './student-word.service';

/**
 * 生词复习调度（P3）—— FSRS（Free Spaced Repetition Scheduler）。
 *
 * 为什么是 FSRS 而不是传统 SM-2：FSRS 基于 7 亿次真实复习数据训练，在同等
 * 记忆留存下比 SM-2 少 20–30% 的复习量，2023 年底起是 Anki 的默认算法。
 * 本场景每天只能挤出 2–3 分钟（复习寄生在交卷后的既有流程里），这 20–30%
 * 是决定性的。见 docs/PRD/vocabulary-notebook.md §1.5。
 *
 * 铁律：ts-fsrs 是纯本地计算的 MIT 库，**不涉及任何 API 调用**。
 */

/**
 * 调度参数。
 *
 * `enable_fuzz: false` —— 同一批词的到期时间保持确定，便于排查与测试复现。
 *
 * `learning_steps: []` / `relearning_steps: []` —— **取消日内学习步进**。
 * 这不是省事，是本场景的正确选择，且修掉了一个真实缺陷：
 *
 *   FSRS 默认的 learning_steps 是 ['1m','10m']，卡片要连续答对两次才
 *   毕业到 Review 态；「现在处于第几步」是记在 Card.learning_steps 上的。
 *   我们把调度状态拆成列存在 StudentWord 里，并没有这一列，还原 Card 时
 *   只能填 0 —— 于是每次复习都把卡片重置回第一步，**永远毕业不了**，
 *   间隔恒为 0 天，间隔重复完全失效（V3 验证实测：连续答对 6 次仍是 0 天）。
 *
 *   而我们的学生一天只复习一次（交卷后那 2 分钟），"1 分钟后再来一次"
 *   本就没人会做。去掉日内步进后，第一次答对即进入 Review 态，
 *   间隔按天走：2 → 11 → 46 → 163 → 497 天，这才是间隔重复该有的样子。
 */
const PARAMS = generatorParameters({
  enable_fuzz: false,
  learning_steps: [],
  relearning_steps: [],
});
const scheduler = fsrs(PARAMS);

/**
 * state 只是给学生看的标签，**不参与调度**（调度全由 FSRS 的
 * stability/difficulty 决定）。按「下次多久要再见到它」分档最直观：
 *   < 7 天  → 还在学          learning
 *   ≥ 60 天 → 已掌握          known（`due` 查询会跳过它）
 *   其余    → 复习中          review
 */
const KNOWN_INTERVAL_DAYS = 60;
const LEARNING_INTERVAL_DAYS = 7;

type DbState = 'new' | 'learning' | 'review' | 'known';

/**
 * 我们的 state 与 FSRS State 的映射。
 *
 * FSRS 有 New/Learning/Review/Relearning 四态；我们额外有一个给学生看的
 * "known(已掌握)"标签，而没有 Relearning。约定：
 *   known      → 送进 FSRS 时按 Review 处理（它本质就是间隔很长的 Review）
 *   Relearning → 落库时归为 learning（对学生而言"又要重新记"就是学习中）
 * 这点信息损失不影响调度正确性，FSRS 的实际调度依据是 stability/difficulty。
 */
function toFsrsState(s: DbState): State {
  switch (s) {
    case 'new':
      return State.New;
    case 'learning':
      return State.Learning;
    case 'review':
    case 'known':
      return State.Review;
  }
}

function fromFsrsState(s: State, scheduledDays: number): DbState {
  if (s === State.New) return 'new';
  if (s === State.Learning || s === State.Relearning) return 'learning';
  // Review 态按间隔长短分档。关掉日内步进后，答错的词不再进 Relearning，
  // 而是留在 Review 但间隔被砍到很短（如 355 天 → 2 天）——
  // 这时给学生看「复习中」是误导，按间隔判定才诚实。
  if (scheduledDays >= KNOWN_INTERVAL_DAYS) return 'known';
  if (scheduledDays < LEARNING_INTERVAL_DAYS) return 'learning';
  return 'review';
}

const RATING_MAP = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const;

export type RatingKey = keyof typeof RATING_MAP;

@Injectable()
export class VocabReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly words: StudentWordService,
  ) {}

  /**
   * 今日待复习。
   *
   * 刻意设上限（默认 5）：复习是插在交卷后的，学生已经答了 30 分钟题，
   * 给 20 个词只会让他直接跳过。宁可每天 5 个、天天做得完。
   */
  async due(input: { studentName: string; studentId?: string; limit?: number }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId);
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
    const rows = await this.prisma.studentWord.findMany({
      where: {
        studentId: student.id,
        state: { not: 'known' },
        due: { lte: new Date() },
      },
      // 先复习欠得最久的
      orderBy: [{ due: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });
    const entries = await this.prisma.dictEntry.findMany({
      where: { word: { in: rows.map((r) => r.headword) } },
    });
    const byWord = new Map(entries.map((e) => [e.word, e]));

    const totalDue = await this.prisma.studentWord.count({
      where: { studentId: student.id, state: { not: 'known' }, due: { lte: new Date() } },
    });

    return {
      student: { id: student.id, name: student.name },
      totalDue,
      cards: rows.map((w) => {
        const e = byWord.get(w.headword);
        return {
          headword: w.headword,
          surfaceForm: w.surfaceForm,
          contextSentence: w.contextSentence,
          sourcePassageTitle: w.sourcePassageTitle,
          phonetic: e?.phonetic ?? null,
          translation: e?.translation ?? '',
          tag: e?.tag ?? [],
          state: w.state,
          reps: w.reps,
        };
      }),
    };
  }

  /**
   * 提交一次复习评分 → FSRS 重新调度 → 落库 + 写流水。
   *
   * 幂等性说明：同一个词短时间内重复提交会被视作两次真实复习（FSRS 会据此
   * 缩短间隔）。前端在提交后立即禁用按钮；这里不做去重，因为"学生确实又点了
   * 一次"和"网络重发"在语义上无法区分，而多算一次复习的代价远小于漏算。
   */
  async review(input: {
    studentName: string;
    studentId?: string;
    headword: string;
    rating: RatingKey;
    elapsedMs?: number;
  }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId);
    const rating = RATING_MAP[input.rating];
    if (rating === undefined) throw new BadRequestException({ code: 'invalid_rating' });

    const word = await this.prisma.studentWord.findUnique({
      where: { studentId_headword: { studentId: student.id, headword: input.headword.toLowerCase() } },
    });
    if (!word) throw new NotFoundException({ code: 'word_not_in_notebook' });

    const now = new Date();
    // 用库里的调度状态还原成 FSRS Card
    const card: Card =
      word.reps === 0 && !word.lastReview
        ? createEmptyCard(word.createdAt)
        : ({
            due: word.due,
            stability: word.stability,
            difficulty: word.difficulty,
            elapsed_days: word.elapsedDays,
            scheduled_days: word.scheduledDays,
            reps: word.reps,
            lapses: word.lapses,
            state: toFsrsState(word.state as DbState),
            last_review: word.lastReview ?? undefined,
            // 参数里已关闭日内步进（见 PARAMS 注释），该计数恒为 0，
            // 不需要也不应该持久化。
            learning_steps: 0,
          } as unknown as Card);

    const next = scheduler.repeat(card, now)[rating].card;

    const updated = await this.prisma.$transaction(async (tx) => {
      const w = await tx.studentWord.update({
        where: { id: word.id },
        data: {
          due: next.due,
          stability: next.stability,
          difficulty: next.difficulty,
          elapsedDays: next.elapsed_days,
          scheduledDays: next.scheduled_days,
          reps: next.reps,
          lapses: next.lapses,
          lastReview: now,
          state: fromFsrsState(next.state, next.scheduled_days),
        },
      });
      await tx.wordReviewLog.create({
        data: {
          studentWordId: word.id,
          rating: input.rating,
          reviewedAt: now,
          elapsedMs: Math.max(0, Math.min(input.elapsedMs ?? 0, 600_000)),
        },
      });
      return w;
    });

    return {
      headword: updated.headword,
      state: updated.state,
      due: updated.due.toISOString(),
      intervalDays: updated.scheduledDays,
      reps: updated.reps,
    };
  }

  /** 我的词汇统计（学生端展示 + PRD §7 效果度量的基础）。 */
  async stats(input: { studentName: string; studentId?: string }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId);
    const rows = await this.prisma.studentWord.groupBy({
      by: ['state'],
      where: { studentId: student.id },
      _count: true,
    });
    const bySource = await this.prisma.studentWord.groupBy({
      by: ['sourceType'],
      where: { studentId: student.id },
      _count: true,
    });
    const reviews = await this.prisma.wordReviewLog.count({
      where: { studentWord: { studentId: student.id } },
    });
    const totalDue = await this.prisma.studentWord.count({
      where: { studentId: student.id, state: { not: 'known' }, due: { lte: new Date() } },
    });
    return {
      student: { id: student.id, name: student.name },
      total: rows.reduce((a, r) => a + r._count, 0),
      byState: Object.fromEntries(rows.map((r) => [r.state, r._count])),
      bySource: Object.fromEntries(bySource.map((r) => [r.sourceType, r._count])),
      totalReviews: reviews,
      totalDue,
    };
  }
}
