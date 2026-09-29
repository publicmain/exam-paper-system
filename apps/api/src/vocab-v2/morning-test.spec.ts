/**
 * 单词测试挪到第二天早读 + 每天 30 个新词（2026-09-29，叶老师）。见 morning-test.ts。
 * 两个开关都是环境变量；不设时的原行为由 voc06 / voc08 等原有测试守着。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formalTestLocked, formalTestOpensAt, schoolDailyTarget } from './morning-test';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

vi.setConfig({ testTimeout: 30_000 });

const VARS = ['VOCAB_MORNING_TEST_FROM', 'VOCAB_SCHOOL_DAILY_TARGET'] as const;
beforeEach(() => {
  process.env.VOCAB_MORNING_TEST_FROM = '2026-09-29';
});
afterEach(() => {
  for (const key of VARS) delete process.env[key];
});

const TUE = sgtNoon('2026-09-29');
const WED_0829 = new Date('2026-09-30T00:29:00.000Z'); // 新加坡 08:29
const WED_0830 = new Date('2026-09-30T00:30:00.000Z'); // 新加坡 08:30

function setup(dailyTarget = 5) {
  const db = newDb();
  const stu = seedStudent(db, { level: 'olevel', dailyTarget, classId: 'class-1' });
  seedOfficialWords(db, 'ngsl', 1801, 60);
  return { db, stu, svc: makeService(db) };
}

async function learnAll(svc: any, stu: string, now: Date) {
  const session = await svc.startDailySession(stu, now);
  let last: any;
  for (const item of session.items) last = await svc.actOnLearningItem(stu, session.id, item.id, 'normal');
  return { session, last };
}

describe('开考时间', () => {
  it('周二学 → 周三 8:30；周五学 → 下周一 8:30；规则之前的日子不设限', () => {
    expect(formalTestOpensAt('2026-09-29')?.toISOString()).toBe('2026-09-30T00:30:00.000Z');
    expect(formalTestOpensAt('2026-10-02')?.toISOString()).toBe('2026-10-05T00:30:00.000Z');
    expect(formalTestOpensAt('2026-09-28')).toBeNull();
    expect(formalTestLocked('2026-09-29', WED_0829)).toBe(true);
    expect(formalTestLocked('2026-09-29', WED_0830)).toBe(false);
  });

  it('没设变量：原来的行为（不限时、不统一词数）', () => {
    delete process.env.VOCAB_MORNING_TEST_FROM;
    expect(formalTestOpensAt('2026-09-29')).toBeNull();
    expect(formalTestLocked('2026-09-29', TUE)).toBe(false);
    expect(schoolDailyTarget()).toBeNull();
    process.env.VOCAB_SCHOOL_DAILY_TARGET = '30';
    expect(schoolDailyTarget()).toBe(30);
  });
});

describe('当天只学不考，下一个教学日 8:30 起开考', () => {
  // 学完最后一张卡时服务端用的是「现在」—— 钉在周二中午，免得过了 09-30 这条测试就变了
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TUE);
  });
  afterEach(() => vi.useRealTimers());

  it('**学完不当场生成卷子；首页测试是「明早考」、不算今天的任务；8:30 前开不了，8:30 起能开**', async () => {
    const { stu, svc } = setup();
    const { session, last } = await learnAll(svc, stu, TUE);
    expect(last.status).toBe('completed');
    expect(last.generatedTestId).toBeNull();
    expect(last.testOpensAt).toBe('2026-09-30T00:30:00.000Z');

    const tue = await svc.overview(stu, TUE);
    expect(tue.home.test).toEqual(expect.objectContaining({ state: 'not_applicable', reason: 'next_morning', opensAt: '2026-09-30T00:30:00.000Z' }));
    expect(tue.home.words.state).toBe('completed');
    expect(tue.pendingTests).toHaveLength(1);
    expect(tue.pendingTests[0]).toEqual(expect.objectContaining({ generated: false, locked: true, opensAt: '2026-09-30T00:30:00.000Z' }));

    const early = await svc.startFormalTest(stu, session.id, WED_0829).catch((e: any) => e);
    expect(early.getResponse()).toEqual(expect.objectContaining({ code: 'v2_test_opens_next_morning', opensAt: '2026-09-30T00:30:00.000Z' }));

    const wedEarly = await svc.overview(stu, WED_0829);
    expect(wedEarly.pendingTests[0].locked).toBe(true);

    const test = await svc.startFormalTest(stu, session.id, WED_0830);
    expect(test.total).toBe(5);
    const wed = await svc.overview(stu, WED_0830);
    expect(wed.pendingTests[0]).toEqual(expect.objectContaining({ generated: true, locked: false }));
    // 已经生成的卷子不再受时间限制（再开一次原样返回）
    const again = await svc.startFormalTest(stu, session.id, WED_0829);
    expect(again.id).toBe(test.id);
  });

  it('回看某天的学词：卷子还没开考时带上开考时间', async () => {
    const { stu, svc } = setup();
    await learnAll(svc, stu, TUE);
    const view = await svc.reviewDailySession(stu, TUE, '2026-09-29');
    expect(view?.test).toEqual(expect.objectContaining({ generated: false, locked: true, opensAt: '2026-09-30T00:30:00.000Z' }));
  });
});

describe('每天 30 个新词', () => {
  it('设了 VOCAB_SCHOOL_DAILY_TARGET=30：新排的每日任务 30 个词，不看各人存的 10', async () => {
    process.env.VOCAB_SCHOOL_DAILY_TARGET = '30';
    const { stu, svc } = setup(10);
    const session = await svc.startDailySession(stu, TUE);
    expect(session.items).toHaveLength(30);
    const ov = await svc.overview(stu, TUE);
    expect(ov.dailyTarget).toBe(30);
  });
});
