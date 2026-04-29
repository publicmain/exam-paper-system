import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const QUESTION_TYPES = [
  { value: '', label: '— let AI decide —' },
  { value: 'mcq', label: 'MCQ' },
  { value: 'short_answer', label: 'Short answer' },
  { value: 'structured', label: 'Structured (multi-part)' },
  { value: 'essay', label: 'Essay' },
];

export default function AiGeneratePage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [components, setComponents] = useState<any[]>([]);
  const [componentId, setComponentId] = useState('');
  const [topics, setTopics] = useState<any[]>([]);
  const [topicCode, setTopicCode] = useState('');
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState<number | ''>('');
  const [questionType, setQuestionType] = useState('');
  const [multiPart, setMultiPart] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);

  useEffect(() => {
    api.subjects().then(setSubjects);
    api.questionBudget().then(setBudget).catch(() => {});
  }, []);

  useEffect(() => {
    if (subjectId) {
      api.components(subjectId).then(setComponents);
    } else {
      setComponents([]);
    }
    setComponentId('');
    setTopics([]);
    setTopicCode('');
  }, [subjectId]);

  useEffect(() => {
    if (componentId) {
      api.topics(componentId).then(setTopics);
    } else {
      setTopics([]);
    }
    setTopicCode('');
  }, [componentId]);

  const subject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId],
  );

  async function generate() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.generateAiQuestions({
        syllabusCode: subject?.code,
        topicCode,
        count,
        difficulty: difficulty === '' ? undefined : Number(difficulty),
        questionType: questionType || undefined,
        multiPart,
      });
      setResult(r);
      api.questionBudget().then(setBudget).catch(() => {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const canGenerate = subjectId && topicCode && count >= 1 && count <= 10 && !busy;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">AI question generator</h1>
        <p className="text-sm text-gray-600">
          Author original CIE-style questions with Claude. Drafts land in the{' '}
          <Link to="/review" className="text-blue-600 underline">review queue</Link>{' '}
          for teacher approval before reaching the question bank.
        </p>
      </div>

      {budget && (
        <div className="card text-xs text-gray-700 flex items-center justify-between">
          <div>
            Anthropic month-to-date: <strong>${budget.monthToDateUsd.toFixed(4)}</strong>
            {budget.capUsd !== null && (
              <>
                {' · '}Cap: ${budget.capUsd}
                {' · '}Remaining: <strong>${budget.remainingUsd?.toFixed(2)}</strong>
              </>
            )}
            {budget.capUsd === null && (
              <span className="ml-2 text-amber-700">
                (no cap set — set ANTHROPIC_MONTHLY_USD_CAP env var to limit spending)
              </span>
            )}
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Subject (syllabus)">
            <select
              className="select"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">— select —</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.examBoard.code} {s.code} {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Component">
            <select
              className="select"
              value={componentId}
              onChange={(e) => setComponentId(e.target.value)}
              disabled={!subjectId}
            >
              <option value="">— select —</option>
              {components.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Topic">
            <select
              className="select"
              value={topicCode}
              onChange={(e) => setTopicCode(e.target.value)}
              disabled={!componentId}
            >
              <option value="">— select —</option>
              {flattenTopics(topics).map((t: any) => (
                <option key={t.id} value={t.code}>
                  {t.code} {t.name}
                  {t._depth > 0 ? ' ↳' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="Number of questions (1–10)">
            <input
              className="input"
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            />
          </Field>
          <Field label="Difficulty (optional)">
            <select
              className="select"
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value === '' ? '' : Number(e.target.value))
              }
            >
              <option value="">— let AI decide —</option>
              <option value="1">1 — recall</option>
              <option value="2">2 — routine</option>
              <option value="3">3 — standard</option>
              <option value="4">4 — challenging</option>
              <option value="5">5 — extension</option>
            </select>
          </Field>
          <Field label="Question type">
            <select
              className="select"
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label=" ">
            <label className="flex items-center gap-2 text-sm pt-2">
              <input
                type="checkbox"
                checked={multiPart}
                onChange={(e) => setMultiPart(e.target.checked)}
              />
              Prefer multi-part (a)/(b)/(c)
            </label>
          </Field>
        </div>

        <div className="flex justify-end pt-2 border-t gap-2">
          <button className="btn btn-primary" disabled={!canGenerate} onClick={generate}>
            {busy ? 'Generating… (~10–30s)' : `Generate ${count} question${count > 1 ? 's' : ''}`}
          </button>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      {result && (
        <div className="card space-y-2">
          <div className="text-sm font-semibold">
            ✅ Created {result.created} of {result.attempted} —{' '}
            <span className="text-gray-600">${result.costUsd.toFixed(4)} this call</span>
          </div>
          <div className="text-xs text-gray-500">
            Month-to-date: ${result.monthToDateUsd.toFixed(4)}
            {result.capUsd != null && <> · Remaining: ${result.remainingUsd.toFixed(2)}</>}
          </div>
          {result.errors?.length > 0 && (
            <div className="text-xs text-red-600">
              <div className="font-semibold mt-2">{result.errors.length} error(s):</div>
              {result.errors.map((e: string, i: number) => (
                <div key={i} className="font-mono">{e}</div>
              ))}
            </div>
          )}
          {result.items?.length > 0 && (
            <div className="text-sm">
              <div className="font-semibold mt-2 mb-1">Drafts created (open the review queue to edit and approve):</div>
              <ul className="text-xs space-y-1">
                {result.items.map((it: any) => (
                  <li key={it.questionItemId} className="font-mono">
                    Q{it.questionNumber} · {it.marks} marks · diff {it.suggestedDifficulty}
                    {it.partCount > 0 && ` · ${it.partCount} parts`}
                  </li>
                ))}
              </ul>
              <Link
                to={`/review?source=ai_generated`}
                className="btn btn-primary inline-block mt-3"
              >
                Open review queue →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function flattenTopics(tree: any[], depth = 0): any[] {
  const out: any[] = [];
  for (const t of tree) {
    out.push({ ...t, _depth: depth });
    if (t.children?.length) out.push(...flattenTopics(t.children, depth + 1));
  }
  return out;
}
