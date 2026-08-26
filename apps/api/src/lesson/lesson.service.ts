import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StudentWordService } from '../vocab/student-word.service';
import {
  VocabReviewService,
  reviewBatchSize,
  streakFromDays,
} from '../vocab/vocab-review.service';
import { MistakeService } from '../vocab/mistake.service';
import {
  LESSON_RULES_VERSION,
  type LessonSegments,
  type SegmentStatus,
  type SubmitSource,
  countsAsStudentDone,
  lessonComplete,
  lessonDayKey,
  sgtMidnightInstant,
  isSegmentComplete,
  lessonProgress,
  readStatus,
  segmentStatus,
  vocabTarget,
  drillTarget,
  readablePaperTitle,
  type LessonStage,
  deriveStage,
  clampStage,
  clampCursor,
  STAGE_ORDER,
  stageRank,
} from './lesson-rules';

/**
 * 每日一课（4.0 阶段 A）。
 *
 * docs/PRD/morning-quiz-4.0-daily-lesson.md
 *
 * ## 影子运行
 *
 * A 阶段**只算不改**：时间窗照旧（08:30–09:00 / 16:00–17:30），这个模块
 * 不参与任何答题闸门，只是把「今天的课完成了几段」算出来给学生和教师看。
 * 要跑满两个完整教学周、与旧口径并排比对之后，才谈放开时间窗（阶段 B）。
 *
 * 单班 35 人每天一个数据点，一周只有 5 个点 —— 一个人请假就能推动 3 个
 * 百分点。所以判据是两周（10 个点），不是一周。
 *
 * ## 目标为什么要冻结
 *
 * 三段的原始数据实时可查，但**目标**不能实时算：学生早上看到「练完 3 道
 * 错题」，下午又错了两道就变成 5 道 —— 目标在他背后往后退，是最挫败的
 * 一种设计。首次打开课程页时把三个目标写进 DailyLessonCompletion，当天
 * 之后新增的错题和生词进明天的课。
 */
@Injectable()
export class LessonService {
  private readonly logger = new Logger('Lesson');

  constructor(
    private readonly prisma: PrismaService,
    private readonly words: StudentWordService,
    private readonly review: VocabReviewService,
    private readonly mistakes: MistakeService,
  ) {}

  /**
   * 今天是哪一天（日期标签）与 SGT 真实零点（时间瞬刻）。
   *
   * 实现放在 lesson-rules，因为这两个曾经被混用过一次 —— 纯函数才好
   * 用测试钉死。区别见那边的注释。
   */
  private sgtDayStart(now = new Date()): Date {
    return lessonDayKey(now, Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60));
  }

  private sgtMidnight(now = new Date()): Date {
    return sgtMidnightInstant(now, Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60));
  }

  /**
   * 今天的课。
   *
   * `freeze` 为 true 时（学生真的打开了课程页）才写目标快照；教师看板
   * 批量查询传 false —— **教师看一眼不该给全班创建当日记录**，那会把
   * 「学生今天来过」这个信号污染掉。
   */
  async today(input: { studentName: string; studentId?: string; freeze?: boolean }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId);
    const now = new Date();
    const day = this.sgtDayStart(now);

    // ── 三段的现况 ──
    const [readNow, vocabNow, drillNow] = await Promise.all([
      this.readState(student.id, day),
      this.vocabState(student.id, now),
      this.drillState(student.id, now),
    ]);

    // ── 目标：已冻结就用冻结值，否则（且允许时）现在冻结 ──
    let frozen = await this.prisma.dailyLessonCompletion.findUnique({
      where: { studentId_date: { studentId: student.id, date: day } },
    });

    if (!frozen && input.freeze) {
      frozen = await this.prisma.dailyLessonCompletion.create({
        data: {
          studentId: student.id,
          date: day,
          readTarget: readNow.hasSession ? 1 : 0,
          vocabTarget: vocabNow.target,
          drillTarget: drillNow.target,
          targetsFrozenAt: now,
          rulesVersion: LESSON_RULES_VERSION,
        },
      });
    } else if (frozen && frozen.rulesVersion < LESSON_RULES_VERSION && input.freeze) {
      // 判定口径变了 → **重新冻结当天目标**。
      //
      // 这正是 rulesVersion 存在的理由：不做失效，它就只是个装饰。
      // 真实例子：补段加上「每日最多 5 道」的上限那次，今天已经冻结的
      // 学生仍然顶着 20 的旧目标，看到的是「1/20 道 · 约 20 分钟」——
      // 修好的规则对他们不生效。
      //
      // 只重算**目标**，不动进度和完成时刻（那是既成事实）。
      frozen = await this.prisma.dailyLessonCompletion.update({
        where: { id: frozen.id },
        data: {
          readTarget: readNow.hasSession ? 1 : 0,
          vocabTarget: vocabNow.target,
          drillTarget: drillNow.target,
          targetsFrozenAt: now,
          rulesVersion: LESSON_RULES_VERSION,
        },
      });
      this.logger.log(
        `re-froze lesson targets for student=${student.id} (rules v${frozen.rulesVersion})`,
      );
    }

    // 冻结记录缺失（教师看板 / 学生还没进过课程页）时用当下值兜底，
    // 行为与冻结后一致，只是不写库
    const readTarget = frozen?.readTarget ?? (readNow.hasSession ? 1 : 0);
    const vTarget = frozen?.vocabTarget ?? vocabNow.target;
    const dTarget = frozen?.drillTarget ?? drillNow.target;

    const segments: LessonSegments = {
      read: readTarget === 0 ? 'none' : readStatus(readNow),
      // 交了当天的正式测试就算背段完成 —— 「学完再考一次」本来就是
      // 这一段的终点。没考的日子仍按复习次数判定（老行为不变）。
      vocab: vocabNow.quizSubmitted ? 'done' : segmentStatus(vocabNow.progress, vTarget),
      drill: segmentStatus(drillNow.progress, dTarget),
    };

    // 把进度写回快照（目标不动，只更新进度与完成时刻）
    if (frozen) {
      await this.syncProgress(frozen.id, frozen, {
        readProgress: segments.read === 'done' ? 1 : 0,
        readSource: readNow.submitSource ?? null,
        readDone: segments.read === 'done',
        vocabProgress: vocabNow.progress,
        vocabDone: segments.vocab === 'done' || segments.vocab === 'none',
        drillProgress: drillNow.progress,
        drillDone: segments.drill === 'done' || segments.drill === 'none',
        autoFinalizeReason: readNow.autoFinalizeReason ?? null,
        now,
      });
    }

    // ── 任务阶段（P3）──
    // 从事实推导，再与库里存的做单调钳制（只前进不后退）。stage 是
    // 缓存：即使与事实短暂不一致，下一次读就会被事实纠正。
    const derived = deriveStage({
      readSettled: isSegmentComplete(segments.read),
      vocabSettled: isSegmentComplete(segments.vocab),
      hasUnlearnedWords: vocabNow.unlearned > 0,
      drillSettled: isSegmentComplete(segments.drill),
    });
    const stage: LessonStage = clampStage(frozen?.stage, derived);
    // 只有真的前进了才写库，且**用条件更新**而不是先读后写
    // （P3 合并前验证第 4 项）：两个标签页同时打开课程页时，读到旧
    // 快照的那个不能把阶段写回去。stageRank 比较交给 SQL 的 IN —— 只
    // 允许从「比目标阶段更早」的状态跃迁，落后的写入匹配 0 行。
    if (frozen && stage !== frozen.stage) {
      const earlier = STAGE_ORDER.slice(0, stageRank(stage));
      await this.prisma.dailyLessonCompletion.updateMany({
        where: { id: frozen.id, stage: { in: earlier } },
        data: { stage, stageAt: now },
      });
    }
    const vocabCursor = clampCursor(frozen?.vocabCursor, vocabNow.target);

    const prog = lessonProgress(segments);
    return {
      student: { id: student.id, name: student.name },
      date: day.toISOString().slice(0, 10),
      rulesVersion: LESSON_RULES_VERSION,
      completed: prog.completed,
      total: prog.total,
      allDone: lessonComplete(segments),
      streakDays: await this.lessonStreak(student.id, day),
      targetsFrozenAt: frozen?.targetsFrozenAt ?? null,
      // P3：当前阶段 + 翻卡断点（纯新增字段，旧前端忽略即可）
      stage,
      stageAt: frozen?.stageAt ?? null,
      vocabCursor,
      segments: [
        {
          key: 'read' as const,
          status: segments.read,
          label: readNow.paperName,
          questionCount: readNow.questionCount,
          /** 参考值，**不是限时** —— 来自近两周真实用时中位数 12.4 分钟 */
          typicalMinutes: 15,
          score: readNow.scoresPending ? null : readNow.score,
          maxScore: readNow.maxScore,
          scoresPending: readNow.scoresPending,
          submissionId: readNow.submissionId,
          autoClosed: segments.read === 'auto_closed',
        },
        {
          key: 'vocab' as const,
          status: segments.vocab,
          progress: vocabNow.progress,
          target: vTarget,
          typicalMinutes: Math.max(2, Math.ceil(vTarget / 5)),
        },
        {
          key: 'drill' as const,
          status: segments.drill,
          progress: drillNow.progress,
          target: dTarget,
          typicalMinutes: Math.max(2, dTarget),
        },
      ],
    };
  }

  /** 只在有变化时写库 —— 课程页会被反复打开，不必每次都 UPDATE。 */
  private async syncProgress(
    id: string,
    cur: {
      readProgress: number;
      readDoneAt: Date | null;
      readSource: string | null;
      vocabProgress: number;
      vocabDoneAt: Date | null;
      drillProgress: number;
      drillDoneAt: Date | null;
      autoFinalizeReason: string | null;
    },
    next: {
      readProgress: number;
      readSource: string | null;
      readDone: boolean;
      vocabProgress: number;
      vocabDone: boolean;
      drillProgress: number;
      drillDone: boolean;
      autoFinalizeReason: string | null;
      now: Date;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (cur.readProgress !== next.readProgress) data.readProgress = next.readProgress;
    if (cur.readSource !== next.readSource) data.readSource = next.readSource;
    if (next.readDone && !cur.readDoneAt) data.readDoneAt = next.now;
    if (cur.vocabProgress !== next.vocabProgress) data.vocabProgress = next.vocabProgress;
    if (next.vocabDone && !cur.vocabDoneAt) data.vocabDoneAt = next.now;
    if (cur.drillProgress !== next.drillProgress) data.drillProgress = next.drillProgress;
    if (next.drillDone && !cur.drillDoneAt) data.drillDoneAt = next.now;
    if (cur.autoFinalizeReason !== next.autoFinalizeReason) {
      data.autoFinalizeReason = next.autoFinalizeReason;
    }
    if (Object.keys(data).length === 0) return;
    await this.prisma.dailyLessonCompletion.update({ where: { id }, data });
  }

  // ── ① 读 ──
  private async readState(studentId: string, day: Date) {
    // **一个班一天可能有多场**（R10 多层：每个难度层一场）。
    // 第一版用 findFirst 随便挑了一场，于是学生明明交了卷，读段却显示
    // 「未开始」—— 挑中的是他没坐的那一层。生产 E2E 抓到。
    //
    // 正确顺序：先把今天所有可能的场次取出来，**优先认学生真有答卷的
    // 那一场**；一份都没有才退回列表里的第一场（此时只用来取标题，
    // 状态反正是 todo）。
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: {
        date: day,
        class: { enrollments: { some: { userId: studentId, role: 'student' } } },
      },
      select: {
        id: true,
        paperAssignment: {
          select: {
            id: true,
            paper: {
              select: { id: true, name: true, _count: { select: { questions: true } } },
            },
          },
        },
      },
    });
    const withAssignment = sessions.filter((s) => s.paperAssignment != null);
    if (withAssignment.length === 0) {
      return {
        hasSession: false,
        finalSubmitted: false,
        submitSource: null as SubmitSource | null,
        opened: false,
        paperName: null as string | null,
        questionCount: 0,
        score: null as number | null,
        maxScore: null as number | null,
        scoresPending: false,
        submissionId: null as string | null,
        autoFinalizeReason: null as string | null,
      };
    }

    const sub = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: { in: withAssignment.map((s) => s.paperAssignment!.id) },
        studentId,
        status: { not: 'practice' },
      },
      // 有最终提交的排前面 —— 万一同一天两层都开了卷，认已交的那份
      orderBy: [{ finalSubmittedAt: { sort: 'desc', nulls: 'last' } }, { startedAt: 'desc' }],
      select: {
        id: true,
        assignmentId: true,
        finalSubmittedAt: true,
        submitSource: true,
        autoFinalizeReason: true,
        status: true,
        totalScore: true,
        maxScore: true,
      },
    });
    const session =
      (sub && withAssignment.find((s) => s.paperAssignment!.id === sub.assignmentId)) ||
      withAssignment[0];
    // 分数门与答案门是两道独立的闸（§9）—— 这里只管分数那道
    const scoresPending = sub != null && !['marked', 'graded', 'returned'].includes(sub.status);
    return {
      hasSession: true,
      finalSubmitted: sub?.finalSubmittedAt != null,
      submitSource: (sub?.submitSource ?? null) as SubmitSource | null,
      opened: sub != null,
      // 学生看到《The Queue》而不是内部 setCode。认不出来返回 null，
      // UI 就不显示标题 —— 显示一串内部编号比不显示更糟。
      paperName: readablePaperTitle(session.paperAssignment!.paper?.name),
      questionCount: session.paperAssignment!.paper?._count.questions ?? 0,
      score: sub?.totalScore ?? null,
      maxScore: sub?.maxScore ?? null,
      scoresPending,
      submissionId: sub?.id ?? null,
      autoFinalizeReason: sub?.autoFinalizeReason ?? null,
    };
  }

  // ── ② 背 ──
  private async vocabState(studentId: string, now: Date) {
    const dueCount = await this.prisma.studentWord.count({
      where: { studentId, due: { lte: now } },
    });
    const backlog = dueCount;
    const target = vocabTarget(dueCount + 0, reviewBatchSize(backlog));
    // 「今天复习了几次」比的是时间戳 → 用真正的 SGT 零点，不是日期标签
    const dayStart = this.sgtMidnight(now);
    const progress = await this.prisma.wordReviewLog.count({
      where: { studentWord: { studentId }, reviewedAt: { gte: dayStart } },
    });
    // P6 —— 今天的正式单词测试交了没有。
    //
    // 这一条是必须的，不是锦上添花：正式测试**不写 WordReviewLog**
    // （考试是量一下，不是练一次），而背段的 progress 数的正是当天的
    // 复习流水。不认这一条的话，一个「教 5 个新词 → 考一次」的日子里
    // progress 永远是 0、背段永远不完成，stage 就卡死在 vocab_test ——
    // 和 P5 那次 unlearned 的死锁一模一样。
    // 按**本次任务**查（穿过 DLC 关系），不是「这个学生今天有没有交过
    // 某一份测试」—— 后者在任务与日历日不再一一对应时会认错人。
    const quizSubmitted = await this.prisma.vocabQuizAttempt.count({
      where: {
        status: 'submitted',
        dailyLessonCompletion: { studentId, date: this.sgtDayStart(now) },
      },
    });

    // 还没**教过**的到期词 —— 阶段判定要靠它区分「该教」还是「该考」。
    //
    // P5 起判据从 reps=0 换成 firstTaughtAt IS NULL AND reps=0（见
    // first-teaching.ts）。原来的 reps=0 有个致命循环：首次教学不再写
    // 评分之后 reps 永远是 0，unlearned 永远不降，stage 会卡在
    // vocab_learn 出不去 —— 学生天天被教同一批词。
    const unlearned = await this.prisma.studentWord.count({
      where: { studentId, due: { lte: now }, firstTaughtAt: null, reps: 0 },
    });
    return { target, progress, unlearned, quizSubmitted: quizSubmitted > 0 };
  }

  // ── ③ 补 ──
  private async drillState(studentId: string, now: Date) {
    const q = await this.mistakes.practiceQueue(studentId, 50);
    const queued = (q?.items ?? []).length;
    // 「今天练了几道」**直接数**，不要用「目标 - 队列剩余」去反推：
    // 目标封顶 5 而队列有 20 时那个式子恒为 0，学生练一天也不动；
    // 而且下午新错的题会让队列变长、进度倒退。
    const practicedToday = await this.prisma.mistakeEntry.count({
      where: { studentId, lastPracticedAt: { gte: this.sgtMidnight(now) } },
    });
    return {
      // 上限 5 —— 与背段同一条「目标必须可达成」原则。没有上限时课程页
      // 真的出现过「0/20 道 · 约 20 分钟」，那个数字只会劝退。
      target: drillTarget(queued + practicedToday),
      progress: practicedToday,
    };
  }

  /**
   * 连续完成天数 —— **只认整节课完成的日子**，口径沿用上学日算法
   * （周末不断）。与「连续复习天数」不同：那个只要背了词就算。
   */
  private async lessonStreak(studentId: string, today: Date): Promise<number> {
    const rows = await this.prisma.dailyLessonCompletion.findMany({
      where: { studentId, date: { lte: today } },
      orderBy: { date: 'desc' },
      take: 60,
      select: {
        date: true,
        readTarget: true,
        readDoneAt: true,
        vocabTarget: true,
        vocabDoneAt: true,
        drillTarget: true,
        drillDoneAt: true,
        readSource: true,
      },
    });
    const doneDays = rows
      .filter(
        (r) =>
          (r.readTarget === 0 || (r.readDoneAt != null && countsAsStudentDone(r.readSource as any))) &&
          (r.vocabTarget === 0 || r.vocabDoneAt != null) &&
          (r.drillTarget === 0 || r.drillDoneAt != null),
      )
      .map((r) => r.date.toISOString().slice(0, 10));
    return streakFromDays(doneDays, today.toISOString().slice(0, 10));
  }

  /**
   * P5 收尾 —— **教学卡「下一个」的唯一写操作**，一个事务做完两件事。
   *
   * ## 为什么必须原子
   *
   * 原来前端分别打 /vocab/first-taught 和 /lesson/vocab-cursor，两者之间
   * 有一个真实的不一致窗口：**cursor 前进了、firstTaughtAt 却没写上**。
   * 后果是死锁，不是小瑕疵 ——
   *   · 那个词永远 unlearned → deriveStage 永远返回 vocab_learn
   *   · 而 cursor 已经越过它 → 学生再进来直接从下一张开始，
   *     怎么翻都翻不到那张漏掉的卡
   *   · 于是 stage 永久停在 vocab_learn，进不了 vocab_test，
   *     这一天的课再也完不成
   *
   * 反方向（标记成功、cursor 没动）只是「明天再看一次同一张卡」，
   * 安全得多。所以两件事必须同生共死，且顺序上宁可先标记。
   *
   * ## 幂等
   *
   * 两个写都是条件写入：firstTaughtAt 只在仍为 null 时写，vocabCursor
   * 只在更小时前进。重复提交、双击、乱序到达、超时重发 —— 结果都一样。
   *
   * 返回真实的 cursor 与 stage，前端不做任何推测补偿。
   */
  async markTaughtAndAdvance(input: {
    studentName: string;
    studentId?: string;
    headword: string;
    cursor: number;
  }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId);
    const headword = (input.headword ?? '').trim();
    if (!headword) throw new BadRequestException({ code: 'headword_required' });

    const day = this.sgtDayStart(new Date());
    // NaN/Infinity 挡在 SQL 之前（P3 合并前验证抓到过一次）
    const raw = Number(input.cursor);
    const wanted = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;

    const result = await this.prisma.$transaction(async (tx) => {
      // ① 标记教过 —— 条件写入，只写这一个字段
      const marked = await tx.studentWord.updateMany({
        where: { studentId: student.id, headword, firstTaughtAt: null },
        data: { firstTaughtAt: new Date() },
      });
      if (marked.count === 0) {
        // 没更新到：本子里没这个词（异常，整笔回滚，cursor 也不许前进），
        // 还是早就标过了（正常的重复提交，继续推进 cursor）
        const exists = await tx.studentWord.findUnique({
          where: { studentId_headword: { studentId: student.id, headword } },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException({ code: 'word_not_in_notebook' });
      }

      // ② 单调推进断点 —— 与 saveVocabCursor 同一条件写入语义
      const bumped = await tx.dailyLessonCompletion.updateMany({
        where: { studentId: student.id, date: day, vocabCursor: { lt: wanted } },
        data: { vocabCursor: wanted },
      });
      let cursor = wanted;
      let stored = true;
      if (bumped.count === 0) {
        const row = await tx.dailyLessonCompletion.findUnique({
          where: { studentId_date: { studentId: student.id, date: day } },
          select: { vocabCursor: true },
        });
        // 没有当日记录说明学生还没打开过课程页 —— 不在这里创建
        //（创建是 today(freeze:true) 的职责）。教学本身已经落库了。
        if (!row) { cursor = 0; stored = false; }
        else cursor = row.vocabCursor;
      }
      return { cursor, stored, alreadyTaught: marked.count === 0 };
    });

    // 事务外回读真实阶段 —— 前端据此判断该不该进下一段，不自己猜。
    // freeze:false：只读，不在这里创建/冻结当日目标。
    const t = await this.today({
      studentName: input.studentName,
      studentId: input.studentId,
      freeze: false,
    });
    return {
      ok: true as const,
      headword,
      cursor: result.cursor,
      stored: result.stored,
      alreadyTaught: result.alreadyTaught,
      stage: t.stage,
    };
  }

  /**
   * 上报翻卡断点（P3）。**只写 cursor，不动 stage** —— 阶段由
   * today() 从事实推导，这里不越权。
   *
   * 单调钳制：只增不减。翻卡评分是并发上报的（弱网重发、快速连翻），
   * 乱序到达时旧值不能把进度冲回去。
   */
  async saveVocabCursor(input: { studentName: string; studentId?: string; cursor: number }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId);
    const day = this.sgtDayStart(new Date());
    // NaN/Infinity 必须挡在 SQL 之前：Math.max(0, Math.floor(NaN)) 仍是
    // NaN，会把脏值送进 where/data（服务层单测抓到）。
    const raw = Number(input.cursor);
    const wanted = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;

    // **条件更新，不是先读后写**（P3 合并前验证第 4 项）。
    //
    // 先读后写的写法在双标签页下会互相覆盖：旧标签页读到 5、写 3，
    // 把新进度冲回去。这里把单调性交给数据库 —— WHERE vocabCursor < ?
    // 由 PG 在行锁内判定，落后的写入匹配 0 行、直接是 no-op，无论两个
    // 请求以什么顺序到达。
    const bumped = await this.prisma.dailyLessonCompletion.updateMany({
      where: {
        studentId: student.id,
        date: day,
        vocabCursor: { lt: wanted },
      },
      data: { vocabCursor: wanted },
    });

    // 没更新到：要么没有当日记录（学生还没打开过课程页 —— 创建是
    // today(freeze:true) 的职责，那里才有完整的目标冻结逻辑），要么
    // 库里已经领先。回读一次把真实值告诉前端。
    if (bumped.count === 0) {
      const row = await this.prisma.dailyLessonCompletion.findUnique({
        where: { studentId_date: { studentId: student.id, date: day } },
        select: { vocabCursor: true },
      });
      if (!row) return { ok: true as const, cursor: 0, stored: false };
      return { ok: true as const, cursor: row.vocabCursor, stored: true };
    }
    return { ok: true as const, cursor: wanted, stored: true };
  }

  // ─────────────────── 教师端看板（PRD §4） ───────────────────

  /**
   * 一个班今天的完成度。
   *
   * 教师要找的是**三个 ○ 的人**（一点没动），以及「读✓ 背○」的人
   * （卷子做了词没背，明天早读点名）。分数保留但退居末列 —— 完成度是
   * 过程指标，分数是结果指标，每天盯的是前者。
   */
  async classBoard(classId: string, dateIso?: string) {
    const day = dateIso
      ? new Date(`${dateIso}T00:00:00.000Z`)
      : this.sgtDayStart();
    const roster = await this.prisma.classEnrollment.findMany({
      where: { classId, role: 'student', user: { archivedAt: null, isActive: true } },
      select: { user: { select: { id: true, name: true } } },
    });
    const rows = await Promise.all(
      roster.map(async (r) => {
        // freeze=false —— 教师看一眼不能给全班创建当日记录，否则
        // 「学生今天来过」这个信号就被教师的浏览污染了
        const t = await this.today({ studentName: r.user.name, studentId: r.user.id, freeze: false });
        const read = t.segments[0] as any;
        return {
          studentId: r.user.id,
          name: r.user.name,
          read: t.segments[0].status,
          vocab: t.segments[1].status,
          drill: t.segments[2].status,
          completed: t.completed,
          total: t.total,
          allDone: t.allDone,
          score: read.score ?? null,
          maxScore: read.maxScore ?? null,
          scoresPending: read.scoresPending ?? false,
        };
      }),
    );
    rows.sort((a, b) => a.completed - b.completed || a.name.localeCompare(b.name, 'zh'));
    return {
      classId,
      date: day.toISOString().slice(0, 10),
      rulesVersion: LESSON_RULES_VERSION,
      total: rows.length,
      allDoneCount: rows.filter((r) => r.allDone).length,
      untouchedCount: rows.filter((r) => r.completed === 0).length,
      students: rows,
    };
  }
}

export type { SegmentStatus };
