import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { SourcesService } from './sources.service';
import { BlockSourceSchema, CreateSourceRepoSchema, UpdateComplianceSchema } from './dto';
import { IngestService } from '../ingest/ingest.service';
import { AiService } from '../ai/ai.service';

@Controller('sources')
@Roles('admin')
export class SourcesController {
  constructor(
    private readonly sources: SourcesService,
    private readonly ingest: IngestService,
    private readonly ai: AiService,
  ) {}

  @Get()
  list() {
    return this.sources.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.sources.get(id);
  }

  @Post()
  async create(
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = CreateSourceRepoSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sources.create(parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Put(':id/compliance')
  async updateCompliance(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = UpdateComplianceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sources.updateCompliance(id, parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Post(':id/block')
  async block(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = BlockSourceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sources.block(id, parsed.data.reason, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Post(':id/sync')
  async sync(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.ingest.syncRepository(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /** Re-process pending / failed files for a repo without re-cloning. */
  @Post(':id/process')
  async process(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.ingest.processPending(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /** Run the AI tagger over pending QuestionItems for this repo. */
  @Post(':id/tag')
  async tag(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.ai.tagPendingForRepo(id, { limit: limit ? Number(limit) : undefined });
  }

  /** Hard-delete the repo + cascading files / pages / un-approved items. */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('force') force: string | undefined,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.sources.delete(id, force === 'true', { id: user.id, role: user.role, ip: req.ip ?? null });
  }
}
