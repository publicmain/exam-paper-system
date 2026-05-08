import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from '../common/auth.guard';
import { AdminCleanupService } from './admin-cleanup.service';

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
  constructor(private readonly cleanup: AdminCleanupService) {}

  @Post('fix-replacement-chars')
  fix() {
    return this.cleanup.fixReplacementChars();
  }

  @Post('purge-test-data')
  purge(@Body() body: { dryRun?: boolean } = {}) {
    return this.cleanup.purgeTestData({ dryRun: body?.dryRun });
  }

  /**
   * Clear morning-quiz fixtures: every MorningQuizSession + its
   * Attendance / Submission / shuffle map, the paired AI-generated
   * Papers (provenanceTag='ai_quick_paper'), the demo class TEST_MQ
   * and the s001–s035 + student-test users. Keeps the imported
   * Cambridge IELTS 8 question bank (provenanceTag='cambridge_ielts_8').
   * Pass {"dryRun": true} to preview.
   */
  @Post('purge-morning-quiz')
  purgeMorningQuiz(@Body() body: { dryRun?: boolean } = {}) {
    return this.cleanup.purgeMorningQuizData({ dryRun: body?.dryRun });
  }
}
