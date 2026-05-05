import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsObject, Max, Min, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { QuestionType, QuestionStatus, SourceType } from '@prisma/client';

export class CreateQuestionDto {
  @IsString() subjectId: string;
  @IsOptional() @IsString() componentId?: string;
  @IsOptional() @IsString() primaryTopicId?: string;
  @IsOptional() @IsArray() topicIds?: string[];

  @IsEnum(QuestionType) questionType: QuestionType;
  @IsInt() @Min(1) @Max(50) marks: number;
  @IsInt() @Min(1) @Max(5) difficulty: number;
  @IsOptional() @IsEnum(SourceType) sourceType?: SourceType;
  @IsOptional() @IsString() sourceRef?: string;
  @IsOptional() estimatedTimeMin?: number;

  @IsObject() content: any;
  @IsObject() answerContent: any;
  @IsOptional() options?: any;
  @IsOptional() markScheme?: any;

  @IsOptional() @IsEnum(QuestionStatus) status?: QuestionStatus;
}

export class UpdateQuestionDto {
  @IsOptional() @IsString() primaryTopicId?: string;
  @IsOptional() @IsArray() topicIds?: string[];
  @IsOptional() @IsEnum(QuestionType) questionType?: QuestionType;
  @IsOptional() @IsInt() marks?: number;
  @IsOptional() @IsInt() difficulty?: number;
  @IsOptional() @IsEnum(SourceType) sourceType?: SourceType;
  @IsOptional() @IsString() sourceRef?: string;
  @IsOptional() estimatedTimeMin?: number;
  @IsOptional() content?: any;
  @IsOptional() answerContent?: any;
  @IsOptional() options?: any;
  @IsOptional() markScheme?: any;
  @IsOptional() @IsEnum(QuestionStatus) status?: QuestionStatus;
  @IsOptional() @IsString() changeNote?: string;
}

export class ListQuestionsQuery {
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() componentId?: string;
  @IsOptional() @IsString() topicId?: string;
  @IsOptional() @IsEnum(QuestionType) questionType?: QuestionType;
  @IsOptional() @IsEnum(QuestionStatus) status?: QuestionStatus;
  @IsOptional() difficulty?: number;
  @IsOptional() marksMin?: number;
  @IsOptional() marksMax?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() page?: number;
  @IsOptional() pageSize?: number;
  // Bug #21: this DTO is hit via GET so query params arrive as strings.
  // class-validator's @IsBoolean() rejects "true"/"false", which broke
  // the entire Questions page (frontend defaults includeDraft=true and
  // got 400 → 0 questions visible despite 395 in the bank). Coerce
  // string-or-boolean → boolean before validating.
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  includeDraft?: boolean;
}
