import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthGuard, Roles } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { validatePaperStructure } from '../morning-quiz/paper-structure-validator';
import { AdminCleanupService } from './admin-cleanup.service';
import { IeltsRepairService } from './ielts-repair.service';

const PurgeSchema = z.object({ dryRun: z.boolean().optional() });
const PurgeMorningQuizSchema = z.object({
  dryRun: z.boolean().optional(),
  // Locked enum — without this an unknown string falls through to the
  // service which only branches on === 'all', so 'drop_everything' would
  // silently be treated as 'sessions-only'. We bail fast instead.
  scope: z.enum(['sessions-only', 'all']).optional(),
});
const RepairIeltsSchema = z.object({
  dryRun: z.boolean().optional(),
  provenancePrefix: z.string().min(1).max(120).optional(),
  sourceRefPrefix: z.string().min(1).max(120).optional(),
});

// R15-followup-9 — targeted submission purge for test-pollution cleanup.
// Capped at 20 IDs per call so a copy-paste of a giant list can't blow
// up a transaction. Defaults to dryRun=true so the first call always shows
// the impact before anything is actually deleted.
const PurgeSubmissionsSchema = z.object({
  submissionIds: z.array(z.string().min(1).max(40)).min(1).max(20),
  dryRun: z.boolean().optional(),
  // R15-followup-11: also delete the linked Attendance row when true.
  // Default false (matches previous behaviour: unhook only).
  deleteAttendance: z.boolean().optional(),
});

// R15-followup-11 — backfill `acceptedKeys` on IELTS either-order MCQ
// pairs. Defaults to dryRun=true so the first call returns the detection
// list for review before mutation.
const BackfillEitherOrderSchema = z.object({
  dryRun: z.boolean().optional(),
  paperQuestionIds: z.array(z.string().min(1).max(40)).max(2000).optional(),
});

// R15-followup-12 — patch specific fields of a PaperQuestion's
// snapshotContent (stem / passage / passageTitle). Allow-list locked
// so a typo'd field name can't blast arbitrary JSON into the column.
const PatchSnapshotSchema = z.object({
  paperQuestionId: z.string().min(1).max(40),
  stem: z.string().min(1).max(4000).optional(),
  passage: z.string().min(1).max(20000).optional(),
  passageTitle: z.string().min(1).max(200).optional(),
});

// R15-followup-14b — emergency MCQ regrade endpoint.
const RefreshMcqGradingSchema = z.object({
  sessionId: z.string().min(1).max(40),
  dryRun: z.boolean().optional(),
});

// R15-followup-14b — hard-delete sessions so batch-generate can re-fill
// the (classId, date, level) tuple with a fresh paper.
const HardDeleteSessionsSchema = z.object({
  sessionIds: z.array(z.string().min(1).max(40)).min(1).max(30),
});

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
    private readonly prisma: PrismaService,
  ) {}

  /**
   * R15-followup-23 — scan upcoming morning-quiz papers for structural
   * violations (the 5/26 TFNG empty-options class of bug). Runs the
   * pure `validatePaperStructure` against every paper attached to a
   * MorningQuizSession in the given date range, returns a flat list of
   * findings: papers that are missing options, empty stems, or whose
   * MCQ-shape questions have no canonical answer.
   *
   *   GET /api/admin-cleanup/scan-paper-structure?from=2026-05-27&to=2026-06-05
   *
   * Use this BEFORE each week's quizzes go live to catch broken
   * fixtures while there's still time to retract or regenerate.
   */
  @Get('scan-paper-structure')
  async scanPaperStructure(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from and to required (YYYY-MM-DD)');
    }
    const fromDate = new Date(from + 'T00:00:00Z');
    const toDate = new Date(to + 'T23:59:59Z');
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('invalid date format — use YYYY-MM-DD');
    }
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: {
          include: {
            paper: {
              include: {
                questions: {
                  include: { question: { select: { questionType: true } } },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { level: 'asc' }],
    });
    const findings: Array<{
      date: string;
      className: string;
      level: string;
      sessionId: string;
      paperId: string;
      paperName: string;
      sessionStatus: string;
      violations: ReturnType<typeof validatePaperStructure>;
    }> = [];
    for (const s of sessions) {
      const paper = s.paperAssignment?.paper;
      if (!paper) continue;
      const violations = validatePaperStructure(paper.questions as any);
      if (violations.length === 0) continue;
      findings.push({
        date: s.date.toISOString().slice(0, 10),
        className: s.class.name,
        level: s.level,
        sessionId: s.id,
        paperId: paper.id,
        paperName: paper.name,
        sessionStatus: s.status,
        violations,
      });
    }
    return {
      from,
      to,
      sessionsChecked: sessions.length,
      papersWithViolations: findings.length,
      findings,
    };
  }

  @Post('fix-replacement-chars')
  fix() {
    return this.cleanup.fixReplacementChars();
  }

  @Post('purge-test-data')
  purge(@Body() body: unknown) {
    const parsed = PurgeSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.cleanup.purgeTestData({ dryRun: parsed.data.dryRun });
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
  purgeMorningQuiz(@Body() body: unknown) {
    const parsed = PurgeMorningQuizSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.cleanup.purgeMorningQuizData({
      dryRun: parsed.data.dryRun,
      scope: parsed.data.scope ?? 'sessions-only',
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
  /**
   * R15-followup-9 — delete specific StudentSubmission rows by ID, unhook
   * any Attendance rows that reference them, and cascade-delete their
   * AnswerScript children. Used to clean up after a QA walk-through that
   * accidentally lands real-student names on production submissions.
   *
   *   POST /admin-cleanup/purge-submissions-by-id
   *   { submissionIds: string[] (1-20), dryRun?: boolean (default true) }
   */
  @Post('purge-submissions-by-id')
  purgeSubmissions(@Body() body: unknown, @Req() req: Request) {
    const parsed = PurgeSubmissionsSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = (req as any).user ?? null;
    return this.cleanup.purgeSubmissionsById(parsed.data.submissionIds, {
      dryRun: parsed.data.dryRun,
      deleteAttendance: parsed.data.deleteAttendance,
      actor: actor
        ? { id: actor.id ?? actor.userId, role: actor.role ?? 'admin', ip: req.ip ?? null }
        : undefined,
    });
  }

  /**
   * R15-followup-11 — backfill snapshotContent.acceptedKeys on IELTS-style
   * "either order" MCQ pairs. Default dryRun=true returns the detection list.
   *
   *   POST /admin-cleanup/backfill-either-order
   *   { dryRun?: boolean, paperQuestionIds?: string[] }
   */
  @Post('backfill-either-order')
  backfillEitherOrder(@Body() body: unknown) {
    const parsed = BackfillEitherOrderSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.cleanup.backfillEitherOrderAcceptedKeys({
      dryRun: parsed.data.dryRun,
      paperQuestionIds: parsed.data.paperQuestionIds,
    });
  }

  /**
   * R15-followup-12 — patch a PaperQuestion's snapshotContent.stem /
   * .passage / .passageTitle directly. Used to fix wording flagged by
   * morning-quiz-qa overnight without regenerating the paper. Allow-list
   * of patchable fields locked at zod layer; no arbitrary JSON write.
   *
   *   POST /admin-cleanup/patch-paper-question-snapshot
   *   { paperQuestionId: string, stem?: string, passage?: string, passageTitle?: string }
   */
  @Post('patch-paper-question-snapshot')
  patchSnapshot(@Body() body: unknown, @Req() req: Request) {
    const parsed = PatchSnapshotSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = (req as any).user ?? null;
    return this.cleanup.patchPaperQuestionSnapshot(parsed.data, {
      id: actor?.id ?? actor?.userId ?? 'unknown',
      role: actor?.role ?? 'admin',
      ip: req.ip ?? null,
    });
  }

  /**
   * R15-followup-14b — emergency MCQ regrade that uses the historyDetail
   * resolution order (snapshotContent.correctOption first). Used when the
   * general /regrade path picks the wrong canonical key on Cambridge
   * classification papers where snapshotOptions[].correct disagrees with
   * snapshotContent.correctOption.
   *
   *   POST /admin-cleanup/refresh-mcq-grading-by-session
   *   { sessionId: string, dryRun?: boolean (default true) }
   */
  /**
   * R15-followup-14b — hard-delete cancelled sessions so the (classId,
   * date, level) tuple is vacated for batch-generate re-fill. Refuses
   * sessions that carry non-absent attendance.
   *
   *   POST /admin-cleanup/hard-delete-sessions
   *   { sessionIds: string[] (1-30) }
   */
  @Post('hard-delete-sessions')
  hardDeleteSessions(@Body() body: unknown, @Req() req: Request) {
    const parsed = HardDeleteSessionsSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = (req as any).user ?? null;
    return this.cleanup.hardDeleteSessions(parsed.data.sessionIds, {
      id: actor?.id ?? actor?.userId ?? 'unknown',
      role: actor?.role ?? 'admin',
      ip: req.ip ?? null,
    });
  }

  @Post('refresh-mcq-grading-by-session')
  refreshMcqGrading(@Body() body: unknown, @Req() req: Request) {
    const parsed = RefreshMcqGradingSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = (req as any).user ?? null;
    return this.cleanup.refreshMcqGradingBySession(
      parsed.data.sessionId,
      { dryRun: parsed.data.dryRun },
      {
        id: actor?.id ?? actor?.userId ?? 'unknown',
        role: actor?.role ?? 'admin',
        ip: req.ip ?? null,
      },
    );
  }

  @Post('repair-ielts')
  repairIelts(@Body() body: unknown) {
    const parsed = RepairIeltsSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ieltsRepair.repair({
      dryRun: parsed.data.dryRun,
      provenancePrefix: parsed.data.provenancePrefix,
      sourceRefPrefix: parsed.data.sourceRefPrefix,
    });
  }
}
