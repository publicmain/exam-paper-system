import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * ROUND 14 — Feature 15: Retract a question from a paper.
 *
 * Used on the MarkerScript page per-question. After retraction:
 *   - the question is flagged invalid on the paper
 *   - if `awardAllStudents` is on, every existing submission of this
 *     paper gets full marks awarded for the retracted question
 *   - the marker UI shows a "已作废" banner and disables score inputs
 *
 * Backend writes a row to AuditLog and triggers a regrade pass on
 * the paper's submissions when awardAllStudents=true.
 */

export default function RetractQuestionModal({
  paperId,
  paperQuestionId,
  questionLabel,
  onClose,
  onDone,
}: {
  paperId: string;
  paperQuestionId: string;
  questionLabel: string;
  onClose: () => void;
  onDone: (result: { reason: string; awardAllStudents: boolean }) => void;
}) {
  const [reason, setReason] = useState('');
  const [awardAll, setAwardAll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleConfirm() {
    if (!reason.trim()) {
      setErr('请填写作废原因');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.paperRetractQuestion(paperId, {
        paperQuestionId,
        reason: reason.trim(),
        awardAllStudents: awardAll,
      });
      onDone({ reason: reason.trim(), awardAllStudents: awardAll });
      onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
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
        className="bg-white rounded-lg shadow-xl p-5 max-w-md w-full space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">🚫 作废此题</h3>
          <button className="text-xl text-gray-500 hover:text-gray-700" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="text-sm text-gray-700">
          作废 <span className="font-mono">{questionLabel}</span> · 该题在卷面上仍显示但不再计分。
        </div>

        <label className="block text-sm">
          <span className="text-xs text-gray-500">作废原因(必填,审计日志可见)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border rounded px-2 py-1 w-full mt-1"
            rows={4}
            placeholder="如:答案有歧义 / mark scheme 错误 / 题目超纲"
          />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={awardAll}
            onChange={(e) => setAwardAll(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">给所有学生加这题的满分</span>
            <div className="text-xs text-gray-500">
              勾选后,已交卷的所有学生在该题上自动获得满分,total/manual score 重新汇总。
            </div>
          </span>
        </label>

        {err && <div className="text-sm text-rose-700">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded bg-rose-600 text-white hover:bg-rose-700 disabled:bg-gray-300"
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? '处理中…' : '确认作废'}
          </button>
        </div>
      </div>
    </div>
  );
}
