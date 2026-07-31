import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { VocabController } from './vocab.controller';
import { StudentWordService } from './student-word.service';
import { VocabReviewService } from './vocab-review.service';
import { VocabService } from './vocab.service';
import { VocabTeacherService } from './vocab-teacher.service';

@Module({
  controllers: [VocabController],
  providers: [PrismaService, VocabService, StudentWordService, VocabReviewService, VocabTeacherService],
  exports: [VocabService, StudentWordService, VocabReviewService, VocabTeacherService],
})
export class VocabModule {}
