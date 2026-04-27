import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const TEMPLATE_PRESETS = [
  { id: 'morning', name: 'Morning Quick Test (15 min · MCQ only)', durationMin: 15, totalMarks: 15,
    questionMix: [{ type: 'mcq', count: 15, marksEach: 1 }] },
  { id: 'inclass', name: 'In-class Quiz (30 min · MCQ + short)', durationMin: 30, totalMarks: 25,
    questionMix: [{ type: 'mcq', count: 10, marksEach: 1 }, { type: 'short_answer', targetMarks: 15 }] },
  { id: 'weekly', name: 'Weekly Test (60 min · structured)', durationMin: 60, totalMarks: 50,
    questionMix: [{ type: 'mcq', count: 10, marksEach: 1 }, { type: 'structured', targetMarks: 40 }] },
  { id: 'monthly', name: 'Monthly Exam (90 min · full)', durationMin: 90, totalMarks: 75,
    questionMix: [{ type: 'mcq', count: 15, marksEach: 1 }, { type: 'structured', targetMarks: 60 }] },
  { id: 'mock', name: 'Mock Exam (120 min · 100 marks)', durationMin: 120, totalMarks: 100,
    questionMix: [{ type: 'mcq', count: 20, marksEach: 1 }, { type: 'structured', targetMarks: 80 }] },
];

export default function PaperWizardPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [topicTree, setTopicTree] = useState<any[]>([]);

  const [form, setForm] = useState<any>({
    name: '',
    classLabel: '',
    examDate: '',
    subjectId: '',
    componentId: '',
    durationMin: 60,
    totalMarks: 50,
    topicFilter: [] as string[],
    questionMix: [
      { type: 'mcq', count: 10, marksEach: 1 },
      { type: 'structured', targetMarks: 40 },
    ],
    difficultyDist: { easy: 0.4, medium: 0.4, hard: 0.2 },
    excludeRecentDays: 60,
  });

  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => { api.subjects().then(setSubjects); }, []);
  useEffect(() => {
    if (form.subjectId) api.components(form.subjectId).then(setComponents);
  }, [form.subjectId]);
  useEffect(() => {
    if (form.componentId) api.topics(form.componentId).then(setTopicTree);
    else setTopicTree([]);
  }, [form.componentId]);

  function applyPreset(p: typeof TEMPLATE_PRESETS[number]) {
    setForm({ ...form, durationMin: p.durationMin, totalMarks: p.totalMarks, questionMix: structuredClone(p.questionMix) });
  }

  // Live conflict detection
  const conflicts = useMemo(() => {
    const list: string[] = [];
    if (!form.subjectId) list.push('Subject is required.');
    if (form.totalMarks <= 0) list.push('Total marks must be positive.');
    if (form.durationMin <= 0) list.push('Duration must be positive.');
    if (form.questionMix.length === 0) list.push('At least one question type is required.');

    let mixMarks = 0;
    for (const m of form.questionMix) {
      if (m.count != null && m.marksEach != null) mixMarks += m.count * m.marksEach;
      else if (m.targetMarks != null) mixMarks += m.targetMarks;
    }
    if (mixMarks > 0 && Math.abs(mixMarks - form.totalMarks) / form.totalMarks > 0.2) {
      list.push(`Mix targets ${mixMarks} marks but total is ${form.totalMarks} (>20% diff).`);
    }
    const ratio = form.durationMin / form.totalMarks;
    if (ratio < 0.5) list.push(`Duration may be too short for ${form.totalMarks} marks.`);
    return list;
  }, [form]);

  async function generate() {
    setBusy(true); setWarnings([]);
    try {
      const res = await api.generatePaper({
        name: form.name || `Paper ${new Date().toISOString().slice(0,10)}`,
        classLabel: form.classLabel || undefined,
        examDate: form.examDate || undefined,
        config: {
          subjectId: form.subjectId,
          componentId: form.componentId || undefined,
          durationMin: form.durationMin,
          totalMarks: form.totalMarks,
          topicFilter: form.topicFilter,
          questionMix: form.questionMix,
          difficultyDist: form.difficultyDist,
          excludeRecentDays: form.excludeRecentDays,
        },
      });
      if (res.warnings?.length) {
        setWarnings(res.warnings);
        setTimeout(() => nav(`/papers/${res.paper.id}`), 1500);
      } else {
        nav(`/papers/${res.paper.id}`);
      }
    } catch (e: any) {
      alert('Generation failed: ' + e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Create New Paper</h1>

      <Stepper step={step} />

      {step === 1 && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Step 1 — Choose a preset (or skip to customise)</h2>
          <div className="grid gap-2">
            {TEMPLATE_PRESETS.map(p => (
              <button key={p.id} className="btn justify-start text-left" onClick={() => { applyPreset(p); setStep(2); }}>
                {p.name}
              </button>
            ))}
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Skip — customise from scratch</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Step 2 — Subject &amp; chapters</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Subject">
              <select className="select" value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value, componentId: '', topicFilter: [] })}>
                <option value="">— select —</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.examBoard.code} {s.code} {s.name} ({s.level})</option>)}
              </select>
            </Field>
            <Field label="Component / Paper">
              <select className="select" value={form.componentId} onChange={e => setForm({ ...form, componentId: e.target.value, topicFilter: [] })} disabled={!form.subjectId}>
                <option value="">— any —</option>
                {components.map((c: any) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Topics / Chapters (multi-select; leave empty to draw from any)">
            <TopicTreeMultiSelect tree={topicTree} value={form.topicFilter} onChange={v => setForm({ ...form, topicFilter: v })} />
          </Field>
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" disabled={!form.subjectId} onClick={() => setStep(3)}>Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Step 3 — Duration, marks &amp; question mix</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Paper name">
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Y12 Math Weekly Test #5" />
            </Field>
            <Field label="Class label (optional)">
              <input className="input" value={form.classLabel} onChange={e => setForm({ ...form, classLabel: e.target.value })} placeholder="e.g. 12A" />
            </Field>
            <Field label="Duration (minutes)">
              <input className="input" type="number" min={5} value={form.durationMin} onChange={e => setForm({ ...form, durationMin: Number(e.target.value) })} />
            </Field>
            <Field label="Total marks">
              <input className="input" type="number" min={1} value={form.totalMarks} onChange={e => setForm({ ...form, totalMarks: Number(e.target.value) })} />
            </Field>
            <Field label="Exam date (optional)">
              <input className="input" type="date" value={form.examDate} onChange={e => setForm({ ...form, examDate: e.target.value })} />
            </Field>
            <Field label="Exclude questions used in last (days)">
              <input className="input" type="number" min={0} value={form.excludeRecentDays} onChange={e => setForm({ ...form, excludeRecentDays: Number(e.target.value) })} />
            </Field>
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Question mix</div>
            <div className="space-y-2">
              {form.questionMix.map((m: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <select className="select" value={m.type} onChange={e => updateMix(i, { ...m, type: e.target.value })}>
                      <option value="mcq">MCQ</option>
                      <option value="short_answer">Short answer</option>
                      <option value="structured">Structured</option>
                      <option value="essay">Essay</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-gray-500">Count (optional)</label>
                    <input className="input" type="number" value={m.count ?? ''} onChange={e => updateMix(i, { ...m, count: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">Marks each</label>
                    <input className="input" type="number" value={m.marksEach ?? ''} onChange={e => updateMix(i, { ...m, marksEach: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-gray-500">Target total marks (alt.)</label>
                    <input className="input" type="number" value={m.targetMarks ?? ''} onChange={e => updateMix(i, { ...m, targetMarks: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  </div>
                  <button className="col-span-1 btn btn-danger" onClick={() => removeMix(i)}>×</button>
                </div>
              ))}
              <button className="btn" onClick={() => setForm({ ...form, questionMix: [...form.questionMix, { type: 'short_answer', targetMarks: 10 }] })}>+ Add slot</button>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Difficulty distribution</div>
            <div className="grid grid-cols-3 gap-2">
              {(['easy','medium','hard'] as const).map(k => (
                <Field key={k} label={`${k} (${(form.difficultyDist[k] * 100).toFixed(0)}%)`}>
                  <input className="input" type="number" min={0} max={1} step={0.1} value={form.difficultyDist[k]}
                    onChange={e => setForm({ ...form, difficultyDist: { ...form.difficultyDist, [k]: Number(e.target.value) } })} />
                </Field>
              ))}
            </div>
          </div>

          {conflicts.length > 0 && (
            <div className="card" style={{ background: '#fef3c7', borderColor: '#fde68a' }}>
              <div className="font-semibold text-amber-700 mb-1">⚠ Validation warnings</div>
              <ul className="text-sm list-disc pl-5">
                {conflicts.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="card" style={{ background: '#dbeafe' }}>
              <div className="font-semibold text-blue-700 mb-1">Generation warnings</div>
              <ul className="text-sm list-disc pl-5">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
              <div className="text-xs mt-2">Redirecting to editor…</div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" disabled={busy || conflicts.length > 0} onClick={generate}>
              {busy ? 'Generating…' : 'Generate Paper'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function updateMix(i: number, m: any) {
    const next = [...form.questionMix]; next[i] = m; setForm({ ...form, questionMix: next });
  }
  function removeMix(i: number) {
    setForm({ ...form, questionMix: form.questionMix.filter((_: any, j: number) => j !== i) });
  }
}

function Stepper({ step }: { step: number }) {
  const labels = ['Preset', 'Subject & chapters', 'Compose'];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => (
        <div key={i} className={`flex-1 px-3 py-2 rounded ${step === i + 1 ? 'bg-blue-100 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
          {i + 1}. {l}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-gray-600 mb-1">{label}</label>{children}</div>;
}

function TopicTreeMultiSelect({ tree, value, onChange }: { tree: any[]; value: string[]; onChange: (v: string[]) => void }) {
  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter(v => v !== id));
    else onChange([...value, id]);
  }
  function render(nodes: any[], depth = 0) {
    return nodes.map(n => (
      <div key={n.id} style={{ marginLeft: depth * 16 }}>
        <label className="flex items-center gap-2 py-0.5 text-sm">
          <input type="checkbox" checked={value.includes(n.id)} onChange={() => toggle(n.id)} />
          <span className="font-mono text-xs text-gray-500">{n.code}</span>
          {n.name}
        </label>
        {n.children?.length > 0 && render(n.children, depth + 1)}
      </div>
    ));
  }
  if (tree.length === 0) return <div className="text-sm text-gray-500">Select a component first.</div>;
  return <div className="card max-h-64 overflow-auto py-2">{render(tree)}</div>;
}
