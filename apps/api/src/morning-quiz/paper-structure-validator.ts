/**
 * R15-followup-23 — paper structure validator.
 *
 * Background — 5/26 morning quiz shipped with TFNG questions whose
 * `snapshotOptions` was an empty array. My previous ad-hoc audit only
 * checked "if options present, verify there's a correct key" — it
 * never reverse-checked "this taskType MUST have options of shape X",
 * so an empty array slipped past. Students saw an empty RadioGroup.
 *
 * This module is the reverse-check, run as a pure function over
 * already-snapshotted paperQuestions. Use it:
 *   - as a one-off scan over historical papers (admin endpoint),
 *   - as a pre-publish gate at paper generation time (future work),
 *   - in unit tests pinning the contract for every new taskType.
 *
 * Pure — no DB, no I/O. Caller fetches the questions and feeds them in.
 */

/** Subset of PaperQuestion that the validator needs to read. Designed
 *  to be a structural match for both the Prisma row + the
 *  redact-for-student shape so tests can pass minimal fixtures. */
export interface PaperQuestionShape {
  sortOrder: number;
  snapshotOptions?: unknown;
  snapshotContent?: unknown;
  snapshotAnswer?: unknown;
  question?: { questionType?: string } | null;
}

export interface StructureViolation {
  sortOrder: number;
  taskType: string;
  questionType: string | undefined;
  code:
    | 'EMPTY_STEM'
    | 'EMPTY_OPTIONS'
    | 'TOO_FEW_OPTIONS'
    | 'NO_CANONICAL_ANSWER';
  detail: string;
}

const TFNG_LIKE = new Set(['true_false_not_given', 'yes_no_not_given']);
const MCQ_LIKE = new Set([
  'multiple_choice',
  'mcq',
  'matching_features',
  'classification',
]);
const NEEDS_OPTS = new Set([...TFNG_LIKE, ...MCQ_LIKE]);

export function validatePaperStructure(
  questions: PaperQuestionShape[],
): StructureViolation[] {
  const violations: StructureViolation[] = [];
  for (const q of questions) {
    const sc = (q.snapshotContent ?? {}) as Record<string, unknown>;
    const taskType = String(sc.taskType ?? '');
    const questionType = q.question?.questionType ?? undefined;
    const opts = Array.isArray(q.snapshotOptions)
      ? (q.snapshotOptions as Array<Record<string, unknown>>)
      : [];
    const optCount = opts.length;
    const stem = sc.stem;

    if (typeof stem !== 'string' || !stem.trim()) {
      violations.push({
        sortOrder: q.sortOrder,
        taskType,
        questionType,
        code: 'EMPTY_STEM',
        detail: 'snapshotContent.stem is missing or blank',
      });
    }

    if (NEEDS_OPTS.has(taskType)) {
      const minOpts = TFNG_LIKE.has(taskType) ? 3 : 2;
      if (optCount === 0) {
        violations.push({
          sortOrder: q.sortOrder,
          taskType,
          questionType,
          code: 'EMPTY_OPTIONS',
          detail: `taskType=${taskType} expects ≥${minOpts} options; snapshotOptions is empty (5/26 TFNG bug)`,
        });
      } else if (optCount < minOpts) {
        violations.push({
          sortOrder: q.sortOrder,
          taskType,
          questionType,
          code: 'TOO_FEW_OPTIONS',
          detail: `taskType=${taskType} expects ≥${minOpts} options; got ${optCount}`,
        });
      }

      // For options present: also need *some* way to know the canonical
      // answer — either an option marked correct, or a top-level key on
      // snapshotContent / snapshotAnswer.
      if (optCount > 0) {
        const ans = (q.snapshotAnswer ?? {}) as Record<string, unknown>;
        const hasMarkedCorrect = opts.some((o) => o?.correct === true);
        const hasCanonical =
          (typeof sc.correctOption === 'string' && (sc.correctOption as string).length > 0) ||
          (typeof sc.correctAnswer === 'string' && (sc.correctAnswer as string).length > 0) ||
          (Array.isArray(sc.acceptedKeys) &&
            (sc.acceptedKeys as unknown[]).length > 0) ||
          (typeof ans.text === 'string' && (ans.text as string).length > 0);
        if (!hasMarkedCorrect && !hasCanonical) {
          violations.push({
            sortOrder: q.sortOrder,
            taskType,
            questionType,
            code: 'NO_CANONICAL_ANSWER',
            detail: `MCQ-shape (${taskType}) has no marked-correct option, no correctOption/correctAnswer/acceptedKeys, and no snapshotAnswer.text — grader has nothing to compare against`,
          });
        }
      }
    }
  }
  return violations;
}
