import { z } from 'zod';

export const ClaimSchema = z.object({
  submissionId: z.string().min(1),
});

export const ReleaseSchema = z.object({
  submissionId: z.string().min(1),
});

export const ScoreScriptSchema = z.object({
  awardedMarks: z.number().min(0).max(100),
  markerComment: z.string().max(4000).nullable().optional(),
});

/**
 * 判分队列的阶段（审计 M01 / M04，2026-09-11）。
 *
 *   needs_marking —— 还有主观题没分数（默认；= 旧口径，待批 + 批改中）
 *   awaiting      —— 待批：还有主观题没分数，且没人认领（可认领）
 *   in_progress   —— 批改中：还有主观题没分数，已有人认领
 *   ready         —— 已评分待发布：主观题全部有分数（人工或自动），但还没发布
 *                    （status 仍是 submitted，学生看不到成绩）
 *   open          —— 以上全部（所有 status=submitted 的答卷）
 *
 * 「已发布」= status marked / returned，不在队列里。
 */
export const QUEUE_STAGES = ['needs_marking', 'awaiting', 'in_progress', 'ready', 'open'] as const;
export type QueueStage = (typeof QUEUE_STAGES)[number];

export const QueueQuerySchema = z.object({
  classId: z.string().optional(),
  paperId: z.string().optional(),
  stage: z.enum(QUEUE_STAGES).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export type ClaimDto = z.infer<typeof ClaimSchema>;
export type ReleaseDto = z.infer<typeof ReleaseSchema>;
export type ScoreScriptDto = z.infer<typeof ScoreScriptSchema>;
export type QueueQueryDto = z.infer<typeof QueueQuerySchema>;
