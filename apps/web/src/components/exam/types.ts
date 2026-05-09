/**
 * Shared types for the exam-shell component family.
 *
 * `ExamPaper` is the common shape every renderer reads. It is a thin
 * normalisation layer over the morning-quiz API response so that the
 * IELTS / O-Level / future renderers can be swapped in without each one
 * re-deriving fields like "is this a passage paper".
 */

export type EnglishLevel = 'ielts_authentic' | 'ielts_hard' | 'olevel';

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
