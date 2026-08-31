import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StudentWordService } from '../vocab/student-word.service';
import { normalizeWord } from '../vocab/vocab.service';
import { MIN_QUIZ_ITEMS } from '../vocab/quiz-eligibility';
import { vocabScoreView, type VocabScoreView } from '../vocab/vocab-score';
import { nextActionOf } from './next-action';
import type { EnglishLevel } from '@prisma/client';
import { pickTodaySession, type SessionCandidate } from './pick-session';
import {
  vocabTargetOf,
  vocabProgressOf,
  hasAnyTask,
  progressForDisplay,
  lessonCardOrder,
} from './rc11-rules';
import { COURSE_QUEUE_MAX } from './lesson-rules';
import { isQuizWindowOpen } from '../morning-quiz/morning-quiz.service';
import {
  MISTAKES_UNAVAILABLE_REASON,
  mistakesAvailable,
} from './pilot-flags';
import { createRealSubmissionSafe } from '../common/submission-create';
import { resolveAuthenticatedStudent } from '../common/authenticated-student';
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
  coursePendingOf,
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
/** 把 'done' 压成 'partial' —— 段落还差最后一步（交卷）时用 */
function capAtPartial(st: SegmentStatus): SegmentStatus {
  return st === 'done' ? 'partial' : st;
}

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
  /**
   * **查询** —— 今天的课，纯读取。
   *
   * 一个字都不写：不创建当日任务、不推进阶段、不补词汇队列。教师看板、
   * 成绩页、任务总结都走这条。
   */
  async getToday(input: { studentName: string; studentId?: string; authStudentId?: string }) {
    return this.today({ ...input, freeze: false });
  }

  /**
   * **命令** —— 开始或恢复今天的课。
   *
   * 学生打开课程页、完成一张教学卡这类明确动作走这条：创建当日任务、
   * 把进度/阶段/词汇队列对齐到事实。
   *
   * 之所以要和 getToday 分成两个名字：布尔参数 `freeze` 会顺着调用链
   * 一路传下去，传到某个只想「看一眼」的地方就变成了一次写。教师看板
   * 改写全班 vocabWords 那个缺陷就是这么来的。
   */
  /**
   * **命令**：开始或恢复今天的课。
   *
   * `begin` 区分了两件不同的事：
   *
   * - `begin: false`（打开课程页）—— 建当日任务行、对齐进度与阶段、
   *   把新到期的词并进队列。恢复既有进度需要它落库：阶段门读的是库里
   *   的 stage，只在返回值里推导的话，学完词的学生开不出正式测试。
   * - `begin: true`（学生点了「开始今天的课程」）—— 额外**建正式答卷**。
   *   这一步必须显式：打开页面就建答卷，等于学生瞄一眼课程页就算参加了
   *   今天的考试。
   */
  async startOrResumeToday(input: { studentName: string; studentId?: string; authStudentId?: string; begin?: boolean }) {
    return this.today({ ...input, freeze: true, begin: input.begin === true });
  }

  private async today(input: {
    studentName: string;
    studentId?: string;
    /**
     * 阶段 5A 更正（2026-08-28）：**这个字段以前不在这里**。
     *
     * `getToday` / `startOrResumeToday` 的入参类型都声明了 `authStudentId`，
     * 也都 `...input` 传了进来 —— 但 `today()` 从不认它，只按
     * `resolveByIdOrName(studentId, studentName)` 查人。结果是：
     *
     * - 控制器把令牌 id 塞进 `studentId` 才能跑通（能用，但那是绕过去的）；
     * - 任何**直接调服务**的地方（`markTaughtAndAdvance` 就是一个）
     *   一旦只传 `authStudentId`，这里就拿到空姓名 + 空 id → `name_required`。
     *
     * 现在真的认它。
     */
    authStudentId?: string;
    freeze?: boolean;
    /** P9：学生明确点了「开始今天的课程」—— 只有这时才建正式答卷。 */
    begin?: boolean;
  }) {
    // **令牌优先**：与 vocab / morning-quiz 同一套资格谓词（阶段 5A），
    // 不查姓名、不消歧、不给近似姓名建议。没有令牌才走原来的 id/姓名路径，
    // 那条路径的判据一字未改。
    const student = input.authStudentId
      ? await resolveAuthenticatedStudent(this.prisma, input.authStudentId)
      : await this.resolveByIdOrName(input.studentId, input.studentName);
    const now = new Date();
    const day = this.sgtDayStart(now);

    // P9 —— 学生的长期难度决定他今天进哪一层（`User.englishLevel` 是
    // 唯一事实来源，P4）。账号制入口下没有人扫码替他指定场次，服务端
    // 必须自己算。
    const levelRow = await this.prisma.user.findUnique({
      where: { id: student.id },
      select: { englishLevel: true },
    });
    const studentLevel = levelRow?.englishLevel ?? null;

    /** S12L —— 补段这个能力今天开不开放（产品开关，不是「今天有没有错题」）。 */
    const drillAvailable = mistakesAvailable();
    const availability = { read: true, vocab: true, drill: drillAvailable };

    // RC1.1：词段要按**已冻结的队列**算，所以先把任务行读出来。
    // （下面还会再读一次 frozen —— 那一次在可能的写入之后，拿到的是
    // 最新值；这一次只用来决定词段的口径。）
    const frozenForVocab = await this.prisma.dailyLessonCompletion.findUnique({
      where: { studentId_date: { studentId: student.id, date: day } },
      select: { vocabWords: true },
    });
    const frozenQueue = Array.isArray(frozenForVocab?.vocabWords)
      ? (frozenForVocab!.vocabWords as string[])
      : null;

    // ── 三段的现况 ──
    let [readNow, vocabNow, drillNow] = await Promise.all([
      this.readState(student.id, day, studentLevel),
      this.vocabState(student.id, now, frozenQueue),
      // S12L —— 补段暂停时**连查都不查**。给学生看一个他进不去的段落，
      // 还为它跑一次错题队列查询，是两件都不该做的事。
      drillAvailable
        ? this.drillState(student.id, now)
        : Promise.resolve({ target: 0, progress: 0 }),
    ]);

    // ── P9：账号制的「开始今天的课程」──
    //
    // 在这之前，正式答卷**只有扫码会建**（attendance.service.scanQr）。
    // 于是一个登录了的学生打开课程页，服务端明知道今天有他那层的卷子，
    // 却只能告诉他「去找老师要二维码」。这是账号制 APP 的根本阻塞点。
    //
    // 现在：登录本身就是资格。start 命令负责把答卷建出来 —— 用的是 P1
    // 的同一个防线（partial unique + 撞墙自愈），所以双击、并发、两台
    // 设备同时点，都只会有一份。
    if (input.begin && readNow.availability === 'ready' && !readNow.opened && readNow.assignmentId) {
      // 首次落定难度（P4）：只在库里仍是 null 时写，条件写保证并发下
      // 不会互相覆盖，也不会把已落定的人改掉。
      if (readNow.landLevel) {
        await this.prisma.user.updateMany({
          where: { id: student.id, englishLevel: null },
          data: { englishLevel: readNow.landLevel },
        });
      }
      await createRealSubmissionSafe(this.prisma, {
        assignmentId: readNow.assignmentId,
        studentId: student.id,
        maxScore: readNow.paperMaxScore,
      });
      // 答卷建好了，读段的事实变了（opened / sessionId / submissionId）——
      // 重新读一次，别让这次调用返回一个刚刚过期的快照。
      readNow = await this.readState(student.id, day, studentLevel);
    }

    // ── 目标：已冻结就用冻结值，否则（且允许时）现在冻结 ──
    let frozen = await this.prisma.dailyLessonCompletion.findUnique({
      where: { studentId_date: { studentId: student.id, date: day } },
    });

    //
    // RC1.1 —— **今天什么都没有就不要建任务行**。
    //
    // 人工测试实测：测试七号（今天没排课、没到期词）主页正确显示
    // 「今天的课程还没有发布」，进课程页却看到「🎉 今天的课完成了 ·
    // 连续 1 天」，库里还留下一条 stage=done。
    //
    // 根因：三段目标全是 0 → deriveStage 认为三段都 settled → done；
    // 而连续天数数的正是「三个 target 要么为 0 要么已完成」的行 ——
    // 一个没有内容的日子被算成了学习日。
    //
    // 没有内容就没有任务。等真的排了课再建。
    const hasAnyTaskToday = hasAnyTask({
      hasSession: readNow.hasSession,
      vocabTarget: vocabNow.target,
      drillTarget: drillNow.target,
    });
    if (!frozen && input.freeze && hasAnyTaskToday) {
      frozen = await this.prisma.dailyLessonCompletion.create({
        data: {
          studentId: student.id,
          date: day,
          readTarget: readNow.hasSession ? 1 : 0,
          vocabTarget: vocabNow.target,
          drillTarget: drillNow.target,
          // 与 vocabTarget 同一时刻冻结：目标数和被数的那批词必须是同一批。
          // 这是**新任务的初始化**，属于「学生明确开始今天的课」这个动作。
          vocabWords: vocabNow.desiredQueue as any,
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
          // 队列跟着目标一起重算 —— 但**只补不删**（并集），已经在里面的
          // 词不会因为重新冻结而消失
          vocabWords: [
            ...new Set([
              ...(Array.isArray(frozen.vocabWords) ? (frozen.vocabWords as string[]) : []),
              ...vocabNow.desiredQueue,
            ]),
          ] as any,
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
    // S12L —— 暂停时目标恒为 0，连历史上冻结过的目标也不认（否则今天
    // 打开课程页的学生会顶着一个进不去的 0/5）。
    const dTarget = drillAvailable ? (frozen?.drillTarget ?? drillNow.target) : 0;

    // 考试范围以**任务记下的队列**为准（不是此刻的到期集合）——
    // 旧任务 vocabWords=NULL 时它是空的，考不起来，正是 legacy 的语义。
    const taskQueue: string[] = Array.isArray(frozen?.vocabWords)
      ? (frozen!.vocabWords as string[]).map((w) => normalizeWord(String(w))).filter(Boolean)
      : [];
    const quizRequired = await this.quizRequiredFor(student.id, taskQueue);

    const segments: LessonSegments = {
      read: readTarget === 0 ? 'none' : readStatus(readNow),
      // 交了当天的正式测试就算背段完成 —— 「学完再考一次」本来就是
      // 这一段的终点。
      //
      // 反过来：**这次任务考得起来的话，背段就不能靠复习次数自己收尾**。
      // 不封这一手，纯复习日里学生复习完背段就 done、stage 直接跳过
      // vocab_test，正式测试永远开不了（阶段门会拒）。考不起来的日子
      // （教过的词不够一份卷子）仍按复习次数判定，老行为不变。
      vocab: vocabNow.quizSubmitted
        ? 'done'
        : quizRequired
          ? capAtPartial(segmentStatus(vocabNow.progress, vTarget))
          : segmentStatus(vocabNow.progress, vTarget),
      drill: segmentStatus(drillNow.progress, dTarget),
    };

    // ── 任务阶段（P3）──
    // 从事实推导，再与库里存的做单调钳制（只前进不后退）。stage 是
    // 缓存：即使与事实短暂不一致，下一次读就会被事实纠正。
    // ── 课程卡还剩没剩 ──
    //
    // **队列、owned、断点三者必须取自同一份快照。**
    //
    // `vocabState()` 跑在可能的创建 / 重新冻结**之前**：当日任务行还不存在
    // 时它看到的队列是 null，重新冻结扩过队列时它看到的是旧队列。拿那时的
    // owned 去配现在的 `vocabWords`，交集必然偏小 —— 最狠的一种是「刚创建
    // 的四词纯复习任务算出 0 张卡」，阶段当场落成 `vocab_test`，而
    // `clampStage` 是单调的，学生再也回不到学词段。
    //
    // 所以 owned 在这里**按最终队列重新查一次**，不复用 vocabState 的结果。
    const frozenQueueNow = Array.isArray(frozen?.vocabWords)
      ? (frozen!.vocabWords as string[])
      : null;
    const ownedForCourse = frozenQueueNow
      ? await this.prisma.studentWord.findMany({
          where: { studentId: student.id, headword: { in: frozenQueueNow } },
          select: { headword: true },
        })
      : [];
    const courseCards = frozenQueueNow
      ? lessonCardOrder(
          frozenQueueNow,
          ownedForCourse.map((w) => w.headword),
        )
      : null;

    const derived = deriveStage({
      readSettled: isSegmentComplete(segments.read),
      vocabSettled: isSegmentComplete(segments.vocab),
      hasPendingCourseCards: coursePendingOf({
        courseCards,
        // **原始断点**，不是 clampCursor 的结果（它把「走完」也压成 0）
        cursor: frozen?.vocabCursor,
        hasAttempt: vocabNow.attempt != null,
        legacyHasUnlearnedWords: vocabNow.unlearned > 0,
      }),
      drillSettled: isSegmentComplete(segments.drill),
      drillAvailable,
    });
    const stage: LessonStage = clampStage(frozen?.stage, derived);

    // ── 唯一的写入口 ──
    //
    // **freeze:true 才写**。freeze 的含义从「要不要创建当日记录」扩成
    // 「这是不是一次明确的学生动作」：打开课程页是，教师看板不是。
    //
    // 教师看板走 today(freeze:false)。它原来会写三样东西 —— 进度快照、
    // 阶段、词汇队列 —— 于是教师看一眼就改了全班的数据，队列内容还被
    // 「教师什么时候看的」决定。现在那条路一个字都不写。
    if (input.freeze && frozen) {
      await this.reconcileTask({
        frozen: frozen as any,
        studentId: student.id,
        now,
        segments,
        readNow,
        vocabProgress: vocabNow.progress,
        drillProgress: drillNow.progress,
        desiredQueue: vocabNow.desiredQueue,
        hasAttempt: vocabNow.attempt != null,
        stage,
      });
    }
    const vocabCursor = clampCursor(frozen?.vocabCursor, vocabNow.target);

    const progRaw = lessonProgress(segments, availability);
    // 无内容日：三段目标都是 0，isSegmentComplete 会把它们全算成"完成"。
    // 那是"没有东西要做"的副产物，不是学生做完了 —— 不能显示 3/3，
    // 更不能让它进连续天数。
    const prog = progressForDisplay(progRaw, hasAnyTaskToday);
    // P8 —— **服务端决定唯一的下一步**。前端只负责显示它，不再让学生
    // 在三张并排的卡片里自己判断该点哪个。
    const nextAction = nextActionOf({
      stage,
      availability: readNow.availability,
      opened: readNow.opened,
      finalSubmitted: readNow.finalSubmitted,
      sessionId: readNow.sessionId,
      submissionId: readNow.submissionId,
      // 有队列才开得出正式测试（旧任务 vocabWords=NULL → 开不出）
      vocabTestAvailable: frozen != null && frozen.vocabWords != null,
      // 今天有没有事情要做。三段目标全为 0 = 今天什么都没排。
      hasAnyTask:
        readNow.hasSession ||
        (frozen?.vocabTarget ?? vocabNow.target) > 0 ||
        (frozen?.drillTarget ?? drillNow.target) > 0,
      // S12H 返工 1/2 —— **补段的事实必须真的传进去**。
      //
      // v1.0 把 drill 分支写好了却没接线，那个能力因此是惰性的，
      // 用户看到的「补段 0/5 却写着看总结」原样还在。
      //
      // 三个值全部来自**服务端自己算好的事实**，与 `deriveStage`
      // 用的是同一组（`dTarget` / `drillNow.progress`），不另起炉灶；
      // 请求体与查询串里没有任何一个能影响它们。
      drillTarget: dTarget,
      drillProgress: drillNow.progress,
      vocabQuizSubmitted: vocabNow.quizSubmitted,
    });
    return {
      student: { id: student.id, name: student.name },
      date: day.toISOString().slice(0, 10),
      nextAction,
      rulesVersion: LESSON_RULES_VERSION,
      completed: prog.completed,
      total: prog.total,
      allDone: lessonComplete(segments, availability),
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
          sessionId: readNow.sessionId,
          autoClosed: segments.read === 'auto_closed',
          available: true,
        },
        {
          key: 'vocab' as const,
          status: segments.vocab,
          progress: vocabNow.progress,
          target: vTarget,
          typicalMinutes: Math.max(2, Math.ceil(vTarget / 5)),
          /**
           * P7 —— **正式词汇成绩，与阅读成绩分开**。
           *
           * 它只来自这次任务名下 status='submitted' 的 VocabQuizAttempt。
           * 上面的 progress/target 是**完成度**（今天复习了几次），不是
           * 成绩；两者不要混着看。
           */
          quizScore: vocabScoreView(
            frozen != null && frozen.vocabWords != null,
            vocabNow.attempt,
          ),
          available: true,
        },
        {
          key: 'drill' as const,
          status: segments.drill,
          progress: drillNow.progress,
          target: dTarget,
          typicalMinutes: Math.max(2, dTarget),
          //
          // S12L —— `available: false` 与 `status: 'none'` 不是一回事。
          // 前者是「这个能力现在整个关着」，后者是「有这一段，今天没内容」。
          // 只有前者会被踢出分母。
          available: drillAvailable,
          unavailableReason: drillAvailable ? null : MISTAKES_UNAVAILABLE_REASON,
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
  /**
   * P9 —— 认人：**有 id 就按 id**，没有才退回姓名。
   *
   * 账号制下身份来自登录令牌（里面有 id），姓名不该再参与认人：
   *
   * - 学生改过名、或令牌是改名前签发的 → 按姓名查会「找不到这个人」，
   *   一个正常登录的学生被挡在门外
   * - 同名同学（35 人的班里真的有过）→ 姓名根本不是身份
   *
   * 姓名分支原样保留：没登录的公开查询路径（输名字看成绩）还在用它。
   */
  private async resolveByIdOrName(studentId: string | undefined, studentName: string) {
    if (studentId) {
      const byId = await this.prisma.user.findFirst({
        where: {
          id: studentId,
          isActive: true,
          classEnrollments: { some: { role: 'student', class: { archivedAt: null } } },
        },
        select: { id: true, name: true },
      });
      if (byId) return byId;
    }
    return this.words.resolveStudent(studentName, studentId);
  }

  private async readState(studentId: string, day: Date, studentLevel: EnglishLevel | null = null) {
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
        // P9：只有 active 的场次算「已发布」。scheduled / ended 的不该被
        // 学生自助开出来。
        status: 'active',
      },
      select: {
        id: true,
        level: true,
        // P9 —— 挑场次要看此刻还能不能作答，作答窗判断需要这几个字段
        quizEnd: true,
        makeupStart: true,
        makeupEnd: true,
        // P9.5 —— 全天模式按班灰度，且「全天」限于这一场的那一天
        classId: true,
        date: true,
        class: { select: { name: true } },
        paperAssignment: {
          select: {
            id: true,
            paper: {
              select: {
                id: true,
                name: true,
                totalMarksActual: true,
                _count: { select: { questions: true } },
              },
            },
          },
        },
      },
    });
    const withAssignment = sessions.filter((s) => s.paperAssignment != null);
    if (withAssignment.length === 0) {
      return {
        hasSession: false,
        availability: 'no_content' as const,
        landLevel: null as EnglishLevel | null,
        assignmentId: null as string | null,
        paperMaxScore: 0,
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
        sessionId: null as string | null,
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
    // P9 —— 没有答卷时由**服务端**挑今天上哪一场（账号制入口：没有人
    // 扫码替他指定）。已经有答卷的照旧认答卷那一场 —— 历史任务不因为
    // 学生后来改了难度而变。
    //
    // 挑选必须确定性：不同请求挑到不同场次 = 不同 assignment = 两份
    // 正式答卷，答卷唯一索引（按 assignmentId）拦不住。
    const nowForWindow = new Date();
    const candidates: SessionCandidate[] = withAssignment.map((x) => ({
      id: x.id,
      level: x.level,
      hasPaper: true,
      windowOpen: isQuizWindowOpen(
        {
          quizEnd: x.quizEnd,
          makeupStart: x.makeupStart,
          makeupEnd: x.makeupEnd,
          classId: x.classId,
          date: x.date,
        },
        nowForWindow,
      ),
    }));
    const picked = pickTodaySession({
      storedLevel: studentLevel,
      candidates,
      isTestClass: (withAssignment[0].class?.name ?? '').startsWith('【测试】'),
    });
    const session =
      (sub && withAssignment.find((s) => s.paperAssignment!.id === sub.assignmentId)) ||
      (picked.kind === 'session' ? withAssignment.find((x) => x.id === picked.sessionId)! : null) ||
      withAssignment[0];
    // 分数门与答案门是两道独立的闸（§9）—— 这里只管分数那道
    const scoresPending = sub != null && !['marked', 'graded', 'returned'].includes(sub.status);
    return {
      hasSession: true,
      // 已经有答卷的人，「今天有没有课」这个问题早就有答案了 —— 他正在
      // 上。窗口关了也不该把他的进度说成「没有内容」。
      availability: sub != null ? ('ready' as const) : (
        picked.kind === 'session' ? ('ready' as const) : picked.kind
      ),
      landLevel: picked.kind === 'session' ? picked.land : null,
      assignmentId: session.paperAssignment!.id,
      paperMaxScore: session.paperAssignment!.paper?.totalMarksActual ?? 0,
      finalSubmitted: sub?.finalSubmittedAt != null,
      submitSource: (sub?.submitSource ?? null) as SubmitSource | null,
      opened: sub != null,
      // 学生看到《The Queue》而不是内部 setCode。认不出来返回 null，
      // UI 就不显示标题 —— 显示一串内部编号比不显示更糟。
      // P8：课程页要能直接把学生送进今天这一场（原来读段只有「已交卷
      // 才有的逐题详情」链接，没开始的学生在课程页上找不到入口）
      sessionId: session.id,
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
  private async vocabState(studentId: string, now: Date, frozenQueue?: string[] | null) {
    const dayStart = this.sgtMidnight(now);
    //
    // RC1.1 —— **正式词段的目标与进度只认当前任务队列**。
    //
    // 人工测试实测：测试五号还没开始阅读，直接去自由练习做了一张卡，
    // 主页的「背 · 今日词汇」就从 0/4 变成 1/3 —— 目标数被自由练习
    // 改小了，随后冻结出来的正式考试范围也只剩 3 个词。
    //
    // 两处根因都在这里：
    //   · target 用的是**此刻**到期的词数 —— 复习过一张，那张的 due 被
    //     FSRS 推远，分母就少一个
    //   · progress 数的是这个学生今天**所有**的复习流水 —— 不管那张卡
    //     属不属于今天的任务、是不是在课程里做的
    //
    // 现在：任务已经冻结 → 一切以 vocabWords 为准；还没冻结 → 分母算
    // 「今天到期过的」（把今天已经复习掉的加回来，所以复习不会让它缩水），
    // 进度为 0（还没开始今天的课，谈不上正式进度）。
    const queue = Array.isArray(frozenQueue) ? frozenQueue : null;

    // 今天到期过的：此刻仍到期的 + 今天已经复习过的（后者的 due 已被推远）
    const dueNowCount = await this.prisma.studentWord.count({
      where: { studentId, due: { lte: now } },
    });
    const reviewedTodayWords = await this.prisma.studentWord.count({
      where: {
        studentId,
        due: { gt: now },
        reviews: { some: { reviewedAt: { gte: dayStart } } },
      },
    });
    const dueCount = dueNowCount + reviewedTodayWords;
    const backlog = dueCount;
    void reviewBatchSize(backlog);
    void vocabTarget;
    const target = vocabTargetOf({
      frozenQueue: queue,
      // 未冻结时用「今天到期过的」——判据见 rc11-rules
      dueNow: dueNowCount,
      reviewedTodayCount: reviewedTodayWords,
    });
    //
    // S12L —— 词段的进度是**今天这批词教了几个**，不再是「今天复习了几次」。
    //
    // 课程学词现在只教不测（教学卡刻意不写 WordReviewLog），旧口径下
    // 进度会永远停在 0/21 —— 学生翻完二十一张卡，主页还写着一个都没做。
    // 「教过」是单调、幂等、且正是这一段在做的那件事。
    const taughtRows = queue
      ? await this.prisma.studentWord.findMany({
          where: { studentId, headword: { in: queue }, firstTaughtAt: { not: null } },
          select: { headword: true },
        })
      : [];
    const progress = vocabProgressOf({
      frozenQueue: queue,
      taughtWords: taughtRows.map((r) => r.headword),
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
    // P7 —— 正式词汇成绩的**唯一来源**：这次任务名下的那一份 attempt。
    // 顺带回答「交了没有」（背段完成条件要用）。自由练习与
    // WordReviewLog 一律不参与。
    const attempt = await this.prisma.vocabQuizAttempt.findFirst({
      where: { dailyLessonCompletion: { studentId, date: this.sgtDayStart(now) } },
      select: { status: true, submittedAt: true, total: true, correct: true, score: true, items: true },
    });
    const quizSubmitted = attempt?.status === 'submitted' ? 1 : 0;

    // 还没**教过**的到期词 —— 阶段判定要靠它区分「该教」还是「该考」。
    //
    // P5 起判据从 reps=0 换成 firstTaughtAt IS NULL AND reps=0（见
    // first-teaching.ts）。原来的 reps=0 有个致命循环：首次教学不再写
    // 评分之后 reps 永远是 0，unlearned 永远不降，stage 会卡在
    // vocab_learn 出不去 —— 学生天天被教同一批词。
    // 同上：任务冻结之后，「还有没教过的词吗」只问队列里的那几个。
    // 不然自由练习加进来的新词会把已经走到「该考」的学生拉回「该教」。
    const unlearned = await this.prisma.studentWord.count({
      where: queue
        ? { studentId, headword: { in: queue }, firstTaughtAt: null, reps: 0 }
        : { studentId, due: { lte: now }, firstTaughtAt: null, reps: 0 },
    });
    // 当前到期队列 —— **只读**，这里绝不落库。
    //
    // 上一版在这里就把它并进 DLC.vocabWords 了。那是个真缺陷：vocabState
    // 是所有读取路径都会走的「看一眼状态」，教师打开看板也会走 —— 于是
    // 教师浏览一次就改写了全班学生的任务队列，而且改写时刻决定了队列内容
    // （学生做完词、due 被 FSRS 推远之后再补，补进来的不是他上午做过的那批）。
    //
    // 现在它只**算出**想要的队列，写不写、什么时候写由 today() 的
    // reconcile 决定，而 reconcile 只在明确的学生动作（freeze:true）里跑。
    //
    // RC1.1 —— 队列口径与 target 保持一致：**今天到期过的**，而不是
    // 「此刻仍到期的」。
    //
    // 差别在自由练习上：学生在开始今天的课之前先去自由练习做掉一张，
    // 那个词的 due 就被 FSRS 推到明天 —— 等他真的开始上课、冻结队列的
    // 那一刻，这个词已经不在「此刻到期」里了。人工测试实测：正式考试
    // 范围因此从 4 个词缩成 3 个。自由练习改变了正式考试范围。
    const dueQueue = await this.prisma.studentWord.findMany({
      where: {
        studentId,
        OR: [
          { due: { lte: now } },
          // 今天已经复习过的：due 被推远了，但它今天确实到期过
          { reviews: { some: { reviewedAt: { gte: dayStart } } } },
        ],
      },
      orderBy: [{ due: 'asc' }, { createdAt: 'asc' }],
      take: 60,
      select: { headword: true },
    });
    // 注意：**这里不再算「队列里学生拥有哪些词」**。
    // vocabState 跑在可能的创建 / 重新冻结之前，它手里的 `queue` 未必是最终
    // 队列；课程卡的张数由 today() 在写入之后按最终队列自己查一次。
    return {
      target,
      progress,
      unlearned,
      quizSubmitted: quizSubmitted > 0,
      /**
       * 这一刻的到期队列（规范化去重）。调用方决定要不要落库。
       *
       * S12L —— **封顶 30**。到期 60 个词的学生今天要被教 60 张卡、
       * 然后考 60 道题；那不是学习计划，是劝退。已经冻结过的队列不受
       * 这一条影响（`take` 只作用于新队列），旧任务照原样跑完。
       */
      desiredQueue: [
        ...new Set(dueQueue.map((w) => normalizeWord(w.headword)).filter(Boolean)),
      ].slice(0, COURSE_QUEUE_MAX),
      /** 当日正式测试那一行（可能没有）—— 成绩视图与阶段判定都要用 */
      attempt,
    };
  }

  /**
   * 这次任务考不考得起来：队列里**教过**的词够不够一份卷子。
   *
   * 背段原来「复习够次数就算完成」。纯复习日里学生一复习完背段就 done、
   * stage 直接跳过 vocab_test，正式测试永远开不了。所以只要考得起来，
   * 背段就不能靠复习次数自己收尾，必须等交卷。
   */
  private async quizRequiredFor(studentId: string, queue: string[]): Promise<boolean> {
    if (!queue.length) return false;
    const testable = await this.prisma.studentWord.count({
      where: { studentId, firstTaughtAt: { not: null }, headword: { in: queue } },
    });
    return testable >= MIN_QUIZ_ITEMS;
  }

  /**
   * 队列还能不能扩充。
   *
   * 走到「该考」或已经开了卷之后就冻住 —— 考试范围一旦成立就不该再变，
   * 否则学生做题做到一半，考纲还在长。
   */
  private queueStillOpen(frozen: { stage?: string | null } | null, hasAttempt: boolean): boolean {
    if (!frozen || hasAttempt) return false;
    return stageRank(String(frozen.stage ?? STAGE_ORDER[0])) < stageRank('vocab_test');
  }

  /**
   * **写**：把这次任务的进度、阶段、词汇队列对齐到事实。
   *
   * 只有明确的学生动作才调用它 —— 打开课程页（today freeze:true）、
   * 完成一张教学卡。教师看板走的是 today(freeze:false)，那条路一个字
   * 都不写。
   */
  private async reconcileTask(input: {
    frozen: { id: string; stage: string | null; vocabWords: unknown };
    studentId: string;
    now: Date;
    segments: LessonSegments;
    readNow: { submitSource?: string | null; autoFinalizeReason?: string | null };
    vocabProgress: number;
    drillProgress: number;
    desiredQueue: string[];
    hasAttempt: boolean;
    stage: LessonStage;
  }) {
    const { frozen, now } = input;

    await this.syncProgress(frozen.id, frozen as any, {
      readProgress: input.segments.read === 'done' ? 1 : 0,
      readSource: (input.readNow.submitSource as any) ?? null,
      readDone: input.segments.read === 'done',
      vocabProgress: input.vocabProgress,
      vocabDone: input.segments.vocab === 'done' || input.segments.vocab === 'none',
      drillProgress: input.drillProgress,
      drillDone: input.segments.drill === 'done' || input.segments.drill === 'none',
      autoFinalizeReason: input.readNow.autoFinalizeReason ?? null,
      now,
    });

    // 阶段：条件更新，只允许从更早的阶段跃迁（两个标签页并发时落后的
    // 那个匹配 0 行）
    if (input.stage !== frozen.stage) {
      const earlier = STAGE_ORDER.slice(0, stageRank(input.stage));
      await this.prisma.dailyLessonCompletion.updateMany({
        where: { id: frozen.id, stage: { in: earlier } },
        data: { stage: input.stage, stageAt: now },
      });
    }

    // 词汇队列：并集、只增不减，且走到「该考」之后就不再扩充。
    //
    // vocabWords 为 NULL 的旧任务**不在这里自愈** —— 见 initTaskQueue 的
    // 注释：普通读取不许把 NULL 变成「此刻的到期集合」，那是拿部署时刻的
    // 数据伪造历史任务的考试范围。
    if (frozen.vocabWords != null && this.queueStillOpen(frozen, input.hasAttempt)) {
      const prev = Array.isArray(frozen.vocabWords)
        ? (frozen.vocabWords as string[]).map((w) => normalizeWord(String(w))).filter(Boolean)
        : [];
      const next = [...new Set([...prev, ...input.desiredQueue])];
      if (next.length !== prev.length) {
        await this.prisma.dailyLessonCompletion.update({
          where: { id: frozen.id },
          data: { vocabWords: next as any },
        });
      }
    }
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
          // S12L —— 补段关着的时候它不参与连续天数。历史行里存着
          // drillTarget=3 而 drillDoneAt 为空的日子，不该因为一个已经
          // 关掉的功能把学生的连胜清零。
          (!mistakesAvailable() || r.drillTarget === 0 || r.drillDoneAt != null),
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
    /** 阶段 5A：已认证学生的 id。给了就走精确 ID 路径，不查姓名。 */
    authStudentId?: string;
    headword: string;
    cursor: number;
  }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId, input.authStudentId);
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

      // ①.5 把这个词记进**这次任务的词汇队列**。
      //
      // 冻结时的快照可能没包含它（比如扫码推词发生在冻结之后）。学生是
      // 通过这次任务的教学卡学的它，它就属于这次任务 —— 这条写入和
      // firstTaughtAt 在同一个事务里，不会出现「教了但不算这次任务的」。
      const dlcRow = await tx.dailyLessonCompletion.findUnique({
        where: { studentId_date: { studentId: student.id, date: day } },
        select: { id: true, vocabWords: true },
      });
      if (dlcRow) {
        const list: string[] = Array.isArray(dlcRow.vocabWords)
          ? (dlcRow.vocabWords as string[]).map((w) => normalizeWord(String(w)))
          : [];
        const key = normalizeWord(headword);
        if (key && !list.includes(key)) {
          await tx.dailyLessonCompletion.update({
            where: { id: dlcRow.id },
            data: { vocabWords: [...list, key] as any },
          });
        }
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

    // 事务外把阶段对齐并回读 —— 前端据此判断该不该进下一段，不自己猜。
    //
    // **这里必须用 freeze:true**：完成一张教学卡是明确的学生动作，阶段要
    // 真的落库（P6 的阶段门读的是 DLC.stage 这个缓存，不落库的话学生教完
    // 最后一张卡也开不了正式测试）。freeze 现在的含义是「这是不是学生的
    // 明确动作」，不再只是「要不要创建当日记录」。
    //
    // 副作用可控：走到这一步说明学生正在上今天的课，创建/对齐当日任务行
    // 本来就是应该的。
    // **身份要跟着走完整条链。**
    //
    // 上面那个事务已经提交了（`firstTaughtAt` / `vocabWords` / `vocabCursor`）。
    // 这一步只是把课程状态对齐，却要重新解析一次学生 —— 之前这里只转了
    // `studentName` / `studentId`，token-only 请求里这两个都是空的，于是
    // **写已经落库、请求却报 `name_required`**。半截写入配一个身份错误，
    // 是这条链上最糟的一种失败。
    const t = await this.startOrResumeToday({
      studentName: input.studentName,
      studentId: input.studentId,
      authStudentId: input.authStudentId,
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
  async saveVocabCursor(input: { studentName: string; studentId?: string; authStudentId?: string; cursor: number }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId, input.authStudentId);
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
    let cursor = wanted;
    let stored = true;
    if (bumped.count === 0) {
      const row = await this.prisma.dailyLessonCompletion.findUnique({
        where: { studentId_date: { studentId: student.id, date: day } },
        select: { vocabCursor: true },
      });
      if (!row) {
        // 没有当日任务行 —— **什么都不建**，行为与从前逐字一致。
        return { ok: true as const, cursor: 0, stored: false };
      }
      cursor = row.vocabCursor;
    }

    // ── 阶段对齐（S9D1）——与教学路径同一刀 ──
    //
    // 正式测试的阶段门读的是**落库**的 `DailyLessonCompletion.stage`，而
    // `/lesson/today` 返回的是推导 + 钳制之后的值。两者只有在有人把推导值
    // 写回库时才一致，而写回只发生在 `today(freeze:true)`。
    //
    // 教学路径早就补过这一刀（见 `markTaughtAndAdvance` 结尾的注释：
    // 「不落库的话学生教完最后一张卡也开不了正式测试」）。复习路径一直没有 ——
    // 于是纯复习日走完四张卡之后，`/lesson/today` 说 `vocab_test`、UI 显示
    // 「开始单词测试」，点下去 `attempt/start` 读到落库的 `reading`，
    // 409 `stage_not_ready`，弹回今天的课。学生靠自己出不去。
    // staging 上的 t5_review 实测就是这样。
    //
    // 三条边界：
    //   · **只有任务行确实存在时才走**（上面已经 return 掉 stored=false），
    //     所以这里不会凭空创建任务行；
    //   · 阶段规则**不在这里重写一份** —— 推导、单调钳制、写不写，全部沿用
    //     `today()` 那一套；
    //   · 身份**整条链传下去**，含 `authStudentId`。token-only 请求里
    //     `studentName` / `studentId` 都是空的，漏传会让这一步报
    //     `name_required`（教学路径踩过同一个坑）。
    await this.startOrResumeToday({
      studentName: input.studentName,
      studentId: input.studentId,
      authStudentId: input.authStudentId,
    });

    // 响应形状与从前**逐字一致**：{ ok, cursor, stored }
    return { ok: true as const, cursor, stored };
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
        const t = await this.getToday({ studentName: r.user.name, studentId: r.user.id });
        // S12L —— **按 key 找，不按下标**。段落数组一旦增删（比如补段
        // 暂停后被拿掉），下标就会静默错位到别的段上。
        const seg = (k: 'read' | 'vocab' | 'drill') =>
          (t.segments.find((x) => x.key === k) ?? null) as any;
        const read = seg('read');
        return {
          studentId: r.user.id,
          name: r.user.name,
          read: read?.status ?? 'none',
          vocab: seg('vocab')?.status ?? 'none',
          drill: seg('drill')?.status ?? 'none',
          completed: t.completed,
          total: t.total,
          allDone: t.allDone,
          // 阅读成绩（既有语义不动：totalScore 含卷内词汇题的分）
          score: read.score ?? null,
          maxScore: read.maxScore ?? null,
          scoresPending: read.scoresPending ?? false,
          // P7：正式词汇成绩，与上面三个字段**分开**，互不覆盖
          vocabScore: seg('vocab')?.quizScore as VocabScoreView,
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
