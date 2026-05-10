import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { IeltsIngestService } from './ielts-ingest.service';

/**
 * R10 — admin-only ingest API for Cambridge IELTS reading materials.
 *
 * Workflow with Claude as the parser:
 *   1. Operator drops a Cambridge IELTS PDF into the project (or pastes
 *      it into a Claude session).
 *   2. Claude reads the PDF, extracts each Reading Passage's full text +
 *      every question (stem / instruction / options / answer) + cross-
 *      references the Answer Keys section, and emits the JSON shape this
 *      controller accepts.
 *   3. Claude POSTs one passage at a time. Idempotency key is the per-
 *      question sourceRef ("cambridge_ielts_8/Test1/P1/Q1"); re-POSTing
 *      a passage already in the bank skips existing rows rather than
 *      overwriting them.
 *   4. Admin reviews in the Questions UI; if a row is wrong, delete +
 *      Claude re-ingests just that passage.
 *
 * The 8 IELTS Reading task types this endpoint accepts match the
 * front-end IELTSReadingPassage renderer + the seed-local-mq.ts shape so
 * morning-quiz pickPassageAndCreatePaper can immediately use the new
 * passages without any extra glue.
 */

const TASK_TYPES = [
  'matching_information',
  'matching_headings',
  'matching_features',
  'multiple_choice',
  'true_false_not_given',
  'yes_no_not_given',
  'sentence_completion',
  'summary_completion',
  'note_completion',
  'table_completion',
  'flow_chart_completion',
  'diagram_label_completion',
  'short_answer',
] as const;

const QuestionShape = z.object({
  n: z.number().int().min(1).max(80),
  questionType: z.enum(['mcq', 'short_answer']),
  taskType: z.enum(TASK_TYPES),
  // Instruction is the rubric ("Choose NO MORE THAN TWO WORDS…"). Stem is
  // the per-question content (the statement to judge / heading to match /
  // sentence to complete). Both rendered to students; instruction usually
  // shared across a sub-block of consecutive questions.
  instruction: z.string().min(1).max(2000),
  stem: z.string().min(1).max(4000),
  // MCQ options carry one `correct: true`. short_answer leaves this null.
  options: z
    .array(
      z.object({
        key: z.string().min(1).max(8),
        text: z.string().min(1).max(500),
        correct: z.boolean(),
      }),
    )
    .nullable()
    .optional(),
  // Canonical answer string. Single character ("D"), roman numeral
  // ("ii"), or 1–3 word phrase ("pendulum clock"). autoGradeScripts
  // normalizes whitespace + case + trailing punctuation when grading.
  answer: z.string().min(1).max(80),
});

const ApproveSchema = z.object({
  sourceRefPrefix: z
    .string()
    .regex(/^IELTS\/[a-z0-9_]+\/Test\d+\/P\d+$/i),
});

const PassageIngestSchema = z.object({
  // Used as both the Source identifier and as the sourceRef prefix on
  // every Question. Lower-snake recommended ("cambridge_ielts_8") so the
  // sourceRef regex in pickPassageAndCreatePaper matches.
  bookCode: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/i, 'bookCode must be alphanumeric / underscore'),
  testNumber: z.number().int().min(1).max(20),
  passageNumber: z.number().int().min(1).max(10),
  passage: z.object({
    title: z.string().min(1).max(300),
    body: z.string().min(50).max(20_000),
  }),
  questions: z.array(QuestionShape).min(1).max(40),
});

@Controller('ielts-ingest')
export class IeltsIngestController {
  constructor(private readonly svc: IeltsIngestService) {}

  /** Ingest one passage (passage + 13ish questions + answers) into the
   *  Question bank as DRAFT rows. Idempotent on (bookCode, testNumber,
   *  passageNumber, n). Drafts are invisible to morning-quiz scheduling
   *  until POST /approve flips them active. */
  @Post('passage')
  async ingestPassage(@Body() body: unknown, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_only' });
    }
    const parsed = PassageIngestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.svc.ingestPassage(parsed.data, { id: user.id });
  }

  /** R10 L5 review gate — promote a passage's draft rows to active.
   *  Body: { sourceRefPrefix: "IELTS/<book>/Test<n>/P<n>" } */
  @Post('approve')
  async approve(@Body() body: unknown, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_only' });
    }
    const parsed = ApproveSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.svc.approveBySourceRefPrefix(parsed.data.sourceRefPrefix);
  }
}
