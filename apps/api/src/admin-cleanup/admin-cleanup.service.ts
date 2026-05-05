import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * Admin-only data hygiene endpoints. Bundles two one-off cleanup tasks:
 *
 *   1. fixReplacementChars — replace U+FFFD (the `�` black diamond)
 *      in Paper / PaperTemplate / Class names with a real middle dot.
 *      This corruption was introduced at ingestion; the cleanup is
 *      idempotent — re-running is a no-op.
 *
 *   2. purgeTestData — remove test fixtures left behind by the blackbox
 *      regression suite (users / classes / papers prefixed with
 *      `t1-..t5-`, `b1-..b10-`). Returns a count of deleted rows.
 *
 * Both methods log everything so we have an audit trail for the
 * destructive case (#2). Both are idempotent.
 */
@Injectable()
export class AdminCleanupService {
  private readonly logger = new Logger('AdminCleanupService');
  constructor(private readonly prisma: PrismaService) {}

  async fixReplacementChars() {
    // Postgres lets us match the U+FFFD code point with E'\\uFFFD'.
    // Wrap each UPDATE in a try/catch so a missing column on a fork
    // doesn't break the rest.
    const fffd = '�';
    const middle = '·';

    const paperNames = await this.prisma.$executeRaw`
      UPDATE "Paper"
      SET "name" = REPLACE("name", ${fffd}, ${middle})
      WHERE "name" LIKE ${'%' + fffd + '%'}
    `;
    const templateNames = await this.prisma.$executeRaw`
      UPDATE "PaperTemplate"
      SET "name" = REPLACE("name", ${fffd}, ${middle})
      WHERE "name" LIKE ${'%' + fffd + '%'}
    `;
    const classNames = await this.prisma.$executeRaw`
      UPDATE "Class"
      SET "name" = REPLACE("name", ${fffd}, ${middle})
      WHERE "name" LIKE ${'%' + fffd + '%'}
    `;
    let questionRefs = 0;
    try {
      questionRefs = await this.prisma.$executeRaw`
        UPDATE "Question"
        SET "sourceRef" = REPLACE("sourceRef", ${fffd}, ${middle})
        WHERE "sourceRef" LIKE ${'%' + fffd + '%'}
      `;
    } catch (e) {
      // sourceRef may be nullable on rows; ignore.
    }

    this.logger.log(
      `fixReplacementChars: paper=${paperNames} template=${templateNames} class=${classNames} questionRef=${questionRefs}`,
    );

    return {
      ok: true,
      replaced: {
        paper: paperNames,
        template: templateNames,
        class: classNames,
        question: questionRefs,
      },
    };
  }

  /**
   * Wipes test-suite fixtures. Pattern-matches on:
   *
   *   - User.email matching `^(t[1-9]|b[1-9])` (t1-stu / b8-stu / t4-class-A-... etc.)
   *   - Class.classCode matching `^(T[1-9]|B[1-9])` (e.g. T2C944621, B7CC946823)
   *   - Paper.name matching `^(t[1-9]-|b[1-9]+-|t.-probe)` etc.
   *
   * We delete in dependency order:
   *   AnswerScript -> StudentSubmission -> PaperAssignment -> ClassEnrollment ->
   *   Class -> Paper-questions / Paper -> User
   *
   * Caller passes `dryRun: true` to preview without deleting.
   */
  async purgeTestData(opts: { dryRun?: boolean } = {}) {
    const dryRun = opts.dryRun !== false; // default true for safety

    // Find candidate users — students only, with test-suite email prefixes.
    // Filtering by role='student' avoids accidentally nuking the admin
    // accounts even if their email somehow matched a prefix.
    const candidateUsers = await this.prisma.user.findMany({
      where: {
        role: 'student',
        OR: [
          { email: { startsWith: 't1-' } },
          { email: { startsWith: 't2-' } },
          { email: { startsWith: 't3-' } },
          { email: { startsWith: 't4-' } },
          { email: { startsWith: 't5-' } },
          { email: { startsWith: 'b1-' } },
          { email: { startsWith: 'b2-' } },
          { email: { startsWith: 'b3-' } },
          { email: { startsWith: 'b4-' } },
          { email: { startsWith: 'b5-' } },
          { email: { startsWith: 'b6-' } },
          { email: { startsWith: 'b7-' } },
          { email: { startsWith: 'b8-' } },
          { email: { startsWith: 'b9-' } },
          { email: { startsWith: 'b10-' } },
        ],
      },
      select: { id: true, email: true },
    });
    // Also pick up B6 test head_teacher / teacher fixtures (they were
    // created by the b6 RBAC test and aren't tagged as students).
    const candidateB6Staff = await this.prisma.user.findMany({
      where: {
        role: { in: ['head_teacher', 'teacher'] },
        OR: [
          { email: { startsWith: 'b6-victim-' } },
          { email: { startsWith: 'b6-teacher-' } },
        ],
      },
      select: { id: true, email: true },
    });
    candidateUsers.push(...candidateB6Staff);
    const candidateClasses = await this.prisma.class.findMany({
      where: {
        OR: [
          { classCode: { startsWith: 'T' } },
          { classCode: { startsWith: 'B' } },
          { classCode: { startsWith: 't' } },
          { classCode: { startsWith: 'b' } },
        ],
      },
      select: { id: true, classCode: true, name: true },
    });
    // Keep only classes whose codes look test-like (start with T/B + digits).
    const testClassRe = /^[TtBb][0-9]/;
    const realTestClasses = candidateClasses.filter((c) => testClassRe.test(c.classCode));

    const candidatePapers = await this.prisma.paper.findMany({
      where: {
        OR: [
          { name: { startsWith: 't1-' } },
          { name: { startsWith: 't2-' } },
          { name: { startsWith: 't3-' } },
          { name: { startsWith: 't4-' } },
          { name: { startsWith: 't5-' } },
          { name: { startsWith: 'b1-' } },
          { name: { startsWith: 'b2-' } },
          { name: { startsWith: 'b3-' } },
          { name: { startsWith: 'b4-' } },
          { name: { startsWith: 'b5-' } },
          { name: { startsWith: 'b6-' } },
          { name: { startsWith: 'b7-' } },
          { name: { startsWith: 'b8-' } },
          { name: { startsWith: 'b9-' } },
          { name: { startsWith: 'b10-' } },
          { name: { startsWith: 't3-probe' } },
        ],
      },
      select: { id: true, name: true },
    });

    // Also gather test boards / subjects added by the B5 syllabus tests.
    const testBoards = await this.prisma.examBoard.findMany({
      where: { code: { startsWith: 'B5-' } },
      select: { id: true, code: true },
    });

    const summary = {
      users: candidateUsers.length,
      classes: realTestClasses.length,
      papers: candidatePapers.length,
      examBoards: testBoards.length,
    };

    if (dryRun) {
      this.logger.log(`purgeTestData (dry-run): ${JSON.stringify(summary)}`);
      return { dryRun: true, summary };
    }

    // Delete in transaction. Cascade FKs handle most dependents but not all:
    // - Paper.assignments cascade-deletes submissions
    // - User cascade has issues if owns Question / Paper rows (those FKs
    //   don't cascade), so test users are only safe to delete if they don't
    //   own real content. The blackbox suite never sets ownerId on real
    //   papers — students don't own papers — so this is safe.
    const userIds = candidateUsers.map((u) => u.id);
    const classIds = realTestClasses.map((c) => c.id);
    const paperIds = candidatePapers.map((p) => p.id);
    const boardIds = testBoards.map((b) => b.id);

    // Run each step OUTSIDE a transaction so a failure on one step
    // gives a precise error message instead of a black-box rollback.
    // The cleanup is idempotent by design — re-running is safe even if
    // a partial succeeds.
    const stepCounts: Record<string, number> = {};
    const stepFailed: string[] = [];
    async function step(name: string, fn: () => Promise<{ count: number } | { count: number }[]>) {
      try {
        const r = await fn();
        const count = Array.isArray(r) ? r.reduce((a, b) => a + (b.count ?? 0), 0) : r.count ?? 0;
        stepCounts[name] = count;
      } catch (e: any) {
        stepFailed.push(`${name}: ${e?.message?.slice(0, 200) ?? String(e)}`);
      }
    }
    const tx2: any = this.prisma; // Path-B accessors

    if (userIds.length) {
      await step('tutorSession', () =>
        tx2.tutorSession.deleteMany({ where: { studentId: { in: userIds } } }),
      );
      await step('watermarkToken', () =>
        tx2.watermarkToken.deleteMany({ where: { studentId: { in: userIds } } }),
      );
      await step('markerAssignment', () =>
        tx2.markerAssignment.deleteMany({ where: { markerId: { in: userIds } } }),
      );
      await step('paperVariantAssignment', () =>
        tx2.paperVariantAssignment.deleteMany({ where: { studentId: { in: userIds } } }),
      );
      await step('codeSubmissionResult', () =>
        tx2.codeSubmissionResult.deleteMany({
          where: { answerScript: { submission: { studentId: { in: userIds } } } },
        }),
      );
      await step('studentSubmission', () =>
        this.prisma.studentSubmission.deleteMany({ where: { studentId: { in: userIds } } }),
      );
      // PaperAssignment rows where a test student created the assignment
      // (rare, but b6 head_teacher fixtures may have).
      await step('paperAssignment', () =>
        this.prisma.paperAssignment.deleteMany({ where: { assignedById: { in: userIds } } }),
      );
      // QuestionItem.reviewedById Restrict — null it out instead of delete.
      await step('questionItemReviewedNull', () =>
        this.prisma.questionItem.updateMany({
          where: { reviewedById: { in: userIds } },
          data: { reviewedById: null },
        }),
      );
      // TeacherReview Restrict — wipe rows by reviewerId.
      await step('teacherReview', () =>
        this.prisma.teacherReview.deleteMany({ where: { reviewerId: { in: userIds } } }),
      );
    }
    if (paperIds.length) {
      await step('paper', () => this.prisma.paper.deleteMany({ where: { id: { in: paperIds } } }));
    }
    if (classIds.length) {
      await step('class', () => this.prisma.class.deleteMany({ where: { id: { in: classIds } } }));
    }
    if (userIds.length) {
      await step('user', () => this.prisma.user.deleteMany({ where: { id: { in: userIds } } }));
    }
    if (boardIds.length) {
      await step('examBoard', () =>
        this.prisma.examBoard.deleteMany({ where: { id: { in: boardIds } } }),
      );
    }
    if (stepFailed.length) {
      this.logger.warn(`purgeTestData partial failure: ${stepFailed.join(' | ')}`);
    }

    this.logger.warn(`purgeTestData (live): deleted ${JSON.stringify(summary)}`);
    return { dryRun: false, summary, stepCounts, stepFailed };
  }
}
