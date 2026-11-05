import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, DictationSheetRow } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { canActOnClass } from '../common/roles';
import { dateOnly, isTeachingDay, nextDate, singaporeDate, validDate } from '../common/school-calendar';
import { buildWordsPrint, learnedWords } from './print-model';

type Actor = { id: string; role: string; ip?: string | null };
export type Entry = { requestId: string; status: 'entered' | 'absent'; wrongSenseIds: string[] };
const key = (studentId: string, date: string) => `v2:${studentId}:${date}:daily`;
export const frozenIds = (value: unknown): string[] => Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];

@Injectable()
export class DictationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async access(actor: Actor, classId: string) {
    if (!await canActOnClass(this.prisma, actor, classId)) throw new ForbiddenException({ code: 'class_forbidden' });
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true } });
    if (!cls) throw new NotFoundException({ code: 'class_not_found' });
    return cls;
  }

  private async dates(classId: string, learnedDate?: string, heldOn = singaporeDate(new Date())) {
    if (!validDate(heldOn) || heldOn > singaporeDate(new Date())) throw new BadRequestException({ code: 'invalid_date' });
    const closed = await this.prisma.classNoSchoolDay.findMany({ where: { classId, date: { lte: dateOnly(heldOn) } }, select: { date: true } });
    const off = new Set(closed.map((r) => r.date.toISOString().slice(0, 10)));
    if (!learnedDate) {
      learnedDate = nextDate(heldOn, -1);
      while (!isTeachingDay(learnedDate, off.has(learnedDate))) learnedDate = nextDate(learnedDate, -1);
    }
    if (!validDate(learnedDate) || learnedDate > heldOn) throw new BadRequestException({ code: 'invalid_date' });
    return { learnedDate, heldOn };
  }

  async get(actor: Actor, classId: string, learnedDate?: string, heldOn?: string) {
    const cls = await this.access(actor, classId);
    const dates = await this.dates(classId, learnedDate, heldOn);
    const sheet = await this.prisma.dictationSheet.findUnique({ where: { classId_learnedDate: { classId, learnedDate: dateOnly(dates.learnedDate) } }, include: { rows: true } });
    if (!sheet) return { className: cls.name, ...dates, sheet: null };
    const ids = sheet.rows.map((r) => r.studentId);
    const [students, daily] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
      this.prisma.vocabularyV2Session.findMany({ where: { sessionKey: { in: ids.map((id) => key(id, dates.learnedDate)) } },
        select: { studentId: true, items: { select: { position: true, senseId: true, contentSnapshot: true } } } }),
    ]);
    const names = new Map(students.map((s) => [s.id, s.name]));
    const words = new Map(daily.map((d) => [d.studentId, buildWordsPrint(d.items)]));
    return { className: cls.name, learnedDate: dates.learnedDate, heldOn: sheet.heldOn.toISOString().slice(0, 10), sheet: {
      id: sheet.id,
      rows: sheet.rows.map((r) => ({ id: r.id, studentId: r.studentId, name: names.get(r.studentId) ?? '学生',
        status: r.status, wrongSenseIds: frozenIds(r.wrongSenseIds), enteredAt: r.enteredAt?.toISOString() ?? null,
        words: frozenIds(r.senseIds).map((senseId) => words.get(r.studentId)?.find((w) => w.senseId === senseId)
          ?? { senseId, headword: '单词内容暂缺', translation: '' }),
      })).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN')),
    } };
  }

  async generate(actor: Actor, classId: string, learnedDate?: string, heldOn?: string) {
    await this.access(actor, classId);
    const dates = await this.dates(classId, learnedDate, heldOn);
    try {
      await this.prisma.$transaction(async (tx) => {
        const where = { classId_learnedDate: { classId, learnedDate: dateOnly(dates.learnedDate) } };
        if (await tx.dictationSheet.findUnique({ where })) return;
        const students = await tx.classEnrollment.findMany({
          where: { classId, role: 'student', user: { isActive: true, archivedAt: null } }, select: { userId: true },
        });
        const daily = await tx.vocabularyV2Session.findMany({
          where: { sessionKey: { in: students.map((s) => key(s.userId, dates.learnedDate)) } },
          select: { studentId: true, items: { select: { position: true, senseId: true, contentSnapshot: true, status: true } } },
        });
        const byStudent = new Map(daily.map((d) => [d.studentId, learnedWords(d.items)]));
        const sheet = await tx.dictationSheet.create({ data: {
          classId, learnedDate: dateOnly(dates.learnedDate), heldOn: dateOnly(dates.heldOn), createdById: actor.id,
          rows: { create: students.map((s) => ({ studentId: s.userId, senseIds: [...new Set((byStudent.get(s.userId) ?? []).map((w) => w.senseId!))] })) },
        } });
        await this.audit.log({ actorId: actor.id, actorRole: actor.role, ip: actor.ip, action: 'dictation.generated',
          entityType: 'DictationSheet', entityId: sheet.id, metadata: dates }, tx);
      });
    } catch (error) {
      // Two generators may both see no sheet. The unique class/date key chooses the winner.
      if ((error as { code?: string }).code !== 'P2002' || !await this.prisma.dictationSheet.findUnique({
        where: { classId_learnedDate: { classId, learnedDate: dateOnly(dates.learnedDate) } },
      })) throw error;
    }
    return this.get(actor, classId, dates.learnedDate, dates.heldOn);
  }

  private async receipt(tx: Prisma.TransactionClient, entityId: string, action: string, requestId: string, signature: string) {
    const logs = await tx.auditLog.findMany({ where: { entityId, action }, select: { metadata: true } });
    const old = logs.map((l) => l.metadata as Record<string, unknown> | null).find((m) => m?.requestId === requestId);
    if (old && old.signature !== signature) throw new ConflictException({ code: 'request_reused' });
    return !!old;
  }

  private async enter(tx: Prisma.TransactionClient, actor: Actor, sheet: { id: string; heldOn: Date }, row: DictationSheetRow, input: Entry) {
    const ids = frozenIds(row.senseIds);
    const wrong = [...new Set(input.wrongSenseIds)].sort();
    if (wrong.some((id) => !ids.includes(id)) || (input.status === 'absent' && wrong.length)) throw new BadRequestException({ code: 'invalid_wrong_words' });
    const signature = JSON.stringify([input.status, wrong]);
    if (await this.receipt(tx, row.id, 'dictation.row_saved', input.requestId, signature)) return;
    // Strictly increasing even if two saves happen in the same millisecond.
    const enteredAt = new Date(Math.max(Date.now(), (row.enteredAt?.getTime() ?? 0) + 1));
    await tx.dictationSheetRow.update({ where: { id: row.id }, data: {
      status: input.status, wrongSenseIds: wrong, enteredById: actor.id, enteredAt,
    } });
    if (ids.length) await tx.learningEvidence.createMany({ data: ids.map((senseId) => ({
      studentId: row.studentId, kind: 'paper_dictation', subject: 'vocab_sense', senseId,
      sourceKey: `paper:${sheet.id}:${row.studentId}:${senseId}:${enteredAt.toISOString()}`,
      isCorrect: input.status === 'absent' ? null : !wrong.includes(senseId), recordedById: actor.id,
      schoolDate: sheet.heldOn, occurredAt: enteredAt,
      detail: { absent: input.status === 'absent', sheetId: sheet.id, rowId: row.id, version: enteredAt.toISOString(),
        supersedesVersion: row.enteredAt?.toISOString() ?? null, requestId: input.requestId },
    })) });
    await this.audit.log({ actorId: actor.id, actorRole: actor.role, ip: actor.ip, action: 'dictation.row_saved',
      entityType: 'DictationSheetRow', entityId: row.id, diff: { before: { status: row.status, wrongSenseIds: row.wrongSenseIds }, after: { status: input.status, wrongSenseIds: wrong } },
      metadata: { requestId: input.requestId, signature, version: enteredAt.toISOString(), sheetId: sheet.id } }, tx);
  }

  async save(actor: Actor, classId: string, sheetId: string, studentId: string | null, input: Entry) {
    await this.access(actor, classId);
    await this.prisma.$transaction(async (tx) => {
      const found = await tx.dictationSheet.findFirst({ where: { id: sheetId, classId } });
      if (!found) throw new NotFoundException({ code: 'dictation_not_found' });
      // A real row UPDATE acquires a PostgreSQL row lock, shared by bulk and individual saves.
      const sheet = await tx.dictationSheet.update({ where: { id: found.id }, data: { updatedAt: new Date() } });
      if (studentId === null) {
        if (await this.receipt(tx, sheet.id, 'dictation.remaining_saved', input.requestId, 'remaining')) return;
        const rows = await tx.dictationSheetRow.findMany({ where: { sheetId, status: 'pending' } });
        for (const row of rows) if (frozenIds(row.senseIds).length) await this.enter(tx, actor, sheet, row, { ...input, status: 'entered', wrongSenseIds: [] });
        await this.audit.log({ actorId: actor.id, actorRole: actor.role, ip: actor.ip, action: 'dictation.remaining_saved', entityType: 'DictationSheet', entityId: sheet.id,
          metadata: { requestId: input.requestId, signature: 'remaining' } }, tx);
      } else {
        const row = await tx.dictationSheetRow.findUnique({ where: { sheetId_studentId: { sheetId, studentId } } });
        if (!row) throw new NotFoundException({ code: 'dictation_row_not_found' });
        await this.enter(tx, actor, sheet, row, input);
      }
    }, { timeout: 15000 });
    const sheet = await this.prisma.dictationSheet.findUniqueOrThrow({ where: { id: sheetId } });
    return this.get(actor, classId, sheet.learnedDate.toISOString().slice(0, 10), sheet.heldOn.toISOString().slice(0, 10));
  }
}
