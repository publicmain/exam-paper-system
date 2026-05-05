import { z } from 'zod';

/**
 * Body for POST /codegrader/questions/:questionId/test-cases (teacher).
 * `marksPerCase` is constrained to a sane upper bound so a teacher can't
 * accidentally award 1e9 marks with a typo. The service additionally
 * checks that sum(marksPerCase) <= Question.marks for the parent question.
 */
export const CreateTestCaseSchema = z.object({
  stdin: z.string().max(20000).default(''),
  expectedStdout: z.string().max(20000),
  marksPerCase: z.number().int().min(0).max(100).default(1),
  hidden: z.boolean().default(false),
  label: z.string().max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});
export type CreateTestCaseDto = z.infer<typeof CreateTestCaseSchema>;

/**
 * Supported language slugs. Mapped to judge0 language ids in
 * codegrader.service.ts (LANGUAGE_TO_JUDGE0_ID). Keep this list short and
 * intentional — every entry here implies we've confirmed the judge0
 * deployment has that language compiler installed.
 */
export const SupportedLanguage = z.enum([
  'python',
  'javascript',
  'java',
  'cpp',
  'c',
  'pseudocode', // Cambridge pseudocode — we run via a python adapter when judge0 is real
]);
export type SupportedLanguageT = z.infer<typeof SupportedLanguage>;

/**
 * Body for POST /codegrader/submit (student).
 * `paperQuestionId` lets us look up the AnswerScript and the underlying
 * Question's test cases in one query. Source code capped at 64KB —
 * exam-time programs are tens of lines, this is a generous safety net.
 */
export const SubmitCodeSchema = z.object({
  paperQuestionId: z.string().min(1),
  language: SupportedLanguage,
  sourceCode: z.string().min(1).max(65536),
});
export type SubmitCodeDto = z.infer<typeof SubmitCodeSchema>;
