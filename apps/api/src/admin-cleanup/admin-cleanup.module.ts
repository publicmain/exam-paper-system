import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AdminCleanupController } from './admin-cleanup.controller';
import { AdminCleanupService } from './admin-cleanup.service';
import { IeltsRepairService } from './ielts-repair.service';

@Module({
  controllers: [AdminCleanupController],
  providers: [PrismaService, AdminCleanupService, IeltsRepairService],
})
export class AdminCleanupModule {}
