import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ShuffleModule } from '../shuffle/shuffle.module';
import { StudentModule } from '../student/student.module';
import { MorningQuizController } from './morning-quiz.controller';
import { MorningQuizCron } from './morning-quiz.cron';
import { MorningQuizService } from './morning-quiz.service';

@Module({
  imports: [ShuffleModule, StudentModule],
  controllers: [MorningQuizController],
  providers: [PrismaService, MorningQuizService, MorningQuizCron],
  exports: [MorningQuizService],
})
export class MorningQuizModule {}
