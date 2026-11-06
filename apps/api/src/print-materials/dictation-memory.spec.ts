import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { dateOnly } from '../common/school-calendar';
import { buildFormalQuestion } from '../vocab-v2/formal-test';
import { orderedEvidence, unresolvedVocabularyMistake } from '../vocab-v2/mastery';
import { VocabularyMemoryService } from '../vocab-v2/vocabulary-memory.service';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from '../vocab-v2/testing/vocab-fixtures';
import { DictationService, type Entry } from './dictation.service';

const teacher = { id: 'teacher', role: 'teacher' };
const TODAY = '2026-11-05';
const scheduleFields = ['due', 'stability', 'difficulty', 'elapsedDays', 'scheduledDays', 'reps', 'lapses', 'lastReview'] as const;
const schedule = (row: Record<string, any>) => Object.fromEntries(scheduleFields.map((key) => [key, row[key]]));
const input = (requestId = 'request_0001', wrongSenseIds: string[] = []) => ({ requestId, status: 'entered' as const, wrongSenseIds });

async function setup() {
  const db = newDb(); const studentId = seedStudent(db, { dailyTarget: 5 });
  db.seed('classEnrollment', { classId: 'class-1', userId: teacher.id, role: 'subject_teacher' });
  const words = seedOfficialWords(db, 'ngsl', 1001, 2);
  seedOfficialWords(db, 'ngsl', 1801, 20);
  db.seed('vocabularyV2Session', { id: 'learned', studentId, sessionKey: `v2:${studentId}:2026-11-04:daily`, status: 'completed' });
  words.forEach((word, index) => db.seed('vocabularyV2SessionItem', {
    sessionId: 'learned', senseId: word.senseId, position: index + 1, status: 'completed',
    contentSnapshot: { headword: word.headword, translation: `词义${index}` },
  }));
  const memory = new VocabularyMemoryService(db as any);
  const svc = new DictationService(db as any, new AuditService(db as any), memory);
  const sheet = (await svc.generate(teacher, 'class-1', '2026-11-04', TODAY)).sheet!;
  const save = (entry: Entry = input()) => svc.save(teacher, 'class-1', sheet.id, studentId, entry);
  const card = (senseId = words[0].senseId) => db.rows('studentVocabularySense', { studentId, senseId })[0];
  const prior = (date = '2026-11-02') => memory.record({
    studentId, senseId: words[0].senseId, kind: 'formal_first', subject: 'vocab_sense',
    sourceKey: `prior:${date}`, isCorrect: true, hinted: false, schoolDate: dateOnly(date), occurredAt: sgtNoon(date),
  });
  return { db, studentId, words, memory, svc, sheet, save, card, prior };
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T01:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('默写与复习调度（真实服务 + 内存事务行锁，零数据库）', () => {
  it('默写错次教学日到期；今天不提前加入，翌日进入固定总量的复习候选', async () => {
    const { db, studentId, words, save, card } = await setup();
    await save(input(undefined, [words[0].senseId]));
    expect(card()).toMatchObject({ due: dateOnly('2026-11-06'), scheduledDays: 1, reps: 1 });
    const vocab = makeService(db);
    expect((await vocab.startDailySession(studentId, sgtNoon(TODAY))).settings.reviewWords).toBe(0);
    const daily = await vocab.startDailySession(studentId, sgtNoon('2026-11-06'));
    expect(daily.items).toHaveLength(4);
    expect(daily.settings.reviewWords).toBe(1);
    const frozen = db.rows('vocabularyV2Session', { id: daily.id })[0].settingsSnapshot.reviewItems;
    expect(frozen.map((item: any) => item.senseId)).toEqual([words[0].senseId]);
    const friday = await setup();
    await friday.db.dictationSheet.update({ where: { id: friday.sheet.id }, data: { heldOn: dateOnly('2026-11-06') } });
    friday.db.seed('classNoSchoolDay', { classId: 'class-1', date: dateOnly('2026-11-09') });
    vi.setSystemTime(new Date('2026-11-06T01:00:00Z'));
    await friday.save(input(undefined, [friday.words[0].senseId]));
    expect(friday.card().due).toEqual(dateOnly('2026-11-10'));
  });

  it('默写对延长间隔，缺考留记录且已有调度完全不变；无调度的词不建卡', async () => {
    const correct = await setup(); await correct.prior();
    const before = correct.card().scheduledDays;
    await correct.save();
    expect(correct.card().scheduledDays).toBeGreaterThan(before);
    expect(correct.card().reps).toBe(2);
    const absent = await setup(); await absent.prior(); const saved = absent.card();
    await absent.save({ ...input(), status: 'absent' });
    expect(absent.card()).toEqual(saved);
    expect(absent.card(absent.words[1].senseId)).toBeUndefined();
    expect(absent.db.rows('learningEvidence', { kind: 'paper_dictation' }).map((e) => e.isCorrect)).toEqual([null, null]);
  });

  it('错改对只用最后一次录入回放，与一次录对的卡片相同；旧记录保留', async () => {
    const amended = await setup(); const direct = await setup();
    await amended.prior(); await direct.prior();
    await amended.save(input(undefined, [amended.words[0].senseId]));
    await amended.save(input('request_0002'));
    await direct.save();
    expect(schedule(amended.card())).toEqual(schedule(direct.card()));
    expect(amended.card().reps).toBe(2);
    expect(unresolvedVocabularyMistake(amended.db.rows('learningEvidence') as any)).toBeNull();
    expect(amended.db.rows('learningEvidence', { kind: 'paper_dictation' })).toHaveLength(4);
    await amended.save(input('request_0003', [amended.words[0].senseId]));
    expect(amended.card()).toMatchObject({ reps: 2, scheduledDays: 1, due: dateOnly('2026-11-06') });
  });

  it('改为缺考撤回原评分并回放其他正式作答；只剩缺考时清除调度，保留学习字段', async () => {
    const prior = await setup(); await prior.prior(); const expected = schedule(prior.card());
    await prior.save(input(undefined, [prior.words[0].senseId]));
    await prior.save({ ...input('request_0002'), status: 'absent' });
    expect(schedule(prior.card())).toEqual(expected);
    const only = await setup(); await only.save(input(undefined, [only.words[0].senseId]));
    await only.db.studentVocabularySense.update({ where: { studentId_senseId: { studentId: only.studentId, senseId: only.words[0].senseId } },
      data: { spellingSkill: 0.5, inNotebook: false } });
    await only.save({ ...input('request_0002'), status: 'absent' });
    expect(only.card()).toMatchObject({ reps: 0, lapses: 0, lastReview: null, stability: 0, scheduledDays: 0, spellingSkill: 0.5, inNotebook: false });
    expect(orderedEvidence(only.db.rows('learningEvidence') as any)).toHaveLength(2);
    expect(unresolvedVocabularyMistake(only.db.rows('learningEvidence') as any)).toBeNull();
    expect((await makeService(only.db).startDailySession(only.studentId, sgtNoon('2026-11-06'))).settings.reviewWords).toBe(0);
  });

  it('晚改录较早的默写会连同之后的正式作答重放，最后复习日期不倒退', async () => {
    const amended = await setup(); const direct = await setup();
    await amended.prior(); await direct.prior();
    await amended.save(input(undefined, [amended.words[0].senseId]));
    await amended.prior('2026-11-06');
    vi.setSystemTime(new Date('2026-11-09T01:00:00Z'));
    await amended.save(input('request_0002'));
    await direct.save(); await direct.prior('2026-11-06');
    expect(schedule(amended.card())).toEqual(schedule(direct.card()));
    expect(amended.card()).toMatchObject({ reps: 3, lastReview: dateOnly('2026-11-06') });
  });

  it('并发重复保存只推进一次；旧请求重试不会覆盖后续改录的卡片', async () => {
    const { db, save, card, words } = await setup();
    await Promise.all([1, 2, 3].map(() => save(input(undefined, [words[0].senseId]))));
    expect(card().reps).toBe(1);
    expect(db.rows('learningEvidence')).toHaveLength(2);
    await save(input('request_0002')); const amended = schedule(card());
    await save(input(undefined, [words[0].senseId]));
    expect(schedule(card())).toEqual(amended);
    expect(card().reps).toBe(1);
    await expect(save(input('request_0002', [words[0].senseId]))).rejects.toMatchObject({ status: 409 });
    expect(schedule(card())).toEqual(amended);
  });

  it.each([false, true])('正式词测与默写同日并发：无死锁、不丢评分，抵达顺序不影响结果（词测先发=%s）', async (formalFirst) => {
    const f = await setup(); const vocab = makeService(f.db); const word = f.words[0];
    const snapshot = { headword: word.headword, translation: '词义', pos: 'noun', definition: '', audioText: word.headword, sentence: null };
    f.db.seed('vocabularyV2Session', { id: 'formal', studentId: f.studentId, sessionKey: 'formal', date: dateOnly(TODAY),
      sessionType: 'formal_test', target: 1, settingsSnapshot: {}, startedAt: sgtNoon(TODAY) });
    f.db.seed('vocabularyV2SessionItem', { id: 'formal-item', sessionId: 'formal', senseId: word.senseId, position: 1,
      contentSnapshot: snapshot, questionSnapshot: buildFormalQuestion(snapshot, 0, [snapshot]) });
    const paper = () => f.save(input(undefined, [word.senseId]));
    const formal = () => vocab.answerTestItem(f.studentId, 'formal', 'formal-item', word.headword, 100, sgtNoon(TODAY));
    await Promise.all(formalFirst ? [formal(), paper()] : [paper(), formal()]);
    const rows = f.db.rows('learningEvidence', { senseId: word.senseId }) as Array<Parameters<VocabularyMemoryService['record']>[0]>;
    expect(rows.map((e) => e.kind).sort()).toEqual(['formal_first', 'paper_dictation']);
    expect(f.card()).toMatchObject({ reps: 2, lastReview: dateOnly(TODAY), scheduledDays: 1, due: dateOnly('2026-11-06') });
    const replay = newDb(); seedStudent(replay); seedOfficialWords(replay, 'ngsl', 1001, 2);
    const memory = new VocabularyMemoryService(replay as any);
    for (const row of [...rows].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) await memory.record(row);
    expect(schedule(f.card())).toEqual(schedule(replay.rows('studentVocabularySense', { senseId: word.senseId })[0]));
  });

  it('正式交卷也先锁学生档案：试题顺序与默写相反，同时保存不死锁且不覆盖调度', async () => {
    const f = await setup(); const vocab = makeService(f.db);
    f.db.seed('vocabularyV2Session', { id: 'formal', studentId: f.studentId, sessionKey: 'formal', date: dateOnly(TODAY),
      sessionType: 'formal_test', target: 2, settingsSnapshot: {}, startedAt: sgtNoon(TODAY) });
    for (const [index, word] of [...f.words].reverse().entries()) {
      const snapshot = { headword: word.headword, translation: '词义', pos: 'noun', definition: '', audioText: word.headword, sentence: null };
      f.db.seed('vocabularyV2SessionItem', { id: `formal-${index}`, sessionId: 'formal', senseId: word.senseId, position: index + 1,
        status: 'answered', isCorrect: true, firstIsCorrect: true, firstAnsweredAt: sgtNoon(TODAY), masteryBefore: 2,
        contentSnapshot: snapshot, questionSnapshot: buildFormalQuestion(snapshot, 0, [snapshot]) });
    }
    const firstWrites: string[] = []; const transact = f.db.$transaction;
    f.db.$transaction = (run: any, opts: any) => transact(async (tx: any) => {
      let first = true;
      for (const [model, method] of [['studentVocabularyProfile', 'upsert'], ['vocabularyV2Session', 'updateMany'], ['dictationSheet', 'update']]) {
        const original = tx[model][method].bind(tx[model]);
        tx[model][method] = (args: any) => { if (first) { firstWrites.push(model); first = false; } return original(args); };
      }
      return run(tx);
    }, opts);
    await Promise.all([vocab.submitTest(f.studentId, 'formal', sgtNoon(TODAY)), f.save(input(undefined, f.words.map((w) => w.senseId)))]);
    expect(firstWrites).toEqual(['studentVocabularyProfile', 'studentVocabularyProfile']);
    expect(f.db.rows('vocabularyV2Session', { id: 'formal' })[0].status).toBe('submitted');
    for (const word of f.words) expect(f.card(word.senseId)).toMatchObject({ reps: 1, due: dateOnly('2026-11-06'), spellingSkill: 1 });
  });

  it('批量每个事务只锁一位学生；不同班级名单反序且与个人保存并发也不死锁', async () => {
    const f = await setup(); const other = seedStudent(f.db, { id: 'other' });
    // Opposite roster insertion orders exercise overlapping student transactions.
    f.db.seed('dictationSheetRow', { sheetId: f.sheet.id, studentId: other, senseIds: f.words.map((w) => w.senseId) });
    f.db.seed('class', { id: 'second' });
    f.db.seed('classEnrollment', { classId: 'second', userId: teacher.id, role: 'subject_teacher' });
    f.db.seed('dictationSheet', { id: 'second-sheet', classId: 'second', learnedDate: dateOnly('2026-11-04'), heldOn: dateOnly(TODAY) });
    for (const studentId of [other, f.studentId]) f.db.seed('dictationSheetRow', { sheetId: 'second-sheet', studentId, senseIds: f.words.map((w) => w.senseId) });
    const traces: string[][] = []; const transact = f.db.$transaction;
    f.db.$transaction = (run: any, opts: any) => transact(async (tx: any) => {
      const trace: string[] = []; traces.push(trace);
      for (const [model, method] of [['studentVocabularyProfile', 'upsert'], ['dictationSheet', 'update'], ['dictationSheetRow', 'update']]) {
        const original = tx[model][method].bind(tx[model]);
        tx[model][method] = (args: any) => { trace.push(model === 'studentVocabularyProfile' ? `profile:${args.where.studentId}` : model); return original(args); };
      }
      return run(tx);
    }, opts);
    await Promise.all([
      f.svc.save(teacher, 'class-1', f.sheet.id, null, input('bulk_0001')),
      f.svc.save(teacher, 'second', 'second-sheet', null, input('bulk_0002')),
      f.save(input('single_001', [f.words[0].senseId])),
    ]);
    expect(traces).toHaveLength(7); // Two manifests + four students + one individual save.
    expect(traces.filter((trace) => trace[0] === 'dictationSheet')).toEqual([['dictationSheet'], ['dictationSheet']]);
    const studentTransactions = traces.filter((trace) => trace[0].startsWith('profile:'));
    expect(studentTransactions).toHaveLength(5);
    for (const trace of studentTransactions) {
      expect(new Set(trace.filter((write) => write.startsWith('profile:'))).size).toBe(1);
      expect(trace).not.toContain('dictationSheet');
    }
    expect(f.db.rows('dictationSheetRow', { sheetId: f.sheet.id, studentId: f.studentId })[0].wrongSenseIds).toEqual([f.words[0].senseId]);
    expect(f.card().reps).toBe(2); // One result from each sheet, not each saved version.
  });

  it.each(['evidence', 'card', 'audit'])('保存到一半失败时勾选、记录、调度、收据全部回滚；原编号可重试（%s）', async (failure) => {
    const f = await setup(); const transact = f.db.$transaction;
    f.db.$transaction = (run: any, opts: any) => transact(async (tx: any) => {
      const [model, method] = failure === 'evidence' ? ['learningEvidence', 'createMany']
        : failure === 'card' ? ['studentVocabularySense', 'upsert'] : ['auditLog', 'create'];
      const original = tx[model][method].bind(tx[model]); let calls = 0;
      tx[model][method] = (args: any) => { if (++calls === (failure === 'audit' ? 1 : 2)) throw new Error('save failed'); return original(args); };
      return run(tx);
    }, opts);
    await expect(f.save()).rejects.toThrow('save failed');
    expect(f.db.rows('learningEvidence')).toEqual([]);
    expect(f.db.rows('studentVocabularySense')).toEqual([]);
    expect(f.db.rows('studentVocabularyProfile')).toHaveLength(1); // Seeded settings only; transaction writes rolled back.
    expect(f.db.rows('dictationSheetRow', { studentId: f.studentId })[0].status).toBe('pending');
    expect(f.db.rows('auditLog', { action: 'dictation.row_saved' })).toEqual([]);
    f.db.$transaction = transact;
    await f.save();
    expect(f.db.rows('learningEvidence')).toHaveLength(2);
    expect(f.db.rows('studentVocabularySense').map((row) => row.reps)).toEqual([1, 1]);
  });
});
