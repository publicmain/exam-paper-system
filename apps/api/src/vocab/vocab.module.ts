import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { VocabController } from './vocab.controller';
import { StudentWordService } from './student-word.service';
import { VocabQuizService } from './vocab-quiz.service';
import { VocabQuizAttemptService } from './vocab-quiz-attempt.service';
import { MistakeService } from './mistake.service';
import { PageViewService } from './page-view.service';
import { VocabReviewService } from './vocab-review.service';
import { VocabService } from './vocab.service';
import { VocabTeacherService } from './vocab-teacher.service';
import { RealtimeTranslationService } from './realtime-translation.service';

@Module({
  controllers: [VocabController],
  providers: [PrismaService, RealtimeTranslationService, VocabService, StudentWordService, VocabReviewService, VocabQuizService, VocabQuizAttemptService, VocabTeacherService, MistakeService, PageViewService],
  exports: [RealtimeTranslationService, VocabService, StudentWordService, VocabReviewService, VocabQuizService, VocabQuizAttemptService, VocabTeacherService, MistakeService, PageViewService],
})
export class VocabModule {}
