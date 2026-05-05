import { useEffect, useState } from 'react';
import CodeAnswerInput, { CodeRunResult, SampleCase } from '../components/CodeAnswerInput';

/**
 * Admin / teacher test page for the code grader.
 *
 * Two halves:
 *   1. Test-case manager: paste a Question id, list its existing test
 *      cases, add new ones (stdin / expected stdout / marks / hidden),
 *      delete cases. Hits POST/GET/DELETE /api/codegrader/...
 *   2. Manual run: pick a paperQuestionId + write source code, hit
 *      POST /api/codegrader/submit. NOTE: /submit is student-only on
 *      the API (security: nobody but a student should award marks to
 *      a student submission). This panel is therefore mainly useful
 *      for testing — when logged in as a student the panel will let
 *      you run code; when logged in as a teacher it will 401 and the
 *      page surfaces the error so you know.
 *
 * We deliberately call fetch directly here instead of extending lib/api.ts
 * because (per agent boundaries) lib/api.ts is owned by another agent.
 * The MERGE_INSTRUCTIONS doc lists the methods to add to the shared
 * api object once integration is approved.
 */

const BASE = (import.meta as any).env?.VITE_API_URL || '';

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('auth_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch<T = any>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${method} ${path} ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : ((await res.text()) as any);
}

interface TestCaseRow {
  id: string;
  stdin: string;
  expectedStdout?: string; // present for teachers
  marksPerCase: number;
  hidden: boolean;
  label: string | null;
  sortOrder: number;
}

export default function CodegraderTestPage() {
  const [questionId, setQuestionId] = useState('');
  const [cases, setCases] = useState<TestCaseRow[]>([]);
  const [casesErr, setCasesErr] = useState<string | null>(null);
  const [casesBusy, setCasesBusy] = useState(false);

  // Add-case form state
  const [newStdin, setNewStdin] = useState('');
  const [newExpected, setNewExpected] = useState('');
  const [newMarks, setNewMarks] = useState(1);
  const [newHidden, setNewHidden] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  // Manual run state
  const [paperQuestionId, setPaperQuestionId] = useState('');
  const [language, setLanguage] = useState('python');
  const [sourceCode, setSourceCode] = useState('print("hello world")\n');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<CodeRunResult | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);

  async function loadCases() {
    if (!questionId.trim()) return;
    setCasesErr(null);
    setCasesBusy(true);
    try {
      const rows = await apiFetch<TestCaseRow[]>('GET', `/codegrader/questions/${questionId.trim()}/test-cases`);
      setCases(rows);
    } catch (e: any) {
      setCasesErr(String(e.message ?? e));
      setCases([]);
    } finally {
      setCasesBusy(false);
    }
  }

  useEffect(() => {
    if (questionId.trim().length > 10) {
      loadCases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  async function addCase() {
    if (!questionId.trim()) return;
    setCasesErr(null);
    setCasesBusy(true);
    try {
      await apiFetch('POST', `/codegrader/questions/${questionId.trim()}/test-cases`, {
        stdin: newStdin,
        expectedStdout: newExpected,
        marksPerCase: newMarks,
        hidden: newHidden,
        label: newLabel || null,
      });
      setNewStdin('');
      setNewExpected('');
      setNewMarks(1);
      setNewHidden(false);
      setNewLabel('');
      await loadCases();
    } catch (e: any) {
      setCasesErr(String(e.message ?? e));
    } finally {
      setCasesBusy(false);
    }
  }

  async function deleteCase(id: string) {
    if (!confirm('Delete this test case?')) return;
    setCasesBusy(true);
    try {
      await apiFetch('DELETE', `/codegrader/test-cases/${id}`);
      await loadCases();
    } catch (e: any) {
      setCasesErr(String(e.message ?? e));
    } finally {
      setCasesBusy(false);
    }
  }

  async function runManual() {
    setRunErr(null);
    setRunning(true);
    setRunResult(null);
    try {
      const result = await apiFetch<CodeRunResult>('POST', `/codegrader/submit`, {
        paperQuestionId: paperQuestionId.trim(),
        language,
        sourceCode,
      });
      setRunResult(result);
    } catch (e: any) {
      setRunErr(String(e.message ?? e));
    } finally {
      setRunning(false);
    }
  }

  const sampleCases: SampleCase[] = cases.map((c) => ({
    id: c.id,
    stdin: c.stdin,
    marksPerCase: c.marksPerCase,
    hidden: c.hidden,
    label: c.label,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Code Grader — Admin / Test</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage test cases for a code question and verify a manual run end-to-end.
          Submitting code requires a <code>student</code> token; the test-case routes are
          teacher / head_teacher / admin only.
        </p>
      </div>

      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">1. Test cases for a question</h2>
          <span className="text-xs text-gray-500">(teacher routes)</span>
        </div>
        <input
          className="w-full border rounded px-2 py-1 font-mono text-sm"
          placeholder="Question id (e.g. cmoxxx...)"
          value={questionId}
          onChange={(e) => setQuestionId(e.target.value)}
          onBlur={loadCases}
        />
        {casesErr && <div className="text-sm text-red-700">{casesErr}</div>}

        {cases.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">#</th>
                <th>label</th>
                <th>stdin</th>
                <th>expected stdout</th>
                <th>marks</th>
                <th>hidden</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c, i) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="py-1 font-mono text-gray-500">{i + 1}</td>
                  <td className="py-1">{c.label ?? '—'}</td>
                  <td className="py-1 font-mono whitespace-pre-wrap max-w-[16rem]">{c.stdin || '∅'}</td>
                  <td className="py-1 font-mono whitespace-pre-wrap max-w-[16rem]">
                    {c.expectedStdout ?? <span className="text-gray-400">(redacted for student)</span>}
                  </td>
                  <td className="py-1">{c.marksPerCase}</td>
                  <td className="py-1">{c.hidden ? 'Y' : 'N'}</td>
                  <td className="py-1">
                    <button
                      className="btn btn-ghost text-red-700"
                      disabled={casesBusy}
                      onClick={() => deleteCase(c.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="border-t pt-3 space-y-2">
          <div className="text-sm font-medium">Add a test case</div>
          <div className="grid grid-cols-2 gap-2">
            <textarea
              className="border rounded px-2 py-1 font-mono text-sm min-h-[80px]"
              placeholder="stdin (sent to student's program)"
              value={newStdin}
              onChange={(e) => setNewStdin(e.target.value)}
            />
            <textarea
              className="border rounded px-2 py-1 font-mono text-sm min-h-[80px]"
              placeholder="expected stdout"
              value={newExpected}
              onChange={(e) => setNewExpected(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input
              className="border rounded px-2 py-1 w-20"
              type="number"
              min={0}
              max={100}
              value={newMarks}
              onChange={(e) => setNewMarks(parseInt(e.target.value || '0', 10))}
            />
            <span className="text-gray-500">marks</span>
            <input
              className="border rounded px-2 py-1 flex-1"
              placeholder="label (optional, e.g. 'edge case: empty input')"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <label className="text-xs flex items-center gap-1">
              <input
                type="checkbox"
                checked={newHidden}
                onChange={(e) => setNewHidden(e.target.checked)}
              />
              hidden from students
            </label>
            <button
              className="btn btn-primary"
              disabled={!questionId.trim() || !newExpected || casesBusy}
              onClick={addCase}
            >
              Add case
            </button>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">2. Manual run</h2>
          <span className="text-xs text-gray-500">(student route — login as student to test)</span>
        </div>
        <input
          className="w-full border rounded px-2 py-1 font-mono text-sm"
          placeholder="paperQuestionId"
          value={paperQuestionId}
          onChange={(e) => setPaperQuestionId(e.target.value)}
        />
        <CodeAnswerInput
          language={language}
          onLanguageChange={setLanguage}
          sourceCode={sourceCode}
          onSourceChange={setSourceCode}
          onRun={runManual}
          busy={running}
          sampleCases={sampleCases}
          lastResult={runResult}
        />
        {runErr && <div className="text-sm text-red-700">{runErr}</div>}
        {runResult && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-600">Raw result JSON</summary>
            <pre className="mt-1 p-2 bg-gray-50 rounded overflow-auto">
              {JSON.stringify(runResult, null, 2)}
            </pre>
          </details>
        )}
      </section>
    </div>
  );
}
