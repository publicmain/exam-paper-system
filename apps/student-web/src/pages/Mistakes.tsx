/**
 * `/mistakes` —— 错题本（阶段 12B）。
 *
 * 同一外壳里的**独立页面**：随时能进，进了也不改变今天的课走到哪一步。
 * 所以它**不读 `/lesson/today`**。
 *
 * ## 一个 GET
 *
 * `GET /vocab/mistakes?includeResolved=1` —— **一次取全**，前端按
 * `resolved` 分成两段。分两次取会出现「上半屏的总数」和「下半屏的列表」
 * 来自不同时刻的窗口。`includeResolved` 是**视图开关**，不是身份。
 *
 * ## 已销账的那一段必须在
 *
 * 错题本要能清空，否则只会一直变长（这是它上线首日就暴露的问题）。
 * 但「清空」不能是**删掉** —— 学生点错了得能拿回来。所以销账是一个可逆的
 * 标记，两段都摆在页面上。
 *
 * ## 销账要确认，而且 `{updated:0}` 是失败
 *
 * 服务端返回的是**受影响行数**：`0` 表示没有一行匹配（不是我的、或者已经
 * 不在了）。把它当成「成功但没变化」，学生会看到那条错题原地消失又回来。
 *
 * ## 写完要对账
 *
 * 总数与题型统计是服务端按整本算的，本地减一减对不上。所以写成功之后
 * **重新取一次权威列表**；如果这次对账失败了 —— 不显示旧数字，明说
 * 「刷新一下」。宁可少显示，不显示错的。
 *
 * ## 含糊的失败绝不盲目重发
 *
 * `POST /vocab/mistakes/resolve` 是幂等的（`updateMany` 到一个固定状态），
 * 但**「请求失败」不等于「没写成功」** —— 响应丢了的那种失败，重发只是
 * 又猜一次。这一屏的做法是：先把列表读回来看看到底成没成 ——
 *
 *   · 已经是目标状态 → 当成成功（本来就成了）；
 *   · 还是老状态     → 让学生自己再点一次；
 *   · 读也失败       → 停在闭锁态，**不自动再写**。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type MistakeEntry, type MistakeListResult } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES, scoreDetailPath } from '../routes.contract';
import { reasonLabel, taskTypeLabel } from '../components/mistakes/answer-check';
import { Button, Card, Notice, Screen } from '../ui';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

/** 分两段。**两边都保留服务端顺序**，只按 `resolved` 挑。 */
export function splitEntries(entries: MistakeEntry[]): {
  unresolved: MistakeEntry[];
  resolved: MistakeEntry[];
} {
  return {
    unresolved: entries.filter((e) => !e.resolved),
    resolved: entries.filter((e) => e.resolved),
  };
}

/** ISO 串取前十位就是那一天。`quizDay` 服务端已经是 `YYYY-MM-DD`。 */
export function dayOf(v: string | null | undefined): string | null {
  return v ? v.slice(0, 10) : null;
}

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

/** 学生正在对哪一条做什么。**放在页面上而不是行里** —— 列表刷新之后
 *  行会重建，错误状态和「再试一次」不能跟着没掉。 */
type Action = { id: string; resolved: boolean; s: 'confirming' | 'sending' | 'failed' };

type Phase =
  | { s: 'loading' }
  | { s: 'error'; message: string }
  /** 写成功了但对账失败 —— 手上这份已经不可信，一个数字都不显示。 */
  | { s: 'reconcile' }
  | { s: 'ready'; data: MistakeListResult };

export default function MistakesPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [action, setAction] = useState<Action | null>(null);

  const gen = useRef(0);
  const busy = useRef(false);

  const fetchList = useCallback(async (token: string, mine: number) => {
    const data = await api.mistakeList(token);
    if (mine !== gen.current) return null;
    return data;
  }, []);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    const mine = ++gen.current;
    setPhase({ s: 'loading' });
    setAction(null);
    try {
      const data = await fetchList(token, mine);
      if (data == null) return;
      setPhase({ s: 'ready', data });
    } catch (e) {
      if (mine !== gen.current) return;
      if (handleAuthFailure(e)) return;
      setPhase({ s: 'error', message: '没能打开错题本 —— 网络不太好，重试一下。' });
    }
  }, [fetchList]);

  useEffect(() => {
    void load();
    return () => {
      gen.current++;
    };
  }, [load]);

  /**
   * 发一次销账 / 恢复。
   *
   * 三条路：成功 → 对账；`updated:0` → 老老实实说失败；请求失败 →
   * **先读回来**再判断（见文件头最后一节）。
   */
  const send = useCallback(
    async (id: string, resolved: boolean) => {
      if (busy.current) return;
      const token = readToken();
      if (!token) return;
      busy.current = true;
      setAction({ id, resolved, s: 'sending' });
      try {
        const r = await api.mistakeResolve(token, { id, resolved });
        busy.current = false;
        if (!r || r.updated < 1) {
          // **不是成功** —— 不对账、不动列表
          setAction({ id, resolved, s: 'failed' });
          return;
        }
        // 成功 → 取权威列表
        const mine = ++gen.current;
        try {
          const data = await fetchList(token, mine);
          if (data == null) return;
          setAction(null);
          setPhase({ s: 'ready', data });
        } catch (e) {
          if (mine !== gen.current) return;
          if (handleAuthFailure(e)) return;
          setAction(null);
          setPhase({ s: 'reconcile' });
        }
      } catch (e) {
        busy.current = false;
        if (handleAuthFailure(e)) return;
        // **含糊的失败**：写可能已经落库了，绝不盲目重发 —— 先读回来。
        const mine = ++gen.current;
        try {
          const data = await fetchList(token, mine);
          if (data == null) return;
          const row = data.entries.find((x) => x.id === id);
          setPhase({ s: 'ready', data });
          // 已经是目标状态 = 那次其实成了
          setAction(row && row.resolved === resolved ? null : { id, resolved, s: 'failed' });
        } catch (e2) {
          if (mine !== gen.current) return;
          if (handleAuthFailure(e2)) return;
          setAction(null);
          setPhase({ s: 'reconcile' });
        }
      }
    },
    [fetchList],
  );

  if (phase.s === 'loading') {
    return (
      <Screen>
        <p className="text-center text-slate-400">载入中…</p>
      </Screen>
    );
  }

  if (phase.s === 'error') {
    return (
      <Screen>
        <Card>
          <Notice kind="error">{phase.message}</Notice>
          <Button onClick={() => void load()}>
            <span data-testid="retry">重试</span>
          </Button>
          <BackToToday navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  if (phase.s === 'reconcile') {
    return (
      <Screen>
        <Card>
          <p data-testid="reconcile-notice" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            那一步可能已经生效了，但现在取不到最新的错题本 —— 这里的数字都不能算数。
            刷新一下再看。
          </p>
          <Button onClick={() => void load()}>
            <span data-testid="retry">重新载入</span>
          </Button>
          <BackToToday navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  const { unresolved, resolved } = splitEntries(phase.data.entries);

  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-semibold mb-1">错题本</h1>
        <p className="text-sm text-slate-600">
          还没弄懂 <span data-testid="mistakes-total" className="font-medium tabular-nums">{phase.data.total}</span> 道
        </p>
        {phase.data.byTaskType.length > 0 ? (
          <p data-testid="by-tasktype" className="mt-1 text-sm text-slate-500">
            {phase.data.byTaskType.map((t) => `${taskTypeLabel(t.taskType)} ${t.count}`).join(' · ')}
          </p>
        ) : null}

        <Link
          data-testid="go-practice"
          to={ROUTES.mistakePractice}
          className="mt-4 block rounded-xl bg-slate-50 px-4 py-3 text-sm text-blue-600 underline"
        >
          开始重练今天的错题 →
        </Link>

        <section data-testid="unresolved-section" className="mt-6">
          <h2 className="text-base font-medium mb-2">还没弄懂</h2>
          {unresolved.length === 0 ? (
            <p data-testid="unresolved-empty" className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              这里空着 —— 目前没有还没弄懂的错题。
            </p>
          ) : (
            <GroupedList
              entries={unresolved}
              action={action}
              onAsk={(e) => setAction({ id: e.id, resolved: true, s: 'confirming' })}
              onCancel={() => setAction(null)}
              onSend={(e) => void send(e.id, true)}
            />
          )}
        </section>

        <section data-testid="resolved-section" className="mt-6">
          <h2 className="text-base font-medium mb-2">已经弄懂</h2>
          {resolved.length === 0 ? (
            <p data-testid="resolved-empty" className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              还没有标记过「已弄懂」的错题。
            </p>
          ) : (
            <GroupedList
              entries={resolved}
              action={action}
              onAsk={(e) => void send(e.id, false)}
              onCancel={() => setAction(null)}
              onSend={(e) => void send(e.id, false)}
            />
          )}
        </section>

        <BackToToday navigate={navigate} />
      </Card>
    </Screen>
  );
}

/**
 * 按**卷子 + 日期**分组。顺序完全跟着服务端（它已经按天倒序、
 * 同天按收录原因排好了）—— 这里只把相邻的同组合并，不重排、不过滤。
 *
 * 为什么要分组：用户验收看到的是同一份卷子的标题在每一张卡上重复
 * 一遍，一屏堆满了一样的字。标题与日期现在**每组只出一次**。
 */
/** 一条错题此刻的状态 —— 一眼能看出「要不要再练」。 */
function statusLabel(entry: MistakeEntry): string {
  if (entry.resolved) return '已掌握';
  if (entry.practiceCount > 0) return `重练中 · 连对 ${entry.correctStreak}`;
  return '未掌握';
}

function GroupedList({
  entries,
  action,
  onAsk,
  onCancel,
  onSend,
}: {
  entries: MistakeEntry[];
  action: Action | null;
  onAsk: (e: MistakeEntry) => void;
  onCancel: () => void;
  onSend: (e: MistakeEntry) => void;
}) {
  const groups: Array<{ key: string; title: string; day: string; items: MistakeEntry[] }> = [];
  for (const e of entries) {
    const key = `${e.passageTitle}__${e.quizDay}`;
    const tail = groups[groups.length - 1];
    if (tail && tail.key === key) tail.items.push(e);
    else groups.push({ key, title: e.passageTitle, day: e.quizDay, items: [e] });
  }
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <section key={`${g.key}-${gi}`} data-testid={`group-${gi}`}>
          <div
            data-testid={`group-head-${gi}`}
            className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm"
          >
            <span className="font-medium">{g.title}</span>
            <span className="text-slate-500 tabular-nums">{dayOf(g.day)}</span>
          </div>
          <ul className="flex flex-col gap-3">
            {g.items.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                action={action?.id === e.id ? action : null}
                onAsk={() => onAsk(e)}
                onCancel={onCancel}
                onSend={() => onSend(e)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EntryCard({
  entry,
  action,
  onAsk,
  onCancel,
  onSend,
}: {
  entry: MistakeEntry;
  action: Action | null;
  onAsk: () => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const id = entry.id;
  const [open, setOpen] = useState(false);
  const sending = action?.s === 'sending';
  const failed = action?.s === 'failed';
  const confirming = action?.s === 'confirming' || failed;

  return (
    <li data-testid={`entry-${id}`} data-entry-id={id} className="rounded-xl bg-slate-50 px-4 py-3">
      {/* S12I —— 篇目标题与日期已经在**组头**上，卡片里不再重复一遍。 */}
      <p className="text-xs text-slate-500">
        {taskTypeLabel(entry.taskType)} · {statusLabel(entry)}
      </p>

      <p data-testid={`stem-${id}`} className="mt-2 text-sm text-slate-900 whitespace-pre-wrap">
        {entry.stem}
      </p>

      <p className="mt-2 text-sm">
        <span className="text-slate-500">你当时写的：</span>
        <span data-testid={`old-answer-${id}`} className="font-medium">
          {entry.studentAnswer.trim() ? entry.studentAnswer : '（空着）'}
        </span>
      </p>
      {entry.correctAnswer ? (
        <p className="mt-1 text-sm">
          <span className="text-slate-500">正确答案：</span>
          <span data-testid={`correct-answer-${id}`} className="font-medium">
            {entry.correctAnswer}
          </span>
        </p>
      ) : null}
      {/* S12I —— 下面这一堆（分数 / 要点 / 范文 / 评语 / 解析 / 依据）以前
          全部摊开，一屏堆满。默认收起 —— 列表只回答「哪一题、错在哪」。 */}
      <button
        type="button"
        data-testid={`detail-toggle-${id}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mt-2 min-h-[44px] text-sm text-blue-600 underline"
      >
        {open ? '收起详情' : '展开详情'}
      </button>

      {open ? (
      <div data-testid={`detail-${id}`}>
      <p data-testid={`reason-${id}`} className="mt-1 text-xs text-slate-500">
        收录原因：{reasonLabel(String(entry.reason))}
      </p>
      <p data-testid={`marks-${id}`} className="mt-1 text-sm text-slate-500 tabular-nums">
        {entry.awarded} / {entry.maxMarks} 分
      </p>

      {entry.answerPoints.length > 0 ? (
        <p data-testid={`points-${id}`} className="mt-1 text-sm text-slate-700">
          <span className="text-slate-500">要点：</span>
          {entry.answerPoints.join(' · ')}
        </p>
      ) : null}
      {entry.answerModel ? (
        <p data-testid={`model-${id}`} className="mt-1 text-sm text-slate-700">
          <span className="text-slate-500">参考范文：</span>
          {entry.answerModel}
        </p>
      ) : null}
      {entry.markerComment ? (
        <p data-testid={`comment-${id}`} className="mt-1 text-sm bg-white rounded-lg px-3 py-2">
          <span className="text-slate-500">老师评语：</span>
          {entry.markerComment}
        </p>
      ) : null}
      {entry.explanation ? (
        <p data-testid={`explanation-${id}`} className="mt-1 text-sm text-slate-600">
          {entry.explanation}
        </p>
      ) : null}
      {entry.evidence ? (
        <p data-testid={`evidence-${id}`} className="mt-1 text-sm text-slate-600">
          <span className="text-slate-500">原文依据：</span>
          {entry.evidence}
        </p>
      ) : null}
      </div>
      ) : null}

      <p data-testid={`streak-${id}`} className="mt-1 text-xs text-slate-500 tabular-nums">
        重练连对 {entry.correctStreak} 次
      </p>

      {entry.submissionId ? (
        <Link
          data-testid={`detail-link-${id}`}
          to={scoreDetailPath(entry.submissionId)}
          className="mt-2 inline-block text-sm text-blue-600 underline"
        >
          看那次的整份成绩 →
        </Link>
      ) : null}

      {/* 销账 / 恢复 */}
      {entry.resolved ? (
        <div className="mt-3">
          <button
            type="button"
            data-testid={`restore-${id}`}
            disabled={sending}
            onClick={onAsk}
            className="min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm disabled:opacity-50"
          >
            {sending ? '处理中…' : '放回「还没弄懂」'}
          </button>
          {failed ? (
            <button
              type="button"
              data-testid={`confirm-restore-${id}`}
              onClick={onSend}
              className="ml-2 min-h-[44px] px-3 rounded-lg bg-blue-600 text-white text-sm"
            >
              再试一次
            </button>
          ) : null}
        </div>
      ) : confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">标记成「已弄懂」之后，重练队列里就不再出现它。</span>
          <button
            type="button"
            data-testid={`confirm-resolve-${id}`}
            disabled={sending}
            onClick={onSend}
            className="min-h-[44px] px-3 rounded-lg bg-blue-600 text-white text-sm disabled:bg-slate-300"
          >
            {sending ? '处理中…' : '确认已弄懂'}
          </button>
          <button
            type="button"
            data-testid={`cancel-resolve-${id}`}
            onClick={onCancel}
            className="min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm"
          >
            取消
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            data-testid={`resolve-${id}`}
            disabled={sending}
            onClick={onAsk}
            className="min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm disabled:opacity-50"
          >
            我已弄懂
          </button>
        </div>
      )}
      {failed ? (
        <p role="alert" data-testid={`resolve-error-${id}`} className="mt-1 text-sm text-rose-700">
          没能改这一条 —— 再试一次。
        </p>
      ) : null}
    </li>
  );
}

function BackToToday({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button
      type="button"
      data-testid="back-to-today"
      onClick={() => navigate(ROUTES.today)}
      className="mt-6 w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      回到今天的课
    </button>
  );
}
