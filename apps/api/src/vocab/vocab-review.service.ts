import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from 'ts-fsrs';
import { PrismaService } from '../common/prisma.service';
import { StudentWordService } from './student-word.service';

/** 一次复习给几张卡。纯函数，可测。
 *
 * 2026-08-24 调平：生产数据是 14 天进 430 词、出 156 次复习，519 词里
 * 352 词（68%）从没被翻开过。收集是自动的、复习是固定配额，进出比常年
 * 3:1 —— 生词本变成只涨不落的数字，学生直接放弃。
 *
 * 所以配额随积压走：积压越深给得越多，20 张封顶（再多学生会整个跳过）。 */
export function reviewBatchSize(backlog: number): number {
  if (backlog > 100) return 20;
  if (backlog > 20) return Math.min(10 + Math.floor(backlog / 40), 20);
  return 5;
}

/**
 * 一次里放几个「从没复习过」的新词。
 *
 * ⚠️ 判据是**复习债**（reps>0 且已到期），不是总积压。
 *
 * 2026-08-24 第一版按总积压算，「积压 > 100 就把新词降到 1」，本意是
 * 先消化存量。但生产数据说明这个前提是错的：2959 个生词里 2798 个
 * （95%）是 reps=0 的**从没碰过**，真正的复习债只有 161 个。而
 * StudentWord.due 默认就是 now()，新词一进本子就计入积压 —— 于是
 *
 *     新词多 → 积压高 → 少给新词 → 新词更多
 *
 * 成了自我锁死的循环，2798 个词永远排不上队。加上排序是 createdAt
 * DESC（最新优先），早期加入的词被永久饿死。
 *
 * 改成只看复习债：真欠着账才压新词，队列里全是新词时就放开学。
 */
export function newWordQuota(reviewDebt: number, batchSize: number): number {
  // 复习债重 → 先还债，新词让位（但不清零，保住「今天学了新东西」）
  if (reviewDebt > 20) return 2;
  // 没什么债 → 一次学 8 个，这是短文层「答完题背单词」的正常节奏
  return Math.min(8, batchSize);
}

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
   * ## 吞吐（2026-08-14 调研后重定）
   *
   * 原来固定 5 张：词少时合理，但采集不限量、复习限死量，两周就积出
   * 307 词欠账（22 人，最老欠两周）—— 每天 5 张连利息都还不上，这是
   * 数学必然不是学生懒。现在**积压超过 20 时上限提到 10**；仍然封顶，
   * 因为一次塞 30 张的结局是学生直接跳过。
   *
   * ## 配额（同一次调研）
   *
   * 原来纯按「欠最久优先」排 —— 学生每天见到的全是陈债，**新学的词
   * 永远等不到第二面**，间隔重复最关键的第 2 天复习点全部错过。
   * 现在每次先给最多 3 个从没复习过的新词（最新加入优先，趁热），
   * 其余名额还旧债（仍按欠最久优先）。
   */
  async due(input: { studentName: string; studentId?: string; limit?: number }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId);
    const now = new Date();
    const backlog = await this.prisma.studentWord.count({
      where: { studentId: student.id, state: { not: 'known' }, due: { lte: now } },
    });
    // ## 吞吐（2026-08-24 调平）
    //
    // 生产数据摆在这里：14 天进 430 词、出 156 次复习，519 词里 352 词
    // （68%）从没被复习过。收集是自动的（答错就采），复习却是固定配额，
    // 进出比常年 3:1 —— 学生越用越绝望，生词本变成一个只涨不落的数字。
    //
    // 所以配额随积压走：积压越深，每次给得越多，直到 20 张的硬顶。
    // 20 是既有的经验上限，一次塞更多学生会直接跳过。
    const dynamicCap = reviewBatchSize(backlog);
    // 显式传 limit 的调用方（如管理面板）仍可覆盖，但不越过 20 的硬顶
    const limit = Math.min(Math.max(input.limit ?? dynamicCap, 1), 20);

    // 真正的**复习债**：复习过至少一次、又到期了的。这才是「欠账」。
    // 不能拿总积压当判据 —— 新词一进本子 due 就是 now()，也计入积压，
    // 于是「新词多 → 少给新词 → 新词更多」自我锁死（见 newWordQuota）。
    const reviewDebt = await this.prisma.studentWord.count({
      where: { studentId: student.id, state: { not: 'known' }, due: { lte: now }, reps: { gt: 0 } },
    });

    // 配额 1：新词（一次都没复习过的），最新加入优先 —— 「趁热」。
    const NEW_QUOTA = Math.min(newWordQuota(reviewDebt, limit), limit);
    //
    // 一半给最新加入的（趁热，学生对刚读过的文章还有印象），一半给
    // **等最久的**。纯 createdAt DESC 会让早期的词永久饿死 —— 生产库里
    // 已经有 2026-07-31 加入、24 天没被翻到一次的词。
    const freshWhere = {
      studentId: student.id,
      state: { not: 'known' as const },
      due: { lte: now },
      reps: 0,
    };
    const newestCount = Math.ceil(NEW_QUOTA / 2);
    const newest = await this.prisma.studentWord.findMany({
      where: freshWhere,
      orderBy: [{ createdAt: 'desc' }],
      take: newestCount,
    });
    const oldestUnseen = await this.prisma.studentWord.findMany({
      where: { ...freshWhere, id: { notIn: newest.map((r) => r.id) } },
      orderBy: [{ createdAt: 'asc' }],
      take: NEW_QUOTA - newest.length,
    });
    const freshRows = [...newest, ...oldestUnseen];
    // 配额 2：旧债，仍按欠最久优先
    const oldRows = await this.prisma.studentWord.findMany({
      where: {
        studentId: student.id,
        state: { not: 'known' },
        due: { lte: now },
        id: { notIn: freshRows.map((r) => r.id) },
      },
      orderBy: [{ due: 'asc' }, { createdAt: 'asc' }],
      take: limit - freshRows.length,
    });
    const rows = [...freshRows, ...oldRows];
    const entries = await this.prisma.dictEntry.findMany({
      where: { word: { in: rows.map((r) => r.headword) } },
    });
    const byWord = new Map(entries.map((e) => [e.word, e]));

    // 方法开头已经数过一遍完全相同的条件（backlog），别再打一次库
    const totalDue = backlog;

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
    // 三分进度（2026-08-24 词汇主线化）。原来的 byState 是 FSRS 的内部
    // 状态机（new / learning / review / relearning / known），学生看不懂
    // 也不该看懂。压成三个他关心的数字：
    //
    //   mastered  已掌握 —— known，或者稳定度已经到 21 天以上（三周内
    //             不会再考到，实质上就是记住了）
    //   learning  学习中 —— 复习过至少一次但还没到掌握
    //   untouched 待开始 —— 一次都没复习过
    //
    // 「待开始」是这次要盯的指标：生产库里它占 68%，说明词收进来就沉底。
    const MASTERED_STABILITY_DAYS = 21;
    const mastered = await this.prisma.studentWord.count({
      where: {
        studentId: student.id,
        OR: [{ state: 'known' }, { reps: { gt: 0 }, stability: { gte: MASTERED_STABILITY_DAYS } }],
      },
    });
    const untouched = await this.prisma.studentWord.count({
      where: { studentId: student.id, reps: 0, state: { not: 'known' } },
    });
    const total = rows.reduce((a, r) => a + r._count, 0);
    const learning = Math.max(0, total - mastered - untouched);

    return {
      student: { id: student.id, name: student.name },
      total,
      byState: Object.fromEntries(rows.map((r) => [r.state, r._count])),
      bySource: Object.fromEntries(bySource.map((r) => [r.sourceType, r._count])),
      totalReviews: reviews,
      totalDue,
      // 2026-08-14 进度反馈：全班只有 6 词毕业、无任何成就展示 ——
      // 学生看到的永远是「还欠多少」，看不到「已经攒下多少」。
      knownCount: rows.find((r) => r.state === 'known')?._count ?? 0,
      streakDays: await this.streakDays(student.id),
      progress: { mastered, learning, untouched },
    };
  }

  /**
   * 连续学习天数（新加坡自然日）。今天有复习记录算今天起，否则从昨天
   * 往前数 —— 今天还没做不该把昨天攒的连胜清零，多邻国同款规则。
   * （2026-08-14 从 vocab-quiz.service 挪来公用：stats 与自测完成页
   * 都要显示它。）
   */
  async streakDays(studentId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ d: string }>>`
      SELECT DISTINCT (("reviewedAt" + interval '8 hours')::date)::text AS d
      FROM "WordReviewLog" l JOIN "StudentWord" w ON w.id = l."studentWordId"
      WHERE w."studentId" = ${studentId}
      ORDER BY d DESC LIMIT 120`;
    if (!rows.length) return 0;
    const days = rows.map((r) => r.d);
    const sgtToday = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const sgtYesterday = new Date(Date.now() + 8 * 3600_000 - 86400_000).toISOString().slice(0, 10);
    if (days[0] !== sgtToday && days[0] !== sgtYesterday) return 0;
    let streak = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1] + 'T00:00:00Z').getTime();
      const cur = new Date(days[i] + 'T00:00:00Z').getTime();
      if (prev - cur === 86400_000) streak++;
      else break;
    }
    return streak;
  }
}
