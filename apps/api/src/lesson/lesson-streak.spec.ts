/**
 * 连续完成天数改成从事实算（2026-09-10）。
 *
 * 修之前：这个数字对每一个学生恒为 0，「已经连续学习 N 天」那行字从
 * 上线到现在一次都没显示过。原因是它数的是 `DailyLessonCompletion` 的
 * `readDoneAt` / `vocabDoneAt`，而那张表自从 V2 词汇模块接管之后就再也
 * 没有被推进过（生产实测 95 行里 92 行建完就没动过）。
 *
 * 所以下面每一条都把 DLC 设成空 —— 那正是生产现在的样子。
 */
import { describe, expect, it, vi } from 'vitest';
import { LessonService } from './lesson.service';

const STUDENT = 'stu-1';
/** 2026-09-10 是周四；09-09 周三、09-08 周二、09-07 周一。 */
const TODAY = new Date('2026-09-10T00:00:00.000Z');

type Read = { date: string; submitSource?: string };
type Vocab = { date: string; sessionType: 'daily_learning' | 'formal_test'; status: string };

function makeSvc(input: {
  reads?: Read[];
  vocab?: Vocab[];
  /** 老口径里已经写实了的完成日（V2 接管之前的试点期） */
  legacy?: string[];
}) {
  const submissionFindMany = vi.fn().mockResolvedValue(
    (input.reads ?? []).map((r) => ({
      assignment: { morningQuizSession: { date: new Date(`${r.date}T00:00:00.000Z`) } },
    })),
  );
  const vocabFindMany = vi.fn().mockResolvedValue(
    (input.vocab ?? []).map((v) => ({
      date: new Date(`${v.date}T00:00:00.000Z`),
      sessionType: v.sessionType,
      status: v.status,
    })),
  );
  const dlcFindMany = vi.fn().mockResolvedValue(
    (input.legacy ?? []).map((d) => ({
      date: new Date(`${d}T00:00:00.000Z`),
      readTarget: 1,
      readDoneAt: new Date(`${d}T02:00:00.000Z`),
      vocabTarget: 12,
      vocabDoneAt: new Date(`${d}T03:00:00.000Z`),
      drillTarget: 0,
      drillDoneAt: null,
      readSource: 'student',
    })),
  );
  const prisma: any = {
    studentSubmission: { findMany: submissionFindMany },
    vocabularyV2Session: { findMany: vocabFindMany },
    dailyLessonCompletion: { findMany: dlcFindMany },
  };
  const svc = new LessonService(prisma, {} as any, {} as any, {} as any);
  const streak = () => (svc as any).lessonStreak(STUDENT, TODAY) as Promise<number>;
  return { streak, submissionFindMany, vocabFindMany, dlcFindMany };
}

/** 一天「整节课完成」的完整事实：交了卷 + 交了正式单词测试。 */
function fullDay(date: string): { read: Read; vocab: Vocab[] } {
  return {
    read: { date },
    vocab: [
      { date, sessionType: 'daily_learning', status: 'completed' },
      { date, sessionType: 'formal_test', status: 'submitted' },
    ],
  };
}

describe('连续完成天数 —— 从事实算', () => {
  it('连着三天交卷 + 交单词测试 → 3 天（DLC 一个字都没写）', async () => {
    const days = ['2026-09-07', '2026-09-08', '2026-09-09'].map(fullDay);
    const { streak, dlcFindMany } = makeSvc({
      reads: days.map((d) => d.read),
      vocab: days.flatMap((d) => d.vocab),
    });
    await expect(streak()).resolves.toBe(3);
    // 老表确实是空的 —— 这个 3 完全来自事实
    expect(await dlcFindMany.mock.results[0].value).toEqual([]);
  });

  it('只交了阅读卷、单词测试没交 → 那天不算', async () => {
    // 09-09 交了卷但正式测试停在 in_progress
    const { streak } = makeSvc({
      reads: [{ date: '2026-09-07' }, { date: '2026-09-08' }, { date: '2026-09-09' }],
      vocab: [
        ...fullDay('2026-09-07').vocab,
        ...fullDay('2026-09-08').vocab,
        { date: '2026-09-09', sessionType: 'daily_learning', status: 'completed' },
        { date: '2026-09-09', sessionType: 'formal_test', status: 'in_progress' },
      ],
    });
    // 09-09 掉了，剩 09-08 + 09-07；中间空的那个工作日被冻结吸收，连胜还活着
    await expect(streak()).resolves.toBe(2);
  });

  it('单词测试交了但那天没交阅读卷 → 那天不算', async () => {
    const { streak } = makeSvc({
      reads: [{ date: '2026-09-09' }],
      vocab: [...fullDay('2026-09-08').vocab, ...fullDay('2026-09-09').vocab],
    });
    await expect(streak()).resolves.toBe(1);
  });

  it('系统没出正式测试（词太少考不起来）→ 学完当天的卡就算完成', async () => {
    const { streak } = makeSvc({
      reads: [{ date: '2026-09-09' }],
      vocab: [{ date: '2026-09-09', sessionType: 'daily_learning', status: 'completed' }],
    });
    await expect(streak()).resolves.toBe(1);
  });

  it('卡没学完、也没有正式测试 → 不算完成', async () => {
    const { streak } = makeSvc({
      reads: [{ date: '2026-09-09' }],
      vocab: [{ date: '2026-09-09', sessionType: 'daily_learning', status: 'in_progress' }],
    });
    await expect(streak()).resolves.toBe(0);
  });

  it('自动收卷的答卷不参与 —— 查询里就把 system_eod 挡在外面', async () => {
    const { streak, submissionFindMany } = makeSvc({ reads: [], vocab: [] });
    await streak();
    const where = submissionFindMany.mock.calls[0][0].where;
    expect(where.submitSource).toEqual({ in: ['student', 'teacher'] });
    expect(where.finalSubmittedAt).toEqual({ not: null });
    // 练习卷不是当天的课
    expect(where.status).toEqual({ not: 'practice' });
    expect(where.studentId).toBe(STUDENT);
  });

  it('老表里真写实过的完成日仍然算数 —— 两个来源取并集', async () => {
    const { streak } = makeSvc({
      // 事实只有 09-09 这一天
      reads: [{ date: '2026-09-09' }],
      vocab: fullDay('2026-09-09').vocab,
      // 09-08 / 09-07 是 V2 接管之前老表写实的
      legacy: ['2026-09-07', '2026-09-08'],
    });
    await expect(streak()).resolves.toBe(3);
  });

  it('同一天两边都算完成也只记一次', async () => {
    const { streak } = makeSvc({
      reads: [{ date: '2026-09-09' }],
      vocab: fullDay('2026-09-09').vocab,
      legacy: ['2026-09-09'],
    });
    await expect(streak()).resolves.toBe(1);
  });

  it('什么都没做 → 0', async () => {
    const { streak } = makeSvc({});
    await expect(streak()).resolves.toBe(0);
  });
});
