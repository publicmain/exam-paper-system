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
 * R10 — admin-only ingest API for OLEVEL English (CIE 1123) papers.
 *
 * Sister to /api/ielts-ingest/passage. The OLEVEL paper structure is
 * fundamentally different from IELTS Reading — there is no single long
 * passage; one paper is a mix of:
 *   * cloze         (a short passage with N numbered blanks)
 *   * vocab         (independent vocab-in-context MCQs)
 *   * transformation (rewrite the sentence keeping meaning)
 *   * comprehension (short passage + MCQs)
 *
 * The morning-quiz exam shell already has a renderer per uiKind, so the
 * ingest payload is grouped by section. A "set" is one whole paper
 * (sourceRef = `OLEVEL/<setCode>/Paper<n>/Q<m>`); the morning-quiz
 * dispatcher's pickOlevelPaperAndCreatePaper picks one set per
 * (date, class, level=olevel) per day, with 30-day per-class de-dup.
 *
 * Workflow with Claude as the author:
 *   1. Operator asks Claude to write an OLEVEL paper (typically
 *      18 questions: 6 cloze + 6 vocab + 6 transformation).
 *   2. Claude POSTs the structured JSON here (admin token).
 *   3. Idempotent on per-question sourceRef — re-POSTing the same
 *      setCode + paperNumber + n is a skip, not a duplicate.
 */

const ClozeQuestionSchema = z.object({
  n: z.number().int().min(1).max(80),
  blankIndex: z.number().int().min(1).max(20),
  // Canonical answer string (1–3 words). autoGradeScripts normalises
  // case + whitespace + trailing punctuation, so "his" / " His " / "his."
  // all match.
  answer: z.string().min(1).max(80),
});

const VocabQuestionSchema = z.object({
  n: z.number().int().min(1).max(80),
  contextSentence: z.string().min(5).max(500),
  targetWord: z.string().min(1).max(60),
  options: z
    .array(
      z.object({
        key: z.string().min(1).max(8),
        text: z.string().min(1).max(200),
        correct: z.boolean(),
      }),
    )
    .min(2)
    .max(6),
  answer: z.string().min(1).max(8),
});

const TransformationQuestionSchema = z.object({
  n: z.number().int().min(1).max(80),
  original: z.string().min(5).max(400),
  starter: z.string().min(0).max(200).optional(),
  // Acceptable rewrite. autoGradeScripts will only short-circuit auto-
  // grade if the canonical text is ≤ 80 chars (otherwise routed to
  // marker queue). For longer "exemplar" rewrites, set
  // shouldAutoGrade=false explicitly to keep the marker workflow.
  answer: z.string().min(1).max(400),
  maxWords: z.number().int().min(3).max(40).optional(),
});

const ComprehensionQuestionSchema = z.object({
  n: z.number().int().min(1).max(80),
  // Standalone stem (the passage is shared at the section level so
  // the renderer can show it once).
  stem: z.string().min(5).max(800),
  options: z
    .array(
      z.object({
        key: z.string().min(1).max(8),
        text: z.string().min(1).max(300),
        correct: z.boolean(),
      }),
    )
    .min(2)
    .max(6),
  answer: z.string().min(1).max(8),
});

const SectionSchema = z.discriminatedUnion('uiKind', [
  z.object({
    uiKind: z.literal('cloze'),
    instruction: z.string().min(5).max(800),
    passage: z.string().min(20).max(8000),
    questions: z.array(ClozeQuestionSchema).min(1).max(20),
  }),
  z.object({
    uiKind: z.literal('vocab'),
    instruction: z.string().min(5).max(800),
    questions: z.array(VocabQuestionSchema).min(1).max(20),
  }),
  z.object({
    uiKind: z.literal('transformation'),
    instruction: z.string().min(5).max(800),
    questions: z.array(TransformationQuestionSchema).min(1).max(20),
  }),
  z.object({
    uiKind: z.literal('comprehension'),
    instruction: z.string().min(5).max(800),
    passage: z.string().min(20).max(8000),
    questions: z.array(ComprehensionQuestionSchema).min(1).max(20),
  }),
]);

const OlevelPaperSchema = z.object({
  // Set = a Claude-curation cohort, e.g. "claude_olevel_v1" or
  // "youthtech_2026_w1". Drives the Question.sourceRef prefix:
  // sourceRef = `OLEVEL/<setCode>/Paper<n>/Q<m>`.
  setCode: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/i, 'setCode must be alphanumeric / underscore'),
  paperNumber: z.number().int().min(1).max(50),
  paperTitle: z.string().min(1).max(200).optional(),
  sections: z.array(SectionSchema).min(1).max(8),
});

@Controller('olevel-ingest')
export class OlevelIngestController {
  constructor(private readonly svc: OlevelIngestService) {}

  /** Ingest one OLEVEL paper (sections × questions). Lands all rows
   *  as `status: draft`; flip to active with /approve below. */
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

  /** Promote a paper's draft questions to active. Body:
   *  { sourceRefPrefix: "OLEVEL/<setCode>/Paper<n>" } */
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
