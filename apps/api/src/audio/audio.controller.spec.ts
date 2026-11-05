import { describe, expect, it, vi } from 'vitest';
import { AudioController, normalizeHeadword } from './audio.controller';
import { PUBLIC_KEY } from '../common/auth.guard';

function fakeRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    body: null as Buffer | null,
    status(code: number) { this.statusCode = code; return this; },
    setHeader(k: string, v: string) { headers[k] = v; return this; },
    end(b?: Buffer) { this.body = b ?? null; return this; },
    headers,
  };
  return res;
}

describe('发音 —— headword 规整', () => {
  it('小写、去空白、URL 解码', () => {
    expect(normalizeHeadword('Abandon')).toBe('abandon');
    expect(normalizeHeadword('%20ice%20cream%20')).toBe('ice cream');
    expect(normalizeHeadword("o'clock")).toBe("o'clock");
    expect(normalizeHeadword('well-being')).toBe('well-being');
  });

  it('不是词的东西一律拒绝 —— 数字、路径、脚本、太长、坏编码', () => {
    for (const bad of ['', '123', '../etc', 'a<b>', 'x'.repeat(65), '%E0%A4%A', ' ', '-dash']) {
      expect(normalizeHeadword(bad), bad).toBeNull();
    }
  });
});

describe('发音 —— 端点', () => {
  const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
  const prisma: any = {
    wordAudio: {
      findUnique: vi.fn().mockImplementation(async ({ where }: any) =>
        where.headword === 'abandon'
          ? { bytes: mp3, contentType: 'audio/mpeg', byteLength: mp3.length, voice: 'en_GB-alba-medium' }
          : null,
      ),
    },
  };
  const ctrl = new AudioController(prisma);

  it('有音频 → MP3 + 一年 immutable 缓存', async () => {
    const res = fakeRes();
    await ctrl.word('Abandon', res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('audio/mpeg');
    expect(res.headers['Content-Length']).toBe('4');
    expect(res.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(res.body?.equals(mp3)).toBe(true);
  });

  it('没有 → 404，也给一小时缓存，学生端退回系统语音后别每次都白跑', async () => {
    const res = fakeRes();
    await ctrl.word('zzzz', res);
    expect(res.statusCode).toBe(404);
    expect(res.headers['Cache-Control']).toBe('public, max-age=3600');
    expect(res.body).toBeNull();
  });

  it('坏的 headword 连库都不查', async () => {
    prisma.wordAudio.findUnique.mockClear();
    const res = fakeRes();
    await ctrl.word('../x', res);
    expect(res.statusCode).toBe(404);
    expect(prisma.wordAudio.findUnique).not.toHaveBeenCalled();
  });
});

describe('sentence MP3 endpoint', () => {
  const hash = 'a'.repeat(64);
  it('is a public route with the hash.mp3 path', () => {
    expect(Reflect.getMetadata(PUBLIC_KEY, AudioController.prototype.sentence)).toBe(true);
    expect(Reflect.getMetadata('path', AudioController.prototype.sentence)).toBe('sentence/:hash.mp3');
  });
  it('returns binary MP3 with immutable cache and content headers', async () => {
    const bytes = Buffer.from([0xff, 0xfb, 0x90, 0]);
    const findUnique = vi.fn(async () => ({ bytes, contentType: 'audio/mpeg', byteLength: 4, voice: 'en_GB-alba-medium' }));
    const res = fakeRes();
    await new AudioController({ sentenceAudio: { findUnique } } as any).sentence(hash, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers).toEqual({ 'Content-Type': 'audio/mpeg', 'Content-Length': '4',
      'Cache-Control': 'public, max-age=31536000, immutable', 'X-Voice': 'en_GB-alba-medium', 'Accept-Ranges': 'bytes' });
    expect(res.body).toEqual(bytes);
    expect(findUnique).toHaveBeenCalledWith({ where: { textHash: hash },
      select: { bytes: true, contentType: true, byteLength: true, voice: true } });
  });
  it('returns cacheable 404 for missing audio', async () => {
    const res = fakeRes();
    await new AudioController({ sentenceAudio: { findUnique: vi.fn(async () => null) } } as any).sentence(hash, res);
    expect(res.statusCode).toBe(404);
    expect(res.headers['Cache-Control']).toBe('public, max-age=3600');
  });
  it('rejects malformed hashes before querying', async () => {
    const findUnique = vi.fn();
    for (const bad of ['../x', 'A'.repeat(64), 'a'.repeat(63), '', hash + '.mp3']) {
      const res = fakeRes();
      await new AudioController({ sentenceAudio: { findUnique } } as any).sentence(bad, res);
      expect(res.statusCode).toBe(404);
    }
    expect(findUnique).not.toHaveBeenCalled();
  });
  it.each([['bytes=0-1', 0, 1], ['bytes=2-', 2, 3], ['bytes=-2', 2, 3], ['bytes=1-99', 1, 3]])(
    'serves Safari range %s with 206', async (range, start, end) => {
      const bytes = Buffer.from([1, 2, 3, 4]);
      const ctrl = new AudioController({ sentenceAudio: { findUnique: vi.fn(async () => ({ bytes, contentType: 'audio/mpeg', byteLength: 4, voice: 'v' })) } } as any);
      const res = fakeRes(); await ctrl.sentence(hash, res, range as string);
      expect(res.statusCode).toBe(206);
      expect(res.headers['Content-Range']).toBe(`bytes ${start}-${end}/4`);
      expect(res.body).toEqual(bytes.subarray(start as number, (end as number) + 1));
      expect(res.headers['Cache-Control']).toContain('immutable');
    },
  );
  it.each(['bytes=9-', 'bytes=3-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,2-3', 'broken'])('rejects invalid range %s', async (range) => {
    const ctrl = new AudioController({ sentenceAudio: { findUnique: vi.fn(async () => ({ bytes: Buffer.from([1, 2]), contentType: 'audio/mpeg', byteLength: 2, voice: 'v' })) } } as any);
    const res = fakeRes(); await ctrl.sentence(hash, res, range);
    expect(res.statusCode).toBe(416);
    expect(res.headers['Content-Range']).toBe('bytes */2');
  });
});
