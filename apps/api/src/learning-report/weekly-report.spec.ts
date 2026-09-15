import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildWeeklyReport,
  mondayOf,
  readingCell,
  summarizeStudent,
  type DayFacts,
  type ReportInput,
  type StudentFacts,
} from './weekly-report';

/**
 * 学习周报的口径（2026-09-15）。页面上的每一个数都从这里出来，所以口径在这里钉死：
 * 什么算交了、什么算欠、什么算整周没做、各档位按哪份卷子算。
 */

type Reading = NonNullable<DayFacts['reading']>;
const read = (over: Partial<Reading> = {}): Reading => ({
  title: 'The Umbrella',
  level: 'ielts_simplified',
  state: 'completed',
  completed: true,
  awaitingMarking: false,
  pct: 70,
  submittedAt: '2026-09-07T08:00:00.000Z',
  ...over,
});
const notDone = (state: Reading['state'], over: Partial<Reading> = {}): Reading =>
  read({ state, completed: false, pct: null, submittedAt: null, ...over });
const day = (date: string, over: Partial<DayFacts> = {}): DayFacts => ({ date, reading: null, learning: null, test: null, ...over });
const student = (id: string, days: DayFacts[], over: Partial<StudentFacts> = {}): StudentFacts => ({
  id,
  name: id,
  classId: 'c-sec',
  className: 'SEC27W',
  level: 'ielts_simplified',
  registeredOn: '2026-09-07',
  days,
  ...over,
});
const MON = '2026-09-07';
const TUE = '2026-09-08';
const WED = '2026-09-09';
const THU = '2026-09-10';
const FRI = '2026-09-11';

describe('周的边界', () => {
  it('周一开始、周日结束；周日属于前面那个周一', () => {
    expect(mondayOf(MON)).toBe(MON);
    expect(mondayOf('2026-09-13')).toBe(MON);
    expect(mondayOf('2026-09-15')).toBe('2026-09-14');
    expect(addDays(MON, 6)).toBe('2026-09-13');
  });
});

describe('一格阅读算什么', () => {
  const today = WED;
  it('交了（含等老师批）→ done；系统收卷不算交', () => {
    expect(readingCell(day(MON, { reading: read() }), today)).toBe('done');
    expect(readingCell(day(MON, { reading: read({ state: 'awaiting_marking', awaitingMarking: true, pct: null }) }), today)).toBe('done');
    expect(readingCell(day(MON, { reading: notDone('auto_closed') }), today)).toBe('auto_closed');
  });

  it('过去的：写了一半没交 → opened；一眼没看 → missed；没分配 → not_assigned', () => {
    expect(readingCell(day(MON, { reading: notDone('in_progress') }), today)).toBe('opened');
    expect(readingCell(day(MON, { reading: notDone('not_started') }), today)).toBe('missed');
    expect(readingCell(day(MON), today)).toBe('not_assigned');
  });

  it('**今天还没交不算欠**（today）；还没到的日子一律 future', () => {
    expect(readingCell(day(WED, { reading: notDone('not_started') }), today)).toBe('today');
    expect(readingCell(day(WED, { reading: read() }), today)).toBe('done');
    expect(readingCell(day(THU, { reading: read() }), today)).toBe('future');
  });
});

describe('一个学生的一周', () => {
  it('应交 = 过去分配到的天数（今天做完才算）；得分率只算批完的；等批的单独数', () => {
    const s = summarizeStudent(
      student('a', [
        day(MON, { reading: read({ pct: 70 }) }),
        day(TUE, { reading: read({ state: 'awaiting_marking', awaitingMarking: true, pct: null }) }),
        day(WED, { reading: notDone('not_started') }),
        day(THU, { reading: notDone('not_started') }),
        day(FRI),
      ]),
      THU,
    );
    expect(s.readN).toBe(2);
    expect(s.readDue).toBe(3);
    expect(s.readAvg).toBe(70);
    expect(s.readMarked).toBe(1);
    expect(s.awaitingMarking).toBe(1);
  });

  it('**整周没做** = 有应交的阅读，但阅读 / 学词 / 词测一样都没做；学了一部分词不算没做', () => {
    const idle = student('b', [day(MON, { reading: notDone('not_started') }), day(TUE, { reading: notDone('in_progress') })]);
    expect(summarizeStudent(idle, WED).none).toBe(true);
    const someWords = student('c', [day(MON, { reading: notDone('not_started'), learning: { completed: false, itemsDone: 3, items: 10 } })]);
    expect(summarizeStudent(someWords, WED).none).toBe(false);
    // 这周根本没有该交的（比如周一早上、或者没选档）：不算「整周没做」
    expect(summarizeStudent(student('d', [day(MON)]), WED).none).toBe(false);
    expect(summarizeStudent(student('e', [day(MON)], { level: null }), WED).noLevel).toBe(true);
  });

  it('交了阅读、单词一个都没学 → readingNoWords；学了一部分就不算', () => {
    expect(summarizeStudent(student('f', [day(MON, { reading: read() })]), WED).readingNoWords).toBe(true);
    expect(
      summarizeStudent(student('g', [day(MON, { reading: read(), learning: { completed: false, itemsDone: 9, items: 10 } })]), WED).readingNoWords,
    ).toBe(false);
  });

  it('阅读平均低于 30% 才提醒（30% 本身不算）；没批完的卷子不参与', () => {
    expect(summarizeStudent(student('h', [day(MON, { reading: read({ pct: 8 }) }), day(TUE, { reading: read({ pct: 15 }) })]), WED).lowReading).toBe(true);
    expect(summarizeStudent(student('i', [day(MON, { reading: read({ pct: 30 }) })]), WED).lowReading).toBe(false);
    expect(summarizeStudent(student('j', [day(MON, { reading: read({ pct: null, state: 'awaiting_marking', awaitingMarking: true }) })]), WED).lowReading).toBe(false);
  });

  it('词测 0 分单独数；题目数是 0 的卷不算 0 分', () => {
    expect(summarizeStudent(student('k', [day(MON, { test: { submitted: true, correct: 0, items: 10 } })]), WED).zeroTests).toBe(1);
    expect(summarizeStudent(student('l', [day(MON, { test: { submitted: true, correct: 0, items: 0 } })]), WED).zeroTests).toBe(0);
    expect(summarizeStudent(student('m', [day(MON, { test: { submitted: false, correct: 0, items: 10 } })]), WED).testN).toBe(0);
  });

  it('坚持得好 = 该交的全交了、而且至少 3 天', () => {
    const three = [MON, TUE, WED].map((d) => day(d, { reading: read() }));
    expect(summarizeStudent(student('n', three), THU).steady).toBe(true);
    expect(summarizeStudent(student('o', three.slice(0, 2)), THU).steady).toBe(false);
  });
});

describe('一个班 / 全校的一周', () => {
  // 今天是周三。A：周一交 80（那份卷是基础档）、周二交 60（改到标准档）、今天还没交，学词 + 词测 9/10；
  // B（另一个班）：周一没看、周二写了一半 → 整周没做；C：交了两天但只有 20 / 10，单词没学。
  const input: ReportInput = {
    weekStart: MON,
    weekEnd: '2026-09-13',
    today: WED,
    days: [MON, TUE, WED, THU, FRI],
    scope: { classId: null, className: null },
    classes: [{ id: 'c-ial', name: 'IAL27W' }, { id: 'c-sec', name: 'SEC27W' }],
    excluded: { demoAccounts: 2, registeredAfter: 1 },
    generatedAt: '2026-09-09T08:00:00.000Z',
    students: [
      student(
        'A',
        [
          day(MON, { reading: read({ pct: 80, level: 'ielts_simplified' }), learning: { completed: true, itemsDone: 10, items: 10 }, test: { submitted: true, correct: 9, items: 10 } }),
          day(TUE, { reading: read({ pct: 60, level: 'olevel' }) }),
          day(WED, { reading: notDone('not_started', { level: 'olevel' }) }),
          day(THU),
          day(FRI),
        ],
        { level: 'olevel' },
      ),
      student(
        'B',
        [
          day(MON, { reading: notDone('not_started', { level: 'ielts_light' }) }),
          day(TUE, { reading: notDone('in_progress', { level: 'ielts_light' }) }),
          day(WED),
          day(THU),
          day(FRI),
        ],
        { classId: 'c-ial', className: 'IAL27W', level: 'ielts_light' },
      ),
      student('C', [day(MON, { reading: read({ pct: 20 }) }), day(TUE, { reading: read({ pct: 10 }) }), day(WED), day(THU), day(FRI)]),
    ],
  };
  const r = buildWeeklyReport(input);

  it('每天：分配了几人、交了几人、平均分；还没到的日子是空的', () => {
    expect(r.days[0]).toMatchObject({ date: MON, dow: '周一', assigned: 3, readDone: 2, readAvg: 50, learnDone: 1, testDone: 1, testAvg: 90 });
    expect(r.days[2]).toMatchObject({ date: WED, isToday: true, assigned: 1, readDone: 0, readAvg: null });
    expect(r.days[3]).toMatchObject({ date: THU, future: true, assigned: null, readDone: null });
  });

  it('总数：完成率按应交算，今天没交的不进分母', () => {
    expect(r.totals).toMatchObject({
      students: 3,
      joined: 2,
      none: 1,
      readDone: 4,
      readDue: 6,
      readRate: 67,
      readAvg: 43,
      learnDone: 1,
      testDone: 1,
      testAvg: 90,
    });
    expect(r.excluded).toEqual({ demoAccounts: 2, registeredAfter: 1 });
  });

  it('各班：人多的在前；完成率 = 交了 / 应交', () => {
    expect(r.byClass.map((c) => [c.className, c.students, c.readDone, c.readDue, c.readRate, c.none])).toEqual([
      ['SEC27W', 2, 4, 4, 100, 0],
      ['IAL27W', 1, 0, 2, 0, 1],
    ]);
  });

  it('**各难度档按那份卷子的档位算** —— 周中改档的学生，卷子各归各档', () => {
    const lv = Object.fromEntries(r.byLevel.map((l) => [l.level, l]));
    expect(lv.ielts_simplified).toMatchObject({ students: 2, due: 3, done: 3, readRate: 100, readAvg: 37 });
    expect(lv.olevel).toMatchObject({ students: 1, due: 1, done: 1, readAvg: 60 });
    expect(lv.ielts_light).toMatchObject({ students: 1, due: 2, done: 0, readRate: 0, readAvg: null });
  });

  it('跟进名单：整周没做 / 分数低（从低到高）/ 只做阅读没学词', () => {
    expect(r.followUps.none.map((s) => s.id)).toEqual(['B']);
    expect(r.followUps.none[0].opened).toBe(1);
    expect(r.followUps.lowReading.map((s) => [s.id, s.readAvg])).toEqual([['C', 15]]);
    expect(r.followUps.readingNoWords.map((s) => s.id)).toEqual(['C']);
    expect(r.followUps.zeroTests).toEqual([]);
  });

  it('周还没过完 → weekComplete=false（页面把「整周没做」说成「到目前」）；过完了 → true', () => {
    expect(r.weekComplete).toBe(false);
    expect(buildWeeklyReport({ ...input, today: '2026-09-14' }).weekComplete).toBe(true);
  });

  it('逐人表：先按班，同班里交得多的在前', () => {
    expect(r.students.map((s) => s.id)).toEqual(['B', 'A', 'C']);
  });
});
