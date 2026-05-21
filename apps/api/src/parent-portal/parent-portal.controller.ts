import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RateLimit } from '../common/rate-limit.guard';
import { ROLE_ADMIN } from '../common/roles';
import { ParentAuthGuard } from './parent-auth.guard';
import { ParentPortalService } from './parent-portal.service';

const CreateLinkSchema = z.object({
  studentId: z.string().min(1),
  parentLabel: z.string().max(120).optional(),
});

/**
 * F14 — admin endpoints for ParentLink CRUD. Distinct from the
 * public portal controller because (a) they require admin auth and
 * (b) they go through the standard global guards. The public portal
 * is the SeparateClass below.
 */
@Controller('admin/parent-links')
export class AdminParentLinksController {
  constructor(private readonly svc: ParentPortalService) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (user?.role !== ROLE_ADMIN) {
      throw new ForbiddenException({ code: 'admin_only' });
    }
    const parsed = CreateLinkSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    // baseUrl is reconstructed from the incoming request so the qrPayload
    // resolves wherever the API is running (Railway prod, ngrok dev, etc.)
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || '';
    const baseUrl = `${proto}://${host}`;
    return this.svc.createLink(parsed.data, baseUrl, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  @Get()
  async list(
    @Query('studentId') studentId: string | undefined,
    @Query('includeRevoked') includeRevokedRaw: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (user?.role !== ROLE_ADMIN) {
      throw new ForbiddenException({ code: 'admin_only' });
    }
    return this.svc.listLinks({
      studentId,
      includeRevoked: includeRevokedRaw === 'true',
    });
  }

  @Post(':id/revoke')
  async revoke(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (user?.role !== ROLE_ADMIN) {
      throw new ForbiddenException({ code: 'admin_only' });
    }
    return this.svc.revokeLink(id, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }
}

/**
 * F14 — public parent portal payload. PUBLIC (@Public bypasses the
 * global AuthGuard JWT requirement) + ParentAuthGuard does its own
 * token check.
 *
 * Rate-limited 30/60s/IP because token enumeration on a 192-bit
 * keyspace is computationally infeasible but a rude client could
 * still hammer the endpoint, and the payload assembly does ~5 DB
 * round-trips.
 */
@Controller('parent')
export class ParentPortalController {
  constructor(private readonly svc: ParentPortalService) {}

  @Public()
  @UseGuards(ParentAuthGuard)
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
  @Get('portal')
  async portal(@Req() req: Request) {
    const link = (req as any).parentLink;
    if (!link) throw new ForbiddenException({ code: 'parent_link_missing' });
    return this.svc.portalPayload(link);
  }
}
