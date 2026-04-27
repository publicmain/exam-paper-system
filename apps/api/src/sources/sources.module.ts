import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { IngestModule } from '../ingest/ingest.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [IngestModule, AiModule],
  controllers: [SourcesController],
  providers: [PrismaService, SourcesService],
  exports: [SourcesService],
})
export class SourcesModule {}
