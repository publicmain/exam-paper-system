import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ComplianceStatus, RepoType, AllowedUsage } from '@prisma/client';
import { CreateSourceRepoDto, UpdateComplianceDto } from './dto';

@Injectable()
export class SourcesService {
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
}
