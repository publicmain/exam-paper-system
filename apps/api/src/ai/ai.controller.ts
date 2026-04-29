import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AiService } from './ai.service';
import { OpenAiImageService, DiagramType } from './openai-image.service';
import { AiQuestionGeneratorService } from './ai-question-generator.service';
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
  @IsIn([
    'apparatus',
    'circuit',
    'waveform',
    'graph',
    'free_body',
    'molecular',
    'ray',
    'mechanics',
    'geometry',
    'statistical',
    'energy_level',
    'organic_skeletal',
  ])
  diagramType: DiagramType;
  @IsOptional() @IsString() syllabus?: string;
  @IsOptional() @IsString() topicCode?: string;
  @IsString() @MinLength(10) @MaxLength(2000) scene: string;
  @IsOptional() @IsArray() labels?: string[];
  @IsOptional() @IsIn(['1024x1024', '1024x1536', '1536x1024'])
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  @IsOptional() @IsIn(['low', 'medium', 'high']) quality?: 'low' | 'medium' | 'high';
}

class GenerateQuestionsDto {
  @IsString() @MinLength(2) @MaxLength(20) syllabusCode: string;
  @IsString() @MinLength(2) @MaxLength(20) topicCode: string;
  @IsInt() @Min(1) @Max(10) count: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) difficulty?: 1 | 2 | 3 | 4 | 5;
  @IsOptional() @IsIn(['mcq', 'short_answer', 'structured', 'essay'])
  questionType?: 'mcq' | 'short_answer' | 'structured' | 'essay';
  @IsOptional() @IsBoolean() multiPart?: boolean;
}

@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly openaiImage: OpenAiImageService,
    private readonly aiQuestions: AiQuestionGeneratorService,
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

  /**
   * Synchronous AI question generation. Writes new QuestionItem rows
   * into the review queue with source=ai_generated. Cost is summed in
   * the AuditLog and gated by ANTHROPIC_MONTHLY_USD_CAP.
   * Admin / head_teacher only — teachers should not burn budget.
   */
  @Post('generate-questions')
  async generateQuestions(
    @Body() dto: GenerateQuestionsDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!['admin', 'head_teacher'].includes(user?.role)) {
      throw new ForbiddenException('admin or head_teacher role required');
    }
    return this.aiQuestions.generate(dto, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /** Cost preview for the question generator. */
  @Get('question-budget')
  async questionBudget() {
    return this.aiQuestions.budgetStatus();
  }
}
