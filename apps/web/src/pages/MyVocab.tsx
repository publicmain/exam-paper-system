import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BASE, api } from '../lib/api';
import { displayTranslation } from '../lib/dictDisplay';
import { weeklyTrackTitle } from '../lib/isoWeek';
import { canSpeak, speak } from '../lib/speech';
import { track } from '../lib/track';
import { Spinner } from '../components/AsyncState';

/**
 * 我的生词本（生词本 P2）。
 *
 * 公开页 + 姓名匹配，与 /my-history 同口径（学生不需要登录）。
 *
 * 设计取向见 docs/PRD/vocabulary-notebook.md §1.4：
 * 这不是又一个背单词 App —— 每个词都必须带着**他自己读过的那一句原文**
 * 和来源文章，这是百词斩之类产品给不了的东西。
 */

interface VocabWord {
  headword: string;
  surfaceForm: string;
  sourceType: 'click' | 'wrong_answer' | 'teacher_push';
  sourcePassageTitle: string | null;
  contextSentence: string;
  state: 'new' | 'learning' | 'review' | 'known';
  reps: number;
  lapses: number;
  due: string;
  createdAt: string;
  phonetic: string | null;
  translation: string;
  tag: string[];
}

const SOURCE_LABEL: Record<VocabWord['sourceType'], { text: string; cls: string }> = {
  click: { text: '阅读时添加', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  wrong_answer: { text: '答错自动收录', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  teacher_push: { text: '老师推送', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const EXAM_TAGS: Record<string, string> = {
  ielts: '雅思',
  toefl: '托福',
  gre: 'GRE',
  cet4: '四级',
  cet6: '六级',
  gk: '高考',
  zk: '中考',
  ky: '考研',
};

export default function MyVocabPage() {
  const [params] = useSearchParams();
  const name = params.get('name') ?? '';
  const studentId = params.get('studentId') ?? '';
  const [data, setData] = useState<{ total: number; dueCount: number; words: VocabWord[] } | null>(null);
  /** 进度反馈（2026-08-14 调研缺陷五）：已掌握数 + 连续学习天数。
   *  拿不到就不显示 —— 绝不因统计接口影响词表本身。 */
  const [progress, setProgress] = useState<{
    known: number;
    streak: number;
    mastered: number;
    learning: number;
    untouched: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'wrong_answer' | 'click'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!name) return;
    api
      .vocabList({ name, studentId: studentId || undefined })
      .then((r: any) => {
        setData(r);
        // P6 埋点：记录"打开过生词本"。失败静默。
        track('vocab', name, studentId);
      })
      .catch((e: any) => setError(String(e?.message ?? e)));
  }, [name, studentId]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `${BASE}/api/vocab/stats?name=${encodeURIComponent(name)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`,
        );
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && typeof j?.knownCount === 'number') {
          setProgress({
            known: j.knownCount,
            streak: j.streakDays ?? 0,
            mastered: j.progress?.mastered ?? j.knownCount ?? 0,
            learning: j.progress?.learning ?? 0,
            untouched: j.progress?.untouched ?? 0,
          });
        }
      } catch { /* 静默 */ }
    })();
    return () => { cancelled = true; };
  }, [name, studentId]);

  const shown = useMemo(
    () => (data?.words ?? []).filter((w) => filter === 'all' || w.sourceType === filter),
    [data, filter],
  );

  // 每周小主线（研究性分析 #3）：本周随扫码推入的 15 个主线词。
  // 有限游戏 —— 周内清完、下周换一批；比望不到头的 3000 词进度条
  // 更符合人均单日 4.5 次评分的真实吞吐。
  const weekTrack = useMemo(() => {
    const title = weeklyTrackTitle();
    const words = (data?.words ?? []).filter((w) => w.sourcePassageTitle === title);
    return { total: words.length, learned: words.filter((w) => w.reps > 0).length };
  }, [data]);

  const remove = async (headword: string) => {
    setBusy(headword);
    try {
      await api.vocabRemove({ studentName: name, studentId: studentId || undefined, headword });
      setData((d) =>
        d ? { ...d, total: d.total - 1, words: d.words.filter((w) => w.headword !== headword) } : d,
      );
    } catch {
      /* 忽略：下次刷新会纠正 */
    } finally {
      setBusy(null);
    }
  };

  if (!name) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center text-gray-600">
          <div className="mb-3">请从「我的记录」进入生词本。</div>
          <Link to="/my-history" className="text-blue-600 underline">
            → 我的记录
          </Link>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-12 text-center">
        <div className="text-rose-700 mb-4">⚠️ {error}</div>
        <Link to={`/my-history?name=${encodeURIComponent(name)}`} className="text-blue-600 underline text-sm">
          ← 返回我的记录
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Spinner label="加载生词本…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <Link
          to={`/my-history?name=${encodeURIComponent(name)}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← 返回我的记录
        </Link>

        <header className="bg-white rounded-xl border shadow-sm p-5">
          <h1 className="text-2xl font-bold text-gray-900">📒 我的生词本</h1>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <span className="text-3xl font-bold text-gray-900">{data.total}</span>
              <span className="text-sm text-gray-500 ml-1">个词</span>
            </div>
            {data.dueCount > 0 && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                {data.dueCount} 个待复习
              </div>
            )}
            {progress && progress.streak > 0 && (
              <div className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
                🔥 连续 {progress.streak} 天
              </div>
            )}
            {weekTrack.total > 0 && (
              <div
                className={`text-sm rounded px-2 py-0.5 border ${
                  weekTrack.learned >= weekTrack.total
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                }`}
              >
                {weekTrack.learned >= weekTrack.total
                  ? `🏁 本周主线 ${weekTrack.total} 词全部学完`
                  : `🧭 本周主线 已学 ${weekTrack.learned}/${weekTrack.total}`}
              </div>
            )}
          </div>

          {/* 三分进度（2026-08-24 词汇主线化）。
              原来只显示「已掌握 N」，学生看到的仍然主要是一个只涨不落的
              生词总数。摊成三段之后，「待开始」那一格有多长是一眼能看见
              的 —— 生产数据里它占 68%，这正是要让学生和老师都看见的事。 */}
          {progress && (progress.mastered + progress.learning + progress.untouched) > 0 && (
            <div className="mt-3">
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                {[
                  { n: progress.mastered, cls: 'bg-emerald-500' },
                  { n: progress.learning, cls: 'bg-sky-500' },
                  { n: progress.untouched, cls: 'bg-gray-300' },
                ].map((seg, i) => {
                  const tot = progress.mastered + progress.learning + progress.untouched;
                  return seg.n > 0 ? (
                    <div key={i} className={seg.cls} style={{ width: `${(seg.n / tot) * 100}%` }} />
                  ) : null;
                })}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-gray-600">
                <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1" />已掌握 {progress.mastered}</span>
                <span><span className="inline-block w-2 h-2 rounded-sm bg-sky-500 mr-1" />学习中 {progress.learning}</span>
                <span><span className="inline-block w-2 h-2 rounded-sm bg-gray-300 mr-1" />待开始 {progress.untouched}</span>
              </div>
            </div>
          )}
          {data.total === 0 && (
            <div className="mt-3 text-sm text-gray-600 leading-relaxed space-y-1.5">
              <p className="font-semibold text-gray-700">本子还是空的。词会从三个地方进来：</p>
              <p>① 交卷后在成绩页重读文章，<strong>点任意不认识的单词</strong>即可加入；</p>
              <p>② 每天扫码进考场时，当天文章的重点词会自动推给你；</p>
              <p>③ 答错的词义/填空题，批改后那个词会自动收进来。</p>
              <p className="text-gray-500">先去答一场早测，明天这里就有东西可背了。</p>
            </div>
          )}
          {/* 主按钮跟着本子状态走（修复 #8）：全是没学过的词时，主位给
              「先学新词」—— 这时点自测只会被没见过的词考到全错。
              有学过的词才把自测放主位（客观判分,自评会骗自己）。 */}
          {data.total > 0 && (() => {
            const qs = `name=${encodeURIComponent(name)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`;
            const allNew = progress != null && progress.mastered + progress.learning === 0;
            const quizBtn = (primary: boolean) => (
              <Link
                to={`/my-vocab/quiz?${qs}`}
                className={`flex-1 text-center py-3 rounded-xl font-semibold touch-manipulation ${
                  primary
                    ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                🎯 自测
              </Link>
            );
            const reviewBtn = (primary: boolean) => (
              <Link
                to={`/my-vocab/review?${qs}`}
                className={`flex-1 text-center py-3 rounded-xl font-semibold touch-manipulation ${
                  primary
                    ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                {allNew ? '📖 先学新词' : '📖 复习'}
              </Link>
            );
            return (
              <div className="mt-4 flex gap-2">
                {allNew ? (
                  <>
                    {reviewBtn(true)}
                    {quizBtn(false)}
                  </>
                ) : (
                  <>
                    {quizBtn(true)}
                    {reviewBtn(false)}
                  </>
                )}
              </div>
            );
          })()}
        </header>

        {data.total > 0 && (
          <div className="flex gap-2">
            {([
              ['all', `全部 ${data.total}`],
              ['wrong_answer', '答错收录'],
              ['click', '我加的'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`text-sm px-3 py-1.5 rounded-full border ${
                  filter === k
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <section className="space-y-3">
          {shown.map((w) => {
            const src = SOURCE_LABEL[w.sourceType];
            return (
              <article key={w.headword} className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl font-bold text-gray-900">{w.headword}</span>
                      {canSpeak() && (
                        <button
                          type="button"
                          onClick={() => speak(w.headword)}
                          aria-label={`朗读 ${w.headword}`}
                          className="text-base px-1 rounded hover:bg-gray-100"
                        >
                          🔊
                        </button>
                      )}
                      {w.phonetic && <span className="text-sm text-gray-500">/{w.phonetic}/</span>}
                      {w.tag.filter((t) => EXAM_TAGS[t]).slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className={`text-[11px] px-1.5 py-0.5 rounded ${
                            t === 'ielts'
                              ? 'bg-purple-100 text-purple-700 font-semibold'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {EXAM_TAGS[t]}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 text-[15px] text-gray-800 whitespace-pre-wrap">
                      {displayTranslation(w.translation, 2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(w.headword)}
                    disabled={busy === w.headword}
                    aria-label={`移除 ${w.headword}`}
                    className="shrink-0 text-xs text-gray-400 hover:text-rose-600 px-2 py-1"
                  >
                    {busy === w.headword ? '…' : '移除'}
                  </button>
                </div>

                {w.contextSentence && (
                  <div className="mt-2.5 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[13px] text-gray-700 leading-relaxed">
                    {highlight(w.contextSentence, w.surfaceForm)}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded border ${src.cls}`}>{src.text}</span>
                  {w.sourcePassageTitle && (
                    <span className="text-gray-500">来自《{w.sourcePassageTitle}》</span>
                  )}
                  {w.reps > 0 && <span className="text-gray-400">已复习 {w.reps} 次</span>}
                </div>
              </article>
            );
          })}
          {data.total > 0 && shown.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-8">该分类下暂无生词。</div>
          )}
        </section>
      </main>
    </div>
  );
}

/** 在原句里把该词高亮出来 —— 复习时一眼看到它长在什么语境。 */
function highlight(sentence: string, surface: string) {
  if (!surface) return sentence;
  const idx = sentence.toLowerCase().indexOf(surface.toLowerCase());
  if (idx < 0) return sentence;
  return (
    <>
      {sentence.slice(0, idx)}
      <mark className="bg-amber-200 rounded px-0.5">{sentence.slice(idx, idx + surface.length)}</mark>
      {sentence.slice(idx + surface.length)}
    </>
  );
}
