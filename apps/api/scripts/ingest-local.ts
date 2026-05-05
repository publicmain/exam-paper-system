/**
 * Bootstrap a Nest standalone context, register (or reuse) a school_upload
 * source repository for a given local folder, and run the ingest pipeline
 * on it. Designed for the teacher-side flow where past papers live on disk
 * rather than a git remote.
 *
 * Usage:
 *   npm run ingest:local -w @app/api -- \
 *     --path "C:/Users/yaoke/Projects/alevel-cs-papers/2024-s/9618_s24_qp_11.pdf" \
 *     --label "9618 Paper 1 (local)" \
 *     --syllabus 9618 \
 *     --show 2
 *
 *   --path     File or directory to ingest (required)
 *   --label    Friendly name; one repo per (label, path) is reused
 *   --syllabus 4-digit syllabus allowlist code (e.g. 9618)
 *   --year     Repeatable year allowlist; pass --year 2024 --year 2025
 *   --show N   After ingest, print the N most-recent QuestionItems
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { IngestService } from '../src/ingest/ingest.service';
import { UserRole } from '@prisma/client';

interface Args {
  path?: string;
  label?: string;
  syllabus?: string;
  years: number[];
  show: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { years: [], show: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--path') { out.path = next; i++; }
    else if (a === '--label') { out.label = next; i++; }
    else if (a === '--syllabus') { out.syllabus = next; i++; }
    else if (a === '--year') { out.years.push(parseInt(next, 10)); i++; }
    else if (a === '--show') { out.show = parseInt(next, 10) || 0; i++; }
  }
  if (!out.path) {
    console.error('Missing --path. See file header for usage.');
    process.exit(2);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Suppress Nest's startup banner so the CLI output reads cleanly.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const ingest = app.get(IngestService);

  // Pick an admin to act as. The seed creates admin@school.local; in a
  // production deploy a teacher with the right role would invoke this
  // path through the upcoming HTTP endpoint instead.
  const admin = await prisma.user.findFirst({ where: { role: UserRole.admin } });
  if (!admin) {
    console.error('No admin user found. Run `npm run db:seed` first.');
    await app.close();
    process.exit(1);
  }
  const actor = { id: admin.id, role: admin.role, ip: 'cli' };

  // file:// URI keeps SourceRepository.url valid (it's a CHECK-free string
  // column with @unique). The path is the source of truth; the URL is a
  // stable identifier so the same folder reuses the same repo on rerun.
  const normalisedPath = args.path!.replace(/\\/g, '/');
  const url = 'file:///' + normalisedPath.replace(/^\/+/, '');

  let repo = await prisma.sourceRepository.findUnique({ where: { url } });
  if (!repo) {
    repo = await prisma.sourceRepository.create({
      data: {
        url,
        repoType: 'school_upload',
        examBoardHint: args.syllabus ? 'CIE' : null,
        complianceStatus: 'approved_internal',
        allowedUsage: 'internal_classroom_only',
        retentionPolicy: 'keep_indefinite',
        notesForTeachers: args.label ?? `Local upload: ${normalisedPath}`,
        copyrightOwner: 'CIE (internal classroom use only)',
        syllabusAllowlist: args.syllabus ? [args.syllabus] : [],
        yearAllowlist: args.years,
        addedById: admin.id,
      },
    });
    console.log(`Created repo ${repo.id} for ${url}`);
  } else {
    console.log(`Reusing repo ${repo.id} for ${url}`);
    // Patch allowlists in case the operator passed new flags.
    if (args.syllabus || args.years.length) {
      repo = await prisma.sourceRepository.update({
        where: { id: repo.id },
        data: {
          syllabusAllowlist: args.syllabus ? [args.syllabus] : repo.syllabusAllowlist,
          yearAllowlist: args.years.length ? args.years : repo.yearAllowlist,
        },
      });
    }
  }

  console.log(`Ingesting ${normalisedPath} ...`);
  const t0 = Date.now();
  const result = await ingest.ingestFromLocalPath(repo.id, args.path!, actor);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n=== Ingest result (${elapsed}s) ===`);
  console.log(`  scanned:           ${result.scanned}`);
  console.log(`  newFiles:          ${result.newFiles}`);
  console.log(`  duplicates:        ${result.duplicates}`);
  console.log(`  skippedByAllowlist:${result.skippedByAllowlist}`);
  console.log(`  skippedByYear:     ${result.skippedByYear}`);
  if (result.dispatch) {
    console.log(`  dispatch:          processed=${(result.dispatch as any).processed ?? '?'}`);
  }
  if (result.split) {
    console.log(`  split:             files=${result.split.files} items=${result.split.totalItems}`);
  }
  if (result.msLink) {
    console.log(`  msLink:            pairs=${result.msLink.pairs} matched=${result.msLink.matched}`);
  }
  if (result.errors.length) {
    console.log(`  errors:`);
    for (const e of result.errors) console.log(`    - ${e}`);
  }

  if (args.show > 0) {
    const items = await prisma.questionItem.findMany({
      where: { sourceFile: { repoId: repo.id } },
      orderBy: { id: 'desc' },
      take: args.show,
      include: {
        sourceFile: true,
        parts: { orderBy: { sortOrder: 'asc' } },
        markSchemeItems: true,
        ingestedAssets: true,
        topicMap: { include: { topic: true } },
      },
    });
    console.log(`\n=== Sample QuestionItems (${items.length}) ===`);
    for (const it of items) {
      console.log('\n----------------------------------------');
      console.log(`id:            ${it.id}`);
      console.log(`source:        ${it.sourceFile?.rawFilename ?? '?'}`);
      console.log(`q.number:      ${it.questionNumber ?? '?'}`);
      console.log(`pages:         ${it.pageStart ?? '?'}-${it.pageEnd ?? '?'}`);
      console.log(`marks (sugg):  ${it.suggestedMarks ?? '?'}`);
      console.log(`topic (sugg):  ${it.suggestedTopicCode ?? '?'}`);
      console.log(`AI confidence: split=${it.confidenceSplit ?? '-'} marks=${it.confidenceMarks ?? '-'} ms=${it.confidenceMs ?? '-'} topic=${it.confidenceTopic ?? '-'}`);
      console.log(`crop image:    ${it.cropImageUrl ?? '(none)'}`);
      console.log(`text (head):   ${(it.rawExtractedText ?? '').slice(0, 280).replace(/\s+/g, ' ')}`);
      if (it.parts.length) {
        console.log(`parts:`);
        for (const p of it.parts) {
          console.log(`  (${p.partLabel}) [${p.marks}m] ${p.text.slice(0, 140).replace(/\s+/g, ' ')}`);
        }
      }
      if (it.markSchemeItems.length) {
        console.log(`mark scheme:`);
        for (const ms of it.markSchemeItems) {
          console.log(`  (${ms.partLabel ?? '-'}) [${ms.marks}m] ${ms.pointText.slice(0, 140).replace(/\s+/g, ' ')}`);
        }
      }
      if (it.topicMap.length) {
        console.log(`topic links:   ${it.topicMap.map(tl => `${tl.topic.code} (${tl.confidence.toFixed(2)})`).join(', ')}`);
      }
    }
  }

  await app.close();
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
