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
  diagram?: DiagramHint;
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

/** Structured math-diagram spec for type=geometry/graph. AI emits exact
 *  geometry; SVG renderer draws it precisely (image models can't compute
 *  slopes / midpoints / intersections). */
export interface CoordinateMathSpec {
  kind: 'coordinate_plane';
  xRange: [number, number];
  yRange: [number, number];
  gridStep?: number;
  points?: Array<{ x: number; y: number; label?: string; labelPos?: string }>;
  segments?: Array<{ from: [number, number]; to: [number, number]; label?: string; style?: 'solid' | 'dashed' }>;
  lines?: Array<{
    point?: [number, number];
    slope?: number;
    verticalX?: number;
    label?: string;
    style?: 'solid' | 'dashed';
  }>;
  parabolas?: Array<{ a: number; b: number; c: number; label?: string; style?: 'solid' | 'dashed' }>;
}

/** Graphviz DOT-syntax spec for type=flowchart/data_structure/network_topology/
 *  logic_gate. AI emits a complete DOT digraph; the SVG service runs it
 *  through @hpcc-js/wasm-graphviz to lay out and render. Free + deterministic. */
export interface GraphvizMathSpec {
  kind: 'graphviz_dot';
  dot: string;
  engine?: 'dot' | 'neato' | 'circo' | 'fdp' | 'sfdp' | 'twopi';
}

/** Free-body diagram spec for type=free_body. */
export interface FreeBodyMathSpec {
  kind: 'free_body';
  body: { shape: 'block' | 'sphere' | 'dot'; label?: string };
  forces: Array<{
    magnitude: number;
    angle: number;             // degrees, 0 = +x axis (right), 90 = +y (up)
    label: string;
    style?: 'solid' | 'dashed';
  }>;
}

/** Energy-level diagram spec for type=energy_level. */
export interface EnergyLevelMathSpec {
  kind: 'energy_level';
  levels: Array<{ energy: number; label: string }>;
  transitions?: Array<{
    fromIndex: number;
    toIndex: number;
    label?: string;
    kind?: 'absorption' | 'emission';
  }>;
}

/** Circuit spec rendered via schemdraw on the Python pdf-worker. */
export interface CircuitSchemdrawMathSpec {
  kind: 'circuit_schemdraw';
  elements: Array<{
    type: string;
    label?: string;
    direction?: 'right' | 'left' | 'up' | 'down';
    length?: number;
    flip?: boolean;
    reverse?: boolean;
  }>;
}

/** Statistical chart specs for type=statistical. AI picks one of three
 *  chart kinds based on what the question asks for. */
export interface StatHistogramMathSpec {
  kind: 'stat_histogram';
  bins: Array<{ lo: number; hi: number; freq: number }>;
  xLabel?: string;
  yLabel?: string;
  frequencyDensity?: boolean;
}
export interface StatBoxPlotMathSpec {
  kind: 'stat_box_plot';
  series: Array<{
    label: string;
    min: number; q1: number; median: number; q3: number; max: number;
    outliers?: number[];
  }>;
  xLabel?: string;
  range?: [number, number];
}
export interface StatCumFreqMathSpec {
  kind: 'stat_cum_freq';
  points: Array<{ x: number; cumFreq: number }>;
  xLabel?: string;
  yLabel?: string;
  markers?: Array<{ y: number; label?: string }>;
}

/** Chemistry structure spec rendered via RDKit on the Python pdf-worker.
 *  AI emits a SMILES string; we send it across, get SVG back. */
export interface MoleculeRdkitMathSpec {
  kind: 'molecule_smiles';
  smiles: string;
  kekulize?: boolean;
  width?: number;
  height?: number;
}

/** Ray-diagram spec for type=ray. AI computes ray paths itself; the SVG
 *  renderer just draws the polylines. */
export interface RayMathSpec {
  kind: 'ray_diagram';
  xRange: [number, number];
  yRange: [number, number];
  axisY?: number;
  element: {
    type: 'plane_mirror' | 'concave_mirror' | 'convex_mirror'
        | 'thin_lens_convex' | 'thin_lens_concave';
    x: number;
    height?: number;
    focalLength?: number;
  };
  object?: { x: number; height: number; label?: string };
  image?: { x: number; height: number; virtual?: boolean; label?: string };
  rays?: Array<{
    points: Array<[number, number]>;
    style?: 'solid' | 'dashed';
    arrow?: 'mid' | 'end' | 'none';
    label?: string;
  }>;
  showFocalPoints?: boolean;
}

export type DiagramSpec = CoordinateMathSpec | GraphvizMathSpec
                        | FreeBodyMathSpec | EnergyLevelMathSpec
                        | CircuitSchemdrawMathSpec | RayMathSpec
                        | MoleculeRdkitMathSpec
                        | StatHistogramMathSpec | StatBoxPlotMathSpec | StatCumFreqMathSpec;

export type DiagramHint = {
  needed: true;
  type:
    | 'apparatus' | 'circuit' | 'waveform' | 'graph' | 'free_body' | 'molecular'
    | 'ray' | 'mechanics' | 'geometry' | 'statistical' | 'energy_level' | 'organic_skeletal'
    | 'logic_gate' | 'flowchart' | 'data_structure' | 'network_topology';
  scene: string;
  labels: string[];
  /** Optional structured spec. When present, the diagram is rendered via
   *  the deterministic SVG service (free, geometrically exact for math;
   *  professional layout for graph-style CS diagrams via Graphviz). When
   *  absent, falls back to gpt-image-2 driven by scene/labels.
   *
   *  Used for these types:
   *    geometry / graph       → kind=coordinate_plane
   *    flowchart              → kind=graphviz_dot (AI emits dot syntax)
   *    data_structure         → kind=graphviz_dot
   *    network_topology       → kind=graphviz_dot
   *    logic_gate             → kind=graphviz_dot
   *  Other types continue to use gpt-image-2. */
  spec?: DiagramSpec;
} | { needed: false };

/**
 * UI renderer hint emitted by the AI for English/IELTS papers (1123 / IELTS).
 * Picked up by the frontend QuestionTypeRegistry to choose between
 * OLevelCloze / OLevelVocabInContext / OLevelSentenceTransformation /
 * IELTSReadingPassage / generic OLevelMcqList.
 *
 * For non-English subjects (Physics 9702, Chem 9701, Math 9709, CS 9608)
 * uiKind is undefined — those papers render via the existing question-type
 * dispatch and don't need a renderer hint.
 */
export type UiKind =
  | 'multiple_choice'
  | 'cloze'
  | 'vocab_in_context'
  | 'sentence_transformation'
  | 'reading_passage';

export interface ParsedQuestion {
  stem: string;
  parts?: { label: string; text: string; marks: number }[];
  totalMarks: number;
  suggestedDifficulty: number;
  questionType: QuestionType;
  /** Frontend renderer hint — REQUIRED for IELTS / 1123 papers. */
  uiKind?: UiKind;
  /** Cloze passage with [BLANK] markers (one per question in the paper).
   *  Only present when uiKind === 'cloze'. The N-th [BLANK] corresponds
   *  to the N-th question's expected answer. */
  passage?: string;
  notes?: string;
  diagram?: DiagramHint;
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

  // Tracks USD reserved by in-flight generate() calls in this process. Same
  // pattern as OpenAiImageService.pendingUsd: prevents two concurrent
  // requests from both passing the cap gate before either's AuditLog
  // row is written. Single-process atomicity only — multi-instance
  // deployments would need a DB-backed reservation table.
  private pendingUsd = 0;

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
    // Some subjects (e.g. IELTS) seed the same topic codes under multiple
    // components — IELTS has IR.1-IR.7 under both AUTH and HARD.
    // findFirst without ordering returns rows non-deterministically, so
    // generation runs land questions in different components for the same
    // logical topic, which then trips QuickPaper's "topics span components"
    // rejection. Order by component.code ascending so the first lexical
    // component (AUTH < HARD) is always picked, keeping a single batch's
    // questions inside one component.
    const topic = await this.prisma.topic.findFirst({
      where: {
        code: input.topicCode,
        component: { subjectId: subject.id },
      },
      include: { component: true },
      orderBy: { component: { code: 'asc' } },
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

    // Pre-flight cap check + reservation. The check + pendingUsd
    // increment runs synchronously after the awaited monthToDateUsd, so
    // two concurrent requests can't both pass the gate before either's
    // AuditLog row is written.
    const monthToDate = await this.monthToDateUsd();
    const roughEstPerQ = 0.025; // conservative upper bound for a 4-part Q
    const estimatedSpend = roughEstPerQ * count;
    if (
      this.capUsd !== null &&
      monthToDate + this.pendingUsd + estimatedSpend > this.capUsd
    ) {
      throw new ServiceUnavailableException(
        `Monthly Anthropic cap of $${this.capUsd} would be exceeded ` +
          `(month-to-date $${monthToDate.toFixed(2)} + ` +
          `in-flight $${this.pendingUsd.toFixed(2)} + ` +
          `estimated $${estimatedSpend.toFixed(2)}).`,
      );
    }
    this.pendingUsd += estimatedSpend;

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

    let elapsedMs = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let text = '';
    try {
      const t0 = Date.now();
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        system: prompt.systemBlocks as any,
        messages: [{ role: 'user', content: prompt.userText }],
      });
      elapsedMs = Date.now() - t0;
      text = resp.content
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('')
        .trim();
      inputTokens = resp.usage.input_tokens ?? 0;
      outputTokens = resp.usage.output_tokens ?? 0;
      costUsd =
        (inputTokens * PRICE_INPUT_PER_M + outputTokens * PRICE_OUTPUT_PER_M) /
        1_000_000;
    } finally {
      // Release the reservation. On success the AuditLog write below
      // captures the actual spend; on failure no AuditLog is written.
      this.pendingUsd = Math.max(0, this.pendingUsd - estimatedSpend);
    }

    const parsed = this.parseResponse(text);
    // B5/B6 contract gate — English/IELTS/1123 must carry uiKind on
    // every question and the cloze [BLANK] count must match question
    // count. Failure throws ServiceUnavailable; the QuickPaper caller
    // surfaces it as a partial run for that topic.
    this.validateEnglishContract(input.syllabusCode, parsed);
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
              suggestedMetadata: {
                aiNotes: q.notes ?? null,
                diagram: q.diagram ?? null,
              } as any,
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
          diagram: q.diagram,
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
   * Layer 1a: shared examiner role (cached across all subjects).
   */
  private readonly LAYER_ROLE_COMMON = `You are a senior CIE A-Level examiner authoring original exam questions for an internal school question bank. Your output is reviewed by a teacher before reaching students, so quality and pedagogical correctness matter more than novelty.

Authoring principles:
- Each question must be self-contained: a student should be able to answer it from the stem alone (plus the standard CIE formula booklet).
- Avoid trick wording. The mark scheme should be unambiguous and have a single defensible answer.
- The number of marks must match the cognitive load: 1 mark = a short recall or a single calculation step; 5 marks = a multi-step derivation; 6+ marks = an extended analysis with several distinct ideas.
- For multi-part questions, parts (a)/(b)/(c) should build on each other or test related sub-skills, not be unrelated.
- LaTeX inside $...$ for inline math, $$...$$ for display math. Numerical answers should use appropriate significant figures.`;

  /**
   * Layer 1b: per-subject conventions. Picked by syllabus code.
   */
  private subjectModule(syllabusCode: string): string {
    if (syllabusCode === '9608') {
      return `Subject: CIE 9608 Computer Science.
- Pseudocode follows the CIE pseudocode reference: \`IF ... THEN ... ENDIF\`, \`WHILE ... ENDWHILE\`, \`FOR i ← 1 TO n ... NEXT i\`, \`PROCEDURE name(...) ... ENDPROCEDURE\`, \`OUTPUT ...\`, \`INPUT ...\`. Use the assignment arrow \`←\` (or \`<-\` if Unicode is a problem). Indent inner blocks by two spaces.
- Wrap any pseudocode, code, SQL, or trace tables in fenced code blocks: triple backticks on their own line before and after. Place this inside the \`text\` field of the relevant part. Avoid LaTeX inside code fences.
- Logic / Boolean expressions: \`AND\`, \`OR\`, \`NOT\`, \`XOR\` in capitals; truth tables rendered as fenced markdown tables.
- For complexity: use Big-O notation \`O(n log n)\` in code spans, not LaTeX.
- Time-per-mark calibration: roughly 1.0 minute per mark.
- Diagram suggestions are HIGH VALUE for: logic gate networks, flowcharts, linked lists, trees, network topology drawings. Diagrams are LOW value for: tracing tables, SQL queries, ethics essays.`;
    }
    if (syllabusCode === '9702') {
      return `Subject: CIE 9702 Physics.
- Use SI units throughout. Numerical values must be physically plausible (e.g. a "force on a falling apple" of 50 000 N is wrong).
- Time-per-mark calibration: roughly 1.25 minutes per mark.
- Use proper unit syntax: \`$\\text{m s}^{-1}$\` not \`$m/s$\`. Constants like \`g = 9.81 m s⁻²\` should be stated explicitly when needed.
- Diagram suggestions are HIGH VALUE for: apparatus setups, circuits, free-body force diagrams, ray diagrams, waveforms. LOW value for: pure-formula derivations, definition recall, multiple choice on conceptual facts.`;
    }
    if (syllabusCode === '9709') {
      return `Subject: CIE 9709 Mathematics.
- Use exact values where appropriate (\`$\\sqrt{2}$\`, \`$\\frac{\\pi}{3}$\`); decimal approximations only when explicitly required.
- Time-per-mark calibration: roughly 1.0 minute per mark.
- Diagram suggestions are HIGH VALUE for: geometric figures, coordinate-axes plots, statistical charts. LOW value for: algebraic manipulation, calculus computations, pure-trig identities.`;
    }
    if (syllabusCode === '9701') {
      return `Subject: CIE 9701 Chemistry.
- Use balanced equations with state symbols (s) (l) (g) (aq). Always include conditions (heat / catalyst / solvent) where relevant.
- Use SI units; numerical answers to 3 sig fig unless stated. mol dm⁻³ for concentration, kJ mol⁻¹ for energy.
- Time-per-mark calibration: roughly 1.25 minute per mark.
- Diagram suggestions are HIGH VALUE for: molecular structures (emit SMILES via type "molecular"), organic skeletal structures (type "organic_skeletal"), Hess / Born-Haber cycles (type "energy_level"), apparatus setups for titration / distillation / reflux (type "apparatus"), reaction-rate / equilibrium graphs (type "graph"). LOW value for: pure stoichiometry calculations, definition recall, simple oxidation-number questions.
- For mechanism questions emit a structured stem with curly-arrow descriptions in text; the diagram architecture does not yet auto-render mechanism arrows.`;
    }
    return `Subject: CIE ${syllabusCode}. Follow standard CIE conventions for this subject.`;
  }

  /** Layer 4: hard output schema, including optional diagram metadata. */
  private readonly LAYER_OUTPUT = `Output STRICT JSON, no commentary, no markdown fencing around the JSON itself. The top level must be a JSON array of question objects. Schema:

[
  {
    "stem": "string (LaTeX in $...$, code in fenced blocks)",
    "parts": [
      { "label": "a", "text": "string", "marks": 3 }
    ],
    "totalMarks": 5,
    "suggestedDifficulty": 1 | 2 | 3 | 4 | 5,
    "questionType": "mcq" | "short_answer" | "structured" | "essay",
    "uiKind": "multiple_choice" | "cloze" | "vocab_in_context" | "sentence_transformation" | "reading_passage",
    "passage": "(REQUIRED when uiKind='cloze') article body with [BLANK] markers — see contract below",
    "notes": "optional string for the reviewing teacher",
    "diagram": {
      "needed": true,
      "type": "apparatus" | "circuit" | "waveform" | "graph" | "free_body" | "molecular" | "ray" | "mechanics" | "geometry" | "statistical" | "energy_level" | "organic_skeletal" | "logic_gate" | "flowchart" | "data_structure" | "network_topology",
      "scene": "concrete description of what the diagram shows, 30-150 words, drawn from the wording of the question",
      "labels": ["label 1 (exact text to place on the diagram)", "label 2", "..."],
      "spec": { /* optional structured spec — REQUIRED when type is geometry or graph */ }
    }
  }
]

Rules:
- "parts" is OPTIONAL. Omit it for single-part short_answer or mcq.
- "totalMarks" MUST equal the sum of part marks when parts are present.
- For "mcq" questions, place the four options inside the stem as "(A) ..., (B) ..., (C) ..., (D) ...". MCQ is always 1 mark, no parts.
- Difficulty: 1=trivial recall, 2=routine, 3=standard exam, 4=challenging, 5=extension/Olympiad-tier.
- Return EXACTLY the requested number of questions in the array.

UI renderer hint (REQUIRED for English / IELTS / 1123 papers):
- "uiKind" MUST be one of: "multiple_choice", "cloze", "vocab_in_context",
  "sentence_transformation", "reading_passage". Pick the one that matches
  what the question is testing. For non-English subjects (Physics 9702,
  Chem 9701, Math 9709, CS 9608) you may omit uiKind.
- "multiple_choice" → standalone MCQ (grammar, vocab MCQ, etc.).
- "vocab_in_context" → one sentence + 4 options for the meaning of one word.
- "sentence_transformation" → "Rewrite this sentence starting with…".
- "reading_passage" → matching / TFNG / passage-MCQ for an IELTS-style block.
- "cloze" → fill-in-blank passage; see cloze contract below.

Cloze paper contract (HARD — violations will be rejected):
When you choose uiKind="cloze" the entire batch must be a coherent cloze
exercise on one passage:
- EVERY question in the batch MUST have uiKind="cloze". Mixing cloze with
  other uiKind values in the same batch is REJECTED.
- The FIRST question's "passage" field MUST contain the full article body
  with literal [BLANK] markers — exactly one [BLANK] per question, in
  natural reading order. The N-th [BLANK] in the passage is the gap whose
  answer corresponds to the N-th question (1-indexed).
- The number of [BLANK] markers MUST equal the number of questions you
  generate. Mismatch is REJECTED.
- Each [BLANK] must be inserted at a grammatically defensible gap (where
  the missing word's part-of-speech is unambiguous from immediate context).
- DO NOT nest [BLANK] markers (no [[BLANK]something[BLANK]] etc.).
- Subsequent questions may carry only the question stem (e.g. "(3) the
  ___ which") without the passage; only Q1 needs the full passage body.
- Each question's "stem" should reference the [BLANK] number in the
  passage (e.g. "Blank 3:") so the marker-review UI can place the input.

Diagram rules (HARD):
- Output \`"diagram": {"needed": false}\` for purely textual / formula-only questions. DO NOT invent a diagram just because the question is structured.
- Across the whole batch, NO MORE THAN 50% of questions should have \`needed: true\`. Pick the ones where a figure genuinely aids comprehension.
- The "scene" must reference exact named entities and quantities from the question stem (e.g. "a metal sphere of radius 3.2 cm", not "a sphere"). Avoid colour, shading, 3D perspective.
- "labels" are placed verbatim on the diagram. Include units. Keep each label under 40 characters.

Geometry / coordinate-graph diagrams (REQUIRED structured spec):
For type "geometry" or "graph", in addition to scene/labels you MUST emit a "spec"
object so the renderer can produce a geometrically EXACT figure. Image-generation
models cannot compute slopes / midpoints / intersections correctly, so we render
SVG from your spec instead. Schema for spec:

{
  "kind": "coordinate_plane",
  "xRange": [xMin, xMax],          // numbers, xMin < xMax, leave 1-2 units padding
  "yRange": [yMin, yMax],          // same
  "gridStep": 1,                    // optional grid unit, default 1
  "points": [
    { "x": 2, "y": 7, "label": "A(2, 7)", "labelPos": "top-right" }
  ],
  "segments": [
    { "from": [2, 7], "to": [6, -1], "label": "AB", "style": "solid" }
  ],
  "lines": [
    /* infinite lines: either point+slope OR verticalX */
    { "point": [4, 3], "slope": 0.5, "label": "l", "style": "solid" },
    { "verticalX": 4, "label": "x = 4", "style": "dashed" }
  ],
  "parabolas": [
    /* y = a x^2 + b x + c */
    { "a": 1, "b": 0, "c": -3, "label": "y = x² − 3" }
  ]
}

CRITICAL when emitting spec:
- COMPUTE the geometry yourself. If the question says "perpendicular bisector
  of A(2,7) and B(6,-1)", the slope is +1/2 (negative reciprocal of −2), passing
  through midpoint (4,3). Emit \`{"point":[4,3],"slope":0.5}\`. NEVER emit a
  vertical line unless the perpendicular bisector is genuinely vertical
  (horizontal AB).
- Pick xRange/yRange to comfortably contain every point and line label with
  a 1-2 unit margin on each side.
- Use "labelPos" to keep point labels from colliding with line labels.
- "scene" can stay short and natural-language; the rendered figure comes from
  the spec.

CS-style graph diagrams (REQUIRED structured spec via Graphviz):
For type "flowchart", "data_structure", "network_topology", or "logic_gate"
you MUST emit a "spec" object containing a Graphviz DOT-syntax description.
The SVG service runs it through Graphviz to lay out and render. Schema:

{
  "kind": "graphviz_dot",
  "dot": "digraph G { rankdir=TB; node [shape=box, style=rounded]; \\n A -> B; B -> C; }",
  "engine": "dot"   /* dot | neato | circo | fdp | sfdp — usually "dot" */
}

Per-type DOT conventions:
- flowchart: rankdir=TB, node [shape=box, style=rounded] for steps,
  shape=diamond for decisions, shape=oval for start/end. Edges labeled with
  conditions ("Yes" / "No" / "i++").
- data_structure (trees / linked lists): rankdir=TB for trees (root at top),
  rankdir=LR for linked lists. node [shape=record] for cells with multiple
  fields. Use record syntax: "<f0>data | <f1>next" and edges between specific
  fields like A:f1 -> B:f0.
- network_topology: rankdir=LR. node [shape=box] for routers/switches,
  shape=circle for hosts. edge [arrowhead=none] for non-directional links.
- logic_gate: rankdir=LR, node [shape=box]. Label boxes "AND", "OR", "NOT",
  "NAND", "NOR", "XOR", "XNOR" plus an output expression. Inputs as plain
  rectangles labelled A/B/C; final output as a labelled rectangle.

CRITICAL when emitting graphviz_dot:
- DOT must be a complete graph: \`digraph G { ... }\` or \`graph G { ... }\`.
- Quote node IDs and labels with double quotes when they contain spaces
  ("step 1" not step 1).
- Keep the diagram readable: <= 20 nodes, <= 30 edges. Larger is allowed but
  the layout gets cramped.
- Do NOT include HTML-like labels (\`<<TABLE...>>\`); use plain string labels
  or record syntax.

Free-body diagrams (REQUIRED structured spec for type "free_body"):

{
  "kind": "free_body",
  "body": { "shape": "block" | "sphere" | "dot", "label": "optional label inside body" },
  "forces": [
    { "magnitude": 50, "angle": 90, "label": "W = 50 N", "style": "solid" }
  ]
}

CRITICAL:
- "angle" is measured in degrees from the +x axis, counter-clockwise positive.
  Right = 0, Up = 90, Left = 180, Down = 270 (or −90). Tension up-and-right
  at 30° above horizontal = 30. Weight always down = 270 (or −90). Normal
  force on flat ground = 90.
- "magnitude" is RELATIVE: arrows render with length proportional to
  magnitude (longest = ~90px). Use the actual numbers from the question;
  the renderer scales automatically.
- Labels appear at the arrow tips; include units ("T = 25 N", "W = mg").

Energy-level diagrams (REQUIRED structured spec for type "energy_level"):

{
  "kind": "energy_level",
  "levels": [
    { "energy": 0,    "label": "n=1 (ground state)" },
    { "energy": 10.2, "label": "n=2" },
    { "energy": 12.1, "label": "n=3" }
  ],
  "transitions": [
    { "fromIndex": 0, "toIndex": 1, "label": "10.2 eV", "kind": "absorption" }
  ]
}

CRITICAL:
- Levels are listed in any order; the renderer stacks them vertically by
  energy value (lower energies at the bottom).
- "fromIndex" / "toIndex" are 0-based indices into the levels array.
- "absorption" renders an upward dashed arrow; "emission" renders a downward
  solid arrow. If kind is omitted, the renderer picks based on direction.
- Include the photon energy or wavelength in the transition label
  ("10.2 eV", "656 nm").

Circuit diagrams (REQUIRED structured spec for type "circuit"):
The diagram is rendered server-side by schemdraw, an electrical-engineering
schematics library. Emit an ordered list of components — schemdraw places
each one starting from where the previous left off, so direction matters.

{
  "kind": "circuit_schemdraw",
  "elements": [
    { "type": "Battery",  "label": "9 V", "direction": "right" },
    { "type": "Resistor", "label": "1 kΩ", "direction": "right" },
    { "type": "Capacitor","label": "10 μF", "direction": "down" },
    { "type": "Line",     "direction": "left" },
    { "type": "Line",     "direction": "up" }
  ]
}

Allowed element types (use exact case): Resistor, ResistorIEC, Capacitor,
CapacitorVar, Inductor, Inductor2, Battery, Cell, Diode, LED, Photodiode,
Switch, SwitchSpdt, Lamp, Speaker, Ground, Vss, Vdd, Line, Dot, Arrow,
SourceV, SourceI, Meter, MeterV, MeterA, MeterOhm, Transformer, Fuse,
Potentiometer, Crystal, Memristor.

CRITICAL when emitting circuit_schemdraw:
- Each element flows from where the previous one ended; close the loop
  with Line elements at right angles to return to the starting node.
- Default direction is "right". Use "down" / "left" / "up" to turn corners.
- Labels are CIE-style component values: "1 kΩ", "10 μF", "9 V", "100 mH".
- Keep <= 12 elements per circuit so the figure stays readable.
- For parallel branches use additional Line/Dot elements to mark the
  junctions; full nodal analysis is too complex for AI emission.

Ray diagrams (REQUIRED structured spec for type "ray"):
You compute the ray paths yourself using mirror / lens formulas; the
renderer just draws the polylines you supply. World units are typically
cm but any unit works as long as you're consistent.

{
  "kind": "ray_diagram",
  "xRange": [-2, 32],
  "yRange": [-6, 6],
  "axisY": 0,
  "element": {
    "type": "thin_lens_convex",
    "x": 16,
    "height": 8,
    "focalLength": 8
  },
  "object": { "x": 4, "height": 3, "label": "O" },
  "image":  { "x": 24, "height": -2, "label": "I" },
  "rays": [
    { "points": [[4, 3], [16, 3], [24, -2]], "label": "ray 1" },
    { "points": [[4, 3], [16, 0], [24, -2]] },
    { "points": [[4, 3], [8, 0], [16, -1.5], [24, -2]] }
  ],
  "showFocalPoints": true
}

Element types and CIE conventions:
  plane_mirror   — vertical line + back-side hatching at 45°
  concave_mirror — arc opening to the right (towards object), focal length F
  convex_mirror  — arc opening to the left, focal length F (virtual focus)
  thin_lens_convex  — vertical line with outward arrowheads at top/bottom
  thin_lens_concave — vertical line with inward arrowheads

Compute the rays correctly per the lens / mirror laws:
  Convex lens: ray parallel to axis refracts through F on the far side; ray
    through optical centre passes straight through; ray through near F
    emerges parallel.
  Concave lens: ray parallel to axis refracts as if from far F.
  Concave mirror: ray parallel reflects through F; ray through C reflects
    back; ray through F reflects parallel.
  Plane mirror: angle of incidence = angle of reflection; image is virtual,
    same distance behind, on dashed extension lines.

Style conventions:
  - Real ray paths: solid black, mid-segment arrowhead pointing in the
    direction of light travel.
  - Virtual extensions / construction lines: dashed.
  - Virtual images: marker_end arrow on the image arrow, dashed outline.
  - Mark F on the principal axis with a filled black dot (showFocalPoints).
  - Object always on the left of the element; light travels left-to-right.

Chemistry structures (REQUIRED structured spec for type "molecular" or
"organic_skeletal"):
The diagram is rendered server-side by RDKit from a SMILES string. RDKit
computes 2D coordinates and lays out the structure with standard organic-
chemistry conventions (skeletal structure, kekulé bonds, stereochemistry).

{
  "kind": "molecule_smiles",
  "smiles": "CC(=O)O",         // SMILES — see common examples below
  "kekulize": true,            // default true; renders aromatic rings as kekulé
  "width": 400, "height": 280  // canvas in px (defaults shown)
}

Common examples (CIE / Edexcel chem-syllabus level):
  Water           "O"
  Ethanol         "CCO"
  Acetic acid     "CC(=O)O"
  Methane         "C"
  Ethene          "C=C"
  Benzene         "c1ccccc1"
  Glucose         "OCC1OC(O)C(O)C(O)C1O"
  Aspirin         "CC(=O)Oc1ccccc1C(=O)O"
  Caffeine        "CN1C=NC2=C1C(=O)N(C)C(=O)N2C"
  Amino acid (alanine)  "CC(C(=O)O)N"

CRITICAL when emitting molecule_smiles:
- SMILES must be SYNTACTICALLY VALID. RDKit rejects malformed strings;
  the renderer falls back to gpt-image-2 if so.
- Use lowercase letters for aromatic atoms (c1ccccc1 = benzene) and
  uppercase for aliphatic (CCCC = butane).
- Stereochemistry is optional but supported: "[C@H](N)(C)C(=O)O" for
  L-alanine. Omit unless the question asks about chirality.
- Keep <= 30 heavy atoms; A-Level / IGCSE syllabus rarely needs more.

Statistical charts (REQUIRED structured spec for type "statistical"):
Pick the chart kind that matches the question. Three options:

1) Histogram — kind "stat_histogram":
{
  "kind": "stat_histogram",
  "bins": [
    { "lo": 0, "hi": 5,  "freq": 8 },
    { "lo": 5, "hi": 10, "freq": 14 },
    { "lo": 10,"hi": 20, "freq": 12 }
  ],
  "frequencyDensity": false,
  "xLabel": "Time (hours)",
  "yLabel": "Frequency"
}
- Bins must be contiguous (each lo equals previous hi); CIE convention
  is bars touch.
- When class widths are UNEQUAL the y-axis must show frequency density,
  not raw frequency. Set frequencyDensity=true and supply density
  values (frequency ÷ class width).

2) Box-and-whisker plot — kind "stat_box_plot":
{
  "kind": "stat_box_plot",
  "series": [
    { "label": "Class A", "min": 12, "q1": 18, "median": 22, "q3": 28, "max": 35,
      "outliers": [42] }
  ],
  "xLabel": "Marks"
}
- Multiple series stack vertically; useful for comparing distributions.
- Include outliers only if the question identifies them.

3) Cumulative frequency curve — kind "stat_cum_freq":
{
  "kind": "stat_cum_freq",
  "points": [
    { "x": 0, "cumFreq": 0 },
    { "x": 5, "cumFreq": 8 },
    { "x": 10,"cumFreq": 22 },
    { "x": 20,"cumFreq": 34 }
  ],
  "xLabel": "Time (hours)",
  "yLabel": "Cumulative frequency",
  "markers": [
    { "y": 17, "label": "median (n/2 = 17)" }
  ]
}
- Points are typically (upper class boundary, cumulative frequency).
- Always start at (lower bound, 0) so the curve grounds at the x-axis.
- Optional dashed marker lines for median / quartiles help students
  read off values; include only if the question asks about them.

Scatter plot? Use kind "coordinate_plane" with just points[]; the
existing math renderer handles scatter via points + axes.`;

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
    // 5-minute window pay only for the user message. Subject module is
    // appended so each subject gets its own conventions block.
    const systemBlocks = [
      {
        type: 'text',
        text: `${this.LAYER_ROLE_COMMON}\n\n${this.subjectModule(args.syllabus)}`,
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
      const diagram = this.parseDiagramHint(q?.diagram);
      const uiKind = this.parseUiKind(q?.uiKind);
      const passage = typeof q?.passage === 'string' && q.passage.trim().length > 0
        ? String(q.passage).slice(0, 8000)
        : undefined;
      return {
        stem,
        parts: parts && parts.length > 0 ? parts : undefined,
        totalMarks,
        suggestedDifficulty,
        questionType,
        uiKind,
        passage,
        notes: q?.notes ? String(q.notes).slice(0, 500) : undefined,
        diagram,
      };
    });
  }

  /** B5 — normalize uiKind to one of the allowed renderer hints, or
   *  undefined if absent / invalid. Non-English subjects are allowed to
   *  omit it; the caller decides whether absence is fatal. */
  private parseUiKind(v: any): UiKind | undefined {
    const allowed: UiKind[] = [
      'multiple_choice',
      'cloze',
      'vocab_in_context',
      'sentence_transformation',
      'reading_passage',
    ];
    const s = String(v ?? '').trim();
    return (allowed as string[]).includes(s) ? (s as UiKind) : undefined;
  }

  /** B5/B6 — for English/IELTS subjects we REQUIRE every parsed question
   *  to carry a uiKind, and when uiKind is 'cloze' we REQUIRE the first
   *  question to carry a `passage` field whose [BLANK] count matches the
   *  number of parsed questions in the batch. Throws ServiceUnavailable
   *  if the contract is violated, so the caller (QuickPaperService) can
   *  surface the failure instead of producing a malformed paper.
   *
   *  Non-English subjects (Physics, Chem, Math, CS) skip this check and
   *  return without throwing. */
  validateEnglishContract(
    syllabusCode: string,
    parsed: ParsedQuestion[],
  ): void {
    const isEnglish =
      syllabusCode === 'IELTS' || syllabusCode === '1123' || syllabusCode === 'EL';
    if (!isEnglish) return;
    for (let i = 0; i < parsed.length; i++) {
      const q = parsed[i];
      if (!q.uiKind) {
        throw new ServiceUnavailableException(
          `English paper question Q${i + 1} is missing uiKind. ` +
            `Each question must declare uiKind (multiple_choice/cloze/vocab_in_context/sentence_transformation/reading_passage).`,
        );
      }
    }
    // Cloze contract: when ANY question is uiKind=cloze, all questions
    // in the batch must be cloze, share one passage on Q1, and the
    // [BLANK] count must equal the question count.
    const clozeCount = parsed.filter((q) => q.uiKind === 'cloze').length;
    if (clozeCount > 0) {
      if (clozeCount !== parsed.length) {
        throw new ServiceUnavailableException(
          'cloze paper contract: every question in the batch must be uiKind=cloze ' +
            `(found ${clozeCount}/${parsed.length}).`,
        );
      }
      const passage = parsed[0].passage ?? '';
      if (!passage) {
        throw new ServiceUnavailableException(
          'cloze paper contract: the first question must carry a `passage` field with [BLANK] markers.',
        );
      }
      // Count occurrences of [BLANK] (case-insensitive). Reject nested
      // markers like [[BLANK]BLANK] by also rejecting the literal "[[BLANK".
      if (/\[\[BLANK/i.test(passage)) {
        throw new ServiceUnavailableException(
          'cloze paper contract: nested [BLANK] markers are not allowed in the passage.',
        );
      }
      const blanks = (passage.match(/\[BLANK\]/gi) ?? []).length;
      if (blanks !== parsed.length) {
        throw new ServiceUnavailableException(
          `cloze paper contract: passage has ${blanks} [BLANK] markers but ` +
            `${parsed.length} questions were generated — they must match.`,
        );
      }
    }
  }

  private parseDiagramHint(d: any): DiagramHint | undefined {
    if (!d || typeof d !== 'object') return undefined;
    if (d.needed === false) return { needed: false };
    if (d.needed !== true) return undefined;
    const allowedTypes: ReadonlyArray<string> = [
      'apparatus', 'circuit', 'waveform', 'graph', 'free_body', 'molecular',
      'ray', 'mechanics', 'geometry', 'statistical', 'energy_level', 'organic_skeletal',
      'logic_gate', 'flowchart', 'data_structure', 'network_topology',
    ];
    const type = String(d.type ?? '').trim();
    if (!allowedTypes.includes(type)) return { needed: false };
    const scene = String(d.scene ?? '').trim();
    if (scene.length < 10) return { needed: false };
    const labels = Array.isArray(d.labels)
      ? d.labels.map((s: any) => String(s ?? '').trim()).filter((s: string) => s.length > 0).slice(0, 12)
      : [];
    const hint: DiagramHint = { needed: true, type: type as any, scene: scene.slice(0, 1500), labels };
    if (d.spec && typeof d.spec === 'object') {
      // Each diagram type has its own permitted spec.kind. Mismatches drop
      // the spec and we fall back to gpt-image-2.
      const isMath = (type === 'geometry' || type === 'graph' || type === 'waveform');
      const isGraph = (type === 'flowchart' || type === 'data_structure'
                    || type === 'network_topology' || type === 'logic_gate');
      const isFreeBody = (type === 'free_body');
      const isEnergyLevel = (type === 'energy_level');
      const isCircuit = (type === 'circuit');
      const isRay = (type === 'ray');
      const isMolecule = (type === 'molecular' || type === 'organic_skeletal');
      const isStatistical = (type === 'statistical');
      if (isMath && d.spec.kind === 'coordinate_plane') {
        const spec = this.parseCoordinateSpec(d.spec);
        if (spec) (hint as any).spec = spec;
      } else if (isGraph && d.spec.kind === 'graphviz_dot') {
        const spec = this.parseGraphvizSpec(d.spec);
        if (spec) (hint as any).spec = spec;
      } else if (isFreeBody && d.spec.kind === 'free_body') {
        const spec = this.parseFreeBodySpec(d.spec);
        if (spec) (hint as any).spec = spec;
      } else if (isEnergyLevel && d.spec.kind === 'energy_level') {
        const spec = this.parseEnergyLevelSpec(d.spec);
        if (spec) (hint as any).spec = spec;
      } else if (isCircuit && d.spec.kind === 'circuit_schemdraw') {
        const spec = this.parseCircuitSpec(d.spec);
        if (spec) (hint as any).spec = spec;
      } else if (isRay && d.spec.kind === 'ray_diagram') {
        const spec = this.parseRaySpec(d.spec);
        if (spec) (hint as any).spec = spec;
      } else if (isMolecule && d.spec.kind === 'molecule_smiles') {
        const spec = this.parseMoleculeSpec(d.spec);
        if (spec) (hint as any).spec = spec;
      } else if (isStatistical && d.spec.kind === 'coordinate_plane') {
        // Scatter plots reuse the math coordinate-plane renderer.
        const spec = this.parseCoordinateSpec(d.spec);
        if (spec) (hint as any).spec = spec;
      } else if (isStatistical && d.spec.kind === 'stat_histogram') {
        const spec = this.parseStatHistogramSpec(d.spec);
        if (spec) (hint as any).spec = spec;
      } else if (isStatistical && d.spec.kind === 'stat_box_plot') {
        const spec = this.parseStatBoxPlotSpec(d.spec);
        if (spec) (hint as any).spec = spec;
      } else if (isStatistical && d.spec.kind === 'stat_cum_freq') {
        const spec = this.parseStatCumFreqSpec(d.spec);
        if (spec) (hint as any).spec = spec;
      }
    }
    return hint;
  }

  private parseStatHistogramSpec(s: any): StatHistogramMathSpec | null {
    if (!s || s.kind !== 'stat_histogram') return null;
    const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const bins = Array.isArray(s.bins)
      ? s.bins.flatMap((b: any) => {
          const lo = num(b?.lo); const hi = num(b?.hi); const freq = num(b?.freq);
          if (lo === null || hi === null || freq === null) return [];
          if (hi <= lo || freq < 0) return [];
          return [{ lo, hi, freq }];
        }).slice(0, 30)
      : [];
    if (bins.length === 0) return null;
    return {
      kind: 'stat_histogram',
      bins,
      frequencyDensity: s.frequencyDensity === true,
      xLabel: typeof s.xLabel === 'string' ? s.xLabel.slice(0, 60) : undefined,
      yLabel: typeof s.yLabel === 'string' ? s.yLabel.slice(0, 60) : undefined,
    };
  }

  private parseStatBoxPlotSpec(s: any): StatBoxPlotMathSpec | null {
    if (!s || s.kind !== 'stat_box_plot') return null;
    const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const series = Array.isArray(s.series)
      ? s.series.flatMap((sr: any) => {
          const min = num(sr?.min); const q1 = num(sr?.q1);
          const median = num(sr?.median); const q3 = num(sr?.q3); const max = num(sr?.max);
          const label = typeof sr?.label === 'string' ? sr.label.trim() : '';
          if (!label || min === null || q1 === null || median === null || q3 === null || max === null) return [];
          if (!(min <= q1 && q1 <= median && median <= q3 && q3 <= max)) return [];
          const outliers = Array.isArray(sr.outliers)
            ? sr.outliers.flatMap((o: any) => { const v = num(o); return v === null ? [] : [v]; }).slice(0, 6)
            : undefined;
          return [{ label: label.slice(0, 40), min, q1, median, q3, max, outliers }];
        }).slice(0, 6)
      : [];
    if (series.length === 0) return null;
    let range: [number, number] | undefined;
    if (Array.isArray(s.range) && s.range.length === 2) {
      const a = num(s.range[0]); const b = num(s.range[1]);
      if (a !== null && b !== null && a < b) range = [a, b];
    }
    return {
      kind: 'stat_box_plot', series, range,
      xLabel: typeof s.xLabel === 'string' ? s.xLabel.slice(0, 60) : undefined,
    };
  }

  private parseStatCumFreqSpec(s: any): StatCumFreqMathSpec | null {
    if (!s || s.kind !== 'stat_cum_freq') return null;
    const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const points = Array.isArray(s.points)
      ? s.points.flatMap((p: any) => {
          const x = num(p?.x); const cf = num(p?.cumFreq);
          if (x === null || cf === null || cf < 0) return [];
          return [{ x, cumFreq: cf }];
        }).slice(0, 30)
      : [];
    if (points.length < 2) return null;
    const markers = Array.isArray(s.markers)
      ? s.markers.flatMap((m: any) => {
          const y = num(m?.y);
          if (y === null) return [];
          return [{ y, label: typeof m?.label === 'string' ? m.label.slice(0, 40) : undefined }];
        }).slice(0, 5)
      : undefined;
    return {
      kind: 'stat_cum_freq', points, markers,
      xLabel: typeof s.xLabel === 'string' ? s.xLabel.slice(0, 60) : undefined,
      yLabel: typeof s.yLabel === 'string' ? s.yLabel.slice(0, 60) : undefined,
    };
  }

  private parseMoleculeSpec(s: any): MoleculeRdkitMathSpec | null {
    if (!s || s.kind !== 'molecule_smiles') return null;
    const smiles = typeof s.smiles === 'string' ? s.smiles.trim() : '';
    if (smiles.length < 1 || smiles.length > 500) return null;
    // Conservative SMILES character allowlist (atoms, bonds, ring digits,
    // brackets, charges, stereo, dots). Server-side RDKit does the real parse.
    if (!/^[A-Za-z0-9@+\-=\[\]\(\)\.\\\/#%*]+$/.test(smiles)) return null;
    return {
      kind: 'molecule_smiles',
      smiles,
      kekulize: s.kekulize !== false,
      width: typeof s.width === 'number' && s.width >= 120 && s.width <= 800 ? s.width : undefined,
      height: typeof s.height === 'number' && s.height >= 120 && s.height <= 600 ? s.height : undefined,
    };
  }

  private parseRaySpec(s: any): RayMathSpec | null {
    if (!s || s.kind !== 'ray_diagram') return null;
    const xRange = this.parseRange(s.xRange);
    const yRange = this.parseRange(s.yRange);
    if (!xRange || !yRange) return null;
    const allowedElements = new Set([
      'plane_mirror', 'concave_mirror', 'convex_mirror',
      'thin_lens_convex', 'thin_lens_concave',
    ]);
    if (!s.element || !allowedElements.has(s.element.type)) return null;
    const ex = Number(s.element.x);
    if (!Number.isFinite(ex)) return null;
    const element: RayMathSpec['element'] = { type: s.element.type, x: ex };
    if (typeof s.element.height === 'number' && Number.isFinite(s.element.height)) element.height = s.element.height;
    if (typeof s.element.focalLength === 'number' && Number.isFinite(s.element.focalLength)) element.focalLength = s.element.focalLength;

    const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const parsePt = (p: any): [number, number] | null => {
      if (!Array.isArray(p) || p.length !== 2) return null;
      const a = Number(p[0]); const b = Number(p[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return [a, b];
    };

    const object = s.object && typeof s.object === 'object' && num(s.object.x) !== null && num(s.object.height) !== null
      ? { x: Number(s.object.x), height: Number(s.object.height),
          label: typeof s.object.label === 'string' ? s.object.label.slice(0, 20) : undefined }
      : undefined;

    const image = s.image && typeof s.image === 'object' && num(s.image.x) !== null && num(s.image.height) !== null
      ? { x: Number(s.image.x), height: Number(s.image.height),
          virtual: s.image.virtual === true,
          label: typeof s.image.label === 'string' ? s.image.label.slice(0, 20) : undefined }
      : undefined;

    const rays = Array.isArray(s.rays)
      ? s.rays.flatMap((r: any) => {
          if (!Array.isArray(r?.points) || r.points.length < 2) return [];
          const pts: Array<[number, number]> = [];
          for (const p of r.points) {
            const xy = parsePt(p);
            if (!xy) return [];
            pts.push(xy);
          }
          if (pts.length < 2) return [];
          return [{
            points: pts,
            style: r?.style === 'dashed' ? 'dashed' as const : 'solid' as const,
            arrow: r?.arrow === 'end' ? 'end' as const
                  : r?.arrow === 'none' ? 'none' as const
                  : 'mid' as const,
            label: typeof r?.label === 'string' ? r.label.slice(0, 30) : undefined,
          }];
        }).slice(0, 8)
      : [];

    return {
      kind: 'ray_diagram',
      xRange, yRange,
      axisY: typeof s.axisY === 'number' ? s.axisY : undefined,
      element,
      object, image, rays,
      showFocalPoints: s.showFocalPoints !== false,
    };
  }

  private parseCircuitSpec(s: any): CircuitSchemdrawMathSpec | null {
    if (!s || s.kind !== 'circuit_schemdraw') return null;
    const allowedTypes = new Set([
      'Resistor','ResistorIEC','Capacitor','CapacitorVar','Inductor','Inductor2',
      'Battery','Cell','Diode','LED','Photodiode','Switch','SwitchSpdt',
      'Lamp','Speaker','Ground','Vss','Vdd','Line','Dot','Arrow',
      'SourceV','SourceI','Meter','MeterV','MeterA','MeterOhm','Transformer',
      'Fuse','Potentiometer','Crystal','Memristor',
    ]);
    const allowedDirs = new Set(['right', 'left', 'up', 'down']);
    const elements = Array.isArray(s.elements)
      ? s.elements.flatMap((e: any) => {
          if (!allowedTypes.has(e?.type)) return [];
          const elt: any = { type: e.type };
          if (typeof e.label === 'string') elt.label = e.label.slice(0, 40);
          if (allowedDirs.has(e.direction)) elt.direction = e.direction;
          if (typeof e.length === 'number' && e.length >= 0.5 && e.length <= 5) elt.length = e.length;
          if (e.flip === true) elt.flip = true;
          if (e.reverse === true) elt.reverse = true;
          return [elt];
        }).slice(0, 12)
      : [];
    if (elements.length === 0) return null;
    return { kind: 'circuit_schemdraw', elements };
  }

  private parseFreeBodySpec(s: any): FreeBodyMathSpec | null {
    if (!s || s.kind !== 'free_body') return null;
    const shape = ['block', 'sphere', 'dot'].includes(s.body?.shape) ? s.body.shape : 'block';
    const bodyLabel = typeof s.body?.label === 'string' ? s.body.label.slice(0, 40) : undefined;
    const forces = Array.isArray(s.forces)
      ? s.forces.flatMap((f: any) => {
          const mag = Number(f?.magnitude);
          const ang = Number(f?.angle);
          const lab = typeof f?.label === 'string' ? f.label.trim() : '';
          if (!Number.isFinite(mag) || mag <= 0) return [];
          if (!Number.isFinite(ang)) return [];
          if (!lab) return [];
          return [{
            magnitude: mag,
            angle: ang,
            label: lab.slice(0, 60),
            style: f?.style === 'dashed' ? 'dashed' : 'solid' as const,
          }];
        }).slice(0, 8)
      : [];
    if (forces.length === 0) return null;
    return { kind: 'free_body', body: { shape, label: bodyLabel }, forces };
  }

  private parseEnergyLevelSpec(s: any): EnergyLevelMathSpec | null {
    if (!s || s.kind !== 'energy_level') return null;
    const levels = Array.isArray(s.levels)
      ? s.levels.flatMap((l: any) => {
          const e = Number(l?.energy);
          const lab = typeof l?.label === 'string' ? l.label.trim() : '';
          if (!Number.isFinite(e)) return [];
          if (!lab) return [];
          return [{ energy: e, label: lab.slice(0, 60) }];
        }).slice(0, 12)
      : [];
    if (levels.length === 0) return null;
    const transitions = Array.isArray(s.transitions)
      ? s.transitions.flatMap((t: any) => {
          const f = Number(t?.fromIndex);
          const o = Number(t?.toIndex);
          if (!Number.isInteger(f) || !Number.isInteger(o)) return [];
          if (f < 0 || f >= levels.length || o < 0 || o >= levels.length) return [];
          return [{
            fromIndex: f,
            toIndex: o,
            label: typeof t?.label === 'string' ? t.label.slice(0, 40) : undefined,
            kind: t?.kind === 'absorption' ? 'absorption' as const
                : t?.kind === 'emission' ? 'emission' as const
                : undefined,
          }];
        }).slice(0, 10)
      : [];
    return { kind: 'energy_level', levels, transitions };
  }

  /** Validate the AI's Graphviz DOT spec. Strips obvious junk; the SVG
   *  service does its own length / safety checks. */
  private parseGraphvizSpec(s: any): GraphvizMathSpec | null {
    if (!s || typeof s !== 'object') return null;
    if (s.kind !== 'graphviz_dot') return null;
    const dot = typeof s.dot === 'string' ? s.dot.trim() : '';
    if (dot.length < 10 || dot.length > 32_000) return null;
    if (!/(di)?graph\s+\w*\s*\{/.test(dot)) return null;
    const enginesAllowed = ['dot', 'neato', 'circo', 'fdp', 'sfdp', 'twopi'];
    const engine = enginesAllowed.includes(s.engine) ? s.engine : 'dot';
    return { kind: 'graphviz_dot', dot, engine };
  }

  /** Validate the structured math spec emitted by the AI. Drops the spec
   *  entirely if anything looks malformed; the caller falls back to scene-
   *  driven gpt-image-2 in that case. */
  private parseCoordinateSpec(s: any): CoordinateMathSpec | null {
    if (!s || typeof s !== 'object') return null;
    if (s.kind !== 'coordinate_plane') return null;
    const xRange = this.parseRange(s.xRange);
    const yRange = this.parseRange(s.yRange);
    if (!xRange || !yRange) return null;
    const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const points = Array.isArray(s.points)
      ? s.points.flatMap((p: any) => {
          const x = num(p?.x); const y = num(p?.y);
          if (x === null || y === null) return [];
          return [{ x, y, label: p?.label ? String(p.label).slice(0, 60) : undefined,
                    labelPos: p?.labelPos ? String(p.labelPos) : undefined }];
        }).slice(0, 20)
      : [];
    const segments = Array.isArray(s.segments)
      ? s.segments.flatMap((g: any) => {
          const f = this.parseXY(g?.from); const t = this.parseXY(g?.to);
          if (!f || !t) return [];
          return [{ from: f, to: t, label: g?.label ? String(g.label).slice(0, 60) : undefined,
                    style: g?.style === 'dashed' ? 'dashed' : 'solid' as const }];
        }).slice(0, 20)
      : [];
    const lines = Array.isArray(s.lines)
      ? s.lines.flatMap((l: any) => {
          const vX = num(l?.verticalX);
          const slope = num(l?.slope);
          const point = this.parseXY(l?.point);
          if (vX === null && (slope === null || !point)) return [];
          return [{
            point: point ?? undefined,
            slope: slope ?? undefined,
            verticalX: vX ?? undefined,
            label: l?.label ? String(l.label).slice(0, 60) : undefined,
            style: l?.style === 'dashed' ? 'dashed' : 'solid' as const,
          }];
        }).slice(0, 10)
      : [];
    const parabolas = Array.isArray(s.parabolas)
      ? s.parabolas.flatMap((p: any) => {
          const a = num(p?.a); const b = num(p?.b); const c = num(p?.c);
          if (a === null || b === null || c === null) return [];
          return [{ a, b, c, label: p?.label ? String(p.label).slice(0, 60) : undefined,
                    style: p?.style === 'dashed' ? 'dashed' : 'solid' as const }];
        }).slice(0, 5)
      : [];
    if (points.length === 0 && segments.length === 0 && lines.length === 0 && parabolas.length === 0) {
      return null;
    }
    return {
      kind: 'coordinate_plane',
      xRange, yRange,
      gridStep: typeof s.gridStep === 'number' && s.gridStep > 0 ? s.gridStep : 1,
      points, segments, lines, parabolas,
    };
  }

  private parseRange(r: any): [number, number] | null {
    if (!Array.isArray(r) || r.length !== 2) return null;
    const a = Number(r[0]); const b = Number(r[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return null;
    return [a, b];
  }

  private parseXY(p: any): [number, number] | null {
    if (!Array.isArray(p) || p.length !== 2) return null;
    const a = Number(p[0]); const b = Number(p[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return [a, b];
  }
}
