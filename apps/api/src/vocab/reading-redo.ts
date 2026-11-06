import { gradeMcq } from '../grading/grade';
import { dateOnly, loadSchoolCalendar, nextDate, singaporeDate } from '../common/school-calendar';
import type { PrismaService } from '../common/prisma.service';
import { translateAnswerLetter } from './mistake-humanize';

export const READING_REDO_CAP = 3;
type JsonObject = Record<string, any>;
const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};

/** Everything used to render or grade a redo is frozen at collection time. */
export function freezeRedo(contentValue: unknown, optionsValue: unknown, answerValue: unknown, questionType: string) {
  const content = object(contentValue);
  const answer = typeof answerValue === 'string' ? { text: answerValue } : object(answerValue);
  const taskType = String(content.taskType ?? content.questionType ?? questionType);
  const options = Array.isArray(optionsValue) ? optionsValue : [];
  const objective = questionType === 'mcq' || ['multiple_choice', 'classification', 'true_false_not_given', 'yes_no_not_given', 'matching_information', 'matching_headings',
    'matching_features', 'sentence_completion', 'summary_completion', 'note_completion', 'table_completion', 'flow_chart_completion', 'diagram_label_completion'].includes(taskType);
  return { version: 1, questionType, taskType, stem: String(content.stem ?? ''),
    passage: String(content.passage ?? ''), passageTitle: String(content.passageTitle ?? ''),
    options, answer, gradingContent: content, objective };
}

export type RedoSnapshot = ReturnType<typeof freezeRedo>;
export function redoSnapshot(value: unknown): RedoSnapshot | null {
  const v = object(value);
  return v.version === 1 && typeof v.stem === 'string' && typeof v.passage === 'string'
    && typeof v.objective === 'boolean' && Array.isArray(v.options) && v.answer && v.gradingContent
    ? v as RedoSnapshot : null;
}

export function redoOptions(snapshot: RedoSnapshot): Array<{ key: string; text: string }> {
  if (snapshot.options.length) return snapshot.options.map((o: any) => ({ key: String(o.key), text: String(o.text ?? o.key) }));
  if (snapshot.taskType === 'true_false_not_given' || snapshot.taskType === 'yes_no_not_given') {
    return (snapshot.taskType === 'true_false_not_given' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']).map((text) => ({ key: text, text }));
  }
  if (snapshot.taskType === 'matching_information') return [...new Set([...snapshot.passage.matchAll(/Paragraph\s+([A-Z])\b/g)].map((m) => m[1]))].sort().map((key) => ({ key, text: key }));
  return [];
}

export function gradeRedo(snapshot: RedoSnapshot, answer: string): boolean {
  if (snapshot.questionType === 'mcq') return gradeMcq({ marks: 1, selectedOption: null, textAnswer: answer,
    snapshotOptions: snapshot.options, snapshotContent: snapshot.gradingContent, questionOptions: [], answerContent: snapshot.answer }).isCorrect === true;
  const norm = (s: string) => translateAnswerLetter(snapshot.taskType, s).trim().toLowerCase().replace(/\s+/g, ' ');
  // 卷子冻结时写了 accept（如 'twelve litres' / '12 litres'）就都算对（2026-11-06 Codex 审查）。
  const accept = Array.isArray((snapshot.answer as any).accept) ? (snapshot.answer as any).accept as unknown[] : [];
  const accepted = [snapshot.answer.text, ...accept].filter((s): s is string => typeof s === 'string' && s.trim() !== '').map(norm);
  return accepted.includes(norm(answer));
}

export function nextTeachingDate(from: string, teaches: (date: string) => boolean): string {
  let date = nextDate(from, 1);
  while (!teaches(date)) date = nextDate(date, 1);
  return date;
}

export const redoSourceKey = (studentId: string, id: string, date: string) => `reading-redo:${studentId}:${id}:${date}`;
export const redoReferenceSourceKey = (studentId: string, id: string, date: string) => `reading-redo-ref:${studentId}:${id}:${date}`;
// Preserve case and punctuation: comparison must not turn a rewritten answer into the first answer.
export const normalizeRedoAnswer = (answer: string) => answer.normalize('NFKC').trim().replace(/\s+/g, ' ');

function readingRedoDueWhere(date: string) {
  const start = new Date(`${date}T00:00:00+08:00`);
  return { createdAt: { lt: start }, OR: [{ resolved: false }, { resolvedAt: { gte: start } }] };
}

/** Input is ordered oldest first. Both individual and class reads use this manifest. */
function readingRedoEntries<T extends { paperQuestionId: string | null; redoSnapshot: unknown }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.paperQuestionId && redoSnapshot(r.redoSnapshot)).slice(0, READING_REDO_CAP);
}

function readingRedoCompletion<T extends { id: string }>(studentId: string, date: string, entries: T[], evidence: readonly { sourceKey: string }[]) {
  const sourceKeys = new Set(evidence.map((e) => e.sourceKey));
  const completedIds = new Set(entries.filter((r) => sourceKeys.has(redoSourceKey(studentId, r.id, date))).map((r) => r.id));
  return { date, target: entries.length, progress: completedIds.size, entries, completedIds };
}

/** Read one class/day in bounded pages, never one query per student. The caller
 * can supply its already-loaded calendar. Keep only the capped daily manifests
 * in memory; invalid legacy snapshots must not hide later eligible questions. */
export async function readingRedoStatesForDay(
  prisma: Pick<PrismaService, 'mistakeEntry' | 'learningEvidence' | 'classEnrollment' | 'classNoSchoolDay'>,
  studentIds: string[], date: string,
  calendar?: { isTeachingDay: (studentId: string, date: string) => boolean },
) {
  const school = calendar ?? await loadSchoolCalendar(prisma, studentIds, date, date);
  const ids = [...new Set(studentIds)].filter((id) => school.isTeachingDay(id, date));
  const result = new Map(studentIds.map((id) => [id, { target: 0, progress: 0 }]));
  if (!ids.length) return result;
  type Entry = { id: string; studentId: string; paperQuestionId: string | null; redoSnapshot: unknown };
  const byStudent = new Map<string, Entry[]>(ids.map((id) => [id, []]));
  let afterEntry: { id: string; createdAt: Date } | undefined;
  for (;;) {
    const page = await prisma.mistakeEntry.findMany({
      where: { studentId: { in: ids }, ...readingRedoDueWhere(date),
        ...(afterEntry ? { AND: [{ OR: [
          { createdAt: { gt: afterEntry.createdAt } },
          { createdAt: afterEntry.createdAt, id: { gt: afterEntry.id } },
        ] }] } : {}) },
      select: { id: true, studentId: true, paperQuestionId: true, redoSnapshot: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 500,
    });
    const grouped = new Map<string, Entry[]>();
    for (const row of page) {
      const mine = grouped.get(row.studentId) ?? [];
      mine.push(row); grouped.set(row.studentId, mine);
    }
    for (const [id, rows] of grouped) byStudent.set(id, readingRedoEntries([...(byStudent.get(id) ?? []), ...rows]));
    if (page.length < 500 || [...byStudent.values()].every((entries) => entries.length === READING_REDO_CAP)) break;
    afterEntry = page[page.length - 1];
  }
  const sourceKeys = [...byStudent].flatMap(([id, entries]) => entries.map((r) => redoSourceKey(id, r.id, date)));
  const evidence: Array<{ sourceKey: string }> = [];
  let after: string | undefined;
  while (sourceKeys.length) {
    const page = await prisma.learningEvidence.findMany({
      where: { studentId: { in: ids }, subject: 'reading_question', kind: 'mistake_redo', schoolDate: dateOnly(date),
        sourceKey: { in: sourceKeys }, ...(after ? { id: { gt: after } } : {}) },
      select: { id: true, sourceKey: true }, orderBy: { id: 'asc' }, take: 500,
    });
    evidence.push(...page);
    if (page.length < 500) break;
    after = page[page.length - 1].id;
  }
  for (const [id, entries] of byStudent) {
    const state = readingRedoCompletion(id, date, entries, evidence);
    result.set(id, { target: state.target, progress: state.progress });
  }
  return result;
}

/** A day's manifest is reconstructed from facts at SGT midnight. New mistakes
 * only become due on a LATER teaching day. Resolutions made today stay in this
 * manifest, so answering never pulls a fourth item into today's assignment.
 * No schema field, fake evidence or mutable live PaperQuestion is needed. */
export async function readingRedoState(prisma: Pick<PrismaService, 'mistakeEntry' | 'learningEvidence' | 'classEnrollment' | 'classNoSchoolDay'>, studentId: string, now = new Date()) {
  const date = singaporeDate(now);
  const calendar = await loadSchoolCalendar(prisma, [studentId], undefined, date);
  if (!calendar.isTeachingDay(studentId, date)) return { date, target: 0, progress: 0, entries: [], completedIds: new Set<string>() };
  const rows = await prisma.mistakeEntry.findMany({ where: { studentId, ...readingRedoDueWhere(date) }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const entries = readingRedoEntries(rows);
  const evidence = entries.length ? await prisma.learningEvidence.findMany({ where: { studentId, subject: 'reading_question', kind: 'mistake_redo',
    sourceKey: { in: entries.map((r) => redoSourceKey(studentId, r.id, date)) }, schoolDate: dateOnly(date) } }) : [];
  return readingRedoCompletion(studentId, date, entries, evidence);
}
