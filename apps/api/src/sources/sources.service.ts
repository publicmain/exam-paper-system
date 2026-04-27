import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ComplianceStatus, RepoType, AllowedUsage } from '@prisma/client';
import { CreateSourceRepoDto, UpdateComplianceDto } from './dto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const RENDER_STORE = process.env.RENDER_STORAGE_PATH || path.join(os.tmpdir(), 'exam-rendered');

@Injectable()
export class SourcesService {
  private readonly logger = new Logger('SourcesService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.sourceRepository.findMany({
      orderBy: { addedAt: 'desc' },
      include: {
        addedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { files: true } },
      },
    });
  }

  async get(id: string) {
    const repo = await this.prisma.sourceRepository.findUnique({
      where: { id },
      include: {
        addedBy: { select: { id: true, name: true, email: true } },
        files: {
          orderBy: { ingestedAt: 'desc' },
          take: 50,
        },
        _count: { select: { files: true } },
      },
    });
    if (!repo) throw new NotFoundException('Source repository not found');
    return repo;
  }

  async create(dto: CreateSourceRepoDto, actor: { id: string; role: string; ip?: string | null }) {
    if (!/^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+/.test(dto.url) && dto.repoType !== 'school_upload' && dto.repoType !== 'ai_generator' && dto.repoType !== 'official') {
      throw new BadRequestException('Only GitHub URLs are accepted for code-hosted repositories.');
    }

    try {
      const repo = await this.prisma.sourceRepository.create({
        data: {
          url: dto.url,
          repoType: dto.repoType as RepoType,
          examBoardHint: dto.examBoardHint,
          copyrightOwner: dto.copyrightOwner,
          notesForTeachers: dto.notesForTeachers,
          syllabusAllowlist: dto.syllabusAllowlist ?? [],
          yearAllowlist: dto.yearAllowlist ?? [],
          addedById: actor.id,
          // Default-deny: every new source starts pending until an admin
          // upgrades it. The sync worker refuses to clone pending repos.
          complianceStatus: ComplianceStatus.pending_review,
          allowedUsage: AllowedUsage.none,
        },
      });
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'source.create',
        entityType: 'source_repository',
        entityId: repo.id,
        metadata: { url: dto.url, repoType: dto.repoType },
        ip: actor.ip ?? null,
      });
      return repo;
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Repository URL already registered.');
      throw e;
    }
  }

  async updateCompliance(
    id: string,
    dto: UpdateComplianceDto,
    actor: { id: string; role: string; ip?: string | null },
  ) {
    const existing = await this.prisma.sourceRepository.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Source repository not found');

    const updated = await this.prisma.sourceRepository.update({
      where: { id },
      data: {
        complianceStatus: dto.complianceStatus,
        allowedUsage: dto.allowedUsage ?? existing.allowedUsage,
        retentionPolicy: dto.retentionPolicy ?? existing.retentionPolicy,
        copyrightOwner: dto.copyrightOwner ?? existing.copyrightOwner,
        notesForTeachers: dto.notesForTeachers ?? existing.notesForTeachers,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'source.compliance.update',
      entityType: 'source_repository',
      entityId: id,
      diff: {
        before: {
          complianceStatus: existing.complianceStatus,
          allowedUsage: existing.allowedUsage,
        },
        after: {
          complianceStatus: updated.complianceStatus,
          allowedUsage: updated.allowedUsage,
        },
      },
      metadata: { reason: dto.reason ?? null },
      ip: actor.ip ?? null,
    });

    return updated;
  }

  /**
   * Block flow: §4 of design doc — cascade compliance, soft-delete files,
   * leave already-published papers archived (no re-use), keep audit trail.
   */
  async block(id: string, reason: string, actor: { id: string; role: string; ip?: string | null }) {
    const existing = await this.prisma.sourceRepository.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Source repository not found');

    const result = await this.prisma.$transaction(async (tx) => {
      const repo = await tx.sourceRepository.update({
        where: { id },
        data: {
          complianceStatus: ComplianceStatus.blocked,
          blockedReason: reason,
          blockedAt: new Date(),
        },
      });

      // Cascade to all files of this repo.
      const filesUpdate = await tx.sourceFile.updateMany({
        where: { repoId: id },
        data: { complianceStatus: ComplianceStatus.blocked },
      });

      // Cascade to derived question_items.
      const itemsUpdate = await tx.questionItem.updateMany({
        where: { sourceFile: { repoId: id } },
        data: { complianceStatus: ComplianceStatus.blocked },
      });

      // Mirror to mirrored Question rows so generation can no longer pick them.
      const questionsUpdate = await tx.question.updateMany({
        where: { ingestedItem: { sourceFile: { repoId: id } } },
        data: { complianceStatus: ComplianceStatus.blocked },
      });

      return { repo, filesAffected: filesUpdate.count, itemsAffected: itemsUpdate.count, questionsAffected: questionsUpdate.count };
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'source.block',
      entityType: 'source_repository',
      entityId: id,
      metadata: {
        reason,
        filesAffected: result.filesAffected,
        itemsAffected: result.itemsAffected,
        questionsAffected: result.questionsAffected,
      },
      ip: actor.ip ?? null,
    });

    return result;
  }

  /**
   * Hard-delete a SourceRepository and all derived data: SourceFile,
   * PdfPage, un-approved QuestionItem rows, and the on-disk raw + rendered
   * files. Refuses by default if any QuestionItem has been mirrored into
   * a Question (those are the "approved past papers in the bank") — pass
   * force=true to also drop those QuestionItems (the mirrored Question
   * rows themselves stay; they just lose their ingest provenance link).
   */
  async delete(id: string, force: boolean, actor: { id: string; role: string; ip?: string | null }) {
    const repo = await this.prisma.sourceRepository.findUnique({ where: { id } });
    if (!repo) throw new NotFoundException('source repository not found');

    const files = await this.prisma.sourceFile.findMany({
      where: { repoId: id },
      select: { id: true, storagePath: true, sha256: true },
    });
    const fileIds = files.map((f) => f.id);

    const approvedItemCount = await this.prisma.questionItem.count({
      where: { sourceFileId: { in: fileIds }, questionId: { not: null } },
    });
    if (approvedItemCount > 0 && !force) {
      throw new BadRequestException(
        `Refusing to delete: ${approvedItemCount} QuestionItem(s) have been mirrored to live Questions. ` +
          `Pass force=true to override (the mirrored Question rows in the bank will remain).`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // QuestionItem.sourceFile uses SetNull on delete (nullable FK); to
      // actually purge the items we delete them explicitly here.
      const items = await tx.questionItem.deleteMany({
        where: { sourceFileId: { in: fileIds } },
      });
      // SourceRepository → SourceFile cascades; SourceFile → PdfPage cascades.
      const repoDel = await tx.sourceRepository.delete({ where: { id } });
      return { repo: repoDel, fileCount: files.length, itemsDeleted: items.count };
    });

    // Best-effort disk cleanup. Failures here do not roll back the DB delete —
    // an orphaned PNG or PDF on disk is harmless and the next sync overwrites.
    let diskFilesDeleted = 0;
    let diskDirsDeleted = 0;
    for (const f of files) {
      try {
        await fs.unlink(f.storagePath);
        diskFilesDeleted++;
      } catch {
        /* ignore — file may already be gone */
      }
      try {
        await fs.rm(path.join(RENDER_STORE, f.id), { recursive: true, force: true });
        diskDirsDeleted++;
      } catch {
        /* ignore */
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'source.delete',
      entityType: 'source_repository',
      entityId: id,
      metadata: {
        url: repo.url,
        force,
        approvedItemsDropped: approvedItemCount,
        filesDeleted: result.fileCount,
        itemsDeleted: result.itemsDeleted,
        diskFilesDeleted,
        diskDirsDeleted,
      },
      ip: actor.ip ?? null,
    });

    return {
      ok: true,
      filesDeleted: result.fileCount,
      itemsDeleted: result.itemsDeleted,
      approvedItemsDropped: approvedItemCount,
      diskFilesDeleted,
      diskDirsDeleted,
    };
  }
}
