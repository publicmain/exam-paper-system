import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';

@Module({
  controllers: [PracticeController],
  providers: [PrismaService, PracticeService],
  exports: [PracticeService],
})
export class PracticeModule {}
