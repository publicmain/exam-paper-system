import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { dateOnly, singaporeDate } from '../common/school-calendar';
import { MEMORY_KINDS, unresolvedVocabularyMistake } from '../vocab-v2/mastery';
import { cleanMarkerComment, cleanStem, humanizeAnswer, translateAnswerLetter } from './mistake-humanize';
import { freezeRedo, gradeRedo, normalizeRedoAnswer, readingRedoState, redoOptions, redoReferenceSourceKey, redoSnapshot, redoSourceKey } from './reading-redo';

export type MistakeReasonKey = 'repeated_tasktype' | 'vocabulary' | 'long_answer';
export const sgtDayOf = singaporeDate;

export function extractVocabWord(stem: string): string {
  const s = stem ?? '';
  const asksAboutWord =
    (/\bwhat does\b/i.test(s) && /\b(suggest|mean|means|imply|convey)\b/i.test(s)) ||
    /\bthe word\s*['‘’"“”]/i.test(s);
  if (!asksAboutWord) return '';
  const m = s.match(/['‘’"“”]([A-Za-z][A-Za-z'’-]{1,30})['‘’"“”]/);
  return m ? m[1].toLowerCase() : '';
}

/** Collect every nonblank answer below full marks; the legacy enum is a category only. */
export function shouldCollect(s: { studentAnswer: string; awarded: number; maxMarks: number; stem: string }, _repeatCount = 0): MistakeReasonKey | null {
  if (!s.studentAnswer.trim() || s.awarded >= s.maxMarks) return null;
  return extractVocabWord(s.stem) ? 'vocabulary' : s.maxMarks >= 2 ? 'long_answer' : 'repeated_tasktype';
}

export function nextPracticeState(prev: { createdAt: Date; correctStreak?: number; lastPracticedAt?: Date | null }, correct: boolean, now: Date, hinted = false) {
  const resolved = correct && !hinted && singaporeDate(now) > singaporeDate(prev.createdAt);
  return { correctStreak: correct ? 1 : 0, resolved };
}

export function practiceKindOf(taskType: string, passage: string): {
  kind: 'tfng' | 'letters' | 'reveal';
  options: string[];
} {
  if (taskType === 'true_false_not_given') return { kind: 'tfng', options: ['TRUE', 'FALSE', 'NOT GIVEN'] };
  if (taskType === 'yes_no_not_given') return { kind: 'tfng', options: ['YES', 'NO', 'NOT GIVEN'] };
  // 只有段落匹配（答案=段落字母）能从原文推选项。matching_headings 的
  // 答案是标题编号（i–x），跟段落字母不是一套体系，走 snapshotOptions
  // 或翻卡兜底。
  if (taskType === 'matching_information') {
    const letters = [...new Set([...passage.matchAll(/Paragraph\s+([A-Z])\b/g)].map((m) => m[1]))];
    if (letters.length >= 3) return { kind: 'letters', options: letters.sort() };
  }
  return { kind: 'reveal', options: [] };
}

export interface RedoInput { date: string; answer: string; hinted?: boolean; selfCorrect?: boolean }

@Injectable()
export class MistakeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Call inside the submit transaction to freeze question and grades together. */
  async collectFromSubmission(submissionId: string, quizDay: string): Promise<{ added: number }> {
    const sub = await this.prisma.studentSubmission.findUnique({ where: { id: submissionId }, select: {
      id: true, studentId: true, finalSubmittedAt: true,
      scripts: { select: { paperQuestionId: true, textAnswer: true, selectedOption: true, awardedMarks: true, markerComment: true,
        paperQuestion: { select: { marks: true, snapshotContent: true, overrideContent: true, snapshotAnswer: true, overrideAnswer: true, snapshotOptions: true,
          question: { select: { questionType: true } } } } } },
    } });
    if (!sub?.finalSubmittedAt) return { added: 0 };
    let added = 0;
    for (const sc of sub.scripts) {
      if (sc.awardedMarks == null) continue;
      const content = (sc.paperQuestion.overrideContent ?? sc.paperQuestion.snapshotContent) as any;
      const answer = sc.paperQuestion.overrideAnswer ?? sc.paperQuestion.snapshotAnswer;
      const studentAnswer = (sc.selectedOption?.trim() || sc.textAnswer?.trim() || '');
      const stem = String(content?.stem ?? '');
      const maxMarks = Number(sc.paperQuestion.marks);
      const reason = shouldCollect({ studentAnswer, awarded: sc.awardedMarks, maxMarks, stem });
      if (!reason) continue;
      const snapshot = freezeRedo(content, sc.paperQuestion.snapshotOptions, answer, sc.paperQuestion.question.questionType);
      const inserted = await this.prisma.mistakeEntry.createMany({ data: [{ studentId: sub.studentId, submissionId: sub.id,
        paperQuestionId: sc.paperQuestionId, taskType: snapshot.taskType, passageTitle: snapshot.passageTitle,
        stem: cleanStem(stem) || stem, studentAnswer, correctAnswer: this.reference(snapshot), markerComment: sc.markerComment ?? '',
        awarded: sc.awardedMarks, maxMarks, vocabWord: extractVocabWord(stem), reason, quizDay, redoSnapshot: snapshot,
      }], skipDuplicates: true });
      added += inserted.count;
    }
    return { added };
  }

  private reference(snapshot: NonNullable<ReturnType<typeof redoSnapshot>>) {
    if (snapshot.questionType === 'mcq') {
      const accepted = snapshot.gradingContent.acceptedKeys ?? snapshot.gradingContent.acceptableOptionKeys ?? snapshot.gradingContent.acceptOptions;
      return Array.isArray(accepted) && accepted.length ? accepted.join(' / ')
        : String(snapshot.options.find((o: any) => o.correct)?.key ?? snapshot.gradingContent.correctOption ?? snapshot.gradingContent.correctAnswer ?? snapshot.answer.text ?? '');
    }
    return String(snapshot.answer.text ?? '');
  }

  private feedback(entry: { redoSnapshot: unknown; correctAnswer: string; markerComment: string; maxMarks: number }) {
    const snapshot = redoSnapshot(entry.redoSnapshot);
    const correctAnswer = snapshot ? this.reference(snapshot) : entry.correctAnswer;
    const { points, model } = humanizeAnswer(correctAnswer);
    return { correctAnswer: translateAnswerLetter(snapshot?.taskType ?? '', correctAnswer), answerPoints: points, answerModel: model,
      markerComment: cleanMarkerComment(entry.markerComment, entry.maxMarks),
      explanation: String(snapshot?.answer.explanation ?? ''), evidence: String(snapshot?.answer.evidence ?? '') };
  }

  async listForStudent(studentId: string, opts?: { includeResolved?: boolean; limit?: number }) {
    const rows = await this.prisma.mistakeEntry.findMany({ where: { studentId, ...(opts?.includeResolved ? {} : { resolved: false }) }, orderBy: [{ quizDay: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }] });
    const vocabulary = await this.vocabularyMistakes(studentId);
    return { total: rows.filter((r) => !r.resolved).length,
      byTaskType: [...new Set(rows.filter((r) => !r.resolved).map((r) => r.taskType))].map((taskType) => ({ taskType, count: rows.filter((r) => !r.resolved && r.taskType === taskType).length })),
      entries: rows.map((r) => {
        const snapshot = redoSnapshot(r.redoSnapshot);
        return { id: r.id, submissionId: r.submissionId, paperQuestionId: r.paperQuestionId, taskType: r.taskType, passageTitle: r.passageTitle,
          quizDay: r.quizDay, stem: cleanStem(snapshot?.stem ?? r.stem) || r.stem, studentAnswer: r.studentAnswer,
          awarded: r.awarded, maxMarks: r.maxMarks, reason: r.reason, resolved: r.resolved, resolvedAt: r.resolvedAt,
          practiceCount: r.practiceCount, correctStreak: r.correctStreak, lastPracticedAt: r.lastPracticedAt, createdAt: r.createdAt,
          passage: snapshot?.passage ?? '', options: snapshot ? redoOptions(snapshot) : [], legacy: !snapshot,
          ...this.feedback(r) };
      }), vocabulary };
  }

  /** Read-only; exactly the 2A unresolved-error predicate, with no scheduling. */
  private async vocabularyMistakes(studentId: string) {
    const rows = await this.prisma.learningEvidence.findMany({ where: { studentId, subject: 'vocab_sense', kind: { in: [...MEMORY_KINDS] } } });
    const groups = new Map<string, typeof rows>();
    for (const row of rows) if (row.senseId) groups.set(row.senseId, [...(groups.get(row.senseId) ?? []), row]);
    const wrong = [...groups].flatMap(([senseId, history]) => {
      const date = unresolvedVocabularyMistake(history);
      const formalWrong = history.some((e) => e.kind === 'formal_first' && e.isCorrect === false && e.schoolDate.toISOString().slice(0, 10) >= (date ?? ''));
      return date && formalWrong ? [{ senseId, date }] : [];
    });
    const senses = wrong.length ? await this.prisma.vocabularySense.findMany({ where: { id: { in: wrong.map((r) => r.senseId) } }, include: { lexeme: true } }) : [];
    return wrong.map((r) => ({ ...r, headword: senses.find((s) => s.id === r.senseId)?.lexeme.headword ?? '',
      meaning: senses.find((s) => s.id === r.senseId)?.translation ?? '' })).filter((r) => r.headword).sort((a, b) => b.date.localeCompare(a.date) || a.headword.localeCompare(b.headword));
  }

  dailyState(studentId: string, now = new Date()) { return readingRedoState(this.prisma, studentId, now); }

  private async readingSubmitted(studentId: string, date: string, prisma: Pick<PrismaService, 'studentSubmission'> = this.prisma) {
    return !!await prisma.studentSubmission.findFirst({ where: { studentId, finalSubmittedAt: { not: null },
      assignment: { morningQuizSession: { date: dateOnly(date) } } }, select: { id: true } });
  }

  async practiceQueue(studentId: string, _limit = 3) {
    const state = await this.dailyState(studentId);
    const unlocked = state.target === 0 || await this.readingSubmitted(studentId, state.date);
    const pending = unlocked ? state.entries.filter((r) => !state.completedIds.has(r.id)) : [];
    const referenceKeys = pending.filter((r) => !redoSnapshot(r.redoSnapshot)!.objective).map((r) => redoReferenceSourceKey(studentId, r.id, state.date));
    const frozen = referenceKeys.length ? await this.prisma.learningEvidence.findMany({ where: {
      studentId, subject: 'reading_question', kind: 'practice_first', schoolDate: dateOnly(state.date), sourceKey: { in: referenceKeys },
    } }) : [];
    return { date: state.date, target: state.target, progress: state.progress, remaining: state.target - state.progress, unlocked,
      items: pending.map((r) => {
        const snapshot = redoSnapshot(r.redoSnapshot)!;
        const reference = !snapshot.objective ? frozen.find((e) => e.sourceKey === redoReferenceSourceKey(studentId, r.id, state.date)) : undefined;
        return { id: r.id, taskType: snapshot.taskType, passageTitle: snapshot.passageTitle, quizDay: r.quizDay, stem: snapshot.stem,
          passage: snapshot.passage, options: redoOptions(snapshot), practiceKind: snapshot.objective ? 'objective' as const : 'self_check' as const,
          ...(reference ? { reference: { ...this.feedback(r), frozenAnswer: (reference.detail as { answer: string }).answer } } : {}) };
      }) };
  }

  async referenceAnswer(studentId: string, id: string, answer: string, date: string) {
    const normalized = normalizeRedoAnswer(answer);
    if (!normalized) throw new BadRequestException({ code: 'answer_required' });
    return this.prisma.$transaction(async (tx) => {
      // Same lock as submission, so a reference can never race a self-check into clearing a rewritten answer.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${studentId} FOR UPDATE`;
      const now = new Date();
      if (date !== singaporeDate(now)) throw new ConflictException({ code: 'redo_date_changed' });
      const entry = await tx.mistakeEntry.findFirst({ where: { id, studentId } });
      const snapshot = redoSnapshot(entry?.redoSnapshot);
      if (!entry || !snapshot || !entry.paperQuestionId || !await this.readingSubmitted(studentId, date, tx)) throw new ConflictException({ code: 'redo_unavailable' });
      if (snapshot.objective) throw new BadRequestException({ code: 'objective_requires_answer' });
      const sourceKey = redoReferenceSourceKey(studentId, id, date);
      let frozen = await tx.learningEvidence.findUnique({ where: { sourceKey } });
      if (!frozen) {
        const state = await readingRedoState(tx, studentId, now);
        const correctionToday = singaporeDate(entry.createdAt) === date;
        if (entry.resolved || (!state.entries.some((r) => r.id === id) && !correctionToday)) throw new ConflictException({ code: 'redo_unavailable' });
        await tx.learningEvidence.createMany({ data: [{ studentId, kind: 'practice_first', subject: 'reading_question',
          paperQuestionId: entry.paperQuestionId, sourceKey, isCorrect: null, hinted: false,
          schoolDate: dateOnly(date), occurredAt: now, detail: { mistakeId: id, answer: normalized },
        }], skipDuplicates: true });
        frozen = await tx.learningEvidence.findUnique({ where: { sourceKey } });
      }
      return { ...this.feedback(entry), frozenAnswer: (frozen!.detail as { answer: string }).answer };
    });
  }

  async practiceResult(studentId: string, id: string, input: RedoInput) {
    if (!input.answer.trim()) throw new BadRequestException({ code: 'answer_required' });
    const now = new Date();
    const sourceKey = redoSourceKey(studentId, id, input.date);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${studentId} FOR UPDATE`;
      const previous = await tx.learningEvidence.findUnique({ where: { sourceKey } });
      const replay = async (record: NonNullable<typeof previous>) => {
        const entry = await tx.mistakeEntry.findFirst({ where: { id, studentId } });
        if (!entry) throw new NotFoundException({ code: 'mistake_not_found' });
        const detail = record.detail as any;
        return { ok: true as const, correct: record.isCorrect === true, resolved: detail.resolved === true,
          correctStreak: detail.correctStreak as number, ...this.feedback(entry) };
      };
      if (previous) return replay(previous);
      if (input.date !== singaporeDate(now)) throw new ConflictException({ code: 'redo_date_changed' });
      const entry = await tx.mistakeEntry.findFirst({ where: { id, studentId } });
      if (!entry) throw new NotFoundException({ code: 'mistake_not_found' });
      const snapshot = redoSnapshot(entry.redoSnapshot);
      if (!snapshot || !entry.paperQuestionId) throw new ConflictException({ code: 'legacy_read_only' });
      const state = await readingRedoState(tx, studentId, now);
      const correctionToday = singaporeDate(entry.createdAt) === input.date;
      if ((!state.entries.some((r) => r.id === id) && !correctionToday) || entry.resolved || !await this.readingSubmitted(studentId, input.date, tx)) throw new ConflictException({ code: 'redo_unavailable' });
      if (snapshot.objective && input.selfCorrect !== undefined || !snapshot.objective && input.selfCorrect === undefined) throw new BadRequestException({ code: 'invalid_self_check' });
      let hinted = input.hinted === true;
      if (!snapshot.objective) {
        const frozen = await tx.learningEvidence.findUnique({ where: { sourceKey: redoReferenceSourceKey(studentId, id, input.date) } });
        if (!frozen) throw new BadRequestException({ code: 'reference_required' });
        if (normalizeRedoAnswer(input.answer) !== (frozen.detail as { answer: string }).answer) hinted = true;
      }
      const correct = snapshot.objective ? gradeRedo(snapshot, input.answer) : input.selfCorrect!;
      const next = nextPracticeState(entry, correct, now, hinted);
      const inserted = await tx.learningEvidence.createMany({ data: [{ studentId, kind: 'mistake_redo', subject: 'reading_question',
        paperQuestionId: entry.paperQuestionId, sourceKey, isCorrect: correct, hinted,
        schoolDate: dateOnly(input.date), occurredAt: now,
        detail: { mistakeId: id, answer: input.answer, selfChecked: !snapshot.objective, ...next },
      }], skipDuplicates: true });
      if (!inserted.count) return replay((await tx.learningEvidence.findUnique({ where: { sourceKey } }))!);
      await tx.mistakeEntry.update({ where: { id }, data: { practiceCount: { increment: 1 }, correctStreak: next.correctStreak,
        lastPracticedAt: now, ...(next.resolved ? { resolved: true, resolvedAt: now } : {}) } });
      const after = await readingRedoState(tx, studentId, now);
      await tx.dailyLessonCompletion.updateMany({ where: { studentId, date: dateOnly(input.date) }, data: {
        drillTarget: after.target, drillProgress: after.progress,
        ...(after.progress === after.target ? { drillDoneAt: now } : {}),
      } });
      return { ok: true as const, correct, ...next, ...this.feedback(entry) };
    });
  }

  /** Compatibility endpoint cannot erase a mistake by self-report. */
  async resolve(_studentId: string, _id: string, _resolved: boolean): Promise<never> {
    throw new BadRequestException({ code: 'redo_required' });
  }
}
