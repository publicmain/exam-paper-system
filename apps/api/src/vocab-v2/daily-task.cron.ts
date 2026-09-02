import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { VocabularyV2Service } from './vocabulary-v2.service';

/**
 * Materialises every active student's dated word task independently of page
 * visits.  Running every ten minutes also repairs a midnight deployment gap;
 * the unique sessionKey keeps all runs idempotent.
 */
@Injectable()
export class VocabularyV2DailyTaskCron implements OnModuleInit {
  private readonly logger = new Logger(VocabularyV2DailyTaskCron.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vocabulary: VocabularyV2Service,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.STUDENT_APP_V2 !== 'on') return;
    setTimeout(() => void this.provision(), 5_000);
  }

  @Cron('*/10 * * * *', { name: 'vocabulary-v2-daily-task-provisioner', timeZone: 'Asia/Singapore' })
  async provision(now = new Date()) {
    if (this.running || process.env.STUDENT_APP_V2 !== 'on') return;
    this.running = true;
    try {
      const students = await this.prisma.user.findMany({
        where: {
          role: 'student',
          isActive: true,
          archivedAt: null,
          englishLevel: { not: null },
          classEnrollments: { some: { role: 'student', class: { archivedAt: null } } },
        },
        select: { id: true },
      });
      let createdOrFound = 0;
      for (let index = 0; index < students.length; index += 4) {
        const batch = students.slice(index, index + 4);
        const results = await Promise.allSettled(batch.map((student) => this.vocabulary.startDailySession(student.id, now)));
        createdOrFound += results.filter((result) => result.status === 'fulfilled').length;
        for (const result of results) {
          if (result.status === 'rejected') this.logger.warn(`daily task provisioning skipped: ${String(result.reason)}`);
        }
      }
      this.logger.log(`daily tasks ready for ${createdOrFound}/${students.length} active students`);
    } finally {
      this.running = false;
    }
  }
}
