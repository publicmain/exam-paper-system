import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { IngestService } from './ingest.service';

@Module({
  providers: [PrismaService, IngestService],
  exports: [IngestService],
})
export class IngestModule {}
