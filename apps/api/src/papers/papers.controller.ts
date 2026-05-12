import {
  BadRequestException,
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { z } from 'zod';
import { PapersService } from './papers.service';
import { ValidationService } from './validation.service';
import { GeneratePaperDto, UpdatePaperQuestionDto } from './dto';
import { AuthGuard, Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PdfService } from '../pdf/pdf.service';

// Whitelist the editable paper attributes. Without this an attacker could
// pass `{ ownerId: '<other-user>' }` (or `totalMarksActual: 0` to invalidate
// existing scores) directly into `prisma.paper.update`. We narrow to the
// fields the paper-edit UI actually sends.
const UpdatePaperSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  totalMarksActual: z.number().int().min(0).max(1000).optional(),
  durationMin: z.number().int().min(0).max(600).nullable().optional(),
  config: z.record(z.string(), z.any()).optional(),
});

const SaveVersionSchema = z.object({
  note: z.string().max(2000).optional(),
});

const ExportTypeSchema = z.enum(['paper', 'answer_key']);

/**
 * Whole controller is teacher/admin only. Students must NEVER read /papers
 * directly — they could pull mark schemes, answer-key PDFs, or paper detail
 * including correct-option flags. The student-take UI gets a redacted paper
 * via GET /api/student/submissions/:id (see StudentService.getOwnSubmission).
 */
@Controller('papers')
@UseGuards(AuthGuard)
@Roles('admin', 'head_teacher', 'teacher')
export class PapersController {
  constructor(
    private readonly service: PapersService,
    private readonly validation: ValidationService,
    private readonly pdf: PdfService,
  ) {}

  @Get() list(@CurrentUser() user: any, @Query('archived') archivedRaw?: string) {
    const archived = archivedRaw === 'true' || archivedRaw === '1';
    return this.service.list(user.id, { archived });
  }

  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }

  @Post('generate')
  generate(@Body() dto: GeneratePaperDto, @CurrentUser() user: any) {
    return this.service.generate(user.id, dto);
  }

  @Patch(':id')
  updatePaper(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdatePaperSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.updatePaper(id, parsed.data);
  }

  @Patch(':id/questions/:pqId')
  updateQuestion(@Param('id') id: string, @Param('pqId') pqId: string, @Body() dto: UpdatePaperQuestionDto) {
    return this.service.updateQuestion(id, pqId, dto);
  }

  @Get(':id/questions/:pqId/replacements')
  replacements(@Param('id') id: string, @Param('pqId') pqId: string) {
    return this.service.findReplacements(id, pqId);
  }

  @Get(':id/validate')
  validate(@Param('id') id: string) { return this.validation.validate(id); }

  @Post(':id/versions')
  saveVersion(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any) {
    const parsed = SaveVersionSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.saveVersion(id, user.id, parsed.data.note);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) { return this.service.listVersions(id); }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query('type') typeRaw: string | undefined,
    @Res() res: Response,
  ) {
    const parsed = ExportTypeSchema.safeParse(typeRaw ?? 'paper');
    if (!parsed.success) throw new BadRequestException('type must be paper|answer_key');
    const type = parsed.data;
    // Sanitise the file name component so a maliciously crafted paper id can't
    // break the Content-Disposition header (CRLF / quote injection / path
    // traversal). Restrict to the alnum + dash/underscore alphabet Prisma
    // ids actually use.
    const safeId = id.replace(/[^A-Za-z0-9_-]/g, '');
    const buffer = await this.pdf.exportPaper(id, type);
    const filename = type === 'answer_key' ? `paper-${safeId}-answer-key.pdf` : `paper-${safeId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
