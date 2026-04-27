import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReferenceService } from './reference.service';
import { AuthGuard } from '../common/auth.guard';

@Controller()
@UseGuards(AuthGuard)
export class ReferenceController {
  constructor(private readonly ref: ReferenceService) {}

  @Get('exam-boards')
  boards() { return this.ref.listExamBoards(); }

  @Get('subjects')
  subjects(@Query('boardId') boardId?: string, @Query('level') level?: string) {
    return this.ref.listSubjects({ boardId, level });
  }

  @Get('components')
  components(@Query('subjectId') subjectId: string) {
    return this.ref.listComponents(subjectId);
  }

  @Get('topics')
  topics(@Query('componentId') componentId: string) {
    return this.ref.listTopicsTree(componentId);
  }
}
