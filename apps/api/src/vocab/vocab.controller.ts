import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import {
  RequireStudentToken,
  StudentIdentityGuard,
  type RequestWithStudentAuth,
} from '../common/student-identity.guard';
import { identityOf } from '../common/student-identity-input';
import { StudentWordService } from './student-word.service';
import { VocabQuizService } from './vocab-quiz.service';
import { VocabQuizAttemptService } from './vocab-quiz-attempt.service';
import { VocabReviewService, type RatingKey } from './vocab-review.service';
import { VocabService } from './vocab.service';
import { VocabTeacherService } from './vocab-teacher.service';
import { MistakeService } from './mistake.service';
import { PageViewService } from './page-view.service';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';

/**
 * 生词本 —— 查词接口（P1，只读）。
 *
 * Public：学生在复盘页点词时并没有登录态（/my-history 是公开 + 姓名匹配 +
 * 校园网 IP 门禁的模式），所以查词也必须免登录。查词本身不返回任何学生数据，
 * 只返回词典释义，无隐私风险。
 *
 * 限流：点词是高频操作（读一篇文章可能点十几次），给一个宽松但足以挡住
 * 爬词典的阈值。
 */
/**
 * 限流口径（2026-08-24 调整）：scope:'ip' + 学校 NAT = **全班共用一个
 * 配额**。34 人在 9:00 前后几分钟内同时走「交卷 → 翻卡(≤20 次评分) →
 * 自测 → 错题重练」，单是 POST /review 就可能冲到 400+/分钟。原来的
 * 60~120/分钟会让后半段学生集体 429 —— 而评分失败是静默吞掉的，表现为
 * FSRS 默默丢复习记录。放宽后的数字按「34 人并发峰值 × 1.5」估，仍足以
 * 挡住逐词爬词典的脚本。
 */
/**
 * 学生身份（2026-08-25 外部审查 P0-1）：
 *   · 带了学生 token 就必须与请求里的姓名对得上（拦「拿自己的 token
 *     操作别人」）
 *   · 所有**写操作**必须带 token（见各方法上的 @RequireStudentToken）
 *   · 读操作无 token 时降级为姓名匹配，保住「不登录也能查成绩」的入口
 * 详见 student-identity.guard.ts 顶部。
 */
@UseGuards(StudentIdentityGuard)
@Controller('vocab')
export class VocabController {
  constructor(
    private readonly svc: VocabService,
    private readonly words: StudentWordService,
    private readonly review: VocabReviewService,
    private readonly quiz: VocabQuizService,
    private readonly teacher: VocabTeacherService,
    private readonly mistakes: MistakeService,
    private readonly views: PageViewService,
    private readonly prisma: PrismaService,
    private readonly attempts: VocabQuizAttemptService,
  ) {}

  /**
   * 直接解析出学生（少数端点要的是 id，不是入参对象）。
   * 身份口径与 identityOf 完全一致 —— 它就是拿 identityOf 的结果去解析。
   */
  private resolveIdentity(req: Request, name?: string, studentId?: string) {
    const i = identityOf(req, name, studentId);
    return this.words.resolveStudent(i.studentName, i.studentId, i.authStudentId);
  }


  /** 查单词。查不到返回 { found: false } —— 前端显示「未收录」，绝不猜词义。 */
  @Public()
  @RateLimit({ limit: 240, windowSec: 60, scope: 'ip' })
  @Get('lookup')
  async lookup(@Query('word') word?: string) {
    const w = (word ?? '').trim();
    if (!w) throw new BadRequestException({ code: 'word_required' });
    if (w.length > 64) throw new BadRequestException({ code: 'word_too_long' });
    const hit = await this.svc.lookup(w);
    return hit ? { found: true as const, entry: hit } : { found: false as const, query: w };
  }

  // ─────────────────── P2 生词本 ───────────────────

  /** 我的生词本。姓名匹配（同名时需带 studentId），与 /my-history 同口径。 */
  @Public()
  @RateLimit({ limit: 180, windowSec: 60, scope: 'ip' })
  @Get('words')
  async listWords(
@Req() req: Request,
@Query('name') name?: string, @Query('studentId') studentId?: string) {
    return this.words.listWords(identityOf(req, name, studentId));
  }

  /** 加入生词本。headword 由服务端查词典确定，不信任前端。 */
  @Public()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @RequireStudentToken()
  @Post('words')
  async addWord(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      studentName: z.string().min(1).max(50).optional(),
      studentId: z.string().optional(),
      word: z.string().min(1).max(64),
      contextSentence: z.string().max(500).optional(),
      sourcePaperQuestionId: z.string().optional(),
      sourcePassageTitle: z.string().max(200).optional(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.words.addWord({ ...p.data, ...identityOf(req, p.data.studentName, p.data.studentId) });
  }

  /** 移出生词本。 */
  @Public()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @RequireStudentToken()
  @Post('words/remove')
  async removeWord(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      studentName: z.string().min(1).max(50).optional(),
      studentId: z.string().optional(),
      headword: z.string().min(1).max(64),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.words.removeWord({ ...p.data, ...identityOf(req, p.data.studentName, p.data.studentId) });
  }
  // ─────────────────── P3 间隔重复复习 ───────────────────

  /** 今日待复习卡片（默认 5 张 —— 复习插在交卷后，给多了学生会直接跳过）。 */
  @Public()
  @RateLimit({ limit: 180, windowSec: 60, scope: 'ip' })
  @Get('due')
  async due(
@Req() req: Request,
@Query('name') name?: string,
    @Query('studentId') studentId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.review.due({
      ...identityOf(req, name, studentId),
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * RC1.1 —— 课程内词汇学习的卡片（**固定队列**）。
   *
   * 与 `/due` 的区别：这里按当天任务冻结的 `vocabWords` 发卡，顺序、
   * 张数、断点都由任务决定，刷新和换设备拿到的完全一样。
   *
   * 今天还没有冻结队列时返回 `{ lessonContext: false }`，调用方退回
   * 自由练习。
   */
  @Public()
  @RateLimit({ limit: 180, windowSec: 60, scope: 'ip' })
  @Get('lesson-cards')
  async lessonCards(
@Req() req: Request,
@Query('name') name?: string, @Query('studentId') studentId?: string) {
    const r = await this.review.lessonCards({
      ...identityOf(req, name, studentId),
    });
    return r ?? { lessonContext: false as const, cards: [], cursor: 0, totalDue: 0 };
  }

  /** 提交一次复习评分 → FSRS 重新调度。 */
  @Public()
  @RateLimit({ limit: 480, windowSec: 60, scope: 'ip' })
  @RequireStudentToken()
  @Post('review')
  async submitReview(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      studentName: z.string().min(1).max(50).optional(),
      studentId: z.string().optional(),
      headword: z.string().min(1).max(64),
      rating: z.enum(['again', 'hard', 'good', 'easy']),
      elapsedMs: z.number().int().min(0).max(600000).optional(),
      // 弱网重发去重：前端每次评分生成一个 UUID，失败重发时带同一个
      requestId: z.string().max(64).optional(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.review.review({
      ...p.data,
      ...identityOf(req, p.data.studentName, p.data.studentId),
      rating: p.data.rating as RatingKey,
    });
  }

  /** 撤销该词最近一次评分（10 分钟内）。误触防线 —— 详见 review 服务注释。 */
  @Public()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @RequireStudentToken()
  @Post('review/undo')
  async undoReview(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      studentName: z.string().min(1).max(50).optional(),
      studentId: z.string().optional(),
      headword: z.string().min(1).max(64),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.review.undo({ ...p.data, ...identityOf(req, p.data.studentName, p.data.studentId) });
  }

  /**
   * 生词自测（P5）—— 组一套百词斩式选择题。出题纯本地计算（学生生词 +
   * 本地词典做干扰项），零 AI。答题结果由前端经既有 POST /vocab/review
   * 写回（对→good 错→again），复用同一条 FSRS 调度线。
   */
  @Public()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Get('quiz')
  async quizBuild(
@Req() req: Request,
@Query('name') name?: string,
    @Query('studentId') studentId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.quiz.buildQuiz({
      ...identityOf(req, name, studentId),
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─────────────────── P6 错题本 ───────────────────

  /** 我的错题本。收录门槛见 mistake.service 顶部注释（不是每道错题都进）。 */
  @Public()
  @RateLimit({ limit: 180, windowSec: 60, scope: 'ip' })
  @Get('mistakes')
  async listMistakes(
@Req() req: Request,
@Query('name') name?: string,
    @Query('studentId') studentId?: string,
    @Query('includeResolved') includeResolved?: string,
  ) {
    const student = await this.resolveIdentity(req, name, studentId);
    // 这里**不埋点**。成绩页要拿错题数做徽标，也会打这个接口 —— 在
    // 服务端埋点会把"打开成绩页"误记成"打开错题本",而这个区分正是
    // 埋点存在的理由。改由前端 MyMistakes 页面显式 track('mistakes')。
    const r = await this.mistakes.listForStudent(student.id, {
      includeResolved: includeResolved === '1',
    });
    return { student: { id: student.id, name: student.name }, ...r };
  }

  /** 标记「已弄懂」/ 撤销。错题本必须能清空，否则只会一直变长。 */
  @Public()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @RequireStudentToken()
  @Post('mistakes/resolve')
  async resolveMistake(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      studentName: z.string().min(1).max(50).optional(),
      studentId: z.string().optional(),
      id: z.string().min(1),
      resolved: z.boolean().default(true),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    const student = await this.resolveIdentity(req, p.data.studentName, p.data.studentId);
    return this.mistakes.resolve(student.id, p.data.id, p.data.resolved);
  }

  /**
   * 今日错题练习队列（带原文）。段落匹配/判断题离开原文没法真正重做，
   * 所以每道题带完整 passage 下发。每天最多 10 道。
   */
  @Public()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Get('mistakes/practice-queue')
  async practiceQueue(
@Req() req: Request,
@Query('name') name?: string,
    @Query('studentId') studentId?: string,
    @Query('limit') limit?: string,
  ) {
    const student = await this.resolveIdentity(req, name, studentId);
    const r = await this.mistakes.practiceQueue(
      student.id,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { student: { id: student.id, name: student.name }, ...r };
  }

  /** 提交一次练习结果。做对且隔天再对一次 → 自动销账。 */
  @Public()
  @RateLimit({ limit: 360, windowSec: 60, scope: 'ip' })
  @RequireStudentToken()
  @Post('mistakes/practice-result')
  async practiceResult(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      studentName: z.string().min(1).max(50).optional(),
      studentId: z.string().optional(),
      id: z.string().min(1),
      correct: z.boolean(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    const student = await this.resolveIdentity(req, p.data.studentName, p.data.studentId);
    return this.mistakes.practiceResult(student.id, p.data.id, p.data.correct);
  }

  // ─────────────────── P6 访问埋点 ───────────────────

  /**
   * 记录一次学生自助页访问。前端在页面加载成功后调用，失败静默。
   * 只记 谁/哪类页面/哪天 —— 不记 IP、UA、停留时长。
   */
  @Public()
  @RateLimit({ limit: 240, windowSec: 60, scope: 'ip' })
  @RequireStudentToken()
  @Post('page-view')
  async recordPageView(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      studentName: z.string().min(1).max(50).optional(),
      studentId: z.string().optional(),
      kind: z.enum(['history', 'submission_detail', 'vocab', 'vocab_practice', 'vocab_review', 'vocab_banner', 'mistakes', 'mistake_practice']),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    try {
      const student = await this.resolveIdentity(req, p.data.studentName, p.data.studentId);
      await this.views.record(student.id, p.data.kind);
    } catch {
      /* 埋点绝不能影响学生看成绩 */
    }
    return { ok: true };
  }

  /** 班级参与度（教师端）。回答"判分后到底有多少人回来看"。 */
  @Get('class/:classId/engagement')
  async classEngagement(
    @Param('classId') classId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query('days') days?: string,
  ) {
    // 班级权限沿用与 classTop/classStats 相同的守卫
    if (!(await canActOnClass(this.prisma, { id: user.id, role: user.role }, classId))) {
      throw new ForbiddenException({ code: 'forbidden_class' });
    }
    const d = days ? parseInt(days, 10) : 14;
    const [engagement, never] = await Promise.all([
      this.views.classEngagement(classId, d),
      this.views.neverLookedBack(classId, d),
    ]);
    return { ...engagement, students: never };
  }

  /** 我的词汇统计。 */
  @Public()
  @RateLimit({ limit: 180, windowSec: 60, scope: 'ip' })
  @Get('stats')
  async stats(
@Req() req: Request,
@Query('name') name?: string, @Query('studentId') studentId?: string) {
    return this.review.stats(identityOf(req, name, studentId));
  }

  // ─────────────────── P4 教师端 ───────────────────
  // 以下三个接口需要登录 + 班级权限（canActOnClass），非 @Public。

  /** 班级高频生词榜 —— 回答"今天该讲哪几个词"。 */
  @Get('class/:classId/top')
  async classTop(
    @Param('classId') classId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ) {
    return this.teacher.classTop(
      classId,
      { id: user.id, role: user.role, ip: (req as any).ip ?? null },
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        days: days ? parseInt(days, 10) : undefined,
      },
    );
  }

  /** 老师推一批词给全班（已有的词跳过，重复推送安全）。 */
  @Post('push')
  async pushWords(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    // items 为逐词例句（推荐），words 为整批共用一句的旧形式。
    // 两者至少给一个，合计不超过 50 词。
    const schema = z
      .object({
        classId: z.string().min(1),
        words: z.array(z.string().min(1).max(64)).max(50).optional(),
        items: z
          .array(
            z.object({
              word: z.string().min(1).max(64),
              context: z.string().max(500).optional(),
            }),
          )
          .max(50)
          .optional(),
        contextSentence: z.string().max(500).optional(),
      })
      .refine((v) => (v.words?.length ?? 0) + (v.items?.length ?? 0) > 0, {
        message: 'words 或 items 至少给一个',
      });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.teacher.pushWords(p.data, {
      id: user.id,
      role: user.role,
      ip: (req as any).ip ?? null,
    });
  }

  /** 班级生词执行情况（采集量 / 已掌握 / 复习总次数）。 */
  @Get('class/:classId/stats')
  async classStats(@Param('classId') classId: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.teacher.classStats(classId, {
      id: user.id,
      role: user.role,
      ip: (req as any).ip ?? null,
    });
  }

  // ─────────────── P6 · 正式单词测试（有成绩） ───────────────
  //
  // 四个端点**一律要求学生令牌**（@RequireStudentToken）。旧的
  // GET /vocab/quiz 只认请求里的 name 字符串，等于「报个名字就能读
  // 别人的题」；成绩实体不能重复这个错误 —— 读别人的成绩、替别人交卷
  // 都必须过身份门。

  /** 开始或恢复当日正式测试。幂等：已有就原样返回。 */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Post('quiz/attempt/start')
  async quizStart(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      studentId: z.string().min(1).max(60).optional(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.attempts.start(identityOf(req, p.data.name, p.data.studentId));
  }

  /** 回读当日测试（刷新 / 重新登录后恢复）。没有就返回 { attempt: null }。 */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 180, windowSec: 60, scope: 'ip' })
  @Get('quiz/attempt/current')
  async quizCurrent(
@Req() req: Request,
@Query('name') name?: string, @Query('studentId') studentId?: string) {
    return this.attempts.current(identityOf(req, name, studentId));
  }

  /** 记一题的作答。第一次作答为准，重复提交 no-op。 */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 240, windowSec: 60, scope: 'ip' })
  @Post('quiz/attempt/answer')
  async quizAnswer(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      studentId: z.string().min(1).max(60).optional(),
      index: z.number().int().min(0).max(50),
      optionIndex: z.number().int().min(0).max(10).optional(),
      text: z.string().max(80).optional(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.attempts.answer({
      ...identityOf(req, p.data.name, p.data.studentId),
      index: p.data.index,
      optionIndex: p.data.optionIndex,
      text: p.data.text,
    });
  }

  /** 提交。幂等：双击 / 重试只会有一份成绩。 */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Post('quiz/attempt/submit')
  async quizSubmit(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      studentId: z.string().min(1).max(60).optional(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.attempts.submit(identityOf(req, p.data.name, p.data.studentId));
  }

  /** 历史成绩（只读）。 */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Get('quiz/attempts')
  async quizAttempts(
@Req() req: Request,
@Query('name') name?: string, @Query('studentId') studentId?: string) {
    return this.attempts.history(identityOf(req, name, studentId));
  }
}
