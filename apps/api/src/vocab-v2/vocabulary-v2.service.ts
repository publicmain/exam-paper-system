import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EnglishLevel } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import { RealtimeTranslationService } from '../vocab/realtime-translation.service';
import { LEVEL_WORD_POLICY } from './level-policy';
import {
  OFFICIAL_WORDLIST_META,
  officialList,
  officialListVersion,
  searchOfficialWords,
  type OfficialListName,
  type OfficialWord,
} from './official-wordlists';
import { canonicalPos, senseKey, translationForPos } from './sense-content';
import { normaliseDailyTarget, planDailyTask, type PlannerCandidate, type V2Source } from './daily-planner';
import { contextForEncounter } from './context-progression';
import { initialStageForAction, type LearningCardAction } from './learning-card';
import { answerFormalQuestion, buildFormalQuestion, hideFormalAnswer, type FormalQuestion, type FrozenCard } from './formal-test';
import { answerAdaptiveQuestion, buildAdaptiveQuestion, hideAdaptiveAnswer, type AdaptiveCard, type AdaptiveQuestion } from './adaptive-test';
import { learningAssetQuality } from './content-quality';
import {
  countActuallyLearned,
  pendingDailySessions,
  testableDailyItems,
  unseenCandidates,
} from './unified-vocabulary-rules';

export type CollectionAction = 'learn' | 'known' | 'lookup_only' | 'later';

export interface CollectWordInput {
  headword: string;
  action: CollectionAction;
  contextSentence?: string;
  contextTranslation?: string;
  sourceTitle?: string;
  sourceRef?: string;
  source?: 'reading_lookup' | 'reading_error' | 'search' | 'teacher_list';
}

function exactOfficial(headword: string, level: EnglishLevel | null): OfficialWord | null {
  const found = searchOfficialWords(headword, 10).filter((word) => word.headword === headword);
  if (!found.length) return null;
  const preferred = LEVEL_WORD_POLICY[level ?? 'olevel'].primary;
  return found.find((word) => word.list === preferred) ?? found[0];
}

function sgtDay(now = new Date()) {
  const key = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { key, date: new Date(`${key}T00:00:00.000Z`) };
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

@Injectable()
export class VocabularyV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translator: RealtimeTranslationService,
  ) {}

  sourceMeta() {
    return {
      ...OFFICIAL_WORDLIST_META,
      lists: {
        ngsl: { version: officialListVersion('ngsl'), count: officialList('ngsl').length },
        nawl: { version: officialListVersion('nawl'), count: officialList('nawl').length },
      },
      selection: 'frequency_rank',
      liveAiExamGeneration: false,
    };
  }

  async profile(studentId: string) {
    const row = await this.prisma.studentVocabularyProfile.upsert({
      where: { studentId },
      create: { studentId },
      update: {},
    });
    return { ...row, allowedDailyTargets: [5, 10, 15, 20] };
  }

  async updateProfile(studentId: string, input: { dailyTarget?: number; audioAccent?: 'en-GB' | 'en-US' }) {
    const dailyTarget = input.dailyTarget == null ? undefined : normaliseDailyTarget(input.dailyTarget);
    if (input.dailyTarget != null && dailyTarget !== input.dailyTarget) {
      throw new BadRequestException({ code: 'daily_target_not_allowed', allowed: [5, 10, 15, 20] });
    }
    return this.prisma.studentVocabularyProfile.upsert({
      where: { studentId },
      create: {
        studentId,
        ...(dailyTarget ? { dailyTarget } : {}),
        ...(input.audioAccent ? { audioAccent: input.audioAccent } : {}),
      },
      update: {
        ...(dailyTarget ? { dailyTarget } : {}),
        ...(input.audioAccent ? { audioAccent: input.audioAccent } : {}),
      },
    });
  }

  async publishTeacherAssignment(
    actor: { id: string; role: string },
    input: { classId: string; date: string; title?: string; words: string[] },
  ) {
    if (!(await canActOnClass(this.prisma, actor, input.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new BadRequestException({ code: 'v2_assignment_date_invalid' });
    }
    if (input.words.length !== 12) {
      throw new BadRequestException({ code: 'v2_assignment_requires_12_words', expected: 12 });
    }
    const normalized = input.words.map((word) => word.trim().toLowerCase()).filter(Boolean);
    if (new Set(normalized).size !== 12) {
      throw new BadRequestException({ code: 'v2_assignment_words_must_be_unique' });
    }
    const resolved = [] as Array<Awaited<ReturnType<VocabularyV2Service['ensureOfficialSense']>>>;
    const notFound: string[] = [];
    for (const headword of normalized) {
      const official = exactOfficial(headword, null);
      if (!official) {
        notFound.push(headword);
        continue;
      }
      const row = await this.ensureOfficialSense(official);
      const quality = learningAssetQuality({
        headword: row.lexeme.headword,
        translation: row.sense.translation,
        definition: row.sense.definition,
        contexts: row.sense.contexts,
      });
      if (row.sense.qualityStatus !== 'ready' || !quality.publishable) notFound.push(headword);
      else resolved.push(row);
    }
    if (notFound.length) {
      throw new BadRequestException({ code: 'v2_assignment_words_not_publishable', words: notFound });
    }
    const date = new Date(`${input.date}T00:00:00.000Z`);
    const assignment = await this.prisma.$transaction(async (tx) => {
      const current = await tx.vocabularyV2Assignment.findUnique({
        where: { classId_date: { classId: input.classId, date } },
      });
      const saved = current
        ? await tx.vocabularyV2Assignment.update({
            where: { id: current.id },
            data: {
              title: input.title?.trim() || `${input.date} 词汇`,
              assignedById: actor.id,
              status: 'published',
              version: { increment: 1 },
            },
          })
        : await tx.vocabularyV2Assignment.create({
            data: {
              classId: input.classId,
              date,
              title: input.title?.trim() || `${input.date} 词汇`,
              assignedById: actor.id,
            },
          });
      await tx.vocabularyV2AssignmentItem.deleteMany({ where: { assignmentId: saved.id } });
      await tx.vocabularyV2AssignmentItem.createMany({
        data: resolved.map((row, index) => ({ assignmentId: saved.id, senseId: row.sense.id, position: index + 1 })),
      });
      return tx.vocabularyV2Assignment.findUnique({
        where: { id: saved.id },
        include: { items: { orderBy: { position: 'asc' }, include: { sense: { include: { lexeme: true } } } } },
      });
    });
    return this.assignmentView(assignment!);
  }

  async teacherAssignments(actor: { id: string; role: string }, classId: string, dateFrom?: string, dateTo?: string) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const date: { gte?: Date; lte?: Date } = {};
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) date.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) date.lte = new Date(`${dateTo}T00:00:00.000Z`);
    const rows = await this.prisma.vocabularyV2Assignment.findMany({
      where: { classId, ...(Object.keys(date).length ? { date } : {}) },
      orderBy: { date: 'desc' },
      take: 60,
      include: { items: { orderBy: { position: 'asc' }, include: { sense: { include: { lexeme: true } } } } },
    });
    return { classId, assignments: rows.map((row) => this.assignmentView(row)) };
  }

  async teacherClassProgress(actor: { id: string; role: string }, classId: string, now = new Date()) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const day = sgtDay(now);
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId, role: 'student', user: { archivedAt: null, isActive: true } },
      orderBy: { user: { name: 'asc' } },
      include: { user: { select: { id: true, name: true, englishLevel: true } } },
    });
    const studentIds = enrollments.map((row) => row.userId);
    if (!studentIds.length) return { classId, date: day.key, totals: { students: 0 }, students: [] };

    const [readingAssignments, dailySessions, formalSessions, notebookRows] = await Promise.all([
      this.prisma.paperAssignment.findMany({
        where: { classId, morningQuizSession: { isNot: null } },
        include: {
          morningQuizSession: { select: { date: true, level: true } },
          submissions: {
            where: { studentId: { in: studentIds } },
            select: { studentId: true, finalSubmittedAt: true, status: true, submitSource: true },
          },
        },
      }),
      this.prisma.vocabularyV2Session.findMany({
        where: { studentId: { in: studentIds }, sessionType: 'daily_learning' },
        include: { items: { select: { status: true } } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.vocabularyV2Session.findMany({
        where: { studentId: { in: studentIds }, sessionType: 'formal_test' },
        select: { studentId: true, sessionKey: true, status: true, target: true, cursor: true },
      }),
      this.prisma.studentVocabularySense.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true, inNotebook: true, masteryStage: true, reps: true },
      }),
    ]);

    const formalByKey = new Map(formalSessions.map((row) => [row.sessionKey, row]));
    const rows = enrollments.map(({ user, joinedAt }) => {
      const firstAssignedDay = sgtDay(joinedAt).date;
      const assignedReading = readingAssignments.filter((assignment) =>
        assignment.morningQuizSession &&
        assignment.morningQuizSession.date.getTime() >= firstAssignedDay.getTime() &&
        assignment.morningQuizSession.date.getTime() <= day.date.getTime() &&
        assignment.morningQuizSession.level === user.englishLevel,
      );
      const readingDone = assignedReading.filter((assignment) =>
        assignment.submissions.some((submission) => submission.studentId === user.id && submission.finalSubmittedAt != null && submission.submitSource !== 'system_eod'),
      ).length;
      const awaitingMarking = assignedReading.filter((assignment) =>
        assignment.submissions.some((submission) => submission.studentId === user.id && submission.status === 'submitted'),
      ).length;
      const learning = dailySessions.filter((session) => session.studentId === user.id);
      const completedLearning = learning.filter((session) => session.status === 'completed');
      const pendingTests = completedLearning.filter((session) =>
        formalByKey.get(`${session.sessionKey}:formal`)?.status !== 'submitted',
      );
      const openWords = learning
        .filter((session) => session.status === 'in_progress')
        .reduce((sum, session) => sum + session.items.filter((item) => item.status === 'pending').length, 0);
      const words = notebookRows.filter((row) => row.studentId === user.id);
      const todayLearning = learning.find((session) => session.date.getTime() === day.date.getTime()) ?? null;
      const todayFormal = todayLearning ? formalByKey.get(`${todayLearning.sessionKey}:formal`) : null;
      return {
        studentId: user.id,
        name: user.name,
        englishLevel: user.englishLevel,
        reading: {
          assigned: assignedReading.length,
          completed: readingDone,
          overdue: Math.max(0, assignedReading.length - readingDone),
          awaitingMarking,
          today: assignedReading.some((assignment) => assignment.morningQuizSession?.date.getTime() === day.date.getTime())
            ? assignedReading.some((assignment) => assignment.morningQuizSession?.date.getTime() === day.date.getTime() && assignment.submissions.some((submission) => submission.studentId === user.id && submission.finalSubmittedAt != null && submission.submitSource !== 'system_eod')) ? 'completed' : 'pending'
            : 'none',
        },
        vocabulary: {
          notebookCount: words.filter((word) => word.inNotebook).length,
          totalLearned: countActuallyLearned(words),
          masteredOrRemoved: words.filter((word) => !word.inNotebook || word.masteryStage === 8).length,
          unfinishedWords: openWords,
          completedDailySets: completedLearning.length,
          pendingTests: pendingTests.length,
          pendingTestWords: pendingTests.reduce((sum, session) => sum + session.items.filter((item) => item.status === 'completed').length, 0),
          todayLearning: !todayLearning || todayLearning.items.every((item) => item.status === 'pending') ? 'not_started' : todayLearning.status,
          todayTest: !todayLearning || todayLearning.status !== 'completed' ? 'locked' : todayFormal?.status ?? 'pending',
        },
      };
    });
    return {
      classId,
      date: day.key,
      totals: {
        students: rows.length,
        readingOverdue: rows.reduce((sum, row) => sum + row.reading.overdue, 0),
        unfinishedWords: rows.reduce((sum, row) => sum + row.vocabulary.unfinishedWords, 0),
        pendingTests: rows.reduce((sum, row) => sum + row.vocabulary.pendingTests, 0),
        notebookWords: rows.reduce((sum, row) => sum + row.vocabulary.notebookCount, 0),
      },
      students: rows,
    };
  }

  private assignmentView(row: any) {
    return {
      id: row.id,
      classId: row.classId,
      date: row.date.toISOString().slice(0, 10),
      title: row.title,
      status: row.status,
      version: row.version,
      words: row.items.map((item: any) => ({
        position: item.position,
        senseId: item.senseId,
        headword: item.sense.lexeme.headword,
        pos: item.sense.pos,
        translation: item.sense.translation,
      })),
    };
  }

  async search(studentId: string, query: string, limit = 20) {
    const q = query.trim().toLowerCase();
    if (!q) return { query: q, items: [] };
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const official = searchOfficialWords(q, safeLimit);
    const stored = await this.prisma.vocabularyLexeme.findMany({
      where: { headword: { contains: q, mode: 'insensitive' } },
      take: safeLimit,
      orderBy: [{ rank: 'asc' }, { headword: 'asc' }],
      include: {
        senses: {
          where: { qualityStatus: 'ready' },
          include: { students: { where: { studentId }, select: { masteryStage: true, due: true } } },
        },
      },
    });
    const storedByKey = new Map(stored.map((row) => [`${row.listName}:${row.headword}`, row]));
    return {
      query: q,
      items: official.map((word) => {
        const row = storedByKey.get(`${word.list}:${word.headword}`);
        return {
          ...word,
          listVersion: officialListVersion(word.list),
          senses: row?.senses.map((sense) => ({
            id: sense.id,
            senseKey: sense.senseKey,
            pos: sense.pos,
            definition: sense.definition,
            translation: sense.translation,
            masteryStage: sense.students[0]?.masteryStage ?? null,
            due: sense.students[0]?.due ?? null,
          })) ?? [],
        };
      }),
    };
  }

  async vocabularyCenter(studentId: string, input: {
    q?: string;
    source?: string;
    stage?: string;
    page?: number;
    pageSize?: number;
    article?: string;
    topic?: string;
    list?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const q = input.q?.trim().toLowerCase() || '';
    const page = Math.max(1, Math.floor(input.page || 1));
    const pageSize = Math.max(1, Math.min(100, Math.floor(input.pageSize || 30)));
    const and: any[] = [];
    if (q) and.push({ sense: { lexeme: { headword: { contains: q, mode: 'insensitive' } } } });
    if (input.source) and.push({ events: { some: { source: input.source } } });
    if (input.article) and.push({ events: { some: { sourceTitle: input.article } } });
    if (input.topic) and.push({ sense: { contexts: { some: { topic: input.topic } } } });
    if (input.list) and.push({ sense: { lexeme: { listName: input.list } } });
    const firstSeenAt: { gte?: Date; lte?: Date } = {};
    if (input.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(input.dateFrom)) firstSeenAt.gte = new Date(`${input.dateFrom}T00:00:00.000Z`);
    if (input.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(input.dateTo)) firstSeenAt.lte = new Date(`${input.dateTo}T23:59:59.999Z`);
    const rows = await this.prisma.studentVocabularySense.findMany({
      where: {
        studentId,
        inNotebook: input.stage === 'removed' ? false : true,
        ...(Object.keys(firstSeenAt).length ? { firstSeenAt } : {}),
        ...(input.stage === 'mastered' ? { masteryStage: 8 } : {}),
        ...(input.stage === 'learning' ? { masteryStage: { gte: 2, lt: 8 } } : {}),
        ...(input.stage === 'new' ? { masteryStage: 1 } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: {
        sense: {
          include: {
            lexeme: true,
            contexts: { where: { qualityStatus: 'ready' }, orderBy: [{ difficulty: 'asc' }, { position: 'asc' }] },
            events: { where: { studentId }, orderBy: { createdAt: 'asc' }, take: 1 },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { firstSeenAt: 'desc' }],
    });
    const all = await this.prisma.studentVocabularySense.findMany({
      where: { studentId },
      select: {
        masteryStage: true,
        due: true,
        spellingSkill: true,
        listeningSkill: true,
        speakingSkill: true,
        firstSeenAt: true,
        inNotebook: true,
        reps: true,
      },
      orderBy: { firstSeenAt: 'asc' },
    });
    const active = all.filter((row) => row.inNotebook);
    const growthByDay = new Map<string, number>();
    for (const row of active) {
      const day = row.firstSeenAt.toISOString().slice(0, 10);
      growthByDay.set(day, (growthByDay.get(day) ?? 0) + 1);
    }
    let cumulative = 0;
    const growth = [...growthByDay.entries()].map(([date, added]) => {
      cumulative += added;
      return { date, added, total: cumulative };
    });
    const stats = {
      total: active.length,
      totalLearned: countActuallyLearned(all),
      removed: all.length - active.length,
      new: active.filter((row) => row.masteryStage === 1).length,
      learning: active.filter((row) => row.masteryStage >= 2 && row.masteryStage < 8).length,
      mastered: active.filter((row) => row.masteryStage === 8).length,
    };
    const start = (page - 1) * pageSize;
    return {
      stats,
      growth,
      filters: {
        sources: ['reading_lookup', 'reading_error', 'level_gap', 'search', 'teacher_list'],
        stages: ['new', 'learning', 'mastered', 'removed'],
        articles: [...new Set(rows.map((row) => row.sense.events[0]?.sourceTitle).filter((value): value is string => Boolean(value)))].sort(),
        topics: [...new Set(rows.flatMap((row) => row.sense.contexts.map((context) => context.topic)).filter((value): value is string => Boolean(value)))].sort(),
        lists: [...new Set(rows.map((row) => row.sense.lexeme.listName))].sort(),
      },
      total: rows.length,
      page,
      pageSize,
      items: rows.slice(start, start + pageSize).map((row) => ({
        studentSenseId: row.id,
        senseId: row.senseId,
        headword: row.sense.lexeme.headword,
        phonetic: row.sense.lexeme.phonetic,
        pos: row.sense.pos,
        translation: row.sense.translation,
        definition: row.sense.definition,
        masteryStage: row.masteryStage,
        due: row.due,
        skills: {
          recognition: row.recognition,
          context: row.contextSkill,
          recall: row.recallSkill,
          spelling: row.spellingSkill,
          listening: row.listeningSkill,
          speaking: row.speakingSkill,
          usage: row.usageSkill,
        },
        source: row.sense.events[0]?.source ?? 'level_gap',
        sourceTitle: row.sense.events[0]?.sourceTitle ?? null,
        context: row.sense.contexts[0] ?? null,
        firstSeenAt: row.firstSeenAt,
        inNotebook: row.inNotebook,
      })),
    };
  }

  async startCustomTest(studentId: string, input: {
    count: 5 | 10 | 20 | 'all';
    scope: 'all' | 'week' | 'weak' | 'mastered' | 'spelling' | 'listening';
    sourceTitle?: string;
  }) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const owned = await this.prisma.studentVocabularySense.findMany({
      where: {
        studentId,
        inNotebook: true,
        ...(input.scope === 'week' ? { firstSeenAt: { gte: since } } : {}),
        ...(input.scope === 'weak' ? { OR: [{ masteryStage: { lt: 4 } }, { spellingSkill: { lt: 0.5 } }] } : {}),
        ...(input.scope === 'mastered' ? { masteryStage: 8 } : {}),
        ...(input.scope === 'spelling' ? { spellingSkill: { lt: 0.7 } } : {}),
        ...(input.scope === 'listening' ? { listeningSkill: { lt: 0.7 } } : {}),
        ...(input.sourceTitle ? { sense: { events: { some: { studentId, sourceTitle: input.sourceTitle } } } } : {}),
      },
      include: { sense: { include: { lexeme: true, contexts: { where: { qualityStatus: 'ready' }, orderBy: { difficulty: 'asc' } } } } },
      orderBy: [{ updatedAt: 'desc' }, { firstSeenAt: 'desc' }],
    });
    const limit = input.count === 'all' ? owned.length : input.count;
    // Personal practice must feel fresh but never writes a formal score.  The
    // shuffle is performed after the server has applied ownership filters, so
    // the client can never ask to practise another student's words.
    const shuffled = [...owned];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    const selected = shuffled.slice(0, limit);
    if (!selected.length) throw new BadRequestException({ code: 'v2_custom_test_empty' });
    const cards = selected.map((row) => ({
      ...this.cardSnapshot({ sense: row.sense, owned: row }, 5, row.reps + 1),
      masteryStage: row.masteryStage,
    }) as AdaptiveCard);
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session = await this.prisma.vocabularyV2Session.create({
      data: {
        sessionKey: `v2:${studentId}:custom:${nonce}`,
        studentId,
        date: sgtDay().date,
        sessionType: 'custom_test',
        mode: 'adaptive_coach',
        status: 'in_progress',
        version: `V2-CUSTOM-${nonce}`,
        target: selected.length,
        settingsSnapshot: { ...input, requestedCount: input.count },
        sourceSummary: { selected: selected.length, scope: input.scope },
        items: {
          create: selected.map((row, index) => ({
            senseId: row.senseId,
            position: index + 1,
            source: 'custom_test',
            masteryBefore: row.masteryStage,
            contentVersion: row.sense.contentVersion,
            contentSnapshot: cards[index] as any,
            questionSnapshot: buildAdaptiveQuestion(cards[index], index, cards) as any,
          })),
        },
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return this.testSessionView(session);
  }

  async collect(studentId: string, input: CollectWordInput) {
    const headword = input.headword.trim().toLowerCase().replace(/^[^a-z'-]+|[^a-z'-]+$/g, '');
    if (!headword) throw new BadRequestException({ code: 'headword_required' });
    const user = await this.prisma.user.findUnique({ where: { id: studentId }, select: { englishLevel: true } });
    const published = exactOfficial(headword, user?.englishLevel ?? null);
    const dict = await this.prisma.dictEntry.findUnique({ where: { word: headword } });
    const pos = canonicalPos(published?.pos || dict?.pos);
    const translation = translationForPos(dict?.translation, pos) || await this.translator.translate(headword) || '';
    if (!translation) throw new ServiceUnavailableException({ code: 'translation_unavailable' });

    const listName: OfficialListName | 'personal' = published?.list ?? 'personal';
    const listVersion = published ? officialListVersion(published.list) : '1';
    const lexeme = await this.prisma.vocabularyLexeme.upsert({
      where: { listName_listVersion_headword: { listName, listVersion, headword } },
      create: {
        listName,
        listVersion,
        rank: published?.rank ?? 0,
        headword,
        phonetic: published?.phonetic || dict?.phonetic || null,
        attribution: published ? OFFICIAL_WORDLIST_META.attribution : 'student search / local dictionary',
      },
      update: {
        phonetic: published?.phonetic || dict?.phonetic || null,
      },
    });
    const sense = await this.prisma.vocabularySense.upsert({
      where: { lexemeId_senseKey: { lexemeId: lexeme.id, senseKey: senseKey(pos) } },
      create: {
        lexemeId: lexeme.id,
        senseKey: senseKey(pos),
        pos,
        definition: published?.definition || dict?.definition || '',
        translation,
        qualityStatus: 'ready',
      },
      update: {
        definition: published?.definition || dict?.definition || '',
        translation,
        qualityStatus: 'ready',
      },
    });

    let contextId: string | null = null;
    const sentence = input.contextSentence?.trim();
    if (sentence) {
      const existing = await this.prisma.vocabularyContext.findFirst({ where: { senseId: sense.id, sentence } });
      if (existing) contextId = existing.id;
      else {
        const position = await this.prisma.vocabularyContext.count({ where: { senseId: sense.id, kind: 'article_original' } }) + 1;
        const contextTranslation = input.contextTranslation?.trim() || await this.translator.translate(sentence) || '';
        const context = await this.prisma.vocabularyContext.create({
          data: {
            senseId: sense.id,
            kind: 'article_original',
            position,
            sentence,
            translation: contextTranslation,
            sourceTitle: input.sourceTitle?.trim() || null,
            sourceRef: input.sourceRef?.trim() || null,
            qualityStatus: contextTranslation ? 'ready' : 'needs_translation',
          },
        });
        contextId = context.id;
      }
    }

    let studentSenseId: string | null = null;
    if (input.action === 'learn' || input.action === 'later' || input.action === 'known') {
      const existing = await this.prisma.studentVocabularySense.findUnique({
        where: { studentId_senseId: { studentId, senseId: sense.id } },
      });
      const desiredStage = input.action === 'known' ? 8 : Math.max(existing?.masteryStage ?? 1, 1);
      const owned = await this.prisma.studentVocabularySense.upsert({
        where: { studentId_senseId: { studentId, senseId: sense.id } },
        create: {
          studentId,
          senseId: sense.id,
          masteryStage: desiredStage,
          inNotebook: input.action !== 'known',
          removedAt: input.action === 'known' ? new Date() : null,
          ...(desiredStage === 8 ? { masteredAt: new Date() } : {}),
        },
        update: input.action === 'known'
          ? { masteryStage: 8, masteredAt: new Date(), inNotebook: false, removedAt: new Date() }
          : { inNotebook: true, removedAt: null },
      });
      studentSenseId = owned.id;
    }

    await this.prisma.vocabularyCollectionEvent.create({
      data: {
        studentId,
        senseId: sense.id,
        studentSenseId,
        source: input.source ?? 'reading_lookup',
        action: input.action,
        sourceTitle: input.sourceTitle?.trim() || null,
        sourceRef: input.sourceRef?.trim() || null,
        contextText: sentence || null,
        metadata: contextId ? { contextId } : undefined,
      },
    });

    return {
      ok: true,
      action: input.action,
      added: studentSenseId != null,
      sense: {
        id: sense.id,
        headword,
        senseKey: sense.senseKey,
        pos: sense.pos,
        definition: sense.definition,
        translation: sense.translation,
        phonetic: lexeme.phonetic,
      },
      contextId,
    };
  }

  async setNotebookMembership(studentId: string, senseId: string, inNotebook: boolean) {
    const owned = await this.prisma.studentVocabularySense.findUnique({
      where: { studentId_senseId: { studentId, senseId } },
      include: { sense: { include: { lexeme: true } } },
    });
    if (!owned) throw new BadRequestException({ code: 'v2_word_not_found' });
    const updated = await this.prisma.studentVocabularySense.update({
      where: { id: owned.id },
      data: inNotebook
        ? { inNotebook: true, removedAt: null, masteryStage: Math.min(owned.masteryStage, 7) }
        : { inNotebook: false, removedAt: new Date(), masteryStage: 8, masteredAt: owned.masteredAt ?? new Date() },
    });
    await this.prisma.vocabularyCollectionEvent.create({
      data: {
        studentId,
        senseId,
        studentSenseId: owned.id,
        source: 'student_notebook',
        action: inNotebook ? 'relearn' : 'removed_mastered',
      },
    });
    return {
      ok: true,
      senseId,
      headword: owned.sense.lexeme.headword,
      inNotebook: updated.inNotebook,
      removedAt: updated.removedAt,
    };
  }

  private async ensureOfficialSense(word: OfficialWord) {
    const version = officialListVersion(word.list);
    const existingLexeme = await this.prisma.vocabularyLexeme.findUnique({
      where: { listName_listVersion_headword: { listName: word.list, listVersion: version, headword: word.headword } },
      include: { senses: { include: { contexts: true } } },
    });
    const existingReady = existingLexeme?.senses.find((sense) => sense.qualityStatus === 'ready');
    if (existingLexeme && existingReady) return { lexeme: existingLexeme, sense: existingReady };

    const dict = await this.prisma.dictEntry.findUnique({ where: { word: word.headword } });
    const pos = canonicalPos(word.pos || dict?.pos);
    const translation = translationForPos(dict?.translation, pos) || await this.translator.translate(word.headword) || '';
    const lexeme = await this.prisma.vocabularyLexeme.upsert({
      where: { listName_listVersion_headword: { listName: word.list, listVersion: version, headword: word.headword } },
      create: {
        listName: word.list,
        listVersion: version,
        rank: word.rank,
        headword: word.headword,
        phonetic: word.phonetic || dict?.phonetic || null,
        attribution: OFFICIAL_WORDLIST_META.attribution,
      },
      update: { rank: word.rank, phonetic: word.phonetic || dict?.phonetic || null },
    });
    const sense = await this.prisma.vocabularySense.upsert({
      where: { lexemeId_senseKey: { lexemeId: lexeme.id, senseKey: senseKey(pos) } },
      create: {
        lexemeId: lexeme.id,
        senseKey: senseKey(pos),
        pos,
        definition: word.definition,
        translation,
        qualityStatus: translation ? 'ready' : 'needs_translation',
      },
      update: {
        pos,
        definition: word.definition,
        ...(translation ? { translation, qualityStatus: 'ready' } : {}),
      },
      include: { contexts: true },
    });
    return { lexeme, sense };
  }

  private cardSnapshot(row: any, maximumDifficulty: number, encounter: number) {
    const context = contextForEncounter(row.sense.contexts ?? [], encounter, maximumDifficulty);
    return {
      headword: row.sense.lexeme.headword,
      phonetic: row.sense.lexeme.phonetic,
      pos: row.sense.pos,
      senseKey: row.sense.senseKey,
      translation: row.sense.translation,
      definition: row.sense.definition,
      sentence: context?.sentence ?? null,
      sentenceTranslation: context?.translation ?? null,
      contextKind: context?.kind ?? null,
      collocations: asStrings(row.sense.collocations),
      wordFamily: asStrings(row.sense.wordFamily),
      confusionWords: asStrings(row.sense.confusionWords),
      memoryHint: row.sense.memoryHint ?? null,
      imageUrl: row.sense.imageUrl ?? null,
      audioText: row.sense.lexeme.headword,
      list: row.sense.lexeme.listName,
      rank: row.sense.lexeme.rank,
      attribution: row.sense.lexeme.attribution,
    };
  }

  private taskDay(now: Date, dateKey?: string) {
    const today = sgtDay(now);
    if (!dateKey) return today;
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || dateKey > today.key) {
      throw new BadRequestException({ code: 'bad_task_date' });
    }
    return { key: dateKey, date };
  }

  async dailySession(studentId: string, now = new Date(), dateKey?: string) {
    const day = this.taskDay(now, dateKey);
    const session = await this.prisma.vocabularyV2Session.findUnique({
      where: { sessionKey: `v2:${studentId}:${day.key}:daily` },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return session ? this.sessionView(session) : null;
  }

  async overview(studentId: string, now = new Date()) {
    const day = sgtDay(now);
    const [profile, today, dailySessions, user] = await Promise.all([
      this.profile(studentId),
      this.dailySession(studentId, now),
      this.prisma.vocabularyV2Session.findMany({
        where: {
          studentId,
          sessionType: 'daily_learning',
          date: { lte: day.date },
        },
        orderBy: { date: 'asc' },
        take: 2000,
        include: { items: { orderBy: { position: 'asc' } } },
      }),
      this.prisma.user.findUnique({
        where: { id: studentId },
        select: {
          englishLevel: true,
          classEnrollments: {
            where: { role: 'student', class: { archivedAt: null } },
            select: { classId: true, joinedAt: true },
          },
        },
      }),
    ]);
    const recentDaily = dailySessions.filter((session) => session.status === 'completed');
    const formalKeys = recentDaily.map((session) => `${session.sessionKey}:formal`);
    const formal = formalKeys.length
      ? await this.prisma.vocabularyV2Session.findMany({
          where: { studentId, sessionKey: { in: formalKeys } },
          select: { id: true, sessionKey: true, status: true },
        })
      : [];
    const formalByKey = new Map(formal.map((session) => [session.sessionKey, session]));
    const pendingTests = pendingDailySessions(
      recentDaily,
      new Map(formal.map((session) => [session.sessionKey, session.status])),
    )
      .map((session) => {
        const test = formalByKey.get(`${session.sessionKey}:formal`);
        return {
          dailySessionId: session.id,
          testSessionId: test?.id ?? null,
          date: session.date.toISOString().slice(0, 10),
          total: testableDailyItems(session.items).length,
          status: test?.status ?? 'not_started',
        };
      });
    const learningBacklog = dailySessions
      .filter((session) => session.status === 'in_progress' && session.date.getTime() < day.date.getTime())
      .map((session) => ({
        sessionId: session.id,
        date: session.date.toISOString().slice(0, 10),
        completed: session.items.filter((item) => item.status === 'completed').length,
        target: session.target,
        status: session.items.every((item) => item.status === 'pending') ? 'not_started' : 'in_progress',
      }));
    const activeEnrollments = user?.classEnrollments ?? [];
    const joinedByClass = new Map(activeEnrollments.map((enrollment) => [enrollment.classId, sgtDay(enrollment.joinedAt).date]));
    const readingRows = user?.englishLevel && activeEnrollments.length
      ? await this.prisma.paperAssignment.findMany({
          where: {
            classId: { in: activeEnrollments.map((enrollment) => enrollment.classId) },
            morningQuizSession: {
              is: {
                date: { lt: day.date },
                level: user.englishLevel,
                status: { not: 'cancelled' },
              },
            },
          },
          orderBy: { morningQuizSession: { date: 'asc' } },
          select: {
            id: true,
            classId: true,
            paper: { select: { name: true } },
            morningQuizSession: { select: { id: true, date: true } },
            submissions: {
              where: { studentId, status: { not: 'practice' } },
              select: {
                id: true,
                status: true,
                finalSubmittedAt: true,
                submitSource: true,
                _count: { select: { scripts: true } },
              },
              take: 1,
            },
          },
        })
      : [];
    const readingBacklog = readingRows
      .filter((assignment) => {
        const joinedAt = joinedByClass.get(assignment.classId);
        if (!joinedAt || assignment.morningQuizSession!.date.getTime() < joinedAt.getTime()) return false;
        const submission = assignment.submissions[0];
        return !submission || submission.finalSubmittedAt == null || submission.submitSource === 'system_eod';
      })
      .map((assignment) => {
        const submission = assignment.submissions[0];
        return {
          assignmentId: assignment.id,
          sessionId: assignment.morningQuizSession!.id,
          submissionId: submission?.id ?? null,
          date: assignment.morningQuizSession!.date.toISOString().slice(0, 10),
          title: assignment.paper.name,
          status: submission && submission._count.scripts > 0 ? 'in_progress' : 'not_started',
        };
      });
    return { dailyTarget: profile.dailyTarget, today, readingBacklog, learningBacklog, pendingTests };
  }

  private async teacherAssignmentForStudent(studentId: string, date: Date) {
    return this.prisma.vocabularyV2Assignment.findFirst({
      where: {
        date,
        status: 'published',
        class: { enrollments: { some: { userId: studentId, role: 'student' } } },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { sense: { include: { lexeme: true, contexts: { where: { qualityStatus: 'ready' } } } } },
        },
      },
    });
  }

  private async createTeacherDailySession(
    studentId: string,
    day: { key: string; date: Date },
    sessionKey: string,
    assignment: NonNullable<Awaited<ReturnType<VocabularyV2Service['teacherAssignmentForStudent']>>>,
  ) {
    const rows = assignment.items.map((item) => ({ sense: item.sense, owned: null }));
    const created = await this.prisma.$transaction(async (tx) => {
      for (const item of assignment.items) {
        await tx.studentVocabularySense.upsert({
          where: { studentId_senseId: { studentId, senseId: item.senseId } },
          create: { studentId, senseId: item.senseId, inNotebook: true },
          update: { inNotebook: true, removedAt: null },
        });
      }
      return tx.vocabularyV2Session.create({
        data: {
          sessionKey,
          studentId,
          date: day.date,
          sessionType: 'daily_learning',
          mode: 'teacher_list',
          status: 'in_progress',
          version: `V2-TEACHER-${assignment.id}-${assignment.version}`,
          target: assignment.items.length,
          settingsSnapshot: {
            requestedTarget: assignment.items.length,
            taskMinutes: 8,
            assignmentId: assignment.id,
            assignmentVersion: assignment.version,
            classId: assignment.classId,
            listName: assignment.items[0]?.sense.lexeme.listName ?? 'ngsl',
          },
          sourceSummary: { teacher_list: assignment.items.length },
          items: {
            create: assignment.items.map((item, index) => {
              const context = contextForEncounter(item.sense.contexts, 1, 5);
              return {
                senseId: item.senseId,
                position: index + 1,
                source: 'teacher_list',
                contextId: context?.id ?? null,
                masteryBefore: 1,
                contentVersion: item.sense.contentVersion,
                contentSnapshot: this.cardSnapshot(rows[index], 5, 1),
              };
            }),
          },
        },
        include: { items: { orderBy: { position: 'asc' } } },
      });
    });
    return this.sessionView(created);
  }

  async startDailySession(studentId: string, now = new Date(), dateKey?: string) {
    const day = this.taskDay(now, dateKey);
    const sessionKey = `v2:${studentId}:${day.key}:daily`;
    const existing = await this.prisma.vocabularyV2Session.findUnique({
      where: { sessionKey },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (existing) return this.sessionView(existing);

    const teacherAssignment = await this.teacherAssignmentForStudent(studentId, day.date);
    if (teacherAssignment?.items.length) {
      try {
        return await this.createTeacherDailySession(studentId, day, sessionKey, teacherAssignment);
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        const raced = await this.prisma.vocabularyV2Session.findUnique({
          where: { sessionKey },
          include: { items: { orderBy: { position: 'asc' } } },
        });
        if (!raced) throw error;
        return this.sessionView(raced);
      }
    }

    const [profile, user] = await Promise.all([
      this.profile(studentId),
      this.prisma.user.findUnique({ where: { id: studentId }, select: { englishLevel: true } }),
    ]);
    const policy = LEVEL_WORD_POLICY[user?.englishLevel ?? 'olevel'];
    const listOrder = [policy.primary, policy.fallback].filter((value, index, values): value is OfficialListName => Boolean(value) && values.indexOf(value) === index);
    const listCursors: Array<{ listName: OfficialListName; listVersion: string; startRank: number; exhausted: boolean }> = [];
    const sourceWords: OfficialWord[] = [];
    // Read ahead far enough to step over words the student met through
    // articles/search before the official-list cursor reached them.
    let wanted = profile.dailyTarget * 10;
    for (const [listIndex, listName] of listOrder.entries()) {
      if (wanted <= 0) break;
      const listVersion = officialListVersion(listName);
      const cursor = await this.prisma.studentVocabularyCursor.findUnique({ where: { studentId_listName_listVersion: { studentId, listName, listVersion } } });
      const configuredStart = listIndex === 0 ? policy.startRank : 1;
      const startRank = Math.max(configuredStart, cursor?.nextRank ?? configuredStart);
      const allWords = officialList(listName);
      const selected = allWords.slice(startRank - 1, startRank - 1 + wanted);
      sourceWords.push(...selected);
      listCursors.push({ listName, listVersion, startRank, exhausted: startRank > allWords.length });
      wanted -= selected.length;
    }
    const levelRows = await Promise.all(sourceWords.map((word) => this.ensureOfficialSense(word)));

    const rows = new Map<string, any>();
    const candidates: PlannerCandidate[] = [];
    // A daily push contains new words only.  A sense is globally excluded as
    // soon as the student has ever collected, learned, removed, mastered or
    // replaced it.  Article/search words stay in the notebook and remain
    // available for personal practice, but are never silently recycled as a
    // "new" daily word.
    const previouslySeen = new Set((await this.prisma.studentVocabularySense.findMany({
      where: { studentId, senseId: { in: levelRows.map((row) => row.sense.id) } },
      select: { senseId: true },
    })).map((row) => row.senseId));
    const unseenLevelRows = unseenCandidates(
      levelRows.map((row) => ({ ...row, senseId: row.sense.id })),
      previouslySeen,
    );
    for (const { lexeme, sense } of unseenLevelRows) {
      rows.set(sense.id, { sense: { ...sense, lexeme }, owned: null });
      const asset = learningAssetQuality({ headword: lexeme.headword, translation: sense.translation, definition: sense.definition, contexts: sense.contexts });
      const listPriority = Math.max(0, listOrder.indexOf(lexeme.listName as OfficialListName));
      candidates.push({ senseId: sense.id, source: 'level_gap', quality: sense.qualityStatus === 'ready' && asset.publishable ? 1 : 0.5, rank: listPriority * 1_000_000 + lexeme.rank });
    }

    const plan = planDailyTask(candidates, profile.dailyTarget);
    if (!plan.length) throw new ServiceUnavailableException({ code: 'no_publishable_vocabulary' });
    const sourceSummary = Object.fromEntries(
      (['level_gap'] as V2Source[])
        .map((source) => [source, plan.filter((item) => item.source === source).length]),
    );
    const nextRankByList = new Map<string, number>();
    for (const item of plan.filter((candidate) => candidate.source === 'level_gap')) {
      const row = rows.get(item.senseId);
      if (!row?.sense?.lexeme) continue;
      const listName = String(row.sense.lexeme.listName);
      nextRankByList.set(listName, Math.max(nextRankByList.get(listName) ?? 1, Number(row.sense.lexeme.rank) + 1));
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const session = await tx.vocabularyV2Session.create({
          data: {
            sessionKey,
            studentId,
            date: day.date,
            sessionType: 'daily_learning',
            mode: profile.mode,
            status: 'in_progress',
            version: `V2-${day.key.replace(/-/g, '')}-001`,
            target: plan.length,
            settingsSnapshot: {
              requestedTarget: profile.dailyTarget,
              taskMinutes: profile.taskMinutes,
              audioAccent: profile.audioAccent,
              level: user?.englishLevel ?? 'olevel',
              listName: policy.primary,
              listVersion: officialListVersion(policy.primary),
              listOrder,
            },
            sourceSummary,
            items: {
              create: plan.map((item) => {
                const row = rows.get(item.senseId);
                const mastery = row?.owned?.masteryStage ?? 1;
                return {
                  senseId: item.senseId,
                  position: item.position,
                  source: item.source,
                  contextId: contextForEncounter(row.sense.contexts ?? [], (row?.owned?.reps ?? 0) + 1, policy.contextDifficulty)?.id ?? null,
                  masteryBefore: mastery,
                  contentVersion: row.sense.contentVersion,
                  contentSnapshot: this.cardSnapshot(row, policy.contextDifficulty, (row?.owned?.reps ?? 0) + 1),
                };
              }),
            },
          },
          include: { items: { orderBy: { position: 'asc' } } },
        });
        for (const item of plan) {
          await tx.studentVocabularySense.upsert({
            where: { studentId_senseId: { studentId, senseId: item.senseId } },
            create: { studentId, senseId: item.senseId, inNotebook: true },
            update: { inNotebook: true, removedAt: null },
          });
          await tx.vocabularyCollectionEvent.create({
            data: {
              studentId,
              senseId: item.senseId,
              source: 'level_gap',
              action: 'daily_pushed',
              metadata: { sessionId: session.id, date: day.key },
            },
          });
        }
        for (const cursor of listCursors) {
          const nextRank = nextRankByList.get(cursor.listName) ?? (cursor.exhausted ? officialList(cursor.listName).length + 1 : cursor.startRank);
          await tx.studentVocabularyCursor.upsert({
            where: { studentId_listName_listVersion: { studentId, listName: cursor.listName, listVersion: cursor.listVersion } },
            create: { studentId, listName: cursor.listName, listVersion: cursor.listVersion, nextRank },
            update: { nextRank: { set: nextRank } },
          });
        }
        return session;
      });
      return this.sessionView(created);
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const raced = await this.prisma.vocabularyV2Session.findUnique({
        where: { sessionKey },
        include: { items: { orderBy: { position: 'asc' } } },
      });
      if (!raced) throw error;
      return this.sessionView(raced);
    }
  }

  async actOnLearningItem(studentId: string, sessionId: string, itemId: string, action: LearningCardAction, responseMs?: number) {
    const session = await this.prisma.vocabularyV2Session.findFirst({
      where: { id: sessionId, studentId, sessionType: 'daily_learning' },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!session) throw new BadRequestException({ code: 'v2_session_not_found' });
    if (session.status !== 'in_progress') throw new BadRequestException({ code: 'v2_session_closed' });
    const item = session.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new BadRequestException({ code: 'v2_item_not_found' });
    if (action === 'replace') throw new BadRequestException({ code: 'use_replace_endpoint' });

    const desiredStage = initialStageForAction(action, item.masteryBefore);
    await this.prisma.$transaction(async (tx) => {
      await tx.studentVocabularySense.upsert({
        where: { studentId_senseId: { studentId, senseId: item.senseId } },
        create: {
          studentId,
          senseId: item.senseId,
          masteryStage: desiredStage,
          confidence: action === 'hard' ? 1 : action === 'mastered' ? 4 : 3,
          reps: action === 'skip' ? 0 : 1,
          ...(desiredStage === 8 ? { masteredAt: new Date() } : {}),
        },
        update: {
          masteryStage: desiredStage,
          confidence: action === 'hard' ? 1 : action === 'mastered' ? 4 : 3,
          ...(action === 'skip' ? {} : { reps: { increment: 1 } }),
          ...(desiredStage === 8 ? { masteredAt: new Date() } : {}),
        },
      });
      await tx.vocabularyCollectionEvent.create({
        data: {
          studentId,
          senseId: item.senseId,
          source: item.source,
          action,
          metadata: { sessionId: session.id, itemId: item.id },
        },
      });
      await tx.vocabularyV2SessionItem.update({
        where: { id: item.id },
        data: {
          status: action === 'skip' ? 'skipped' : 'completed',
          response: { action },
          responseMs: responseMs == null ? null : Math.max(0, Math.floor(responseMs)),
          attempts: { increment: 1 },
          completedAt: new Date(),
        },
      });
      const cursor = Math.max(session.cursor, item.position);
      const remaining = session.items.filter((candidate) => candidate.id !== item.id && !['completed', 'skipped'].includes(candidate.status));
      await tx.vocabularyV2Session.update({
        where: { id: session.id },
        data: remaining.length ? { cursor } : { cursor: session.target, status: 'completed', completedAt: new Date() },
      });
    });
    const refreshed = await this.prisma.vocabularyV2Session.findUnique({
      where: { id: session.id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    let generatedTestId: string | null = null;
    if (refreshed?.status === 'completed' && refreshed.items.some((candidate) => candidate.status === 'completed')) {
      const test = await this.startFormalTest(studentId, refreshed.id);
      generatedTestId = test.id;
    }
    return { ...this.sessionView(refreshed!), generatedTestId };
  }

  async replaceDailyItem(studentId: string, sessionId: string, itemId: string) {
    const session = await this.prisma.vocabularyV2Session.findFirst({
      where: { id: sessionId, studentId, sessionType: 'daily_learning', status: 'in_progress' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { sense: { include: { lexeme: true, contexts: true } } },
        },
      },
    });
    if (!session) throw new BadRequestException({ code: 'v2_session_not_found' });
    const item = session.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new BadRequestException({ code: 'v2_item_not_found' });
    if (item.status !== 'pending') throw new BadRequestException({ code: 'v2_item_already_completed' });

    const settings = session.settingsSnapshot as any;
    const listName = (settings?.listName ?? item.sense.lexeme.listName) as OfficialListName;
    if (listName !== 'ngsl' && listName !== 'nawl') {
      throw new BadRequestException({ code: 'v2_replacement_source_unavailable' });
    }
    const listVersion = officialListVersion(listName);
    const policyDifficulty = Number(settings?.level && LEVEL_WORD_POLICY[settings.level as EnglishLevel]?.contextDifficulty) || 3;
    const cursor = await this.prisma.studentVocabularyCursor.findUnique({
      where: { studentId_listName_listVersion: { studentId, listName, listVersion } },
    });
    const startRank = Math.max(cursor?.nextRank ?? 1, 1);
    const inSession = new Set(session.items.map((candidate) => candidate.senseId));
    let replacement: Awaited<ReturnType<VocabularyV2Service['ensureOfficialSense']>> | null = null;
    let replacementWord: OfficialWord | null = null;
    for (const word of officialList(listName).slice(startRank - 1, startRank - 1 + 100)) {
      const ready = await this.ensureOfficialSense(word);
      const asset = learningAssetQuality({
        headword: ready.lexeme.headword,
        translation: ready.sense.translation,
        definition: ready.sense.definition,
        contexts: ready.sense.contexts,
      });
      if (ready.sense.qualityStatus !== 'ready' || !asset.publishable || inSession.has(ready.sense.id)) continue;
      const owned = await this.prisma.studentVocabularySense.findUnique({
        where: { studentId_senseId: { studentId, senseId: ready.sense.id } },
        select: { id: true },
      });
      if (owned) continue;
      replacement = ready;
      replacementWord = word;
      break;
    }
    if (!replacement || !replacementWord) {
      throw new ServiceUnavailableException({ code: 'v2_replacement_exhausted' });
    }
    const replacementRow = { sense: { ...replacement.sense, lexeme: replacement.lexeme }, owned: null };
    const context = contextForEncounter(replacement.sense.contexts ?? [], 1, policyDifficulty);

    await this.prisma.$transaction(async (tx) => {
      await tx.studentVocabularySense.upsert({
        where: { studentId_senseId: { studentId, senseId: item.senseId } },
        create: { studentId, senseId: item.senseId, masteryStage: 8, confidence: 4, masteredAt: new Date(), inNotebook: false, removedAt: new Date() },
        update: { masteryStage: 8, confidence: 4, masteredAt: new Date(), inNotebook: false, removedAt: new Date() },
      });
      await tx.studentVocabularySense.create({
        data: { studentId, senseId: replacement!.sense.id, inNotebook: true },
      });
      await tx.vocabularyCollectionEvent.create({
        data: {
          studentId,
          senseId: item.senseId,
          source: item.source,
          action: 'known_replaced',
          metadata: { sessionId: session.id, itemId: item.id, replacementSenseId: replacement!.sense.id },
        },
      });
      await tx.vocabularyV2SessionItem.update({
        where: { id: item.id },
        data: {
          senseId: replacement!.sense.id,
          source: 'level_gap',
          contextId: context?.id ?? null,
          masteryBefore: 1,
          contentVersion: replacement!.sense.contentVersion,
          contentSnapshot: this.cardSnapshot(replacementRow, policyDifficulty, 1),
          isCorrect: null,
          attempts: 0,
          responseMs: null,
          completedAt: null,
        },
      });
      await tx.studentVocabularyCursor.upsert({
        where: { studentId_listName_listVersion: { studentId, listName, listVersion } },
        create: { studentId, listName, listVersion, nextRank: replacementWord!.rank + 1 },
        update: { nextRank: Math.max(startRank, replacementWord!.rank + 1) },
      });
    });

    const refreshed = await this.prisma.vocabularyV2Session.findUnique({
      where: { id: session.id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return {
      ...this.sessionView(refreshed!),
      replacement: {
        position: item.position,
        oldHeadword: item.sense.lexeme.headword,
        newHeadword: replacement.lexeme.headword,
      },
    };
  }

  async startFormalTest(studentId: string, dailySessionId: string, _now = new Date()) {
    const daily = await this.prisma.vocabularyV2Session.findFirst({
      where: { id: dailySessionId, studentId, sessionType: 'daily_learning', status: 'completed' },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!daily) throw new BadRequestException({ code: 'v2_learning_not_completed' });
    const sessionKey = `${daily.sessionKey}:formal`;
    const existing = await this.prisma.vocabularyV2Session.findUnique({
      where: { sessionKey },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (existing) return this.testSessionView(existing);

    const tested = testableDailyItems(daily.items);
    if (!tested.length) throw new BadRequestException({ code: 'v2_no_testable_items' });
    const cards = tested.map((item) => item.contentSnapshot as unknown as FrozenCard);
    const created = await this.prisma.vocabularyV2Session.create({
      data: {
        sessionKey,
        studentId,
        date: daily.date,
        sessionType: 'formal_test',
        mode: 'teacher_list',
        status: 'in_progress',
        version: `${daily.version}-TEST-001`,
        target: tested.length,
        settingsSnapshot: { dailySessionId: daily.id, questionTypes: ['spelling', 'meaning_choice'] },
        sourceSummary: { dailySessionId: daily.id, frozenItemCount: tested.length },
        items: {
          create: tested.map((item, index) => ({
            senseId: item.senseId,
            position: index + 1,
            source: item.source,
            contextId: item.contextId,
            masteryBefore: item.masteryBefore,
            contentVersion: item.contentVersion,
            contentSnapshot: item.contentSnapshot as any,
            questionSnapshot: buildFormalQuestion(cards[index], index, cards) as any,
          })),
        },
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return this.testSessionView(created);
  }

  async answerTestItem(studentId: string, sessionId: string, itemId: string, response: unknown, responseMs?: number) {
    const session = await this.prisma.vocabularyV2Session.findFirst({
      where: { id: sessionId, studentId, sessionType: { in: ['formal_test', 'retry', 'custom_test'] }, status: 'in_progress' },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!session) throw new BadRequestException({ code: 'v2_test_not_found' });
    const item = session.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new BadRequestException({ code: 'v2_item_not_found' });
    if (item.status === 'answered') return this.testSessionView(session);
    const question = item.questionSnapshot as unknown as AdaptiveQuestion;
    const isCorrect = session.sessionType === 'custom_test'
      ? answerAdaptiveQuestion(question, response)
      : answerFormalQuestion(question as FormalQuestion, response);
    await this.prisma.$transaction(async (tx) => {
      await tx.vocabularyV2SessionItem.update({
        where: { id: item.id },
        data: {
          status: 'answered',
          response: { value: response as any },
          isCorrect,
          attempts: { increment: 1 },
          responseMs: responseMs == null ? null : Math.max(0, Math.floor(responseMs)),
          completedAt: new Date(),
        },
      });
      await tx.vocabularyV2Session.update({
        where: { id: session.id },
        data: { cursor: Math.max(session.cursor, item.position) },
      });
    });
    const refreshed = await this.prisma.vocabularyV2Session.findUnique({
      where: { id: session.id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return this.testSessionView(refreshed!);
  }

  async submitTest(studentId: string, sessionId: string) {
    const session = await this.prisma.vocabularyV2Session.findFirst({
      where: { id: sessionId, studentId, sessionType: { in: ['formal_test', 'retry', 'custom_test'] } },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!session) throw new BadRequestException({ code: 'v2_test_not_found' });
    if (session.status === 'submitted') return this.testSessionView(session);
    const unanswered = session.items.filter((item) => item.status !== 'answered');
    if (unanswered.length) throw new BadRequestException({ code: 'v2_test_incomplete', remaining: unanswered.length });
    // Self-selected practice is deliberately disposable: it has no formal
    // score, no mastery mutation and no follow-up task.  We retain only the
    // short-lived session needed to show the result on the current screen.
    if (session.sessionType === 'custom_test') {
      const submitted = await this.prisma.vocabularyV2Session.update({
        where: { id: session.id },
        data: { status: 'submitted', cursor: session.target, completedAt: new Date() },
        include: { items: { orderBy: { position: 'asc' } } },
      });
      const result = { ...this.testSessionView(submitted), practiceOnly: true, retry: null };
      // 自主抽查不进入成绩、统计或历史记录。先构造当前页面需要的结果，
      // 再删除这份临时会话（items 由外键级联删除）。
      await this.prisma.vocabularyV2Session.delete({ where: { id: session.id } });
      return result;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vocabularyV2Session.update({
        where: { id: session.id },
        data: { status: 'submitted', cursor: session.target, completedAt: new Date() },
      });
      for (const item of session.items) {
        const question = item.questionSnapshot as unknown as AdaptiveQuestion;
        const skillValue = item.isCorrect ? 1 : 0;
        const skill = question.type === 'spelling'
          ? { spellingSkill: skillValue, recallSkill: skillValue }
          : question.type === 'listening_spelling'
            ? { listeningSkill: skillValue, spellingSkill: skillValue }
            : question.type === 'cloze' || question.type === 'collocation'
              ? { contextSkill: skillValue }
              : question.type === 'active_use'
                ? { usageSkill: skillValue }
                : question.type === 'word_family'
                  ? { recallSkill: skillValue }
                  : { recognition: skillValue };
        const nextStage = item.isCorrect
          ? Math.min(8, Math.max(2, item.masteryBefore + 1))
          : Math.max(1, item.masteryBefore - 1);
        await tx.studentVocabularySense.upsert({
          where: { studentId_senseId: { studentId, senseId: item.senseId } },
          create: {
            studentId,
            senseId: item.senseId,
            masteryStage: nextStage,
            inNotebook: true,
            removedAt: null,
            ...skill,
          },
          update: {
            masteryStage: nextStage,
            ...skill,
          },
        });
      }
    });
    const submitted = await this.prisma.vocabularyV2Session.findUnique({
      where: { id: session.id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return {
      ...this.testSessionView(submitted!),
      retry: null,
    };
  }

  async testSession(studentId: string, sessionId: string) {
    const session = await this.prisma.vocabularyV2Session.findFirst({
      where: { id: sessionId, studentId, sessionType: { in: ['formal_test', 'retry', 'custom_test'] } },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!session) throw new BadRequestException({ code: 'v2_test_not_found' });
    return this.testSessionView(session);
  }

  private testSessionView(session: any) {
    const submitted = session.status === 'submitted';
    const answered = session.items.filter((item: any) => item.status === 'answered').length;
    const correct = session.items.filter((item: any) => item.isCorrect === true).length;
    return {
      id: session.id,
      version: session.version,
      date: session.date.toISOString().slice(0, 10),
      type: session.sessionType,
      status: session.status,
      total: session.target,
      answered,
      correct: submitted ? correct : null,
      items: session.items.map((item: any) => {
        const question = item.questionSnapshot as AdaptiveQuestion;
        return {
          id: item.id,
          position: item.position,
          status: item.status,
          question: item.status === 'answered' || submitted
            ? question
            : session.sessionType === 'custom_test'
              ? hideAdaptiveAnswer(question)
              : hideFormalAnswer(question as FormalQuestion),
          response: item.status === 'answered' || submitted ? item.response : null,
          isCorrect: item.status === 'answered' || submitted ? item.isCorrect : null,
          card: item.status === 'answered' || submitted ? item.contentSnapshot : null,
        };
      }),
    };
  }

  private sessionView(session: any) {
    const completed = session.items.filter((item: any) => ['completed', 'skipped'].includes(item.status)).length;
    const learned = session.items.filter((item: any) => item.status === 'completed').length;
    return {
      id: session.id,
      version: session.version,
      date: session.date.toISOString().slice(0, 10),
      type: session.sessionType,
      mode: session.mode,
      status: session.status,
      target: session.target,
      cursor: session.cursor,
      completed,
      learned,
      sourceSummary: session.sourceSummary,
      settings: session.settingsSnapshot,
      deferredUntil: session.deferredUntil?.toISOString().slice(0, 10) ?? null,
      items: session.items.map((item: any) => ({
        id: item.id,
        position: item.position,
        source: item.source,
        masteryBefore: item.masteryBefore,
        status: item.status,
        card: item.contentSnapshot,
      })),
    };
  }
}
