import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeTranslationService } from '../vocab/realtime-translation.service';
import { VocabularyV2Controller } from './vocabulary-v2.controller';
import { VocabularyV2TeacherController } from './vocabulary-v2-teacher.controller';
import { VocabularyV2Service } from './vocabulary-v2.service';
import { VocabularyV2ContentCron } from './content-producer.cron';
import { VocabularyV2DailyTaskCron } from './daily-task.cron';

@Module({
  controllers: [VocabularyV2Controller, VocabularyV2TeacherController],
  providers: [PrismaService, RealtimeTranslationService, VocabularyV2Service, VocabularyV2ContentCron, VocabularyV2DailyTaskCron],
  exports: [VocabularyV2Service],
})
export class VocabularyV2Module {}
