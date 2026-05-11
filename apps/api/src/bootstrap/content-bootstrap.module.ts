import { Module } from '@nestjs/common';
import { ContentBootstrapService } from './content-bootstrap.service';
import { IeltsIngestModule } from '../ielts-ingest/ielts-ingest.module';
import { OlevelIngestModule } from '../olevel-ingest/olevel-ingest.module';
import { PrismaService } from '../common/prisma.service';

/**
 * Auto-seed the morning-quiz content bank on application start.
 *
 * Wired into AppModule so that on every API boot (e.g. each Railway
 * redeploy of a clean prod DB), the GT 14 simplified passages,
 * Cambridge IELTS 8 academic passages, and Cambridge IGCSE 0510 olevel
 * papers are ingested.
 *
 * Every ingest call is idempotent — the ielts/olevel ingest services
 * skip rows whose sourceRef already exists. So this is safe to run on
 * every boot: first deploy seeds the bank, every subsequent deploy is
 * a no-op finishing in well under a second.
 *
 * See content-bootstrap.service.ts for the actual logic.
 */
@Module({
  imports: [IeltsIngestModule, OlevelIngestModule],
  providers: [ContentBootstrapService, PrismaService],
})
export class ContentBootstrapModule {}
