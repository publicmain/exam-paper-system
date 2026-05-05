import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { buildOptionMap, deriveSeed, mulberry32, shuffleInPlace } from './shuffle';

interface ActorCtx { id: string; role: string; ip?: string | null }

type GenerateMode = 'shuffle_options' | 'shuffle_questions' | 'both';

/**
 * Variant generation strategy
 * ---------------------------
 * For a given PaperAssignment we look up every enrolled student in
 * the bound class, derive a deterministic seed per student, then
 * compute either a question permutation, an option-letter remap, or
 * both. The resolved order + map are stored in
 * PaperVariantAssignment so the take-paper UI never has to know the
 * shuffle algorithm — and a refresh mid-exam renders the same form.
 *
 * Idempotency: re-running generate-for-class is safe. We upsert by
 * the (assignmentId, studentId) unique key, so a student who joined
 * the class after the first generation also gets a row on the
 * second pass and existing rows are overwritten with the same
 * (deterministic) seed.
 */
@Injectable()
export class PaperVariantsService {
  private readonly logger = new Logger('PaperVariantsService');
  constructor(private readonly prisma: PrismaService) {}

  async generateForClass(assignmentId: string, mode: GenerateMode, _actor: ActorCtx) {
    // Casting through `any` because b7.prisma is a path-B fragment that
    // hasn't been concatenated into schema.prisma yet. Once the
    // integrator merges, the cast can be dropped.
    const prisma: any = this.prisma;

    const assignment = await prisma.paperAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        paper: {
          include: {
            questions: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, snapshotOptions: true, question: { select: { questionType: true, options: true } } },
            },
          },
        },
        class: {
          include: {
            enrollments: { where: { role: 'student' }, select: { userId: true } },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException('assignment not found');

    const studentIds: string[] = (assignment.class.enrollments ?? []).map((e: any) => e.userId);
    const paperQuestions = assignment.paper.questions ?? [];
    // Pre-compute the original option key list per pq, so each
    // student-loop iteration doesn't redo the type/key parse.
    const pqOptionKeys: Array<{ pqId: string; keys: string[] }> = paperQuestions.map((pq: any) => {
      const isMcq = pq.question?.questionType === 'mcq';
      if (!isMcq) return { pqId: pq.id, keys: [] };
      const opts = (pq.snapshotOptions ?? pq.question?.options ?? []) as Array<{ key: string }>;
      return { pqId: pq.id, keys: Array.isArray(opts) ? opts.map((o) => o.key).filter(Boolean) : [] };
    });
    const baseOrder: string[] = paperQuestions.map((pq: any) => pq.id);

    const written: any[] = [];
    for (const studentId of studentIds) {
      const seed = deriveSeed(assignmentId, studentId);
      // Two independent PRNG streams keyed off the same seed — one
      // for question order, one for option-letter shuffles. Using
      // distinct constants keeps the two streams from drifting
      // together when both modes are on.
      const rngQ = mulberry32(seed ^ 0xA5A5A5A5);
      const rngO = mulberry32(seed ^ 0x5A5A5A5A);

      const order = (mode === 'shuffle_questions' || mode === 'both')
        ? shuffleInPlace([...baseOrder], rngQ)
        : [...baseOrder];

      const optionShuffles: Record<string, Record<string, string>> = {};
      if (mode === 'shuffle_options' || mode === 'both') {
        for (const { pqId, keys } of pqOptionKeys) {
          if (keys.length > 1) {
            optionShuffles[pqId] = buildOptionMap(keys, rngO);
          }
        }
      }

      const row = await prisma.paperVariantAssignment.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId } },
        create: {
          assignmentId,
          studentId,
          seed,
          questionOrder: order,
          optionShuffles,
        },
        update: {
          // On re-run, re-write seed/order/options. Because seed is
          // derived from (assignmentId, studentId), the values are
          // the same — but if `mode` changed (e.g. teacher first
          // ran shuffle_options, then re-ran with both) the row
          // gets refreshed.
          seed,
          questionOrder: order,
          optionShuffles,
        },
      });
      written.push(row);
    }

    return {
      assignmentId,
      mode,
      studentsProcessed: studentIds.length,
      variants: written,
    };
  }

  /**
   * Look up the variant for a given (student, assignment) pair.
   * Returns 404 if no variant has been generated yet — the caller
   * (StudentTake.tsx integration) should fall back to the canonical
   * paper order when the variant is missing.
   *
   * Authorization note: this is queried by the student themself
   * during the take-paper flow. The controller enforces that the
   * caller's userId matches studentId (or the caller is staff).
   */
  async getForStudent(studentId: string, assignmentId: string) {
    const prisma: any = this.prisma;
    const variant = await prisma.paperVariantAssignment.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
    });
    if (!variant) throw new NotFoundException('no variant for this student/assignment');
    return variant;
  }

  /**
   * Teacher-side: list every variant row for an assignment, joined
   * with student name/email so the VariantPreview UI can render a
   * table without N+1 lookups.
   */
  async listForAssignment(assignmentId: string) {
    const prisma: any = this.prisma;
    const rows = await prisma.paperVariantAssignment.findMany({
      where: { assignmentId },
      include: { student: { select: { id: true, name: true, email: true } } },
      orderBy: { generatedAt: 'asc' },
    });
    return rows;
  }
}
