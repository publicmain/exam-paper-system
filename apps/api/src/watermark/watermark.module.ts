import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PdfModule } from '../pdf/pdf.module';
import { WatermarkController } from './watermark.controller';
import { WatermarkService } from './watermark.service';

/**
 * WatermarkModule — wraps PdfService.exportPaper() and overlays a per-student
 * forensic watermark layer on the resulting buffer.
 *
 * Imports PdfModule rather than re-providing PdfService so we share the
 * single Puppeteer browser instance held in PdfService (otherwise each
 * module would spin its own Chrome).
 */
@Module({
  imports: [PdfModule],
  controllers: [WatermarkController],
  providers: [PrismaService, WatermarkService],
  exports: [WatermarkService],
})
export class WatermarkModule {}
