import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * ROUND 14 — Feature 10: Marker-side appeal review modal.
 *
 * Reviewer sees the student's appeal message, accepts / rejects, and
 * optionally overrides the per-question score. Resolution writes the
 * appeal status + a row to AuditLog.
 */

interface Appeal {
  id: string;
  submissionId: string;
  paperQuestionId?: string | null;
  message: string;
  status: string;
  studentName?: string;
  studentId?: string;
  createdAt: string;
}

export default function AppealReviewModal({
  appeal,
  onClose,
  onResolved,
}: {
  appeal: Appeal;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [note, setNote] = useState('');
  const [accept, setAccept] = useState<boolean | null>(null);
  const [scoreOverride, setScoreOverride] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleResolve(decision: boolean) {
    setAccept(decision);
    setBusy(true);
    setErr(null);
    try {
      const body: any = {
        accept: decision,
        note: note.trim() || undefined,
      };
      if (decision && scoreOverride.trim() !== '' && !isNaN(Number(scoreOverride))) {
        body.scoreOverride = Number(scoreOverride);
      }
      if (appeal.paperQuestionId) {
        body.paperQuestionId = appeal.paperQuestionId;
      }
      await api.morningQuizResolveAppeal(appeal.id, body);
      onResolved();
      onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setAccept(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-5 max-w-xl w-full space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">📢 复核申诉</h3>
          <button className="text-xl text-gray-500 hover:text-gray-700" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="text-xs text-gray-500">
          {appeal.studentName ?? appeal.studentId ?? '未知学生'} ·{' '}
          {new Date(appeal.createdAt).toLocaleString()}
          {appeal.paperQuestionId && (
            <>
              {' · '}
              <span className="font-mono">Q={appeal.paperQuestionId.slice(0, 8)}</span>
            </>
          )}
        </div>

        <div className="bg-gray-50 border rounded p-3 text-sm whitespace-pre-wrap">
          {appeal.message}
        </div>

        <label className="block text-sm">
          <span className="text-xs text-gray-500">审核备注(可选,审计日志可见)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border rounded px-2 py-1 w-full mt-1"
            rows={3}
            placeholder="如:复核后答案确实可接受 / 已修正分数"
          />
        </label>

        {appeal.paperQuestionId && (
          <label className="block text-sm">
            <span className="text-xs text-gray-500">
              该题分数覆盖(可选,仅接受时生效)
            </span>
            <input
              type="number"
              step="0.5"
              min={0}
              value={scoreOverride}
              onChange={(e) => setScoreOverride(e.target.value)}
              className="border rounded px-2 py-1 w-32 mt-1"
              placeholder="如 5"
            />
          </label>
        )}

        {err && <div className="text-sm text-rose-700">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            className="px-3 py-1.5 text-sm rounded text-gray-700 hover:bg-gray-100"
            onClick={onClose}
            disabled={busy}
          >
            取消
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            onClick={() => handleResolve(false)}
            disabled={busy}
          >
            {busy && accept === false ? '处理中…' : '✗ 驳回'}
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => handleResolve(true)}
            disabled={busy}
          >
            {busy && accept === true ? '处理中…' : '✓ 接受'}
          </button>
        </div>
      </div>
    </div>
  );
}
