import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RemoteRenderService } from './remote-render.service';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { Graphviz } from '@hpcc-js/wasm-graphviz';

const ASSET_STORE = process.env.AI_IMAGE_STORAGE_PATH
  || path.join(process.env.RENDER_STORAGE_PATH || os.tmpdir(), 'ai-images');

/**
 * Structured spec for a coordinate-plane diagram. Designed so the AI
 * question generator can hand us geometry that we render deterministically
 * via SVG, instead of asking gpt-image-2 to "draw a perpendicular bisector"
 * (which gets the slope wrong because image models do not compute geometry).
 */
export interface CoordinatePlaneSpec {
  kind: 'coordinate_plane';
  xRange: [number, number];
  yRange: [number, number];
  /** Grid step in math units (default 1). 0 to disable grid. */
  gridStep?: number;
  points?: Array<{
    x: number;
    y: number;
    label?: string;
    /** Where to place the label relative to the point. Default top-right. */
    labelPos?: 'top' | 'bottom' | 'left' | 'right'
             | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  }>;
  /** Finite line segments. */
  segments?: Array<{
    from: [number, number];
    to: [number, number];
    label?: string;
    style?: 'solid' | 'dashed';
  }>;
  /** Infinite lines, defined either by point+slope or as a vertical x=k. */
  lines?: Array<{
    point?: [number, number];
    slope?: number;
    /** For vertical lines, the x value. Use this OR point+slope. */
    verticalX?: number;
    label?: string;
    style?: 'solid' | 'dashed';
  }>;
  /** Parabola y = a x² + b x + c. */
  parabolas?: Array<{
    a: number; b: number; c: number;
    label?: string;
    style?: 'solid' | 'dashed';
  }>;
  /** Sine/cosine waveforms for waveform-type diagrams. y = amplitude *
   *  sin(frequency * x + phase) + vertOffset. Two cycles or so worth in
   *  the visible xRange usually reads best. */
  sineCurves?: Array<{
    amplitude: number;
    frequency: number;
    phase?: number;
    vertOffset?: number;
    label?: string;
    style?: 'solid' | 'dashed';
  }>;
}

/**
 * Graphviz DOT-syntax spec used for CS-style network diagrams (flowcharts,
 * data structures, network topology, logic-gate networks). AI emits the dot
 * string directly; we hand it to @hpcc-js/wasm-graphviz which lays out and
 * renders SVG. Free, deterministic, professional-looking.
 */
export interface GraphvizDotSpec {
  kind: 'graphviz_dot';
  /** Full DOT syntax including the `digraph G { ... }` wrapper. */
  dot: string;
  /** Layout engine. dot = top-down hierarchical (default). neato = force.
   *  circo = circular. fdp = also force. sfdp = scalable force. */
  engine?: 'dot' | 'neato' | 'circo' | 'fdp' | 'sfdp' | 'twopi';
}

/** Free-body diagram: a body at the centre with named force arrows
 *  radiating out at exact angles (measured from +x axis, counter-clockwise
 *  positive). Arrow lengths are proportional to magnitude. */
export interface FreeBodySpec {
  kind: 'free_body';
  /** Body shape. block = square, sphere = circle, dot = small filled circle. */
  body: { shape: 'block' | 'sphere' | 'dot'; label?: string };
  forces: Array<{
    magnitude: number;
    angle: number;            // degrees, 0 = right, 90 = up
    label: string;
    style?: 'solid' | 'dashed';
  }>;
}

/** Atomic / molecular energy-level diagram: horizontal lines stacked by
 *  energy with vertical arrows for transitions between levels. */
export interface EnergyLevelSpec {
  kind: 'energy_level';
  levels: Array<{ energy: number; label: string }>;
  transitions?: Array<{
    fromIndex: number;
    toIndex: number;
    label?: string;
    /** 'absorption' (upward, dashed) or 'emission' (downward, solid). */
    kind?: 'absorption' | 'emission';
  }>;
}

/** Circuit-diagram spec rendered server-side via the Python pdf-worker
 *  (schemdraw library). AI emits a list of imperative element descriptions;
 *  the worker walks them through schemdraw's `Drawing()` API and returns
 *  SVG. Used to replace gpt-image-2 for type=circuit. */
export interface CircuitSchemdrawSpec {
  kind: 'circuit_schemdraw';
  elements: Array<{
    type: string;            // schemdraw element class name (Resistor, Capacitor, ...)
    label?: string;
    direction?: 'right' | 'left' | 'up' | 'down';
    length?: number;
    flip?: boolean;
    reverse?: boolean;
  }>;
}

/** Ray-diagram spec for type=ray. AI emits the geometry exactly: optical
 *  element + object + image + rays as point sequences. We render each ray
 *  as a polyline with an arrowhead mid-segment per CIE convention.
 *  Critical: the AI is responsible for computing ray paths correctly using
 *  the laws of reflection / refraction; the renderer just draws what it's
 *  told. */
export interface RayDiagramSpec {
  kind: 'ray_diagram';
  /** World coordinate range. Same logic as coordinate_plane but no grid. */
  xRange: [number, number];
  yRange: [number, number];
  /** Y of principal axis. Defaults to (yMin + yMax) / 2. */
  axisY?: number;
  element: {
    type: 'plane_mirror' | 'concave_mirror' | 'convex_mirror'
        | 'thin_lens_convex' | 'thin_lens_concave';
    x: number;
    /** Vertical extent of the element symbol in world units. Default
     *  is roughly 60% of yRange. */
    height?: number;
    /** Used to mark focal points as dots if provided. Distance in
     *  world units. */
    focalLength?: number;
  };
  /** Object as an upright/inverted arrow standing on the axis. */
  object?: { x: number; height: number; label?: string };
  /** Image as an arrow. virtual=true draws a dashed outline. */
  image?: { x: number; height: number; virtual?: boolean; label?: string };
  /** Rays as ordered point sequences. solid for real ray paths, dashed
   *  for virtual extensions / construction lines. */
  rays?: Array<{
    points: Array<[number, number]>;
    style?: 'solid' | 'dashed';
    /** mid (default per CIE convention) | end | none. */
    arrow?: 'mid' | 'end' | 'none';
    label?: string;
  }>;
  showFocalPoints?: boolean;
}

export type AnyDiagramSpec = CoordinatePlaneSpec | GraphvizDotSpec
                           | FreeBodySpec | EnergyLevelSpec
                           | CircuitSchemdrawSpec | RayDiagramSpec;

export interface SvgGenerateInput {
  questionId: string;
  spec: AnyDiagramSpec;
  syllabus?: string;
  topicCode?: string;
  altText?: string;
}

export interface SvgGenerateResult {
  assetId: string;
  storageUrl: string;
  costUsd: 0;
}

/**
 * Renders coordinate-plane math diagrams into precise SVG, then persists
 * them as QuestionAsset rows. Free (no API call), deterministic, and
 * geometrically correct — fixes gpt-image-2's habit of drawing slopes
 * wrong on math diagrams.
 */
@Injectable()
export class SvgDiagramService {
  private readonly logger = new Logger('SvgDiagram');
  // Lazy-init the wasm Graphviz instance; first call costs ~50ms, subsequent are cached.
  private graphvizPromise: Promise<Graphviz> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly remoteRender: RemoteRenderService,
  ) {}

  async generate(
    input: SvgGenerateInput,
    actor: { id: string; role: string; ip?: string | null },
  ): Promise<SvgGenerateResult> {
    const question = await this.prisma.question.findUnique({
      where: { id: input.questionId },
      select: { id: true },
    });
    if (!question) throw new BadRequestException('question not found');

    const svg = await this.renderSpec(input.spec);

    const dir = path.join(ASSET_STORE, input.questionId);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.svg`;
    const abs = path.join(dir, filename);
    await fs.writeFile(abs, svg, 'utf-8');

    const asset = await this.prisma.questionAsset.create({
      data: {
        questionId: input.questionId,
        assetType: 'svg',
        storageUrl: `/api/question-assets/by-question/${input.questionId}/${filename}`,
        altText: (input.altText ?? '').slice(0, 200) || null,
        aiGenerated: true,
        aiModel: input.spec.kind === 'graphviz_dot' ? 'graphviz-wasm-v1' : 'svg-renderer-v1',
        aiPrompt: JSON.stringify(input.spec).slice(0, 8000),
        aiCostUsd: 0,
        aiCreatedBy: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'svg.diagram.generate',
      entityType: 'question_asset',
      entityId: asset.id,
      metadata: {
        kind: input.spec.kind,
        syllabus: input.syllabus,
        topicCode: input.topicCode,
      },
      ip: actor.ip ?? null,
    });

    this.logger.log(`svg ok q=${input.questionId} kind=${input.spec.kind}`);
    return { assetId: asset.id, storageUrl: asset.storageUrl, costUsd: 0 };
  }

  /** Top-level dispatch by spec.kind. Async because Graphviz uses wasm
   *  and circuit rendering hits the pdf-worker over HTTP. */
  async renderSpec(spec: AnyDiagramSpec): Promise<string> {
    if (spec.kind === 'coordinate_plane') return this.renderCoordinatePlane(spec);
    if (spec.kind === 'graphviz_dot') return this.renderGraphvizDot(spec);
    if (spec.kind === 'free_body') return this.renderFreeBody(spec);
    if (spec.kind === 'energy_level') return this.renderEnergyLevel(spec);
    if (spec.kind === 'circuit_schemdraw') return this.remoteRender.renderCircuit(spec.elements);
    if (spec.kind === 'ray_diagram') return this.renderRayDiagram(spec);
    throw new BadRequestException(`unsupported diagram kind: ${(spec as any).kind}`);
  }

  /** Ray-diagram renderer. Optical element drawn per CIE conventions:
   *  plane_mirror = vertical line + back-side hatching; concave_mirror =
   *  arc opening towards positive x with hatching behind; convex_mirror
   *  the mirror image of that; thin convex lens = vertical line with
   *  outward arrowheads top and bottom; thin concave lens = inward
   *  arrowheads. AI computes ray paths and supplies them as point
   *  sequences; we draw polylines with mid-segment arrowheads. */
  private renderRayDiagram(spec: RayDiagramSpec): string {
    const [xMin, xMax] = spec.xRange;
    const [yMin, yMax] = spec.yRange;
    if (!(xMax > xMin) || !(yMax > yMin)) {
      throw new BadRequestException('ray_diagram: xRange / yRange invalid');
    }
    const axisY = spec.axisY ?? (yMin + yMax) / 2;
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    const padding = 24;
    const widthPx = 600;
    const heightPx = Math.round((widthPx - 2 * padding) * (yRange / xRange) + 2 * padding);
    const sx = (widthPx - 2 * padding) / xRange;
    const sy = (heightPx - 2 * padding) / yRange;
    const px = (x: number) => padding + (x - xMin) * sx;
    const py = (y: number) => heightPx - padding - (y - yMin) * sy;

    const parts: string[] = [];
    parts.push(`<rect width="${widthPx}" height="${heightPx}" fill="white"/>`);

    // Arrow markers — small filled triangle at mid-segment (CIE convention).
    parts.push(`<defs>
      <marker id="raymid" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="black"/></marker>
      <marker id="rayend" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="black"/></marker>
    </defs>`);

    // Principal axis — horizontal line through axisY
    parts.push(`<line x1="${px(xMin)}" y1="${py(axisY)}" x2="${px(xMax)}" y2="${py(axisY)}" stroke="black" stroke-width="0.8"/>`);

    // Optical element
    const e = spec.element;
    const elemHeight = e.height ?? yRange * 0.6;
    const eyTop = axisY + elemHeight / 2;
    const eyBot = axisY - elemHeight / 2;
    const ex = e.x;

    if (e.type === 'plane_mirror') {
      parts.push(`<line x1="${px(ex)}" y1="${py(eyTop)}" x2="${px(ex)}" y2="${py(eyBot)}" stroke="black" stroke-width="1.6"/>`);
      // Back-side hatching: 5 short diagonal strokes at 45°
      for (let i = 0; i < 5; i++) {
        const yy = eyBot + (elemHeight * (i + 0.5)) / 5;
        parts.push(`<line x1="${px(ex) + 8}" y1="${py(yy) - 4}" x2="${px(ex) + 2}" y2="${py(yy) + 4}" stroke="black" stroke-width="0.7"/>`);
      }
    } else if (e.type === 'concave_mirror' || e.type === 'convex_mirror') {
      // Arc: concave opens to the right (object side typically left), convex
      // opens left. Use SVG path arc; sagitta ≈ elemHeight/8 for visual.
      const sag = elemHeight / 6;
      const flip = e.type === 'convex_mirror' ? -1 : 1;
      const xL = ex - flip * sag;
      // Path uses end-angle arc spec; we just draw a half-ellipse-ish arc.
      const r = elemHeight; // radius approx
      const x1 = px(ex), y1 = py(eyTop);
      const x2 = px(ex), y2 = py(eyBot);
      const sweep = flip > 0 ? 0 : 1;
      parts.push(`<path d="M ${x1} ${y1} A ${r * sx / Math.max(1, sx)} ${elemHeight * sy / 2} 0 0 ${sweep} ${x2} ${y2}" stroke="black" stroke-width="1.6" fill="none"/>`);
      // Hatching behind the arc on the convex side
      for (let i = 0; i < 5; i++) {
        const yy = eyBot + (elemHeight * (i + 0.5)) / 5;
        const dx = flip > 0 ? -10 : 4;
        parts.push(`<line x1="${px(ex) + dx}" y1="${py(yy) - 4}" x2="${px(ex) + dx + 6}" y2="${py(yy) + 4}" stroke="black" stroke-width="0.7"/>`);
      }
    } else if (e.type === 'thin_lens_convex') {
      // Vertical line with outward arrowheads at top & bottom
      parts.push(`<line x1="${px(ex)}" y1="${py(eyTop)}" x2="${px(ex)}" y2="${py(eyBot)}" stroke="black" stroke-width="1.6"/>`);
      const ah = 6;
      parts.push(`<polygon points="${px(ex) - ah},${py(eyTop) + ah} ${px(ex) + ah},${py(eyTop) + ah} ${px(ex)},${py(eyTop)}" fill="black"/>`);
      parts.push(`<polygon points="${px(ex) - ah},${py(eyBot) - ah} ${px(ex) + ah},${py(eyBot) - ah} ${px(ex)},${py(eyBot)}" fill="black"/>`);
    } else if (e.type === 'thin_lens_concave') {
      // Vertical line with inward arrowheads at top & bottom
      parts.push(`<line x1="${px(ex)}" y1="${py(eyTop)}" x2="${px(ex)}" y2="${py(eyBot)}" stroke="black" stroke-width="1.6"/>`);
      const ah = 6;
      parts.push(`<polygon points="${px(ex) - ah},${py(eyTop)} ${px(ex) + ah},${py(eyTop)} ${px(ex)},${py(eyTop) + ah}" fill="black"/>`);
      parts.push(`<polygon points="${px(ex) - ah},${py(eyBot)} ${px(ex) + ah},${py(eyBot)} ${px(ex)},${py(eyBot) - ah}" fill="black"/>`);
    }

    // Focal points — marked as filled black dots on the axis at ±f
    if ((spec.showFocalPoints ?? true) && typeof e.focalLength === 'number') {
      const f = Math.abs(e.focalLength);
      for (const sign of [1, -1]) {
        const fx = ex + sign * f;
        if (fx >= xMin && fx <= xMax) {
          parts.push(`<circle cx="${px(fx)}" cy="${py(axisY)}" r="2.6" fill="black"/>`);
          parts.push(`<text x="${px(fx)}" y="${py(axisY) + 14}" text-anchor="middle" font-size="10" font-family="Arial" font-style="italic">F</text>`);
        }
      }
    }

    // Object — upright (or inverted) arrow on axis
    if (spec.object) {
      const o = spec.object;
      const x1 = px(o.x), y1 = py(axisY);
      const y2 = py(axisY + o.height);
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y2}" stroke="black" stroke-width="1.4" marker-end="url(#rayend)"/>`);
      if (o.label) {
        parts.push(`<text x="${x1}" y="${(y2) - 6}" text-anchor="middle" font-size="11" font-family="Arial" font-style="italic">${esc(o.label)}</text>`);
      }
    }

    // Image — same shape; dashed outline if virtual
    if (spec.image) {
      const im = spec.image;
      const x1 = px(im.x), y1 = py(axisY);
      const y2 = py(axisY + im.height);
      const dash = im.virtual ? ' stroke-dasharray="4,3"' : '';
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y2}" stroke="black" stroke-width="1.4" marker-end="url(#rayend)"${dash}/>`);
      if (im.label) {
        parts.push(`<text x="${x1}" y="${y2 - 6}" text-anchor="middle" font-size="11" font-family="Arial" font-style="italic">${esc(im.label)}</text>`);
      }
    }

    // Rays — polylines with optional mid-segment arrowhead
    for (const ray of spec.rays || []) {
      const pts = ray.points;
      if (!pts || pts.length < 2) continue;
      const dash = ray.style === 'dashed' ? ' stroke-dasharray="4,3"' : '';
      const arrow = ray.arrow ?? 'mid';
      const arrowAttr = arrow === 'end'
        ? ' marker-end="url(#rayend)"'
        : '';
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p[0]).toFixed(1)} ${py(p[1]).toFixed(1)}`).join(' ');
      parts.push(`<path d="${d}" stroke="black" stroke-width="1.3" fill="none"${dash}${arrowAttr}/>`);
      // Mid-segment arrow: place a separate triangle at the midpoint of the
      // longest segment (so ray direction is clear without cluttering joins).
      if (arrow === 'mid' && pts.length >= 2) {
        let bestI = 0, bestLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const dx = pts[i + 1][0] - pts[i][0];
          const dy = pts[i + 1][1] - pts[i][1];
          const len = Math.hypot(dx, dy);
          if (len > bestLen) { bestLen = len; bestI = i; }
        }
        const a = pts[bestI], b = pts[bestI + 1];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const angle = (Math.atan2(py(b[1]) - py(a[1]), px(b[0]) - px(a[0])) * 180) / Math.PI;
        parts.push(`<polygon points="-5,-3 5,0 -5,3" transform="translate(${px(mx)},${py(my)}) rotate(${angle.toFixed(1)})" fill="black"/>`);
      }
      if (ray.label) {
        const last = pts[pts.length - 1];
        parts.push(`<text x="${px(last[0]) + 6}" y="${py(last[1]) - 4}" font-size="10" font-family="Arial" font-style="italic">${esc(ray.label)}</text>`);
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}">${parts.join('')}</svg>`;
  }

  /** Free-body diagram: body in centre, force arrows radiating at exact
   *  angles. Arrow length scales with magnitude (longest force = 80px,
   *  others proportional). Labels at arrow tips. */
  private renderFreeBody(spec: FreeBodySpec): string {
    const W = 360, H = 280, cx = W / 2, cy = H / 2;
    const maxMag = Math.max(...spec.forces.map(f => Math.abs(f.magnitude)), 1);
    const baseLen = 90; // longest arrow length, px

    const parts: string[] = [];
    parts.push(`<rect width="${W}" height="${H}" fill="white"/>`);

    // Body
    if (spec.body.shape === 'block') {
      parts.push(`<rect x="${cx - 20}" y="${cy - 20}" width="40" height="40" fill="white" stroke="black" stroke-width="1.5"/>`);
    } else if (spec.body.shape === 'sphere') {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="20" fill="white" stroke="black" stroke-width="1.5"/>`);
    } else {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="3.5" fill="black"/>`);
    }
    if (spec.body.label) {
      parts.push(`<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-family="Arial">${esc(spec.body.label)}</text>`);
    }

    // Arrowhead marker (single, reused per arrow)
    parts.push(`<defs><marker id="fbarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="black"/></marker></defs>`);

    for (const f of spec.forces) {
      const len = baseLen * (Math.abs(f.magnitude) / maxMag);
      const rad = (f.angle * Math.PI) / 180;
      // Start arrow from body edge (not centre) to keep it clean.
      const bodyR = spec.body.shape === 'dot' ? 4 : 22;
      const x1 = cx + bodyR * Math.cos(rad);
      const y1 = cy - bodyR * Math.sin(rad);
      const x2 = cx + (bodyR + len) * Math.cos(rad);
      const y2 = cy - (bodyR + len) * Math.sin(rad);
      const dash = f.style === 'dashed' ? ' stroke-dasharray="5,4"' : '';
      parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="black" stroke-width="1.6" marker-end="url(#fbarr)"${dash}/>`);
      // Label at tip, offset outward
      const lx = cx + (bodyR + len + 12) * Math.cos(rad);
      const ly = cy - (bodyR + len + 12) * Math.sin(rad);
      const anchor = Math.cos(rad) > 0.3 ? 'start' : Math.cos(rad) < -0.3 ? 'end' : 'middle';
      parts.push(`<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-family="Arial" font-style="italic">${esc(f.label)}</text>`);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
  }

  /** Energy-level diagram: horizontal lines stacked by energy. Optional
   *  vertical arrows for transitions (absorption upward dashed, emission
   *  downward solid). Used for atomic shells, photon transitions, etc. */
  private renderEnergyLevel(spec: EnergyLevelSpec): string {
    const W = 420, H = 320;
    const margin = 40;
    const labelGap = 60; // space on right for level labels
    const xLeft = margin;
    const xRight = W - margin - labelGap;

    if (spec.levels.length === 0) {
      throw new BadRequestException('energy_level needs at least one level');
    }
    const energies = spec.levels.map(l => l.energy);
    const eMin = Math.min(...energies);
    const eMax = Math.max(...energies);
    const eRange = eMax - eMin || 1;

    const yFor = (e: number) =>
      (H - margin) - ((e - eMin) / eRange) * (H - 2 * margin);

    const parts: string[] = [];
    parts.push(`<rect width="${W}" height="${H}" fill="white"/>`);

    // y-axis label
    parts.push(`<text x="${margin - 24}" y="${margin - 10}" font-size="11" font-family="Arial" font-style="italic">Energy</text>`);
    parts.push(`<line x1="${margin}" y1="${margin - 6}" x2="${margin}" y2="${H - margin + 6}" stroke="black" stroke-width="1"/>`);
    parts.push(`<polygon points="${margin - 4},${margin - 4} ${margin + 4},${margin - 4} ${margin},${margin - 12}" fill="black"/>`);

    // Levels
    for (let i = 0; i < spec.levels.length; i++) {
      const lv = spec.levels[i];
      const y = yFor(lv.energy);
      parts.push(`<line x1="${xLeft}" y1="${y.toFixed(1)}" x2="${xRight}" y2="${y.toFixed(1)}" stroke="black" stroke-width="1.4"/>`);
      parts.push(`<text x="${xRight + 8}" y="${(y + 4).toFixed(1)}" font-size="11" font-family="Arial">${esc(lv.label)}</text>`);
    }

    // Arrowhead
    parts.push(`<defs>
      <marker id="elup" viewBox="0 0 10 10" refX="5" refY="0" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 10 L 5 0 L 10 10 z" fill="black"/></marker>
      <marker id="eldn" viewBox="0 0 10 10" refX="5" refY="10" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 5 10 L 10 0 z" fill="black"/></marker>
    </defs>`);

    // Transitions
    const N = spec.levels.length;
    let trCount = 0;
    for (const tr of spec.transitions ?? []) {
      if (tr.fromIndex < 0 || tr.fromIndex >= N) continue;
      if (tr.toIndex < 0 || tr.toIndex >= N) continue;
      const yF = yFor(spec.levels[tr.fromIndex].energy);
      const yT = yFor(spec.levels[tr.toIndex].energy);
      const x = xLeft + ((trCount + 1) * (xRight - xLeft)) / (((spec.transitions ?? []).length) + 1);
      const isAbsorption = tr.kind === 'absorption' || (tr.kind === undefined && yF > yT);
      const dash = isAbsorption ? ' stroke-dasharray="5,4"' : '';
      const marker = yT < yF ? 'elup' : 'eldn';
      parts.push(`<line x1="${x.toFixed(1)}" y1="${yF.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yT.toFixed(1)}" stroke="black" stroke-width="1.4" marker-end="url(#${marker})"${dash}/>`);
      if (tr.label) {
        const ym = (yF + yT) / 2;
        parts.push(`<text x="${(x + 6).toFixed(1)}" y="${(ym + 4).toFixed(1)}" font-size="10" font-family="Arial" font-style="italic">${esc(tr.label)}</text>`);
      }
      trCount++;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
  }

  /**
   * Render a Graphviz DOT-syntax graph as SVG. Used for flowcharts, data
   * structures (trees / linked lists), network topology, and logic-gate
   * networks. The AI hands us the full DOT string; @hpcc-js/wasm-graphviz
   * does the layout. SVG output is sanitised (script/foreignObject stripped)
   * because Puppeteer will inline this into the PDF.
   */
  private async renderGraphvizDot(spec: GraphvizDotSpec): Promise<string> {
    if (!spec.dot || typeof spec.dot !== 'string' || spec.dot.length < 10) {
      throw new BadRequestException('graphviz dot string is empty or invalid');
    }
    if (spec.dot.length > 32_000) {
      throw new BadRequestException('graphviz dot string too long (max 32k)');
    }
    const gv = await this.getGraphviz();
    const engine = spec.engine ?? 'dot';
    let svg: string;
    try {
      svg = gv.layout(spec.dot, 'svg', engine);
    } catch (e: any) {
      throw new BadRequestException(`graphviz layout failed: ${(e?.message ?? e).toString().slice(0, 300)}`);
    }
    // Sanitise: drop script tags and foreignObject (CSP defence in depth).
    svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '');
    svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
    // Drop the XML declaration so the file works as both standalone SVG and
    // when inlined into HTML via data URI.
    svg = svg.replace(/<\?xml[^?]*\?>\s*/, '').replace(/<!DOCTYPE[^>]*>\s*/, '');
    return svg;
  }

  private async getGraphviz(): Promise<Graphviz> {
    if (!this.graphvizPromise) this.graphvizPromise = Graphviz.load();
    return this.graphvizPromise;
  }

  /** Pure renderer — exposed for tests. Returns a self-contained SVG string. */
  renderCoordinatePlane(spec: CoordinatePlaneSpec): string {
    const [xMin, xMax] = spec.xRange;
    const [yMin, yMax] = spec.yRange;
    if (!(xMax > xMin) || !(yMax > yMin)) {
      throw new BadRequestException('xRange and yRange must be increasing');
    }

    const xRange = xMax - xMin;
    const yRange = yMax - yMin;

    // Pixel canvas — 600×N keeps lines crisp at print.
    const padding = 36;
    const widthPx = 600;
    const heightPx = Math.round((widthPx - 2 * padding) * (yRange / xRange) + 2 * padding);

    const sx = (widthPx - 2 * padding) / xRange;
    const sy = (heightPx - 2 * padding) / yRange;
    const px = (x: number) => padding + (x - xMin) * sx;
    const py = (y: number) => heightPx - padding - (y - yMin) * sy;

    const parts: string[] = [];
    parts.push(`<rect width="${widthPx}" height="${heightPx}" fill="white"/>`);

    // Grid
    const step = spec.gridStep ?? 1;
    if (step > 0) {
      for (let x = Math.ceil(xMin / step) * step; x <= xMax + 1e-9; x += step) {
        parts.push(`<line x1="${px(x)}" y1="${padding}" x2="${px(x)}" y2="${heightPx - padding}" stroke="#e5e5e5" stroke-width="0.5"/>`);
      }
      for (let y = Math.ceil(yMin / step) * step; y <= yMax + 1e-9; y += step) {
        parts.push(`<line x1="${padding}" y1="${py(y)}" x2="${widthPx - padding}" y2="${py(y)}" stroke="#e5e5e5" stroke-width="0.5"/>`);
      }
    }

    // Bounding box
    parts.push(`<rect x="${padding}" y="${padding}" width="${widthPx - 2 * padding}" height="${heightPx - 2 * padding}" fill="none" stroke="black" stroke-width="1"/>`);

    // Axes (only inside the visible range)
    const axisAtX0 = xMin <= 0 && xMax >= 0;
    const axisAtY0 = yMin <= 0 && yMax >= 0;
    if (axisAtX0) {
      parts.push(`<line x1="${px(0)}" y1="${padding}" x2="${px(0)}" y2="${heightPx - padding}" stroke="black" stroke-width="1.2"/>`);
      parts.push(`<text x="${px(0) - 4}" y="${padding - 6}" text-anchor="end" font-size="11" font-family="Arial" font-style="italic">y</text>`);
    }
    if (axisAtY0) {
      parts.push(`<line x1="${padding}" y1="${py(0)}" x2="${widthPx - padding}" y2="${py(0)}" stroke="black" stroke-width="1.2"/>`);
      parts.push(`<text x="${widthPx - padding + 6}" y="${py(0) + 4}" font-size="11" font-family="Arial" font-style="italic">x</text>`);
    }

    // Tick labels (integers only)
    if (axisAtY0) {
      for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
        if (x === 0) continue;
        parts.push(`<text x="${px(x)}" y="${py(0) + 14}" text-anchor="middle" font-size="9" font-family="Arial">${x}</text>`);
      }
    }
    if (axisAtX0) {
      for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
        if (y === 0) continue;
        parts.push(`<text x="${px(0) - 6}" y="${py(y) + 3}" text-anchor="end" font-size="9" font-family="Arial">${y}</text>`);
      }
    }
    if (axisAtX0 && axisAtY0) {
      parts.push(`<text x="${px(0) - 6}" y="${py(0) + 14}" text-anchor="end" font-size="9" font-family="Arial">O</text>`);
    }

    // Infinite lines
    for (const line of spec.lines || []) {
      const dash = line.style === 'dashed' ? ' stroke-dasharray="5,4"' : '';
      if (typeof line.verticalX === 'number') {
        const xv = line.verticalX;
        if (xv >= xMin && xv <= xMax) {
          parts.push(`<line x1="${px(xv)}" y1="${py(yMin)}" x2="${px(xv)}" y2="${py(yMax)}" stroke="black" stroke-width="1.4"${dash}/>`);
          if (line.label) {
            parts.push(`<text x="${px(xv) + 5}" y="${py(yMax) + 14}" font-size="11" font-family="Arial" font-style="italic">${esc(line.label)}</text>`);
          }
        }
      } else if (typeof line.slope === 'number' && line.point) {
        const [x0, y0] = line.point;
        const m = line.slope;
        const cI = y0 - m * x0;
        // Param line; clip to box.
        const clip = clipSegment(xMin, m * xMin + cI, xMax, m * xMax + cI, xMin, xMax, yMin, yMax);
        if (clip) {
          parts.push(`<line x1="${px(clip.x1)}" y1="${py(clip.y1)}" x2="${px(clip.x2)}" y2="${py(clip.y2)}" stroke="black" stroke-width="1.4"${dash}/>`);
          if (line.label) {
            parts.push(`<text x="${px(clip.x2) - 6}" y="${py(clip.y2) - 6}" text-anchor="end" font-size="11" font-family="Arial" font-style="italic">${esc(line.label)}</text>`);
          }
        }
      }
    }

    // Parabolas (sample 80 points, clip)
    for (const p of spec.parabolas || []) {
      const dash = p.style === 'dashed' ? ' stroke-dasharray="5,4"' : '';
      const pts: string[] = [];
      const N = 80;
      for (let i = 0; i <= N; i++) {
        const x = xMin + (xRange * i) / N;
        const y = p.a * x * x + p.b * x + p.c;
        if (y < yMin - 0.5 || y > yMax + 0.5) {
          if (pts.length) {
            // Move pen — render in a path with M for new sub-path
            pts.push('M');
          }
          continue;
        }
        if (pts.length === 0) pts.push(`M ${px(x)} ${py(y)}`);
        else if (pts[pts.length - 1] === 'M') pts[pts.length - 1] = `M ${px(x)} ${py(y)}`;
        else pts.push(`L ${px(x)} ${py(y)}`);
      }
      const d = pts.filter(s => s !== 'M').join(' ');
      if (d) {
        parts.push(`<path d="${d}" stroke="black" stroke-width="1.4" fill="none"${dash}/>`);
        if (p.label) {
          // Place label at the rightmost visible point
          const xL = xMax - xRange * 0.05;
          const yL = p.a * xL * xL + p.b * xL + p.c;
          if (yL >= yMin && yL <= yMax) {
            parts.push(`<text x="${px(xL)}" y="${py(yL) - 8}" font-size="11" font-family="Arial" font-style="italic">${esc(p.label)}</text>`);
          }
        }
      }
    }

    // Sine / cosine waveforms — y = A * sin(B*x + C) + D
    for (const c of spec.sineCurves || []) {
      const dash = c.style === 'dashed' ? ' stroke-dasharray="5,4"' : '';
      const A = c.amplitude;
      const B = c.frequency;
      const phi = c.phase ?? 0;
      const D = c.vertOffset ?? 0;
      const N = 200;
      const pts: string[] = [];
      let started = false;
      for (let i = 0; i <= N; i++) {
        const x = xMin + (xRange * i) / N;
        const y = A * Math.sin(B * x + phi) + D;
        if (y < yMin - 0.5 || y > yMax + 0.5) {
          if (started && pts[pts.length - 1] !== 'M') pts.push('M');
          continue;
        }
        if (!started || pts[pts.length - 1] === 'M') {
          pts.push(`M ${px(x)} ${py(y)}`);
          started = true;
        } else {
          pts.push(`L ${px(x)} ${py(y)}`);
        }
      }
      const d = pts.filter(s => s !== 'M').join(' ');
      if (d) {
        parts.push(`<path d="${d}" stroke="black" stroke-width="1.4" fill="none"${dash}/>`);
        if (c.label) {
          // Place near end of curve
          const xL = xMax - xRange * 0.05;
          const yL = A * Math.sin(B * xL + phi) + D;
          if (yL >= yMin && yL <= yMax) {
            parts.push(`<text x="${px(xL)}" y="${py(yL) - 8}" text-anchor="end" font-size="11" font-family="Arial" font-style="italic">${esc(c.label)}</text>`);
          }
        }
      }
    }

    // Segments
    for (const seg of spec.segments || []) {
      const dash = seg.style === 'dashed' ? ' stroke-dasharray="5,4"' : '';
      const [x1, y1] = seg.from;
      const [x2, y2] = seg.to;
      parts.push(`<line x1="${px(x1)}" y1="${py(y1)}" x2="${px(x2)}" y2="${py(y2)}" stroke="black" stroke-width="1.2"${dash}/>`);
      if (seg.label) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        parts.push(`<text x="${px(mx) + 6}" y="${py(my) - 4}" font-size="10" font-family="Arial">${esc(seg.label)}</text>`);
      }
    }

    // Points (drawn last, on top)
    for (const pt of spec.points || []) {
      parts.push(`<circle cx="${px(pt.x)}" cy="${py(pt.y)}" r="2.6" fill="black"/>`);
      if (pt.label) {
        const pos = pt.labelPos || 'top-right';
        let dx = 6, dy = -6, anchor: 'start' | 'middle' | 'end' = 'start';
        if (pos === 'top')          { dx = 0;  dy = -8; anchor = 'middle'; }
        else if (pos === 'bottom')  { dx = 0;  dy = 14; anchor = 'middle'; }
        else if (pos === 'left')    { dx = -6; dy = 4;  anchor = 'end'; }
        else if (pos === 'right')   { dx = 6;  dy = 4;  anchor = 'start'; }
        else if (pos === 'top-right')   { dx = 6;  dy = -6; anchor = 'start'; }
        else if (pos === 'top-left')    { dx = -6; dy = -6; anchor = 'end'; }
        else if (pos === 'bottom-right'){ dx = 6;  dy = 14; anchor = 'start'; }
        else if (pos === 'bottom-left') { dx = -6; dy = 14; anchor = 'end'; }
        parts.push(`<text x="${px(pt.x) + dx}" y="${py(pt.y) + dy}" text-anchor="${anchor}" font-size="11" font-family="Arial">${esc(pt.label)}</text>`);
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}">${parts.join('')}</svg>`;
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Liang-Barsky parametric line clipping against an axis-aligned rect. */
function clipSegment(
  x1: number, y1: number, x2: number, y2: number,
  xMin: number, xMax: number, yMin: number, yMax: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const ps = [-dx, dx, -dy, dy];
  const qs = [x1 - xMin, xMax - x1, y1 - yMin, yMax - y1];
  for (let i = 0; i < 4; i++) {
    if (ps[i] === 0) {
      if (qs[i] < 0) return null;
    } else {
      const r = qs[i] / ps[i];
      if (ps[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
  }
  return {
    x1: x1 + t0 * dx, y1: y1 + t0 * dy,
    x2: x1 + t1 * dx, y2: y1 + t1 * dy,
  };
}
