import { afterEach, describe, expect, it, vi } from 'vitest';
import { judgeRecall, normalizeRecallSpelling, recallExpected } from './recall-spelling';
import { VocabularyV2Controller } from './vocabulary-v2.controller';
import { REQUIRE_STUDENT_TOKEN } from '../common/student-access';
import { makeService, newDb, seedOfficialWords, seedStudent } from './testing/vocab-fixtures';

const NOW = new Date('2026-11-04T23:59:59Z');
function fixture(headword: unknown = 'decline') {
  const db = newDb();
  const studentId = seedStudent(db);
  const [word] = seedOfficialWords(db, 'ngsl', 1801, 1);
  db.seed('vocabularyV2Session', { id: 'daily', studentId, sessionType: 'daily_learning',
    sessionKey: `v2:${studentId}:2026-11-05:daily`, version: 'v1', date: new Date('2026-11-05'), target: 1, mode: 'level_gap', settingsSnapshot: {}, sourceSummary: {} });
  db.seed('vocabularyV2SessionItem', { id: 'item', sessionId: 'daily', senseId: word.senseId,
    source: 'level_gap', position: 1, masteryBefore: 1, contentSnapshot: { headword, translation: '下降' } });
  const svc = makeService(db);
  const body = { sessionId: 'daily', itemId: 'item', expectedSenseId: word.senseId, typed: 'wrong', hintLevel: 0, attempt: 1 };
  return { db, svc, studentId, body };
}
afterEach(() => vi.unstubAllEnvs());

describe('遮词回忆：精确规范化、错位与提示', () => {
  it.each([
    ['Decline', 'decline'], ['  decline  ', 'decline'], ['take   care\tof', 'take care of'],
    ['don’t', "don't"], ['‘hello’', "'hello'"], ['say “hello”', 'say "hello"'],
    ...['‐', '‑', '‒', '–', '—', '―', '−', '-'].map((dash) => [`well${dash}known`, 'well-known']),
    ['ＴＡＫＥ　ＣＡＲＥ', 'take care'],
  ])('%s 与 %s 一致', (typed, expected) => {
    expect(normalizeRecallSpelling(typed)).toBe(expected);
    expect(judgeRecall(expected, typed, 1).isCorrect).toBe(true);
  });
  it.each([['deCline', null], ['decilne', 3], ['declin', 6], ['declines', 7], ['', 0], ['d decline', 1]])(
    '%s 的首个错位为 %s（从零开始）', (typed, index) => {
      expect(judgeRecall('decline', typed, 1).firstWrongIndex).toBe(index);
    });
  it('短语保留空格，不接受漏空格、错字母或近似拼法', () => {
    expect(judgeRecall('take care', 'takecare', 1)).toMatchObject({ isCorrect: false, firstWrongIndex: 4 });
    expect(judgeRecall('receive', 'recieve', 1).isCorrect).toBe(false);
  });
  it('前三次各露一个前缀字母，第四次显示答案；照打错了也不能通过', () => {
    let state;
    for (let attempt = 1; attempt <= 4; attempt++) {
      state = judgeRecall('decline', 'wrong', attempt, state);
      expect(state.nextPrefix).toBe('decline'.slice(0, Math.min(attempt, 3)));
      expect(state.correctSpelling).toBe(attempt === 4 ? 'decline' : null);
    }
    const wrongCopy = judgeRecall('decline', 'declin', 5, state);
    expect(wrongCopy).toMatchObject({ isCorrect: false, answerRevealed: true });
    expect(judgeRecall('decline', 'DECLINE', 6, wrongCopy)).toMatchObject({ isCorrect: true, answerRevealed: true });
  });
  it.each(['a', 'an', 'a-', "a'", 'a b'])('短词 %s 始终至少留一个字母不露', (word) => {
    let state;
    for (let attempt = 1; attempt <= 3; attempt++) state = judgeRecall(word, '', attempt, state);
    expect(word.slice(state!.nextPrefix.length)).toMatch(/[a-z]/);
  });
  it.each([null, {}, { headword: '' }, { headword: '  ' }, { headword: '单词' }, { headword: '???' }, { headword: 'a'.repeat(121) }])(
    '无可靠词头时跳过：%j', (card) => expect(recallExpected(card)).toBeNull());
});

describe('遮词回忆：仅内存记录、幂等与归属', () => {
  it('默认开启，能力和每卡可用性由接口返回，错位细节写首答，不改能力/完成状态', async () => {
    vi.stubEnv('VOCAB_RECALL_STEP', '');
    const { db, svc, studentId, body } = fixture();
    const view = await svc.dailySession(studentId, NOW);
    expect(view).toMatchObject({ capabilities: { recallStep: true }, items: [{ recall: { available: true, started: false, state: null } }] });
    const result = await svc.submitRecall(studentId, body, NOW);
    expect(result).toMatchObject({ isCorrect: false, firstWrongIndex: 0, nextPrefix: 'd', hintLevel: 1, attempt: 1 });
    expect(db.rows('learningEvidence')).toHaveLength(1);
    expect(db.rows('learningEvidence')[0]).toMatchObject({
      kind: 'practice_first', subject: 'vocab_sense', sourceKey: 'v2item:item:practice_first', senseId: body.expectedSenseId,
      sessionItemId: 'item', isCorrect: false, hinted: false,
      detail: { typed: 'wrong', firstWrongIndex: 0, expectedLength: 7 }, schoolDate: new Date('2026-11-05'),
    });
    expect(db.rows('studentVocabularySense')).toEqual([]);
    expect(db.rows('vocabularyV2SessionItem')[0]).toMatchObject({ status: 'pending', attempts: 0, firstAnsweredAt: null });
    expect((await svc.dailySession(studentId, NOW))?.items[0].recall).toMatchObject({ started: true, state: result });
  });
  it('同序号并发不同答案只接受一个；重发返回原结果，首答永不覆盖', async () => {
    const { db, svc, studentId, body } = fixture();
    const [a, b] = await Promise.all([
      svc.submitRecall(studentId, body, NOW),
      svc.submitRecall(studentId, { ...body, typed: 'decline' }, NOW),
    ]);
    expect(a).toEqual(b);
    expect(db.rows('learningEvidence')).toHaveLength(1);
    const first = db.rows('learningEvidence')[0];
    expect(await svc.submitRecall(studentId, { ...body, typed: 'DECLINE' }, NOW)).toEqual(a);
    expect(db.rows('learningEvidence')[0]).toEqual(first);
    expect(a).toMatchObject({ isCorrect: false });
  });
  it('重答使用唯一序号，服务端保留提示语义；答对不写正式分数/徽章/学习量', async () => {
    const { db, svc, studentId, body } = fixture();
    await svc.submitRecall(studentId, body, NOW);
    const retry = { ...body, typed: 'DECLINE ', attempt: 2, hintLevel: 0 };
    const [a, b] = await Promise.all([svc.submitRecall(studentId, retry, NOW), svc.submitRecall(studentId, retry, NOW)]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ isCorrect: true });
    expect(db.rows('learningEvidence')).toHaveLength(2);
    expect(db.rows('learningEvidence')[0].isCorrect).toBe(false);
    expect(db.rows('learningEvidence')[1]).toMatchObject({ kind: 'practice_retry', sourceKey: 'v2item:item:practice_retry:2', hinted: true, isCorrect: true });
    expect(db.rows('studentVocabularySense')).toEqual([]);
    expect(db.rows('vocabularyV2Session')[0].status).toBe('in_progress');
    await expect(svc.submitRecall(studentId, { ...retry, attempt: 3 }, NOW)).rejects.toMatchObject({ response: { code: 'v2_recall_complete' } });
  });
  it('第四次错误显示答案，照打错仍为错，照打对记为有提示重答', async () => {
    const { db, svc, studentId, body } = fixture();
    for (let attempt = 1; attempt <= 5; attempt++) {
      const result = await svc.submitRecall(studentId, { ...body, attempt }, NOW);
      expect(result).toMatchObject({ isCorrect: false, answerRevealed: attempt >= 4 });
    }
    expect(await svc.submitRecall(studentId, { ...body, attempt: 6, typed: 'decline' }, NOW)).toMatchObject({ isCorrect: true });
    expect(db.rows('learningEvidence')[5]).toMatchObject({ kind: 'practice_retry', hinted: true });
  });
  it('客户端明确报有提示时首答也标记 hinted', async () => {
    const { db, svc, studentId, body } = fixture();
    await svc.submitRecall(studentId, { ...body, hintLevel: 1 }, NOW);
    expect(db.rows('learningEvidence')[0].hinted).toBe(true);
  });
  it('序号跳跃、其他学生、其他任务的卡、正式卷、旧词义都拒绝且无记录', async () => {
    const { db, svc, studentId, body } = fixture();
    await expect(svc.submitRecall(studentId, { ...body, attempt: 2 }, NOW)).rejects.toMatchObject({ response: { code: 'v2_recall_sequence' } });
    await expect(svc.submitRecall('other', body, NOW)).rejects.toThrow();
    await expect(svc.submitRecall(studentId, { ...body, itemId: 'other' }, NOW)).rejects.toThrow();
    await expect(svc.submitRecall(studentId, { ...body, expectedSenseId: 'old' }, NOW)).rejects.toMatchObject({ response: { code: 'v2_item_changed' } });
    await db.vocabularyV2Session.update({ where: { id: 'daily' }, data: { sessionType: 'formal_test' } });
    await expect(svc.submitRecall(studentId, body, NOW)).rejects.toThrow();
    expect(db.rows('learningEvidence')).toEqual([]);
  });
  it('已完成的词拒绝新提交，但允许原序号重放', async () => {
    const { db, svc, studentId, body } = fixture();
    const first = await svc.submitRecall(studentId, body, NOW);
    await db.vocabularyV2SessionItem.update({ where: { id: 'item' }, data: { status: 'completed' } });
    await db.vocabularyV2Session.update({ where: { id: 'daily' }, data: { status: 'completed' } });
    expect(await svc.submitRecall(studentId, body, NOW)).toEqual(first);
    await expect(svc.submitRecall(studentId, { ...body, attempt: 2 }, NOW)).rejects.toMatchObject({ response: { code: 'v2_session_closed' } });
  });
  it('off 关闭能力与入口；接口检查归属后不写任何记录', async () => {
    vi.stubEnv('VOCAB_RECALL_STEP', 'off');
    const { db, svc, studentId, body } = fixture();
    expect(await svc.dailySession(studentId, NOW)).toMatchObject({ capabilities: { recallStep: false }, items: [{ recall: { available: false } }] });
    db.resetWrites();
    expect(await svc.submitRecall(studentId, body, NOW)).toEqual({ enabled: false });
    expect(db.writes).toEqual([]);
    await expect(svc.submitRecall('other', body, NOW)).rejects.toThrow();
  });
  it('缺词头不显示拼写入口，也不记练习结果', async () => {
    const { db, svc, studentId, body } = fixture(null);
    expect((await svc.dailySession(studentId, NOW))?.items[0].recall.available).toBe(false);
    expect(await svc.submitRecall(studentId, body, NOW)).toEqual({ enabled: false });
    expect(db.rows('learningEvidence')).toEqual([]);
  });
  it('记录保存失败时提示进度一起回滚，原序号重试可用', async () => {
    const { db, svc, studentId, body } = fixture();
    const transact = db.$transaction;
    db.$transaction = (run: any) => transact(async (tx: any) => {
      tx.learningEvidence.createMany = async () => { throw new Error('save failed'); };
      return run(tx);
    });
    await expect(svc.submitRecall(studentId, body, NOW)).rejects.toThrow('save failed');
    expect(db.rows('vocabularyV2SessionItem')[0]).toMatchObject({ response: null, hintLevel: 0 });
    db.$transaction = transact;
    expect(await svc.submitRecall(studentId, body, NOW)).toMatchObject({ attempt: 1 });
  });
  it('换词复用格位时保留请求序号，但清除旧词提示；旧首答保留', async () => {
    const { db, svc, studentId, body } = fixture();
    await svc.submitRecall(studentId, body, NOW);
    await db.vocabularyV2SessionItem.update({ where: { id: 'item' }, data: { senseId: 'new-sense', contentSnapshot: { headword: 'care' } } });
    expect((await svc.dailySession(studentId, NOW))?.items[0].recall).toMatchObject({ started: false, state: { attempt: 1, hintLevel: 0, nextPrefix: '' } });
    await svc.submitRecall(studentId, { ...body, expectedSenseId: 'new-sense', attempt: 2, typed: 'care' }, NOW);
    expect(db.rows('learningEvidence')[0]).toMatchObject({ senseId: body.expectedSenseId, isCorrect: false });
    expect(db.rows('learningEvidence')[1]).toMatchObject({ senseId: 'new-sense', kind: 'practice_retry', isCorrect: true, hinted: false });
    await expect(svc.submitRecall(studentId, body, NOW)).rejects.toMatchObject({ response: { code: 'v2_item_changed' } });
  });
  it('换词已读到旧快照时另一页提交拼写，换词事务仍保留最新拼写序号', async () => {
    const db = newDb();
    const studentId = seedStudent(db, { dailyTarget: 5 });
    seedOfficialWords(db, 'ngsl', 1801, 30);
    const svc = makeService(db);
    const daily = await svc.startDailySession(studentId, NOW);
    const item = daily.items[0];
    const transact = db.$transaction;
    let reached!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { reached = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let pauseReplacement = true;
    db.$transaction = async (run: any) => {
      if (pauseReplacement) { pauseReplacement = false; reached(); await gate; }
      return transact(run);
    };
    const replacement = svc.replaceDailyItem(studentId, daily.id, item.id, { expectedSenseId: item.senseId }, NOW);
    await ready;
    try {
      await svc.submitRecall(studentId, { sessionId: daily.id, itemId: item.id, expectedSenseId: item.senseId, typed: 'wrong', attempt: 1, hintLevel: 0 }, NOW);
    } finally { release(); }
    const after = await replacement;
    expect(after.items[0].recall).toMatchObject({ started: false, state: { attempt: 1, hintLevel: 0, nextPrefix: '' } });
    await svc.submitRecall(studentId, { sessionId: daily.id, itemId: item.id, expectedSenseId: after.items[0].senseId,
      typed: after.items[0].card.headword, attempt: 2, hintLevel: 0 }, NOW);
    expect(db.rows('learningEvidence').filter((row) => row.kind === 'practice_first')).toHaveLength(1);
    expect(db.rows('learningEvidence').filter((row) => row.kind === 'practice_retry')).toHaveLength(1);
  });
  it('新接口要求学生本人令牌，与现有学词写入接口一致', () => {
    expect(Reflect.getMetadata(REQUIRE_STUDENT_TOKEN, VocabularyV2Controller.prototype.recall)).toBe(true);
  });
  it.each([{ attempt: 0 }, { attempt: 1.5 }, { hintLevel: -1 }, { typed: 'a'.repeat(1001) }, { attempt: 10001 }])(
    '控制器拒绝无效输入：%j', (invalid) => {
      const controller = new VocabularyV2Controller({ submitRecall: vi.fn() } as any);
      expect(() => controller.recall({ studentAuth: { id: 'student' } } as any,
        { sessionId: 'daily', itemId: 'item', typed: 'a', hintLevel: 0, attempt: 1, ...invalid })).toThrow();
    });
});
