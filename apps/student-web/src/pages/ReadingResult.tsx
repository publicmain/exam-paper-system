/**
 * `/lesson/reading/result` —— 交完卷之后看成绩与逐题回顾。
 *
 * ## 资源从哪来
 *
 * 和阅读页同一条链：`GET /lesson/today` → `segments.read` 给出
 * `sessionId` / `submissionId`。**URL 的查询串、localStorage、令牌里解出来
 * 的东西、后端的 `href`、旧的历史 state —— 一个都不读。** 这条规矩的意义
 * 是「学生只能看到服务端认定属于他的那份答卷」——一旦资源标识可以从
 * URL 里指定，任何人都能翻别人的卷子。
 *
 * ## 放不放分数 / 答案，服务端说了算
 *
 * 响应里有两面旗子：
 *   · `scoresPending` —— 还没判分。此时 `totalScore` 等全是 null，
 *     页面显示「还在判分」，**绝不自己补一个 0 分**；
 *   · `answersPending` —— 还没最终提交（第二作答窗还开着）。此时
 *     `correctAnswer` / `referenceAnswer` / `explanation` 全是 null，
 *     页面**一个字的答案材料都不显示**。
 *
 * 前端不做第二套判断 —— 服务端的 `stripUnreleasedScores` 是权威，
 * 这里只按旗子决定措辞。
 *
 * ## 这一页是只读的
 *
 * 不存草稿、不保存答案、不交卷、不重做。唯一的写操作是**申诉**。
 *
 * ## 主行动：接下来做什么（S9D2B）
 *
 * 阅读页交完卷**固定**送到这一屏（见 `Reading.tsx` 文件头），所以「往下走」
 * 这一步落在这里：点主行动时**再问一次** `/lesson/today`，按当下的
 * `nextAction.kind` 走 `NEXT_ACTION_ROUTE`。不用交卷那一刻的答案 ——
 * 学生可能在这一页停了很久，中途状态早就变了。
 *
 * 有一条自环必须挡住：`kind` 仍是 `read_result` 时（交了卷但阶段没推进，
 * 比如被系统收尾的那种日子）照跳就是原地打转 —— 那种情况落回枢纽。
 * `stay` 类的 kind（今天没内容 / 窗口关了 / 没分级）同样落回枢纽。
 *
 * ## 呈现层在 `components/ResultView.tsx`（阶段 11）
 *
 * 成绩摘要、逐题回顾、申诉那一整块**原样搬去了**共享组件 —— 历史成绩页
 * （`/scores/:submissionId`）要显示的是同一份东西。这一页仍然负责**它自己
 * 那条定位链**（`/lesson/today` → read 段 → sessionId + submissionId）和
 * 「接下来做什么」，呈现规则不再有第二份实现。
 *
 * 三个纯函数从这里**再导出**一次，是为了让既有的行为测试与调用点不必改。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResultView } from '../components/ResultView';
import {
  ApiError,
  api,
  type LessonToday,
  type ReadingResult,
  type SegmentStatus,
} from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { NEXT_ACTION_ROUTE, ROUTES } from '../routes.contract';

/**
 * 纯逻辑现在住在共享组件里。**从这里再导出一次**，既有的
 * `reading-result.test.tsx` 与任何调用点都不必改 —— 行为完全同一份实现。
 */
export {
  percentageOf,
  questionOutcome,
  validateAppealMessage,
  type QuestionOutcome,
} from '../components/ResultView';

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

/**
 * 「这一段阅读有结果可看」的状态。
 *
 * `todo` / `partial` 是还在做，`none` 是今天压根没有阅读 —— 这三种状态下
 * **没有可回顾的答卷**，来了也只能空手而归。真正做完的只有两种：学生自己
 * 交了卷（`done`），或者作答窗关闭时被系统收走（`auto_closed`）。
 *
 * 这个判断刻意**只认服务端下发的状态**，不去猜「有 submissionId 大概就是
 * 做完了」—— 阅读做到一半也有 submissionId。
 */
const RESULT_READY: ReadonlySet<SegmentStatus> = new Set<SegmentStatus>(['done', 'auto_closed']);

/** 从今天的课里取出这一屏需要的两个标识；任何一个缺就是「没有结果可看」。 */
export function readingResultRef(
  today: LessonToday,
): { sessionId: string; submissionId: string } | null {
  const read = today.segments.find((s) => s.key === 'read');
  if (!read || read.key !== 'read') return null;
  if (!RESULT_READY.has(read.status)) return null;
  if (!read.sessionId || !read.submissionId) return null;
  return { sessionId: read.sessionId, submissionId: read.submissionId };
}

type Phase =
  | { s: 'loading' }
  | { s: 'error'; message: string }
  | { s: 'locked' }
  /**
   * `submissionId` 单独带着，**不从 `result` 里读**。申诉是写操作，它认的那
   * 个 id 必须来自认证过的 `/lesson/today` 这条链，而不是结果响应自己说的
   * 那个 —— 否则「结果响应」就成了另一个可以指定写入目标的入口。
   */
  | { s: 'ready'; result: ReadingResult; submissionId: string };

export default function ReadingResultPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    setPhase({ s: 'loading' });
    try {
      const today = await api.lessonToday(token);
      const ref = readingResultRef(today);
      if (!ref) {
        // 今天没有可看的阅读结果 —— 回枢纽，由它决定下一步。
        navigate(ROUTES.today, { replace: true });
        return;
      }
      const result = await api.getReadingResult(token, ref.sessionId);
      // 拿回来的必须**就是**我们问的那一份。对不上就是链路错位（换了一天、
      // 卷子被换、响应串了）—— 一个字都不显示，更不能让申诉挂到别人的答卷上。
      if (result.sessionId !== ref.sessionId || result.submissionId !== ref.submissionId) {
        navigate(ROUTES.today, { replace: true });
        return;
      }
      setPhase({ s: 'ready', result, submissionId: ref.submissionId });
    } catch (e) {
      if (handleAuthFailure(e)) return;
      if (e instanceof ApiError && e.body.code === 'result_locked_until_submit') {
        setPhase({ s: 'locked' });
        return;
      }
      if (e instanceof ApiError && (e.body.code === 'no_submission' || e.body.code === 'session_not_found')) {
        // 课程状态与这一页对不上（换了一天、卷子被撤）—— 回枢纽，不是报错。
        navigate(ROUTES.today, { replace: true });
        return;
      }
      setPhase({ s: 'error', message: '没能打开这次的成绩 —— 网络不太好，重试一下。' });
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase.s === 'loading') {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-slate-50">
        <p className="text-slate-400">载入中…</p>
      </div>
    );
  }

  if (phase.s === 'locked') {
    return (
      <Shell>
        <div role="alert" data-testid="locked" className="rounded-xl bg-amber-50 text-amber-900 px-4 py-3 text-sm mb-4">
          这次的答卷还没交，先把卷子做完再来看结果。
        </div>
        <BackToToday navigate={navigate} />
      </Shell>
    );
  }

  if (phase.s === 'error') {
    return (
      <Shell>
        <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-4 py-3 text-sm mb-4">
          {phase.message}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="w-full rounded-xl bg-blue-600 text-white py-3 text-base font-medium min-h-[44px]"
        >
          重试
        </button>
        <BackToToday navigate={navigate} />
      </Shell>
    );
  }

  return (
    <Shell>
      <ResultView
        result={phase.result}
        submissionId={phase.submissionId}
        onAuthLost={() => void load()}
        /* 主行动 —— 看完成绩之后往下走。「往哪走」现问现答。 */
        footer={<ContinueLesson navigate={navigate} />}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-6">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </div>
  );
}

/**
 * 「接下来做什么」——**当下**的 `nextAction` 说了算（见文件头）。
 *
 * 顺序有讲究：**先取令牌、后上闸**。反过来写的话，没令牌那一支会在闸门
 * 已经锁上之后 return，按钮就永久卡在「正在打开…」——S9A 踩过一次。
 */
function ContinueLesson({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const go = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，路由守卫会送走
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const today = await api.lessonToday(token);
      const target = NEXT_ACTION_ROUTE[today.nextAction.kind];
      // 自环挡一道：kind 还是 read_result 就是「就在这一页」，照跳原地打转。
      const path =
        target.kind === 'navigate' && target.path !== ROUTES.readingResult
          ? target.path
          : ROUTES.today;
      navigate(path);
      // 走成功就不复位了 —— 这个组件随即卸载，复位只会打到已卸载的树上。
    } catch (e) {
      busyRef.current = false;
      setBusy(false);
      if (handleAuthFailure(e)) return;
      // 问不到「下一步」不该把学生困在成绩页上 —— 回枢纽，它自己会再问一次。
      navigate(ROUTES.today);
    }
  }, [navigate]);

  return (
    <button
      type="button"
      data-testid="continue-lesson"
      disabled={busy}
      onClick={() => void go()}
      className="mt-6 w-full rounded-xl bg-blue-600 text-white py-3 text-base font-medium min-h-[44px] disabled:opacity-60"
    >
      {busy ? '正在打开…' : '继续今天的课'}
    </button>
  );
}

function BackToToday({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button
      type="button"
      data-testid="back-to-today"
      onClick={() => navigate(ROUTES.today)}
      className="mt-4 w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      回到今天的课
    </button>
  );
}
