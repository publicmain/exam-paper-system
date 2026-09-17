import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AchievementsController, AchievementsTeachingController } from './achievements.controller';
import { AchievementsService } from './achievements.service';

@Module({
  controllers: [AchievementsController, AchievementsTeachingController],
  // AuditService 来自全局 AuditModule
  providers: [PrismaService, AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
