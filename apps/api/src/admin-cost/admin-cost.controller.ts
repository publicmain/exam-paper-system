import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/auth.guard';
import { AdminCostService } from './admin-cost.service';

/**
 * Admin-only AI cost dashboard endpoints.
 *
 * Every route here is gated by @Roles('admin'). Cost data leaks model
 * usage volume per user — that's PII (an "active teacher" signal) plus
 * an internal financial signal — so it never goes to head_teacher or
 * teacher.
 */
@Controller('admin-cost')
@Roles('admin')
export class AdminCostController {
  constructor(private readonly cost: AdminCostService) {}

  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.cost.summary(from, to);
  }

  @Get('by-user')
  byUser(@Query('from') from?: string, @Query('to') to?: string) {
    return this.cost.byUser(from, to);
  }

  @Get('by-day')
  byDay(@Query('days') days?: string) {
    const n = days != null ? Number(days) : undefined;
    return this.cost.byDay(n);
  }
}
