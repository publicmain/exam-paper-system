import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from '../common/auth.guard';
import { AdminCleanupService } from './admin-cleanup.service';
import { IeltsRepairService } from './ielts-repair.service';

/**
 * Admin-only data hygiene endpoints (Bugs #2 + #5).
 *
 * Routes:
 *   POST /admin-cleanup/fix-replacement-chars
 *   POST /admin-cleanup/purge-test-data        body: { dryRun?: boolean }   default dryRun=true
 *
 * `purge-test-data` deletes data — by default it runs in dry-run mode.
 * Pass {"dryRun": false} to actually delete.
 */
@Controller('admin-cleanup')
@UseGuards(AuthGuard)
@Roles('admin')
export class AdminCleanupController {
  constructor(
    private readonly cleanup: AdminCleanupService,
    private readonly ieltsRepair: IeltsRepairService,
  ) {}

  @Post('fix-replacement-chars')
  fix() {
    return this.cleanup.fixReplacementChars();
  }

  @Post('purge-test-data')
  purge(@Body() body: { dryRun?: boolean } = {}) {
    return this.cleanup.purgeTestData({ dryRun: body?.dryRun });
  }

  /**
   * Clear morning-quiz fixtures with selectable scope:
   *   scope='sessions-only' (default) — wipes sessions / attendance /
   *     submissions / shuffle maps and the AI-generated Papers, but
   *     KEEPS the class + students so a follow-up batch-generate can
   *     rebuild the schedule without re-rostering 30 students.
   *   scope='all' — also deletes TEST_MQ class + s001-s035 students
   *     for a full reset.
   * Always keeps the imported Cambridge IELTS 8 question bank
   * (provenanceTag='cambridge_ielts_8').
   */
  @Post('purge-morning-quiz')
  purgeMorningQuiz(
    @Body() body: { dryRun?: boolean; scope?: 'sessions-only' | 'all' } = {},
  ) {
    return this.cleanup.purgeMorningQuizData({
      dryRun: body?.dryRun,
      scope: body?.scope ?? 'sessions-only',
    });
  }

  /**
   * One-off Claude-driven IELTS data repair.
   *   - regenerates the missing matching_headings list-of-headings
   *   - regenerates the missing summary_completion word bank
   *   - cleans OCR artifacts and reflows column-broken passages
   * Idempotent: questions already marked passageCleaned / with bank are
   * skipped on re-runs. Default dryRun=true.
   */
  @Post('repair-ielts')
  repairIelts(
    @Body()
    body: {
      dryRun?: boolean;
      provenancePrefix?: string;
      sourceRefPrefix?: string;
    } = {},
  ) {
    return this.ieltsRepair.repair({
      dryRun: body?.dryRun,
      provenancePrefix: body?.provenancePrefix,
      sourceRefPrefix: body?.sourceRefPrefix,
    });
  }
}
