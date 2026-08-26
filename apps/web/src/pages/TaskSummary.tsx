import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Spinner } from '../components/AsyncState';
import {
  submittedAtLabel,
  vocabScoreLabel,
  type VocabScoreView,
} from '../lib/vocabScore';

/**
 * P8 —— 今天这节课的**任务总结**。
 *
 * 章程的七阶段最后一步。在此之前它根本不存在：学生做完所有事，看到的
 * 还是三张并排的段落卡，不知道今天到底考了多少。
 *
 * 两条硬边界：
 * - **纯读取**。走 GET /lesson/today（P8 收口后它一个字都不写），不创建
 *   任务、不推进阶段、不新建 attempt。学生反复刷新总结页，数据不会变
 * - **不在前端算分**。阅读分来自正式答卷、词汇分来自 P7 的统一 DTO，
 *   两个数字都是服务端算好落库的。这里只把它们摆出来
 */

interface Seg {
  key: 'read' | 'vocab' | 'drill';
  status: string;
  label?: string | null;
  score?: number | null;
  maxScore?: number | null;
  scoresPending?: boolean;
  submissionId?: string | null;
  progress?: number;
  target?: number;
  quizScore?: VocabScoreView | null;
}

interface TodayDto {
  student: { id: string; name: string };
  date: string;
  stage: string;
  allDone: boolean;
  completed: number;
  total: number;
  streakDays?: number;
  segments: Seg[];
}

/** 阅读成绩的一行字。**待批不是 0 分，没交也不是 0 分。** */
function readScoreLabel(seg: Seg | undefined): string {
  if (!seg) return '—';
  if (seg.status === 'none') return '今天没有安排文章';
  if (seg.status === 'todo') return '还没开始';
  if (seg.status === 'partial') return '做了一半 · 还没交卷';
  if (seg.scoresPending) return '已交 · 等老师批改';
  if (seg.score == null) return '已交 · 暂无分数';
  return `${seg.score}/${seg.maxScore ?? '—'} 分`;
}

export default function TaskSummaryPage() {
  const [params] = useSearchParams();
  const name =
    params.get('name') ??
    (() => {
      try {
        return localStorage.getItem('mq:history:name') ?? '';
      } catch {
        return '';
      }
    })();
  const studentId = params.get('studentId') ?? '';
  const qs =
    `name=${encodeURIComponent(name)}` +
    (studentId ? `&studentId=${encodeURIComponent(studentId)}` : '');

  const [data, setData] = useState<TodayDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    // **只读**：总结页绝不调 /lesson/start
    api
      .lessonToday(name, studentId || undefined)
      .then((r: any) => {
        if (!cancelled) setData(r);
      })
      .catch((e: any) => {
        if (!cancelled) setError(String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [name, studentId]);

  if (!name) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="text-center text-gray-500">
          不知道你是谁 —— 请从主页进入。
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="bg-white rounded-2xl border p-6 max-w-sm w-full text-center">
          <div className="text-3xl mb-2">⛔</div>
          <div className="text-gray-700">{error}</div>
          <Link to={`/my-lesson?${qs}`} className="mt-4 block text-blue-600 underline">
            ← 回到今天的课
          </Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Spinner label="正在算今天的总结…" />
      </div>
    );
  }

  const read = data.segments.find((s) => s.key === 'read');
  const vocab = data.segments.find((s) => s.key === 'vocab');
  const vocabScore = vocab?.quizScore ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-md mx-auto px-4 py-6" data-testid="task-summary">
        <header className="text-center mb-6">
          <div className="text-4xl mb-1">{data.allDone ? '🎉' : '📋'}</div>
          <h1 className="text-xl font-bold text-gray-900">
            {data.allDone ? '今天的课完成了' : '今天的进度'}
          </h1>
          <div className="text-[13px] text-gray-500 mt-1">
            {data.date} · {data.completed}/{data.total} 段
            {data.streakDays ? ` · 连续 ${data.streakDays} 天` : ''}
          </div>
        </header>

        {/* ── 两项成绩分开列，各有各的事实来源 ── */}
        <div className="space-y-3">
          <section className="bg-white rounded-2xl border p-4" data-testid="summary-reading">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">阅读成绩</span>
              {read?.label && (
                <span className="text-[12px] text-gray-400 truncate max-w-[55%]">
                  《{read.label}》
                </span>
              )}
            </div>
            <div className="mt-1 text-[20px] font-bold text-gray-900">
              {readScoreLabel(read)}
            </div>
            {read?.submissionId && (
              <Link
                to={`/my-history/submission/${read.submissionId}?${qs}`}
                className="mt-2 inline-block text-[14px] text-blue-600"
              >
                看逐题解析 →
              </Link>
            )}
          </section>

          <section className="bg-white rounded-2xl border p-4" data-testid="summary-vocab">
            <div className="text-[13px] text-gray-500">单词测试成绩</div>
            <div
              className={`mt-1 text-[20px] font-bold ${
                vocabScore?.status === 'submitted' ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              {vocabScoreLabel(vocabScore)}
            </div>
            {submittedAtLabel(vocabScore) && (
              <div className="mt-1 text-[12px] text-gray-400">{submittedAtLabel(vocabScore)}</div>
            )}
            {/* 完成度与成绩是两回事，分行写清楚，别让学生把「复习了几次」
                当成分数 */}
            <div className="mt-2 text-[12px] text-gray-400">
              今天复习了 {vocab?.progress ?? 0} 次（完成度，不是成绩）
            </div>
          </section>
        </div>

        <Link
          to={`/my-lesson?${qs}`}
          className="press mt-6 block w-full py-3 rounded-[14px] bg-blue-600 text-white text-center font-semibold"
        >
          回到今天的课
        </Link>
        <Link
          to={`/my-history?${qs}`}
          className="mt-3 block text-center text-[14px] text-blue-600"
        >
          看历史成绩
        </Link>
      </main>
    </div>
  );
}
