import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * ROUND 14 — Feature 12: Transfer a student between classes.
 *
 * Used from the per-student row inside ClassDetailModal. The admin
 * picks a target class (excluding the source), optionally writes a
 * reason (lands in AuditLog), and confirms. Backend handles the
 * enrollment swap and any historical submission relabel.
 */

export default function TransferStudentModal({
  userId,
  userName,
  fromClassId,
  fromClassName,
  onClose,
  onTransferred,
}: {
  userId: string;
  userName: string;
  fromClassId: string;
  fromClassName: string;
  onClose: () => void;
  onTransferred: () => void;
}) {
  const [classes, setClasses] = useState<any[]>([]);
  const [toClassId, setToClassId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .listClasses()
      .then((cs: any[]) => setClasses((cs ?? []).filter((c) => c.id !== fromClassId)))
      .catch((e: any) => setErr(String(e?.message ?? e)));
  }, [fromClassId]);

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleTransfer() {
    if (!toClassId) {
      setErr('请先选择目标班级');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.classTransferStudent({
        userId,
        fromClassId,
        toClassId,
        reason: reason.trim() || undefined,
      });
      onTransferred();
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
          <h3 className="font-bold text-lg">转班 · Transfer</h3>
          <button className="text-xl text-gray-500 hover:text-gray-700" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="text-sm text-gray-700">
          <div>
            学生: <span className="font-medium">{userName}</span>
          </div>
          <div className="text-gray-500">
            从: {fromClassName}
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-xs text-gray-500">目标班级</span>
          <select
            value={toClassId}
            onChange={(e) => setToClassId(e.target.value)}
            className="border rounded px-2 py-1 w-full mt-1"
          >
            <option value="">— 选择班级 —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.classCode})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-xs text-gray-500">原因(可选,写入审计日志)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border rounded px-2 py-1 w-full mt-1"
            rows={3}
            placeholder="如:学生要求换班 / 升班 / 教学组调整"
          />
        </label>

        {err && <div className="text-sm text-rose-700">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleTransfer} disabled={busy}>
            {busy ? '转班中…' : '确认转班'}
          </button>
        </div>
      </div>
    </div>
  );
}
