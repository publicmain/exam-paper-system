import type { DayFacts, StudentFacts } from './weekly-report';
import { isTeachingDay } from '../common/school-calendar';

export type TaskState = 'not_started' | 'in_progress' | 'submitted' | 'marked' | 'not_assigned';
export function buildTeacherToday(input: {
  classId: string; className: string; date: string; classNoSchoolDay: boolean;
  students: StudentFacts[]; recentByStudent: Map<string, string[]>; warned: Set<string>;
  warnings?: Array<{ id: string; userId: string; title: string; body: string | null; createdAt: Date }>;
}) {
  const students = input.students.map((s) => {
    const day = s.days.find((d) => d.date === input.date)!;
    const noSchoolDay = Boolean(day.noSchoolDay);
    const required = isTeachingDay(input.date, noSchoolDay);
    const redoPending = Boolean(day.reading?.completed && (day.reading.redoDone ?? 0) < (day.reading.redoRequired ?? 0));
    const reading: TaskState = redoPending ? 'in_progress' : day.reading?.completed ? day.reading.awaitingMarking ? 'submitted' : 'marked'
      : day.reading ? day.reading.state === 'in_progress' ? 'in_progress' : 'not_started' : 'not_assigned';
    const words: TaskState = day.learning?.completed ? 'submitted' : day.learning?.itemsDone ? 'in_progress' : s.level ? 'not_started' : 'not_assigned';
    const test: TaskState = day.test?.submitted ? 'marked' : day.testRequired === false ? 'not_assigned'
      : day.test?.answered ? 'in_progress' : s.level ? 'not_started' : 'not_assigned';
    const recent = (input.recentByStudent.get(s.id) ?? []).map((date) => s.days.find((d) => d.date === date)).filter((d): d is DayFacts => Boolean(d));
    const lowReadingDates = recent.filter((d) => d.reading?.pct != null && d.reading.pct < 50).map((d) => d.date);
    const lowTestDates = recent.filter((d) => d.test?.submitted && d.test.items > 0 && d.test.correct / d.test.items < 0.5).map((d) => d.date);
    const warnedThisWeek = input.warned.has(s.id);
    const pending = s.pendingMarking ?? [];
    const pendingSubjective = pending.reduce((n, p) => n + p.questions, 0);
    const reasons: string[] = [];
    if (required) {
      if (redoPending) reasons.push('阅读错题没重做完');
      else if (reading === 'not_started' || reading === 'in_progress') reasons.push('阅读没交');
      if (words === 'not_started' || words === 'in_progress') reasons.push('新词没学完');
      if (test === 'not_started' || test === 'in_progress') reasons.push('词测没交');
    }
    const unfinished = reasons.length > 0;
    if (pendingSubjective) reasons.push(`待批 ${pendingSubjective} 题`);
    if (lowReadingDates.length) reasons.push(`近三个上课日有 ${lowReadingDates.length} 天阅读不到一半`);
    if (lowTestDates.length) reasons.push(`近三个上课日有 ${lowTestDates.length} 天词测不到一半`);
    if (warnedThisWeek) reasons.push('本周被提醒过');
    const needsAttention = unfinished || pendingSubjective > 0 || lowReadingDates.length > 0 || lowTestDates.length > 0 || warnedThisWeek;
    return {
      id: s.id, name: s.name, noSchoolDay, teachingDay: required, reading, words, test,
      pendingSubjective, pendingSubmissions: pending.map((p) => p.submissionId),
      lowReadingCount: lowReadingDates.length, lowTestCount: lowTestDates.length, lowReadingDates, lowTestDates,
      warnedThisWeek, unfinished, needsAttention, reasons,
      warnings: (input.warnings ?? []).filter((w) => w.userId === s.id).map((w) => ({ id: w.id, title: w.title, body: w.body ?? '', createdAt: w.createdAt.toISOString() })),
      readingSubmissionId: day.reading?.submissionId ?? null,
    };
  }).sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention) || Number(b.warnedThisWeek) - Number(a.warnedThisWeek) || b.lowReadingCount + b.lowTestCount - a.lowReadingCount - a.lowTestCount || Number(b.unfinished) - Number(a.unfinished) || a.name.localeCompare(b.name, 'zh'));
  return {
    classId: input.classId, className: input.className, date: input.date, noSchoolDay: input.classNoSchoolDay, students,
    totals: { unfinished: students.filter((s) => s.unfinished).length, pending: students.reduce((n, s) => n + s.pendingSubmissions.length, 0), attention: students.filter((s) => s.needsAttention).length },
  };
}
