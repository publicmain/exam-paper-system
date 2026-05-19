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
  ArrayMaxSize,
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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AiService } from './ai.service';
import { OpenAiImageService, DiagramType } from './openai-image.service';
import { AiQuestionGeneratorService } from './ai-question-generator.service';
import { QuickPaperService } from './quick-paper.service';
import { ConversationalPaperService } from './conversational-paper.service';
import { ManualPaperService, ManualImportInput } from './manual-paper.service';
import { AuthGuard } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
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
    'logic_gate',
    'flowchart',
    'data_structure',
    'network_topology',
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

class QuickPaperTopicDto {
  @IsString() @MinLength(2) @MaxLength(20) code: string;
  @IsInt() @Min(1) @Max(10) count: number;
}

class BackfillTopicsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(20) syllabusCode?: string;
  @IsOptional() @IsString() componentId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) limit?: number;
  @IsOptional() minConfidence?: number;
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

class ChatPaperDto {
  @IsString() @MinLength(2) @MaxLength(20) syllabusCode: string;
  @IsString() @MinLength(3) @MaxLength(2000) message: string;
  @IsOptional() @IsString() @MaxLength(60) classLabel?: string;
}

class QuickPaperDto {
  @IsString() @MinLength(2) @MaxLength(20) syllabusCode: string;
  // Either supply a single topic (legacy) ...
  @IsOptional() @IsString() @MinLength(2) @MaxLength(20) topicCode?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) count?: number;
  // ...or a list of topics for a mock-exam style mixed paper.
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true })
  @Type(() => QuickPaperTopicDto)
  topics?: QuickPaperTopicDto[];
  @IsOptional() @IsInt() @Min(5) @Max(180) durationMin?: number;
  @IsOptional() @IsBoolean() includeDiagrams?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(5) difficulty?: 1 | 2 | 3 | 4 | 5;
  @IsOptional() @IsBoolean() multiPart?: boolean;
  @IsOptional() @IsString() @MaxLength(120) paperName?: string;
  @IsOptional() @IsString() @MaxLength(60) classLabel?: string;
}

@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly openaiImage: OpenAiImageService,
    private readonly aiQuestions: AiQuestionGeneratorService,
    private readonly quickPaper: QuickPaperService,
    private readonly chatPaper: ConversationalPaperService,
    private readonly manualPaper: ManualPaperService,
  ) {}

  /**
   * Burns Anthropic tokens (~$0.001 per call but trivially scriptable).
   * Restrict to authoring roles so a logged-in student can't burn the
   * monthly cap by hammering the endpoint from the browser console.
   */
  @Post('suggest-labels')
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  suggestLabels(@Body() dto: SuggestLabelsDto, @CurrentUser() user: any) {
    if (!['admin', 'head_teacher', 'teacher'].includes(user?.role)) {
      throw new ForbiddenException('teacher, head_teacher, or admin role required');
    }
    return this.ai.suggestLabels(dto);
  }

  /**
   * Synchronous diagram generation. Charges the OpenAI account on success;
   * a monthly cap (OPENAI_MONTHLY_USD_CAP env) is enforced before the call
   * so a runaway client cannot blow the budget.
   */
  @Post('generate-diagram')
  @RateLimit({ limit: 10, windowSec: 60, scope: 'user' })
  async generateDiagram(
    @Body() dto: GenerateDiagramDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    // Restrict to roles that can author questions. Without this, any
    // authenticated user (including future read-only roles) could burn
    // through the OpenAI monthly cap. Teachers stay allowed because the
    // QuestionEdit page uses this from the diagram generator panel.
    if (!['admin', 'head_teacher', 'teacher'].includes(user?.role)) {
      throw new ForbiddenException('teacher, head_teacher, or admin role required');
    }
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
  @RateLimit({ limit: 20, windowSec: 60, scope: 'user' })
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

  /**
   * Backfill primaryTopicId on already-approved Questions whose tagger
   * never ran. Costs real Anthropic money (~$0.012 per question), so
   * confirm dryRun first to see what would be touched.
   * Admin / head_teacher only.
   */
  @Post('backfill-topics')
  async backfillTopics(@Body() dto: BackfillTopicsDto, @CurrentUser() user: any) {
    if (!['admin', 'head_teacher'].includes(user?.role)) {
      throw new ForbiddenException('admin or head_teacher role required');
    }
    return this.ai.backfillApprovedTopics({
      syllabusCode: dto.syllabusCode,
      componentId: dto.componentId,
      limit: dto.limit,
      minConfidence: typeof dto.minConfidence === 'number' ? dto.minConfidence : undefined,
      dryRun: dto.dryRun === true,
    });
  }

  /**
   * One-click "AI generates a complete paper". Chains AI question
   * generation → auto-approval into the bank → optional gpt-image-2
   * diagrams (parallel) → paper assembly. Returns paperId so the UI
   * can immediately link to the paper detail / PDF export.
   *
   * Admin or head_teacher only — every call burns Claude + OpenAI
   * tokens. Default 5 questions + diagrams ≈ $0.20 / 70-90 seconds.
   */
  @Post('quick-paper')
  @RateLimit({ limit: 5, windowSec: 60, scope: 'user' })
  async quickPaperGenerate(
    @Body() dto: QuickPaperDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!['admin', 'head_teacher'].includes(user?.role)) {
      throw new ForbiddenException('admin or head_teacher role required');
    }
    return this.quickPaper.generate(dto, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /**
   * R18: import a fully-authored paper. Bypasses Anthropic entirely —
   * the caller supplies the question content, this endpoint runs the
   * existing audit + approve + paper-assembly pipeline.
   *
   * Used (a) when Anthropic credits are dry, and (b) for content
   * authored externally (Claude in a dev chat, a CLI script, a
   * future admin UI). Diagrams are limited to structured SVG specs —
   * image-only types are refused to keep the path cost-free.
   *
   * Admin / head_teacher only — bypassing Anthropic doesn't bypass the
   * privilege check on authoring questions into the bank.
   */
  @Post('import-paper')
  @RateLimit({ limit: 10, windowSec: 60, scope: 'user' })
  async importPaper(
    @Body() dto: ManualImportInput,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!['admin', 'head_teacher'].includes(user?.role)) {
      throw new ForbiddenException('admin or head_teacher role required');
    }
    return this.manualPaper.importPaper(dto, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /**
   * R16: chat-paper. Teacher types a free-text description and the
   * system parses it into a QuickPaperInput, then runs the same
   * generate pipeline. Strict authoring-role gate matches /quick-paper
   * — every call burns both haiku (parse) and sonnet (generate) tokens.
   */
  @Post('chat-paper')
  @RateLimit({ limit: 5, windowSec: 60, scope: 'user' })
  async chatPaperGenerate(
    @Body() dto: ChatPaperDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!['admin', 'head_teacher'].includes(user?.role)) {
      throw new ForbiddenException('admin or head_teacher role required');
    }
    return this.chatPaper.generateFromMessage(
      {
        syllabusCode: dto.syllabusCode,
        message: dto.message,
        classLabel: dto.classLabel ?? null,
      },
      {
        id: user.id,
        role: user.role,
        ip: req.ip ?? null,
      },
    );
  }
}
