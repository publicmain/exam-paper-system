import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AdminCostController } from './admin-cost.controller';
import { AdminCostService } from './admin-cost.service';

@Module({
  controllers: [AdminCostController],
  providers: [PrismaService, AdminCostService],
  exports: [AdminCostService],
})
export class AdminCostModule {}
