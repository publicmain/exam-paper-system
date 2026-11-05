import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), constructor: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function (options) {
    mocks.constructor(options);
    return { messages: { create: mocks.create } };
  }),
}));

import { AiService } from './ai.service';
import { AiQuestionGeneratorService } from './ai-question-generator.service';
import { AutoGraderService } from './auto-grader.service';
import { ConversationalPaperService } from './conversational-paper.service';
import { OpenAiImageService } from './openai-image.service';
import { AiTutorService } from '../ai-tutor/ai-tutor.service';
import { IeltsRepairService } from '../admin-cleanup/ielts-repair.service';
import { MorningQuizQaService } from '../morning-quiz-qa/morning-quiz-qa.service';
import { ShortAnswerEvaluatorService } from '../morning-quiz/short-answer-evaluator.service';
import { MorningQuizService } from '../morning-quiz/morning-quiz.service';

const input = { stem: 'Explain.', studentAnswer: 'A real answer.', markScheme: 'Expected idea.', maxMarks: 2 };
function services() {
  return [
    new AiService({} as any), new AiQuestionGeneratorService({} as any, {} as any, {} as any),
    new AutoGraderService({} as any), new ConversationalPaperService({} as any, {} as any, {} as any),
    new AiTutorService({} as any), new IeltsRepairService({} as any),
    new MorningQuizQaService({} as any, {} as any), new ShortAnswerEvaluatorService(),
  ];
}

beforeEach(() => {
  vi.stubEnv('OUTBOUND_ALLOW', undefined);
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-fake-for-tests');
  vi.stubEnv('OPENAI_API_KEY', 'fake-for-tests');
  vi.stubEnv('MORNING_QUIZ_AI_GRADING', 'on');
  mocks.constructor.mockReset(); mocks.create.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unexpected network call')));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('all Anthropic clients', () => {
  it('constructs zero SDK clients with keys present and default configuration', async () => {
    for (const service of services()) expect((service as any).client).toBeNull();
    expect(await new ShortAnswerEvaluatorService().evaluate(input)).toBeNull();
    expect(await new AutoGraderService({} as any).evaluate(input)).toBeNull();
    expect(mocks.constructor).toHaveBeenCalledTimes(0);
    expect(mocks.create).toHaveBeenCalledTimes(0);
    expect(fetch).toHaveBeenCalledTimes(0);
  });

  it('only constructs SDK clients after explicit allowance', () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'anthropic');
    services();
    expect(mocks.constructor).toHaveBeenCalledTimes(8);
    expect(mocks.create).toHaveBeenCalledTimes(0);
  });

  it('calls the mock SDK when allowed and returns to the manual path after revocation', async () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'anthropic');
    mocks.create.mockResolvedValue({ content: [{ type: 'text', text: '[{"id":"item","awardedMarks":1,"reasoning":"Match","confident":true}]' }], usage: {} });
    const service = new ShortAnswerEvaluatorService();
    const batch = { items: [{ id: 'item', ...input }] };
    expect((await service.evaluateBatch(batch))?.get('item')?.awardedMarks).toBe(1);
    vi.stubEnv('OUTBOUND_ALLOW', '');
    expect(await service.evaluateBatch(batch)).toBeNull();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    // The custom SDK fetch also guards delayed SDK requests and retries.
    await expect(mocks.constructor.mock.calls[0][0].fetch('https://example.invalid')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(0);
  });

  it('uses pending QA and empty label suggestions, with no fabricated success', async () => {
    const prisma = { topic: { findMany: vi.fn().mockResolvedValue([{ id: 'topic' }]) }, paper: { update: vi.fn().mockResolvedValue({}) } };
    const labels = await new AiService(prisma as any).suggestLabels({ subjectId: 's', questionStem: 'Explain.' });
    expect(labels.topicCandidates).toEqual([]);
    const qa = new MorningQuizQaService(prisma as any, {} as any);
    vi.spyOn(qa as any, 'loadReviewable').mockResolvedValue({});
    expect(await qa.reviewPaper('p', {} as any)).toMatchObject({ verdict: 'pending', model: 'skipped', costUsd: 0 });
    expect(mocks.constructor).toHaveBeenCalledTimes(0);
    expect(mocks.create).toHaveBeenCalledTimes(0);
  });

  it('fails generation and tutor requests explicitly while disabled', async () => {
    await expect(new AiQuestionGeneratorService({} as any, {} as any, {} as any).generate({} as any, {} as any)).rejects.toThrow();
    await expect(new ConversationalPaperService({} as any, {} as any, {} as any).generateFromMessage({} as any, {} as any)).rejects.toThrow();
    await expect((new AiTutorService({} as any) as any).askClaude({ ctx: {}, latestStudent: 'Help', historyMessages: [] })).rejects.toThrow();
    expect(await new IeltsRepairService({} as any).repair({})).toMatchObject({ ok: false });
    expect(mocks.create).toHaveBeenCalledTimes(0);
  });

  it('skips batch labeling without persisting invented type or difficulty', async () => {
    const update = vi.fn();
    const service = new AiService({ questionItem: {
      findMany: vi.fn().mockResolvedValue([{ id: 'item', sourceFile: { syllabusCode: '1123' }, rawExtractedText: 'Question' }]),
      update,
    } } as any);
    expect(await service.tagPendingForRepo('repo')).toMatchObject({ tagged: 0, skipped: 1 });
    expect(update).toHaveBeenCalledTimes(0);
  });
});

describe('OpenAI image boundary', () => {
  const scene = { questionId: 'q', diagramType: 'apparatus', scene: 'A sufficiently detailed diagram' } as const;
  it('blocks repeated and concurrent requests before any DB or network work', async () => {
    const db = vi.fn();
    const service = new OpenAiImageService({ question: { findUnique: db } } as any, {} as any);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => service.generateDiagram(scene, {} as any)));
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(db).toHaveBeenCalledTimes(0); expect(fetch).toHaveBeenCalledTimes(0);
  });
  it('dispatches only when allowed, using a mocked provider failure before persistence', async () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'openai');
    vi.mocked(fetch).mockResolvedValue(new Response('mock failure', { status: 503 }));
    const service = new OpenAiImageService({ question: { findUnique: vi.fn().mockResolvedValue({ id: 'q' }) }, auditLog: { findMany: vi.fn().mockResolvedValue([]) } } as any, {} as any);
    await expect(service.generateDiagram(scene, {} as any)).rejects.toThrow(/OpenAI/);
    expect(fetch).toHaveBeenCalledTimes(1); expect((service as any).pendingUsd).toBe(0);
  });
  it('rechecks after asynchronous preflight work', async () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'openai');
    const service = new OpenAiImageService({ question: { findUnique: vi.fn().mockResolvedValue({ id: 'q' }) }, auditLog: { findMany: vi.fn(async () => { vi.stubEnv('OUTBOUND_ALLOW', ''); return []; }) } } as any, {} as any);
    await expect(service.generateDiagram(scene, {} as any)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(0); expect((service as any).pendingUsd).toBe(0);
  });
});

describe('morning quiz manual queue', () => {
  it('leaves subjective answers pending with the legacy AI switch on and the gate closed', async () => {
    const evaluator = { evaluateBatch: vi.fn(), evaluate: vi.fn() };
    const service = new MorningQuizService({} as any, {} as any, {} as any, {} as any, {} as any, evaluator as any);
    const scripts = [
      { id: 'short', selectedOption: null, textAnswer: 'Student idea', paperQuestion: { marks: 2, snapshotOptions: [], question: { questionType: 'short_answer', options: [], answerContent: { text: 'Expected idea' }, content: { stem: 'Explain.' } } } },
      { id: 'mcq', selectedOption: 'A', textAnswer: null, paperQuestion: { marks: 1, snapshotOptions: [{ key: 'A', correct: true }], question: { questionType: 'mcq', options: [], answerContent: {} } } },
    ];
    const result = await (service as any).gradeScripts(scripts);
    expect(result.scriptUpdates).toContainEqual(expect.objectContaining({ id: 'short', autoCorrect: null, awardedMarks: null }));
    expect(result.scriptUpdates).toContainEqual(expect.objectContaining({ id: 'mcq', awardedMarks: 1 }));
    expect(evaluator.evaluateBatch).toHaveBeenCalledTimes(0);
    expect(evaluator.evaluate).toHaveBeenCalledTimes(0);
  });
});
