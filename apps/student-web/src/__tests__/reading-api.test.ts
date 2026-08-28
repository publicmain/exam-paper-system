/**
 * AC-02 —— 阅读三端点的**请求形状**。
 *
 * 全部打桩 `fetch` 并断言**方法、完整 URL、请求头、序列化后的请求体**。
 * 不看源码字符串 —— 只看真的发出去了什么。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, ApiError, NetworkError } from '../lib/api';

type Call = { url: string; init: RequestInit };

function stubFetch(status: number, body: unknown): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(body),
      } as unknown as Response;
    }),
  );
  return calls;
}

const SID = 'sess-1';

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('AC-02 加载会话', () => {
  it('**GET /api/morning-quiz/sessions/:id**，带 Bearer，无请求体', async () => {
    const calls = stubFetch(200, { sessionId: SID, questions: [], existingAnswers: {} });
    await api.getReadingSession('TK', SID);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/morning-quiz/sessions/sess-1');
    expect(calls[0].init.method).toBe('GET');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer TK');
    expect(calls[0].init.body).toBeUndefined();
  });

  it('**URL 没有任何子路径** —— 不是 /student-view（S7A 返工 2/2 的教训）', async () => {
    const calls = stubFetch(200, { existingAnswers: {} });
    await api.getReadingSession('TK', SID);
    expect(calls[0].url).not.toMatch(/student-view/);
    expect(calls[0].url.split('/api/morning-quiz/sessions/')[1]).toBe('sess-1');
  });

  it('sessionId 被 URL 编码，不能拼出越权路径', async () => {
    const calls = stubFetch(200, { existingAnswers: {} });
    await api.getReadingSession('TK', 'a/../b');
    expect(calls[0].url).toBe('/api/morning-quiz/sessions/a%2F..%2Fb');
  });

  it('**响应字段全部透出**：existingAnswers 的四个字段一个不少', async () => {
    stubFetch(200, {
      sessionId: SID,
      submissionId: 'sub-1',
      quizEnd: '2026-08-28T23:59:00.000Z',
      regularQuizEnd: '2026-08-28T09:00:00.000Z',
      secondWindowToday: false,
      questions: [{ id: 'q1', sortOrder: 1, marks: 1, questionType: 'mcq', snapshotContent: {}, snapshotOptions: [] }],
      existingAnswers: {
        q1: { content: 'A', selectedOption: 'A', textAnswer: null, clientSeq: 3, flagged: false },
      },
    });
    const r = await api.getReadingSession('TK', SID);
    expect(r.submissionId).toBe('sub-1');
    expect(r.quizEnd).toBe('2026-08-28T23:59:00.000Z');
    expect(r.secondWindowToday).toBe(false);
    expect(r.questions).toHaveLength(1);
    expect(r.existingAnswers.q1.selectedOption).toBe('A');
    expect(r.existingAnswers.q1.textAnswer).toBeNull();
    expect(r.existingAnswers.q1.clientSeq).toBe(3);
    expect(r.existingAnswers.q1.flagged).toBe(false);
  });

  it('403 no_lesson_started → ApiError，不是静默空会话', async () => {
    stubFetch(403, { code: 'no_lesson_started' });
    await expect(api.getReadingSession('TK', SID)).rejects.toBeInstanceOf(ApiError);
  });

  it('断网 → NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api.getReadingSession('TK', SID)).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('AC-02 逐题保存', () => {
  it('**PATCH /api/morning-quiz/sessions/:id/answer**，请求体逐字段', async () => {
    const calls = stubFetch(200, { applied: true, clientSeq: 4 });
    await api.saveReadingAnswer('TK', SID, {
      paperQuestionId: 'q1',
      selectedOption: 'B',
      textAnswer: null,
      clientSeq: 4,
    });
    expect(calls[0].url).toBe('/api/morning-quiz/sessions/sess-1/answer');
    expect(calls[0].init.method).toBe('PATCH');
    const h = calls[0].init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer TK');
    expect(h['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      paperQuestionId: 'q1',
      selectedOption: 'B',
      textAnswer: null,
      clientSeq: 4,
    });
  });

  it('**null 会被真的序列化出去**，不是被 JSON.stringify 丢掉', async () => {
    const calls = stubFetch(200, { applied: true, clientSeq: 1 });
    await api.saveReadingAnswer('TK', SID, {
      paperQuestionId: 'q1',
      selectedOption: null,
      textAnswer: 'hello',
      clientSeq: 1,
    });
    const body = JSON.parse(String(calls[0].init.body));
    expect('selectedOption' in body).toBe(true);
    expect(body.selectedOption).toBeNull();
    expect(body.textAnswer).toBe('hello');
  });

  it('**请求体里没有任何身份字段**', async () => {
    const calls = stubFetch(200, { applied: true, clientSeq: 1 });
    await api.saveReadingAnswer('TK', SID, {
      paperQuestionId: 'q1',
      selectedOption: 'A',
      textAnswer: null,
      clientSeq: 1,
    });
    const raw = String(calls[0].init.body);
    expect(raw).not.toMatch(/"name"|"studentName"|"studentId"/);
    expect(calls[0].url).not.toMatch(/[?&](name|studentId)=/);
  });

  it('**superseded 结果原样透出**（applied:false + 服务端现值）', async () => {
    stubFetch(200, { applied: false, superseded: true, clientSeq: 9, updatedAt: 'x' });
    const r = await api.saveReadingAnswer('TK', SID, {
      paperQuestionId: 'q1', selectedOption: null, textAnswer: 'a', clientSeq: 2,
    });
    expect(r.applied).toBe(false);
    expect(r.superseded).toBe(true);
    expect(r.clientSeq).toBe(9);
  });
});

describe('AC-02 交卷', () => {
  it('**POST /api/morning-quiz/sessions/:id/submit**，体为 { final }', async () => {
    const calls = stubFetch(200, { id: 'sub-1', status: 'submitted' });
    await api.submitReading('TK', SID, { final: true });
    expect(calls[0].url).toBe('/api/morning-quiz/sessions/sess-1/submit');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ final: true });
  });

  it('**交卷响应里没有 nextAction / href** —— 它不是导航权威', async () => {
    stubFetch(200, { id: 'sub-1', status: 'submitted' });
    const r = await api.submitReading('TK', SID, { final: true });
    expect((r as Record<string, unknown>).nextAction).toBeUndefined();
    expect((r as Record<string, unknown>).href).toBeUndefined();
  });

  it('**重复交卷 400 不被吞掉** —— 由调用方决定怎么处理', async () => {
    stubFetch(400, { message: 'submission already submitted' });
    await expect(api.submitReading('TK', SID, { final: true })).rejects.toBeInstanceOf(ApiError);
  });
});
