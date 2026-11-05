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
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(translateAnswerLetter(snapshot.taskType, answer)) === norm(translateAnswerLetter(snapshot.taskType, String(snapshot.answer.text ?? '')));
}

export function nextTeachingDate(from: string, teaches: (date: string) => boolean): string {
  let date = nextDate(from, 1);
  while (!teaches(date)) date = nextDate(date, 1);
  return date;
}

export const redoSourceKey = (studentId: string, id: string, date: string) => `reading-redo:${studentId}:${id}:${date}`;

/** A day's manifest is reconstructed from facts at SGT midnight. New mistakes
 * only become due on a LATER teaching day. Resolutions made today stay in this
 * manifest, so answering never pulls a fourth item into today's assignment.
 * No schema field, fake evidence or mutable live PaperQuestion is needed. */
export async function readingRedoState(prisma: Pick<PrismaService, 'mistakeEntry' | 'learningEvidence' | 'classEnrollment' | 'classNoSchoolDay'>, studentId: string, now = new Date()) {
  const date = singaporeDate(now);
  const start = new Date(`${date}T00:00:00+08:00`);
  const calendar = await loadSchoolCalendar(prisma, [studentId], undefined, date);
  if (!calendar.isTeachingDay(studentId, date)) return { date, target: 0, progress: 0, entries: [], completedIds: new Set<string>() };
  const rows = await prisma.mistakeEntry.findMany({ where: { studentId, createdAt: { lt: start },
    OR: [{ resolved: false }, { resolvedAt: { gte: start } }] }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const entries = rows.filter((r) => r.paperQuestionId && redoSnapshot(r.redoSnapshot))
    .slice(0, READING_REDO_CAP);
  const evidence = entries.length ? await prisma.learningEvidence.findMany({ where: { studentId, subject: 'reading_question', kind: 'mistake_redo',
    sourceKey: { in: entries.map((r) => redoSourceKey(studentId, r.id, date)) }, schoolDate: dateOnly(date) } }) : [];
  const completedIds = new Set(entries.filter((r) => evidence.some((e) => e.sourceKey === redoSourceKey(studentId, r.id, date))).map((r) => r.id));
  return { date, target: entries.length, progress: completedIds.size, entries, completedIds };
}
