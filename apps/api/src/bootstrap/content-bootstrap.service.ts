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

      // R10 follow-up — consolidate duplicate IELTS subjects so
      // ingest + picker land on the same row. A legacy seed created
      // an IELTS subject under the CAE exam board; the newer ingest
      // creates one under IELTS exam board. With both rows present,
      // findFirst({code:'IELTS'}) returns whichever Postgres orders
      // first, ingest may write to one and picker may read the
      // other → no_passages_in_bank even though the bank is full.
      // This consolidation is idempotent: if 0 or 1 IELTS subjects
      // exist it does nothing.
      await this.consolidateIeltsSubjects();

      const ieltsPassages: Array<{ label: string; payload: any }> = [
        { label: 'GT 14 Test1/P1', payload: loadFixture('cambridge-ielts-gt-14/test1-section1.json') },
        { label: 'GT 14 Test1/P2', payload: loadFixture('cambridge-ielts-gt-14/test1-section2.json') },
        { label: 'GT 14 Test1/P3', payload: loadFixture('cambridge-ielts-gt-14/test1-section3.json') },
        { label: 'IELTS 8 Test1/P1', payload: loadFixture('cambridge-ielts-8/test1-passage1.json') },
        { label: 'IELTS 8 Test1/P2', payload: loadFixture('cambridge-ielts-8/test1-passage2.json') },
        { label: 'IELTS 8 Test1/P3', payload: loadFixture('cambridge-ielts-8/test1-passage3.json') },
        // R10 follow-up — extending the ielts_authentic pool. Bank-stats
        // showed `剩 0/3 ⚠` after one school week because the pool only
        // had Test 1's 3 passages. Each Test 2/3/4 passage we add buys
        // the picker one more day of unique content before LRU recycle.
        { label: 'IELTS 8 Test2/P1', payload: loadFixture('cambridge-ielts-8/test2-passage1.json') },
        { label: 'IELTS 8 Test2/P2', payload: loadFixture('cambridge-ielts-8/test2-passage2.json') },
        { label: 'IELTS 8 Test2/P3', payload: loadFixture('cambridge-ielts-8/test2-passage3.json') },
        { label: 'IELTS 8 Test3/P1', payload: loadFixture('cambridge-ielts-8/test3-passage1.json') },
        { label: 'IELTS 8 Test3/P2', payload: loadFixture('cambridge-ielts-8/test3-passage2.json') },
        { label: 'IELTS 8 Test3/P3', payload: loadFixture('cambridge-ielts-8/test3-passage3.json') },
        { label: 'IELTS 8 Test4/P1', payload: loadFixture('cambridge-ielts-8/test4-passage1.json') },
        { label: 'IELTS 8 Test4/P2', payload: loadFixture('cambridge-ielts-8/test4-passage2.json') },
        { label: 'IELTS 8 Test4/P3', payload: loadFixture('cambridge-ielts-8/test4-passage3.json') },
        // BUG 8 — Register the 9 AI-authored 2026 IELTS Academic passages
        // (bookCode `ielts_authored_2026_v1`, 3 tests × 3 passages). These
        // fixtures live in apps/api/test-fixtures/ielts-authored-2026/ and
        // were pre-audited (10-check AI audit per pdf_ingest_rules.md).
        // Without this registration, a Railway redeploy / fresh DB ends up
        // missing them and the ielts_authentic bank shrinks back to the
        // Cambridge IELTS 8 set only. Idempotency comes for free — the
        // ingest service does findFirst on (bookCode, testNumber,
        // passageNumber, n) before insert, and approveBySourceRefPrefix
        // is a no-op when every row is already `status:active`.
        { label: 'IELTS Authored 2026 Test1/P1', payload: loadFixture('ielts-authored-2026/test1-passage1.json') },
        { label: 'IELTS Authored 2026 Test1/P2', payload: loadFixture('ielts-authored-2026/test1-passage2.json') },
        { label: 'IELTS Authored 2026 Test1/P3', payload: loadFixture('ielts-authored-2026/test1-passage3.json') },
        { label: 'IELTS Authored 2026 Test2/P1', payload: loadFixture('ielts-authored-2026/test2-passage1.json') },
        { label: 'IELTS Authored 2026 Test2/P2', payload: loadFixture('ielts-authored-2026/test2-passage2.json') },
        { label: 'IELTS Authored 2026 Test2/P3', payload: loadFixture('ielts-authored-2026/test2-passage3.json') },
        { label: 'IELTS Authored 2026 Test3/P1', payload: loadFixture('ielts-authored-2026/test3-passage1.json') },
        { label: 'IELTS Authored 2026 Test3/P2', payload: loadFixture('ielts-authored-2026/test3-passage2.json') },
        { label: 'IELTS Authored 2026 Test3/P3', payload: loadFixture('ielts-authored-2026/test3-passage3.json') },
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

      // R10 followup — switch OLEVEL bank from Cambridge IGCSE 0510
      // (English as a Second Language, wrong syllabus for our cohort)
      // to Singapore-Cambridge GCE O-Level 1128 / 1184 English Language
      // (actual exam they sit). The bank now has two tiers, both styled
      // as 1128/02 §B comprehension (narrative passage + short-answer +
      // 4-blank emotion flowchart MCQ):
      //
      //   STANDARD tier — provenanceTag 'singapore_olevel_1128' (OCR'd
      //   real prelim PDFs from Singapore secondary schools, ~600-800
      //   word passage, 9-11 SA + 3-4 MCQ) AND provenanceTag
      //   'ai_authored_olevel_1128' (Claude-authored original narratives
      //   at the same difficulty). Both serve the `olevel` band.
      //
      //   SIMPLIFIED tier — provenanceTag 'ai_authored_olevel_1128_simplified'
      //   (Claude-authored shorter narratives, ~350-500 word passage,
      //   6 SA + 4 MCQ, easier vocabulary). Serves the `ielts_simplified`
      //   middle band, which used to read IELTS GT but is now O-Level
      //   syllabus at a stretch-toward-O-Level difficulty.
      const olevelPapers: Array<{ label: string; payload: any }> = [
        // Real-PDF papers (Singapore secondary school prelims, OCR'd)
        { label: '1128 Admiralty 2021 SA2 §B narrative',     payload: loadFixture('singapore-olevel-1128/admiralty-2021-sa2.json') },
        { label: '1128 Bedok View 2021 SA2 §B narrative',    payload: loadFixture('singapore-olevel-1128/bedokview-2021-sa2.json') },
        // AI-authored standard tier (basic band) — 15 papers
        { label: 'AI 01 Smith Street (kueh shop closing)',   payload: loadFixture('singapore-olevel-1128/ai-authored-01-smith-street.json') },
        { label: 'AI 03 Empty Seat (reunion dinner)',        payload: loadFixture('singapore-olevel-1128/ai-authored-03-empty-seat.json') },
        { label: 'AI 04 Test Result (results day alone)',    payload: loadFixture('singapore-olevel-1128/ai-authored-04-test-result.json') },
        { label: 'AI 07 Last Lap (4x100m anchor leg)',       payload: loadFixture('singapore-olevel-1128/ai-authored-07-last-lap.json') },
        { label: 'AI 08 Window (moving day farewell)',       payload: loadFixture('singapore-olevel-1128/ai-authored-08-window-seat.json') },
        { label: 'AI 11 NDP Orchid (Ah Ma\'s 23rd plant)',   payload: loadFixture('singapore-olevel-1128/ai-authored-11-ndp-orchid.json') },
        { label: 'AI 12 Senior Sister (netball captaincy)',  payload: loadFixture('singapore-olevel-1128/ai-authored-12-senior-sister.json') },
        { label: 'AI 15 The Tutor (Mr Ng grieving)',         payload: loadFixture('singapore-olevel-1128/ai-authored-15-the-tutor.json') },
        { label: 'AI 16 Tekka Fish (Sunday for Ah Ma)',      payload: loadFixture('singapore-olevel-1128/ai-authored-16-tekka-fish.json') },
        { label: 'AI 19 Pulau Ubin (low-ropes course)',      payload: loadFixture('singapore-olevel-1128/ai-authored-19-pulau-ubin.json') },
        { label: 'AI 20 Unsent Letter (sealed 1989)',        payload: loadFixture('singapore-olevel-1128/ai-authored-20-unsent-letter.json') },
        { label: 'AI 23 Friday Soup (Wai Yan from Yangon)',  payload: loadFixture('singapore-olevel-1128/ai-authored-23-friday-soup.json') },
        { label: 'AI 24 MRT Photograph (vanished kampung)',  payload: loadFixture('singapore-olevel-1128/ai-authored-24-mrt-photograph.json') },
        // AI-authored simplified tier (middle band) — 13 papers
        { label: 'AI 02 Forgotten Promise (cat-sitting)',    payload: loadFixture('singapore-olevel-1128/ai-authored-02-forgotten-promise-simplified.json') },
        { label: 'AI 05 Lost Wallet (hawker centre)',        payload: loadFixture('singapore-olevel-1128/ai-authored-05-lost-wallet-simplified.json') },
        { label: 'AI 06 First Bus Ride (Sec 1 alone)',       payload: loadFixture('singapore-olevel-1128/ai-authored-06-bus-ride-simplified.json') },
        { label: 'AI 09 Birthday Cake (crash on bike)',      payload: loadFixture('singapore-olevel-1128/ai-authored-09-birthday-cake-simplified.json') },
        { label: 'AI 10 Umbrella (stranger in the rain)',    payload: loadFixture('singapore-olevel-1128/ai-authored-10-umbrella-simplified.json') },
        { label: 'AI 13 Spelling Bee (fastidious)',          payload: loadFixture('singapore-olevel-1128/ai-authored-13-spelling-bee-simplified.json') },
        { label: 'AI 14 Snowy (hamster escape)',             payload: loadFixture('singapore-olevel-1128/ai-authored-14-hamster-simplified.json') },
        { label: 'AI 17 Last Runner (relay reluctant)',      payload: loadFixture('singapore-olevel-1128/ai-authored-17-relay-simplified.json') },
        { label: 'AI 18 Library Card (Tampines interchange)',payload: loadFixture('singapore-olevel-1128/ai-authored-18-library-card-simplified.json') },
        { label: 'AI 21 Drawing on the Wall (wrong label)',  payload: loadFixture('singapore-olevel-1128/ai-authored-21-drawing-simplified.json') },
        { label: 'AI 22 MacRitchie Frog (let it go)',        payload: loadFixture('singapore-olevel-1128/ai-authored-22-macritchie-frog-simplified.json') },
        { label: 'AI 25 Auntie Lim Bee Hoon (moving away)',  payload: loadFixture('singapore-olevel-1128/ai-authored-25-hawker-auntie-simplified.json') },
        { label: 'AI 26 Phone on Bus 80 (kind driver)',      payload: loadFixture('singapore-olevel-1128/ai-authored-26-phone-bus80-simplified.json') },
      ];

      // Before ingesting the new 1128 fixtures, retire the legacy
      // Cambridge IGCSE 0510 questions so the morning-quiz picker
      // (filters by status='active') doesn't accidentally serve
      // them again. QuestionStatus enum is {draft, active, retired};
      // retired = inactive but kept for audit trail. Idempotent: if
      // there are zero active 0510 rows this is a no-op.
      try {
        const retired = await this.prisma.question.updateMany({
          where: { provenanceTag: 'cambridge_0510', status: 'active' },
          data: { status: 'retired' },
        });
        if (retired.count > 0) {
          this.logger.log(`retired ${retired.count} legacy 0510 question(s) — replaced by 1128 / 1184 content`);
        }
      } catch (e: any) {
        this.logger.warn(`could not retire legacy 0510 rows: ${e.message ?? e}`);
      }

      // R10 followup pilot — DELETE stale singapore_olevel_1128
      // rows whose sourceRef doesn't match the *current* fixture
      // version (we use setCode versioning, e.g. `_admiralty_2021_v2`,
      // so a content bump = a new prefix). This makes fixture edits
      // idempotently take effect on the next boot. Once the pilot is
      // stabilised we'll switch to upsert-by-sourceRef; for now the
      // ingest service still does findFirst+skip, hence the explicit
      // wipe step. Only active questions get deleted; if any have
      // been answered by students (FK to AnswerScript), the delete
      // throws and we fall through silently — the orphan rows will
      // be retired by a later admin pass.
      const CURRENT_OLEVEL_PREFIXES = [
        'OLEVEL/singapore_olevel_1128_admiralty_2021_v2/',
        'OLEVEL/singapore_olevel_1128_bedokview_2021_v2/',
      ];
      try {
        // Pull all olevel-1128 rows then filter by JS — Prisma doesn't
        // express "startsWith ANY of these prefixes" cleanly.
        const all = await this.prisma.question.findMany({
          where: { provenanceTag: 'singapore_olevel_1128' },
          select: { id: true, sourceRef: true },
        });
        const stale = all.filter(
          (q) => !CURRENT_OLEVEL_PREFIXES.some((p) => q.sourceRef?.startsWith(p)),
        );
        if (stale.length > 0) {
          // Best-effort delete; PaperQuestion FK + AnswerScript FK can block.
          // Wrap each in try/catch so one bad row doesn't kill the batch.
          let deleted = 0;
          for (const s of stale) {
            try {
              await this.prisma.question.delete({ where: { id: s.id } });
              deleted++;
            } catch { /* row referenced by a paper or scripted; leave it */ }
          }
          if (deleted > 0) {
            this.logger.log(`pruned ${deleted}/${stale.length} stale singapore_olevel_1128 row(s) from outdated fixture versions`);
          } else if (stale.length > 0) {
            this.logger.log(`${stale.length} stale singapore_olevel_1128 row(s) referenced by other tables — left in place (will be retired by next admin cleanup pass)`);
          }
        }
      } catch (e: any) {
        this.logger.warn(`could not prune stale singapore_olevel_1128 rows: ${e.message ?? e}`);
      }

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

  /**
   * Merge duplicate IELTS subject rows into the oldest one (canonical).
   * The picker uses `findFirst({code:'IELTS'}, orderBy:{createdAt asc})`
   * — match the same order so ingest writes to the canonical row.
   *
   * Migration steps for each non-canonical subject:
   *   1. For every component on it, upsert the same code on the
   *      canonical subject; remember the (old → new) component id map.
   *   2. UPDATE Question SET componentId = newComponentId WHERE
   *      componentId = oldComponentId AND subjectId = oldSubjectId.
   *   3. UPDATE Question SET subjectId = canonicalId WHERE
   *      subjectId = oldSubjectId.
   *   4. UPDATE Paper SET subjectId = canonicalId WHERE
   *      subjectId = oldSubjectId (and componentId likewise).
   *   5. Delete the now-empty old components, then the old subject.
   *
   * Skips silently if 0 or 1 IELTS subjects exist (the common case).
   */
  private async consolidateIeltsSubjects(): Promise<void> {
    const subjects = await this.prisma.subject.findMany({
      where: { code: 'IELTS' },
      orderBy: { id: 'asc' }, // cuid lexicographic ≈ creation order
      include: { components: true },
    });
    if (subjects.length <= 1) return;
    const [canonical, ...others] = subjects;
    this.logger.warn(
      `consolidating ${others.length} duplicate IELTS subject(s) into canonical=${canonical.id}`,
    );
    for (const other of others) {
      try {
        // 1. Upsert each component on canonical, build remap.
        const remap = new Map<string, string>();
        for (const oldComp of other.components) {
          const newComp = await this.prisma.syllabusComponent.upsert({
            where: { subjectId_code: { subjectId: canonical.id, code: oldComp.code } },
            create: { subjectId: canonical.id, code: oldComp.code, name: oldComp.name },
            update: {},
          });
          remap.set(oldComp.id, newComp.id);
        }
        // 2 & 3. Move questions. Have to iterate per-component because
        // Question.componentId points to a SyllabusComponent FK.
        for (const [oldCid, newCid] of remap) {
          await this.prisma.question.updateMany({
            where: { componentId: oldCid },
            data: { componentId: newCid },
          });
        }
        const movedQ = await this.prisma.question.updateMany({
          where: { subjectId: other.id },
          data: { subjectId: canonical.id },
        });
        // 4. Move papers similarly. Paper.componentId is nullable.
        for (const [oldCid, newCid] of remap) {
          await this.prisma.paper.updateMany({
            where: { componentId: oldCid },
            data: { componentId: newCid },
          });
        }
        const movedP = await this.prisma.paper.updateMany({
          where: { subjectId: other.id },
          data: { subjectId: canonical.id },
        });
        // 5. Drop now-empty components + the orphan subject. If anything
        // still references it (a SyllabusTopic, etc.) the FK throws —
        // we catch and leave the row in place rather than crashing.
        for (const oldCid of remap.keys()) {
          try {
            await this.prisma.syllabusComponent.delete({ where: { id: oldCid } });
          } catch (e: any) {
            this.logger.warn(`  could not drop component ${oldCid}: ${e.message?.slice(0, 100)}`);
          }
        }
        try {
          await this.prisma.subject.delete({ where: { id: other.id } });
        } catch (e: any) {
          this.logger.warn(`  could not drop subject ${other.id}: ${e.message?.slice(0, 100)}`);
        }
        this.logger.log(`  merged subject=${other.id}: ${movedQ.count} question(s), ${movedP.count} paper(s)`);
      } catch (e: any) {
        this.logger.warn(`  consolidation failed for ${other.id}: ${e.message?.slice(0, 200)}`);
      }
    }
  }
}
