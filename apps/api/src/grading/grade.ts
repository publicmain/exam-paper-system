/**
 * Deterministic grading core — the zero-API half of the Phase 1 "AI-ready
 * grading seam" (docs/PRD §7). This is the SINGLE source of truth for how a
 * scored answer maps to marks; both the batch path (student.service
 * autoGradeScripts) and the forward-looking GradeService dispatch through it.
 *
 * MCQ is fully deterministic (no LLM, ever). short_answer / structured / essay
 * have no deterministic verdict in zero-API mode → they return
 * needsHumanReview=true and are routed to the human marker queue. When a paid
 * runtime LLM is funded (PRD Phase 3), the short-answer branch of GradeService
 * is the ONLY place that changes — this core and every MCQ call site stay put.
 *
 * The MCQ logic here is moved verbatim from the original autoGradeScripts MCQ
 * branch so behaviour is byte-identical; grade.spec.ts pins the tricky cases
 * (acceptedKeys "either-order", correctOption/correctAnswer fallback chain,
 * typed-letter textAnswer fallback, case/whitespace tolerance).
 */

export type QuestionType = 'mcq' | 'short_answer' | 'structured' | 'essay';

export interface McqGradeInput {
  marks: number;
  selectedOption: string | null;
  textAnswer: string | null;
  /** Frozen-at-publish options snapshot; falls back to live question options. */
  snapshotOptions: unknown;
  /** May carry acceptedKeys / correctOption / correctAnswer. */
  snapshotContent?: unknown;
  questionOptions: unknown;
  answerContent: unknown;
}

export interface GradeOutcome {
  /** true/false for a deterministic verdict; null = no verdict (needs human). */
  isCorrect: boolean | null;
  /** marks awarded, or null when there is no deterministic verdict. */
  awardedMarks: number | null;
  /** true when this item must go to the human marker queue (zero-API mode). */
  needsHumanReview: boolean;
}

/** Mirror the MyHistoryDetail UI's `trim().toLowerCase()` compare so the grader
 *  and the student's "✓ 正确" badge can never visibly disagree. */
const norm = (s: string | null | undefined): string =>
  s == null ? '' : String(s).trim().toLowerCase();

/**
 * Grade a single MCQ answer. Verbatim port of the original autoGradeScripts
 * MCQ branch (R15-followup-10 / -14 / -14b semantics preserved):
 *   1. Prefer snapshotOptions, fall back to live question.options.
 *   2. acceptedKeys / acceptableOptionKeys / acceptOptions → accept ANY listed.
 *   3. else canonical key = options[].correct ?? snapshotContent.correctOption
 *      / correctAnswer ?? question.answerContent.text.
 *   4. selectedOption, or a typed letter in textAnswer matched to an option key.
 *   5. case/whitespace-tolerant compare.
 */
export function gradeMcq(input: McqGradeInput): GradeOutcome {
  const opts = (input.snapshotOptions ?? input.questionOptions ?? []) as Array<{
    key: string;
    correct: boolean;
  }>;
  const correctOpt = Array.isArray(opts) ? opts.find((o) => o.correct) : null;

  const sc =
    typeof input.snapshotContent === 'object' && input.snapshotContent !== null
      ? (input.snapshotContent as Record<string, unknown>)
      : null;
  const accepted = (() => {
    if (!sc) return null;
    for (const field of ['acceptedKeys', 'acceptableOptionKeys', 'acceptOptions']) {
      const v = sc[field];
      if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
        return v as string[];
      }
    }
    return null;
  })();

  let canonicalCorrectKey: string | null = correctOpt?.key ?? null;
  if (!canonicalCorrectKey && sc) {
    for (const field of ['correctOption', 'correctAnswer']) {
      const v = sc[field];
      if (typeof v === 'string' && v.length > 0 && v.length <= 8) {
        canonicalCorrectKey = v;
        break;
      }
    }
  }
  if (!canonicalCorrectKey) {
    const ac = input.answerContent as { text?: unknown } | null;
    if (typeof ac?.text === 'string' && ac.text.length <= 8) {
      canonicalCorrectKey = ac.text;
    }
  }

  let selected = input.selectedOption;
  if (selected == null && typeof input.textAnswer === 'string') {
    const candidate = input.textAnswer.trim();
    if (candidate.length > 0 && candidate.length <= 4) {
      const optKeys = (Array.isArray(opts) ? opts : [])
        .map((o: any) => String(o?.key ?? ''))
        .filter(Boolean);
      const cu = candidate.toUpperCase();
      const matchedKey = optKeys.find((k) => k.toUpperCase() === cu);
      if (matchedKey) selected = matchedKey;
    }
  }

  const selectedN = norm(selected);
  const isCorrect =
    accepted && accepted.length > 0
      ? accepted.map(norm).includes(selectedN)
      : canonicalCorrectKey != null && norm(canonicalCorrectKey) === selectedN;
  const awarded = isCorrect ? input.marks : 0;
  return { isCorrect, awardedMarks: awarded, needsHumanReview: false };
}
