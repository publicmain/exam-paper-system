import { useState } from 'react';

/**
 * ROUND 14 — Feature 7: Bulk attendance correction toolbar.
 *
 * Renders above the AttendanceAdmin table when one or more rows are
 * selected. Operator picks a target status + note, clicks apply,
 * and the parent component calls api.attendanceCorrectBulk.
 *
 * Note is required (it lands in AuditLog metadata so future auditors
 * can answer "why were these 12 students retroactively marked late").
 */

type Status = 'on_time' | 'late' | 'absent';

export default function BulkAttendanceBar({
  selectedCount,
  onApply,
  onCancel,
  busy,
}: {
  selectedCount: number;
  onApply: (status: Status, note: string) => Promise<void> | void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [status, setStatus] = useState<Status>('on_time');
  const [note, setNote] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);

  async function handleApply() {
    if (!note.trim()) {
      setLocalErr('请填写备注 — 会写入审计日志');
      return;
    }
    setLocalErr(null);
    await onApply(status, note.trim());
    setNote('');
  }

  if (selectedCount <= 0) return null;

  return (
    <div className="sticky top-0 z-10 mb-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center gap-3">
      <span className="font-medium text-sm text-blue-900">
        已选 {selectedCount} 项
      </span>
      <label className="text-sm">
        批量改为
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="ml-2 border rounded px-2 py-1"
          disabled={busy}
        >
          <option value="on_time">on_time</option>
          <option value="late">late</option>
          <option value="absent">absent</option>
        </select>
      </label>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注(必填,写入审计日志)"
        className="border rounded px-2 py-1 flex-1 min-w-[200px] text-sm"
        disabled={busy}
      />
      {localErr && <span className="text-xs text-rose-700">{localErr}</span>}
      <div className="ml-auto flex gap-2">
        <button
          className="px-3 py-1.5 text-sm rounded text-gray-700 hover:bg-gray-100"
          onClick={onCancel}
          disabled={busy}
        >
          取消
        </button>
        <button
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
          onClick={handleApply}
          disabled={busy}
        >
          {busy ? '应用中…' : '应用'}
        </button>
      </div>
    </div>
  );
}
