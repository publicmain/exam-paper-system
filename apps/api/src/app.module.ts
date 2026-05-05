import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './common/prisma.service';
import { AuthGuard } from './common/auth.guard';
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
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
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
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [PrismaService],
})
export class AppModule {}
