/**
 * Shared types for the exam-shell component family.
 *
 * `ExamPaper` is the common shape every renderer reads. It is a thin
 * normalisation layer over the morning-quiz API response so that the
 * IELTS / O-Level / future renderers can be swapped in without each one
 * re-deriving fields like "is this a passage paper".
 */

export type EnglishLevel = 'ielts_authentic' | 'ielts_simplified' | 'olevel';

/** UI flavour. `practice` is friendly — instant correctness feedback,
 *  unlimited retries, soft visuals; `test` is the strict morning-quiz
 *  flow — submit-then-see-result, no retries. */
export type ExamMode = 'practice' | 'test';

export interface ExamOption {
  key: string;
  text: string;
  /** Set only on practice-mode review feedback. */
  isCorrect?: boolean;
}

/** A single rendered question. Keep the shape minimal; renderers that
 *  need more (e.g. passage body for IELTS) reach into snapshotContent. */
export interface ExamQuestion {
  id: string;
  sortOrder: number;
  marks: number;
  questionType: 'mcq' | 'short_answer' | 'structured' | 'essay';
  snapshotContent: any;
  snapshotOptions: ExamOption[] | null;
}

export interface ExamAnswer {
  selectedOption?: string;
  textAnswer?: string;
}

export interface ExamPaper {
  sessionId: string;
  quizEnd: string;
  level: EnglishLevel;
  /** `passage_pick` ⇒ shared passage at the top of paper (IELTS Reading).
   *  `null`/`standard` ⇒ each question stands alone. */
  paperMode: 'passage_pick' | 'standard' | null;
  questions: ExamQuestion[];
}

/** A category that the registry uses to pick a renderer. Detected from
 *  the question's snapshotContent.taskType, with sensible fallbacks. */
export type QuestionRenderKind =
  | 'ielts_passage_pick'      // shared passage, group of tasks (matching/TFNG/MCQ)
  | 'olevel_comprehension'    // single passage + paged MCQs underneath
  | 'olevel_cloze'            // article with inline blanks
  | 'olevel_vocab'            // single sentence MCQ — vocab in context
  | 'olevel_transformation'   // rewrite this sentence starting with…
  | 'olevel_mcq';             // generic MCQ fallback (grammar / vocab MCQ)

/**
 * B3-H2 — TYPE-AUTHORITY contract
 *
 * Three fields participate in renderer dispatch. Their roles are NOT
 * redundant; documenting the priority here so future code stops
 * reaching for the wrong one:
 *
 *   1. `questionType` (Prisma enum on Question/PaperQuestion):
 *        mcq | short_answer | structured | essay
 *      — answer-grading shape only. Tells the auto-grader whether the
 *      script is text vs option-key. Never alone enough to pick a
 *      renderer.
 *
 *   2. `snapshotContent.taskType` (string — AUTHORITATIVE for renderer):
 *        matching_headings | matching_features | true_false_not_given |
 *        sentence_completion | summary_completion | … | cloze | vocab |
 *        transformation
 *      — the pedagogical task type. THIS is what the registry should
 *      prefer when picking a renderer.
 *
 *   3. `snapshotContent.uiKind` (string — DEPRECATED legacy hint):
 *        multiple_choice | cloze | vocab_in_context |
 *        sentence_transformation | reading_passage
 *      — kept readable for back-compat with rows generated before
 *      taskType became universal. The registry falls back to uiKind
 *      ONLY when taskType is absent. New AI-generated rows MUST emit
 *      taskType (and may emit uiKind too — they should agree).
 *
 * Codemod plan: when historical Question rows are batch-touched (next
 * tag-backfill pass), copy the legacy uiKind → taskType so the
 * fallback path can be retired later. See
 * apps/api/scripts/backfill-question-tags.ts (which now also reads
 * uiKind and writes taskType when the latter is missing).
 */
