import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { VocabController } from './vocab.controller';
import { StudentWordService } from './student-word.service';
import { VocabService } from './vocab.service';

@Module({
  controllers: [VocabController],
  providers: [PrismaService, VocabService, StudentWordService],
  exports: [VocabService, StudentWordService],
})
export class VocabModule {}
