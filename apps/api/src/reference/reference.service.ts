import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async listExamBoards() {
    return this.prisma.examBoard.findMany({ orderBy: { code: 'asc' } });
  }

  async listSubjects(opts: { boardId?: string; level?: string }) {
    return this.prisma.subject.findMany({
      where: {
        ...(opts.boardId && { examBoardId: opts.boardId }),
        ...(opts.level && { level: opts.level }),
      },
      include: { examBoard: true },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
  }

  async listComponents(subjectId: string) {
    return this.prisma.syllabusComponent.findMany({
      where: { subjectId },
      orderBy: { code: 'asc' },
    });
  }

  async listTopicsTree(componentId: string) {
    const flat = await this.prisma.topic.findMany({
      where: { componentId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    const byId = new Map(flat.map(t => [t.id, { ...t, children: [] as any[] }]));
    const roots: any[] = [];
    for (const t of byId.values()) {
      if (t.parentTopicId && byId.has(t.parentTopicId)) {
        byId.get(t.parentTopicId)!.children.push(t);
      } else {
        roots.push(t);
      }
    }
    return roots;
  }
}
