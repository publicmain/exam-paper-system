import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import {
  submittedAtLabel,
  vocabScoreLabel,
  type VocabScoreView,
} from '../lib/vocabScore';
import { Spinner } from '../components/AsyncState';
import RegistrationSheet from '../components/RegistrationSheet';
import { checkRegistration, type RegStatus } from '../lib/registration';

/**
 * 今天的课（4.0 阶段 A，docs/PRD/morning-quiz-4.0-daily-lesson.md §3）。
 *
 * ## 设计要点（都来自 PRD，逐条对应）
 *
 * 1. **三段并列，不强制顺序** —— 学生可以先背词再读文章。强制顺序会
 *    复制「词汇挡在成绩前面」的老毛病。
 * 2. **每段显示预计时间，且都是小数字**（15 / 4 / 3 分钟）。「今天要花
 *    22 分钟」比「今天有一节课」好接受得多。措辞是「通常」不是「限时」
 *    —— 它是参考，不是约束。
 * 3. **未开始的段落不用红色**。这是学习任务不是欠债，视觉上不制造压力。
 * 4. 三段全绿时顶部换成一句庆祝，**不发徽章不发积分** —— 34 人的班里
 *    攀比机制的副作用大于收益。
 *
 * ## 「已自动收卷」这个状态
 *
 * 读段如果是被系统 23:59 收尾的（不是学生自己交的），显示的是
 * 「已自动收卷」而不是 ✓。这是 A0 的核心：完成度不能被系统凭空发放，
 * 否则它就回答不了「今天到底学没学」。
 */

type SegStatus = 'done' | 'partial' | 'todo' | 'none' | 'auto_closed';

interface LessonSeg {
  key: 'read' | 'vocab' | 'drill';
  status: SegStatus;
  label?: string | null;
  questionCount?: number;
  typicalMinutes: number;
  progress?: number;
  target?: number;
  score?: number | null;
  maxScore?: number | null;
  scoresPending?: boolean;
  submissionId?: string | null;
  autoClosed?: boolean;
  /** P7：正式词汇成绩（只有 vocab 段有）。与 progress/target 是两回事 */
  quizScore?: VocabScoreView | null;
  /** P8：读段带场次 id —— 已开卷的学生能从课程页直接回到卷子 */
  sessionId?: string | null;
}

/** P8：服务端给出的**唯一**下一步 */
interface NextAction {
  kind:
    | 'ready_to_start'
    | 'resume_reading'
    | 'read_result'
    | 'learn_vocab'
    | 'vocab_test'
    | 'summary'
    | 'no_content'
    | 'window_closed'
    | 'level_not_set'
    | 'none';
  label: string;
  href: string | null;
}

type LessonStage = 'reading' | 'reading_done' | 'vocab_learn' | 'vocab_test' | 'done';

/** 当前阶段对应哪一段该高亮（P3）。done 时不高亮任何段。 */
function activeSegOf(stage?: LessonStage): LessonSeg['key'] | null {
  if (stage === 'reading') return 'read';
  if (stage === 'vocab_learn' || stage === 'vocab_test') return 'vocab';
  return null;
}

interface LessonToday {
  /** P8：服务端给出的唯一下一步 */
  nextAction?: NextAction;
  student: { id: string; name: string };
  date: string;
  stage?: LessonStage;
  completed: number;
  total: number;
  allDone: boolean;
  streakDays: number;
  segments: LessonSeg[];
}

const META: Record<LessonSeg['key'], { icon: string; title: string; cta: string }> = {
  read: { icon: '📖', title: '读 · 今天的文章', cta: '看答案' },
  vocab: { icon: '🔤', title: '背 · 今日词汇', cta: '开始' },
  drill: { icon: '📕', title: '补 · 错题重练', cta: '开始' },
};

/** 圆点。刻意不用红色 —— 见文件头第 3 条。 */
function Dot({ status }: { status: SegStatus }) {
  if (status === 'done' || status === 'none') return <span className="text-emerald-500">●</span>;
  if (status === 'partial') return <span className="text-amber-500">◐</span>;
  if (status === 'auto_closed') return <span className="text-gray-400">◍</span>;
  return <span className="text-gray-300">○</span>;
}

function detailOf(seg: LessonSeg): string {
  switch (seg.key) {
    case 'read':
      if (seg.status === 'none') return '今天没有安排文章';
      if (seg.status === 'auto_closed') return '已自动收卷 —— 今天没有自己交卷';
      if (seg.status === 'done') {
        if (seg.scoresPending) return '已交 · 等老师批改';
        return `已交 · ${seg.score ?? '—'}/${seg.maxScore ?? '—'} 分`;
      }
      if (seg.status === 'partial') return '做了一半 · 还没交卷';
      return `${seg.questionCount ?? 0} 题 · 通常 ${seg.typicalMinutes} 分钟`;
    case 'vocab':
      if (seg.status === 'none') return '今天没有到期的词';
      if (seg.status === 'done') return `今天已复习 ${seg.progress ?? 0} 次 · 做完了`;
      return `${seg.progress ?? 0}/${seg.target ?? 0} · 约 ${seg.typicalMinutes} 分钟`;
    case 'drill':
      if (seg.status === 'none') return '今天没有待练的错题';
      if (seg.status === 'done') return '错题都练完了';
      return `${seg.progress ?? 0}/${seg.target ?? 0} 道 · 约 ${seg.typicalMinutes} 分钟`;
  }
}

/** 完成后的按钮不该还写「开始」—— 学生会以为没记上。 */
function ctaOf(seg: LessonSeg, fallback: string): string {
  if (seg.key === 'read') return seg.status === 'done' ? '看答案' : '开始';
  if (seg.status === 'done') return '再练一轮';
  if (seg.status === 'partial') return '继续';
  return fallback;
}

export default function MyLessonPage() {
  const [params] = useSearchParams();
  // 新装 PWA 的 start_url 是裸的 /my-lesson —— 没带参数时从本地取。
  // 本地也没有（真正的新同学）才提示去主页走输名字流程。
  const name =
    params.get('name') ??
    (() => {
      try {
        return localStorage.getItem('mq:history:name') ?? '';
      } catch {
        return '';
      }
    })();
  const studentId =
    params.get('studentId') ??
    (() => {
      try {
        return localStorage.getItem('mq:history:studentId') ?? '';
      } catch {
        return '';
      }
    })();
  const [data, setData] = useState<LessonToday | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** P9：「开始今天的课程」在飞。按钮同时禁用 —— 双击不该发两次命令。 */
  const [starting, setStarting] = useState(false);
  // 网站式注册（2026-08-26）：打开 app 且未注册 → 弹卡，注册完继续
  const [reg, setReg] = useState<RegStatus | null>(null);
  useEffect(() => {
    let alive = true;
    void checkRegistration().then((r) => {
      if (alive && r?.show) setReg(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!name.trim()) {
      setErr('请从个人主页进入');
      return;
    }
    let alive = true;
    void (async () => {
      try {
        // P8 —— 打开课程页 = 「开始或恢复今天的课」这个**命令**。
        // 只有这里会创建当日任务行、推进阶段。总结页与教师看板走纯读。
        const r = await api.lessonStart(name, studentId || undefined);
        if (alive) setData(r as LessonToday);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [name, studentId]);

  /**
   * P9 —— 「开始今天的课程」。
   *
   * 服务端在这一下里挑场次、建正式答卷、冻结当日目标，然后返回新的
   * next-action —— 该去哪一场是它算出来的，前端提前拼不出这个地址。
   *
   * 幂等由服务端保证（答卷唯一索引 + 撞墙自愈），这里的 `starting`
   * 只是不让按钮在飞行途中被连点出第二个请求。
   */
  const beginLesson = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const r = (await api.lessonStart(name, studentId || undefined, true)) as LessonToday;
      setData(r);
      const next = r.nextAction;
      if (next?.href) window.location.href = `${next.href}?${qs}`;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setStarting(false);
    }
  };

  const qs = useMemo(
    () =>
      `name=${encodeURIComponent(name)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`,
    [name, studentId],
  );

  const hrefOf = (seg: LessonSeg): string | null => {
    if (seg.key === 'read') {
      // 交过卷 → 看逐题解析；没交但卷子已开出 → 直接回今天这一场
      // （P8：原来这里返回 null，做到一半退出的学生在课程页上找不到
      // 回卷子的路）
      if (seg.submissionId) return `/my-history/submission/${seg.submissionId}?${qs}`;
      // 答卷还没建出来 —— 进去看得到题却存不下答案。开始是主按钮的事
      // （一次 POST），这张卡不给一个会失败的链接。
      if (data?.nextAction && data.nextAction.kind !== 'resume_reading'
        && data.nextAction.kind !== 'read_result') return null;
      return seg.sessionId ? `/morning-quiz/${seg.sessionId}?${qs}` : null;
    }
    // 走到「该考」之后，词段的入口是正式测试而不是翻卡（P8）
    if (seg.key === 'vocab') {
      return data?.stage === 'vocab_test' ? `/my-vocab/quiz?${qs}` : `/my-vocab/review?${qs}`;
    }
    return `/my-mistakes/practice?${qs}`;
  };

  if (reg) {
    return (
      <RegistrationSheet
        name={reg.name}
        studentId={reg.studentId}
        candidates={reg.candidates}
        onDone={() => window.location.reload()}
      />
    );
  }
  if (err) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="text-center text-gray-500 text-sm">{err}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const d = new Date(`${data.date}T00:00:00Z`);
  const dateLabel = `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${'周日周一周二周三周四周五周六'.slice(
    d.getUTCDay() * 2,
    d.getUTCDay() * 2 + 2,
  )}`;

  return (
    <div className="ui-ios min-h-screen bg-gray-50 px-5 py-6">
      <div className="max-w-md mx-auto">
        <header className="mb-4">
          {data.allDone ? (
            <div className="text-xl font-bold text-emerald-600">
              🎉 今天的课完成了
              {data.streakDays > 0 && ` · 连续 ${data.streakDays} 天`}
            </div>
          ) : (
            <>
              <div className="text-xl font-bold text-gray-900">今天的课 · {dateLabel}</div>
              <div className="mt-1 flex items-center gap-2 text-[15px] text-gray-500">
                <span className="tracking-[0.2em]">
                  {data.segments.map((s) => (
                    <Dot key={s.key} status={s.status} />
                  ))}
                </span>
                <span>
                  {data.completed}/{data.total} 完成
                </span>
              </div>
            </>
          )}
        </header>

        {/* ── P8：**唯一的主要下一步** ──
            阶段由服务端判断，页面只显示。在这之前学生要在三张并排的卡片
            里自己挑：没开始的人在课程页上根本找不到「开始阅读」（读段的
            链接只有已交卷才有），走到该考的阶段点词段还是进翻卡。 */}
        {/* P9 —— 「开始今天的课程」是一次**命令**，不是链接。
            服务端在这一下里挑场次、建答卷、冻结目标，然后才知道该去
            哪一场；前端提前拼不出这个地址。 */}
        {data.nextAction?.kind === 'ready_to_start' && (
          <button
            type="button"
            disabled={starting}
            onClick={() => void beginLesson()}
            data-testid="primary-next"
            data-next-kind="ready_to_start"
            className="press mb-4 block w-full min-h-[52px] rounded-[14px] bg-blue-600 text-white text-center text-[17px] font-semibold active:bg-blue-700 disabled:opacity-60"
          >
            {starting ? '正在准备…' : `${data.nextAction.label} →`}
          </button>
        )}
        {data.nextAction && data.nextAction.kind !== 'ready_to_start' && data.nextAction.href && (
          <a
            href={`${data.nextAction.href}?${qs}`}
            data-testid="primary-next"
            data-next-kind={data.nextAction.kind}
            className="press mb-4 block w-full min-h-[52px] leading-[52px] rounded-[14px] bg-blue-600 text-white text-center text-[17px] font-semibold active:bg-blue-700"
          >
            {data.nextAction.label} →
          </a>
        )}
        {data.nextAction && !data.nextAction.href && (
          <div
            data-testid="primary-next"
            data-next-kind={data.nextAction.kind}
            className="mb-4 rounded-[14px] border border-dashed border-gray-300 py-3 text-center text-[14px] text-gray-500"
          >
            {data.nextAction.label}
          </div>
        )}

        <div className="space-y-3">
          {data.segments.map((seg) => {
            const meta = META[seg.key];
            const href = hrefOf(seg);
            const finished = seg.status === 'done' || seg.status === 'none';
            return (
              <div
                key={seg.key}
                className={`bg-white rounded-2xl border p-4 ${
                  finished
                    ? 'border-emerald-200'
                    : seg.key === activeSegOf(data.stage)
                      ? 'border-blue-400 ring-1 ring-blue-100'
                      : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.icon}</span>
                      <span className="font-semibold text-gray-900">{meta.title}</span>
                      <Dot status={seg.status} />
                    </div>
                    {seg.key === 'read' && seg.label && (
                      <div className="mt-1 text-[13px] text-gray-700 truncate">《{seg.label}》</div>
                    )}
                    <div className="mt-1 text-[13px] text-gray-500">{detailOf(seg)}</div>
                    {/* P7 —— 正式词汇成绩**单独一行**，与上面那行完成度分开。
                        上面是「今天复习了几次」（过程），这里是「单词测试考了
                        多少」（结果）。阅读成绩在 read 段，两者互不覆盖。 */}
                    {seg.key === 'vocab' && seg.quizScore && (
                      <div className="mt-1.5" data-testid="vocab-score">
                        <span className="text-[11px] text-gray-400 mr-1.5">单词测试</span>
                        <span
                          className={`text-[13px] ${
                            seg.quizScore.status === 'submitted'
                              ? 'font-semibold text-blue-700'
                              : 'text-gray-500'
                          }`}
                        >
                          {vocabScoreLabel(seg.quizScore)}
                        </span>
                        {submittedAtLabel(seg.quizScore) && (
                          <span className="ml-1.5 text-[11px] text-gray-400">
                            {submittedAtLabel(seg.quizScore)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* P8 —— 卡片上的入口只给**当前该做的**和**已经做完的**
                      那两类：做完的要能回看（答案、成绩、再练一轮），当前
                      的是主按钮的同一条路。还没轮到的段落不给行动链接 ——
                      三张卡各挂一个「开始 →」就是学生分不清先做哪个的原因，
                      也是唯一主按钮想解决的事。想自由复习生词本的路没被堵：
                      「我的主页」里一直有。 */}
                  {href && seg.status !== 'none' &&
                    (finished || seg.key === activeSegOf(data.stage)) && (
                    <a
                      href={href}
                      className="shrink-0 text-[14px] text-blue-600 font-medium px-2 py-1"
                    >
                      {ctaOf(seg, meta.cta)} →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 读段没开始时给一句社会证明 —— 全天开放后这是主要的推力来源
            （PRD §6.2）。措辞是「大家通常」，不是「你必须」。 */}
        {data.segments[0]?.status === 'todo' && (
          <p className="mt-4 text-[13px] text-gray-400 text-center leading-relaxed">
            你可以在今天任何时间开始或继续课程，学习进度会自动保存。
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-5">
          {/* 带参数 → 不会触发 my-history 的启动跳转，看成绩的路永远通 */}
          <a href={`/my-history?${qs}`} className="text-[13px] text-gray-400">
            成绩记录
          </a>
          <a href={`/me`} className="text-[13px] text-gray-400">
            我的主页
          </a>
        </div>
      </div>
    </div>
  );
}
