import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { IngestModule } from '../ingest/ingest.module';

@Module({
  imports: [IngestModule],
  controllers: [SourcesController],
  providers: [PrismaService, SourcesService],
  exports: [SourcesService],
})
export class SourcesModule {}
