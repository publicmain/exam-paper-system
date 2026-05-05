import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../common/auth.guard';
import { PracticeService } from './practice.service';

@Controller('practice')
export class PracticeController {
  constructor(private readonly svc: PracticeService) {}

  @Get('topics')
  topics(@Query('syllabusCode') syllabusCode: string) {
    return this.svc.listTopics(syllabusCode || '9618');
  }

  @Get('questions')
  questions(
    @Query('syllabusCode') syllabusCode?: string,
    @Query('paperVariants') paperVariants?: string,
    @Query('topicCodes') topicCodes?: string,
    @Query('years') years?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listQuestions({
      syllabusCode: syllabusCode || undefined,
      paperVariants: paperVariants ? paperVariants.split(',').filter(Boolean) : undefined,
      topicCodes: topicCodes ? topicCodes.split(',').filter(Boolean) : undefined,
      years: years ? years.split(',').map((y) => parseInt(y, 10)).filter((n) => !isNaN(n)) : undefined,
      search: search || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * Teacher-facing topic override. Body shape: { topicCode: 'CS.8' | null }.
   * Restricted to teaching staff so students can't reshuffle the bank.
   */
  @Patch('questions/:id/topic')
  @Roles('admin', 'head_teacher', 'teacher')
  updateTopic(
    @Param('id') id: string,
    @Body() body: { topicCode: string | null },
  ) {
    return this.svc.updateTopic(id, body?.topicCode ?? null);
  }
}
