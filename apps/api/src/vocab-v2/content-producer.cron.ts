import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { CONTENT_JOB_POLICY, runVocabularyContentBatch, vocabularyContentProviderConfigured } from './content-producer';

@Injectable()
export class VocabularyV2ContentCron {
  private readonly logger = new Logger(VocabularyV2ContentCron.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 2026-10-20 起默认**不跑**，要显式设 `VOCAB_AUTO_CONTENT_ENABLED=1` 才开。
   *
   * 这个每 5 分钟一次的任务就是「越清越冒」的发动机：例句一下架，它就把那个词当成
   * 缺内容，去 Tatoeba 拉一条没人审过的新句子写回去。现在内容是白名单 —— 学生只能
   * 看到审过的 —— 新例句由 agent 为中学生专门写、审过再导入，不需要它自动补。
   * 就算以后有人打开，它写进来的也只会是 pending_review，学生看不到。
   */
  @Cron('*/5 * * * *', { name: 'vocabulary-v2-content-producer' })
  async produce() {
    if (process.env.VOCAB_AUTO_CONTENT_ENABLED !== '1') return;
    if (this.running || !vocabularyContentProviderConfigured()) return;
    this.running = true;
    try {
      const result = await runVocabularyContentBatch(this.prisma, Number(process.env.VOCAB_CONTENT_BATCH_SIZE || 25));
      if (result.selected) {
        const extra = (['reclaimed', 'exhausted', 'superseded', 'skipped'] as const)
          .map((key) => ((result as Record<string, unknown>)[key] ? ` ${key}=${(result as Record<string, unknown>)[key]}` : ''))
          .join('');
        this.logger.log(`content batch selected=${result.selected} published=${result.published} rejected=${result.rejected} failed=${result.failed}${extra}`);
        // VOC14：租约过期回收 / 次数用完定格要让人看得见
        if ((result as { exhausted?: number }).exhausted) this.logger.warn(`content jobs gave up after ${CONTENT_JOB_POLICY.maxAttempts} attempts: ${(result as { exhausted?: number }).exhausted}`);
      }
    } catch (error) {
      this.logger.warn(`content batch failed: ${String((error as Error).message || error).slice(0, 180)}`);
    } finally { this.running = false; }
  }
}
