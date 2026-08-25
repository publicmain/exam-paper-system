import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { VocabModule } from '../vocab/vocab.module';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';

/**
 * 每日一课（4.0 阶段 A）。
 *
 * 三段的数据源全部复用既有服务（StudentWordService / VocabReviewService /
 * MistakeService），只从 VocabModule 引入，不重新实现一遍取数逻辑 ——
 * 两套口径迟早会不一致，而完成度最怕的就是「和生词本对不上账」。
 */
@Module({
  imports: [VocabModule],
  controllers: [LessonController],
  providers: [PrismaService, LessonService],
  exports: [LessonService],
})
export class LessonModule {}
