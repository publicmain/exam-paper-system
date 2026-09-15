import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LearningReportController } from './learning-report.controller';
import { LearningReportService } from './learning-report.service';

@Module({
  controllers: [LearningReportController],
  providers: [PrismaService, LearningReportService],
})
export class LearningReportModule {}
