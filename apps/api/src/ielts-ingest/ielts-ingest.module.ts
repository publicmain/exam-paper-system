import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { IeltsIngestController } from './ielts-ingest.controller';
import { IeltsIngestService } from './ielts-ingest.service';

@Module({
  controllers: [IeltsIngestController],
  providers: [IeltsIngestService, PrismaService],
  exports: [IeltsIngestService],
})
export class IeltsIngestModule {}
