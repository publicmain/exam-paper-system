import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { QualityFeedbackController } from './quality-feedback.controller';
import { QualityFeedbackService } from './quality-feedback.service';

/**
 * Block B3 — AI question quality feedback loop.
 * Service is exported so other modules (review, student, marker) can
 * inject it directly instead of going over HTTP. The integrator must
 * register this module in `app.module.ts` (see MERGE_INSTRUCTIONS.md).
 */
@Module({
  controllers: [QualityFeedbackController],
  providers: [PrismaService, QualityFeedbackService],
  exports: [QualityFeedbackService],
})
export class QualityFeedbackModule {}
