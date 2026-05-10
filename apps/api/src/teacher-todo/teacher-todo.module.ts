import { Module } from '@nestjs/common';
import { TeacherTodoController } from './teacher-todo.controller';
import { TeacherTodoService } from './teacher-todo.service';
import { TeacherTodoCron } from './teacher-todo.cron';
import { PrismaService } from '../common/prisma.service';
import { WechatNotifyModule } from '../wechat-notify/wechat-notify.module';
// R10-Track2: import the canonical absence streak detector so the
// teacher dashboard's "consecutive absent" count uses the SAME logic
// as the alert service. Round-9 found teacher-todo had its own
// re-implementation that lacked the "current streak only" semantics
// → it counted long-stale absences as live, producing 35 when the
// alert service produced 0.
import { MorningQuizModule } from '../morning-quiz/morning-quiz.module';

/**
 * F1 — Teacher's "today" dashboard module.
 *
 * Aggregates four signal streams into a single payload the teacher
 * dashboard renders as a top-of-page card:
 *   1. Papers awaiting QA-review action (verdict needs_review/reject,
 *      qaTeacherAction null).
 *   2. Short-answer answer scripts awaiting marking (auto-graded MCQs
 *      excluded; only structured/short_answer items still without
 *      awardedMarks).
 *   3. Students with consecutive-absence streak ≥ ABSENCE_ALERT_THRESHOLD.
 *   4. Today's quiz session(s) where students have not yet scanned in by
 *      the late-cutoff time (i.e. unaccounted-for students).
 *
 * Used by:
 *   - GET /teacher/todo/today — JSON payload for the dashboard card
 *   - TeacherTodoCron at 08:30 + 18:30 — formats a digest and pushes
 *     it to enterprise WeChat via wechat-notify (event
 *     `teacher_daily_digest`). Gated by env TEACHER_DAILY_DIGEST=true.
 */
@Module({
  imports: [WechatNotifyModule, MorningQuizModule],
  controllers: [TeacherTodoController],
  providers: [TeacherTodoService, TeacherTodoCron, PrismaService],
  exports: [TeacherTodoService],
})
export class TeacherTodoModule {}
