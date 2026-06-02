import { z } from 'zod';

/**
 * Frozen contract for the grading seam (docs/PRD §7). This is the boundary
 * that lets us swap the implementation behind GradeService from "human in
 * chat" (zero-API now) to "paid runtime LLM + critic gate" (Phase 3) WITHOUT
 * touching any call site. Treat these schemas as a versioned API: widen
 * additively, never repurpose a field.
 */

export const OptionSchema = z.object({
  key: z.string(),
  text: z.string().optional(),
  correct: z.boolean().optional(),
});

export const GradeRequestSchema = z.object({
  questionType: z.enum(['mcq', 'short_answer', 'structured', 'essay']),
  maxMarks: z.number().nonnegative(),
  // --- student answer ---
  selectedOption: z.string().nullable().optional(),
  textAnswer: z.string().nullable().optional(),
  // --- MCQ deterministic inputs ---
  options: z.array(OptionSchema).optional(),
  acceptedKeys: z.array(z.string()).optional(),
  correctOption: z.string().optional(),
  // `correctAnswer` is an accepted alias of `correctOption`; `answerContent`
  // is the last-resort canonical-key source. Both are forwarded so the seam
  // is FULL-FIDELITY with the batch grader's gradeMcq (not a partial subset).
  correctAnswer: z.string().optional(),
  answerContent: z.object({ text: z.string() }).partial().optional(),
  // --- short-answer inputs (consumed only once a runtime LLM is funded) ---
  stem: z.string().optional(),
  passage: z.string().optional(),
  markScheme: z.string().optional(),
});
export type GradeRequest = z.infer<typeof GradeRequestSchema>;

export const GradeResultSchema = z.object({
  /** marks awarded, or null when there is no deterministic verdict. */
  awardedMarks: z.number().nullable(),
  /** true/false verdict, or null when deferred to a human. */
  isCorrect: z.boolean().nullable(),
  /** true → route to the human marker queue (current zero-API short-answer). */
  needsHumanReview: z.boolean(),
  /** machine-readable provenance of the verdict. */
  source: z.enum(['deterministic', 'human_pending', 'llm']),
  reason: z.string().optional(),
  /** 0..1, present only for non-deterministic verdicts. */
  confidence: z.number().min(0).max(1).optional(),
});
export type GradeResult = z.infer<typeof GradeResultSchema>;

/**
 * Authoring seam contract (docs/PRD §7). Declared now; its current
 * implementation is genuinely OUT OF BAND — papers are authored + 10-point
 * audited by Claude in chat (zero-API). This interface marks the single
 * swap point for a future runtime generator + groundedness/critic gate.
 * No live service wraps it yet because there is no code path to wrap.
 */
export const AuthoringRequestSchema = z.object({
  subject: z.string(),
  level: z.string(),
  spec: z.record(z.string(), z.unknown()),
});
export type AuthoringRequest = z.infer<typeof AuthoringRequestSchema>;

export interface AuthoredQuestion {
  content: unknown;
  answer: unknown;
  auditVerdict: 'pass' | 'fail' | 'pending';
}
export interface AuthoringResult {
  paper: unknown;
  perQuestion: AuthoredQuestion[];
}
