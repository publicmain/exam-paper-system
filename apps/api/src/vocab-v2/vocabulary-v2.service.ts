import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EnglishLevel } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import { RealtimeTranslationService, type TranslationResult } from '../vocab/realtime-translation.service';
import { LEVEL_WORD_POLICY } from './level-policy';
import {
  OFFICIAL_WORDLIST_META,
  officialList,
  officialListVersion,
  searchOfficialWords,
  type OfficialListName,
  type OfficialWord,
} from './official-wordlists';
import { canonicalPos, inferPosFromTranslation, senseKey, translationForPos } from './sense-content';
import { normaliseDailyTarget, planDailyTask, type PlannerCandidate, type V2Source } from './daily-planner';
import { contextForEncounter, isTemplateContext } from './context-progression';
import { initialStageForAction, type LearningCardAction } from './learning-card';
import { answerFormalQuestion, buildFormalQuestion, publicFormalQuestion, type FormalQuestion, type FrozenCard } from './formal-test';
import { answerAdaptiveQuestion, buildAdaptiveQuestion, checkActiveUse, publicAdaptiveQuestion, type AdaptiveCard, type AdaptiveQuestion } from './adaptive-test';
import { learningAssetQuality } from './content-quality';
import { focusedSentence, parseSourceRef, passageOf, sentenceInPassages } from './collect-context';
import {
  collectUnseenFromList,
  countActuallyLearned,
  deferredSenseIds,
  headwordKey,
  isTeachingDay,
  pendingDailySessions,
  seenHeadwordSet,
  teacherItemsForStudent,
  testableDailyItems,
} from './unified-vocabulary-rules';

/**
 * 正式测试里除了今天学的词，再抽查几个以前学过的。
 *
 * 2026-09-10 叶老师定的 3 个。为什么要有：在这之前，一个词的一生就是
 * 「被推送一次、当天被考一次、再也不见」—— 生产实测 1569 个词只在一天
 * 出现过，被推过两天的只有 23 个。抽查让旧词自己轮着回来，不用另造一条
 * 复习队列。
 */
export const REVIEW_SAMPLE_SIZE = 3;

export type CollectionAction = 'learn' | 'known' | 'lookup_only' | 'later';

export interface CollectWordInput {
  headword: string;
  action: CollectionAction;
  contextSentence?: string;
  contextTranslation?: string;
  sourceTitle?: string;
  sourceRef?: string;
  source?: 'reading_lookup' | 'reading_error' | 'search' | 'teacher_list';
  /** 学生点的是显示中的哪一条词义（UI02：按钮绑定显示结果，不读输入框）。 */
  senseId?: string;
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

const ACTIVE_USE_LABEL: Record<string, string> = {
  ok: '检测到目标词，未评估句子质量',
  only_target_repeated: '只重复了目标词，没有写成句子',
  target_missing: '没有找到目标词（或它的变形）',
  too_short: '句子太短，至少写 3 个英文单词',
  not_words: '没有写英文单词',
};

/** 造句题回顾里给学生看的检查结果（VOC11）。永远不说「句子正确」。 */
function activeUseCheckView(headword: string, response: unknown) {
  const check = checkActiveUse(headword, response);
  return { ...check, label: ACTIVE_USE_LABEL[check.reason] ?? ACTIVE_USE_LABEL.ok };
}

/** 与 schema 里 StudentVocabularyProfile 的默认值一致；没存过设置的学生按它算（S08：读不建行）。 */
const PROFILE_DEFAULTS = { dailyTarget: 10, taskMinutes: 8, mode: 'adaptive_coach', audioAccent: 'en-GB' } as const;

/** 一张学习卡被「我会了，换一个」换过几次、换掉的是谁（VOC02/VOC08）。 */
function replacementHistory(response: unknown): Array<{ senseId: string; headword: string }> {
  const raw = response && typeof response === 'object' && !Array.isArray(response)
    ? (response as { replacedFrom?: unknown }).replacedFrom
    : null;
  return Array.isArray(raw)
    ? raw.filter((entry): entry is { senseId: string; headword: string } => Boolean(entry && typeof entry === 'object' && typeof (entry as any).senseId === 'string'))
    : [];
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

  /**
   * 学生的词汇设置。**只读**（S08，2026-09-11）：原来这里 upsert 一行，
   * `GET /vocab-v2/profile` 和 `GET /vocab-v2/overview` 于是都会写库 —— 教师只读
   * 视角看一眼就在学生名下建了行。没存过就按 schema 默认值返回，真正建行只在
   * `POST /vocab-v2/profile`（updateProfile）。
   */
  async profile(studentId: string) {
    const row = await this.prisma.studentVocabularyProfile.findUnique({ where: { studentId } });
    return {
      studentId,
      ...PROFILE_DEFAULTS,
      ...(row ?? {}),
      persisted: Boolean(row),
      allowedDailyTargets: [5, 10, 15, 20],
    };
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

  /**
   * 老师给一个班发一天的词。
   *
   * 2026-09-05 放宽的三堵墙：不再必须 12 个（1–20 个都行）；不再必须在
   * NGSL / NAWL 里 —— 库里已有可发布 sense 的任何拼写都收（词表外的词由
   * `scripts/vocab-v2/publish-word-list.ts` 先把释义例句灌进去）；每个词可带
   * `force`，见过的学生也照推。按拼写去重发生在学生开始当天任务时
   * （`createTeacherDailySession`），不在这里。
   */
  async publishTeacherAssignment(
    actor: { id: string; role: string },
    input: { classId: string; date: string; title?: string; words: Array<string | { headword: string; force?: boolean }> },
  ) {
    if (!(await canActOnClass(this.prisma, actor, input.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new BadRequestException({ code: 'v2_assignment_date_invalid' });
    }
    const requested = input.words
      .map((word) => (typeof word === 'string' ? { headword: word, force: false } : { headword: word.headword, force: Boolean(word.force) }))
      .map((word) => ({ ...word, headword: headwordKey(word.headword) }))
      .filter((word) => word.headword);
    if (requested.length < 1 || requested.length > 20) {
      throw new BadRequestException({ code: 'v2_assignment_word_count', min: 1, max: 20, received: requested.length });
    }
    if (new Set(requested.map((word) => word.headword)).size !== requested.length) {
      throw new BadRequestException({ code: 'v2_assignment_words_must_be_unique' });
    }
    const resolved: Array<{ sense: { id: string }; force: boolean }> = [];
    const notFound: string[] = [];
    for (const word of requested) {
      const row = await this.publishableSenseFor(word.headword);
      if (!row) notFound.push(word.headword);
      else resolved.push({ sense: row, force: word.force });
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
        data: resolved.map((row, index) => ({ assignmentId: saved.id, senseId: row.sense.id, position: index + 1, force: row.force })),
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
      const pendingTests = pendingDailySessions(
        completedLearning,
        new Map(formalSessions.filter((row) => row.studentId === user.id).map((row) => [row.sessionKey, row.status])),
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
        force: Boolean(item.force),
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
    const pageRows = rows.slice(start, start + pageSize);
    // VOC05：学生自己收词时的句子只挂在他自己的收词事件上 —— 共享例句没有时，
    // 「我的单词」给他看他自己的那一句（标明是个人的）。
    const personalEvents = pageRows.length
      ? await this.prisma.vocabularyCollectionEvent.findMany({
          where: { studentId, senseId: { in: pageRows.map((row) => row.senseId) }, contextText: { not: null } },
          orderBy: { createdAt: 'desc' },
          select: { senseId: true, contextText: true, metadata: true },
        })
      : [];
    const personalBySense = new Map<string, { sentence: string; translation: string | null; personal: true }>();
    for (const event of personalEvents) {
      if (personalBySense.has(event.senseId) || !event.contextText) continue;
      const translation = (event.metadata as { personalContextTranslation?: unknown } | null)?.personalContextTranslation;
      personalBySense.set(event.senseId, { sentence: event.contextText, translation: typeof translation === 'string' ? translation : null, personal: true });
    }
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
      items: pageRows.map((row) => ({
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
        context: row.sense.contexts[0] ? { ...row.sense.contexts[0], personal: false } : personalBySense.get(row.senseId) ?? null,
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
    // 同一拼写的两个词义只留一个：否则一题的回顾（卡片里有拼写）会泄露另一题的答案（VOC04）。
    const byHeadword = new Map<string, (typeof owned)[number]>();
    for (const row of owned) {
      const key = headwordKey(row.sense.lexeme.headword);
      if (key && !byHeadword.has(key)) byHeadword.set(key, row);
    }
    const distinct = [...byHeadword.values()];
    const limit = input.count === 'all' ? distinct.length : input.count;
    // Personal practice must feel fresh but never writes a formal score.  The
    // shuffle is performed after the server has applied ownership filters, so
    // the client can never ask to practise another student's words.
    const shuffled = [...distinct];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    const selected = shuffled.slice(0, limit);
    if (!selected.length) throw new BadRequestException({ code: 'v2_custom_test_empty' });
    // 听写题只给有服务端录音的词出：没有录音就只能让浏览器朗读 = 把单词明文交给客户端（VOC04）。
    const audioRows = await this.prisma.wordAudio.findMany({
      where: { headword: { in: selected.map((row) => headwordKey(row.sense.lexeme.headword)) } },
      select: { headword: true },
    });
    const withAudio = new Set(audioRows.map((row) => row.headword));
    const cards = selected.map((row) => ({
      ...this.cardSnapshot({ sense: row.sense, owned: row }, 5, row.reps + 1),
      masteryStage: row.masteryStage,
      audioAvailable: withAudio.has(headwordKey(row.sense.lexeme.headword)),
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

  /**
   * ECDICT 的变形词条有一类中文只写「be的过去式」这种指针，英文 definition 还混进了
   * 别的条目（was 的第一行是华盛顿州）。指向谁就用谁的释义，中文前面标一句
   *（2026-09-06 第五轮盲测 4；阅读页查词走 VocabService，这里是「我的单词」页和收词）。
   */
  private async inflectionPointer(dict: { word: string; translation: string | null } | null) {
    if (!dict) return null;
    const m = String(dict.translation ?? '').trim()
      .match(/^([a-z]+)\s*的\s*(过去式|过去分词|现在分词|复数|第三人称单数|比较级|最高级)$/i);
    if (!m) return null;
    const base = await this.prisma.dictEntry.findUnique({ where: { word: m[1].toLowerCase() } });
    if (!base) return null;
    return { base, note: `${dict.word} 是 ${base.word} 的${m[2]}` };
  }

  /** 机翻（VOC15 口径）：注入的翻译服务有 translateDetailed 就用它，否则退回旧的 translate()。 */
  private async machineTranslate(text: string): Promise<TranslationResult> {
    const translator = this.translator as Partial<RealtimeTranslationService>;
    if (typeof translator.translateDetailed === 'function') return translator.translateDetailed(text);
    const value = typeof translator.translate === 'function' ? await translator.translate(text) : null;
    return value
      ? { text: value, status: 'ok', retryable: false, provider: 'none' }
      : { text: null, status: 'provider_error', retryable: true, provider: 'none' };
  }

  /**
   * 这个拼写在库里已有的 sense —— **只读**，不建、不改（VOC05）。
   * 学生点了具体哪一条（senseId）就只认那一条；否则官方词表（学生档位的主表优先）
   * → 其它词表 → personal；同一词条里 ready 的优先。
   */
  private async existingSenseForCollect(headword: string, level: EnglishLevel | null, senseId?: string) {
    if (senseId) {
      const chosen = await this.prisma.vocabularySense.findUnique({ where: { id: senseId }, include: { lexeme: true } });
      if (!chosen || headwordKey(chosen.lexeme.headword) !== headword) {
        throw new BadRequestException({ code: 'sense_headword_mismatch', message: '要操作的词条和显示的单词对不上，请重新查一次。' });
      }
      return chosen;
    }
    const published = exactOfficial(headword, level);
    const lexemes = await this.prisma.vocabularyLexeme.findMany({
      where: { headword },
      include: { senses: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
    });
    const order = (lexeme: { listName: string; listVersion: string }) =>
      published && lexeme.listName === published.list && lexeme.listVersion === officialListVersion(published.list)
        ? 0
        : lexeme.listName === 'ngsl' || lexeme.listName === 'nawl' ? 1 : lexeme.listName === 'personal' ? 3 : 2;
    const sorted = [...lexemes].sort((a, b) => order(a) - order(b));
    for (const lexeme of sorted) {
      const ready = lexeme.senses.find((sense) => sense.qualityStatus === 'ready');
      if (ready) return { ...ready, lexeme };
    }
    const first = sorted.find((lexeme) => lexeme.senses.length);
    return first ? { ...first.senses[0], lexeme: first } : null;
  }

  /**
   * 查词显示用的内容：官方词表 + 本地词典（+ 指针词条）+ 必要时机翻。纯计算，不写库。
   */
  private async draftSenseForCollect(headword: string, level: EnglishLevel | null) {
    const published = exactOfficial(headword, level);
    const dictRaw = await this.prisma.dictEntry.findUnique({ where: { word: headword } });
    const pointer = await this.inflectionPointer(dictRaw);
    const dict = pointer && dictRaw
      ? {
          ...dictRaw,
          translation: pointer.base.translation,
          definition: pointer.base.definition ?? dictRaw.definition,
          pos: dictRaw.pos ?? pointer.base.pos,
          phonetic: dictRaw.phonetic ?? pointer.base.phonetic,
        }
      : dictRaw;
    const rawPos = canonicalPos(published?.pos || dict?.pos);
    const pos = rawPos === 'other' ? (inferPosFromTranslation(dict?.translation) ?? rawPos) : rawPos;
    let translation = translationForPos(dict?.translation, pos);
    let translationStatus: TranslationResult['status'] = translation ? 'ok' : 'empty_input';
    let retryable = false;
    let retryAfterSec: number | undefined;
    if (!translation) {
      const machine = await this.machineTranslate(headword);
      translation = machine.text ?? '';
      translationStatus = machine.status;
      retryable = machine.retryable;
      retryAfterSec = machine.retryAfterSec;
    }
    if (translation && pointer) translation = `${pointer.note}；${translation}`;
    return {
      published,
      pos,
      translation,
      definition: published?.definition || dict?.definition || '',
      phonetic: published?.phonetic || dict?.phonetic || null,
      translationStatus,
      retryable,
      retryAfterSec,
    };
  }

  /**
   * 句子是否出自这个学生有权阅读的那篇已发布文章（VOC05）。
   * 只认 `assignment:<id>` / `session:<id>`，而且必须：
   *   · 是他所在班的布置、没有被取消；
   *   · 他真的有权读它 —— 他在这份卷上有答卷（打开过），或者它就是他这一档、
   *     今天及以前的那一场（同班别档的文章不算他的）；
   *   · 句子逐字出现在那份卷子的文章正文里。
   */
  private async verifiedArticleFor(studentId: string, level: EnglishLevel | null, sourceRef: string | undefined, sentence: string | null) {
    const ref = parseSourceRef(sourceRef);
    if (!ref || !sentence) return null;
    const access: any[] = [{ submissions: { some: { studentId } } }];
    if (level) access.push({ morningQuizSession: { is: { level, date: { lte: sgtDay().date } } } });
    const assignment = await this.prisma.paperAssignment.findFirst({
      where: {
        AND: [
          ref.kind === 'assignment' ? { id: ref.id } : { morningQuizSession: { is: { id: ref.id } } },
          { class: { enrollments: { some: { userId: studentId, role: 'student' } } } },
          { OR: [{ morningQuizSession: { is: null } }, { morningQuizSession: { is: { status: { not: 'cancelled' } } } }] },
          { OR: access },
        ],
      },
      select: {
        id: true,
        paper: { select: { name: true, questions: { select: { question: { select: { content: true } } } } } },
      },
    });
    if (!assignment) return null;
    const passages = (assignment.paper?.questions ?? [])
      .map((row) => passageOf(row.question?.content))
      .filter((value): value is string => Boolean(value));
    if (!sentenceInPassages(sentence, passages)) return null;
    return { assignmentId: assignment.id, title: assignment.paper?.name ?? null };
  }

  /**
   * 学生查词后的四个选择：加入 / 我已经会了 / 稍后再学 / 只查一下。
   *
   * VOC05（2026-09-11）把「个人输入」和「共享教材」分开：
   *   · 只查一下 = **零写入**（不建共享词条、不建归属、不写事件）；
   *   · 已有的共享 sense **一个字都不改**（原来每次收词都用词典/机翻覆盖释义、
   *     把状态改回 ready）；库里真没有这个词时才按服务端词典/词表建一条；
   *   · 学生传来的句子只截含目标词的那一句，挂在他自己的收词事件上；
   *   · 写进共享 `VocabularyContext` 的只有服务端验证过出自他有权阅读的已发布文章
   *     的句子，译文由服务端出，客户端传来的译文只作他个人的备注。
   */
  async collect(studentId: string, input: CollectWordInput) {
    const headword = input.headword.trim().toLowerCase().replace(/^[^a-z'-]+|[^a-z'-]+$/g, '');
    if (!headword) throw new BadRequestException({ code: 'headword_required' });
    const user = await this.prisma.user.findUnique({ where: { id: studentId }, select: { englishLevel: true } });
    const level = user?.englishLevel ?? null;
    const existing = await this.existingSenseForCollect(headword, level, input.senseId);
    const needsDraft = !existing || !String(existing.translation ?? '').trim();
    const draft = needsDraft ? await this.draftSenseForCollect(headword, level) : null;
    const displayTranslation = String(existing?.translation ?? '').trim() || draft?.translation || '';
    if (!displayTranslation) {
      throw new ServiceUnavailableException({
        code: 'translation_unavailable',
        reason: draft?.translationStatus ?? 'provider_error',
        retryable: draft?.retryable ?? true,
        ...(draft?.retryAfterSec ? { retryAfterSec: draft.retryAfterSec } : {}),
        message: draft?.translationStatus === 'no_chinese'
          ? '暂时没有这个词可靠的中文释义。'
          : '翻译服务暂时不可用，请稍后重试。',
      });
    }
    const focused = focusedSentence(input.contextSentence, headword);
    const personalTranslation = input.contextTranslation?.trim() || null;

    const senseView = (sense: { id: string; senseKey: string; pos: string; definition: string; translation: string } | null, phonetic: string | null) => ({
      id: sense?.id ?? null,
      headword,
      senseKey: sense?.senseKey ?? senseKey(draft?.pos ?? 'other'),
      pos: sense?.pos ?? draft?.pos ?? 'other',
      definition: String(sense?.definition ?? '').trim() || draft?.definition || '',
      translation: displayTranslation,
      phonetic,
    });

    if (input.action === 'lookup_only') {
      return {
        ok: true,
        action: input.action,
        added: false,
        sense: senseView(existing, existing?.lexeme.phonetic ?? draft?.phonetic ?? null),
        contextId: null,
        context: focused ? { sentence: focused, translation: personalTranslation, scope: 'personal' as const } : null,
      };
    }

    // 需要一条归属行 → 需要一个真实的 sense。库里有就用（不改它）；没有才按服务端数据建。
    let sense = existing;
    if (!sense) {
      const listName: OfficialListName | 'personal' = draft!.published?.list ?? 'personal';
      const listVersion = draft!.published ? officialListVersion(draft!.published.list) : '1';
      const lexeme = await this.prisma.vocabularyLexeme.upsert({
        where: { listName_listVersion_headword: { listName, listVersion, headword } },
        create: {
          listName,
          listVersion,
          rank: draft!.published?.rank ?? 0,
          headword,
          phonetic: draft!.phonetic,
          attribution: draft!.published ? OFFICIAL_WORDLIST_META.attribution : 'student search / local dictionary',
        },
        update: {},
      });
      const created = await this.prisma.vocabularySense.upsert({
        where: { lexemeId_senseKey: { lexemeId: lexeme.id, senseKey: senseKey(draft!.pos) } },
        create: {
          lexemeId: lexeme.id,
          senseKey: senseKey(draft!.pos),
          pos: draft!.pos,
          definition: draft!.definition,
          translation: draft!.translation,
          qualityStatus: draft!.translation ? 'ready' : 'needs_translation',
        },
        update: {},
      });
      sense = { ...created, lexeme };
    }

    let contextId: string | null = null;
    let contextScope: 'shared_verified' | 'personal' | null = focused ? 'personal' : null;
    let sharedTranslation: string | null = null;
    let sharedTranslationStatus: TranslationResult['status'] | null = null;
    const verified = await this.verifiedArticleFor(studentId, level, input.sourceRef, focused);
    if (verified && focused) {
      contextScope = 'shared_verified';
      const found = await this.prisma.vocabularyContext.findFirst({ where: { senseId: sense.id, sentence: focused } });
      if (found) {
        contextId = found.id;
        sharedTranslation = found.translation || null;
      } else {
        const machine = await this.machineTranslate(focused);
        sharedTranslation = machine.text;
        sharedTranslationStatus = machine.status;
        for (let attempt = 0; attempt < 3 && !contextId; attempt += 1) {
          const position = await this.prisma.vocabularyContext.count({ where: { senseId: sense.id, kind: 'article_original' } }) + 1 + attempt;
          try {
            const context = await this.prisma.vocabularyContext.create({
              data: {
                senseId: sense.id,
                kind: 'article_original',
                position,
                sentence: focused,
                translation: machine.text ?? '',
                sourceTitle: verified.title,
                sourceRef: `assignment:${verified.assignmentId}`,
                provider: 'article_verified',
                attribution: 'school reading article + server translation',
                qualityStatus: machine.text ? 'ready' : 'needs_translation',
              },
            });
            contextId = context.id;
          } catch (error) {
            if ((error as { code?: string }).code !== 'P2002') throw error;
          }
        }
      }
    }

    const current = await this.prisma.studentVocabularySense.findUnique({
      where: { studentId_senseId: { studentId, senseId: sense.id } },
    });
    // 2026-09-05 盲测 P2-12：「加入我的单词」和「稍后再学」原来落库一模一样。
    // 现在：加入 = 学生已经认识它了，起步就是第 2 阶（认得），马上可复习；
    // 稍后 = 只收着（第 1 阶，见过），到期日推到明天，今天的复习不排它。
    const desiredStage = input.action === 'known'
      ? 8
      : input.action === 'learn'
        ? Math.max(current?.masteryStage ?? 1, 2)
        : Math.max(current?.masteryStage ?? 1, 1);
    const tomorrow = new Date(new Date(`${sgtDay().key}T00:00:00.000Z`).getTime() + 86_400_000 - 8 * 3600_000);
    const dueForAction = input.action === 'later' ? { due: tomorrow } : input.action === 'learn' ? { due: new Date() } : {};
    const owned = await this.prisma.studentVocabularySense.upsert({
      where: { studentId_senseId: { studentId, senseId: sense.id } },
      create: {
        studentId,
        senseId: sense.id,
        masteryStage: desiredStage,
        inNotebook: input.action !== 'known',
        removedAt: input.action === 'known' ? new Date() : null,
        ...(desiredStage === 8 ? { masteredAt: new Date() } : {}),
        ...dueForAction,
      },
      update: input.action === 'known'
        ? { masteryStage: 8, masteredAt: new Date(), inNotebook: false, removedAt: new Date() }
        : { inNotebook: true, removedAt: null, masteryStage: desiredStage, ...dueForAction },
    });

    await this.prisma.vocabularyCollectionEvent.create({
      data: {
        studentId,
        senseId: sense.id,
        studentSenseId: owned.id,
        source: input.source ?? 'reading_lookup',
        action: input.action,
        sourceTitle: input.sourceTitle?.trim() || null,
        sourceRef: input.sourceRef?.trim() || null,
        // 个人上下文：只截含目标词的那一句，只给他自己看
        contextText: focused,
        metadata: {
          ...(contextId ? { contextId } : {}),
          ...(personalTranslation && focused ? { personalContextTranslation: personalTranslation } : {}),
          ...(verified ? { verifiedAssignmentId: verified.assignmentId } : {}),
        },
      },
    });

    return {
      ok: true,
      action: input.action,
      added: true,
      sense: senseView(sense, sense.lexeme.phonetic ?? draft?.phonetic ?? null),
      contextId,
      context: focused
        ? {
            sentence: focused,
            scope: contextScope,
            translation: contextScope === 'shared_verified' ? sharedTranslation : personalTranslation,
            ...(sharedTranslationStatus && !sharedTranslation ? { translationStatus: sharedTranslationStatus, retryable: true } : {}),
          }
        : null,
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

  /**
   * 一个拼写对应的可发布 sense：官方词表里的走 ensureOfficialSense（会补建），
   * 词表外的只认库里已经 ready 且有例句的（任何 listName）。找不到返回 null。
   */
  private async publishableSenseFor(headword: string) {
    const publishable = (row: { lexeme: { headword: string }; sense: { qualityStatus: string; translation: string; definition: string; contexts: Array<{ sentence: string; translation: string; qualityStatus?: string }> } }) =>
      row.sense.qualityStatus === 'ready'
      && learningAssetQuality({ headword: row.lexeme.headword, translation: row.sense.translation, definition: row.sense.definition, contexts: row.sense.contexts }).publishable;
    const official = exactOfficial(headword, null);
    if (official) {
      const row = await this.ensureOfficialSense(official);
      return publishable(row) ? row.sense : null;
    }
    const lexemes = await this.prisma.vocabularyLexeme.findMany({
      where: { headword },
      include: { senses: { where: { qualityStatus: 'ready' }, include: { contexts: { where: { qualityStatus: 'ready' } } } } },
      orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
    });
    for (const lexeme of lexemes) {
      for (const sense of lexeme.senses) {
        if (publishable({ lexeme, sense })) return sense;
      }
    }
    return null;
  }

  /** 学生名下所有归属行的拼写 —— 学过、加过、移出过、会了的全算见过。 */
  private async seenHeadwords(studentId: string): Promise<Set<string>> {
    const rows = await this.prisma.studentVocabularySense.findMany({
      where: { studentId },
      select: { sense: { select: { lexeme: { select: { headword: true } } } } },
    });
    return seenHeadwordSet(rows.map((row) => ({ headword: row.sense.lexeme.headword })));
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
    const context = contextForEncounter(
      row.sense.contexts ?? [],
      encounter,
      maximumDifficulty,
      row.sense.lexeme.headword,
    );
    return {
      headword: row.sense.lexeme.headword,
      phonetic: row.sense.lexeme.phonetic,
      pos: row.sense.pos,
      senseKey: row.sense.senseKey,
      translation: row.sense.translation,
      definition: row.sense.definition,
      sentence: context?.sentence ?? null,
      // 释义模板句的机翻会把词本身译错（objective →「客观」）；中文直接按所教词义写
      //（2026-09-06 上线验收 中级档 B-2）。
      sentenceTranslation: context && isTemplateContext(context)
        ? `“${row.sense.lexeme.headword}” 在这里的意思：${String(row.sense.translation ?? '').split(/\n+/)[0].replace(/^[a-z]{1,5}\.\s*/i, '').trim()}`
        : (context?.translation ?? null),
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

  /**
   * 老师词表落到一个学生头上。见过的拼写跳过（force 的除外）；一个都不剩
   * 时返回 null，调用方回到档位词表照常推 —— 老师的词他全学过，不等于
   * 今天没词可学。
   */
  private async createTeacherDailySession(
    studentId: string,
    day: { key: string; date: Date },
    sessionKey: string,
    assignment: NonNullable<Awaited<ReturnType<VocabularyV2Service['teacherAssignmentForStudent']>>>,
    seen: ReadonlySet<string>,
  ) {
    const { kept, skipped } = teacherItemsForStudent(
      assignment.items.map((item) => ({ ...item, headword: item.sense.lexeme.headword, force: item.force })),
      seen,
    );
    if (!kept.length) return null;
    // 老师明确强制重学、而学生其实见过的词：这是「按拼写不重复」的唯一例外，单独记下来（VOC02）
    const forcedSeen = kept.filter((item) => item.force && seen.has(headwordKey(item.headword))).map((item) => item.headword);
    const rows = kept.map((item) => ({ sense: item.sense, owned: null }));
    const created = await this.prisma.$transaction(async (tx) => {
      for (const item of kept) {
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
          target: kept.length,
          settingsSnapshot: {
            requestedTarget: assignment.items.length,
            taskMinutes: 8,
            assignmentId: assignment.id,
            assignmentVersion: assignment.version,
            classId: assignment.classId,
            listName: kept[0]?.sense.lexeme.listName ?? 'ngsl',
            // 按拼写去重跳过的词：记下来，教师端和排查都看得见。
            skippedSeen: skipped.map((item) => item.headword),
            forcedSeen,
          },
          sourceSummary: { teacher_list: kept.length },
          items: {
            create: kept.map((item, index) => {
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
    // 每日新词只在教学日（周一到周五）生成。已存在的会话照常返回（上面），
    // 所以这条只挡新建：周末打开 App 不会凭空多出一天的欠账。
    if (!isTeachingDay(day.key)) throw new BadRequestException({ code: 'v2_no_task_on_weekend' });

    // 「见过」只看拼写：换词表、升版本、阅读时自己加过的词，都不再当新词推。
    const seen = await this.seenHeadwords(studentId);

    const teacherAssignment = await this.teacherAssignmentForStudent(studentId, day.date);
    if (teacherAssignment?.items.length) {
      try {
        const teacherSession = await this.createTeacherDailySession(studentId, day, sessionKey, teacherAssignment, seen);
        if (teacherSession) return teacherSession;
        // 老师这天的词他全学过 → 往下走档位词表。
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
    // 顺着词表从游标往后读，凑够「没见过」的词就停（见过 = 拼写在学生
    // 名下出现过，不管来自哪张表）。多凑几个给规划器挑，免得个别词没有
    // 可发布的例句时那天不足额；主表读完还不够就去备用表接着凑。
    let wanted = profile.dailyTarget + 5;
    for (const [listIndex, listName] of listOrder.entries()) {
      if (wanted <= 0) break;
      const listVersion = officialListVersion(listName);
      const cursor = await this.prisma.studentVocabularyCursor.findUnique({ where: { studentId_listName_listVersion: { studentId, listName, listVersion } } });
      const configuredStart = listIndex === 0 ? policy.startRank : 1;
      const startRank = Math.max(configuredStart, cursor?.nextRank ?? configuredStart);
      const allWords = officialList(listName);
      const { picked, exhausted } = collectUnseenFromList(allWords, startRank, seen, wanted);
      sourceWords.push(...picked);
      listCursors.push({ listName, listVersion, startRank, exhausted: startRank > allWords.length });
      if (!exhausted) break;
      wanted -= picked.length;
    }
    const unseenLevelRows = await Promise.all(sourceWords.map((word) => this.ensureOfficialSense(word)));

    const rows = new Map<string, any>();
    const candidates: PlannerCandidate[] = [];
    // A daily push contains new words only.  Article/search words stay in the
    // notebook and remain available for personal practice, but are never
    // silently recycled as a "new" daily word — the headword filter above
    // already removed everything the student has ever owned.
    for (const { lexeme, sense } of unseenLevelRows) {
      rows.set(sense.id, { sense: { ...sense, lexeme }, owned: null });
      const asset = learningAssetQuality({ headword: lexeme.headword, translation: sense.translation, definition: sense.definition, contexts: sense.contexts });
      const listPriority = Math.max(0, listOrder.indexOf(lexeme.listName as OfficialListName));
      candidates.push({ senseId: sense.id, source: 'level_gap', quality: sense.qualityStatus === 'ready' && asset.publishable ? 1 : 0.5, rank: listPriority * 1_000_000 + lexeme.rank });
    }

    // 「稍后再学」过、后来一直没学完的词，排到今天任务的最前面。
    //
    // 它们的归属行在第一次推送时就建了，所以上面按拼写的「见过」过滤会把
    // 它们永久排除；词表游标也早已越过它们。不在这里显式捞回来，「稍后」
    // 就等于「再也不」。仍在「我的单词」里、且没被学生移出的才回来；
    // 学生点过「我会了」（mastered / 换词）的不回来 —— 那是他明确的决定。
    const deferredIds = deferredSenseIds(
      await this.prisma.vocabularyV2SessionItem.findMany({
        where: { session: { studentId, sessionType: 'daily_learning' }, status: { in: ['skipped', 'completed'] } },
        select: { senseId: true, status: true },
      }),
    );
    const deferredSenseSet = new Set<string>();
    if (deferredIds.length) {
      const owned = await this.prisma.studentVocabularySense.findMany({
        where: { studentId, senseId: { in: deferredIds }, inNotebook: true, removedAt: null, masteryStage: { lt: 8 } },
        include: { sense: { include: { lexeme: true, contexts: { where: { qualityStatus: 'ready' } } } } },
      });
      for (const row of owned) {
        const sense = row.sense;
        if (!sense?.lexeme || rows.has(sense.id)) continue;
        const asset = learningAssetQuality({ headword: sense.lexeme.headword, translation: sense.translation, definition: sense.definition, contexts: sense.contexts });
        rows.set(sense.id, { sense, owned: row });
        deferredSenseSet.add(sense.id);
        // rank 0：排在任何词表词之前；同一来源 level_gap，学生端标签不变。
        candidates.push({ senseId: sense.id, source: 'level_gap', quality: sense.qualityStatus === 'ready' && asset.publishable ? 1 : 0.5, rank: 0 });
      }
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
      // 捞回来的「稍后再学」词 rank 在游标之前，不能让它把游标拉回去。
      if (deferredSenseSet.has(item.senseId)) continue;
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

  /**
   * 学生翻完一张卡（学完 / 有点难 / 我会了 / 稍后再学）。
   *
   * VOC01（2026-09-11 审计）：原来用事务外读到的 `session.items` 算「还剩几张」，
   * 两个标签页同时点最后两张时各自都看见另一张没学 → 会话永远 in_progress、
   * 正式卷不生成；重复请求还会把 reps 再加一次。现在：
   *
   *   1. 这张卡从 pending 改成 completed / skipped 是**条件更新**
   *      （`where status = 'pending' AND senseId = 读到的那个`）。Postgres 里
   *      同一行的并发条件更新会排队、后到的按最新值重判 where —— 只有一次成功。
   *   2. 学习次数、掌握阶段、来源事件只在「真的转换了」的那一次写。
   *   3. cursor 只前进不后退（`where cursor < position`）。
   *   4. 事务**提交之后**再数还剩几张：两个请求各自提交后各数一次，后数的那个
   *      一定看得见双方的提交（READ COMMITTED 下每条语句看见此前已提交的数据）。
   *      结束会话本身也是条件更新（`where status = 'in_progress'`），只结一次。
   *   5. 正式卷由 sessionKey 唯一约束保证只有一份（`startFormalTest` 撞 P2002
   *      就回读已建好的那份）。
   *
   * 已经处理过的卡再来一次（双击、重试、旧页面迟到）→ 原样返回当前会话，不报错、
   * 不加学习量。
   */
  async actOnLearningItem(studentId: string, sessionId: string, itemId: string, action: LearningCardAction, responseMs?: number) {
    if (action === 'replace') throw new BadRequestException({ code: 'use_replace_endpoint' });
    const session = await this.prisma.vocabularyV2Session.findFirst({
      where: { id: sessionId, studentId, sessionType: 'daily_learning' },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!session) throw new BadRequestException({ code: 'v2_session_not_found' });
    const item = session.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new BadRequestException({ code: 'v2_item_not_found' });
    if (item.status !== 'pending') return this.learningActionResult(studentId, session.id, true);
    if (session.status !== 'in_progress') throw new BadRequestException({ code: 'v2_session_closed' });

    const desiredStage = initialStageForAction(action, item.masteryBefore);
    const previousResponse = item.response && typeof item.response === 'object' && !Array.isArray(item.response)
      ? item.response as Record<string, unknown>
      : {};
    const transitioned = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.vocabularyV2SessionItem.updateMany({
        where: { id: item.id, sessionId: session.id, status: 'pending', senseId: item.senseId },
        data: {
          status: action === 'skip' ? 'skipped' : 'completed',
          // 换词记录（replacedFrom）要留着：计数「换了几个」靠它（VOC08）。
          response: { ...previousResponse, action } as any,
          responseMs: responseMs == null ? null : Math.max(0, Math.floor(responseMs)),
          attempts: { increment: 1 },
          completedAt: new Date(),
        },
      });
      if (claim.count === 0) return false;
      const owned = await tx.studentVocabularySense.upsert({
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
          // 带上归属行：来源筛选和来源标签走同一条关系（VOC09）。
          studentSenseId: owned.id,
          source: item.source,
          action,
          metadata: { sessionId: session.id, itemId: item.id },
        },
      });
      await tx.vocabularyV2Session.updateMany({
        where: { id: session.id, cursor: { lt: item.position } },
        data: { cursor: item.position },
      });
      return true;
    });
    if (!transitioned) {
      const current = await this.prisma.vocabularyV2SessionItem.findUnique({ where: { id: item.id } });
      // 被别的请求处理掉了 → 幂等；还是 pending 但换了词 → 学生点的是旧卡。
      if (current && current.status === 'pending') {
        throw new ConflictException({ code: 'v2_item_changed', message: '这张卡刚被换成了新词，请看新卡。' });
      }
      return this.learningActionResult(studentId, session.id, true);
    }
    await this.settleLearningSession(session.id);
    return this.learningActionResult(studentId, session.id, false);
  }

  /**
   * 每日学习会话还有没有没处理的卡；没有了就结束它（只结一次）。
   * 必须在处理卡片的事务**提交之后**调用 —— 理由见 `actOnLearningItem`。
   */
  private async settleLearningSession(sessionId: string) {
    const remaining = await this.prisma.vocabularyV2SessionItem.count({ where: { sessionId, status: 'pending' } });
    if (remaining > 0) return false;
    const session = await this.prisma.vocabularyV2Session.findUnique({ where: { id: sessionId }, select: { target: true } });
    const closed = await this.prisma.vocabularyV2Session.updateMany({
      where: { id: sessionId, status: 'in_progress' },
      data: { status: 'completed', cursor: session?.target ?? 0, completedAt: new Date() },
    });
    return closed.count > 0;
  }

  /** 学完动作的统一返回：最新会话 + 当天那份正式卷（学完且至少学会一个词才有）。 */
  private async learningActionResult(studentId: string, sessionId: string, replayed: boolean) {
    const refreshed = await this.prisma.vocabularyV2Session.findUnique({
      where: { id: sessionId },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    let generatedTestId: string | null = null;
    let generatedTest: { id: string; total: number; newWords: number; reviewWords: number } | null = null;
    if (refreshed?.status === 'completed' && refreshed.items.some((candidate) => candidate.status === 'completed')) {
      const test = await this.startFormalTest(studentId, refreshed.id);
      generatedTestId = test.id;
      generatedTest = { id: test.id, total: test.total, newWords: test.newWords, reviewWords: test.reviewWords };
    }
    return { ...this.sessionView(refreshed!), generatedTestId, generatedTest, replayed };
  }

  /**
   * 「这个词我会了，换一个」（VOC02，2026-09-11 审计重写）。
   *
   *   · 候选按**规范化拼写**全局排除：学生名下任何归属行的拼写（阅读 / 搜索 / 已会 /
   *     已移出 / 其他词义 / 别的词表）+ 本会话里已有的拼写，都不再换进来。
   *   · 候选顺序：会话冻结的词表（官方表时）→ 学生档位的主表 → 备用表；每张表从游标
   *     往后**分批一直找到表尾**，不再只看前 100 个。老师词表那天（词表外的词）也从
   *     档位词表补。只挑库里已有可发布内容（释义 + 带译文的短例句）的词，不临时造。
   *   · 真耗尽：原词原样留着（不标会、不移出、不写事件），错误里给 kept/options。
   *   · 幂等：卡片改词用条件更新（`where senseId = 读到的那个 AND status = pending`）；
   *     客户端带 `expectedSenseId`（它屏幕上那张卡的词义）时，重试 / 双击看到的是
   *     「已经换过了」的原样返回，不会把刚换上来的新词也标会。两张卡同时换撞到同一个
   *     新词 → 后到的撞唯一键，换下一个候选重来，不 500。
   */
  async replaceDailyItem(studentId: string, sessionId: string, itemId: string, options: { expectedSenseId?: string } = {}) {
    const session = await this.prisma.vocabularyV2Session.findFirst({
      where: { id: sessionId, studentId, sessionType: 'daily_learning' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { sense: { include: { lexeme: true } } },
        },
      },
    });
    if (!session) throw new BadRequestException({ code: 'v2_session_not_found' });
    const item = session.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new BadRequestException({ code: 'v2_item_not_found' });

    const replayView = async () => {
      const refreshed = await this.prisma.vocabularyV2Session.findUnique({
        where: { id: session.id },
        include: { items: { orderBy: { position: 'asc' } } },
      });
      const current = refreshed!.items.find((candidate: any) => candidate.id === item.id);
      const history = replacementHistory(current?.response);
      const last = history[history.length - 1];
      return {
        ...this.sessionView(refreshed!),
        replacement: last
          ? { position: item.position, oldHeadword: last.headword, newHeadword: String((current?.contentSnapshot as { headword?: string } | null)?.headword ?? '') }
          : null,
        replayed: true,
      };
    };

    // 客户端屏幕上那张卡已经不是这个词了：换过了就原样返回，否则说明它看的是旧卡。
    if (options.expectedSenseId && options.expectedSenseId !== item.senseId) {
      if (replacementHistory(item.response).some((entry) => entry.senseId === options.expectedSenseId)) return replayView();
      throw new ConflictException({ code: 'v2_item_changed', message: '这张卡已经换成了别的词，请看新卡。' });
    }
    if (item.status !== 'pending') throw new BadRequestException({ code: 'v2_item_already_completed' });
    if (session.status !== 'in_progress') throw new BadRequestException({ code: 'v2_session_closed' });

    const settings = (session.settingsSnapshot ?? {}) as Record<string, unknown>;
    const user = await this.prisma.user.findUnique({ where: { id: studentId }, select: { englishLevel: true } });
    const level = (typeof settings.level === 'string' && settings.level in LEVEL_WORD_POLICY
      ? settings.level
      : user?.englishLevel ?? 'olevel') as EnglishLevel;
    const policy = LEVEL_WORD_POLICY[level];
    const frozenList = settings.listName === 'ngsl' || settings.listName === 'nawl' ? settings.listName as OfficialListName : null;
    const listOrder = [frozenList, policy.primary, policy.fallback]
      .filter((value, index, values): value is OfficialListName => Boolean(value) && values.indexOf(value) === index);

    const excluded = await this.seenHeadwords(studentId);
    for (const row of session.items) {
      excluded.add(headwordKey(row.sense?.lexeme?.headword ?? ''));
      excluded.add(headwordKey(String((row.contentSnapshot as { headword?: string } | null)?.headword ?? '')));
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const found = await this.nextReplacementCandidate(studentId, listOrder, policy, excluded);
      if (!found) {
        throw new ServiceUnavailableException({
          code: 'v2_replacement_exhausted',
          kept: true,
          options: ['learn', 'later'],
          message: '符合你等级和质量要求、你还没见过的新词暂时找不到了。原词还在，没有被移出：可以照常学它，或点「稍后再学」。',
        });
      }
      const { lexeme, sense, word, listName, listVersion } = found;
      const replacementRow = { sense: { ...sense, lexeme }, owned: null };
      const context = contextForEncounter(sense.contexts ?? [], 1, policy.contextDifficulty, lexeme.headword);
      const oldHeadword = item.sense.lexeme.headword;
      const previousResponse = item.response && typeof item.response === 'object' && !Array.isArray(item.response)
        ? item.response as Record<string, unknown>
        : {};
      let outcome: 'replaced' | 'stale';
      try {
        outcome = await this.prisma.$transaction(async (tx) => {
          const claim = await tx.vocabularyV2SessionItem.updateMany({
            where: { id: item.id, sessionId: session.id, status: 'pending', senseId: item.senseId },
            data: {
              senseId: sense.id,
              source: 'level_gap',
              contextId: context?.id ?? null,
              masteryBefore: 1,
              contentVersion: sense.contentVersion,
              contentSnapshot: this.cardSnapshot(replacementRow, policy.contextDifficulty, 1) as any,
              // 换词记录：VOC08 数「换了几个」、重试时认出「已经换过」都靠它
              response: {
                ...previousResponse,
                replacedFrom: [...replacementHistory(item.response), { senseId: item.senseId, headword: oldHeadword, at: new Date().toISOString() }],
              } as any,
              isCorrect: null,
              attempts: 0,
              responseMs: null,
              completedAt: null,
            },
          });
          if (claim.count === 0) return 'stale' as const;
          // 新词：此前任何来源都没见过（上面按拼写排除了）；撞唯一键 = 别的请求刚把它给了这个学生
          const added = await tx.studentVocabularySense.create({ data: { studentId, senseId: sense.id, inNotebook: true } });
          const original = await tx.studentVocabularySense.upsert({
            where: { studentId_senseId: { studentId, senseId: item.senseId } },
            create: { studentId, senseId: item.senseId, masteryStage: 8, confidence: 4, masteredAt: new Date(), inNotebook: false, removedAt: new Date() },
            update: { masteryStage: 8, confidence: 4, masteredAt: new Date(), inNotebook: false, removedAt: new Date() },
          });
          await tx.vocabularyCollectionEvent.create({
            data: {
              studentId,
              senseId: item.senseId,
              studentSenseId: original.id,
              source: item.source,
              action: 'known_replaced',
              metadata: { sessionId: session.id, itemId: item.id, replacementSenseId: sense.id },
            },
          });
          await tx.vocabularyCollectionEvent.create({
            data: {
              studentId,
              senseId: sense.id,
              studentSenseId: added.id,
              source: 'level_gap',
              action: 'daily_pushed',
              metadata: { sessionId: session.id, itemId: item.id, date: session.date.toISOString().slice(0, 10), replacing: item.senseId },
            },
          });
          // 游标只前进
          const cursor = await tx.studentVocabularyCursor.findUnique({ where: { studentId_listName_listVersion: { studentId, listName, listVersion } } });
          if (!cursor) {
            await tx.studentVocabularyCursor.create({ data: { studentId, listName, listVersion, nextRank: word.rank + 1 } });
          } else if (cursor.nextRank < word.rank + 1) {
            await tx.studentVocabularyCursor.updateMany({
              where: { id: cursor.id, nextRank: { lt: word.rank + 1 } },
              data: { nextRank: word.rank + 1 },
            });
          }
          return 'replaced' as const;
        });
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        excluded.add(headwordKey(lexeme.headword));
        continue;
      }
      if (outcome === 'stale') {
        const current = await this.prisma.vocabularyV2SessionItem.findUnique({ where: { id: item.id } });
        if (current && replacementHistory(current.response).some((entry) => entry.senseId === item.senseId)) return replayView();
        if (current && current.status !== 'pending') throw new BadRequestException({ code: 'v2_item_already_completed' });
        throw new ConflictException({ code: 'v2_item_changed', message: '这张卡刚刚变了，请看新卡。' });
      }
      const refreshed = await this.prisma.vocabularyV2Session.findUnique({
        where: { id: session.id },
        include: { items: { orderBy: { position: 'asc' } } },
      });
      return {
        ...this.sessionView(refreshed!),
        replacement: { position: item.position, oldHeadword, newHeadword: lexeme.headword },
        replayed: false,
      };
    }
    throw new ConflictException({ code: 'v2_replacement_busy', message: '同时换词的请求太多了，请再点一次。' });
  }

  /**
   * 换词候选：按表顺序、从游标往后分批找，拿到第一个「拼写没见过 + 库里已有可发布内容」
   * 的词。每批一次查询，表尾读完换下一张表；都读完返回 null。
   */
  private async nextReplacementCandidate(
    studentId: string,
    listOrder: OfficialListName[],
    policy: (typeof LEVEL_WORD_POLICY)[EnglishLevel],
    excluded: ReadonlySet<string>,
  ) {
    const BATCH = 200;
    for (const listName of listOrder) {
      const listVersion = officialListVersion(listName);
      const cursor = await this.prisma.studentVocabularyCursor.findUnique({
        where: { studentId_listName_listVersion: { studentId, listName, listVersion } },
      });
      // 与 startDailySession 同一口径：主表从档位起点起，备用表从 1 起；游标只会更靠后
      const configuredStart = listName === policy.primary ? policy.startRank : 1;
      const startRank = Math.max(1, configuredStart, cursor?.nextRank ?? configuredStart);
      const all = officialList(listName);
      for (let offset = startRank - 1; offset < all.length; offset += BATCH) {
        const chunk = all.slice(offset, offset + BATCH).filter((word) => !excluded.has(headwordKey(word.headword)));
        if (!chunk.length) continue;
        const lexemes = await this.prisma.vocabularyLexeme.findMany({
          where: { listName, listVersion, headword: { in: chunk.map((word) => word.headword) } },
          include: { senses: { where: { qualityStatus: 'ready' }, include: { contexts: { where: { qualityStatus: 'ready' } } } } },
        });
        const byHeadword = new Map(lexemes.map((row) => [row.headword, row]));
        for (const word of chunk) {
          const lexeme = byHeadword.get(word.headword);
          if (!lexeme) continue;
          const sense = lexeme.senses.find((candidate) => learningAssetQuality({
            headword: lexeme.headword,
            translation: candidate.translation,
            definition: candidate.definition,
            contexts: candidate.contexts,
          }).publishable);
          if (sense) return { lexeme, sense, word, listName, listVersion };
        }
      }
    }
    return null;
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

    // 今天学的排在前面，抽查的旧词跟在后面 —— 学生先答熟悉的，节奏不被打断。
    const sampled = await this.sampleReviewItems(
      studentId,
      tested.map((item) => item.senseId),
      REVIEW_SAMPLE_SIZE,
      tested.map((item) => String((item.contentSnapshot as { headword?: string } | null)?.headword ?? '')),
    );
    const paper = [
      ...tested.map((item) => ({
        senseId: item.senseId,
        source: item.source,
        contextId: item.contextId,
        masteryBefore: item.masteryBefore,
        contentVersion: item.contentVersion,
        contentSnapshot: item.contentSnapshot as any,
      })),
      ...sampled,
    ];
    const cards = paper.map((item) => item.contentSnapshot as unknown as FrozenCard);
    let created: any;
    try {
      created = await this.prisma.vocabularyV2Session.create({
      data: {
        sessionKey,
        studentId,
        date: daily.date,
        sessionType: 'formal_test',
        mode: 'teacher_list',
        status: 'in_progress',
        version: `${daily.version}-TEST-001`,
        target: paper.length,
        settingsSnapshot: { dailySessionId: daily.id, questionTypes: ['spelling', 'meaning_choice'] },
        sourceSummary: {
          dailySessionId: daily.id,
          frozenItemCount: tested.length,
          reviewSampleCount: sampled.length,
        },
        items: {
          create: paper.map((item, index) => ({
            ...item,
            position: index + 1,
            questionSnapshot: buildFormalQuestion(cards[index], index, cards) as any,
          })),
        },
      },
      include: { items: { orderBy: { position: 'asc' } } },
      });
    } catch (error) {
      // 学完回调和首页「开始测试」同时到：sessionKey 唯一，后到的回读那一份（VOC01）。
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const raced = await this.prisma.vocabularyV2Session.findUnique({
        where: { sessionKey },
        include: { items: { orderBy: { position: 'asc' } } },
      });
      if (!raced) throw error;
      return this.testSessionView(raced);
    }
    return this.testSessionView(created);
  }

  /**
   * 抽查题：从学生**学过**的词里挑最久没被考过的几个。
   *
   * 规矩：
   *   · `reps > 0` —— 只挑真学过的。被推送过但一张卡都没翻的不算，
   *     那些由「稍后再学」那条路捞回学词队列，不该直接进考卷。
   *   · `masteryStage < 8` —— 学生自己点过「我会了」的不再打扰。
   *   · 排除今天这份卷子里已有的词，免得同一个词考两遍。
   *   · 例句按 `reps + 1` 取 —— 复习时看到的是**换过的**句子，不是背过的
   *     那一句（`contextForEncounter`，2026-09-08 加的）。
   *
   * 没有可抽的（新生第一天、词全掌握了）就返回空数组，考卷照常只考今天的。
   */
  private async sampleReviewItems(studentId: string, excludeSenseIds: string[], size: number, excludeHeadwords: string[] = []) {
    if (size <= 0) return [];
    const owned = await this.prisma.studentVocabularySense.findMany({
      where: {
        studentId,
        inNotebook: true,
        removedAt: null,
        reps: { gt: 0 },
        masteryStage: { lt: 8 },
        senseId: { notIn: excludeSenseIds },
      },
      include: { sense: { include: { lexeme: true, contexts: { where: { qualityStatus: 'ready' } } } } },
      // 挑 3 个不需要把整本单词本读进来；200 个足够排出「最久没考」的头部
      take: 200,
      orderBy: { updatedAt: 'asc' },
    });
    // 同一拼写的另一个词义不抽（老师强制重推的词可能在旧词里有别的词义）：
    // 一张卷里同一个拼写出两次，一题的回顾就泄露另一题的答案（VOC04）。
    const blockedHeadwords = new Set(excludeHeadwords.map(headwordKey).filter(Boolean));
    const usable = owned.filter(
      (row) => row.sense?.lexeme?.headword
        && String(row.sense.translation ?? '').trim()
        && !blockedHeadwords.has(headwordKey(row.sense.lexeme.headword)),
    );
    if (!usable.length) return [];

    // 「最久没被考过」—— 查这些词上一次出现在正式测试里是什么时候。
    // 从没考过的排最前（时间当 0）。
    const lastTested = new Map<string, number>();
    const prior = await this.prisma.vocabularyV2SessionItem.findMany({
      where: {
        senseId: { in: usable.map((row) => row.senseId) },
        session: { studentId, sessionType: 'formal_test' },
      },
      select: { senseId: true, createdAt: true },
    });
    for (const row of prior) {
      const at = row.createdAt.getTime();
      if (at > (lastTested.get(row.senseId) ?? 0)) lastTested.set(row.senseId, at);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { englishLevel: true },
    });
    const policy = LEVEL_WORD_POLICY[user?.englishLevel ?? 'olevel'];

    const sampledHeadwords = new Set<string>();
    return usable
      .sort(
        (a, b) =>
          (lastTested.get(a.senseId) ?? 0) - (lastTested.get(b.senseId) ?? 0) ||
          a.senseId.localeCompare(b.senseId),
      )
      .filter((row) => {
        const key = headwordKey(row.sense.lexeme.headword);
        if (sampledHeadwords.has(key)) return false;
        sampledHeadwords.add(key);
        return true;
      })
      .slice(0, size)
      .map((row) => {
        const encounter = (row.reps ?? 0) + 1;
        const context = contextForEncounter(
          row.sense.contexts ?? [],
          encounter,
          policy.contextDifficulty,
          row.sense.lexeme.headword,
        );
        return {
          senseId: row.senseId,
          source: 'review' as V2Source,
          contextId: context?.id ?? null,
          masteryBefore: row.masteryStage,
          contentVersion: row.sense.contentVersion,
          contentSnapshot: this.cardSnapshot({ sense: row.sense, owned: row }, policy.contextDifficulty, encounter) as any,
        };
      });
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

  /**
   * 听写题的音频（VOC04）。客户端只有 sessionId + itemId，服务端按这道题冻结的
   * 词去 WordAudio 取录音；URL、查询串、响应头里都没有单词本身。
   * 只给听写题：普通拼写题念出来就是答案。
   */
  async testItemAudio(studentId: string, sessionId: string, itemId: string) {
    const item = await this.prisma.vocabularyV2SessionItem.findFirst({
      where: { id: itemId, sessionId, session: { studentId, sessionType: { in: ['formal_test', 'retry', 'custom_test'] } } },
      select: { questionSnapshot: true, contentSnapshot: true },
    });
    const question = item?.questionSnapshot as { type?: string } | null;
    if (!item || question?.type !== 'listening_spelling') throw new NotFoundException({ code: 'v2_audio_not_available' });
    const headword = headwordKey(String((item.contentSnapshot as { headword?: string } | null)?.headword ?? ''));
    const audio = headword
      ? await this.prisma.wordAudio.findUnique({ where: { headword }, select: { contentType: true, bytes: true } })
      : null;
    if (!audio) throw new NotFoundException({ code: 'v2_audio_not_available' });
    return { contentType: audio.contentType, bytes: Buffer.from(audio.bytes) };
  }

  async testSession(studentId: string, sessionId: string) {
    const session = await this.prisma.vocabularyV2Session.findFirst({
      where: { id: sessionId, studentId, sessionType: { in: ['formal_test', 'retry', 'custom_test'] } },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!session) throw new BadRequestException({ code: 'v2_test_not_found' });
    return this.testSessionView(session);
  }

  /**
   * 历史成绩页的「正式单词测试」：已交卷的 formal_test 会话，按日期倒序。
   *（2026-09-06 上线验收 P0：那页原来读旧版 VocabQuizAttempt，新版测试根本不出现。）
   */
  async listFormalTests(studentId: string) {
    const rows = await this.prisma.vocabularyV2Session.findMany({
      where: { studentId, sessionType: 'formal_test', status: 'submitted' },
      orderBy: [{ date: 'desc' }, { completedAt: 'desc' }],
      take: 60,
      include: { items: { select: { isCorrect: true } } },
    });
    return {
      tests: rows.map((row) => ({
        sessionId: row.id,
        date: row.date.toISOString().slice(0, 10),
        total: row.target,
        correct: row.items.filter((item) => item.isCorrect === true).length,
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      })),
    };
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
      // 冻结卷里「当天实际学完的新词」与「旧词抽查」各几题（VOC06：各页面只认这份冻结数字）
      newWords: session.items.filter((item: any) => item.source !== 'review').length,
      reviewWords: session.items.filter((item: any) => item.source === 'review').length,
      answered,
      correct: submitted ? correct : null,
      items: session.items.map((item: any) => {
        const question = item.questionSnapshot as AdaptiveQuestion;
        return {
          id: item.id,
          position: item.position,
          status: item.status,
          // 进行中且未答：白名单题面（VOC04）；已答或已交：完整题目 + 卡片，供回顾。
          question: item.status === 'answered' || submitted
            ? question
            : session.sessionType === 'custom_test'
              ? publicAdaptiveQuestion(question)
              : publicFormalQuestion(question as FormalQuestion),
          response: item.status === 'answered' || submitted ? item.response : null,
          isCorrect: item.status === 'answered' || submitted ? item.isCorrect : null,
          card: item.status === 'answered' || submitted ? item.contentSnapshot : null,
          // VOC11：造句题只能确定「用到了目标词」，结果如实说「未评估句子质量」
          ...(question?.type === 'active_use' && (item.status === 'answered' || submitted)
            ? { check: activeUseCheckView(question.answer, (item.response as { value?: unknown } | null)?.value) }
            : {}),
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
        // VOC02：换词请求带回 expectedSenseId（屏幕上这张卡的词义），重试不会误换新词
        senseId: item.senseId,
        position: item.position,
        source: item.source,
        masteryBefore: item.masteryBefore,
        status: item.status,
        // 学生翻这张卡时点的是「有点难 / 记住了 / 我会了」——「背一背」页
        // 据此把难词排到前面（2026-09-10）。
        action: (item.response as any)?.action ?? null,
        card: item.contentSnapshot,
      })),
    };
  }
}
