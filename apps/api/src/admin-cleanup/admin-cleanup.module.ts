import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AdminCleanupController } from './admin-cleanup.controller';
import { AdminCleanupService } from './admin-cleanup.service';

@Module({
  controllers: [AdminCleanupController],
  providers: [PrismaService, AdminCleanupService],
})
export class AdminCleanupModule {}
