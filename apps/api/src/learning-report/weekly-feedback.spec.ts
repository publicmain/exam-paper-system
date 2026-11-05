import { describe, expect, it } from 'vitest';
import { dateOnly } from '../common/school-calendar';
import { newDb, seedStudent } from '../vocab-v2/testing/vocab-fixtures';
import { LearningReportService } from './learning-report.service';

const NOW = new Date('2026-11-05T12:00:00Z');
const admin = { id: 'a', role: 'admin' };
function setup() {
  const db = newDb();
  seedStudent(db, { id: 's', level: 'olevel', joinedAt: dateOnly('2026-10-01') });
  const reading = (date: string, status = 'marked', marks: number | null = 1, written = 'A thoughtful answer') => {
    db.seed('paper', { id: `p-${date}` });
    db.seed('question', { id: `q-${date}`, questionType: 'short_answer' });
    db.seed('paperQuestion', { id: `pq-${date}`, paperId: `p-${date}`, questionId: `q-${date}`, snapshotContent: { passage: `An original article for ${date}.` } });
    db.seed('paperAssignment', { id: `pa-${date}`, paperId: `p-${date}`, classId: 'class-1' });
    db.seed('morningQuizSession', { paperAssignmentId: `pa-${date}`, classId: 'class-1', date: dateOnly(date) });
    db.seed('studentSubmission', { id: `sub-${date}`, studentId: 's', assignmentId: `pa-${date}`, status, finalSubmittedAt: new Date(`${date}T08:00:00Z`), submitSource: 'student', totalScore: marks });
    db.seed('answerScript', { submissionId: `sub-${date}`, paperQuestionId: `pq-${date}`, textAnswer: written, awardedMarks: marks });
  };
  const test = (date: string, grades: boolean[]) => {
    const at = (time: string) => new Date(`${date}T${time}:00Z`);
    const daily = db.seed('vocabularyV2Session', { studentId: 's', sessionKey: `${date}:daily`, sessionType: 'daily_learning', date: dateOnly(date), createdAt: at('08:01'), completedAt: at('08:02'), status: 'completed' });
    const formal = db.seed('vocabularyV2Session', { studentId: 's', sessionKey: `${date}:formal`, sessionType: 'formal_test', date: dateOnly(date), createdAt: at('08:03'), completedAt: at('08:05'), status: 'submitted', target: grades.length, settingsSnapshot: { dailySessionId: daily.id } });
    grades.forEach((correct, i) => {
      const contentSnapshot = { headword: `apple${i}` };
      db.seed('vocabularyV2SessionItem', { sessionId: daily.id, position: i, senseId: `word-${i}`, status: 'completed', completedAt: at('08:02'), response: { action: 'normal' }, contentSnapshot });
      db.seed('vocabularyV2SessionItem', { sessionId: formal.id, position: i, senseId: `word-${i}`, source: 'new', status: 'answered', completedAt: at('08:04'), response: { value: 'corrected' }, isCorrect: true,
        firstResponse: { value: 'original' }, firstAnsweredAt: at('08:04'), firstIsCorrect: correct, questionSnapshot: { type: 'spelling' }, contentSnapshot });
    });
  };
  const sheet = (date: string, status: string, ids: string[] = ['w1', 'w2'], wrong: string[] = []) => {
    const s = db.seed('dictationSheet', { classId: 'class-1', learnedDate: dateOnly(date), heldOn: dateOnly(date) });
    db.seed('dictationSheetRow', { sheetId: s.id, studentId: 's', status, senseIds: ids, wrongSenseIds: wrong });
  };
  return { db, reading, test, sheet, svc: new LearningReportService(db as never) };
}

describe('每周分开的学习数字（内存事实加载器）', () => {
  it('按首答对题数加权；认真天数复用徽章，待批、零分或词测不足一半不算', async () => {
    const { svc, reading, test } = setup();
    reading('2026-11-02'); test('2026-11-02', [true]);
    reading('2026-11-03', 'submitted', null); test('2026-11-03', [true, false, false]);
    reading('2026-11-04', 'marked', 0); test('2026-11-04', [true, true]);
    reading('2026-11-05', 'marked', 1, ''); test('2026-11-05', [true]);
    const report = await svc.weekly(admin, { classId: 'class-1' }, NOW);
    expect(report.students[0]).toMatchObject({ earnestDays: 1, testFirstCorrect: 5, testFirstTotal: 7, testFirstPct: 71 });
    expect((await svc.weekly(admin, { classId: 'class-1' }, NOW)).students).toEqual(report.students);
  });
  it('未录入、缺考、空名单、未来日期和停课不进入正确率分母；停课不进入应录天数', async () => {
    const { svc, db, reading, sheet } = setup();
    reading('2026-11-02');
    sheet('2026-11-02', 'pending'); sheet('2026-11-03', 'entered', ['w1', 'w2', 'w2'], ['w1', 'unknown']);
    sheet('2026-11-04', 'absent'); sheet('2026-11-05', 'entered'); sheet('2026-11-06', 'entered');
    db.seed('classNoSchoolDay', { classId: 'class-1', date: dateOnly('2026-11-05') });
    const row = (await svc.weekly(admin, { classId: 'class-1' }, NOW)).students[0];
    expect(row).toMatchObject({ dictationCorrect: 1, dictationTotal: 2, dictationPct: 50, dictationEnteredDays: 2, dictationExpectedDays: 3 });
    const empty = setup(); empty.reading('2026-11-02'); empty.sheet('2026-11-03', 'entered', []);
    expect((await empty.svc.weekly(admin, { classId: 'class-1' }, NOW)).students[0]).toMatchObject({ dictationPct: null, dictationExpectedDays: 0, testFirstPct: null, earnestDays: 0, newMastered: 0, unresolvedMistakes: 0 });
  });
  it('周初已掌握不重复新增；练习、自报和提示不算；错词隔天独立正确才消', async () => {
    const { svc, db, reading } = setup(); reading('2026-11-02');
    function proof(senseId: string, date: string, isCorrect = true, extra = {}) {
      db.seed('learningEvidence', { studentId: 's', senseId, kind: 'formal_first', subject: 'vocab_sense', sourceKey: `${senseId}:${date}:${JSON.stringify(extra)}`, schoolDate: dateOnly(date), occurredAt: new Date(`${date}T08:00:00Z`), isCorrect, hinted: false, ...extra });
    }
    proof('old', '2026-10-28'); proof('old', '2026-10-30');
    proof('new', '2026-10-30'); proof('new', '2026-11-03');
    proof('practice', '2026-11-02', true, { kind: 'practice_first' }); proof('practice', '2026-11-05', true, { kind: 'self_report' });
    proof('hinted', '2026-10-30'); proof('hinted', '2026-11-05', true, { hinted: true });
    proof('wrong', '2026-11-02', false); proof('wrong', '2026-11-02', true, { kind: 'mistake_redo' });
    proof('cleared', '2026-11-02', false); proof('cleared', '2026-11-03', true, { kind: 'mistake_redo' });
    proof('absent', '2026-11-02', false, { kind: 'paper_dictation' });
    db.seed('mistakeEntry', { studentId: 's', submissionId: 'read', paperQuestionId: 'read', quizDay: '2026-10-20', createdAt: dateOnly('2026-10-20') });
    db.seed('mistakeEntry', { studentId: 's', submissionId: 'done', paperQuestionId: 'done', quizDay: '2026-10-20', createdAt: dateOnly('2026-10-20'), resolved: true, resolvedAt: dateOnly('2026-11-03') });
    expect((await svc.weekly(admin, { classId: 'class-1' }, NOW)).students[0]).toMatchObject({ mastered: 2, newMastered: 1, unresolvedReading: 1, unresolvedVocabulary: 1, unresolvedMistakes: 2 });
  });
  it('超过一页时不截断阅读错题或掌握历史，重复查询结果不翻倍', async () => {
    const { svc, db, reading } = setup(); reading('2026-11-02');
    for (let i = 0; i < 501; i++) {
      db.seed('mistakeEntry', { studentId: 's', submissionId: `sub-${i}`, paperQuestionId: 'q', quizDay: '2026-10-20', createdAt: dateOnly('2026-10-20') });
      db.seed('learningEvidence', { studentId: 's', senseId: `sense-${i}`, subject: 'vocab_sense', kind: 'formal_first', isCorrect: false, hinted: false,
        sourceKey: `error-${i}`, schoolDate: dateOnly('2026-11-02'), occurredAt: dateOnly('2026-11-02') });
    }
    const reports = await Promise.all([1, 2].map(() => svc.weekly(admin, { classId: 'class-1' }, NOW)));
    for (const r of reports) expect(r.students[0]).toMatchObject({ unresolvedReading: 501, unresolvedVocabulary: 501, unresolvedMistakes: 1002, newMastered: 0 });
  });
});
