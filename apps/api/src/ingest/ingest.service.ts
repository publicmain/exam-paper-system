import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ComplianceService } from '../compliance/compliance.service';
import { PdfDispatcherService, DispatchResult } from './pdf-dispatcher.service';
import { QuestionSplitterService, SplitResult } from './question-splitter.service';
import { MarkSchemeLinkerService } from './mark-scheme-linker.service';
import { ComplianceStatus, ProcessStatus, SyncStatus } from '@prisma/client';
import { parseFilename } from './filename-parser';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

export interface SyncResult {
  repoId: string;
  cloned: boolean;
  scanned: number;
  newFiles: number;
  duplicates: number;
  skippedByAllowlist: number;
  skippedByYear: number;
  errors: string[];
  dispatch?: DispatchResult;
  split?: { totalItems: number; files: number };
  msLink?: { matched: number; pairs: number };
}

const MAX_CLONE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB safety cap per sync
const RAW_STORE = process.env.RAW_STORAGE_PATH || path.join(os.tmpdir(), 'exam-raw-pdfs');

@Injectable()
export class IngestService {
  private readonly logger = new Logger('IngestService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly compliance: ComplianceService,
    private readonly dispatcher: PdfDispatcherService,
    private readonly splitter: QuestionSplitterService,
    private readonly msLinker: MarkSchemeLinkerService,
  ) {}

  /** Manually re-process all pending/failed files for a repo. */
  async processPending(repoId: string, actor: ActorCtx) {
    const dispatch = await this.dispatcher.processPendingForRepo(repoId, actor);
    const splits = await this.splitter.splitForRepo(repoId);
    const links = await this.msLinker.linkForRepo(repoId);
    return { dispatch, splits, links };
  }

  /**
   * Synchronise one source repository. The worker will refuse to clone any
   * repo that has not been explicitly approved by an admin; this is the
   * default-deny gate from §4 of the design doc.
   */
  async syncRepository(repoId: string, actor: ActorCtx): Promise<SyncResult> {
    const repo = await this.prisma.sourceRepository.findUnique({ where: { id: repoId } });
    if (!repo) throw new NotFoundException('Source repository not found');

    if (!this.compliance.canSyncRepo(repo.complianceStatus)) {
      throw new ForbiddenException(
        `Repo ${repo.id} is in compliance state '${repo.complianceStatus}'. ` +
          `Only approved_internal or restricted_internal repos may sync.`,
      );
    }

    if (repo.repoType === 'topic_page' || repo.repoType === 'downloader_script') {
      throw new BadRequestException(
        `Repo type '${repo.repoType}' is for discovery / tooling reference only and is never synced.`,
      );
    }

    await this.prisma.sourceRepository.update({
      where: { id: repoId },
      data: { syncStatus: SyncStatus.running, syncError: null },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'source.sync.start',
      entityType: 'source_repository',
      entityId: repoId,
      ip: actor.ip ?? null,
    });

    const result: SyncResult = {
      repoId,
      cloned: false,
      scanned: 0,
      newFiles: 0,
      duplicates: 0,
      skippedByAllowlist: 0,
      skippedByYear: 0,
      errors: [],
    };
    const allowlist = new Set<string>(repo.syllabusAllowlist ?? []);
    const yearAllowlist = new Set<number>(repo.yearAllowlist ?? []);

    let cloneDir: string | null = null;
    try {
      cloneDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eps-clone-'));
      await this.gitClone(repo.url, cloneDir);
      result.cloned = true;

      await fs.mkdir(RAW_STORE, { recursive: true });

      const pdfFiles = await this.walkForPdfs(cloneDir, allowlist);
      result.scanned = pdfFiles.length;

      let totalBytesIngested = 0;

      for (const absPath of pdfFiles) {
        try {
          const rawName = path.basename(absPath);
          const parsed = parseFilename(rawName);

          // Allowlist gate: when set, only keep PDFs whose parsed
          // syllabusCode is whitelisted. Unparseable filenames are dropped
          // since we cannot prove they are in scope.
          if (allowlist.size > 0) {
            if (!parsed.syllabusCode || !allowlist.has(parsed.syllabusCode)) {
              result.skippedByAllowlist++;
              continue;
            }
          }
          if (yearAllowlist.size > 0) {
            if (!parsed.examYear || !yearAllowlist.has(parsed.examYear)) {
              result.skippedByYear++;
              continue;
            }
          }

          const stat = await fs.stat(absPath);
          if (totalBytesIngested + stat.size > MAX_CLONE_BYTES) {
            result.errors.push(`Aborted at ${absPath}: 2GB cap reached.`);
            break;
          }

          const buf = await fs.readFile(absPath);
          const sha256 = createHash('sha256').update(buf).digest('hex');

          const existing = await this.prisma.sourceFile.findUnique({ where: { sha256 } });
          if (existing) {
            result.duplicates++;
            continue;
          }

          const dest = path.join(RAW_STORE, `${sha256}.pdf`);
          await fs.writeFile(dest, buf);

          await this.prisma.sourceFile.create({
            data: {
              repoId: repo.id,
              rawFilename: rawName,
              storagePath: dest,
              sha256,
              fileSizeBytes: stat.size,
              fileKind: parsed.fileKind,
              syllabusCode: parsed.syllabusCode,
              examYear: parsed.examYear,
              examSeason: parsed.examSeason,
              paperVariant: parsed.paperVariant,
              paperNumber: parsed.paperNumber,
              parsedFromName: parsed as any,
              processStatus: ProcessStatus.pending,
              // Inherit from repo. Admins can override per-file later.
              complianceStatus: repo.complianceStatus,
            },
          });
          totalBytesIngested += stat.size;
          result.newFiles++;
        } catch (e: any) {
          result.errors.push(`${absPath}: ${e.message ?? e}`);
        }
      }

      await this.prisma.sourceRepository.update({
        where: { id: repoId },
        data: {
          syncStatus: SyncStatus.ok,
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'source.sync.ok',
        entityType: 'source_repository',
        entityId: repoId,
        metadata: result,
        ip: actor.ip ?? null,
      });

      // Hand off newly-ingested files to the pdf-worker. We do this inline
      // so the operator who clicked "Sync now" gets one report covering
      // both clone and processing. Errors per-file do not abort the batch.
      try {
        result.dispatch = await this.dispatcher.processPendingForRepo(repoId, actor);
      } catch (dispatchErr: any) {
        this.logger.warn(`dispatch after sync failed: ${dispatchErr?.message ?? dispatchErr}`);
        result.errors.push(`dispatch: ${dispatchErr?.message ?? dispatchErr}`);
      }

      // Split processed PDFs into QuestionItems for the review queue.
      try {
        const splits = await this.splitter.splitForRepo(repoId);
        const totalItems = splits.reduce((s, x) => s + x.splits, 0);
        result.split = { files: splits.length, totalItems };
      } catch (splitErr: any) {
        this.logger.warn(`splitter after dispatch failed: ${splitErr?.message ?? splitErr}`);
        result.errors.push(`split: ${splitErr?.message ?? splitErr}`);
      }

      // Pair QPs with their MSs and attach per-question mark scheme rows.
      try {
        const links = await this.msLinker.linkForRepo(repoId);
        result.msLink = {
          pairs: links.filter((l) => l.msFileId).length,
          matched: links.reduce((s, x) => s + x.matched, 0),
        };
      } catch (linkErr: any) {
        this.logger.warn(`ms link after split failed: ${linkErr?.message ?? linkErr}`);
        result.errors.push(`mslink: ${linkErr?.message ?? linkErr}`);
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      await this.prisma.sourceRepository.update({
        where: { id: repoId },
        data: { syncStatus: SyncStatus.failed, syncError: msg },
      });
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'source.sync.fail',
        entityType: 'source_repository',
        entityId: repoId,
        metadata: { error: msg, partial: result },
        ip: actor.ip ?? null,
      });
      throw e;
    } finally {
      if (cloneDir) {
        try {
          await fs.rm(cloneDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          this.logger.warn(`Failed to clean clone dir ${cloneDir}: ${cleanupErr}`);
        }
      }
    }

    return result;
  }

  /**
   * Shallow clone via the git CLI. Streams stderr so very large repos
   * surface failures quickly. We deliberately avoid simple-git because
   * spawning the system git binary keeps the dependency footprint flat.
   */
  private async gitClone(url: string, dest: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('git', ['clone', '--depth', '1', '--single-branch', url, dest], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      child.on('error', (err) => reject(err));
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`git clone exited ${code}: ${stderr.slice(0, 500)}`));
      });
    });
  }

  /**
   * Walk for PDFs. When `allowlist` is non-empty, prune subdirectories whose
   * name does not contain an allowed syllabus code (e.g. for the
   * OpenPastPapers layout `A-Level-physics-9702/`). The root dir is always
   * descended; pruning happens one level deep where syllabus folders live.
   */
  private async walkForPdfs(dir: string, allowlist: Set<string>): Promise<string[]> {
    const out: string[] = [];
    const stack: { path: string; depth: number }[] = [{ path: dir, depth: 0 }];
    while (stack.length) {
      const { path: cur, depth } = stack.pop()!;
      let entries: fsSync.Dirent[];
      try {
        entries = await fs.readdir(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of entries) {
        if (ent.name === '.git' || ent.name === 'node_modules') continue;
        const full = path.join(cur, ent.name);
        if (ent.isDirectory()) {
          if (depth === 0 && allowlist.size > 0 && !this.dirNameContainsAllowedCode(ent.name, allowlist)) {
            continue;
          }
          stack.push({ path: full, depth: depth + 1 });
        } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.pdf')) {
          out.push(full);
        }
      }
    }
    return out;
  }

  private dirNameContainsAllowedCode(name: string, allowlist: Set<string>): boolean {
    const matches = name.match(/\d{4}/g) ?? [];
    return matches.some((code) => allowlist.has(code));
  }
}
