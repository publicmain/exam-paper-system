/**
 * VOC09 · 来源筛选与展示标签是同一关系 + UI03 · 生词本分页 / 总数 / 筛选（审计 2026-09-11）。
 *
 * VOC09 原症状：标签从「这个词义的事件」读（sense.events where studentId），筛选却从
 * 「归属行的事件」读（owned.events，靠 studentSenseId）；每日推送事件没写 studentSenseId
 * → 标签显示「每日新词」、按「每日新词」筛选 0 个。老师词表的词一条事件都没有，标签被
 * 默认成 level_gap（= 编造来源）。
 *
 * UI03 原症状：默认 30 条、页面没接分页；排序键是 updatedAt（答一次题就跳位置），
 * 翻页会重、会漏；移出末页最后一项后停在空页。
 */
import { describe, expect, it, vi } from 'vitest';
import { makeService, newDb, seedOfficialWords, seedStudent, sgtNoon } from './testing/vocab-fixtures';

// 内存假库逐语句让出事件循环，整套并行跑时单个用例可能超过默认 5 秒；这里只放宽超时，不改断言。
vi.setConfig({ testTimeout: 30_000 });

const MON = sgtNoon('2026-09-07');

function ownWords(db: any, stu: string, count: number, opts: { fromRank?: number; sameDayEvery?: number } = {}) {
  const words = seedOfficialWords(db, 'ngsl', opts.fromRank ?? 1, count);
  words.forEach((word, index) => {
    // 每 sameDayEvery 个共用同一个 firstSeenAt，逼出排序的并列 → 必须有稳定的次序键
    const bucket = opts.sameDayEvery ? Math.floor(index / opts.sameDayEvery) : index;
    db.seed('studentVocabularySense', {
      studentId: stu,
      senseId: word.senseId,
      firstSeenAt: new Date(Date.UTC(2026, 7, 1) + bucket * 60_000),
    });
  });
  return words;
}

async function pages(svc: any, stu: string, filters: Record<string, unknown> = {}) {
  const first = await svc.vocabularyCenter(stu, { ...filters, page: 1 });
  const all = [...first.items];
  for (let page = 2; page <= first.pageCount; page += 1) {
    all.push(...(await svc.vocabularyCenter(stu, { ...filters, page })).items);
  }
  return { first, all };
}

async function walkCursor(svc: any, stu: string, filters: Record<string, unknown> = {}, between?: (items: any[]) => Promise<void>) {
  const all: any[] = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 100; guard += 1) {
    const result = await svc.vocabularyCenter(stu, { ...filters, cursor });
    all.push(...result.items);
    if (between && guard === 0) await between(result.items);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return all;
}

describe('VOC09 来源标签 = 来源筛选', () => {
  it('原样例：每日推送事件没带归属行 —— 标签是每日新词，按每日新词筛也能筛到', async () => {
    const db = newDb();
    const stu = seedStudent(db);
    const [word] = seedOfficialWords(db, 'ngsl', 1801, 1);
    db.seed('studentVocabularySense', { studentId: stu, senseId: word.senseId });
    db.seed('vocabularyCollectionEvent', { studentId: stu, senseId: word.senseId, studentSenseId: null, source: 'level_gap', action: 'daily_pushed' });
    const svc = makeService(db);
    const all = await svc.vocabularyCenter(stu, {});
    expect(all.items[0].source).toBe('level_gap');
    const filtered = await svc.vocabularyCenter(stu, { source: 'level_gap' });
    expect(filtered.total).toBe(1);
    expect(filtered.items.map((row: any) => row.headword)).toEqual([word.headword]);
  });

  it('每日 / 阅读 / 搜索 / 老师 单独与组合筛选，与标签、总数一致；一个词多来源两边都算', async () => {
    const db = newDb();
    const stu = seedStudent(db);
    const [daily, reading, search, teacher, both] = seedOfficialWords(db, 'ngsl', 1801, 5);
    for (const word of [daily, reading, search, teacher, both]) db.seed('studentVocabularySense', { studentId: stu, senseId: word.senseId });
    db.seed('vocabularyCollectionEvent', { studentId: stu, senseId: daily.senseId, source: 'level_gap', action: 'daily_pushed' });
    db.seed('vocabularyCollectionEvent', { studentId: stu, senseId: reading.senseId, source: 'reading_lookup', action: 'learn', sourceTitle: 'Mon reading' });
    db.seed('vocabularyCollectionEvent', { studentId: stu, senseId: search.senseId, source: 'search', action: 'learn' });
    // 老师词表的历史词：一条事件都没有，只有学习会话里的那张卡（真实证据）
    db.seed('vocabularyV2Session', { id: 'sess-t', sessionKey: 'k-t', studentId: stu, date: new Date('2026-09-01T00:00:00.000Z'), sessionType: 'daily_learning', mode: 'teacher_list', version: 'v', target: 1, settingsSnapshot: {}, sourceSummary: {} });
    db.seed('vocabularyV2SessionItem', { sessionId: 'sess-t', senseId: teacher.senseId, position: 1, source: 'teacher_list', masteryBefore: 1, contentVersion: 1, contentSnapshot: {} });
    db.seed('vocabularyCollectionEvent', { studentId: stu, senseId: both.senseId, source: 'level_gap', action: 'daily_pushed' });
    db.seed('vocabularyCollectionEvent', { studentId: stu, senseId: both.senseId, source: 'reading_lookup', action: 'later' });
    const svc = makeService(db);

    const all = await svc.vocabularyCenter(stu, {});
    const label = (headword: string) => all.items.find((row: any) => row.headword === headword)!;
    expect(label(daily.headword).source).toBe('level_gap');
    expect(label(teacher.headword).source).toBe('teacher_list');
    expect(label(both.headword).sources).toEqual(['level_gap', 'reading_lookup']);

    const by = async (source: string) => (await svc.vocabularyCenter(stu, { source })).items.map((row: any) => row.headword).sort();
    expect(await by('level_gap')).toEqual([daily.headword, both.headword].sort());
    expect(await by('reading_lookup')).toEqual([reading.headword, both.headword].sort());
    expect(await by('search')).toEqual([search.headword]);
    expect(await by('teacher_list')).toEqual([teacher.headword]);
    expect(await by('level_gap,search')).toEqual([daily.headword, both.headword, search.headword].sort());
    // 每一行的可见标签都能在筛选里找回自己
    for (const row of all.items) {
      for (const source of row.sources) expect(await by(source)).toContain(row.headword);
    }
    // 按文章筛：走同一条关系
    expect((await svc.vocabularyCenter(stu, { article: 'Mon reading' })).items.map((row: any) => row.headword)).toEqual([reading.headword]);
  });

  it('没有任何来源证据的词：不编造成「每日新词」，标签为 null，只有 source=unknown 能筛到', async () => {
    const db = newDb();
    const stu = seedStudent(db);
    const [orphan] = seedOfficialWords(db, 'ngsl', 1801, 1);
    db.seed('studentVocabularySense', { studentId: stu, senseId: orphan.senseId });
    const svc = makeService(db);
    const all = await svc.vocabularyCenter(stu, {});
    expect(all.items[0].source).toBeNull();
    expect(all.items[0].sources).toEqual([]);
    expect((await svc.vocabularyCenter(stu, { source: 'level_gap' })).total).toBe(0);
    expect((await svc.vocabularyCenter(stu, { source: 'unknown' })).total).toBe(1);
  });

  it('新建的每日任务 / 老师词表任务：来源事件都带归属行，筛选立刻对得上', async () => {
    const db = newDb();
    const stu = seedStudent(db, { dailyTarget: 5 });
    seedOfficialWords(db, 'ngsl', 1801, 20);
    const svc = makeService(db);
    await svc.startDailySession(stu, MON);
    const events = db.rows('vocabularyCollectionEvent', { studentId: stu, action: 'daily_pushed' });
    expect(events).toHaveLength(5);
    expect(events.every((row: any) => row.studentSenseId)).toBe(true);
    expect((await svc.vocabularyCenter(stu, { source: 'level_gap' })).total).toBe(5);
  });
});

describe('UI03 生词本分页契约', () => {
  it('31 个词：两页 30 + 1，不重不漏，总数与页数正确', async () => {
    const db = newDb();
    const stu = seedStudent(db);
    ownWords(db, stu, 31);
    const svc = makeService(db);
    const { first, all } = await pages(svc, stu);
    expect(first).toEqual(expect.objectContaining({ total: 31, pageSize: 30, pageCount: 2, hasMore: true }));
    expect(all).toHaveLength(31);
    expect(new Set(all.map((row: any) => row.studentSenseId)).size).toBe(31);
    const last = await svc.vocabularyCenter(stu, { page: 2 });
    expect(last).toEqual(expect.objectContaining({ page: 2, hasMore: false, nextCursor: null }));
  });

  it('65 个词、排序有并列：游标翻页与页码翻页顺序一致，全部可达', async () => {
    const db = newDb();
    const stu = seedStudent(db);
    ownWords(db, stu, 65, { sameDayEvery: 7 });
    const svc = makeService(db);
    const byPage = (await pages(svc, stu)).all.map((row: any) => row.studentSenseId);
    const byCursor = (await walkCursor(svc, stu)).map((row: any) => row.studentSenseId);
    expect(byPage).toHaveLength(65);
    expect(new Set(byPage).size).toBe(65);
    expect(byCursor).toEqual(byPage);
  });

  it('500 个词：页码 17 页全部可达；游标一路走完也是 500 个', { timeout: 30_000 }, async () => {
    const db = newDb();
    const stu = seedStudent(db);
    ownWords(db, stu, 500, { sameDayEvery: 20 });
    const svc = makeService(db);
    const { first, all } = await pages(svc, stu);
    expect(first.pageCount).toBe(17);
    expect(new Set(all.map((row: any) => row.studentSenseId)).size).toBe(500);
    expect(new Set((await walkCursor(svc, stu, { pageSize: 100 })).map((row: any) => row.studentSenseId)).size).toBe(500);
  });

  it('移出末页唯一的那一项：再请求这一页 → 回到最后一个非空页，不困在空页', async () => {
    const db = newDb();
    const stu = seedStudent(db);
    ownWords(db, stu, 31);
    const svc = makeService(db);
    const lastPage = await svc.vocabularyCenter(stu, { page: 2 });
    expect(lastPage.items).toHaveLength(1);
    await svc.setNotebookMembership(stu, lastPage.items[0].senseId, false);
    const again = await svc.vocabularyCenter(stu, { page: 2 });
    expect(again).toEqual(expect.objectContaining({ page: 1, requestedPage: 2, clamped: true, total: 30, pageCount: 1 }));
    expect(again.items).toHaveLength(30);
  });

  it('游标翻页中途移出一个已看过的词：后面的不跳过、不重复', async () => {
    const db = newDb();
    const stu = seedStudent(db);
    ownWords(db, stu, 65);
    const svc = makeService(db);
    const seen = await walkCursor(svc, stu, {}, async (firstPage) => {
      await svc.setNotebookMembership(stu, firstPage[3].senseId, false);
    });
    expect(seen).toHaveLength(65);
    expect(new Set(seen.map((row: any) => row.studentSenseId)).size).toBe(65);
  });

  it('筛选后总数准确，筛选选项不因筛选而消失', async () => {
    const db = newDb();
    const stu = seedStudent(db);
    const words = ownWords(db, stu, 40);
    const svc = makeService(db);
    for (const word of words.slice(0, 12)) await svc.setNotebookMembership(stu, word.senseId, false);
    expect((await svc.vocabularyCenter(stu, {})).total).toBe(28);
    expect((await svc.vocabularyCenter(stu, { stage: 'removed' })).total).toBe(12);
    const q = words[20].headword.slice(0, 3);
    const expected = words.slice(12).filter((word) => word.headword.includes(q)).length;
    expect((await svc.vocabularyCenter(stu, { q })).total).toBe(expected);
    const filtered = await svc.vocabularyCenter(stu, { list: 'nawl' });
    expect(filtered.total).toBe(0);
    expect(filtered.filters.lists).toEqual(['ngsl']);
  });
});
