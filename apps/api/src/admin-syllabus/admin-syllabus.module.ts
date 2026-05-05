import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AdminSyllabusController } from './admin-syllabus.controller';
import { AdminSyllabusService } from './admin-syllabus.service';

@Module({
  controllers: [AdminSyllabusController],
  providers: [PrismaService, AdminSyllabusService],
  exports: [AdminSyllabusService],
})
export class AdminSyllabusModule {}
