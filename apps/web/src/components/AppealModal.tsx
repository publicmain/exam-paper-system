import { useEffect, useState } from 'react';
import { submitAppeal } from '../lib/api-student';

/**
 * Appeal modal — students disputing an auto-grade open this from a per-
 * question "🚩 申诉这题" link on /my-history/submission/:id, OR from a
 * single whole-paper "🚩 申诉整张卷" link at the top of the same page.
 *
 * UX constraints (per spec):
 *  - Not Enter-submittable — explicit "提交申诉" click is required.
 *  - 500-char ceiling on the textarea.
 *  - Shows question context (stem + student's answer + correct answer)
 *    when paperQuestionId is supplied, so the student knows what they're
 *    actually disputing. Hidden for whole-paper appeals.
 *  - Graceful 404 — if /api/morning-quiz/appeals isn't deployed yet,
 *    submitAppeal() returns null and we tell the student to email instead.
 */

export interface AppealQuestionContext {
  sortOrder: number;
  stem: string;
  studentAnswer: string | null;
  correctAnswer: string | null;
  marks: number;
  awardedMarks: number | null;
}

interface Props {
  submissionId: string;
  /** Omit for whole-paper appeals. */
  paperQuestionId?: string;
  studentName: string;
  studentId?: string;
  questionContext?: AppealQuestionContext;
  onClose: () => void;
  onSubmitted?: () => void;
}

const MAX_LEN = 500;

export default function AppealModal({
  submissionId,
  paperQuestionId,
  studentName,
  studentId,
  questionContext,
  onClose,
  onSubmitted,
}: Props) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  // ESC closes (when not mid-submit).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      const r = await submitAppeal({
        submissionId,
        paperQuestionId,
        message: message.trim(),
        studentName,
        studentId,
      });
      if (r === null) {
        // Backend not deployed yet — graceful degrade rather than crash.
        setError('申诉功能暂未开放, 请直接联系老师 · Appeals not yet available; please tell your teacher.');
        return;
      }
      setSuccess(true);
      onSubmitted?.();
      // Auto-close after 1.4s so the student sees the confirmation.
      setTimeout(() => onClose(), 1400);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setPending(false);
    }
  }

  const trimmedLen = message.trim().length;
  const tooShort = trimmedLen < 5;
  const overLimit = message.length > MAX_LEN;
  const canSubmit = !pending && !success && !tooShort && !overLimit;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={() => { if (!pending) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="appeal-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="appeal-modal-title" className="text-lg font-bold text-gray-900">
            🚩 {paperQuestionId ? '申诉这题 · Appeal this question' : '申诉整张卷 · Appeal whole paper'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2 disabled:opacity-50"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {questionContext && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-1.5">
            <div className="text-gray-500">
              Q{questionContext.sortOrder} · 得分 {questionContext.awardedMarks ?? 0} / {questionContext.marks}
            </div>
            {questionContext.stem && (
              <div className="text-gray-800 whitespace-pre-wrap line-clamp-4">
                {questionContext.stem}
              </div>
            )}
            <div className="pt-1 text-gray-700">
              <span className="text-gray-400">我的答案:</span>{' '}
              {questionContext.studentAnswer || <em className="text-gray-400">(空答)</em>}
            </div>
            {questionContext.correctAnswer && (
              <div className="text-gray-700">
                <span className="text-gray-400">参考答案:</span> {questionContext.correctAnswer}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="appeal-message" className="block text-sm font-medium text-gray-700">
            申诉理由 · Reason
            <span className="text-xs text-gray-400 ml-2">(最多 {MAX_LEN} 字)</span>
          </label>
          <textarea
            id="appeal-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            // Required by spec: NOT auto-submittable on Enter — Enter just
            // inserts a newline like a normal textarea. The Submit click is
            // the only path to fire the POST.
            disabled={pending || success}
            rows={5}
            maxLength={MAX_LEN + 50}
            className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
            placeholder="请清楚地说明为什么这题(或这张卷)的批改有问题, 并提供你的依据。老师会在 2 个工作日内回复。"
          />
          <div className="flex items-center justify-between text-xs">
            <span className={overLimit ? 'text-rose-600' : 'text-gray-400'}>
              {message.length} / {MAX_LEN}
            </span>
            {tooShort && !success && (
              <span className="text-amber-600">请写至少 5 个字符</span>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-800">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
            ✓ 申诉已提交, 老师收到后会处理。
          </div>
        )}

        {!success && (
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium disabled:opacity-50"
            >
              取消
            </button>
            {!confirmStep ? (
              <button
                type="button"
                onClick={() => setConfirmStep(true)}
                disabled={!canSubmit}
                className="px-4 py-2 text-sm text-white rounded-lg font-semibold bg-rose-600 hover:bg-rose-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                提交申诉 · Submit
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canSubmit}
                className="px-4 py-2 text-sm text-white rounded-lg font-semibold bg-rose-700 hover:bg-rose-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {pending ? '提交中…' : '确认提交 · Confirm'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
