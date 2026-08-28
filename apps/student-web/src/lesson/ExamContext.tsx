/**
 * 渲染器与 S7B 状态引擎之间的**适配层**。
 *
 * 搬过来的六个渲染器都调 `useExam()`。它们要的东西
 * （`answers` / `setAnswer` / `savingId` / `isOffline` / 旗标 / 字号）
 * S7B 的引擎全都已经有了 —— 这里**不重新实现任何持久化或并发语义**，
 * 只是把引擎的公共契约换个名字露给渲染器。
 *
 * 唯一新增的是 `mode`：引擎不管它（它是卷子的属性，不是保存状态），
 * 由页面从会话载荷里取出来往下传。阅读页永远传 `test`。
 */
import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useReading } from './ReadingProvider';
import type { ExamAnswer, ExamMode, ExamQuestion } from './examTypes';

const ModeCtx = createContext<ExamMode>('test');

/**
 * 「请跳到这一题」。
 *
 * 分页的 O-Level 渲染器（一屏一题）自己持有页码，题号条在外壳里 ——
 * 两边得有个最小的通道，否则点题号只会滚到一个不在 DOM 里的元素。
 * 只传一个题号，页码仍归渲染器自己算。
 */
const FocusCtx = createContext<{ qid: string | null; request(qid: string): void }>({
  qid: null,
  request: () => {},
});

export function ExamFocusProvider({
  value,
  children,
}: {
  value: { qid: string | null; request(qid: string): void };
  children: ReactNode;
}) {
  return <FocusCtx.Provider value={value}>{children}</FocusCtx.Provider>;
}

/** 渲染器用它把自己的页码对齐到被点的那一题。 */
export function useRequestedQuestion(): string | null {
  return useContext(FocusCtx).qid;
}

export function useRequestFocus(): (qid: string) => void {
  return useContext(FocusCtx).request;
}

/**
 * 分页渲染器的「跳到某题」。
 *
 * 一屏一题的 O-Level 渲染器自己持有页码，而题号条在外壳里。学生点了
 * 第 7 题，如果渲染器不翻页，`scrollIntoView` 找的是一个根本不在 DOM
 * 里的元素 —— 表现就是「点题号没反应」。
 */
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

export function ExamModeProvider({ mode, children }: { mode: ExamMode; children: ReactNode }) {
  return <ModeCtx.Provider value={mode}>{children}</ModeCtx.Provider>;
}

export interface ExamContextValue {
  mode: ExamMode;
  fontScale: number;
  setFontScale(n: number): void;
  answers: Record<string, ExamAnswer>;
  setAnswer(qid: string, ans: ExamAnswer): void;
  savingId: string | null;
  isOffline: boolean;
  isFlagged(qid: string): boolean;
  toggleFlag(qid: string): void;
  flaggedCount: number;
}

export function useExam(): ExamContextValue {
  const r = useReading();
  const mode = useContext(ModeCtx);
  return useMemo(
    () => ({
      mode,
      fontScale: r.fontScale,
      setFontScale: r.setFontScale,
      answers: r.answers,
      setAnswer: r.setAnswer,
      savingId: r.savingId,
      isOffline: r.isOffline,
      isFlagged: r.isFlagged,
      toggleFlag: r.toggleFlag,
      flaggedCount: r.flaggedCount,
    }),
    [
      mode,
      r.fontScale,
      r.setFontScale,
      r.answers,
      r.setAnswer,
      r.savingId,
      r.isOffline,
      r.isFlagged,
      r.toggleFlag,
      r.flaggedCount,
    ],
  );
}
