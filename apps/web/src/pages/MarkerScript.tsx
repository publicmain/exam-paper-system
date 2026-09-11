import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { MathHtml } from '../components/MathHtml';
import { AuthImage } from '../components/AuthImage';
import RetractQuestionModal from '../components/RetractQuestionModal';
import { Spinner, ErrorState } from '../components/AsyncState';
import { Dialog } from '../components/Dialog';
import { clean } from '../components/exam/shared/textUtils';
import { prettifyPaperName } from '../lib/paperName';
import {
  STAGE_BADGE_CLASS,
  STAGE_HINT,
  STAGE_LABEL,
  ScoreDraft,
  draftFromScript,
  errorMessage,
  isDraftDirty,
  isStructuredType,
  previewTotals,
  readStoredDrafts,
  stageOfSubmission,
  validateMarks,
  writeStoredDrafts,
} from '../lib/markerStages';

/**
 * 老师判主观题要看的答案材料 —— 从 `snapshotAnswer`（发卷时的快照）
 * 与 `question.answerContent`（题库现值）里取，快照优先。
 *
 * 2026-09-05 首发前复核：这一页原来只渲染原文 / 题干 / 学生答案 / 打分框，
 * 老师判一道两分的理解题得自己回原文找答案。首发周的内容包把
 * `text`（参考答案）、`accept`（可接受写法）、`rubric`（评分标准）、
 * `evidence`（原文依据）都写进了 answerContent，这里把它们摆出来。
 * 旧 fixture 的 `markScheme` / `exampleAnswer` 也一并兼容。
 */
export function referenceOf(pq: any): {
  text: string | null;
  accept: string[];
  rubric: string | null;
  evidence: string | null;
  example: string | null;
} {
  const str = (v: unknown) => (typeof v === 'string' && v.trim().length > 0 ? v : null);
  const sources = [pq?.snapshotAnswer, pq?.question?.answerContent].filter(
    (x) => x && typeof x === 'object' && !Array.isArray(x),
  ) as Array<Record<string, unknown>>;
  const first = (...keys: string[]) => {
    for (const src of sources) for (const k of keys) {
      const v = str(src[k]);
      if (v) return v;
    }
    return null;
  };
  const text = first('text', 'correctAnswer');
  let accept: string[] = [];
  for (const src of sources) {
    if (Array.isArray(src.accept)) {
      accept = src.accept.map((a) => String(a)).filter((a) => a.trim().length > 0);
      break;
    }
  }
  // 与参考答案只差大小写的写法不单列 —— 那是给自动判分用的，老师不用看。
  accept = accept.filter((a) => text == null || a.toLowerCase() !== text.toLowerCase());
  return {
    text,
    accept,
    rubric: first('rubric', 'markScheme'),
    evidence: first('evidence'),
    example: first('exampleAnswer'),
  };
}

type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; error?: string; retryable?: boolean };
type DialogState = null | { kind: 'publish' } | { kind: 'release' } | { kind: 'leave'; to: string };

/**
 * 逐题判分页（2026-09-11 审计 M01 / M02 / M03 / IOS-10 重做）。
 *
 * 编辑模型（M02）：
 *   · 每题一份本地编辑缓冲 `edits`，另存一份「服务端已确认」的值 `saved`；
 *     两者不同 = 这题未保存。
 *   · 保存一题只 PATCH 这一题，用服务端返回值更新这一题的 `saved` 与分数，
 *     **不再整页 reload** —— 其他题的未保存输入、保存期间继续打的字都不动。
 *   · 保存失败：输入原样保留，错误显示在这一题里，可以重试。
 *   · 有未保存 / 保存中的题时发布按钮不可用；「保存全部修改」一次处理。
 *   · 离开保护：刷新 / 关闭走 beforeunload；站内链接弹出选择；未保存的输入
 *     同时写进本标签页 sessionStorage，浏览器后退再回来也能恢复。
 *
 * 客观题（M03）：正式服务对 MCQ 一律拒绝人工改分，这里只读显示自动分，
 * 不再提供「能改却永远保存不了」的输入框。
 *
 * 阶段（M01）：待批 / 批改中 / 已评分待发布 / 已发布，保存完最后一题立刻
 * 显示「已评分待发布」并给出发布入口；发布只经确认对话框调用一次 finalize。
 */
export default function MarkerScriptPage() {
  const { submissionId = '' } = useParams<{ submissionId: string }>();
  const nav = useNavigate();
  const [sub, setSub] = useState<any | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, ScoreDraft>>({});
  const [saved, setSaved] = useState<Record<string, ScoreDraft>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'claim' | 'release' | 'finalize' | 'saveAll'>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  // ROUND 14 — Feature 15: question retraction modal target + local
  // optimistic "已作废" overlay keyed by paperQuestionId so the banner
  // appears before a reload completes.
  const [retracting, setRetracting] = useState<{ pqId: string; label: string } | null>(null);
  const [localRetracted, setLocalRetracted] = useState<Record<string, string>>({});

  // 异步回调里要读「此刻」的值，而不是闭包创建时的值
  const editsRef = useRef(edits);
  editsRef.current = edits;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;

  const load = useCallback(
    async (opts: { restoreDrafts?: boolean } = {}) => {
      if (!submissionId) return;
      setLoadErr(null);
      try {
        const data = await api.markerSubmission(submissionId);
        const serverDrafts: Record<string, ScoreDraft> = {};
        for (const s of data?.scripts ?? []) serverDrafts[s.id] = draftFromScript(s);
        const editable = data?.status === 'submitted' && !!data?.myClaim;
        const stored = opts.restoreDrafts && editable ? readStoredDrafts(submissionId) : {};
        if (data?.status && data.status !== 'submitted') writeStoredDrafts(submissionId, {});
        const structuredIds = new Set(
          (data?.scripts ?? [])
            .filter((s: any) => isStructuredType(s.paperQuestion?.question?.questionType))
            .map((s: any) => s.id),
        );
        const prevEdits = editsRef.current;
        const prevSaved = savedRef.current;
        const nextEdits: Record<string, ScoreDraft> = {};
        let restored = 0;
        for (const [id, serverDraft] of Object.entries(serverDrafts)) {
          if (prevEdits[id] && prevSaved[id] && isDraftDirty(prevEdits[id], prevSaved[id])) {
            nextEdits[id] = prevEdits[id]; // 本页还没保存的输入：保留
          } else if (structuredIds.has(id) && stored[id] && isDraftDirty(stored[id], serverDraft)) {
            nextEdits[id] = stored[id]; // 上次离开时没保存的：恢复
            restored += 1;
          } else {
            nextEdits[id] = serverDraft;
          }
        }
        setSub(data);
        setSaved(serverDrafts);
        setEdits(nextEdits);
        if (restored > 0) setNotice(`恢复了 ${restored} 题上次没保存的修改（还没保存，请检查后保存）。`);
      } catch (ex) {
        setLoadErr(errorMessage(ex));
      }
    },
    [submissionId],
  );

  useEffect(() => {
    void load({ restoreDrafts: true });
  }, [load]);

  // ── 派生状态 ──
  const scripts: any[] = sub?.scripts ?? [];
  const structuredScripts = useMemo(
    () => scripts.filter((s) => isStructuredType(s.paperQuestion?.question?.questionType)),
    [scripts],
  );
  const dirtyIds = structuredScripts.filter((s) => isDraftDirty(edits[s.id], saved[s.id])).map((s) => s.id);
  const savingIds = structuredScripts.filter((s) => saveState[s.id]?.status === 'saving').map((s) => s.id);
  const hasUnsaved = dirtyIds.length > 0 || savingIds.length > 0;
  const hasUnsavedRef = useRef(hasUnsaved);
  hasUnsavedRef.current = hasUnsaved;
  const ungraded = structuredScripts.filter((s) => s.awardedMarks == null).length;
  const status: string = sub?.status ?? '';
  const myClaim = !!sub?.myClaim;
  const canEdit = status === 'submitted' && myClaim;
  const stage = sub
    ? stageOfSubmission({ status, ungradedCount: ungraded, claimActive: sub.claim?.status === 'active' })
    : null;
  const totals = previewTotals(scripts);

  // 本标签页草稿：只存未保存的题
  useEffect(() => {
    if (!sub || !submissionId || sub.status !== 'submitted') return;
    const dirty: Record<string, ScoreDraft> = {};
    for (const id of dirtyIds) dirty[id] = edits[id];
    writeStoredDrafts(submissionId, dirty);
    // dirtyIds 由 edits / saved 推出
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, saved, sub, submissionId]);

  // 刷新 / 关闭标签页：有未保存修改时让浏览器拦下
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // 站内链接（顶部导航、返回队列）：有未保存修改时先问
  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!hasUnsavedRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      setDialogError(null);
      setDialog({ kind: 'leave', to: url.pathname + url.search + url.hash });
    };
    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, []);

  function setEdit(id: string, patch: Partial<ScoreDraft>) {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { awardedMarks: '', markerComment: '' }), ...patch } }));
    setSaveState((prev) =>
      prev[id]?.status === 'error' && !prev[id]?.retryable ? { ...prev, [id]: { status: 'idle' } } : prev,
    );
  }

  function revert(id: string) {
    const base = savedRef.current[id];
    if (!base) return;
    setEdits((prev) => ({ ...prev, [id]: base }));
    setSaveState((prev) => ({ ...prev, [id]: { status: 'idle' } }));
  }

  /** 保存一题。只动这一题；返回是否成功。 */
  async function saveScript(id: string): Promise<boolean> {
    if (saveStateRef.current[id]?.status === 'saving') return false;
    const script = scripts.find((s) => s.id === id);
    const pq = (sub?.assignment?.paper?.questions ?? []).find((q: any) => q.id === script?.paperQuestionId);
    const max = Number(pq?.marks ?? script?.paperQuestion?.marks ?? 0);
    const v = editsRef.current[id] ?? { awardedMarks: '', markerComment: '' };
    const invalid = validateMarks(v.awardedMarks, max);
    if (invalid) {
      setSaveState((prev) => ({ ...prev, [id]: { status: 'error', error: invalid, retryable: false } }));
      return false;
    }
    const body = {
      awardedMarks: Number(v.awardedMarks),
      markerComment: v.markerComment.trim() ? v.markerComment : null,
    };
    setSaveState((prev) => ({ ...prev, [id]: { status: 'saving' } }));
    try {
      const res: any = await api.markerScoreScript(id, body);
      const confirmed = draftFromScript({
        awardedMarks: res?.awardedMarks ?? body.awardedMarks,
        markerComment: res && 'markerComment' in res ? res.markerComment : body.markerComment,
      });
      setSaved((prev) => ({ ...prev, [id]: confirmed }));
      setSub((prev: any) =>
        prev
          ? {
              ...prev,
              scripts: (prev.scripts ?? []).map((s: any) =>
                s.id === id
                  ? {
                      ...s,
                      awardedMarks: res?.awardedMarks ?? body.awardedMarks,
                      markerComment: confirmed.markerComment || null,
                      markedById: res?.markedById ?? s.markedById ?? 'me',
                      markedAt: res?.markedAt ?? s.markedAt ?? null,
                    }
                  : s,
              ),
            }
          : prev,
      );
      setSaveState((prev) => ({ ...prev, [id]: { status: 'saved' } }));
      return true;
    } catch (ex) {
      setSaveState((prev) => ({
        ...prev,
        [id]: { status: 'error', error: `保存失败：${errorMessage(ex)}。输入还在，可以重试。`, retryable: true },
      }));
      return false;
    }
  }

  /** 逐题保存所有未保存的题（跳过正在保存的）。返回失败的题数。 */
  async function saveAll(): Promise<number> {
    const ids = structuredScripts
      .filter((s) => isDraftDirty(editsRef.current[s.id], savedRef.current[s.id]))
      .map((s) => s.id);
    setBusy('saveAll');
    let failed = 0;
    for (const id of ids) {
      const ok = await saveScript(id);
      if (!ok) failed += 1;
    }
    setBusy(null);
    return failed;
  }

  async function claim() {
    if (!submissionId) return;
    setBusy('claim');
    setPageError(null);
    try {
      await api.markerClaim(submissionId);
      await load();
    } catch (ex) {
      setPageError(`认领失败：${errorMessage(ex)}`);
    } finally {
      setBusy(null);
    }
  }

  async function confirmRelease() {
    setBusy('release');
    setDialogError(null);
    try {
      await api.markerRelease(submissionId);
      writeStoredDrafts(submissionId, {});
      hasUnsavedRef.current = false;
      setDialog(null);
      nav('/marker');
    } catch (ex) {
      setDialogError(`释放失败：${errorMessage(ex)}`);
    } finally {
      setBusy(null);
    }
  }

  async function confirmPublish() {
    setDialogError(null);
    // 防御：对话框打开后又有了未保存修改（例如另一题保存失败），绝不发布库里的旧分数
    if (hasUnsavedRef.current) {
      setDialogError('还有未保存或正在保存的题，先处理完再发布。');
      return;
    }
    setBusy('finalize');
    try {
      const updated: any = await api.markerFinalize(submissionId);
      writeStoredDrafts(submissionId, {});
      setDialog(null);
      setNotice(
        `成绩已发布：自动分 ${updated?.autoScore ?? 0} + 人工分 ${updated?.manualScore ?? 0} = 总分 ${
          updated?.totalScore ?? 0
        } / ${sub?.maxScore ?? '—'}。学生现在能看到成绩。`,
      );
      await load();
    } catch (ex) {
      setDialogError(`发布失败：${errorMessage(ex)}`);
    } finally {
      setBusy(null);
    }
  }

  async function leave(to: string, mode: 'save' | 'discard') {
    setDialogError(null);
    if (mode === 'save') {
      const failed = await saveAll();
      if (failed > 0) {
        setDialogError(`有 ${failed} 题没保存成功，已留在本页。请看题目下方的提示。`);
        return;
      }
    } else {
      writeStoredDrafts(submissionId, {});
    }
    hasUnsavedRef.current = false;
    setDialog(null);
    nav(to);
  }

  if (loadErr && !sub) return <ErrorState message={loadErr} onRetry={() => void load()} />;
  if (!sub) return <Spinner label="加载答卷…" />;

  const paper = sub.assignment?.paper;
  const publishBlocker = !canEdit
    ? null
    : savingIds.length > 0
      ? '正在保存，稍等保存完成再发布。'
      : dirtyIds.length > 0
        ? '先保存全部修改再发布 —— 发布只用已经保存的分数。'
        : ungraded > 0
          ? `还有 ${ungraded} 道主观题没打分。`
          : null;
  const publishDisabled = !canEdit || publishBlocker != null || busy === 'finalize';

  return (
    <div className="space-y-4">
      {/* 页头 + 常驻操作条：学生标识、阶段、保存状态、主要动作始终可达 */}
      <header className="card sticky top-0 z-10 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to="/marker" className="tap inline-flex items-center text-sm font-medium text-blue-700 hover:underline">
              ← 返回判分队列
            </Link>
            <h1 className="text-xl font-bold break-words" title={paper?.name ?? 'Paper'}>
              {prettifyPaperName(paper?.name ?? 'Paper')}
            </h1>
            <p className="text-sm text-gray-700 mt-1 break-words">
              学生：<strong>{sub.student?.name ?? sub.student?.email}</strong> · 班级：{sub.assignment?.class?.name}
              {sub.assignment?.class?.classCode ? ` (${sub.assignment.class.classCode})` : ''}
            </p>
            <p className="text-sm text-gray-700 flex flex-wrap items-center gap-2 mt-1">
              {stage ? (
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STAGE_BADGE_CLASS[stage]}`}>
                  {STAGE_LABEL[stage]}
                </span>
              ) : (
                <span className="badge">学生作答中</span>
              )}
              <span>
                当前分数：自动 {totals.auto} + 人工 {totals.manual} = {totals.total} / {sub.maxScore}
              </span>
              {sub.claim?.status === 'active' && !myClaim ? (
                <span className="text-amber-800">已被 {sub.claim.marker?.name ?? '其他老师'} 认领</span>
              ) : null}
            </p>
            {stage ? <p className="text-xs text-gray-600 mt-1">{STAGE_HINT[stage]}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && dirtyIds.length > 0 ? (
              <button
                type="button"
                className="btn tap"
                onClick={() => void saveAll()}
                disabled={busy === 'saveAll'}
              >
                保存全部修改（{dirtyIds.length}）
              </button>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                className="btn tap"
                onClick={() => {
                  setDialogError(null);
                  setDialog({ kind: 'release' });
                }}
                disabled={busy === 'release'}
              >
                释放认领
              </button>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                className="btn btn-primary tap disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  setDialogError(null);
                  setDialog({ kind: 'publish' });
                }}
                disabled={publishDisabled}
                aria-describedby={publishBlocker ? 'publish-blocker' : undefined}
              >
                发布成绩
              </button>
            ) : null}
            {!myClaim && status === 'submitted' ? (
              <button type="button" className="btn btn-primary tap" onClick={() => void claim()} disabled={busy === 'claim'}>
                {busy === 'claim' ? '认领中…' : '认领这份答卷'}
              </button>
            ) : null}
          </div>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3 text-sm" aria-live="polite">
            {savingIds.length > 0 ? <span className="text-blue-800">正在保存 {savingIds.length} 题…</span> : null}
            {dirtyIds.length > 0 ? <span className="font-semibold text-amber-800">有 {dirtyIds.length} 题未保存</span> : null}
            {!hasUnsaved ? <span className="text-emerald-800">所有输入都已保存</span> : null}
            {publishBlocker ? (
              <span id="publish-blocker" className="text-gray-700">
                {publishBlocker}
              </span>
            ) : null}
          </div>
        ) : null}
        {!myClaim && status === 'submitted' ? (
          <p className="text-sm text-amber-800">你还没认领这份答卷，现在是只读。认领后才能打分。</p>
        ) : null}
        {pageError ? (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {pageError}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {notice}
          </p>
        ) : null}
        {loadErr ? (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            刷新失败：{loadErr}（页面上的输入没有丢）
          </p>
        ) : null}
      </header>

      {(paper?.questions ?? []).map((pq: any, i: number) => {
        const script = scripts.find((s: any) => s.paperQuestionId === pq.id);
        const qType = pq.question?.questionType;
        const isMcq = qType === 'mcq';
        const structured = isStructuredType(qType);
        const content = pq.snapshotContent ?? {};
        const opts = pq.snapshotOptions ?? pq.question?.options;
        // ROUND 14 — Feature 15: question retraction state. Server-side
        // `retractedAt` / `retractedReason` if present win; local optimistic
        // state from this session also counts.
        const retractedReason: string | null = pq.retractedReason ?? localRetracted[pq.id] ?? null;
        const isRetracted = !!retractedReason || !!pq.retractedAt;
        const ref = referenceOf(pq);
        const hasRef = !!(ref.text || ref.rubric || ref.evidence || ref.example || ref.accept.length);
        const headingId = `q-${pq.id}-title`;
        const v = script ? edits[script.id] ?? { awardedMarks: '', markerComment: '' } : null;
        const dirty = script ? isDraftDirty(edits[script.id], saved[script.id]) : false;
        const st: SaveState = (script && saveState[script.id]) || { status: 'idle' };
        const inputsDisabled = !canEdit || isRetracted;

        return (
          <section key={pq.id} className="card" aria-labelledby={headingId}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h2 id={headingId} className="font-bold text-base">
                Q{i + 1}.
              </h2>
              <span className="badge">{isMcq ? '客观题' : structured ? '主观题' : qType}</span>
              <span className="badge">满分 {pq.marks}</span>
              {script?.autoCorrect != null && (
                <span className={`badge ${script.autoCorrect ? 'badge-success' : 'badge-error'}`}>
                  {script.autoCorrect ? '自动判：正确' : '自动判：错误'}
                </span>
              )}
              {structured && script ? (
                <span className="ml-1 text-xs font-semibold">
                  {st.status === 'saving' ? (
                    <span className="text-blue-800">保存中…</span>
                  ) : dirty ? (
                    <span className="text-amber-800">未保存</span>
                  ) : script.awardedMarks == null ? (
                    <span className="text-gray-700">未评分</span>
                  ) : script.markedById ? (
                    <span className="text-emerald-800">已保存</span>
                  ) : (
                    <span className="text-gray-700">自动判分</span>
                  )}
                </span>
              ) : null}
              {!isRetracted && paper?.id && (
                <button
                  type="button"
                  className="tap ml-auto text-sm text-rose-700 hover:text-rose-900 hover:underline"
                  onClick={() => setRetracting({ pqId: pq.id, label: `Q${i + 1}` })}
                  title="作废此题 —— 给所有学生加满分或仅标记无效"
                >
                  作废此题
                </button>
              )}
            </div>
            {isRetracted && (
              <div className="mb-2 px-3 py-2 bg-rose-50 border border-rose-300 text-rose-800 rounded text-sm">
                已作废：{retractedReason ?? '(无原因记录)'} · 该题不再计分
              </div>
            )}
            {/* R15-Audit#3 — 原文折叠显示，老师能对照原文判理解题 */}
            {typeof content.passage === 'string' && content.passage.length > 0 && (
              <details className="mb-3 bg-gray-50 border border-gray-200 rounded">
                <summary className="tap flex items-center cursor-pointer px-3 text-xs uppercase tracking-wide text-gray-700 font-semibold select-none">
                  原文 · {clean(content.passageTitle ?? '原文文本')}
                </summary>
                <div className="px-4 py-3 text-sm text-gray-800 font-serif leading-[1.7] whitespace-pre-wrap border-t border-gray-200">
                  {content.passage}
                </div>
              </details>
            )}
            <div className="text-sm">
              <MathHtml source={content.stem ?? ''} />
            </div>
            {pq.question?.assets?.length > 0 && (
              <div className="mt-2 space-y-2">
                {pq.question.assets.map((a: any) => (
                  <AuthImage key={a.id} src={a.storageUrl} alt={a.altText ?? ''} />
                ))}
              </div>
            )}
            {!isMcq && content.parts?.length > 0 && (
              <div className="ml-2 mt-2 text-sm space-y-1">
                {content.parts.map((p: any) => (
                  <div key={p.label}>
                    <span className="font-semibold">({p.label})</span> <MathHtml source={p.content} />
                    <span className="text-xs text-gray-600 ml-2">[{p.marks}]</span>
                  </div>
                ))}
              </div>
            )}

            {!isMcq && hasRef && (
              <div
                data-testid={`reference-${pq.id}`}
                className="mt-3 bg-green-50 border border-green-200 rounded px-3 py-2 text-sm space-y-1"
              >
                <div className="text-xs uppercase tracking-wide text-green-800 font-semibold">参考答案 · 评分标准</div>
                {ref.text && (
                  <div>
                    <span className="text-gray-700">参考答案：</span>
                    <span className="font-medium whitespace-pre-wrap">{clean(ref.text)}</span>
                  </div>
                )}
                {ref.accept.length > 0 && (
                  <div>
                    <span className="text-gray-700">也算对：</span>
                    <span className="whitespace-pre-wrap">{ref.accept.map(clean).join(' / ')}</span>
                  </div>
                )}
                {ref.example && (
                  <div>
                    <span className="text-gray-700">示例答案：</span>
                    <span className="whitespace-pre-wrap">{clean(ref.example)}</span>
                  </div>
                )}
                {ref.rubric && (
                  <div>
                    <span className="text-gray-700">评分标准：</span>
                    <span className="whitespace-pre-wrap">{clean(ref.rubric)}</span>
                  </div>
                )}
                {ref.evidence && (
                  <div className="text-gray-800 italic">
                    <span className="not-italic text-gray-700">原文依据：</span>
                    {clean(ref.evidence)}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 border-t pt-3">
              <div className="text-xs uppercase tracking-wide text-gray-600 mb-1">学生作答</div>
              {isMcq ? (
                <div className="text-sm">
                  所选选项：<span className="font-mono">{script?.selectedOption ?? '—'}</span>
                  {Array.isArray(opts) && (
                    <ul className="mt-1 ml-4 text-xs text-gray-700">
                      {opts.map((o: any) => (
                        <li key={o.key}>
                          <span className="font-mono">{o.key}.</span>{' '}
                          <span className={o.correct ? 'text-green-800 font-semibold' : ''}>
                            {o.text} {o.correct ? '（正确答案）' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm bg-gray-50 p-2 rounded">
                  {script?.textAnswer ?? <span className="text-gray-600">— 空白 —</span>}
                </pre>
              )}
            </div>

            {/* M03：客观题只读。正式服务禁止人工改 MCQ 分数，这里不给改分控件。 */}
            {isMcq && script ? (
              <div className="mt-3 border-t pt-3 text-sm text-gray-800">
                <p>
                  自动得分：{script.awardedMarks ?? 0} / {pq.marks} 分
                </p>
                <p className="text-xs text-gray-600 mt-1">客观题自动判分，不在这里改分。答案键有误请用「作废此题」或联系管理员。</p>
              </div>
            ) : null}

            {structured && script && v ? (
              <div className="mt-3 border-t pt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`marks-${script.id}`} className="text-sm font-semibold">
                    得分
                  </label>
                  <input
                    id={`marks-${script.id}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={pq.marks}
                    step="0.5"
                    className="border rounded px-2 w-24 text-sm min-h-[44px]"
                    value={v.awardedMarks}
                    disabled={inputsDisabled}
                    aria-invalid={st.status === 'error' && !st.retryable ? true : undefined}
                    aria-describedby={st.status === 'error' ? `err-${script.id}` : undefined}
                    onChange={(e) => setEdit(script.id, { awardedMarks: e.target.value })}
                  />
                  <span className="text-sm text-gray-700">/ {pq.marks}</span>
                </div>
                <label htmlFor={`comment-${script.id}`} className="sr-only">
                  评语
                </label>
                <textarea
                  id={`comment-${script.id}`}
                  className="w-full border rounded p-2 text-sm font-sans"
                  placeholder="评语（选填）"
                  rows={3}
                  value={v.markerComment}
                  disabled={inputsDisabled}
                  onChange={(e) => setEdit(script.id, { markerComment: e.target.value })}
                />
                {st.status === 'error' ? (
                  <div
                    id={`err-${script.id}`}
                    role="alert"
                    className="flex flex-wrap items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
                  >
                    <span>{st.error}</span>
                    {st.retryable && canEdit ? (
                      <button type="button" className="btn tap" onClick={() => void saveScript(script.id)}>
                        重试保存
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {canEdit && !isRetracted ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-primary tap"
                      disabled={st.status === 'saving' || !dirty}
                      onClick={() => void saveScript(script.id)}
                    >
                      保存得分
                    </button>
                    {dirty && st.status !== 'saving' ? (
                      <button type="button" className="btn tap" onClick={() => revert(script.id)}>
                        撤销修改
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}

      {/* ROUND 14 — Feature 15: question retraction modal */}
      {retracting && paper?.id && (
        <RetractQuestionModal
          paperId={paper.id}
          paperQuestionId={retracting.pqId}
          questionLabel={retracting.label}
          onClose={() => setRetracting(null)}
          onDone={(r) => {
            setLocalRetracted((prev) => ({ ...prev, [retracting.pqId]: r.reason }));
            // Reload async so server-side retractedReason replaces the
            // optimistic local one once persisted. 未保存的输入会保留。
            void load();
          }}
        />
      )}

      <Dialog
        open={dialog?.kind === 'publish'}
        title="发布成绩？"
        description={
          <>
            <p>
              发布后学生能看到成绩，判分完成并释放认领。将发布的分数：自动 {totals.auto} + 人工 {totals.manual} ={' '}
              <strong>
                {totals.total} / {sub.maxScore}
              </strong>
              。
            </p>
          </>
        }
        busy={busy === 'finalize'}
        error={dialogError}
        onClose={() => setDialog(null)}
        testId="publish-dialog"
        footer={
          <>
            <button type="button" className="btn tap" onClick={() => setDialog(null)} disabled={busy === 'finalize'}>
              返回检查
            </button>
            <button
              type="button"
              className="btn btn-primary tap"
              onClick={() => void confirmPublish()}
              disabled={busy === 'finalize'}
            >
              {busy === 'finalize' ? '发布中…' : '确认发布'}
            </button>
          </>
        }
      />

      <Dialog
        open={dialog?.kind === 'release'}
        title="释放这份答卷的认领？"
        description={
          dirtyIds.length > 0
            ? `释放后其他老师可以接手。你还有 ${dirtyIds.length} 题没保存，释放会丢掉这些修改。`
            : '释放后其他老师可以接手；已保存的分数会保留。'
        }
        busy={busy === 'release'}
        error={dialogError}
        onClose={() => setDialog(null)}
        footer={
          <>
            <button type="button" className="btn tap" onClick={() => setDialog(null)} disabled={busy === 'release'}>
              继续判分
            </button>
            <button type="button" className="btn btn-danger tap" onClick={() => void confirmRelease()} disabled={busy === 'release'}>
              {busy === 'release' ? '释放中…' : '确认释放'}
            </button>
          </>
        }
      />

      <Dialog
        open={dialog?.kind === 'leave'}
        title="有未保存的修改"
        description={`有 ${dirtyIds.length} 题的分数或评语还没保存${savingIds.length ? `，另有 ${savingIds.length} 题正在保存` : ''}。要怎么处理？`}
        busy={busy === 'saveAll'}
        error={dialogError}
        onClose={() => setDialog(null)}
        footer={
          <>
            <button type="button" className="btn tap" onClick={() => setDialog(null)} disabled={busy === 'saveAll'}>
              留在本页
            </button>
            <button
              type="button"
              className="btn btn-danger tap"
              onClick={() => dialog?.kind === 'leave' && void leave(dialog.to, 'discard')}
              disabled={busy === 'saveAll'}
            >
              放弃修改并离开
            </button>
            <button
              type="button"
              className="btn btn-primary tap"
              onClick={() => dialog?.kind === 'leave' && void leave(dialog.to, 'save')}
              disabled={busy === 'saveAll'}
            >
              保存全部后离开
            </button>
          </>
        }
      />
    </div>
  );
}
