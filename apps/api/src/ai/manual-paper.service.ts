import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReviewService } from '../review/review.service';
import { QuickPaperAuditService } from './quick-paper-audit.service';
import { SvgDiagramService } from './svg-diagram.service';
import {
  ComplianceStatus,
  PaperStatus,
  QuestionItemSource,
  QuestionType,
  ReviewStatus,
} from '@prisma/client';

/**
 * R18: bypass-Anthropic paper import.
 *
 * When the Anthropic account is dry (credit balance zero) the chat-paper
 * pipeline obviously can't run. This service lets a caller — initially
 * Claude inside the dev conversation, eventually a CLI / admin UI —
 * hand the system pre-authored questions and get the same paper assembly
 * for free.
 *
 * The questions still go through QuickPaperAuditService (so a bad table
 * or untagged answer-overlay is still rejected) and through
 * ReviewService.approve (so the audit log, primary-topic backfill, and
 * paper-pool gates all behave identically to the AI path). SVG diagrams
 * are rendered locally for free. We refuse OpenAI image diagrams to keep
 * this path truly Anthropic-free; the caller must either supply a
 * structured spec or set `diagram: { needed: false }`.
 */

export interface ManualImportQuestion {
  topicCode: string;
  stem: string;
  parts?: Array<{ label: string; text: string; marks: number; answer?: string }>;
  totalMarks: number;
  suggestedDifficulty: 1 | 2 | 3 | 4 | 5;
  questionType: QuestionType;
  /** Optional reference answer for the answer key. For multi-part
   *  questions, prefer setting answer on each part instead. */
  answer?: { text?: string };
  diagram?: {
    needed: boolean;
    type?: string;
    /** Only structured specs are honoured; image-only types are refused
     *  (avoids OpenAI cost on this bypass path). */
    spec?: any;
  };
  /** Free-text reviewer note attached to the QuestionItem. */
  notes?: string;
}

export interface ManualImportInput {
  syllabusCode: string;
  paperName?: string;
  classLabel?: string | null;
  durationMin?: number;
  questions: ManualImportQuestion[];
}

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

interface ApprovedItem {
  questionId: string;
  componentId: string | null;
  subjectId: string;
  marks: number;
  topicCode: string;
  diagram?: ManualImportQuestion['diagram'];
}

@Injectable()
export class ManualPaperService {
  private readonly logger = new Logger('ManualPaper');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly review: ReviewService,
    private readonly qpAudit: QuickPaperAuditService,
    private readonly svgDiagram: SvgDiagramService,
  ) {}

  async importPaper(input: ManualImportInput, actor: ActorCtx) {
    const t0 = Date.now();
    if (!input.questions || input.questions.length === 0) {
      throw new BadRequestException('questions[] cannot be empty.');
    }
    if (input.questions.length > 30) {
      throw new BadRequestException('At most 30 questions per imported paper.');
    }

    // Resolve subject + topic taxonomy up front so we can fail fast on a
    // typo'd syllabus or topic code (saves us writing half a paper before
    // discovering the topic doesn't exist).
    const subject = await this.prisma.subject.findFirst({
      where: { code: input.syllabusCode },
      include: { components: { include: { topics: true } } },
    });
    if (!subject) {
      throw new BadRequestException(`subject '${input.syllabusCode}' not seeded`);
    }
    const topicByCode = new Map<string, { id: string; componentId: string }>();
    for (const c of subject.components) {
      for (const t of c.topics) {
        if (!topicByCode.has(t.code)) {
          topicByCode.set(t.code, { id: t.id, componentId: c.id });
        }
      }
    }
    for (const q of input.questions) {
      if (!topicByCode.has(q.topicCode)) {
        throw new BadRequestException(
          `topic '${q.topicCode}' not found under syllabus ${input.syllabusCode}`,
        );
      }
    }

    // ---- Step 1: 10-step audit ----
    const auditReports = input.questions.map((q, i) =>
      this.qpAudit.audit({
        ref: `Q${i + 1}`,
        stem: q.stem,
        parts: q.parts,
        totalMarks: q.totalMarks,
        questionType: q.questionType,
        diagram: q.diagram?.needed
          ? { needed: true, type: q.diagram.type, spec: q.diagram.spec }
          : undefined,
      }),
    );
    const droppedByAudit = new Set<number>();
    const auditErrors: string[] = [];
    const auditWarnings: string[] = [];
    auditReports.forEach((rep, i) => {
      for (const finding of rep.findings) {
        const line = `Q${i + 1} ${finding.checkId}: ${finding.message}`;
        if (finding.severity === 'error') {
          droppedByAudit.add(i);
          auditErrors.push(line);
        } else {
          auditWarnings.push(line);
        }
      }
    });

    // ---- Step 2: insert QuestionItem + parts; approve each into the bank ----
    const approved: ApprovedItem[] = [];
    const approveErrors: string[] = [];
    for (let i = 0; i < input.questions.length; i++) {
      if (droppedByAudit.has(i)) continue;
      const q = input.questions[i];
      try {
        const item = await this.prisma.$transaction(async (tx) => {
          const created = await tx.questionItem.create({
            data: {
              source: QuestionItemSource.ai_generated,
              sourceFileId: null,
              rawExtractedText: q.stem,
              questionNumber: String(i + 1),
              suggestedSubjectCode: input.syllabusCode,
              suggestedTopicCode: q.topicCode,
              suggestedType: q.questionType,
              suggestedMarks: q.totalMarks,
              suggestedDifficulty: q.suggestedDifficulty,
              suggestedMetadata: {
                manualImport: true,
                manualImportNotes: q.notes ?? null,
                diagram: q.diagram ?? null,
                answer: q.answer ?? null,
              } as any,
              reviewStatus: ReviewStatus.pending_review,
              complianceStatus: ComplianceStatus.approved_internal,
              aiModel: 'manual_chat_import_v1',
              aiPrompt: '',
              aiCostUsd: 0,
              aiCreatedById: actor.id,
            },
          });
          if (q.parts && q.parts.length > 0) {
            for (let j = 0; j < q.parts.length; j++) {
              const p = q.parts[j];
              await tx.questionPart.create({
                data: {
                  questionItemId: created.id,
                  partLabel: p.label,
                  marks: p.marks,
                  text: p.text,
                  sortOrder: j,
                },
              });
            }
          }
          return created;
        });
        const result = await this.review.approve(item.id, actor, {
          provenanceTag: 'ai_manual_import',
        });
        approved.push({
          questionId: result.question.id,
          componentId: result.question.componentId,
          subjectId: result.question.subjectId,
          marks: result.question.marks,
          topicCode: q.topicCode,
          diagram: q.diagram,
        });
      } catch (e: any) {
        approveErrors.push(`Q${i + 1}: ${String(e?.message ?? e).slice(0, 200)}`);
      }
    }

    if (approved.length === 0) {
      throw new ServiceUnavailableException(
        `No questions imported. Audit errors: ${auditErrors.slice(0, 5).join(' | ')}; ` +
          `approve errors: ${approveErrors.slice(0, 5).join(' | ')}`,
      );
    }
    const componentIds = Array.from(
      new Set(approved.map((a) => a.componentId).filter((x): x is string => !!x)),
    );
    if (componentIds.length > 1) {
      throw new BadRequestException(
        'Imported questions span multiple components within the syllabus. Keep one paper inside one component.',
      );
    }

    // ---- Step 3: render diagrams (SVG only — image diagrams refused) ----
    let diagramsRequested = 0;
    let diagramsGenerated = 0;
    const diagramErrors: string[] = [];
    for (const a of approved) {
      const d = a.diagram;
      if (!d?.needed) continue;
      diagramsRequested++;
      if (!d.spec || typeof d.spec !== 'object' || !d.spec.kind) {
        diagramErrors.push(
          `Q topic=${a.topicCode}: diagram requires a structured spec on the bypass-Anthropic path (image-only types refused).`,
        );
        continue;
      }
      try {
        await this.svgDiagram.generate(
          {
            questionId: a.questionId,
            spec: d.spec,
            syllabus: input.syllabusCode,
            topicCode: a.topicCode,
          },
          actor,
        );
        diagramsGenerated++;
      } catch (e: any) {
        diagramErrors.push(
          `Q topic=${a.topicCode}: svg failed: ${String(e?.message ?? e).slice(0, 200)}`,
        );
      }
    }

    // ---- Step 4: assemble Paper (clone of QuickPaperService's Step 4) ----
    const totalMarks = approved.reduce((s, a) => s + a.marks, 0);
    const durationMin =
      input.durationMin ?? Math.max(15, Math.round(totalMarks * 1.0));
    const subjectId = approved[0].subjectId;
    const componentId = componentIds[0] ?? null;

    const topicSet = Array.from(new Set(approved.map((a) => a.topicCode)));
    const paperName =
      input.paperName ??
      (topicSet.length === 1
        ? `Manual Paper · ${input.syllabusCode} ${topicSet[0]}`
        : `Manual Paper · ${input.syllabusCode} (${topicSet.length} sections)`);

    const questionRows = await this.prisma.question.findMany({
      where: { id: { in: approved.map((a) => a.questionId) } },
      include: { assets: true },
    });
    const byId = new Map(questionRows.map((q) => [q.id, q]));

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
            manualImport: true,
            syllabusCode: input.syllabusCode,
            topics: topicSet.map((code) => ({
              code,
              count: approved.filter((a) => a.topicCode === code).length,
            })),
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
          changeNote: 'manual chat-import',
        },
      });
      return created;
    });

    const elapsedMs = Date.now() - t0;
    const partial =
      droppedByAudit.size > 0 || approveErrors.length > 0 || diagramErrors.length > 0;

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ai.manual_paper.import',
      entityType: 'paper',
      entityId: paper.id,
      metadata: {
        syllabusCode: input.syllabusCode,
        topics: topicSet,
        requested: input.questions.length,
        imported: approved.length,
        droppedByAudit: droppedByAudit.size,
        auditErrors: auditErrors.slice(0, 50),
        auditWarnings: auditWarnings.slice(0, 50),
        approveErrors,
        diagramsRequested,
        diagramsGenerated,
        diagramErrors,
        elapsedMs,
      },
      ip: actor.ip ?? null,
    });

    this.logger.log(
      `manual-paper ${partial ? 'partial' : 'ok'} ${input.syllabusCode} ` +
        `q=${approved.length}/${input.questions.length} ` +
        `dia=${diagramsGenerated}/${diagramsRequested} ${elapsedMs}ms`,
    );

    return {
      paperId: paper.id,
      paperName: paper.name,
      totalMarks,
      durationMin,
      questionCount: approved.length,
      topicCount: topicSet.length,
      diagramsRequested,
      diagramsGenerated,
      diagramErrors,
      partial,
      warnings: [
        ...auditErrors.map((e) => `audit: ${e}`),
        ...auditWarnings.map((w) => `warn: ${w}`),
        ...approveErrors.map((e) => `approve: ${e}`),
      ],
      cost: { totalUsd: 0, anthropicUsd: 0, openaiUsd: 0 },
      elapsedMs,
    };
  }
}
