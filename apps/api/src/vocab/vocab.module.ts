import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { VocabController } from './vocab.controller';
import { VocabService } from './vocab.service';

@Module({
  controllers: [VocabController],
  providers: [PrismaService, VocabService],
  exports: [VocabService],
})
export class VocabModule {}
