import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Spinner } from '../components/AsyncState';

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
}

interface LessonToday {
  student: { id: string; name: string };
  date: string;
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

  useEffect(() => {
    if (!name.trim()) {
      setErr('请从个人主页进入');
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const r = await api.lessonToday(name, studentId || undefined);
        if (alive) setData(r as LessonToday);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [name, studentId]);

  const qs = useMemo(
    () =>
      `name=${encodeURIComponent(name)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`,
    [name, studentId],
  );

  const hrefOf = (seg: LessonSeg): string | null => {
    if (seg.key === 'read') {
      return seg.submissionId ? `/my-history/submission/${seg.submissionId}?${qs}` : null;
    }
    if (seg.key === 'vocab') return `/my-vocab/review?${qs}`;
    return `/my-mistakes/practice?${qs}`;
  };

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

        <div className="space-y-3">
          {data.segments.map((seg) => {
            const meta = META[seg.key];
            const href = hrefOf(seg);
            const finished = seg.status === 'done' || seg.status === 'none';
            return (
              <div
                key={seg.key}
                className={`bg-white rounded-2xl border p-4 ${
                  finished ? 'border-emerald-200' : 'border-gray-200'
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
                  </div>
                  {href && seg.status !== 'none' && (
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
            大家通常在早上 8:30 做今天的文章。
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
