import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AiTutorController } from './ai-tutor.controller';
import { AiTutorService } from './ai-tutor.service';

/**
 * Block B9 — AI tutor chat for students.
 *
 * Wiring (the integrator must add this module to app.module.ts when
 * merging — see MERGE_INSTRUCTIONS.md). We deliberately do NOT import
 * AiModule here even though we use the same Anthropic SDK client, because
 * AiModule's services have semantics we don't share (image budgets,
 * question-bank generators). Instantiating Anthropic locally keeps
 * tutor cost accounting cleanly separated from the question-generation
 * spend audit.
 */
@Module({
  controllers: [AiTutorController],
  providers: [PrismaService, AiTutorService],
  exports: [AiTutorService],
})
export class AiTutorModule {}
