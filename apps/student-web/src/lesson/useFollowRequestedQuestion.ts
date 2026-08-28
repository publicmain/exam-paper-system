/**
 * 分页渲染器的「跳到某题」。
 *
 * 一屏一题的 O-Level 渲染器自己持有页码，而题号条在外壳里。学生点了
 * 第 7 题，如果渲染器不翻页，`scrollIntoView` 找的是一个根本不在 DOM
 * 里的元素 —— 表现就是「点题号没反应」。
 */
import { useEffect } from 'react';
import type { ExamQuestion } from './examTypes';
import { useRequestedQuestion } from './ExamContext';

export function useFollowRequestedQuestion(
  questions: ExamQuestion[] | undefined,
  setIdx: (n: number) => void,
): void {
  const qid = useRequestedQuestion();
  useEffect(() => {
    if (!qid || !questions) return;
    const i = questions.findIndex((q) => q.id === qid);
    if (i >= 0) setIdx(i);
    // setIdx 是 useState 的 setter，身份稳定，不进依赖数组
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qid, questions]);
}
