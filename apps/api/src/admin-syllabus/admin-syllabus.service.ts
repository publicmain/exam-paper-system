import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateExamBoardDto,
  CreateSubjectDto,
  CreateComponentDto,
  CreateTopicDto,
  UpdateTopicDto,
  ImportSyllabusDto,
  TopicNode,
} from './dto';

interface Actor {
  id: string;
  role: string;
  ip: string | null;
}

// Prisma error codes we translate into HTTP errors. Kept loose-typed so the
// service compiles without pulling in @prisma/client error namespace.
function isPrismaUnique(e: any): boolean {
  return e && typeof e === 'object' && e.code === 'P2002';
}
function isPrismaFkConstraint(e: any): boolean {
  return e && typeof e === 'object' && (e.code === 'P2003' || e.code === 'P2014');
}
function isPrismaNotFound(e: any): boolean {
  return e && typeof e === 'object' && e.code === 'P2025';
}

@Injectable()
export class AdminSyllabusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Exam Boards ----------
  async createExamBoard(dto: CreateExamBoardDto, actor: Actor) {
    try {
      const board = await this.prisma.examBoard.create({
        data: { code: dto.code, name: dto.name },
      });
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'admin_syllabus.exam_board.create',
        entityType: 'ExamBoard',
        entityId: board.id,
        diff: { code: board.code, name: board.name },
        ip: actor.ip,
      });
      return board;
    } catch (e) {
      if (isPrismaUnique(e)) {
        throw new ConflictException(`exam board with code "${dto.code}" already exists`);
      }
      throw e;
    }
  }

  // ---------- Subjects ----------
  async createSubject(dto: CreateSubjectDto, actor: Actor) {
    const board = await this.prisma.examBoard.findUnique({ where: { id: dto.examBoardId } });
    if (!board) throw new NotFoundException('examBoardId not found');
    try {
      const subject = await this.prisma.subject.create({
        data: {
          examBoardId: dto.examBoardId,
          code: dto.code,
          name: dto.name,
          level: dto.level,
        },
      });
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'admin_syllabus.subject.create',
        entityType: 'Subject',
        entityId: subject.id,
        diff: dto,
        ip: actor.ip,
      });
      return subject;
    } catch (e) {
      if (isPrismaUnique(e)) {
        throw new ConflictException(
          `subject ${dto.code} (${dto.level}) already exists for this board`,
        );
      }
      throw e;
    }
  }

  // ---------- Components ----------
  async createComponent(dto: CreateComponentDto, actor: Actor) {
    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) throw new NotFoundException('subjectId not found');
    try {
      const component = await this.prisma.syllabusComponent.create({
        data: {
          subjectId: dto.subjectId,
          code: dto.code,
          name: dto.name,
        },
      });
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'admin_syllabus.component.create',
        entityType: 'SyllabusComponent',
        entityId: component.id,
        diff: dto,
        ip: actor.ip,
      });
      return component;
    } catch (e) {
      if (isPrismaUnique(e)) {
        throw new ConflictException(
          `component "${dto.code}" already exists for this subject`,
        );
      }
      throw e;
    }
  }

  // ---------- Topics ----------
  async createTopic(dto: CreateTopicDto, actor: Actor) {
    const component = await this.prisma.syllabusComponent.findUnique({
      where: { id: dto.componentId },
    });
    if (!component) throw new NotFoundException('componentId not found');
    if (dto.parentTopicId) {
      const parent = await this.prisma.topic.findUnique({ where: { id: dto.parentTopicId } });
      if (!parent) throw new NotFoundException('parentTopicId not found');
      if (parent.componentId !== dto.componentId) {
        throw new BadRequestException('parent topic belongs to a different component');
      }
    }
    try {
      const topic = await this.prisma.topic.create({
        data: {
          componentId: dto.componentId,
          parentTopicId: dto.parentTopicId ?? null,
          code: dto.code,
          name: dto.name,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'admin_syllabus.topic.create',
        entityType: 'Topic',
        entityId: topic.id,
        diff: dto,
        ip: actor.ip,
      });
      return topic;
    } catch (e) {
      if (isPrismaUnique(e)) {
        throw new ConflictException(
          `topic "${dto.code}" already exists in this component`,
        );
      }
      throw e;
    }
  }

  async updateTopic(id: string, dto: UpdateTopicDto, actor: Actor) {
    const existing = await this.prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('topic not found');

    // Reparent guards: cannot point at self, and must be in same component.
    if (dto.parentTopicId !== undefined && dto.parentTopicId !== null) {
      if (dto.parentTopicId === id) {
        throw new BadRequestException('topic cannot be its own parent');
      }
      const parent = await this.prisma.topic.findUnique({
        where: { id: dto.parentTopicId },
      });
      if (!parent) throw new NotFoundException('parentTopicId not found');
      if (parent.componentId !== existing.componentId) {
        throw new BadRequestException(
          'cannot reparent topic into a different component',
        );
      }
      // Prevent cycles: walk up from new parent and check we don't hit `id`.
      let cursor: string | null = parent.parentTopicId;
      const seen = new Set<string>([parent.id]);
      while (cursor) {
        if (cursor === id) {
          throw new BadRequestException('reparent would create a cycle');
        }
        if (seen.has(cursor)) break;
        seen.add(cursor);
        const next: { parentTopicId: string | null } | null =
          await this.prisma.topic.findUnique({
            where: { id: cursor },
            select: { parentTopicId: true },
          });
        cursor = next?.parentTopicId ?? null;
      }
    }

    try {
      const updated = await this.prisma.topic.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.parentTopicId !== undefined && { parentTopicId: dto.parentTopicId }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'admin_syllabus.topic.update',
        entityType: 'Topic',
        entityId: id,
        diff: { before: existing, after: dto },
        ip: actor.ip,
      });
      return updated;
    } catch (e) {
      if (isPrismaUnique(e)) {
        throw new ConflictException(
          `topic code "${dto.code}" already exists in this component`,
        );
      }
      throw e;
    }
  }

  async deleteTopic(id: string, actor: Actor) {
    const existing = await this.prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('topic not found');

    // Block delete if any Question / QuestionTopic / QuestionItemTopic / child topic references it.
    // We surface 409 Conflict (not 500) so the UI can show a friendly message.
    const [primaryCount, linkCount, itemLinkCount, childCount] = await Promise.all([
      this.prisma.question.count({ where: { primaryTopicId: id } }),
      this.prisma.questionTopic.count({ where: { topicId: id } }),
      this.prisma.questionItemTopic.count({ where: { topicId: id } }),
      this.prisma.topic.count({ where: { parentTopicId: id } }),
    ]);
    if (primaryCount + linkCount + itemLinkCount > 0) {
      throw new ConflictException({
        message: 'cannot delete topic: questions still reference it',
        primaryQuestions: primaryCount,
        questionLinks: linkCount,
        questionItemLinks: itemLinkCount,
      });
    }
    if (childCount > 0) {
      throw new ConflictException({
        message: 'cannot delete topic: it has child topics — delete or reparent them first',
        children: childCount,
      });
    }

    try {
      await this.prisma.topic.delete({ where: { id } });
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'admin_syllabus.topic.delete',
        entityType: 'Topic',
        entityId: id,
        diff: { before: existing },
        ip: actor.ip,
      });
      return { ok: true };
    } catch (e) {
      // Defensive — Prisma's onDelete: NoAction on parent FK would surface here too.
      if (isPrismaFkConstraint(e)) {
        throw new ConflictException('cannot delete topic: still referenced');
      }
      if (isPrismaNotFound(e)) {
        throw new NotFoundException('topic not found');
      }
      throw e;
    }
  }

  // ---------- Bulk import ----------
  async importSyllabus(dto: ImportSyllabusDto, actor: Actor) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert exam board by code
      const board = await tx.examBoard.upsert({
        where: { code: dto.boardCode },
        update: {},
        create: {
          code: dto.boardCode,
          name: dto.boardName ?? dto.boardCode,
        },
      });

      // Upsert subject by (examBoardId, code, level)
      const subject = await tx.subject.upsert({
        where: {
          examBoardId_code_level: {
            examBoardId: board.id,
            code: dto.subjectCode,
            level: dto.level,
          },
        },
        update: { name: dto.subjectName },
        create: {
          examBoardId: board.id,
          code: dto.subjectCode,
          name: dto.subjectName,
          level: dto.level,
        },
      });

      let createdComponents = 0;
      let createdTopics = 0;

      for (const comp of dto.components) {
        const component = await tx.syllabusComponent.upsert({
          where: {
            subjectId_code: { subjectId: subject.id, code: comp.code },
          },
          update: { name: comp.name },
          create: {
            subjectId: subject.id,
            code: comp.code,
            name: comp.name,
          },
        });
        createdComponents++;

        // Walk the topic tree depth-first, upserting each node by (componentId, code).
        const walk = async (
          nodes: TopicNode[],
          parentId: string | null,
        ): Promise<void> => {
          let order = 0;
          for (const node of nodes) {
            const t = await tx.topic.upsert({
              where: {
                componentId_code: { componentId: component.id, code: node.code },
              },
              update: {
                name: node.name,
                parentTopicId: parentId,
                sortOrder: node.sortOrder ?? order,
              },
              create: {
                componentId: component.id,
                parentTopicId: parentId,
                code: node.code,
                name: node.name,
                sortOrder: node.sortOrder ?? order,
              },
            });
            createdTopics++;
            order++;
            if (node.children && node.children.length > 0) {
              await walk(node.children, t.id);
            }
          }
        };
        await walk(comp.topics, null);
      }

      return {
        boardId: board.id,
        subjectId: subject.id,
        components: createdComponents,
        topics: createdTopics,
      };
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'admin_syllabus.import',
      entityType: 'Subject',
      entityId: result.subjectId,
      diff: {
        boardCode: dto.boardCode,
        subjectCode: dto.subjectCode,
        level: dto.level,
        componentCount: result.components,
        topicCount: result.topics,
      },
      ip: actor.ip,
    });

    return result;
  }
}
