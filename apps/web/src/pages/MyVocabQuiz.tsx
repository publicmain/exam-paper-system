import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { flushPending, submitReview } from '../lib/reviewQueue';
import { canSpeak, speak } from '../lib/speech';
import { track } from '../lib/track';
import { Spinner } from '../components/AsyncState';

/**
 * 生词自测（P5）—— 百词斩 / 多邻国式的客观选择题。
 *
 * 与 P3 翻卡复习的分工：翻卡是「被寄生」在交卷后的两分钟，自评式，
 * 走量；自测是学生**主动点进来**的，客观判分（选错就是选错），
 * FSRS 收到真实信号。两条线写同一个调度（POST /vocab/review）。
 *
 * 交互上抄多邻国抄到的三件事：
 *   1. 一屏一题 + 顶部进度条 —— 永远知道还剩多少；
 *   2. 选完立刻上色反馈（对=绿 错=红并标出正确项），**但不自动跳** ——
 *      「继续」按钮由学生自己点。上周聚光灯自动轮播被老师退回的教训：
 *      节奏必须在学生手里；
 *   3. 答错的题在本轮末尾**再来一次**（只重考、不重复扣 FSRS 分），
 *      多邻国的错题回炉。带着刚看过的答案再做一遍，就是最便宜的巩固。
 *
 * 连胜（streak）由服务端按新加坡时区自然日计算，多邻国同款规则：
 * 今天没做不清昨天的账。
 */

interface QuizQuestion {
  qtype: 'word_to_meaning' | 'meaning_to_word' | 'cloze' | 'spelling';
  headword: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  phonetic: string | null;
  translation: string;
  contextSentence: string | null;
  /** spelling 专用：要拼出的原文 token / 首字母提示 */
  answer?: string;
  hint?: string;
}

/** 拼写判分的归一：大小写、首尾空白、弯撇号都不该算错。 */
function normalizeSpelling(s: string): string {
  return s.trim().toLowerCase().replace(/[’‘]/g, "'");
}

interface QuizPayload {
  student: { id: string; name: string };
  streakDays: number;
  totalWords: number;
  /** 复习过至少一次的词数。0 = 这套题全是没学过的词（修复 #8） */
  seenWords?: number;
  questions: QuizQuestion[];
}

const QTYPE_LABEL: Record<QuizQuestion['qtype'], string> = {
  word_to_meaning: '选出正确的意思',
  meaning_to_word: '选出对应的单词',
  cloze: '这句话里缺的词是——',
  spelling: '把缺的词拼出来——',
};

/** 队列项：retry = 错题回炉，不再写 FSRS。 */
type QueueItem = QuizQuestion & { retry?: boolean };

export default function MyVocabQuizPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get('name') ?? '';
  const studentId = params.get('studentId') ?? '';

  const [payload, setPayload] = useState<QuizPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  /** 拼写题的输入与结果（null=未提交）。next() 时一并复位。 */
  const [typed, setTyped] = useState('');
  const [spellResult, setSpellResult] = useState<boolean | null>(null);
  /** 第一遍答错的词（回炉重做不改变这个名单） */
  const [missed, setMissed] = useState<QuizQuestion[]>([]);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [round, setRound] = useState(0); // 「再练一轮」时 +1 触发重新拉题
  /** 全是没学过的词时的门槛页（修复 #8）：学生明确点过「直接考」才放行 */
  const [proceedAllNew, setProceedAllNew] = useState(false);
  /**
   * P6 —— 正式测试。非 null 表示这一轮是**有成绩的考试**，不是自由练习。
   *
   * 与自测的三点区别（都由这个状态分支出去）：
   * - 作答走 /quiz/attempt/answer，**不写 FSRS**（考试是量一下，不是练一次）
   * - 答错不回炉重考（回炉会让分数失去意义）
   * - 结束时提交一次，成绩落库
   */
  const [formal, setFormal] = useState<{ attemptId: string; total: number } | null>(null);
  /**
   * P8 —— 正式测试**开不出来的原因**。
   *
   * 「阶段还没到」和「生词本里词太少」是两件事，先前都落到同一个
   * 「还出不了题 · 生词本里的词还太少」空态上。学生顺着深链接或旧标签页
   * 进来，看到的解释是错的，也没有一条回到今天该做的事情的路。
   */
  const [blocked, setBlocked] = useState<string | null>(null);
  /** 提交结果（成绩）。有值 = 已交卷。 */
  const [result, setResult] = useState<{ total: number; correct: number; score: number } | null>(null);
  const submittingRef = useRef(false);
  /**
   * 正式测试：这一题的答案**还没存进服务器**。
   *
   * 网络失败时绝不能往下走 —— 往下走等于把学生真的选了的答案记成空白，
   * 交卷时按答错算进成绩。选项保持选中、停在原题、给重试，是唯一诚实的
   * 处理。重试打的是同一个幂等接口（第一次成功持久化的答案为准）。
   */
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  /**
   * RC1.1 —— 正式测试里**这一题的判定以服务端为准**。
   *
   * 人工测试实测：学生选对了却全被标成 ✗。根因是前端拿 `q.correctIndex`
   * 判对错，而正式测试作答前服务端**不下发正确答案**（防作弊，devtools
   * 里能看到），那个字段是 null —— 没有一个选项能"等于正确答案"。
   *
   * 现在：答完之后服务端回执里带这一题的 isCorrect 与 correctIndex
   * （已作答的题才给），前端照着显示。自由练习不走这条路，题目自带答案。
   */
  const [serverJudge, setServerJudge] = useState<{
    index: number; isCorrect: boolean; correctIndex: number | null;
  } | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  // 弱网攒下的评分先补传
  useEffect(() => { void flushPending(); }, []);

  /** 交卷流程跳进来的：完成后主目的地是本场逐题详情（then 参数），
   *  且主按钮从「再练一轮」换成「去看成绩」。只认 /my-history 前缀，
   *  防开放跳转 —— 与 MyVocabReview 同一约定。 */
  const afterSubmit = params.get('after') === 'submit';
  const thenParam = params.get('then') ?? '';
  const backUrl = `/my-vocab?name=${encodeURIComponent(name)}${
    studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''
  }`;
  const historyUrl = thenParam.startsWith('/my-history')
    ? thenParam
    : `/my-history?name=${encodeURIComponent(name)}${
        studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''
      }`;
  /**
   * 交卷流程的下一站（2026-08-24）：生词自测完不再直接去成绩页，中间
   * 插一段错题重练。
   *
   * 为什么插在这里 —— 错题本 871 条、销账 0 条，规则没问题，问题是
   * 重练不在任何必经路径上，跟生词自测冷了两周是同一个病。挂进交卷
   * 仪式后它才有人走。错题页自己会判断「没有待练的就立刻放行」，所以
   * 这里无条件跳过去也不会多挡学生一步。
   *
   * 非交卷流程（学生自己点进来练）不受影响，仍然直接去成绩页。
   */
  /** P8：被阶段挡住时回去的地方 —— 今天的课（那里有唯一的下一步） */
  const lessonUrl = `/my-lesson?name=${encodeURIComponent(name)}${
    studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''
  }`;
  /** P8：正式测试之后的唯一去处 —— 今天的任务总结 */
  const summaryUrl = `/my-lesson/summary?name=${encodeURIComponent(name)}${
    studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''
  }`;
  const nextAfterQuiz = afterSubmit
    ? `/my-mistakes/practice?name=${encodeURIComponent(name)}${
        studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''
      }&after=submit&then=${encodeURIComponent(historyUrl)}`
    : historyUrl;

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    setPayload(null);
    setQueue([]);
    setI(0);
    setChosen(null);
    setServerJudge(null);
    setTyped('');
    setSpellResult(null);
    setMissed([]);
    setFirstTryCorrect(0);
    setFormal(null);
    setBlocked(null);
    setResult(null);
    submittingRef.current = false;
    // P6：先试正式测试。不够格（not_ready / insufficient_items）才退回
    // 自由练习 —— **同一个入口、同一个页面**，不另开一套。
    Promise.resolve()
      .then(() => api.vocabQuizStart({ studentName: name, studentId: studentId || undefined }))
      .then((a: any) => {
        if (cancelled) return;
        const items: any[] = a.items ?? [];
        setFormal({ attemptId: a.attemptId, total: items.length });
        setPayload({ questions: items, seenWords: 1, streakDays: 0, totalWords: items.length } as any);
        track('vocab_practice', name, studentId);
        if (a.status === 'submitted') {
          // 今天已经考过 —— 直接给成绩，不重考
          setResult({ total: a.total, correct: a.correct, score: a.score ?? 0 });
          setFirstTryCorrect(a.correct);
          setQueue([]);
          setI(0);
          return;
        }
        setQueue(items);
        // 恢复：落到第一道没作答的题
        const firstUnanswered = items.findIndex((it) => it.isCorrect == null);
        setI(firstUnanswered < 0 ? items.length : firstUnanswered);
        setFirstTryCorrect(items.filter((it) => it.isCorrect === true).length);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setBlocked(String(e?.body?.code ?? ''));
        // 不够格考试 → 自由练习（老行为原样保留，含 FSRS 回写）
        return api
          .vocabQuiz({ name, studentId: studentId || undefined })
          .then((r: any) => {
            if (cancelled) return;
            setPayload(r);
            track('vocab_practice', name, studentId);
            setQueue(r.questions ?? []);
          })
          .catch((e: any) => {
            if (cancelled) return;
            if (afterSubmit) navigate(historyUrl, { replace: true });
            else setError(String(e?.message ?? e));
          });
      })
      .then(() => undefined)
      .catch(() => { /* 上面已处理 */ });
    return () => {
      cancelled = true;
    };
  }, [name, studentId, round]);

  const q = queue[i] ?? null;
  const total = queue.length;
  const firstRoundTotal = payload?.questions.length ?? 0;

  /**
   * 把服务端回执里的这一题**替换到本地队列上**。
   *
   * S9B0 起，正式测试的未作答题只下发 `index / qtype / prompt / options`
   * —— `headword` / 音标 / 释义 / 原句 / `correctIndex` / `answer` 全是 null，
   * 作答成功的回执里才揭开**这一题**。反馈区要显示的正是这些字段，所以
   * 必须先用回执覆盖本地那份，再去渲染反馈。
   *
   * 只动第 `i` 题：回执里其余的题仍然是遮着的，覆盖上去等于把已经揭开的
   * 那些又抹回 null。
   */
  const adoptServerItem = useCallback((res: any) => {
    const back = (res?.items ?? [])[i];
    if (!back) return null;
    setQueue((qq) => qq.map((item, n) => (n === i ? { ...item, ...back } : item)));
    return back;
  }, [i]);

  const pick = useCallback(
    (idx: number) => {
      if (!q || chosen !== null) return;
      setChosen(idx);
      const correct = idx === q.correctIndex;
      if (formal) {
        // 正式测试：作答落进成绩单，**不写 FSRS、不回炉**。
        // 服务端第一次作答为准，重发是 no-op。
        setSaving(true);
        setSaveFailed(false);
        void api
          .vocabQuizAnswer({
            studentName: name,
            studentId: studentId || undefined,
            index: i,
            optionIndex: idx,
          })
          .then((res: any) => {
            setSaving(false);
            // 服务端说了算 —— 它手里才有正确答案。先把这一题换成回执里的
            // 那份（音标 / 释义 / 原句 / 正确项都在里面），再显示反馈。
            const back = adoptServerItem(res);
            if (typeof back?.isCorrect !== 'boolean') {
              // 回执里没有服务端的判定 —— **不自己编一个**。当成没存上，给重试。
              setSaveFailed(true);
              return;
            }
            setServerJudge({
              index: i,
              isCorrect: back.isCorrect,
              correctIndex: typeof back.correctIndex === 'number' ? back.correctIndex : null,
            });
            if (back.isCorrect) setFirstTryCorrect((c) => c + 1);
          })
          .catch(() => {
            // **不静默记为空答案**：停在原题、选项保持选中、给明确重试。
            setSaving(false);
            setSaveFailed(true);
          });
      } else if (!q.retry) {
        if (correct) setFirstTryCorrect((c) => c + 1);
        else {
          setMissed((m) => [...m, q]);
          // 错题回炉：排到队尾再考一次（只考一次，不无限循环）
          setQueue((qq) => [...qq, { ...q, retry: true }]);
        }
        // 客观结果 → FSRS。fire-and-forget 但**不再静默丢失**（修复 #10）：
        // submitReview 失败自动进 localStorage 队列，下次打开词汇页补传。
        void submitReview({
          studentName: name,
          studentId: studentId || undefined,
          headword: q.headword,
          rating: correct ? 'good' : 'again',
        });
      }
      // 读屏用户把焦点带到反馈区
      setTimeout(() => feedbackRef.current?.focus(), 50);
    },
    [q, chosen, name, studentId, formal, i, adoptServerItem],
  );

  /** 拼写题结算 —— 与 pick() 的副作用完全对齐：第一遍才计分/回炉/写 FSRS。 */
  const settleSpelling = useCallback(
    (correct: boolean) => {
      if (!q || q.qtype !== 'spelling' || spellResult !== null) return;
      // 正式测试里这个 `correct` 是本地比出来的，而本地**没有答案**
      // （`q.answer` 被遮着，恒为 null）—— 它只用来标记「学生已经交了」，
      // 判定一律以服务端回执为准。自由练习那条线才真的用它。
      setSpellResult(correct);
      if (formal) {
        setSaving(true);
        setSaveFailed(false);
        void api
          .vocabQuizAnswer({
            studentName: name,
            studentId: studentId || undefined,
            index: i,
            text: typed,
          })
          .then((res: any) => {
            setSaving(false);
            const back = adoptServerItem(res);
            if (typeof back?.isCorrect !== 'boolean') {
              setSaveFailed(true);
              return;
            }
            setServerJudge({
              index: i,
              isCorrect: back.isCorrect,
              correctIndex: typeof back.correctIndex === 'number' ? back.correctIndex : null,
            });
            if (back.isCorrect) setFirstTryCorrect((c) => c + 1);
          })
          .catch(() => {
            setSaving(false);
            setSaveFailed(true);
          });
      } else if (!q.retry) {
        if (correct) setFirstTryCorrect((c) => c + 1);
        else {
          setMissed((m) => [...m, q]);
          setQueue((qq) => [...qq, { ...q, retry: true }]);
        }
        void submitReview({
          studentName: name,
          studentId: studentId || undefined,
          headword: q.headword,
          rating: correct ? 'good' : 'again',
        });
      }
      setTimeout(() => feedbackRef.current?.focus(), 50);
    },
    [q, spellResult, name, studentId, formal, i, typed, adoptServerItem],
  );

  const next = useCallback(() => {
    setChosen(null);
    setTyped('');
    setSpellResult(null);
    setSaveFailed(false);
    setI((x) => x + 1);
  }, []);

  /** 保存失败后重试。打同一个幂等接口，参数与刚才那一次完全一致。 */
  const retrySave = useCallback(async () => {
    if (!q || !formal || saving) return;
    setSaving(true);
    try {
      const res: any = await api.vocabQuizAnswer({
        studentName: name,
        studentId: studentId || undefined,
        index: i,
        ...(q.qtype === 'spelling' ? { text: typed } : { optionIndex: chosen ?? 0 }),
      });
      const back = adoptServerItem(res);
      if (typeof back?.isCorrect !== 'boolean') {
        // 同 pick()：没有服务端判定就**不编一个**，继续给重试。
        setSaveFailed(true);
        return;
      }
      setSaveFailed(false);
      setServerJudge({
        index: i,
        isCorrect: back.isCorrect,
        correctIndex: typeof back.correctIndex === 'number' ? back.correctIndex : null,
      });
      if (back.isCorrect) setFirstTryCorrect((c) => c + 1);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, [q, formal, saving, name, studentId, i, typed, chosen, adoptServerItem]);

  if (!name) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center text-gray-600">
          <div className="mb-3">请从「我的记录」进入生词自测。</div>
          <Link to="/my-history" className="text-blue-600 underline">→ 我的记录</Link>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 px-6 py-12 text-center">
        <div className="text-rose-700 mb-4">⚠️ {error}</div>
        <Link to={backUrl} className="text-blue-600 underline text-sm">← 返回生词本</Link>
      </div>
    );
  }
  if (!payload) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50">
        <Spinner label="正在出题…" />
      </div>
    );
  }

  // 全是没学过的词（修复 #8）：主页「自测」入口没有先学门槛，轻量层
  // 第一天推进来的 8 个词全是 reps=0 —— 直接考只会全错，还把它们写成
  // FSRS 困难词。给一道明确的岔路口：先去翻卡学（推荐），或坚持要考。
  // 交卷流程不经过这里（MyVocabReview 已保证有新词先翻卡）。
  if (!afterSubmit && !proceedAllNew && firstRoundTotal > 0 && (payload.seenWords ?? 1) === 0) {
    const reviewUrl =
      `/my-vocab/review?name=${encodeURIComponent(name)}` +
      (studentId ? `&studentId=${encodeURIComponent(studentId)}` : '');
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="bg-white rounded-2xl border shadow-sm p-7 max-w-sm w-full text-center">
          <div className="text-4xl mb-2">📖</div>
          <div className="text-xl font-bold text-gray-900">这些词你还没学过</div>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            本子里的词都还没翻过卡。先学一遍（看词义和原句）再考，
            比直接被考全错要有用得多。
          </p>
          <Link
            to={reviewUrl}
            className="press mt-5 block w-full py-3 rounded-[14px] bg-blue-600 text-white font-semibold"
          >
            先学新词 →
          </Link>
          <button
            type="button"
            onClick={() => setProceedAllNew(true)}
            className="mt-3 text-sm text-gray-500 underline"
          >
            我就要直接考
          </button>
        </div>
      </div>
    );
  }

  // 出不了题 —— 但要说对是哪一种「出不了」
  if (firstRoundTotal === 0) {
    // P8：阶段还没轮到单词测试（深链接 / 旧标签页 / 收藏夹进来的）。
    // 这不是「词太少」，学生该回今天的课去做当前那一步。
    const notYet = blocked === 'stage_not_ready';
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div
          className="bg-white rounded-2xl border shadow-sm p-7 max-w-sm w-full text-center"
          data-testid="quiz-blocked"
          data-blocked-reason={notYet ? 'stage_not_ready' : 'too_few_words'}
        >
          <div className="text-4xl mb-2">{notYet ? '📘' : '📭'}</div>
          <div className="text-xl font-bold text-gray-900">
            {notYet ? '还没到考单词的时候' : '还出不了题'}
          </div>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            {notYet ? (
              <>
                今天的课要按顺序走：先读文章、再学新词，学完才考。
                回到今天的课，那里写着你现在该做哪一步。
              </>
            ) : (
              <>
                生词本里的词还太少。考试或复盘时<strong>点不认识的单词</strong>，
                存下的词就会出现在这里变成自测题。
              </>
            )}
          </p>
          <Link
            to={notYet ? lessonUrl : backUrl}
            className="press mt-5 block w-full py-3 rounded-[14px] bg-blue-600 text-white font-semibold"
          >
            {notYet ? '回今天的课 →' : '返回生词本'}
          </Link>
        </div>
      </div>
    );
  }

  // ── 完成页 ──────────────────────────────────────────────
  if (!q) {
    // P6：正式测试走到底 → 提交一次拿成绩。
    // submittingRef 挡住重复触发（完成页会因 state 变化重渲染多次）；
    // 服务端本身也是幂等的，两道防线都要有。
    if (formal && !result && !submittingRef.current) {
      submittingRef.current = true;
      void api
        .vocabQuizSubmit({ studentName: name, studentId: studentId || undefined })
        .then((r: any) => setResult({ total: r.total, correct: r.correct, score: r.score ?? 0 }))
        .catch(() => { submittingRef.current = false; });
    }
    // 正式测试显示**落库的**成绩（改词库也不会变），自由练习仍显示本地统计
    const pct = result
      ? Math.round(result.score)
      : firstRoundTotal
        ? Math.round((firstTryCorrect / firstRoundTotal) * 100)
        : 0;
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-5 py-8">
        <div className="bg-white rounded-2xl border shadow-sm p-7 max-w-sm w-full text-center enter">
          {/* P8 —— 一眼看出这一轮算不算数。自由练习不计入正式成绩，
              但它长得和正式测试一模一样，不标出来学生会以为自己考过了。 */}
          <div
            className={`mb-2 inline-block rounded-full px-3 py-1 text-[12px] ${
              formal
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
            data-testid="quiz-mode-badge"
          >
            {formal ? '正式单词测试 · 计入成绩' : '自由练习 · 不计入正式成绩'}
          </div>
          <div className="text-5xl mb-3">{pct === 100 ? '🏆' : pct >= 60 ? '💪' : '📖'}</div>
          <div className="text-2xl font-bold text-gray-900">
            {result ? result.correct : firstTryCorrect} / {result ? result.total : firstRoundTotal}{' '}
            <span className="text-base font-normal text-gray-500">
              {result ? '答对' : '一次答对'}
            </span>
          </div>
          {/* 正式测试：分数在提交时算一次并落库，这里只是把它读出来 —— 
              之后改词库、改释义，这个数字都不会变。 */}
          {result && (
            <div className="mt-1 text-[15px] font-semibold text-blue-700" data-testid="quiz-score">
              单词测试成绩 {result.score} 分
            </div>
          )}
          {payload.streakDays > 0 && (
            <div className="mt-2 inline-block text-[14px] text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
              🔥 连续学习 {payload.streakDays} 天
            </div>
          )}

          {missed.length > 0 && (
            <div className="mt-5 text-left">
              <div className="text-[13px] font-semibold text-gray-500 mb-2">这几个词还不熟：</div>
              <div className="space-y-2">
                {missed.map((m) => (
                  <div key={m.headword} className="rounded-[12px] bg-rose-50 border border-rose-100 px-3 py-2">
                    <span className="font-bold text-gray-900">{m.headword}</span>
                    {m.phonetic && <span className="text-[12px] text-gray-500 ml-1.5">/{m.phonetic}/</span>}
                    <div className="text-[13px] text-gray-700 mt-0.5">{m.translation}</div>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-gray-400 mt-2">
                答错的词已经安排提前复习，过两天还会再考你。
              </p>
            </div>
          )}

          {formal ? (
            <>
              {/* P8 —— 正式测试交完卷，**唯一的下一步是今天的总结**。 */}
              <Link
                to={summaryUrl}
                data-testid="quiz-next"
                className="press mt-6 block w-full min-h-[48px] leading-[48px] rounded-[14px] bg-blue-600 text-white text-[16px] font-semibold active:bg-blue-700"
              >
                看今天的总结 →
              </Link>
              <div className="mt-3 flex justify-center gap-5 text-[14px]">
                {/* 「再练一轮」是**自由练习**，不会新建正式测试（服务端
                    也挡着：同一任务只有一份 attempt）。写清楚免得学生以为
                    还能再考一次刷分。 */}
                <button type="button" onClick={() => setRound((r) => r + 1)} className="text-gray-500">
                  再练一轮（不计分）
                </button>
                <Link to={backUrl} className="text-blue-600">返回生词本</Link>
              </div>
            </>
          ) : afterSubmit ? (
            <>
              <Link
                to={nextAfterQuiz}
                className="press mt-6 block w-full min-h-[48px] leading-[48px] rounded-[14px] bg-blue-600 text-white text-[16px] font-semibold active:bg-blue-700"
              >
                继续 → 查看答案与成绩
              </Link>
              <div className="mt-3 flex justify-center gap-5 text-[14px]">
                <button type="button" onClick={() => setRound((r) => r + 1)} className="text-gray-500">
                  再练一轮（不计分）
                </button>
                <Link to={backUrl} className="text-blue-600">返回生词本</Link>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setRound((r) => r + 1)}
                className="press mt-6 w-full min-h-[48px] rounded-[14px] bg-blue-600 text-white text-[16px] font-semibold active:bg-blue-700"
              >
                再练一轮（不计分）
              </button>
              <div className="mt-3 flex justify-center gap-5 text-[14px]">
                <Link to={backUrl} className="text-blue-600">返回生词本</Link>
                <Link to={historyUrl} className="text-blue-600">查看成绩</Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── 答题页 ──────────────────────────────────────────────
  const isSpelling = q.qtype === 'spelling';
  /** 学生已经作出选择 / 提交了拼写。**不等于**已经有判定。 */
  const submitted = isSpelling ? spellResult !== null : chosen !== null;
  // 这一题服务端怎么判的（正式测试）。自由练习没有回执，用本地比较。
  const judge = serverJudge?.index === i ? serverJudge : null;
  /**
   * 正式测试：**回执到了才算答完**。
   *
   * 以前点一下就显示对错，靠的是本地拿 `q.correctIndex` 比较 —— 而正式
   * 测试作答前服务端不下发答案，那个字段是 null，比出来的对错是假的
   * （人工测试里表现为「选对了却全被标成 ✗」）。现在没有回执就什么都
   * 不说，宁可让学生多等半秒。
   */
  const answered = formal ? judge != null : submitted;
  /** 已经交出选择、还在等服务端（或等重试）的那一段。 */
  const awaitingServer = Boolean(formal) && submitted && judge == null;
  const correct = judge
    ? judge.isCorrect
    : isSpelling
      ? spellResult === true
      : answered && chosen === q.correctIndex;
  /** 正确项的下标：正式测试作答后由服务端给；自由练习题目自带。 */
  const correctIdx = judge?.correctIndex ?? q.correctIndex;

  return (
    <div className="ui-ios min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-md w-full mx-auto px-4 pt-3 pb-6 flex flex-col flex-1">
        {/* 顶栏：退出 + 进度 + 连胜 */}
        <div className="flex items-center gap-3">
          <Link to={backUrl} aria-label="退出自测" className="hit press text-gray-400 text-xl px-1">✕</Link>
          <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${(i / Math.max(total, 1)) * 100}%` }}
            />
          </div>
          {payload.streakDays > 0 && (
            <span className="text-[13px] text-orange-600 font-semibold shrink-0">🔥{payload.streakDays}</span>
          )}
        </div>

        {/* 题干 */}
        <div className="mt-6">
          <div className="text-[13px] font-semibold text-gray-500">
            {QTYPE_LABEL[q.qtype]}
            {q.retry && <span className="ml-2 text-amber-600">· 错题再试</span>}
            {/* P8 —— 做题当中就要看得出这一轮算不算分。「再练一轮（不计分）」
                进来的页面和正式测试长得一模一样，不标的话学生会以为自己
                正在考试（或者反过来，把正式测试当练习乱点）。 */}
            <span
              className={`ml-2 font-normal ${formal ? 'text-blue-600' : 'text-gray-400'}`}
              data-testid="quiz-taking-mode"
            >
              · {formal ? '计入成绩' : '不计分'}
            </span>
          </div>
          {q.qtype === 'word_to_meaning' ? (
            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <span className="text-[30px] font-bold text-gray-900 break-words">{q.prompt}</span>
              {/* 词就是题干，读出来不泄答案（选项是释义）——发音见研究性分析 #1 */}
              {canSpeak() && (
                <button
                  type="button"
                  onClick={() => speak(q.prompt)}
                  aria-label={`朗读 ${q.prompt}`}
                  className="hit press text-xl px-1 rounded hover:bg-gray-100"
                >
                  🔊
                </button>
              )}
              {q.phonetic && <span className="text-[15px] text-gray-500">/{q.phonetic}/</span>}
            </div>
          ) : q.qtype === 'cloze' || q.qtype === 'spelling' ? (
            <p className="mt-2 text-[17px] leading-relaxed text-gray-800 font-serif">{q.prompt}</p>
          ) : (
            <div className="mt-2 text-[22px] font-bold text-gray-900 leading-snug">{q.prompt}</div>
          )}
        </div>

        {/* 拼写题：半产出输入（研究性分析 #2）。产出型检索的长期保持
            显著强于四选一辨认，且自家数据显示自评「记得」的词客观一考
            大面积倒下。首字母+字数提示压低手机输入摩擦；「不会写」是
            诚实的出口 —— 按答错记（again），绝不困住学生。 */}
        {isSpelling && !answered && !awaitingServer && (
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!typed.trim()) return;
              settleSpelling(normalizeSpelling(typed) === normalizeSpelling(q.answer ?? ''));
            }}
          >
            {/* 提示逐项可选 —— 正式测试里首字母 / 字数 / 释义都被服务端遮着，
                有什么给什么，没有就整条不出现，绝不渲染成空壳。 */}
            {(q.hint || q.answer || q.translation) && (
              <div className="text-[13px] text-gray-500 mb-2">
                {q.hint && <>首字母 <b className="text-gray-800">{q.hint}</b></>}
                {q.answer ? <> · 共 {q.answer.length} 个字母</> : null}
                {q.translation ? <> · 意思：{q.translation}</> : null}
              </div>
            )}
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={`${q.hint ?? ''}…`}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              aria-label="输入这个单词的拼写"
              className="w-full min-h-[52px] rounded-[14px] border-2 border-gray-300 px-4 py-3 text-[18px] font-medium tracking-wide focus:border-blue-500 focus:outline-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={!typed.trim()}
                className="press flex-1 min-h-[48px] rounded-[14px] bg-blue-600 text-white text-[16px] font-semibold disabled:bg-gray-300 active:bg-blue-700"
              >
                提交
              </button>
              <button
                type="button"
                onClick={() => settleSpelling(false)}
                className="press px-5 min-h-[48px] rounded-[14px] bg-white border-2 border-gray-300 text-gray-600 text-[15px] font-medium"
              >
                不会写
              </button>
            </div>
          </form>
        )}

        {/* 选项 */}
        <div className="mt-5 space-y-2.5" role="group" aria-label="选项">
          {q.options.map((opt, idx) => {
            let cls = 'bg-white border-gray-200 text-gray-900';
            if (answered) {
              if (correctIdx != null && idx === correctIdx) cls = 'bg-emerald-50 border-emerald-500 text-emerald-900';
              else if (idx === chosen) cls = 'bg-rose-50 border-rose-400 text-rose-900';
              else cls = 'bg-white border-gray-200 text-gray-400';
            } else if (awaitingServer) {
              // 还在等服务端判：**只显示他选了哪个**，一个字的对错都不说。
              cls = idx === chosen
                ? 'bg-blue-50 border-blue-400 text-blue-900'
                : 'bg-white border-gray-200 text-gray-400';
            }
            return (
              <button
                key={idx}
                type="button"
                disabled={answered || awaitingServer}
                onClick={() => pick(idx)}
                className={`press w-full min-h-[52px] rounded-[14px] border-2 px-4 py-3 text-left text-[16px] font-medium transition-colors ${cls}`}
              >
                {opt}
                {answered && correctIdx != null && idx === correctIdx && (
                  <span className="float-right">✓</span>
                )}
                {answered && idx === chosen && correctIdx != null && idx !== correctIdx && (
                  <span className="float-right">✗</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 反馈 + 继续。节奏在学生手里，不自动跳。 */}
        {(answered || awaitingServer) && (
          <div
            ref={feedbackRef}
            tabIndex={-1}
            className={`mt-auto pt-4 outline-none enter`}
            aria-live="polite"
          >
            {/* 判定卡**只在服务端说了话之后**出现。等回执的那一段这里是空的
                —— 下面的「保存中…」按钮就是这段的全部反馈。 */}
            {answered && (
            <div
              data-testid="quiz-feedback"
              className={`rounded-[14px] px-4 py-3 ${
                correct ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'
              }`}
            >
              <div className={`text-[15px] font-bold ${correct ? 'text-emerald-800' : 'text-rose-800'}`}>
                {correct ? '答对了' : isSpelling ? '正确拼写在下面' : '正确答案已标出'}
              </div>
              {/* 拼写题：正确拼写要放大给足，错在哪一眼可见 */}
              {isSpelling && (
                <div className="mt-1 text-[18px] font-bold tracking-wide text-gray-900">
                  {q.answer}
                  {!correct && typed.trim() && (
                    <span className="ml-3 text-[14px] font-normal text-rose-700 line-through">{typed.trim()}</span>
                  )}
                </div>
              )}
              <div className="mt-1 text-[14px] text-gray-800">
                <span className="font-bold">{q.headword}</span>
                {canSpeak() && (
                  <button
                    type="button"
                    onClick={() => speak(q.headword)}
                    aria-label={`朗读 ${q.headword}`}
                    className="hit press text-base ml-1 px-1 rounded hover:bg-black/5"
                  >
                    🔊
                  </button>
                )}
                {q.phonetic && <span className="text-gray-500 ml-1.5">/{q.phonetic}/</span>}
                <span className="ml-2">{q.translation}</span>
              </div>
              {!correct && q.contextSentence && q.qtype !== 'cloze' && q.qtype !== 'spelling' && (
                <div className="mt-1.5 text-[13px] text-gray-600 font-serif leading-relaxed">
                  {q.contextSentence}
                </div>
              )}
            </div>
            )}
            {/* 正式测试：答案没存进服务器之前不许往下走。往下走等于把
                学生真的选了的答案记成空白，交卷时按答错算进成绩。 */}
            {saveFailed ? (
              <div className="mt-3" data-testid="answer-save-failed">
                <div className="text-[13px] text-rose-600 text-center mb-2" aria-live="assertive">
                  这一题还没存上 · 你的选择还在，点下面重试
                </div>
                <button
                  type="button"
                  onClick={retrySave}
                  disabled={saving}
                  data-testid="answer-retry"
                  className="press w-full min-h-[52px] rounded-[14px] bg-rose-600 text-white text-[17px] font-semibold active:bg-rose-700 disabled:opacity-50"
                >
                  {saving ? '重试中…' : '重试保存'}
                </button>
              </div>
            ) : (
            <button
              type="button"
              onClick={next}
              disabled={saving || awaitingServer}
              data-testid="quiz-continue"
              className="press mt-3 w-full min-h-[52px] rounded-[14px] bg-blue-600 text-white text-[17px] font-semibold active:bg-blue-700 disabled:opacity-50"
            >
              {saving || awaitingServer ? '保存中…' : '继续'}
            </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
