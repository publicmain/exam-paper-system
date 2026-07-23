import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { HomeworkController } from './homework.controller';
import { StudentHomeworkController } from './student-homework.controller';
import { HomeworkService } from './homework.service';

// AuditModule is @Global, so AuditService injects without an import here.
@Module({
  controllers: [HomeworkController, StudentHomeworkController],
  providers: [PrismaService, HomeworkService],
  exports: [HomeworkService],
})
export class HomeworkModule {}
