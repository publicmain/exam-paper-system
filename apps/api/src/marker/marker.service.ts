import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ClaimDto, QueueQueryDto, ScoreScriptDto } from './dto';

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

/**
 * Marker workflow:
 *   1. Markers (teacher / head_teacher / admin) GET /api/marker/queue to see
 *      submissions that have been final-submitted by students AND still have
 *      at least one structured AnswerScript with awardedMarks IS NULL.
 *      MCQs are auto-graded at submit time and never appear here.
 *   2. POST /api/marker/claim {submissionId} — atomic claim. Uses the same
 *      conditional `updateMany` (or upsert-with-where) pattern as
 *      StudentService.finalSubmit so two markers racing yields exactly one
 *      winner; the loser gets 409.
 *   3. PATCH /api/marker/scripts/:scriptId — score one script. Rejects the
 *      call unless the caller is the current claim-holder.
 *   4. POST /api/marker/release {submissionId} — give the claim back.
 *   5. POST /api/marker/finalize/:submissionId — once every structured
 *      AnswerScript has awardedMarks set, sum to manualScore, persist
 *      totalScore = autoScore + manualScore, status='marked'.
 *
 * Integrity invariants:
 *   - We never let a non-claim-holder write to AnswerScript.awardedMarks.
 *   - finalize() refuses to run while structured scripts are still null.
 *   - finalize() and finalSubmit() are *both* on the StudentSubmission row,
 *     so the lifecycle is in_progress -> submitted -> marked.
 */
@Injectable()
export class MarkerService {
  private readonly logger = new Logger('MarkerService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List submissions with at least one ungraded structured script.
   * Filters by classId / paperId via assignment join.
   */
  async listQueue(query: QueueQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    // Find submissions:
    //   - status='submitted'
    //   - have ≥1 AnswerScript whose paperQuestion.question.questionType
    //     is structured/short_answer/essay AND awardedMarks IS NULL.
    // We deliberately exclude 'marked' submissions (already finalized).
    const where: any = {
      status: 'submitted',
      scripts: {
        some: {
          awardedMarks: null,
          paperQuestion: {
            question: {
              questionType: { in: ['structured', 'short_answer', 'essay'] },
            },
          },
        },
      },
    };
    if (query.classId) {
      where.assignment = { ...(where.assignment ?? {}), classId: query.classId };
    }
    if (query.paperId) {
      where.assignment = { ...(where.assignment ?? {}), paperId: query.paperId };
    }

    const [total, rows] = await Promise.all([
      this.prisma.studentSubmission.count({ where }),
      this.prisma.studentSubmission.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { submittedAt: 'asc' }, // oldest first — fairness
        include: {
          assignment: {
            include: {
              paper: { select: { id: true, name: true, totalMarksActual: true } },
              class: { select: { id: true, name: true, classCode: true } },
            },
          },
          student: { select: { id: true, name: true, email: true } },
          scripts: {
            select: {
              id: true,
              awardedMarks: true,
              paperQuestion: {
                select: {
                  id: true,
                  question: { select: { questionType: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    // Attach claim info — the controller gets to decide what to render.
    const claims = await this.prisma.markerAssignment.findMany({
      where: {
        submissionId: { in: rows.map((r) => r.id) },
        status: 'active',
      },
      include: { marker: { select: { id: true, name: true, email: true } } },
    });
    const claimsBySub = new Map(claims.map((c) => [c.submissionId, c]));

    const items = rows.map((r) => {
      const total = (r.scripts ?? []).filter((s) =>
        ['structured', 'short_answer', 'essay'].includes(s.paperQuestion.question.questionType),
      ).length;
      const ungraded = (r.scripts ?? []).filter(
        (s) =>
          ['structured', 'short_answer', 'essay'].includes(
            s.paperQuestion.question.questionType,
          ) && s.awardedMarks == null,
      ).length;
      return {
        id: r.id,
        status: r.status,
        autoScore: r.autoScore,
        manualScore: r.manualScore,
        totalScore: r.totalScore,
        maxScore: r.maxScore,
        submittedAt: r.submittedAt,
        student: r.student,
        assignment: r.assignment,
        structuredCount: total,
        ungradedCount: ungraded,
        claim: claimsBySub.get(r.id) ?? null,
      };
    });

    return { total, page, pageSize, items };
  }

  /**
   * Atomically claim a submission for marking.
   *
   * Race-safe pattern: we use `MarkerAssignment.submissionId` UNIQUE plus a
   * conditional update so two concurrent calls produce exactly one winner.
   *
   * Strategy:
   *   1. Try to create the row. If P2002 (unique violation) → check existing
   *      claim. If it's released, *atomically* re-claim with updateMany WHERE
   *      status='released'. If still active and held by someone else → 409.
   *      If active and held by *us* → idempotent success.
   */
  async claim(body: ClaimDto, marker: ActorCtx) {
    // Validate target submission exists and is in the right state.
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: body.submissionId },
    });
    if (!sub) throw new NotFoundException('submission not found');
    if (sub.status !== 'submitted') {
      throw new BadRequestException(
        `submission status=${sub.status}; can only claim submitted submissions`,
      );
    }

    try {
      const created = await this.prisma.markerAssignment.create({
        data: {
          submissionId: body.submissionId,
          markerId: marker.id,
          status: 'active',
        },
      });
      return created;
    } catch (e: any) {
      if (e?.code !== 'P2002') {
        throw e;
      }
      // Unique-on-submissionId fired: a row already exists. See if it's stale.
      const existing = await this.prisma.markerAssignment.findUnique({
        where: { submissionId: body.submissionId },
      });
      if (!existing) {
        // Race between create and the lookup — extremely unlikely, treat as
        // generic conflict so the caller retries.
        throw new ConflictException('claim conflict; retry');
      }
      if (existing.status === 'active') {
        if (existing.markerId === marker.id) {
          // Idempotent: caller already owns the claim.
          return existing;
        }
        throw new ConflictException(
          `submission already claimed by marker ${existing.markerId}`,
        );
      }
      // status === 'released' → re-claim atomically. updateMany returns count
      // = 0 if some other marker beat us to it.
      const reclaim = await this.prisma.markerAssignment.updateMany({
        where: { submissionId: body.submissionId, status: 'released' },
        data: { markerId: marker.id, status: 'active', claimedAt: new Date(), releasedAt: null },
      });
      if (reclaim.count === 0) {
        // Lost the race against another marker who also tried to re-claim.
        const after = await this.prisma.markerAssignment.findUnique({
          where: { submissionId: body.submissionId },
        });
        throw new ConflictException(
          `submission already claimed by marker ${after?.markerId ?? 'unknown'}`,
        );
      }
      return this.prisma.markerAssignment.findUnique({
        where: { submissionId: body.submissionId },
      });
    }
  }

  /** Release a claim. Only the claim owner (or admin) may release. */
  async release(submissionId: string, marker: ActorCtx) {
    const claim = await this.prisma.markerAssignment.findUnique({
      where: { submissionId },
    });
    if (!claim) throw new NotFoundException('no active claim on this submission');
    if (claim.status !== 'active') {
      throw new BadRequestException(`claim is ${claim.status}, not active`);
    }
    if (claim.markerId !== marker.id && marker.role !== 'admin') {
      throw new ForbiddenException('only the claim owner or an admin may release');
    }
    return this.prisma.markerAssignment.update({
      where: { submissionId },
      data: { status: 'released', releasedAt: new Date() },
    });
  }

  /**
   * Score one structured AnswerScript. Caller must be the current claim
   * owner of the script's submission, and the script must belong to a
   * structured-type question (we never let a marker overwrite an MCQ
   * autoCorrect verdict — that's the integrity guard).
   *
   * Caps awardedMarks at the paperQuestion.marks budget (a comment about a
   * 12-mark question awarding 200 marks is almost certainly a typo).
   */
  async scoreScript(scriptId: string, body: ScoreScriptDto, marker: ActorCtx) {
    const script = await this.prisma.answerScript.findUnique({
      where: { id: scriptId },
      include: {
        paperQuestion: { include: { question: { select: { questionType: true } } } },
        submission: { select: { id: true, status: true } },
      },
    });
    if (!script) throw new NotFoundException('script not found');
    if (script.submission.status !== 'submitted') {
      throw new BadRequestException(
        `submission status=${script.submission.status}; can only score 'submitted'`,
      );
    }
    if (script.paperQuestion.question.questionType === 'mcq') {
      throw new BadRequestException('MCQ scripts are auto-graded; cannot manually score');
    }
    if (body.awardedMarks > script.paperQuestion.marks) {
      throw new BadRequestException(
        `awardedMarks ${body.awardedMarks} exceeds paperQuestion.marks ${script.paperQuestion.marks}`,
      );
    }

    // Enforce claim ownership.
    const claim = await this.prisma.markerAssignment.findUnique({
      where: { submissionId: script.submission.id },
    });
    if (!claim || claim.status !== 'active' || claim.markerId !== marker.id) {
      throw new ForbiddenException(
        'you must hold the active marker-claim on this submission to score it',
      );
    }

    return this.prisma.answerScript.update({
      where: { id: scriptId },
      data: {
        awardedMarks: body.awardedMarks,
        markerComment: body.markerComment ?? null,
        markedById: marker.id,
        markedAt: new Date(),
      },
    });
  }

  /**
   * Finalize: ensure every structured script has awardedMarks set, then
   * compute manualScore + totalScore and flip submission.status='marked'.
   * Releases the marker claim as part of finalization.
   */
  async finalize(submissionId: string, marker: ActorCtx) {
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        scripts: {
          include: {
            paperQuestion: {
              include: { question: { select: { questionType: true } } },
            },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('submission not found');
    if (sub.status !== 'submitted') {
      throw new BadRequestException(
        `submission status=${sub.status}; cannot finalize`,
      );
    }

    // Claim ownership check (admin can override).
    const claim = await this.prisma.markerAssignment.findUnique({
      where: { submissionId },
    });
    if (!claim || claim.status !== 'active') {
      throw new ForbiddenException('no active claim on this submission');
    }
    if (claim.markerId !== marker.id && marker.role !== 'admin') {
      throw new ForbiddenException(
        'only the claim owner or an admin may finalize',
      );
    }

    // Verify every structured script is graded.
    let manualScore = 0;
    let structuredScripts = 0;
    let ungraded = 0;
    for (const s of sub.scripts) {
      const t = s.paperQuestion.question.questionType;
      if (t === 'mcq') continue;
      structuredScripts += 1;
      if (s.awardedMarks == null) {
        ungraded += 1;
      } else {
        manualScore += s.awardedMarks;
      }
    }
    if (ungraded > 0) {
      throw new BadRequestException(
        `cannot finalize: ${ungraded}/${structuredScripts} structured scripts are still ungraded`,
      );
    }

    const autoScore = sub.autoScore ?? 0;
    const totalScore = autoScore + manualScore;

    // Atomic transition: only flip submitted → marked. If two markers both
    // try to finalize concurrently the loser sees count=0 and we 409.
    const updated = await this.prisma.studentSubmission.updateMany({
      where: { id: submissionId, status: 'submitted' },
      data: {
        status: 'marked',
        manualScore,
        totalScore,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException('submission was finalized concurrently by another marker');
    }

    // Release claim (audit-trail row stays, just status flip).
    await this.prisma.markerAssignment.update({
      where: { submissionId },
      data: { status: 'released', releasedAt: new Date() },
    });

    return this.prisma.studentSubmission.findUnique({ where: { id: submissionId } });
  }

  /**
   * Per-submission detail view for the marker UI.
   * Returns the full paper structure so the marker sees the question text,
   * AND each AnswerScript with the student's textAnswer. Unlike the student
   * variant, this one is NOT redacted: markers need the mark scheme.
   */
  async getSubmissionForMarker(submissionId: string, marker: ActorCtx) {
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            paper: {
              include: {
                questions: {
                  orderBy: { sortOrder: 'asc' },
                  include: { question: { include: { assets: true } } },
                },
              },
            },
            class: { select: { id: true, name: true, classCode: true } },
          },
        },
        student: { select: { id: true, name: true, email: true } },
        scripts: {
          include: {
            paperQuestion: { include: { question: { include: { assets: true } } } },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('submission not found');

    const claim = await this.prisma.markerAssignment.findUnique({
      where: { submissionId },
      include: { marker: { select: { id: true, name: true, email: true } } },
    });

    return {
      ...sub,
      claim,
      // Convenience flag for the UI: did *I* claim this?
      myClaim: !!(claim && claim.status === 'active' && claim.markerId === marker.id),
    };
  }
}
