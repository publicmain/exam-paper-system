import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ShortAnswerEvaluatorService } from '../morning-quiz/short-answer-evaluator.service';
import { WechatNotifyModule } from '../wechat-notify/wechat-notify.module';
import { WechatNotifyService } from '../wechat-notify/wechat-notify.service';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';

/**
 * R10 — wire ShortAnswerEvaluatorService as the AiShortAnswerGrader for
 * StudentService.finalSubmit's short_answer fallback. Manual factory
 * keeps StudentService decoupled from morning-quiz's evaluator class
 * while still passing it as the optional 3rd constructor arg.
 *
 * F3 (Wave-2 API-Cross) — Events team left WechatNotifyService as
 * @Optional() because the factory's inject array didn't pass it; now
 * we add it explicitly so finalSubmit's notify.fire('score_ready') path
 * is reached at runtime. The constructor arg stays @Optional() so unit
 * tests that build a StudentService directly (no notifier) still work,
 * but in the wired-up NestJS DI tree it is always supplied.
 */
@Module({
  imports: [WechatNotifyModule],
  controllers: [StudentController],
  providers: [
    PrismaService,
    ShortAnswerEvaluatorService,
    {
      provide: StudentService,
      useFactory: (
        prisma: PrismaService,
        evaluator: ShortAnswerEvaluatorService,
        notify: WechatNotifyService,
      ) => new StudentService(prisma, evaluator, notify),
      inject: [PrismaService, ShortAnswerEvaluatorService, WechatNotifyService],
    },
  ],
  exports: [StudentService],
})
export class StudentModule {}
