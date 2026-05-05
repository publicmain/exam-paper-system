import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PerfRoutingController } from './perf-routing.controller';
import { PerfRoutingService } from './perf-routing.service';

/**
 * Performance-aware routing for AI question generation. Computes
 * per-class topic mastery from `AnswerScript.autoCorrect` and exposes
 * it so the AI generator (or a UI on top of it) can preferentially
 * target weak topics for a class.
 *
 * Stateless / read-only — no Prisma migrations required.
 */
@Module({
  controllers: [PerfRoutingController],
  providers: [PrismaService, PerfRoutingService],
  exports: [PerfRoutingService],
})
export class PerfRoutingModule {}
