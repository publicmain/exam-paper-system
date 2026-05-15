import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceStatus,
  EnglishLevel,
  MorningQuizStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { QuickPaperInput, QuickPaperService } from '../ai/quick-paper.service';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import { ShuffleService } from '../shuffle/shuffle.service';
import { MorningQuizQaService } from '../morning-quiz-qa/morning-quiz-qa.service';
import { ShortAnswerEvaluatorService } from './short-answer-evaluator.service';
import { autoGradeScripts } from '../student/student.service';

interface ActorCtx {
  id: string;
  role: string;
  ip: string | null;
}

export interface CreateSessionInput {
  date: Date; // y-m-d in school timezone — service derives the windows
  classId: string;
  paperId: string;
  // R10 multi-level: every session belongs to a difficulty band so a
  // class can run several sessions on the same day. Defaults to
  // ielts_authentic for callers that pre-date the multi-level work.
  level?: EnglishLevel;
}

export interface BatchScheduleInput {
  /** Sunday-night-style batch: list of (date, class, paper) tuples to wire. */
  items: Array<{ date: string; classId: string; paperId: string }>;
}

// R10 — attendance window per spec:
//   8:30:00 – 8:35:00     → on_time
//   8:35:00 – 8:59:59.999 → late
//   9:00:00+              → absent (an absent attendance row gets created
//                            on attempted scan after this point so the
//                            roster shows them as no-show)
//   9:00:00               → quiz auto-locks; in-progress submissions
//                            flip to submitted by the cron tick
//
// lateCutoff is set at 08:59:59 (NOT 09:00:00) so the strict `<` invariant
// `lateCutoff < quizEnd` still holds and the boundary-second is unambiguous.
const ATTENDANCE_START_LOCAL = '08:30:00';
const ATTENDANCE_END_LOCAL = '08:35:00';
const LATE_CUTOFF_LOCAL = '08:59:59';
const QUIZ_END_LOCAL = '09:00:00';

/**
 * Whitelist of `snapshotContent` fields that are safe to send to a student
 * during an active quiz. ANY field not on this list is dropped, including
 * fields that don't exist today but may be added by a future PR
 * (correctXxx, exampleAnswer, explanation, markScheme, answerContent …).
 * The deny-by-default posture means redaction is correct-by-construction
 * — see round-3 SUMMARY C1 for why the previous omit-list was unsafe.
 *
 * If a new safe field is needed by the UI, add it here AND update
 * docs/UI-QUESTION-TYPES.md so the contract stays in sync.
 */
const SAFE_SNAPSHOT_SCALAR_FIELDS = new Set([
  // Common stem / instruction text
  'stem',
  'prompt',
  'instruction',
  // Reading-comprehension shared context
  'passage',
  'passageTitle',
  // IELTS reading task discriminator
  'taskType',
  // Vocab in context
  'contextSentence',
  'targetWord',
  // Sentence transformation
  'original',
  'starter',
  'maxWords',
  // Cloze
  // (passage already listed; per-blank correctAnswer is INTENTIONALLY omitted)
  // Renderer hint set by the AI generator (cloze / vocab / transformation)
  'uiKind',
]);

/**
 * Per-question option-bank fields nested inside snapshotContent (separate
 * from the top-level snapshotOptions). Values are arrays of {key, text};
 * we re-strip each entry to drop any "correct" flag the bank may carry.
 */
const SAFE_SNAPSHOT_BANK_FIELDS = new Set(['headingsBank', 'wordBank']);

/**
 * Redact a `snapshotContent` JSON for delivery to a student.
 * Whitelist-based: only known-safe fields pass; everything else (incl.
 * answer-key fields like `correctOption`, `correctAnswer`, `explanation`,
 * `exampleAnswer`, `markScheme`, `answerContent`, `solution`, etc.) is
 * silently dropped.
 */
export function redactSnapshotForStudent(sc: unknown): unknown {
  if (sc == null) return sc;
  if (typeof sc !== 'object' || Array.isArray(sc)) return sc;
  const src = sc as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    if (SAFE_SNAPSHOT_SCALAR_FIELDS.has(k)) {
      out[k] = src[k];
    } else if (SAFE_SNAPSHOT_BANK_FIELDS.has(k) && Array.isArray(src[k])) {
      out[k] = (src[k] as unknown[]).map((b: any) => ({
        key: b?.key,
        text: b?.text,
      }));
    }
    // anything else: dropped (deny by default)
  }
  return out;
}

/**
 * Combine a y-m-d and a hh:mm:ss string in school local time (assumed
 * Asia/Singapore = UTC+8) into a UTC Date. We avoid pulling a tz library
 * for this single use; the offset is hard-coded but adjustable via the
 * MORNING_QUIZ_TZ_OFFSET_MIN env var if the school ever moves.
 */
function combineLocal(dateOnlyIso: string, timeLocal: string, tzOffsetMin = 8 * 60): Date {
  const [h, m, s] = timeLocal.split(':').map(Number);
  // dateOnlyIso = "2026-05-12"
  const [y, mo, d] = dateOnlyIso.split('-').map(Number);
  // Build UTC ms then subtract the tz offset to land on the "local" wall clock.
  const utcMs = Date.UTC(y, mo - 1, d, h, m, s ?? 0) - tzOffsetMin * 60_000;
  return new Date(utcMs);
}

@Injectable()
export class MorningQuizService {
  private readonly logger = new Logger('MorningQuizService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly shuffle: ShuffleService,
    private readonly quickPaper: QuickPaperService,
    private readonly qaReview: MorningQuizQaService,
    // Optional Claude-backed short-answer grader. Wired in the module so
    // the re-grade endpoint here applies byte-identical rules to the
    // cron's lockOne path (which uses the same evaluator).
    private readonly evaluator?: ShortAnswerEvaluatorService,
  ) {}

  /**
   * Wraps a paper generator with the AI QA review loop.
   *
   * 1. Caller passes a fresh-paper-builder closure (passage_pick or AI gen).
   * 2. We run it, run review, and decide:
   *    - verdict=pass         → return paperId (live)
   *    - verdict=needs_review → return paperId (live but flagged for teacher)
   *    - verdict=reject       → archive the paper, bump retries, re-run the
   *      generator from step 1. Cap at 2 retries (3 total tries) before
   *      surfacing the last reject paper for manual triage.
   *
   * Retries upgrade to the strict (Opus) model so we don't get the same
   * subtle miss twice.
   */
  private async generateWithQaLoop(
    builder: () => Promise<string>,
    actor: ActorCtx,
    contextLabel: string,
  ): Promise<string> {
    const MAX_RETRIES = 2;
    let lastPaperId = '';
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const paperId = await builder();
      lastPaperId = paperId;
      try {
        const review = await this.qaReview.reviewPaper(paperId, actor, {
          strict: attempt > 0,
        });
        await this.prisma.paper.update({
          where: { id: paperId },
          data: { qaReviewRetries: attempt },
        });
        if (review.verdict === 'reject' && attempt < MAX_RETRIES) {
          this.logger.warn(
            `qa-review reject (attempt ${attempt + 1}/${MAX_RETRIES + 1}) ` +
              `paper=${paperId} ${contextLabel} — archiving + regenerating. ` +
              `summary="${review.summary.slice(0, 120)}"`,
          );
          await this.prisma.paper.update({
            where: { id: paperId },
            data: { status: 'archived' },
          });
          continue;
        }
        return paperId;
      } catch (e: any) {
        // Review itself failed (Anthropic outage, parse error). Don't loop —
        // just surface the paper as-is with verdict=pending so a teacher can
        // either re-run review or push it through manually.
        this.logger.error(
          `qa-review error paper=${paperId} ${contextLabel}: ${String(e?.message ?? e).slice(0, 200)}`,
        );
        return paperId;
      }
    }
    // Hit the retry cap. Audit it and return the last paper for triage.
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.qa_review.retry_exhausted',
      entityType: 'Paper',
      entityId: lastPaperId,
      ip: actor.ip,
      metadata: { contextLabel, attempts: MAX_RETRIES + 1 },
    });
    return lastPaperId;
  }

  async createSession(input: CreateSessionInput, actor: ActorCtx) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }

    const dateIso = input.date.toISOString().slice(0, 10);
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const attendanceStart = combineLocal(dateIso, ATTENDANCE_START_LOCAL, tzOff);
    const attendanceEnd = combineLocal(dateIso, ATTENDANCE_END_LOCAL, tzOff);
    const lateCutoff = combineLocal(dateIso, LATE_CUTOFF_LOCAL, tzOff);
    const quizEnd = combineLocal(dateIso, QUIZ_END_LOCAL, tzOff);

    // Invariant: window times must be strictly ordered. Without this, a
    // misconfigured MORNING_QUIZ_TZ_OFFSET_MIN or a bad set of LOCAL
    // constants would silently produce a session where every scan falls
    // into the absent branch, or where lateCutoff <= attendanceEnd makes
    // 'late' status unreachable.
    if (
      !(attendanceStart < attendanceEnd) ||
      !(attendanceEnd < lateCutoff) ||
      !(lateCutoff < quizEnd)
    ) {
      throw new BadRequestException({
        code: 'invalid_session_time_window',
        windows: { attendanceStart, attendanceEnd, lateCutoff, quizEnd },
      });
    }

    const cls = await this.prisma.class.findUnique({
      where: { id: input.classId },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException({ code: 'class_not_found' });

    const paper = await this.prisma.paper.findUnique({
      where: { id: input.paperId },
      select: { id: true, totalMarksActual: true },
    });
    if (!paper) throw new NotFoundException({ code: 'paper_not_found' });

    // Bind paper → class via PaperAssignment (1:1). Reuse existing if present;
    // otherwise create. dueAt aligned with quizEnd so existing student.service
    // already-closed gate triggers naturally at 09:00.
    const assignment = await this.prisma.paperAssignment.upsert({
      where: { paperId_classId: { paperId: input.paperId, classId: input.classId } },
      update: { dueAt: quizEnd, startAt: attendanceStart },
      create: {
        paperId: input.paperId,
        classId: input.classId,
        assignedById: actor.id,
        dueAt: quizEnd,
        startAt: attendanceStart,
        durationMin: 30,
        status: 'scheduled',
      },
    });

    // R10 multi-level: a session is keyed on (date, class, level), so a
    // single class can run sessions across all 3 difficulty bands on the
    // same day without colliding. Default to ielts_authentic when the
    // caller didn't supply one (pre-multi-level callers).
    const sessionLevel: EnglishLevel = input.level ?? 'ielts_authentic';
    const existing = await this.prisma.morningQuizSession.findUnique({
      where: {
        date_classId_level: {
          date: attendanceStart,
          classId: input.classId,
          level: sessionLevel,
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'session_already_exists',
        sessionId: existing.id,
      });
    }

    const session = await this.prisma.morningQuizSession.create({
      data: {
        date: attendanceStart,
        classId: input.classId,
        level: sessionLevel,
        paperAssignmentId: assignment.id,
        attendanceStart,
        attendanceEnd,
        lateCutoff,
        quizStart: attendanceStart,
        quizEnd,
        qrSecret: randomBytes(16).toString('hex'),
        status: MorningQuizStatus.scheduled,
        scheduledById: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.session.create',
      entityType: 'MorningQuizSession',
      entityId: session.id,
      ip: actor.ip,
      metadata: { date: dateIso, classId: input.classId, paperId: input.paperId },
    });

    return session;
  }

  /**
   * Sunday-night batch. Loops items and creates one session per (date, class,
   * paper). Each item runs in its own try/catch so a single conflict doesn't
   * abort the whole week. Returns a per-item result array the UI can render.
   */
  async batchSchedule(input: BatchScheduleInput, actor: ActorCtx) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const results: Array<
      | { ok: true; index: number; sessionId: string }
      | { ok: false; index: number; code: string; detail?: unknown }
    > = [];

    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      try {
        const session = await this.createSession(
          { date: new Date(item.date), classId: item.classId, paperId: item.paperId },
          actor,
        );
        results.push({ ok: true, index: i, sessionId: session.id });
      } catch (e: any) {
        const detail = typeof e?.response === 'object' ? e.response : e?.message;
        const code = (e?.response?.code as string) ?? 'unknown_error';
        results.push({ ok: false, index: i, code, detail });
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.batch_schedule',
      entityType: 'MorningQuizSession',
      entityId: '(batch)',
      ip: actor.ip,
      metadata: {
        total: input.items.length,
        ok: results.filter((r) => r.ok).length,
        fail: results.filter((r) => !r.ok).length,
      },
    });

    return { results };
  }

  /**
   * AI batch — Sunday-night-style. For each weekday × class, look up the
   * class's English level, call QuickPaperService to author a fresh paper,
   * then create a MorningQuizSession bound to it. Each tuple runs in its
   * own try/catch so a single Anthropic timeout doesn't kill the week.
   */
  async batchGenerateForWeek(
    input: {
      weekStart: string;
      classIds?: string[];
      questionsPerPaper?: number;
      /**
       * Wipe existing sessions+papers in the window before generating.
       * Used when a fresh content bank has just been ingested and the
       * operator wants the week's quizzes regenerated against the new
       * bank rather than waiting for LRU rotation to organically reach
       * the new picks. Destructive: any student submissions or answer
       * scripts in the window are deleted along with the papers via FK
       * cascade.
       */
      force?: boolean;
    },
    actor: ActorCtx,
  ) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const monday = new Date(input.weekStart);
    if (Number.isNaN(monday.getTime())) {
      throw new BadRequestException({ code: 'bad_week_start' });
    }
    const targetCount = input.questionsPerPaper ?? 18;

    // Generate one entry per non-skipped weekday in the week starting at
    // `monday` (caller passes a Monday but we don't assume — we iterate
    // 7 calendar days and filter by weekday). School schedule: no morning
    // quiz on Mondays (assembly day) or weekends, so the active week is
    // Tue / Wed / Thu / Fri = 4 sessions per class per level. If the
    // school's no-quiz-day policy ever changes, update SKIP_WEEKDAYS.
    //
    // Using getUTCDay() (not getDay()) because the underlying Date columns
    // are stored as @db.Date at UTC midnight and we want the comparison
    // to match how the DB sees the day — avoids "server is in Pacific
    // tz and thinks UTC-midnight 5/12 is still 5/11" type bugs.
    const SKIP_WEEKDAYS = new Set([0, 1, 6]); // 0=Sun, 1=Mon, 6=Sat
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getTime() + i * 86_400_000);
      if (SKIP_WEEKDAYS.has(d.getUTCDay())) continue;
      dates.push(d.toISOString().slice(0, 10));
    }

    // If caller omitted classIds, default to every class that has at least
    // one ClassEnglishLevel row — i.e. every class scheduled for morning
    // quiz. Lets school-wide regen go through with one POST instead of the
    // operator enumerating class IDs by hand.
    let classIds = input.classIds ?? [];
    if (classIds.length === 0) {
      const rows = await this.prisma.classEnglishLevel.findMany({
        distinct: ['classId'],
        select: { classId: true },
      });
      classIds = rows.map((r) => r.classId);
      if (classIds.length === 0) {
        throw new BadRequestException({
          code: 'no_classes_with_levels',
          hint: 'No class has a ClassEnglishLevel registered; nothing to generate.',
        });
      }
    }

    type Outcome =
      | { ok: true; date: string; classId: string; level: string; sessionId: string; paperId: string }
      | { ok: false; date: string; classId: string; level?: string; code: string; detail?: string };
    const outcomes: Outcome[] = [];

    // force: pre-wipe existing sessions + papers (and their FK-cascaded
    // assignments / questions / submissions / scripts) for the window.
    // We delete Paper rows by id; PaperAssignment → Cascade,
    // PaperQuestion → Cascade, MorningQuizSession → Cascade (via
    // PaperAssignment), StudentSubmission → Cascade (via PaperAssignment),
    // AnswerScript → Cascade (via StudentSubmission). One deleteMany call
    // unwinds the whole dependent tree.
    let wiped = 0;
    if (input.force) {
      // Bug 6 fix — match by half-open instant range, not by `date: { in: [UTC midnights] }`.
      // `MorningQuizSession.date` is written from `attendanceStart` (a real
      // instant), so `in: [UTC midnight, ...]` matched nothing and the wipe
      // deleted 0 sessions — even when the preview (after its own fix)
      // reported N>0. The range filter [Mon, next-Mon) is intentionally
      // wider than `dates[]` (which already filters out Mon/Sat/Sun); since
      // no session is generated on a skip-day anyway, the extra coverage is
      // a no-op in practice and we get exact agreement with the preview.
      const rangeStart = monday;                                       // inclusive
      const rangeEnd = new Date(monday.getTime() + 7 * 86_400_000);    // exclusive
      const sessions = await this.prisma.morningQuizSession.findMany({
        where: {
          classId: { in: classIds },
          date: { gte: rangeStart, lt: rangeEnd },
        },
        select: { id: true, paperAssignment: { select: { paperId: true } } },
      });
      const paperIds = sessions
        .map((s) => s.paperAssignment?.paperId)
        .filter((id): id is string => !!id);
      if (paperIds.length > 0) {
        const r = await this.prisma.paper.deleteMany({
          where: { id: { in: paperIds } },
        });
        wiped = r.count;
        this.logger.log(
          `batch-regenerate force-wiped ${wiped} paper(s) (${sessions.length} session row(s)) in [${rangeStart.toISOString().slice(0, 10)}..${rangeEnd.toISOString().slice(0, 10)})`,
        );
      }
    }

    for (const dateIso of dates) {
      for (const classId of classIds) {
        // R10 multi-level: a class can register N difficulty bands at
        // once. Fan out to one (date, classId, level) session per band.
        const levelRows = await this.prisma.classEnglishLevel.findMany({
          where: { classId },
          orderBy: { level: 'asc' },
        });
        if (levelRows.length === 0) {
          outcomes.push({ ok: false, date: dateIso, classId, code: 'class_level_not_set' });
          continue;
        }

        const cls = await this.prisma.class.findUnique({
          where: { id: classId },
          select: { weeklyFocus: true },
        });
        const weeklyFocus = cls?.weeklyFocus ?? null;

        for (const levelRow of levelRows) {
          try {
            // Idempotent — skip if a session already exists for
            // (date, class, level). Multi-level adds the level dimension
            // so different bands on the same day no longer collide.
            const existingSession = await this.prisma.morningQuizSession.findUnique({
              where: {
                date_classId_level: {
                  date: new Date(dateIso),
                  classId,
                  level: levelRow.level,
                },
              },
            });
            if (existingSession) {
              outcomes.push({
                ok: false,
                date: dateIso,
                classId,
                level: levelRow.level,
                code: 'session_already_exists',
                detail: existingSession.id,
              });
              continue;
            }

            // R10 — every level now picks pre-curated content from a
            // human-vetted bank instead of calling the AI inline:
            //   ielts_authentic   → Cambridge IELTS Academic passages
            //                       (Cambridge IELTS 8, all 12; later
            //                       books to be ingested)
            //   ielts_simplified  → Singapore O-Level 1128 §B-style
            //                       short narratives (Claude-authored,
            //                       ~350-500 words, easier vocabulary).
            //                       Used to read IELTS GT 14 but was
            //                       re-routed to O-Level syllabus for
            //                       cohort fit — the "middle band" is
            //                       now O-Level at a stretch difficulty,
            //                       not IELTS GT.
            //   olevel            → Singapore O-Level 1128 §B narratives
            //                       (real-PDF Singapore prelims + Claude-
            //                       authored full-difficulty originals)
            //
            // The QA review loop (generateWithQaLoop) is bypassed: the
            // bank items have already passed audit at ingest time and
            // re-reviewing them with AI would just burn Anthropic credit.
            //
            // weeklyFocus is preserved as a field on the paper config
            // for future use (e.g. teacher post-hoc filtering); it's no
            // longer threaded into a runtime AI prompt.
            void weeklyFocus;
            void targetCount;
            let paperId: string;
            if (levelRow.level === 'ielts_authentic') {
              paperId = await this.pickPassageAndCreatePaper(
                'IELTS', 'AUTH', classId, dateIso, actor,
                { provenanceFilter: 'authentic' },
              );
            } else if (levelRow.level === 'ielts_simplified') {
              // Middle band: pull from OLEVEL simplified tier, not IELTS GT.
              paperId = await this.pickOlevelPaperAndCreatePaper(
                classId, dateIso, actor,
                { provenanceFilter: 'simplified' },
              );
            } else {
              // olevel basic band: pull from OLEVEL standard tier.
              paperId = await this.pickOlevelPaperAndCreatePaper(
                classId, dateIso, actor,
                { provenanceFilter: 'standard' },
              );
            }

            const session = await this.createSession(
              { date: new Date(dateIso), classId, paperId, level: levelRow.level },
              actor,
            );
            outcomes.push({
              ok: true,
              date: dateIso,
              classId,
              level: levelRow.level,
              sessionId: session.id,
              paperId,
            });
          } catch (e: any) {
            const code = (e?.response?.code as string) ?? e?.message ?? 'unknown_error';
            outcomes.push({
              ok: false,
              date: dateIso,
              classId,
              level: levelRow.level,
              code: String(code).slice(0, 100),
            });
          }
        }
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.batch_generate',
      entityType: 'MorningQuizSession',
      entityId: '(batch)',
      ip: actor.ip,
      metadata: {
        weekStart: input.weekStart,
        classCount: classIds.length,
        forceWiped: wiped,
        ok: outcomes.filter((o) => o.ok).length,
        fail: outcomes.filter((o) => !o.ok).length,
      },
    });
    return { wiped, outcomes };
  }

  /**
   * Build a Paper from one whole passage in the bank instead of generating
   * unrelated questions via AI. Logic:
   *   1. Find every Question under (subjectCode, componentCode) with
   *      sourceType='past_paper_reference' (i.e. real exam content).
   *   2. Group by passage prefix parsed from sourceRef. We use the
   *      pattern `IELTS/<book>/Test<N>/P<M>` for Cambridge IELTS — an
   *      example sourceRef like `IELTS/8/Test1/P1/Q3` collapses to
   *      `IELTS/8/Test1/P1` as the passage key.
   *   3. Skip passages already used by this class within the last 30
   *      days (we stash the passageRef in Paper.config so the next call
   *      can find it without joining through PaperAssignment back-relations).
   *   4. Pick a remaining passage at random; if every passage has been
   *      used in the window, fall through to least-recent.
   *   5. Spin up a Paper + PaperQuestion rows snapshotting the questions'
   *      content / answer / options, just like the AI-gen path does.
   */
  private async pickPassageAndCreatePaper(
    subjectCode: string,
    componentCode: string,
    classId: string,
    dateIso: string,
    actor: ActorCtx,
    opts: { provenanceFilter?: 'authentic' | 'simplified' } = {},
  ): Promise<string> {
    const subject = await this.prisma.subject.findFirst({
      where: { code: subjectCode },
      // R10 follow-up — Subject has no createdAt; cuid is itself
      // timestamp-prefixed (lexicographic order ≈ creation order),
      // so `orderBy id asc` reliably picks the OLDEST IELTS subject.
      // Both ielts-ingest and content-bootstrap use the same order
      // so ingest + picker always agree on which row to read/write.
      orderBy: { id: 'asc' },
      include: { components: { where: { code: componentCode } } },
    });
    if (!subject || subject.components.length === 0) {
      throw new BadRequestException({
        code: 'subject_or_component_not_found',
        subjectCode,
        componentCode,
      });
    }
    const component = subject.components[0];

    // R10 — provenanceTag filter so a `ielts_authentic` session only
    // pulls Cambridge IELTS Academic passages and `ielts_simplified`
    // only pulls Cambridge IELTS General Training passages. Both
    // share the same Subject/Component (IELTS/AUTH); the band is
    // disambiguated entirely by provenanceTag:
    //   authentic  → tag like `cambridge_ielts_<n>_authentic` (Academic)
    //   simplified → tag = `cambridge_ielts_gt` (General Training)
    // Filter implemented as inclusion (simplified) vs exclusion
    // (authentic = anything that isn't GT) so a future band rename
    // doesn't accidentally drop authentic content.
    const filter = opts.provenanceFilter ?? 'authentic';
    const provenanceCondition =
      filter === 'simplified'
        ? { provenanceTag: 'cambridge_ielts_gt' }
        : { NOT: { provenanceTag: 'cambridge_ielts_gt' } };

    const bank = await this.prisma.question.findMany({
      where: {
        subjectId: subject.id,
        componentId: component.id,
        status: 'active',
        sourceType: 'past_paper_reference',
        ...provenanceCondition,
      },
      orderBy: { sourceRef: 'asc' },
    });

    // Group by passage prefix. e.g. "IELTS/8/Test1/P1/Q3" → "IELTS/8/Test1/P1"
    const byPassage = new Map<string, typeof bank>();
    for (const q of bank) {
      const ref = q.sourceRef ?? '';
      const m = ref.match(/^([^/]+\/[^/]+\/Test\d+\/P\d+)\//);
      if (!m) continue;
      const key = m[1];
      if (!byPassage.has(key)) byPassage.set(key, []);
      byPassage.get(key)!.push(q);
    }
    if (byPassage.size === 0) {
      throw new BadRequestException({
        code: 'no_passages_in_bank',
        hint: `No real-question bank under ${subjectCode}/${componentCode}. Ingest past-paper PDFs first.`,
      });
    }

    // Filter out passages this class has EVER been served (no time window).
    // User decision: a passage that's been used once is retired from the
    // candidate pool permanently — repeats only happen when the entire
    // bank is exhausted (LRU fallback below), at which point ops sees a
    // loud warn() and ingests more content. When a Paper row is deleted
    // (e.g. via force-regenerate), its passageRef silently rejoins the
    // candidate pool — no extra bookkeeping needed because we read the
    // ever-used set live from Paper rows.
    //
    // Round-7 hardening retained:
    //   - scope to (this subject + passage_pick mode) so unrelated picks
    //     can't skew the bucket;
    //   - track lastUsedAt per passage so the LRU fallback picks the
    //     oldest, not the deterministic [0] (which used to silent-loop
    //     "every Monday same passage");
    //   - emit a loud warn() when the bank is depleted so ops can act.
    const recentPapers = await this.prisma.paper.findMany({
      where: {
        subjectId: subject.id,
        assignments: { some: { classId } },
      },
      select: { config: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const usedPassageRefs = new Set<string>();
    const lastUsedAt = new Map<string, number>();
    for (const p of recentPapers) {
      const cfg = p.config as { mode?: string; passageRef?: string } | null;
      if (cfg?.mode !== 'passage_pick' || !cfg?.passageRef) continue;
      usedPassageRefs.add(cfg.passageRef);
      const t = p.createdAt.getTime();
      if ((lastUsedAt.get(cfg.passageRef) ?? 0) < t) {
        lastUsedAt.set(cfg.passageRef, t);
      }
    }
    const candidates = Array.from(byPassage.keys()).filter(
      (k) => !usedPassageRefs.has(k),
    );
    let pick: string;
    if (candidates.length > 0) {
      pick = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // Bank depleted — pick the least recently used to avoid a silent
      // weekly loop. Loud-log so the ops dashboard surfaces this and
      // someone ingests more passages.
      const sorted = Array.from(byPassage.keys()).sort(
        (a, b) => (lastUsedAt.get(a) ?? 0) - (lastUsedAt.get(b) ?? 0),
      );
      pick = sorted[0];
      this.logger.warn(
        `passage_pick bank exhausted (lifetime) for class=${classId} subject=${subjectCode} — recycling LRU passage=${pick} ` +
          `(bank=${byPassage.size}, ever served=${usedPassageRefs.size}). Ingest more past papers.`,
      );
    }
    // Sort questions inside the passage NUMERICALLY by Q-number — string
    // sort puts Q10..Q13 before Q2..Q9, which scrambles the test ordering.
    // We extract the trailing /Q<n> from sourceRef and sort by the integer.
    const passageQuestions = byPassage.get(pick)!.slice().sort((a, b) => {
      const an = parseInt(a.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10);
      const bn = parseInt(b.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10);
      return an - bn;
    });

    const totalMarks = passageQuestions.reduce((s, q) => s + q.marks, 0);
    const paper = await this.prisma.paper.create({
      data: {
        name: `Morning Quiz ${pick} (${dateIso})`,
        ownerId: actor.id,
        subjectId: subject.id,
        componentId: component.id,
        durationMin: 30,
        totalMarksTarget: totalMarks,
        totalMarksActual: totalMarks,
        status: 'draft',
        generatedSeed: Math.floor(Math.random() * 1e9),
        config: {
          mode: 'passage_pick',
          passageRef: pick,
          // Store the provenance filter so bankStatsForClass can bucket
          // authentic vs simplified picks correctly without resorting to
          // path-suffix heuristics on the passageRef.
          provenanceFilter: filter,
          questionCount: passageQuestions.length,
          dateIso,
        },
      },
    });
    for (let i = 0; i < passageQuestions.length; i++) {
      const q = passageQuestions[i];
      await this.prisma.paperQuestion.create({
        data: {
          paperId: paper.id,
          questionId: q.id,
          sortOrder: i + 1,
          snapshotContent: q.content as any,
          snapshotAnswer: q.answerContent as any,
          snapshotOptions: q.options as any,
          marks: q.marks,
        },
      });
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.passage_pick',
      entityType: 'Paper',
      entityId: paper.id,
      ip: actor.ip,
      metadata: {
        passageRef: pick,
        classId,
        dateIso,
        questionCount: passageQuestions.length,
      },
    });
    return paper.id;
  }

  /**
   * R10 — OLEVEL paper picker. Mirrors pickPassageAndCreatePaper but
   * for the OLEVEL bank (sourceRef prefix `OLEVEL/<setCode>/PaperN`).
   * Each "set" is a complete pre-curated paper Claude wrote and POSTed
   * via /api/olevel-ingest/paper, with mixed question types (cloze /
   * vocab / transformation). Picks the least-recently-used paper for
   * this class with lifetime de-dup — same as IELTS picker.
   */
  private async pickOlevelPaperAndCreatePaper(
    classId: string,
    dateIso: string,
    actor: ActorCtx,
    opts: { provenanceFilter?: 'standard' | 'simplified' } = {},
  ): Promise<string> {
    const subject = await this.prisma.subject.findFirst({
      where: { code: '1123' },
      include: { components: true },
    });
    if (!subject || subject.components.length === 0) {
      throw new BadRequestException({
        code: 'subject_not_seeded',
        hint: 'OLEVEL 1123 syllabus not seeded; run prisma seed.',
      });
    }
    // The OLEVEL ingest API stamps Question.sourceRef =
    // `OLEVEL/<setCode>/Paper<n>/Q<m>`. Group by the prefix up to /Q.
    //
    // R10 follow-up — the OLEVEL bank is now bucketed into two tiers by
    // provenanceTag:
    //   standard  → real-PDF prelims (singapore_olevel_1128) + AI-authored
    //               full-difficulty (ai_authored_olevel_1128). Serves the
    //               `olevel` basic band.
    //   simplified → AI-authored shorter/easier narratives
    //               (ai_authored_olevel_1128_simplified). Serves the
    //               `ielts_simplified` middle band, which used to read
    //               IELTS GT but now reads O-Level §B at a stretch-toward-
    //               O-Level difficulty.
    // The filter is implemented as inclusion (simplified) vs exclusion
    // (standard = anything that is NOT the simplified tag) so any future
    // standard-tier provenance tag we add (e.g. for Boon Lay, Hua Yi) is
    // picked up automatically without code changes.
    const filter = opts.provenanceFilter ?? 'standard';
    const tierCondition =
      filter === 'simplified'
        ? { provenanceTag: 'ai_authored_olevel_1128_simplified' }
        : { NOT: { provenanceTag: 'ai_authored_olevel_1128_simplified' } };
    const bank = await this.prisma.question.findMany({
      where: {
        subjectId: subject.id,
        status: 'active',
        sourceType: 'past_paper_reference',
        sourceRef: { startsWith: 'OLEVEL/' },
        ...tierCondition,
      },
      orderBy: { sourceRef: 'asc' },
    });
    const byPaperKey = new Map<string, typeof bank>();
    for (const q of bank) {
      const m = q.sourceRef?.match(/^(OLEVEL\/[^/]+\/Paper\d+)\//);
      if (!m) continue;
      const key = m[1];
      if (!byPaperKey.has(key)) byPaperKey.set(key, []);
      byPaperKey.get(key)!.push(q);
    }
    if (byPaperKey.size === 0) {
      throw new BadRequestException({
        code: 'no_olevel_papers_in_bank',
        hint: 'POST OLEVEL papers via /api/olevel-ingest/paper first.',
      });
    }

    // Lifetime de-dup against this class's OLEVEL picks (no time window),
    // SCOPED TO THIS TIER. A paper that's been served once is retired
    // from the candidate pool permanently; repeats only happen when the
    // entire tier is exhausted (LRU fallback below). Cross-tier picks
    // don't dedup each other — the basic and middle bands run on
    // different days for different students. When a Paper row is deleted
    // (e.g. force-regenerate), its paperKey silently rejoins this pool.
    const recent = await this.prisma.paper.findMany({
      where: {
        subjectId: subject.id,
        assignments: { some: { classId } },
      },
      select: { config: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const usedKeys = new Set<string>();
    const lastUsedAt = new Map<string, number>();
    for (const p of recent) {
      const cfg = p.config as { mode?: string; paperKey?: string; provenanceFilter?: string } | null;
      if (cfg?.mode !== 'olevel_curated' || !cfg?.paperKey) continue;
      // Only count picks from the same tier. Legacy rows without
      // provenanceFilter were all standard-tier (this field landed with
      // the simplified-tier split), so default to 'standard' for those.
      const pickTier = cfg.provenanceFilter ?? 'standard';
      if (pickTier !== filter) continue;
      usedKeys.add(cfg.paperKey);
      const t = p.createdAt.getTime();
      if ((lastUsedAt.get(cfg.paperKey) ?? 0) < t) lastUsedAt.set(cfg.paperKey, t);
    }
    const candidates = Array.from(byPaperKey.keys()).filter((k) => !usedKeys.has(k));
    let pick: string;
    if (candidates.length > 0) {
      pick = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      const sorted = Array.from(byPaperKey.keys()).sort(
        (a, b) => (lastUsedAt.get(a) ?? 0) - (lastUsedAt.get(b) ?? 0),
      );
      pick = sorted[0];
      this.logger.warn(
        `olevel pick bank exhausted (lifetime, tier=${filter}) for class=${classId} — recycling LRU paper=${pick} ` +
          `(bank=${byPaperKey.size}, ever served=${usedKeys.size}). Ingest more papers.`,
      );
    }
    // Sort by trailing Q-number numerically (same trick as IELTS).
    const items = byPaperKey.get(pick)!.slice().sort((a, b) => {
      const an = parseInt(a.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10);
      const bn = parseInt(b.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10);
      return an - bn;
    });
    const totalMarks = items.reduce((s, q) => s + q.marks, 0);
    const component = subject.components[0];
    const paper = await this.prisma.paper.create({
      data: {
        name: `Morning Quiz ${pick} (${dateIso})`,
        ownerId: actor.id,
        subjectId: subject.id,
        componentId: component.id,
        durationMin: 30,
        totalMarksTarget: totalMarks,
        totalMarksActual: totalMarks,
        status: 'draft',
        generatedSeed: Math.floor(Math.random() * 1e9),
        config: {
          mode: 'olevel_curated',
          paperKey: pick,
          provenanceFilter: filter,
          dateIso,
          questionCount: items.length,
        },
      },
    });
    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      await this.prisma.paperQuestion.create({
        data: {
          paperId: paper.id,
          questionId: q.id,
          sortOrder: i + 1,
          snapshotContent: q.content as any,
          snapshotAnswer: q.answerContent as any,
          snapshotOptions: q.options as any,
          marks: q.marks,
        },
      });
    }
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.olevel_pick',
      entityType: 'Paper',
      entityId: paper.id,
      ip: actor.ip,
      metadata: { paperKey: pick, classId, dateIso, questionCount: items.length },
    });
    return paper.id;
  }

  /**
   * Read-only mirror of the pick* logic: for each registered level on a
   * class, count how many unique passages/papers the bank has and how
   * many this class has EVER been served. Used by the schedule UI to
   * flag depletion BEFORE the operator hits "generate" and silently
   * lands on an LRU recycle.
   *
   * Lifetime dedup matches the dedup policy in pickPassageAndCreatePaper
   * and pickOlevelPaperAndCreatePaper — if you change one you must change
   * the other or this counter lies. Field name `usedRecent` is kept for
   * API backward-compat (UI clients still read it); semantically it now
   * means "ever served" not "in last 30 days".
   */
  async bankStatsForClass(classId: string): Promise<
    Array<{
      level: EnglishLevel;
      totalBank: number;
      usedRecent: number;
      remaining: number;
      depleted: boolean;
    }>
  > {
    const levelRows = await this.prisma.classEnglishLevel.findMany({
      where: { classId },
      orderBy: { level: 'asc' },
    });
    if (levelRows.length === 0) return [];

    // Helper: count unique passage prefixes in the IELTS bank under one
    // provenance filter. Mirrors pickPassageAndCreatePaper's bucketing.
    const countIeltsBank = async (
      provenanceFilter: 'authentic' | 'simplified',
    ): Promise<number> => {
      const subject = await this.prisma.subject.findFirst({
        where: { code: 'IELTS' },
        orderBy: { id: 'asc' },
        include: { components: { where: { code: 'AUTH' } } },
      });
      if (!subject || subject.components.length === 0) return 0;
      const provenanceCondition =
        provenanceFilter === 'simplified'
          ? { provenanceTag: 'cambridge_ielts_gt' }
          : { NOT: { provenanceTag: 'cambridge_ielts_gt' } };
      const bank = await this.prisma.question.findMany({
        where: {
          subjectId: subject.id,
          componentId: subject.components[0].id,
          status: 'active',
          sourceType: 'past_paper_reference',
          ...provenanceCondition,
        },
        select: { sourceRef: true },
      });
      const passages = new Set<string>();
      for (const q of bank) {
        const m = (q.sourceRef ?? '').match(/^([^/]+\/[^/]+\/Test\d+\/P\d+)\//);
        if (m) passages.add(m[1]);
      }
      return passages.size;
    };

    // Helper: count unique OLEVEL paper prefixes in a given tier. Mirrors
    // pickOlevelPaperAndCreatePaper's bucketing — simplified =
    // ai_authored_olevel_1128_simplified only; standard = everything else
    // under OLEVEL/* (real-PDF prelims + AI-authored full-difficulty).
    const countOlevelBank = async (
      tier: 'standard' | 'simplified',
    ): Promise<number> => {
      const subject = await this.prisma.subject.findFirst({
        where: { code: '1123' },
        select: { id: true },
      });
      if (!subject) return 0;
      const tierCondition =
        tier === 'simplified'
          ? { provenanceTag: 'ai_authored_olevel_1128_simplified' }
          : { NOT: { provenanceTag: 'ai_authored_olevel_1128_simplified' } };
      const bank = await this.prisma.question.findMany({
        where: {
          subjectId: subject.id,
          status: 'active',
          sourceType: 'past_paper_reference',
          sourceRef: { startsWith: 'OLEVEL/' },
          ...tierCondition,
        },
        select: { sourceRef: true },
      });
      const paperKeys = new Set<string>();
      for (const q of bank) {
        const m = q.sourceRef?.match(/^(OLEVEL\/[^/]+\/Paper\d+)\//);
        if (m) paperKeys.add(m[1]);
      }
      return paperKeys.size;
    };

    // Per-class lifetime picks (no time window), scoped to mode so we
    // don't accidentally count cross-level papers against each other.
    // Mirrors the lifetime dedup in pickPassageAndCreatePaper /
    // pickOlevelPaperAndCreatePaper.
    const recent = await this.prisma.paper.findMany({
      where: {
        assignments: { some: { classId } },
      },
      select: { config: true },
    });
    const usedByMode = {
      passage_pick_authentic: new Set<string>(),
      passage_pick_simplified: new Set<string>(),
      olevel_curated_standard: new Set<string>(),
      olevel_curated_simplified: new Set<string>(),
    };
    for (const p of recent) {
      const cfg = p.config as
        | { mode?: string; passageRef?: string; paperKey?: string; provenanceFilter?: string }
        | null;
      if (!cfg) continue;
      if (cfg.mode === 'passage_pick' && cfg.passageRef) {
        // passage_pick is now the IELTS authentic path only — the middle
        // band was re-routed to olevel_curated_simplified. Any historical
        // passage_pick picks (including pre-rework GT picks) count against
        // the authentic bucket for accounting purposes; they are also
        // already dedup'd at the picker level via passageRef lifetime set.
        usedByMode.passage_pick_authentic.add(cfg.passageRef);
      } else if (cfg.mode === 'olevel_curated' && cfg.paperKey) {
        // provenanceFilter landed with the simplified-tier split; legacy
        // rows without it were all standard-tier.
        const tier = cfg.provenanceFilter === 'simplified' ? 'simplified' : 'standard';
        if (tier === 'simplified') usedByMode.olevel_curated_simplified.add(cfg.paperKey);
        else usedByMode.olevel_curated_standard.add(cfg.paperKey);
      }
    }

    const out: Array<{
      level: EnglishLevel;
      totalBank: number;
      usedRecent: number;
      remaining: number;
      depleted: boolean;
    }> = [];
    for (const lr of levelRows) {
      let totalBank = 0;
      let usedRecent = 0;
      if (lr.level === 'ielts_authentic') {
        totalBank = await countIeltsBank('authentic');
        usedRecent = usedByMode.passage_pick_authentic.size;
      } else if (lr.level === 'ielts_simplified') {
        // Middle band now pulls from OLEVEL simplified tier, not IELTS GT.
        totalBank = await countOlevelBank('simplified');
        usedRecent = usedByMode.olevel_curated_simplified.size;
      } else {
        totalBank = await countOlevelBank('standard');
        usedRecent = usedByMode.olevel_curated_standard.size;
      }
      const remaining = Math.max(0, totalBank - usedRecent);
      out.push({
        level: lr.level,
        totalBank,
        usedRecent,
        remaining,
        depleted: remaining === 0,
      });
    }
    return out;
  }

  private levelToQuickPaperInput(
    level: EnglishLevel,
    dateIso: string,
    targetCount: number,
  ): QuickPaperInput {
    // Distribute targetCount across the topic mix per level. Keep MVP simple —
    // even split with rounding adjustments. 18 default → ~4 topics × 4-5 each.
    const split = (codes: string[]): Array<{ code: string; count: number }> => {
      const base = Math.floor(targetCount / codes.length);
      const rem = targetCount - base * codes.length;
      return codes.map((c, i) => ({ code: c, count: base + (i < rem ? 1 : 0) }));
    };

    if (level === 'ielts_authentic') {
      return {
        syllabusCode: 'IELTS',
        topics: split(['IR.1', 'IR.2', 'IR.4', 'IR.6']),
        difficulty: 3,
        durationMin: 30,
        includeDiagrams: false,
        paperName: `Morning Quiz IELTS-Auth ${dateIso}`,
        multiPart: false,
      };
    }
    if (level === 'ielts_simplified') {
      // R10: this is the MIDDLE band — strong O-Level students stretching
      // toward IELTS. IELTS task types (TFNG, matching, summary completion)
      // but with O-Level-grade vocabulary and shorter passages. Keep
      // difficulty low (2) and pick the easier IELTS topic codes
      // (IR.1 = main idea, IR.2 = detail, IR.4 = factual matching) —
      // skip the harder inference / opinion / vocabulary tasks
      // (IR.3, IR.5, IR.7) used for authentic-band drills.
      return {
        syllabusCode: 'IELTS',
        topics: split(['IR.1', 'IR.2', 'IR.4']),
        difficulty: 2,
        durationMin: 30,
        includeDiagrams: false,
        paperName: `Morning Quiz IELTS-Simplified ${dateIso}`,
        multiPart: false,
      };
    }
    // olevel
    return {
      syllabusCode: '1123',
      topics: split(['EL.1', 'EL.2', 'EL.4', 'EL.5']),
      difficulty: 2,
      durationMin: 30,
      includeDiagrams: false,
      paperName: `Morning Quiz O-Level ${dateIso}`,
      multiPart: false,
    };
  }

  /** Look at a week's worth of scheduled sessions for the calendar UI.
   *  R15-Audit#2 Finding #4: hide sessions whose class has been
   *  archived — they'd otherwise pollute the schedule view with rows
   *  the operator can't act on. */
  async listScheduled(weekStart: Date) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
    return this.prisma.morningQuizSession.findMany({
      where: {
        date: { gte: weekStart, lt: weekEnd },
        class: { archivedAt: null },
      },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: { include: { paper: { select: { id: true, name: true, totalMarksActual: true } } } },
      },
      orderBy: [{ date: 'asc' }, { class: { name: 'asc' } }],
    });
  }

  /**
   * Cancel — used both by teacher UI and by the holiday admin toggle. Sets
   * status=cancelled so cron skips it; existing attendance rows untouched.
   */
  async cancelSession(sessionId: string, actor: ActorCtx, reason?: string) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const before = await this.prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
    if (!before) throw new NotFoundException({ code: 'session_not_found' });

    const after = await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: { status: MorningQuizStatus.cancelled },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.session.cancel',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      diff: { before: { status: before.status }, after: { status: after.status } },
      metadata: { reason: reason ?? null },
    });
    return after;
  }

  /**
   * Get the paper for the student, with shuffle applied. Caller must have
   * confirmed there's an Attendance row (i.e. they passed scanQr earlier).
   */
  async getStudentView(sessionId: string, studentId: string) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: { paperAssignment: { select: { paperId: true, id: true, classId: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (session.status === MorningQuizStatus.cancelled) {
      throw new BadRequestException({ code: 'session_cancelled' });
    }

    // Confirm the student has an Attendance row (gate: only scanned-in
    // students can fetch the paper; manual_correction also qualifies).
    const att = await this.prisma.attendance.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    });
    if (!att || att.status === AttendanceStatus.absent) {
      throw new ForbiddenException({ code: 'no_attendance_record' });
    }

    const paperId = session.paperAssignment.paperId;
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: { config: true, status: true, qaTeacherAction: true },
    });
    // Round-7 C-F3 — a teacher-rejected paper has status=archived but the
    // MorningQuizSession's PaperAssignment still points at it. Without
    // this guard a student would still receive the rejected paper.
    if (paper?.status === 'archived' || paper?.qaTeacherAction === 'rejected') {
      throw new BadRequestException({ code: 'paper_archived' });
    }
    // R10 multi-level: every session now carries its own `level` column
    // (one of ielts_authentic / ielts_simplified / olevel) so we don't
    // need to round-trip through ClassEnglishLevel anymore. Pre-multi-
    // level sessions were back-filled by the migration to ielts_authentic.
    const sessionLevel: EnglishLevel | null = session.level ?? null;
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId },
      orderBy: { sortOrder: 'asc' },
      include: {
        question: { select: { id: true, questionType: true } },
      },
    });

    // Skip question-order shuffle on passage-pick papers — IELTS Reading
    // groups questions into tasks (Q1-4 matching headings, Q5-9 T/F/NG, etc.)
    // and shuffling tears those groups apart. Option-shuffle inside MCQ
    // questions is still applied per-question by the relabel below.
    const isPassagePick =
      ((paper?.config as { mode?: string } | null)?.mode ?? null) === 'passage_pick';
    let ordered: typeof paperQuestions;
    if (isPassagePick) {
      ordered = paperQuestions;
    } else {
      const map = await this.shuffle.getOrCreate(studentId, paperId);
      ordered = this.shuffle.applyToPaper(paperQuestions, map);
    }

    // Relabel option keys A/B/C/D so the student's choices map cleanly to
    // displayed letters; the original `key` values are preserved separately
    // in the shuffle map for reverse-mapping at save time. (For passage-pick
    // we skip the relabel because keys carry semantic meaning — A=Babylonians
    // in matching_features must stay A.)
    const delivered = ordered.map((pq) => {
      if (pq.question.questionType !== 'mcq') return pq;
      if (isPassagePick) return pq;
      const opts = (pq.snapshotOptions as Array<{ key: string; text: string }> | null) ?? [];
      const relabeled = opts.map((opt, i) => ({
        ...opt,
        key: String.fromCharCode(65 + i),
      }));
      return { ...pq, snapshotOptions: relabeled };
    });

    // SECURITY: strip every answer-key field before sending to a student.
    // snapshotOptions[].correct + snapshotContent.markScheme / answerContent
    // would otherwise be readable in F12 and let the student aim for full
    // marks. Mirrors student.service.redactForStudent's contract.
    //
    // The redaction is an EXPLICIT WHITELIST — anything not on the list is
    // dropped. This avoids the omit-list trap where a future field
    // (correctOption, exampleAnswer, explanation, …) silently flows to the
    // student because nobody updated the deny list. See round-3 SUMMARY C1.
    const stripOptions = (opts: unknown) => {
      if (!Array.isArray(opts)) return opts;
      return opts.map((o: any) => ({ key: o?.key, text: o?.text }));
    };
    const stripSnapshotContent = redactSnapshotForStudent;

    // Derive the quiz UI mode for the client. `level` comes straight
    // from the session row (R10 multi-level); fallback to a paper.config
    // heuristic for any pre-migration session that somehow has level
    // null (defensive).
    const paperMode = (paper?.config as { mode?: string } | null)?.mode ?? null;
    const level = sessionLevel ?? (paperMode === 'passage_pick' ? 'ielts_authentic' : 'olevel');

    // F1 — Resume-on-different-device support. If an in-progress
    // submission already exists for this (assignment, student), pull
    // every persisted AnswerScript so the client can repopulate the
    // form on a fresh device. Returns an empty object if the student
    // has not autosaved anything yet (or if the submission has already
    // been locked / submitted — in which case existingAnswers is empty
    // and the take-paper UI starts blank, matching pre-F1 behaviour).
    const existingAnswers: Record<string, { content: any; flagged: boolean }> = {};
    const inProgressSub = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignment.id,
        studentId,
        status: { not: 'practice' },
      },
      select: { id: true, status: true },
    });
    if (inProgressSub && inProgressSub.status === 'in_progress') {
      const scripts = await this.prisma.answerScript.findMany({
        where: { submissionId: inProgressSub.id },
        select: {
          paperQuestionId: true,
          selectedOption: true,
          textAnswer: true,
        },
      });
      for (const s of scripts) {
        // `content` is either the MCQ key the student picked or the
        // free-text body. `flagged` is reserved for a future "I'll come
        // back to this one" toggle — wired through here so the API
        // shape lands intact even before the column exists.
        const content =
          s.selectedOption != null ? s.selectedOption : s.textAnswer;
        existingAnswers[s.paperQuestionId] = {
          content,
          flagged: false,
        };
      }
    }

    return {
      sessionId: session.id,
      attendanceId: att.id,
      submissionId: att.submissionId,
      quizEnd: session.quizEnd,
      level,
      paperMode,
      // Authoritative quiz mode for the client. Morning quizzes are always
      // 'test' — the server never returns answer-key data through this
      // endpoint, so a client-side `?mode=practice` URL trick can't unlock
      // it. (Practice review of a *submitted* quiz uses POST /check.)
      mode: 'test' as const,
      paperQuestions: delivered.map((pq) => ({
        id: pq.id,
        sortOrder: pq.sortOrder,
        marks: pq.marks,
        snapshotContent: stripSnapshotContent(pq.snapshotContent),
        snapshotOptions: stripOptions(pq.snapshotOptions),
        questionType: pq.question.questionType,
      })),
      // F1 — keyed by paperQuestionId; empty object if nothing autosaved.
      existingAnswers,
    };
  }

  /**
   * Server-authoritative practice-mode check. Only callable AFTER the
   * student has submitted (or the session window has closed): until then,
   * answers stay locked. Returns whether the guess matches the canonical
   * key, plus the canonical key + explanation if the student got it wrong.
   *
   * For MCQ on a non-passage-pick paper we reverse-map the displayed key
   * (A/B/C/D after relabel) back to the original key before comparing —
   * mirroring saveAnswer.
   */
  async checkAnswer(
    sessionId: string,
    body: { paperQuestionId: string; selectedOption?: string | null; textAnswer?: string | null },
    studentId: string,
  ) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: { paperAssignment: { select: { id: true, paperId: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    const submission = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignmentId,
        studentId,
        status: { not: 'practice' },
      },
      select: { status: true },
    });
    const now = new Date();
    const windowClosed = now > session.quizEnd;
    const submitted =
      submission?.status === 'submitted' || submission?.status === 'graded';
    if (!windowClosed && !submitted) {
      // Block during the live window — preserves test integrity.
      throw new ForbiddenException({ code: 'check_blocked_until_submit' });
    }

    const pq = await this.prisma.paperQuestion.findFirst({
      where: { id: body.paperQuestionId, paperId: session.paperAssignment.paperId },
      include: { question: { select: { questionType: true } } },
    });
    if (!pq) throw new NotFoundException({ code: 'paper_question_mismatch' });

    const sc = (pq.snapshotContent ?? {}) as Record<string, unknown>;
    const correctKey =
      typeof sc.correctOption === 'string'
        ? (sc.correctOption as string)
        : typeof sc.correctAnswer === 'string'
        ? (sc.correctAnswer as string)
        : null;
    const explanation =
      typeof sc.explanation === 'string' ? (sc.explanation as string) : null;
    const exampleAnswer =
      typeof sc.exampleAnswer === 'string' ? (sc.exampleAnswer as string) : null;

    let studentChoice = body.selectedOption ?? null;
    if (pq.question.questionType === 'mcq' && studentChoice) {
      const paper = await this.prisma.paper.findUnique({
        where: { id: session.paperAssignment.paperId },
        select: { config: true },
      });
      const isPassagePick =
        ((paper?.config as { mode?: string } | null)?.mode ?? null) === 'passage_pick';
      if (!isPassagePick) {
        const map = await this.shuffle.getOrCreate(studentId, session.paperAssignment.paperId);
        const displayedIdx = studentChoice.charCodeAt(0) - 65;
        const originalIdx = this.shuffle.unmapOptionIndex(map, pq.id, displayedIdx);
        if (originalIdx !== null) {
          const opts = (pq.snapshotOptions as Array<{ key: string }> | null) ?? [];
          if (originalIdx < opts.length) {
            studentChoice = opts[originalIdx].key;
          }
        }
      }
    }

    let correct: boolean | null = null;
    if (correctKey) {
      const guess = (studentChoice ?? body.textAnswer ?? '').toString().trim().toLowerCase();
      correct = guess.length > 0 && guess === correctKey.toString().trim().toLowerCase();
    }
    return {
      correct,
      correctKey: correctKey ?? null,
      explanation,
      exampleAnswer,
    };
  }

  /**
   * Save an answer, reverse-mapping any displayed-key for shuffled MCQs back
   * to the original key before delegating to the standard AnswerScript upsert.
   */
  async saveAnswer(
    sessionId: string,
    body: { paperQuestionId: string; selectedOption?: string | null; textAnswer?: string | null },
    studentId: string,
  ) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: { paperAssignment: { select: { id: true, paperId: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    const now = new Date();
    if (now > session.quizEnd) throw new BadRequestException({ code: 'quiz_window_closed' });

    const submission = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignmentId,
        studentId,
        status: { not: 'practice' },
      },
    });
    if (!submission) throw new NotFoundException({ code: 'no_submission' });
    if (submission.status !== 'in_progress') {
      throw new BadRequestException({ code: 'submission_locked', status: submission.status });
    }

    const pq = await this.prisma.paperQuestion.findFirst({
      where: { id: body.paperQuestionId, paperId: session.paperAssignment.paperId },
      include: { question: { select: { questionType: true } } },
    });
    if (!pq) throw new NotFoundException({ code: 'paper_question_mismatch' });

    let selectedOption = body.selectedOption ?? null;
    if (pq.question.questionType === 'mcq' && selectedOption) {
      const paper = await this.prisma.paper.findUnique({
        where: { id: session.paperAssignment.paperId },
        select: { config: true },
      });
      const isPassagePick =
        ((paper?.config as { mode?: string } | null)?.mode ?? null) === 'passage_pick';
      // Passage-pick papers display option keys verbatim (matching_features
      // letters carry semantic meaning), so no reverse-map is needed.
      if (!isPassagePick) {
        const map = await this.shuffle.getOrCreate(studentId, session.paperAssignment.paperId);
        const displayedIdx = selectedOption.charCodeAt(0) - 65;
        const originalIdx = this.shuffle.unmapOptionIndex(map, pq.id, displayedIdx);
        if (originalIdx === null) {
          // No shuffle for this question — store as-is. (Unusual edge case.)
        } else {
          const opts = (pq.snapshotOptions as Array<{ key: string }> | null) ?? [];
          if (originalIdx < opts.length) {
            selectedOption = opts[originalIdx].key;
          }
        }
      }
    }

    return this.prisma.answerScript.upsert({
      where: {
        submissionId_paperQuestionId: {
          submissionId: submission.id,
          paperQuestionId: pq.id,
        },
      },
      create: {
        submissionId: submission.id,
        paperQuestionId: pq.id,
        selectedOption,
        textAnswer: body.textAnswer ?? null,
      },
      update: {
        selectedOption,
        textAnswer: body.textAnswer ?? null,
      },
    });
  }

  /** R10 — was an upsert that REPLACED the class's single bound level
   *  (back when ClassEnglishLevel.classId was unique). With multi-level,
   *  this is now an "add this band" call. Idempotent: re-adding an
   *  already-registered band is a no-op. Use removeClassEnglishLevel to
   *  drop a band. */
  async setClassEnglishLevel(classId: string, level: EnglishLevel, actor: ActorCtx) {
    if (!['admin', 'head_teacher'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const upserted = await this.prisma.classEnglishLevel.upsert({
      where: { classId_level: { classId, level } },
      create: { classId, level, effectiveFrom: new Date() },
      update: { effectiveFrom: new Date() },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.class_level.add',
      entityType: 'ClassEnglishLevel',
      entityId: upserted.id,
      ip: actor.ip,
      metadata: { classId, level },
    });
    return upserted;
  }

  /** R10 multi-level — drop one band from a class. The class's existing
   *  sessions for that band are left in place (so historical data
   *  survives), but no new sessions will be generated for it. */
  async removeClassEnglishLevel(classId: string, level: EnglishLevel, actor: ActorCtx) {
    if (!['admin', 'head_teacher'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const r = await this.prisma.classEnglishLevel.deleteMany({
      where: { classId, level },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.class_level.remove',
      entityType: 'ClassEnglishLevel',
      entityId: `${classId}:${level}`,
      ip: actor.ip,
      metadata: { classId, level, removed: r.count },
    });
    return { classId, level, removed: r.count };
  }

  /**
   * DEBUG ONLY — gated behind MORNING_QUIZ_DEBUG=true. Fast-forwards a
   * session into "currently active" state by overwriting time windows to
   * NOW + standard offsets and flipping status to active. Used for off-hours
   * end-to-end smoke testing of the scan flow. Audit-logged.
   */
  /**
   * Inverse of debugActivateNow — restore a session that was force-activated
   * by debugActivateNow (for a dry-run) back to its canonical pre-dry-run
   * state: recompute attendanceStart / attendanceEnd / lateCutoff / quizStart
   * / quizEnd from session.date using the standard 08:30 / 08:35 / 08:59:59
   * / 09:00 SGT constants, and flip status back to `scheduled`. Does NOT
   * touch Attendance / StudentSubmission / AnswerScript rows — those are
   * handled by clearStudentTestData. Audit-logged.
   *
   * Gated the same way as debugActivateNow: MORNING_QUIZ_DEBUG=true AND
   * admin role. The controller does the env-flag check; this service
   * method only does the canActOnClass test.
   */
  async revertSessionToScheduled(sessionId: string, actor: ActorCtx) {
    const before = await this.prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
    if (!before) throw new NotFoundException({ code: 'session_not_found' });
    if (!(await canActOnClass(this.prisma, actor, before.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const dateIso = before.date.toISOString().slice(0, 10);
    const attendanceStart = combineLocal(dateIso, ATTENDANCE_START_LOCAL, tzOff);
    const attendanceEnd = combineLocal(dateIso, ATTENDANCE_END_LOCAL, tzOff);
    const lateCutoff = combineLocal(dateIso, LATE_CUTOFF_LOCAL, tzOff);
    const quizEnd = combineLocal(dateIso, QUIZ_END_LOCAL, tzOff);
    const after = await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        attendanceStart,
        attendanceEnd,
        lateCutoff,
        quizStart: attendanceStart,
        quizEnd,
        status: MorningQuizStatus.scheduled,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.revert_to_scheduled',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      diff: {
        before: { status: before.status, attendanceStart: before.attendanceStart },
        after: { status: after.status, attendanceStart: after.attendanceStart },
      },
    });
    return after;
  }

  async debugActivateNow(sessionId: string, actor: ActorCtx) {
    const before = await this.prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
    if (!before) throw new NotFoundException({ code: 'session_not_found' });
    const now = new Date();
    const after = await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        attendanceStart: new Date(now.getTime() - 30_000),
        attendanceEnd: new Date(now.getTime() + 2 * 60_000),
        lateCutoff: new Date(now.getTime() + 20 * 60_000),
        quizStart: new Date(now.getTime() - 30_000),
        quizEnd: new Date(now.getTime() + 30 * 60_000),
        status: MorningQuizStatus.active,
      },
    });
    // Clear any absent attendance rows the cron may have inserted before
    // we re-activated. Without this, a pre-existing absent row poisons
    // the upsert in scanQr (which doesn't update status on the update
    // branch), so the test student stays "absent" even after a clean scan.
    await this.prisma.attendance.deleteMany({
      where: { sessionId, status: AttendanceStatus.absent, scanTime: null },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.debug_activate',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      diff: {
        before: { status: before.status, attendanceStart: before.attendanceStart },
        after: { status: after.status, attendanceStart: after.attendanceStart },
      },
    });
    return after;
  }

  /**
   * Admin-only — wipe one student's data on one session. Used to clean up
   * after dry-runs (teacher tested scan flow with student X; now wants X's
   * attendance + submission + answer scripts gone so the morning's real
   * dashboard isn't polluted). Idempotent — if there's nothing to delete
   * the call still succeeds and returns zero counts.
   *
   * Deletes:
   *   - Attendance(sessionId, studentId)                (1 row or 0)
   *   - StudentSubmission(assignmentId, studentId)      (1 row or 0)
   *   - AnswerScript(submission)                        (cascade from above)
   *
   * Does NOT delete the Paper/PaperAssignment/MorningQuizSession themselves
   * — those belong to the whole class and must stay intact for other
   * students. Compare with force-regenerate (batchGenerateForWeek with
   * force=true) which wipes the entire session and recreates it; use that
   * instead when you want to throw away ALL student data on a session.
   */
  async clearStudentTestData(
    sessionId: string,
    studentId: string,
    actor: ActorCtx,
  ): Promise<{ attendanceDeleted: number; submissionDeleted: number; scriptDeleted: number }> {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { paperAssignmentId: true },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });

    // Count scripts BEFORE deleting the submission so the audit log carries
    // an accurate number — once StudentSubmission is gone the cascade has
    // already taken AnswerScript with it.
    const scriptCount = await this.prisma.answerScript.count({
      where: {
        submission: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
      },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // Submission first (AnswerScript cascades), then attendance. Order
      // doesn't really matter since both have unique constraints; doing
      // submission first keeps the script delete inside the same tx.
      const subDel = await tx.studentSubmission.deleteMany({
        where: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
      });
      const attDel = await tx.attendance.deleteMany({
        where: { sessionId, studentId },
      });
      return { submissionDeleted: subDel.count, attendanceDeleted: attDel.count };
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.clear_student_test_data',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      metadata: {
        sessionId,
        studentId,
        attendanceDeleted: result.attendanceDeleted,
        submissionDeleted: result.submissionDeleted,
        scriptDeleted: scriptCount,
      },
    });

    return {
      attendanceDeleted: result.attendanceDeleted,
      submissionDeleted: result.submissionDeleted,
      scriptDeleted: scriptCount,
    };
  }

  /**
   * Re-run autoGradeScripts on every submitted submission in a session.
   * Used to recover scoring on already-locked submissions when:
   *   - The auto-grader code has changed since last grading
   *   - The ANTHROPIC_API_KEY was missing at lock time but is now set
   *   - A bug in autoGradeScripts caused scripts to be skipped (e.g. the
   *     pre-fix length>80 path that left long-mark-scheme answers
   *     un-graded, awarded marks = null)
   *
   * Re-grades in a single transaction, updates submission.autoScore +
   * each answerScript.{autoCorrect, awardedMarks, markerComment}.
   * Does NOT touch manualScore (teacher overrides preserved) or
   * submission.status (still 'submitted' / 'locked' / etc.). Audit-logged
   * with per-submission delta counts.
   */
  /**
   * Bug 2 — preview what batchGenerateForWeek({force:true}) would
   * destroy. Returns counts of sessions / attendances / submissions /
   * answer scripts in the (weekStart..+5d) window for the given classes
   * (defaults to all classes with at least one ClassEnglishLevel).
   *
   * The UI calls this BEFORE confirm() so the operator sees concrete
   * numbers ("会删除 19 份提交、247 条答题") rather than an abstract
   * warning. Read-only — no audit log, no DB mutation.
   */
  async previewRegenerateImpact(
    input: { weekStart: string; classIds?: string[] },
  ): Promise<{
    sessions: number;
    submissions: number;
    attendances: number;
    answerScripts: number;
  }> {
    const monday = new Date(input.weekStart);
    if (Number.isNaN(monday.getTime())) {
      throw new BadRequestException({ code: 'bad_week_start' });
    }
    // Bug 6 fix — use a half-open [Mon, next-Mon) range filter rather than
    // a `date: { in: dates }` list of UTC midnights. `MorningQuizSession.date`
    // is written from `attendanceStart` (a real instant like 00:30 UTC for
    // SGT 08:30), not the UTC-midnight date, so `in` matched zero rows and
    // the preview always reported 0. A range filter catches every session
    // whose `date` instant lies inside the target week regardless of how
    // the time-of-day component was set. The range MUST match exactly what
    // the force-wipe block below uses so the preview count == wipe count.
    const rangeStart = monday;                                       // inclusive
    const rangeEnd = new Date(monday.getTime() + 7 * 86_400_000);    // exclusive
    let classIds = input.classIds ?? [];
    if (classIds.length === 0) {
      const rows = await this.prisma.classEnglishLevel.findMany({
        distinct: ['classId'], select: { classId: true },
      });
      classIds = rows.map((r) => r.classId);
    }
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { classId: { in: classIds }, date: { gte: rangeStart, lt: rangeEnd } },
      select: { id: true, paperAssignment: { select: { paperId: true } } },
    });
    if (sessions.length === 0) {
      return { sessions: 0, submissions: 0, attendances: 0, answerScripts: 0 };
    }
    const sessionIds = sessions.map((s) => s.id);
    const paperIds = sessions
      .map((s) => s.paperAssignment?.paperId)
      .filter((p): p is string => !!p);
    const [attendances, submissions, answerScripts] = await Promise.all([
      this.prisma.attendance.count({ where: { sessionId: { in: sessionIds } } }),
      this.prisma.studentSubmission.count({
        where: { assignment: { paperId: { in: paperIds } } },
      }),
      this.prisma.answerScript.count({
        where: { submission: { assignment: { paperId: { in: paperIds } } } },
      }),
    ]);
    return {
      sessions: sessions.length,
      submissions,
      attendances,
      answerScripts,
    };
  }

  async regradeSession(
    sessionId: string,
    actor: ActorCtx,
  ): Promise<{
    sessionId: string;
    submissionsRegraded: number;
    scriptsUpdated: number;
    autoScoreDelta: number;
    errors: Array<{ submissionId: string; error: string }>;
  }> {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { id: true, classId: true, paperAssignmentId: true },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (!(await canActOnClass(this.prisma, actor, session.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }

    // Critical: DO NOT wrap the AI calls in a single big $transaction. Each
    // Claude API call is 2–3s; 19 submissions × ~10 short-answer items =
    // ~500 seconds of AI calls. The default Prisma transaction timeout is
    // ~5 s, so the whole regrade returned "Transaction timed out / already
    // closed" the moment AI grading exceeded it. Fix: load the submissions
    // upfront (no tx needed for reads), call autoGradeScripts per submission
    // OUTSIDE any tx, then commit each submission's writes in a small
    // dedicated tx. Failures on one submission don't roll back others.
    const submissions = await this.prisma.studentSubmission.findMany({
      where: {
        assignmentId: session.paperAssignmentId,
        // Only submissions that actually carry student work; in_progress
        // is left to the cron's lockOne so we don't race the lock flow.
        status: { in: ['submitted', 'locked'] },
      },
      include: {
        scripts: {
          include: {
            paperQuestion: {
              include: {
                question: {
                  select: { questionType: true, options: true, answerContent: true, content: true },
                },
              },
            },
          },
        },
      },
    });

    let submissionsRegraded = 0;
    let scriptsUpdated = 0;
    let autoScoreDelta = 0;
    const errors: Array<{ submissionId: string; error: string }> = [];

    for (const sub of submissions) {
      try {
        // AI calls happen here, outside any tx. Slow but doesn't hold a
        // db transaction open.
        const { autoScore, scriptUpdates } = await autoGradeScripts(sub.scripts, this.evaluator);
        const before = sub.autoScore ?? 0;

        // Tiny atomic write per submission. If one fails (e.g. another
        // tx is updating the same script row), we log + move on instead
        // of nuking everyone else's regrade.
        await this.prisma.$transaction(async (tx) => {
          // R15-followup-14 — was only writing `autoScore`. The student /
          // parent dashboards display `totalScore` (= autoScore + manualScore)
          // which is cached on the submission row. Without recomputing it,
          // a successful regrade would update individual script awardedMarks
          // BUT the student would still see the old totalScore — exactly the
          // confusing "I picked the right answer and the system still says 0"
          // pattern teachers reported after the 5/14 IELTS bulk regrade.
          // Mirror the convention from resolveAppeal: totalScore = autoScore
          // + manualScore (0 when unset).
          const manualScore = sub.manualScore ?? 0;
          const totalScore = autoScore + manualScore;
          await tx.studentSubmission.update({
            where: { id: sub.id },
            data: { autoScore, totalScore },
          });
          for (const u of scriptUpdates) {
            await tx.answerScript.update({
              where: { id: u.id },
              data: {
                autoCorrect: u.autoCorrect,
                awardedMarks: u.awardedMarks,
                ...(u.aiReason ? { markerComment: `[ai-grade] ${u.aiReason}` } : {}),
              },
            });
          }
        });
        scriptsUpdated += scriptUpdates.length;
        autoScoreDelta += autoScore - before;
        submissionsRegraded++;
      } catch (e: any) {
        this.logger.error(`regrade submission ${sub.id} failed: ${e?.message ?? e}`);
        errors.push({ submissionId: sub.id, error: String(e?.message ?? e).slice(0, 200) });
      }
    }

    const result = { submissionsRegraded, scriptsUpdated, autoScoreDelta, errors };

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.regrade_session',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      metadata: {
        sessionId,
        submissionsRegraded: result.submissionsRegraded,
        scriptsUpdated: result.scriptsUpdated,
        autoScoreDelta: result.autoScoreDelta,
      },
    });

    return { sessionId, ...result };
  }

  /**
   * Admin-only — wipe ALL Papers whose questions were generated from a
   * retired provenance bank (currently: cambridge_0510, which we
   * switched away from in commit be96aa6 when the OLEVEL bank moved to
   * Singapore-Cambridge 1128 / 1184).
   *
   * Why this exists — even after `cambridge_0510` Questions were marked
   * status='retired' (so the picker stops choosing them), Papers /
   * MorningQuizSessions / Attendances / Submissions / AnswerScripts
   * generated BEFORE that switch still exist and pollute student-facing
   * views. e.g. 牟歌's portal shows a 5/18 attendance row that's
   * actually a 5/11 test-activate scan on a retired 0510 paper.
   *
   * Strategy — find Papers where ANY PaperQuestion → Question carries
   * the cambridge_0510 provenance tag, then `paper.deleteMany`. FK
   * cascade pulls down PaperQuestion + PaperAssignment +
   * MorningQuizSession + StudentSubmission + Attendance + AnswerScript
   * (see schema.prisma — every dependent FK on this tree is
   * onDelete: Cascade).
   *
   * Audit-logged with count of papers deleted.
   */
  async cleanupRetiredContent(actor: ActorCtx): Promise<{
    papersDeleted: number;
    provenanceTagsCovered: string[];
  }> {
    if (actor.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const RETIRED_TAGS = ['cambridge_0510'];
    const oldPapers = await this.prisma.paper.findMany({
      where: {
        questions: {
          some: { question: { provenanceTag: { in: RETIRED_TAGS } } },
        },
      },
      select: { id: true, name: true },
    });
    const ids = oldPapers.map((p) => p.id);
    let deleted = 0;
    if (ids.length > 0) {
      // Best-effort delete; if some FK is unexpectedly Restrict we log
      // and continue to the next one rather than failing the whole batch.
      for (const id of ids) {
        try {
          await this.prisma.paper.delete({ where: { id } });
          deleted++;
        } catch (e: any) {
          this.logger.warn(`could not delete retired paper ${id}: ${e?.message ?? e}`);
        }
      }
    }
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.cleanup_retired_content',
      entityType: 'Paper',
      entityId: '(batch)',
      ip: actor.ip,
      metadata: {
        provenanceTags: RETIRED_TAGS,
        candidates: ids.length,
        deleted,
      },
    });
    return { papersDeleted: deleted, provenanceTagsCovered: RETIRED_TAGS };
  }

  /**
   * Admin-only — delete every MorningQuizSession (and its Paper, via FK
   * cascade) scheduled for a weekday the school doesn't run morning
   * quiz on. Currently: Mondays (assembly day) and weekends (Sat/Sun).
   *
   * Why this exists — the old batchGenerateForWeek emitted Mon-Fri
   * (5 days), so up to today we've been creating Monday sessions that
   * never get used in practice and just pollute student portals as
   * "absent" rows. After updating the generator to skip Mondays
   * (this same commit), we still need to clean up historical Monday
   * sessions sitting in the DB.
   *
   * Strategy — iterate all MorningQuizSession rows, filter to weekdays
   * in SKIP set, delete their backing Paper. FK cascade handles the
   * rest. We don't try to be clever with a SQL WHERE on weekday because
   * neither Postgres nor Prisma exposes "DATE_PART('dow', date)" through
   * Prisma's typed query API without raw SQL — JS filter is simple and
   * the table is small.
   */
  async cleanupNonSchoolDaySessions(actor: ActorCtx): Promise<{
    sessionsConsidered: number;
    papersDeleted: number;
    skipDays: string[];
  }> {
    if (actor.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const SKIP_WEEKDAYS = new Set([0, 1, 6]); // 0=Sun, 1=Mon, 6=Sat
    const all = await this.prisma.morningQuizSession.findMany({
      select: { id: true, date: true, paperAssignmentId: true },
    });
    const offending = all.filter((s) => SKIP_WEEKDAYS.has(new Date(s.date).getUTCDay()));
    const assignmentIds = offending.map((s) => s.paperAssignmentId);
    const assignments = assignmentIds.length > 0
      ? await this.prisma.paperAssignment.findMany({
          where: { id: { in: assignmentIds } },
          select: { paperId: true },
        })
      : [];
    const paperIds = Array.from(new Set(assignments.map((a) => a.paperId)));
    let papersDeleted = 0;
    for (const id of paperIds) {
      try {
        await this.prisma.paper.delete({ where: { id } });
        papersDeleted++;
      } catch (e: any) {
        this.logger.warn(`could not delete non-school-day paper ${id}: ${e?.message ?? e}`);
      }
    }
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.cleanup_non_school_days',
      entityType: 'Paper',
      entityId: '(batch)',
      ip: actor.ip,
      metadata: {
        skipWeekdays: ['Sun', 'Mon', 'Sat'],
        sessionsConsidered: offending.length,
        papersDeleted,
      },
    });
    return {
      sessionsConsidered: offending.length,
      papersDeleted,
      skipDays: ['Sun', 'Mon', 'Sat'],
    };
  }

  /** Find the StudentSubmission tied to (session, student) — used by the
   *  controller's submit endpoint to delegate to the canonical
   *  student.service.finalSubmit. */
  async findSubmissionForSession(sessionId: string, studentId: string) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { paperAssignmentId: true },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    return this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignmentId,
        studentId,
        status: { not: 'practice' },
      },
    });
  }

  /**
   * Aggregated dashboard for one (classId, date): merges the 1–N sessions
   * (one per registered EnglishLevel) into a single roster + counts view.
   *
   * Why this exists — each student picks exactly ONE level on the
   * /scan/<token> page, so a student appears in at most one of the (date,
   * class) sessions. The per-session dashboard splits the roster across
   * level pages, which makes the teacher hop between 1–3 dashboards just
   * to see "who scanned today". This merges them: each row carries its
   * source sessionId + level so the per-student 「清除测试数据」 button still
   * targets the right session, but the teacher sees one unified table.
   */
  async getClassDayDashboard(
    classId: string,
    dateIso: string,
    actor: ActorCtx,
  ) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    // Date column in MorningQuizSession is @db.Date — Prisma represents it
    // as a Date at the start of that UTC day. Build the [day, nextDay)
    // range so the filter matches regardless of how the caller phrased
    // the date string.
    const day = new Date(`${dateIso}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime())) {
      throw new BadRequestException({ code: 'bad_date', hint: 'expect YYYY-MM-DD' });
    }
    const nextDay = new Date(day.getTime() + 86_400_000);

    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { classId, date: { gte: day, lt: nextDay } },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: { include: { paper: { select: { id: true, name: true, totalMarksActual: true } } } },
        attendances: {
          include: {
            student: { select: { id: true, name: true } },
            submission: { select: { id: true, autoScore: true, totalScore: true, submittedAt: true } },
          },
        },
      },
      orderBy: { level: 'asc' },
    });
    if (sessions.length === 0) {
      throw new NotFoundException({ code: 'no_sessions_for_class_day' });
    }

    // Merge attendance rows from all N sessions, tagging each with its
    // source sessionId + level so the row-level 🗑️ clear button still
    // targets the correct session.
    //
    // Then DEDUPE by studentId — the cron's lockOne creates an `absent`
    // row for every enrolled student on every session, so a student
    // enrolled in 3 levels who scans only one will produce 3 attendance
    // rows (1 real + 2 spurious absent). Naïve concatenation gave the UI
    // 3 rows per student and a 3× inflated absent count. Keep only the
    // highest-priority row per student: on_time > late > absent. The
    // kept row's level/sessionId reflects where the student ACTUALLY
    // scanned (or arbitrary level if they truly didn't show on any).
    const raw: Array<any> = [];
    for (const s of sessions) {
      for (const a of s.attendances) {
        raw.push({
          ...a,
          sessionId: s.id,
          level: s.level,
        });
      }
    }
    const PRIORITY: Record<string, number> = { on_time: 3, late: 2, absent: 1 };
    const byStudent = new Map<string, (typeof raw)[number]>();
    for (const a of raw) {
      const sid = a.studentId;
      const existing = byStudent.get(sid);
      if (!existing) {
        byStudent.set(sid, a);
        continue;
      }
      const newP = PRIORITY[a.status] ?? 0;
      const oldP = PRIORITY[existing.status] ?? 0;
      // If equal priority (e.g. two absent rows for the same student),
      // prefer the row that has a submission attached — keeps any quiz
      // data visible even if status ended up tied.
      if (newP > oldP || (newP === oldP && a.submission && !existing.submission)) {
        byStudent.set(sid, a);
      }
    }
    const attendances = Array.from(byStudent.values()).sort((a, b) => {
      const an = a.student?.name ?? '';
      const bn = b.student?.name ?? '';
      return an.localeCompare(bn, 'zh-CN');
    });
    // Recompute counts on the deduped set — one tally per student, not
    // per attendance row.
    const counts = { on_time: 0, late: 0, absent: 0 };
    for (const a of attendances) counts[a.status]++;

    return {
      classId,
      date: dateIso,
      className: sessions[0].class.name,
      sessions: sessions.map((s) => ({
        id: s.id,
        level: s.level,
        status: s.status,
        paper: s.paperAssignment.paper,
      })),
      counts,
      attendances,
    };
  }

  async getDashboard(sessionId: string, actor: ActorCtx) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: { include: { paper: { select: { id: true, name: true, totalMarksActual: true } } } },
        attendances: {
          include: {
            student: { select: { id: true, name: true } },
            submission: { select: { id: true, autoScore: true, totalScore: true, submittedAt: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });

    // Round 2 IDOR fix — admin/head_teacher pass through; a regular
    // teacher must teach this session's class. Otherwise an English
    // teacher could pull the dashboard for the maths class by guessing
    // sessionIds.
    if (!(await canActOnClass(this.prisma, actor, session.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }

    const counts = { on_time: 0, late: 0, absent: 0 };
    for (const a of session.attendances) counts[a.status]++;

    return {
      session: {
        id: session.id,
        date: session.date,
        status: session.status,
        class: session.class,
        paper: session.paperAssignment.paper,
      },
      counts,
      attendances: session.attendances,
    };
  }

  /**
   * F3 — student post-submit result page payload.
   *
   * Strict invariant: only callable by the student who owns the
   * submission AND only after submission.status === 'submitted' (or
   * the quiz window has closed). Until then, returns ForbiddenException
   * with code='result_locked_until_submit' so a curl poll can't pre-leak
   * the answer key.
   *
   * Per-question content goes through the same redactSnapshotForStudent
   * whitelist as the take-paper view, then we explicitly add ONLY the
   * fields appropriate for the post-submit screen:
   *   - correctAnswer (the canonical key)
   *   - explanation   (one-sentence rationale, if the source question
   *                    carried one — never markScheme verbatim)
   *   - studentAnswer (this student's submitted choice/text)
   *   - awardedMarks  (auto-graded for MCQ; null for un-marked structured)
   *
   * We deliberately do NOT include fields like `markScheme`,
   * `exampleAnswer`, or any per-paperQuestion override that could leak
   * teacher-internal data. Other students' answers are NEVER included
   * (the query is scoped to this submission only).
   */
  async getStudentResult(sessionId: string, studentId: string) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: {
        paperAssignment: {
          select: { id: true, paperId: true, paper: { select: { name: true } } },
        },
      },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });

    const submission = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignmentId,
        studentId,
        status: { not: 'practice' },
      },
      select: {
        id: true,
        status: true,
        autoScore: true,
        manualScore: true,
        totalScore: true,
        maxScore: true,
        submittedAt: true,
        scripts: {
          select: {
            paperQuestionId: true,
            selectedOption: true,
            textAnswer: true,
            awardedMarks: true,
            autoCorrect: true,
            // R10 follow-up — surface the AI grader's rationale to students
            // so when the AI credits a paraphrase or denies a sounds-right
            // wrong answer they can see why. finalSubmit writes
            // `[ai-grade] <reason>` to markerComment when Claude
            // intervened; this select pulls it through to the result page.
            markerComment: true,
          },
        },
      },
    });
    if (!submission) throw new NotFoundException({ code: 'no_submission' });
    const now = new Date();
    const windowClosed = now > session.quizEnd;
    const submitted =
      submission.status === 'submitted' || submission.status === 'graded' ||
      submission.status === 'returned' || submission.status === 'marked';
    if (!submitted && !windowClosed) {
      throw new ForbiddenException({ code: 'result_locked_until_submit' });
    }

    // Pull paper questions in display order so the result page lines up
    // with the take-paper experience.
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: session.paperAssignment.paperId },
      orderBy: { sortOrder: 'asc' },
      include: {
        // R10: also pull answerContent so the result page can display the
        // canonical short_answer text answer ("ii", "pendulum clock") even
        // when snapshotContent / snapshotOptions don't carry it. This is
        // server-side only; the take-paper getStudentView still strips it.
        question: { select: { questionType: true, answerContent: true } },
      },
    });

    const scriptByPq = new Map(
      submission.scripts.map((s) => [s.paperQuestionId, s]),
    );

    const items = paperQuestions.map((pq) => {
      const sc = (pq.snapshotContent ?? {}) as Record<string, unknown>;
      // R10-fix: snapshotContent often omits correctOption / correctAnswer
      // (IELTS passage-pick papers store the answer key on snapshotOptions
      // as `{key, correct: true}`, leaving snapshotContent with only stem +
      // passage). Fall back to the snapshotOptions array so the result page
      // can show the correct letter.
      let correctKey: string | null =
        typeof sc.correctOption === 'string'
          ? (sc.correctOption as string)
          : typeof sc.correctAnswer === 'string'
          ? (sc.correctAnswer as string)
          : null;
      if (!correctKey && Array.isArray(pq.snapshotOptions)) {
        const correctOpt = (pq.snapshotOptions as any[]).find((o) => o?.correct === true);
        if (correctOpt?.key) correctKey = String(correctOpt.key);
      }
      // R10: final fallback — Question.answerContent.text. This is where
      // IELTS short_answer (matching headings, summary completion, diagram
      // labels) keeps the canonical answer. Server-side only; never sent
      // during the live take-paper flow (getStudentView redacts).
      if (!correctKey) {
        const ac = (pq.question as any)?.answerContent as { text?: unknown } | null;
        if (typeof ac?.text === 'string' && ac.text.length <= 80) {
          correctKey = ac.text;
        }
      }
      const explanation =
        typeof sc.explanation === 'string'
          ? (sc.explanation as string).slice(0, 600)
          : null;
      const script = scriptByPq.get(pq.id);
      const studentChoice = script?.selectedOption ?? script?.textAnswer ?? null;
      // R10-fix: prefer the persisted autoCorrect that finalSubmit's
      // autoGradeScripts already wrote — it's authoritative and survives
      // the snapshotContent missing-correct-key case above. Recompute from
      // correctKey only as a defensive fallback for older submissions
      // (where the script row predates the autoGrade writeback).
      let isCorrect: boolean | null = null;
      if (typeof script?.autoCorrect === 'boolean') {
        isCorrect = script.autoCorrect;
      } else if (correctKey != null && studentChoice != null) {
        isCorrect =
          String(studentChoice).trim().toLowerCase() ===
          String(correctKey).trim().toLowerCase();
      }
      return {
        paperQuestionId: pq.id,
        sortOrder: pq.sortOrder,
        marks: pq.marks,
        questionType: pq.question.questionType,
        // Whitelist redacted content (strips correctOption/markScheme/
        // exampleAnswer; keeps stem/passage/options).
        snapshotContent: redactSnapshotForStudent(pq.snapshotContent),
        // Display-only options (no `correct` flag).
        snapshotOptions: Array.isArray(pq.snapshotOptions)
          ? (pq.snapshotOptions as any[]).map((o) => ({ key: o?.key, text: o?.text }))
          : null,
        // Result-page-only fields (added after redaction since the quiz
        // window has closed for this student):
        studentAnswer: studentChoice,
        correctAnswer: correctKey,
        explanation,
        awardedMarks: script?.awardedMarks ?? null,
        autoCorrect: script?.autoCorrect ?? null,
        isCorrect,
        // Strip the internal `[ai-grade] ` prefix before showing students;
        // they don't need the marker tag, only the rationale itself.
        // Teacher-side dashboards keep the raw markerComment with the prefix.
        markerComment:
          typeof script?.markerComment === 'string'
            ? script.markerComment.replace(/^\[ai-grade\]\s*/, '')
            : null,
      };
    });

    return {
      sessionId: session.id,
      paperName: session.paperAssignment.paper.name,
      submissionId: submission.id,
      status: submission.status,
      autoScore: submission.autoScore,
      manualScore: submission.manualScore,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      submittedAt: submission.submittedAt,
      items,
    };
  }

  // ─────────────────── Wave-2 private helpers ───────────────────

  /**
   * Resolve a (name, optional studentId) tuple to one student row, mirroring
   * the disambiguation rules used by /history-by-name (Round-13 fix
   * included: filter isActive=true and archivedAt=null so soft-deleted /
   * withdrawn students don't appear). Returns either:
   *   - { kind: 'one', student }     → unique match, caller proceeds
   *   - { kind: 'disambig', list }   → multiple matches + no studentId
   * Throws NotFoundException if no candidate matches at all.
   */
  private async resolveStudentByName(
    rawName: string,
    studentIdFilter?: string,
  ): Promise<
    | {
        kind: 'one';
        student: {
          id: string;
          name: string;
          classes: Array<{ id: string; name: string; classCode: string }>;
        };
      }
    | {
        kind: 'disambig';
        candidates: Array<{
          studentId: string;
          name: string;
          classes: Array<{ id: string; name: string; classCode: string }>;
        }>;
      }
  > {
    const name = (rawName ?? '').trim();
    if (!name) throw new BadRequestException({ code: 'name_required' });
    if (name.length > 50) throw new BadRequestException({ code: 'name_too_long' });
    // R15-Audit#2 Finding #1 — the controller-side historyByName fix
    // (also requiring `classEnrollments: { some: { role: 'student' } }`)
    // was incomplete: this shared helper feeds upcoming-for-name +
    // trend + 4 other endpoints. The phantom 李永轩 would still show
    // through any of them. Mirror the controller's predicate AND
    // require the enrollment's class itself to be active (not
    // archived).
    const allCandidates = await this.prisma.user.findMany({
      where: {
        name,
        role: 'student',
        isActive: true,
        archivedAt: null,
        classEnrollments: {
          some: { role: 'student', class: { archivedAt: null } },
        },
      },
      select: {
        id: true,
        name: true,
        classEnrollments: {
          where: { role: 'student', class: { archivedAt: null } },
          select: { class: { select: { id: true, name: true, classCode: true } } },
        },
      },
    });
    if (allCandidates.length === 0) {
      throw new NotFoundException({ code: 'student_not_found', typed: name });
    }
    if (studentIdFilter) {
      const matched = allCandidates.find((c) => c.id === studentIdFilter);
      if (!matched) {
        throw new NotFoundException({
          code: 'student_not_found',
          message: 'no candidate matches studentId for this name',
        });
      }
      return {
        kind: 'one',
        student: {
          id: matched.id,
          name: matched.name,
          classes: matched.classEnrollments.map((e) => e.class),
        },
      };
    }
    if (allCandidates.length > 1) {
      return {
        kind: 'disambig',
        candidates: allCandidates.map((c) => ({
          studentId: c.id,
          name: c.name,
          classes: c.classEnrollments.map((e) => e.class),
        })),
      };
    }
    const only = allCandidates[0];
    return {
      kind: 'one',
      student: {
        id: only.id,
        name: only.name,
        classes: only.classEnrollments.map((e) => e.class),
      },
    };
  }

  // ─────────────────── F2 — Upcoming today by name ───────────────────

  /**
   * Public, IP-gated, rate-limited. Reuses the name+studentId disambig
   * shape from /history-by-name. Returns every non-cancelled session
   * for any of the student's classes whose date == today (Asia/Shanghai)
   * AND whose quizEnd >= now. "Today" is computed via the same
   * UTC-noon-+8 trick used elsewhere in this module: the DB stores
   * MorningQuizSession.date at UTC-00:00 of the school-local day, so
   * we floor `now + tzOffset` to a UTC midnight to match.
   */
  async upcomingForName(rawName: string, studentIdFilter?: string) {
    const resolved = await this.resolveStudentByName(rawName, studentIdFilter);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const student = resolved.student;
    const classIds = student.classes.map((c) => c.id);
    if (classIds.length === 0) {
      return { student, upcoming: [] };
    }
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const now = new Date();
    // Floor `now` to a UTC midnight that matches @db.Date storage for
    // "today in school-local". E.g. 2026-05-12T03:00Z + 8h offset is
    // 2026-05-12T11:00 local → school-local day = 2026-05-12 → DB stores
    // 2026-05-12T00:00Z. Add tzOff, take UTC YMD, then rebuild the
    // midnight Date.
    const localMs = now.getTime() + tzOff * 60_000;
    const localDay = new Date(localMs);
    const dayIso = `${localDay.getUTCFullYear()}-${String(
      localDay.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(localDay.getUTCDate()).padStart(2, '0')}`;
    const dayStart = new Date(`${dayIso}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: {
        classId: { in: classIds },
        date: { gte: dayStart, lt: dayEnd },
        status: { not: 'cancelled' },
        quizEnd: { gte: now },
      },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: { select: { paper: { select: { name: true } } } },
      },
      orderBy: { attendanceStart: 'asc' },
    });
    return {
      student,
      upcoming: sessions.map((s) => ({
        sessionId: s.id,
        classId: s.classId,
        className: s.class.name,
        level: s.level,
        attendanceStart: s.attendanceStart,
        quizStart: s.quizStart,
        quizEnd: s.quizEnd,
        paperName: s.paperAssignment.paper.name,
        status: s.status,
      })),
    };
  }

  // ─────────────────── F10 — Grade appeals ───────────────────

  /**
   * Public (IP-gated, rate-limited) — student creates a grade-appeal row
   * tied to a submitted submission. Name+studentId disambig matches
   * /history-by-name. Validates that the submission belongs to the
   * verified student (defeat scraping submissionIds with someone else's
   * name).
   */
  async createAppeal(
    input: {
      submissionId: string;
      paperQuestionId?: string;
      message: string;
      studentName: string;
      studentId?: string;
    },
    ip: string | null,
  ) {
    const message = (input.message ?? '').trim();
    if (!message) throw new BadRequestException({ code: 'message_required' });
    if (message.length > 4000) throw new BadRequestException({ code: 'message_too_long' });
    const resolved = await this.resolveStudentByName(input.studentName, input.studentId);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: input.submissionId },
      select: { id: true, studentId: true, assignmentId: true, status: true },
    });
    if (!sub) throw new NotFoundException({ code: 'submission_not_found' });
    if (sub.studentId !== resolved.student.id) {
      throw new ForbiddenException({ code: 'submission_not_yours' });
    }
    if (input.paperQuestionId) {
      // Verify the paperQuestionId is actually one of the paper's questions.
      const asgmt = await this.prisma.paperAssignment.findUnique({
        where: { id: sub.assignmentId },
        select: { paperId: true },
      });
      if (asgmt) {
        const pq = await this.prisma.paperQuestion.findFirst({
          where: { id: input.paperQuestionId, paperId: asgmt.paperId },
          select: { id: true },
        });
        if (!pq) throw new BadRequestException({ code: 'paper_question_mismatch' });
      }
    }
    const appeal = await this.prisma.gradeAppeal.create({
      data: {
        submissionId: sub.id,
        paperQuestionId: input.paperQuestionId ?? null,
        studentMessage: message,
        status: 'open',
      },
    });
    await this.audit.log({
      actorId: resolved.student.id,
      actorRole: 'student',
      action: 'morning_quiz.appeal.create',
      entityType: 'GradeAppeal',
      entityId: appeal.id,
      ip,
      metadata: {
        submissionId: sub.id,
        paperQuestionId: input.paperQuestionId ?? null,
      },
    });
    return { appealId: appeal.id, status: appeal.status };
  }

  /**
   * Teacher / head_teacher / admin — paginated list of appeals. Filterable
   * by status (default 'open') and classId (admin sees everything; class-
   * scoped teachers only see their own classes). Joins submission + paper
   * + student for display.
   */
  async listAppeals(
    actor: ActorCtx,
    filters: { status?: string; classId?: string; page?: number; pageSize?: number },
  ) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
    const status = filters.status ?? 'open';
    // Scope by classId if supplied AND caller can act on it.
    let assignmentFilter: Prisma.GradeAppealWhereInput = {};
    if (filters.classId) {
      if (!(await canActOnClass(this.prisma, actor, filters.classId))) {
        throw new ForbiddenException({ code: 'not_your_class' });
      }
      assignmentFilter = {
        submission: { assignment: { classId: filters.classId } },
      };
    } else if (actor.role === 'teacher') {
      // Teacher (non-head) gets scoped to the classes they teach.
      const enrollments = await this.prisma.classEnrollment.findMany({
        where: { userId: actor.id, role: { not: 'student' } },
        select: { classId: true },
      });
      const allowedClassIds = enrollments.map((e) => e.classId);
      assignmentFilter = {
        submission: { assignment: { classId: { in: allowedClassIds } } },
      };
    }
    const where: Prisma.GradeAppealWhereInput = {
      status,
      ...assignmentFilter,
    };
    const [items, total] = await Promise.all([
      this.prisma.gradeAppeal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          submission: {
            select: {
              id: true,
              studentId: true,
              autoScore: true,
              maxScore: true,
              student: { select: { id: true, name: true } },
              assignment: {
                select: {
                  paper: { select: { id: true, name: true } },
                  class: { select: { id: true, name: true } },
                },
              },
            },
          },
          paperQuestion: {
            select: { id: true, sortOrder: true, marks: true },
          },
          reviewer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.gradeAppeal.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Teacher / head_teacher / admin — accept or reject an appeal. When
   * accepting WITH a scoreOverride + paperQuestionId, also rewrite the
   * AnswerScript's awardedMarks and recompute the parent submission's
   * autoScore. Audit-logged.
   */
  async resolveAppeal(
    appealId: string,
    actor: ActorCtx,
    body: {
      accept: boolean;
      note?: string;
      scoreOverride?: number | null;
      paperQuestionId?: string;
    },
  ) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const appeal = await this.prisma.gradeAppeal.findUnique({
      where: { id: appealId },
      include: {
        submission: {
          select: {
            id: true,
            assignmentId: true,
            assignment: { select: { classId: true } },
          },
        },
      },
    });
    if (!appeal) throw new NotFoundException({ code: 'appeal_not_found' });
    if (!(await canActOnClass(this.prisma, actor, appeal.submission.assignment.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    if (appeal.status !== 'open') {
      throw new BadRequestException({ code: 'appeal_already_resolved', status: appeal.status });
    }
    const newStatus = body.accept ? 'accepted' : 'rejected';
    const note = body.note ? String(body.note).slice(0, 4000) : null;
    const targetPqId = body.paperQuestionId ?? appeal.paperQuestionId ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.gradeAppeal.update({
        where: { id: appealId },
        data: {
          status: newStatus,
          reviewerId: actor.id,
          reviewerNote: note,
          reviewedAt: new Date(),
        },
      });
      // If accepting AND there's a scoreOverride targeting a specific
      // paperQuestion, rewrite the AnswerScript and recompute autoScore.
      if (
        body.accept &&
        typeof body.scoreOverride === 'number' &&
        targetPqId
      ) {
        const script = await tx.answerScript.findUnique({
          where: {
            submissionId_paperQuestionId: {
              submissionId: appeal.submissionId,
              paperQuestionId: targetPqId,
            },
          },
          select: { id: true },
        });
        if (script) {
          await tx.answerScript.update({
            where: { id: script.id },
            data: {
              awardedMarks: body.scoreOverride,
              autoCorrect: body.scoreOverride > 0,
            },
          });
        }
        // Recompute autoScore = sum of awardedMarks across this submission.
        const updatedScripts = await tx.answerScript.findMany({
          where: { submissionId: appeal.submissionId },
          select: { awardedMarks: true },
        });
        const autoScore = updatedScripts.reduce(
          (acc, s) => acc + (s.awardedMarks ?? 0),
          0,
        );
        // R15-Audit#2 Finding #2 — also write totalScore. The student
        // and parent dashboards read `totalScore`, not `autoScore`;
        // previously the override silently had no visible effect on a
        // `marked` submission. totalScore = autoScore + (manualScore ?? 0)
        // matches the convention used by finalSubmit + regradeSession.
        const sub = await tx.studentSubmission.findUnique({
          where: { id: appeal.submissionId },
          select: { manualScore: true },
        });
        const manualScore = sub?.manualScore ?? null;
        const totalScore = autoScore + (manualScore ?? 0);
        await tx.studentSubmission.update({
          where: { id: appeal.submissionId },
          data: { autoScore, totalScore },
        });
      }
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.appeal.resolve',
      entityType: 'GradeAppeal',
      entityId: appealId,
      ip: actor.ip,
      metadata: {
        accept: body.accept,
        scoreOverride: body.scoreOverride ?? null,
        paperQuestionId: targetPqId,
      },
    });
    return { id: appealId, status: newStatus };
  }

  // ─────────────────── F13 — Fuzzy student search ───────────────────

  /**
   * Teacher / head_teacher / admin — case-insensitive substring search
   * on User.name + User.email scoped to a class's active enrollments.
   * No real pinyin yet — when we wire opencc / pinyin-pro we'll
   * normalise both sides; for now ASCII substring + zh literal hits
   * cover the dashboard use case.
   *
   * Returns up to 50 results (cap); use a more specific query to drill in.
   */
  async searchStudentsInClass(classId: string, rawQuery: string, actor: ActorCtx) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const q = (rawQuery ?? '').trim();
    if (!q) return { items: [] };
    if (q.length > 50) throw new BadRequestException({ code: 'query_too_long' });
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: {
        classId,
        role: 'student',
        user: {
          isActive: true,
          archivedAt: null,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      take: 50,
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return {
      items: enrollments.map((e) => e.user),
    };
  }

  // ─────────────────── F15 — Question retraction ───────────────────

  /**
   * Teacher / head_teacher / admin — mark a paper question as retracted.
   * Unique on paperQuestionId — second retract returns 409. If
   * awardAllStudents=true, every existing StudentSubmission for this
   * paper has its AnswerScript for this question rewritten to
   * `autoCorrect=true, awardedMarks=pq.marks` and the parent submission's
   * autoScore recomputed. Each affected submission gets an audit row
   * with the before/after delta.
   */
  async retractQuestion(
    paperId: string,
    body: {
      paperQuestionId: string;
      reason: string;
      awardAllStudents: boolean;
    },
    actor: ActorCtx,
  ) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const reason = (body.reason ?? '').trim();
    if (!reason) throw new BadRequestException({ code: 'reason_required' });
    if (reason.length > 1000) throw new BadRequestException({ code: 'reason_too_long' });
    // Verify the question is on this paper.
    const pq = await this.prisma.paperQuestion.findFirst({
      where: { id: body.paperQuestionId, paperId },
      select: { id: true, marks: true },
    });
    if (!pq) throw new NotFoundException({ code: 'paper_question_not_found' });
    // Per-class scoping — teachers must own at least one assignment of
    // this paper. Admin / head_teacher pass through.
    if (actor.role === 'teacher') {
      const owned = await this.prisma.paperAssignment.findFirst({
        where: { paperId },
        select: { classId: true },
      });
      if (!owned || !(await canActOnClass(this.prisma, actor, owned.classId))) {
        throw new ForbiddenException({ code: 'not_your_class' });
      }
    }
    const existing = await this.prisma.questionRetraction.findUnique({
      where: { paperQuestionId: body.paperQuestionId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'already_retracted',
        retractionId: existing.id,
      });
    }
    const retraction = await this.prisma.questionRetraction.create({
      data: {
        paperQuestionId: body.paperQuestionId,
        reason,
        awardAllStudents: body.awardAllStudents,
        actorId: actor.id,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.question.retract',
      entityType: 'QuestionRetraction',
      entityId: retraction.id,
      ip: actor.ip,
      metadata: {
        paperId,
        paperQuestionId: body.paperQuestionId,
        awardAllStudents: body.awardAllStudents,
      },
    });
    let submissionsRegraded = 0;
    if (body.awardAllStudents) {
      // Find every (non-practice) StudentSubmission for this paper. Walk
      // each one, rewrite the script for the retracted question, recompute
      // autoScore. Per-submission tx so a single failure doesn't roll the
      // whole batch back.
      const submissions = await this.prisma.studentSubmission.findMany({
        where: {
          assignment: { paperId },
          status: { not: 'practice' },
        },
        select: {
          id: true,
          autoScore: true,
          scripts: {
            where: { paperQuestionId: body.paperQuestionId },
            select: { id: true, awardedMarks: true },
          },
        },
      });
      for (const sub of submissions) {
        try {
          const oldMark = sub.scripts[0]?.awardedMarks ?? 0;
          const newMark = pq.marks;
          await this.prisma.$transaction(async (tx) => {
            if (sub.scripts[0]) {
              await tx.answerScript.update({
                where: { id: sub.scripts[0].id },
                data: { autoCorrect: true, awardedMarks: newMark },
              });
            } else {
              // No script row for this question yet (student never opened
              // it). Create one so the credit shows up. Empty content.
              await tx.answerScript.create({
                data: {
                  submissionId: sub.id,
                  paperQuestionId: body.paperQuestionId,
                  autoCorrect: true,
                  awardedMarks: newMark,
                },
              });
            }
            // Recompute autoScore as sum of awardedMarks. Cheaper to
            // recount than diff-track when the underlying script set
            // may have just grown by one.
            const allScripts = await tx.answerScript.findMany({
              where: { submissionId: sub.id },
              select: { awardedMarks: true },
            });
            const autoScore = allScripts.reduce(
              (acc, s) => acc + (s.awardedMarks ?? 0),
              0,
            );
            await tx.studentSubmission.update({
              where: { id: sub.id },
              data: { autoScore },
            });
          });
          await this.audit.log({
            actorId: actor.id,
            actorRole: actor.role,
            action: 'morning_quiz.question.retract.regrade',
            entityType: 'StudentSubmission',
            entityId: sub.id,
            ip: actor.ip,
            metadata: {
              retractionId: retraction.id,
              paperQuestionId: body.paperQuestionId,
              oldMark,
              newMark,
            },
          });
          submissionsRegraded++;
        } catch (e: any) {
          this.logger.error(
            `retract regrade submission ${sub.id} failed: ${e?.message ?? e}`,
          );
        }
      }
    }
    return {
      retractionId: retraction.id,
      paperQuestionId: body.paperQuestionId,
      submissionsRegraded,
    };
  }

  // ─────────────────── F16 — Practice mode ───────────────────

  /**
   * Public (IP-gated, rate-limited) — start a fresh practice attempt
   * against an existing submission's paper. The caller MUST verify their
   * identity via the standard name+studentId disambig flow. Practice
   * submissions live as status='practice' rows with no sessionId binding,
   * so the cron's lockOne (which filters by sessionId) ignores them and
   * the stats endpoints exclude them via status filter.
   *
   * NOTE: StudentSubmission has @@unique([assignmentId, studentId]) so
   * a second practice attempt against the same assignment will hit a
   * P2002. Spec covers this in v1 as "punt — schema team owns dropping
   * the unique to (assignmentId, studentId, status)". Catch + 409 for
   * now so callers can degrade gracefully.
   */
  async startPractice(
    submissionId: string,
    body: { studentName: string; studentId?: string },
    ip: string | null,
  ) {
    const resolved = await this.resolveStudentByName(body.studentName, body.studentId);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        studentId: true,
        assignmentId: true,
        assignment: { select: { paperId: true } },
      },
    });
    if (!sub) throw new NotFoundException({ code: 'submission_not_found' });
    if (sub.studentId !== resolved.student.id) {
      throw new ForbiddenException({ code: 'submission_not_yours' });
    }
    // maxScore mirrors the paper's totalMarksActual at the moment of
    // creation, same as finalSubmit does for real submissions.
    const paper = await this.prisma.paper.findUnique({
      where: { id: sub.assignment.paperId },
      select: { totalMarksActual: true },
    });
    if (!paper) throw new NotFoundException({ code: 'paper_not_found' });
    let practice;
    try {
      practice = await this.prisma.studentSubmission.create({
        data: {
          assignmentId: sub.assignmentId,
          studentId: sub.studentId,
          status: 'practice',
          maxScore: paper.totalMarksActual,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        // Schema-team punt — @@unique([assignmentId, studentId]) still
        // present so we can't have both a real submission AND a practice
        // submission. Surface a clear error instead of a 500.
        throw new ConflictException({
          code: 'practice_unique_blocked',
          message: 'Schema migration pending: cannot create practice submission while real submission exists for this assignment.',
        });
      }
      throw e;
    }
    // Pre-seed empty AnswerScript rows for every PaperQuestion so the
    // take-quiz UI has rows to fill.
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: sub.assignment.paperId },
      select: { id: true },
    });
    if (paperQuestions.length > 0) {
      await this.prisma.answerScript.createMany({
        data: paperQuestions.map((pq) => ({
          submissionId: practice.id,
          paperQuestionId: pq.id,
        })),
      });
    }
    await this.audit.log({
      actorId: resolved.student.id,
      actorRole: 'student',
      action: 'morning_quiz.practice.start',
      entityType: 'StudentSubmission',
      entityId: practice.id,
      ip,
      metadata: { sourceSubmissionId: submissionId },
    });
    return {
      practiceSubmissionId: practice.id,
      paperId: sub.assignment.paperId,
      sessionId: null,
    };
  }

  /**
   * Public (IP-gated, rate-limited) — fetch a practice paper for replay.
   * Returns the paper questions (whitelist-redacted, same as
   * getStudentView) plus the existing answers the student has saved on
   * this practice run.
   */
  async getPractice(
    practiceSubmissionId: string,
    body: { studentName: string; studentId?: string },
  ) {
    const resolved = await this.resolveStudentByName(body.studentName, body.studentId);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: practiceSubmissionId },
      select: {
        id: true,
        studentId: true,
        status: true,
        autoScore: true,
        maxScore: true,
        submittedAt: true,
        assignment: { select: { paperId: true } },
      },
    });
    if (!sub) throw new NotFoundException({ code: 'submission_not_found' });
    if (sub.status !== 'practice') {
      throw new BadRequestException({ code: 'not_a_practice_submission' });
    }
    if (sub.studentId !== resolved.student.id) {
      throw new ForbiddenException({ code: 'submission_not_yours' });
    }
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: sub.assignment.paperId },
      orderBy: { sortOrder: 'asc' },
      include: { question: { select: { id: true, questionType: true, answerContent: true } } },
    });
    const scripts = await this.prisma.answerScript.findMany({
      where: { submissionId: sub.id },
      select: {
        id: true,
        paperQuestionId: true,
        selectedOption: true,
        textAnswer: true,
        autoCorrect: true,
        awardedMarks: true,
        markerComment: true,
      },
    });
    const existingAnswers: Record<string, { content: any; flagged: boolean }> = {};
    for (const s of scripts) {
      existingAnswers[s.paperQuestionId] = {
        content: s.selectedOption != null ? s.selectedOption : s.textAnswer,
        flagged: false,
      };
    }
    const stripOptions = (opts: unknown) => {
      if (!Array.isArray(opts)) return opts;
      return opts.map((o: any) => ({ key: o?.key, text: o?.text }));
    };
    // R15-followup-7: when the student already submitted this practice
    // attempt, return the same perQuestion grading payload that
    // submitPractice returns so the FE can render PracticeResultView
    // immediately. Without this, visiting /practice/:id of a finished
    // attempt re-shows the editable form and the only entry point back
    // to "what did I score" is to re-submit, which feels broken.
    // Use autoScore (not submittedAt) as the "already graded" flag —
    // legacy practice rows from before R15-followup-7 have
    // submittedAt=null but a real autoScore; treating those as
    // "unsubmitted" would re-show the form and make /my-history's
    // 「查看练习卷」 confusing for any data created before this fix.
    const alreadySubmitted = sub.autoScore != null;
    let perQuestion: any[] | null = null;
    if (alreadySubmitted) {
      const scriptByPq = new Map(scripts.map((s) => [s.paperQuestionId, s]));
      perQuestion = paperQuestions.map((pq) => {
        const s = scriptByPq.get(pq.id);
        const sc = (pq.snapshotContent ?? {}) as any;
        let correctKey: string | null =
          typeof sc.correctOption === 'string'
            ? sc.correctOption
            : typeof sc.correctAnswer === 'string'
            ? sc.correctAnswer
            : null;
        if (!correctKey && Array.isArray(pq.snapshotOptions)) {
          const correctOpt = (pq.snapshotOptions as any[]).find(
            (o) => o?.correct === true,
          );
          if (correctOpt?.key) correctKey = String(correctOpt.key);
        }
        if (!correctKey) {
          const ac = (pq.question as any)?.answerContent as { text?: unknown } | null;
          if (typeof ac?.text === 'string' && ac.text.length <= 80) {
            correctKey = ac.text;
          }
        }
        const studentAnswer = s?.selectedOption ?? s?.textAnswer ?? null;
        // markerComment is stored as `[ai-grade] <reason>`; strip the
        // prefix so the FE displays just the reasoning.
        const rawComment = s?.markerComment ?? null;
        const aiReason = rawComment?.startsWith('[ai-grade] ')
          ? rawComment.slice('[ai-grade] '.length)
          : rawComment;
        return {
          scriptId: s?.id ?? null,
          paperQuestionId: pq.id,
          sortOrder: pq.sortOrder,
          marks: pq.marks,
          autoCorrect: s?.autoCorrect ?? null,
          isCorrect: s?.autoCorrect ?? null,
          awardedMarks: s?.awardedMarks ?? 0,
          studentAnswer,
          correctAnswer: correctKey,
          explanation:
            typeof sc.explanation === 'string' ? sc.explanation.slice(0, 600) : null,
          aiReason,
        };
      });
    }
    return {
      practiceSubmissionId: sub.id,
      paperId: sub.assignment.paperId,
      paperQuestions: paperQuestions.map((pq) => ({
        id: pq.id,
        sortOrder: pq.sortOrder,
        marks: pq.marks,
        snapshotContent: redactSnapshotForStudent(pq.snapshotContent),
        snapshotOptions: stripOptions(pq.snapshotOptions),
        questionType: pq.question.questionType,
      })),
      existingAnswers,
      alreadySubmitted,
      autoScore: sub.autoScore,
      maxScore: sub.maxScore,
      perQuestion,
    };
  }

  /**
   * Public (IP-gated, rate-limited) — submit a practice attempt. Runs
   * autoGradeScripts so the student sees a score, but DOES NOT mark the
   * submission as 'submitted' (status stays 'practice'). DOES NOT fire
   * score_ready notifications. Stats / trend / wrong-rate endpoints
   * filter out status='practice' so this never counts.
   */
  async submitPractice(
    practiceSubmissionId: string,
    body: {
      studentName: string;
      studentId?: string;
      answers: Array<{
        paperQuestionId: string;
        selectedOption?: string | null;
        textAnswer?: string | null;
      }>;
    },
    ip: string | null,
  ) {
    const resolved = await this.resolveStudentByName(body.studentName, body.studentId);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: practiceSubmissionId },
      select: {
        id: true,
        studentId: true,
        status: true,
        maxScore: true,
        assignment: { select: { paperId: true } },
      },
    });
    if (!sub) throw new NotFoundException({ code: 'submission_not_found' });
    if (sub.status !== 'practice') {
      throw new BadRequestException({ code: 'not_a_practice_submission' });
    }
    if (sub.studentId !== resolved.student.id) {
      throw new ForbiddenException({ code: 'submission_not_yours' });
    }
    // Upsert all answers.
    for (const a of body.answers ?? []) {
      await this.prisma.answerScript.upsert({
        where: {
          submissionId_paperQuestionId: {
            submissionId: sub.id,
            paperQuestionId: a.paperQuestionId,
          },
        },
        create: {
          submissionId: sub.id,
          paperQuestionId: a.paperQuestionId,
          selectedOption: a.selectedOption ?? null,
          textAnswer: a.textAnswer ?? null,
        },
        update: {
          selectedOption: a.selectedOption ?? null,
          textAnswer: a.textAnswer ?? null,
        },
      });
    }
    // Load + grade.
    const scripts = await this.prisma.answerScript.findMany({
      where: { submissionId: sub.id },
      include: {
        paperQuestion: {
          include: {
            question: {
              select: {
                questionType: true,
                options: true,
                answerContent: true,
                content: true,
              },
            },
          },
        },
      },
    });
    const { autoScore, scriptUpdates } = await autoGradeScripts(scripts, this.evaluator);
    await this.prisma.$transaction(async (tx) => {
      await tx.studentSubmission.update({
        where: { id: sub.id },
        // Stamp submittedAt so /my-history can sort practice rows by
        // recency and the student can see "submitted just now" timing.
        // status stays 'practice' so stats/trend/wrong-rate still skip it.
        data: { autoScore, submittedAt: new Date() },
      });
      for (const u of scriptUpdates) {
        await tx.answerScript.update({
          where: { id: u.id },
          data: {
            autoCorrect: u.autoCorrect,
            awardedMarks: u.awardedMarks,
            ...(u.aiReason ? { markerComment: `[ai-grade] ${u.aiReason}` } : {}),
          },
        });
      }
    });
    await this.audit.log({
      actorId: resolved.student.id,
      actorRole: 'student',
      action: 'morning_quiz.practice.submit',
      entityType: 'StudentSubmission',
      entityId: sub.id,
      ip,
      metadata: { autoScore, maxScore: sub.maxScore },
    });
    // R15-followup — the FE result page expects per-question
    // metadata (sortOrder, marks, studentAnswer, correctAnswer,
    // explanation) so it can render "Q3 · 1/1 · ✓ · my answer: X /
    // correct: Y". Without these, the result page renders every row
    // as "Q? · 得分:0 · (空答)" even when answers were submitted.
    const scriptById = new Map(scriptUpdates.map((u) => [u.id, u]));
    return {
      autoScore,
      maxScore: sub.maxScore,
      perQuestion: scripts.map((s) => {
        const u = scriptById.get(s.id);
        const autoCorrect = u?.autoCorrect ?? s.autoCorrect ?? null;
        const awardedMarks = u?.awardedMarks ?? s.awardedMarks ?? 0;
        const sc = (s.paperQuestion.snapshotContent ?? {}) as any;
        // Derive a canonical correctAnswer for the result view —
        // mirror getStudentResult's logic. snapshotContent may carry
        // correctOption (MCQ key) OR correctAnswer (short text);
        // fall back to snapshotOptions array, then question.answerContent.
        let correctKey: string | null =
          typeof sc.correctOption === 'string'
            ? sc.correctOption
            : typeof sc.correctAnswer === 'string'
            ? sc.correctAnswer
            : null;
        if (!correctKey && Array.isArray(s.paperQuestion.snapshotOptions)) {
          const correctOpt = (s.paperQuestion.snapshotOptions as any[]).find(
            (o) => o?.correct === true,
          );
          if (correctOpt?.key) correctKey = String(correctOpt.key);
        }
        if (!correctKey) {
          const ac = (s.paperQuestion.question as any)?.answerContent as
            | { text?: unknown }
            | null;
          if (typeof ac?.text === 'string' && ac.text.length <= 80) {
            correctKey = ac.text;
          }
        }
        const studentAnswer = s.selectedOption ?? s.textAnswer ?? null;
        return {
          scriptId: s.id,
          paperQuestionId: s.paperQuestionId,
          sortOrder: s.paperQuestion.sortOrder,
          marks: s.paperQuestion.marks,
          autoCorrect,
          isCorrect: autoCorrect,
          awardedMarks,
          studentAnswer,
          correctAnswer: correctKey,
          explanation:
            typeof sc.explanation === 'string'
              ? sc.explanation.slice(0, 600)
              : null,
          aiReason: u?.aiReason ?? null,
        };
      }),
    };
  }

  // ─────────────────── F17 — Score trend by week ───────────────────

  /**
   * Public (IP-gated, rate-limited) — last N weeks of (week × level)
   * averages for one student. Week boundary is Monday in school-local
   * time (UTC+8), same as the date storage convention used throughout
   * this module. Excludes practice submissions and unsubmitted rows.
   */
  async historyTrendByName(
    rawName: string,
    studentIdFilter?: string,
    rawWeeks?: number,
  ) {
    const resolved = await this.resolveStudentByName(rawName, studentIdFilter);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const weeks = Math.min(52, Math.max(1, rawWeeks ?? 12));
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    // Build the cutoff: Monday-00:00 of (this week - weeks weeks).
    const now = new Date();
    const localMs = now.getTime() + tzOff * 60_000;
    const local = new Date(localMs);
    const dow = local.getUTCDay(); // 0=Sun..6=Sat
    // Distance back to Monday (Mon=1). If today is Sunday, that's 6 days
    // back, not -1.
    const daysBackToMonday = (dow + 6) % 7;
    const monLocal = new Date(
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate() - daysBackToMonday,
      ),
    );
    // monLocal is UTC midnight of "this Monday in local". Subtract
    // (weeks-1) weeks to get the earliest week we care about.
    const earliestMonLocal = new Date(
      monLocal.getTime() - (weeks - 1) * 7 * 86_400_000,
    );
    // Convert that back to UTC instant for the DB filter: localMidnight
    // - tzOff = UTC instant.
    const cutoffUtc = new Date(earliestMonLocal.getTime() - tzOff * 60_000);
    const submissions = await this.prisma.studentSubmission.findMany({
      where: {
        studentId: resolved.student.id,
        status: { in: ['submitted', 'graded', 'returned', 'marked'] },
        submittedAt: { gte: cutoffUtc },
      },
      select: {
        id: true,
        autoScore: true,
        totalScore: true,
        maxScore: true,
        submittedAt: true,
        assignmentId: true,
      },
    });
    if (submissions.length === 0) {
      return { student: resolved.student, weeks: [] };
    }
    // Resolve level from MorningQuizSession (paperAssignmentId → session).
    const assignmentIds = Array.from(new Set(submissions.map((s) => s.assignmentId)));
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { paperAssignmentId: { in: assignmentIds } },
      select: { paperAssignmentId: true, level: true },
    });
    const levelByAsgmt = new Map<string, string>();
    for (const s of sessions) {
      if (!levelByAsgmt.has(s.paperAssignmentId)) {
        levelByAsgmt.set(s.paperAssignmentId, s.level);
      }
    }
    // Bucket by (weekStart-YMD, level).
    type Bucket = { totalPct: number; count: number };
    const buckets = new Map<string, Bucket>();
    for (const sub of submissions) {
      if (!sub.submittedAt) continue;
      const level = levelByAsgmt.get(sub.assignmentId);
      if (!level) continue;
      const subLocalMs = sub.submittedAt.getTime() + tzOff * 60_000;
      const subLocal = new Date(subLocalMs);
      const subDow = subLocal.getUTCDay();
      const subDaysBack = (subDow + 6) % 7;
      const subMonLocal = new Date(
        Date.UTC(
          subLocal.getUTCFullYear(),
          subLocal.getUTCMonth(),
          subLocal.getUTCDate() - subDaysBack,
        ),
      );
      const weekStart = `${subMonLocal.getUTCFullYear()}-${String(
        subMonLocal.getUTCMonth() + 1,
      ).padStart(2, '0')}-${String(subMonLocal.getUTCDate()).padStart(2, '0')}`;
      const key = `${weekStart}|${level}`;
      const max = sub.maxScore || 0;
      const got = sub.totalScore ?? sub.autoScore ?? 0;
      const pct = max > 0 ? (got / max) * 100 : 0;
      const b = buckets.get(key) ?? { totalPct: 0, count: 0 };
      b.totalPct += pct;
      b.count += 1;
      buckets.set(key, b);
    }
    const rows: Array<{
      weekStart: string;
      level: string;
      avgPct: number;
      submissionCount: number;
    }> = [];
    for (const [key, b] of buckets.entries()) {
      const [weekStart, level] = key.split('|');
      rows.push({
        weekStart,
        level,
        avgPct: b.count > 0 ? b.totalPct / b.count : 0,
        submissionCount: b.count,
      });
    }
    rows.sort((a, b) =>
      a.weekStart === b.weekStart
        ? a.level.localeCompare(b.level)
        : a.weekStart.localeCompare(b.weekStart),
    );
    return {
      student: resolved.student,
      weeks: rows,
    };
  }

  // ─────────────────── F18 — Per-question wrong rate ───────────────────

  /**
   * Teacher / head_teacher / admin — per-question wrong rate for one
   * paper. Excludes practice submissions. Wrong = autoCorrect === false;
   * scripts without an autoCorrect (never auto-graded) are excluded from
   * the denominator to keep "wrongRate" meaningful.
   */
  async paperWrongRate(paperId: string, actor: ActorCtx) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    // Scope check for non-admins — at least one assignment of this paper
    // must touch one of their classes.
    if (actor.role === 'teacher') {
      const anyAsgmt = await this.prisma.paperAssignment.findFirst({
        where: { paperId },
        select: { classId: true },
      });
      if (!anyAsgmt || !(await canActOnClass(this.prisma, actor, anyAsgmt.classId))) {
        throw new ForbiddenException({ code: 'not_your_class' });
      }
    }
    const pqs = await this.prisma.paperQuestion.findMany({
      where: { paperId },
      orderBy: { sortOrder: 'asc' },
      include: { question: { select: { questionType: true, content: true } } },
    });
    if (pqs.length === 0) return { items: [] };
    const pqIds = pqs.map((p) => p.id);
    const scripts = await this.prisma.answerScript.findMany({
      where: {
        paperQuestionId: { in: pqIds },
        submission: { status: { not: 'practice' } },
      },
      select: {
        paperQuestionId: true,
        autoCorrect: true,
      },
    });
    type Counter = { totalAttempts: number; wrongCount: number };
    const counters = new Map<string, Counter>();
    for (const s of scripts) {
      if (s.autoCorrect == null) continue; // not graded
      const c = counters.get(s.paperQuestionId) ?? { totalAttempts: 0, wrongCount: 0 };
      c.totalAttempts += 1;
      if (s.autoCorrect === false) c.wrongCount += 1;
      counters.set(s.paperQuestionId, c);
    }
    const items = pqs.map((pq, i) => {
      const c = counters.get(pq.id) ?? { totalAttempts: 0, wrongCount: 0 };
      // taskType lives on the question content blob for IELTS reading;
      // surface it when present so the UI can group by task.
      const content = (pq.question.content as Record<string, unknown> | null) ?? null;
      const taskType =
        typeof content?.taskType === 'string' ? (content.taskType as string) : null;
      return {
        paperQuestionId: pq.id,
        n: i + 1,
        taskType,
        totalAttempts: c.totalAttempts,
        wrongCount: c.wrongCount,
        wrongRate: c.totalAttempts > 0 ? c.wrongCount / c.totalAttempts : 0,
      };
    });
    return { items };
  }
}
