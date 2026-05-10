import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ShortAnswerEvaluatorService } from '../morning-quiz/short-answer-evaluator.service';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';

/**
 * R10 — wire ShortAnswerEvaluatorService as the AiShortAnswerGrader for
 * StudentService.finalSubmit's short_answer fallback. Manual factory
 * keeps StudentService decoupled from morning-quiz's evaluator class
 * while still passing it as the optional 3rd constructor arg.
 */
@Module({
  controllers: [StudentController],
  providers: [
    PrismaService,
    ShortAnswerEvaluatorService,
    {
      provide: StudentService,
      useFactory: (prisma: PrismaService, evaluator: ShortAnswerEvaluatorService) =>
        new StudentService(prisma, evaluator),
      inject: [PrismaService, ShortAnswerEvaluatorService],
    },
  ],
  exports: [StudentService],
})
export class StudentModule {}
