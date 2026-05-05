import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard, Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CodegraderService } from './codegrader.service';
import { CreateTestCaseSchema, SubmitCodeSchema } from './dto';

/**
 * Code grader controller — split into two role groups, NOT a class-level
 * @Roles. The submit / list-cases / fetch-result routes are reachable by
 * students; the test-case management routes (create / delete) are
 * teacher-only.
 *
 * We use AuthGuard at class level (everyone needs a JWT) and put @Roles
 * on each handler so the matrix is obvious in code review:
 *
 *   POST /codegrader/questions/:questionId/test-cases  teacher
 *   GET  /codegrader/questions/:questionId/test-cases  teacher OR student (hidden filtered)
 *   DELETE /codegrader/test-cases/:id                  teacher
 *   POST /codegrader/submit                            student
 *   GET  /codegrader/result/:scriptId                  student (own only) OR teacher (any)
 */
@Controller('codegrader')
@UseGuards(AuthGuard)
export class CodegraderController {
  constructor(private readonly service: CodegraderService) {}

  // ----------------------------------------------------------------
  // Test case management — teacher-only
  // ----------------------------------------------------------------

  @Post('questions/:questionId/test-cases')
  @Roles('admin', 'head_teacher', 'teacher')
  addTestCase(
    @Param('questionId') questionId: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = CreateTestCaseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.addTestCase(questionId, parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /**
   * List test cases. Both teachers and students can hit this; service
   * filters hidden cases and redacts expectedStdout for students.
   * @Roles allows all four roles so AuthGuard's role check passes.
   */
  @Get('questions/:questionId/test-cases')
  @Roles('admin', 'head_teacher', 'teacher', 'student')
  listTestCases(
    @Param('questionId') questionId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.service.listTestCases(questionId, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  @Delete('test-cases/:id')
  @Roles('admin', 'head_teacher', 'teacher')
  deleteTestCase(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.service.deleteTestCase(id, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  // ----------------------------------------------------------------
  // Submission — student
  // ----------------------------------------------------------------

  @Post('submit')
  @Roles('student')
  submit(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = SubmitCodeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.submit(parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /**
   * Fetch a code result by AnswerScript id. Service enforces ownership
   * for students (own only); teachers can read anyone's. We allow all
   * four roles at the guard level and let the service make the
   * fine-grained decision.
   */
  @Get('result/:scriptId')
  @Roles('admin', 'head_teacher', 'teacher', 'student')
  getResult(@Param('scriptId') scriptId: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.service.getResult(scriptId, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }
}
