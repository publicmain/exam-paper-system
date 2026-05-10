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
import { redactSnapshotForStudent } from '../src/morning-quiz/morning-quiz.service';

describe('MorningQuizService — student view redaction (Round 1 critical + Round 3 C1)', () => {
  // Round 3 C1: redaction is now an explicit WHITELIST, not an omit-list.
  // Anything not on SAFE_SNAPSHOT_SCALAR_FIELDS or SAFE_SNAPSHOT_BANK_FIELDS
  // is dropped — including any future answer-key field.
  function stripOptions(opts: unknown) {
    if (!Array.isArray(opts)) return opts;
    return opts.map((o: any) => ({ key: o?.key, text: o?.text }));
  }

  it('strips correct flag from snapshotOptions', () => {
    const opts = [
      { key: 'A', text: '24', correct: false },
      { key: 'B', text: '42', correct: true },
      { key: 'C', text: '7', correct: false },
    ];
    for (const opt of stripOptions(opts) as any[]) {
      expect(opt).not.toHaveProperty('correct');
      expect(opt).toHaveProperty('key');
      expect(opt).toHaveProperty('text');
    }
  });

  it('strips markScheme + answerContent from snapshotContent', () => {
    const sc = {
      stem: 'Explain photosynthesis.',
      markScheme: '6CO2 + 6H2O -> C6H12O6 + 6O2 (3 marks)',
      answerContent: { text: 'plants use sunlight…' },
      passage: 'visible legitimate field',
    };
    const out = redactSnapshotForStudent(sc) as any;
    expect(out).not.toHaveProperty('markScheme');
    expect(out).not.toHaveProperty('answerContent');
    expect(out.passage).toBe('visible legitimate field');
    expect(out.stem).toBeDefined();
  });

  it('passes through null/non-object snapshotContent unchanged', () => {
    expect(redactSnapshotForStudent(null)).toBeNull();
    expect(redactSnapshotForStudent('plain string')).toBe('plain string');
    expect(redactSnapshotForStudent(undefined)).toBeUndefined();
  });

  // ─────── Round 3 C1: whitelist-vs-blacklist regression guards ───────

  it('drops correctOption / correctAnswer / exampleAnswer / explanation', () => {
    const sc = {
      stem: 'Sample stem',
      passage: 'Some passage text',
      correctOption: 'B',
      correctAnswer: 'photosynthesis',
      exampleAnswer: 'A model answer',
      explanation: 'Because…',
    };
    const out = redactSnapshotForStudent(sc) as any;
    expect(out).not.toHaveProperty('correctOption');
    expect(out).not.toHaveProperty('correctAnswer');
    expect(out).not.toHaveProperty('exampleAnswer');
    expect(out).not.toHaveProperty('explanation');
    expect(out.stem).toBe('Sample stem');
    expect(out.passage).toBe('Some passage text');
  });

  it('whitelist allows the documented UI fields', () => {
    const sc = {
      stem: 's',
      prompt: 'p',
      instruction: 'i',
      passage: 'pa',
      passageTitle: 'pt',
      taskType: 'true_false_not_given',
      contextSentence: 'cs',
      targetWord: 'tw',
      original: 'o',
      starter: 'st',
      maxWords: 12,
      uiKind: 'cloze',
    };
    const out = redactSnapshotForStudent(sc) as any;
    for (const k of Object.keys(sc)) {
      expect(out[k]).toBe((sc as any)[k]);
    }
  });

  it('strips correct flag inside headingsBank / wordBank entries', () => {
    const sc = {
      stem: 'Match the headings',
      taskType: 'matching_headings',
      headingsBank: [
        { key: 'i', text: 'A title', correct: true, internalNote: 'leak' },
        { key: 'ii', text: 'Another title', correct: false },
      ],
      wordBank: [
        { key: 'A', text: 'energy', correct: true },
      ],
    };
    const out = redactSnapshotForStudent(sc) as any;
    for (const h of out.headingsBank) {
      expect(h).not.toHaveProperty('correct');
      expect(h).not.toHaveProperty('internalNote');
      expect(h).toHaveProperty('key');
      expect(h).toHaveProperty('text');
    }
    for (const w of out.wordBank) {
      expect(w).not.toHaveProperty('correct');
    }
  });

  // FUZZ: random unknown keys must always be dropped. This is the
  // structural guarantee — any future answer-key field added to the
  // generator will be redacted automatically.
  it('fuzz: drops every unknown field, regardless of name or value type', () => {
    const SAFE_SCALAR = new Set([
      'stem', 'prompt', 'instruction', 'passage', 'passageTitle', 'taskType',
      'contextSentence', 'targetWord', 'original', 'starter', 'maxWords', 'uiKind',
    ]);
    const SAFE_BANK = new Set(['headingsBank', 'wordBank']);
    const RNG = (() => {
      let s = 1234567;
      return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    })();
    const randomKey = () => {
      const seeds = [
        'correctXxx', 'answerXxx', 'solution', 'rubric', 'modelAnswer',
        'expectedOutput', 'mark', 'totalMarks', 'gradingNotes',
        'teacherOnly', 'private', 'secret', 'leak',
        'correct_option_v2', '__answer__', 'foo', 'bar',
      ];
      return seeds[Math.floor(RNG() * seeds.length)];
    };
    const randomValue = () => {
      const v = RNG();
      if (v < 0.2) return 'a string';
      if (v < 0.4) return 42;
      if (v < 0.6) return { nested: 'object', correct: 'C' };
      if (v < 0.8) return ['list', 'of', 'things'];
      return null;
    };
    for (let trial = 0; trial < 200; trial++) {
      const sc: Record<string, unknown> = {
        stem: 'test stem',
        passage: 'test passage',
      };
      // Sprinkle 1-5 unknown fields with random names + values.
      const n = 1 + Math.floor(RNG() * 5);
      const planted: string[] = [];
      for (let i = 0; i < n; i++) {
        const k = randomKey() + (i > 0 ? `_${i}` : '');
        sc[k] = randomValue();
        planted.push(k);
      }
      const out = redactSnapshotForStudent(sc) as Record<string, unknown>;
      for (const k of Object.keys(out)) {
        if (!SAFE_SCALAR.has(k) && !SAFE_BANK.has(k)) {
          throw new Error(`fuzz failure: redaction leaked unknown key "${k}" (trial ${trial})`);
        }
      }
      // safe fields preserved
      expect(out.stem).toBe('test stem');
      expect(out.passage).toBe('test passage');
      // every planted field gone
      for (const k of planted) {
        expect(out).not.toHaveProperty(k);
      }
    }
  });
});

// ─────────────────────── autoGradeScripts (Round 1 medium) ─────────────

describe('autoGradeScripts — shared grader for finalSubmit + cron lock', () => {
  it('returns 0 marks when student picked nothing', async () => {
    const r = await autoGradeScripts([
      {
        id: 's1',
        selectedOption: null,
        textAnswer: null,
        paperQuestion: {
          marks: 4,
          snapshotOptions: [{ key: 'A', correct: true }, { key: 'B', correct: false }],
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
      },
    ]);
    expect(r.autoScore).toBe(0);
    expect(r.scriptUpdates[0].autoCorrect).toBe(false);
  });

  it('awards full marks for a correct MCQ pick', async () => {
    const r = await autoGradeScripts([
      {
        id: 's1',
        selectedOption: 'B',
        textAnswer: null,
        paperQuestion: {
          marks: 4,
          snapshotOptions: [{ key: 'A', correct: false }, { key: 'B', correct: true }],
          question: { questionType: 'mcq', options: null, answerContent: null },
        },
      },
    ]);
    expect(r.autoScore).toBe(4);
    expect(r.scriptUpdates[0]).toMatchObject({ autoCorrect: true, awardedMarks: 4 });
  });

  it('falls back to question.options when snapshotOptions is null', async () => {
    const r = await autoGradeScripts([
      {
        id: 's1',
        selectedOption: 'A',
        textAnswer: null,
        paperQuestion: {
          marks: 2,
          snapshotOptions: null,
          question: {
            questionType: 'mcq',
            options: [{ key: 'A', correct: true }, { key: 'B', correct: false }],
            answerContent: null,
          },
        },
      },
    ]);
    expect(r.autoScore).toBe(2);
  });

  // ─────── R10: short_answer auto-grading ────────

  it('R10 grades short_answer matching headings (roman numerals) — case insensitive', async () => {
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: 'II',
        paperQuestion: {
          marks: 1, snapshotOptions: null,
          question: { questionType: 'short_answer', options: null, answerContent: { text: 'ii' } },
        },
      },
    ]);
    expect(r.autoScore).toBe(1);
    expect(r.scriptUpdates[0]).toMatchObject({ autoCorrect: true, awardedMarks: 1 });
  });

  it('R10 grades short_answer matching paragraphs (single letter) — strips trailing punctuation', async () => {
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: 'D.',
        paperQuestion: {
          marks: 1, snapshotOptions: null,
          question: { questionType: 'short_answer', options: null, answerContent: { text: 'D' } },
        },
      },
    ]);
    expect(r.autoScore).toBe(1);
    expect(r.scriptUpdates[0].autoCorrect).toBe(true);
  });

  it('R10 grades short_answer multi-word labels — collapses internal whitespace', async () => {
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: 'Pendulum  Clock ',
        paperQuestion: {
          marks: 1, snapshotOptions: null,
          question: { questionType: 'short_answer', options: null, answerContent: { text: 'pendulum clock' } },
        },
      },
    ]);
    expect(r.autoScore).toBe(1);
    expect(r.scriptUpdates[0].autoCorrect).toBe(true);
  });

  it('R10 marks short_answer wrong on misspelling — no fuzzy match without aiGrader', async () => {
    // Without an AI grader, string mismatch falls through to wrong.
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: 'pendalum clock',
        paperQuestion: {
          marks: 1, snapshotOptions: null,
          question: { questionType: 'short_answer', options: null, answerContent: { text: 'pendulum clock' } },
        },
      },
    ]);
    expect(r.autoScore).toBe(0);
    expect(r.scriptUpdates[0]).toMatchObject({ autoCorrect: false, awardedMarks: 0 });
  });

  it('R10 marks short_answer wrong when student left it blank — never calls AI', async () => {
    const calls: any[] = [];
    const aiGrader = {
      evaluate: async (i: any) => { calls.push(i); return null; },
    };
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: '',
        paperQuestion: {
          marks: 1, snapshotOptions: null,
          question: { questionType: 'short_answer', options: null, answerContent: { text: 'D' } },
        },
      },
    ], aiGrader);
    expect(r.autoScore).toBe(0);
    expect(r.scriptUpdates[0].autoCorrect).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('R10 still defers long free-form short_answer to the marker (>80 char canonical)', async () => {
    const longCanonical = 'a'.repeat(120);
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: longCanonical,
        paperQuestion: {
          marks: 5, snapshotOptions: null,
          question: { questionType: 'short_answer', options: null, answerContent: { text: longCanonical } },
        },
      },
    ]);
    expect(r.autoScore).toBe(0);
    expect(r.scriptUpdates).toHaveLength(0); // marker queue
  });

  it('R10 defers short_answer with no canonical answer (still uncategorised)', async () => {
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: 'something',
        paperQuestion: {
          marks: 1, snapshotOptions: null,
          question: { questionType: 'short_answer', options: null, answerContent: null },
        },
      },
    ]);
    expect(r.scriptUpdates).toHaveLength(0);
  });

  // ─────── R10: AI grader fallback for paraphrase / typo ────────

  it('R10 AI grader credits paraphrase that string match would reject', async () => {
    const aiGrader = {
      evaluate: async (i: any) => ({
        awardedMarks: 1,
        reasoning: '"the fat beneath the shell" is the same as the canonical "fat beneath shell" with optional articles.',
        confident: true,
      }),
    };
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: 'the fat beneath the shell',
        paperQuestion: {
          marks: 1, snapshotOptions: null,
          question: {
            questionType: 'short_answer', options: null,
            answerContent: { text: 'fat beneath shell' },
            content: { stem: 'Where does the green turtle get its name from?' },
          },
        },
      },
    ], aiGrader);
    expect(r.autoScore).toBe(1);
    expect(r.scriptUpdates[0]).toMatchObject({ autoCorrect: true, awardedMarks: 1 });
    expect(r.scriptUpdates[0].aiReason).toMatch(/canonical/);
  });

  it('R10 AI grader rejects clearly wrong answer', async () => {
    const aiGrader = {
      evaluate: async () => ({ awardedMarks: 0, reasoning: 'Off-topic.', confident: true }),
    };
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: 'because they are green',
        paperQuestion: {
          marks: 1, snapshotOptions: null,
          question: {
            questionType: 'short_answer', options: null,
            answerContent: { text: 'fat beneath shell' },
          },
        },
      },
    ], aiGrader);
    expect(r.autoScore).toBe(0);
    expect(r.scriptUpdates[0].autoCorrect).toBe(false);
  });

  it('R10 AI grader returning null is treated as wrong (no over-credit)', async () => {
    const aiGrader = { evaluate: async () => null };
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: 'something',
        paperQuestion: {
          marks: 1, snapshotOptions: null,
          question: { questionType: 'short_answer', options: null, answerContent: { text: 'D' } },
        },
      },
    ], aiGrader);
    expect(r.autoScore).toBe(0);
    expect(r.scriptUpdates[0].autoCorrect).toBe(false);
  });

  it('R10 AI grader is NOT called when string match already passes — saves cost', async () => {
    let called = 0;
    const aiGrader = { evaluate: async () => { called++; return null; } };
    const r = await autoGradeScripts([
      {
        id: 's1', selectedOption: null, textAnswer: 'D.',
        paperQuestion: {
          marks: 1, snapshotOptions: null,
          question: { questionType: 'short_answer', options: null, answerContent: { text: 'D' } },
        },
      },
    ], aiGrader);
    expect(r.scriptUpdates[0].autoCorrect).toBe(true);
    expect(called).toBe(0);
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

// ───────── Round-4: Excel export workbook generation ─────────────────
import { MorningQuizExportService } from '../src/morning-quiz/morning-quiz-export.service';
import * as ExcelJS from 'exceljs';

describe('MorningQuizExportService.generateAttendanceWorkbook', () => {
  function makePrismaStub() {
    const sessions = [
      {
        id: 's1',
        date: new Date('2026-05-04T00:00:00Z'),
        classId: 'c1',
        class: { id: 'c1', name: 'P5A' },
        paperAssignment: { paperId: 'paper-1' },
      },
      {
        id: 's2',
        date: new Date('2026-05-05T00:00:00Z'),
        classId: 'c1',
        class: { id: 'c1', name: 'P5A' },
        paperAssignment: { paperId: 'paper-1' },
      },
    ];
    const attendances = [
      {
        id: 'a1',
        sessionId: 's1',
        studentId: 'stu-1',
        student: { id: 'stu-1', name: 'Alice' },
        status: 'on_time',
        scanTime: new Date('2026-05-04T00:30:00Z'),
        submissionId: 'sub-1',
      },
      {
        id: 'a2',
        sessionId: 's2',
        studentId: 'stu-1',
        student: { id: 'stu-1', name: 'Alice' },
        status: 'absent',
        scanTime: null,
        submissionId: null,
      },
      {
        id: 'a3',
        sessionId: 's1',
        studentId: 'stu-2',
        student: { id: 'stu-2', name: 'Bob' },
        status: 'late',
        scanTime: new Date('2026-05-04T00:35:00Z'),
        submissionId: 'sub-2',
      },
    ];
    const submissions = [
      {
        id: 'sub-1',
        submittedAt: new Date('2026-05-04T01:00:00Z'),
        scripts: [
          { paperQuestionId: 'pq-1', selectedOption: 'A', autoCorrect: true, awardedMarks: 1 },
          { paperQuestionId: 'pq-2', selectedOption: 'B', autoCorrect: false, awardedMarks: 0 },
        ],
      },
      {
        id: 'sub-2',
        submittedAt: null,
        scripts: [
          { paperQuestionId: 'pq-1', selectedOption: 'A', autoCorrect: true, awardedMarks: 1 },
        ],
      },
    ];
    return {
      morningQuizSession: { findMany: vi.fn().mockResolvedValue(sessions) },
      attendance: { findMany: vi.fn().mockResolvedValue(attendances) },
      studentSubmission: { findMany: vi.fn().mockResolvedValue(submissions) },
    };
  }

  it('produces an .xlsx with three named sheets and the expected row counts', async () => {
    const audit = { log: vi.fn().mockResolvedValue(undefined) } as any;
    const svc = new MorningQuizExportService(makePrismaStub() as any, audit);
    const buf = await svc.generateAttendanceWorkbook(
      { from: '2026-05-04', to: '2026-05-08' },
      { id: 'admin-1', role: 'admin', ip: null },
    );
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(2000); // workbook bytes
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual(
      expect.arrayContaining([
        '考勤明细 Attendance',
        '成绩明细 Scores',
        '缺勤汇总 Absences',
      ]),
    );
    const att = wb.getWorksheet('考勤明细 Attendance')!;
    // 1 header + 3 attendance rows
    expect(att.rowCount).toBe(4);
    const scores = wb.getWorksheet('成绩明细 Scores')!;
    // 1 header + 2 submitted rows (a1 and a3, not a2 which has no submission)
    expect(scores.rowCount).toBe(3);
    const summary = wb.getWorksheet('缺勤汇总 Absences')!;
    // 1 header + 2 distinct students
    expect(summary.rowCount).toBe(3);
    expect(audit.log).toHaveBeenCalled();
  });

  it('refuses non-teacher roles', async () => {
    const audit = { log: vi.fn() } as any;
    const svc = new MorningQuizExportService({} as any, audit);
    await expect(
      svc.generateAttendanceWorkbook(
        { from: '2026-05-04', to: '2026-05-08' },
        { id: 'stu-1', role: 'student', ip: null },
      ),
    ).rejects.toThrow();
  });
});

// ───────── Round-4: AbsenceAlertService streak detection ─────────────
import { AbsenceAlertService } from '../src/morning-quiz/absence-alert.service';
import { AttendanceStatus } from '@prisma/client';

describe('AbsenceAlertService.findCurrentStreaks', () => {
  function makePrismaWith(records: Array<{ studentId: string; date: string; status: AttendanceStatus; className?: string }>) {
    // Group records into sessions by date+class.
    const byDateClass = new Map<string, any>();
    for (const r of records) {
      const cls = r.className ?? 'C1';
      const key = `${cls}::${r.date}`;
      const sess = byDateClass.get(key) ?? {
        id: `sess-${key}`,
        date: new Date(`${r.date}T00:00:00Z`),
        classId: cls,
        class: { id: cls, name: cls },
        attendances: [] as any[],
      };
      sess.attendances.push({
        studentId: r.studentId,
        status: r.status,
        student: { id: r.studentId, name: r.studentId },
      });
      byDateClass.set(key, sess);
    }
    const sessions = Array.from(byDateClass.values());
    return {
      morningQuizSession: { findMany: vi.fn().mockResolvedValue(sessions) },
    };
  }

  it('flags a student with 3 consecutive absent days', async () => {
    const records: Array<{ studentId: string; date: string; status: AttendanceStatus }> = [
      { studentId: 'alice', date: '2026-05-05', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-06', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-07', status: AttendanceStatus.absent },
    ];
    const svc = new AbsenceAlertService(
      makePrismaWith(records) as any,
      { fire: vi.fn() } as any,
      { log: vi.fn() } as any,
    );
    const streaks = await svc.findCurrentStreaks(3, new Date('2026-05-07T12:00:00Z'));
    expect(streaks).toHaveLength(1);
    expect(streaks[0].studentId).toBe('alice');
    expect(streaks[0].consecutiveDays).toBe(3);
  });

  it('does NOT flag a student who returned (absent run was broken)', async () => {
    const records: Array<{ studentId: string; date: string; status: AttendanceStatus }> = [
      { studentId: 'alice', date: '2026-05-04', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-05', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-06', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-07', status: AttendanceStatus.on_time },
    ];
    const svc = new AbsenceAlertService(
      makePrismaWith(records) as any,
      { fire: vi.fn() } as any,
      { log: vi.fn() } as any,
    );
    const streaks = await svc.findCurrentStreaks(3, new Date('2026-05-07T12:00:00Z'));
    expect(streaks).toHaveLength(0);
  });

  it('flags only the longer streak when threshold is crossed', async () => {
    const records: Array<{ studentId: string; date: string; status: AttendanceStatus }> = [
      // alice: streak of 4 ending today
      { studentId: 'alice', date: '2026-05-04', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-05', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-06', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-07', status: AttendanceStatus.absent },
      // bob: 1 absent only
      { studentId: 'bob', date: '2026-05-07', status: AttendanceStatus.absent },
    ];
    const svc = new AbsenceAlertService(
      makePrismaWith(records) as any,
      { fire: vi.fn() } as any,
      { log: vi.fn() } as any,
    );
    const streaks = await svc.findCurrentStreaks(3, new Date('2026-05-07T12:00:00Z'));
    expect(streaks).toHaveLength(1);
    expect(streaks[0].studentId).toBe('alice');
    expect(streaks[0].consecutiveDays).toBe(4);
  });
});

describe('AbsenceAlertService.runOnce dedup', () => {
  it('does not re-fire when the same student already alerted within 7 days at the same streak', async () => {
    const records = [
      { studentId: 'alice', date: '2026-05-05', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-06', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-07', status: AttendanceStatus.absent },
    ];
    const byDateClass = new Map<string, any>();
    for (const r of records) {
      const key = `C1::${r.date}`;
      const sess = byDateClass.get(key) ?? {
        id: `sess-${key}`,
        date: new Date(`${r.date}T00:00:00Z`),
        classId: 'C1',
        class: { id: 'C1', name: 'C1' },
        attendances: [],
      };
      sess.attendances.push({
        studentId: r.studentId,
        status: r.status,
        student: { id: r.studentId, name: r.studentId },
      });
      byDateClass.set(key, sess);
    }
    const sessions = Array.from(byDateClass.values());
    const fire = vi.fn();
    const auditLog = vi.fn();
    const prisma = {
      morningQuizSession: { findMany: vi.fn().mockResolvedValue(sessions) },
      auditLog: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'al-1',
          action: 'absence_alert.fired',
          entityId: 'alice',
          metadata: { consecutiveDays: 3 },
          createdAt: new Date(Date.now() - 1 * 24 * 3600_000),
        }),
      },
    } as any;
    const svc = new AbsenceAlertService(prisma, { fire } as any, { log: auditLog } as any);
    const result = await svc.runOnce();
    expect(result.fired).toBe(0);
    expect(result.skippedDedup).toBe(1);
    expect(fire).not.toHaveBeenCalled();
  });

  it('DOES re-fire when streak got longer since last alert', async () => {
    const records = [
      { studentId: 'alice', date: '2026-05-04', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-05', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-06', status: AttendanceStatus.absent },
      { studentId: 'alice', date: '2026-05-07', status: AttendanceStatus.absent },
    ];
    const byDateClass = new Map<string, any>();
    for (const r of records) {
      const key = `C1::${r.date}`;
      const sess = byDateClass.get(key) ?? {
        id: `sess-${key}`,
        date: new Date(`${r.date}T00:00:00Z`),
        classId: 'C1',
        class: { id: 'C1', name: 'C1' },
        attendances: [],
      };
      sess.attendances.push({
        studentId: r.studentId,
        status: r.status,
        student: { id: r.studentId, name: r.studentId },
      });
      byDateClass.set(key, sess);
    }
    const sessions = Array.from(byDateClass.values());
    const fire = vi.fn().mockResolvedValue([{}]);
    const auditLog = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      morningQuizSession: { findMany: vi.fn().mockResolvedValue(sessions) },
      auditLog: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'al-1',
          action: 'absence_alert.fired',
          entityId: 'alice',
          metadata: { consecutiveDays: 3 }, // last alert was at 3, now we're at 4
          createdAt: new Date(Date.now() - 1 * 24 * 3600_000),
        }),
      },
    } as any;
    const svc = new AbsenceAlertService(prisma, { fire } as any, { log: auditLog } as any);
    const result = await svc.runOnce();
    expect(result.fired).toBe(1);
    expect(fire).toHaveBeenCalledWith(
      'consecutive_absent',
      expect.objectContaining({ studentId: 'alice', consecutiveDays: 4 }),
    );
  });
});

// ───────── Round-4: ShortAnswerEvaluatorService ─────────
import { ShortAnswerEvaluatorService } from '../src/morning-quiz/short-answer-evaluator.service';

describe('ShortAnswerEvaluatorService', () => {
  it('returns null when ANTHROPIC_API_KEY is not configured (stub mode)', async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = '';
    try {
      const svc = new ShortAnswerEvaluatorService();
      const out = await svc.evaluate({
        stem: 'Define photosynthesis.',
        studentAnswer: 'Plants make food from sunlight.',
        markScheme: '1 mark for "convert sunlight" or equivalent.',
        maxMarks: 2,
      });
      expect(out).toBeNull();
    } finally {
      process.env.ANTHROPIC_API_KEY = prev ?? '';
    }
  });

  it('shortcuts a blank answer to 0 with high confidence (no API call)', async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-but-not-stub';
    try {
      const svc = new ShortAnswerEvaluatorService();
      const out = await svc.evaluate({
        stem: 'Define photosynthesis.',
        studentAnswer: '',
        markScheme: 'X',
        maxMarks: 2,
      });
      expect(out?.awardedMarks).toBe(0);
      expect(out?.confident).toBe(true);
    } finally {
      process.env.ANTHROPIC_API_KEY = prev ?? '';
    }
  });

  it('returns null when no markScheme is provided', async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fake';
    try {
      const svc = new ShortAnswerEvaluatorService();
      const out = await svc.evaluate({
        stem: 'X',
        studentAnswer: 'Y',
        markScheme: '',
        maxMarks: 1,
      });
      expect(out).toBeNull();
    } finally {
      process.env.ANTHROPIC_API_KEY = prev ?? '';
    }
  });
});

// ───────── Round-4: MorningQuizWeeklyCron weekStart calc ─────────
import { MorningQuizWeeklyCron } from '../src/morning-quiz/morning-quiz-weekly-cron';

describe('MorningQuizWeeklyCron.runOnce', () => {
  it('skips work when no class has an English level', async () => {
    const cron = new MorningQuizWeeklyCron(
      { classEnglishLevel: { findMany: vi.fn().mockResolvedValue([]) } } as any,
      { batchGenerateForWeek: vi.fn() } as any,
      { fire: vi.fn() } as any,
    );
    const out = await cron.runOnce();
    expect(out.classesAttempted).toBe(0);
  });

  it('calls batchGenerateForWeek with the upcoming Monday and counts ok=true outcomes as succeeded', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ classId: 'C1' }, { classId: 'C2' }]);
    // Real batchGenerateForWeek returns { outcomes: Outcome[] } where each
    // outcome has ok:true | ok:false. The cron previously read `items` and
    // a non-existent `error` field, so this test now pins the real shape.
    const batchGenerate = vi.fn().mockResolvedValue({
      outcomes: [
        { ok: true, date: '2026-05-11', classId: 'C1', sessionId: 's1', paperId: 'p1' },
        { ok: true, date: '2026-05-11', classId: 'C2', sessionId: 's2', paperId: 'p2' },
      ],
    });
    const fire = vi.fn();
    const cron = new MorningQuizWeeklyCron(
      { classEnglishLevel: { findMany } } as any,
      { batchGenerateForWeek: batchGenerate } as any,
      { fire } as any,
    );
    const out = await cron.runOnce();
    expect(batchGenerate).toHaveBeenCalledTimes(1);
    const call = batchGenerate.mock.calls[0][0];
    expect(call.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.classIds).toEqual(['C1', 'C2']);
    expect(out.classesSucceeded).toBe(2);
    expect(out.classesFailed).toBe(0);
    expect(fire).not.toHaveBeenCalled();
  });

  it('fires notify when batch errors are returned (ok:false outcomes)', async () => {
    const findMany = vi.fn().mockResolvedValue([{ classId: 'C1' }]);
    const batchGenerate = vi.fn().mockResolvedValue({
      outcomes: [
        { ok: false, date: '2026-05-11', classId: 'C1', code: 'AI_TIMEOUT', detail: 'Anthropic 529' },
      ],
    });
    const fire = vi.fn().mockResolvedValue(undefined);
    const cron = new MorningQuizWeeklyCron(
      { classEnglishLevel: { findMany } } as any,
      { batchGenerateForWeek: batchGenerate } as any,
      { fire } as any,
    );
    const out = await cron.runOnce();
    expect(out.classesSucceeded).toBe(0);
    expect(out.classesFailed).toBe(1);
    expect(fire).toHaveBeenCalledWith(
      'morning_quiz_cron_failed',
      expect.objectContaining({ failed: 1 }),
    );
  });
});
