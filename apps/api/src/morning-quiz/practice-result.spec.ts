import { describe, expect, it } from 'vitest';

/**
 * 练习交卷结果页的组装口径（2026-08-14 修）。
 *
 * 事故：老师试读基础层，交卷后「逐题回顾」整块空白、连正确答案都看不到。
 * 根因是 submitPractice 用 `scripts.map(...)` 组装 perQuestion —— 而
 * **未作答的题在库里没有 AnswerScript 行**，一题没答就是空数组。
 * getPractice（重访路径）一直是按 paperQuestions 组装的，两条路径口径
 * 不一致，谁先被测到全看运气。
 *
 * 这是本项目的老坑第三次出现（前两次：成绩页「待老师批改」、出手率
 * 分母）。规则固化为：**任何逐题视图的行数必须等于试卷题数，来源是
 * PaperQuestion，答题记录只用来往上贴数据。**
 */

type PQ = { id: string; sortOrder: number; marks: number; snapshotOptions?: any; snapshotContent?: any };
type Script = { id: string; paperQuestionId: string; selectedOption?: string | null; textAnswer?: string | null; autoCorrect?: boolean | null; awardedMarks?: number | null };

/** submitPractice / getPractice 共用的组装逻辑（提取自服务端实现）。 */
function buildPerQuestion(paperQuestions: PQ[], scripts: Script[]) {
  const byPq = new Map(scripts.map((s) => [s.paperQuestionId, s]));
  return paperQuestions.map((pq) => {
    const s = byPq.get(pq.id);
    const sc = (pq.snapshotContent ?? {}) as any;
    let correctKey: string | null =
      typeof sc.correctOption === 'string' ? sc.correctOption
      : typeof sc.correctAnswer === 'string' ? sc.correctAnswer
      : null;
    if (!correctKey && Array.isArray(pq.snapshotOptions)) {
      const c = pq.snapshotOptions.find((o: any) => o?.correct === true);
      if (c?.key) correctKey = String(c.key);
    }
    return {
      paperQuestionId: pq.id,
      sortOrder: pq.sortOrder,
      marks: pq.marks,
      awardedMarks: s?.awardedMarks ?? 0,
      isCorrect: s?.autoCorrect ?? null,
      studentAnswer: s?.selectedOption ?? s?.textAnswer ?? null,
      correctAnswer: correctKey,
    };
  });
}

const paper: PQ[] = [
  { id: 'pq1', sortOrder: 1, marks: 1, snapshotContent: { correctAnswer: 'a lorry' } },
  { id: 'pq2', sortOrder: 2, marks: 1, snapshotContent: { correctAnswer: 'wet wipes' } },
  { id: 'pq3', sortOrder: 3, marks: 1, snapshotOptions: [
      { key: 'A', text: '对', correct: true }, { key: 'B', text: '错', correct: false }] },
  { id: 'pq4', sortOrder: 4, marks: 1, snapshotOptions: [
      { key: 'A', text: 'x', correct: false }, { key: 'B', text: 'y', correct: true }] },
  { id: 'pq5', sortOrder: 5, marks: 1, snapshotOptions: [
      { key: 'A', text: 'p', correct: false }, { key: 'C', text: 'q', correct: true }] },
];

describe('练习结果页 perQuestion', () => {
  it('一题没答：仍然返回全部 5 行，且带正确答案', () => {
    const r = buildPerQuestion(paper, []);
    expect(r).toHaveLength(5);
    expect(r.map((x) => x.correctAnswer)).toEqual(['a lorry', 'wet wipes', 'A', 'B', 'C']);
    expect(r.every((x) => x.studentAnswer === null)).toBe(true);
    expect(r.every((x) => x.awardedMarks === 0)).toBe(true);
  });

  it('答了一部分：行数不变，只有答过的带作答', () => {
    const r = buildPerQuestion(paper, [
      { id: 's1', paperQuestionId: 'pq1', textAnswer: 'a lorry', autoCorrect: true, awardedMarks: 1 },
      { id: 's3', paperQuestionId: 'pq3', selectedOption: 'A', autoCorrect: true, awardedMarks: 1 },
    ]);
    expect(r).toHaveLength(5);
    expect(r[0].studentAnswer).toBe('a lorry');
    expect(r[1].studentAnswer).toBeNull();
    expect(r[2].studentAnswer).toBe('A');
    expect(r.filter((x) => x.awardedMarks > 0)).toHaveLength(2);
  });

  it('全部答对：5 行全带分', () => {
    const r = buildPerQuestion(
      paper,
      paper.map((pq, i) => ({
        id: `s${i}`,
        paperQuestionId: pq.id,
        selectedOption: pq.snapshotOptions ? 'X' : null,
        textAnswer: pq.snapshotOptions ? null : 'ans',
        autoCorrect: true,
        awardedMarks: 1,
      })),
    );
    expect(r).toHaveLength(5);
    expect(r.reduce((n, x) => n + x.awardedMarks, 0)).toBe(5);
  });

  it('行数恒等于试卷题数 —— 与答题记录条数无关', () => {
    for (const n of [0, 1, 3, 5]) {
      const scripts = paper.slice(0, n).map((pq, i) => ({ id: `s${i}`, paperQuestionId: pq.id }));
      expect(buildPerQuestion(paper, scripts)).toHaveLength(paper.length);
    }
  });

  it('多出来的孤儿答题记录不会凭空造出第 6 行', () => {
    const r = buildPerQuestion(paper, [
      { id: 'sX', paperQuestionId: 'pq-deleted', textAnswer: '旧卷残留' },
    ]);
    expect(r).toHaveLength(5);
    expect(r.every((x) => x.studentAnswer === null)).toBe(true);
  });
});
