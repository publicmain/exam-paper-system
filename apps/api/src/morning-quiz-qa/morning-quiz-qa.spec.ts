import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MorningQuizQaService } from './morning-quiz-qa.service';

/**
 * The service touches Prisma + the Anthropic SDK. We stub both so the suite
 * runs offline. Each test injects a Claude tool-use response of its choosing
 * via the (private) `client` field — straightforward TS hack since we own
 * both sides of the boundary.
 */

function fakeAuditService() {
  return { log: vi.fn().mockResolvedValue(undefined) } as any;
}

function fakePrisma(overrides?: { paper?: any }) {
  const updateCalls: any[] = [];
  const paper = {
    id: 'paper-1',
    name: 'Morning Quiz IELTS/8/Test1/P1 (2026-05-12)',
    config: { mode: 'passage_pick', passageRef: 'IELTS/8/Test1/P1' },
    component: { code: 'AUTH' },
    subject: { code: 'IELTS' },
    assignments: [
      { class: { englishLevel: { level: 'ielts_authentic' } } },
    ],
    questions: [
      {
        sortOrder: 1,
        marks: 1,
        snapshotContent: {
          stem: 'According to the passage, what year did the bridge open?',
          passage:
            'The Tower Bridge in London officially opened on 30 June 1894 after eight years of construction. The bridge was designed by Sir Horace Jones, who unfortunately died before its completion. Today the bridge remains one of the city most recognisable landmarks. ' +
            'Its bascules were originally driven by steam-powered hydraulics, but the system was electrified in 1972, drastically reducing the time and effort required for each opening. The bridge carries about 40,000 vehicles per day across the River Thames.',
        },
        snapshotAnswer: { text: '1894' },
        snapshotOptions: [],
        question: { questionType: 'short_answer' },
      },
      {
        sortOrder: 2,
        marks: 1,
        snapshotContent: {
          stem: 'Who designed the bridge?',
        },
        snapshotAnswer: { text: 'Sir Horace Jones' },
        snapshotOptions: [],
        question: { questionType: 'short_answer' },
      },
    ],
    ...overrides?.paper,
  };
  return {
    paper: {
      findUnique: vi.fn().mockResolvedValue(paper),
      update: vi.fn().mockImplementation((args: any) => {
        updateCalls.push(args);
        return Promise.resolve({ ...paper, ...args.data });
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    _updateCalls: updateCalls,
  } as any;
}

function fakeClient(toolInput: any) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            name: 'submit_review',
            input: toolInput,
          },
        ],
        usage: { input_tokens: 1234, output_tokens: 240 },
      }),
    },
  } as any;
}

describe('MorningQuizQaService', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-fake-key-1234567890';
  });

  it('verdict=pass — clean paper writes pass + zero issues', async () => {
    const prisma = fakePrisma();
    const svc = new MorningQuizQaService(prisma, fakeAuditService());
    (svc as any).client = fakeClient({
      overall_verdict: 'pass',
      summary: '未发现问题',
      issues: [],
    });

    const result = await svc.reviewPaper('paper-1', { id: 'u1', role: 'admin', ip: null });

    expect(result.verdict).toBe('pass');
    expect(result.issues).toHaveLength(0);
    expect(result.summary).toBe('未发现问题');
    expect(result.inputTokens).toBe(1234);
    // Sonnet pricing: 1234*3/1e6 + 240*15/1e6 = 0.003702 + 0.0036 = 0.007302 ≈ 0.0073
    expect(result.costUsd).toBeCloseTo(0.0073, 4);
    const update = prisma._updateCalls[0];
    expect(update.data.qaReviewVerdict).toBe('pass');
    expect(update.data.qaReviewIssues).toEqual([]);
  });

  it('verdict=needs_review — high-severity issue routes through teacher gate', async () => {
    const prisma = fakePrisma();
    const svc = new MorningQuizQaService(prisma, fakeAuditService());
    (svc as any).client = fakeClient({
      overall_verdict: 'needs_review',
      summary: 'Q2 措辞略歧义',
      issues: [
        {
          type: 'question_ambiguous',
          severity: 'high',
          questionRef: 'Q2',
          description: '题干"who designed"也可指多个工程师',
          evidence: 'Who designed the bridge?',
          suggestedFix: '改为 "Who was the principal designer?"',
        },
      ],
    });

    const result = await svc.reviewPaper('paper-1', { id: 'u1', role: 'admin', ip: null });
    expect(result.verdict).toBe('needs_review');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('high');
  });

  it('verdict=reject — critical issue blocks paper', async () => {
    const prisma = fakePrisma();
    const svc = new MorningQuizQaService(prisma, fakeAuditService());
    (svc as any).client = fakeClient({
      overall_verdict: 'reject',
      summary: 'Q1 答案错误',
      issues: [
        {
          type: 'answer_wrong',
          severity: 'critical',
          questionRef: 'Q1',
          description: '答案标 1894 但题干问的是建造起始年份(1886)',
          evidence: 'after eight years of construction',
          suggestedFix: '把答案改为 1886,或题干改为 opened',
        },
      ],
    });

    const result = await svc.reviewPaper('paper-1', { id: 'u1', role: 'admin', ip: null });
    expect(result.verdict).toBe('reject');
    expect(result.issues).toHaveLength(1);
  });

  it('reconciles inconsistent verdicts: pass with critical issue → reject', async () => {
    const prisma = fakePrisma();
    const svc = new MorningQuizQaService(prisma, fakeAuditService());
    (svc as any).client = fakeClient({
      overall_verdict: 'pass', // Claude misjudged
      summary: 'looks fine',
      issues: [
        {
          type: 'answer_wrong',
          severity: 'critical',
          questionRef: 'Q1',
          description: 'X',
          evidence: 'Y',
          suggestedFix: 'Z',
        },
      ],
    });

    const result = await svc.reviewPaper('paper-1', { id: 'u1', role: 'admin', ip: null });
    // Defensive override — having any critical issue forces reject regardless
    // of what Claude wrote in overall_verdict.
    expect(result.verdict).toBe('reject');
  });

  it('reconciles inconsistent verdicts: pass with high issue → needs_review', async () => {
    const prisma = fakePrisma();
    const svc = new MorningQuizQaService(prisma, fakeAuditService());
    (svc as any).client = fakeClient({
      overall_verdict: 'pass',
      summary: 'looks fine',
      issues: [
        {
          type: 'question_ambiguous',
          severity: 'high',
          questionRef: 'Q1',
          description: 'X',
          evidence: 'Y',
          suggestedFix: 'Z',
        },
      ],
    });
    const result = await svc.reviewPaper('paper-1', { id: 'u1', role: 'admin', ip: null });
    expect(result.verdict).toBe('needs_review');
  });

  it('skips when ANTHROPIC_API_KEY is unset (verdict=pending)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const prisma = fakePrisma();
    const svc = new MorningQuizQaService(prisma, fakeAuditService());
    // Confirm constructor decided not to wire a client.
    expect((svc as any).client).toBeNull();

    const result = await svc.reviewPaper('paper-1', { id: 'u1', role: 'admin', ip: null });
    expect(result.verdict).toBe('pending');
    expect(result.summary).toContain('ANTHROPIC_API_KEY');
    expect(prisma._updateCalls[0].data.qaReviewModel).toBe('skipped');
  });

  it('buildUserMessage includes the passage, every Q, and answer keys', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-fake-key-1234567890';
    const svc = new MorningQuizQaService(fakePrisma(), fakeAuditService());
    const out = svc.buildUserMessage({
      paperId: 'p1',
      paperName: 'P',
      level: 'ielts_authentic',
      mode: 'passage_pick',
      passageRef: 'IELTS/8/Test1/P1',
      passageText:
        'The Tower Bridge in London officially opened on 30 June 1894 after eight years of construction.',
      questions: [
        {
          sortOrder: 1,
          type: 'mcq',
          marks: 1,
          stem: 'When did the bridge open?',
          options: [
            { key: 'A', text: '1886' },
            { key: 'B', text: '1894' },
            { key: 'C', text: '1972' },
          ],
          correctAnswer: 'B',
        },
      ],
    });
    expect(out).toContain('Tower Bridge');
    expect(out).toContain('Q1.');
    expect(out).toContain('A) 1886');
    expect(out).toContain('Correct: B');
    expect(out).toContain('IELTS/8/Test1/P1');
    expect(out).toContain('passage_pick');
  });

  it('B1 fallback — verdict=reject + issues=[] triggers second-pass extraction', async () => {
    const prisma = fakePrisma();
    const svc = new MorningQuizQaService(prisma, fakeAuditService());
    // First Anthropic call: stuff detail in summary, leave issues empty.
    // Second Anthropic call (fallback): return one synthesised issue.
    const create = vi.fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'submit_review',
            input: {
              overall_verdict: 'reject',
              summary: 'Q1 答案错误:文中说桥 1894 年开放,但答案标 1972',
              issues: [],
            },
          },
        ],
        usage: { input_tokens: 2400, output_tokens: 900 },
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'submit_issues',
            input: {
              issues: [
                {
                  type: 'answer_wrong',
                  severity: 'critical',
                  questionRef: 'Q1',
                  description: '答案标 1972 与原文 1894 不符',
                  evidence: 'officially opened on 30 June 1894',
                  suggestedFix: '把答案改成 1894',
                },
              ],
            },
          },
        ],
        usage: { input_tokens: 320, output_tokens: 110 },
      });
    (svc as any).client = { messages: { create } };

    const result = await svc.reviewPaper('paper-1', { id: 'u1', role: 'admin', ip: null });
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.verdict).toBe('reject'); // verdict preserved (not flipped by fallback)
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].questionRef).toBe('Q1');
    expect(result.issues[0].evidence).toContain('1894');
    // Tokens accumulated across both calls.
    expect(result.inputTokens).toBe(2400 + 320);
    expect(result.outputTokens).toBe(900 + 110);
  });

  it('B1 fallback — needs_review with empty issues also triggers second pass', async () => {
    const prisma = fakePrisma();
    const svc = new MorningQuizQaService(prisma, fakeAuditService());
    const create = vi.fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'submit_review',
            input: {
              overall_verdict: 'needs_review',
              summary: 'Q3 题干歧义需要老师确认',
              issues: [],
            },
          },
        ],
        usage: { input_tokens: 1500, output_tokens: 200 },
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'submit_issues',
            input: {
              issues: [
                {
                  type: 'question_ambiguous',
                  severity: 'high',
                  questionRef: 'Q3',
                  description: '题干没有限定时间范围',
                  evidence: 'Who designed the bridge?',
                  suggestedFix: '加上 "originally"',
                },
              ],
            },
          },
        ],
        usage: { input_tokens: 280, output_tokens: 90 },
      });
    (svc as any).client = { messages: { create } };

    const result = await svc.reviewPaper('paper-1', { id: 'u1', role: 'admin', ip: null });
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.verdict).toBe('needs_review');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('high');
  });

  it('B1 fallback — verdict=pass with empty issues does NOT trigger fallback', async () => {
    const prisma = fakePrisma();
    const svc = new MorningQuizQaService(prisma, fakeAuditService());
    const create = vi.fn().mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          name: 'submit_review',
          input: { overall_verdict: 'pass', summary: '未发现问题', issues: [] },
        },
      ],
      usage: { input_tokens: 1234, output_tokens: 240 },
    });
    (svc as any).client = { messages: { create } };

    const result = await svc.reviewPaper('paper-1', { id: 'u1', role: 'admin', ip: null });
    expect(create).toHaveBeenCalledTimes(1); // only the original call
    expect(result.verdict).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('B1 fallback — graceful when fallback call itself fails', async () => {
    const prisma = fakePrisma();
    const svc = new MorningQuizQaService(prisma, fakeAuditService());
    const create = vi.fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'submit_review',
            input: {
              overall_verdict: 'reject',
              summary: 'Q1 broken',
              issues: [],
            },
          },
        ],
        usage: { input_tokens: 1000, output_tokens: 100 },
      })
      .mockRejectedValueOnce(new Error('API timeout'));
    (svc as any).client = { messages: { create } };

    const result = await svc.reviewPaper('paper-1', { id: 'u1', role: 'admin', ip: null });
    expect(create).toHaveBeenCalledTimes(2);
    // Verdict + summary preserved; issues stays empty (no exception thrown).
    expect(result.verdict).toBe('reject');
    expect(result.issues).toHaveLength(0);
    expect(result.summary).toBe('Q1 broken');
  });

  it('B2 calibration — system prompt mentions matching task strict-but-correct rules', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const url = await import('url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.join(here, 'morning-quiz-qa.service.ts'), 'utf8');
    expect(src).toContain('Matching task 校准');
    expect(src).toContain('难度梯度');
    expect(src).toContain('summary 与 issues 的关系');
  });

  it('B1 prompt contract — system prompt forbids summary-only detail', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const url = await import('url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.join(here, 'morning-quiz-qa.service.ts'), 'utf8');
    expect(src).toContain('禁止');
    expect(src).toContain('issues[]');
    // The contract sentence specifically.
    expect(src).toMatch(/summary.*detail.*issues|issues.*必须.*包含|具体题号/);
  });

  it('parseToolInput sanitizes bad enum values without throwing', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-fake-key-1234567890';
    const svc = new MorningQuizQaService(fakePrisma(), fakeAuditService());
    const parsed = svc.parseToolInput({
      overall_verdict: 'PASS', // wrong case
      summary: 'ok',
      issues: [
        { type: 'invented_type', severity: 'meh', questionRef: 'Q1', description: 'd', evidence: 'e', suggestedFix: 'f' },
        null,
      ],
    });
    // Verdict normalised: PASS isn't an exact match → falls through to needs_review,
    // then reconciler keeps it (no critical/high in normalised issues).
    // We assert what *did* survive and move on.
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0].type).toBe('format');
    expect(parsed.issues[0].severity).toBe('medium');
  });
});
