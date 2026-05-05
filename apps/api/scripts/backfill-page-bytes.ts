/**
 * Backfill PdfPage.imageBytes for rows that were ingested before the
 * column existed. Reads each row's matching PNG from RENDER_STORAGE_PATH
 * and writes the bytes into Postgres so the data survives a container
 * restart and can be replicated via pg_dump.
 *
 * Usage:
 *   npm run backfill:page-bytes -w @app/api
 *
 * Idempotent: skips rows that already have imageBytes set.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const RENDER_STORE = process.env.RENDER_STORAGE_PATH || path.join(os.tmpdir(), 'exam-rendered');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);

  console.log(`Backfilling from ${RENDER_STORE} ...`);
  const total = await prisma.pdfPage.count();
  const pending = await prisma.pdfPage.count({ where: { imageBytes: null } });
  console.log(`Pages: ${total} total, ${pending} need backfill`);

  let done = 0;
  let missingFile = 0;
  let bytesWritten = 0;
  const t0 = Date.now();

  // Process in batches to avoid loading every page row at once.
  const BATCH = 50;
  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.pdfPage.findMany({
      where: { imageBytes: null },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, sourceFileId: true, pageNo: true },
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const row of batch) {
      const fname = `page-${String(row.pageNo).padStart(4, '0')}.png`;
      const abs = path.join(RENDER_STORE, row.sourceFileId, fname);
      try {
        const buf = await fs.readFile(abs);
        await prisma.pdfPage.update({
          where: { id: row.id },
          data: { imageBytes: buf },
        });
        bytesWritten += buf.byteLength;
        done++;
      } catch (e: any) {
        if (e?.code === 'ENOENT') {
          missingFile++;
        } else {
          console.warn(`error on ${row.id} ${row.sourceFileId}/${fname}: ${e?.message ?? e}`);
        }
      }
    }
    if (done % 200 === 0) {
      const mb = (bytesWritten / 1024 / 1024).toFixed(1);
      const sec = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`  ${done}/${pending} done, ${mb} MB written, ${sec}s elapsed`);
    }
  }

  console.log(`\nDone: ${done} pages backfilled, ${missingFile} missing PNG files, ${(bytesWritten / 1024 / 1024).toFixed(1)} MB`);
  await app.close();
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
