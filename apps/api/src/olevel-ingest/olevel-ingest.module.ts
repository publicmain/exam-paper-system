import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { OlevelIngestController } from './olevel-ingest.controller';
import { OlevelIngestService } from './olevel-ingest.service';

@Module({
  controllers: [OlevelIngestController],
  providers: [OlevelIngestService, PrismaService],
  exports: [OlevelIngestService],
})
export class OlevelIngestModule {}
