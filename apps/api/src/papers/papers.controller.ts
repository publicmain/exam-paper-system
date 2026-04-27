import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { PapersService } from './papers.service';
import { ValidationService } from './validation.service';
import { GeneratePaperDto, UpdatePaperQuestionDto } from './dto';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PdfService } from '../pdf/pdf.service';

@Controller('papers')
@UseGuards(AuthGuard)
export class PapersController {
  constructor(
    private readonly service: PapersService,
    private readonly validation: ValidationService,
    private readonly pdf: PdfService,
  ) {}

  @Get() list(@CurrentUser() user: any) { return this.service.list(user.id); }

  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }

  @Post('generate')
  generate(@Body() dto: GeneratePaperDto, @CurrentUser() user: any) {
    return this.service.generate(user.id, dto);
  }

  @Patch(':id')
  updatePaper(@Param('id') id: string, @Body() dto: any) {
    return this.service.updatePaper(id, dto);
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
  saveVersion(@Param('id') id: string, @Body() body: { note?: string }, @CurrentUser() user: any) {
    return this.service.saveVersion(id, user.id, body?.note);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) { return this.service.listVersions(id); }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query('type') type: 'paper' | 'answer_key' = 'paper',
    @Res() res: Response,
  ) {
    const buffer = await this.pdf.exportPaper(id, type);
    const filename = type === 'answer_key' ? `paper-${id}-answer-key.pdf` : `paper-${id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
