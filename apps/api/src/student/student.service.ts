import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

interface ActorCtx { id: string; role: string; ip?: string | null }

/**
 * Student-side workflow:
 *   1. Teacher calls POST /api/papers/:paperId/assign with { classId, dueAt? }.
 *      Creates a PaperAssignment.
 *   2. Student GETs /api/student/assignments — list of papers waiting / open / closed.
 *   3. Student POSTs /api/student/submissions { assignmentId } — opens a
 *      StudentSubmission row, status=in_progress.
 *   4. Student PATCHes /api/student/submissions/:id/scripts — autosave answers
 *      while taking the paper. Each PATCH upserts an AnswerScript per question.
 *   5. Student POSTs /api/student/submissions/:id/submit — final submit.
 *      MCQ answers auto-graded immediately; structured items wait for marker.
 *   6. Marker workflow lives in a separate Block 2 epic (spawned task).
 */
@Injectable()
export class StudentService {
  private readonly logger = new Logger('StudentService');
  constructor(private readonly prisma: PrismaService) {}

  /** Teacher creates a PaperAssignment binding a paper to a class. */
  async assignPaperToClass(
    paperId: string,
    body: { classId: string; startAt?: string | null; dueAt?: string | null; durationMin?: number | null },
    actor: ActorCtx,
  ) {
    const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper) throw new NotFoundException('paper not found');
    const cls = await this.prisma.class.findUnique({ where: { id: body.classId } });
    if (!cls) throw new NotFoundException('class not found');
    return this.prisma.paperAssignment.create({
      data: {
        paperId,
        classId: body.classId,
        assignedById: actor.id,
        startAt: body.startAt ? new Date(body.startAt) : null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        durationMin: body.durationMin ?? null,
        status: body.startAt && new Date(body.startAt) > new Date() ? 'scheduled' : 'open',
      },
    });
  }

  /** Lists assignments visible to a given student (only classes they're enrolled in). */
  async listAssignmentsForStudent(studentId: string) {
    const assignments = await this.prisma.paperAssignment.findMany({
      where: { class: { enrollments: { some: { userId: studentId, role: 'student' } } } },
      include: {
        paper: { select: { id: true, name: true, subjectId: true, durationMin: true, totalMarksActual: true } },
        class: { select: { id: true, name: true, classCode: true } },
        submissions: { where: { studentId } },
      },
      orderBy: { assignedAt: 'desc' },
    });
    // Each assignment carries either 0 or 1 submission for this student.
    return assignments.map(a => ({
      ...a,
      mySubmission: a.submissions[0] ?? null,
      submissions: undefined,
    }));
  }

  /** Open or resume a submission for the student. Idempotent: already-existing
   *  submission row is returned as-is. */
  async openSubmission(assignmentId: string, student: ActorCtx) {
    const assignment = await this.prisma.paperAssignment.findUnique({
      where: { id: assignmentId },
      include: { class: { include: { enrollments: { where: { userId: student.id } } } } },
    });
    if (!assignment) throw new NotFoundException('assignment not found');
    const enrolled = assignment.class.enrollments.some(e => e.role === 'student');
    if (!enrolled) throw new ForbiddenException('not enrolled in this class');
    if (assignment.dueAt && assignment.dueAt < new Date()) {
      throw new ForbiddenException('assignment is closed');
    }
    const existing = await this.prisma.studentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
    });
    if (existing) return existing;
    const paper = await this.prisma.paper.findUnique({ where: { id: assignment.paperId } });
    return this.prisma.studentSubmission.create({
      data: {
        assignmentId,
        studentId: student.id,
        maxScore: paper?.totalMarksActual ?? 0,
      },
    });
  }

  /** Save / overwrite a single AnswerScript for a (submission, paperQuestion) pair. */
  async saveScript(
    submissionId: string,
    body: { paperQuestionId: string; selectedOption?: string | null; textAnswer?: string | null },
    student: ActorCtx,
  ) {
    const sub = await this.prisma.studentSubmission.findUnique({ where: { id: submissionId } });
    if (!sub) throw new NotFoundException('submission not found');
    if (sub.studentId !== student.id) throw new ForbiddenException('not your submission');
    if (sub.status !== 'in_progress') {
      throw new BadRequestException(`submission is ${sub.status}; cannot edit`);
    }
    return this.prisma.answerScript.upsert({
      where: { submissionId_paperQuestionId: { submissionId, paperQuestionId: body.paperQuestionId } },
      create: {
        submissionId,
        paperQuestionId: body.paperQuestionId,
        selectedOption: body.selectedOption ?? null,
        textAnswer: body.textAnswer ?? null,
      },
      update: {
        selectedOption: body.selectedOption ?? null,
        textAnswer: body.textAnswer ?? null,
      },
    });
  }

  /** Final submit: locks the submission, auto-grades MCQ, leaves structured
   *  questions for the marker. */
  async finalSubmit(submissionId: string, student: ActorCtx) {
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        scripts: { include: { paperQuestion: { include: { question: { select: { questionType: true, options: true } } } } } },
      },
    });
    if (!sub) throw new NotFoundException('submission not found');
    if (sub.studentId !== student.id) throw new ForbiddenException('not your submission');
    if (sub.status !== 'in_progress') {
      throw new BadRequestException(`submission already ${sub.status}`);
    }

    let autoScore = 0;
    for (const script of sub.scripts) {
      const q = script.paperQuestion.question;
      if (q.questionType !== 'mcq') continue;
      // Auto-grade MCQ: snapshotOptions on PaperQuestion has correct flag
      const opts = (script.paperQuestion.snapshotOptions ?? q.options ?? []) as Array<{ key: string; correct: boolean }>;
      const correctOpt = Array.isArray(opts) ? opts.find(o => o.correct) : null;
      const isCorrect = correctOpt?.key === script.selectedOption;
      const awarded = isCorrect ? script.paperQuestion.marks : 0;
      autoScore += awarded;
      await this.prisma.answerScript.update({
        where: { id: script.id },
        data: { autoCorrect: isCorrect, awardedMarks: awarded },
      });
    }

    return this.prisma.studentSubmission.update({
      where: { id: submissionId },
      data: {
        submittedAt: new Date(),
        status: 'submitted',
        autoScore,
        // manualScore + totalScore stay null until marker fills structured items.
      },
    });
  }

  /** Student fetches their own submission to review answers / marks (when returned). */
  async getOwnSubmission(submissionId: string, student: ActorCtx) {
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: { include: { paper: true, class: true } },
        scripts: { include: { paperQuestion: { include: { question: true } } } },
      },
    });
    if (!sub) throw new NotFoundException('submission not found');
    if (sub.studentId !== student.id) throw new ForbiddenException('not your submission');
    return sub;
  }
}
