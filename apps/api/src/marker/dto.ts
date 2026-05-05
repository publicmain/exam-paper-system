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

export const QueueQuerySchema = z.object({
  classId: z.string().optional(),
  paperId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export type ClaimDto = z.infer<typeof ClaimSchema>;
export type ReleaseDto = z.infer<typeof ReleaseSchema>;
export type ScoreScriptDto = z.infer<typeof ScoreScriptSchema>;
export type QueueQueryDto = z.infer<typeof QueueQuerySchema>;
