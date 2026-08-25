import { Injectable, Logger } from '@nestjs/common';
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
  lessonProgress,
  readStatus,
  segmentStatus,
  vocabTarget,
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
      this.drillState(student.id),
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
    }

    // 冻结记录缺失（教师看板 / 学生还没进过课程页）时用当下值兜底，
    // 行为与冻结后一致，只是不写库
    const readTarget = frozen?.readTarget ?? (readNow.hasSession ? 1 : 0);
    const vTarget = frozen?.vocabTarget ?? vocabNow.target;
    const dTarget = frozen?.drillTarget ?? drillNow.target;

    const segments: LessonSegments = {
      read: readTarget === 0 ? 'none' : readStatus(readNow),
      vocab: segmentStatus(vocabNow.progress, vTarget),
      // 补段的 progress = 「今天清掉了几道」= 冻结时的目标 - 现在还剩几道
      drill: segmentStatus(Math.max(0, dTarget - drillNow.remaining), dTarget),
    };

    // 把进度写回快照（目标不动，只更新进度与完成时刻）
    if (frozen) {
      await this.syncProgress(frozen.id, frozen, {
        readProgress: segments.read === 'done' ? 1 : 0,
        readSource: readNow.submitSource ?? null,
        readDone: segments.read === 'done',
        vocabProgress: vocabNow.progress,
        vocabDone: segments.vocab === 'done' || segments.vocab === 'none',
        drillProgress: Math.max(0, dTarget - drillNow.remaining),
        drillDone: segments.drill === 'done' || segments.drill === 'none',
        autoFinalizeReason: readNow.autoFinalizeReason ?? null,
        now,
      });
    }

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
          progress: Math.max(0, dTarget - drillNow.remaining),
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
      paperName: session.paperAssignment!.paper?.name ?? null,
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
    return { target, progress };
  }

  // ── ③ 补 ──
  private async drillState(studentId: string) {
    const q = await this.mistakes.practiceQueue(studentId, 50);
    const remaining = (q?.items ?? []).length;
    return { target: remaining, remaining };
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
