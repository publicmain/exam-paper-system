import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const AI_IMAGE_STORE = process.env.AI_IMAGE_STORAGE_PATH
  || path.join(process.env.RENDER_STORAGE_PATH || os.tmpdir(), 'ai-images');

/**
 * Serve AI-generated diagram PNGs. Requires JWT (the global AuthGuard
 * gates this) — only logged-in school staff can read the files.
 */
@Controller('question-assets')
export class QuestionAssetController {
  @Get('by-question/:qid/:filename')
  serve(@Param('qid') qid: string, @Param('filename') filename: string, @Res() res: Response) {
    if (!/^[a-z0-9-]+$/i.test(qid) || !/^[a-z0-9-]+\.png$/i.test(filename)) {
      throw new NotFoundException('invalid path');
    }
    const abs = path.join(AI_IMAGE_STORE, qid, filename);
    if (!fs.existsSync(abs)) throw new NotFoundException('asset not found');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(abs).pipe(res);
  }
}
