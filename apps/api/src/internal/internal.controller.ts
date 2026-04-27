import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'node:fs';
import { PrismaService } from '../common/prisma.service';
import { Internal } from './internal-auth.guard';

@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stream a raw PDF by sha256 to the pdf-worker. Authenticated by the
   * shared X-Internal-Token header (enforced by InternalGuard).
   */
  @Get('pdf-bytes/:sha256')
  @Internal()
  async getPdfBytes(@Param('sha256') sha256: string, @Res() res: Response) {
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      throw new NotFoundException('invalid sha256');
    }
    const file = await this.prisma.sourceFile.findUnique({ where: { sha256 } });
    if (!file) throw new NotFoundException('source file not found');
    if (!fs.existsSync(file.storagePath)) {
      throw new NotFoundException('raw pdf missing on disk');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', file.fileSizeBytes);
    fs.createReadStream(file.storagePath).pipe(res);
  }
}
