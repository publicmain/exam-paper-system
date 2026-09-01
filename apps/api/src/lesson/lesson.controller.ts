import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { RequireStudentToken, StudentIdentityGuard } from '../common/student-identity.guard';
import { identityOf } from '../common/student-identity-input';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import { z } from 'zod';
import { LessonService } from './lesson.service';

/**
 * 每日一课（4.0 阶段 A，docs/PRD/morning-quiz-4.0-daily-lesson.md §5.2）。
 *
 * 全部只读 —— A 阶段是**影子运行**，这个模块不参与任何答题闸门。
 * 学生端沿用「公开 + 姓名匹配 + 带 token 时校验」的既有模式。
 */
@UseGuards(StudentIdentityGuard)
@Controller('lesson')
export class LessonController {
  constructor(
    private readonly svc: LessonService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 学生：今天的课。
   *
   * **这个接口会冻结当日目标**（首次调用时）—— 「学生打开了课程页」
   * 就是冻结时刻的定义。教师看板走 /class 那条，不冻结。
   */
  // P7 —— 加**学生令牌门**。
  //
  // 这个接口原来只认请求里的 name 字符串：报个名字就能读别人的课程状态，
  // 而里面本来就有阅读成绩，P7 又要往里放正式词汇成绩。成绩必须是
  // 「只能看自己的」。教师的只读视角（teacher_view 令牌）照样能看 ——
  // 那正是「看到学生看到的东西」。
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Get('today')
  async today(
    @Req() req: Request,
    @Query('name') name?: string,
    @Query('studentId') studentId?: string,
  ) {
    // P9：与 /lesson/start 同一口径 —— 身份来自 token，姓名只是兼容。
    const auth = (req as unknown as { studentAuth?: { id: string; name: string } }).studentAuth;
    if (!auth?.id && !(name ?? '').trim() && !studentId) {
      // 旧错误码，一字不改 —— 这个端点从来报的就是 student_required
      throw new BadRequestException({ code: 'student_required' });
    }
    // **纯读取**（P8）。原来这个 GET 会创建当日任务、推进阶段、补词汇
    // 队列 —— 一个 GET 有写副作用，教师看板和总结页一读就改数据。
    // 开始/恢复课程改走下面的 POST /lesson/start。
    //
    // 阶段 5A 更正：有令牌时**只传 authStudentId**，不再把令牌里的姓名
    // 塞进 studentName。令牌签发后姓名可能改过，把它当查询条件传下去，
    // 等于用一个可疑的等价物冒充精确查询。
    return this.svc.getToday(
      auth?.id
        ? { studentName: '', authStudentId: auth.id }
        : { studentName: name ?? '', studentId: studentId || undefined },
    );
  }

  /**
   * **命令**：开始或恢复今天的课。
   *
   * 学生打开课程页时调用。它才会创建当日任务行、把进度与阶段对齐、
   * 把新到期的词并进任务队列。
   */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Post('start')
  async start(@Body() body: unknown, @Req() req: Request) {
    const schema = z.object({
      // P9：姓名只是**兼容字段**，不再是身份来源。账号登录后 token 里
      // 就有身份，学生不该每天再报一次名字（报名字这条路也意味着「报
      // 谁的名字就是谁」，那是 P7 修掉的越权读）。
      name: z.string().min(1).max(120).optional(),
      studentId: z.string().min(1).max(60).optional(),
      /**
       * P9：学生明确点了「开始今天的课程」。
       *
       * 只有它为 true 时才建正式答卷 —— 打开课程页（begin 缺省）只做
       * 恢复：建任务行、对齐阶段、并入新到期的词。分开是因为「瞄一眼
       * 课程页」不该等于「参加了今天的考试」。
       */
      begin: z.boolean().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    // token 里的身份优先。StudentIdentityGuard 已经保证了：带 token 时
    // body 里的 name/studentId 必须对得上，对不上直接 403。
    const auth = (req as unknown as { studentAuth?: { id: string; name: string } }).studentAuth;
    if (!auth?.id && !(parsed.data.name ?? '').trim() && !parsed.data.studentId) {
      throw new BadRequestException({ code: 'student_required' });
    }
    // 阶段 5A 更正：与 GET /today 同一口径 —— 有令牌就只传 authStudentId，
    // 服务端按精确 id 查人；令牌里的姓名不参与解析。
    return this.svc.startOrResumeToday({
      ...(auth?.id
        ? { studentName: '', authStudentId: auth.id }
        : { studentName: parsed.data.name ?? '', studentId: parsed.data.studentId || undefined }),
      begin: parsed.data.begin === true,
    });
  }

  /**
   * P5 收尾 —— 教学卡「下一个」：一次调用，事务里标记「教过」+ 推进断点。
   *
   * 取代原来分别打 /vocab/first-taught 与 /lesson/vocab-cursor 的两步 ——
   * 那两步之间有「cursor 前进了但 firstTaughtAt 没写上」的窗口，会把
   * stage 永久锁死在 vocab_learn。
   */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Post('vocab-taught')
  async vocabTaught(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      studentId: z.string().min(1).max(60).optional(),
      headword: z.string().min(1).max(80),
      cursor: z.number().int().min(0).max(500),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.markTaughtAndAdvance({
      ...identityOf(req, parsed.data.name, parsed.data.studentId),
      headword: parsed.data.headword,
      cursor: parsed.data.cursor,
    });
  }

  /** 学生已经会当前词：服务端原位补一个同课备用词，且同步改考试范围。 */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Post('vocab-replace')
  async vocabReplace(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      studentId: z.string().min(1).max(60).optional(),
      headword: z.string().min(1).max(80),
      cursor: z.number().int().min(0).max(500),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.replaceKnownLessonWord({
      ...identityOf(req, parsed.data.name, parsed.data.studentId),
      headword: parsed.data.headword,
      cursor: parsed.data.cursor,
    });
  }

  /**
   * 上报翻卡断点（P3）。学生退出/刷新/换设备后从这里恢复位置。
   *
   * 写操作 → 必须带学生 token（@RequireStudentToken 由 Guard 强制），
   * 与所有其它学生写接口同一道闸。
   */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Post('vocab-cursor')
  async saveVocabCursor(@Req() req: Request, @Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(1).max(50).optional(),
      studentId: z.string().optional(),
      cursor: z.number().int().min(0).max(500),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.saveVocabCursor({
      ...identityOf(req, p.data.name, p.data.studentId),
      cursor: p.data.cursor,
    });
  }

  /** 教师：班级完成度看板。 */
  @Get('class')
  async classBoard(
    @Query('classId') classId: string,
    @Query('date') date: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!classId) throw new BadRequestException({ code: 'class_id_required' });
    if (!(await canActOnClass(this.prisma, { id: user.id, role: user.role }, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    return this.svc.classBoard(classId, date);
  }
}
