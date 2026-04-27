import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { MathHtml } from '../components/MathHtml';

const TYPES = ['mcq', 'short_answer', 'structured', 'essay'];

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
      });
    }
  }, [id]);

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
          <button className="btn mt-2" disabled={aiBusy || !form.content.stem || !form.subjectId} onClick={suggestAi}>
            {aiBusy ? 'AI thinking…' : '🤖 Suggest topic & difficulty'}
          </button>
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

      <div className="flex gap-2 pt-4 border-t">
        <button className="btn" disabled={saving} onClick={() => save(false)}>Save Draft</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => save(true)}>Save & Publish (Active)</button>
        <button className="btn btn-ghost" onClick={() => nav('/questions')}>Cancel</button>
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
