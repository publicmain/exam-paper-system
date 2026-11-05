import { Controller, Get, Headers, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';

/** 只认小写英文、撇号、连字符、空格 —— 词库里的 headword 就长这样。 */
export function normalizeHeadword(raw: string): string | null {
  let s: string;
  try {
    s = decodeURIComponent(String(raw ?? ''));
  } catch {
    return null;
  }
  s = s.trim().toLowerCase();
  if (!s || s.length > 64) return null;
  if (!/^[a-z][a-z' -]*$/.test(s)) return null;
  return s;
}

/**
 * 词汇发音（2026-09-10）。
 *
 * `<audio src>` 没法带 Authorization 头，所以这个端点**必须是公开的**——
 * 内容是词典单词的发音，不含任何学生数据，公开没有问题。
 *
 * 缓存：一年、immutable。同一个词的音频永远不变（换音色会换 voice 字段，
 * 但学生端取的 URL 不带版本 —— 真要换音色时把路径加上 voice 段再说）。
 * 404 也给一小时缓存，学生端退回系统语音后不会每次点都白跑一趟。
 */
@Controller('audio')
export class AudioController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('sentence/:hash.mp3')
  async sentence(@Param('hash') hash: string, @Res() res: Response, @Headers('range') range?: string) {
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      res.status(404).setHeader('Cache-Control', 'public, max-age=3600').end();
      return;
    }
    const row = await this.prisma.sentenceAudio.findUnique({
      where: { textHash: hash },
      select: { bytes: true, contentType: true, byteLength: true, voice: true },
    });
    if (!row) {
      res.status(404).setHeader('Cache-Control', 'public, max-age=3600').end();
      return;
    }
    res.setHeader('Content-Type', row.contentType);
    res.setHeader('Content-Length', String(row.byteLength));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Voice', row.voice);
    res.setHeader('Accept-Ranges', 'bytes');
    const bytes = Buffer.from(row.bytes);
    // Safari can request byte ranges to load/seek MP3s. Only one range is
    // supported; invalid ranges never accidentally return the whole file.
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const size = bytes.length;
      let start = Number.NaN;
      let end = Number.NaN;
      if (match && (match[1] || match[2])) {
        if (match[1]) {
          start = Number(match[1]);
          end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
        } else if (Number(match[2]) > 0) {
          start = Math.max(0, size - Number(match[2]));
          end = size - 1;
        }
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size || start < 0) {
        res.setHeader('Content-Range', `bytes */${size}`);
        res.setHeader('Content-Length', '0');
        res.status(416).end();
        return;
      }
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      res.status(206).end(bytes.subarray(start, end + 1));
      return;
    }
    res.end(bytes);
  }

  @Public()
  @Get('word/:headword')
  async word(@Param('headword') raw: string, @Res() res: Response) {
    const headword = normalizeHeadword(raw);
    if (!headword) {
      res.status(404).setHeader('Cache-Control', 'public, max-age=3600').end();
      return;
    }
    const row = await this.prisma.wordAudio.findUnique({
      where: { headword },
      select: { bytes: true, contentType: true, byteLength: true, voice: true },
    });
    if (!row) {
      res.status(404).setHeader('Cache-Control', 'public, max-age=3600').end();
      return;
    }
    res.setHeader('Content-Type', row.contentType);
    res.setHeader('Content-Length', String(row.byteLength));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Voice', row.voice);
    res.end(Buffer.from(row.bytes));
  }
}
