import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FileKind, ProcessStatus, SourceFile } from '@prisma/client';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

interface PageOut {
  page_no: number;
  text: string;
  char_count: number;
  used_ocr: boolean;
  image_b64: string;
  image_mime?: string;
}

interface ProcessPdfResponse {
  source_file_id: string;
  page_count: number;
  pages: PageOut[];
  sha256: string;
}

const RENDER_STORE = process.env.RENDER_STORAGE_PATH || path.join(os.tmpdir(), 'exam-rendered');
const PDF_WORKER_URL = process.env.PDF_WORKER_URL || '';
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || '';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';

// File kinds we hand to the worker. Inserts / syllabus docs / examiner
// reports do not produce question_items so we save the round-trip.
const PROCESSABLE_KINDS: FileKind[] = [FileKind.question_paper, FileKind.mark_scheme];

export interface DispatchResult {
  attempted: number;
  succeeded: number;
  failed: number;
  skippedKind: number;
  errors: { sourceFileId: string; error: string }[];
}

@Injectable()
export class PdfDispatcherService {
  private readonly logger = new Logger('PdfDispatcher');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Process all pending SourceFile rows for a repo. Synchronous: each
   * worker call blocks until the worker returns the rendered pages, then
   * we persist them. Errors are recorded per file but do not abort the
   * batch — we want one bad PDF to not poison the queue.
   */
  async processPendingForRepo(repoId: string, actor: ActorCtx): Promise<DispatchResult> {
    const pending = await this.prisma.sourceFile.findMany({
      where: { repoId, processStatus: ProcessStatus.pending },
      orderBy: { ingestedAt: 'asc' },
    });
    return this.processFiles(pending, actor);
  }

  async processFiles(files: SourceFile[], actor: ActorCtx): Promise<DispatchResult> {
    const result: DispatchResult = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skippedKind: 0,
      errors: [],
    };

    if (!PDF_WORKER_URL) {
      this.logger.warn('PDF_WORKER_URL not set — skipping dispatch');
      return result;
    }
    if (!INTERNAL_API_TOKEN) {
      this.logger.warn('INTERNAL_API_TOKEN not set — skipping dispatch');
      return result;
    }
    if (!PUBLIC_API_URL) {
      this.logger.warn('PUBLIC_API_URL not set — pdf-worker would not know how to fetch');
      return result;
    }

    for (const f of files) {
      if (!PROCESSABLE_KINDS.includes(f.fileKind)) {
        result.skippedKind++;
        await this.prisma.sourceFile.update({
          where: { id: f.id },
          data: { processStatus: ProcessStatus.skipped },
        });
        continue;
      }
      result.attempted++;
      try {
        await this.prisma.sourceFile.update({
          where: { id: f.id },
          data: { processStatus: ProcessStatus.processing, processError: null },
        });
        const fetchUrl = `${PUBLIC_API_URL.replace(/\/$/, '')}/api/internal/pdf-bytes/${f.sha256}`;
        const resp = await this.callWorker({
          source_file_id: f.id,
          fetch_url: fetchUrl,
          expected_sha256: f.sha256,
        });
        await this.persistResult(f, resp);
        await this.prisma.sourceFile.update({
          where: { id: f.id },
          data: { processStatus: ProcessStatus.processed, processError: null },
        });
        result.succeeded++;
      } catch (e: any) {
        const msg = String(e?.message ?? e).slice(0, 1000);
        this.logger.warn(`process failed for ${f.id}: ${msg}`);
        await this.prisma.sourceFile.update({
          where: { id: f.id },
          data: { processStatus: ProcessStatus.failed, processError: msg },
        });
        result.failed++;
        result.errors.push({ sourceFileId: f.id, error: msg });
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'pdf.dispatch.batch',
      entityType: 'source_file',
      entityId: 'batch',
      metadata: result as any,
      ip: actor.ip ?? null,
    });

    return result;
  }

  private async callWorker(body: {
    source_file_id: string;
    fetch_url: string;
    expected_sha256: string;
  }): Promise<ProcessPdfResponse> {
    const url = `${PDF_WORKER_URL.replace(/\/$/, '')}/process_pdf`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`pdf-worker ${r.status}: ${text.slice(0, 500)}`);
    }
    return (await r.json()) as ProcessPdfResponse;
  }

  private async persistResult(f: SourceFile, resp: ProcessPdfResponse): Promise<void> {
    const dir = path.join(RENDER_STORE, f.id);
    await fs.mkdir(dir, { recursive: true });

    // Replace any prior pages for this file (idempotent re-process).
    await this.prisma.pdfPage.deleteMany({ where: { sourceFileId: f.id } });

    for (const p of resp.pages) {
      const buf = Buffer.from(p.image_b64, 'base64');
      const fname = `page-${String(p.page_no).padStart(4, '0')}.png`;
      const abs = path.join(dir, fname);
      await fs.writeFile(abs, buf);

      // imageUrl is a relative API route; the UI hits the API which
      // streams from disk. Using a path keeps it portable across hosts.
      const imageUrl = `/api/source-files/${f.id}/pages/${p.page_no}.png`;

      await this.prisma.pdfPage.create({
        data: {
          sourceFileId: f.id,
          pageNo: p.page_no,
          rawText: p.text,
          imageUrl,
          ocrUsed: p.used_ocr,
        },
      });
    }
  }
}
