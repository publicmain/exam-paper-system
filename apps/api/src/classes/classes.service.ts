import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

interface ActorCtx { id: string; role: string; ip?: string | null }

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.class.findMany({
      orderBy: { name: 'asc' },
      // R10 multi-level: englishLevel was 1:1; now englishLevels is N:1 (a
      // class can register multiple bands at once). The schedule UI needs
      // the full list to render one row per (class, level) pair.
      include: {
        _count: { select: { enrollments: true, assignments: true } },
        englishLevels: { select: { level: true }, orderBy: { level: 'asc' } },
      },
    });
  }

  async get(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      // R10-Bug1 + R10 multi-level: detail modal renders the full set
      // of registered bands so admin can add / remove a band per class.
      include: {
        englishLevels: { select: { id: true, level: true }, orderBy: { level: 'asc' } },
        enrollments: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        assignments: {
          include: { paper: { select: { id: true, name: true, subjectId: true } } },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });
    if (!cls) throw new NotFoundException('class not found');
    return cls;
  }

  async create(data: { name: string; classCode: string }) {
    if (!/^[A-Z0-9_-]{2,40}$/i.test(data.classCode)) {
      throw new BadRequestException('classCode must be 2-40 alphanumeric / dash / underscore');
    }
    return this.prisma.class.create({ data });
  }

  /** F5 — partial update. Today only weeklyFocus is mutable here; other
   *  attributes still flow through the create + roster endpoints. */
  async update(classId: string, data: { weeklyFocus?: string | null }) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('class not found');
    return this.prisma.class.update({
      where: { id: classId },
      data: {
        ...(data.weeklyFocus !== undefined ? { weeklyFocus: data.weeklyFocus } : {}),
      },
    });
  }

  async addEnrollment(classId: string, opts: { userId: string; role?: string }) {
    const role = opts.role ?? 'student';
    if (!['student', 'class_teacher', 'subject_teacher'].includes(role)) {
      throw new BadRequestException(`invalid enrollment role: ${role}`);
    }
    const user = await this.prisma.user.findUnique({ where: { id: opts.userId } });
    if (!user) throw new NotFoundException('user not found');
    return this.prisma.classEnrollment.create({
      data: { classId, userId: opts.userId, role },
    });
  }

  async removeEnrollment(classId: string, userId: string) {
    return this.prisma.classEnrollment.deleteMany({ where: { classId, userId } });
  }

  /** Bulk-create student users by email + name list, then enroll all in
   *  one class. Used by the admin to onboard a roster from CSV without
   *  per-user clicks. Idempotent: already-enrolled users are skipped. */
  async bulkRoster(
    classId: string,
    students: Array<{ email: string; name: string; password?: string }>,
    actor: ActorCtx,
  ) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('class not found');

    const bcrypt = await import('bcryptjs');
    const created: string[] = [];
    const enrolled: string[] = [];
    const skipped: string[] = [];
    for (const s of students) {
      let user = await this.prisma.user.findUnique({ where: { email: s.email } });
      if (!user) {
        const passwordHash = await bcrypt.hash(s.password ?? 'student123', 10);
        user = await this.prisma.user.create({
          data: { email: s.email, name: s.name, role: 'student' as any, passwordHash },
        });
        created.push(user.id);
      }
      const existing = await this.prisma.classEnrollment.findFirst({
        where: { classId, userId: user.id },
      });
      if (existing) {
        skipped.push(user.id);
        continue;
      }
      await this.prisma.classEnrollment.create({
        data: { classId, userId: user.id, role: 'student' },
      });
      enrolled.push(user.id);
    }
    void actor;
    return { createdUsers: created.length, enrolled: enrolled.length, alreadyIn: skipped.length };
  }

  /** List classes the current user belongs to (any role). */
  async myClasses(userId: string) {
    return this.prisma.class.findMany({
      where: { enrollments: { some: { userId } } },
      include: {
        enrollments: { where: { userId }, select: { role: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
