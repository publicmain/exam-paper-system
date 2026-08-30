import { describe, expect, it } from 'vitest';
import { answersReleased, scoresReleased, stripUnreleasedScores } from './morning-quiz.service';

/**
 * 学生能看到什么，由两道**互相独立**的门决定：
 *
 *   分数门（2026-08-14 新政）—— scoresReleased(status)
 *     交卷即见答案，但分数评语等老师人工判分定稿后才下发。
 *
 *   答案门（2026-08-20 第二作答窗上线后加的）—— answersReleased(...)
 *     16:00-17:30 学生能回来改早上写下的答案。如果交卷就给答案，早上
 *     交卷的人下午照抄一遍就是满分。所以答案只认「最终提交」。
 *
 * 剥离必须发生在服务端 —— 前端藏起来挡不住 devtools。history-detail
 * 复用 getStudentResult，所以这一个纯函数覆盖两个学生入口。
 */

const item = (over: Partial<Record<string, unknown>> = {}) => ({
  // S12H —— 「有没有作答」只看持久化的作答内容，所以桩里要有它。
  studentAnswer: 'B',
  // S12H 返工 1/2 —— 确定性判分的判据改成了**正面的** MCQ，
  // 所以桩必须说清楚自己是哪种题。不说 = 不算确定性（失败关闭）。
  questionType: 'mcq',
  awardedMarks: 1,
  autoCorrect: true,
  isCorrect: true,
  markerComment: '定位到第 3 段末句。',
  commentSource: 'teacher',
  correctAnswer: 'B',
  referenceAnswer: '她的字看起来像小学生写的。',
  explanation: '题干问的是学生说了什么，不是作者的描述。',
  ...over,
});

/** finalSubmittedAt 默认给值 = 最终提交；传 null 就是暂存提交。 */
const payload = (
  status: string,
  finalSubmittedAt: Date | null = new Date('2026-08-25T01:00:00Z'),
  items: Array<Record<string, unknown>> = [
    item(),
    item({ awardedMarks: 0, autoCorrect: false, isCorrect: false }),
  ],
) => ({
  status,
  finalSubmittedAt,
  autoScore: 5,
  manualScore: 4,
  totalScore: 9,
  maxScore: 13,
  items,
});

describe('scoresReleased —— 分数发布口径', () => {
  it('marked / graded / returned 已定稿 → 发布', () => {
    expect(scoresReleased('marked')).toBe(true);
    expect(scoresReleased('graded')).toBe(true);
    expect(scoresReleased('returned')).toBe(true);
  });
  it('practice 是即时判分的自发重做，不适用晚发布', () => {
    expect(scoresReleased('practice')).toBe(true);
  });
  it('submitted / in_progress 未定稿 → 不发布', () => {
    expect(scoresReleased('submitted')).toBe(false);
    expect(scoresReleased('in_progress')).toBe(false);
  });
});

describe('answersReleased —— 答案发布口径', () => {
  it('最终提交 → 给答案', () => {
    expect(answersReleased({ status: 'submitted', finalSubmittedAt: new Date() })).toBe(true);
  });
  it('暂存提交（09:00 被自动收卷）→ 不给，下午还能改', () => {
    expect(answersReleased({ status: 'submitted', finalSubmittedAt: null })).toBe(false);
  });
  it('practice 自发重做，无窗口可言 → 即时给', () => {
    expect(answersReleased({ status: 'practice', finalSubmittedAt: null })).toBe(true);
  });
  it('判过分但没最终提交也不给 —— 两道门独立，答案只认最终提交', () => {
    expect(answersReleased({ status: 'marked', finalSubmittedAt: null })).toBe(false);
  });
});

describe('stripUnreleasedScores', () => {
  // S12H 起这一条**按判分出身拆成两半**。
  //
  // 原来它断言「未定稿 → 每题的判分信息全部置空」。用户第一次真人验收
  // 发现那条口径把**确定性判完的选择题**也说成「还在判分」。新口径：
  // 整卷总分照旧等定稿，但已最终提交的那些**服务端确定性判分**放行；
  // 老师的草稿分与评语一个字都不提前给。
  it('未定稿：整卷三个分数字段照旧置空', () => {
    const r = stripUnreleasedScores(payload('submitted') as any);
    expect(r.scoresPending).toBe(true);
    expect(r.autoScore).toBeNull();
    expect(r.manualScore).toBeNull();
    expect(r.totalScore).toBeNull();
  });

  it('未定稿：老师判的题**全部置空**（含草稿分与评语）', () => {
    const r = stripUnreleasedScores(
      payload('submitted', new Date('2026-08-25T01:00:00Z'), [
        item({ markedById: 't_teacher' }),
        item({ awardedMarks: 0, autoCorrect: false, isCorrect: false, markedById: 't_teacher' }),
      ]) as any,
    );
    for (const it2 of r.items) {
      expect(it2.awardedMarks).toBeNull();
      expect(it2.autoCorrect).toBeNull();
      expect(it2.isCorrect).toBeNull();
      expect(it2.markerComment).toBeNull();
      expect(it2.commentSource).toBeNull();
      expect((it2 as any).gradingStatus).toBe('pending_marking');
    }
  });

  it('未定稿：服务端确定性判的题放行分数，但评语仍然不给', () => {
    const r = stripUnreleasedScores(payload('submitted') as any);
    for (const it2 of r.items) {
      expect(it2.awardedMarks).not.toBeNull();
      expect(it2.autoCorrect).not.toBeNull();
      expect(it2.markerComment, '老师评语不该提前给').toBeNull();
      expect(it2.commentSource).toBeNull();
      expect((it2 as any).gradingStatus).toBe('auto_graded');
    }
  });

  it('还没最终提交：连确定性判分也不给 —— 隐私边界没松', () => {
    const r = stripUnreleasedScores(payload('submitted', null) as any);
    for (const it2 of r.items) {
      expect(it2.awardedMarks).toBeNull();
      expect(it2.autoCorrect).toBeNull();
      expect(it2.isCorrect).toBeNull();
      expect((it2 as any).answerDisplay).toBeNull();
    }
    expect((r as any).gradingSummary).toBeNull();
  });

  it('最终提交但未判分：答案给，分数不给 —— 这是最常见的一种状态', () => {
    const r = stripUnreleasedScores(payload('submitted') as any);
    expect(r.answersPending).toBe(false);
    expect((r.items[0] as any).correctAnswer).toBe('B');
    expect((r.items[0] as any).referenceAnswer).toBeTruthy();
    expect((r.items[0] as any).explanation).toBeTruthy();
    expect(r.totalScore).toBeNull();
  });

  it('暂存提交：答案三件套全部置空 —— 下午照抄的入口就是它们', () => {
    const r = stripUnreleasedScores(payload('submitted', null) as any);
    expect(r.answersPending).toBe(true);
    for (const it2 of r.items) {
      expect((it2 as any).correctAnswer).toBeNull();
      expect((it2 as any).referenceAnswer).toBeNull();
      expect((it2 as any).explanation).toBeNull();
    }
  });

  it('已定稿且最终提交：原样透传，两个 pending 都是 false', () => {
    const r = stripUnreleasedScores(payload('marked') as any);
    expect(r.scoresPending).toBe(false);
    expect(r.answersPending).toBe(false);
    expect(r.totalScore).toBe(9);
    expect(r.items[0].awardedMarks).toBe(1);
    expect(r.items[0].markerComment).toBe('定位到第 3 段末句。');
    expect((r.items[0] as any).correctAnswer).toBe('B');
  });

  it('finalSubmittedAt 缺省（老调用点 / 测试桩）按已发布处理，不弄丢历史答案', () => {
    const legacy = { ...payload('marked') } as any;
    delete legacy.finalSubmittedAt;
    const r = stripUnreleasedScores(legacy);
    expect(r.answersPending).toBe(false);
    expect((r.items[0] as any).correctAnswer).toBe('B');
  });

  it('不改动输入对象（纯函数）', () => {
    const p = payload('submitted', null);
    stripUnreleasedScores(p as any);
    expect(p.totalScore).toBe(9);
    expect(p.items[0].awardedMarks).toBe(1);
    expect((p.items[0] as any).correctAnswer).toBe('B');
  });
});
