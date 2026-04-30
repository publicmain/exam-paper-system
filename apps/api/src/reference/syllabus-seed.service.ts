import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SYLLABUS_9608 } from './syllabi/topics-9608';
import { SYLLABUS_4024 } from './syllabi/topics-4024';
import { SYLLABUS_4MA1 } from './syllabi/topics-4ma1';

interface SyllabusSeed {
  examBoardCode: string;
  subjectCode: string;
  subjectName: string;
  level: string;
  components: Array<{
    code: string;
    name: string;
    topics: Array<{
      code: string;
      name: string;
      children?: Array<{ code: string; name: string }>;
    }>;
  }>;
}

const SYLLABI: SyllabusSeed[] = [SYLLABUS_9608, SYLLABUS_4024, SYLLABUS_4MA1];

/**
 * Idempotent runtime syllabus seeder. Production runs `prisma db push` on
 * every deploy but does NOT run prisma/seed.ts (ts-node is a devDependency
 * and the runtime image is built with --omit=dev). New syllabi added to
 * the SYLLABI list above are upserted on every NestJS bootstrap so prod
 * picks them up without operator intervention.
 *
 * Existing rows are left alone — name updates flow through, topic
 * deletions are NOT propagated (that would risk orphaning approved
 * Questions linked to the old topic).
 */
@Injectable()
export class SyllabusSeedService implements OnModuleInit {
  private readonly logger = new Logger('SyllabusSeedService');

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.SKIP_SYLLABUS_SEED === 'true') {
      this.logger.log('SKIP_SYLLABUS_SEED=true; skipping');
      return;
    }
    for (const syllabus of SYLLABI) {
      try {
        await this.seedOne(syllabus);
      } catch (e: any) {
        this.logger.error(
          `seed failed for ${syllabus.examBoardCode} ${syllabus.subjectCode}: ${e.message}`,
        );
      }
    }
  }

  private async seedOne(s: SyllabusSeed) {
    const board = await this.prisma.examBoard.upsert({
      where: { code: s.examBoardCode },
      update: {},
      create: {
        code: s.examBoardCode,
        name: s.examBoardCode === 'CIE' ? 'Cambridge International' : s.examBoardCode,
      },
    });
    const subject = await this.prisma.subject.upsert({
      where: { examBoardId_code_level: { examBoardId: board.id, code: s.subjectCode, level: s.level as any } },
      update: { name: s.subjectName },
      create: { examBoardId: board.id, code: s.subjectCode, name: s.subjectName, level: s.level as any },
    });
    let topicCount = 0;
    for (const comp of s.components) {
      const component = await this.prisma.syllabusComponent.upsert({
        where: { subjectId_code: { subjectId: subject.id, code: comp.code } },
        update: { name: comp.name },
        create: { subjectId: subject.id, code: comp.code, name: comp.name },
      });
      let order = 0;
      for (const t of comp.topics) {
        const top = await this.prisma.topic.upsert({
          where: { componentId_code: { componentId: component.id, code: t.code } },
          update: { name: t.name, sortOrder: order, parentTopicId: null },
          create: { componentId: component.id, parentTopicId: null, code: t.code, name: t.name, sortOrder: order },
        });
        order++;
        topicCount++;
        let childOrder = 0;
        for (const c of t.children ?? []) {
          await this.prisma.topic.upsert({
            where: { componentId_code: { componentId: component.id, code: c.code } },
            update: { name: c.name, sortOrder: childOrder, parentTopicId: top.id },
            create: { componentId: component.id, parentTopicId: top.id, code: c.code, name: c.name, sortOrder: childOrder },
          });
          childOrder++;
          topicCount++;
        }
      }
    }
    this.logger.log(`seeded ${s.examBoardCode} ${s.subjectCode} (${topicCount} topics)`);
  }
}
