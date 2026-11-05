import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeTranslationService } from '../vocab/realtime-translation.service';
import { VocabularyV2Controller } from './vocabulary-v2.controller';
import { VocabularyV2TeacherController } from './vocabulary-v2-teacher.controller';
import { VocabularyV2Service } from './vocabulary-v2.service';
import { VocabularyV2ContentCron } from './content-producer.cron';
import { VocabularyV2DailyTaskCron } from './daily-task.cron';
import { VocabularyMemoryService } from './vocabulary-memory.service';
import { VocabularyMasteryService } from './mastery';
import { ExtraPracticeController } from './extra-practice.controller';
import { ExtraPracticeService } from './extra-practice';

@Module({
  controllers: [VocabularyV2Controller, VocabularyV2TeacherController, ExtraPracticeController],
  providers: [PrismaService, RealtimeTranslationService, VocabularyV2Service, VocabularyV2ContentCron, VocabularyV2DailyTaskCron, VocabularyMemoryService, VocabularyMasteryService, ExtraPracticeService],
  exports: [VocabularyV2Service, VocabularyMemoryService, VocabularyMasteryService],
})
export class VocabularyV2Module {}
