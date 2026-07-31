import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { StudentWordService } from './student-word.service';
import { VocabReviewService, type RatingKey } from './vocab-review.service';
import { VocabService } from './vocab.service';

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
@Controller('vocab')
export class VocabController {
  constructor(
    private readonly svc: VocabService,
    private readonly words: StudentWordService,
    private readonly review: VocabReviewService,
  ) {}

  /** 查单词。查不到返回 { found: false } —— 前端显示「未收录」，绝不猜词义。 */
  @Public()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
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
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Get('words')
  async listWords(@Query('name') name?: string, @Query('studentId') studentId?: string) {
    return this.words.listWords({ studentName: name ?? '', studentId: studentId || undefined });
  }

  /** 加入生词本。headword 由服务端查词典确定，不信任前端。 */
  @Public()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Post('words')
  async addWord(@Body() body: unknown) {
    const schema = z.object({
      studentName: z.string().min(1).max(50),
      studentId: z.string().optional(),
      word: z.string().min(1).max(64),
      contextSentence: z.string().max(500).optional(),
      sourcePaperQuestionId: z.string().optional(),
      sourcePassageTitle: z.string().max(200).optional(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.words.addWord(p.data);
  }

  /** 移出生词本。 */
  @Public()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Post('words/remove')
  async removeWord(@Body() body: unknown) {
    const schema = z.object({
      studentName: z.string().min(1).max(50),
      studentId: z.string().optional(),
      headword: z.string().min(1).max(64),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.words.removeWord(p.data);
  }
  // ─────────────────── P3 间隔重复复习 ───────────────────

  /** 今日待复习卡片（默认 5 张 —— 复习插在交卷后，给多了学生会直接跳过）。 */
  @Public()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Get('due')
  async due(
    @Query('name') name?: string,
    @Query('studentId') studentId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.review.due({
      studentName: name ?? '',
      studentId: studentId || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** 提交一次复习评分 → FSRS 重新调度。 */
  @Public()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Post('review')
  async submitReview(@Body() body: unknown) {
    const schema = z.object({
      studentName: z.string().min(1).max(50),
      studentId: z.string().optional(),
      headword: z.string().min(1).max(64),
      rating: z.enum(['again', 'hard', 'good', 'easy']),
      elapsedMs: z.number().int().min(0).max(600000).optional(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.review.review({ ...p.data, rating: p.data.rating as RatingKey });
  }

  /** 我的词汇统计。 */
  @Public()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Get('stats')
  async stats(@Query('name') name?: string, @Query('studentId') studentId?: string) {
    return this.review.stats({ studentName: name ?? '', studentId: studentId || undefined });
  }
}
