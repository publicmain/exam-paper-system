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

interface ActorCtx {
  id: string;
  role: string;
  ip: string | null;
}

export interface CreateSessionInput {
  date: Date; // y-m-d in school timezone — service derives the windows
  classId: string;
  paperId: string;
}

export interface BatchScheduleInput {
  /** Sunday-night-style batch: list of (date, class, paper) tuples to wire. */
  items: Array<{ date: string; classId: string; paperId: string }>;
}

const ATTENDANCE_START_LOCAL = '08:30:00';
const ATTENDANCE_END_LOCAL = '08:32:00';
const LATE_CUTOFF_LOCAL = '08:50:00';
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

    // Conflict detection: same (date, class) already has a session?
    const existing = await this.prisma.morningQuizSession.findUnique({
      where: { date_classId: { date: attendanceStart, classId: input.classId } },
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
    input: { weekStart: string; classIds: string[]; questionsPerPaper?: number },
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

    const dates: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday.getTime() + i * 86_400_000);
      dates.push(d.toISOString().slice(0, 10));
    }

    type Outcome =
      | { ok: true; date: string; classId: string; sessionId: string; paperId: string }
      | { ok: false; date: string; classId: string; code: string; detail?: string };
    const outcomes: Outcome[] = [];

    for (const dateIso of dates) {
      for (const classId of input.classIds) {
        try {
          // Idempotent — skip if a session already exists for (date, class).
          const existingSession = await this.prisma.morningQuizSession.findUnique({
            where: { date_classId: { date: new Date(dateIso), classId } },
          });
          if (existingSession) {
            outcomes.push({
              ok: false,
              date: dateIso,
              classId,
              code: 'session_already_exists',
              detail: existingSession.id,
            });
            continue;
          }

          const levelRow = await this.prisma.classEnglishLevel.findUnique({
            where: { classId },
          });
          if (!levelRow) {
            outcomes.push({ ok: false, date: dateIso, classId, code: 'class_level_not_set' });
            continue;
          }

          // Fork by level. ielts_authentic uses passage-pick mode — IELTS
          // Reading is fundamentally passage-grouped (one ~800-word passage
          // with 13 sub-questions), and AI question-by-question generation
          // produces 13 unrelated mini-passages. We pull a real Cambridge
          // passage from the bank and use ALL its questions verbatim.
          //
          // Every fresh paper goes through the AI QA loop before we surface
          // its id back to the caller — verdict=reject triggers an automatic
          // regenerate (different passage / different AI call) with up to
          // 2 retries before we hand the paper to the teacher for manual
          // triage. See generateWithQaLoop for the full state machine.
          // F5: pull the per-class weekly focus so the AI prompt can
          // bias generation. Read inline (cheap, one column) so each
          // class's session reflects the latest teacher input even
          // mid-week.
          const cls = await this.prisma.class.findUnique({
            where: { id: classId },
            select: { weeklyFocus: true },
          });
          const weeklyFocus = cls?.weeklyFocus ?? null;

          const builder =
            levelRow.level === 'ielts_authentic'
              ? () =>
                  this.pickPassageAndCreatePaper('IELTS', 'AUTH', classId, dateIso, actor)
              : async () => {
                  const qpInput = this.levelToQuickPaperInput(
                    levelRow.level,
                    dateIso,
                    targetCount,
                  );
                  qpInput.weeklyFocus = weeklyFocus;
                  const generated = await this.quickPaper.generate(qpInput, actor);
                  return generated.paperId;
                };
          const paperId = await this.generateWithQaLoop(
            builder,
            actor,
            `level=${levelRow.level} class=${classId} date=${dateIso}`,
          );

          const session = await this.createSession(
            { date: new Date(dateIso), classId, paperId },
            actor,
          );
          outcomes.push({
            ok: true,
            date: dateIso,
            classId,
            sessionId: session.id,
            paperId,
          });
        } catch (e: any) {
          const code = (e?.response?.code as string) ?? e?.message ?? 'unknown_error';
          outcomes.push({ ok: false, date: dateIso, classId, code: String(code).slice(0, 100) });
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
        classCount: input.classIds.length,
        ok: outcomes.filter((o) => o.ok).length,
        fail: outcomes.filter((o) => !o.ok).length,
      },
    });
    return { outcomes };
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
  ): Promise<string> {
    const subject = await this.prisma.subject.findFirst({
      where: { code: subjectCode },
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

    const bank = await this.prisma.question.findMany({
      where: {
        subjectId: subject.id,
        componentId: component.id,
        status: 'active',
        sourceType: 'past_paper_reference',
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

    // Filter out passages used by this class in the last 30 days. Round-7
    // hardening:
    //   - constrain the recent-papers query to (this subject + passage_pick
    //     mode) so an unrelated passage_pick from another subject (we only
    //     have IELTS today, but defensive) can't skew the bucket;
    //   - track lastUsedAt per passage so the fallback can pick the LEAST
    //     recently used instead of the deterministic [0]; that's what
    //     turned a depleted bank into a "silent loop" — the same passage
    //     came up every Monday;
    //   - emit a loud warn() when the bank is depleted so ops can act.
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const recentPapers = await this.prisma.paper.findMany({
      where: {
        subjectId: subject.id,
        assignments: { some: { classId } },
        createdAt: { gte: cutoff },
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
        `passage_pick bank depleted for class=${classId} subject=${subjectCode} — recycling LRU passage=${pick} ` +
          `(bank=${byPassage.size}, used in last 30d=${usedPassageRefs.size}). Ingest more past papers.`,
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
    if (level === 'ielts_hard') {
      return {
        syllabusCode: 'IELTS',
        topics: split(['IR.2', 'IR.3', 'IR.4', 'IR.5', 'IR.7']),
        difficulty: 5,
        durationMin: 30,
        includeDiagrams: false,
        paperName: `Morning Quiz IELTS-Hard ${dateIso}`,
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

  /** Look at a week's worth of scheduled sessions for the calendar UI. */
  async listScheduled(weekStart: Date) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
    return this.prisma.morningQuizSession.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
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
    // The student client uses `level` to pick the exam shell (IELTS split-pane
    // vs O-Level paged) and `paperMode` to decide whether option-shuffle is
    // safe. Looking the level up here keeps the client one-shot — no extra
    // round trip just to know which UI to render. The class might not have a
    // ClassEnglishLevel row (older sessions / non-English subjects), in which
    // case we fall back to a heuristic on paper.config.
    const classLevel = session.paperAssignment.classId
      ? await this.prisma.classEnglishLevel.findUnique({
          where: { classId: session.paperAssignment.classId },
          select: { level: true },
        })
      : null;
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

    // Derive the quiz UI mode for the client. `level` comes from
    // ClassEnglishLevel; if absent (no row yet) we fall back to:
    //   - 'ielts_authentic' when paper.config.mode === 'passage_pick'
    //   - 'olevel' otherwise
    // The client uses this to switch between the IELTS split-pane and the
    // O-Level paged shells.
    const paperMode = (paper?.config as { mode?: string } | null)?.mode ?? null;
    const level = classLevel?.level ?? (paperMode === 'passage_pick' ? 'ielts_authentic' : 'olevel');
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
    const submission = await this.prisma.studentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
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

    const submission = await this.prisma.studentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
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

  async setClassEnglishLevel(classId: string, level: EnglishLevel, actor: ActorCtx) {
    if (!['admin', 'head_teacher'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const upserted = await this.prisma.classEnglishLevel.upsert({
      where: { classId },
      create: { classId, level, effectiveFrom: new Date() },
      update: { level, effectiveFrom: new Date() },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.class_level.set',
      entityType: 'ClassEnglishLevel',
      entityId: upserted.id,
      ip: actor.ip,
      metadata: { classId, level },
    });
    return upserted;
  }

  /**
   * DEBUG ONLY — gated behind MORNING_QUIZ_DEBUG=true. Fast-forwards a
   * session into "currently active" state by overwriting time windows to
   * NOW + standard offsets and flipping status to active. Used for off-hours
   * end-to-end smoke testing of the scan flow. Audit-logged.
   */
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

  /** Find the StudentSubmission tied to (session, student) — used by the
   *  controller's submit endpoint to delegate to the canonical
   *  student.service.finalSubmit. */
  async findSubmissionForSession(sessionId: string, studentId: string) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { paperAssignmentId: true },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    return this.prisma.studentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
      },
    });
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

    const submission = await this.prisma.studentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
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
        question: { select: { questionType: true } },
      },
    });

    const scriptByPq = new Map(
      submission.scripts.map((s) => [s.paperQuestionId, s]),
    );

    const items = paperQuestions.map((pq) => {
      const sc = (pq.snapshotContent ?? {}) as Record<string, unknown>;
      const correctKey =
        typeof sc.correctOption === 'string'
          ? (sc.correctOption as string)
          : typeof sc.correctAnswer === 'string'
          ? (sc.correctAnswer as string)
          : null;
      const explanation =
        typeof sc.explanation === 'string'
          ? (sc.explanation as string).slice(0, 600)
          : null;
      const script = scriptByPq.get(pq.id);
      const studentChoice = script?.selectedOption ?? script?.textAnswer ?? null;
      // For MCQ on shuffled (non-passage_pick) papers we DON'T relabel
      // here — the student's saved selectedOption is already the canonical
      // (un-shuffled) key, so direct comparison against correctKey works.
      const isCorrect =
        correctKey != null && studentChoice != null
          ? String(studentChoice).trim().toLowerCase() ===
            String(correctKey).trim().toLowerCase()
          : null;
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
}
