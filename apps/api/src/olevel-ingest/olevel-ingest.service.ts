import { Injectable, Logger } from '@nestjs/common';
import { QuestionStatus, QuestionType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

/**
 * R10 — OLEVEL English (CIE 1123) paper ingest. See
 * olevel-ingest.controller.ts for the API shape and rationale.
 *
 * Mapping to Question rows (one Question per question.n in payload):
 *   sourceRef     = `OLEVEL/<setCode>/Paper<n>/Q<m>`
 *                   (matches the `OLEVEL/<set>/Paper<n>` prefix
 *                    pickOlevelPaperAndCreatePaper groups on)
 *   sourceType    = past_paper_reference
 *   provenanceTag = `${setCode}_olevel`
 *   subjectId     = Subject {code:'1123'}
 *   componentId   = Subject's first component (OL)
 *   content / answerContent / options shape:
 *     - cloze:           { uiKind:'cloze',   passage, blankIndex, stem,
 *                          taskType:'cloze' }
 *                        answerContent.text = answer word
 *                        questionType = short_answer
 *     - vocab:           { uiKind:'vocab',   contextSentence, targetWord,
 *                          stem, taskType:'vocab' }
 *                        options + correct flag
 *                        questionType = mcq
 *     - transformation:  { uiKind:'transformation', original, starter,
 *                          stem, taskType:'transformation', maxWords?,
 *                          exampleAnswer }
 *                        answerContent.text = canonical rewrite
 *                        questionType = short_answer
 *     - comprehension:   { passage, stem, taskType:'multiple_choice',
 *                          uiKind:'comprehension' }
 *                        options + correct
 *                        questionType = mcq
 *
 * Idempotent on (sourceRef): re-POSTing the same paper skips rows
 * already present and never overwrites curated content.
 */

type ClozeQ = { n: number; blankIndex: number; answer: string };
type VocabQ = {
  n: number;
  contextSentence: string;
  targetWord: string;
  options: Array<{ key: string; text: string; correct: boolean }>;
  answer: string;
};
type TransformQ = {
  n: number;
  original: string;
  starter?: string;
  answer: string;
  maxWords?: number;
};
type CompQ = {
  n: number;
  stem: string;
  options: Array<{ key: string; text: string; correct: boolean }>;
  answer: string;
};
type Section =
  | { uiKind: 'cloze'; instruction: string; passage: string; questions: ClozeQ[] }
  | { uiKind: 'vocab'; instruction: string; questions: VocabQ[] }
  | { uiKind: 'transformation'; instruction: string; questions: TransformQ[] }
  | { uiKind: 'comprehension'; instruction: string; passage: string; questions: CompQ[] };

export interface OlevelPaperIngestInput {
  setCode: string;
  paperNumber: number;
  paperTitle?: string;
  sections: Section[];
}

export interface OlevelPaperIngestResult {
  sourceRefPrefix: string;
  created: number;
  skipped: number;
  questionIds: string[];
}

@Injectable()
export class OlevelIngestService {
  private readonly logger = new Logger('OlevelIngestService');

  constructor(private readonly prisma: PrismaService) {}

  async ingestPaper(
    input: OlevelPaperIngestInput,
    actor: { id: string },
  ): Promise<OlevelPaperIngestResult> {
    const sourceRefPrefix = `OLEVEL/${input.setCode}/Paper${input.paperNumber}`;
    const provenanceTag = `${input.setCode}_olevel`;

    const subject = await this.ensureOlevelSubject();
    const component = await this.ensureOlComponent(subject.id);

    const created: string[] = [];
    let skipped = 0;

    for (const section of input.sections) {
      for (const q of section.questions) {
        const sourceRef = `${sourceRefPrefix}/Q${q.n}`;
        const existing = await this.prisma.question.findFirst({
          where: { sourceType: 'past_paper_reference', sourceRef },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const built = this.buildQuestionData(section, q);
        const row = await this.prisma.question.create({
          data: {
            subjectId: subject.id,
            componentId: component.id,
            questionType: built.questionType,
            marks: 1,
            estimatedTimeMin: 1.5,
            difficulty: 2,
            sourceType: 'past_paper_reference',
            sourceRef,
            content: built.content,
            answerContent: built.answerContent,
            options: built.options ?? undefined,
            status: QuestionStatus.draft,
            createdById: actor.id,
            provenanceTag,
          },
        });
        created.push(row.id);
      }
    }

    this.logger.log(
      `ingest olevel paper ${sourceRefPrefix}: created=${created.length} skipped=${skipped}`,
    );
    return {
      sourceRefPrefix,
      created: created.length,
      skipped,
      questionIds: created,
    };
  }

  async approveByPrefix(sourceRefPrefix: string) {
    if (!/^OLEVEL\/[a-z0-9_]+\/Paper\d+$/i.test(sourceRefPrefix)) {
      throw new Error(`bad sourceRefPrefix: ${sourceRefPrefix}`);
    }
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
      `approve olevel paper ${sourceRefPrefix}: promoted=${drafts.length} alreadyActive=${matches.length - drafts.length}`,
    );
    return {
      sourceRefPrefix,
      promoted: drafts.length,
      alreadyActive: matches.length - drafts.length,
    };
  }

  /** Build content/answerContent/options/questionType per uiKind. */
  private buildQuestionData(
    section: Section,
    q: ClozeQ | VocabQ | TransformQ | CompQ,
  ): {
    questionType: QuestionType;
    content: any;
    answerContent: any;
    options: any | null;
  } {
    if (section.uiKind === 'cloze') {
      const cq = q as ClozeQ;
      return {
        questionType: QuestionType.short_answer,
        content: {
          uiKind: 'cloze',
          taskType: 'cloze',
          passage: section.passage,
          blankIndex: cq.blankIndex,
          stem: `${section.instruction}\n\nFill blank ${cq.blankIndex}.`,
        },
        answerContent: { text: cq.answer },
        options: null,
      };
    }
    if (section.uiKind === 'vocab') {
      const vq = q as VocabQ;
      return {
        questionType: QuestionType.mcq,
        content: {
          uiKind: 'vocab',
          taskType: 'vocab',
          contextSentence: vq.contextSentence,
          targetWord: vq.targetWord,
          stem: `${section.instruction}\n\n${vq.contextSentence}\n\nWhat does "${vq.targetWord}" mean here?`,
        },
        answerContent: { text: vq.answer },
        options: vq.options,
      };
    }
    if (section.uiKind === 'transformation') {
      const tq = q as TransformQ;
      return {
        questionType: QuestionType.short_answer,
        content: {
          uiKind: 'transformation',
          taskType: 'transformation',
          original: tq.original,
          starter: tq.starter ?? null,
          maxWords: tq.maxWords ?? null,
          exampleAnswer: tq.answer,
          stem: `${section.instruction}\n\nOriginal: ${tq.original}${tq.starter ? `\n\nStart with: ${tq.starter}` : ''}`,
        },
        answerContent: { text: tq.answer },
        options: null,
      };
    }
    // comprehension
    const cp = q as CompQ;
    return {
      questionType: QuestionType.mcq,
      content: {
        uiKind: 'comprehension',
        taskType: 'multiple_choice',
        passage: section.passage,
        stem: `${section.instruction}\n\n${cp.stem}`,
      },
      answerContent: { text: cp.answer },
      options: cp.options,
    };
  }

  private async ensureOlevelSubject() {
    const board = await this.prisma.examBoard.upsert({
      where: { code: 'CIE' },
      create: { code: 'CIE', name: 'Cambridge International (CIE)' },
      update: {},
    });
    const existing = await this.prisma.subject.findFirst({
      where: { code: '1123', examBoardId: board.id },
    });
    if (existing) return existing;
    return this.prisma.subject.create({
      data: {
        code: '1123',
        name: 'CIE 1123 English Language',
        level: 'O_LEVEL',
        examBoardId: board.id,
      },
    });
  }

  private async ensureOlComponent(subjectId: string) {
    return this.prisma.syllabusComponent.upsert({
      where: { subjectId_code: { subjectId, code: 'OL' } },
      create: { subjectId, code: 'OL', name: 'OLEVEL English' },
      update: {},
    });
  }
}
