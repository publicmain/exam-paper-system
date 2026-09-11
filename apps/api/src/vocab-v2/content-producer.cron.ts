import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { CONTENT_JOB_POLICY, runVocabularyContentBatch, vocabularyContentProviderConfigured } from './content-producer';

@Injectable()
export class VocabularyV2ContentCron {
  private readonly logger = new Logger(VocabularyV2ContentCron.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('*/5 * * * *', { name: 'vocabulary-v2-content-producer' })
  async produce() {
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
