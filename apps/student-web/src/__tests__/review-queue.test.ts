/**
 * AC-07 —— 弱网评分队列。
 *
 * 用**真的队列模块 + 真的 api 客户端**，只在 `fetch` 那一层打桩。断言落在
 * 「盘上留下了什么」和「发出去了什么」——这两件事就是这个模块的全部契约。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  QUEUE_KEY,
  __resetFlushGuardForTest,
  flushPending,
  newRequestId,
  pendingCount,
  readQueue,
  submitCourseReview,
  type PendingReview,
} from '../lib/review-queue';
import { clearIdentity, readToken, writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';

type Req = { url: string; init: RequestInit };

let reqs: Req[] = [];
let routes: Record<string, (req: Req) => { status?: number; body: unknown } | Error>;

function installFetch() {
  reqs = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      reqs.push({ url, init });
      const key = Object.keys(routes)
        .filter((k) => url.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
      const r = key ? routes[key]({ url, init }) : { status: 404, body: {} };
      if (r instanceof Error) throw r;
      const status = r.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(r.body),
      } as unknown as Response;
    }),
  );
}

const reviewOk = { headword: 'nile', state: 'review', due: 'x', intervalDays: 3, reps: 1 };

const calls = (frag: string) => reqs.filter((r) => r.url.includes(frag));
const bodyOf = (r: Req) => JSON.parse(String(r.init.body)) as Record<string, unknown>;

beforeEach(() => {
  localStorage.clear();
  __resetForTest();
  __resetFlushGuardForTest();
  writeToken('TK');
  installFetch();
  routes = {
    '/api/vocab/review/undo': () => ({ body: { headword: 'nile', undone: true, reps: 0, state: 'new' } }),
    '/api/vocab/review': () => ({ body: reviewOk }),
    '/api/lesson/vocab-cursor': () => ({ body: { ok: true, cursor: 1, stored: true } }),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  // 用例里会 spy 掉 `Storage.prototype.setItem`。**必须在这里统一还原** ——
  // 只在用例末尾 restore 的话，断言一失败就永远走不到那一行，后面每个
  // 用例都会顶着一个坏掉的 localStorage 跑。
  vi.restoreAllMocks();
});

const input = (over: Partial<PendingReview> = {}) => ({
  headword: 'nile',
  rating: 'good' as const,
  elapsedMs: 2000,
  cursor: 1,
  ...over,
});

// ─────────────────────────────────────────────────────────────

describe('AC-07 一条评分的生命周期', () => {
  it('**顺利时：评分 → 断点 → 出队**，顺序固定', async () => {
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('ok');
    expect(reqs.map((r) => r.url)).toEqual(['/api/vocab/review', '/api/lesson/vocab-cursor']);
    expect(readQueue()).toEqual([]);
  });

  it('**发之前就先落盘** —— 请求还没回来，记录已经在队里', async () => {
    let seen: PendingReview[] = [];
    routes['/api/vocab/review'] = () => {
      seen = readQueue(); // 此刻 review 请求正在处理中
      return { body: reviewOk };
    };
    await submitCourseReview('TK', input());
    expect(seen).toHaveLength(1);
    expect(seen[0].headword).toBe('nile');
  });

  it('**请求体是精确的 token-only 形状**，一个身份字段都没有', async () => {
    await submitCourseReview('TK', input());
    const rev = bodyOf(calls('/vocab/review')[0]);
    expect(Object.keys(rev).sort()).toEqual(['elapsedMs', 'headword', 'rating', 'requestId']);
    expect(bodyOf(calls('/vocab-cursor')[0])).toEqual({ cursor: 1 });
    for (const r of reqs) {
      expect(r.url).not.toMatch(/[?&#]/);
      expect((r.init.headers as Record<string, string>).Authorization).toBe('Bearer TK');
      expect(String(r.init.body)).not.toMatch(/name|studentId|then|after/);
    }
  });

  it('**从不打 /vocab/due**（那是自由练习的队列）', async () => {
    await submitCourseReview('TK', input());
    await flushPending('TK');
    expect(calls('/vocab/due')).toHaveLength(0);
  });
});

describe('AC-07 失败与重试', () => {
  it('**网络错误 → 留在队里**，不丢', async () => {
    routes['/api/vocab/review'] = () => new Error('offline');
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('queued');
    expect(readQueue()).toHaveLength(1);
  });

  for (const status of [500, 502, 429] as const) {
    it(`**${status} → 留在队里**`, async () => {
      routes['/api/vocab/review'] = () => ({ status, body: { code: 'x' } });
      const out = await submitCourseReview('TK', input());
      expect(out.status).toBe('queued');
      expect(readQueue()).toHaveLength(1);
    });
  }

  it('**非认证类 4xx → 丢弃**（重试多少次都是同一个错）', async () => {
    routes['/api/vocab/review'] = () => ({ status: 404, body: { code: 'word_not_in_notebook' } });
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('invalid');
    expect(readQueue()).toEqual([]);
  });

  it('**401 走既有登出，记录留着**（换张票这条评分依然有效）', async () => {
    routes['/api/vocab/review'] = () => ({ status: 401, body: { code: 'token_revoked' } });
    await expect(submitCourseReview('TK', input())).rejects.toBeTruthy();
    expect(readQueue()).toHaveLength(1);
  });

  it('**评分成了、断点没成 → 记录留着**，重放安全（requestId 不变）', async () => {
    routes['/api/lesson/vocab-cursor'] = () => new Error('offline');
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('queued');
    const q = readQueue();
    expect(q).toHaveLength(1);
    const firstId = q[0].requestId;

    // 网络回来 —— 补传重放同一个 requestId，服务端回 duplicate
    routes['/api/vocab/review'] = () => ({ body: { ...reviewOk, duplicate: true } });
    routes['/api/lesson/vocab-cursor'] = () => ({ body: { ok: true, cursor: 1, stored: true } });
    reqs = [];
    await flushPending('TK');
    expect(bodyOf(calls('/vocab/review')[0]).requestId).toBe(firstId);
    expect(readQueue()).toEqual([]);
  });

  it('**重发一直用同一个 requestId**，绝不重新分配', async () => {
    routes['/api/vocab/review'] = () => new Error('offline');
    await submitCourseReview('TK', input());
    const id = readQueue()[0].requestId;

    for (let i = 0; i < 3; i++) {
      __resetFlushGuardForTest();
      await flushPending('TK');
    }
    const ids = calls('/vocab/review').map((r) => bodyOf(r).requestId);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(id);
  });
});

describe('AC-06/07 tooFast 不推进任何持久进度（返工 1/2 · B-1）', () => {
  const tooFast = { headword: 'nile', state: 'review', due: 'd', intervalDays: 0, reps: 2, tooFast: true };

  it('**tooFast 不落断点**，一次 vocab-cursor 都不发', async () => {
    routes['/api/vocab/review'] = () => ({ body: tooFast });
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('ok');
    expect(out.status === 'ok' && out.result.tooFast).toBe(true);
    expect(calls('/vocab-cursor')).toHaveLength(0);
  });

  it('**tooFast 出队** —— 否则补传会拿 duplicate 把断点推过去', async () => {
    routes['/api/vocab/review'] = () => ({ body: tooFast });
    await submitCourseReview('TK', input());
    expect(readQueue()).toEqual([]);

    // 再补传一次：队里已经没有它了，什么都不该发
    reqs = [];
    __resetFlushGuardForTest();
    await flushPending('TK');
    expect(reqs).toHaveLength(0);
  });

  it('**补传时撞上 tooFast 也不落断点**', async () => {
    routes['/api/vocab/review'] = () => ({ body: tooFast });
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([{ ...input(), requestId: 'r1', ts: Date.now() }]),
    );
    await flushPending('TK');
    expect(calls('/vocab-cursor')).toHaveLength(0);
    expect(readQueue()).toEqual([]);
  });
});

describe('AC-07 落盘失败必须说实话（返工 1/2 · B-2）', () => {
  it('**storage 整个不可用 → 不发请求**，返回 unstored', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('unstored');
    expect(reqs).toHaveLength(0);
    spy.mockRestore();
  });

  it('**只有写队列那一次 setItem 失败 → 也不发请求**', async () => {
    const real = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      k: string,
      v: string,
    ) {
      if (k === QUEUE_KEY) throw new Error('QuotaExceeded');
      real.call(this, k, v);
    });
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('unstored');
    expect(calls('/vocab/review')).toHaveLength(0);
    expect(calls('/vocab-cursor')).toHaveLength(0);
    spy.mockRestore();
  });

  it('**回读不到自己刚写的那条也算没存下**', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      /* 假装写成功，其实什么都没写 */
    });
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('unstored');
    expect(reqs).toHaveLength(0);
    spy.mockRestore();
  });
});

describe('AC-07 断点落库的四种结局（返工 1/2 · B-3）', () => {
  it('**stored:true 才算完** —— 出队，返回持久成功', async () => {
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('ok');
    expect(readQueue()).toEqual([]);
  });

  it('**stored:false 记录留着**，requestId 不变，不算完成', async () => {
    routes['/api/lesson/vocab-cursor'] = () => ({ body: { ok: true, cursor: 0, stored: false } });
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('queued');
    const q = readQueue();
    expect(q).toHaveLength(1);
    const id = q[0].requestId;

    // 断点这次落成了 —— 重放同一个 requestId，然后才出队
    routes['/api/lesson/vocab-cursor'] = () => ({ body: { ok: true, cursor: 1, stored: true } });
    routes['/api/vocab/review'] = () => ({ body: { ...reviewOk, duplicate: true } });
    reqs = [];
    __resetFlushGuardForTest();
    await flushPending('TK');
    expect(bodyOf(calls('/vocab/review')[0]).requestId).toBe(id);
    expect(readQueue()).toEqual([]);
  });

  for (const status of [500, 429] as const) {
    it(`**断点 ${status} → 留在队里**`, async () => {
      routes['/api/lesson/vocab-cursor'] = () => ({ status, body: { code: 'x' } });
      const out = await submitCourseReview('TK', input());
      expect(out.status).toBe('queued');
      expect(readQueue()).toHaveLength(1);
    });
  }

  it('**断点是非认证类 4xx → 按既有规矩丢弃**', async () => {
    routes['/api/lesson/vocab-cursor'] = () => ({ status: 400, body: { code: 'bad_cursor' } });
    const out = await submitCourseReview('TK', input());
    expect(out.status).toBe('invalid');
    expect(readQueue()).toEqual([]);
  });

  it('**断点认证失败 → 抛给调用方走既有登出，记录留着**', async () => {
    routes['/api/lesson/vocab-cursor'] = () => ({ status: 401, body: { code: 'token_revoked' } });
    await expect(submitCourseReview('TK', input())).rejects.toBeTruthy();
    expect(readQueue()).toHaveLength(1);
    // 登出会走 sw: 前缀扫除，那时才清
    clearIdentity();
    expect(readQueue()).toEqual([]);
  });
});

describe('AC-07 队列本身的规矩', () => {
  it('**键在 sw: 命名空间下**', () => {
    expect(QUEUE_KEY.startsWith('sw:')).toBe(true);
  });

  it('**记录里没有姓名 / studentId**', async () => {
    routes['/api/vocab/review'] = () => new Error('offline');
    await submitCourseReview('TK', input());
    const raw = localStorage.getItem(QUEUE_KEY)!;
    expect(raw).not.toMatch(/name|studentId|nickname/i);
    expect(Object.keys(readQueue()[0]).sort()).toEqual([
      'cursor', 'elapsedMs', 'headword', 'rating', 'requestId', 'ts',
    ]);
  });

  it('**超过 48 小时的记录会被丢掉**', () => {
    const old = { ...input(), requestId: 'a', ts: Date.now() - 49 * 3600_000 };
    const fresh = { ...input(), requestId: 'b', ts: Date.now() - 1000 };
    localStorage.setItem(QUEUE_KEY, JSON.stringify([old, fresh]));
    expect(pendingCount()).toBe(1);
    expect(readQueue()[0].requestId).toBe('b');
  });

  it('**最多留 200 条**，超了丢最旧的', async () => {
    routes['/api/vocab/review'] = () => new Error('offline');
    const many = Array.from({ length: 200 }, (_, i) => ({
      ...input(), requestId: `old-${i}`, ts: Date.now(),
    }));
    localStorage.setItem(QUEUE_KEY, JSON.stringify(many));
    await submitCourseReview('TK', input({ headword: 'newest' }));
    const q = readQueue();
    expect(q).toHaveLength(200);
    expect(q[0].requestId).toBe('old-1'); // old-0 被挤掉
    expect(q[199].headword).toBe('newest');
  });

  it('**形状不对的记录直接不认**，不会拿脏值去发请求', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([{ nonsense: 1 }, 'x', null]));
    expect(readQueue()).toEqual([]);
  });

  it('**队列坏了（不是 JSON）也不崩**', () => {
    localStorage.setItem(QUEUE_KEY, '{{{');
    expect(readQueue()).toEqual([]);
    expect(pendingCount()).toBe(0);
  });

  it('**登出 / 换账号会把队列一起清掉**（走既有的 sw: 前缀扫除）', async () => {
    routes['/api/vocab/review'] = () => new Error('offline');
    await submitCourseReview('TK', input());
    expect(pendingCount()).toBe(1);
    clearIdentity();
    expect(pendingCount()).toBe(0);
    expect(readToken()).toBeNull();
  });

  it('每次评分拿到的 requestId 都不一样', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newRequestId()));
    expect(ids.size).toBe(50);
  });
});

describe('AC-07 补传', () => {
  it('**串行**：一条走完才走下一条，且顺序就是入队顺序', async () => {
    const seen: string[] = [];
    routes['/api/vocab/review'] = ({ init }) => {
      seen.push(String(JSON.parse(String(init.body)).headword));
      return { body: reviewOk };
    };
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { ...input({ headword: 'a', cursor: 1 }), requestId: 'r1', ts: Date.now() },
        { ...input({ headword: 'b', cursor: 2 }), requestId: 'r2', ts: Date.now() },
        { ...input({ headword: 'c', cursor: 3 }), requestId: 'r3', ts: Date.now() },
      ]),
    );
    const out = await flushPending('TK');
    expect(seen).toEqual(['a', 'b', 'c']);
    expect(out).toEqual({ flushed: 3, remaining: 0 });
    // 每条评分后面都紧跟着它自己的断点
    expect(reqs.map((r) => r.url.replace('/api', ''))).toEqual([
      '/vocab/review', '/lesson/vocab-cursor',
      '/vocab/review', '/lesson/vocab-cursor',
      '/vocab/review', '/lesson/vocab-cursor',
    ]);
    expect(calls('/vocab-cursor').map((r) => bodyOf(r).cursor)).toEqual([1, 2, 3]);
  });

  it('**中途断网就停下**，剩下的留着下次再补', async () => {
    let n = 0;
    routes['/api/vocab/review'] = () => (++n === 1 ? { body: reviewOk } : new Error('offline'));
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { ...input({ headword: 'a' }), requestId: 'r1', ts: Date.now() },
        { ...input({ headword: 'b' }), requestId: 'r2', ts: Date.now() },
        { ...input({ headword: 'c' }), requestId: 'r3', ts: Date.now() },
      ]),
    );
    const out = await flushPending('TK');
    expect(out.flushed).toBe(1);
    expect(readQueue().map((p) => p.headword)).toEqual(['b', 'c']);
  });

  it('**并发调用只跑一轮**（防抖）', async () => {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([{ ...input(), requestId: 'r1', ts: Date.now() }]),
    );
    const [a, b] = await Promise.all([flushPending('TK'), flushPending('TK')]);
    expect(a.flushed + b.flushed).toBe(1);
    expect(calls('/vocab/review')).toHaveLength(1);
  });

  it('**补传时认证失败 → 抛给调用方走既有登出**，记录不丢', async () => {
    routes['/api/vocab/review'] = () => ({ status: 401, body: { code: 'student_token_required' } });
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([{ ...input(), requestId: 'r1', ts: Date.now() }]),
    );
    await expect(flushPending('TK')).rejects.toBeTruthy();
    expect(readQueue()).toHaveLength(1);
  });

  it('空队列时什么都不发', async () => {
    const out = await flushPending('TK');
    expect(out).toEqual({ flushed: 0, remaining: 0 });
    expect(reqs).toHaveLength(0);
  });
});
