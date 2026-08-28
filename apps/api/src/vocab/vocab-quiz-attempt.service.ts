import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { shouldRevealAnswer, stageAfterSubmit } from '../lesson/rc11-rules';
import { PrismaService } from '../common/prisma.service';
import { StudentWordService } from './student-word.service';
import { VocabQuizService } from './vocab-quiz.service';
import {
  MAX_QUIZ_ITEMS,
  MIN_QUIZ_ITEMS,
  scoreOf,
  selectEligible,
} from './quiz-eligibility';
import { STAGE_ORDER, stageRank } from '../lesson/lesson-rules';
import { normalizeWord } from './vocab.service';

/**
 * P6 —— 正式单词测试。
 *
 * 与「自测」的区别不在页面，在于**它有成绩**：一份 VocabQuizAttempt，
 * 一个任务日一份，题目创建时快照冻结。
 *
 * 三条硬边界，逐条对应本片的规则：
 * - **不写 FSRS**：不产生 WordReviewLog，不动 due/reps/stability/
 *   difficulty/lapses。考试是「量一下」，不是「练一次」；让考试改调度
 *   等于用尺子把被量的东西压短。复习调度仍然只由翻卡评分驱动。
 * - **不写阅读答卷**：成绩落在自己的表里，StudentSubmission 一个字段
 *   都不碰。
 * - **只考教过的词**：资格判据见 quiz-eligibility.ts，任何情况下都不为
 *   凑题数放宽。
 */
@Injectable()
export class VocabQuizAttemptService {
  private readonly logger = new Logger(VocabQuizAttemptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly words: StudentWordService,
    private readonly quiz: VocabQuizService,
  ) {}

  /** 任务日（SGT 日历日的 UTC 午夜）—— 与 DailyLessonCompletion.date 同口径 */
  private dayKey(now = new Date()): Date {
    const sgt = new Date(now.getTime() + 8 * 3600_000);
    return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()));
  }

  /** 真实的 SGT 零点（时间瞬刻）—— 用于「今天刚教过」的比较 */
  private sgtMidnight(now = new Date()): Date {
    const k = this.dayKey(now);
    return new Date(k.getTime() - 8 * 3600_000);
  }

  private view(a: {
    id: string;
    status: string;
    startedAt: Date;
    submittedAt: Date | null;
    total: number;
    correct: number;
    score: number;
    items: unknown;
  }) {
    const items = (a.items as any[]) ?? [];
    const submitted = a.status === 'submitted';
    return {
      attemptId: a.id,
      status: a.status,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      total: submitted ? a.total : items.length,
      correct: submitted ? a.correct : items.filter((it) => it.isCorrect === true).length,
      score: submitted ? a.score : null,
      items: items.map((it, index) => ({
        index,
        qtype: it.qtype,
        headword: it.headword,
        prompt: it.prompt,
        options: it.options ?? [],
        phonetic: it.phonetic ?? null,
        translation: it.translation ?? null,
        contextSentence: it.contextSentence ?? null,
        // 作答前**不下发正确答案** —— 下发了等于把答案放进 devtools。
        //
        // RC1.1：**这一题已经作答之后**也给。人工测试实测：学生选对了
        // 却全被标成 ✗ —— 前端拿 correctIndex 判即时对错，而作答前它是
        // null，于是没有一个选项能"等于正确答案"。
        //
        // 已答的题下发答案不构成作弊：这一题的作答是一次性的（服务端
        // 幂等挡住改答案），学生已经交出了他的选择。未作答的题照旧扣着。
        correctIndex: shouldRevealAnswer({ submitted, answered: it.isCorrect != null })
          ? (it.correctIndex ?? null)
          : null,
        answer: shouldRevealAnswer({ submitted, answered: it.isCorrect != null })
          ? (it.answer ?? null)
          : null,
        studentIndex: it.studentIndex ?? null,
        studentAnswer: it.studentAnswer ?? null,
        isCorrect: it.isCorrect ?? null,
        answeredAt: it.answeredAt ?? null,
      })),
    };
  }

  /**
   * 开始（或恢复）当日的正式测试。**幂等**。
   *
   * 已有记录 → 原样返回（进行中就接着做，已提交就返回成绩）。
   * 没有 → 按资格挑词、出题、快照落库。
   *
   * 并发/双击：靠 (studentId, date) 唯一约束。两个请求同时进来，先到的
   * 建成，后到的撞约束后回读同一份 —— 不可能产生两份成绩。
   */
  async start(input: { studentName: string; studentId?: string; authStudentId?: string }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId, input.authStudentId);
    const now = new Date();
    const date = this.dayKey(now);
    const dayStart = this.sgtMidnight(now);

    // ── 先要有「当前任务」──
    //
    // 正式测试属于一次任务，没有任务就没有正式测试。DLC 行由
    // today(freeze:true) 创建（那里才有完整的目标冻结逻辑），这里只读不建
    // —— 越权创建会造出 target 全 0 的空任务行。
    const dlc = await this.prisma.dailyLessonCompletion.findUnique({
      where: { studentId_date: { studentId: student.id, date } },
      select: { id: true, vocabWords: true, stage: true },
    });
    if (!dlc) throw new ConflictException({ code: 'no_task' });

    // 已有这次任务的测试 → 原样返回。按**任务**查，不按「学生 + 今天」查：
    // 前者是 attempt 真正归属的东西，后者只是它恰好落在的那一天。
    //
    // 放在阶段门之前：已经开考的测试，无论现在走到哪个阶段都读得回来
    // （交完卷 stage 会变成 done，那时仍然要能看成绩）。
    const existing = await this.prisma.vocabQuizAttempt.findFirst({
      where: { dailyLessonCompletionId: dlc.id },
    });
    if (existing) return { ...this.view(existing), resumed: true as const };

    // ── 阶段门：**没走到该考的阶段就不许开考** ──
    //
    // 学生可能从深链接、书签、或直接打 API 进来。资格判据只回答「这些词
    // 能不能考」，回答不了「他该不该现在考」—— 一个还在翻卡学新词的学生，
    // 哪怕这次任务的词都教过了（比如队列里全是往日的复习词），也不该跳过
    // 课程内的流程直接开考。
    //
    // stage=done 且没有现成的测试：这一天已经收尾了，不再新开一份。
    const stage = String(dlc.stage ?? STAGE_ORDER[0]);
    if (stageRank(stage) !== stageRank('vocab_test')) {
      throw new ConflictException({ code: 'stage_not_ready', stage });
    }

    // ── 资格：**本次任务的合法词汇集合** ──
    //
    // 事实来源是任务自己记下的队列（DLC.vocabWords），不是任何形式的
    // 日期推断。
    //
    // 上一版用「今天动过这个词」（firstTaughtAt 落在今天，或今天有复习
    // 流水）推断归属 —— 那是错的：**写复习流水的不止课程内的翻卡**，
    // 自由练习和生词本里随手复习写的是同一种 WordReviewLog。学生下午
    // 自由练了几个陈年旧词，晚上的正式测试就会把它们考进去。
    //
    // 队列由课程内的动作写（冻结目标时快照 + 教学时补入），自由练习
    // 碰不到它。旧任务行没有快照 → 空集 → insufficient_items，宁可
    // 当天不考，也不考不属于这次任务的词。
    const taskWords: string[] = Array.isArray(dlc.vocabWords)
      ? [...new Set((dlc.vocabWords as string[]).map((w) => normalizeWord(String(w))).filter(Boolean))]
      : [];

    const candidates = await this.prisma.studentWord.findMany({
      where: {
        studentId: student.id,
        // 只考教过的词。这一条在 SQL 里就挡住，不依赖下游过滤。
        firstTaughtAt: { not: null },
        // 且必须在**这次任务的队列**里
        headword: { in: taskWords },
      },
      select: {
        headword: true,
        firstTaughtAt: true,
        due: true,
        contextSentence: true,
        reps: true,
      },
    });
    const outcome = selectEligible(candidates, now, dayStart);
    if (outcome.kind !== 'ok') {
      // 明确说不够，**不生成虚假测试**。前端据此退回自由练习或提示。
      throw new ConflictException({
        code: outcome.kind,
        taught: outcome.taught,
        eligible: outcome.eligible,
        minItems: MIN_QUIZ_ITEMS,
      });
    }

    // ── 出题：固定词表，服务端不再自己补题 ──
    const built = await this.quiz.buildQuiz({
      studentName: input.studentName,
      studentId: input.studentId,
      limit: MAX_QUIZ_ITEMS,
      words: outcome.words.map((w: any) => ({
        headword: w.headword,
        contextSentence: w.contextSentence ?? null,
        reps: w.reps ?? 0,
      })),
    });
    const questions = built.questions ?? [];
    if (questions.length < MIN_QUIZ_ITEMS) {
      // 词够了但组不出题（干扰项不足 / 释义缺失）—— 同样明说，不糊弄
      throw new ConflictException({
        code: 'insufficient_items',
        taught: outcome.words.length,
        eligible: questions.length,
        minItems: MIN_QUIZ_ITEMS,
      });
    }

    const items = questions.map((q: any) => ({
      qtype: q.qtype,
      headword: q.headword,
      prompt: q.prompt,
      options: q.options ?? [],
      correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : null,
      answer: q.answer ?? null,
      phonetic: q.phonetic ?? null,
      translation: q.translation ?? null,
      contextSentence: q.contextSentence ?? null,
      studentIndex: null,
      studentAnswer: null,
      isCorrect: null,
      answeredAt: null,
    }));

    try {
      const created = await this.prisma.vocabQuizAttempt.create({
        data: {
          studentId: student.id,
          date,
          dailyLessonCompletionId: dlc.id,
          status: 'in_progress',
          items: items as any,
          total: items.length,
        },
      });
      this.logger.log(
        `vocab quiz started student=${student.id} attempt=${created.id} items=${items.length}`,
      );
      return { ...this.view(created), resumed: false as const };
    } catch (e: any) {
      // 并发撞唯一约束 —— 回读那一份，绝不建第二份
      if (e?.code !== 'P2002') throw e;
      const winner = await this.prisma.vocabQuizAttempt.findFirst({
        where: { dailyLessonCompletionId: dlc.id },
      });
      if (!winner) throw e;
      return { ...this.view(winner), resumed: true as const };
    }
  }

  /** 回读当日测试（恢复用）。没有就返回 null，不隐式创建。 */
  async current(input: { studentName: string; studentId?: string; authStudentId?: string }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId, input.authStudentId);
    const a = await this.prisma.vocabQuizAttempt.findFirst({
      where: { studentId: student.id, date: this.dayKey() },
    });
    return a ? this.view(a) : { attempt: null };
  }

  /**
   * 记一题的作答。**第一次作答为准**，重复提交同一题是 no-op ——
   * 网络重试、双击、返回上一题再点，都不会改写已经记下的答案。
   *
   * 只写 items，不碰 StudentWord / WordReviewLog。
   */
  async answer(input: {
    studentName: string;
    studentId?: string;
    /** 阶段 5A：已认证学生的 id。给了就走精确 ID 路径，不查姓名。 */
    authStudentId?: string;
    index: number;
    /** 选择题的选项下标；拼写题传 text */
    optionIndex?: number;
    text?: string;
  }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId, input.authStudentId);
    const date = this.dayKey();
    const a = await this.prisma.vocabQuizAttempt.findFirst({
      where: { studentId: student.id, date },
    });
    if (!a) throw new ConflictException({ code: 'no_attempt' });
    if (a.status === 'submitted') {
      // 交过卷就不再接受作答 —— 成绩已经落定
      return { ...this.view(a), accepted: false as const, reason: 'already_submitted' as const };
    }

    const items = (a.items as any[]) ?? [];
    const idx = Number(input.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) {
      throw new BadRequestException({ code: 'index_out_of_range' });
    }
    const it = items[idx];
    if (it.isCorrect != null) {
      // 已经答过 —— 幂等 no-op，保留第一次的答案
      return { ...this.view(a), accepted: false as const, reason: 'already_answered' as const };
    }

    let isCorrect = false;
    let studentAnswer: string | null = null;
    let studentIndex: number | null = null;
    if (it.qtype === 'spelling') {
      const typed = (input.text ?? '').trim();
      studentAnswer = typed;
      isCorrect =
        typed.length > 0 &&
        typed.toLowerCase() === String(it.answer ?? '').trim().toLowerCase();
    } else {
      const oi = Number(input.optionIndex);
      if (!Number.isInteger(oi) || oi < 0 || oi >= (it.options?.length ?? 0)) {
        throw new BadRequestException({ code: 'option_out_of_range' });
      }
      studentIndex = oi;
      studentAnswer = it.options[oi] ?? null;
      isCorrect = oi === it.correctIndex;
    }

    items[idx] = {
      ...it,
      studentIndex,
      studentAnswer,
      isCorrect,
      answeredAt: new Date().toISOString(),
    };

    // 条件写入：只在这一题仍未作答时落库。两个请求同时打同一题，
    // 先到的写成，后到的匹配 0 行 —— 第一次作答为准。
    const updated = await this.prisma.vocabQuizAttempt.updateMany({
      where: { id: a.id, status: 'in_progress' },
      data: { items: items as any },
    });
    if (updated.count === 0) {
      const fresh = await this.prisma.vocabQuizAttempt.findUnique({ where: { id: a.id } });
      return { ...this.view(fresh!), accepted: false as const, reason: 'already_submitted' as const };
    }
    const fresh = await this.prisma.vocabQuizAttempt.findUnique({ where: { id: a.id } });
    return { ...this.view(fresh!), accepted: true as const, isCorrect };
  }

  /**
   * 提交。**幂等** —— 双击、重试、并发都只会有一份成绩。
   *
   * 分数在这里算一次、落库一次；展示层永远读落库的值，改词库不影响。
   * 未作答的题按答错计入总数（考试就是这样），但不写任何 FSRS 字段。
   */
  async submit(input: { studentName: string; studentId?: string; authStudentId?: string }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId, input.authStudentId);
    const date = this.dayKey();
    const a = await this.prisma.vocabQuizAttempt.findFirst({
      where: { studentId: student.id, date },
    });
    if (!a) throw new ConflictException({ code: 'no_attempt' });
    if (a.status === 'submitted') {
      // 已经交过 —— 原样返回同一份成绩，不重算、不新建
      return { ...this.view(a), alreadySubmitted: true as const };
    }

    const items = (a.items as any[]) ?? [];
    const { total, correct, score } = scoreOf(items);

    // 条件更新：只有仍是 in_progress 的那一次会成功。并发提交里
    // 后到的匹配 0 行，回读同一份成绩 —— 不可能产生第二份。
    //
    // RC1.1 —— **提交与阶段推进在同一个事务里**。
    //
    // 人工测试实测：attempt 已经 submitted、成绩 4/4，而
    // DailyLessonCompletion.stage 还停在 vocab_test。展示层（总结页现算
    // 阶段）说"完成了"，持久化层说"没完成" —— cron、统计、恢复和之后
    // 的身份收敛读到的是两个事实。
    //
    // 不能靠总结页那个 GET 去补写：读取路径必须保持只读（P7 的教训）。
    // 提交是**这一步真的完成了**的唯一时刻，推进就该发生在这里。
    const done = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.vocabQuizAttempt.updateMany({
        where: { id: a.id, status: 'in_progress' },
        data: { status: 'submitted', submittedAt: new Date(), total, correct, score },
      });
      if (upd.count > 0 && a.dailyLessonCompletionId) {
        // 单调推进：只从 vocab_test 往前走。已经是 done 的不动（重复提交
        // 幂等），还没走到 vocab_test 的也不越级（那说明前面的步骤没完成，
        // 这次提交本就不该发生 —— 阶段门会先拦下）。
        // 目标阶段由 rc11-rules 决定（单调、幂等、不越级），
        // where 里的 stage 条件与它表达同一件事。
        const nextStage = stageAfterSubmit('vocab_test', true);
        await tx.dailyLessonCompletion.updateMany({
          where: { id: a.dailyLessonCompletionId, stage: 'vocab_test' },
          data: { stage: nextStage as any, stageAt: new Date() },
        });
      }
      return upd;
    });
    const fresh = await this.prisma.vocabQuizAttempt.findUnique({ where: { id: a.id } });
    if (done.count === 0) {
      return { ...this.view(fresh!), alreadySubmitted: true as const };
    }
    this.logger.log(
      `vocab quiz submitted student=${student.id} attempt=${a.id} ${correct}/${total} (${score})`,
    );
    return { ...this.view(fresh!), alreadySubmitted: false as const };
  }

  /** 历史成绩列表（最近 N 次）。只读，供成绩页用。 */
  async history(input: { studentName: string; studentId?: string; authStudentId?: string; limit?: number }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId, input.authStudentId);
    const take = Math.min(Math.max(input.limit ?? 30, 1), 100);
    const rows = await this.prisma.vocabQuizAttempt.findMany({
      where: { studentId: student.id, status: 'submitted' },
      orderBy: [{ date: 'desc' }],
      take,
      select: {
        id: true, date: true, submittedAt: true, total: true, correct: true, score: true,
      },
    });
    return {
      attempts: rows.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
        total: r.total,
        correct: r.correct,
        score: r.score,
      })),
    };
  }
}
