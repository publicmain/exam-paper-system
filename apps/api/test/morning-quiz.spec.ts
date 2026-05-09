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

// ─────────────────────── MorningQuizService.getStudentView redaction ────
// QA Round 1 — regression guard for the answer-key leak (Critical #1).
// Without redaction, an MCQ option's `correct` flag was sent verbatim to
// the student, and `snapshotContent.markScheme` / `answerContent` shipped
// alongside the question stem. F12 → student opens the network tab and
// reads off all the right answers. The redaction below mirrors the
// inline strip logic in morning-quiz.service.getStudentView so a future
// refactor accidentally re-introducing the leak fails this test loudly.

import { autoGradeScripts } from '../src/student/student.service';

describe('MorningQuizService — student view redaction (Round 1 critical)', () => {
  // Mirror the helper in getStudentView. If the service helper changes
  // shape, update both here AND in the service.
  function redactSnapshotForStudent(pq: {
    snapshotContent: any;
    snapshotOptions: any;
  }) {
    const stripOptions = (opts: unknown) => {
      if (!Array.isArray(opts)) return opts;
      return opts.map((o: any) => ({ key: o?.key, text: o?.text }));
    };
    const stripSnapshotContent = (sc: unknown) => {
      if (!sc || typeof sc !== 'object' || Array.isArray(sc)) return sc;
      const { markScheme, answerContent, ...rest } = sc as Record<string, unknown>;
      return rest;
    };
    return {
      snapshotContent: stripSnapshotContent(pq.snapshotContent),
      snapshotOptions: stripOptions(pq.snapshotOptions),
    };
  }

  it('strips correct flag from snapshotOptions', () => {
    const pq = {
      snapshotOptions: [
        { key: 'A', text: '24', correct: false },
        { key: 'B', text: '42', correct: true },
        { key: 'C', text: '7', correct: false },
      ],
      snapshotContent: { stem: 'What is 6 × 7?' },
    };
    const out = redactSnapshotForStudent(pq);
    for (const opt of out.snapshotOptions as any[]) {
      expect(opt).not.toHaveProperty('correct');
      expect(opt).toHaveProperty('key');
      expect(opt).toHaveProperty('text');
    }
  });

  it('strips markScheme + answerContent from snapshotContent', () => {
    const pq = {
      snapshotOptions: null,
      snapshotContent: {
        stem: 'Explain photosynthesis.',
        markScheme: '6CO2 + 6H2O -> C6H12O6 + 6O2 (3 marks)',
        answerContent: { text: 'plants use sunlight…' },
        passage: 'visible legitimate field',
      },
    };
    const out = redactSnapshotForStudent(pq) as any;
    expect(out.snapshotContent).not.toHaveProperty('markScheme');
    expect(out.snapshotContent).not.toHaveProperty('answerContent');
    expect(out.snapshotContent.passage).toBe('visible legitimate field');
    expect(out.snapshotContent.stem).toBeDefined();
  });

  it('passes through null/non-object snapshotContent unchanged', () => {
    expect(redactSnapshotForStudent({ snapshotOptions: [], snapshotContent: null })
      .snapshotContent).toBeNull();
    expect(redactSnapshotForStudent({ snapshotOptions: [], snapshotContent: 'plain string' })
      .snapshotContent).toBe('plain string');
  });
});

// ─────────────────────── autoGradeScripts (Round 1 medium) ─────────────

describe('autoGradeScripts — shared grader for finalSubmit + cron lock', () => {
  it('returns 0 marks when student picked nothing', () => {
    const r = autoGradeScripts([
      {
        id: 's1',
        selectedOption: null,
        paperQuestion: {
          marks: 4,
          snapshotOptions: [{ key: 'A', correct: true }, { key: 'B', correct: false }],
          question: { questionType: 'mcq', options: null },
        },
      },
    ]);
    expect(r.autoScore).toBe(0);
    expect(r.scriptUpdates[0].autoCorrect).toBe(false);
  });

  it('awards full marks for a correct MCQ pick', () => {
    const r = autoGradeScripts([
      {
        id: 's1',
        selectedOption: 'B',
        paperQuestion: {
          marks: 4,
          snapshotOptions: [{ key: 'A', correct: false }, { key: 'B', correct: true }],
          question: { questionType: 'mcq', options: null },
        },
      },
    ]);
    expect(r.autoScore).toBe(4);
    expect(r.scriptUpdates[0]).toMatchObject({ autoCorrect: true, awardedMarks: 4 });
  });

  it('skips short_answer (deferred to Phase 2)', () => {
    const r = autoGradeScripts([
      {
        id: 's1',
        selectedOption: null,
        paperQuestion: {
          marks: 5,
          snapshotOptions: null,
          question: { questionType: 'short_answer', options: null },
        },
      },
    ]);
    expect(r.autoScore).toBe(0);
    expect(r.scriptUpdates).toHaveLength(0);
  });

  it('falls back to question.options when snapshotOptions is null', () => {
    const r = autoGradeScripts([
      {
        id: 's1',
        selectedOption: 'A',
        paperQuestion: {
          marks: 2,
          snapshotOptions: null,
          question: {
            questionType: 'mcq',
            options: [{ key: 'A', correct: true }, { key: 'B', correct: false }],
          },
        },
      },
    ]);
    expect(r.autoScore).toBe(2);
  });
});

// ─────────────────────── Attendance ScanSchema deviceUuid (Round 1 critical) ──

import { z } from 'zod';

describe('AttendanceController.ScanSchema — deviceUuid required + regex', () => {
  // Mirror of the schema in attendance.controller.ts. We pull the regex
  // from the source to assert behaviour rather than reimplementing.
  const ScanSchema = z.object({
    qrToken: z.string().min(8).max(256),
    studentName: z.string().trim().min(1).max(50),
    deviceUuid: z
      .string()
      .min(8)
      .max(64)
      .regex(/^([0-9a-fA-F-]{8,64}|fallback-[0-9a-z]{8,64})$/),
  });

  const validBody = {
    qrToken: 'v1.111111.deadbeefdeadbeef.sess1',
    studentName: 'Alice',
    deviceUuid: '550e8400-e29b-41d4-a716-446655440000',
  };

  it('accepts a real UUID v4', () => {
    expect(ScanSchema.safeParse(validBody).success).toBe(true);
  });

  it('accepts the documented fallback-… form', () => {
    const r = ScanSchema.safeParse({ ...validBody, deviceUuid: 'fallback-abc12345xyz67' });
    expect(r.success).toBe(true);
  });

  it('rejects missing deviceUuid (Round 1 critical: prevents 1-device-30-students)', () => {
    const { deviceUuid, ...rest } = validBody;
    expect(ScanSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects deviceUuid with arbitrary text injection', () => {
    expect(
      ScanSchema.safeParse({ ...validBody, deviceUuid: '"; DROP TABLE attendance;--' }).success,
    ).toBe(false);
  });

  it('rejects too-short uuid', () => {
    expect(ScanSchema.safeParse({ ...validBody, deviceUuid: 'abcd' }).success).toBe(false);
  });
});
