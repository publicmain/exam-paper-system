import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Spinner } from '../components/AsyncState';

/**
 * 今日生词复习（生词本 P3）。
 *
 * 设计要点（docs/PRD/vocabulary-notebook.md §1.2 / §5）：
 * - **寄生在交卷后**：学生刚答完 30 分钟的题，这里只给 5 张卡、约 2 分钟。
 *   不新增任何"每天记得来打卡"的自律要求 —— 学情数据显示 64% 的学生
 *   正确率低于 50%，靠自觉的功能只会被最需要的人无视。
 * - **卡片必须带原句**：挖空他自己读过的那一句，这是与百词斩类产品
 *   最大的体验差异。
 * - 没有待复习的词时**立刻放行**，绝不挡在成绩页前面。
 */

interface Card {
  headword: string;
  surfaceForm: string;
  contextSentence: string;
  sourcePassageTitle: string | null;
  phonetic: string | null;
  translation: string;
  tag: string[];
  state: string;
  reps: number;
}

const RATINGS = [
  { key: 'again', label: '又忘了', sub: 'Again', cls: 'bg-rose-600 hover:bg-rose-700' },
  { key: 'hard', label: '有点难', sub: 'Hard', cls: 'bg-amber-500 hover:bg-amber-600' },
  { key: 'good', label: '记得', sub: 'Good', cls: 'bg-emerald-600 hover:bg-emerald-700' },
  { key: 'easy', label: '很简单', sub: 'Easy', cls: 'bg-blue-600 hover:bg-blue-700' },
] as const;

export default function MyVocabReviewPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get('name') ?? '';
  const studentId = params.get('studentId') ?? '';
  /** 从交卷流程跳进来的：复习完要继续去成绩页 */
  const afterSubmit = params.get('after') === 'submit';

  const [cards, setCards] = useState<Card[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [shownAt, setShownAt] = useState<number>(() => Date.now());

  // 2026-08-14 —— 交卷流程会带 then=<逐题详情页>，复习完直接落过去
  // （学生要的即时反馈）。只接受本域 /my-history 前缀，防开放跳转。
  const thenParam = params.get('then') ?? '';
  const historyUrl = thenParam.startsWith('/my-history')
    ? thenParam
    : `/my-history?name=${encodeURIComponent(name)}${
        studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''
      }`;

  useEffect(() => {
    if (!name) {
      navigate(historyUrl, { replace: true });
      return;
    }
    let cancelled = false;
    // ⚠️ 必须有超时。这个页面现在挡在**每个学生交卷之后**，而 Railway 容器
    // 冷启动实测可达 15 秒（V4 真机验证时遇到过）。周一早上 8:30 的第一个
    // 请求很可能就是冷的 —— 学生刚交完卷却卡在转圈，会以为交卷失败。
    // 5 秒拿不到就直接放行去看成绩：复习是锦上添花，成绩才是他来的目的。
    Promise.race([
      // 不传 limit —— 让服务端按这个学生的实际积压决定给几张（见
      // vocab-review.service 的 reviewBatchSize）。写死 5 会绕过那套
      // 动态配额：生产数据里积压最多的学生有 219 词，每次只还 5 张
      // 永远追不上，而这正是 2798 个词卡在「从没碰过」的原因之一。
      api.vocabDue({ name, studentId: studentId || undefined }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ])
      .then((r: any) => {
        if (cancelled) return;
        const list: Card[] = r?.cards ?? [];
        // 没有要复习的 → 直接放行，不打扰
        if (list.length === 0) {
          navigate(historyUrl, { replace: true });
          return;
        }
        // 2026-08-14 调研后改：交卷后的必经环节从翻卡换成**客观自测**。
        // 翻卡自评的判断权在学生手里（秒选「记得」两秒钟），而自测选错
        // 就是错、答题即回写 FSRS —— 信号真实调度才准。
        //
        // 2026-08-24 补一条前置：**没学过的新词先翻卡，不直接考**。
        //
        // 短文层（雅思轻量 / O-Level 基础）的词表是建场时推进来的，
        // 学生从没见过；而 StudentWord.due 默认就是 now()，一进本子就
        // 算到期、立刻进自测题库。直接考的结果是全错 —— 更糟的是答错
        // 会回写 FSRS，把这批词标成「困难」，往后天天来烦他。
        //
        // 判据是 reps===0（一次都没复习过）。有新词就先过翻卡（卡片正面
        // 是词、背面是释义 + 他刚读过那篇文章里的原句），学生自己点开看，
        // 看完再考。都是老词就维持直接自测。
        const unseen = list.filter((c) => (c.reps ?? 0) === 0);
        if (afterSubmit && unseen.length > 0) {
          setCards(list);
          return;
        }
        // 可考词不足 4 个时出不了像样的选择题，退回翻卡。
        if (afterSubmit && list.length >= 4) {
          navigate(
            `/my-vocab/quiz?name=${encodeURIComponent(name)}` +
              (studentId ? `&studentId=${encodeURIComponent(studentId)}` : '') +
              `&after=submit&then=${encodeURIComponent(historyUrl)}`,
            { replace: true },
          );
          return;
        }
        setCards(list);
      })
      .catch(() => {
        // 超时或生词本不可用，绝不能挡住看成绩
        if (!cancelled) navigate(historyUrl, { replace: true });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, studentId]);

  const rate = useCallback(
    async (rating: string) => {
      if (!cards || busy) return;
      const card = cards[idx];
      setBusy(true);
      try {
        await api.vocabReview({
          studentName: name,
          studentId: studentId || undefined,
          headword: card.headword,
          rating,
          elapsedMs: Math.min(Date.now() - shownAt, 600_000),
        });
      } catch {
        /* 评分失败不阻断流程：下次到期时还会再出现 */
      } finally {
        setBusy(false);
        setDone((d) => d + 1);
        if (idx + 1 >= cards.length) setIdx(cards.length); // → 完成页
        else {
          setIdx((i) => i + 1);
          setRevealed(false);
          setShownAt(Date.now());
        }
      }
    },
    [cards, idx, busy, name, studentId, shownAt],
  );

  if (!cards) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Spinner label="准备今日生词…" />
      </div>
    );
  }

  // 全部复习完
  if (idx >= cards.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="bg-white rounded-2xl border shadow-sm p-7 max-w-sm w-full text-center">
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-xl font-bold text-gray-900">今日生词看完了</div>
          <div className="text-sm text-gray-600 mt-1.5">
            过了 <strong>{done}</strong> 个词。间隔重复会在你快忘记时再把它们送回来。
          </div>
          {/* 先背再考（2026-08-24）。刚翻完卡片就趁热考一遍 —— 这是记
              得住的关键一步，也让 FSRS 拿到真实信号（翻卡的「我记得」是
              自评，自测选错就是错）。学生可以跳过直接看成绩，不强制。 */}
          {afterSubmit && cards.length >= 4 && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/my-vocab/quiz?name=${encodeURIComponent(name)}` +
                    (studentId ? `&studentId=${encodeURIComponent(studentId)}` : '') +
                    `&after=submit&then=${encodeURIComponent(historyUrl)}`,
                  { replace: true },
                )
              }
              className="mt-5 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold touch-manipulation"
            >
              趁热考一遍 →
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(historyUrl, { replace: true })}
            className={`w-full py-3 rounded-xl font-semibold touch-manipulation ${
              afterSubmit && cards.length >= 4
                ? 'mt-2 bg-white border text-gray-700 hover:bg-gray-50'
                : 'mt-5 bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {afterSubmit ? '查看我的成绩 →' : '返回我的记录 →'}
          </button>
        </div>
      </div>
    );
  }

  const card = cards[idx];
  const cloze = clozeSentence(card.contextSentence, card.surfaceForm);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-md mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-600">
            今日生词 <strong>{idx + 1}</strong> / {cards.length}
            {/* 第一次见的词标出来。短文层的词表是老师推的，学生此前没
                接触过 —— 不标的话他会以为自己忘了，其实只是没学过。 */}
            {(card.reps ?? 0) === 0 && (
              <span className="ml-2 text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                新词
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(historyUrl, { replace: true })}
            className="hit press text-[14px] text-gray-500 px-2 -mr-2 rounded-lg hover:text-gray-600"
          >跳过
          </button>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${(idx / cards.length) * 100}%` }}
          />
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-5 min-h-[300px] flex flex-col">
          {/* 正面：原句挖空 —— 先想，再翻面 */}
          <div className="text-[15px] leading-relaxed text-gray-800">{cloze}</div>
          {card.sourcePassageTitle && (
            <div className="text-[11px] text-gray-400 mt-2">来自《{card.sourcePassageTitle}》</div>
          )}

          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-auto w-full py-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-base touch-manipulation"
            >
              显示答案 · Show
            </button>
          ) : (
            <>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-gray-900">{card.headword}</span>
                  {card.phonetic && <span className="text-sm text-gray-500">/{card.phonetic}/</span>}
                  {card.tag.includes('ielts') && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">
                      雅思
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-[15px] text-gray-800 whitespace-pre-wrap">
                  {card.translation.split('\n').slice(0, 2).join('\n')}
                </div>
              </div>
              <div className="mt-auto pt-4 grid grid-cols-2 gap-2">
                {RATINGS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    disabled={busy}
                    onClick={() => rate(r.key)}
                    className={`py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 touch-manipulation ${r.cls}`}
                  >
                    {r.label}
                    <span className="block text-[11px] font-normal opacity-80">{r.sub}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** 把原句里的该词挖成下划线 —— 先回忆，再看答案。 */
function clozeSentence(sentence: string, surface: string) {
  if (!sentence) return <span className="text-gray-400">（无原句）</span>;
  if (!surface) return sentence;
  const i = sentence.toLowerCase().indexOf(surface.toLowerCase());
  if (i < 0) return sentence;
  return (
    <>
      {sentence.slice(0, i)}
      <span className="inline-block min-w-[64px] border-b-2 border-amber-400 text-center text-amber-600 font-semibold">
        ?
      </span>
      {sentence.slice(i + surface.length)}
    </>
  );
}
