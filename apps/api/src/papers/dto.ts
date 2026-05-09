import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** One slot in GenerationConfigDto.questionMix. Validated nested so
 *  malformed shapes (e.g. count=99999, type='nonsense', extra eval JSON)
 *  fail at the controller boundary instead of inside the generator.
 *  Round-7 agent-2 H-6. */
export class QuestionMixSlotDto {
  @IsIn(['mcq', 'short_answer', 'structured', 'essay'])
  type: 'mcq' | 'short_answer' | 'structured' | 'essay';

  @IsOptional() @IsInt() @Min(1) @Max(100) count?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) targetMarks?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) marksEach?: number;
}

export class GenerationConfigDto {
  @IsString() subjectId: string;
  @IsOptional() @IsString() componentId?: string;
  @IsOptional() @IsArray() topicFilter?: string[];
  @IsInt() @Min(5) durationMin: number;
  @IsInt() @Min(1) totalMarks: number;
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuestionMixSlotDto)
  questionMix: QuestionMixSlotDto[];
  @IsOptional() @IsObject() difficultyDist?: { easy?: number; medium?: number; hard?: number };
  @IsOptional() @IsInt() excludeRecentDays?: number;
  @IsOptional() @IsArray() excludeQuestionIds?: string[];
  @IsOptional() @IsInt() seed?: number;
  /** Opt-in to questions whose source is licensed past papers (compliance
   *  status restricted_internal). Default off so school-authored content
   *  is the safe path. */
  @IsOptional() @IsBoolean() includeRestricted?: boolean;
  /** Opt-in to AI Quick Paper output that has not been promoted to the
   *  general bank. These questions are tagged provenanceTag='ai_quick_paper'
   *  by Quick Paper's auto-approve flow and excluded from regular paper
   *  generation by default to keep un-curated AI output out of other
   *  teachers' papers. */
  @IsOptional() @IsBoolean() includeAiQuickPaper?: boolean;
}

export class GeneratePaperDto {
  @IsOptional() @IsString() templateId?: string;
  @IsString() name: string;
  @IsOptional() @IsString() classLabel?: string;
  @IsOptional() examDate?: string;
  @IsOptional() config?: GenerationConfigDto;
}

export class UpdatePaperQuestionDto {
  @IsIn(['reorder', 'delete', 'edit', 'replace'])
  action: 'reorder' | 'delete' | 'edit' | 'replace';

  @IsOptional() @IsInt() @Min(0) @Max(10_000) newSortOrder?: number;

  // overrideContent / overrideAnswer used to be typed `any`. Now constrained
  // to plain JSON-able objects (no arrays, no scalars) and capped in size by
  // the global body limit. Round-7 agent-2 H-5.
  @IsOptional() @IsObject() overrideContent?: Record<string, unknown>;
  @IsOptional() @IsObject() overrideAnswer?: Record<string, unknown>;

  @IsOptional() @IsString() replacementQuestionId?: string;
}
