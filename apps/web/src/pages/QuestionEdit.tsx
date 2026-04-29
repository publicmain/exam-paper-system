import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { MathHtml } from '../components/MathHtml';

const TYPES = ['mcq', 'short_answer', 'structured', 'essay'];

const DIAGRAM_TYPES: { value: string; label: string; hint: string }[] = [
  { value: 'apparatus', label: 'Apparatus', hint: 'Lab equipment / experimental setup' },
  { value: 'circuit', label: 'Circuit', hint: 'CIE rectangle-resistor electric circuit' },
  { value: 'waveform', label: 'Waveform', hint: 'Wave on time/displacement axes' },
  { value: 'graph', label: 'Graph', hint: 'Cartesian xy graph with axes + curve' },
  { value: 'free_body', label: 'Free body', hint: 'Body with force arrows' },
  { value: 'molecular', label: 'Molecular', hint: 'Atomic / dot-and-cross structure' },
  { value: 'ray', label: 'Ray diagram', hint: 'Geometric optics: rays, lenses, mirrors' },
  { value: 'mechanics', label: 'Mechanics', hint: 'Inclined plane / pulley / spring setup' },
  { value: 'geometry', label: 'Geometry', hint: 'Pure geometric figure with vertex labels' },
  { value: 'statistical', label: 'Statistics', hint: 'Histogram / box plot / scatter / cum freq' },
  { value: 'energy_level', label: 'Energy levels', hint: 'Atomic energy levels + transitions' },
  { value: 'organic_skeletal', label: 'Organic skeletal', hint: 'Skeletal formula with implicit C/H' },
];

const SIZE_OPTIONS = ['1024x1024', '1024x1536', '1536x1024'] as const;
const QUALITY_OPTIONS = ['low', 'medium', 'high'] as const;
const QUALITY_PRICE: Record<string, Record<string, number>> = {
  '1024x1024': { low: 0.006, medium: 0.053, high: 0.211 },
  '1024x1536': { low: 0.005, medium: 0.041, high: 0.165 },
  '1536x1024': { low: 0.005, medium: 0.041, high: 0.165 },
};

export default function QuestionEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);

  const [form, setForm] = useState<any>({
    subjectId: '',
    componentId: '',
    primaryTopicId: '',
    questionType: 'short_answer',
    marks: 3,
    difficulty: 3,
    sourceType: 'original_school',
    content: { stem: '' },
    answerContent: { text: '' },
    options: undefined,
    markScheme: undefined,
    status: 'draft',
  });

  const [aiSugg, setAiSugg] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [diagramOpen, setDiagramOpen] = useState(false);

  useEffect(() => { api.subjects().then(setSubjects); }, []);
  useEffect(() => {
    if (form.subjectId) api.components(form.subjectId).then(setComponents);
    else setComponents([]);
  }, [form.subjectId]);
  useEffect(() => {
    if (form.componentId) api.topics(form.componentId).then(setTopics);
    else setTopics([]);
  }, [form.componentId]);

  useEffect(() => {
    if (id) {
      api.getQuestion(id).then(q => {
        setForm({
          subjectId: q.subjectId,
          componentId: q.componentId || '',
          primaryTopicId: q.primaryTopicId || '',
          questionType: q.questionType,
          marks: q.marks,
          difficulty: q.difficulty,
          sourceType: q.sourceType,
          sourceRef: q.sourceRef || '',
          content: q.content,
          answerContent: q.answerContent,
          options: q.options,
          markScheme: q.markScheme,
          status: q.status,
        });
        setAssets(q.assets || []);
      });
    }
  }, [id]);

  async function refreshAssets() {
    if (!id) return;
    const q = await api.getQuestion(id);
    setAssets(q.assets || []);
  }

  function ensureMcqOptions() {
    if (form.questionType === 'mcq' && !form.options) {
      setForm({ ...form, options: [
        { key: 'A', text: '', correct: false },
        { key: 'B', text: '', correct: false },
        { key: 'C', text: '', correct: false },
        { key: 'D', text: '', correct: false },
      ]});
    }
  }
  useEffect(ensureMcqOptions, [form.questionType]);

  async function suggestAi() {
    setAiBusy(true);
    try {
      const r = await api.suggestLabels({
        subjectId: form.subjectId,
        componentId: form.componentId || undefined,
        questionStem: form.content.stem,
        marks: form.marks,
      });
      setAiSugg(r);
    } finally { setAiBusy(false); }
  }
  function applyAi(s: any) {
    if (s.suggestedDifficulty) setForm((f: any) => ({ ...f, difficulty: s.suggestedDifficulty }));
    if (s.topicCandidates?.[0]?.topicId) setForm((f: any) => ({ ...f, primaryTopicId: s.topicCandidates[0].topicId }));
  }

  async function save(publish = false) {
    setSaving(true);
    try {
      const data = { ...form, status: publish ? 'active' : (form.status === 'active' ? 'active' : 'draft') };
      if (isNew) {
        const created = await api.createQuestion(data);
        nav(`/questions/${created.id}`);
      } else {
        await api.updateQuestion(id!, data);
        nav('/questions');
      }
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{isNew ? 'New Question' : 'Edit Question'}</h1>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Subject">
          <select className="select" value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value, componentId: '', primaryTopicId: '' })}>
            <option value="">— select —</option>
            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.examBoard.code} {s.code} {s.name}</option>)}
          </select>
        </Field>
        <Field label="Component">
          <select className="select" value={form.componentId} onChange={e => setForm({ ...form, componentId: e.target.value, primaryTopicId: '' })} disabled={!form.subjectId}>
            <option value="">— none —</option>
            {components.map((c: any) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Primary Topic">
          <select className="select" value={form.primaryTopicId} onChange={e => setForm({ ...form, primaryTopicId: e.target.value })} disabled={!form.componentId}>
            <option value="">— none —</option>
            {flattenTopics(topics).map((t: any) => <option key={t.id} value={t.id}>{t.code} {t.name}{t._depth > 0 ? ' ↳' : ''}</option>)}
          </select>
        </Field>

        <Field label="Question Type">
          <select className="select" value={form.questionType} onChange={e => setForm({ ...form, questionType: e.target.value })}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Marks">
          <input className="input" type="number" min={1} value={form.marks} onChange={e => setForm({ ...form, marks: Number(e.target.value) })} />
        </Field>
        <Field label="Difficulty (1-5)">
          <input className="input" type="number" min={1} max={5} value={form.difficulty} onChange={e => setForm({ ...form, difficulty: Number(e.target.value) })} />
        </Field>

        <Field label="Source Type">
          <select className="select" value={form.sourceType} onChange={e => setForm({ ...form, sourceType: e.target.value })}>
            <option value="original_school">Original (school-authored)</option>
            <option value="ai_generated">AI generated</option>
            <option value="past_paper_reference">Past paper reference (metadata only)</option>
            <option value="textbook">Textbook</option>
          </select>
        </Field>
        <Field label="Source Reference (e.g. 9702/22/M/J/19/Q3)">
          <input className="input" value={form.sourceRef || ''} onChange={e => setForm({ ...form, sourceRef: e.target.value })} />
        </Field>
        <Field label="Status">
          <select className="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Field label="Question Stem (LaTeX in $...$, $$..$$ for display)">
            <textarea
              className="textarea h-40 font-mono text-sm"
              value={form.content.stem}
              onChange={e => setForm({ ...form, content: { ...form.content, stem: e.target.value } })}
              placeholder={'e.g. Solve $x^2 - 4x + 4 = 0$.'}
            />
          </Field>
          <div className="flex gap-2 mt-2 flex-wrap">
            <button className="btn" disabled={aiBusy || !form.content.stem || !form.subjectId} onClick={suggestAi}>
              {aiBusy ? 'AI thinking…' : '🤖 Suggest topic & difficulty'}
            </button>
            <button
              className="btn"
              disabled={!id}
              title={id ? 'Generate a diagram with gpt-image-2' : 'Save the question first to attach diagrams'}
              onClick={() => setDiagramOpen(true)}
            >
              🎨 AI diagram
            </button>
          </div>
          {aiSugg && (
            <div className="card mt-3 text-sm space-y-2">
              <div className="text-xs uppercase text-gray-500">AI Suggestion</div>
              <div>Difficulty: <strong>{aiSugg.suggestedDifficulty}</strong></div>
              <div>Type: <strong>{aiSugg.suggestedQuestionType}</strong></div>
              {(aiSugg.topicCandidates || []).map((c: any) => (
                <div key={c.topicCode} className="text-xs">
                  <strong>{c.topicCode}</strong> {c.topicName}
                  <span className="ml-1 text-gray-500">({(c.confidence * 100).toFixed(0)}%) — {c.reason}</span>
                </div>
              ))}
              {aiSugg.notes && <div className="text-xs text-gray-500 italic">{aiSugg.notes}</div>}
              <button className="btn btn-primary text-xs" onClick={() => applyAi(aiSugg)}>Apply suggestion</button>
            </div>
          )}
        </div>
        <div>
          <Field label="Preview">
            <div className="card prose max-w-none min-h-[10rem] q-stem">
              <MathHtml source={form.content.stem} />
            </div>
          </Field>
        </div>
      </div>

      {form.questionType === 'mcq' && form.options && (
        <div>
          <h3 className="font-semibold mb-2">Options</h3>
          <div className="card space-y-2">
            {form.options.map((o: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="badge">{o.key}</span>
                <input className="input flex-1" value={o.text} onChange={e => {
                  const opts = [...form.options]; opts[i] = { ...o, text: e.target.value }; setForm({ ...form, options: opts });
                }} placeholder="Option text (LaTeX OK)" />
                <label className="flex items-center gap-1 text-xs">
                  <input type="radio" name="correctOption" checked={o.correct} onChange={() => {
                    const opts = form.options.map((x: any, j: number) => ({ ...x, correct: j === i }));
                    setForm({ ...form, options: opts });
                  }} />
                  correct
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      <Field label="Answer / Explanation">
        <textarea className="textarea h-24 font-mono text-sm"
          value={form.answerContent?.text || ''}
          onChange={e => setForm({ ...form, answerContent: { ...form.answerContent, text: e.target.value } })} />
      </Field>

      {assets.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Attached diagrams</h3>
          <div className="grid grid-cols-2 gap-3">
            {assets.map((a) => (
              <AssetCard key={a.id} asset={a} />
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t">
        <button className="btn" disabled={saving} onClick={() => save(false)}>Save Draft</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => save(true)}>Save & Publish (Active)</button>
        <button className="btn btn-ghost" onClick={() => nav('/questions')}>Cancel</button>
      </div>

      {diagramOpen && id && (
        <DiagramModal
          questionId={id}
          subjectCode={subjects.find((s: any) => s.id === form.subjectId)?.code}
          topicCode={topics.find((t: any) => t.id === form.primaryTopicId)?.code}
          onClose={() => setDiagramOpen(false)}
          onSaved={async () => {
            await refreshAssets();
          }}
        />
      )}
    </div>
  );
}

function AssetCard({ asset }: { asset: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card text-xs">
      <AuthAssetImage src={api.questionAssetUrl(asset.storageUrl)} alt={asset.altText || ''} />
      <div className="mt-2 flex flex-wrap gap-2 items-center">
        {asset.aiGenerated && <span className="badge bg-purple-100 text-purple-700">AI</span>}
        {asset.aiModel && <span className="text-gray-500">{asset.aiModel}</span>}
        {typeof asset.aiCostUsd === 'number' && (
          <span className="text-gray-500">${asset.aiCostUsd.toFixed(3)}</span>
        )}
        {asset.aiPrompt && (
          <button className="text-blue-600 underline" onClick={() => setOpen(o => !o)}>
            {open ? 'Hide prompt' : 'Show prompt'}
          </button>
        )}
      </div>
      {open && asset.aiPrompt && (
        <pre className="text-[10px] mt-2 bg-gray-50 p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap">
          {asset.aiPrompt}
        </pre>
      )}
    </div>
  );
}

function AuthAssetImage({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    const t = localStorage.getItem('auth_token');
    fetch(src, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(r => r.blob())
      .then(b => { if (cancelled) return; blobUrl = URL.createObjectURL(b); setUrl(blobUrl); })
      .catch(() => {});
    return () => { cancelled = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [src]);
  if (!url) return <div className="text-xs text-gray-400">loading…</div>;
  return <img src={url} alt={alt} className="border rounded w-full" />;
}

function DiagramModal({
  questionId,
  subjectCode,
  topicCode,
  onClose,
  onSaved,
}: {
  questionId: string;
  subjectCode?: string;
  topicCode?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [diagramType, setDiagramType] = useState<string>('apparatus');
  const [scene, setScene] = useState('');
  const [labels, setLabels] = useState('');
  const [size, setSize] = useState<typeof SIZE_OPTIONS[number]>('1536x1024');
  const [quality, setQuality] = useState<typeof QUALITY_OPTIONS[number]>('medium');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState<any>(null);

  useEffect(() => {
    api.imageBudget().then(setBudget).catch(() => {});
  }, []);

  const estCost = QUALITY_PRICE[size]?.[quality] ?? 0;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const labelArr = labels.split('\n').map(l => l.trim()).filter(Boolean);
      const r = await api.generateDiagram({
        questionId,
        diagramType,
        syllabus: subjectCode,
        topicCode,
        scene,
        labels: labelArr,
        size,
        quality,
      });
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-lg">🎨 AI Diagram (gpt-image-2)</h2>
          <button className="btn btn-ghost text-sm" onClick={onClose}>Close</button>
        </div>

        {budget && (
          <div className="text-xs text-gray-600 mb-3">
            Month-to-date: <strong>${budget.monthToDateUsd.toFixed(3)}</strong>
            {budget.capUsd !== null && (
              <> · Cap: ${budget.capUsd} · Remaining: <strong>${budget.remainingUsd?.toFixed(2)}</strong></>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Diagram type</label>
            <div className="grid grid-cols-3 gap-2">
              {DIAGRAM_TYPES.map((t) => (
                <button
                  key={t.value}
                  className={`card text-left text-xs ${diagramType === t.value ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setDiagramType(t.value)}
                >
                  <div className="font-semibold">{t.label}</div>
                  <div className="text-gray-500">{t.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Scene description (≥10 chars; describe what the diagram shows)
            </label>
            <textarea
              className="textarea h-24 font-mono text-xs"
              placeholder="e.g. A round-bottom flask is half-filled with air, sealed with a rubber stopper that has a thin glass tube going through it. The tube extends upward and bends 90° to the right, ending submerged in a beaker of water. A bunsen burner is lit beneath the flask."
              value={scene}
              onChange={(e) => setScene(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Labels (one per line, exact spelling — placed on the diagram)
            </label>
            <textarea
              className="textarea h-20 font-mono text-xs"
              placeholder={'gas (air)\nwater\nrubber stopper'}
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Size</label>
              <select className="select" value={size} onChange={(e) => setSize(e.target.value as any)}>
                {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Quality</label>
              <select className="select" value={quality} onChange={(e) => setQuality(e.target.value as any)}>
                {QUALITY_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Estimated cost</label>
              <div className="input bg-gray-50 font-mono text-sm">${estCost.toFixed(3)}</div>
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          {result && (
            <div className="card">
              <AuthAssetImage src={api.questionAssetUrl(result.storageUrl)} alt="generated" />
              <div className="text-xs mt-2 text-gray-600">
                Cost: ${result.costUsd.toFixed(3)} · Month-to-date: ${result.monthToDateUsd.toFixed(3)}
                {result.remainingUsd != null && <> · Remaining: ${result.remainingUsd.toFixed(2)}</>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            {result && (
              <button
                className="btn btn-primary"
                onClick={() => { onSaved(); onClose(); }}
              >
                Keep & close
              </button>
            )}
            <button
              className="btn"
              disabled={busy || scene.trim().length < 10}
              onClick={generate}
            >
              {busy ? 'Generating…' : result ? 'Regenerate' : `Generate (~$${estCost.toFixed(3)})`}
            </button>
          </div>
        </div>
      </div>
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
