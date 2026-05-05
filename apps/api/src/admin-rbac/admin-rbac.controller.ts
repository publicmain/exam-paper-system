import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AdminRbacService } from './admin-rbac.service';
import { ResetPasswordSchema, UpdateUserSchema } from './dto';

/**
 * Admin-only RBAC management.
 *
 *   GET    /admin-rbac/users?q=&role=&page=&pageSize=
 *   PATCH  /admin-rbac/users/:id          { role?, isActive? }
 *   POST   /admin-rbac/users/:id/reset-password  { newPassword }
 *
 * Every route is gated by @Roles('admin'). The service additionally
 * enforces the self-lockout rule (an admin cannot demote / deactivate
 * themselves); the controller passes the actor's id to the service for
 * that comparison.
 */
@Controller('admin-rbac')
@Roles('admin')
export class AdminRbacController {
  constructor(private readonly rbac: AdminRbacService) {}

  @Get('users')
  list(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rbac.listUsers({
      q,
      role,
      page: page != null ? Number(page) : undefined,
      pageSize: pageSize != null ? Number(pageSize) : undefined,
    });
  }

  @Patch('users/:id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.rbac.update(id, parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  @Post('users/:id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.rbac.resetPassword(id, parsed.data.newPassword, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }
}
