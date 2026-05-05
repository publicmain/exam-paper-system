import { Controller, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../common/auth.guard';
import { RuleClassifierService } from './rule-classifier.service';

@Controller('classifier')
@Roles('admin')
export class ClassifierController {
  constructor(private readonly rules: RuleClassifierService) {}

  /**
   * Run the keyword rule classifier over a single repo.
   *   ?syllabusCode=9618   restrict to one syllabus
   *   ?overwrite=true      re-tag items that already carry a suggestion
   */
  @Post('sources/:id/run-rules')
  async run(
    @Param('id') repoId: string,
    @Query('syllabusCode') syllabusCode: string | undefined,
    @Query('overwrite') overwrite: string | undefined,
  ) {
    return this.rules.classifyForRepo(repoId, {
      syllabusCode,
      overwrite: overwrite === 'true',
    });
  }
}
