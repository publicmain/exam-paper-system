import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto, ListQuestionsQuery, UpdateQuestionDto } from './dto';
import { AuthGuard, Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';

// Asset attachments are images/diagrams referenced from the question stem.
// Without validation a malicious teacher could pass a javascript: URL or an
// arbitrarily long altText payload that breaks rendering downstream.
//
// zod's `.url()` accepts ANY URL with a scheme — including `javascript:`,
// `data:`, `vbscript:`, `file:`, etc. Round-7 agent-2 H-7. Constrain to
// http(s) explicitly so a malicious authoring attempt to embed
// `javascript:alert(1)` as an "image" URL fails validation.
const AddAssetSchema = z.object({
  assetType: z.enum(['image', 'diagram', 'audio']),
  storageUrl: z
    .string()
    .url()
    .max(2048)
    .refine(
      (u) => {
        try {
          const parsed = new URL(u);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'storageUrl must be an http(s) URL (no javascript:, data:, file:, etc.)' },
    ),
  altText: z.string().max(500).optional(),
});

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
  addAsset(@Param('id') id: string, @Body() body: unknown) {
    const parsed = AddAssetSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.addAsset(id, parsed.data);
  }

  @Delete(':id/assets/:assetId')
  deleteAsset(@Param('id') id: string, @Param('assetId') assetId: string) {
    return this.service.deleteAsset(id, assetId);
  }
}
