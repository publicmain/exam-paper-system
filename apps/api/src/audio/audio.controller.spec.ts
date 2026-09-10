import { describe, expect, it, vi } from 'vitest';
import { AudioController, normalizeHeadword } from './audio.controller';

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
