import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * AI tutor chat for students. Reads ?submissionId=... from the URL,
 * fetches the submission so we know which paperQuestions the student
 * got wrong, then lets the student pick one and start a chat session
 * about it.
 *
 * NOTE on api access: lib/api.ts is owned by another agent and we
 * cannot edit it from this fragment. To stay self-contained the page
 * uses a small `request()` helper that mirrors the lib's auth-token
 * convention. After the integrator wires the api methods documented in
 * MERGE_INSTRUCTIONS.md, the helper can be replaced with the api shim.
 *
 * markScheme guarantee on the client: this page never reads or displays
 * a markScheme/answerContent/correct field. The server-side getStudentSubmission
 * already strips them, and the tutor backend never sends them in the
 * chat reply. So nothing the student sees can leak the answer key.
 */

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

function authToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken() ? { Authorization: `Bearer ${authToken()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    // Attach status so callers can branch on 429 vs 4xx.
    const err: any = new Error(text || `${method} ${path} failed: ${res.status}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

interface ChatMsg {
  id?: string;
  role: 'student' | 'assistant';
  content: string;
  pending?: boolean;
}

export default function StudentTutorPage() {
  const [params] = useSearchParams();
  const submissionId = params.get('submissionId') ?? '';

  const [submission, setSubmission] = useState<any | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [activePqId, setActivePqId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [chatErr, setChatErr] = useState<string | null>(null);
  const [dailyCap, setDailyCap] = useState<{ spentUsd: number; capUsd: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ---- Initial load: the student's submission so we can list wrong items.
  useEffect(() => {
    if (!submissionId) {
      setLoadErr('Missing submissionId in URL.');
      return;
    }
    request('GET', `/student/submissions/${encodeURIComponent(submissionId)}`)
      .then(setSubmission)
      .catch((e) => setLoadErr(String(e?.message ?? e)));
  }, [submissionId]);

  // ---- Auto-scroll the chat to the bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Compute the wrong / unmarked items. We can only confidently flag MCQ as
  // wrong (autoCorrect===false). Structured items that haven't been marked
  // yet show up as "review" candidates so the student can still chat about
  // anything they're unsure of.
  const wrongItems = useMemo(() => {
    if (!submission) return [];
    const pqs = submission.assignment?.paper?.questions ?? [];
    const scriptByPq = new Map<string, any>();
    for (const s of submission.scripts ?? []) {
      scriptByPq.set(s.paperQuestionId, s);
    }
    return pqs.map((pq: any) => {
      const sc = scriptByPq.get(pq.id);
      const isMcq = pq.question?.questionType === 'mcq';
      let status: 'wrong' | 'partial' | 'review' = 'review';
      if (isMcq && sc?.autoCorrect === false) status = 'wrong';
      else if (
        !isMcq &&
        typeof sc?.awardedMarks === 'number' &&
        sc.awardedMarks < pq.marks * 0.5
      ) {
        status = 'partial';
      }
      return { pq, script: sc, status };
    }).filter((row: any) => row.status !== 'review' || submission.status === 'submitted' || submission.status === 'in_progress');
  }, [submission]);

  async function startSession(pqId: string) {
    setBusy('start');
    setChatErr(null);
    try {
      const session = await request<any>('POST', '/ai-tutor/sessions', {
        submissionId,
        paperQuestionId: pqId,
      });
      setActivePqId(pqId);
      setSessionId(session.id);
      setMessages([]);
      setDailyCap(null);
    } catch (e: any) {
      setChatErr(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  async function sendMessage() {
    if (!sessionId) return;
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const optimistic: ChatMsg[] = [
      ...messages,
      { role: 'student', content: text },
      { role: 'assistant', content: 'Thinking…', pending: true },
    ];
    setMessages(optimistic);
    setBusy('msg');
    setChatErr(null);
    try {
      const out = await request<any>(
        'POST',
        `/ai-tutor/sessions/${encodeURIComponent(sessionId)}/messages`,
        { content: text },
      );
      setMessages((prev) => {
        const next = prev.filter((m) => !m.pending);
        next.push({ role: 'assistant', content: out.assistantMessage?.content ?? '' });
        return next;
      });
      if (out.dailyCap) setDailyCap(out.dailyCap);
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => !m.pending));
      if (e?.status === 429) {
        setChatErr('Daily AI tutor budget reached. Try again tomorrow or ask your teacher.');
      } else {
        setChatErr(String(e?.message ?? e));
      }
    } finally {
      setBusy(null);
    }
  }

  if (loadErr) return <div className="card text-red-700">{loadErr}</div>;
  if (!submissionId) return <div className="card text-red-700">Missing submissionId.</div>;
  if (!submission) return <div className="text-gray-500">Loading…</div>;

  const paper = submission.assignment?.paper;

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-bold">AI Tutor</h1>
        <div className="text-xs text-gray-600 mt-1">
          Paper: {paper?.name ?? '—'}
          {dailyCap && (
            <span className="ml-3">
              · Daily usage: ${dailyCap.spentUsd.toFixed(3)} / ${dailyCap.capUsd.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ---- Left: list of items the student got wrong ---- */}
        <div className="card md:col-span-1">
          <div className="font-semibold mb-2">Questions to review</div>
          {wrongItems.length === 0 ? (
            <div className="text-sm text-gray-500">
              Nothing flagged as wrong yet. Once the marker grades structured questions,
              they'll show up here.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {wrongItems.map((row: any, i: number) => (
                <li key={row.pq.id}>
                  <button
                    className={`w-full text-left p-2 rounded text-sm border ${activePqId === row.pq.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    disabled={busy === 'start'}
                    onClick={() => startSession(row.pq.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">Q{i + 1}</span>
                      <span className="badge">{row.pq.question?.questionType ?? 'q'}</span>
                      <span
                        className={`badge ${row.status === 'wrong' ? 'bg-red-100 text-red-800' : row.status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100'}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {(row.pq.snapshotContent?.stem ?? '').slice(0, 120)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- Right: chat pane ---- */}
        <div className="card md:col-span-2 flex flex-col" style={{ minHeight: 480 }}>
          {!sessionId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
              Pick a question on the left to start a tutor session.
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ maxHeight: 480 }}>
                {messages.length === 0 && (
                  <div className="text-sm text-gray-500">
                    Ask the tutor anything about this question — what concept it tests,
                    why your answer wasn't quite right, or for a hint on a similar problem.
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded text-sm whitespace-pre-wrap ${m.role === 'student' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'} ${m.pending ? 'opacity-60 italic' : ''}`}
                  >
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                      {m.role === 'student' ? 'You' : 'Tutor'}
                    </div>
                    {m.content}
                  </div>
                ))}
              </div>
              {chatErr && (
                <div className="text-xs text-red-700 mt-2">{chatErr}</div>
              )}
              <div className="mt-3 flex gap-2 border-t pt-3">
                <input
                  type="text"
                  className="flex-1 border rounded px-3 py-2 text-sm"
                  placeholder="Ask a question…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={busy === 'msg'}
                  maxLength={4000}
                />
                <button
                  className="btn btn-primary"
                  onClick={sendMessage}
                  disabled={busy === 'msg' || !draft.trim()}
                >
                  {busy === 'msg' ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
