import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const SUBJECT_PRESETS = [
  { code: '9608', name: 'Computer Science', emoji: '💻' },
  { code: '9702', name: 'Physics', emoji: '⚛️' },
  { code: '9701', name: 'Chemistry', emoji: '⚗️' },
  { code: '9709', name: 'Mathematics', emoji: '∑' },
  { code: '4024', name: 'O-Level Math', emoji: '📐' },
  { code: '4MA1', name: 'IGCSE Math A', emoji: '📊' },
];

interface PaperPreset {
  id: 'morning' | 'weekly' | 'mock';
  emoji: string;
  label: string;
  blurb: string;
  durationMin: number;
  pickTopics: (allTopics: any[]) => Array<{ code: string; count: number }>;
}

const PRESETS: PaperPreset[] = [
  {
    id: 'morning',
    emoji: '☕',
    label: 'Morning Quick Test',
    blurb: '3 topics · 1 q each · ~15 min',
    durationMin: 15,
    pickTopics: (all) => sampleN(all, 3).map((t) => ({ code: t.code, count: 1 })),
  },
  {
    id: 'weekly',
    emoji: '📝',
    label: 'Weekly Test',
    blurb: '5 topics · 2 q each · ~45 min',
    durationMin: 45,
    pickTopics: (all) => sampleN(all, 5).map((t) => ({ code: t.code, count: 2 })),
  },
  {
    id: 'mock',
    emoji: '🏆',
    label: 'Mock Exam',
    blurb: 'All sections · 1 q each · ~90 min',
    durationMin: 90,
    pickTopics: (all) => all.map((t) => ({ code: t.code, count: 1 })),
  },
];

function sampleN<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return [...arr];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function QuickPaperPage() {
  const [subjectCode, setSubjectCode] = useState('9608');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [componentId, setComponentId] = useState<string>('');
  const [topics, setTopics] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; result?: any; error?: string } | null>(null);
  const [withDiagrams, setWithDiagrams] = useState(true);
  const [count, setCount] = useState(5);
  // Custom mix: { 'CS.1': 1, 'CS.3': 2, ... }
  const [mix, setMix] = useState<Record<string, number>>({});
  // R16: free-text chat-paper description. When non-empty, the
  // "Generate from description" button parses it via Claude haiku and
  // feeds the result into the same QuickPaper pipeline.
  const [chatMessage, setChatMessage] = useState('');

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
    // Switching component invalidates the per-topic mix selection.
    setMix({});
  }, [componentId]);

  const mixEntries = useMemo(
    () => Object.entries(mix).filter(([, n]) => n > 0),
    [mix],
  );
  const mixTotalQuestions = mixEntries.reduce((s, [, n]) => s + n, 0);
  const mixDurationEstimate = Math.max(15, mixTotalQuestions * 8); // rough

  function bumpMix(code: string, delta: number) {
    setMix((m) => {
      const next = { ...m };
      const cur = next[code] ?? 0;
      const newVal = Math.max(0, Math.min(10, cur + delta));
      if (newVal === 0) delete next[code];
      else next[code] = newVal;
      return next;
    });
  }
  function clearMix() {
    setMix({});
  }

  const topLevelTopics = useMemo(() => topics.map((t) => ({ ...t })), [topics]);

  async function runQuickPaper(args: {
    label: string;
    topicsArg?: { code: string; count: number }[];
    singleTopic?: { code: string; name: string };
    durationMin?: number;
    paperName: string;
    busyTag: string;
  }) {
    if (busy) return;
    setBusy(args.busyTag);
    setProgress({
      step: args.singleTopic
        ? `Drafting ${count} questions for ${args.singleTopic.code} ${args.singleTopic.name} ...`
        : `Drafting questions across ${args.topicsArg?.length ?? 0} topics in parallel ...`,
    });
    const tickerSteps = withDiagrams
      ? [
          'Drafting with Claude (parallel per topic) · ~30s',
          'Auto-approving drafts into the question bank',
          'Generating diagrams with gpt-image-2 · parallel',
          'Assembling paper',
        ]
      : [
          'Drafting with Claude (parallel per topic) · ~30s',
          'Auto-approving drafts into the question bank',
          'Assembling paper',
        ];
    let stepIdx = 0;
    const ticker = setInterval(() => {
      if (stepIdx < tickerSteps.length - 1) {
        stepIdx++;
        setProgress((p) => (p && !p.result ? { ...p, step: tickerSteps[stepIdx] } : p));
      }
    }, withDiagrams ? 22000 : 10000);

    try {
      const body: any = {
        syllabusCode: subjectCode,
        includeDiagrams: withDiagrams,
        multiPart: true,
        paperName: args.paperName,
      };
      if (args.singleTopic) {
        body.topicCode = args.singleTopic.code;
        body.count = count;
      } else {
        body.topics = args.topicsArg;
        if (args.durationMin) body.durationMin = args.durationMin;
      }
      const result = await api.quickPaper(body);
      clearInterval(ticker);
      setProgress({ step: 'Done', result });
    } catch (e: any) {
      clearInterval(ticker);
      setProgress({ step: 'Failed', error: e.message });
    } finally {
      setBusy(null);
    }
  }

  function runPreset(preset: PaperPreset) {
    if (topLevelTopics.length === 0) return;
    const picked = preset.pickTopics(topLevelTopics);
    if (picked.length === 0) return;
    runQuickPaper({
      label: preset.label,
      topicsArg: picked,
      durationMin: preset.durationMin,
      paperName: `${preset.label} · ${subjectCode} (${picked.length} sections)`,
      busyTag: `preset-${preset.id}`,
    });
  }

  function runSingleTopic(t: any) {
    runQuickPaper({
      label: `${t.code} ${t.name}`,
      singleTopic: { code: t.code, name: t.name },
      paperName: `Quick Paper · ${subjectCode} ${t.code} ${t.name}`,
      busyTag: `topic-${t.code}`,
    });
  }

  async function runChatPaper() {
    if (busy) return;
    const msg = chatMessage.trim();
    if (msg.length < 3) return;
    setBusy('chat');
    setProgress({ step: 'Interpreting your description with Claude …' });
    const tickerSteps = [
      'Interpreting your description with Claude (~3s)',
      'Drafting questions with sonnet · ~30-60s',
      'Auto-approving drafts into the question bank',
      withDiagrams ? 'Generating diagrams in parallel' : 'Skipping diagrams',
      'Assembling paper',
    ];
    let stepIdx = 0;
    const ticker = setInterval(() => {
      if (stepIdx < tickerSteps.length - 1) {
        stepIdx++;
        setProgress((p) => (p && !p.result ? { ...p, step: tickerSteps[stepIdx] } : p));
      }
    }, 12000);
    try {
      const result: any = await api.chatPaper({
        syllabusCode: subjectCode,
        message: msg,
      });
      clearInterval(ticker);
      setProgress({ step: 'Done', result });
    } catch (e: any) {
      clearInterval(ticker);
      setProgress({ step: 'Failed', error: e.message });
    } finally {
      setBusy(null);
    }
  }

  function runCustomMix() {
    if (mixEntries.length === 0) return;
    const topicsArg = mixEntries.map(([code, count]) => ({ code, count }));
    const label = `Custom Mix · ${mixEntries.length} sections, ${mixTotalQuestions}q`;
    runQuickPaper({
      label,
      topicsArg,
      durationMin: mixDurationEstimate,
      paperName: `Custom Mix · ${subjectCode} (${mixEntries.length} sections, ${mixTotalQuestions}q)`,
      busyTag: 'custom-mix',
    }).then(() => {
      // Clear the selection on success so the next mix starts fresh.
      // (runQuickPaper sets `progress` regardless of outcome; we clear
      // optimistically — user can also regenerate the same selection
      // by re-clicking the "+" buttons if they want.)
      clearMix();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">⚡ Quick Paper</h1>
        <p className="text-sm text-gray-600">
          One click → AI authors fresh questions, decides which need diagrams, generates them,
          and assembles a printable paper. Single-topic ~70-90s ($0.10-0.20). Mixed papers
          (Mock Exam) parallelise per topic, ~45s ($0.30-0.80).
        </p>
      </div>

      {/* R16: chat-paper — type a free-text description, Claude haiku
          parses it into a QuickPaperInput, then the same author-audit-
          assemble pipeline runs. Subject chip below still decides which
          syllabus's topic taxonomy is grounded into the parse. */}
      <div
        className="card space-y-2"
        style={{ background: 'linear-gradient(135deg,#fef3c7,#fef9c3)' }}
      >
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="font-bold text-base">💬 用对话出题</div>
            <div className="text-xs text-gray-600">
              一句话描述要出的题，AI 会解析成具体的考点 / 题数 / 难度 / 是否要图。
              例: "4024，OL.4 二次函数图像 + 零点，5 题，难度 3-4，要图，40 分钟"
            </div>
          </div>
          <div className="text-xs text-gray-500">
            语料范围跟下面选的 syllabus 一致（当前: <span className="font-mono">{subjectCode}</span>）
          </div>
        </div>
        <textarea
          className="input w-full font-mono text-sm"
          rows={2}
          placeholder="例: 5 道 OL.4 函数与图像题，重点二次函数零点和图像变换，难度中等偏难，要图"
          value={chatMessage}
          disabled={!!busy}
          onChange={(e) => setChatMessage(e.target.value.slice(0, 2000))}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-gray-500">
            {chatMessage.length}/2000
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost text-sm"
              disabled={!!busy || !chatMessage}
              onClick={() => setChatMessage('')}
            >
              清空
            </button>
            <button
              className="btn btn-primary"
              disabled={!!busy || chatMessage.trim().length < 3}
              onClick={runChatPaper}
            >
              {busy === 'chat' ? '生成中 …' : '✨ AI 出题'}
            </button>
          </div>
        </div>
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
                {/* Fix #11: when name already starts with code (e.g. "AS Computer Science")
                    we'd otherwise render "AS AS Computer Science". Strip the leading code. */}
                {c.code === c.name || c.name?.startsWith(c.code + ' ')
                  ? c.name
                  : `${c.code} ${c.name}`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label>Q per topic (single-topic mode):</label>
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

      {/* Preset buttons */}
      <div>
        <div className="text-xs uppercase text-gray-500 font-semibold mb-2 tracking-wide">
          Mixed-topic presets
        </div>
        {/* R10-Bug4: 3 columns at 320px wraps each preset card to one
            tiny line; stack 1-up on mobile, 2-up on iPad portrait, 3-up
            on iPad landscape and up. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              disabled={!!busy || topLevelTopics.length === 0}
              onClick={() => runPreset(p)}
              className={`card text-left transition hover:shadow-lg ${
                busy === `preset-${p.id}` ? 'ring-2 ring-blue-500' : ''
              } ${busy && busy !== `preset-${p.id}` ? 'opacity-40' : ''}`}
              style={{
                background: busy === `preset-${p.id}`
                  ? 'linear-gradient(135deg,#7c3aed18,#3b82f618)'
                  : 'linear-gradient(135deg,#fafaff,#fff)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-lg flex items-center justify-center text-3xl shrink-0"
                  style={{
                    background:
                      p.id === 'mock'
                        ? 'linear-gradient(135deg,#f59e0b,#ef4444)'
                        : p.id === 'weekly'
                        ? 'linear-gradient(135deg,#10b981,#3b82f6)'
                        : 'linear-gradient(135deg,#a78bfa,#3b82f6)',
                  }}
                >
                  {p.emoji}
                </div>
                <div>
                  <div className="font-bold">{p.label}</div>
                  <div className="text-xs text-gray-600">{p.blurb}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Single-topic cards */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs uppercase text-gray-500 font-semibold tracking-wide">
            Sections — click card for single-topic, click <span className="text-emerald-700">+</span> to add to mix
          </div>
          {mixEntries.length === 0 && (
            <div className="text-xs text-gray-400">
              Tip: click the green + on multiple sections to build a custom mix.
            </div>
          )}
        </div>
        {topLevelTopics.length === 0 && (
          <div className="card text-gray-500 text-sm">
            {subjectCode === '9608'
              ? 'CS topics will appear here once the API restarts and seeds the 9608 syllabus.'
              : 'Loading topics ...'}
          </div>
        )}
        {/* R10-Bug4: stack 1-up on mobile, 2-up on iPad+, 3-up on xl. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {topLevelTopics.map((t, i) => {
            const inMix = (mix[t.code] ?? 0) > 0;
            return (
              <div
                key={t.id}
                className={`card text-left transition hover:shadow-md relative ${
                  busy === `topic-${t.code}` ? 'ring-2 ring-blue-500' : ''
                } ${inMix ? 'ring-2 ring-emerald-400' : ''} ${
                  busy && busy !== `topic-${t.code}` ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <button
                  className="w-full text-left disabled:cursor-not-allowed"
                  disabled={!!busy}
                  onClick={() => runSingleTopic(t)}
                >
                  <div className="flex items-start gap-3 pr-24">
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
                  </div>
                </button>
                {/* Mix +/- controls in the right corner. */}
                <div
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  {inMix && (
                    <>
                      <button
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 font-bold"
                        disabled={!!busy}
                        title="Remove one"
                        onClick={() => bumpMix(t.code, -1)}
                      >
                        −
                      </button>
                      <span className="font-mono w-7 text-center font-bold text-emerald-700">
                        ×{mix[t.code]}
                      </span>
                    </>
                  )}
                  <button
                    className={`w-7 h-7 rounded-full disabled:opacity-40 font-bold ${
                      inMix
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700'
                    }`}
                    disabled={!!busy || (mix[t.code] ?? 0) >= 10}
                    title={inMix ? 'Add one more to mix' : 'Add to mix'}
                    onClick={() => bumpMix(t.code, +1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom padding so the floating bar doesn't cover the last card. */}
      {mixEntries.length > 0 && <div style={{ height: 90 }} />}

      {/* Floating Custom Mix selection bar */}
      {mixEntries.length > 0 && (
        <div
          className="fixed left-0 right-0 bottom-0 border-t bg-white shadow-2xl z-40"
          style={{ borderColor: '#e5e7eb' }}
        >
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
            <div className="text-sm">
              <strong className="text-emerald-700">{mixEntries.length}</strong> sections ·{' '}
              <strong className="text-emerald-700">{mixTotalQuestions}</strong> questions · ~
              {mixDurationEstimate} min
            </div>
            <div className="flex-1 flex flex-wrap gap-1 min-w-0">
              {mixEntries.map(([code, n]) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 text-xs"
                >
                  <span className="font-mono">{code}</span>
                  <span className="font-bold text-emerald-700">×{n}</span>
                  <button
                    className="ml-1 text-gray-500 hover:text-red-600"
                    title="Remove"
                    onClick={() => bumpMix(code, -n)}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <button
              className="btn"
              disabled={!!busy}
              onClick={clearMix}
            >
              Clear
            </button>
            <button
              className="btn btn-primary"
              disabled={!!busy || mixEntries.length === 0}
              onClick={runCustomMix}
            >
              {busy === 'custom-mix' ? 'Generating ...' : `Generate mixed paper →`}
            </button>
          </div>
        </div>
      )}

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
            {progress.error
              ? '❌ Failed'
              : done && progress.result?.partial
                ? '⚠️ Paper ready (partial)'
                : done
                  ? '✅ Paper ready'
                  : '⚙️ Generating ...'}
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
              Don't close this tab — the API call is running on the server. Mock exam (12 topics)
              ~45s with diagrams; single topic ~70-90s.
            </div>
          </div>
        )}

        {progress.error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{progress.error}</div>
        )}

        {progress.result && (
          <div className="space-y-3">
            <div
              className={`p-3 rounded text-sm ${
                progress.result.partial ? 'bg-amber-50' : 'bg-green-50'
              }`}
            >
              <div className="font-semibold">{progress.result.paperName}</div>
              <div className="text-gray-700 mt-1">
                {progress.result.questionCount} questions across {progress.result.topicCount}{' '}
                topic{progress.result.topicCount > 1 ? 's' : ''} · {progress.result.totalMarks}{' '}
                marks · {progress.result.durationMin} min
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
              {progress.result.warnings && progress.result.warnings.length > 0 && (
                <ul className="mt-2 text-amber-800 list-disc pl-5 space-y-0.5">
                  {progress.result.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
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
