/**
 * P7 —— 正式词汇成绩的展示口径。
 *
 * 形状由服务端给（apps/api/src/vocab/vocab-score.ts），**前端一律不推算**：
 * 不从复习次数猜、不从卷内词汇题减、不用真值判断区分 0 分和没成绩。
 */

export type VocabScoreView =
  | { status: 'legacy_no_queue' }
  | { status: 'not_started' }
  | { status: 'in_progress'; answered: number; total: number }
  | {
      status: 'submitted';
      correct: number;
      total: number;
      percentage: number;
      submittedAt: string;
    };

/** 一行短文案。**0 分显示成 0/8，不是「—」** —— 考了得 0 分和没考是两回事。 */
export function vocabScoreLabel(v: VocabScoreView | null | undefined): string {
  if (!v) return '—';
  switch (v.status) {
    case 'legacy_no_queue':
      // 旧任务没有词汇队列快照，开不出正式测试。必须与「还没考」分开说，
      // 否则学生会一直等一个永远不会出现的入口。
      return '这一天没有正式单词测试';
    case 'not_started':
      return '还没考';
    case 'in_progress':
      return `考试进行中 · ${v.answered}/${v.total} 题`;
    case 'submitted':
      return `${v.correct}/${v.total} · ${v.percentage} 分`;
  }
}

/** 看板那种一格宽的紧凑写法。 */
export function vocabScoreShort(v: VocabScoreView | null | undefined): string {
  if (!v) return '—';
  switch (v.status) {
    case 'legacy_no_queue': return '无测试';
    case 'not_started': return '未考';
    case 'in_progress': return '进行中';
    case 'submitted': return `${v.correct}/${v.total}`;
  }
}

/** 交卷时刻，给「已提交」那一行做副标题。 */
export function submittedAtLabel(v: VocabScoreView | null | undefined): string | null {
  if (!v || v.status !== 'submitted' || !v.submittedAt) return null;
  const d = new Date(v.submittedAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')} 交卷`;
}
