/**
 * 判分工作台的阶段与逐题编辑缓冲规则（2026-09-11 审计 M01 / M02 / IOS-10）。
 *
 * 阶段口径与后端 `apps/api/src/marker/dto.ts` 的 QUEUE_STAGES 一致：
 *   待批 awaiting      —— 还有主观题没分数，没人认领
 *   批改中 in_progress —— 还有主观题没分数，有人认领
 *   已评分待发布 ready —— 主观题全部有分数，但还没发布（学生看不到成绩）
 *   已发布 published   —— status marked / returned
 */

export const STRUCTURED_TYPES: readonly string[] = ['structured', 'short_answer', 'essay'];

export function isStructuredType(t: string | null | undefined): boolean {
  return !!t && STRUCTURED_TYPES.includes(t);
}

export type MarkerStage = 'awaiting' | 'in_progress' | 'ready' | 'published';

export const STAGE_LABEL: Record<MarkerStage, string> = {
  awaiting: '待批',
  in_progress: '批改中',
  ready: '已评分待发布',
  published: '已发布',
};

/** 每个阶段一句话说明（队列分栏下方、判分页状态处）。 */
export const STAGE_HINT: Record<MarkerStage, string> = {
  awaiting: '还有主观题没打分，也没有老师认领。认领后才能打分。',
  in_progress: '已有老师认领，正在逐题打分。',
  ready: '主观题都有分数了（老师打的或自动判的），但还没发布 —— 学生暂时看不到成绩。',
  published: '成绩已发布，学生能看到。',
};

/** 阶段徽标配色：文字与底色对比均 ≥ 4.5:1（WCAG 2.2 AA 普通文字）。 */
export const STAGE_BADGE_CLASS: Record<MarkerStage, string> = {
  awaiting: 'bg-amber-50 text-amber-800 border-amber-300',
  in_progress: 'bg-blue-50 text-blue-800 border-blue-300',
  ready: 'bg-violet-50 text-violet-800 border-violet-300',
  published: 'bg-emerald-50 text-emerald-800 border-emerald-300',
};

export function stageOfSubmission(input: {
  status: string;
  ungradedCount: number;
  claimActive: boolean;
}): MarkerStage | null {
  if (input.status === 'marked' || input.status === 'returned') return 'published';
  if (input.status !== 'submitted') return null;
  if (input.ungradedCount === 0) return 'ready';
  return input.claimActive ? 'in_progress' : 'awaiting';
}

// ───────────────────────── 逐题编辑缓冲 ─────────────────────────

export interface ScoreDraft {
  awardedMarks: string;
  markerComment: string;
}

export function draftFromScript(s: { awardedMarks?: number | null; markerComment?: string | null }): ScoreDraft {
  return {
    awardedMarks: s.awardedMarks == null ? '' : String(s.awardedMarks),
    markerComment: s.markerComment ?? '',
  };
}

/** 本地输入与「服务端已确认」的值是否不同。分数按数值比（"2" 与 "2.0" 相同）。 */
export function isDraftDirty(edit: ScoreDraft | undefined, saved: ScoreDraft | undefined): boolean {
  if (!edit || !saved) return false;
  if (edit.markerComment !== saved.markerComment) return true;
  const a = edit.awardedMarks.trim();
  const b = saved.awardedMarks.trim();
  if (a === '' || b === '') return a !== b;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return a !== b;
  return na !== nb;
}

/** 分数校验。返回给老师看的一句话；合法返回 null。 */
export function validateMarks(raw: string, max: number): string | null {
  const s = raw.trim();
  if (s === '') return '请先填这题的分数。';
  const n = Number(s);
  if (!Number.isFinite(n)) return '分数要填数字。';
  if (n < 0 || n > max) return `分数要在 0–${max} 分之间。`;
  if (Math.round(n * 2) !== n * 2) return '分数按 0.5 分递增（如 1 或 1.5）。';
  return null;
}

/** 发布前的总分预览 —— 与后端 finalize 同一算法（按 markedById 分自动 / 人工）。 */
export function previewTotals(
  scripts: Array<{ awardedMarks?: number | null; markedById?: string | null; paperQuestion?: { question?: { questionType?: string } } }>,
): { auto: number; manual: number; total: number } {
  let auto = 0;
  let manual = 0;
  for (const s of scripts) {
    const t = s.paperQuestion?.question?.questionType;
    if (s.awardedMarks == null) continue;
    if (t === 'mcq' || !s.markedById) auto += s.awardedMarks;
    else manual += s.awardedMarks;
  }
  return { auto, manual, total: auto + manual };
}

// ───────────────────────── 本标签页草稿（刷新 / 返回后可恢复） ─────────────────────────

const DRAFT_PREFIX = 'marker-draft:';

export function readStoredDrafts(submissionId: string): Record<string, ScoreDraft> {
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFIX + submissionId);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, ScoreDraft> = {};
    for (const [id, v] of Object.entries(parsed as Record<string, any>)) {
      if (v && typeof v.awardedMarks === 'string' && typeof v.markerComment === 'string') {
        out[id] = { awardedMarks: v.awardedMarks, markerComment: v.markerComment };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeStoredDrafts(submissionId: string, drafts: Record<string, ScoreDraft>): void {
  try {
    if (Object.keys(drafts).length === 0) sessionStorage.removeItem(DRAFT_PREFIX + submissionId);
    else sessionStorage.setItem(DRAFT_PREFIX + submissionId, JSON.stringify(drafts));
  } catch {
    /* 隐私模式 / 存储被禁：草稿只是保险，不影响保存本身 */
  }
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
    return (e as any).message;
  }
  return String(e);
}
