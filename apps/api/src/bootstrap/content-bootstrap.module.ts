import { Module } from '@nestjs/common';
import { ContentBootstrapService } from './content-bootstrap.service';
import { IeltsIngestModule } from '../ielts-ingest/ielts-ingest.module';
import { OlevelIngestModule } from '../olevel-ingest/olevel-ingest.module';
import { PrismaService } from '../common/prisma.service';

/**
 * onApplicationBootstrap hook:
 *
 *  - ContentBootstrapService — seeds the morning-quiz question bank
 *    (Cambridge IELTS GT/Academic fixtures). Idempotent via sourceRef
 *    de-dup. Disable with BOOTSTRAP_CONTENT_DISABLED=true.
 *
 * Retired: DemoSessionBootstrapService. Originally auto-provisioned a
 * "morning assembly demo" class + session on every boot for projector
 * smoke-testing. Once admin deleted the demo class explicitly, the
 * bootstrap kept reviving it (class.upsert by classCode), so deleted
 * → next-deploy → back, with an orphan active olevel session leaking
 * into the schedule audit. The service file is kept on disk for
 * reference but is no longer wired into the module; flip it back on
 * only if we want a recurring demo again.
 */
@Module({
  imports: [IeltsIngestModule, OlevelIngestModule],
  providers: [ContentBootstrapService, PrismaService],
})
export class ContentBootstrapModule {}
