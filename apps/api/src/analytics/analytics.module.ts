import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [PrismaService, AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
