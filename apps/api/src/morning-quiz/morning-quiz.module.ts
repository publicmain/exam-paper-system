import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../common/prisma.service';
import { ShuffleModule } from '../shuffle/shuffle.module';
import { StudentModule } from '../student/student.module';
import { WechatNotifyModule } from '../wechat-notify/wechat-notify.module';
import { MorningQuizController } from './morning-quiz.controller';
import { MorningQuizCron } from './morning-quiz.cron';
import { MorningQuizExportService } from './morning-quiz-export.service';
import { MorningQuizService } from './morning-quiz.service';
import { ShortAnswerEvaluatorService } from './short-answer-evaluator.service';
import { MorningQuizWeeklyCron } from './morning-quiz-weekly-cron';
import { AbsenceAlertService } from './absence-alert.service';
import { AbsenceAlertCron } from './absence-alert.cron';

@Module({
  imports: [ShuffleModule, StudentModule, AiModule, AuditModule, WechatNotifyModule],
  controllers: [MorningQuizController],
  providers: [
    PrismaService,
    MorningQuizService,
    MorningQuizCron,
    MorningQuizExportService,
    ShortAnswerEvaluatorService,
    MorningQuizWeeklyCron,
    AbsenceAlertService,
    AbsenceAlertCron,
  ],
  exports: [MorningQuizService, ShortAnswerEvaluatorService, AbsenceAlertService],
})
export class MorningQuizModule {}
