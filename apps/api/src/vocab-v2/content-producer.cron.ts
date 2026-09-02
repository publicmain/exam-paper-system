import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { runVocabularyContentBatch, vocabularyContentProviderConfigured } from './content-producer';

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
      if (result.selected) this.logger.log(`content batch selected=${result.selected} published=${result.published} rejected=${result.rejected} failed=${result.failed}`);
    } catch (error) {
      this.logger.warn(`content batch failed: ${String((error as Error).message || error).slice(0, 180)}`);
    } finally { this.running = false; }
  }
}
