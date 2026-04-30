import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class GenerationConfigDto {
  @IsString() subjectId: string;
  @IsOptional() @IsString() componentId?: string;
  @IsOptional() @IsArray() topicFilter?: string[];
  @IsInt() @Min(5) durationMin: number;
  @IsInt() @Min(1) totalMarks: number;
  @IsArray() questionMix: Array<{ type: 'mcq' | 'short_answer' | 'structured' | 'essay'; count?: number; targetMarks?: number; marksEach?: number }>;
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
  @IsString() action: 'reorder' | 'delete' | 'edit' | 'replace';
  @IsOptional() @IsInt() newSortOrder?: number;
  @IsOptional() overrideContent?: any;
  @IsOptional() overrideAnswer?: any;
  @IsOptional() @IsString() replacementQuestionId?: string;
}
