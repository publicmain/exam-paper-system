import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { QuestionAssetController } from './question-asset.controller';
import { AiService } from './ai.service';
import { OpenAiImageService } from './openai-image.service';
import { SvgDiagramService } from './svg-diagram.service';
import { RemoteRenderService } from './remote-render.service';
import { AiQuestionGeneratorService } from './ai-question-generator.service';
import { QuickPaperService } from './quick-paper.service';
import { PrismaService } from '../common/prisma.service';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [ReviewModule],
  controllers: [AiController, QuestionAssetController],
  providers: [
    AiService,
    OpenAiImageService,
    SvgDiagramService,
    RemoteRenderService,
    AiQuestionGeneratorService,
    QuickPaperService,
    PrismaService,
  ],
  exports: [AiService, OpenAiImageService, SvgDiagramService, RemoteRenderService, AiQuestionGeneratorService],
})
export class AiModule {}
