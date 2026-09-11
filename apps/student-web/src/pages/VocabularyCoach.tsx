/**
 * 我的单词（审计 IOS-08 / UI02 / UI03 / UI04 / VOC09 / VOC13）。
 *
 * ## 组织
 *
 * 一个入口，三块内容：**生词列表 / 测试待办 / 已移出**（分段切换，状态记在网址里，返回时
 * 还在原处）。页头放两个工具：「查词」（词典，查了不自动加）和「抽查」（自助练习的小表单）。
 *
 * ## 生词列表
 *
 *   · 搜索（UI04）：输入框一直在，**不因为查询而卸载**；停手 250ms 才查，中文输入法组合
 *     过程中不查；列表区自己转圈，旧请求回来一律丢掉，不覆盖新条件。
 *   · 长列表（UI03）：显示「共 N 个」，「加载更多」按服务端游标接着取，不漏不重；
 *     移出一个就地减一，移空了当前这批而后面还有，就重新取第一批，不困在空页。
 *   · 返回保留：搜索词、筛选、分段写在网址里；已经加载的那几批留在内存里，回来直接显示，
 *     标签栏记住滚动位置。
 *   · 移出（IOS-08）：就地移出 + 「撤销」，不弹确认框；移出不删学习记录。
 *
 * ## 已移出
 *
 * 按钮写「重新加入」（VOC13）—— 只是放回我的单词，不开始教学、不算新词、不会马上要求复习。
 *
 * ## 查词（UI02）
 *
 * 结果卡上的按钮**只作用于卡上显示的那个词**（带它的 senseId）。输入框改了、还没重新查，
 * 按钮就先停用并说明，不会把 apple 的「加入」发给 banana。慢请求回来晚了也不串词。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, type V2Center, type V2Overview } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { isTeachingDay } from '../lib/teaching-day';
import { cleanDefinition, cleanTranslation, formatPhonetic, posPrefixFor } from '../lib/word-display';
import { Badge } from '../design/Badge';
import { Button } from '../design/Button';
import { Dialog } from '../design/Dialog';
import { Icon } from '../design/Icon';
import { Group, RowButton } from '../design/List';
import { Page } from '../design/Page';
import { Segmented } from '../design/Segmented';
import { InlineStatus, Spinner } from '../design/Status';
import { useToast } from '../design/Toast';
import { dayText, testSizeText } from './Today';

export const SOURCE_LABEL: Record<string, string> = {
  level_gap: '每日新词',
  teacher_list: '老师布置',
  reading_lookup: '阅读中查词',
  reading_error: '阅读错题',
  search: '主动查词',
  unknown: '来源未记录',
};

const STAGE_OPTIONS: Array<[string, string]> = [
  ['', '全部阶段'],
  ['new', '待学习'],
  ['learning', '学习中'],
  ['mastered', '已掌握'],
];

type View = 'words' | 'tests' | 'removed';
type Item = V2Center['items'][number];

type ListState = {
  status: 'loading' | 'ready' | 'error' | 'more';
  items: Item[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
  moreError: boolean;
};

const EMPTY_LIST: ListState = { status: 'loading', items: [], total: 0, nextCursor: null, hasMore: false, moreError: false };

/**
 * 已加载的列表按「视图 + 条件」留在内存里（只在这次打开 App 期间）：从一个词的测试回来，
 * 列表立刻是原来那样，标签栏再把滚动位置还原。不写 localStorage —— 生词本是个人数据。
 */
const listCache = new Map<string, ListState & { center: Pick<V2Center, 'stats' | 'filters' | 'growth'> }>();
export function __clearVocabCacheForTest() {
  listCache.clear();
}

/** 把新取到的一批接到已有列表后面，按 studentSenseId 去重（跨批不漏不重）。 */
export function appendUnique(prev: Item[], next: Item[]): Item[] {
  const seen = new Set(prev.map((it) => it.studentSenseId));
  return [...prev, ...next.filter((it) => !seen.has(it.studentSenseId))];
}

export default function VocabularyCoachPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const view = (['words', 'tests', 'removed'].includes(params.get('view') ?? '') ? params.get('view') : 'words') as View;
  const q = params.get('q') ?? '';
  const stage = params.get('stage') ?? '';
  const source = params.get('source') ?? '';

  // 输入框的值与「真正去查的条件」分开：打字不触发整页刷新（UI04）
  const [qInput, setQInput] = useState(q);
  const composing = useRef(false);

  const setParam = useCallback(
    (patch: Record<string, string>) => {
      setParams(
        (cur) => {
          const next = new URLSearchParams(cur);
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // 停手 250ms 才把输入推成查询条件；输入法组合中不推
  useEffect(() => {
    if (composing.current || qInput.trim() === q) return;
    const t = window.setTimeout(() => setParam({ q: qInput.trim() }), 250);
    return () => window.clearTimeout(t);
  }, [qInput, q, setParam]);

  // ── 概览（今天的新词、测试待办、新词补做）：自己加载、自己报错 ──
  const [ov, setOv] = useState<{ s: 'loading' } | { s: 'error' } | { s: 'ready'; data: V2Overview }>({ s: 'loading' });
  const loadOverview = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setOv({ s: 'loading' });
    try {
      setOv({ s: 'ready', data: await api.vocabV2Overview(token) });
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setOv({ s: 'error' });
    }
  }, []);
  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  // ── 列表：按视图 + 条件取，第一批 / 加载更多 ──
  const listKey = view === 'tests' ? null : `${view}|${view === 'removed' ? '' : q}|${view === 'removed' ? 'removed' : stage}|${view === 'removed' ? '' : source}`;
  const cached = listKey ? listCache.get(listKey) : undefined;
  const [list, setList] = useState<ListState>(cached ?? EMPTY_LIST);
  const [center, setCenter] = useState<Pick<V2Center, 'stats' | 'filters' | 'growth'> | null>(cached?.center ?? null);
  const gen = useRef(0);
  /** 当前列表属于哪个视图：换条件时旧结果可以先留着，换视图时不行 */
  const listView = useRef(view);

  const fetchPage = useCallback(
    async (mode: 'first' | 'more', cursor?: string | null) => {
      const token = readToken();
      if (!token || !listKey) return;
      const mine = ++gen.current;
      setList((cur) => (mode === 'first' ? { ...cur, status: cur.items.length ? cur.status : 'loading', moreError: false } : { ...cur, status: 'more', moreError: false }));
      try {
        const data = await api.vocabV2Center(token, {
          q: view === 'removed' ? undefined : q,
          stage: view === 'removed' ? 'removed' : stage,
          source: view === 'removed' ? undefined : source,
          cursor: mode === 'more' ? cursor ?? undefined : undefined,
        });
        if (mine !== gen.current) return; // 条件已经变了，这个响应作废（UI04）
        setCenter({ stats: data.stats, filters: data.filters, growth: data.growth });
        setList((cur) => {
          const items = mode === 'more' ? appendUnique(cur.items, data.items) : data.items;
          const hasMore = data.hasMore ?? (data.nextCursor ? true : items.length < data.total);
          const next: ListState = { status: 'ready', items, total: data.total, nextCursor: data.nextCursor ?? null, hasMore, moreError: false };
          listCache.set(listKey, { ...next, center: { stats: data.stats, filters: data.filters, growth: data.growth } });
          return next;
        });
      } catch (e) {
        if (mine !== gen.current) return;
        if (handleAuthFailure(e)) return;
        setList((cur) => (mode === 'more' ? { ...cur, status: 'ready', moreError: true } : { ...cur, status: cur.items.length ? 'ready' : 'error', moreError: cur.items.length > 0 }));
      }
    },
    [listKey, q, source, stage, view],
  );

  useEffect(() => {
    if (!listKey) return;
    const hit = listCache.get(listKey);
    if (hit) {
      setList(hit);
      setCenter(hit.center);
    } else {
      // 换了条件：旧结果先留着（变淡），新结果到了再换 —— 不闪成空白
      setList((cur) => (listView.current === view ? { ...cur, status: 'loading', moreError: false } : EMPTY_LIST));
    }
    listView.current = view;
    // 有缓存也在后台刷新第一批；只有第一批变了才替换（没变就不跳）
    void (async () => {
      const token = readToken();
      if (!token) return;
      const mine = ++gen.current;
      try {
        const data = await api.vocabV2Center(token, {
          q: view === 'removed' ? undefined : q,
          stage: view === 'removed' ? 'removed' : stage,
          source: view === 'removed' ? undefined : source,
        });
        if (mine !== gen.current) return;
        setCenter({ stats: data.stats, filters: data.filters, growth: data.growth });
        const same = hit && hit.total === data.total && data.items.every((it, i) => hit.items[i]?.studentSenseId === it.studentSenseId);
        if (same) return;
        const next: ListState = { status: 'ready', items: data.items, total: data.total, nextCursor: data.nextCursor ?? null, hasMore: data.hasMore ?? (data.nextCursor ? true : data.items.length < data.total), moreError: false };
        listCache.set(listKey, { ...next, center: { stats: data.stats, filters: data.filters, growth: data.growth } });
        setList(next);
      } catch (e) {
        if (mine !== gen.current) return;
        if (handleAuthFailure(e)) return;
        if (!hit) setList({ ...EMPTY_LIST, status: 'error' });
      }
    })();
  }, [listKey, q, source, stage, view]);

  // ── 移出 / 重新加入：就地改列表 + 撤销 ──
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  const setMembership = useCallback(
    async (item: Item, inNotebook: boolean, opts: { undo?: boolean } = {}) => {
      const token = readToken();
      if (!token) return;
      setRowBusy(item.studentSenseId);
      setRowError(null);
      try {
        await api.vocabV2SetMembership(token, item.senseId, inNotebook);
        // 当前视图里这一项要消失（生词列表里移出 / 已移出里重新加入）
        const leaves = (view === 'words' && !inNotebook) || (view === 'removed' && inNotebook);
        let index = -1;
        if (leaves) {
          setList((cur) => {
            index = cur.items.findIndex((it) => it.studentSenseId === item.studentSenseId);
            const items = cur.items.filter((it) => it.studentSenseId !== item.studentSenseId);
            const next = { ...cur, items, total: Math.max(0, cur.total - 1) };
            if (listKey) listCache.set(listKey, { ...next, center: center ?? { stats: {} as V2Center['stats'], filters: {} as V2Center['filters'], growth: [] } });
            // 这一批移空了、后面还有 → 重新取第一批，不困在空页（UI03）
            if (!items.length && next.total > 0) window.setTimeout(() => void fetchPage('first'), 0);
            return next;
          });
        }
        // 另外两个视图的缓存都过期了
        for (const k of [...listCache.keys()]) if (k !== listKey) listCache.delete(k);
        setCenter((c) => c && {
          ...c,
          stats: { ...c.stats, total: c.stats.total + (inNotebook ? 1 : -1), removed: Math.max(0, c.stats.removed + (inNotebook ? -1 : 1)) },
        });
        if (opts.undo) return;
        toast.show({
          tone: 'neutral',
          message: inNotebook ? `已重新加入 ${item.headword}（不算新词，也不会马上要求复习）` : `已移出 ${item.headword}。学习记录都还在。`,
          action: {
            label: '撤销',
            onAction: () => {
              // 撤销 = 反向操作一次，再把它放回原来的位置（不重新取列表，已加载的几批都还在）
              void setMembership(item, !inNotebook, { undo: true }).then(() => {
                if (!leaves) return;
                setList((cur) => {
                  if (cur.items.some((it) => it.studentSenseId === item.studentSenseId)) return cur;
                  const items = [...cur.items];
                  items.splice(index < 0 ? 0 : Math.min(index, items.length), 0, item);
                  return { ...cur, items, total: cur.total + 1 };
                });
              });
            },
          },
        });
      } catch (e) {
        if (handleAuthFailure(e)) return;
        setRowError({ id: item.studentSenseId, text: '没保存上，再点一次。' });
      } finally {
        setRowBusy(null);
      }
    },
    [center, fetchPage, listKey, toast, view],
  );

  // ── 测试待办 ──
  const [testBusy, setTestBusy] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const openPendingTest = async (task: V2Overview['pendingTests'][number]) => {
    const token = readToken();
    if (!token || testBusy) return;
    setTestBusy(task.dailySessionId);
    setTestError(null);
    try {
      const id = task.testSessionId ?? (await api.vocabV2StartTest(token, task.dailySessionId)).id;
      navigate(`${ROUTES.coachTest}?sessionId=${encodeURIComponent(id)}`);
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setTestError('这份单词测试暂时打不开，请重试。');
      setTestBusy(null);
    }
  };

  const [dictOpen, setDictOpen] = useState(false);
  const [dictSeed, setDictSeed] = useState('');
  const [practiceOpen, setPracticeOpen] = useState(false);

  const ovData = ov.s === 'ready' ? ov.data : null;
  const pendingTests = ovData?.pendingTests ?? [];
  const backlog = ovData?.learningBacklog ?? [];
  const stats = center?.stats;
  const todayWords = ovData?.home?.words;
  const todayLine = !ovData
    ? null
    : todayWords?.state === 'not_applicable' || (!ovData.today && !isTeachingDay())
      ? '周六周日不推新词，周一再来'
      : todayWords?.state === 'completed' || ovData.today?.status === 'completed'
        ? `今天的新词学完了${todayWords?.learned != null ? `（学完 ${todayWords.learned} 个${todayWords.deferred ? `，延后 ${todayWords.deferred} 个` : ''}）` : ''} · 可以再背一背`
        : ovData.today || todayWords?.state === 'in_progress'
          ? `学到一半 · 学完 ${todayWords?.learned ?? ovData.today?.learned ?? 0} / ${todayWords?.target ?? ovData.today?.target ?? ovData.dailyTarget}`
          : `今天 ${ovData.dailyTarget} 个新词，还没开始`;

  return (
    <Page
      title="我的单词"
      subtitle={stats ? `生词本 ${stats.total} 个 · 累计学过 ${stats.totalLearned} 个` : undefined}
      width="wide"
      testId="vocab-page"
      trailing={
        <>
          <Button size="sm" variant="neutral" icon="search" data-testid="open-dictionary" onClick={() => { setDictSeed(''); setDictOpen(true); }}>
            查词
          </Button>
          <Button size="sm" variant="neutral" icon="shuffle" data-testid="open-practice" onClick={() => setPracticeOpen(true)}>
            抽查
          </Button>
        </>
      }
    >
      {/* 今天的新词 —— 学习的统一入口 */}
      <div className="mb-5">
        {ov.s === 'error' ? (
          <InlineStatus tone="error" testId="overview-error" onRetry={() => void loadOverview()}>
            今天的新词和测试待办没加载出来，不代表没有。
          </InlineStatus>
        ) : (
          <Group>
            <RowButton
              icon="words"
              title="今天的新词"
              subtitle={todayLine ?? '载入中…'}
              testId="today-words"
              disabled={!ovData || todayLine === '周六周日不推新词，周一再来'}
              onClick={() => navigate(todayWords?.state === 'completed' && ovData?.home?.date ? `${ROUTES.coachLearn}?date=${encodeURIComponent(ovData.home.date)}` : ROUTES.coachLearn)}
            />
          </Group>
        )}
      </div>

      <Segmented<View>
        mode="tabs"
        label="我的单词分类"
        value={view}
        onChange={(v) => setParam({ view: v === 'words' ? '' : v })}
        className="mb-4"
        options={[
          { value: 'words', label: `生词列表${stats ? ` ${stats.total}` : ''}`, controls: 'vocab-panel', testId: 'view-words' },
          { value: 'tests', label: `测试待办${ovData ? ` ${pendingTests.length}` : ''}`, controls: 'vocab-panel', testId: 'view-tests' },
          { value: 'removed', label: `已移出${stats ? ` ${stats.removed}` : ''}`, controls: 'vocab-panel', testId: 'view-removed' },
        ]}
      />

      <div id="vocab-panel" role="tabpanel" aria-label={view === 'words' ? '生词列表' : view === 'tests' ? '测试待办' : '已移出'}>
        {view === 'tests' ? (
          <TestsPanel
            ov={ov}
            pendingTests={pendingTests}
            backlog={backlog}
            busy={testBusy}
            error={testError}
            onOpen={(t) => void openPendingTest(t)}
            onBacklog={(date) => navigate(`${ROUTES.coachLearn}?date=${encodeURIComponent(date)}`)}
            onRetry={() => void loadOverview()}
            onPractice={() => setPracticeOpen(true)}
          />
        ) : (
          <>
            {view === 'words' ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="relative min-w-[12rem] flex-[1_1_16rem]">
                  <span className="sr-only">搜索我的单词</span>
                  <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    data-testid="vocab-search"
                    type="search"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    onCompositionStart={() => {
                      composing.current = true;
                    }}
                    onCompositionEnd={(e) => {
                      composing.current = false;
                      setQInput((e.target as HTMLInputElement).value);
                    }}
                    placeholder="搜索英文或中文"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    className="min-h-[44px] w-full rounded-control border border-control bg-surface pl-10 pr-3 text-body text-ink"
                  />
                </label>
                <label className="flex-[0_1_10rem]">
                  <span className="sr-only">按学习阶段筛选</span>
                  <select
                    data-testid="vocab-stage"
                    value={stage}
                    onChange={(e) => setParam({ stage: e.target.value })}
                    className="min-h-[44px] w-full rounded-control border border-control bg-surface px-3 text-body text-ink"
                  >
                    {STAGE_OPTIONS.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="flex-[0_1_10rem]">
                  <span className="sr-only">按来源筛选</span>
                  <select
                    data-testid="vocab-source"
                    value={source}
                    onChange={(e) => setParam({ source: e.target.value })}
                    className="min-h-[44px] w-full rounded-control border border-control bg-surface px-3 text-body text-ink"
                  >
                    <option value="">全部来源</option>
                    {(center?.filters.sources ?? Object.keys(SOURCE_LABEL)).filter((v) => SOURCE_LABEL[v]).map((v) => (
                      <option key={v} value={v}>{SOURCE_LABEL[v]}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <WordList
              view={view}
              list={list}
              query={view === 'words' ? q : ''}
              filtered={view === 'words' && Boolean(q || stage || source)}
              searching={view === 'words' && qInput.trim() !== q}
              rowBusy={rowBusy}
              rowError={rowError}
              onMembership={(it, inNb) => void setMembership(it, inNb)}
              onMore={() => void fetchPage('more', list.nextCursor)}
              onRetry={() => void fetchPage('first')}
              onLookUp={(word) => {
                setDictSeed(word);
                setDictOpen(true);
              }}
            />
          </>
        )}
      </div>

      <DictionarySheet
        open={dictOpen}
        seed={dictSeed}
        onClose={() => setDictOpen(false)}
        onChanged={() => {
          listCache.clear();
          void fetchPage('first');
        }}
      />
      <PracticeSheet open={practiceOpen} onClose={() => setPracticeOpen(false)} center={center} />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────

function WordList({
  view,
  list,
  query,
  filtered,
  searching,
  rowBusy,
  rowError,
  onMembership,
  onMore,
  onRetry,
  onLookUp,
}: {
  view: View;
  list: ListState;
  query: string;
  filtered: boolean;
  searching: boolean;
  rowBusy: string | null;
  rowError: { id: string; text: string } | null;
  onMembership: (it: Item, inNotebook: boolean) => void;
  onMore: () => void;
  onRetry: () => void;
  onLookUp: (word: string) => void;
}) {
  if (list.status === 'error') {
    return (
      <InlineStatus tone="error" testId="list-error" onRetry={onRetry}>
        单词列表没加载出来。
      </InlineStatus>
    );
  }
  return (
    <section aria-busy={list.status === 'loading' || searching}>
      <p data-testid="list-count" className="mb-2 flex min-h-[1.5rem] items-center gap-2 px-1 text-footnote text-ink-3" aria-live="polite">
        {list.status === 'loading' ? (
          <Spinner label="正在查找" />
        ) : (
          <>
            {view === 'removed' ? `已移出 ${list.total} 个` : `${filtered ? '找到' : '共'} ${list.total} 个单词`}
            {list.items.length < list.total ? ` · 已显示 ${list.items.length} 个` : ''}
            {searching ? <Spinner label="" /> : null}
          </>
        )}
      </p>
      {list.status !== 'loading' && list.items.length === 0 ? (
        <div data-testid="list-empty" className="rounded-group bg-surface px-4 py-6 text-center text-callout text-ink-3">
          {view === 'removed'
            ? '没有移出的词。'
            : query
              ? (
                <>
                  我的单词里没有包含「{query}」的词。
                  <Button variant="plain" size="md" className="ml-1" onClick={() => onLookUp(query)}>
                    在词典里查「{query}」
                  </Button>
                </>
              )
              : filtered
                ? '这个范围还没有单词。'
                : '生词本还是空的。学每日新词、阅读时查词，都会收进这里。'}
        </div>
      ) : (
        <ul data-testid="word-list" className={`list-inset overflow-hidden rounded-group bg-surface transition-opacity ${list.status === 'loading' ? 'opacity-60' : ''}`}>
          {list.items.map((it) => (
            <WordRow key={it.studentSenseId} item={it} view={view} busy={rowBusy === it.studentSenseId} error={rowError?.id === it.studentSenseId ? rowError.text : null} onMembership={onMembership} />
          ))}
        </ul>
      )}
      {list.hasMore && list.items.length > 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2">
          {list.moreError ? <InlineStatus tone="error">下一批没加载出来。</InlineStatus> : null}
          <Button data-testid="load-more" variant="neutral" size="md" busy={list.status === 'more'} onClick={onMore}>
            {list.moreError ? '重试加载更多' : `加载更多（还有 ${Math.max(0, list.total - list.items.length)} 个）`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function WordRow({ item, view, busy, error, onMembership }: { item: Item; view: View; busy: boolean; error: string | null; onMembership: (it: Item, inNotebook: boolean) => void }) {
  const sources = (item.sources?.length ? item.sources : item.source ? [item.source] : []).map((s) => SOURCE_LABEL[s]).filter(Boolean);
  return (
    <li data-testid={`word-${item.headword}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-headline text-ink" lang="en">{item.headword}</span>
          {formatPhonetic(item.phonetic) ? <span className="text-footnote text-ink-3">{formatPhonetic(item.phonetic)}</span> : null}
        </p>
        <p className="text-callout text-ink-2">
          {posPrefixFor(item.pos, item.translation)}
          {cleanTranslation(item.translation).split('\n')[0]}
        </p>
        {item.context?.sentence ? (
          <p className="mt-1 text-footnote leading-6 text-ink-3">
            <span lang="en">{item.context.sentence}</span>
            {item.context.translation ? <span className="block">{item.context.translation}</span> : null}
          </p>
        ) : cleanDefinition(item.definition) ? (
          <p className="mt-1 text-footnote text-ink-3" lang="en">{cleanDefinition(item.definition)}</p>
        ) : null}
        <p className="mt-1 flex flex-wrap gap-1">
          {sources.length ? sources.map((s) => <Badge key={s} tone="neutral">{s}</Badge>) : <Badge tone="neutral">来源未记录</Badge>}
          {item.context?.personal ? <Badge tone="accent">我的例句</Badge> : null}
        </p>
        {error ? <div className="mt-1"><InlineStatus tone="error">{error}</InlineStatus></div> : null}
      </div>
      <div className="shrink-0 self-end sm:self-center">
        {view === 'removed' ? (
          <Button size="sm" variant="secondary" busy={busy} data-testid={`restore-${item.headword}`} onClick={() => onMembership(item, true)}>
            重新加入
          </Button>
        ) : (
          <Button size="sm" variant="destructive-plain" busy={busy} data-testid={`remove-${item.headword}`} aria-label={`把 ${item.headword} 移出我的单词`} onClick={() => onMembership(item, false)}>
            移出
          </Button>
        )}
      </div>
    </li>
  );
}

function TestsPanel({
  ov,
  pendingTests,
  backlog,
  busy,
  error,
  onOpen,
  onBacklog,
  onRetry,
  onPractice,
}: {
  ov: { s: 'loading' } | { s: 'error' } | { s: 'ready'; data: V2Overview };
  pendingTests: V2Overview['pendingTests'];
  backlog: NonNullable<V2Overview['learningBacklog']>;
  busy: string | null;
  error: string | null;
  onOpen: (t: V2Overview['pendingTests'][number]) => void;
  onBacklog: (date: string) => void;
  onRetry: () => void;
  onPractice: () => void;
}) {
  if (ov.s === 'loading') return <Spinner label="载入中" />;
  if (ov.s === 'error') {
    return (
      <InlineStatus tone="error" onRetry={onRetry}>
        测试待办没加载出来，不代表没有。
      </InlineStatus>
    );
  }
  const sorted = [...pendingTests].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="pending-tests-title">
        <h2 id="pending-tests-title" className="mb-2 px-1 text-footnote font-semibold text-ink-3">
          还没做的单词测试（{sorted.length}）· 没有截止时间，每一天的单独留着
        </h2>
        {error ? <div className="mb-2"><InlineStatus tone="error">{error}</InlineStatus></div> : null}
        {sorted.length ? (
          <Group>
            {sorted.map((t) => (
              <RowButton
                key={t.dailySessionId}
                icon="checkCircle"
                title={`${dayText(t.date)} 单词测试`}
                subtitle={`${testSizeText(t) || '今天学完的新词'}${t.status === 'in_progress' ? ` · 做到 ${t.answered ?? 0} 题` : ''}`}
                value={busy === t.dailySessionId ? '正在打开…' : t.status === 'in_progress' ? '继续' : '开始'}
                disabled={busy !== null}
                testId={`pending-${t.date}`}
                onClick={() => onOpen(t)}
              />
            ))}
          </Group>
        ) : (
          <p className="rounded-group bg-surface px-4 py-5 text-callout text-ink-3">没有欠着的单词测试。</p>
        )}
      </section>
      {backlog.length ? (
        <section aria-labelledby="backlog-title">
          <h2 id="backlog-title" className="mb-2 px-1 text-footnote font-semibold text-ink-3">新词补做（{backlog.length}）· 从上次停下的位置继续</h2>
          <Group>
            {backlog.map((b) => (
              <RowButton
                key={b.sessionId}
                icon="words"
                title={`${dayText(b.date)} 新词`}
                subtitle={`学完 ${b.learned ?? b.completed} · 还剩 ${b.pending ?? Math.max(0, b.target - b.completed)}`}
                value={b.status === 'in_progress' ? '继续' : '开始'}
                onClick={() => onBacklog(b.date)}
              />
            ))}
          </Group>
        </section>
      ) : null}
      <section>
        <Button variant="secondary" icon="shuffle" onClick={onPractice}>自助抽查（不记正式成绩）</Button>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 查词（UI02）
// ─────────────────────────────────────────────────────────────

type Sense = Awaited<ReturnType<typeof api.vocabV2Collect>>['sense'];

function DictionarySheet({ open, seed, onClose, onChanged }: { open: boolean; seed: string; onClose: () => void; onChanged: () => void }) {
  const [input, setInput] = useState(seed);
  const [result, setResult] = useState<{ query: string; sense: Sense } | null>(null);
  const [status, setStatus] = useState<'idle' | 'looking' | 'acting' | 'notFound' | 'error'>('idle');
  const [done, setDone] = useState<'learn' | 'known' | 'later' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const gen = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 正在查的是哪个词：输入改了就能再查（后查的赢），同一个词不重复发 */
  const [lookingFor, setLookingFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setInput(seed);
    setResult(null);
    setDone(null);
    setStatus('idle');
    setActionError(null);
    if (seed) void lookUp(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);

  const lookUp = async (word = input) => {
    const token = readToken();
    const w = word.trim();
    if (!token || !w) return;
    const mine = ++gen.current;
    setStatus('looking');
    setLookingFor(w);
    setDone(null);
    setActionError(null);
    try {
      const r = await api.vocabV2Collect(token, { headword: w, action: 'lookup_only', source: 'search' });
      if (mine !== gen.current) return; // 慢请求回来晚了：丢掉，不串词
      setResult({ query: w, sense: r.sense });
      setStatus('idle');
      setLookingFor(null);
    } catch (e) {
      if (mine !== gen.current) return;
      if (handleAuthFailure(e)) return;
      setResult(null);
      setLookingFor(null);
      setStatus(e instanceof ApiError && (e.status === 404 || e.body?.code === 'v2_word_not_found') ? 'notFound' : 'error');
    }
  };

  /** 动作绑定卡上显示的那个词（headword + senseId），不读输入框（UI02）。 */
  const act = async (action: 'learn' | 'known' | 'later') => {
    const token = readToken();
    if (!token || !result || status === 'acting') return;
    setStatus('acting');
    setActionError(null);
    try {
      await api.vocabV2Collect(token, {
        headword: result.sense.headword,
        ...(result.sense.id ? { senseId: result.sense.id } : {}),
        action,
        source: 'search',
      });
      setDone(action);
      onChanged();
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setActionError('没保存上，再点一次。');
    } finally {
      setStatus('idle');
    }
  };

  const stale = Boolean(result && input.trim() && input.trim().toLowerCase() !== result.query.toLowerCase());
  const shown = result?.sense;

  return (
    <Dialog open={open} onClose={onClose} title="查词" description="查了不会自动加进我的单词，加不加由你决定。和阅读时点词查到的是同一本词典。" placement="sheet" size="md" testId="dictionary-sheet" initialFocusRef={inputRef}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookUp();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">输入英文单词</span>
          <input
            ref={inputRef}
            data-testid="dictionary-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入英文单词"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            lang="en"
            className="min-h-[44px] w-full rounded-control border border-control bg-surface px-3 text-body text-ink"
          />
        </label>
        <Button type="submit" size="md" busy={status === 'looking' && lookingFor === input.trim()} disabled={!input.trim()}>
          查询
        </Button>
      </form>

      {status === 'notFound' ? <div className="mt-3"><InlineStatus tone="warning">词典里没有「{input.trim()}」。检查一下拼写？</InlineStatus></div> : null}
      {status === 'error' ? <div className="mt-3"><InlineStatus tone="error" onRetry={() => void lookUp()}>没查到可靠的翻译，可能是网络问题。</InlineStatus></div> : null}

      {shown ? (
        <div data-testid="dictionary-result" className="mt-4 rounded-group bg-surface-2 p-4">
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-title2 text-ink" lang="en">{shown.headword}</span>
            {formatPhonetic(shown.phonetic) ? <span className="text-callout text-ink-3">{formatPhonetic(shown.phonetic)}</span> : null}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-body text-ink">
            {posPrefixFor(shown.pos, shown.translation)}
            {cleanTranslation(shown.translation)}
          </p>
          {cleanDefinition(shown.definition) ? <p className="mt-1 text-callout text-ink-3" lang="en">{cleanDefinition(shown.definition)}</p> : null}

          {done ? (
            <div data-testid="dictionary-done" className="mt-3 flex flex-wrap items-center gap-2">
              <InlineStatus tone="success" role="status">
                {done === 'learn' ? `${shown.headword} 已加入我的单词` : done === 'later' ? `${shown.headword} 已收进我的单词，稍后再学` : `${shown.headword} 记为已会，以后不当新词推`}
              </InlineStatus>
              <Button variant="plain" size="md" onClick={() => { setInput(''); setResult(null); setDone(null); inputRef.current?.focus(); }}>
                查下一个
              </Button>
            </div>
          ) : (
            <>
              {stale ? (
                <p data-testid="dictionary-stale" className="mt-3 text-footnote text-warning">
                  输入已经改成「{input.trim()}」—— 先点「查询」。下面的按钮暂时停用，免得加错词。
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button size="md" disabled={stale} busy={status === 'acting'} data-testid="dict-learn" onClick={() => void act('learn')}>
                  加入我的单词
                </Button>
                <Button size="md" variant="neutral" disabled={stale || status === 'acting'} data-testid="dict-later" onClick={() => void act('later')}>
                  稍后再学
                </Button>
                <Button size="md" variant="neutral" disabled={stale || status === 'acting'} data-testid="dict-known" onClick={() => void act('known')}>
                  我已经会了
                </Button>
              </div>
              {actionError ? <div className="mt-2"><InlineStatus tone="error">{actionError}</InlineStatus></div> : null}
              <p className="mt-2 text-footnote leading-5 text-ink-3">
                加入 = 现在开始学，复习会优先安排；稍后再学 = 先收着；我已经会了 = 记下来，以后不当新词推。关掉这个面板 = 只查一下，什么都不记。
              </p>
            </>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// 自助抽查（IOS-08 / VOC10）
// ─────────────────────────────────────────────────────────────

type Scope = 'all' | 'week' | 'weak' | 'mastered' | 'spelling' | 'listening';
const SCOPES: Array<{ value: Scope; label: string; note: string }> = [
  { value: 'all', label: '全部', note: '我的单词里的所有词' },
  { value: 'week', label: '最近一周', note: '最近 7 天加入的词' },
  { value: 'weak', label: '还不熟', note: '还没掌握、或拼写常错的词' },
  { value: 'mastered', label: '已掌握', note: '确认一下还记得' },
  { value: 'spelling', label: '拼写', note: '拼写还不稳的词' },
  { value: 'listening', label: '听音', note: '听音还不稳的词' },
];

export function availableFor(scope: Scope, center: Pick<V2Center, 'stats' | 'growth'> | Pick<V2Center, 'stats'> | null): number | null {
  if (!center) return null;
  const s = center.stats;
  if (scope === 'all') return s.total;
  if (scope === 'mastered') return s.mastered;
  if (scope === 'week' && 'growth' in center && center.growth) return center.growth.slice(-7).reduce((a, g) => a + g.added, 0);
  if (scope === 'weak' && s.weak != null) return s.weak;
  if (scope === 'spelling' && s.spellingWeak != null) return s.spellingWeak;
  if (scope === 'listening' && s.listeningWeak != null) return s.listeningWeak;
  return null;
}

function PracticeSheet({ open, onClose, center }: { open: boolean; onClose: () => void; center: Pick<V2Center, 'stats' | 'filters' | 'growth'> | null }) {
  const navigate = useNavigate();
  const [scope, setScope] = useState<Scope>('all');
  const [count, setCount] = useState<5 | 10 | 20 | 'all'>(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = useMemo(() => availableFor(scope, center), [scope, center]);

  const start = async () => {
    const token = readToken();
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api.vocabV2CustomTest(token, { count, scope });
      navigate(`${ROUTES.coachTest}?sessionId=${encodeURIComponent(s.id)}`);
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setError(e instanceof ApiError && e.body?.code === 'v2_custom_test_empty' ? '这个范围现在没有可以抽的词，换一个范围试试。' : '抽查没开始，再试一次。');
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="自助抽查"
      description="从我的单词里随机抽。只是个人练习：不记正式成绩，不改复习安排，结果保留 2 小时。"
      placement="sheet"
      size="md"
      testId="practice-sheet"
      busy={busy}
      footer={
        <>
          <Button variant="neutral" onClick={onClose} disabled={busy}>取消</Button>
          <Button busy={busy} data-testid="practice-start" disabled={available === 0} onClick={() => void start()}>开始抽查</Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-2 text-footnote font-semibold text-ink-3">范围</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="抽查范围">
          {SCOPES.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={scope === o.value}
              data-testid={`scope-${o.value}`}
              onClick={() => setScope(o.value)}
              className={`min-h-[44px] rounded-control border px-3 py-2 text-left ${scope === o.value ? 'border-accent bg-accent-soft text-accent' : 'border-control bg-surface text-ink'}`}
            >
              <span className="block text-callout font-semibold">{o.label}</span>
              <span className="block text-caption text-ink-3">{o.note}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <p data-testid="practice-available" className="mt-2 text-footnote text-ink-3">
        {available == null ? '按掌握情况抽，不够时有多少抽多少。' : available === 0 ? '这个范围现在没有词。' : `这个范围最多能抽 ${available} 个。`}
      </p>
      <fieldset className="mt-4">
        <legend className="mb-2 text-footnote font-semibold text-ink-3">题数</legend>
        <Segmented<'5' | '10' | '20' | 'all'>
          label="抽查题数"
          value={String(count) as '5' | '10' | '20' | 'all'}
          onChange={(v) => setCount(v === 'all' ? 'all' : (Number(v) as 5 | 10 | 20))}
          options={[
            { value: '5', label: '5' },
            { value: '10', label: '10' },
            { value: '20', label: '20' },
            { value: 'all', label: '全部' },
          ]}
        />
      </fieldset>
      {error ? <div className="mt-3"><InlineStatus tone="error">{error}</InlineStatus></div> : null}
    </Dialog>
  );
}
