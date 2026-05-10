import { Injectable, Logger } from '@nestjs/common';
import { QuestionStatus, QuestionType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

export interface PassageIngestInput {
  bookCode: string;
  testNumber: number;
  passageNumber: number;
  passage: { title: string; body: string };
  questions: Array<{
    n: number;
    questionType: 'mcq' | 'short_answer';
    taskType: string;
    instruction: string;
    stem: string;
    options?: Array<{ key: string; text: string; correct: boolean }> | null;
    answer: string;
  }>;
}

export interface PassageIngestResult {
  sourceRefPrefix: string;
  created: number;
  skipped: number;
  questionIds: string[];
}

/**
 * Writes one IELTS Reading passage's worth of Question rows into the
 * bank. Mirrors the seed-local-mq.ts shape exactly so morning-quiz
 * pickPassageAndCreatePaper picks them up without any further glue.
 *
 * Schema mapping (per Question row):
 *   sourceRef     = `${bookCode}/Test${testNumber}/P${passageNumber}/Q${n}`
 *                   matches /^([^/]+\/[^/]+\/Test\d+\/P\d+)\// in
 *                   pickPassageAndCreatePaper so each ingested passage
 *                   becomes a poolable unit immediately.
 *   sourceType    = past_paper_reference (Cambridge-published material)
 *   provenanceTag = `${bookCode}_authentic` (e.g. cambridge_ielts_8_authentic)
 *   content.passage / passageTitle = repeated on every Q in the passage.
 *                                    Wasteful but matches existing seed
 *                                    + lets pickPassage work without a
 *                                    schema change.
 *   content.taskType = the IELTS task (matching_headings, …) the
 *                      front-end QuestionTypeRegistry switches on.
 *   content.stem     = instruction + "\n\n" + stem (renderer expects
 *                      the rubric in front, same shape as seed).
 *   answerContent    = { text: <answer> } — autoGradeScripts compares
 *                      after normalizing whitespace + case + trailing
 *                      punctuation, so "ii" / "II" / " ii. " all match.
 *   options          = MCQ array with one `correct: true`; null for
 *                      short_answer.
 *
 * Idempotency: every Question.sourceRef has a unique constraint via the
 * (sourceType, sourceRef) check pattern we apply with findFirst. A
 * re-ingest of the same passage skips rows that already exist, so the
 * operator can re-POST without creating duplicates.
 */
@Injectable()
export class IeltsIngestService {
  private readonly logger = new Logger('IeltsIngestService');

  constructor(private readonly prisma: PrismaService) {}

  async ingestPassage(
    input: PassageIngestInput,
    actor: { id: string },
  ): Promise<PassageIngestResult> {
    // sourceRef format: `IELTS/<bookCode>/Test<n>/P<n>/Q<n>`. The leading
    // `IELTS/` segment is required so this matches the regex
    //   /^([^/]+\/[^/]+\/Test\d+\/P\d+)\//
    // in morning-quiz.pickPassageAndCreatePaper, which counts on 4
    // slash-separated segments before the question id. Same convention
    // as the existing seed-local-mq.ts ("IELTS/SEED/Test1/P1/Q1").
    const sourceRefPrefix = `IELTS/${input.bookCode}/Test${input.testNumber}/P${input.passageNumber}`;
    const provenanceTag = `${input.bookCode}_authentic`;

    // Lazily create the IELTS subject + AUTH component if missing. This
    // is the same shape seed-local-mq.ts uses; we don't re-create the
    // examBoard if it's already there.
    const subject = await this.ensureIeltsSubject();
    const component = await this.ensureAuthComponent(subject.id);

    const passageMeta = {
      passage: input.passage.body,
      passageTitle: input.passage.title,
    };

    const created: string[] = [];
    let skipped = 0;

    for (const q of input.questions) {
      const sourceRef = `${sourceRefPrefix}/Q${q.n}`;
      // Idempotency check — skip rows already in the bank.
      const existing = await this.prisma.question.findFirst({
        where: {
          sourceType: 'past_paper_reference',
          sourceRef,
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Coerce the Zod-validated questionType into the Prisma enum.
      const qt: QuestionType =
        q.questionType === 'mcq' ? QuestionType.mcq : QuestionType.short_answer;

      const row = await this.prisma.question.create({
        data: {
          subjectId: subject.id,
          componentId: component.id,
          questionType: qt,
          marks: 1,
          // IELTS reading questions average ~1.5 min each (60 min / 40 q).
          estimatedTimeMin: 1.5,
          difficulty: 3,
          sourceType: 'past_paper_reference',
          sourceRef,
          content: {
            ...passageMeta,
            taskType: q.taskType,
            // Same shape as seed-local-mq.ts: instruction first, then a
            // blank line, then the per-question stem. The renderer
            // displays this verbatim.
            stem: `${q.instruction}\n\n${q.stem}`,
          },
          answerContent: { text: q.answer },
          // For MCQ pass through; for short_answer Prisma wants undefined
          // not null when the column is JSON-nullable but unset.
          options: q.options && q.options.length > 0 ? q.options : undefined,
          status: QuestionStatus.active,
          createdById: actor.id,
          provenanceTag,
        },
      });
      created.push(row.id);
    }

    this.logger.log(
      `ingest passage ${sourceRefPrefix}: created=${created.length} skipped=${skipped}`,
    );

    return {
      sourceRefPrefix,
      created: created.length,
      skipped,
      questionIds: created,
    };
  }

  private async ensureIeltsSubject() {
    const board = await this.prisma.examBoard.upsert({
      where: { code: 'IELTS' },
      create: { code: 'IELTS', name: 'IELTS' },
      update: {},
    });
    // Schema declares @@unique([examBoardId, code, level]) on Subject,
    // so the Prisma compound key is `examBoardId_code_level`.
    return this.prisma.subject.upsert({
      where: {
        examBoardId_code_level: {
          examBoardId: board.id,
          code: 'IELTS',
          level: 'IELTS',
        },
      },
      create: {
        code: 'IELTS',
        name: 'IELTS Academic Reading',
        level: 'IELTS',
        examBoardId: board.id,
      },
      update: {},
    });
  }

  private async ensureAuthComponent(subjectId: string) {
    // Schema declares @@unique([subjectId, code]) → `subjectId_code`.
    return this.prisma.syllabusComponent.upsert({
      where: { subjectId_code: { subjectId, code: 'AUTH' } },
      create: {
        code: 'AUTH',
        name: 'Authentic IELTS Reading',
        subjectId,
      },
      update: {},
    });
  }
}
