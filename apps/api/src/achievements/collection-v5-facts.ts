import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../common/prisma.service';
import { sgtKey } from './badge-time';
import { demoRules, isDemoAccount, isDemoClass } from '../product/demo-accounts';
import { headwordKey } from '../vocab-v2/unified-vocabulary-rules';
import { validFormalResponse } from './achievement-facts';
import { verifiedPrimaryTopicForArticleKey } from './verified-article-topics';
import { emptyCollectionV5Facts, type CollectionV5Event, type CollectionV5Facts } from './collection-v5-rules';

/** Structural type also accepts a Prisma transaction client. */
type FactsDb = Pick<PrismaService, 'user' | 'studentSubmission' | 'vocabularyV2Session'>;
const PAGE_SIZE = 250;
const object = (value: unknown): Record<string, unknown> => value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const nonblank = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const validAt = (value: unknown, now: Date): value is Date => value instanceof Date && Number.isFinite(value.getTime()) && value <= now;
const sourceDay = (value: Date) => value.toISOString().slice(0, 10);
const synthetic = (value: unknown) => {
  const o = object(value);
  return o.achievementSandbox === true || o.isDemo === true || o.isTest === true || o.synthetic === true || o.fixture === true;
};
const firstEvents = (events: CollectionV5Event[]) => {
  const first = new Map<string, CollectionV5Event>();
  for (const event of events) {
    const old = first.get(event.key);
    if (!old || event.at < old.at || (event.at.getTime() === old.at.getTime() && `${event.submissionId ?? ''}:${event.sessionId ?? ''}` < `${old.submissionId ?? ''}:${old.sessionId ?? ''}`)) first.set(event.key, event);
  }
  return [...first.values()].sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key));
};

/** Identity uses the frozen article body, not mutable question tags or the containing paper ID. */
export function frozenCollectionArticle(snapshot: unknown): { key: string; topic?: string } | null {
  const content = object(snapshot);
  const passage = typeof content.passage === 'string' ? content.passage : object(content.passage).body;
  if (!nonblank(passage)) return null;
  const normalized = passage.normalize('NFKC').replace(/^\s*Paragraph\s+[A-Z0-9]+\s*[:.)]?\s*$/gim, '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized) return null;
  const meta = object(content.achievementArticle);
  const key = `article:${createHash('sha256').update(normalized).digest('hex')}`;
  const frozenTopic = meta.primaryTopicVerified === true && nonblank(meta.primaryTopicId) ? meta.primaryTopicId.trim() : undefined;
  const reviewedTopic = verifiedPrimaryTopicForArticleKey(key);
  // Exact frozen-body manifest fills absent metadata without changing an exam.
  // Conflicting independently reviewed facts must never pick a winner silently.
  const topic = frozenTopic && reviewedTopic && frozenTopic !== reviewedTopic ? undefined : frozenTopic ?? reviewedTopic;
  return { key, ...(topic ? { topic } : {}) };
}

/**
 * Read-only, cursor-paged source facts. No lifetime caps, regrading, inferred topic
 * tags, grants, external requests or writes. Parent transaction can keep this
 * snapshot consistent with serialized award creation.
 */
/** 需要学生自己写的题（简答 / 结构题 / 作文）。题型不明的按客观题处理。 */
function isSubjective(question: { question?: { questionType?: string | null } | null }): boolean {
  const type = question.question?.questionType;
  return typeof type === 'string' && type !== 'mcq';
}

export async function loadCollectionV5Facts(prisma: FactsDb, studentId: string, now = new Date()): Promise<CollectionV5Facts> {
  const user = await prisma.user.findUnique({ where: { id: studentId }, select: { id: true, role: true } });
  if (!user) throw new NotFoundException({ code: 'student_not_found' });
  const facts = emptyCollectionV5Facts();
  // No development escape hatch is included in the production artifact.
  const allowSandbox = false;
  const demo = demoRules();
  if (user.role !== 'student' || (!allowSandbox && isDemoAccount(studentId, demo))) return facts;
  const today = new Date(`${sgtKey(now)}T00:00:00.000Z`);
  const readingTasks: CollectionV5Event[] = [];
  const articleTopics = new Map<string, Set<string>>();
  let after: string | undefined;
  for (;;) {
    const rows = await prisma.studentSubmission.findMany({
      where: { studentId, status: { in: ['submitted', 'marked'] }, submitSource: { in: ['student', 'teacher'] },
        finalSubmittedAt: { not: null, lte: now },
        assignment: { morningQuizSession: { is: { date: { lte: today }, status: { not: 'cancelled' } } } } },
      orderBy: { id: 'asc' }, take: PAGE_SIZE, ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      select: { id: true, finalSubmittedAt: true, status: true, submitSource: true,
        scripts: { select: { paperQuestionId: true, selectedOption: true, textAnswer: true, awardedMarks: true } },
        assignment: { select: { classId: true, morningQuizSession: { select: { date: true, status: true } },
          paper: { select: { config: true, questions: { select: { id: true, snapshotContent: true, question: { select: { questionType: true } } } } } } } } },
    });
    for (const row of rows) {
      const task = row.assignment.morningQuizSession;
      if (!task || task.status === 'cancelled' || !validAt(task.date, today) || !validAt(row.finalSubmittedAt, now) ||
        !['submitted', 'marked'].includes(row.status) || !['student', 'teacher'].includes(row.submitSource ?? '') ||
        sgtKey(row.finalSubmittedAt) < sourceDay(task.date) ||
        (!allowSandbox && (isDemoClass(row.assignment.classId, demo) || synthetic(row.assignment.paper.config)))) continue;
      const answered = new Set(row.scripts.filter((script) => nonblank(script.selectedOption) || nonblank(script.textAnswer)).map((script) => script.paperQuestionId));
      // 2026-09-24 认真做才算（叶老师：糊弄做的不能算进度）。简答题是区分「做了」和「点完交卷」
      // 的唯一可靠信号：用时不行（有学生两三分钟就满分），学词卡片的停留时间也不行（人人一两秒）。
      const subjective = new Set(row.assignment.paper.questions.filter((question) => isSubjective(question)).map((question) => question.id));
      const written = new Set(row.scripts.filter((script) => subjective.has(script.paperQuestionId) && nonblank(script.textAnswer)).map((script) => script.paperQuestionId));
      const marksOf = new Map(row.scripts.filter((script) => subjective.has(script.paperQuestionId)).map((script) => [script.paperQuestionId, script.awardedMarks]));
      // A multi-passage paper can contain several articles. An untouched passage
      // does not become a completed article just because another passage was answered.
      const articles = new Map<string, { topic?: string; questionIds: string[] }>();
      for (const question of row.assignment.paper.questions) {
        if (!allowSandbox && synthetic(question.snapshotContent)) continue;
        const article = frozenCollectionArticle(question.snapshotContent);
        if (!article) continue;
        const old = articles.get(article.key);
        articles.set(article.key, { topic: old?.topic ?? article.topic, questionIds: [...(old?.questionIds ?? []), question.id] });
        if (article.topic) articleTopics.set(article.key, new Set([...(articleTopics.get(article.key) ?? []), article.topic]));
      }
      for (const [key, article] of articles) {
        if (!article.questionIds.some((id) => answered.has(id))) continue;
        const shortAnswers = article.questionIds.filter((id) => subjective.has(id));
        if (shortAnswers.length > 0) {
          // 简答不到一半就交卷 → 不算
          if (shortAnswers.filter((id) => written.has(id)).length * 2 < shortAnswers.length) continue;
          // 还没批改 → 批完再算（批改一般在第二天）
          if (row.status !== 'marked') continue;
          // 批改后简答一分没得（乱写 / 答非所问）→ 不算
          if (shortAnswers.reduce((sum, id) => sum + (Number(marksOf.get(id)) || 0), 0) <= 0) continue;
        }
        readingTasks.push({ key, at: row.finalSubmittedAt, submissionId: row.id, sourceDate: sourceDay(task.date), ...(article.topic ? { topic: article.topic } : {}) });
      }
    }
    if (rows.length < PAGE_SIZE) break;
    after = rows[rows.length - 1].id;
  }
  facts.readings = firstEvents(readingTasks).map((event) => {
    // Contradictory frozen labels are not permission to invent the right topic.
    if ((articleTopics.get(event.key)?.size ?? 0) > 1) { const { topic: _topic, ...rest } = event; return rest; }
    return event;
  });

  type Daily = { key: string; id: string; date: string; event: CollectionV5Event; words: Set<string> };
  const dailies = new Map<string, Daily>();
  type Candidate = { dailyId: string; createdAt: Date; id: string; date: string; completedAt: Date | null;
    completed: boolean; gradeValid: boolean; qualified: boolean; atLeastHalf: boolean; words: Set<string>; event: CollectionV5Event | null };
  const firstFormal = new Map<string, Candidate>();
  after = undefined;
  for (;;) {
    const rows = await prisma.vocabularyV2Session.findMany({
      where: { studentId, sessionType: { in: ['daily_learning', 'formal_test'] }, date: { lte: today }, createdAt: { lte: now } },
      orderBy: { id: 'asc' }, take: PAGE_SIZE, ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      select: { id: true, sessionKey: true, date: true, createdAt: true, sessionType: true, status: true, mode: true,
        target: true, completedAt: true, settingsSnapshot: true, sourceSummary: true,
        items: { select: { id: true, senseId: true, source: true, status: true, completedAt: true, response: true,
          contentSnapshot: true, questionSnapshot: true, isCorrect: true } } },
    });
    for (const row of rows) {
      if (!validAt(row.date, today) || !validAt(row.createdAt, now) ||
        (!allowSandbox && (synthetic(row.settingsSnapshot) || synthetic(row.sourceSummary) || ['demo', 'fixture'].includes(row.mode)))) continue;
      const date = sourceDay(row.date);
      const completedAt = validAt(row.completedAt, now) && row.completedAt >= row.createdAt && sgtKey(row.completedAt) >= date ? row.completedAt : null;
      const wordOf = (item: typeof row.items[number]) => {
        const value = object(item.contentSnapshot).headword;
        return nonblank(value) ? headwordKey(value) : '';
      };
      if (row.sessionType === 'daily_learning') {
        // The final manifest may be smaller after deferrals. We require every
        // remaining item settled, not target == learned count or a cursor hint.
        const settled = row.items.every((item) => ['completed', 'skipped'].includes(item.status) &&
          validAt(item.completedAt, now) && completedAt != null && item.completedAt <= completedAt);
        const learned = row.items.filter((item) => item.status === 'completed' &&
          ['normal', 'hard'].includes(String(object(item.response).action ?? '')) && nonblank(wordOf(item)));
        // An unsupported completed action or a blank learned card is uncertain
        // source data, not a reason to turn a partially corrupt task into a grant.
        const supported = row.items.every((item) => item.status === 'skipped'
          ? object(item.response).action === 'skip'
          : ['normal', 'hard', 'mastered'].includes(String(object(item.response).action ?? '')) && !!wordOf(item));
        if (row.status !== 'completed' || !completedAt || !settled || !supported || learned.length === 0 || !nonblank(row.sessionKey)) continue;
        const event = { key: row.sessionKey, sessionId: row.id, sourceDate: date, at: completedAt, itemIds: learned.map((item) => item.id) };
        dailies.set(row.id, { key: row.sessionKey, id: row.id, date, event, words: new Set(learned.map(wordOf)) });
      } else if (row.sessionType === 'formal_test') {
        const dailyId = object(row.settingsSnapshot).dailySessionId;
        if (!nonblank(dailyId)) continue;
        const completed = row.status === 'submitted' && completedAt != null && row.items.length > 0 && row.target === row.items.length &&
          row.items.every((item) => item.status === 'answered' && validAt(item.completedAt, now) && item.completedAt <= completedAt && validFormalResponse(item.questionSnapshot, item.response));
        const gradeValid = completed && row.items.every((item) => typeof item.isCorrect === 'boolean');
        // Read stored authoritative grading; never recalculate answers against
        // mutable dictionaries and never trust client-supplied percentages.
        const qualified = gradeValid && row.items.filter((item) => item.isCorrect === true).length * 100 >= row.items.length * 80;
        // 2026-09-24：学新词要算进度，当天正式词测第一次作答至少对一半（随手点完卡片、测试瞎蒙的不算）
        const atLeastHalf = gradeValid && row.items.filter((item) => item.isCorrect === true).length * 2 >= row.items.length;
        const event = completed ? { key: dailyId, sessionId: row.id, sourceDate: date, at: completedAt!, itemIds: row.items.map((item) => item.id) } : null;
        const candidate: Candidate = { dailyId, id: row.id, createdAt: row.createdAt, date, completedAt, completed, gradeValid, qualified, atLeastHalf,
          words: new Set(row.items.filter((item) => item.source !== 'review').map(wordOf).filter(Boolean)), event };
        const prior = firstFormal.get(dailyId);
        // Select the first actual formal attempt *before* filtering validity or
        // score. A later passed clone cannot erase an earlier failed/invalid one.
        if (!prior || candidate.createdAt < prior.createdAt || (candidate.createdAt.getTime() === prior.createdAt.getTime() && candidate.id < prior.id)) firstFormal.set(dailyId, candidate);
      }
    }
    if (rows.length < PAGE_SIZE) break;
    after = rows[rows.length - 1].id;
  }
  const completedTests: CollectionV5Event[] = [];
  /** 学完、而且当天正式词测第一次作答至少对一半的每日任务 —— 只有这些算「学新词」进度 */
  const earnestDailyIds = new Set<string>();
  const fullDays: CollectionV5Event[] = [];
  const firstReadingByDate = new Map<string, CollectionV5Event>();
  for (const reading of readingTasks) {
    const previous = firstReadingByDate.get(reading.sourceDate!);
    if (!previous || reading.at < previous.at || (reading.at.getTime() === previous.at.getTime() && reading.key < previous.key)) firstReadingByDate.set(reading.sourceDate!, reading);
  }
  for (const test of firstFormal.values()) {
    const daily = dailies.get(test.dailyId);
    if (!daily || !test.completed || !test.event || test.date !== daily.date || test.event.at < daily.event.at ||
      test.words.size !== daily.words.size || [...daily.words].some((word) => !test.words.has(word))) continue;
    const event = { ...test.event, key: daily.key };
    completedTests.push(event);
    if (test.qualified) facts.tests.push(event);
    if (!test.atLeastHalf) continue;
    earnestDailyIds.add(daily.id);
    const reading = firstReadingByDate.get(daily.date);
    if (reading) fullDays.push({ key: daily.date, sourceDate: daily.date,
      at: new Date(Math.max(reading.at.getTime(), daily.event.at.getTime(), event.at.getTime())),
      submissionId: reading.submissionId, sessionId: event.sessionId, itemIds: [...(daily.event.itemIds ?? []), ...(event.itemIds ?? [])] });
  }
  facts.learningBatches = firstEvents([...dailies.values()].filter((daily) => earnestDailyIds.has(daily.id)).map((daily) => daily.event));
  facts.tests = firstEvents(facts.tests);
  facts.fullDays = firstEvents(fullDays);
  facts.activeDays = firstEvents([...readingTasks, ...facts.learningBatches, ...completedTests].map((event) => ({ ...event, key: sgtKey(event.at) })));
  return facts;
}
