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

export type DiagramSpec = CoordinateMathSpec | GraphvizMathSpec
                        | FreeBodyMathSpec | EnergyLevelMathSpec;

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

export interface ParsedQuestion {
  stem: string;
  parts?: { label: string; text: string; marks: number }[];
  totalMarks: number;
  suggestedDifficulty: number;
  questionType: QuestionType;
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
  ("10.2 eV", "656 nm").`;

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
      return {
        stem,
        parts: parts && parts.length > 0 ? parts : undefined,
        totalMarks,
        suggestedDifficulty,
        questionType,
        notes: q?.notes ? String(q.notes).slice(0, 500) : undefined,
        diagram,
      };
    });
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
      }
    }
    return hint;
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
