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
import { useLocation, useNavigate } from 'react-router-dom';
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
import { isTeachingDay } from '../lib/teaching-day';
import { Button } from '../design/Button';
import { FocusHeader } from '../design/Page';
import { InlineStatus, StatusView } from '../design/Status';

/**
 * 刚交完卷时由阅读页通过路由状态（不进 URL）带过来的那一份（审计 UI11）。
 *
 * 两个 id 都来自服务端：会话是阅读页加载的那一场，答卷 id 是交卷响应回的那一份。
 * 有它就直接打开**刚交的这一份**，不再问「今天」—— 23:59 开始、00:01 交卷时，
 * 今天已经是新的一天，按今天定位会打开别的卷子或把人送回首页。
 */
type JustSubmitted = { sessionId: string; submissionId: string };
function justSubmittedFrom(state: unknown): JustSubmitted | null {
  const j = (state as { justSubmitted?: Partial<JustSubmitted> } | null)?.justSubmitted;
  return j && typeof j.sessionId === 'string' && typeof j.submissionId === 'string' && j.sessionId && j.submissionId
    ? { sessionId: j.sessionId, submissionId: j.submissionId }
    : null;
}

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
  const location = useLocation();
  const just = justSubmittedFrom(location.state);
  const justKey = just ? `${just.sessionId}|${just.submissionId}` : '';
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    setPhase({ s: 'loading' });
    try {
      // ① 刚交完卷：直接按服务端回的那一份定位（UI11）。对不上就退回「今天」这条链。
      const j = justKey ? { sessionId: justKey.split('|')[0], submissionId: justKey.split('|')[1] } : null;
      if (j) {
        const result = await api.getReadingResult(token, j.sessionId);
        if (result.sessionId === j.sessionId && result.submissionId === j.submissionId) {
          setPhase({ s: 'ready', result, submissionId: j.submissionId });
          return;
        }
      }
      // ② 从首页卡片进来：按今天的课定位
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
  }, [navigate, justKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase.s === 'loading') {
    return <StatusView kind="loading" title="载入中" />;
  }

  if (phase.s === 'locked') {
    return (
      <Shell navigate={navigate}>
        <div className="mx-auto max-w-md py-10">
          <div data-testid="locked">
            <InlineStatus tone="warning">这次的答卷还没交，先把卷子做完再来看结果。</InlineStatus>
          </div>
          <BackToToday navigate={navigate} />
        </div>
      </Shell>
    );
  }

  if (phase.s === 'error') {
    return (
      <Shell navigate={navigate}>
        <StatusView
          kind="error"
          title="成绩没打开"
          message={phase.message}
          onRetry={() => void load()}
          secondary={<BackToToday navigate={navigate} />}
        />
      </Shell>
    );
  }

  return (
    <Shell navigate={navigate} title={phase.result.paperName} meta={phase.result.scoresPending ? '已交卷 · 主观题等老师批' : '已交卷 · 成绩已出'} fill>
      <ResultView
        fill
        result={phase.result}
        submissionId={phase.submissionId}
        onAuthLost={() => void load()}
        /*
          得分率是**前端除出来的**（服务端不下发）。这一屏历史上一直显示
          它，是冻结过的既有行为，所以在这里显式打开 —— 开关默认关，
          历史成绩详情页就不会跟着多出一个服务端没说过的数字。
        */
        showDerivedPercentage
        /* 主行动 —— 看完成绩之后往下走。「往哪走」现问现答。 */
        footer={<ContinueLesson navigate={navigate} />}
      />
    </Shell>
  );
}

/** 刚交卷结果页的外壳：与答题页同一种专注顶栏；宽屏整页一屏高、两栏各自滚动。 */
function Shell({
  children,
  navigate,
  title = '阅读结果',
  meta,
  fill = false,
}: {
  children: React.ReactNode;
  navigate: ReturnType<typeof useNavigate>;
  title?: string;
  meta?: string;
  fill?: boolean;
}) {
  return (
    <div className={`flex min-h-[100dvh] flex-col ${fill ? 'min-[900px]:h-[100dvh]' : ''}`} style={{ ['--focus-header-h' as string]: '57px' }}>
      <FocusHeader backLabel="今日" onBack={() => navigate(ROUTES.today)} title={title} meta={meta} />
      <main id="main" className={`safe-x mx-auto w-full max-w-[1400px] flex-1 py-3 ${fill ? 'min-[900px]:min-h-0' : ''}`}>
        {children}
      </main>
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
      // 周末没有新词任务：别把学生送进只有一句「周一再来」的页面，回首页
      //（2026-09-05 复测新发现 2）。
      const weekendLearn = !isTeachingDay() && today.nextAction.kind === 'learn_vocab';
      const path =
        target.kind === 'navigate' && target.path !== ROUTES.readingResult && !weekendLearn
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
    <Button data-testid="continue-lesson" block busy={busy} onClick={() => void go()} className="mt-2">
      {busy ? '正在打开…' : isTeachingDay() ? '继续今天的课' : '回到今日'}
    </Button>
  );
}

function BackToToday({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <Button data-testid="back-to-today" variant="neutral" block onClick={() => navigate(ROUTES.today)} className="mt-4">
      回到今日
    </Button>
  );
}
