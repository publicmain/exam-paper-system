import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { track } from '../lib/track';
import { Spinner } from '../components/AsyncState';

/**
 * 错题重练（2026-08-13）。
 *
 * 错题本 v1 只有「读一遍 + 自己点已弄懂」—— 自报是最弱的确认方式，
 * 上线首日全班 0 人点过那个按钮。成熟产品（Anki / 猿题库系）的共同
 * 做法是**错题会回来考你**：这一页就是那个闭环。
 *
 * 规则（服务端 nextPracticeState）：做对 → streak 1；**隔天**再做对
 * → 自动移出错题本。同一天连对不叠加（刚看完答案马上重做是短时
 * 记忆），做错归零。每天最多 10 道，几分钟能练完。
 *
 * 交互按题型分四种（服务端 practiceKind）：
 *   tfng    判断题三键（TRUE/FALSE/NOT GIVEN）
 *   letters 段落匹配的段落字母键（从原文推出）
 *   options MCQ / 情绪配对的完整选项（snapshotOptions）
 *   reveal  主观题：想好再翻卡，自评（无 AI，Anki 模式）
 * 客观题都带可折叠原文 —— 离开原文的"重做"只是背答案。
 */

interface PracticeItem {
  id: string;
  taskType: string;
  reason: string;
  passageTitle: string;
  quizDay: string;
  stem: string;
  correctAnswer: string;
  myOldAnswer: string;
  markerComment: string;
  answerPoints: string[];
  answerModel: string;
  explanation: string;
  evidence: string;
  practiceKind: 'tfng' | 'letters' | 'options' | 'reveal';
  options: Array<string | { key: string; text: string }>;
  correctStreak: number;
  passage: string;
  submissionId: string | null;
  paperQuestionId: string | null;
}

type Phase = 'answering' | 'feedback';

export default function MyMistakesPracticePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get('name') ?? '';
  const studentId = params.get('studentId') ?? '';
  /**
   * 交卷后的必经环节（2026-08-24）。
   *
   * 错题本 871 条、销账 0 条 —— 规则是「隔天再做对才销」，零销账说明
   * 根本没人走完这条路。原因和生词自测冷了两周一模一样：它不在任何
   * 必经路径上。现在把它挂进交卷仪式（交卷 → 生词自测 → 错题重练 →
   * 成绩页），并遵守同一套规矩：
   *   · 限量 —— 交卷后只练 3 题，学生已经答了半小时卷子
   *   · 没有待练的就立刻放行，绝不挡路
   */
  const afterSubmit = params.get('after') === 'submit';
  const then = params.get('then') ?? '';
  const AFTER_SUBMIT_LIMIT = 3;
  const [items, setItems] = useState<PracticeItem[] | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  const [picked, setPicked] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);
  /** reveal 翻卡题：是否已自评（自评后按钮换成「下一题」） */
  const [selfMarked, setSelfMarked] = useState(false);
  const [serverNote, setServerNote] = useState<{ correctStreak: number; resolved: boolean } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    if (!name) return;
    api
      .mistakePracticeQueue({ name, studentId: studentId || undefined })
      .then((r: any) => {
        const all: PracticeItem[] = r.items ?? [];
        // 交卷后这一趟没有待练的 → 立刻放行去成绩页，不让学生多点一下
        if (afterSubmit && all.length === 0 && then) {
          navigate(then, { replace: true });
          return;
        }
        setItems(afterSubmit ? all.slice(0, AFTER_SUBMIT_LIMIT) : all);
        setRemaining(r.remaining ?? 0);
        track('mistake_practice', name, studentId);
      })
      // 队列取不到就直接放行 —— 错题练习绝不能挡住学生看成绩
      .catch((e: any) => {
        if (afterSubmit && then) navigate(then, { replace: true });
        else setError(String(e?.message ?? e));
      });
  }, [name, studentId, afterSubmit, then, navigate]);

  const item = items && idx < items.length ? items[idx] : null;
  const qs = `name=${encodeURIComponent(name)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`;

  const report = (correct: boolean) => {
    setWasCorrect(correct);
    if (correct) setCorrectCount((n) => n + 1);
    setPhase('feedback');
    setServerNote(null);
    if (!item) return;
    // 上报失败静默 —— 练习体验不能被网络问题打断，下次队列会重出这道
    void api
      .mistakePracticeResult({ studentName: name, studentId: studentId || undefined, id: item.id, correct })
      .then((r: any) => { if (r?.ok) setServerNote({ correctStreak: r.correctStreak, resolved: r.resolved }); })
      .catch(() => {});
  };

  const choose = (value: string) => {
    if (!item || phase !== 'answering') return;
    setPicked(value);
    report(value.trim().toUpperCase() === item.correctAnswer.trim().toUpperCase());
  };

  const next = () => {
    setIdx((i) => i + 1);
    setPhase('answering');
    setPicked(null);
    setServerNote(null);
    setSelfMarked(false);
  };

  const progressPct = useMemo(
    () => (items && items.length ? Math.round(((idx + (phase === 'feedback' ? 1 : 0)) / items.length) * 100) : 0),
    [items, idx, phase],
  );

  if (!name) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center text-gray-600">
          <div className="mb-3">请从错题本进入练习。</div>
          <Link to="/my-history" className="text-blue-600 underline">→ 我的记录</Link>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 px-6 py-12 text-center">
        <div className="text-rose-700 mb-4">⚠️ {error}</div>
        <Link to={`/my-mistakes?${qs}`} className="text-blue-600 underline text-sm">← 返回错题本</Link>
      </div>
    );
  }
  if (!items) {
    return <div className="ui-ios min-h-screen bg-gray-50"><Spinner label="准备练习…" /></div>;
  }

  // 队列为空：今天没有待练的
  if (items.length === 0) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-gray-800 font-semibold mb-1">今天没有要练的错题</div>
          <p className="text-sm text-gray-500 mb-4">练过的题明天会再来一次 —— 隔天做对才算真的会了。</p>
          <Link to={`/my-mistakes?${qs}`} className="text-blue-600 underline text-sm">← 返回错题本</Link>
        </div>
      </div>
    );
  }

  // 练完本轮
  if (!item) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">{correctCount === items.length ? '💯' : '✅'}</div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{correctCount} / {items.length}</div>
          <div className="text-sm text-gray-600 mb-1">本轮答对</div>
          <p className="text-[13px] text-gray-500 mb-5">
            做对的题明天再对一次就自动移出错题本；做错的明天会再出现。
            {remaining > items.length ? `今天还有 ${remaining - items.length} 条可以再练一轮。` : ''}
          </p>
          {afterSubmit && then ? (
            <button
              type="button"
              onClick={() => navigate(then, { replace: true })}
              className="press w-full min-h-[46px] rounded-[12px] bg-blue-600 text-white text-[15px] font-semibold mb-3"
            >
              看今天的卷子 →
            </button>
          ) : remaining > items.length ? (
            <button
              type="button"
              onClick={() => { window.location.reload(); }}
              className="press w-full min-h-[46px] rounded-[12px] bg-gray-900 text-white text-[15px] font-semibold mb-3"
            >
              再练一轮
            </button>
          ) : null}
          <Link to={`/my-mistakes?${qs}`} className="text-blue-600 underline text-sm">← 返回错题本</Link>
        </div>
      </div>
    );
  }

  const isLetterGrid = item.practiceKind === 'letters';
  const correct = wasCorrect;

  return (
    <div className="ui-ios min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-16">
        <div className="flex items-center justify-between">
          <Link to={`/my-mistakes?${qs}`} className="text-sm text-blue-600 hover:underline">← 退出练习</Link>
          <span className="text-[13px] text-gray-500 tabular-nums">{idx + 1} / {items.length}</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        <article className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500">
            {item.passageTitle && <span>《{item.passageTitle}》</span>}
            <span>{item.quizDay} 错过这道</span>
          </div>
          <p className="mt-2 text-[15px] text-gray-900 leading-relaxed">{item.stem}</p>

          {item.passage && (
            <details className="mt-3 rounded-lg bg-gray-50 border">
              <summary className="px-3 py-2 text-[13px] font-semibold text-gray-700 cursor-pointer select-none">
                📄 看原文（先自己想，想不起来再翻）
              </summary>
              <div className="px-3 pb-3 text-[13px] text-gray-700 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                {item.passage}
              </div>
            </details>
          )}

          {/* ── 作答区 ── */}
          {phase === 'answering' && (
            <div className="mt-4">
              {item.practiceKind === 'reveal' ? (
                <>
                  <p className="text-[13px] text-gray-500 mb-3">在心里组织好答案，再翻开对照。</p>
                  <button
                    type="button"
                    onClick={() => setPhase('feedback')}
                    className="press w-full min-h-[46px] rounded-[12px] bg-gray-900 text-white text-[15px] font-semibold"
                  >
                    翻开答案
                  </button>
                </>
              ) : (
                <div className={isLetterGrid ? 'grid grid-cols-4 gap-2' : 'space-y-2'}>
                  {item.options.map((o) => {
                    const val = typeof o === 'string' ? o : o.key;
                    const text = typeof o === 'string' ? o : `${o.key}. ${o.text}`;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => choose(val)}
                        className={`press border rounded-[12px] text-gray-800 bg-white hover:bg-gray-50 ${
                          isLetterGrid
                            ? 'min-h-[46px] text-[16px] font-bold'
                            : 'w-full min-h-[46px] px-4 py-2.5 text-left text-[14px]'
                        }`}
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 反馈区 ── */}
          {phase === 'feedback' && (
            <div className="mt-4 space-y-2 text-[13px]">
              {item.practiceKind !== 'reveal' && (
                <div className={`rounded-lg px-3 py-2.5 border font-semibold text-[14px] ${
                  correct ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {correct ? '✓ 答对了' : `✗ 你选了 ${picked}`}
                  <span className="ml-2 font-normal">正确答案：<b>{item.correctAnswer}</b></span>
                </div>
              )}

              {item.practiceKind === 'reveal' && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                  <div className="text-[11px] text-emerald-700 font-semibold mb-1">
                    {item.answerPoints.length > 1 ? '参考要点' : '参考答案'}
                  </div>
                  {item.answerPoints.length > 1 ? (
                    <ul className="space-y-1">
                      {item.answerPoints.map((pt, i) => (
                        <li key={i} className="flex gap-1.5 text-gray-800">
                          <span className="text-emerald-600 shrink-0">{i + 1}.</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-800 font-medium">{item.answerPoints[0] || item.correctAnswer}</div>
                  )}
                  {item.answerModel && (
                    <div className="mt-2 pt-2 border-t border-emerald-200">
                      <div className="text-[11px] text-emerald-700 font-semibold mb-0.5">范文</div>
                      <div className="text-gray-800 leading-relaxed">{item.answerModel}</div>
                    </div>
                  )}
                </div>
              )}

              {item.explanation && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <div className="text-[11px] text-amber-800 font-bold mb-1">为什么</div>
                  <div className="text-[13.5px] text-gray-900 leading-relaxed">{item.explanation}</div>
                  {item.evidence && (
                    <div className="mt-2 pt-2 border-t border-amber-200 text-[12.5px] text-gray-700 italic leading-relaxed">
                      原文依据：“{item.evidence}”
                    </div>
                  )}
                </div>
              )}

              {item.markerComment && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                  <div className="text-[11px] text-blue-800 font-bold mb-1">老师说</div>
                  <div className="text-[13.5px] text-gray-900 whitespace-pre-wrap leading-relaxed">{item.markerComment}</div>
                </div>
              )}

              {item.myOldAnswer && (
                <div className="text-[12px] text-gray-500">当时你写的：{item.myOldAnswer}</div>
              )}

              {item.practiceKind === 'reveal' && !selfMarked ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setSelfMarked(true); report(false); }}
                    className="press min-h-[46px] rounded-[12px] bg-white border text-[14px] font-semibold text-gray-700"
                  >
                    还没掌握
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelfMarked(true); report(true); }}
                    className="press min-h-[46px] rounded-[12px] bg-gray-900 text-white text-[14px] font-semibold"
                  >
                    我答对了
                  </button>
                </div>
              ) : (
                <>
                  {serverNote?.resolved && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-800 font-semibold">
                      🎉 隔天两次做对 —— 这道题已移出错题本
                    </div>
                  )}
                  {serverNote && !serverNote.resolved && correct && (
                    <div className="text-[12px] text-emerald-700">明天再做对一次，这道题就自动移出错题本。</div>
                  )}
                  <button
                    type="button"
                    onClick={next}
                    className="press w-full min-h-[46px] rounded-[12px] bg-gray-900 text-white text-[15px] font-semibold"
                  >
                    {idx + 1 < items.length ? '下一题' : '看本轮结果'}
                  </button>
                </>
              )}
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
