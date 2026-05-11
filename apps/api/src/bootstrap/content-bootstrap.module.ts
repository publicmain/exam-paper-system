import { Module } from '@nestjs/common';
import { ContentBootstrapService } from './content-bootstrap.service';
import { DemoSessionBootstrapService } from './demo-session-bootstrap.service';
import { IeltsIngestModule } from '../ielts-ingest/ielts-ingest.module';
import { OlevelIngestModule } from '../olevel-ingest/olevel-ingest.module';
import { PrismaService } from '../common/prisma.service';

/**
 * Two onApplicationBootstrap hooks fire on every API start:
 *
 *  1. ContentBootstrapService — seeds the morning-quiz question bank
 *     (Cambridge IELTS GT/Academic + IGCSE 0510 fixtures). Idempotent
 *     via sourceRef de-dup.
 *
 *  2. DemoSessionBootstrapService — provisions the morning-assembly
 *     demo session for "today or next weekday morning", with a stable
 *     classId so the projector URL `/display?classId=<demo>` works
 *     across days without re-pasting per-session ids.
 *
 * Disable individually with BOOTSTRAP_CONTENT_DISABLED=true or
 * BOOTSTRAP_DEMO_DISABLED=true.
 */
@Module({
  imports: [IeltsIngestModule, OlevelIngestModule],
  providers: [ContentBootstrapService, DemoSessionBootstrapService, PrismaService],
})
export class ContentBootstrapModule {}
