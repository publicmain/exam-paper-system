import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { OlevelIngestService } from './olevel-ingest.service';

/**
 * R10 — admin-only ingest API for Cambridge IGCSE 0510/0511
 * (English as a Second Language, Reading & Writing Extended).
 *
 * Maps to the actual 0510 Paper 1 R&W exercise structure as published
 * in the official mark schemes:
 *
 *   Exercise 1: passage + ~6 short-answer comprehension questions
 *               (1 mark each; mark scheme gives a literal answer or
 *               accepted-paraphrase list)
 *   Exercise 2: 4-text multiple-matching, ~9 sub-questions, A/B/C/D
 *   Exercise 3: passage + notes completion (one or two words from
 *               the text per blank, 4–8 marks)
 *   Exercise 4: passage + ~6 short-answer comprehension questions
 *               (similar to Exercise 1)
 *
 * Exercises 5 (summary writing) and 6 (composition) are deliberately
 * NOT in scope: their answers are open-ended human-graded compositions
 * and don't fit the auto-grade pipeline. The morning-quiz product is
 * "100% auto-graded" by design, so we drop them.
 *
 * Provenance:
 *   sourceRef     = `OLEVEL/<setCode>/Paper<n>/Q<m>`
 *   provenanceTag = `cambridge_0510` (filterable by morning-quiz)
 *
 * Call this once per real PDF (e.g. setCode = 'cambridge_0510_s24'
 * paperNumber = 12 for the May/June 2024 variant 12).
 */

const ShortAnswerQ = z.object({
  n: z.number().int().min(1).max(80),
  // Question stem (the actual question prompt). The passage lives on
  // the section, not the question, so the renderer can show it once
  // and ask many questions about it.
  stem: z.string().min(1).max(2000),
  // Canonical answer. autoGradeScripts normalises whitespace + case +
  // trailing punctuation, so "fat beneath shell" and "fat beneath the
  // shell" both match if either is the canonical. Use the shortest
  // mark-scheme phrasing that's still unambiguous.
  answer: z.string().min(1).max(120),
});

const MultiMatchQ = z.object({
  n: z.number().int().min(1).max(80),
  stem: z.string().min(1).max(800),
  // For Ex2 the options are A/B/C/D → labelling each text's nickname;
  // we encode them as MCQ options with one `correct: true` so the
  // existing autoGradeScripts MCQ branch grades it.
  options: z
    .array(
      z.object({
        key: z.string().min(1).max(8),
        text: z.string().min(1).max(200),
        correct: z.boolean(),
      }),
    )
    .min(2)
    .max(8),
  answer: z.string().min(1).max(8),
});

const NotesQ = z.object({
  n: z.number().int().min(1).max(80),
  stem: z.string().min(1).max(800),
  answer: z.string().min(1).max(120),
});

const SectionSchema = z.discriminatedUnion('exercise', [
  z.object({
    exercise: z.literal(1),
    instruction: z.string().min(5).max(2000),
    passageTitle: z.string().min(1).max(300),
    passage: z.string().min(50).max(20_000),
    questions: z.array(ShortAnswerQ).min(1).max(20),
  }),
  z.object({
    exercise: z.literal(2),
    instruction: z.string().min(5).max(2000),
    // For Exercise 2, the four texts are stitched together into one
    // passage block separated by blank lines, with each text headed
    // "Text A:", "Text B:" etc. The renderer treats it as a single
    // passage with internal sections.
    passage: z.string().min(50).max(20_000),
    questions: z.array(MultiMatchQ).min(1).max(20),
  }),
  z.object({
    exercise: z.literal(3),
    instruction: z.string().min(5).max(2000),
    passageTitle: z.string().min(1).max(300),
    passage: z.string().min(50).max(20_000),
    // Notes-completion shape: each question is a stem like "Cause: ___"
    // and the answer is one or two words from the passage. The
    // renderer reuses the cloze layout (passage above, blanks below).
    questions: z.array(NotesQ).min(1).max(20),
  }),
  z.object({
    exercise: z.literal(4),
    instruction: z.string().min(5).max(2000),
    passageTitle: z.string().min(1).max(300),
    passage: z.string().min(50).max(20_000),
    questions: z.array(ShortAnswerQ).min(1).max(20),
  }),
]);

const OlevelPaperSchema = z.object({
  setCode: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/i, 'setCode must be alphanumeric / underscore'),
  paperNumber: z.number().int().min(1).max(99),
  paperTitle: z.string().min(1).max(200).optional(),
  sections: z.array(SectionSchema).min(1).max(6),
});

@Controller('olevel-ingest')
export class OlevelIngestController {
  constructor(private readonly svc: OlevelIngestService) {}

  /** Ingest one 0510 paper. Lands rows as `status: draft`; promote
   *  with /approve once you've spot-checked them. */
  @Post('paper')
  async ingestPaper(@Body() body: unknown, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_only' });
    }
    const parsed = OlevelPaperSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.svc.ingestPaper(parsed.data, { id: user.id });
  }

  @Post('approve')
  async approve(@Body() body: unknown, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_only' });
    }
    const schema = z.object({
      sourceRefPrefix: z.string().regex(/^OLEVEL\/[a-z0-9_]+\/Paper\d+$/i),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.svc.approveByPrefix(parsed.data.sourceRefPrefix);
  }
}
