import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CodegraderController } from './codegrader.controller';
import { CodegraderService } from './codegrader.service';

@Module({
  controllers: [CodegraderController],
  providers: [PrismaService, CodegraderService],
  exports: [CodegraderService],
})
export class CodegraderModule {}
