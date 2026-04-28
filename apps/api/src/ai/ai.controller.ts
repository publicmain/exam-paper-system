import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AiService } from './ai.service';
import { OpenAiImageService, DiagramType } from './openai-image.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';

class SuggestLabelsDto {
  @IsString() subjectId: string;
  @IsOptional() @IsString() componentId?: string;
  @IsString() questionStem: string;
  @IsOptional() @IsInt() marks?: number;
}

class GenerateDiagramDto {
  @IsString() questionId: string;
  @IsIn(['apparatus', 'circuit', 'waveform', 'graph', 'free_body', 'molecular'])
  diagramType: DiagramType;
  @IsOptional() @IsString() syllabus?: string;
  @IsOptional() @IsString() topicCode?: string;
  @IsString() @MinLength(10) @MaxLength(2000) scene: string;
  @IsOptional() @IsArray() labels?: string[];
  @IsOptional() @IsIn(['1024x1024', '1024x1536', '1536x1024'])
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  @IsOptional() @IsIn(['low', 'medium', 'high']) quality?: 'low' | 'medium' | 'high';
}

@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly openaiImage: OpenAiImageService,
  ) {}

  @Post('suggest-labels')
  suggestLabels(@Body() dto: SuggestLabelsDto) {
    return this.ai.suggestLabels(dto);
  }

  /**
   * Synchronous diagram generation. Charges the OpenAI account on success;
   * a monthly cap (OPENAI_MONTHLY_USD_CAP env) is enforced before the call
   * so a runaway client cannot blow the budget.
   */
  @Post('generate-diagram')
  async generateDiagram(
    @Body() dto: GenerateDiagramDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!dto || typeof dto.scene !== 'string') {
      throw new BadRequestException('scene is required');
    }
    return this.openaiImage.generateDiagram(dto, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /** Cost preview without spending money. */
  @Get('image-budget')
  async budget() {
    return this.openaiImage.budgetStatus();
  }
}
