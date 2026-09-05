/**
 * AC-05 ~ AC-09 —— 阅读状态引擎的**行为**测试。
 *
 * 用的是真的导出组件 `ReadingProvider` + 真的 `useReading()`，
 * 只把三个副作用注入成 mock：保存、权威重载、连通性探测。
 * 计时器是假的；`navigator.onLine` 与 `storage` 事件都真发。
 *
 * **不做源码字符串匹配** —— 每一条都必须由渲染出来的状态或 mock 的
 * 调用记录来证明。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ReadingProvider, useReading, isSubmitBlocked } from '../lesson/ReadingProvider';
import type { ReadingSaveResult, ReadingSessionPayload } from '../lib/api';
import { READING_KEYS, FONT_SCALE_KEY } from '../lesson/storage';

const SID = 's1';
const SUB = 'sub1';

type SaveBody = { selectedOption: string | null; textAnswer: string | null; clientSeq: number };
type SaveCall = { qid: string; body: SaveBody };

function payload(existing: ReadingSessionPayload['existingAnswers']): ReadingSessionPayload {
  return {
    sessionId: SID,
    submissionId: SUB,
    quizEnd: '2026-08-28T23:59:00.000Z',
    regularQuizEnd: null,
    secondWindowToday: false,
    level: 'olevel',
    paperMode: null,
    mode: 'test',
    questions: [],
    existingAnswers: existing,
    submissionStatus: 'in_progress',
    finalSubmitted: false,
  };
}

/** 把公共契约整个铺到 DOM 上 —— 断言只读这些，不碰内部实现。 */
function Probe() {
  const r = useReading();
  return (
    <div>
      <span data-testid="answers">{JSON.stringify(r.answers)}</span>
      <span data-testid="savingId">{r.savingId ?? '-'}</span>
      <span data-testid="offline">{String(r.isOffline)}</span>
      <span data-testid="saveError">{r.saveError ?? '-'}</span>
      <span data-testid="pending">{String(r.hasPendingSaves)}</span>
      <span data-testid="unverified">{String(r.hasUnverifiedAnswers)}</span>
      <span data-testid="notice">{r.conflictNotice ?? '-'}</span>
      <span data-testid="secondary">{String(r.isSecondaryTab)}</span>
      <span data-testid="flagged">{String(r.flaggedCount)}</span>
      <span data-testid="font">{String(r.fontScale)}</span>
      <span data-testid="blocked">{String(isSubmitBlocked(r))}</span>
      <button onClick={() => r.setAnswer('q1', { textAnswer: 'x' })}>edit</button>
      <button onClick={() => r.setAnswer('q1', { textAnswer: 'A' })}>editA</button>
      <button onClick={() => r.setAnswer('q1', { textAnswer: 'B' })}>editB</button>
      <button onClick={() => void r.flushPendingSaves()}>flush</button>
      <button onClick={() => r.claimTabOwnership()}>claim</button>
      <button onClick={() => r.dismissConflictNotice()}>dismiss</button>
      <button onClick={() => r.toggleFlag('q1')}>flag</button>
      <button onClick={() => r.setFontScale(1.3)}>bigger</button>
    </div>
  );
}

type Harness = {
  saves: SaveCall[];
  loads: number;
  saveAnswer: ReturnType<typeof vi.fn>;
  loadSession: ReturnType<typeof vi.fn>;
  healthProbe: ReturnType<typeof vi.fn>;
  onAuthFailure: ReturnType<typeof vi.fn>;
};

function makeDeps(
  opts: {
    save?: (call: SaveCall) => Promise<ReadingSaveResult>;
    load?: () => Promise<ReadingSessionPayload>;
    probe?: () => Promise<boolean>;
  } = {},
): Harness {
  const saves: SaveCall[] = [];
  const h: Harness = {
    saves,
    loads: 0,
    saveAnswer: vi.fn(async (qid: string, body: SaveBody) => {
      const call = { qid, body };
      saves.push(call);
      return opts.save
        ? await opts.save(call)
        : ({ applied: true, clientSeq: body.clientSeq } as ReadingSaveResult);
    }),
    loadSession: vi.fn(async () => {
      h.loads += 1;
      return opts.load ? await opts.load() : payload({});
    }),
    healthProbe: vi.fn(async () => (opts.probe ? await opts.probe() : true)),
    onAuthFailure: vi.fn(() => false),
  };
  return h;
}

function mount(h: Harness, props: Record<string, unknown> = {}) {
  return render(
    <ReadingProvider
      sessionId={SID}
      submissionId={SUB}
      deps={{
        saveAnswer: h.saveAnswer as never,
        loadSession: h.loadSession as never,
        healthProbe: h.healthProbe as never,
        onAuthFailure: h.onAuthFailure as never,
      }}
      {...props}
    >
      <Probe />
    </ReadingProvider>,
  );
}

const txt = (id: string) => screen.getByTestId(id).textContent;

async function click(label: string) {
  await act(async () => {
    screen.getByText(label).click();
  });
}

async function tick(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

async function settle() {
  // 串行队列是靠 promise 链拼起来的 —— 一次 microtask 不够，多冲几轮。
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-05 自动保存与 clientSeq
// ─────────────────────────────────────────────────────────────

describe('AC-05 序号与防抖', () => {
  it('**初始序号取自服务端 existingAnswers** —— 第一次写就比它大', async () => {
    const h = makeDeps();
    mount(h, { initialSeqs: { q1: 7 } });
    await click('edit');
    await tick(600);
    expect(h.saves).toHaveLength(1);
    expect(h.saves[0].body.clientSeq).toBe(8);
  });

  it('服务端没给序号 → 从 0 起，第一次写是 1', async () => {
    const h = makeDeps();
    mount(h);
    await click('edit');
    await tick(600);
    expect(h.saves[0].body.clientSeq).toBe(1);
  });

  it('**防抖 600ms**：599ms 不发，600ms 才发', async () => {
    const h = makeDeps();
    mount(h);
    await click('edit');
    await tick(599);
    expect(h.saves).toHaveLength(0);
    await tick(1);
    expect(h.saves).toHaveLength(1);
  });

  it('**每改一次占一个更大的号**', async () => {
    const h = makeDeps();
    mount(h);
    await click('edit');
    await tick(600);
    await click('edit');
    await tick(600);
    expect(h.saves.map((s) => s.body.clientSeq)).toEqual([1, 2]);
  });

  it('**定时器到点取的是最新值，不是闭包里的旧值**', async () => {
    const h = makeDeps();
    const Two = () => {
      const r = useReading();
      return (
        <>
          <button onClick={() => r.setAnswer('q1', { textAnswer: 'first' })}>a</button>
          <button onClick={() => r.setAnswer('q1', { textAnswer: 'second' })}>b</button>
        </>
      );
    };
    render(
      <ReadingProvider
        sessionId={SID}
        submissionId={SUB}
        deps={{
          saveAnswer: h.saveAnswer as never,
          loadSession: h.loadSession as never,
          healthProbe: h.healthProbe as never,
        }}
      >
        <Two />
      </ReadingProvider>,
    );
    await act(async () => {
      screen.getByText('a').click();
    });
    await tick(300);
    await act(async () => {
      screen.getByText('b').click();
    });
    await tick(600);
    expect(h.saves).toHaveLength(1);
    expect(h.saves[0].body.textAnswer).toBe('second');
    expect(h.saves[0].body.clientSeq).toBe(2);
  });

  it('**重试沿用同一个序号**（没有更新的编辑时）', async () => {
    let fail = true;
    const h = makeDeps({
      save: async () => {
        if (fail) throw new Error('boom');
        return { applied: true, clientSeq: 1 };
      },
    });
    mount(h);
    await click('edit');
    await tick(600);
    expect(h.saves).toHaveLength(1);
    fail = false;
    await click('flush');
    expect(h.saves).toHaveLength(2);
    expect(h.saves[1].body.clientSeq).toBe(h.saves[0].body.clientSeq);
  });

  it('**重试期间学生又改了 → 新的写拿更大的号**', async () => {
    const h = makeDeps({
      save: async () => {
        throw new Error('boom');
      },
    });
    mount(h);
    await click('edit');
    await tick(600);
    await click('edit');
    await tick(600);
    expect(h.saves.map((s) => s.body.clientSeq)).toEqual([1, 2]);
  });

  it('**applied 之后 pending / dirty 清干净**', async () => {
    const h = makeDeps();
    mount(h);
    await click('edit');
    expect(txt('pending')).toBe('true'); // 定时器还挂着
    await tick(600);
    expect(txt('pending')).toBe('false');
    expect(txt('savingId')).toBe('-');
    expect(txt('saveError')).toBe('-');
    expect(txt('blocked')).toBe('false');
  });

  it('**flushPendingSaves 取消定时器并等所有在途落盘**', async () => {
    const h = makeDeps();
    mount(h);
    await click('edit');
    expect(h.saves).toHaveLength(0);
    await click('flush');
    expect(h.saves).toHaveLength(1);
    // 定时器已被取消 —— 再推进时间不会重复发
    await tick(5000);
    expect(h.saves).toHaveLength(1);
    expect(txt('pending')).toBe('false');
  });

  it('**hasPendingSaves 覆盖定时器、脏行与在途请求**', async () => {
    let release: (v: ReadingSaveResult) => void = () => {};
    const h = makeDeps({
      save: () =>
        new Promise<ReadingSaveResult>((res) => {
          release = res;
        }),
    });
    mount(h);
    expect(txt('pending')).toBe('false');
    await click('edit');
    expect(txt('pending')).toBe('true'); // 定时器
    await tick(600);
    expect(txt('pending')).toBe('true'); // 在途
    expect(txt('savingId')).toBe('q1');
    await act(async () => {
      release({ applied: true, clientSeq: 1 });
    });
    expect(txt('pending')).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 离线与补传
// ─────────────────────────────────────────────────────────────

describe('AC-06 离线与补传', () => {
  it('**答案与序号在联网成功之前就已经落盘**', async () => {
    const h = makeDeps({ save: () => new Promise(() => {}) });
    mount(h);
    await click('edit');
    expect(JSON.parse(localStorage.getItem(READING_KEYS.answers(SID, SUB)!)!)).toEqual({
      q1: { textAnswer: 'x' },
    });
    expect(JSON.parse(localStorage.getItem(READING_KEYS.seqs(SID, SUB)!)!)).toEqual({ q1: 1 });
    expect(h.saves).toHaveLength(0);
  });

  it('**navigator 离线事件 → isOffline**', async () => {
    const h = makeDeps();
    mount(h);
    expect(txt('offline')).toBe('false');
    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(txt('offline')).toBe('true');
  });

  it('**注入的探测连续两次失败 → isOffline**（一次不算，避免抖动）', async () => {
    const h = makeDeps({ probe: async () => false });
    mount(h, { options: { probeFirstMs: 100, probeIntervalMs: 250 } });
    await tick(100);
    expect(txt('offline')).toBe('false'); // 第一次失败还不算
    await tick(250);
    expect(txt('offline')).toBe('true');  // 连续第二次才判离线
  });

  it('探测恢复 → 回到在线', async () => {
    let ok = false;
    const h = makeDeps({ probe: async () => ok });
    mount(h, { options: { probeFirstMs: 100, probeIntervalMs: 250 } });
    await tick(100);
    await tick(250);
    expect(txt('offline')).toBe('true');
    ok = true;
    await tick(250);
    expect(txt('offline')).toBe('false');
  });

  it('**重连时把最新的脏答案补传上去**', async () => {
    let fail = true;
    const h = makeDeps({
      save: async () => {
        if (fail) throw new Error('offline');
        return { applied: true, clientSeq: 1 };
      },
    });
    mount(h);
    await click('edit');
    await tick(600);
    expect(txt('saveError')).not.toBe('-');
    fail = false;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(h.saves).toHaveLength(2);
    expect(txt('saveError')).toBe('-');
    expect(txt('pending')).toBe('false');
  });

  it('**补传又失败 → 仍然是脏的，saveError 还在**', async () => {
    const h = makeDeps({
      save: async () => {
        throw new Error('still down');
      },
    });
    mount(h);
    await click('edit');
    await tick(600);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(txt('pending')).toBe('true');
    expect(txt('saveError')).not.toBe('-');
    expect(txt('blocked')).toBe('true');
  });

  it('**没有无限自动重试** —— 失败之后干等十分钟也不会再发', async () => {
    const h = makeDeps({
      save: async () => {
        throw new Error('boom');
      },
    });
    mount(h);
    await click('edit');
    await tick(600);
    expect(h.saves).toHaveLength(1);
    await tick(600_000);
    expect(h.saves).toHaveLength(1);
  });

  it('**保存失败没解决时交卷是被挡住的**', async () => {
    const h = makeDeps({
      save: async () => {
        throw new Error('boom');
      },
    });
    mount(h);
    await click('edit');
    await tick(600);
    expect(txt('blocked')).toBe('true');
    expect(
      isSubmitBlocked({ hasPendingSaves: false, saveError: 'x', hasUnverifiedAnswers: false }),
    ).toBe(true);
    expect(
      isSubmitBlocked({ hasPendingSaves: false, saveError: null, hasUnverifiedAnswers: true }),
    ).toBe(true);
    expect(
      isSubmitBlocked({ hasPendingSaves: false, saveError: null, hasUnverifiedAnswers: false }),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-07 superseded 对账（S7A §5.4）
// ─────────────────────────────────────────────────────────────

describe('AC-07 superseded 对账', () => {
  function supersededOnce(serverSeq: number) {
    let n = 0;
    return async (): Promise<ReadingSaveResult> => {
      n += 1;
      if (n === 1) return { applied: false, superseded: true, clientSeq: serverSeq };
      return { applied: true, clientSeq: 99 };
    };
  }

  it('**情况 A（L > N）：留在脏且未证实，不显示已保存，不重载**', async () => {
    let hold: ((v: ReadingSaveResult) => void) | null = null;
    const h = makeDeps({
      save: (call) =>
        call.body.clientSeq === 1
          ? new Promise<ReadingSaveResult>((res) => {
              hold = res;
            })
          : Promise.resolve({ applied: true, clientSeq: call.body.clientSeq }),
    });
    mount(h);
    await click('edit'); // seq 1
    await tick(600); // 发出 seq=1，卡住
    await click('edit'); // seq 2，本地更新
    await act(async () => {
      hold!({ applied: false, superseded: true, clientSeq: 1 });
    });
    expect(h.loads).toBe(0); // 情况 A 不重载
    expect(txt('pending')).toBe('true'); // 还是脏的
    expect(txt('unverified')).toBe('true'); // 未证实
    expect(txt('blocked')).toBe('true');
  });

  it('**情况 B 有差异：服务端值覆盖本地、落盘、弹一次提示、回干净**', async () => {
    const h = makeDeps({
      save: supersededOnce(5),
      load: async () =>
        payload({
          q1: { content: 'srv', selectedOption: null, textAnswer: 'srv', clientSeq: 5, flagged: false },
        }),
    });
    mount(h);
    await click('edit');
    await tick(600);
    await settle();
    expect(h.loads).toBe(1);
    expect(JSON.parse(txt('answers')!)).toEqual({ q1: { textAnswer: 'srv' } });
    expect(JSON.parse(localStorage.getItem(READING_KEYS.answers(SID, SUB)!)!)).toEqual({
      q1: { textAnswer: 'srv' },
    });
    expect(JSON.parse(localStorage.getItem(READING_KEYS.seqs(SID, SUB)!)!)).toEqual({ q1: 5 });
    expect(txt('notice')).not.toBe('-');
    expect(txt('unverified')).toBe('false');
    expect(txt('pending')).toBe('false');
    expect(txt('blocked')).toBe('false');
  });

  it('提示可以关掉', async () => {
    const h = makeDeps({
      save: supersededOnce(5),
      load: async () =>
        payload({
          q1: { content: 'srv', selectedOption: null, textAnswer: 'srv', clientSeq: 5, flagged: false },
        }),
    });
    mount(h);
    await click('edit');
    await tick(600);
    await settle();
    expect(txt('notice')).not.toBe('-');
    await click('dismiss');
    expect(txt('notice')).toBe('-');
  });

  it('**情况 B 无差异：不弹提示**（重试撞上自己已落盘的那次写）', async () => {
    const h = makeDeps({
      save: supersededOnce(1),
      load: async () =>
        payload({
          q1: { content: 'x', selectedOption: null, textAnswer: 'x', clientSeq: 1, flagged: false },
        }),
    });
    mount(h);
    await click('edit');
    await tick(600);
    await settle();
    expect(h.loads).toBe(1);
    expect(txt('notice')).toBe('-');
    expect(txt('unverified')).toBe('false');
  });

  it('**重载失败 → conflict-unverified，交卷被挡住**', async () => {
    const h = makeDeps({
      save: supersededOnce(5),
      load: async () => {
        throw new Error('500');
      },
    });
    mount(h);
    await click('edit');
    await tick(600);
    await settle();
    expect(txt('unverified')).toBe('true');
    expect(txt('blocked')).toBe('true');
  });

  it('**重载回来没有这一题 → 也算失败**，不得当成「本地就是对的」', async () => {
    const h = makeDeps({ save: supersededOnce(5), load: async () => payload({}) });
    mount(h);
    await click('edit');
    await tick(600);
    await settle();
    expect(txt('unverified')).toBe('true');
    expect(txt('blocked')).toBe('true');
    expect(JSON.parse(txt('answers')!)).toEqual({ q1: { textAnswer: 'x' } });
  });

  it('**两题同时冲突 → 只发一个重载请求**', async () => {
    const h = makeDeps({
      save: async () => ({ applied: false, superseded: true, clientSeq: 5 }),
      load: async () =>
        payload({
          q1: { content: 'a', selectedOption: null, textAnswer: 'a', clientSeq: 5, flagged: false },
          q2: { content: 'b', selectedOption: null, textAnswer: 'b', clientSeq: 5, flagged: false },
        }),
    });
    const TwoQ = () => {
      const r = useReading();
      return (
        <>
          <button
            onClick={() => {
              r.setAnswer('q1', { textAnswer: '1' });
              r.setAnswer('q2', { textAnswer: '2' });
            }}
          >
            both
          </button>
          <span data-testid="unverified">{String(r.hasUnverifiedAnswers)}</span>
        </>
      );
    };
    render(
      <ReadingProvider
        sessionId={SID}
        submissionId={SUB}
        deps={{
          saveAnswer: h.saveAnswer as never,
          loadSession: h.loadSession as never,
          healthProbe: h.healthProbe as never,
        }}
      >
        <TwoQ />
      </ReadingProvider>,
    );
    await act(async () => {
      screen.getByText('both').click();
    });
    await tick(600);
    await settle();
    expect(h.saves).toHaveLength(2);
    expect(h.loads).toBe(1);
  });

  it('**401 走既有的认证失败处理，不进冲突态**', async () => {
    const h = makeDeps({
      save: supersededOnce(5),
      load: async () => {
        throw new Error('401');
      },
    });
    h.onAuthFailure.mockReturnValue(true);
    mount(h);
    await click('edit');
    await tick(600);
    await settle();
    expect(h.onAuthFailure).toHaveBeenCalled();
  });

  it('**fail-closed：L < N 也按情况 B 处理**（理论上不该发生）', async () => {
    const h = makeDeps({
      save: async () => ({ applied: false, superseded: true, clientSeq: 50 }),
      load: async () =>
        payload({
          q1: { content: 'srv', selectedOption: null, textAnswer: 'srv', clientSeq: 50, flagged: false },
        }),
    });
    mount(h, { initialSeqs: { q1: 0 } });
    await click('edit');
    await tick(600);
    await settle();
    expect(h.loads).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-08 多标签
// ─────────────────────────────────────────────────────────────

describe('AC-08 多标签所有权', () => {
  function owner() {
    const raw = localStorage.getItem(READING_KEYS.tabOwner(SID));
    return raw ? (JSON.parse(raw) as { tabId: string; ts: number }) : null;
  }

  it('**第一个标签成为主标签并写下所有权**', async () => {
    const h = makeDeps();
    mount(h);
    expect(txt('secondary')).toBe('false');
    expect(owner()?.tabId).toBeTruthy();
  });

  it('**所有权键就是 sw:reading:tab-owner:<sessionId>**', async () => {
    mount(makeDeps());
    expect(Object.keys(localStorage)).toContain('sw:reading:tab-owner:s1');
  });

  it('**新鲜的别人的所有权在 → 本标签是次要标签，且不往服务端写**', async () => {
    localStorage.setItem(
      READING_KEYS.tabOwner(SID),
      JSON.stringify({ tabId: 'other', ts: Date.now() }),
    );
    const h = makeDeps();
    mount(h);
    expect(txt('secondary')).toBe('true');
    await click('edit');
    await tick(2000);
    expect(h.saves).toHaveLength(0);
    expect(JSON.parse(txt('answers')!)).toEqual({ q1: { textAnswer: 'x' } });
    expect(JSON.parse(localStorage.getItem(READING_KEYS.answers(SID, SUB)!)!)).toEqual({
      q1: { textAnswer: 'x' },
    });
  });

  it('**过期的所有权（超过 10 秒没心跳）→ 直接接管**', async () => {
    localStorage.setItem(
      READING_KEYS.tabOwner(SID),
      JSON.stringify({ tabId: 'crashed', ts: Date.now() - 60_000 }),
    );
    const h = makeDeps();
    mount(h);
    expect(txt('secondary')).toBe('false');
    expect(owner()?.tabId).not.toBe('crashed');
  });

  it('**心跳会刷新自己的时间戳**', async () => {
    const h = makeDeps();
    mount(h);
    const t0 = owner()!.ts;
    await tick(3000);
    expect(owner()!.ts).toBeGreaterThanOrEqual(t0);
    expect(txt('secondary')).toBe('false');
  });

  it('**显式接管把所有权转过来，本标签立刻恢复保存**', async () => {
    localStorage.setItem(
      READING_KEYS.tabOwner(SID),
      JSON.stringify({ tabId: 'other', ts: Date.now() }),
    );
    const h = makeDeps();
    mount(h);
    expect(txt('secondary')).toBe('true');
    await click('claim');
    expect(txt('secondary')).toBe('false');
    expect(owner()?.tabId).not.toBe('other');
    await click('edit');
    await tick(600);
    expect(h.saves).toHaveLength(1);
  });

  it('**别的标签抢走所有权（storage 事件）→ 本标签变次要**', async () => {
    const h = makeDeps();
    mount(h);
    expect(txt('secondary')).toBe('false');
    await act(async () => {
      localStorage.setItem(
        READING_KEYS.tabOwner(SID),
        JSON.stringify({ tabId: 'other', ts: Date.now() }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: READING_KEYS.tabOwner(SID) }));
    });
    expect(txt('secondary')).toBe('true');
  });

  it('**卸载时只在自己还持有时才释放**', async () => {
    const h = makeDeps();
    const { unmount } = mount(h);
    expect(owner()).not.toBeNull();
    unmount();
    expect(owner()).toBeNull();
  });

  it('**别人持有时卸载不能把别人的所有权删掉**', async () => {
    localStorage.setItem(
      READING_KEYS.tabOwner(SID),
      JSON.stringify({ tabId: 'other', ts: Date.now() }),
    );
    const { unmount } = mount(makeDeps());
    unmount();
    expect(owner()?.tabId).toBe('other');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-09 公共契约
// ─────────────────────────────────────────────────────────────

describe('AC-09 公共契约', () => {
  const EXPECTED_KEYS = [
    'answers',
    'claimTabOwnership',
    'conflictNotice',
    'dismissConflictNotice',
    'flaggedCount',
    'flushPendingSaves',
    'fontScale',
    'hasPendingSaves',
    'hasUnverifiedAnswers',
    'isFlagged',
    'isOffline',
    'isSecondaryTab',
    'saveError',
    'savingId',
    'setAnswer',
    'setFontScale',
    'toggleFlag',
  ];

  function grabKeys(): string[] {
    let keys: string[] = [];
    const Grab = () => {
      keys = Object.keys(useReading());
      return null;
    };
    render(
      <ReadingProvider
        sessionId={SID}
        submissionId={SUB}
        deps={{ saveAnswer: vi.fn() as never, loadSession: vi.fn() as never }}
      >
        <Grab />
      </ReadingProvider>,
    );
    return keys;
  }

  it('**只暴露约定的那些能力，一个不多**', () => {
    expect(grabKeys().sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('**没有交卷 / 路由 / 渲染器选择**这类不属于引擎的东西', () => {
    const keys = grabKeys();
    for (const bad of ['submit', 'navigate', 'nextaction', 'href', 'renderer', 'question']) {
      expect(keys.some((k) => k.toLowerCase().includes(bad))).toBe(false);
    }
  });

  it('**在 Provider 外面用 useReading 会直接抛**，不给一个假的空状态', () => {
    const Bad = () => {
      useReading();
      return null;
    };
    expect(() => render(<Bad />)).toThrow();
  });

  it('旗标与字号在引擎内实现，键都在 sw: 下', async () => {
    const h = makeDeps();
    mount(h);
    await click('flag');
    expect(txt('flagged')).toBe('1');
    expect(JSON.parse(localStorage.getItem(READING_KEYS.flags(SID, SUB)!)!)).toEqual(['q1']);
    await click('bigger');
    expect(txt('font')).toBe('1.3');
    expect(localStorage.getItem(FONT_SCALE_KEY)).toBe('1.3');
  });

  it('**加载时按 mergeDrafts 合并本地缓存与服务端答案，并补传本地更新的那题**', async () => {
    localStorage.setItem(
      READING_KEYS.answers(SID, SUB)!,
      JSON.stringify({ q1: { textAnswer: '本地新' } }),
    );
    localStorage.setItem(READING_KEYS.seqs(SID, SUB)!, JSON.stringify({ q1: 9 }));
    const h = makeDeps();
    mount(h, {
      initialAnswers: { q1: { textAnswer: '服务端旧' }, q2: { selectedOption: 'C' } },
      initialSeqs: { q1: 3, q2: 1 },
    });
    expect(JSON.parse(txt('answers')!)).toEqual({
      q1: { textAnswer: '本地新' },
      q2: { selectedOption: 'C' },
    });
    await settle();
    expect(h.saves.map((s) => s.qid)).toEqual(['q1']);
    expect(h.saves[0].body.clientSeq).toBe(9);
  });

  it('**次要标签不补传**', async () => {
    localStorage.setItem(
      READING_KEYS.tabOwner(SID),
      JSON.stringify({ tabId: 'other', ts: Date.now() }),
    );
    localStorage.setItem(
      READING_KEYS.answers(SID, SUB)!,
      JSON.stringify({ q1: { textAnswer: '本地新' } }),
    );
    localStorage.setItem(READING_KEYS.seqs(SID, SUB)!, JSON.stringify({ q1: 9 }));
    const h = makeDeps();
    mount(h, { initialAnswers: { q1: { textAnswer: '旧' } }, initialSeqs: { q1: 1 } });
    await settle();
    expect(h.saves).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 返工 1/2 —— B2：重叠的保存请求
//
// 原实现只有一个 `pendingSeqRef[qid]` 和一个 `Set<qid>`：一次**迟到的旧
// 响应**会无条件清掉 dirty / pending，把学生刚写的新答案标成「已保存」。
// 下面四条钉住的就是这个。
// ─────────────────────────────────────────────────────────────

describe('B2 重叠保存：旧响应不得替新写入表态', () => {
  /** 每个 seq 一个闸门，测试自己决定谁什么时候回来。 */
  function gated() {
    const gates = new Map<number, (v: ReadingSaveResult) => void>();
    const rejects = new Map<number, (e: unknown) => void>();
    const h = makeDeps({
      save: (call) =>
        new Promise<ReadingSaveResult>((res, rej) => {
          gates.set(call.body.clientSeq, res);
          rejects.set(call.body.clientSeq, rej);
        }),
    });
    return { h, gates, rejects };
  }

  it('**seq=1 在飞时学生改成 seq=2；seq=1 成功 → seq=2 仍然是脏的、未确认**', async () => {
    const { h, gates } = gated();
    mount(h);
    await click('edit');
    await tick(600); // 发出 seq=1，卡住
    expect(h.saves.map((s) => s.body.clientSeq)).toEqual([1]);

    await click('edit'); // 本地拿到 seq=2，进入脏 + 防抖
    await act(async () => {
      gates.get(1)!({ applied: true, clientSeq: 1 });
    });
    await settle();

    // **旧响应成功了，但它不是最新那次** —— 不许清掉新写入的状态
    expect(txt('pending')).toBe('true');
    expect(txt('blocked')).toBe('true');
    expect(h.saves).toHaveLength(1); // seq=2 的防抖还没到点

    // 用 flush 来**证明 dirty 真的还在**：它会先取消防抖定时器，
    // 所以「还有请求发出去」只可能来自那条没被清掉的脏行。
    // （光看 hasPendingSaves 不算数 —— 防抖定时器本身也会让它是 true。）
    await click('flush');
    await settle();
    expect(h.saves.map((s) => s.body.clientSeq)).toEqual([1, 2]);
    expect(txt('pending')).toBe('true'); // seq=2 在飞

    await act(async () => {
      gates.get(2)!({ applied: true, clientSeq: 2 });
    });
    await settle();
    expect(txt('pending')).toBe('false');
    expect(txt('blocked')).toBe('false');
  });

  it('**同样的局面，seq=2 失败 → 仍被挡住；flush 用同一个 seq=2 重试**', async () => {
    const { h, gates, rejects } = gated();
    mount(h);
    await click('edit');
    await tick(600);
    await click('edit');
    await act(async () => {
      gates.get(1)!({ applied: true, clientSeq: 1 });
    });
    await settle();
    await tick(600); // 发出 seq=2
    await act(async () => {
      rejects.get(2)!(new Error('down'));
    });
    await settle();

    expect(txt('saveError')).not.toBe('-');
    expect(txt('pending')).toBe('true');
    expect(txt('blocked')).toBe('true');

    await click('flush');
    await settle();
    // 重试沿用同一个号，**不是** 3
    expect(h.saves.map((s) => s.body.clientSeq)).toEqual([1, 2, 2]);
  });

  it('**自动保存在飞时点 flush → 只等它，不再发一份重复请求**', async () => {
    const { h, gates } = gated();
    mount(h);
    await click('edit');
    await tick(600);
    expect(h.saves).toHaveLength(1);

    let flushed = false;
    await act(async () => {
      void screen.getByText('flush').click();
    });
    await settle();
    expect(h.saves).toHaveLength(1); // **没有重复请求**

    await act(async () => {
      gates.get(1)!({ applied: true, clientSeq: 1 });
      flushed = true;
    });
    await settle();
    expect(flushed).toBe(true);
    expect(h.saves).toHaveLength(1);
    expect(txt('pending')).toBe('false');
  });

  it('**旧响应不能把 hasPendingSaves 抹成 false**（B2 的核心）', async () => {
    const { h, gates } = gated();
    mount(h);
    await click('edit');
    await tick(600);
    await click('edit'); // seq=2 未落盘
    await act(async () => {
      gates.get(1)!({ applied: true, clientSeq: 1 });
    });
    await settle();
    // flush 先清掉所有防抖定时器 —— 之后 hasPendingSaves 若还是 true，
    // 那只能是因为脏行与在途请求确实还在。
    await click('flush');
    await settle();
    expect(h.saves).toHaveLength(2);
    expect(txt('pending')).toBe('true');
    expect(txt('blocked')).toBe('true');
  });

  it('**同一题不会有两个请求同时在飞**（按题串行）', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const h = makeDeps({
      save: async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await Promise.resolve();
        concurrent -= 1;
        return { applied: true, clientSeq: 1 };
      },
    });
    mount(h);
    await click('edit');
    await tick(600);
    await click('edit');
    await tick(600);
    await click('flush');
    await settle();
    expect(maxConcurrent).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// 返工 1/2 —— B3：探测恢复也要补传
//
// API 恢复时 `navigator.onLine` 可能一直是 true（设备从没断网，是服务端
// 那头挂了），浏览器根本不发 `online` 事件。只挂 `online` 监听的话，
// 脏答案会一直躺在本地没人补。
// ─────────────────────────────────────────────────────────────

describe('B3 探测恢复后的补传', () => {
  it('**探测两次失败后再成功 → 恰好补传一次，用的是最新答案与同一个 seq**', async () => {
    let ok = false;
    let failSave = true;
    const h = makeDeps({
      save: async (call) => {
        if (failSave) throw new Error('api down');
        return { applied: true, clientSeq: call.body.clientSeq };
      },
      probe: async () => ok,
    });
    mount(h, { options: { probeFirstMs: 100, probeIntervalMs: 250 } });

    // 两次编辑，两次保存都失败 —— 最新的是 seq=2 / 'B'
    await click('editA');
    await tick(600);
    await click('editB');
    await tick(600);
    await settle();
    expect(h.saves.map((s) => s.body.clientSeq)).toEqual([1, 2]);
    expect(txt('blocked')).toBe('true');

    // 设备**一直在线**，只有 API 挂了 —— 不会有 online 事件
    expect(navigator.onLine).toBe(true);
    await tick(100); // 探测失败 1
    await tick(250); // 探测失败 2 → 离线
    expect(txt('offline')).toBe('true');
    expect(h.saves).toHaveLength(2);

    ok = true;
    failSave = false;
    await tick(250); // 探测成功 → 跳变，补传一次
    await settle();
    expect(h.saves).toHaveLength(3);
    expect(h.saves[2].body.clientSeq).toBe(2); // 同一个 seq
    expect(h.saves[2].body.textAnswer).toBe('B'); // 最新答案
    expect(txt('offline')).toBe('false');
    expect(txt('pending')).toBe('false');
    expect(txt('saveError')).toBe('-');
    expect(txt('blocked')).toBe('false');

    // 之后每一次探测成功都不该再发请求
    await tick(250);
    await tick(250);
    await tick(250);
    await settle();
    expect(h.saves).toHaveLength(3);
  });

  it('**没有脏答案时，探测恢复什么都不发**', async () => {
    let ok = false;
    const h = makeDeps({ probe: async () => ok });
    mount(h, { options: { probeFirstMs: 100, probeIntervalMs: 250 } });
    await click('edit');
    await tick(600);
    await settle();
    expect(h.saves).toHaveLength(1);
    await tick(100);
    await tick(250);
    expect(txt('offline')).toBe('true');
    ok = true;
    await tick(250);
    await settle();
    expect(h.saves).toHaveLength(1);
  });

  it('**探测一直成功 → 从头到尾不触发补传**（成功探测不是重试时机）', async () => {
    let failSave = true;
    const h = makeDeps({
      save: async () => {
        if (failSave) throw new Error('down');
        return { applied: true, clientSeq: 1 };
      },
      probe: async () => true,
    });
    mount(h, { options: { probeFirstMs: 100, probeIntervalMs: 250 } });
    await click('edit');
    await tick(600);
    await settle();
    expect(h.saves).toHaveLength(1);
    failSave = false;
    await tick(100);
    await tick(250);
    await tick(250);
    await tick(250);
    await settle();
    // 探测从没判过离线 → 没有「恢复」这回事，脏行留着等 online / flush
    expect(h.saves).toHaveLength(1);
    expect(txt('blocked')).toBe('true');
  });
});
