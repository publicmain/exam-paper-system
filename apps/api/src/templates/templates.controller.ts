import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('templates')
@UseGuards(AuthGuard)
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get() list(@CurrentUser() user: any) { return this.service.list(user.id); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post() create(@Body() dto: any, @CurrentUser() user: any) { return this.service.create(user.id, dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Delete(':id') del(@Param('id') id: string) { return this.service.remove(id); }
}
