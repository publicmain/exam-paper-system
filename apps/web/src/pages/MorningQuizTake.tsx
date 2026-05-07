import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface PaperQuestion {
  id: string;
  sortOrder: number;
  marks: number;
  questionType: 'mcq' | 'short_answer' | 'structured' | 'essay';
  snapshotContent: any;
  snapshotOptions: Array<{ key: string; text: string }> | null;
}

interface SessionView {
  sessionId: string;
  attendanceId: string;
  submissionId: string | null;
  quizEnd: string;
  paperQuestions: PaperQuestion[];
}

/**
 * Student morning-quiz page. Fetches the shuffle-applied paper, renders
 * questions in their (already-shuffled) order, and autosaves each answer
 * onBlur. The countdown and the submit button work off `quizEnd` from the
 * server response — that's the single source of truth, so client clock
 * drift can't extend the window. When time hits zero we auto-submit (the
 * server-side cron also force-submits at the same moment as a backstop).
 */
export default function MorningQuizTake() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { selectedOption?: string; textAnswer?: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    api
      .morningQuizSession(sessionId)
      .then((v: SessionView) => setView(v))
      .catch((e: any) => setError(e.message ?? String(e)));
  }, [sessionId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = useMemo(() => {
    if (!view) return 0;
    return Math.max(0, new Date(view.quizEnd).getTime() - now);
  }, [view, now]);

  // Auto-submit when remaining hits zero. Keep idempotent.
  useEffect(() => {
    if (!view || submitted) return;
    if (remainingMs > 0) return;
    handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, view, submitted]);

  async function saveAnswer(pqId: string, body: { selectedOption?: string | null; textAnswer?: string | null }) {
    if (!sessionId) return;
    setSavingId(pqId);
    try {
      await api.morningQuizSaveAnswer(sessionId, { paperQuestionId: pqId, ...body });
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  }

  async function handleSubmit() {
    if (!sessionId || submitted) return;
    setSubmitted(true);
    try {
      await api.morningQuizSubmit(sessionId);
      navigate('/student', { replace: true });
    } catch (e: any) {
      setError(e.message ?? String(e));
      setSubmitted(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="text-rose-600 text-lg mb-4">⚠️ {error}</div>
        <button className="text-sm text-blue-600 underline" onClick={() => navigate('/student')}>
          返回首页
        </button>
      </div>
    );
  }
  if (!view) return <div className="p-6 text-gray-500">Loading…</div>;

  const mm = String(Math.floor(remainingMs / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((remainingMs % 60_000) / 1000)).padStart(2, '0');
  const danger = remainingMs < 5 * 60_000;

  return (
    <div className="max-w-3xl mx-auto px-4 pb-32">
      <div
        className={`sticky top-0 z-10 -mx-4 px-4 py-3 mb-6 backdrop-blur bg-white/80 border-b flex items-center justify-between ${danger ? 'text-rose-600' : 'text-gray-700'}`}
      >
        <div className="font-semibold">Morning Quiz · 早测</div>
        <div className="font-mono tabular-nums text-2xl">
          {mm}:{ss}
        </div>
      </div>

      <ol className="space-y-8">
        {view.paperQuestions.map((pq, idx) => (
          <li key={pq.id} className="bg-white rounded-lg border p-5 shadow-sm">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-sm font-mono text-gray-400">Q{idx + 1}</span>
              <span className="text-xs text-gray-500">[{pq.marks} mark{pq.marks > 1 ? 's' : ''}]</span>
              {savingId === pq.id && <span className="text-xs text-blue-500 ml-auto">saving…</span>}
            </div>
            <div className="prose prose-sm max-w-none mb-4">
              <RenderContent content={pq.snapshotContent} />
            </div>
            {pq.questionType === 'mcq' && pq.snapshotOptions ? (
              <div className="space-y-2">
                {pq.snapshotOptions.map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex gap-3 items-start p-3 rounded border cursor-pointer transition-colors ${answers[pq.id]?.selectedOption === opt.key ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <input
                      type="radio"
                      name={`q-${pq.id}`}
                      value={opt.key}
                      checked={answers[pq.id]?.selectedOption === opt.key}
                      onChange={() => {
                        setAnswers((prev) => ({ ...prev, [pq.id]: { selectedOption: opt.key } }));
                        saveAnswer(pq.id, { selectedOption: opt.key, textAnswer: null });
                      }}
                      className="mt-1"
                    />
                    <span className="font-mono text-gray-500 text-sm">{opt.key}.</span>
                    <span className="flex-1 text-sm">{opt.text}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[pq.id]?.textAnswer ?? ''}
                onChange={(e) => setAnswers((p) => ({ ...p, [pq.id]: { textAnswer: e.target.value } }))}
                onBlur={(e) => saveAnswer(pq.id, { selectedOption: null, textAnswer: e.target.value })}
                placeholder="Your answer…"
                className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
              />
            )}
          </li>
        ))}
      </ol>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {Object.keys(answers).length} / {view.paperQuestions.length} answered
          </div>
          <button
            disabled={submitted}
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-medium"
          >
            {submitted ? '提交中…' : '交卷 · Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RenderContent({ content }: { content: any }) {
  if (!content) return null;
  if (typeof content === 'string') return <p>{content}</p>;
  // The existing question-bank schema stores { stem, parts? }. For the morning
  // quiz MVP we render only stem; parts (structured) aren't auto-graded in
  // this scope.
  if (content.stem) return <p style={{ whiteSpace: 'pre-wrap' }}>{content.stem}</p>;
  return <pre className="text-xs bg-gray-50 p-2 overflow-x-auto">{JSON.stringify(content, null, 2)}</pre>;
}
