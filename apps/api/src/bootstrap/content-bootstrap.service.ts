import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IeltsIngestService } from '../ielts-ingest/ielts-ingest.service';
import { OlevelIngestService } from '../olevel-ingest/olevel-ingest.service';
import { PrismaService } from '../common/prisma.service';

// Fixtures live OUTSIDE src/ (in apps/api/test-fixtures/) so they can
// be reused by the e2e harness. TS compile-time JSON imports from
// outside rootDir would land at the wrong relative path inside dist/,
// so we read them at runtime instead. Dockerfile COPYs the
// test-fixtures dir alongside dist/ so the relative path resolves
// the same way at runtime as it does in dev:
//   apps/api/dist/bootstrap/content-bootstrap.service.js
//   apps/api/test-fixtures/...
function loadFixture(rel: string): any {
  // __dirname at runtime = apps/api/dist/bootstrap (in container)
  // or                    = apps/api/dist/bootstrap (locally)
  // Both go up two to reach apps/api, then into test-fixtures.
  const p = path.join(__dirname, '..', '..', 'test-fixtures', rel);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * On application bootstrap (every API start), seed the content bank
 * idempotently:
 *   - 3 × Cambridge IELTS 14 GT sections   → ielts_simplified pool
 *   - 3 × Cambridge IELTS 8 Academic       → ielts_authentic pool
 *   - 3 × Cambridge IGCSE 0510 papers      → olevel pool
 *
 * The underlying ingest services do `findFirst({sourceRef})` before
 * each create, so re-runs of an already-populated DB are no-ops.
 *
 * If anything goes wrong (missing admin user, ingest validation
 * failure, transient DB issue), we log the error and continue — the
 * API must still boot to serve the rest of the routes.
 *
 * Disable with BOOTSTRAP_CONTENT_DISABLED=true if you ever need a deploy
 * to skip this step.
 */
@Injectable()
export class ContentBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('ContentBootstrap');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ielts: IeltsIngestService,
    private readonly olevel: OlevelIngestService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.BOOTSTRAP_CONTENT_DISABLED === 'true') {
      this.logger.log('skipped — BOOTSTRAP_CONTENT_DISABLED=true');
      return;
    }
    try {
      // Find an admin user to own the seeded rows. Falls back to first
      // teacher / head_teacher if no admin exists yet (fresh DB scenario).
      // If even that fails, abort: ingest needs a real userId for the
      // createdById FK.
      const owner = await this.prisma.user.findFirst({
        where: { role: { in: ['admin', 'head_teacher', 'teacher'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, email: true },
      });
      if (!owner) {
        this.logger.warn('skipped — no admin/teacher user exists yet; seed users first');
        return;
      }
      this.logger.log(`content-seed starting (owner=${owner.role} ${owner.email})`);
      const actor = { id: owner.id };

      const ieltsPassages: Array<{ label: string; payload: any }> = [
        { label: 'GT 14 Test1/P1', payload: loadFixture('cambridge-ielts-gt-14/test1-section1.json') },
        { label: 'GT 14 Test1/P2', payload: loadFixture('cambridge-ielts-gt-14/test1-section2.json') },
        { label: 'GT 14 Test1/P3', payload: loadFixture('cambridge-ielts-gt-14/test1-section3.json') },
        { label: 'IELTS 8 Test1/P1', payload: loadFixture('cambridge-ielts-8/test1-passage1.json') },
        { label: 'IELTS 8 Test1/P2', payload: loadFixture('cambridge-ielts-8/test1-passage2.json') },
        { label: 'IELTS 8 Test1/P3', payload: loadFixture('cambridge-ielts-8/test1-passage3.json') },
      ];

      let ieltsCreated = 0;
      let ieltsApproved = 0;
      for (const p of ieltsPassages) {
        try {
          const r = await this.ielts.ingestPassage(p.payload as any, actor);
          ieltsCreated += r.created;
          if (r.sourceRefPrefix) {
            // Auto-approve so weekly-generate immediately sees the rows
            // as `status: active`. In normal operator flow ingestion is
            // a 2-step (POST then approve); here we do both because the
            // fixtures are pre-vetted and shipped with the app.
            const a = await this.ielts.approveBySourceRefPrefix(r.sourceRefPrefix);
            ieltsApproved += a.promoted;
          }
        } catch (e: any) {
          this.logger.warn(`  ${p.label}: ${e.message ?? e}`);
        }
      }
      this.logger.log(`ielts pool: created=${ieltsCreated} approved=${ieltsApproved}`);

      const olevelPapers: Array<{ label: string; payload: any }> = [
        { label: '0510 s24/Paper12', payload: loadFixture('cie-0510/paper-s24-12.json') },
        { label: '0510 s23/Paper12', payload: loadFixture('cie-0510/paper-s23-12.json') },
        { label: '0510 w24/Paper12', payload: loadFixture('cie-0510/paper-w24-12.json') },
      ];

      let olCreated = 0;
      let olApproved = 0;
      for (const p of olevelPapers) {
        try {
          const r = await this.olevel.ingestPaper(p.payload as any, actor);
          olCreated += r.created;
          if (r.sourceRefPrefix) {
            const a = await this.olevel.approveByPrefix(r.sourceRefPrefix);
            olApproved += a.promoted;
          }
        } catch (e: any) {
          this.logger.warn(`  ${p.label}: ${e.message ?? e}`);
        }
      }
      this.logger.log(`olevel pool: created=${olCreated} approved=${olApproved}`);

      this.logger.log('content-seed done');
    } catch (e: any) {
      // Never block app startup on a seed problem — log and continue.
      this.logger.error(`bootstrap failed (continuing): ${e.message ?? e}`);
    }
  }
}
