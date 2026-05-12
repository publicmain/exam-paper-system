import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ClassesController, UserArchiveController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  // UserArchiveController is co-owned with ClassesController — it
  // mounts under /users/:id/* but lives next to the transfer endpoint
  // because both mutate the same archivedAt column + share auth gating.
  controllers: [ClassesController, UserArchiveController],
  providers: [PrismaService, ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
