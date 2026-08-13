import { api } from './api';

/**
 * 学生自助页访问埋点的唯一入口。
 *
 * **它的全部设计目标是「永远不出事」**：埋点是给老师看参与度的辅助
 * 指标，任何情况下都不该让学生看不成成绩。所以这里把三种失败一并
 * 吞掉：网络错误、接口不存在（旧版本后端）、以及 api 上压根没有这个
 * 方法（测试里 mock 不全时就会这样 —— 2026-08-13 首次接埋点时,
 * 四个自测页的测试就是被一个 undefined 方法调用炸掉的）。
 *
 * 只记 谁 / 哪类页面 / 哪天，不记 IP、UA、停留时长（见后端
 * page-view.service 顶部注释）。
 */
export type TrackKind =
  | 'history'
  | 'submission_detail'
  | 'vocab'
  | 'vocab_practice'
  | 'mistakes';

export function track(kind: TrackKind, studentName: string, studentId?: string): void {
  if (!studentName) return;
  try {
    const fn = (api as any)?.recordPageView;
    if (typeof fn !== 'function') return;
    void Promise.resolve(fn({ studentName, studentId: studentId || undefined, kind })).catch(
      () => {},
    );
  } catch {
    /* 埋点绝不能影响学生看成绩 */
  }
}
