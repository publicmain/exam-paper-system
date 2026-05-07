import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ShuffleService } from '../src/shuffle/shuffle.service';
import { QrService } from '../src/qr/qr.service';
import { IpAllowlistGuard } from '../src/wifi-gate/ip-allowlist.guard';
import { parseFilename } from '../src/ingest/filename-parser';
import type { ExecutionContext } from '@nestjs/common';

// ─────────────────────────── ShuffleService ───────────────────────────

function mockPrismaForShuffle(overrides: Partial<{
  existing: any;
  paperQuestions: any[];
}> = {}) {
  const upsertCalls: any[] = [];
  return {
    questionShuffleMap: {
      findUnique: vi.fn().mockResolvedValue(overrides.existing ?? null),
      upsert: vi.fn().mockImplementation((args: any) => {
        upsertCalls.push(args);
        return Promise.resolve(args.create);
      }),
    },
    paperQuestion: {
      findMany: vi.fn().mockResolvedValue(
        overrides.paperQuestions ?? [
          { id: 'pq1', snapshotOptions: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }], question: { questionType: 'mcq' } },
          { id: 'pq2', snapshotOptions: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }], question: { questionType: 'mcq' } },
          { id: 'pq3', snapshotOptions: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }], question: { questionType: 'mcq' } },
        ],
      ),
    },
    _upsertCalls: upsertCalls,
  } as any;
}

describe('ShuffleService', () => {
  it('is deterministic — same (student,paper) yields identical map across calls', async () => {
    const prisma1 = mockPrismaForShuffle();
    const svc1 = new ShuffleService(prisma1);
    const prisma2 = mockPrismaForShuffle();
    const svc2 = new ShuffleService(prisma2);

    const m1 = await svc1.getOrCreate('alice', 'paperX');
    const m2 = await svc2.getOrCreate('alice', 'paperX');

    expect(m1.seed).toBe(m2.seed);
    expect(m1.questionOrder).toEqual(m2.questionOrder);
    expect(m1.optionOrders).toEqual(m2.optionOrders);
  });

  it('produces different orders for different students', async () => {
    const prisma = mockPrismaForShuffle();
    const svc = new ShuffleService(prisma);
    const a = await svc.getOrCreate('alice', 'paperX');
    const b = await svc.getOrCreate('bob', 'paperX');
    expect(a.questionOrder).not.toEqual(b.questionOrder);
  });

  it('reuses existing map without recomputing', async () => {
    const stored = {
      seed: 'cafebabe12345678',
      questionOrder: [2, 0, 1],
      optionOrders: { pq1: [3, 1, 0, 2] },
    };
    const prisma = mockPrismaForShuffle({ existing: stored });
    const svc = new ShuffleService(prisma);
    const m = await svc.getOrCreate('alice', 'paperX');
    expect(m).toEqual(stored);
    expect(prisma.questionShuffleMap.upsert).not.toHaveBeenCalled();
  });

  it('unmapOptionIndex reverses option permutation', () => {
    const svc = new ShuffleService({} as any);
    const map = { seed: '', questionOrder: [], optionOrders: { pq1: [2, 0, 3, 1] } };
    // Student saw display index 0 → original index 2.
    expect(svc.unmapOptionIndex(map, 'pq1', 0)).toBe(2);
    expect(svc.unmapOptionIndex(map, 'pq1', 1)).toBe(0);
    expect(svc.unmapOptionIndex(map, 'pq1', 2)).toBe(3);
    expect(svc.unmapOptionIndex(map, 'pq1', 3)).toBe(1);
    expect(svc.unmapOptionIndex(map, 'pq1', 4)).toBeNull(); // out of range
    expect(svc.unmapOptionIndex(map, 'unknownPq', 0)).toBeNull(); // missing
  });

  it('applyToPaper reorders questions and options consistently', () => {
    const svc = new ShuffleService({} as any);
    const pqs = [
      { id: 'a', snapshotOptions: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }], question: { questionType: 'mcq' } },
      { id: 'b', snapshotOptions: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }], question: { questionType: 'mcq' } },
      { id: 'c', snapshotOptions: null, question: { questionType: 'short_answer' } },
    ];
    const map = {
      seed: '',
      questionOrder: [2, 0, 1],
      optionOrders: { a: [3, 0, 1, 2], b: [1, 0, 2, 3] },
    };
    const out = svc.applyToPaper(pqs as any, map);
    expect(out[0].id).toBe('c'); // short_answer question moved to position 0
    expect(out[1].id).toBe('a');
    expect(out[2].id).toBe('b');
    // a's options reordered per [3,0,1,2]
    expect((out[1] as any).snapshotOptions[0].key).toBe('D');
    expect((out[1] as any).snapshotOptions[1].key).toBe('A');
  });
});

// ─────────────────────────── QrService ───────────────────────────

function mockPrismaForQr(session: any | null) {
  return {
    morningQuizSession: {
      findUnique: vi.fn().mockResolvedValue(session),
    },
  } as any;
}

describe('QrService', () => {
  const session = {
    id: 'sess1',
    qrSecret: 'aabbccdd00112233',
    qrRotationSeconds: 15,
    status: 'active',
  };

  it('round-trips a freshly generated token', async () => {
    const svc = new QrService(mockPrismaForQr(session));
    const { token } = await svc.currentToken('sess1');
    const decoded = await svc.verify(token);
    expect(decoded.sessionId).toBe('sess1');
  });

  it('rejects malformed token', async () => {
    const svc = new QrService(mockPrismaForQr(session));
    await expect(svc.verify('not_a_token')).rejects.toMatchObject({
      response: { code: 'qr_malformed' },
    });
    await expect(svc.verify('v1.123.short.sess1')).rejects.toMatchObject({
      response: { code: 'qr_malformed' },
    });
  });

  it('rejects token with wrong signature (tamper detection)', async () => {
    const svc = new QrService(mockPrismaForQr(session));
    const { token } = await svc.currentToken('sess1');
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.0000000000000000.${parts[3]}`;
    await expect(svc.verify(tampered)).rejects.toMatchObject({
      response: { code: 'qr_invalid' },
    });
  });

  it('rejects expired token (older than rotation+tolerance)', async () => {
    const svc = new QrService(mockPrismaForQr(session));
    // Forge a token with a windowStart 60s in the past — past 15+30 tolerance.
    const past = Math.floor((Date.now() - 60_000) / 15_000) * 15_000;
    const { createHmac } = await import('crypto');
    const sig = createHmac('sha256', session.qrSecret)
      .update(`${session.id}.${past}`)
      .digest('hex')
      .slice(0, 16);
    const stale = `v1.${past}.${sig}.${session.id}`;
    await expect(svc.verify(stale)).rejects.toMatchObject({
      response: { code: 'qr_expired' },
    });
  });

  it('rejects when session is not found', async () => {
    const svc = new QrService(mockPrismaForQr(null));
    // Generated by a session-aware client first…
    const realSvc = new QrService(mockPrismaForQr(session));
    const { token } = await realSvc.currentToken('sess1');
    // …but verified against an empty DB.
    await expect(svc.verify(token)).rejects.toMatchObject({
      response: { code: 'qr_session_not_found' },
    });
  });
});

// ─────────────────────────── IpAllowlistGuard ───────────────────────────

function mockConfig(env: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => env[k] } as any;
}

function execCtx(req: { ip?: string; remoteAddress?: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip: req.ip,
        socket: { remoteAddress: req.remoteAddress },
      }),
    }),
  } as any;
}

describe('IpAllowlistGuard', () => {
  it('allows exact IP match', () => {
    const g = new IpAllowlistGuard(mockConfig({ SCHOOL_PUBLIC_IPS: '203.0.113.5' }));
    expect(g.canActivate(execCtx({ ip: '203.0.113.5' }))).toBe(true);
  });

  it('allows CIDR-block match', () => {
    const g = new IpAllowlistGuard(mockConfig({ SCHOOL_PUBLIC_IPS: '203.0.113.0/24' }));
    expect(g.canActivate(execCtx({ ip: '203.0.113.42' }))).toBe(true);
    expect(g.canActivate(execCtx({ ip: '203.0.113.255' }))).toBe(true);
  });

  it('rejects IP outside allowlist', () => {
    const g = new IpAllowlistGuard(mockConfig({ SCHOOL_PUBLIC_IPS: '203.0.113.0/24' }));
    expect(() => g.canActivate(execCtx({ ip: '198.51.100.1' }))).toThrow();
  });

  it('strips IPv4-mapped-IPv6 prefix', () => {
    const g = new IpAllowlistGuard(mockConfig({ SCHOOL_PUBLIC_IPS: '203.0.113.5' }));
    expect(g.canActivate(execCtx({ ip: '::ffff:203.0.113.5' }))).toBe(true);
  });

  it('fails closed when SCHOOL_PUBLIC_IPS is unset', () => {
    const g = new IpAllowlistGuard(mockConfig({}));
    expect(() => g.canActivate(execCtx({ ip: '203.0.113.5' }))).toThrow();
  });

  it('honours SCHOOL_IP_BYPASS=true (dev escape hatch)', () => {
    const g = new IpAllowlistGuard(
      mockConfig({ SCHOOL_PUBLIC_IPS: '203.0.113.0/24', SCHOOL_IP_BYPASS: 'true' }),
    );
    expect(g.canActivate(execCtx({ ip: '198.51.100.1' }))).toBe(true);
  });

  it('handles multi-rule comma-separated allowlist', () => {
    const g = new IpAllowlistGuard(
      mockConfig({ SCHOOL_PUBLIC_IPS: '203.0.113.0/24, 198.51.100.42, 192.0.2.0/28' }),
    );
    expect(g.canActivate(execCtx({ ip: '203.0.113.7' }))).toBe(true);
    expect(g.canActivate(execCtx({ ip: '198.51.100.42' }))).toBe(true);
    expect(g.canActivate(execCtx({ ip: '192.0.2.5' }))).toBe(true);
    expect(() => g.canActivate(execCtx({ ip: '192.0.2.16' }))).toThrow();
  });
});

// ─────────────────────────── filename-parser (IELTS) ───────────────────────────

describe('filename-parser (IELTS)', () => {
  it('parses Cambridge IELTS book + test + section (underscore form)', () => {
    const r = parseFilename('cambridge_ielts_18_test_2_reading.pdf');
    expect(r.matched).toBe(true);
    expect(r.syllabusCode).toBe('IELTS');
    expect(r.paperVariant).toBe('18.2');
    expect(r.paperNumber).toBe('reading');
    expect(r.fileKind).toBe('question_paper');
  });

  it('parses compact form (ielts18_t2_reading)', () => {
    const r = parseFilename('ielts18_t2_reading.pdf');
    expect(r.matched).toBe(true);
    expect(r.paperVariant).toBe('18.2');
  });

  it('marks answer-key files as mark_scheme', () => {
    const r = parseFilename('ielts_18_test_2_reading_answer_key.pdf');
    expect(r.fileKind).toBe('mark_scheme');
  });

  it('still parses CIE-format filenames unchanged', () => {
    const r = parseFilename('9702_s19_qp_22.pdf');
    expect(r.syllabusCode).toBe('9702');
    expect(r.examSeason).toBe('s');
    expect(r.fileKind).toBe('question_paper');
  });
});
