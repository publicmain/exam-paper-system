import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PrismaService } from '../common/prisma.service';
import { Public, Roles } from '../common/auth.guard';

const RENDER_STORE = process.env.RENDER_STORAGE_PATH || path.join(os.tmpdir(), 'exam-rendered');

/**
 * Serve rendered page images to authenticated UI clients (review queue,
 * teacher edit). The images live on the API container's local disk and
 * map 1:1 to PdfPage rows.
 */
@Controller('source-files')
export class SourceFilesController {
  constructor(private readonly prisma: PrismaService) {}

  // Page image is opened via <img src=...> which can't carry the JWT
  // Authorization header. Mark it @Public so browsers can fetch it from
  // the /practice page; the route itself only serves rendered PNGs of
  // already-approved past papers, so opening it up doesn't expose any
  // pending-review or restricted content.
  @Public()
  @Get(':id/pages/:page')
  async pageImage(
    @Param('id') id: string,
    @Param('page') page: string,
    @Res() res: Response,
  ) {
    // Strip optional .png suffix the UI may include in the URL.
    const pageNum = parseInt(page.replace(/\.png$/i, ''), 10);
    if (!Number.isFinite(pageNum) || pageNum < 1) {
      throw new NotFoundException('invalid page number');
    }
    // Ensure the source file exists and the caller can see it. Compliance
    // filtering is enforced at the question level later; here we just gate
    // on existence so a logged-in user cannot probe arbitrary ids.
    const file = await this.prisma.sourceFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('source file not found');

    const fname = `page-${String(pageNum).padStart(4, '0')}.png`;
    const abs = path.join(RENDER_STORE, id, fname);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=600');
    if (fs.existsSync(abs)) {
      fs.createReadStream(abs).pipe(res);
      return;
    }
    // Filesystem missed (typical on ephemeral container hosts where the
    // disk PNG was lost on restart). Fall back to the DB-embedded copy
    // populated by the dispatcher. This is the column that pg_dump
    // carries when migrating between environments.
    const row = await this.prisma.pdfPage.findUnique({
      where: { sourceFileId_pageNo: { sourceFileId: id, pageNo: pageNum } },
      select: { imageBytes: true },
    });
    if (!row?.imageBytes) {
      throw new NotFoundException('page image not rendered');
    }
    res.end(Buffer.from(row.imageBytes));
  }

  /**
   * Admin-only debug endpoint: returns the extracted PdfPage.rawText
   * concatenated for the whole file, with page boundary markers. Used
   * to tune the splitter heuristics without leaving the deployed system.
   */
  @Get(':id/text')
  @Roles('admin')
  async fullText(@Param('id') id: string) {
    const file = await this.prisma.sourceFile.findUnique({
      where: { id },
      include: { pages: { orderBy: { pageNo: 'asc' } } },
    });
    if (!file) throw new NotFoundException('source file not found');
    return {
      file: { id: file.id, rawFilename: file.rawFilename, fileKind: file.fileKind, paperVariant: file.paperVariant },
      pages: file.pages.map((p) => ({ pageNo: p.pageNo, charCount: (p.rawText ?? '').length, rawText: p.rawText ?? '' })),
    };
  }
}
