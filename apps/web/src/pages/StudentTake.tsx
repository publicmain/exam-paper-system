import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { MathHtml } from '../components/MathHtml';
import { AuthImage } from '../components/AuthImage';

/**
 * Take-paper page. Opens (or resumes) a StudentSubmission for the given
 * assignment, then renders each PaperQuestion with an answer input.
 * MCQ: radio. Structured: textarea. Autosave on blur.
 */
export default function StudentTakePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const nav = useNavigate();
  const [submission, setSubmission] = useState<any | null>(null);
  const [paper, setPaper] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, { selectedOption?: string; textAnswer?: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!assignmentId) return;
    try {
      const sub = await api.openStudentSubmission(assignmentId);
      setSubmission(sub);
      const subFull = await api.getStudentSubmission(sub.id);
      const p = subFull.assignment?.paper;
      // Re-fetch paper detail for full questions; the submission detail has
      // PaperQuestions inside scripts but they may be sparse. Use the
      // dedicated paper endpoint via the same auth.
      if (p?.id) {
        const fullPaper = await api.getPaper(p.id);
        setPaper(fullPaper);
      }
      const ans: Record<string, any> = {};
      for (const s of subFull.scripts ?? []) {
        ans[s.paperQuestionId] = { selectedOption: s.selectedOption ?? undefined, textAnswer: s.textAnswer ?? undefined };
      }
      setAnswers(ans);
    } catch (e: any) {
      setErr(String(e));
    }
  }, [assignmentId]);

  useEffect(() => { load(); }, [load]);

  if (err) return <div className="card text-red-700">{err}</div>;
  if (!submission || !paper) return <div className="text-gray-500">Loading…</div>;

  const locked = submission.status !== 'in_progress';

  async function saveAnswer(paperQuestionId: string, patch: { selectedOption?: string; textAnswer?: string }) {
    if (locked) return;
    setBusy(paperQuestionId);
    try {
      await api.saveStudentScript(submission.id, { paperQuestionId, ...patch });
      setAnswers((prev) => ({ ...prev, [paperQuestionId]: { ...prev[paperQuestionId], ...patch } }));
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function finalSubmit() {
    if (!confirm('Submit this paper? You will not be able to edit your answers after submitting.')) return;
    setBusy('submit');
    try {
      const updated = await api.finalSubmitStudent(submission.id);
      setSubmission(updated);
      alert(`Submitted. Auto-graded score: ${updated.autoScore ?? 0} / ${updated.maxScore} (structured items pending marker review).`);
      nav('/student');
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{paper.name}</h1>
          {locked ? (
            <span className="badge bg-gray-100">Status: {submission.status}</span>
          ) : (
            <button className="btn btn-primary" disabled={busy === 'submit'} onClick={finalSubmit}>
              {busy === 'submit' ? 'Submitting…' : 'Submit final answers'}
            </button>
          )}
        </div>
        <div className="text-xs text-gray-600 mt-1">
          {paper.totalMarksActual} marks · {paper.durationMin} min
          {locked && submission.autoScore != null && (
            <span className="ml-2">· Auto-graded: {submission.autoScore} / {submission.maxScore}</span>
          )}
        </div>
      </div>

      {paper.questions.map((pq: any, i: number) => {
        const content = pq.snapshotContent ?? {};
        const opts = pq.snapshotOptions ?? pq.question?.options;
        const ans = answers[pq.id] ?? {};
        const isMcq = pq.question?.questionType === 'mcq';
        return (
          <div key={pq.id} className="card">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold">Q{i + 1}.</span>
              <span className="badge">{pq.question?.questionType}</span>
              <span className="badge">[{pq.marks}]</span>
            </div>
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

            {isMcq && Array.isArray(opts) ? (
              <div className="mt-3 space-y-1.5">
                {opts.map((o: any) => (
                  <label key={o.key} className={`flex items-start gap-2 cursor-pointer p-2 rounded ${ans.selectedOption === o.key ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      className="mt-1"
                      name={`q-${pq.id}`}
                      value={o.key}
                      checked={ans.selectedOption === o.key}
                      disabled={locked}
                      onChange={() => saveAnswer(pq.id, { selectedOption: o.key })}
                    />
                    <span className="font-mono text-xs mt-1">{o.key}.</span>
                    <span className="flex-1 text-sm"><MathHtml source={o.text} /></span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                {content.parts?.length > 0 && (
                  <div className="ml-2 mb-2 text-sm space-y-1">
                    {content.parts.map((p: any) => (
                      <div key={p.label}>
                        <span className="font-semibold">({p.label})</span> <MathHtml source={p.content} />
                        <span className="text-xs text-gray-500 ml-2">[{p.marks}]</span>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  className="w-full min-h-[120px] border rounded p-2 text-sm font-sans"
                  placeholder="Show your working..."
                  value={ans.textAnswer ?? ''}
                  disabled={locked}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [pq.id]: { ...prev[pq.id], textAnswer: e.target.value } }))}
                  onBlur={(e) => saveAnswer(pq.id, { textAnswer: e.target.value })}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
