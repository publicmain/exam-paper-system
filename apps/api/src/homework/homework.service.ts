import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth.guard';
import { canActOnClass, isAdminOrHead, isTeacherOrAbove } from '../common/roles';

// Homework files live on the same Railway volume as the past-paper
// archive (RAW_STORAGE_PATH=/data/raw → /data/raw/homework) so no new
// env var or volume mount is needed. Override with HOMEWORK_STORAGE_PATH.
const HOMEWORK_STORE =
  process.env.HOMEWORK_STORAGE_PATH ||
  path.join(process.env.RAW_STORAGE_PATH || os.tmpdir(), 'homework');

/** Shape of a multer memory-storage file without depending on @types/multer. */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const HOMEWORK_FILE_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
// Student photo pages: images, plus PDF for "scanned at home" workflows.
const PAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_PAGES_PER_SUBMISSION = 30;

function writeToStore(subdir: string, mime: string, buf: Buffer): { rel: string; abs: string } {
  const rel = path.join(subdir, `${randomUUID()}.${EXT_BY_MIME[mime]}`);
  const abs = path.join(HOMEWORK_STORE, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
  return { rel, abs };
}

@Injectable()
export class HomeworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  absolutePath(storagePath: string): string {
    // storagePath is stored relative to the store root; refuse traversal.
    const abs = path.resolve(HOMEWORK_STORE, storagePath);
    if (!abs.startsWith(path.resolve(HOMEWORK_STORE))) {
      throw new BadRequestException('bad storage path');
    }
    return abs;
  }

  // ---------- Courses ----------

  async listCourses(includeArchived = false) {
    return this.prisma.course.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { id: true, code: true, name: true, level: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { homeworks: { where: { archivedAt: null } } } },
      },
    });
  }

  async createCourse(user: AuthUser, data: { name: string; subjectId?: string }) {
    if (data.subjectId) {
      const subject = await this.prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject) throw new BadRequestException('subject not found');
    }
    const course = await this.prisma.course.create({
      data: { name: data.name, subjectId: data.subjectId ?? null, createdById: user.id },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'homework.course.create',
      entityType: 'Course',
      entityId: course.id,
      metadata: { name: data.name },
    });
    return course;
  }

  async updateCourse(
    user: AuthUser,
    id: string,
    data: { name?: string; subjectId?: string | null; archived?: boolean },
  ) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('course not found');
    if (course.createdById !== user.id && !isAdminOrHead(user.role)) {
      throw new ForbiddenException('only the course creator or an admin can modify it');
    }
    return this.prisma.course.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.subjectId !== undefined ? { subjectId: data.subjectId } : {}),
        ...(data.archived !== undefined
          ? { archivedAt: data.archived ? new Date() : null }
          : {}),
      },
    });
  }

  // ---------- Homework ----------

  async listHomework(courseId: string) {
    return this.prisma.homework.findMany({
      where: { courseId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        files: { orderBy: { sortOrder: 'asc' } },
        assignments: {
          include: {
            class: { select: { id: true, name: true, classCode: true } },
            _count: { select: { submissions: { where: { status: { not: 'in_progress' } } } } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async getHomework(id: string) {
    const hw = await this.prisma.homework.findUnique({
      where: { id },
      include: {
        course: true,
        files: { orderBy: { sortOrder: 'asc' } },
        questions: { orderBy: { order: 'asc' } },
        assignments: {
          include: { class: { select: { id: true, name: true, classCode: true } } },
        },
      },
    });
    if (!hw || hw.archivedAt) throw new NotFoundException('homework not found');
    return hw;
  }

  async createHomework(
    user: AuthUser,
    data: { courseId: string; title: string; instructions?: string; totalMarks?: number },
  ) {
    const course = await this.prisma.course.findUnique({ where: { id: data.courseId } });
    if (!course || course.archivedAt) throw new BadRequestException('course not found');
    const hw = await this.prisma.homework.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        instructions: data.instructions ?? null,
        totalMarks: data.totalMarks ?? null,
        createdById: user.id,
      },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'homework.create',
      entityType: 'Homework',
      entityId: hw.id,
      metadata: { title: data.title, courseId: data.courseId },
    });
    return hw;
  }

  async updateHomework(
    user: AuthUser,
    id: string,
    data: { title?: string; instructions?: string | null; totalMarks?: number | null; archived?: boolean },
  ) {
    const hw = await this.prisma.homework.findUnique({ where: { id } });
    if (!hw) throw new NotFoundException('homework not found');
    if (hw.createdById !== user.id && !isAdminOrHead(user.role)) {
      throw new ForbiddenException('only the homework creator or an admin can modify it');
    }
    return this.prisma.homework.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.instructions !== undefined ? { instructions: data.instructions } : {}),
        ...(data.totalMarks !== undefined ? { totalMarks: data.totalMarks } : {}),
        ...(data.archived !== undefined
          ? { archivedAt: data.archived ? new Date() : null }
          : {}),
      },
    });
  }

  async addFiles(user: AuthUser, homeworkId: string, files: UploadedFileLike[]) {
    const hw = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
      include: { files: { select: { id: true }, orderBy: { sortOrder: 'desc' }, take: 1 } },
    });
    if (!hw || hw.archivedAt) throw new NotFoundException('homework not found');
    for (const f of files) {
      if (!HOMEWORK_FILE_MIMES.has(f.mimetype)) {
        throw new BadRequestException(`unsupported file type: ${f.mimetype} (PDF/JPG/PNG/WebP only)`);
      }
    }
    const existingCount = await this.prisma.homeworkFile.count({ where: { homeworkId } });
    const created: Awaited<ReturnType<typeof this.prisma.homeworkFile.create>>[] = [];
    for (const [i, f] of files.entries()) {
      const { rel } = writeToStore(path.join('hw', homeworkId), f.mimetype, f.buffer);
      created.push(
        await this.prisma.homeworkFile.create({
          data: {
            homeworkId,
            filename: f.originalname,
            mimeType: f.mimetype,
            sizeBytes: f.size,
            storagePath: rel,
            sortOrder: existingCount + i,
          },
        }),
      );
    }
    return created;
  }

  async deleteFile(user: AuthUser, fileId: string) {
    const file = await this.prisma.homeworkFile.findUnique({
      where: { id: fileId },
      include: { homework: { select: { createdById: true } } },
    });
    if (!file) throw new NotFoundException('file not found');
    if (file.homework.createdById !== user.id && !isAdminOrHead(user.role)) {
      throw new ForbiddenException('only the homework creator or an admin can delete files');
    }
    await this.prisma.homeworkFile.delete({ where: { id: fileId } });
    try {
      fs.unlinkSync(this.absolutePath(file.storagePath));
    } catch {
      /* disk cleanup is best-effort; DB row is the source of truth */
    }
    return { ok: true };
  }

  /** JWT-protected byte serving. Teachers see everything; a student only
   *  files of homework assigned to a class they're enrolled in. */
  async getFileForServing(user: AuthUser, fileId: string) {
    const file = await this.prisma.homeworkFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('file not found');
    if (user.role === 'student') {
      const reachable = await this.prisma.homeworkAssignment.findFirst({
        where: {
          homeworkId: file.homeworkId,
          class: { enrollments: { some: { userId: user.id } } },
        },
        select: { id: true },
      });
      if (!reachable) throw new ForbiddenException('not assigned to you');
    }
    return file;
  }

  // ---------- Assignments ----------

  async assign(
    user: AuthUser,
    homeworkId: string,
    data: { classId: string; startAt?: string; dueAt?: string; allowLate?: boolean },
  ) {
    const hw = await this.prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!hw || hw.archivedAt) throw new NotFoundException('homework not found');
    if (!(await canActOnClass(this.prisma, user, data.classId))) {
      throw new ForbiddenException('not your class');
    }
    const assignment = await this.prisma.homeworkAssignment.upsert({
      where: { homeworkId_classId: { homeworkId, classId: data.classId } },
      create: {
        homeworkId,
        classId: data.classId,
        assignedById: user.id,
        startAt: data.startAt ? new Date(data.startAt) : null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        allowLate: data.allowLate ?? true,
      },
      update: {
        startAt: data.startAt ? new Date(data.startAt) : null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        allowLate: data.allowLate ?? true,
        status: 'open',
      },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'homework.assign',
      entityType: 'HomeworkAssignment',
      entityId: assignment.id,
      metadata: { homeworkId, classId: data.classId, dueAt: data.dueAt ?? null },
    });
    return assignment;
  }

  async updateAssignment(
    user: AuthUser,
    id: string,
    data: { status?: 'open' | 'closed'; dueAt?: string | null; allowLate?: boolean },
  ) {
    const assignment = await this.prisma.homeworkAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('assignment not found');
    if (!(await canActOnClass(this.prisma, user, assignment.classId))) {
      throw new ForbiddenException('not your class');
    }
    return this.prisma.homeworkAssignment.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
        ...(data.allowLate !== undefined ? { allowLate: data.allowLate } : {}),
      },
    });
  }

  /**
   * AI-grading queue: every submitted-but-not-yet-graded submission that has a
   * rubric, with the rubric + answer-page ids. This is the seam the human (or
   * Claude-in-chat) uses to grade off-code: pull the queue, look at the page
   * images, write AI suggestions back via PUT .../ai-grades. No model is called
   * server-side. Admin/head see all; a teacher sees only their classes'.
   */
  async gradingQueue(user: AuthUser, filter: { classId?: string }) {
    let classIdIn: string[] | undefined;
    if (!isAdminOrHead(user.role)) {
      const enr = await this.prisma.classEnrollment.findMany({
        where: { userId: user.id, role: { not: 'student' } },
        select: { classId: true },
      });
      classIdIn = enr.map((e) => e.classId);
      if (filter.classId && !classIdIn.includes(filter.classId)) {
        return { count: 0, submissions: [] };
      }
    }
    const subs = await this.prisma.homeworkSubmission.findMany({
      where: {
        status: 'submitted',
        assignment: {
          ...(filter.classId ? { classId: filter.classId } : {}),
          ...(classIdIn ? { classId: { in: classIdIn } } : {}),
          homework: { questions: { some: {} } },
        },
      },
      orderBy: { submittedAt: 'asc' },
      include: {
        student: { select: { id: true, name: true } },
        pages: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, source: true, mimeType: true },
        },
        grades: { select: { questionId: true, source: true } },
        assignment: {
          include: {
            class: { select: { id: true, name: true } },
            homework: {
              select: {
                id: true,
                title: true,
                course: { select: { name: true } },
                questions: {
                  orderBy: { order: 'asc' },
                  select: { id: true, label: true, maxMarks: true, criteria: true },
                },
              },
            },
          },
        },
      },
    });
    // "needs grading" = fewer grades than rubric questions.
    const pending = subs.filter(
      (s) => s.grades.length < s.assignment.homework.questions.length,
    );
    return {
      count: pending.length,
      submissions: pending.map((s) => ({
        submissionId: s.id,
        student: s.student.name,
        homework: s.assignment.homework.title,
        course: s.assignment.homework.course?.name ?? null,
        class: s.assignment.class.name,
        submittedAt: s.submittedAt,
        questions: s.assignment.homework.questions,
        pages: s.pages.map((p) => ({
          id: p.id,
          source: p.source,
          mimeType: p.mimeType,
          contentPath: `/api/homework-pages/${p.id}/content`,
        })),
        alreadyGraded: s.grades.length,
      })),
    };
  }

  /** 收卷看板: full roster of the class × submission status. */
  async dashboard(user: AuthUser, assignmentId: string) {
    const assignment = await this.prisma.homeworkAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        homework: {
          include: {
            course: true,
            files: { orderBy: { sortOrder: 'asc' } },
            questions: { select: { id: true } },
          },
        },
        class: {
          include: {
            enrollments: {
              where: { role: 'student', user: { archivedAt: null } },
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
        submissions: {
          include: {
            _count: { select: { pages: true } },
            grades: { select: { source: true, awardedMarks: true } },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException('assignment not found');
    if (!(await canActOnClass(this.prisma, user, assignment.classId))) {
      throw new ForbiddenException('not your class');
    }
    const questionCount = assignment.homework.questions.length;
    const byStudent = new Map(assignment.submissions.map((s) => [s.studentId, s]));
    const roster = assignment.class.enrollments
      .map((e) => {
        const sub = byStudent.get(e.user.id);
        const teacherGraded =
          sub?.grades.filter((g) => g.source === 'teacher' && g.awardedMarks != null).length ?? 0;
        const aiPending = sub?.grades.filter((g) => g.source === 'ai_suggested').length ?? 0;
        return {
          student: e.user,
          submissionId: sub?.id ?? null,
          status: sub ? sub.status : 'missing',
          isLate: sub?.isLate ?? false,
          submittedAt: sub?.submittedAt ?? null,
          pageCount: sub?._count.pages ?? 0,
          teacherScore: sub?.teacherScore ?? null,
          // Grading progress for the roster badges + bulk publish gating.
          questionCount,
          teacherGraded,
          aiPending,
          readyToPublish:
            sub?.status === 'submitted' && questionCount > 0 && teacherGraded === questionCount,
        };
      })
      .sort((a, b) => a.student.name.localeCompare(b.student.name));
    const { submissions, class: klass, ...rest } = assignment;
    return {
      ...rest,
      class: { id: klass.id, name: klass.name, classCode: klass.classCode },
      roster,
      counts: {
        total: roster.length,
        submitted: roster.filter((r) => r.status === 'submitted' || r.status === 'returned').length,
        inProgress: roster.filter((r) => r.status === 'in_progress').length,
        missing: roster.filter((r) => r.status === 'missing').length,
        late: roster.filter((r) => r.isLate).length,
      },
    };
  }

  /** Teacher views one submission's pages + rubric + existing grades
   *  (the M3 grading console; also serves the M1 viewer when no rubric). */
  async getSubmissionForTeacher(user: AuthUser, submissionId: string) {
    const sub = await this.prisma.homeworkSubmission.findUnique({
      where: { id: submissionId },
      include: {
        pages: { orderBy: { sortOrder: 'asc' } },
        grades: true,
        student: { select: { id: true, name: true, email: true } },
        assignment: {
          include: {
            homework: {
              select: {
                id: true,
                title: true,
                totalMarks: true,
                questions: { orderBy: { order: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('submission not found');
    if (!(await canActOnClass(this.prisma, user, sub.assignment.classId))) {
      throw new ForbiddenException('not your class');
    }
    return sub;
  }

  /** M1 manual return: score + comment, no AI involved. */
  async returnSubmission(
    user: AuthUser,
    submissionId: string,
    data: { teacherScore?: number; teacherComment?: string },
  ) {
    const sub = await this.prisma.homeworkSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: { select: { classId: true } } },
    });
    if (!sub) throw new NotFoundException('submission not found');
    if (sub.status === 'in_progress') {
      throw new BadRequestException('student has not submitted yet');
    }
    if (!(await canActOnClass(this.prisma, user, sub.assignment.classId))) {
      throw new ForbiddenException('not your class');
    }
    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'returned',
        returnedAt: new Date(),
        ...(data.teacherScore !== undefined ? { teacherScore: data.teacherScore } : {}),
        ...(data.teacherComment !== undefined ? { teacherComment: data.teacherComment } : {}),
      },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'homework.submission.return',
      entityType: 'HomeworkSubmission',
      entityId: submissionId,
      metadata: { teacherScore: data.teacherScore ?? null },
    });
    return updated;
  }

  // ---------- M3: rubric + per-question grading ----------

  private async assertHomeworkOwner(user: AuthUser, homeworkId: string) {
    const hw = await this.prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!hw) throw new NotFoundException('homework not found');
    if (hw.createdById !== user.id && !isAdminOrHead(user.role)) {
      throw new ForbiddenException('only the homework creator or an admin can edit its rubric');
    }
    return hw;
  }

  /** Replace the whole rubric for a homework. Editing is blocked once any
   *  submission has been graded, to keep awarded marks meaningful. */
  async setRubric(
    user: AuthUser,
    homeworkId: string,
    questions: { id?: string; label: string; maxMarks: number; criteria?: string }[],
  ) {
    await this.assertHomeworkOwner(user, homeworkId);
    const graded = await this.prisma.homeworkGrade.count({
      where: { question: { homeworkId } },
    });
    if (graded > 0) {
      throw new BadRequestException('rubric is locked — some submissions are already graded');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.homeworkQuestion.deleteMany({ where: { homeworkId } });
      for (const [i, q] of questions.entries()) {
        await tx.homeworkQuestion.create({
          data: {
            homeworkId,
            order: i,
            label: q.label,
            maxMarks: q.maxMarks,
            criteria: q.criteria ?? null,
          },
        });
      }
      return tx.homeworkQuestion.findMany({ where: { homeworkId }, orderBy: { order: 'asc' } });
    });
  }

  private async gradableSubmission(user: AuthUser, submissionId: string, requireTeacher = true) {
    const sub = await this.prisma.homeworkSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: { include: { homework: { include: { questions: true } } } },
      },
    });
    if (!sub) throw new NotFoundException('submission not found');
    if (sub.status === 'in_progress') throw new BadRequestException('student has not submitted yet');
    if (requireTeacher && !(await canActOnClass(this.prisma, user, sub.assignment.classId))) {
      throw new ForbiddenException('not your class');
    }
    return sub;
  }

  /** Teacher saves per-question marks (source='teacher', final). */
  async saveGrades(
    user: AuthUser,
    submissionId: string,
    grades: { questionId: string; awardedMarks: number | null; comment?: string }[],
  ) {
    const sub = await this.gradableSubmission(user, submissionId);
    const validIds = new Set(sub.assignment.homework.questions.map((q) => q.id));
    const maxByQ = new Map(sub.assignment.homework.questions.map((q) => [q.id, q.maxMarks]));
    for (const g of grades) {
      if (!validIds.has(g.questionId)) throw new BadRequestException('unknown question');
      if (g.awardedMarks != null) {
        const max = maxByQ.get(g.questionId)!;
        if (g.awardedMarks < 0 || g.awardedMarks > max) {
          throw new BadRequestException(`marks out of range for a question (0–${max})`);
        }
      }
    }
    await this.prisma.$transaction(
      grades.map((g) =>
        this.prisma.homeworkGrade.upsert({
          where: { submissionId_questionId: { submissionId, questionId: g.questionId } },
          create: {
            submissionId,
            questionId: g.questionId,
            awardedMarks: g.awardedMarks,
            comment: g.comment ?? null,
            source: 'teacher',
            gradedById: user.id,
          },
          update: {
            awardedMarks: g.awardedMarks,
            comment: g.comment ?? null,
            source: 'teacher',
            gradedById: user.id,
          },
        }),
      ),
    );
    return this.getSubmissionForTeacher(user, submissionId);
  }

  /**
   * Write AI-suggested per-question grades (source='ai_suggested'). This is the
   * iron-rule-compliant seam: the CODE never calls a model — suggestions are
   * written here by whatever produced them (a future backend, or Claude-in-chat
   * reading the flattened answer image). Never publishes; the teacher still
   * confirms each into a 'teacher' grade. Won't overwrite a teacher grade.
   */
  async saveAiSuggestions(
    user: AuthUser,
    submissionId: string,
    grades: { questionId: string; awardedMarks: number | null; confidence?: number; rationale?: string; comment?: string }[],
  ) {
    const sub = await this.gradableSubmission(user, submissionId);
    if (!isTeacherOrAbove(user.role)) throw new ForbiddenException('teachers only');
    const validIds = new Set(sub.assignment.homework.questions.map((q) => q.id));
    for (const g of grades) {
      if (!validIds.has(g.questionId)) throw new BadRequestException('unknown question');
    }
    const existing = await this.prisma.homeworkGrade.findMany({ where: { submissionId } });
    const teacherOwned = new Set(existing.filter((e) => e.source === 'teacher').map((e) => e.questionId));
    const toWrite = grades.filter((g) => !teacherOwned.has(g.questionId));
    await this.prisma.$transaction(
      toWrite.map((g) =>
        this.prisma.homeworkGrade.upsert({
          where: { submissionId_questionId: { submissionId, questionId: g.questionId } },
          create: {
            submissionId,
            questionId: g.questionId,
            awardedMarks: g.awardedMarks,
            comment: g.comment ?? null,
            source: 'ai_suggested',
            confidence: g.confidence ?? null,
            rationale: g.rationale ?? null,
          },
          update: {
            awardedMarks: g.awardedMarks,
            comment: g.comment ?? null,
            source: 'ai_suggested',
            confidence: g.confidence ?? null,
            rationale: g.rationale ?? null,
          },
        }),
      ),
    );
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'homework.ai_suggest',
      entityType: 'HomeworkSubmission',
      entityId: submissionId,
      metadata: { count: toWrite.length, skippedTeacherOwned: grades.length - toWrite.length },
    });
    return this.getSubmissionForTeacher(user, submissionId);
  }

  /** Publish per-question grades to the student. Requires every rubric
   *  question to have a teacher-confirmed mark (AI suggestions must be
   *  reviewed first). Sums to teacherScore + returns. */
  async publishGrades(user: AuthUser, submissionId: string, teacherComment?: string) {
    const sub = await this.gradableSubmission(user, submissionId);
    const questions = sub.assignment.homework.questions;
    if (questions.length === 0) throw new BadRequestException('this homework has no rubric');
    const grades = await this.prisma.homeworkGrade.findMany({ where: { submissionId } });
    const byQ = new Map(grades.map((g) => [g.questionId, g]));
    for (const q of questions) {
      const g = byQ.get(q.id);
      if (!g || g.awardedMarks == null) {
        throw new BadRequestException(`question "${q.label}" is not graded yet`);
      }
      if (g.source !== 'teacher') {
        throw new BadRequestException(`question "${q.label}" still has an unreviewed AI suggestion`);
      }
    }
    const total = questions.reduce((sum, q) => sum + (byQ.get(q.id)!.awardedMarks ?? 0), 0);
    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'returned',
        returnedAt: new Date(),
        teacherScore: total,
        ...(teacherComment !== undefined ? { teacherComment } : {}),
      },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'homework.grades.publish',
      entityType: 'HomeworkSubmission',
      entityId: submissionId,
      metadata: { total },
    });
    return updated;
  }

  /** Bulk publish: every submitted submission of the assignment whose rubric is
   *  fully teacher-confirmed. Skips (never fails on) the rest, so the teacher
   *  can publish the reviewed half of the class and keep grading. */
  async publishAll(user: AuthUser, assignmentId: string) {
    const assignment = await this.prisma.homeworkAssignment.findUnique({
      where: { id: assignmentId },
      include: { homework: { include: { questions: { select: { id: true } } } } },
    });
    if (!assignment) throw new NotFoundException('assignment not found');
    if (!(await canActOnClass(this.prisma, user, assignment.classId))) {
      throw new ForbiddenException('not your class');
    }
    const qIds = assignment.homework.questions.map((q) => q.id);
    if (qIds.length === 0) throw new BadRequestException('this homework has no rubric');
    const subs = await this.prisma.homeworkSubmission.findMany({
      where: { assignmentId, status: 'submitted' },
      include: { grades: true },
    });
    const published: string[] = [];
    const skipped: { submissionId: string; reason: string }[] = [];
    for (const sub of subs) {
      const byQ = new Map(sub.grades.map((g) => [g.questionId, g]));
      const unconfirmed = qIds.filter((id) => {
        const g = byQ.get(id);
        return !g || g.awardedMarks == null || g.source !== 'teacher';
      });
      if (unconfirmed.length > 0) {
        skipped.push({ submissionId: sub.id, reason: `${unconfirmed.length} question(s) not teacher-confirmed` });
        continue;
      }
      const total = qIds.reduce((s, id) => s + (byQ.get(id)!.awardedMarks ?? 0), 0);
      await this.prisma.homeworkSubmission.update({
        where: { id: sub.id },
        data: { status: 'returned', returnedAt: new Date(), teacherScore: total },
      });
      published.push(sub.id);
    }
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'homework.grades.publish_all',
      entityType: 'HomeworkAssignment',
      entityId: assignmentId,
      metadata: { published: published.length, skipped: skipped.length },
    });
    return { published: published.length, skipped };
  }

  // ---------- Student side ----------

  async listForStudent(user: AuthUser) {
    const assignments = await this.prisma.homeworkAssignment.findMany({
      where: {
        class: { enrollments: { some: { userId: user.id } } },
        homework: { archivedAt: null },
      },
      orderBy: { assignedAt: 'desc' },
      include: {
        homework: {
          select: {
            id: true,
            title: true,
            instructions: true,
            totalMarks: true,
            course: { select: { id: true, name: true } },
          },
        },
        class: { select: { id: true, name: true } },
        submissions: {
          where: { studentId: user.id },
          include: { _count: { select: { pages: true } } },
        },
      },
    });
    const now = new Date();
    return assignments.map((a) => {
      const sub = a.submissions[0] ?? null;
      const { submissions, ...rest } = a;
      return {
        ...rest,
        submission: sub
          ? {
              id: sub.id,
              status: sub.status,
              submittedAt: sub.submittedAt,
              isLate: sub.isLate,
              pageCount: sub._count.pages,
              teacherScore: sub.teacherScore,
              teacherComment: sub.status === 'returned' ? sub.teacherComment : null,
            }
          : null,
        canSubmit: this.canSubmitNow(a, now),
      };
    });
  }

  private canSubmitNow(
    a: { status: string; startAt: Date | null; dueAt: Date | null; allowLate: boolean },
    now: Date,
  ): boolean {
    if (a.status !== 'open') return false;
    if (a.startAt && now < a.startAt) return false;
    if (a.dueAt && now > a.dueAt && !a.allowLate) return false;
    return true;
  }

  private async assertStudentAssignment(user: AuthUser, assignmentId: string) {
    const assignment = await this.prisma.homeworkAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        homework: {
          include: {
            files: { orderBy: { sortOrder: 'asc' } },
            questions: { orderBy: { order: 'asc' } },
            course: true,
          },
        },
      },
    });
    if (!assignment || assignment.homework.archivedAt) {
      throw new NotFoundException('assignment not found');
    }
    const enrolled = await this.prisma.classEnrollment.findUnique({
      where: { classId_userId: { classId: assignment.classId, userId: user.id } },
    });
    if (!enrolled) throw new ForbiddenException('not assigned to you');
    return assignment;
  }

  async studentDetail(user: AuthUser, assignmentId: string) {
    const assignment = await this.assertStudentAssignment(user, assignmentId);
    const sub = await this.prisma.homeworkSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
      include: { pages: { orderBy: { sortOrder: 'asc' } }, grades: true },
    });
    const returned = sub?.status === 'returned';
    return {
      ...assignment,
      submission: sub
        ? {
            ...sub,
            teacherComment: returned ? sub.teacherComment : null,
            // Per-question breakdown only once returned (never leak
            // in-progress teacher/AI marks to the student).
            grades: returned ? sub.grades : [],
          }
        : null,
      canSubmit: this.canSubmitNow(assignment, new Date()),
    };
  }

  async addPages(
    user: AuthUser,
    assignmentId: string,
    files: UploadedFileLike[],
    source: 'upload' | 'ink' = 'upload',
  ) {
    const assignment = await this.assertStudentAssignment(user, assignmentId);
    if (!this.canSubmitNow(assignment, new Date())) {
      throw new BadRequestException('this assignment is closed');
    }
    for (const f of files) {
      if (!PAGE_MIMES.has(f.mimetype)) {
        throw new BadRequestException(`unsupported file type: ${f.mimetype} (JPG/PNG/WebP/PDF only)`);
      }
    }
    // Open-or-resume the submission row (mirrors StudentSubmission flow).
    let sub = await this.prisma.homeworkSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    });
    if (sub && sub.status !== 'in_progress') {
      throw new BadRequestException('already submitted — ask your teacher to reopen it');
    }
    if (!sub) {
      sub = await this.prisma.homeworkSubmission.create({
        data: { assignmentId, studentId: user.id },
      });
    }
    const existing = await this.prisma.homeworkPage.count({ where: { submissionId: sub.id } });
    if (existing + files.length > MAX_PAGES_PER_SUBMISSION) {
      throw new BadRequestException(`too many pages (max ${MAX_PAGES_PER_SUBMISSION})`);
    }
    const created: Awaited<ReturnType<typeof this.prisma.homeworkPage.create>>[] = [];
    for (const [i, f] of files.entries()) {
      const { rel } = writeToStore(path.join('sub', sub.id), f.mimetype, f.buffer);
      created.push(
        await this.prisma.homeworkPage.create({
          data: {
            submissionId: sub.id,
            filename: f.originalname,
            mimeType: f.mimetype,
            sizeBytes: f.size,
            storagePath: rel,
            sortOrder: existing + i,
            source,
          },
        }),
      );
    }
    return { submissionId: sub.id, pages: created };
  }

  private async ownedPage(user: AuthUser, pageId: string) {
    const page = await this.prisma.homeworkPage.findUnique({
      where: { id: pageId },
      include: { submission: { select: { id: true, studentId: true, status: true } } },
    });
    if (!page) throw new NotFoundException('page not found');
    if (page.submission.studentId !== user.id) throw new ForbiddenException('not your page');
    return page;
  }

  async deletePage(user: AuthUser, pageId: string) {
    const page = await this.ownedPage(user, pageId);
    if (page.submission.status !== 'in_progress') {
      throw new BadRequestException('already submitted');
    }
    await this.prisma.homeworkPage.delete({ where: { id: pageId } });
    try {
      fs.unlinkSync(this.absolutePath(page.storagePath));
    } catch {
      /* best-effort */
    }
    return { ok: true };
  }

  async reorderPages(user: AuthUser, assignmentId: string, pageIds: string[]) {
    const sub = await this.prisma.homeworkSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
      include: { pages: { select: { id: true } } },
    });
    if (!sub) throw new NotFoundException('no submission yet');
    if (sub.status !== 'in_progress') throw new BadRequestException('already submitted');
    const owned = new Set(sub.pages.map((p) => p.id));
    if (pageIds.length !== owned.size || pageIds.some((id) => !owned.has(id))) {
      throw new BadRequestException('page list does not match submission');
    }
    await this.prisma.$transaction(
      pageIds.map((id, i) =>
        this.prisma.homeworkPage.update({ where: { id }, data: { sortOrder: i } }),
      ),
    );
    return { ok: true };
  }

  async submit(user: AuthUser, assignmentId: string) {
    const assignment = await this.assertStudentAssignment(user, assignmentId);
    if (!this.canSubmitNow(assignment, new Date())) {
      throw new BadRequestException('this assignment is closed');
    }
    const sub = await this.prisma.homeworkSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
      include: { _count: { select: { pages: true } } },
    });
    if (!sub) throw new BadRequestException('upload at least one page first');
    if (sub.status !== 'in_progress') throw new BadRequestException('already submitted');
    if (sub._count.pages === 0) throw new BadRequestException('upload at least one page first');
    const now = new Date();
    return this.prisma.homeworkSubmission.update({
      where: { id: sub.id },
      data: {
        status: 'submitted',
        submittedAt: now,
        isLate: !!assignment.dueAt && now > assignment.dueAt,
      },
    });
  }

  /** Student withdraws a submission to fix/add pages (Canvas-style resubmit).
   *  Only while: still 'submitted', assignment still open, and NO grading has
   *  started — once a teacher or AI has touched it, withdrawal would silently
   *  invalidate marks, so it's blocked. */
  async withdraw(user: AuthUser, assignmentId: string) {
    const assignment = await this.assertStudentAssignment(user, assignmentId);
    const sub = await this.prisma.homeworkSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
      include: { _count: { select: { grades: true } } },
    });
    if (!sub) throw new NotFoundException('no submission');
    if (sub.status !== 'submitted') {
      throw new BadRequestException(sub.status === 'returned' ? 'already graded and returned' : 'not submitted yet');
    }
    if (sub._count.grades > 0) {
      throw new BadRequestException('grading has already started — ask your teacher to reopen it');
    }
    if (!this.canSubmitNow(assignment, new Date())) {
      throw new BadRequestException('this assignment is closed');
    }
    return this.prisma.homeworkSubmission.update({
      where: { id: sub.id },
      data: { status: 'in_progress', submittedAt: null, isLate: false },
    });
  }

  /** Bytes for a page image: the owning student, or any teacher of the class. */
  async getPageForServing(user: AuthUser, pageId: string) {
    const page = await this.prisma.homeworkPage.findUnique({
      where: { id: pageId },
      include: {
        submission: {
          select: { studentId: true, assignment: { select: { classId: true } } },
        },
      },
    });
    if (!page) throw new NotFoundException('page not found');
    if (page.submission.studentId !== user.id) {
      if (
        user.role === 'student' ||
        !(await canActOnClass(this.prisma, user, page.submission.assignment.classId))
      ) {
        throw new ForbiddenException('not yours');
      }
    }
    return page;
  }

  // ---------- M2: handwriting (ink) drafts ----------

  /** Open-or-resume the submission row for the current student. Used by the
   *  ink flow (which needs a submission id before any HomeworkPage exists). */
  private async openSubmission(user: AuthUser, assignmentId: string) {
    let sub = await this.prisma.homeworkSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    });
    if (sub && sub.status !== 'in_progress') {
      throw new BadRequestException('already submitted — ask your teacher to reopen it');
    }
    if (!sub) {
      sub = await this.prisma.homeworkSubmission.create({
        data: { assignmentId, studentId: user.id },
      });
    }
    return sub;
  }

  async listInk(user: AuthUser, assignmentId: string) {
    await this.assertStudentAssignment(user, assignmentId);
    const sub = await this.prisma.homeworkSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    });
    if (!sub) return { submissionId: null, pages: [] };
    const pages = await this.prisma.homeworkInkPage.findMany({
      where: { submissionId: sub.id },
      orderBy: { sortOrder: 'asc' },
    });
    return { submissionId: sub.id, pages };
  }

  async createInkPage(
    user: AuthUser,
    assignmentId: string,
    data: { width: number; height: number; backgroundFileId?: string },
  ) {
    const assignment = await this.assertStudentAssignment(user, assignmentId);
    if (!this.canSubmitNow(assignment, new Date())) {
      throw new BadRequestException('this assignment is closed');
    }
    if (data.backgroundFileId) {
      // Background must be a file of THIS homework (don't leak other files).
      const ok = assignment.homework.files.some((f) => f.id === data.backgroundFileId);
      if (!ok) throw new BadRequestException('background file not part of this homework');
    }
    const sub = await this.openSubmission(user, assignmentId);
    const count = await this.prisma.homeworkInkPage.count({ where: { submissionId: sub.id } });
    if (count >= MAX_PAGES_PER_SUBMISSION) {
      throw new BadRequestException(`too many handwriting pages (max ${MAX_PAGES_PER_SUBMISSION})`);
    }
    return this.prisma.homeworkInkPage.create({
      data: {
        submissionId: sub.id,
        sortOrder: count,
        width: Math.round(data.width),
        height: Math.round(data.height),
        backgroundFileId: data.backgroundFileId ?? null,
        strokes: [],
      },
    });
  }

  private async ownedInkPage(user: AuthUser, pageId: string) {
    const page = await this.prisma.homeworkInkPage.findUnique({
      where: { id: pageId },
      include: { submission: { select: { studentId: true, status: true } } },
    });
    if (!page) throw new NotFoundException('ink page not found');
    if (page.submission.studentId !== user.id) throw new ForbiddenException('not your page');
    if (page.submission.status !== 'in_progress') {
      throw new BadRequestException('already submitted');
    }
    return page;
  }

  /** Autosave. `strokes` is opaque vector JSON; we cap its serialized size so
   *  a runaway client can't fill the row. */
  async saveInk(user: AuthUser, pageId: string, strokes: unknown) {
    await this.ownedInkPage(user, pageId);
    const size = JSON.stringify(strokes ?? []).length;
    if (size > 2_000_000) throw new BadRequestException('handwriting data too large for one page');
    return this.prisma.homeworkInkPage.update({
      where: { id: pageId },
      data: { strokes: strokes as any },
    });
  }

  async deleteInkPage(user: AuthUser, pageId: string) {
    await this.ownedInkPage(user, pageId);
    await this.prisma.homeworkInkPage.delete({ where: { id: pageId } });
    return { ok: true };
  }
}
