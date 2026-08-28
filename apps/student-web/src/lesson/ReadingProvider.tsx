/**
 * 阅读页的状态引擎 —— 阶段 7B 的全部产出。
 *
 * 这里**只管答案怎么保住**：分配序号、防抖自动保存、离线排队、重连补传、
 * 多标签所有权、以及 `superseded` 之后的对账。
 * 渲染、路由、交卷动作都不在这一层 —— 那是阶段 7C 的事。
 *
 * ## 三个副作用全部注入
 *
 * `saveAnswer` / `loadSession` / `healthProbe` 由调用方传进来。引擎自己
 * 不 import `lib/api`，更不 import 旧端的任何东西 —— 这样测试能用真的
 * 组件跑真的行为，而不是去打桩 `fetch`。
 *
 * ## 冻结的规则（S7A §5.2 / §5.4）
 *
 * - 序号**在 setAnswer 那一刻分配**，不是发请求时；重试沿用同一个号。
 * - `superseded` **不是失败，但也不是干净**：
 *   本地有更新的写 → 留在脏；否则 → 重载权威会话覆盖本地。
 *   重载失败 → `conflict-unverified`，交卷被挡住。
 * - 次要标签**本地照写、服务端不写**。
 * - 「未证实」只在内存里，不落盘 —— 刷新本来就会重新拉权威会话。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { ReadingAnswer, ReadingSaveResult, ReadingSessionPayload } from '../lib/api';
import { mergeDrafts } from './draftMerge';
import {
  FONT_SCALE_KEY,
  READING_KEYS,
  readJson,
  readRaw,
  removeKey,
  writeJson,
  writeRaw,
} from './storage';

const SAVE_DEBOUNCE_MS = 600;
const TAB_HEARTBEAT_MS = 2_000;
const TAB_STALE_MS = 10_000;
const PROBE_FIRST_MS = 30_000;
const PROBE_INTERVAL_MS = 60_000;

const CONFLICT_NOTICE = '这道题在别的地方改过，已经取服务器上的版本。';

export interface ReadingEngineDeps {
  /** 逐题保存。**由调用方负责带令牌**，引擎不碰身份。 */
  saveAnswer(
    qid: string,
    body: { selectedOption: string | null; textAnswer: string | null; clientSeq: number },
  ): Promise<ReadingSaveResult>;
  /** 权威会话读取 —— 对账重载打的就是这一个。 */
  loadSession(): Promise<ReadingSessionPayload>;
  /** 连通性探测。返回 true 表示通。不传就不探。 */
  healthProbe?(): Promise<boolean>;
  /** 认证失败的既有处理。返回 true 表示「已经处理掉了（登出）」。 */
  onAuthFailure?(e: unknown): boolean;
}

export interface ReadingEngineOptions {
  debounceMs?: number;
  probeFirstMs?: number;
  probeIntervalMs?: number;
  heartbeatMs?: number;
  staleMs?: number;
}

export interface ReadingEngineValue {
  answers: Record<string, ReadingAnswer>;
  setAnswer(qid: string, ans: ReadingAnswer): void;
  savingId: string | null;
  isOffline: boolean;
  saveError: string | null;
  hasPendingSaves: boolean;
  hasUnverifiedAnswers: boolean;
  conflictNotice: string | null;
  dismissConflictNotice(): void;
  isSecondaryTab: boolean;
  claimTabOwnership(): void;
  flushPendingSaves(): Promise<void>;
  isFlagged(qid: string): boolean;
  toggleFlag(qid: string): void;
  flaggedCount: number;
  fontScale: number;
  setFontScale(n: number): void;
}

/**
 * 交卷闸门（纯函数）。
 *
 * 三个条件任意一个成立都不许交：还有没落盘的写、上一次保存报了错、
 * 或者有答案未经证实（S7A §5.4）。阶段 7C 的交卷按钮直接用它 ——
 * 判据只写一处，页面不能自己另发明一套。
 */
export function isSubmitBlocked(s: {
  hasPendingSaves: boolean;
  saveError: string | null;
  hasUnverifiedAnswers: boolean;
}): boolean {
  return s.hasPendingSaves || s.saveError != null || s.hasUnverifiedAnswers;
}

const Ctx = createContext<ReadingEngineValue | null>(null);

export function useReading(): ReadingEngineValue {
  const v = useContext(Ctx);
  // 给一个空状态比抛更危险：页面会显示「没有答案、一切正常」。
  if (!v) throw new Error('useReading 必须在 ReadingProvider 里用');
  return v;
}

function sameAnswer(a: ReadingAnswer | undefined, b: ReadingAnswer): boolean {
  return (
    (a?.selectedOption ?? null) === (b.selectedOption ?? null) &&
    (a?.textAnswer ?? null) === (b.textAnswer ?? null)
  );
}

function newTabId(): string {
  const c = typeof crypto !== 'undefined' ? (crypto as { randomUUID?: () => string }) : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface ReadingProviderProps {
  sessionId: string;
  submissionId: string | null;
  /** 服务端已存的答案（由页面从 `existingAnswers` 归一化后传进来）。 */
  initialAnswers?: Record<string, ReadingAnswer>;
  /** 每题服务端已接受的最大序号。 */
  initialSeqs?: Record<string, number>;
  deps: ReadingEngineDeps;
  options?: ReadingEngineOptions;
  children: ReactNode;
}

export function ReadingProvider({
  sessionId,
  submissionId,
  initialAnswers,
  initialSeqs,
  deps,
  options,
  children,
}: ReadingProviderProps) {
  const debounceMs = options?.debounceMs ?? SAVE_DEBOUNCE_MS;
  const heartbeatMs = options?.heartbeatMs ?? TAB_HEARTBEAT_MS;
  const staleMs = options?.staleMs ?? TAB_STALE_MS;
  const probeFirstMs = options?.probeFirstMs ?? PROBE_FIRST_MS;
  const probeIntervalMs = options?.probeIntervalMs ?? PROBE_INTERVAL_MS;

  const ANSWERS_KEY = READING_KEYS.answers(sessionId, submissionId);
  const SEQS_KEY = READING_KEYS.seqs(sessionId, submissionId);
  const FLAGS_KEY = READING_KEYS.flags(sessionId, submissionId);
  const OWNER_KEY = READING_KEYS.tabOwner(sessionId);

  const depsRef = useRef(deps);
  depsRef.current = deps;

  // ── 内部账本 ──
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const dirtyRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef<Set<string>>(new Set());
  /** 未证实的题：superseded 之后、对账确认之前都算。**不落盘。** */
  const unverifiedRef = useRef<Set<string>>(new Set());
  const latestAnswerRef = useRef<Record<string, ReadingAnswer>>({});
  const seqRef = useRef<Record<string, number>>({});
  /** 已经发出去、还没确认的那次写用的序号 —— 重试沿用它。 */
  const pendingSeqRef = useRef<Record<string, number>>({});
  /** 本地比服务端新的题 —— 挂载后补传一次。 */
  const resendRef = useRef<string[]>([]);
  /** 单飞的对账重载 —— 同一时刻只允许一个在途。 */
  const reloadRef = useRef<Promise<ReadingSessionPayload> | null>(null);

  /**
   * 加载即合并。
   *
   * 用 `useState` 的惰性初始化，保证在第一次渲染之前就把本地缓存与
   * 服务端答案对齐 —— 中间不存在「先显示服务端、再闪成本地」的一帧。
   */
  const [answers, setAnswers] = useState<Record<string, ReadingAnswer>>(() => {
    const cached = readJson<Record<string, ReadingAnswer>>(ANSWERS_KEY, {});
    const cachedSeqs = readJson<Record<string, number>>(SEQS_KEY, {});
    const { answers: merged, resend } = mergeDrafts(
      cached,
      cachedSeqs,
      initialAnswers ?? {},
      initialSeqs ?? {},
    );
    resendRef.current = resend;
    // 序号种子：服务端的那份打底，本地更新的那几题用本地的号
    // —— 补传时必须带原来的号，不能换一个更大的。
    const seeds: Record<string, number> = { ...(initialSeqs ?? {}) };
    for (const qid of resend) {
      const n = cachedSeqs[qid];
      if (typeof n === 'number') seeds[qid] = n;
    }
    seqRef.current = seeds;
    latestAnswerRef.current = { ...merged };
    return merged;
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' && !navigator.onLine,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  /**
   * 标签身份**必须在第一次渲染就定下来**。
   *
   * 放在 effect 里定会晚一拍：补传 effect 与所有权 effect 在同一次提交里
   * 跑，补传看到的还是上一帧的 `false`，于是次要标签照样把本地草稿推到
   * 服务端 —— 正是多标签守卫要防的那件事。
   */
  const tabIdRef = useRef<string>(newTabId());
  const [isSecondaryTab, setIsSecondaryTab] = useState<boolean>(() => {
    const raw = readRaw(OWNER_KEY);
    if (!raw) return false;
    try {
      const p = JSON.parse(raw) as { tabId?: string; ts?: number };
      if (typeof p?.tabId === 'string' && typeof p?.ts === 'number') {
        return p.tabId !== tabIdRef.current && Date.now() - p.ts <= staleMs;
      }
    } catch {
      /* 坏值当作没有 */
    }
    return false;
  });
  /** 由内部账本推导出来的两个可见状态 —— 每次改账本都要同步一次。 */
  const [status, setStatus] = useState({ pending: false, unverified: false });

  const [flagged, setFlagged] = useState<Set<string>>(
    () => new Set(readJson<string[]>(FLAGS_KEY, [])),
  );

  const [fontScale, setFontScaleRaw] = useState<number>(() => {
    const raw = readRaw(FONT_SCALE_KEY);
    const n = raw ? Number(raw) : 1;
    return Number.isFinite(n) && n >= 0.7 && n <= 1.6 ? n : 1;
  });

  const answersRef = useRef<Record<string, ReadingAnswer>>(answers);
  answersRef.current = answers;
  const isSecondaryRef = useRef(false);
  isSecondaryRef.current = isSecondaryTab;

  const syncStatus = useCallback(() => {
    setStatus((prev) => {
      const pending =
        timersRef.current.size > 0 ||
        dirtyRef.current.size > 0 ||
        inflightRef.current.size > 0 ||
        reloadRef.current != null;
      const unverified = unverifiedRef.current.size > 0;
      return prev.pending === pending && prev.unverified === unverified
        ? prev
        : { pending, unverified };
    });
  }, []);

  const persistSeqs = useCallback(() => writeJson(SEQS_KEY, seqRef.current), [SEQS_KEY]);

  // ── 对账（S7A §5.4 情况 B）──
  const reconcile = useCallback(
    async (qid: string, serverSeq: number | null) => {
      const shared = reloadRef.current ?? (reloadRef.current = depsRef.current.loadSession());
      syncStatus();
      let payload: ReadingSessionPayload | null = null;
      try {
        payload = await shared;
      } catch (e) {
        // 401 交给既有的认证失败链路（登出回登录页），不进冲突态。
        if (depsRef.current.onAuthFailure?.(e)) unverifiedRef.current.delete(qid);
        payload = null;
      } finally {
        if (reloadRef.current === shared) reloadRef.current = null;
      }
      // 重载失败 → 停在 conflict-unverified：未证实标记留着，交卷被挡住。
      if (!payload) {
        syncStatus();
        return;
      }
      const row = payload.existingAnswers?.[qid];
      // 重载回来没有这一题 —— **不是**「服务端没有答案所以本地是对的」。
      if (!row) {
        syncStatus();
        return;
      }
      const authoritative: ReadingAnswer = {};
      if (row.selectedOption != null) authoritative.selectedOption = row.selectedOption;
      if (row.textAnswer != null) authoritative.textAnswer = row.textAnswer;
      const before = latestAnswerRef.current[qid];
      latestAnswerRef.current[qid] = authoritative;
      seqRef.current[qid] = row.clientSeq ?? serverSeq ?? seqRef.current[qid] ?? 0;
      setAnswers((prev) => {
        const next = { ...prev, [qid]: authoritative };
        writeJson(ANSWERS_KEY, next);
        return next;
      });
      persistSeqs();
      unverifiedRef.current.delete(qid);
      // 不静默覆盖：值真变了才打扰学生，一样就不弹。
      if (!sameAnswer(before, authoritative)) setConflictNotice(CONFLICT_NOTICE);
      syncStatus();
    },
    [ANSWERS_KEY, persistSeqs, syncStatus],
  );

  const persistOne = useCallback(
    async (qid: string, ans: ReadingAnswer) => {
      // 重试沿用同一个序号 —— 换个更大的号重试，等于让这次重试有资格
      // 盖掉学生在重试期间写下的新答案。
      const seq = pendingSeqRef.current[qid] ?? seqRef.current[qid] ?? 0;
      pendingSeqRef.current[qid] = seq;
      inflightRef.current.add(qid);
      setSavingId(qid);
      syncStatus();
      try {
        const res = await depsRef.current.saveAnswer(qid, {
          selectedOption: ans.selectedOption ?? null,
          textAnswer: ans.textAnswer ?? null,
          clientSeq: seq,
        });
        if (res?.superseded) {
          const L = seqRef.current[qid] ?? 0;
          if (pendingSeqRef.current[qid] === seq) delete pendingSeqRef.current[qid];
          unverifiedRef.current.add(qid);
          if (L > seq) {
            // 情况 A —— 在途期间学生又改了，那次改动有它自己的生命周期。
            // **保持脏、保持未证实**，不重载、不报「已保存」。
            return;
          }
          // 情况 B（L === seq；以及 fail-closed 的 L < seq）
          dirtyRef.current.delete(qid);
          await reconcile(qid, res.clientSeq ?? null);
          return;
        }
        delete pendingSeqRef.current[qid];
        dirtyRef.current.delete(qid);
        unverifiedRef.current.delete(qid);
        setSaveError(null);
      } catch (e) {
        // 脏行留着；靠「重连」与「交卷前强刷」两个时机重来，
        // **不做无限自动重试**。
        setSaveError((e as Error)?.message ?? String(e ?? 'save_failed'));
        throw e;
      } finally {
        inflightRef.current.delete(qid);
        setSavingId((cur) => (cur === qid ? null : cur));
        syncStatus();
      }
    },
    [reconcile, syncStatus],
  );

  const setAnswer = useCallback(
    (qid: string, ans: ReadingAnswer) => {
      setAnswers((prev) => {
        const next = { ...prev, [qid]: ans };
        writeJson(ANSWERS_KEY, next);
        return next;
      });
      latestAnswerRef.current[qid] = ans;
      // 每改一次答案就占一个更大的号。**在这里分配**（而不是发请求时）
      // 才能保证「学生先写的那次」永远拿到更小的号。
      seqRef.current[qid] = (seqRef.current[qid] ?? 0) + 1;
      delete pendingSeqRef.current[qid];
      // 序号跟着答案一起落盘 —— 下次打开才判断得出「本地这份比服务端新」。
      persistSeqs();
      // 次要标签：本地照写，服务端不写。
      if (isSecondaryRef.current) {
        syncStatus();
        return;
      }
      dirtyRef.current.add(qid);
      const existing = timersRef.current.get(qid);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        timersRef.current.delete(qid);
        // 到点时取**最新值**，不是闭包里捕获的那份。
        const latest = latestAnswerRef.current[qid] ?? ans;
        void persistOne(qid, latest).catch(() => {
          /* 脏行留着，saveError 已经设了 */
        });
      }, debounceMs);
      timersRef.current.set(qid, t);
      syncStatus();
    },
    [ANSWERS_KEY, debounceMs, persistOne, persistSeqs, syncStatus],
  );

  const flushPendingSaves = useCallback(async () => {
    // 1. 取消所有防抖定时器 —— 等着的现在就发。
    for (const [qid, timer] of timersRef.current.entries()) {
      clearTimeout(timer);
      timersRef.current.delete(qid);
    }
    // 2. 并行落盘每一条脏行的最新值。
    const todo = Array.from(dirtyRef.current);
    if (todo.length > 0) {
      await Promise.allSettled(
        todo.map((qid) => {
          const ans = latestAnswerRef.current[qid];
          return ans ? persistOne(qid, ans) : Promise.resolve();
        }),
      );
    }
    // 3. 交卷前不仅要等在途保存，**还要等在途的对账重载**。
    const inflightReload = reloadRef.current;
    if (inflightReload) await inflightReload.catch(() => undefined);
    syncStatus();
  }, [persistOne, syncStatus]);

  const flushRef = useRef(flushPendingSaves);
  flushRef.current = flushPendingSaves;

  // ── 在线 / 离线 ──
  useEffect(() => {
    function on() {
      setIsOffline(false);
      if (dirtyRef.current.size > 0) {
        void flushRef.current().catch(() => {
          /* 通过 saveError 暴露 */
        });
      }
    }
    function off() {
      setIsOffline(true);
    }
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // ── 注入的连通性探测 ──
  //
  // `navigator.onLine` 在 captive portal 下是 true（设备**连着网**，只是
  // 出不去），API 本身挂了也一样。所以另外主动探一下；连续两次失败才
  // 判离线，避免一次抖动就吓到学生。
  useEffect(() => {
    const probe = depsRef.current.healthProbe;
    if (!probe) return;
    let cancelled = false;
    let consecutiveFailures = 0;
    async function run() {
      if (cancelled) return;
      let ok = false;
      try {
        ok = await probe!();
      } catch {
        ok = false;
      }
      if (cancelled) return;
      if (ok) {
        consecutiveFailures = 0;
        if (typeof navigator === 'undefined' || navigator.onLine) setIsOffline(false);
      } else {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) setIsOffline(true);
      }
    }
    const first = setTimeout(run, probeFirstMs);
    const interval = setInterval(run, probeIntervalMs);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [probeFirstMs, probeIntervalMs]);

  // ── 标签所有权 ──
  const readOwner = useCallback((): { tabId: string; ts: number } | null => {
    const raw = readRaw(OWNER_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { tabId?: string; ts?: number };
      if (typeof parsed?.tabId === 'string' && typeof parsed?.ts === 'number') {
        return { tabId: parsed.tabId, ts: parsed.ts };
      }
    } catch {
      /* 坏值当作没有 */
    }
    return null;
  }, [OWNER_KEY]);

  const writeOwner = useCallback(
    (tabId: string) => writeRaw(OWNER_KEY, JSON.stringify({ tabId, ts: Date.now() })),
    [OWNER_KEY],
  );

  const claimTabOwnership = useCallback(() => {
    writeOwner(tabIdRef.current);
    setIsSecondaryTab(false);
  }, [writeOwner]);

  useEffect(() => {
    const me = tabIdRef.current;
    const cur = readOwner();
    if (!cur || Date.now() - cur.ts > staleMs) {
      writeOwner(me);
      setIsSecondaryTab(false);
    } else {
      setIsSecondaryTab(cur.tabId !== me);
    }
    const heartbeat = setInterval(() => {
      const c = readOwner();
      if (!c || Date.now() - c.ts > staleMs) {
        writeOwner(me);
        setIsSecondaryTab(false);
      } else if (c.tabId === me) {
        writeOwner(me);
      } else {
        setIsSecondaryTab(true);
      }
    }, heartbeatMs);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== OWNER_KEY) return;
      const c = readOwner();
      setIsSecondaryTab(!!c && c.tabId !== me);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('storage', onStorage);
      // 只在**自己还持有**时释放 —— 否则会把别人的所有权删掉。
      const c = readOwner();
      if (c && c.tabId === me) removeKey(OWNER_KEY);
    };
  }, [OWNER_KEY, heartbeatMs, readOwner, staleMs, writeOwner]);

  // ── 挂载后补传本地更新的那几题（只跑一次；次要标签不补传）──
  const resentRef = useRef(false);
  useEffect(() => {
    if (resentRef.current) return;
    const todo = resendRef.current;
    if (todo.length === 0) return;
    if (isSecondaryTab) return;
    resentRef.current = true;
    resendRef.current = [];
    for (const qid of todo) {
      const ans = answersRef.current[qid];
      if (!ans) continue;
      latestAnswerRef.current[qid] = ans;
      dirtyRef.current.add(qid);
      void persistOne(qid, ans).catch(() => {
        /* 脏行留着，重连时会重试 */
      });
    }
    syncStatus();
  }, [isSecondaryTab, persistOne, syncStatus]);

  // 卸载时清掉还挂着的防抖定时器。
  useEffect(
    () => () => {
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    },
    [],
  );

  const toggleFlag = useCallback(
    (qid: string) => {
      setFlagged((prev) => {
        const next = new Set(prev);
        if (next.has(qid)) next.delete(qid);
        else next.add(qid);
        writeJson(FLAGS_KEY, [...next]);
        return next;
      });
    },
    [FLAGS_KEY],
  );

  const isFlagged = useCallback((qid: string) => flagged.has(qid), [flagged]);

  const setFontScale = useCallback((n: number) => {
    const clamped = Math.max(0.7, Math.min(1.6, n));
    setFontScaleRaw(clamped);
    writeRaw(FONT_SCALE_KEY, String(clamped));
  }, []);

  const dismissConflictNotice = useCallback(() => setConflictNotice(null), []);

  const value = useMemo<ReadingEngineValue>(
    () => ({
      answers,
      setAnswer,
      savingId,
      isOffline,
      saveError,
      hasPendingSaves: status.pending,
      hasUnverifiedAnswers: status.unverified,
      conflictNotice,
      dismissConflictNotice,
      isSecondaryTab,
      claimTabOwnership,
      flushPendingSaves,
      isFlagged,
      toggleFlag,
      flaggedCount: flagged.size,
      fontScale,
      setFontScale,
    }),
    [
      answers,
      setAnswer,
      savingId,
      isOffline,
      saveError,
      status.pending,
      status.unverified,
      conflictNotice,
      dismissConflictNotice,
      isSecondaryTab,
      claimTabOwnership,
      flushPendingSaves,
      isFlagged,
      toggleFlag,
      flagged.size,
      fontScale,
      setFontScale,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
