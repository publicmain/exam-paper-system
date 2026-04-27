import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { IngestService } from './ingest.service';
import { PdfDispatcherService } from './pdf-dispatcher.service';
import { QuestionSplitterService } from './question-splitter.service';
import { MarkSchemeLinkerService } from './mark-scheme-linker.service';
import { SourceFilesController } from './source-files.controller';

@Module({
  controllers: [SourceFilesController],
  providers: [
    PrismaService,
    IngestService,
    PdfDispatcherService,
    QuestionSplitterService,
    MarkSchemeLinkerService,
  ],
  exports: [IngestService, PdfDispatcherService, QuestionSplitterService, MarkSchemeLinkerService],
})
export class IngestModule {}
