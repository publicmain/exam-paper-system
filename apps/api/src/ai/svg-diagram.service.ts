import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';

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
}

export interface SvgGenerateInput {
  questionId: string;
  spec: CoordinatePlaneSpec;
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

    const svg = this.renderCoordinatePlane(input.spec);

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
        aiModel: 'svg-renderer-v1',
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
        pointsCount: input.spec.points?.length ?? 0,
        segmentsCount: input.spec.segments?.length ?? 0,
        linesCount: input.spec.lines?.length ?? 0,
      },
      ip: actor.ip ?? null,
    });

    this.logger.log(`svg ok q=${input.questionId} kind=${input.spec.kind}`);
    return { assetId: asset.id, storageUrl: asset.storageUrl, costUsd: 0 };
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
