import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './common/prisma.service';
import { GradeService } from './grading/grade.service';
import { AuthGuard } from './common/auth.guard';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { RateLimitGuard } from './common/rate-limit.guard';
import { AuthModule } from './auth/auth.module';
import { ReferenceModule } from './reference/reference.module';
import { QuestionsModule } from './questions/questions.module';
import { TemplatesModule } from './templates/templates.module';
import { PapersModule } from './papers/papers.module';
import { AiModule } from './ai/ai.module';
import { PdfModule } from './pdf/pdf.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { ComplianceModule } from './compliance/compliance.module';
import { IngestModule } from './ingest/ingest.module';
import { SourcesModule } from './sources/sources.module';
import { InternalModule } from './internal/internal.module';
import { ReviewModule } from './review/review.module';
import { ClassesModule } from './classes/classes.module';
import { StudentModule } from './student/student.module';
// Path-B modules
import { MarkerModule } from './marker/marker.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { QualityFeedbackModule } from './quality-feedback/quality-feedback.module';
import { PerfRoutingModule } from './perf-routing/perf-routing.module';
import { AdminSyllabusModule } from './admin-syllabus/admin-syllabus.module';
import { AdminCostModule } from './admin-cost/admin-cost.module';
import { AdminRbacModule } from './admin-rbac/admin-rbac.module';
import { PaperVariantsModule } from './paper-variants/paper-variants.module';
import { WechatNotifyModule } from './wechat-notify/wechat-notify.module';
import { CodegraderModule } from './codegrader/codegrader.module';
import { AiTutorModule } from './ai-tutor/ai-tutor.module';
import { WatermarkModule } from './watermark/watermark.module';
import { AdminCleanupModule } from './admin-cleanup/admin-cleanup.module';
import { ClassifierModule } from './classifier/classifier.module';
import { PracticeModule } from './practice/practice.module';
// Morning attendance + quiz (feature/morning-attendance-quiz)
import { ShuffleModule } from './shuffle/shuffle.module';
import { QrModule } from './qr/qr.module';
import { AttendanceModule } from './attendance/attendance.module';
import { MorningQuizModule } from './morning-quiz/morning-quiz.module';
import { MorningQuizQaModule } from './morning-quiz-qa/morning-quiz-qa.module';
import { TeacherTodoModule } from './teacher-todo/teacher-todo.module';
import { IeltsIngestModule } from './ielts-ingest/ielts-ingest.module';
import { OlevelIngestModule } from './olevel-ingest/olevel-ingest.module';
import { ContentBootstrapModule } from './bootstrap/content-bootstrap.module';
import { ParentPortalModule } from './parent-portal/parent-portal.module';
import { HomeworkModule } from './homework/homework.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    ScheduleModule.forRoot(),
    AuditModule,
    ComplianceModule,
    AuthModule,
    UsersModule,
    ReferenceModule,
    QuestionsModule,
    TemplatesModule,
    PapersModule,
    AiModule,
    PdfModule,
    IngestModule,
    SourcesModule,
    InternalModule,
    ReviewModule,
    ClassesModule,
    StudentModule,
    // Path-B
    MarkerModule,
    AnalyticsModule,
    QualityFeedbackModule,
    PerfRoutingModule,
    AdminSyllabusModule,
    AdminCostModule,
    AdminRbacModule,
    PaperVariantsModule,
    WechatNotifyModule,
    CodegraderModule,
    AiTutorModule,
    WatermarkModule,
    AdminCleanupModule,
    ClassifierModule,
    PracticeModule,
    // Morning attendance + quiz
    ShuffleModule,
    QrModule,
    AttendanceModule,
    MorningQuizModule,
    MorningQuizQaModule,
    TeacherTodoModule,
    IeltsIngestModule,
    OlevelIngestModule,
    // Homework M1 — course folders, homework upload/assign, photo submissions.
    HomeworkModule,
    // ContentBootstrapModule MUST come after IeltsIngestModule and
    // OlevelIngestModule — its provider injects their services. On
    // every API start it idempotently seeds the morning-quiz bank
    // from the shipped Cambridge fixtures (GT 14, IELTS 8, 0510)
    // so a fresh prod DB has content before the first weekly-generate
    // runs. Disable via BOOTSTRAP_CONTENT_DISABLED=true.
    ContentBootstrapModule,
    // F14 — Parent portal. AdminParentLinksController is admin-only and
    // goes through the global JWT AuthGuard. ParentPortalController is
    // @Public + ParentAuthGuard.
    ParentPortalModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    // RateLimitGuard runs before AuthGuard so anonymous brute-force on
    // /auth/login is blocked even when the AuthGuard would let unauthenticated
    // requests through (Public routes). Both are global; @RateLimit() opts
    // a route in.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    RateLimitGuard,
    // Phase 1 AI-ready grading seam (docs/PRD §7).
    GradeService,
  ],
  exports: [PrismaService, GradeService],
})
export class AppModule {}
