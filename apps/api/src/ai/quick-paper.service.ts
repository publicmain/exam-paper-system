import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReviewService } from '../review/review.service';
import {
  AiQuestionGeneratorService,
  GeneratedQuestionItemSummary,
} from './ai-question-generator.service';
import { OpenAiImageService } from './openai-image.service';
import { PaperStatus } from '@prisma/client';

export interface QuickPaperTopic {
  code: string;
  count: number;
}

export interface QuickPaperInput {
  syllabusCode: string;
  /** Either supply a single topicCode + count (legacy) or topics[] (multi). */
  topicCode?: string;
  count?: number;
  topics?: QuickPaperTopic[];
  durationMin?: number;
  includeDiagrams?: boolean;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  multiPart?: boolean;
  paperName?: string;
  classLabel?: string;
}

export interface QuickPaperResult {
  paperId: string;
  paperName: string;
  totalMarks: number;
  durationMin: number;
  questionCount: number;
  topicCount: number;
  diagramsRequested: number;
  diagramsGenerated: number;
  diagramErrors: string[];
  /** True when a sub-step partially failed (some topics, approvals, or
   *  diagrams did not succeed). UI should surface this as "partial" /
   *  "needs review" rather than the usual green "Done" state, so the
   *  teacher knows the paper may be missing diagrams or have fewer
   *  questions than requested. */
  partial: boolean;
  /** Human-readable lines describing each sub-step shortfall. Empty
   *  array when the run was complete. */
  warnings: string[];
  cost: {
    questionsUsd: number;
    diagramsUsd: number;
    totalUsd: number;
  };
  elapsedMs: {
    questions: number;
    approval: number;
    diagrams: number;
    paper: number;
    total: number;
  };
}

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

interface ApprovedItem {
  summary: GeneratedQuestionItemSummary;
  topicCode: string;
  questionId: string;
  componentId: string | null;
  subjectId: string;
  marks: number;
}

const PARALLEL_TOPIC_LIMIT = 4;
const PARALLEL_DIAGRAM_LIMIT = 4;

/**
 * One-click orchestrator. Two modes:
 *
 *   single — generate N questions on ONE topic (the original Quick Paper).
 *   multi  — accept topics[] like [{code:'CS.1',count:2},{code:'CS.3',count:1}]
 *            and fan out parallel Claude calls per topic; useful for
 *            mock-exam style papers that span Sections 1-12.
 *
 * Topic-level parallelism is capped at PARALLEL_TOPIC_LIMIT and diagram
 * parallelism at PARALLEL_DIAGRAM_LIMIT so we don't trip Anthropic /
 * OpenAI per-org rate limits when a teacher clicks "Mock Exam" on a
 * 30-question paper.
 */
@Injectable()
export class QuickPaperService {
  private readonly logger = new Logger('QuickPaperService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly aiQuestions: AiQuestionGeneratorService,
    private readonly openaiImage: OpenAiImageService,
    private readonly review: ReviewService,
  ) {}

  async generate(input: QuickPaperInput, actor: ActorCtx): Promise<QuickPaperResult> {
    const t0 = Date.now();
    const includeDiagrams = input.includeDiagrams ?? true;

    // Normalise legacy { topicCode, count } into topics[].
    let topics: QuickPaperTopic[] = [];
    if (input.topics && input.topics.length > 0) {
      topics = input.topics
        .map((t) => ({ code: t.code, count: Math.max(1, Math.min(10, t.count)) }))
        .filter((t) => t.code);
    } else if (input.topicCode) {
      topics = [{ code: input.topicCode, count: Math.max(1, Math.min(10, input.count ?? 5)) }];
    }
    if (topics.length === 0) {
      throw new BadRequestException('At least one topic must be supplied.');
    }
    if (topics.length > 20) {
      throw new BadRequestException('At most 20 topics allowed per paper.');
    }
    const totalRequested = topics.reduce((s, t) => s + t.count, 0);
    if (totalRequested > 30) {
      throw new BadRequestException(
        `Total questions across topics is ${totalRequested}; max 30 per paper.`,
      );
    }

    // ---- Step 1: Author questions via Claude (parallel by topic, capped) ----
    const tQ0 = Date.now();
    const perTopicResults = await this.runWithLimit(
      topics,
      PARALLEL_TOPIC_LIMIT,
      async (t) => {
        try {
          const r = await this.aiQuestions.generate(
            {
              syllabusCode: input.syllabusCode,
              topicCode: t.code,
              count: t.count,
              difficulty: input.difficulty,
              multiPart: input.multiPart ?? true,
            },
            actor,
          );
          return { topic: t, ok: true as const, result: r };
        } catch (e: any) {
          return { topic: t, ok: false as const, error: String(e?.message ?? e).slice(0, 200) };
        }
      },
    );
    const tQ = Date.now() - tQ0;

    const successfulTopics = perTopicResults.filter((r) => r.ok);
    if (successfulTopics.length === 0) {
      throw new ServiceUnavailableException(
        'No topics produced any questions: ' +
          perTopicResults
            .map((r) => (r.ok ? '' : `${r.topic.code}=${r.error}`))
            .filter(Boolean)
            .join('; '),
      );
    }
    const questionsCostUsd = successfulTopics.reduce(
      (s, r) => s + (r.ok ? r.result.costUsd : 0),
      0,
    );

    // Flatten items in topic order so the paper has Topic 1's questions
    // first, then Topic 2's, etc.
    const flatItems: { topicCode: string; item: GeneratedQuestionItemSummary }[] = [];
    for (const r of perTopicResults) {
      if (!r.ok) continue;
      for (const it of r.result.items) flatItems.push({ topicCode: r.topic.code, item: it });
    }

    // ---- Step 2: Auto-approve every draft into the live Question bank ----
    const tA0 = Date.now();
    const approved: ApprovedItem[] = [];
    const approveErrors: string[] = [];
    for (const { topicCode, item } of flatItems) {
      try {
        // Tag these as quick-paper output so they're excluded from the
        // default question pool used by the regular paper-generation flow.
        // Other teachers won't get un-curated AI questions in their papers
        // unless they explicitly opt in via includeAiQuickPaper.
        const result = await this.review.approve(item.questionItemId, actor, {
          provenanceTag: 'ai_quick_paper',
        });
        approved.push({
          summary: item,
          topicCode,
          questionId: result.question.id,
          componentId: result.question.componentId,
          subjectId: result.question.subjectId,
          marks: result.question.marks,
        });
      } catch (e: any) {
        approveErrors.push(`${item.questionItemId}: ${String(e?.message ?? e).slice(0, 120)}`);
      }
    }
    const tA = Date.now() - tA0;

    if (approved.length === 0) {
      throw new ServiceUnavailableException(
        'No drafts were approved into the question bank — paper cannot be assembled.',
      );
    }

    // Reject mixed-component papers (AS topics + A2 topics in one paper
    // makes no pedagogical sense; the UI prevents it but the API
    // double-checks).
    const componentIds = Array.from(
      new Set(approved.map((a) => a.componentId).filter((x): x is string => !!x)),
    );
    if (componentIds.length > 1) {
      throw new BadRequestException(
        'Topics span multiple components (e.g. AS + A2). A single paper must stay within one component.',
      );
    }

    // ---- Step 3: Generate diagrams in parallel (best-effort, capped) ----
    const tD0 = Date.now();
    let diagramsRequested = 0;
    let diagramsGenerated = 0;
    let diagramsCostUsd = 0;
    const diagramErrors: string[] = [];
    if (includeDiagrams) {
      const targets = approved.filter((a) => a.summary.diagram?.needed === true);
      diagramsRequested = targets.length;
      const results = await this.runWithLimit(
        targets,
        PARALLEL_DIAGRAM_LIMIT,
        async (a) => {
          const d = a.summary.diagram;
          // The pre-filter above guarantees d.needed === true, but
          // narrow it here so the discriminated union picks the
          // populated branch and we can read d.type/scene/labels.
          if (!d || d.needed !== true) {
            return { ok: false as const, error: 'no diagram hint' };
          }
          try {
            const out = await this.openaiImage.generateDiagram(
              {
                questionId: a.questionId,
                diagramType: d.type,
                syllabus: input.syllabusCode,
                topicCode: a.topicCode,
                scene: d.scene,
                labels: d.labels,
                size: '1024x1024',
                quality: 'medium',
              },
              actor,
            );
            return { ok: true as const, cost: out.costUsd };
          } catch (e: any) {
            return { ok: false as const, error: String(e?.message ?? e).slice(0, 200) };
          }
        },
      );
      for (const r of results) {
        if (r.ok) {
          diagramsGenerated++;
          diagramsCostUsd += r.cost;
        } else {
          diagramErrors.push(r.error);
        }
      }
    }
    const tD = Date.now() - tD0;

    // ---- Step 4: Manually assemble the Paper from those exact Questions ----
    const tP0 = Date.now();
    const totalMarks = approved.reduce((s, a) => s + a.marks, 0);
    const durationMin =
      input.durationMin ?? Math.max(15, Math.round(totalMarks * 1.0));
    const subjectId = approved[0].subjectId;
    const componentId = componentIds[0] ?? null;

    const paperName =
      input.paperName ??
      (topics.length === 1
        ? `Quick Paper · ${input.syllabusCode} ${topics[0].code}`
        : `Mock Paper · ${input.syllabusCode} (${topics.length} sections)`);

    // Re-pull Question rows so we can snapshot content / options / answers.
    const questionRows = await this.prisma.question.findMany({
      where: { id: { in: approved.map((a) => a.questionId) } },
      include: { assets: true },
    });
    const byId = new Map(questionRows.map((q) => [q.id, q]));

    // Wrap paper + usage logs + version row in a single transaction so a
    // mid-step failure rolls back instead of leaving an orphaned paper
    // with no usage tracking or version history.
    const paper = await this.prisma.$transaction(async (tx) => {
      const created = await tx.paper.create({
        data: {
          ownerId: actor.id,
          name: paperName,
          classLabel: input.classLabel ?? null,
          subjectId,
          componentId,
          durationMin,
          totalMarksTarget: totalMarks,
          totalMarksActual: totalMarks,
          status: PaperStatus.draft,
          generatedSeed: 0,
          config: {
            quickPaper: true,
            syllabusCode: input.syllabusCode,
            topics,
            includeDiagrams,
            difficulty: input.difficulty ?? null,
          } as any,
          questions: {
            create: approved.map((a, idx) => {
              const q = byId.get(a.questionId);
              return {
                questionId: a.questionId,
                sortOrder: idx,
                snapshotContent: (q?.content as any) ?? null,
                snapshotAnswer: (q?.answerContent as any) ?? null,
                snapshotOptions: (q?.options as any) ?? null,
                marks: a.marks,
              };
            }),
          },
        },
      });
      await tx.questionUsageLog.createMany({
        data: approved.map((a) => ({
          questionId: a.questionId,
          paperId: created.id,
          classLabel: input.classLabel ?? null,
        })),
      });
      await tx.paperVersion.create({
        data: {
          paperId: created.id,
          versionNumber: 1,
          snapshot: created as any,
          changedById: actor.id,
          changeNote: 'quick-paper generated',
        },
      });
      return created;
    });
    const tP = Date.now() - tP0;

    // ---- Build the warnings list so the UI can show "partial" instead
    //      of a misleading "Done" when sub-steps did not all succeed. ----
    const failedTopics = perTopicResults.filter((r) => !r.ok);
    const warnings: string[] = [];
    for (const f of failedTopics) {
      if (!f.ok) warnings.push(`Topic ${f.topic.code} produced no questions: ${f.error}`);
    }
    if (approveErrors.length > 0) {
      warnings.push(
        `${approveErrors.length} draft question(s) could not be approved into the bank.`,
      );
    }
    if (diagramsRequested > 0 && diagramsGenerated < diagramsRequested) {
      warnings.push(
        `Only ${diagramsGenerated} of ${diagramsRequested} diagrams generated; ` +
          `the rest can be re-generated from each question's edit page.`,
      );
    }
    const partial = warnings.length > 0;

    const total = Date.now() - t0;

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ai.quick_paper.generate',
      entityType: 'paper',
      entityId: paper.id,
      metadata: {
        syllabusCode: input.syllabusCode,
        topics,
        topicCount: topics.length,
        approvedQuestions: approved.length,
        approveErrors,
        diagramsRequested,
        diagramsGenerated,
        diagramErrors,
        partial,
        warnings,
        questionsCostUsd: Math.round(questionsCostUsd * 10000) / 10000,
        diagramsCostUsd: Math.round(diagramsCostUsd * 10000) / 10000,
        elapsedMs: { total, questions: tQ, approval: tA, diagrams: tD, paper: tP },
      },
      ip: actor.ip ?? null,
    });

    this.logger.log(
      `quick-paper ${partial ? 'partial' : 'ok'} ${input.syllabusCode} ` +
        `topics=${topics.length} q=${approved.length} ` +
        `dia=${diagramsGenerated}/${diagramsRequested} ` +
        `$${(questionsCostUsd + diagramsCostUsd).toFixed(4)} ${total}ms`,
    );

    return {
      paperId: paper.id,
      paperName: paper.name,
      totalMarks,
      durationMin,
      questionCount: approved.length,
      topicCount: topics.length,
      diagramsRequested,
      diagramsGenerated,
      diagramErrors,
      partial,
      warnings,
      cost: {
        questionsUsd: Math.round(questionsCostUsd * 10000) / 10000,
        diagramsUsd: Math.round(diagramsCostUsd * 10000) / 10000,
        totalUsd: Math.round((questionsCostUsd + diagramsCostUsd) * 10000) / 10000,
      },
      elapsedMs: {
        questions: tQ,
        approval: tA,
        diagrams: tD,
        paper: tP,
        total,
      },
    };
  }

  /** Bounded-concurrency runner (up to `limit` in flight). */
  private async runWithLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers: Promise<void>[] = [];
    const worker = async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= items.length) return;
        results[idx] = await fn(items[idx]);
      }
    };
    for (let i = 0; i < Math.min(limit, items.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
    return results;
  }
}
