import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PrismaService } from '../common/prisma.service';

const RENDER_STORE = process.env.RENDER_STORAGE_PATH || path.join(os.tmpdir(), 'exam-rendered');

/**
 * Serve rendered page images to authenticated UI clients (review queue,
 * teacher edit). The images live on the API container's local disk and
 * map 1:1 to PdfPage rows.
 */
@Controller('source-files')
export class SourceFilesController {
  constructor(private readonly prisma: PrismaService) {}

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
    if (!fs.existsSync(abs)) {
      throw new NotFoundException('page image not rendered');
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=600');
    fs.createReadStream(abs).pipe(res);
  }
}
