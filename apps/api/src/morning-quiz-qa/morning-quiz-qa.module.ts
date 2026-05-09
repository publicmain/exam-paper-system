import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MorningQuizQaController } from './morning-quiz-qa.controller';
import { MorningQuizQaService } from './morning-quiz-qa.service';

@Module({
  controllers: [MorningQuizQaController],
  providers: [PrismaService, MorningQuizQaService],
  exports: [MorningQuizQaService],
})
export class MorningQuizQaModule {}
