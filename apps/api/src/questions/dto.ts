import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsObject, Max, Min, IsBoolean } from 'class-validator';
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
  @IsOptional() @IsBoolean() includeDraft?: boolean;
}
