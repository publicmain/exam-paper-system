import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { findClozeSpan, trimSentence, windowAroundSpan } from '../lib/cloze';
import { flushPending, submitReview } from '../lib/reviewQueue';
import { displayTranslation } from '../lib/dictDisplay';
import { canSpeak, speak } from '../lib/speech';
import { track } from '../lib/track';
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
  /** 词性 / 英文释义 —— 字典里没有就是 null，教学面按 null 隐藏那一行 */
  pos?: string | null;
  definition?: string | null;
  tag: string[];
  state: string;
  reps: number;
  /** P5：这张卡该走首次教学还是复习交互。判据在服务端 first-teaching.ts */
  needsFirstTeaching?: boolean;
  firstTaughtAt?: string | null;
  sourceType?: 'click' | 'wrong_answer' | 'teacher_push';
  addedAt?: string;
}

/**
 * 两档评分（2026-08-24 学生十问修复 #4）。
 *
 * 原来是 Anki 的四档（又忘了/有点难/记得/很简单）—— 那是老手语义，
 * 学生要么全点「记得」，要么手滑点「很简单」把不会的词推到 11+ 天后。
 * 降到两档：判断只剩「想起来了没有」，没有可犹豫的灰度。FSRS 用
 * again/good 两个信号工作得很好；hard/easy 带来的调度增益远小于
 * 学生乱选带来的噪声。后端四档接口原样保留（自测线也在用）。
 */
const RATINGS = [
  { key: 'again', label: '忘了', labelNew: '没记住', sub: 'Forgot', cls: 'bg-rose-600 hover:bg-rose-700' },
  { key: 'good', label: '记得', labelNew: '记住了', sub: 'Got it', cls: 'bg-emerald-600 hover:bg-emerald-700' },
] as const;

/**
 * P5 —— 这张卡走教学还是走复习。
 *
 * 结论由服务端给（`needsFirstTeaching`，判据见 api 的 first-teaching.ts）。
 * 这里的兜底只在字段缺失时生效（旧构建的前端撞上新后端，或反过来），
 * 用的是同一条式子，不构成第二套判据。
 */
function isTeachingCard(card: Card): boolean {
  if (typeof card.needsFirstTeaching === 'boolean') return card.needsFirstTeaching;
  return card.firstTaughtAt == null && (card.reps ?? 0) === 0;
}

/**
 * 显示答案后到可以评分之间的最短间隔（2026-08-25 首日实测后加）。
 *
 * 上线首日真机数据：每张卡停留中位数 5.1 秒 → 1.6 秒，21 次评分
 * 100%「记住了」，一名学生 25 秒刷完 10 张、最后四张不到 1 秒。
 * 两档评分把绿色按钮固定在右边，闭眼连点的成本比四档时代更低 ——
 * 复习退化成了「下一张」按钮。
 *
 * 这 1.5 秒不是惩罚，是**逼着眼睛落到释义上**。真会的学生也不亏：
 * 读一眼自己认识的词本来就要一秒。服务端还有一道同阈值的兜底
 * （MIN_HONEST_DWELL_MS），所以旧缓存前端也绕不过去。
 */
const MIN_DWELL_MS = 1500;

/** 卡片来源行（修复 #6）：回答「这词怎么进我本子的」。 */
const SOURCE_TEXT: Record<string, string> = {
  click: '你阅读时自己添加的',
  wrong_answer: '答错自动收录',
  teacher_push: '随当天文章推送',
};

function sourceLine(card: Card): string | null {
  // 每周主线词也是 teacher_push，但来路不同 —— 按标题区分文案
  const how = card.sourcePassageTitle?.startsWith('每周主线')
    ? '本周主线词'
    : card.sourceType
      ? SOURCE_TEXT[card.sourceType]
      : null;
  if (!how) return null;
  const d = card.addedAt ? new Date(card.addedAt) : null;
  const when = d && !Number.isNaN(d.getTime()) ? `${d.getMonth() + 1}/${d.getDate()} ` : '';
  return `${when}${how}`;
}

export default function MyVocabReviewPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get('name') ?? '';
  const studentId = params.get('studentId') ?? '';
  /** 从交卷流程跳进来的：复习完要继续去成绩页 */
  const afterSubmit = params.get('after') === 'submit';

  const [cards, setCards] = useState<Card[] | null>(null);
  /** 到期队列已空（只在学生主动进来时用 —— 交卷流程直接放行） */
  const [emptyQueue, setEmptyQueue] = useState(false);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  /** 答案显示后 MIN_DWELL_MS 内不接受评分 —— 掐掉无脑连点 */
  const [canRate, setCanRate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [shownAt, setShownAt] = useState<number>(() => Date.now());
  /** 上一张的评分回执（修复 #4/#7）：间隔反馈 + 撤销入口。
   *  queued = 弱网已暂存（撤销不可用 —— 服务端还没有这条记录）。 */
  const [lastRated, setLastRated] = useState<{
    headword: string;
    idx: number;
    feedback: string;
    canUndo: boolean;
  } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  /** 教学卡的「下一个」失败了 —— 什么都没存，提示学生再点一次 */
  const [teachError, setTeachError] = useState(false);
  /** 正在处理的教学卡下标（双击去重，不依赖渲染时机） */
  const teachingRef = useRef<number | null>(null);

  // 上次弱网攒下的评分，进页面先补传（fire-and-forget，失败留队）
  useEffect(() => { void flushPending(); }, []);

  // 最小停留计时：每次翻面 / 换卡都重新计。撤销回上一张时 revealed 会
  // 被重新设为 true，idx 也变了，所以两个依赖都要在。
  useEffect(() => {
    if (!revealed) {
      setCanRate(false);
      return;
    }
    setCanRate(false);
    const t = setTimeout(() => setCanRate(true), MIN_DWELL_MS);
    return () => clearTimeout(t);
  }, [revealed, idx]);

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
        // 没有要复习的：
        //   · 交卷流程（被寄生在必经路径上）→ 直接放行，绝不打扰
        //   · 学生**主动**点进来的 → 他是专门来背词的，把人踢走等于
        //     告诉他「今天不用学了」。这时给一个「提前学」的选择：
        //     队列空只说明到期的都还完了，本子里通常还压着几百个从没
        //     碰过的词（生产库 2798 个）。
        if (list.length === 0) {
          if (afterSubmit) {
            navigate(historyUrl, { replace: true });
          } else {
            setCards([]);
            setEmptyQueue(true);
          }
          return;
        }
        // 埋点盲区修复（研究性分析 #0）：这个页面此前没有任何 kind ——
        // 交卷后链路的触达从未被统计，漏斗数据一直缺翻卡这一环。
        track('vocab_review', name, studentId);
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
        // P3 退出恢复：从服务端拿断点定位（换设备/重新登录也在）。
        // 越界由 clampCursor 语义兜底 —— 拿不到就从头翻，绝不卡死。
        void api
          .lessonToday(name, studentId || undefined)
          .then((t: any) => {
            const c = Number(t?.vocabCursor);
            if (!cancelled && Number.isInteger(c) && c > 0 && c < list.length) {
              setIdx(c);
            }
          })
          .catch(() => { /* 拿不到断点就从头翻，不打扰学生 */ });
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
      // 最小停留未到 —— 按钮本就是禁用的，这里挡住键盘/读屏等其它触发路径
      if (!canRate) return;
      const card = cards[idx];
      setBusy(true);
      // submitReview：失败自动进 localStorage 队列，下次打开词汇页补传
      //（修复 #10 —— 原来 catch 静默吞掉，学生的复习凭空消失）。
      const r = await submitReview({
        studentName: name,
        studentId: studentId || undefined,
        headword: card.headword,
        rating,
        elapsedMs: Math.min(Date.now() - shownAt, 600_000),
      });
      // 间隔反馈（修复 #7）：让学生看见「这个词被推远了多少」——
      // 没有它，反复出现的词只会传递「我在原地踏步」。
      let feedback: string;
      let canUndo = false;
      if ('needsScan' in r && r.needsScan) {
        // 没有当天的学生凭证 —— 复习没被记录。说清楚怎么办，
        // 否则学生会以为背了却没算数（2026-08-25 身份校验上线）。
        feedback = '没记上 · 今天还没扫码，扫一下再背就能存下来';
      } else if ('queued' in r && r.queued) {
        feedback = '网络不稳，已暂存稍后补传';
      } else if ((r as { tooFast?: boolean }).tooFast) {
        // 服务端兜底判定这次太快 —— 调度没动，这张卡下次还会来。
        // 说清楚原因，不然学生只会觉得系统吞了他的操作。
        feedback = '太快了，这次不算 · 它还会再来';
      } else {
        const ok = r as { intervalDays: number; state: string };
        canUndo = true;
        if (rating === 'again') feedback = '待会儿再见';
        else if (ok.state === 'known') feedback = `🎓 已掌握，${ok.intervalDays} 天内不再打扰`;
        else feedback = ok.intervalDays >= 1 ? `${ok.intervalDays} 天后再见` : '明天再见';
      }
      setLastRated({ headword: card.headword, idx, feedback, canUndo });
      setBusy(false);
      setDone((d) => d + 1);
      if (idx + 1 >= cards.length) setIdx(cards.length); // → 完成页
      else {
        setIdx((i) => {
        const next = i + 1;
        // P3：上报断点（best-effort —— 失败不打扰学生，下次翻卡
        // 最坏从上一个已上报的位置继续）
        void api.lessonVocabCursor(name, next, studentId || undefined).catch(() => {});
        return next;
      });
        setRevealed(false);
        setShownAt(Date.now());
      }
    },
    [cards, idx, busy, canRate, name, studentId, shownAt],
  );

  /**
   * P5 —— 首次教学卡的「下一个」。
   *
   * 与 rate() **刻意不共用**：这条路不评分、不写复习流水、不动 FSRS，
   * 也不产生任何成绩。它只做两件事 —— 标记「这个词教过了」，推进断点。
   *
   * 标记失败不拦学生（网络问题不该卡在背词页）。失败的后果是安全的：
   * 这个词明天再教一次，绝不会被错标成已教。
   */
  const teachNext = useCallback(async () => {
    if (!cards || busy) return;
    // 双击去重：同一张卡只处理一次。busy 在网络往返期间挡住第二次点击，
    // 但接口极快返回时 busy 可能已经放开而 idx 还没重渲染 —— 那一瞬间的
    // 第二次点击会拿着旧闭包再推一格，中间那张卡就被跳过了（从未教过，
    // 而 cursor 已经越过它）。用 ref 记住正在处理的下标，不依赖渲染时机。
    if (teachingRef.current === idx) return;
    teachingRef.current = idx;

    const card = cards[idx];
    setBusy(true);
    setTeachError(false);
    try {
      // **一次调用**：服务端在事务里标记「教过」+ 单调推进断点。
      // 分两步打会留下「cursor 前进了但 firstTaughtAt 没写上」的窗口，
      // 那会把 stage 永久锁死在 vocab_learn（见 lesson.service 注释）。
      await api.lessonVocabTaught({
        studentName: name,
        studentId: studentId || undefined,
        headword: card.headword,
        cursor: idx + 1,
      });
    } catch {
      // 服务端什么都没写（事务整笔回滚）。**这里绝不能往前走** ——
      // 往前走等于页面在撒谎：进度条动了、完成页出来了，而库里这张卡
      // 从没被教过。让学生再点一次，是唯一诚实的处理。
      teachingRef.current = null;
      setBusy(false);
      setTeachError(true);
      return;
    }
    setBusy(false);
    setDone((d) => d + 1);
    // 教学不产生评分回执，把上一张的回执收掉，教学面绝不出现「撤销」
    setLastRated(null);
    if (idx + 1 >= cards.length) {
      setIdx(cards.length);
    } else {
      setIdx(idx + 1);
      setRevealed(false);
      setShownAt(Date.now());
    }
  }, [cards, idx, busy, name, studentId]);

  /** 撤销上一张（修复 #4）：服务端从快照精确还原，前端跳回那张卡重评。 */
  const undo = useCallback(async () => {
    if (!lastRated?.canUndo || undoBusy) return;
    setUndoBusy(true);
    try {
      await api.vocabReviewUndo({
        studentName: name,
        studentId: studentId || undefined,
        headword: lastRated.headword,
      });
      setIdx(lastRated.idx);
      setRevealed(true);
      setDone((d) => Math.max(0, d - 1));
      setLastRated(null);
      setShownAt(Date.now());
    } catch {
      // 撤销窗口过期 / 网络失败：把入口收掉，别让学生反复点一个坏按钮
      setLastRated(null);
    } finally {
      setUndoBusy(false);
    }
  }, [lastRated, undoBusy, name, studentId]);

  if (!cards) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Spinner label="准备今日生词…" />
      </div>
    );
  }

  // 到期的都还完了 —— 学生主动进来才会看到这一屏（交卷流程直接放行）。
  // 不能只说「今天没有了」就把人赶走：他是专门来背词的，而本子里通常
  // 还压着大量从没碰过的词。给一条继续学的路。
  if (emptyQueue) {
    const qs =
      `name=${encodeURIComponent(name)}` +
      (studentId ? `&studentId=${encodeURIComponent(studentId)}` : '');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="bg-white rounded-2xl border shadow-sm p-7 max-w-sm w-full text-center">
          <div className="text-4xl mb-2">✅</div>
          <div className="text-xl font-bold text-gray-900">今天到期的都复习完了</div>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            间隔重复会在你快忘记时把它们送回来。想继续的话，可以做一轮自测 ——
            自测不限于到期的词，随时都能练。
          </p>
          <Link
            to={`/my-vocab/quiz?${qs}`}
            className="press mt-5 block w-full py-3 rounded-xl bg-blue-600 text-white font-semibold"
          >
            🎯 做一轮自测
          </Link>
          <Link to={`/my-vocab?${qs}`} className="block mt-3 text-sm text-blue-600 underline">
            ← 返回生词本
          </Link>
        </div>
      </div>
    );
  }

  // 全部复习完
  if (idx >= cards.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="bg-white rounded-2xl border shadow-sm p-7 max-w-sm w-full text-center">
          {lastRated && (
            <div className="mb-3 flex items-center justify-center gap-2 text-[12px] text-gray-500">
              <span>
                {lastRated.headword} · {lastRated.feedback}
              </span>
              {lastRated.canUndo && (
                <button
                  type="button"
                  onClick={undo}
                  disabled={undoBusy}
                  className="text-blue-600 underline disabled:opacity-50"
                >
                  撤销
                </button>
              )}
            </div>
          )}
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-xl font-bold text-gray-900">今日生词看完了</div>
          <div className="text-sm text-gray-600 mt-1.5">
            过了 <strong>{done}</strong> 个词。间隔重复会在你快忘记时再把它们送回来。
          </div>
          {/* P8 —— 学完就去考，**唯一的主要下一步**。
              原来这个入口只在「交卷流程 + 卡片 ≥4」时才出现，学生主动
              来背完词就没有任何通往正式测试的路；「趁热考一遍」也读不出
              这是有成绩的正式测试还是随便练练。 */}
          <button
            type="button"
            data-testid="review-next"
            onClick={() =>
              navigate(
                `/my-vocab/quiz?name=${encodeURIComponent(name)}` +
                  (studentId ? `&studentId=${encodeURIComponent(studentId)}` : '') +
                  (afterSubmit ? `&after=submit&then=${encodeURIComponent(historyUrl)}` : ''),
                { replace: true },
              )
            }
            className="mt-5 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold touch-manipulation"
          >
            去考今天的单词 →
          </button>
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
  const teaching = isTeachingCard(card);
  const cloze = teaching ? null : clozeSentence(card.contextSentence, card.surfaceForm);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-md mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-600">
            今日生词 <strong>{idx + 1}</strong> / {cards.length}
            {/* 第一次见的词标出来。短文层的词表是老师推的，学生此前没
                接触过 —— 不标的话他会以为自己忘了，其实只是没学过。 */}
            {teaching && (
              <span className="ml-2 text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                第一次学
              </span>
            )}
          </div>
          {/* 「跳过」只导航、不写库，所以它本身不会造成 cursor 与
              firstTaughtAt 不一致。但首次教学卡上只该有「发音」和
              「下一个」两个动作 —— 一个第一次见到这个词的学生，不需要
              在「学」和「不学」之间做选择。复习卡保留原样。 */}
          {!teaching && (
          <button
            type="button"
            // 交卷流程跳过→成绩页（他来的目的）；主动来练的跳过→回生词本，
            // 被扔去成绩页会莫名其妙
            onClick={() =>
              navigate(
                afterSubmit
                  ? historyUrl
                  : `/my-vocab?name=${encodeURIComponent(name)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`,
                { replace: true },
              )
            }
            className="hit press text-[14px] text-gray-500 px-2 -mr-2 rounded-lg hover:text-gray-600"
          >跳过
          </button>
          )}
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${(idx / cards.length) * 100}%` }}
          />
        </div>

        {/* 上一张的回执：间隔反馈 + 撤销（误触防线）。不挡内容，一行即可。
            **教学面一律不显示** —— 首次教学不评分，也就没有可撤销的东西，
            而「撤销」出现在教学卡上只会让学生以为刚才那一下被记了分。 */}
        {lastRated && !teaching && (
          <div className="mb-3 flex items-center justify-between text-[12px] text-gray-500 bg-white border rounded-lg px-3 py-1.5">
            <span className="truncate">
              上一张 <span className="font-semibold text-gray-700">{lastRated.headword}</span> · {lastRated.feedback}
            </span>
            {lastRated.canUndo && (
              <button
                type="button"
                onClick={undo}
                disabled={undoBusy}
                className="hit shrink-0 ml-2 text-blue-600 underline disabled:opacity-50"
              >
                撤销
              </button>
            )}
          </div>
        )}

        {teaching ? (
          /* ── 首次教学卡（P5）──
             这个词学生从没见过。第一面就把答案给全：词、音标、词性、
             释义、他刚读过那篇文章里的原句。**不挖空、不要求猜、不评分**
             —— 让人猜一个从没教过的词，得到的不是学习而是挫败，那次
             「不认识」还会被 FSRS 当成真实信号写进调度。
             字段缺失一律隐藏，绝不编造音标或例句。 */
          <div className="bg-white rounded-2xl border shadow-sm p-5 min-h-[300px] flex flex-col">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold text-gray-900">{card.headword}</span>
              {canSpeak() && (
                <button
                  type="button"
                  onClick={() => speak(card.headword)}
                  aria-label={`朗读 ${card.headword}`}
                  className="hit press text-xl -my-1 px-1 rounded hover:bg-gray-100"
                >
                  🔊
                </button>
              )}
              {card.phonetic && <span className="text-sm text-gray-500">/{card.phonetic}/</span>}
              {card.pos && (
                <span className="text-[12px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {card.pos}
                </span>
              )}
              {card.tag.includes('ielts') && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">
                  雅思
                </span>
              )}
            </div>

            {displayTranslation(card.translation).trim() && (
              <div className="mt-3 text-[16px] text-gray-800 whitespace-pre-wrap">
                {displayTranslation(card.translation)}
              </div>
            )}
            {card.definition && (
              <div className="mt-1.5 text-[13px] text-gray-500 leading-relaxed">
                {card.definition}
              </div>
            )}

            {card.contextSentence?.trim() && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-[11px] text-gray-400 mb-1">你读到的这句话</div>
                <div className="text-[15px] leading-relaxed text-gray-800">
                  {card.contextSentence}
                </div>
                {card.sourcePassageTitle && (
                  <div className="text-[11px] text-gray-400 mt-2">
                    来自《{card.sourcePassageTitle}》
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto pt-5">
              <div
                className={`text-[12px] text-center mb-2 ${
                  teachError ? 'text-rose-600' : 'text-gray-400'
                }`}
                aria-live="polite"
              >
                {teachError
                  ? '没存上，再点一次 · 这一下没有被记录'
                  : '第一次见这个词，先认识它就够了 —— 待会儿再考'}
              </div>
              <button
                type="button"
                data-testid="teach-next"
                disabled={busy}
                onClick={teachNext}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base disabled:opacity-40 touch-manipulation"
              >
                下一个 · Next
              </button>
            </div>
          </div>
        ) : (
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
                  {/* 发音（研究性分析 #1）：只认识字形=学了半个词，听力口试上等于没学 */}
                  {canSpeak() && (
                    <button
                      type="button"
                      onClick={() => speak(card.headword)}
                      aria-label={`朗读 ${card.headword}`}
                      className="hit press text-lg -my-1 px-1 rounded hover:bg-gray-100"
                    >
                      🔊
                    </button>
                  )}
                  {card.phonetic && <span className="text-sm text-gray-500">/{card.phonetic}/</span>}
                  {card.tag.includes('ielts') && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">
                      雅思
                    </span>
                  )}
                </div>
                {/* 释义放宽到 6 行（修复 #5）：一词多义时前两行可能根本
                    不含文中义；[计]/[医] 等专业义项行滤掉（实测 borrow
                    漏出「[计] 借位」）。 */}
                <div className="mt-1.5 text-[15px] text-gray-800 whitespace-pre-wrap">
                  {displayTranslation(card.translation)}
                </div>
                {sourceLine(card) && (
                  <div className="mt-2 text-[11px] text-gray-400">{sourceLine(card)}</div>
                )}
              </div>
              <div className="mt-auto pt-4">
                {/* 为什么按钮暂时按不了 —— 不说清楚学生会以为系统卡了。
                    1.5 秒后这行消失、按钮亮起。 */}
                <div
                  className={`text-[12px] text-center mb-2 transition-opacity ${
                    canRate ? 'opacity-0' : 'text-amber-600 opacity-100'
                  }`}
                  aria-live="polite"
                >
                  {canRate ? ' ' : '先读一遍上面的意思…'}
                </div>
                <div className="grid grid-cols-2 gap-2">
                {RATINGS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    disabled={busy || !canRate}
                    onClick={() => rate(r.key)}
                    className={`py-3.5 rounded-xl text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation ${r.cls}`}
                  >
                    {(card.reps ?? 0) === 0 ? r.labelNew : r.label}
                    <span className="block text-[11px] font-normal opacity-80">{r.sub}</span>
                  </button>
                ))}
                </div>
              </div>
            </>
          )}
        </div>
        )}
      </main>
    </div>
  );
}

/**
 * 把原句里的该词挖成下划线 —— 先回忆，再看答案。
 *
 * 定位走 findClozeSpan（与自测出题同一套规格）。原来的 indexOf 有两个
 * 真数据坏例（2026-08-24 审计，占 26%）：
 *   · agree ⊂ agreed → 挖出「＿＿＿d」，残缺又漏答案
 *   · 例句里根本没有该词 → 原样显示整句，答案直接可见
 * 定位不到时不再假装挖空 —— 退化成学习卡：句子原样给，词高亮不出现
 * （句里没有它），学生看完释义自评即可。
 */
function clozeSentence(sentence: string, surface: string) {
  if (!sentence) return <span className="text-gray-400">（无原句）</span>;
  const span = surface ? findClozeSpan(sentence, surface) : null;
  // 定位不到 → 学习卡：句子原样给（长句截断,修复 #5），不假装挖空
  if (!span) return trimSentence(sentence);
  // 长句围绕挖空处开窗（修复 #5）：300 字符的学术长句是墙不是提示
  const win = windowAroundSpan(sentence, span, 180);
  return (
    <>
      {win.text.slice(0, win.span.start)}
      <span className="inline-block min-w-[64px] border-b-2 border-amber-400 text-center text-amber-600 font-semibold">
        ?
      </span>
      {win.text.slice(win.span.end)}
    </>
  );
}
