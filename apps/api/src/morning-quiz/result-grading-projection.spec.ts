/**
 * S12H —— 逐题判分状态与答案展示契约。
 *
 * 用户第一次真的走阶段 12 验收时抓到的：一道**有确定答案的选择题**在结果页
 * 显示「还在判分」，而两行「正确答案 / 参考答案」内容一模一样。
 *
 * 根因不在前端：`stripUnreleasedScores` 只有**一道整卷级别的分数门**
 * （`scoresReleased(status)`），卷子没判完就把**每一道题**的
 * `awardedMarks` / `autoCorrect` / `isCorrect` 全部置空 —— 包括交卷那一刻
 * `autoGradeScripts` 已经确定性判完的选择题。
 *
 * 这份 spec 钉的是新契约：
 *
 *   · 确定性判完的题**在交卷之后**就该给分，哪怕整卷还等着老师批；
 *   · 真正需要人判的题继续 pending，老师的评语继续不给；
 *   · 交卷之前**一个字的新信息都不能多给**；
 *   · 答案展示是**语义数据**（`primaryKind` / `primaryValue` / `rubricValue`），
 *     API 里不出现任何中文标签，两个值归一化后相等时只发一个。
 *
 * 判分出身**只认服务端自己写的持久化字段**，绝不看客户端传什么：
 *
 *   `markedById != null`                         → 老师判的
 *   `markedById == null && autoCorrect != null`  → 服务端判分路径写的
 *   其中 `markerComment` 以 `[ai-grade]` 开头的 → AI 判的，**不算确定性**
 */
import { describe, it, expect } from 'vitest';
import { stripUnreleasedScores } from './morning-quiz.service';

type Item = {
  paperQuestionId: string;
  questionType: string;
  studentAnswer: string | null;
  awardedMarks: number | null;
  autoCorrect: boolean | null;
  isCorrect: boolean | null;
  markerComment: string | null;
  commentSource: string | null;
  markedById: string | null;
  correctAnswer?: string | null;
  referenceAnswer?: string | null;
  explanation?: string | null;
  marks: number;
};

function mcq(over: Partial<Item> = {}): Item {
  return {
    paperQuestionId: 'pq-mcq',
    questionType: 'mcq',
    studentAnswer: 'A',
    awardedMarks: 1,
    autoCorrect: true,
    isCorrect: true,
    markerComment: null,
    commentSource: null,
    markedById: null,
    correctAnswer: 'A',
    referenceAnswer: null,
    explanation: null,
    marks: 1,
    ...over,
  };
}

function shortAnswer(over: Partial<Item> = {}): Item {
  return {
    paperQuestionId: 'pq-sa',
    questionType: 'short_answer',
    studentAnswer: 'a row of hedges',
    awardedMarks: null,
    autoCorrect: null,
    isCorrect: null,
    markerComment: null,
    commentSource: null,
    markedById: null,
    correctAnswer: null,
    referenceAnswer: 'a row of hedges',
    explanation: null,
    marks: 2,
    ...over,
  };
}

function result(over: {
  status?: string;
  finalSubmittedAt?: Date | null;
  items?: Item[];
} = {}) {
  return {
    status: over.status ?? 'submitted',
    finalSubmittedAt:
      over.finalSubmittedAt === undefined ? new Date('2026-08-30T00:51:00Z') : over.finalSubmittedAt,
    autoScore: 1,
    manualScore: null,
    totalScore: null,
    items: over.items ?? [mcq(), shortAnswer()],
  };
}

const out = (r: ReturnType<typeof result>) => stripUnreleasedScores(r as any) as any;

// ─────────────────────────────────────────────────────────────
// 1. 确定性判分必须活过整卷 pending
// ─────────────────────────────────────────────────────────────

describe('S12H —— 交卷之后，确定性判分不再被整卷 pending 抹掉', () => {
  it('已自动判分的选择题保留 awardedMarks / autoCorrect / isCorrect', () => {
    const r = out(result());
    const item = r.items.find((x: any) => x.paperQuestionId === 'pq-mcq');
    expect(item.awardedMarks, '选择题的得分被整卷 pending 抹掉了').toBe(1);
    expect(item.autoCorrect).toBe(true);
    expect(item.isCorrect).toBe(true);
  });

  it('它的状态是 auto_graded', () => {
    const r = out(result());
    const item = r.items.find((x: any) => x.paperQuestionId === 'pq-mcq');
    expect(item.gradingStatus).toBe('auto_graded');
  });

  it('整卷的总分仍然 pending —— 逐题给分不等于整卷判完', () => {
    const r = out(result());
    expect(r.scoresPending).toBe(true);
    expect(r.totalScore).toBeNull();
    expect(r.autoScore).toBeNull();
    expect(r.manualScore).toBeNull();
  });

  it('自动判 0 分的选择题同样保留（0 分是结论，不是「没判」）', () => {
    const r = out(result({ items: [mcq({ awardedMarks: 0, autoCorrect: false, isCorrect: false, studentAnswer: 'C' })] }));
    const item = r.items[0];
    expect(item.awardedMarks).toBe(0);
    expect(item.gradingStatus).toBe('auto_graded');
  });

  it('AI 判的题**不算**确定性判分 —— 继续 pending，理由也不给', () => {
    const r = out(result({
      items: [shortAnswer({
        awardedMarks: 2,
        autoCorrect: true,
        isCorrect: true,
        markerComment: '[ai-grade] 同义改写，给分',
        commentSource: 'ai',
      })],
    }));
    const item = r.items[0];
    expect(item.gradingStatus).toBe('pending_marking');
    expect(item.awardedMarks).toBeNull();
    expect(item.isCorrect).toBeNull();
    expect(item.markerComment).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 需要人判的题继续 pending
// ─────────────────────────────────────────────────────────────

describe('S12H —— 需要人判的题维持原样', () => {
  it('没判过的主观题是 pending_marking，分数与对错都是 null', () => {
    const r = out(result());
    const item = r.items.find((x: any) => x.paperQuestionId === 'pq-sa');
    expect(item.gradingStatus).toBe('pending_marking');
    expect(item.awardedMarks).toBeNull();
    expect(item.isCorrect).toBeNull();
  });

  it('老师已经写了草稿分与评语，但整卷还没定稿 → 一个字都不给', () => {
    const r = out(result({
      items: [shortAnswer({
        awardedMarks: 1,
        isCorrect: false,
        markerComment: '少写了一个要点',
        commentSource: 'teacher',
        markedById: 't_stgteacher',
      })],
    }));
    const item = r.items[0];
    expect(item.gradingStatus).toBe('pending_marking');
    expect(item.awardedMarks, '老师的草稿分泄漏了').toBeNull();
    expect(item.markerComment, '老师的草稿评语泄漏了').toBeNull();
    expect(item.commentSource).toBeNull();
  });

  it('空白且没判过的题是 not_answered', () => {
    const r = out(result({ items: [shortAnswer({ studentAnswer: '' })] }));
    expect(r.items[0].gradingStatus).toBe('not_answered');
  });

  it('整卷定稿之后，老师判的那道题是 marked，评语放出来', () => {
    const r = out(result({
      status: 'marked',
      items: [shortAnswer({
        awardedMarks: 1,
        isCorrect: false,
        markerComment: '少写了一个要点',
        commentSource: 'teacher',
        markedById: 't_stgteacher',
      })],
    }));
    const item = r.items[0];
    expect(item.gradingStatus).toBe('marked');
    expect(item.awardedMarks).toBe(1);
    expect(item.markerComment).toBe('少写了一个要点');
  });
});

// ─────────────────────────────────────────────────────────────
// 3. 交卷之前**不许多给一个字**
// ─────────────────────────────────────────────────────────────

describe('S12H —— 交卷之前的隐私边界一点没松', () => {
  it('还在作答（未最终提交）→ 连自动判分的选择题也不给分、不给答案', () => {
    const r = out(result({ finalSubmittedAt: null }));
    const item = r.items.find((x: any) => x.paperQuestionId === 'pq-mcq');
    expect(item.awardedMarks).toBeNull();
    expect(item.autoCorrect).toBeNull();
    expect(item.isCorrect).toBeNull();
    expect(item.correctAnswer).toBeNull();
    expect(item.referenceAnswer).toBeNull();
    expect(item.answerDisplay).toBeNull();
    expect(r.answersPending).toBe(true);
  });

  it('未最终提交时逐题状态一律 pending_marking / not_answered，不泄漏判分出身', () => {
    const r = out(result({ finalSubmittedAt: null }));
    for (const item of r.items) {
      expect(['pending_marking', 'not_answered']).toContain(item.gradingStatus);
    }
  });

  it('未最终提交时不给 gradingSummary', () => {
    const r = out(result({ finalSubmittedAt: null }));
    expect(r.gradingSummary).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 4. gradingSummary
// ─────────────────────────────────────────────────────────────

describe('S12H —— gradingSummary', () => {
  it('计数来自同一份响应里的逐题状态，且加起来等于 total', () => {
    const r = out(result({
      items: [
        mcq({ paperQuestionId: 'q1' }),
        mcq({ paperQuestionId: 'q2', awardedMarks: 0, autoCorrect: false, isCorrect: false }),
        shortAnswer({ paperQuestionId: 'q3' }),
        shortAnswer({ paperQuestionId: 'q4', studentAnswer: '' }),
      ],
    }));
    const s = r.gradingSummary;
    expect(s.autoGraded).toBe(2);
    expect(s.pendingMarking).toBe(1);
    expect(s.notAnswered).toBe(1);
    expect(s.marked).toBe(0);
    expect(s.total).toBe(4);
    expect(s.autoGraded + s.marked + s.pendingMarking + s.notAnswered).toBe(s.total);
    const counted = r.items.filter((x: any) => x.gradingStatus === 'auto_graded').length;
    expect(counted).toBe(s.autoGraded);
  });

  it('不从部分逐题分数里派生任何整卷分数或百分比', () => {
    const r = out(result());
    expect(r.totalScore).toBeNull();
    expect(Object.keys(r)).not.toContain('percentage');
    expect(Object.keys(r)).not.toContain('derivedScore');
    expect(Object.keys(r.gradingSummary)).toEqual(
      expect.arrayContaining(['autoGraded', 'marked', 'pendingMarking', 'notAnswered', 'total']),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 5. answerDisplay —— 语义，不是中文标签
// ─────────────────────────────────────────────────────────────

describe('S12H —— answerDisplay', () => {
  it('归一化后相等（大小写 / 空白差异）→ 只发一个值，没有 rubric', () => {
    const r = out(result({
      items: [shortAnswer({ correctAnswer: 'A Row  of Hedges', referenceAnswer: 'a row of hedges' })],
    }));
    const d = r.items[0].answerDisplay;
    expect(d.primaryKind).toBe('reference');
    expect(d.primaryValue, '展示值必须是原样，不是归一化后的').toBe('A Row  of Hedges');
    expect(d.rubricValue).toBeUndefined();
  });

  it('答案与评分要点确实不同 → 两个都发', () => {
    const r = out(result({
      items: [shortAnswer({
        correctAnswer: 'a row of hedges',
        referenceAnswer: 'MP1 wind break; MP2 planted along the north wall',
      })],
    }));
    const d = r.items[0].answerDisplay;
    expect(d.primaryValue).toBe('a row of hedges');
    expect(d.rubricValue).toBe('MP1 wind break; MP2 planted along the north wall');
  });

  it('选择题用 correct', () => {
    const r = out(result({ items: [mcq()] }));
    expect(r.items[0].answerDisplay.primaryKind).toBe('correct');
    expect(r.items[0].answerDisplay.primaryValue).toBe('A');
  });

  it('主观题用 reference', () => {
    const r = out(result({ items: [shortAnswer()] }));
    expect(r.items[0].answerDisplay.primaryKind).toBe('reference');
  });

  it('答案门没开 → answerDisplay 是 null', () => {
    const r = out(result({ finalSubmittedAt: null }));
    expect(r.items[0].answerDisplay).toBeNull();
  });

  it('压根没有答案材料 → answerDisplay 是 null', () => {
    const r = out(result({
      items: [shortAnswer({ correctAnswer: null, referenceAnswer: null })],
    }));
    expect(r.items[0].answerDisplay).toBeNull();
  });

  it('API 里不出现任何中文标签', () => {
    const r = out(result());
    expect(JSON.stringify(r.items.map((x: any) => x.answerDisplay))).not.toMatch(
      /正确答案|参考答案|评分要点/,
    );
  });
});
