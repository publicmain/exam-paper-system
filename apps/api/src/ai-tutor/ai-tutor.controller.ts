import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { AuthGuard, Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AiTutorService } from './ai-tutor.service';

// Validate at the edge with zod (matches student.controller.ts style).
const CreateSessionSchema = z.object({
  submissionId: z.string().min(1).optional(),
  paperQuestionId: z.string().min(1).optional(),
});
const AppendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});
const UsageQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * AI tutor controller. Two distinct slices, distinguished by role:
 *   - Student-only: create / read sessions, append messages.
 *   - Admin/head_teacher only: usage rollup for cost auditing.
 *
 * Authz: every route has an explicit @Roles() decorator. The class-level
 * AuthGuard (also globally registered as APP_GUARD in app.module.ts)
 * verifies the JWT and the per-handler role list.
 *
 * markScheme leak guarantee: the service feeds the mark scheme into the
 * Claude system prompt server-side ONLY and never includes it in the
 * response payload. The route handlers in this file return whatever the
 * service returns — they don't add or pass through any answer-key field.
 */
@Controller('ai-tutor')
@UseGuards(AuthGuard)
export class AiTutorController {
  constructor(private readonly tutor: AiTutorService) {}

  /** Student creates a new tutor session, optionally bound to a
   *  submission + paperQuestion they want to discuss. */
  @Post('sessions')
  @Roles('student')
  createSession(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.tutor.createSession(parsed.data, {
      id: user.id, role: user.role, ip: req.ip ?? null,
    });
  }

  /** Student or admin reads a session (full chat history). Authorization
   *  is enforced inside the service — students see only their own; admins
   *  see all. We allow both roles on the route so admins can audit
   *  individual sessions in the usage view. */
  @Get('sessions/:id')
  @Roles('student', 'admin', 'head_teacher')
  getSession(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.tutor.getSession(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /** Student sends a chat message. Service enforces the per-student
   *  daily cost cap; on exceedance this throws 429. */
  @Post('sessions/:id/messages')
  @Roles('student')
  appendMessage(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = AppendMessageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.tutor.appendMessage(id, parsed.data, {
      id: user.id, role: user.role, ip: req.ip ?? null,
    });
  }

  /** Admin view: total tutor cost in a time window. */
  @Get('usage')
  @Roles('admin', 'head_teacher')
  usage(@Query() query: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = UsageQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.tutor.usage(parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }
}
