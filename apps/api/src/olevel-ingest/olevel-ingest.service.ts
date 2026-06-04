import { Injectable, Logger } from '@nestjs/common';
import { QuestionStatus, QuestionType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

/**
 * R10 — IGCSE 0510 Paper 1 R&W Extended ingest. See
 * olevel-ingest.controller.ts for the API shape.
 *
 * Per question we write:
 *   sourceRef     = `OLEVEL/<setCode>/Paper<n>/Q<m>`
 *   provenanceTag = `cambridge_0510`
 *   subjectId     = Subject {code:'1123'} (we keep the existing 1123
 *                   subject as the OLEVEL container; the renderer
 *                   doesn't care which CIE syllabus row backs the
 *                   paper, only the per-question content shape)
 *   questionType  = mcq for Exercise 2, short_answer for the others
 *   content       = { uiKind, taskType, passage, passageTitle?, stem,
 *                     instruction }
 *                   uiKind values used:
 *                     'olevel_short_answer'   (Ex 1, 4)
 *                     'olevel_multi_match'    (Ex 2)
 *                     'olevel_notes'          (Ex 3 — uses cloze-like
 *                       renderer)
 *   answerContent = { text: <canonical answer> }
 *   options       = MCQ options for Ex 2; null otherwise
 */

type ShortAnswerQ = { n: number; stem: string; answer: string; marks?: number };
type MultiMatchQ = {
  n: number;
  stem: string;
  options: Array<{ key: string; text: string; correct: boolean }>;
  answer: string;
  marks?: number;
};
type NotesQ = { n: number; stem: string; answer: string; marks?: number };

type Section =
  | {
      exercise: 1 | 4;
      instruction: string;
      passageTitle: string;
      passage: string;
      questions: ShortAnswerQ[];
    }
  | {
      exercise: 2;
      instruction: string;
      passage: string;
      questions: MultiMatchQ[];
    }
  | {
      exercise: 3;
      instruction: string;
      passageTitle: string;
      passage: string;
      questions: NotesQ[];
    };

export interface OlevelPaperIngestInput {
  setCode: string;
  paperNumber: number;
  paperTitle?: string;
  /**
   * Override the default provenanceTag. Cambridge IGCSE 0510 papers
   * (the original olevel content) use `cambridge_0510`; Singapore-
   * Cambridge 1128/1184 papers use `singapore_olevel_1128`. The
   * morning-quiz picker reads BOTH by joining on subject+component
   * instead of provenance, so this field is mostly informational
   * but lets us split the bank by syllabus for analytics.
   */
  provenanceTag?: string;
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
    const provenanceTag = input.provenanceTag ?? 'cambridge_0510';

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
        const marks = (q as { marks?: number }).marks ?? 1;
        const row = await this.prisma.question.create({
          data: {
            subjectId: subject.id,
            componentId: component.id,
            questionType: built.questionType,
            marks,
            estimatedTimeMin: marks >= 3 ? 3 : marks === 2 ? 2 : 1.5,
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
      `ingest 0510 paper ${sourceRefPrefix}: created=${created.length} skipped=${skipped}`,
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
      `approve 0510 paper ${sourceRefPrefix}: promoted=${drafts.length} alreadyActive=${matches.length - drafts.length}`,
    );
    return {
      sourceRefPrefix,
      promoted: drafts.length,
      alreadyActive: matches.length - drafts.length,
    };
  }

  private buildQuestionData(
    section: Section,
    q: ShortAnswerQ | MultiMatchQ | NotesQ,
  ): {
    questionType: QuestionType;
    content: any;
    answerContent: any;
    options: any | null;
  } {
    if (section.exercise === 2) {
      const mq = q as MultiMatchQ;
      return {
        questionType: QuestionType.mcq,
        content: {
          uiKind: 'olevel_multi_match',
          taskType: 'multi_match',
          passage: section.passage,
          stem: `${section.instruction}\n\n${mq.stem}`,
        },
        answerContent: { text: mq.answer },
        options: mq.options,
      };
    }
    if (section.exercise === 3) {
      const nq = q as NotesQ;
      return {
        questionType: QuestionType.short_answer,
        content: {
          uiKind: 'olevel_notes',
          taskType: 'note_completion',
          passage: section.passage,
          passageTitle: section.passageTitle,
          stem: `${section.instruction}\n\n${nq.stem}`,
        },
        answerContent: { text: nq.answer },
        options: null,
      };
    }
    // Exercises 1 and 4 share the short-answer comprehension shape.
    const sq = q as ShortAnswerQ;
    return {
      questionType: QuestionType.short_answer,
      content: {
        uiKind: 'olevel_short_answer',
        taskType: 'short_answer',
        passage: section.passage,
        passageTitle: section.passageTitle,
        stem: `${section.instruction}\n\n${sq.stem}`,
      },
      answerContent: { text: sq.answer },
      options: null,
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
        name: 'CIE 1123 / 0510 English',
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
