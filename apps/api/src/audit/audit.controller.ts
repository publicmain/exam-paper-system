import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../common/prisma.service';
import { RateLimit } from '../common/rate-limit.guard';
import { ROLE_ADMIN } from '../common/roles';
import { AuditService } from './audit.service';

const ListSchema = z.object({
  action: z.string().max(120).optional(),
  actorId: z.string().max(80).optional(),
  entityType: z.string().max(80).optional(),
  entityId: z.string().max(80).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * F8 — read endpoint for AuditLog. Admin-only because the trail
 * contains PII (actor names, IPs, occasionally student data inside
 * the diff/metadata blobs). Heavy query (full table scan once
 * filters are sparse), so guarded with @RateLimit 30/60s/IP.
 *
 * Privacy compliance: every read is itself audit-logged with
 * `action: 'audit.viewed'` + the filter parameters so we can answer
 * "who looked at this row?" later.
 */
@Controller('audit')
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
  async list(@Query() query: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (user?.role !== ROLE_ADMIN) {
      throw new ForbiddenException({ code: 'admin_only' });
    }
    const parsed = ListSchema.safeParse(query ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { action, actorId, entityType, entityId, from, to, limit, offset } = parsed.data;

    const where: any = {};
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Join actor name/email when present. Done with a single follow-up
    // query (not a Prisma relation include) because AuditLog.actorId is a
    // raw string column with no FK — actor may be 'system' or a deleted
    // user id, both of which need to surface gracefully.
    const actorIds = Array.from(
      new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x && x !== 'system')),
    );
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const actorById = new Map(actors.map((a) => [a.id, a]));
    const items = rows.map((r) => {
      const a = r.actorId ? actorById.get(r.actorId) : null;
      return {
        ...r,
        actor: a ? { id: a.id, name: a.name, email: a.email } : null,
      };
    });

    // Audit the read itself for privacy compliance. Fire-and-forget —
    // if the audit insert fails the read still returns; AuditService
    // already swallows non-tx errors with a console.error.
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'audit.viewed',
      entityType: 'AuditLog',
      entityId: 'list',
      ip: req.ip ?? null,
      metadata: {
        filter: { action, actorId, entityType, entityId, from, to },
        limit,
        offset,
        resultCount: items.length,
        total,
      },
    });

    return {
      items,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }
}
