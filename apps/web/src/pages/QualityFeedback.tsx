import { useEffect, useMemo, useState } from 'react';
import { api as baseApi } from '../lib/api';
import { formatSubjectLabel } from '../lib/labels';

// Cast to `any` because the four B3 endpoints
// (qualityLogSignal / qualityQuestionScore / qualityTopicLeaderboard /
// qualityAiPromptSuggestions) are added to `lib/api.ts` by the integrator
// — see `apps/api/src/quality-feedback/MERGE_INSTRUCTIONS.md` step 3.
// At runtime the methods exist; the cast just keeps tsc happy until
// the api.ts patch lands.
const api = baseApi as any;

/**
 * AI question quality feedback dashboard (B3).
 * Admin-only view. Lets a head_teacher pick a topic and see:
 *   - top-N / bottom-N questions by aggregate quality score
 *   - per-question signal counts (approved / rejected / edited /
 *     answered_correct / answered_wrong / skipped)
 *   - the AI prompt-suggestion snippets the next generation run should
 *     splice into its prompt for that topic.
 *
 * The route is wired in App.tsx by the integrator (see MERGE_INSTRUCTIONS.md).
 */

type SignalCounts = {
  approved: number;
  rejected: number;
  edited: number;
  answered_correct: number;
  answered_wrong: number;
  skipped: number;
};

type LeaderboardEntry = {
  questionId: string;
  marks: number;
  difficulty: number;
  questionType: string;
  sourceType: string;
  provenanceTag: string | null;
  score: number;
  totalSignals: number;
  counts: SignalCounts;
};

type LeaderboardResponse = {
  topic: { id: string; code: string; name: string };
  top: LeaderboardEntry[];
  bottom: LeaderboardEntry[];
};

type SuggestionsResponse = {
  topic: { id: string; code: string; name: string };
  suggestions: string[];
  stats: {
    totalSignals: number;
    totalScore: number;
    counts: SignalCounts;
  } | null;
};

export default function QualityFeedbackPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState<string>('');
  const [components, setComponents] = useState<any[]>([]);
  const [componentId, setComponentId] = useState<string>('');
  const [topics, setTopics] = useState<any[]>([]);
  const [topicId, setTopicId] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Boot: load all subjects so the user can pick one.
  useEffect(() => {
    (async () => {
      try {
        const s = await api.subjects();
        setSubjects(s);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!subjectId) {
      setComponents([]);
      setComponentId('');
      return;
    }
    (async () => {
      try {
        const c = await api.components(subjectId);
        setComponents(c);
        setComponentId('');
        setTopics([]);
        setTopicId('');
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [subjectId]);

  useEffect(() => {
    if (!componentId) {
      setTopics([]);
      setTopicId('');
      return;
    }
    (async () => {
      try {
        const t = await api.topics(componentId);
        setTopics(t);
        setTopicId('');
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [componentId]);

  async function load() {
    if (!topicId) return;
    setLoading(true);
    setError(null);
    try {
      const [lb, sg] = await Promise.all([
        api.qualityTopicLeaderboard(topicId),
        api.qualityAiPromptSuggestions(topicId),
      ]);
      setLeaderboard(lb);
      setSuggestions(sg);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (topicId) load();
    else {
      setLeaderboard(null);
      setSuggestions(null);
    }
  }, [topicId]);

  const stats = suggestions?.stats;
  const totalScoreColor = useMemo(() => {
    if (!stats) return 'text-gray-600';
    if (stats.totalScore > 5) return 'text-green-700';
    if (stats.totalScore < -5) return 'text-red-700';
    return 'text-gray-700';
  }, [stats]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">AI question quality</h1>
        <p className="text-sm text-gray-600">
          Per-topic quality leaderboard for AI-generated and human-curated questions, plus the
          prompt-tweak snippets the next generation run should pick up.
        </p>
      </div>

      <div className="card flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs text-gray-600 block">Subject</label>
          <select
            className="select"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            style={{ minWidth: 200 }}
          >
            <option value="">— pick subject —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {/* Fix #9: unify subject label across pages */}
                {formatSubjectLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600 block">Component</label>
          <select
            className="select"
            value={componentId}
            onChange={(e) => setComponentId(e.target.value)}
            disabled={!subjectId}
            style={{ minWidth: 180 }}
          >
            <option value="">— pick component —</option>
            {components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600 block">Topic</label>
          <select
            className="select"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            disabled={!componentId}
            style={{ minWidth: 240 }}
          >
            <option value="">— pick topic —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} {t.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-ghost" onClick={() => load()} disabled={!topicId || loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ background: '#fee2e2', borderColor: '#fecaca' }}>
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {!topicId && (
        <div className="card text-sm text-gray-600">
          Pick a topic above to inspect its question quality signals.
        </div>
      )}

      {topicId && stats && (
        <div className="card space-y-2">
          <div className="text-sm">
            <span className="text-gray-600">Topic</span>{' '}
            <span className="font-mono">
              {leaderboard?.topic.code} {leaderboard?.topic.name}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Stat label="Total signals" value={stats.totalSignals} />
            <Stat label="Aggregate score" value={stats.totalScore.toFixed(2)} className={totalScoreColor} />
            <SignalChip label="approved" v={stats.counts.approved} tone="green" />
            <SignalChip label="rejected" v={stats.counts.rejected} tone="red" />
            <SignalChip label="edited" v={stats.counts.edited} tone="amber" />
            <SignalChip label="correct" v={stats.counts.answered_correct} tone="green" />
            <SignalChip label="wrong" v={stats.counts.answered_wrong} tone="red" />
            <SignalChip label="skipped" v={stats.counts.skipped} tone="gray" />
          </div>
        </div>
      )}

      {topicId && suggestions && (
        <div className="card">
          <div className="font-semibold mb-2">AI prompt suggestions</div>
          {suggestions.suggestions.length === 0 ? (
            <div className="text-sm text-gray-600">
              No calibration signal yet — default generation prompt is fine for this topic.
            </div>
          ) : (
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {suggestions.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {topicId && leaderboard && (() => {
        // Fix #10: when no signals have been logged yet for this topic, every
        // question's aggregate score is 0.00, so sort-asc and sort-desc both
        // return the same list — rendering identical "Top" and "Bottom"
        // columns is confusing. Detect that case and collapse to a single
        // unsorted list with a clarifying note.
        const allEqual = stats != null && stats.totalSignals === 0;
        if (allEqual) {
          return (
            <div className="card">
              <div className="font-semibold mb-1">Questions in this topic</div>
              <div className="text-xs text-gray-500 mb-3">
                No quality signals logged yet — there is no top / bottom split until
                students answer or teachers approve / reject these questions.
              </div>
              <Leaderboard title="" entries={leaderboard.top} tone="gray" />
            </div>
          );
        }
        return (
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Leaderboard title="Top questions" entries={leaderboard.top} tone="green" />
            <Leaderboard title="Bottom questions" entries={leaderboard.bottom} tone="red" />
          </div>
        );
      })()}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-gray-500">{label}:</span>
      <span className={`font-semibold ${className ?? ''}`}>{value}</span>
    </span>
  );
}

function SignalChip({ label, v, tone }: { label: string; v: number; tone: 'green' | 'red' | 'amber' | 'gray' }) {
  const cls =
    tone === 'green'
      ? 'bg-green-100 text-green-700'
      : tone === 'red'
        ? 'bg-red-100 text-red-700'
        : tone === 'amber'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-gray-100 text-gray-700';
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>
      {label} {v}
    </span>
  );
}

function Leaderboard({
  title,
  entries,
  tone,
}: {
  title: string;
  entries: LeaderboardEntry[];
  tone: 'green' | 'red' | 'gray';
}) {
  // tone="gray" used in the no-signals collapse path (Fix #10).
  const scoreColor =
    tone === 'green' ? 'text-green-700' : tone === 'red' ? 'text-red-700' : 'text-gray-500';
  return (
    <div className="card p-0 overflow-hidden">
      {title && <div className="px-3 py-2 border-b text-sm font-semibold">{title}</div>}
      {entries.length === 0 ? (
        <div className="px-3 py-4 text-sm text-gray-600">No questions on this topic yet.</div>
      ) : (
        <div className="divide-y">
          {entries.map((e) => (
            <div key={e.questionId} className="px-3 py-2 text-sm">
              <div className="flex justify-between items-baseline">
                <span className="font-mono text-xs text-gray-500">{e.questionId.slice(-8)}</span>
                <span className={`font-semibold ${scoreColor}`}>
                  {e.score >= 0 ? '+' : ''}
                  {e.score.toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-gray-600 flex flex-wrap gap-2 mt-1">
                <span>{e.questionType}</span>
                <span>{e.marks}m</span>
                <span>diff {e.difficulty}</span>
                <span className="text-gray-500">{e.sourceType}</span>
                {e.provenanceTag && <span className="badge bg-purple-100 text-purple-700">{e.provenanceTag}</span>}
              </div>
              <div className="text-xs flex flex-wrap gap-1 mt-1">
                <SignalChip label="✓" v={e.counts.approved} tone="green" />
                <SignalChip label="✗" v={e.counts.rejected} tone="red" />
                <SignalChip label="✎" v={e.counts.edited} tone="amber" />
                <SignalChip label="ans✓" v={e.counts.answered_correct} tone="green" />
                <SignalChip label="ans✗" v={e.counts.answered_wrong} tone="red" />
                <SignalChip label="skip" v={e.counts.skipped} tone="gray" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
