import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const SUBJECT_PRESETS = [
  { code: '9608', name: 'Computer Science', emoji: '💻' },
  { code: '9702', name: 'Physics', emoji: '⚛️' },
  { code: '9709', name: 'Mathematics', emoji: '∑' },
];

export default function QuickPaperPage() {
  const [subjectCode, setSubjectCode] = useState('9608');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [componentId, setComponentId] = useState<string>('');
  const [topics, setTopics] = useState<any[]>([]);
  const [busyTopicCode, setBusyTopicCode] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; result?: any; error?: string } | null>(null);
  const [withDiagrams, setWithDiagrams] = useState(true);
  const [count, setCount] = useState(5);

  const nav = useNavigate();

  useEffect(() => {
    api.subjects().then(setSubjects).catch(() => {});
  }, []);

  const subject = useMemo(
    () => subjects.find((s) => s.code === subjectCode),
    [subjects, subjectCode],
  );

  useEffect(() => {
    if (!subject) {
      setComponents([]);
      setComponentId('');
      return;
    }
    api.components(subject.id).then((cs: any[]) => {
      setComponents(cs);
      // Default to first component (AS for 9608/9702)
      const def = cs.find((c) => c.code === 'AS') || cs[0];
      setComponentId(def?.id ?? '');
    });
  }, [subject?.id]);

  useEffect(() => {
    if (componentId) {
      api.topics(componentId).then(setTopics);
    } else {
      setTopics([]);
    }
  }, [componentId]);

  const flatTopics = useMemo(() => {
    const out: any[] = [];
    function walk(tree: any[], depth = 0) {
      for (const t of tree) {
        out.push({ ...t, _depth: depth });
        if (t.children?.length) walk(t.children, depth + 1);
      }
    }
    walk(topics);
    return out;
  }, [topics]);

  const topLevelOnly = flatTopics.filter((t) => t._depth === 0);

  async function generateForTopic(t: any) {
    if (busyTopicCode) return;
    setBusyTopicCode(t.code);
    setProgress({ step: `Drafting ${count} questions for ${t.code} ${t.name} ...` });
    try {
      // Cute progressive status updates
      const tickerSteps = withDiagrams
        ? [
            'Drafting questions with Claude · ~30s',
            'Auto-approving drafts into the question bank',
            'Generating diagrams with gpt-image-2 · ~25s each (parallel)',
            'Assembling paper',
          ]
        : [
            'Drafting questions with Claude · ~30s',
            'Auto-approving drafts into the question bank',
            'Assembling paper',
          ];
      let stepIdx = 0;
      const ticker = setInterval(() => {
        if (stepIdx < tickerSteps.length - 1) {
          stepIdx++;
          setProgress((p) => p && !p.result ? { ...p, step: tickerSteps[stepIdx] } : p);
        }
      }, withDiagrams ? 25000 : 12000);

      const result = await api.quickPaper({
        syllabusCode: subjectCode,
        topicCode: t.code,
        count,
        includeDiagrams: withDiagrams,
        multiPart: true,
        paperName: `Quick Paper · ${subjectCode} ${t.code} ${t.name}`,
      });
      clearInterval(ticker);
      setProgress({ step: 'Done', result });
    } catch (e: any) {
      setProgress({ step: 'Failed', error: e.message });
    } finally {
      setBusyTopicCode(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">⚡ Quick Paper</h1>
        <p className="text-sm text-gray-600">
          One click → AI authors fresh questions, decides which need diagrams, generates them,
          and assembles a printable paper. ~70–90s per click, ~$0.20 per paper.
        </p>
      </div>

      <div className="card flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          {SUBJECT_PRESETS.map((s) => (
            <button
              key={s.code}
              className={`btn ${subjectCode === s.code ? 'btn-primary' : ''}`}
              onClick={() => setSubjectCode(s.code)}
            >
              <span className="mr-1">{s.emoji}</span> {s.code} {s.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label>Component:</label>
          <select
            className="select"
            value={componentId}
            onChange={(e) => setComponentId(e.target.value)}
            style={{ width: 180 }}
          >
            {components.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label>Questions:</label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 5)))}
            className="input"
            style={{ width: 70 }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withDiagrams}
            onChange={(e) => setWithDiagrams(e.target.checked)}
          />
          Generate AI diagrams (gpt-image-2, +$0.05/diagram)
        </label>
      </div>

      {topLevelOnly.length === 0 && (
        <div className="card text-gray-500 text-sm">
          {subjectCode === '9608'
            ? 'CS topics will appear here once the API restarts and seeds the 9608 syllabus.'
            : 'Loading topics ...'}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {topLevelOnly.map((t, i) => (
          <button
            key={t.id}
            disabled={!!busyTopicCode}
            onClick={() => generateForTopic(t)}
            className={`card text-left transition hover:shadow-md ${
              busyTopicCode === t.code ? 'ring-2 ring-blue-500' : ''
            } ${busyTopicCode && busyTopicCode !== t.code ? 'opacity-40' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-gray-500 font-mono">{t.code}</div>
              </div>
              <div className="text-2xl text-gray-400">›</div>
            </div>
          </button>
        ))}
      </div>

      {progress && (
        <ProgressOverlay
          progress={progress}
          onClose={() => setProgress(null)}
          onOpenPaper={(paperId) => nav(`/papers/${paperId}`)}
        />
      )}
    </div>
  );
}

function ProgressOverlay({
  progress,
  onClose,
  onOpenPaper,
}: {
  progress: { step: string; result?: any; error?: string };
  onClose: () => void;
  onOpenPaper: (paperId: string) => void;
}) {
  const done = !!progress.result || !!progress.error;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {progress.error ? '❌ Failed' : done ? '✅ Paper ready' : '⚙️ Generating ...'}
          </h2>
          {done && (
            <button className="btn btn-ghost text-sm" onClick={onClose}>
              Close
            </button>
          )}
        </div>

        {!done && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">{progress.step}</div>
            <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
              <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
            </div>
            <div className="text-xs text-gray-500">
              Don't close this tab — the API call is running on the server. ~70–90s with diagrams,
              ~30s without.
            </div>
          </div>
        )}

        {progress.error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{progress.error}</div>
        )}

        {progress.result && (
          <div className="space-y-3">
            <div className="bg-green-50 p-3 rounded text-sm">
              <div className="font-semibold">{progress.result.paperName}</div>
              <div className="text-gray-700 mt-1">
                {progress.result.questionCount} questions · {progress.result.totalMarks} marks ·{' '}
                {progress.result.durationMin} min
              </div>
              <div className="text-gray-700 mt-1">
                Diagrams: {progress.result.diagramsGenerated} of {progress.result.diagramsRequested}{' '}
                requested
                {progress.result.diagramErrors?.length > 0 && (
                  <span className="text-amber-700 ml-2">
                    ({progress.result.diagramErrors.length} failed)
                  </span>
                )}
              </div>
              <div className="text-gray-700 mt-1">
                Cost:{' '}
                <span className="font-mono">
                  ${progress.result.cost.totalUsd.toFixed(4)}
                </span>{' '}
                <span className="text-xs text-gray-500">
                  (Q: ${progress.result.cost.questionsUsd.toFixed(4)} + Img: $
                  {progress.result.cost.diagramsUsd.toFixed(4)})
                </span>
              </div>
              <div className="text-gray-700 mt-1">
                Elapsed:{' '}
                <span className="font-mono">
                  {(progress.result.elapsedMs.total / 1000).toFixed(1)}s
                </span>{' '}
                <span className="text-xs text-gray-500">
                  (Q: {Math.round(progress.result.elapsedMs.questions / 1000)}s · Img:{' '}
                  {Math.round(progress.result.elapsedMs.diagrams / 1000)}s)
                </span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost" onClick={onClose}>
                Generate another
              </button>
              <button
                className="btn btn-primary"
                onClick={() => onOpenPaper(progress.result.paperId)}
              >
                Open paper →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
