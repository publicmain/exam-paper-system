import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto, ListQuestionsQuery, UpdateQuestionDto } from './dto';
import { AuthGuard, Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';

/**
 * Whole controller is teacher/admin only. Students must NEVER read /questions
 * directly — that would leak markScheme, answerContent, and the correct-option
 * flag for every MCQ in the bank. Cheating would be a one-line fetch.
 */
@Controller('questions')
@UseGuards(AuthGuard)
@Roles('admin', 'head_teacher', 'teacher')
export class QuestionsController {
  constructor(private readonly service: QuestionsService) {}

  @Get()
  list(@Query() q: ListQuestionsQuery) { return this.service.list(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.get(id); }

  @Post()
  create(@Body() dto: CreateQuestionDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }

  @Post(':id/assets')
  addAsset(@Param('id') id: string, @Body() asset: { assetType: string; storageUrl: string; altText?: string }) {
    return this.service.addAsset(id, asset);
  }

  @Delete(':id/assets/:assetId')
  deleteAsset(@Param('id') id: string, @Param('assetId') assetId: string) {
    return this.service.deleteAsset(id, assetId);
  }
}
