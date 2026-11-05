import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { dateOnly, singaporeDate } from '../common/school-calendar';
import { readingSentenceAudio, sentenceHash } from '../audio/sentence-audio';
import { assignedReadingFor } from './level-timeline';
import { keepSchoolSafeContexts, keepSchoolSafeTexts } from './school-safe-sentences';
import { isSchoolBlockedHeadword } from './school-safe-words';
import { collocationsBackedByApproved } from './content-review';
import { contextForEncounter, type ContextCandidate } from './context-progression';
import { recallExpected } from './recall-spelling';
import { MEMORY_KINDS, unresolvedVocabularyMistake } from './mastery';

export type ExtraDrill = 'type' | 'ladder' | 'shadow';
export interface ExtraStep { step: number; prompt: string; answer: string; translation: string }
export interface ExtraItem { senseId?: string; textHash?: string; headword?: string; translation?: string;
  text?: string; audioUrl?: string; steps: ExtraStep[] }
type ExtraSense = { id: string; qualityStatus: string; translation: string; lexeme: { headword: string };
  collocations: unknown; contexts: ContextCandidate[];
  items: { contextId: string | null; completedAt: Date | null; context?: ContextCandidate | null }[] };

// Small, browser-independent content builder; never generates language content.
export function buildExtraWord(sense: ExtraSense, drill: 'type' | 'ladder'): ExtraItem | null {
  const headword = sense.lexeme.headword;
  if (!sense.items.length || sense.qualityStatus !== 'ready' || isSchoolBlockedHeadword(headword) || !keepSchoolSafeTexts([headword]).length
    || !recallExpected({ headword }) || !sense.translation.trim() || !keepSchoolSafeTexts([sense.translation]).length) return null;
  const encountered = sense.items[0].context;
  const contexts = [...new Map([...(encountered ? [encountered] : []), ...sense.contexts].map(c => [c.id, c])).values()];
  const safe = keepSchoolSafeContexts(contexts.filter(c => c.qualityStatus === 'ready' && c.sentence.trim() && c.translation.trim()));
  const steps: ExtraStep[] = [{ step: 1, prompt: sense.translation, answer: headword, translation: sense.translation }];
  if (drill === 'ladder') {
    const short = safe.filter(c => c.sentence.trim().split(/\s+/).length <= 14);
    const seen = short.find(c => c.id === sense.items[0].contextId);
    const sentence = seen ?? contextForEncounter(short, 1, 5, headword);
    const collocations = Array.isArray(sense.collocations) ? sense.collocations.filter((s): s is string => typeof s === 'string') : [];
    const phrase = keepSchoolSafeTexts(collocationsBackedByApproved(collocations, safe)).find(p => maskExtraWord(p, headword) !== null);
    if (phrase) steps.push({ step: 2, prompt: maskExtraWord(phrase, headword)!, answer: headword, translation: sense.translation });
    if (sentence) steps.push({ step: 3, prompt: sentence.translation, answer: sentence.sentence, translation: sentence.translation });
  }
  return { senseId: sense.id, headword, translation: sense.translation, steps };
}

export function maskExtraWord(phrase: string, word: string): string | null {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^a-z])(${escaped})(?=$|[^a-z])`, 'i');
  return pattern.test(phrase) ? phrase.replace(pattern, '$1____') : null;
}

const roundClaims = z.object({ v: z.literal(1), id: z.string().uuid(), student: z.string(), drill: z.enum(['type', 'ladder', 'shadow']),
  items: z.array(z.object({ id: z.string(), steps: z.array(z.number().int()) })).max(10) });
export const extraResultSchema = z.object({ roundId: z.string().uuid(), roundToken: z.string().max(12000),
  drill: z.enum(['type', 'ladder', 'shadow']), senseId: z.string().min(1).max(80).optional(),
  textHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), step: z.number().int().min(1).max(3).default(1),
  attempt: z.enum(['first', 'retry']), retryN: z.number().int().min(1).max(10000).optional(),
  isCorrect: z.boolean().nullable(), hinted: z.boolean(), timeBucket: z.enum(['fast', 'normal', 'slow']),
}).strict().superRefine((r, ctx) => {
  if ((r.drill === 'shadow' ? (!r.textHash || r.senseId || r.isCorrect !== null) : (!r.senseId || r.textHash || r.isCorrect === null))
    || (r.attempt === 'retry' ? !r.retryN : r.retryN !== undefined)) ctx.addIssue({ code: 'custom', message: 'invalid_result' });
});
export type ExtraResult = z.input<typeof extraResultSchema>;

@Injectable()
export class ExtraPracticeService {
  // Reuse the deployment secret for multi-process/restart-safe offline replays.
  // Without one, fail securely on old rounds after a development restart.
  private readonly secret = process.env.EXTRA_PRACTICE_SECRET || process.env.JWT_SECRET || randomBytes(32).toString('hex');
  constructor(private readonly prisma: PrismaService) {}
  enabled() { return process.env.EXTRA_PRACTICE_FEATURE?.trim().toLowerCase() !== 'off'; }
  assertEnabled() { if (!this.enabled()) throw new NotFoundException(); }
  private sign(payload: string) { return createHmac('sha256', this.secret).update(`extra-practice:v1:${payload}`).digest('base64url'); }

  async round(studentId: string, drill: ExtraDrill, now = new Date()) {
    this.assertEnabled();
    const items = drill === 'shadow' ? await this.shadowItems(studentId, now) : await this.wordItems(studentId, drill, now);
    const roundId = randomUUID();
    const payload = Buffer.from(JSON.stringify({ v: 1, id: roundId, student: this.sign(`student:${studentId}`), drill,
      items: items.map(i => ({ id: i.senseId ?? i.textHash, steps: i.steps.map(s => s.step) })) })).toString('base64url');
    return { roundId, roundToken: `${payload}.${this.sign(payload)}`, drill, items };
  }

  private async wordItems(studentId: string, drill: 'type' | 'ladder', now: Date): Promise<ExtraItem[]> {
    const learned = { status: 'completed', session: { studentId, sessionType: 'daily_learning' } };
    const where = { studentId, sense: { qualityStatus: 'ready', items: { some: learned } } };
    const include = { sense: { include: { lexeme: true,
      contexts: { where: { qualityStatus: 'ready' }, orderBy: { position: 'asc' as const }, take: 20 },
      items: { where: learned, orderBy: { completedAt: 'desc' as const }, take: 1,
        select: { contextId: true, completedAt: true, context: true } } } } };
    const [due, recent] = await Promise.all([
      this.prisma.studentVocabularySense.findMany({ where: { ...where, due: { lte: new Date(now.getTime() + 7 * 86400_000) } }, include,
        orderBy: [{ due: 'asc' }, { senseId: 'asc' }], take: 60 }),
      this.prisma.vocabularyV2SessionItem.findMany({ where: { ...learned, sense: { qualityStatus: 'ready' } }, include,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], distinct: ['senseId'], take: 60 }),
    ]);
    const result: ExtraItem[] = []; const seen = new Set<string>();
    for (const row of [...due, ...recent]) {
      if (seen.has(row.senseId)) continue; seen.add(row.senseId);
      const item = buildExtraWord(row.sense, drill); if (!item) continue;
      const [history, mistake] = await Promise.all([
        this.prisma.learningEvidence.findMany({ where: { studentId, senseId: row.senseId, subject: 'vocab_sense', kind: { in: [...MEMORY_KINDS] } },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 201 }),
        this.prisma.mistakeEntry.findFirst({ where: { studentId, resolved: false, vocabWord: { equals: row.sense.lexeme.headword, mode: 'insensitive' } }, select: { id: true } }),
      ]);
      // A truncated history cannot prove an old error cleared. Skip conservatively.
      if (mistake || history.length >= 201 || unresolvedVocabularyMistake(history)) continue;
      result.push(item); if (result.length === 10) break;
    }
    return result;
  }

  private async shadowItems(studentId: string, now: Date): Promise<ExtraItem[]> {
    const todayKey = singaporeDate(now);
    const [user, memberships, changes] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: studentId }, select: { englishLevel: true } }),
      this.prisma.classEnrollment.findMany({ where: { userId: studentId, role: 'student', class: { archivedAt: null } }, take: 20 }),
      this.prisma.studentLevelChange.findMany({ where: { studentId }, orderBy: { changedAt: 'desc' }, take: 501 }),
    ]);
    if (changes.length === 501) return [];
    const assignments = await this.prisma.paperAssignment.findMany({ where: { classId: { in: memberships.map(m => m.classId) },
      morningQuizSession: { date: { lte: dateOnly(todayKey) }, status: { in: ['active', 'locked'] } } },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }], take: 100,
      include: { morningQuizSession: true, submissions: { where: { studentId, status: { not: 'practice' } }, take: 1,
        select: { id: true, status: true, finalSubmittedAt: true, submitSource: true } } } });
    const assigned = assignedReadingFor({ todayKey, currentLevel: user?.englishLevel ?? null, changes,
      joinedAtByClass: new Map(memberships.map(m => [m.classId, m.joinedAt])),
      rows: assignments.filter(a => a.morningQuizSession).map(a => ({ assignmentId: a.id, classId: a.classId, title: null,
        session: a.morningQuizSession!, submission: a.submissions[0] ? { ...a.submissions[0], scripts: 0 } : null })) });
    const latest = assigned.sort((a, b) => b.date.localeCompare(a.date)
      || assignments.find(r => r.id === b.assignmentId)!.assignedAt.getTime() - assignments.find(r => r.id === a.assignmentId)!.assignedAt.getTime())[0];
    if (!latest) return [];
    const assignment = assignments.find(a => a.id === latest.assignmentId)!;
    const questions = await this.prisma.paperQuestion.findMany({ where: { paperId: assignment.paperId }, orderBy: { sortOrder: 'asc' }, take: 100,
      select: { snapshotContent: true } });
    const passages = questions.flatMap(q => { const p = (q.snapshotContent as { passage?: unknown })?.passage;
      return typeof p === 'string' && p.length <= 50000 ? [p] : []; });
    const bounded: string[] = []; let length = 0;
    for (const passage of new Set(passages)) {
      if (bounded.length === 8 || length + passage.length > 100000) break;
      bounded.push(passage); length += passage.length;
    }
    const audio = await readingSentenceAudio(bounded, this.prisma);
    const distinct = new Map(audio.flatMap(p => p.paragraphs.flat()).filter(s => s.audioUrl)
      .map(s => [sentenceHash(s.text), s]));
    return [...distinct].sort(([, a], [, b]) => {
      const aw = a.text.split(/\s+/).length, bw = b.text.split(/\s+/).length;
      return Number(aw > 20) - Number(bw > 20) || aw - bw;
    }).slice(0, 5).map(([textHash, s]) => ({ textHash, text: s.text, audioUrl: s.audioUrl!,
      steps: [{ step: 1, prompt: s.text, answer: s.text, translation: '' }] }));
  }

  async result(studentId: string, input: ExtraResult, now = new Date()) {
    this.assertEnabled();
    const parsed = extraResultSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: 'invalid_extra_result' });
    const r = parsed.data;
    const [payload, signature, extra] = r.roundToken.split('.');
    const expected = this.sign(payload ?? '');
    if (extra || !signature || !/^[A-Za-z0-9_-]{43}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new BadRequestException({ code: 'invalid_extra_round' });
    }
    let raw: unknown;
    try { raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw new BadRequestException({ code: 'invalid_extra_round' }); }
    const claims = roundClaims.safeParse(raw);
    const itemId = r.senseId ?? r.textHash!;
    if (!claims.success || claims.data.id !== r.roundId || claims.data.student !== this.sign(`student:${studentId}`) || claims.data.drill !== r.drill
      || !claims.data.items.some(i => i.id === itemId && i.steps.includes(r.step))) throw new BadRequestException({ code: 'invalid_extra_round' });
    const sourceKey = `extra:${studentId}:${r.roundId}:${r.drill}:${itemId}:${r.step}:${r.attempt === 'first' ? 'first' : `retry${r.retryN}`}`;
    // Atomic unique insert: first arrival wins, including concurrent/reordered replays.
    await this.prisma.learningEvidence.createMany({ data: [{ studentId, sourceKey,
      kind: r.attempt === 'first' ? 'practice_first' : 'practice_retry', subject: r.drill === 'shadow' ? 'reading_sentence' : 'vocab_sense',
      senseId: r.senseId ?? null, isCorrect: r.isCorrect, hinted: r.hinted, schoolDate: dateOnly(singaporeDate(now)), occurredAt: now,
      detail: { drill: r.drill, step: r.step, timeBucket: r.timeBucket, roundId: r.roundId,
        roundItemCount: claims.data.items.length, itemSteps: claims.data.items.find(i => i.id === itemId)!.steps,
        ...(r.textHash ? { textHash: r.textHash } : {}) },
    }], skipDuplicates: true });
    return { ok: true as const };
  }
}
