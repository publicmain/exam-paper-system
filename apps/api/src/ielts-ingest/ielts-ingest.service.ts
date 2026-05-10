import { Injectable, Logger } from '@nestjs/common';
import { QuestionStatus, QuestionType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

export interface PassageIngestInput {
  bookCode: string;
  // R10 — when set, overrides the default `${bookCode}_authentic`
  // provenance tag. Use 'claude_simplified' for the simplified-IELTS
  // pool the morning-quiz dispatcher reads under level=ielts_simplified.
  provenanceTag?: string;
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
    const provenanceTag = input.provenanceTag ?? `${input.bookCode}_authentic`;

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
          // R10 L5 review gate: ingest lands rows as `draft` so a typo
          // in stem / answer can never reach a student before an admin
          // sign-off. Promote with POST /ielts-ingest/approve.
          // pickPassageAndCreatePaper filters on status='active' so
          // draft rows are invisible to morning-quiz scheduling.
          status: QuestionStatus.draft,
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

  /**
   * R10 L5 — admin promotes a passage's worth of draft rows to active.
   * Idempotent: re-running with all rows already active is a no-op.
   * Strict prefix match so an admin can't accidentally approve "/Test1/P1"
   * thinking it'll only hit Q1 — the prefix has to match the passage
   * boundary exactly, not the question id.
   */
  async approveBySourceRefPrefix(sourceRefPrefix: string): Promise<{
    sourceRefPrefix: string;
    promoted: number;
    alreadyActive: number;
  }> {
    // Validate the prefix matches the passage shape we mint in
    // ingestPassage so we can't be tricked into approving something
    // weird (e.g. an O-Level paper).
    if (!/^IELTS\/[a-z0-9_]+\/Test\d+\/P\d+$/i.test(sourceRefPrefix)) {
      throw new Error(
        `bad sourceRefPrefix: ${sourceRefPrefix}. Expected IELTS/<book>/Test<n>/P<n>.`,
      );
    }
    // Use startsWith to grab Q1..Q13 (and any future Q14+) under the
    // passage. A passage's Q rows share this prefix exactly + "/Q\d+".
    const matches = await this.prisma.question.findMany({
      where: { sourceRef: { startsWith: `${sourceRefPrefix}/Q` } },
      select: { id: true, status: true },
    });
    const drafts = matches.filter((m) => m.status === QuestionStatus.draft);
    if (drafts.length > 0) {
      await this.prisma.question.updateMany({
        where: { id: { in: drafts.map((d) => d.id) } },
        data: { status: QuestionStatus.active },
      });
    }
    this.logger.log(
      `approve passage ${sourceRefPrefix}: promoted=${drafts.length} alreadyActive=${matches.length - drafts.length}`,
    );
    return {
      sourceRefPrefix,
      promoted: drafts.length,
      alreadyActive: matches.length - drafts.length,
    };
  }

  private async ensureIeltsSubject() {
    const board = await this.prisma.examBoard.upsert({
      where: { code: 'IELTS' },
      create: { code: 'IELTS', name: 'IELTS' },
      update: {},
    });
    // R10 fix: any subject with code 'IELTS' under the IELTS exam board
    // is acceptable — `level` differs between the seed-local-mq.ts row
    // ('CEFR') and what ingest would create ('IELTS'), but
    // pickPassageAndCreatePaper does findFirst({where:{code:'IELTS'}})
    // so ingest must reuse whatever level value already exists.
    // Otherwise we end up with two IELTS subjects, ingest writes to one,
    // morning-quiz reads from the other, and the question pool looks
    // empty even though we just imported 40 questions.
    const existing = await this.prisma.subject.findFirst({
      where: { code: 'IELTS', examBoardId: board.id },
    });
    if (existing) return existing;
    return this.prisma.subject.create({
      data: {
        code: 'IELTS',
        name: 'IELTS Academic Reading',
        level: 'IELTS',
        examBoardId: board.id,
      },
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
