import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { cleanCieQuestionText } from '../common/cie-text-cleanup';
import { classifyText } from './rules-9618';

export interface ClassifyBatchResult {
  scanned: number;
  classified: number;
  unmatched: number;
  errors: Array<{ itemId: string; error: string }>;
  topicHistogram: Record<string, number>;
}

@Injectable()
export class RuleClassifierService {
  private readonly logger = new Logger('RuleClassifier');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run keyword-rule classification across every QuestionItem in a repo
   * (optionally narrowed by syllabusCode). Updates suggestedTopicCode +
   * confidenceTopic and writes a QuestionItemTopic link with taggedBy =
   * `rule`. Items the rules can't match are left untagged so the teacher
   * can resolve them in the UI rather than receiving a confidently wrong
   * label.
   */
  async classifyForRepo(
    repoId: string,
    opts: { syllabusCode?: string; overwrite?: boolean } = {},
  ): Promise<ClassifyBatchResult> {
    const items = await this.prisma.questionItem.findMany({
      where: {
        sourceFile: {
          repoId,
          ...(opts.syllabusCode ? { syllabusCode: opts.syllabusCode } : {}),
        },
        // Skip items that already carry a manual or AI tag unless caller
        // explicitly asked to overwrite (used when iterating on rules).
        ...(opts.overwrite ? {} : { suggestedTopicCode: null }),
      },
      include: { sourceFile: true },
    });

    const result: ClassifyBatchResult = {
      scanned: items.length,
      classified: 0,
      unmatched: 0,
      errors: [],
      topicHistogram: {},
    };

    for (const item of items) {
      try {
        // Score against scrubbed text — without this, the legal footer
        // CIE appends to every paper ("Permission to reproduce... Copyright
        // Acknowledgements... UCLES...") feeds 'copyright/license' tokens
        // into the CS.7 Ethics rule and creates dozens of false positives
        // for whatever question happened to be the last one to slurp the
        // footer up before splitter boundaries fire.
        const text = cleanCieQuestionText(item.rawExtractedText ?? '');
        if (!text) {
          result.unmatched++;
          continue;
        }
        const out = classifyText(text, item.sourceFile?.paperVariant ?? null);
        if (!out.topicCode) {
          result.unmatched++;
          continue;
        }

        // Resolve topicCode → topicId for this syllabus. Topic codes are
        // unique within a SyllabusComponent in the schema, so we narrow
        // by the question's known component (paperVariant → P<n>).
        const topic = await this.prisma.topic.findFirst({
          where: {
            code: out.topicCode,
            component: {
              subject: { code: item.sourceFile?.syllabusCode ?? '' },
            },
          },
        });
        if (!topic) {
          result.errors.push({
            itemId: item.id,
            error: `topic ${out.topicCode} not found in syllabus`,
          });
          continue;
        }

        await this.prisma.$transaction([
          this.prisma.questionItem.update({
            where: { id: item.id },
            data: {
              suggestedTopicCode: out.topicCode,
              confidenceTopic: out.confidence,
              suggestedMetadata: {
                source: 'rule-classifier',
                version: '9618-v1',
                scores: out.scores,
              } as any,
            },
          }),
          // Upsert the topic link so re-runs are idempotent.
          this.prisma.questionItemTopic.upsert({
            where: {
              questionItemId_topicId: { questionItemId: item.id, topicId: topic.id },
            },
            create: {
              questionItemId: item.id,
              topicId: topic.id,
              confidence: out.confidence,
              taggedBy: 'heuristic',
            },
            update: {
              confidence: out.confidence,
              taggedBy: 'heuristic',
            },
          }),
        ]);

        result.classified++;
        result.topicHistogram[out.topicCode] =
          (result.topicHistogram[out.topicCode] ?? 0) + 1;
      } catch (e: any) {
        result.errors.push({
          itemId: item.id,
          error: String(e?.message ?? e).slice(0, 300),
        });
      }
    }

    this.logger.log(
      `Repo ${repoId} classified ${result.classified}/${result.scanned} (unmatched=${result.unmatched})`,
    );
    return result;
  }
}
