import type { ReadingState } from '../vocab-v2/level-timeline';

/**
 * 学习周报（教师后台，2026-09-15）—— 纯函数部分。
 *
 * 老师 / 领导要回答的是：**这一周谁做了、谁没做、做得怎么样、该找谁**。
 * 以前这件事靠我每周一跑一次只读查询出 PDF；这里把同一套判断搬进后台，打开就是实时的。
 *
 * ## 分工
 *
 * 查库的是 `learning-report.service.ts`：它把每个学生每一天整理成 `DayFacts`，
 * 其中「那天该做哪份阅读」直接用学习总表的 `assignedReadingFor`（与学生首页、
 * 教师「生词」页同一个口径：入班以后、按那天的档位、取消的场次没交不算）。
 * 这里只做判断和汇总，不碰数据库，口径由单测钉死。
 *
 * ## 口径
 *
 *   · **交了阅读** = 学生自己（或老师代）最终交卷；系统到点收卷（`auto_closed`）不算。
 *     等老师批的也算交了，只是没有分数。
 *   · **应交** = 已经过去的、分配给他的阅读天数；今天做完了才算进去，今天还没做不算欠。
 *   · **阅读得分率** 只算已经批完的卷子。
 *   · **学完新词** = 当天的每日新词整组学完；学了一部分单独标出来。
 *   · **单词测试** = 当天的正式词测交了；得分 = 答对题数 / 总题数。
 *   · **整周没做** = 这周有应交的阅读，但阅读、学词、词测一样都没做（学了一部分词也算做了）。
 */

export const LOW_READING_PCT = 30;
/** 该交的全交了、而且至少交了这么多天，才算「坚持得好」 */
export const STEADY_MIN_DAYS = 3;

export type ReadingCell =
  /** 交了（含等老师批） */
  | 'done'
  /** 打开写了一部分，那天结束没交 */
  | 'opened'
  /** 系统到点收卷 —— 不算他交的 */
  | 'auto_closed'
  /** 分配了，一眼没看 */
  | 'missed'
  /** 今天的，还没交（不算欠） */
  | 'today'
  /** 还没到这一天 */
  | 'future'
  /** 那天没有分配给他的阅读 */
  | 'not_assigned';

export interface DayFacts {
  date: string;
  reading: {
    title: string | null;
    level: string;
    state: ReadingState;
    completed: boolean;
    awaitingMarking: boolean;
    /** 有他的答卷行（打开过这份卷子，哪怕一题没写）。共用的 readingState 把「一题没写」算作没开始，周报要分出来 */
    opened: boolean;
    /** 已批完卷子的得分率（0–100）；没批完 / 没交是 null */
    pct: number | null;
    submittedAt: string | null;
  } | null;
  learning: { completed: boolean; itemsDone: number; items: number } | null;
  test: { submitted: boolean; correct: number; items: number } | null;
}

export interface StudentFacts {
  id: string;
  name: string;
  classId: string;
  className: string;
  level: string | null;
  registeredOn: string;
  days: DayFacts[];
}

export interface ReportInput {
  weekStart: string;
  weekEnd: string;
  today: string;
  /** 这一周要显示的日子（周一到周五，加上有课的周末） */
  days: string[];
  students: StudentFacts[];
  scope: { classId: string | null; className: string | null };
  /** 这个老师能选的班 */
  classes: Array<{ id: string; name: string }>;
  excluded: { demoAccounts: number; registeredAfter: number };
  generatedAt: string;
}

const DOW = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function dayOfWeek(key: string): number {
  return new Date(`${key}T00:00:00.000Z`).getUTCDay();
}

export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 这一天所在那周的周一（周一开始、周日结束）。 */
export function mondayOf(key: string): string {
  const dow = dayOfWeek(key);
  return addDays(key, dow === 0 ? -6 : 1 - dow);
}

export function isDateKey(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

export function readingCell(day: DayFacts, today: string): ReadingCell {
  if (day.date > today) return 'future';
  const r = day.reading;
  if (!r) return 'not_assigned';
  if (r.completed) return 'done';
  if (day.date === today) return 'today';
  if (r.state === 'auto_closed') return 'auto_closed';
  if (r.state === 'in_progress' || r.opened) return 'opened';
  return 'missed';
}

const mean = (xs: number[]): number | null => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const rate = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 100) : null);
const pctOf = (correct: number, items: number): number | null => (items > 0 ? Math.round((correct / items) * 100) : null);

export function summarizeStudent(s: StudentFacts, today: string) {
  const cells = s.days.map((d) => {
    const reading = readingCell(d, today);
    const learning: 'done' | 'partial' | 'none' = d.learning?.completed ? 'done' : (d.learning?.itemsDone ?? 0) > 0 ? 'partial' : 'none';
    const testDone = Boolean(d.test?.submitted);
    return {
      date: d.date,
      reading,
      readPct: reading === 'done' ? (d.reading?.pct ?? null) : null,
      awaitingMarking: reading === 'done' && Boolean(d.reading?.awaitingMarking),
      title: d.reading?.title ?? null,
      paperLevel: d.reading?.level ?? null,
      submittedAt: reading === 'done' ? (d.reading?.submittedAt ?? null) : null,
      learning,
      learnItemsDone: d.learning?.itemsDone ?? 0,
      learnItems: d.learning?.items ?? 0,
      test: testDone ? ('done' as const) : ('none' as const),
      testPct: testDone && d.test ? pctOf(d.test.correct, d.test.items) : null,
    };
  });
  const readN = cells.filter((c) => c.reading === 'done').length;
  const readDue = cells.filter((c) => c.reading === 'done' || c.reading === 'opened' || c.reading === 'auto_closed' || c.reading === 'missed').length;
  const learnN = cells.filter((c) => c.learning === 'done').length;
  const learnPartial = cells.filter((c) => c.learning === 'partial').length;
  const testN = cells.filter((c) => c.test === 'done').length;
  const readPcts = cells.filter((c) => c.readPct != null).map((c) => c.readPct as number);
  const testPcts = cells.filter((c) => c.testPct != null).map((c) => c.testPct as number);
  const anyActivity = readN + learnN + testN + learnPartial > 0;
  return {
    id: s.id,
    name: s.name,
    classId: s.classId,
    className: s.className,
    level: s.level,
    registeredOn: s.registeredOn,
    days: cells,
    readN,
    readDue,
    learnN,
    learnPartial,
    testN,
    readAvg: mean(readPcts),
    readMarked: readPcts.length,
    testAvg: mean(testPcts),
    awaitingMarking: cells.filter((c) => c.awaitingMarking).length,
    zeroTests: testPcts.filter((p) => p === 0).length,
    /** 这周有该交的阅读，但一样都没做 */
    none: readDue > 0 && !anyActivity,
    /** 交了阅读，单词一个都没学（连一部分都没有） */
    readingNoWords: readN > 0 && learnN === 0 && learnPartial === 0 && testN === 0,
    lowReading: readPcts.length > 0 && (mean(readPcts) as number) < LOW_READING_PCT,
    steady: readDue >= STEADY_MIN_DAYS && readN === readDue,
    noLevel: !s.level,
  };
}

export type StudentSummary = ReturnType<typeof summarizeStudent>;

export function buildWeeklyReport(input: ReportInput) {
  const today = input.today;
  const students = input.students
    .map((s) => summarizeStudent(s, today))
    .sort((a, b) => a.className.localeCompare(b.className) || b.readN - a.readN || b.testN - a.testN || a.name.localeCompare(b.name, 'zh'));

  const days = input.days.map((date, i) => {
    const future = date > today;
    const cells = students.map((s) => s.days[i]).filter((c) => c && c.date === date);
    const readPcts = cells.filter((c) => c.readPct != null).map((c) => c.readPct as number);
    const testPcts = cells.filter((c) => c.testPct != null).map((c) => c.testPct as number);
    return {
      date,
      dow: DOW[dayOfWeek(date)],
      isToday: date === today,
      future,
      /** 分配到当天阅读的人数 */
      assigned: future ? null : cells.filter((c) => c.reading !== 'not_assigned').length,
      readDone: future ? null : cells.filter((c) => c.reading === 'done').length,
      readAvg: future ? null : mean(readPcts),
      readMarked: readPcts.length,
      learnDone: future ? null : cells.filter((c) => c.learning === 'done').length,
      testDone: future ? null : cells.filter((c) => c.test === 'done').length,
      testAvg: future ? null : mean(testPcts),
    };
  });

  const byClassMap = new Map<string, StudentSummary[]>();
  for (const s of students) byClassMap.set(s.classId, [...(byClassMap.get(s.classId) ?? []), s]);
  const byClass = [...byClassMap.entries()]
    .map(([classId, ss]) => ({
      classId,
      className: ss[0].className,
      students: ss.length,
      joined: ss.filter((s) => s.readN + s.learnN + s.testN + s.learnPartial > 0).length,
      none: ss.filter((s) => s.none).length,
      readDone: ss.reduce((a, s) => a + s.readN, 0),
      readDue: ss.reduce((a, s) => a + s.readDue, 0),
      readRate: rate(ss.reduce((a, s) => a + s.readN, 0), ss.reduce((a, s) => a + s.readDue, 0)),
      testDaysAvg: ss.length ? Math.round((ss.reduce((a, s) => a + s.testN, 0) / ss.length) * 10) / 10 : null,
      readAvg: mean(ss.flatMap((s) => s.days.filter((c) => c.readPct != null).map((c) => c.readPct as number))),
    }))
    .sort((a, b) => b.students - a.students || a.className.localeCompare(b.className));

  // 各难度档按「那份卷子的档位」算 —— 周中改过档的学生，卷子各归各档
  const levelMap = new Map<string, { students: Set<string>; due: number; done: number; pcts: number[] }>();
  for (const s of students) {
    for (const c of s.days) {
      if (!c.paperLevel || c.reading === 'not_assigned' || c.reading === 'future' || c.reading === 'today') continue;
      const row = levelMap.get(c.paperLevel) ?? { students: new Set<string>(), due: 0, done: 0, pcts: [] };
      row.students.add(s.id);
      row.due += 1;
      if (c.reading === 'done') row.done += 1;
      if (c.readPct != null) row.pcts.push(c.readPct);
      levelMap.set(c.paperLevel, row);
    }
  }
  const byLevel = [...levelMap.entries()].map(([level, r]) => ({
    level,
    students: r.students.size,
    due: r.due,
    done: r.done,
    readRate: rate(r.done, r.due),
    readAvg: mean(r.pcts),
    marked: r.pcts.length,
  }));

  const sum = (f: (s: StudentSummary) => number) => students.reduce((a, s) => a + f(s), 0);
  const brief = (s: StudentSummary) => ({ id: s.id, name: s.name, className: s.className, level: s.level, readN: s.readN, readDue: s.readDue, readAvg: s.readAvg, learnPartial: s.learnPartial, zeroTests: s.zeroTests, opened: s.days.filter((c) => c.reading === 'opened').length });

  return {
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    today,
    /** 这一周已经过完了没有（今天在最后一个显示日之后）。没过完时页面把「整周没做」说成「到目前一项没做」 */
    weekComplete: input.days.length ? today > input.days[input.days.length - 1] : true,
    generatedAt: input.generatedAt,
    scope: input.scope,
    classes: input.classes,
    excluded: input.excluded,
    days,
    totals: {
      students: students.length,
      joined: students.filter((s) => s.readN + s.learnN + s.testN + s.learnPartial > 0).length,
      none: students.filter((s) => s.none).length,
      steady: students.filter((s) => s.steady).length,
      readDone: sum((s) => s.readN),
      readDue: sum((s) => s.readDue),
      readRate: rate(sum((s) => s.readN), sum((s) => s.readDue)),
      readAvg: mean(students.flatMap((s) => s.days.filter((c) => c.readPct != null).map((c) => c.readPct as number))),
      learnDone: sum((s) => s.learnN),
      testDone: sum((s) => s.testN),
      testAvg: mean(students.flatMap((s) => s.days.filter((c) => c.testPct != null).map((c) => c.testPct as number))),
      awaitingMarking: sum((s) => s.awaitingMarking),
    },
    byClass,
    byLevel,
    followUps: {
      none: students.filter((s) => s.none).map(brief),
      lowReading: students.filter((s) => s.lowReading).sort((a, b) => (a.readAvg ?? 0) - (b.readAvg ?? 0)).map(brief),
      readingNoWords: students.filter((s) => s.readingNoWords).map(brief),
      zeroTests: students.filter((s) => s.zeroTests > 0).map(brief),
      noLevel: students.filter((s) => s.noLevel).map(brief),
    },
    students,
  };
}

export type WeeklyReport = ReturnType<typeof buildWeeklyReport>;
