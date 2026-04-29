import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';

const AI_IMAGE_STORE = process.env.AI_IMAGE_STORAGE_PATH
  || path.join(process.env.RENDER_STORAGE_PATH || os.tmpdir(), 'ai-images');

// Pricing as of gpt-image-2 launch (2026-04-21). Update when OpenAI changes.
const PRICE_USD_PER_IMAGE: Record<string, Record<string, number>> = {
  '1024x1024': { low: 0.006, medium: 0.053, high: 0.211 },
  '1024x1536': { low: 0.005, medium: 0.041, high: 0.165 },
  '1536x1024': { low: 0.005, medium: 0.041, high: 0.165 },
};

export type DiagramType =
  | 'apparatus'
  | 'circuit'
  | 'waveform'
  | 'graph'
  | 'free_body'
  | 'molecular'
  | 'ray'
  | 'mechanics'
  | 'geometry'
  | 'statistical'
  | 'energy_level'
  | 'organic_skeletal';

export interface GenerateDiagramInput {
  questionId: string;
  diagramType: DiagramType;
  syllabus?: string;       // e.g. "9702", "9709"
  topicCode?: string;      // e.g. "PH.14"
  scene: string;           // teacher's free-text scene description
  labels?: string[];       // explicit labels to place
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'low' | 'medium' | 'high';
}

export interface GenerateDiagramResult {
  assetId: string;
  storageUrl: string;       // /api/question-assets/:id/file.png
  prompt: string;
  costUsd: number;
  monthToDateUsd: number;
  capUsd: number | null;
  remainingUsd: number | null;
}

/**
 * gpt-image-2 wrapper for generating CIE-style scientific diagrams that go
 * inside a Question. The teacher writes the question text in the editor;
 * this service only produces the supporting figure. Output is persisted as
 * a QuestionAsset with the full prompt + cost recorded for audit and
 * re-generation. Monthly spend is summed from the AuditLog so an attacker
 * with a teacher token can't quietly burn the OpenAI budget.
 */
@Injectable()
export class OpenAiImageService {
  private readonly logger = new Logger('OpenAiImageService');
  private readonly apiKey = process.env.OPENAI_API_KEY || '';
  private readonly capUsd = process.env.OPENAI_MONTHLY_USD_CAP
    ? Number(process.env.OPENAI_MONTHLY_USD_CAP)
    : null;
  private readonly model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Sum AuditLog 'openai.image.generate' costs for the current calendar
   * month. Cheaper than maintaining a usage table; the AuditLog is the
   * single source of truth and we already write to it on every call.
   */
  private async monthToDateUsd(): Promise<number> {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rows = await this.prisma.auditLog.findMany({
      where: { action: 'openai.image.generate', createdAt: { gte: start } },
      select: { metadata: true },
    });
    let sum = 0;
    for (const r of rows) {
      const cost = (r.metadata as any)?.costUsd;
      if (typeof cost === 'number' && Number.isFinite(cost)) sum += cost;
    }
    return Math.round(sum * 10000) / 10000;
  }

  async generateDiagram(
    input: GenerateDiagramInput,
    actor: { id: string; role: string; ip?: string | null },
  ): Promise<GenerateDiagramResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not configured on this deployment.',
      );
    }
    if (!input.scene || input.scene.trim().length < 10) {
      throw new BadRequestException('scene must be at least 10 characters');
    }
    const size = input.size ?? '1536x1024';
    const quality = input.quality ?? 'medium';
    const unitPrice = PRICE_USD_PER_IMAGE[size]?.[quality];
    if (typeof unitPrice !== 'number') {
      throw new BadRequestException(`unsupported size/quality: ${size} ${quality}`);
    }

    // Verify the parent question exists before spending money.
    const question = await this.prisma.question.findUnique({
      where: { id: input.questionId },
      select: { id: true },
    });
    if (!question) throw new BadRequestException('question not found');

    // Cost gate.
    const monthToDate = await this.monthToDateUsd();
    if (this.capUsd !== null && monthToDate + unitPrice > this.capUsd) {
      throw new ServiceUnavailableException(
        `Monthly OpenAI cap of $${this.capUsd} would be exceeded ` +
          `(month-to-date $${monthToDate.toFixed(2)} + $${unitPrice.toFixed(3)}).`,
      );
    }

    const prompt = this.buildPrompt(input);

    // Call gpt-image-2. Using fetch directly so we are not pinned to a
    // specific openai SDK release (gpt-image-2 just shipped 2026-04-21).
    const t0 = Date.now();
    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        size,
        quality,
        n: 1,
      }),
    });
    const elapsedMs = Date.now() - t0;
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new ServiceUnavailableException(
        `OpenAI ${resp.status}: ${text.slice(0, 500)}`,
      );
    }
    const body = (await resp.json()) as { data: { b64_json: string }[] };
    const b64 = body.data?.[0]?.b64_json;
    if (!b64) throw new ServiceUnavailableException('OpenAI returned no image data');

    // Persist to disk + DB.
    const dir = path.join(AI_IMAGE_STORE, input.questionId);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.png`;
    const abs = path.join(dir, filename);
    await fs.writeFile(abs, Buffer.from(b64, 'base64'));

    const asset = await this.prisma.questionAsset.create({
      data: {
        questionId: input.questionId,
        assetType: 'image',
        storageUrl: `/api/question-assets/by-question/${input.questionId}/${filename}`,
        altText: input.scene.slice(0, 200),
        aiGenerated: true,
        aiModel: this.model,
        aiPrompt: prompt,
        aiCostUsd: unitPrice,
        aiCreatedBy: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'openai.image.generate',
      entityType: 'question_asset',
      entityId: asset.id,
      metadata: {
        model: this.model,
        size,
        quality,
        diagramType: input.diagramType,
        syllabus: input.syllabus,
        topicCode: input.topicCode,
        costUsd: unitPrice,
        elapsedMs,
        promptChars: prompt.length,
      },
      ip: actor.ip ?? null,
    });

    this.logger.log(
      `gpt-image-2 ok q=${input.questionId} type=${input.diagramType} cost=$${unitPrice} elapsed=${elapsedMs}ms`,
    );

    return {
      assetId: asset.id,
      storageUrl: asset.storageUrl,
      prompt,
      costUsd: unitPrice,
      monthToDateUsd: Math.round((monthToDate + unitPrice) * 10000) / 10000,
      capUsd: this.capUsd,
      remainingUsd:
        this.capUsd !== null
          ? Math.max(0, Math.round((this.capUsd - monthToDate - unitPrice) * 100) / 100)
          : null,
    };
  }

  /** Public so the UI can show a cost estimate without spending money. */
  estimateCost(size: string, quality: string): number {
    return PRICE_USD_PER_IMAGE[size]?.[quality] ?? 0;
  }

  /** Public so the UI can show "month-to-date $X" before generating. */
  async budgetStatus() {
    const mtd = await this.monthToDateUsd();
    return {
      monthToDateUsd: mtd,
      capUsd: this.capUsd,
      remainingUsd:
        this.capUsd !== null ? Math.max(0, Math.round((this.capUsd - mtd) * 100) / 100) : null,
    };
  }

  // ---------- prompt assembly ----------

  /**
   * Layer 1: visual style lock. Every prompt starts with this so the model
   * matches CIE past-paper diagram conventions across all diagram types.
   */
  private readonly LAYER_STYLE = `You are a scientific diagram illustrator for Cambridge International A-Level examination papers. Your output must match the visual conventions of CIE past papers exactly:
- Pure black ink on white background. No colour, no shading, no gradients, no shadows.
- Line weight: 1.5pt for primary objects, 0.75pt for axes and label leaders.
- Sans-serif labels (Helvetica equivalent), 10pt body / 8pt subscripts.
- All text horizontal except curve labels which may be at 90 degrees.
- 2D orthogonal projection. No 3D perspective unless explicitly requested.
- 5% empty margin on each side of the canvas.
- The image must be self-contained: do NOT add a question number, a paper title, "Fig. 1", "Diagram 1" or similar — the layout engine adds those. Only draw the diagram itself plus the labels I list.
- Spell every requested label exactly as written. If you cannot place a label legibly, leave it out rather than abbreviating.`;

  /** Layer 2: per-diagram-type conventions. */
  private readonly LAYER_TYPE: Record<DiagramType, string> = {
    apparatus: `Diagram type: experimental APPARATUS schematic.
Conventions:
- Glassware: round-bottom flask = circle with vertical stem; beaker = U with handle; conical flask = triangle with neck.
- Bunsen burner = trapezoid with flame tongue above.
- Clamps and stands: hatched rectangle on a vertical rod with base.
- Liquids: parallel horizontal lines, surface as a single solid line, meniscus optional.
- Gas inside a container: faint diagonal hatching.
- Rubber tubing: parallel double line with 1mm gap.
- Thermometer: vertical line with bulb circle and scale ticks on the side.
- Use leader lines (thin diagonal) from labels to the object they name.`,
    circuit: `Diagram type: ELECTRIC CIRCUIT (CIE 9702 standard symbols).
Conventions:
- Cell = long line (positive) + short line (negative). Battery = repeated cell pattern.
- Resistor = RECTANGLE (CIE convention; do NOT use the American zigzag).
- Variable resistor = rectangle with a diagonal arrow through it.
- Ammeter = circle containing the letter A. Voltmeter = circle containing V.
- Switch open = gap with diagonal line above; switch closed = solid line.
- Wires: orthogonal only (right angles), no curves. Junction = filled black dot.
- LED = triangle pointing into a vertical bar, two outward-pointing arrows.
- Capacitor = two parallel lines of equal length and spacing.
- Inductor = series of half-circle bumps.`,
    waveform: `Diagram type: WAVEFORM on labelled axes.
Conventions:
- Horizontal axis (time/displacement) and vertical axis (amplitude/displacement) drawn as black arrows with arrowheads, axis labels at the arrow tip.
- Origin marked with "0".
- Tick marks at regular intervals with numeric labels below the x-axis.
- The waveform itself is a single smooth black curve drawn over a clearly visible grid is OPTIONAL — only draw a grid if requested.
- Mark amplitude and wavelength with double-headed arrows when requested.`,
    graph: `Diagram type: 2D GRAPH on Cartesian axes.
Conventions:
- Axes drawn as black arrows with arrowheads, axis labels at the arrow tip including units in / parentheses (e.g. "v / m s⁻¹").
- Origin marked with "0". Tick marks evenly spaced with numeric values.
- A single curve unless multiple are explicitly requested. Different curves use different line dash patterns (solid, dashed, dotted), never colours.
- Significant points (intersections, turning points) marked with a small filled black circle and labelled.`,
    free_body: `Diagram type: FREE-BODY force diagram.
Conventions:
- The body is drawn as a simple geometric shape (block, sphere, dot) at the centre.
- Each force is a black arrow originating from the centre of the body, length proportional to magnitude.
- Force labels are at the arrowhead tip, in italics: F, T, W, R, Fₘ, etc.
- Angles between forces are marked with a small arc and the angle value in degrees.
- The reference frame (ground / wall) is drawn with hatching when relevant.`,
    molecular: `Diagram type: MOLECULAR / atomic structure.
Conventions:
- Atoms = black-edged circles with the element symbol inside (uppercase).
- Bonds = single line (single bond), double line (double bond), triple line (triple bond), dashed line (hydrogen bond / dative).
- Bond angles approximately to scale.
- Lone pairs as two small filled dots above the atom.
- Electrons in dot-and-cross diagrams: dots for one atom, crosses for the other, evenly distributed around the atom.`,
    ray: `Diagram type: RAY DIAGRAM (geometric optics, CIE 9702 / 0625 standard).
Conventions:
- Light rays = solid black lines with a single arrowhead pointing in the direction of travel. Place the arrowhead near the middle of each ray segment, not at the endpoint.
- Construction lines (normals, virtual ray extensions) = thin dashed lines, no arrowhead.
- The principal axis = a horizontal solid line through the centre of the optical element.
- Lenses: convex = vertical line with two small outward arrows at top and bottom; concave = vertical line with two small inward arrows. Mark the principal focus F on the axis with a small filled dot.
- Plane mirror = a solid line with right-angle hatching on the back side (5 short diagonal strokes, 45 degrees).
- Curved mirror = a solid arc with hatching on the convex side.
- Object = an upright black arrow standing on the axis. Image = a black arrow drawn at the determined position; if virtual, draw with a dashed outline.
- Angles of incidence/reflection/refraction marked with a small arc and angle label measured from the normal.
- Refraction at a boundary: bend the ray at the interface; show the normal as a thin dashed line perpendicular to the surface.`,
    mechanics: `Diagram type: MECHANICS schematic (kinematics / dynamics setup, CIE 9702).
Conventions:
- The body is drawn as a simple geometric shape (block, sphere, trolley) — solid black outline, white fill.
- Inclined surfaces are solid lines with hatching beneath to indicate solid ground; angle to horizontal marked with a small arc and label.
- Strings / ropes = thin solid lines; pulleys = small open circles with the rope passing over them.
- Springs = a series of small triangular zigzags drawn horizontally or vertically as appropriate.
- Forces shown as black arrows originating from the centre or relevant point of the body, length proportional to magnitude, label at arrowhead.
- Distances and dimensions: thin double-headed arrows with the value (e.g. "2.0 m") placed alongside in upright text.
- Velocity arrows are labelled with the symbol v (italic) and may carry a numeric value (e.g. "v = 5 m s⁻¹").
- The ground / wall reference surface is drawn with hatching (parallel diagonal strokes).`,
    geometry: `Diagram type: GEOMETRIC figure (pure geometry, CIE 9709 Math).
Conventions:
- All construction lines are solid black; auxiliary or extended lines are thin dashed.
- Vertices labelled with capital letters (A, B, C, …) placed just outside the figure, never overlapping the line.
- Side lengths and angles labelled directly: lengths in upright text along the side (e.g. "4 cm"), angles in upright text inside the angle (e.g. "60°").
- Right angles indicated with a small square at the vertex (not an arc).
- Equal sides marked with single tick marks; pairs of equal sides marked with double ticks. Equal angles marked with single or double arcs accordingly.
- Parallel lines marked with single or double arrowheads at midpoint.
- For circles: centre marked with a small filled dot labelled O; radius drawn as a solid line; chords as solid lines; tangents touch the circle at exactly one point with no gap.
- Coordinate geometry: axes drawn as black arrows with arrowheads, origin labelled O, scale tick marks at unit intervals.`,
    statistical: `Diagram type: STATISTICAL chart (CIE 9709 / 0580 statistics).
Conventions:
- Both axes are solid black lines with arrowheads at the far end. Axis labels placed at the arrow tip in upright text including units in / parentheses (e.g. "frequency density / cm⁻¹").
- Tick marks on the inside of the axis only, evenly spaced, with numeric labels below the x-axis and to the left of the y-axis.
- HISTOGRAM: rectangles with solid black borders, no fill or with light grey fill ONLY if requested; bars are adjacent (no gap); class boundaries on the x-axis.
- BOX-AND-WHISKER PLOT: a horizontal box drawn with solid black lines, vertical line for the median inside the box, whiskers as horizontal lines extending to min/max with short vertical caps. Outliers as small open circles beyond the whiskers.
- BAR CHART: rectangles with gaps between bars; categorical labels on the x-axis.
- CUMULATIVE FREQUENCY CURVE: a single smooth black curve through plotted points; points marked with small filled circles; values plotted at upper class boundaries.
- SCATTER PLOT: small filled black circles for each data point; line of best fit (if requested) drawn as a thin solid line.
- The origin is marked with "0" at the intersection of the axes.`,
    energy_level: `Diagram type: ENERGY LEVEL diagram (atomic / quantum, CIE 9702 photons & atoms).
Conventions:
- Horizontal solid black lines representing each energy level, drawn at vertical positions roughly proportional to energy magnitude.
- Each level labelled on the right with its energy value (e.g. "−0.85 eV") and on the left with the principal quantum number or label (e.g. "n = 4", "ground state").
- The lowest level (ground state) is drawn near the bottom; energy increases upward.
- Transitions shown as vertical arrows between levels: downward arrow for emission, upward arrow for absorption. Arrowhead at the destination level. Place transition labels (wavelength or photon energy) alongside the arrow.
- The "ionisation" or zero level is drawn as a solid line at the top labelled "n = ∞" or "ionisation".
- A thin vertical reference line on the left can carry tick marks for the energy scale, but is optional.
- Do NOT use colour to distinguish transitions; use solid vs dashed line styles only if multiple transitions overlap.`,
    organic_skeletal: `Diagram type: ORGANIC SKELETAL formula (CIE 9701 chemistry).
Conventions:
- Carbon atoms are NOT drawn as letters — each vertex and line endpoint is an implicit C.
- Hydrogen atoms on carbons are NOT drawn (implicit). Hydrogens on heteroatoms (N, O, S) ARE drawn explicitly as "H" with a bond.
- Heteroatoms (O, N, S, halogens, etc.) are drawn as the element letter at the vertex, no circle around them.
- Bonds: single bond = one line; double bond = two parallel lines very close together; triple bond = three parallel lines.
- Bond angles drawn at approximately 120° for sp² centres and zigzag for sp³ chains; do not draw straight horizontal chains.
- Functional groups follow standard convention: carboxylic acid drawn as -C(=O)-OH with the OH explicit; ester as -C(=O)-O-; aldehyde as -CHO with the H explicit; ketone as a vertex with =O branching off.
- Ring structures (benzene) drawn as a regular hexagon with three internal double bonds OR a hexagon with an inner circle (use double-bond convention by default unless circle is requested).
- Stereochemistry: solid wedge (filled triangle) for bond coming out of page; dashed wedge (parallel dashed lines forming a triangle) for bond going behind.
- Charges drawn next to the atom they belong to, e.g. "O⁻", "N⁺".`,
  };

  /** Layer 4: hard output constraints. */
  private readonly LAYER_OUTPUT = `Output requirements:
- All requested labels must appear EXACTLY as written, character-for-character. If a label contains a number (e.g. "150 g", "30°"), reproduce that number precisely.
- Do not add any labels, callouts, arrows, dimensions, or text not requested in the scene.
- If you cannot satisfy a label requirement, omit that label rather than substitute a different one.
- Do not put a border or frame around the diagram.`;

  private buildPrompt(input: GenerateDiagramInput): string {
    const styleLayer = this.LAYER_STYLE;
    const typeLayer = this.LAYER_TYPE[input.diagramType];

    const sceneLines: string[] = [];
    if (input.syllabus) sceneLines.push(`Syllabus: CIE ${input.syllabus}.`);
    if (input.topicCode) sceneLines.push(`Topic: ${input.topicCode}.`);
    sceneLines.push(`Scene: ${input.scene.trim()}`);
    if (input.labels && input.labels.length > 0) {
      sceneLines.push(`Required labels (exact spelling, place each on the relevant feature):`);
      for (const l of input.labels) sceneLines.push(`  - "${l}"`);
    }
    const sceneLayer = sceneLines.join('\n');

    return [styleLayer, typeLayer, sceneLayer, this.LAYER_OUTPUT].join('\n\n');
  }
}
