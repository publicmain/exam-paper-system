/**
 * Copy the local 9618 past-paper archive (syllabus + ingested questions
 * + rendered page bytes) into a target Prisma-compatible database.
 *
 * Designed to bootstrap the production DB without touching its existing
 * users / question bank. Idempotent: re-runs upsert on every row.
 *
 * Usage:
 *   TARGET_DATABASE_URL='postgresql://user:pw@host:5432/dbname' \
 *     npm run migrate:9618 -w @app/api
 *
 * Required env on the local source side: DATABASE_URL pointing at the
 * source DB (the same one your local dev API uses).
 *
 * The script:
 *   1. Connects to the SOURCE DB via the default DATABASE_URL.
 *   2. Connects to the TARGET DB by overriding the datasource URL on a
 *      second PrismaClient instance.
 *   3. Ensures CIE / Subject 9618 / 4 components / all topics exist on
 *      target. Builds a topicCode -> targetTopicId remap.
 *   4. Ensures admin@school.local exists on target so SourceRepository
 *      has a valid addedById.
 *   5. Streams 9618 SourceRepository / SourceFile / PdfPage (with
 *      imageBytes) / QuestionItem / QuestionPart / MarkSchemeItem /
 *      IngestedAsset / QuestionItemTopic, batched, with FK rewriting.
 */

import 'reflect-metadata';
import { PrismaClient as SourceClient } from '@prisma/client';

const TARGET = process.env.TARGET_DATABASE_URL;
if (!TARGET) {
  console.error('TARGET_DATABASE_URL is required.');
  process.exit(2);
}

const src = new SourceClient();
const tgt = new SourceClient({
  datasources: { db: { url: TARGET! } },
});

const SYLLABUS = '9618';
const ADMIN_EMAIL = 'admin@school.local';

async function ensureTargetSyllabus(): Promise<{
  adminId: string;
  topicMap: Map<string, string>;
  componentMap: Map<string, string>;
  subjectId: string;
  examBoardId: string;
}> {
  // We replay the same topic tree the local seed produced, but resolve
  // every row by its stable code so target's existing IDs (if any) are
  // preserved instead of getting overwritten.
  const board = await tgt.examBoard.upsert({
    where: { code: 'CIE' },
    update: {},
    create: { code: 'CIE', name: 'Cambridge International' },
  });
  const subject = await tgt.subject.upsert({
    where: { examBoardId_code_level: { examBoardId: board.id, code: SYLLABUS, level: 'A_LEVEL' } },
    update: { name: 'Computer Science' },
    create: { examBoardId: board.id, code: SYLLABUS, name: 'Computer Science', level: 'A_LEVEL' },
  });

  const localBoard = await src.examBoard.findUnique({ where: { code: 'CIE' } });
  const localSubject = await src.subject.findFirst({
    where: { code: SYLLABUS, examBoardId: localBoard!.id },
    include: {
      components: {
        include: { topics: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { code: 'asc' },
      },
    },
  });
  if (!localSubject) throw new Error('local 9618 subject not found — did you seed locally?');

  const componentMap = new Map<string, string>();
  const topicMap = new Map<string, string>();
  for (const comp of localSubject.components) {
    const tComp = await tgt.syllabusComponent.upsert({
      where: { subjectId_code: { subjectId: subject.id, code: comp.code } },
      update: { name: comp.name },
      create: { subjectId: subject.id, code: comp.code, name: comp.name },
    });
    componentMap.set(comp.code, tComp.id);
    // Two passes: parents first so children's parentTopicId is resolvable.
    const parents = comp.topics.filter((t) => !t.parentTopicId);
    for (const t of parents) {
      const tt = await tgt.topic.upsert({
        where: { componentId_code: { componentId: tComp.id, code: t.code } },
        update: { name: t.name, sortOrder: t.sortOrder },
        create: { componentId: tComp.id, code: t.code, name: t.name, sortOrder: t.sortOrder },
      });
      topicMap.set(t.code, tt.id);
    }
    const children = comp.topics.filter((t) => t.parentTopicId);
    for (const t of children) {
      const localParent = comp.topics.find((p) => p.id === t.parentTopicId);
      const targetParentId = localParent ? topicMap.get(localParent.code) : null;
      const tt = await tgt.topic.upsert({
        where: { componentId_code: { componentId: tComp.id, code: t.code } },
        update: { name: t.name, sortOrder: t.sortOrder, parentTopicId: targetParentId ?? null },
        create: {
          componentId: tComp.id,
          code: t.code,
          name: t.name,
          sortOrder: t.sortOrder,
          parentTopicId: targetParentId ?? null,
        },
      });
      topicMap.set(t.code, tt.id);
    }
  }

  // Admin user — keep target's existing one if present, otherwise create.
  let admin = await tgt.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    // Local admin's password hash is reused so existing demo creds work.
    const localAdmin = await src.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!localAdmin) throw new Error('local admin not seeded');
    admin = await tgt.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: 'Admin',
        role: 'admin',
        passwordHash: localAdmin.passwordHash,
      },
    });
  }

  return { adminId: admin.id, topicMap, componentMap, subjectId: subject.id, examBoardId: board.id };
}

async function migrateRepoAndFiles(adminId: string): Promise<{ repoIdMap: Map<string, string> }> {
  // Find the local 9618 repo(s). There may be more than one (the smoke
  // test created its own); we replay all of them so the source-file
  // dedup keys remain stable.
  const localRepos = await src.sourceRepository.findMany({
    where: {
      files: { some: { syllabusCode: SYLLABUS } },
    },
  });

  const repoIdMap = new Map<string, string>();
  for (const r of localRepos) {
    const tRepo = await tgt.sourceRepository.upsert({
      where: { url: r.url },
      update: {
        complianceStatus: r.complianceStatus,
        allowedUsage: r.allowedUsage,
        retentionPolicy: r.retentionPolicy,
        syllabusAllowlist: r.syllabusAllowlist,
        yearAllowlist: r.yearAllowlist,
        notesForTeachers: r.notesForTeachers,
        copyrightOwner: r.copyrightOwner,
        examBoardHint: r.examBoardHint,
      },
      create: {
        url: r.url,
        repoType: r.repoType,
        examBoardHint: r.examBoardHint,
        complianceStatus: r.complianceStatus,
        allowedUsage: r.allowedUsage,
        retentionPolicy: r.retentionPolicy,
        syllabusAllowlist: r.syllabusAllowlist,
        yearAllowlist: r.yearAllowlist,
        notesForTeachers: r.notesForTeachers,
        copyrightOwner: r.copyrightOwner,
        addedById: adminId,
      },
    });
    repoIdMap.set(r.id, tRepo.id);
  }
  return { repoIdMap };
}

async function migrateSourceFiles(repoIdMap: Map<string, string>): Promise<Map<string, string>> {
  const files = await src.sourceFile.findMany({
    where: { syllabusCode: SYLLABUS },
    orderBy: { id: 'asc' },
  });
  const fileIdMap = new Map<string, string>();
  let i = 0;
  for (const f of files) {
    const targetRepoId = repoIdMap.get(f.repoId);
    if (!targetRepoId) {
      console.warn(`SourceFile ${f.id} has unmapped repoId ${f.repoId}, skipping`);
      continue;
    }
    // Match by sha256 (the unique content hash) to dedupe across runs.
    const existing = await tgt.sourceFile.findUnique({ where: { sha256: f.sha256 } });
    if (existing) {
      fileIdMap.set(f.id, existing.id);
    } else {
      const tFile = await tgt.sourceFile.create({
        data: {
          repoId: targetRepoId,
          rawFilename: f.rawFilename,
          storagePath: f.storagePath,
          sha256: f.sha256,
          fileSizeBytes: f.fileSizeBytes,
          fileKind: f.fileKind,
          syllabusCode: f.syllabusCode,
          examYear: f.examYear,
          examSeason: f.examSeason,
          paperVariant: f.paperVariant,
          paperNumber: f.paperNumber,
          parsedFromName: f.parsedFromName as any,
          processStatus: f.processStatus,
          processError: f.processError,
          complianceStatus: f.complianceStatus,
        },
      });
      fileIdMap.set(f.id, tFile.id);
    }
    if (++i % 50 === 0) console.log(`  source files: ${i}/${files.length}`);
  }
  console.log(`  source files done: ${i}/${files.length}`);
  return fileIdMap;
}

async function migratePdfPages(fileIdMap: Map<string, string>) {
  const total = await src.pdfPage.count({
    where: { sourceFile: { syllabusCode: SYLLABUS } },
  });
  console.log(`  pdf pages to migrate: ${total}`);

  // Batch by sourceFile to keep memory reasonable when imageBytes is set.
  const localFiles = [...fileIdMap.keys()];
  let done = 0;
  for (const localFileId of localFiles) {
    const targetFileId = fileIdMap.get(localFileId)!;
    const pages = await src.pdfPage.findMany({
      where: { sourceFileId: localFileId },
      orderBy: { pageNo: 'asc' },
    });
    for (const p of pages) {
      await tgt.pdfPage.upsert({
        where: { sourceFileId_pageNo: { sourceFileId: targetFileId, pageNo: p.pageNo } },
        update: {
          rawText: p.rawText,
          imageUrl: p.imageUrl,
          imageBytes: p.imageBytes,
          ocrUsed: p.ocrUsed,
          ocrConfidence: p.ocrConfidence,
          layoutJson: p.layoutJson as any,
        },
        create: {
          sourceFileId: targetFileId,
          pageNo: p.pageNo,
          rawText: p.rawText,
          imageUrl: p.imageUrl,
          imageBytes: p.imageBytes,
          ocrUsed: p.ocrUsed,
          ocrConfidence: p.ocrConfidence,
          layoutJson: p.layoutJson as any,
        },
      });
      done++;
    }
    if (done % 100 < pages.length) {
      console.log(`  pdf pages: ${done}/${total}`);
    }
  }
  console.log(`  pdf pages done: ${done}/${total}`);
}

async function migrateQuestions(fileIdMap: Map<string, string>, topicMap: Map<string, string>) {
  const localItems = await src.questionItem.findMany({
    where: { sourceFile: { syllabusCode: SYLLABUS } },
    include: {
      parts: { orderBy: { sortOrder: 'asc' } },
      markSchemeItems: { orderBy: { sortOrder: 'asc' } },
      ingestedAssets: { orderBy: { sortOrder: 'asc' } },
      topicMap: true,
    },
  });
  console.log(`  question items: ${localItems.length}`);
  let i = 0;
  for (const it of localItems) {
    const targetFileId = it.sourceFileId ? fileIdMap.get(it.sourceFileId) : null;
    if (it.sourceFileId && !targetFileId) {
      console.warn(`item ${it.id} -> unmapped sourceFile, skipping`);
      continue;
    }
    // Dedup on (sourceFileId, questionNumber) only — pageStart/pageEnd
    // are *outputs* of the splitter and can shift across re-runs (e.g.
    // when bbox-aware page detection corrects the text-based guess).
    // Matching only by question number lets the upsert update those
    // fields in place instead of inserting a duplicate row.
    const existing = await tgt.questionItem.findFirst({
      where: {
        sourceFileId: targetFileId ?? null,
        questionNumber: it.questionNumber,
      },
    });
    let targetItemId: string;
    if (existing) {
      targetItemId = existing.id;
      await tgt.questionItem.update({
        where: { id: targetItemId },
        data: {
          rawExtractedText: it.rawExtractedText,
          extractedLatex: it.extractedLatex,
          // Page range may have been corrected by the bbox-aware splitter;
          // copy it across so the UI's "pages X-Y" label matches the
          // crop boxes we're about to push.
          pageStart: it.pageStart,
          pageEnd: it.pageEnd,
          cropBboxJson: it.cropBboxJson as any,
          cropImageUrl: it.cropImageUrl,
          suggestedSubjectCode: it.suggestedSubjectCode,
          suggestedTopicCode: it.suggestedTopicCode,
          suggestedType: it.suggestedType,
          suggestedMarks: it.suggestedMarks,
          suggestedDifficulty: it.suggestedDifficulty,
          suggestedMetadata: it.suggestedMetadata as any,
          confidenceSplit: it.confidenceSplit,
          confidenceMarks: it.confidenceMarks,
          confidenceMs: it.confidenceMs,
          confidenceTopic: it.confidenceTopic,
          reviewStatus: it.reviewStatus,
          complianceStatus: it.complianceStatus,
        },
      });
      // Drop child rows so we recreate from local — simpler than diffing.
      await tgt.questionPart.deleteMany({ where: { questionItemId: targetItemId } });
      await tgt.markSchemeItem.deleteMany({ where: { questionItemId: targetItemId } });
      await tgt.ingestedAsset.deleteMany({ where: { questionItemId: targetItemId } });
      await tgt.questionItemTopic.deleteMany({ where: { questionItemId: targetItemId } });
    } else {
      const created = await tgt.questionItem.create({
        data: {
          source: it.source,
          sourceFileId: targetFileId,
          rawExtractedText: it.rawExtractedText,
          extractedLatex: it.extractedLatex,
          questionNumber: it.questionNumber,
          pageStart: it.pageStart,
          pageEnd: it.pageEnd,
          cropBboxJson: it.cropBboxJson as any,
          cropImageUrl: it.cropImageUrl,
          suggestedSubjectCode: it.suggestedSubjectCode,
          suggestedTopicCode: it.suggestedTopicCode,
          suggestedType: it.suggestedType,
          suggestedMarks: it.suggestedMarks,
          suggestedDifficulty: it.suggestedDifficulty,
          suggestedMetadata: it.suggestedMetadata as any,
          confidenceSplit: it.confidenceSplit,
          confidenceMarks: it.confidenceMarks,
          confidenceMs: it.confidenceMs,
          confidenceTopic: it.confidenceTopic,
          reviewStatus: it.reviewStatus,
          complianceStatus: it.complianceStatus,
        },
      });
      targetItemId = created.id;
    }

    // Recreate child rows.
    if (it.parts.length) {
      // Two-pass for parent/child relationships within parts.
      const partIdMap = new Map<string, string>();
      const parents = it.parts.filter((p) => !p.parentPartId);
      for (const p of parents) {
        const created = await tgt.questionPart.create({
          data: {
            questionItemId: targetItemId,
            partLabel: p.partLabel,
            marks: p.marks,
            text: p.text,
            latexText: p.latexText,
            cropBboxJson: p.cropBboxJson as any,
            cropImageUrl: p.cropImageUrl,
            sortOrder: p.sortOrder,
          },
        });
        partIdMap.set(p.id, created.id);
      }
      const children = it.parts.filter((p) => p.parentPartId);
      for (const p of children) {
        await tgt.questionPart.create({
          data: {
            questionItemId: targetItemId,
            parentPartId: partIdMap.get(p.parentPartId!) ?? null,
            partLabel: p.partLabel,
            marks: p.marks,
            text: p.text,
            latexText: p.latexText,
            cropBboxJson: p.cropBboxJson as any,
            cropImageUrl: p.cropImageUrl,
            sortOrder: p.sortOrder,
          },
        });
      }
    }
    if (it.markSchemeItems.length) {
      await tgt.markSchemeItem.createMany({
        data: it.markSchemeItems.map((ms) => ({
          questionItemId: targetItemId,
          partLabel: ms.partLabel,
          pointText: ms.pointText,
          marks: ms.marks,
          sortOrder: ms.sortOrder,
        })),
      });
    }
    if (it.ingestedAssets.length) {
      await tgt.ingestedAsset.createMany({
        data: it.ingestedAssets.map((a) => ({
          questionItemId: targetItemId,
          kind: a.kind,
          imageUrl: a.imageUrl,
          pageNo: a.pageNo,
          bboxJson: a.bboxJson as any,
          altText: a.altText,
          ocrText: a.ocrText,
          sortOrder: a.sortOrder,
        })),
      });
    }
    if (it.topicMap.length) {
      for (const tl of it.topicMap) {
        const localTopic = await src.topic.findUnique({ where: { id: tl.topicId } });
        const targetTopicId = localTopic ? topicMap.get(localTopic.code) : null;
        if (!targetTopicId) continue;
        await tgt.questionItemTopic.create({
          data: {
            questionItemId: targetItemId,
            topicId: targetTopicId,
            confidence: tl.confidence,
            taggedBy: tl.taggedBy,
          },
        });
      }
    }
    if (++i % 50 === 0) console.log(`  question items: ${i}/${localItems.length}`);
  }
  console.log(`  question items done: ${i}/${localItems.length}`);
}

async function main() {
  const t0 = Date.now();
  console.log('Connecting to source + target ...');
  await Promise.all([src.$connect(), tgt.$connect()]);

  console.log('Step 1: ensure syllabus on target');
  const { adminId, topicMap, componentMap, subjectId, examBoardId } = await ensureTargetSyllabus();
  console.log(`  topicMap size=${topicMap.size}, componentMap=${componentMap.size}, admin=${adminId}`);

  console.log('Step 2: migrate source repository / files');
  const { repoIdMap } = await migrateRepoAndFiles(adminId);
  const fileIdMap = await migrateSourceFiles(repoIdMap);

  if (process.env.SKIP_PAGES === '1') {
    console.log('Step 3: SKIPPED pdf-page migration (SKIP_PAGES=1) — assumes prod already has the rendered images and layoutJson');
  } else {
    console.log('Step 3: migrate pdf pages (with imageBytes)');
    await migratePdfPages(fileIdMap);
  }

  console.log('Step 4: migrate question items + parts + mark scheme + topics');
  await migrateQuestions(fileIdMap, topicMap);

  await Promise.all([src.$disconnect(), tgt.$disconnect()]);
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nMigration complete in ${sec}s`);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
