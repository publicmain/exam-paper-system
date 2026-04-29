import { Module } from '@nestjs/common';
import { ReferenceController } from './reference.controller';
import { ReferenceService } from './reference.service';
import { SyllabusSeedService } from './syllabus-seed.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [ReferenceController],
  providers: [ReferenceService, SyllabusSeedService, PrismaService],
})
export class ReferenceModule {}
