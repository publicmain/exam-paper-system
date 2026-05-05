import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * AI cost dashboard aggregator.
 *
 * Source of truth: the AuditLog rows already written by every AI-spending
 * service (ai-question-generator, openai-image, quick-paper, svg-diagram).
 * Each row carries `metadata.costUsd` (number, USD). Some rows carry
 * additional fields the dashboard surfaces:
 *   - inputTokens / outputTokens (Anthropic generations)
 *   - model (Anthropic model id, OpenAI image model id, etc.)
 *   - questionsCostUsd / diagramsCostUsd (quick-paper, the only action
 *     that bundles two cost components)
 *
 * IMPORTANT: this module never *writes* to AuditLog and never *mutates*
 * any AI service. It only reads. If a new AI integration is added, just
 * include its action string in `AI_COST_ACTIONS` below and the dashboard
 * will pick it up.
 */
@Injectable()
export class AdminCostService {
  private readonly logger = new Logger('AdminCostService');

  /**
   * Every AuditLog action that carries a numeric `metadata.costUsd`.
   * Keep this list aligned with the audit.log() callsites in:
   *   - apps/api/src/ai/ai-question-generator.service.ts
   *   - apps/api/src/ai/openai-image.service.ts
   *   - apps/api/src/ai/quick-paper.service.ts
   *   - apps/api/src/ai/svg-diagram.service.ts (cost is always 0 today;
   *     included so a future paid SVG path is captured automatically)
   */
  private readonly AI_COST_ACTIONS = [
    'ai.question.generate',
    'openai.image.generate',
    'ai.quick_paper.generate',
    'svg.diagram.generate',
  ];

  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------------
  // GET /admin-cost/summary
  // Aggregate USD across the window, broken out by "model" key the FE
  // can render as cards: anthropic_input_tokens / anthropic_output_tokens
  // (token counts only, not USD; the USD is rolled into anthropic_total)
  // and openai_image (USD).
  // --------------------------------------------------------------------
  async summary(fromIso: string | undefined, toIso: string | undefined) {
    const { from, to } = parseRange(fromIso, toIso);

    const rows = await this.prisma.auditLog.findMany({
      where: {
        action: { in: this.AI_COST_ACTIONS },
        createdAt: { gte: from, lte: to },
      },
      select: { action: true, metadata: true, createdAt: true },
    });

    let totalUsd = 0;
    let anthropicUsd = 0;
    let openaiImageUsd = 0;
    let svgUsd = 0;
    let anthropicInputTokens = 0;
    let anthropicOutputTokens = 0;
    let callCount = 0;
    const byModel: Record<string, { calls: number; usd: number }> = {};

    for (const r of rows) {
      const md = (r.metadata ?? {}) as Record<string, any>;
      const cost = numberOrZero(md.costUsd);

      // quick-paper internally calls ai.question.generate +
      // openai.image.generate, each of which writes its own audit row
      // with metadata.costUsd. Counting the parent row's
      // questionsCostUsd / diagramsCostUsd would double-count, so we
      // skip the parent for monetary aggregation but still bump
      // callCount and the byModel breakdown so admins can see how
      // many quick-paper invocations happened.
      if (r.action === 'ai.quick_paper.generate') {
        callCount += 1;
        const slotKey = 'ai.quick_paper.generate';
        const slot = byModel[slotKey] ?? { calls: 0, usd: 0 };
        slot.calls += 1;
        // usd intentionally not incremented (avoid double-count)
        byModel[slotKey] = slot;
        continue;
      }

      totalUsd += cost;
      callCount += 1;

      if (r.action === 'ai.question.generate') {
        anthropicUsd += cost;
        anthropicInputTokens += numberOrZero(md.inputTokens);
        anthropicOutputTokens += numberOrZero(md.outputTokens);
      } else if (r.action === 'openai.image.generate') {
        openaiImageUsd += cost;
      } else if (r.action === 'svg.diagram.generate') {
        svgUsd += cost;
      }

      const modelKey = String(md.model ?? r.action);
      const slot = byModel[modelKey] ?? { calls: 0, usd: 0 };
      slot.calls += 1;
      slot.usd += cost;
      byModel[modelKey] = slot;
    }

    const byModelArr = Object.entries(byModel)
      .map(([model, v]) => ({
        model,
        calls: v.calls,
        usd: round4(v.usd),
      }))
      .sort((a, b) => b.usd - a.usd);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      callCount,
      totalUsd: round4(totalUsd),
      anthropicUsd: round4(anthropicUsd),
      openaiImageUsd: round4(openaiImageUsd),
      svgUsd: round4(svgUsd),
      anthropicInputTokens,
      anthropicOutputTokens,
      byModel: byModelArr,
    };
  }

  // --------------------------------------------------------------------
  // GET /admin-cost/by-user
  // Top spenders in the window. Joins User to resolve display name +
  // email; rows whose actorId is null are bucketed under "(system)".
  // --------------------------------------------------------------------
  async byUser(fromIso: string | undefined, toIso: string | undefined) {
    const { from, to } = parseRange(fromIso, toIso);

    const rows = await this.prisma.auditLog.findMany({
      where: {
        // Exclude quick-paper to avoid double counting (its child calls
        // are counted via ai.question.generate / openai.image.generate).
        action: { in: ['ai.question.generate', 'openai.image.generate', 'svg.diagram.generate'] },
        createdAt: { gte: from, lte: to },
      },
      select: { actorId: true, metadata: true, action: true },
    });

    const perUser = new Map<string, { calls: number; usd: number }>();
    for (const r of rows) {
      const md = (r.metadata ?? {}) as Record<string, any>;
      const cost = numberOrZero(md.costUsd);
      const key = r.actorId ?? '__system__';
      const slot = perUser.get(key) ?? { calls: 0, usd: 0 };
      slot.calls += 1;
      slot.usd += cost;
      perUser.set(key, slot);
    }

    const userIds = [...perUser.keys()].filter((k) => k !== '__system__');
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true, role: true },
        })
      : [];
    const usersById = new Map(users.map((u) => [u.id, u]));

    const out = [...perUser.entries()]
      .map(([id, v]) => {
        const u = id === '__system__' ? null : usersById.get(id) ?? null;
        return {
          userId: id === '__system__' ? null : id,
          email: u?.email ?? '(system)',
          name: u?.name ?? '(system)',
          role: u?.role ?? null,
          calls: v.calls,
          usd: round4(v.usd),
        };
      })
      .sort((a, b) => b.usd - a.usd);

    return { from: from.toISOString(), to: to.toISOString(), users: out };
  }

  // --------------------------------------------------------------------
  // GET /admin-cost/by-day
  // Daily timeseries for the last `days` calendar days (UTC).
  // --------------------------------------------------------------------
  async byDay(daysParam: number | undefined) {
    const days = clampInt(daysParam ?? 30, 1, 365);
    const now = new Date();
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    from.setUTCHours(0, 0, 0, 0);

    const rows = await this.prisma.auditLog.findMany({
      where: {
        action: { in: ['ai.question.generate', 'openai.image.generate', 'svg.diagram.generate'] },
        createdAt: { gte: from, lte: to },
      },
      select: { createdAt: true, action: true, metadata: true },
    });

    // Pre-fill every day so the FE chart has continuous x-axis.
    const buckets = new Map<string, { date: string; calls: number; usd: number; anthropicUsd: number; openaiUsd: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setUTCDate(d.getUTCDate() + i);
      const key = isoDate(d);
      buckets.set(key, { date: key, calls: 0, usd: 0, anthropicUsd: 0, openaiUsd: 0 });
    }

    for (const r of rows) {
      const key = isoDate(r.createdAt);
      const slot = buckets.get(key);
      if (!slot) continue;
      const md = (r.metadata ?? {}) as Record<string, any>;
      const cost = numberOrZero(md.costUsd);
      slot.calls += 1;
      slot.usd += cost;
      if (r.action === 'ai.question.generate') slot.anthropicUsd += cost;
      else if (r.action === 'openai.image.generate') slot.openaiUsd += cost;
    }

    const series = [...buckets.values()].map((b) => ({
      date: b.date,
      calls: b.calls,
      usd: round4(b.usd),
      anthropicUsd: round4(b.anthropicUsd),
      openaiUsd: round4(b.openaiUsd),
    }));

    return { days, from: from.toISOString(), to: to.toISOString(), series };
  }
}

// --------------------------- helpers ---------------------------

function numberOrZero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function isoDate(d: Date): string {
  // YYYY-MM-DD in UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parseRange(fromIso: string | undefined, toIso: string | undefined): { from: Date; to: Date } {
  // Defaults: last 30 days, UTC midnight to now.
  const now = new Date();
  let to = now;
  let from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 30);
  from.setUTCHours(0, 0, 0, 0);

  if (fromIso) {
    const d = parseDateOnly(fromIso);
    if (!d) throw new BadRequestException(`Invalid 'from' date: ${fromIso}`);
    from = d;
  }
  if (toIso) {
    const d = parseDateOnly(toIso, /* endOfDay */ true);
    if (!d) throw new BadRequestException(`Invalid 'to' date: ${toIso}`);
    to = d;
  }
  if (from > to) {
    throw new BadRequestException(`'from' must be <= 'to'`);
  }
  return { from, to };
}

/** Accept YYYY-MM-DD; reject anything else. */
function parseDateOnly(s: string, endOfDay = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}
