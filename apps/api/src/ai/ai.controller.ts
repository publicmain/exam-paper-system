import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { AiService } from './ai.service';
import { AuthGuard } from '../common/auth.guard';

class SuggestLabelsDto {
  @IsString() subjectId: string;
  @IsOptional() @IsString() componentId?: string;
  @IsString() questionStem: string;
  @IsOptional() @IsInt() marks?: number;
}

@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('suggest-labels')
  suggestLabels(@Body() dto: SuggestLabelsDto) {
    return this.ai.suggestLabels(dto);
  }
}
