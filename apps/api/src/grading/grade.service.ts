import { Injectable } from '@nestjs/common';
import { gradeMcq } from './grade';
import { GradeRequest, GradeRequestSchema, GradeResult } from './grade.contract';

/**
 * The grading seam (docs/PRD §7). One method, one frozen contract.
 *
 * TODAY (zero-API): MCQ is graded deterministically via the shared core;
 * short_answer / structured / essay have no automated verdict, so they are
 * marked needsHumanReview=true and flow to the human marker queue — exactly
 * how `student.service.finalSubmit(deferAi)` already behaves.
 *
 * PHASE 3 (runtime LLM funded): the ONLY change is the short-answer branch
 * below — call a paid model + evaluator-optimizer/groundedness gate and emit
 * source:'llm' with a confidence. MCQ stays deterministic; every caller and
 * the contract stay untouched.
 */
@Injectable()
export class GradeService {
  grade(rawReq: GradeRequest): GradeResult {
    // Validate at the boundary so a malformed caller fails loudly here rather
    // than silently mis-scoring downstream.
    const req = GradeRequestSchema.parse(rawReq);

    if (req.questionType === 'mcq') {
      const outcome = gradeMcq({
        marks: req.maxMarks,
        selectedOption: req.selectedOption ?? null,
        textAnswer: req.textAnswer ?? null,
        snapshotOptions: req.options ?? null,
        snapshotContent: {
          // Empty acceptedKeys is intentionally omitted: gradeMcq treats an
          // empty list as "no override → use canonical key", and omitting it
          // here preserves that exactly.
          ...(req.acceptedKeys && req.acceptedKeys.length ? { acceptedKeys: req.acceptedKeys } : {}),
          ...(req.correctOption ? { correctOption: req.correctOption } : {}),
          ...(req.correctAnswer ? { correctAnswer: req.correctAnswer } : {}),
        },
        questionOptions: req.options ?? null,
        answerContent: req.answerContent ?? null,
      });
      return {
        awardedMarks: outcome.awardedMarks,
        isCorrect: outcome.isCorrect,
        needsHumanReview: false,
        source: 'deterministic',
      };
    }

    // short_answer / structured / essay — no zero-API verdict; defer to human.
    return {
      awardedMarks: null,
      isCorrect: null,
      needsHumanReview: true,
      source: 'human_pending',
      reason: 'no deterministic verdict for this question type in zero-API mode',
    };
  }
}
