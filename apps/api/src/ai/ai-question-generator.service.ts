import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ComplianceStatus,
  QuestionItemSource,
  QuestionStatus,
  QuestionType,
  ReviewStatus,
} from '@prisma/client';

export interface GenerateQuestionsInput {
  syllabusCode: string;       // e.g. "9702"
  topicCode: string;          // e.g. "PH.9"
  count: number;              // 1..10
  difficulty?: 1 | 2 | 3 | 4 | 5;
  questionType?: QuestionType;
  multiPart?: boolean;        // hint: prefer multi-part if true
}

export interface GeneratedQuestionItemSummary {
  questionItemId: string;
  questionNumber: string | null;
  marks: number;
  suggestedDifficulty: number;
  partCount: number;
}

export interface GenerateQuestionsResult {
  attempted: number;
  created: number;
  costUsd: number;
  monthToDateUsd: number;
  capUsd: number | null;
  remainingUsd: number | null;
  items: GeneratedQuestionItemSummary[];
  errors: string[];
}

interface ParsedQuestion {
  stem: string;
  parts?: { label: string; text: string; marks: number }[];
  totalMarks: number;
  suggestedDifficulty: number;
  questionType: QuestionType;
  notes?: string;
}

// Claude Sonnet 4.6 pricing (USD per 1M tokens)
const PRICE_INPUT_PER_M = 3;
const PRICE_OUTPUT_PER_M = 15;

@Injectable()
export class AiQuestionGeneratorService {
  private readonly logger = new Logger('AiQuestionGeneratorService');
  private readonly client: Anthropic | null;
  private readonly model: string;
  private readonly capUsd: number | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    this.capUsd = process.env.ANTHROPIC_MONTHLY_USD_CAP
      ? Number(process.env.ANTHROPIC_MONTHLY_USD_CAP)
      : null;
    if (!apiKey || apiKey.startsWith('sk-ant-replace')) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured — AI question generation disabled.',
      );
      this.client = null;
    } else {
      this.client = new Anthropic({ apiKey });
    }
  }

  /**
   * Sum AuditLog 'ai.question.generate' costs for the current calendar
   * month. Mirrors OpenAiImageService.monthToDateUsd so a teacher token
   * cannot quietly burn the Claude budget.
   */
  private async monthToDateUsd(): Promise<number> {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rows = await this.prisma.auditLog.findMany({
      where: { action: 'ai.question.generate', createdAt: { gte: start } },
      select: { metadata: true },
    });
    let sum = 0;
    for (const r of rows) {
      const cost = (r.metadata as any)?.costUsd;
      if (typeof cost === 'number' && Number.isFinite(cost)) sum += cost;
    }
    return Math.round(sum * 10000) / 10000;
  }

  async budgetStatus() {
    const mtd = await this.monthToDateUsd();
    return {
      monthToDateUsd: mtd,
      capUsd: this.capUsd,
      remainingUsd:
        this.capUsd !== null
          ? Math.max(0, Math.round((this.capUsd - mtd) * 100) / 100)
          : null,
    };
  }

  async generate(
    input: GenerateQuestionsInput,
    actor: { id: string; role: string; ip?: string | null },
  ): Promise<GenerateQuestionsResult> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY is not configured on this deployment.',
      );
    }
    const count = Math.max(1, Math.min(input.count ?? 1, 10));

    const subject = await this.prisma.subject.findFirst({
      where: { code: input.syllabusCode },
      include: { components: true },
    });
    if (!subject) {
      throw new BadRequestException(`subject '${input.syllabusCode}' not seeded`);
    }
    const topic = await this.prisma.topic.findFirst({
      where: {
        code: input.topicCode,
        component: { subjectId: subject.id },
      },
      include: { component: true },
    });
    if (!topic) {
      throw new BadRequestException(
        `topic '${input.topicCode}' not found under syllabus ${input.syllabusCode}`,
      );
    }

    // Pull few-shot examples: approved Questions in same topic, varied difficulty.
    const fewShotPool = await this.prisma.question.findMany({
      where: {
        primaryTopicId: topic.id,
        status: QuestionStatus.active,
        complianceStatus: ComplianceStatus.approved_internal,
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        questionType: true,
        marks: true,
        difficulty: true,
        sourceRef: true,
        content: true,
      },
    });

    // Pre-flight cap check (rough: assume max budget per question)
    const monthToDate = await this.monthToDateUsd();
    const roughEstPerQ = 0.025; // conservative upper bound for a 4-part Q
    if (this.capUsd !== null && monthToDate + roughEstPerQ * count > this.capUsd) {
      throw new ServiceUnavailableException(
        `Monthly Anthropic cap of $${this.capUsd} would be exceeded ` +
          `(month-to-date $${monthToDate.toFixed(2)} + estimated $${(roughEstPerQ * count).toFixed(
            2,
          )}).`,
      );
    }

    const prompt = this.buildPrompt({
      syllabus: input.syllabusCode,
      topicCode: topic.code,
      topicName: topic.name,
      componentCode: topic.component?.code ?? null,
      count,
      difficulty: input.difficulty,
      questionType: input.questionType,
      multiPart: input.multiPart ?? false,
      fewShot: fewShotPool,
    });

    const t0 = Date.now();
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system: prompt.systemBlocks as any,
      messages: [{ role: 'user', content: prompt.userText }],
    });
    const elapsedMs = Date.now() - t0;

    const text = resp.content
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('')
      .trim();
    const inputTokens = resp.usage.input_tokens ?? 0;
    const outputTokens = resp.usage.output_tokens ?? 0;
    const costUsd =
      (inputTokens * PRICE_INPUT_PER_M + outputTokens * PRICE_OUTPUT_PER_M) /
      1_000_000;

    const parsed = this.parseResponse(text);
    const errors: string[] = [];
    const created: GeneratedQuestionItemSummary[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const q = parsed[i];
      try {
        const item = await this.prisma.$transaction(async (tx) => {
          const created = await tx.questionItem.create({
            data: {
              source: QuestionItemSource.ai_generated,
              sourceFileId: null,
              rawExtractedText: q.stem,
              questionNumber: String(i + 1),
              suggestedSubjectCode: input.syllabusCode,
              suggestedTopicCode: input.topicCode,
              suggestedType: q.questionType,
              suggestedMarks: q.totalMarks,
              suggestedDifficulty: q.suggestedDifficulty,
              suggestedMetadata: { aiNotes: q.notes ?? null } as any,
              reviewStatus: ReviewStatus.pending_review,
              complianceStatus: ComplianceStatus.approved_internal,
              aiModel: this.model,
              aiPrompt: prompt.userText.slice(0, 8000),
              aiCostUsd: Math.round((costUsd / parsed.length) * 10000) / 10000,
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
        created.push({
          questionItemId: item.id,
          questionNumber: item.questionNumber,
          marks: q.totalMarks,
          suggestedDifficulty: q.suggestedDifficulty,
          partCount: q.parts?.length ?? 0,
        });
      } catch (e: any) {
        errors.push(`Q${i + 1}: ${String(e?.message ?? e).slice(0, 200)}`);
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ai.question.generate',
      entityType: 'question_item_batch',
      entityId: created[0]?.questionItemId ?? `empty-${Date.now()}`,
      metadata: {
        model: this.model,
        syllabus: input.syllabusCode,
        topicCode: input.topicCode,
        requested: count,
        parsed: parsed.length,
        created: created.length,
        inputTokens,
        outputTokens,
        costUsd: Math.round(costUsd * 10000) / 10000,
        elapsedMs,
        promptChars: prompt.userText.length,
        difficulty: input.difficulty ?? null,
        multiPart: input.multiPart ?? false,
      },
      ip: actor.ip ?? null,
    });

    this.logger.log(
      `ai-gen ok syllabus=${input.syllabusCode} topic=${input.topicCode} ` +
        `req=${count} parsed=${parsed.length} created=${created.length} ` +
        `cost=$${costUsd.toFixed(4)} elapsed=${elapsedMs}ms`,
    );

    return {
      attempted: count,
      created: created.length,
      costUsd: Math.round(costUsd * 10000) / 10000,
      monthToDateUsd: Math.round((monthToDate + costUsd) * 10000) / 10000,
      capUsd: this.capUsd,
      remainingUsd:
        this.capUsd !== null
          ? Math.max(0, Math.round((this.capUsd - monthToDate - costUsd) * 100) / 100)
          : null,
      items: created,
      errors,
    };
  }

  // ---------- prompt assembly ----------

  /**
   * Layer 1: role + style. Cached so a batch over the same syllabus
   * pays the input-token cost for these blocks once.
   */
  private readonly LAYER_ROLE = `You are a senior CIE A-Level examiner authoring original exam questions for an internal school question bank. Your output is reviewed by a teacher before reaching students, so quality and pedagogical correctness matter more than novelty.

Authoring principles:
- Each question must be self-contained: a student should be able to answer it from the stem alone (plus the standard CIE formula booklet).
- Use SI units throughout. Numerical values must be physically plausible (e.g. a "force on a falling apple" of 50 000 N is wrong).
- Avoid trick wording. The mark scheme should be unambiguous.
- The number of marks must match the cognitive load: 1 mark = a short recall or a single calculation step; 5 marks = a multi-step derivation; 6+ marks = an extended analysis with several distinct ideas.
- Time-per-mark calibration: roughly 1.25 minutes per mark for physics.
- For multi-part questions, parts (a)/(b)/(c) should build on each other or test related sub-skills, not be unrelated.
- LaTeX inside $...$ for inline math, $$...$$ for display math. Render numerical answers with appropriate significant figures. Use proper unit syntax: $\\text{m s}^{-1}$ not $m/s$.`;

  /** Layer 4: hard output schema. */
  private readonly LAYER_OUTPUT = `Output STRICT JSON, no commentary, no markdown fencing. The top level must be a JSON array of question objects. Schema:

[
  {
    "stem": "string (LaTeX in $...$)",
    "parts": [
      { "label": "a", "text": "string (LaTeX OK)", "marks": 3 }
    ],
    "totalMarks": 5,
    "suggestedDifficulty": 1 | 2 | 3 | 4 | 5,
    "questionType": "mcq" | "short_answer" | "structured" | "essay",
    "notes": "optional string for the reviewing teacher"
  }
]

Rules:
- "parts" is OPTIONAL. Omit it for single-part short_answer or mcq.
- "totalMarks" MUST equal the sum of part marks when parts are present.
- For "mcq" questions, place the four options inside the stem as "(A) ..., (B) ..., (C) ..., (D) ...". MCQ is always 1 mark, no parts.
- Difficulty: 1=trivial recall, 2=routine, 3=standard exam, 4=challenging, 5=extension/Olympiad-tier.
- Return EXACTLY the requested number of questions in the array.`;

  private buildPrompt(args: {
    syllabus: string;
    topicCode: string;
    topicName: string;
    componentCode: string | null;
    count: number;
    difficulty?: number;
    questionType?: QuestionType;
    multiPart: boolean;
    fewShot: Array<{
      questionType: QuestionType;
      marks: number;
      difficulty: number;
      sourceRef: string | null;
      content: any;
    }>;
  }) {
    // Layer 2: per-request topic + intent context (NOT cached).
    const intentLines: string[] = [
      `Syllabus: CIE ${args.syllabus}`,
      `Component: ${args.componentCode ?? '(any)'}`,
      `Topic: ${args.topicCode} ${args.topicName}`,
      `Number of questions to author: ${args.count}`,
    ];
    if (args.difficulty)
      intentLines.push(`Target difficulty: ${args.difficulty} (on the 1-5 scale defined above)`);
    if (args.questionType)
      intentLines.push(`Question type required: ${args.questionType}`);
    if (args.multiPart)
      intentLines.push(`Prefer multi-part questions with 2-4 parts (a)/(b)/(c)/(d).`);
    const intentBlock = intentLines.join('\n');

    // Layer 3: few-shot from approved questions in same topic.
    const fewShotItems = args.fewShot
      .filter((q) => q?.content)
      .slice(0, 4)
      .map((q, i) => {
        const stem =
          typeof q.content === 'object' && q.content && 'stem' in q.content
            ? String((q.content as any).stem ?? '').slice(0, 800)
            : '';
        return [
          `Example ${i + 1} (${q.questionType}, ${q.marks} marks, difficulty ${q.difficulty}${
            q.sourceRef ? `, ${q.sourceRef}` : ''
          }):`,
          stem,
        ].join('\n');
      })
      .join('\n\n');
    const fewShotBlock = fewShotItems
      ? `Reference questions from the school's approved bank for this topic — match their tone, depth, and notation:\n\n${fewShotItems}`
      : `(No prior approved questions for this topic — author from CIE syllabus conventions.)`;

    const userText = [intentBlock, fewShotBlock, this.LAYER_OUTPUT].join('\n\n');

    // System block: role text is cached so subsequent calls within the
    // 5-minute window pay only for the user message.
    const systemBlocks = [
      {
        type: 'text',
        text: this.LAYER_ROLE,
        cache_control: { type: 'ephemeral' },
      },
    ];
    return { systemBlocks, userText };
  }

  private parseResponse(text: string): ParsedQuestion[] {
    // Strip markdown code fences if Claude added them despite instructions.
    let cleaned = text.trim();
    const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m);
    if (fence) cleaned = fence[1].trim();
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!arrayMatch) {
      throw new ServiceUnavailableException(
        'Claude response did not contain a JSON array of questions.',
      );
    }
    let raw: any;
    try {
      raw = JSON.parse(arrayMatch[0]);
    } catch (e: any) {
      throw new ServiceUnavailableException(
        `Failed to parse Claude JSON: ${e.message}`,
      );
    }
    if (!Array.isArray(raw)) {
      throw new ServiceUnavailableException('Claude response was not a JSON array.');
    }
    return raw.map((q: any, i: number): ParsedQuestion => {
      const stem = String(q?.stem ?? '').trim();
      if (!stem) {
        throw new ServiceUnavailableException(`Question ${i + 1} has empty stem.`);
      }
      const parts = Array.isArray(q?.parts)
        ? q.parts
            .map((p: any) => ({
              label: String(p?.label ?? '').trim(),
              text: String(p?.text ?? '').trim(),
              marks: Number(p?.marks ?? 0),
            }))
            .filter((p: any) => p.label && p.text && p.marks > 0)
        : undefined;
      const totalMarks = Math.max(
        1,
        Math.min(50, Number(q?.totalMarks ?? parts?.reduce((s: number, p: any) => s + p.marks, 0) ?? 1)),
      );
      const suggestedDifficulty = Math.min(
        5,
        Math.max(1, Number(q?.suggestedDifficulty ?? 3)),
      );
      const qt = String(q?.questionType ?? 'short_answer') as QuestionType;
      const allowedTypes: QuestionType[] = [
        'mcq',
        'short_answer',
        'structured',
        'essay',
      ] as any;
      const questionType: QuestionType = allowedTypes.includes(qt) ? qt : ('short_answer' as any);
      return {
        stem,
        parts: parts && parts.length > 0 ? parts : undefined,
        totalMarks,
        suggestedDifficulty,
        questionType,
        notes: q?.notes ? String(q.notes).slice(0, 500) : undefined,
      };
    });
  }
}
