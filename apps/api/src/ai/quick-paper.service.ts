import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReviewService } from '../review/review.service';
import { AiQuestionGeneratorService } from './ai-question-generator.service';
import { OpenAiImageService } from './openai-image.service';
import { PaperStatus } from '@prisma/client';

export interface QuickPaperInput {
  syllabusCode: string;
  topicCode: string;
  count?: number;             // default 5
  durationMin?: number;       // default = totalMarks × 1.0 minutes (rounded up)
  totalMarksTarget?: number;  // informational only
  includeDiagrams?: boolean;  // default true
  difficulty?: 1 | 2 | 3 | 4 | 5;
  multiPart?: boolean;        // default true
  paperName?: string;
  classLabel?: string;
}

export interface QuickPaperResult {
  paperId: string;
  paperName: string;
  totalMarks: number;
  durationMin: number;
  questionCount: number;
  diagramsRequested: number;
  diagramsGenerated: number;
  diagramErrors: string[];
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

/**
 * One-click "Generate a complete paper" orchestrator. Chains four
 * existing services: AiQuestionGenerator → ReviewService.approve →
 * OpenAiImageService.generateDiagram (parallel, only for questions
 * where Claude flagged a diagram as useful) → manual paper assembly
 * (bypasses GenerationService so the paper contains EXACTLY the
 * just-authored Questions, not a random pick from the bank).
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
    const count = Math.max(1, Math.min(input.count ?? 5, 10));
    const includeDiagrams = input.includeDiagrams ?? true;

    // ---- Step 1: Author questions via Claude ----
    const tQ0 = Date.now();
    const genResult = await this.aiQuestions.generate(
      {
        syllabusCode: input.syllabusCode,
        topicCode: input.topicCode,
        count,
        difficulty: input.difficulty,
        multiPart: input.multiPart ?? true,
      },
      actor,
    );
    const tQ = Date.now() - tQ0;
    if (genResult.items.length === 0) {
      throw new ServiceUnavailableException(
        `Claude returned no usable questions: ${genResult.errors.join(', ') || 'unknown error'}`,
      );
    }

    // ---- Step 2: Auto-approve each draft into the live Question bank ----
    const tA0 = Date.now();
    const approved: Array<{
      summary: typeof genResult.items[number];
      questionId: string;
      componentId: string | null;
      subjectId: string;
      marks: number;
    }> = [];
    for (const item of genResult.items) {
      try {
        const result = await this.review.approve(item.questionItemId, actor);
        approved.push({
          summary: item,
          questionId: result.question.id,
          componentId: result.question.componentId,
          subjectId: result.question.subjectId,
          marks: result.question.marks,
        });
      } catch (e: any) {
        this.logger.warn(`approve failed for item ${item.questionItemId}: ${e.message}`);
      }
    }
    const tA = Date.now() - tA0;

    if (approved.length === 0) {
      throw new ServiceUnavailableException(
        'No drafts were approved into the question bank — paper cannot be assembled.',
      );
    }

    // ---- Step 3: Generate diagrams in parallel (best-effort, server-side) ----
    const tD0 = Date.now();
    let diagramsRequested = 0;
    let diagramsGenerated = 0;
    let diagramsCostUsd = 0;
    const diagramErrors: string[] = [];
    if (includeDiagrams) {
      const targets = approved.filter(
        (a) => a.summary.diagram?.needed === true,
      );
      diagramsRequested = targets.length;
      const results = await Promise.all(
        targets.map(async (a) => {
          const d = a.summary.diagram!;
          if (d.needed !== true) return null;
          try {
            const out = await this.openaiImage.generateDiagram(
              {
                questionId: a.questionId,
                diagramType: d.type,
                syllabus: input.syllabusCode,
                topicCode: input.topicCode,
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
        }),
      );
      for (const r of results) {
        if (!r) continue;
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
    const durationMin = input.durationMin ?? Math.max(15, Math.round(totalMarks * 1.0));
    const paperName =
      input.paperName ?? `AI Quick Paper · ${input.syllabusCode}/${input.topicCode}`;
    const subjectId = approved[0].subjectId;
    const componentId = approved[0].componentId;

    // Re-pull Question rows so we can snapshot content / options / answers
    const questionRows = await this.prisma.question.findMany({
      where: { id: { in: approved.map((a) => a.questionId) } },
      include: { assets: true },
    });
    const byId = new Map(questionRows.map((q) => [q.id, q]));

    const paper = await this.prisma.paper.create({
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
          topicCode: input.topicCode,
          count,
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

    // usage logs + initial version (mirrors PapersService.generate)
    await this.prisma.questionUsageLog.createMany({
      data: approved.map((a) => ({
        questionId: a.questionId,
        paperId: paper.id,
        classLabel: input.classLabel ?? null,
      })),
    });
    await this.prisma.paperVersion.create({
      data: {
        paperId: paper.id,
        versionNumber: 1,
        snapshot: paper as any,
        changedById: actor.id,
        changeNote: 'quick-paper generated',
      },
    });
    const tP = Date.now() - tP0;

    const total = Date.now() - t0;

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ai.quick_paper.generate',
      entityType: 'paper',
      entityId: paper.id,
      metadata: {
        syllabusCode: input.syllabusCode,
        topicCode: input.topicCode,
        requested: count,
        approved: approved.length,
        diagramsRequested,
        diagramsGenerated,
        diagramErrors,
        questionsCostUsd: genResult.costUsd,
        diagramsCostUsd: Math.round(diagramsCostUsd * 10000) / 10000,
        elapsedMs: { total, questions: tQ, approval: tA, diagrams: tD, paper: tP },
      },
      ip: actor.ip ?? null,
    });

    this.logger.log(
      `quick-paper ok ${input.syllabusCode}/${input.topicCode} ` +
        `q=${approved.length} dia=${diagramsGenerated}/${diagramsRequested} ` +
        `$${(genResult.costUsd + diagramsCostUsd).toFixed(4)} ${total}ms`,
    );

    return {
      paperId: paper.id,
      paperName: paper.name,
      totalMarks,
      durationMin,
      questionCount: approved.length,
      diagramsRequested,
      diagramsGenerated,
      diagramErrors,
      cost: {
        questionsUsd: genResult.costUsd,
        diagramsUsd: Math.round(diagramsCostUsd * 10000) / 10000,
        totalUsd: Math.round((genResult.costUsd + diagramsCostUsd) * 10000) / 10000,
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
}
