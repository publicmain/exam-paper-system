import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { QuestionAssetController } from './question-asset.controller';
import { AiService } from './ai.service';
import { OpenAiImageService } from './openai-image.service';
import { AiQuestionGeneratorService } from './ai-question-generator.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [AiController, QuestionAssetController],
  providers: [AiService, OpenAiImageService, AiQuestionGeneratorService, PrismaService],
  exports: [AiService, OpenAiImageService, AiQuestionGeneratorService],
})
export class AiModule {}
