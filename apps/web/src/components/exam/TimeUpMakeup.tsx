import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPracticeClone } from '../../lib/api-student';

/**
 * 超时自动交卷后的落地页 —— 「补做」入口。
 *
 * ## 它要解决的问题（2026-08-13 老师提出，用考勤数据证实）
 *
 * 早测 8:30-9:00 固定收卷。真实扫码时刻中位数是迟到 5 分钟，但尾部
 * 很长，而迟到与放弃高度相关：
 *   0-10 分钟到（n=158）：平均得分率 52.3%，空白率 26.5%
 *   11-20 分钟到（n=31）：平均得分率 24.8%，空白率 56.7%
 *   21 分钟后到（n=14）：平均得分率  1.7%，空白率 **95.6%**
 * 也就是说迟到二十分钟以上的学生几乎整张卷子空着 —— 不是不会做，
 * 是算出来"反正做不完"之后直接不做了。这是**动机问题**，不是能力问题。
 *
 * ## 为什么不是"把计时去掉"
 *
 * 老师的原始设想是时间到了让学生继续答。我没有直接这么做，三个原因：
 *   1. 这是雅思班，限时阅读本身就是要练的能力，取消计时等于取消训练；
 *   2. 9:00 之后是正课，物理上不可能让学生答到 9:20；
 *   3. 统一的正式作答窗口是成绩可比的前提 —— 如果每人时长不同，
 *      分数之间就没法横向比较，周报和技能画像都会失真。
 *
 * 所以保留 9:00 硬性收卷（正式成绩定格），但**把终点改成存档点**：
 * 交卷后立刻告诉学生"你还有 N 题没做完，现在做完仍然算数"，一键进入
 * 补做（复用既有的 practice 机制，服务端判分、进历史、错题会被收录）。
 * 补做不计入正式分 —— 公平性不受影响，但"做完"重新变得有意义。
 *
 * 参考 Moodle 的做法：per-attempt 计时与固定关闭时间取较早者。我们
 * 受作息限制只能保留后者，于是把"关闭之后"这段做成可继续练习的区间。
 */
export default function TimeUpMakeup({
  submissionId,
  studentName,
  unanswered,
  total,
  onSkip,
}: {
  submissionId: string;
  studentName: string;
  /** 交卷时仍空着的题数 */
  unanswered: number;
  total: number;
  onSkip: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const answered = total - unanswered;

  async function startMakeup() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r: any = await createPracticeClone(submissionId, { studentName });
      if (r?.practiceSubmissionId) {
        navigate(
          `/practice/${r.practiceSubmissionId}?name=${encodeURIComponent(studentName)}`,
          { replace: true },
        );
        return;
      }
      setErr('补做入口暂时打不开，先去看成绩吧。');
    } catch (e: any) {
      setErr(String(e?.message ?? e).slice(0, 120));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-5 py-8">
      <div className="bg-white rounded-2xl border shadow-sm p-6 max-w-sm w-full enter">
        <div className="text-[13px] font-semibold tracking-[0.18em] text-blue-600">时间到 · 已自动交卷</div>
        <h1 className="text-[24px] font-bold text-gray-900 mt-1.5 leading-tight">
          {unanswered > 0 ? `还有 ${unanswered} 题没做完` : '答完了，交卷成功'}
        </h1>

        {unanswered > 0 ? (
          <>
            <p className="text-[15px] text-gray-600 mt-2.5 leading-relaxed">
              已答 {answered} / {total} 题。
              <strong className="text-gray-900">现在把剩下的做完仍然算数</strong>
              —— 系统照样判分、错题照样进你的错题本，老师也看得到。
              只是不计入今天的正式分数。
            </p>
            <div className="mt-3 rounded-[12px] bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[13px] text-amber-900 leading-relaxed">
              空着一定是 0 分。做完至少你知道自己哪里不会 —— 这比分数有用。
            </div>
            {err && <div className="mt-3 text-[13px] text-rose-600">{err}</div>}
            <button
              type="button"
              disabled={busy}
              onClick={startMakeup}
              className="press mt-4 w-full min-h-[52px] rounded-[14px] bg-blue-600 text-white text-[17px] font-semibold active:bg-blue-700 disabled:opacity-60"
            >
              {busy ? '正在准备…' : '把剩下的做完'}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="press mt-2.5 w-full min-h-[44px] rounded-[14px] text-gray-500 text-[15px]"
            >
              先看成绩
            </button>
          </>
        ) : (
          <>
            <p className="text-[15px] text-gray-600 mt-2.5">
              {total} 题全部作答完毕。去看看这次的成绩和错题。
            </p>
            <button
              type="button"
              onClick={onSkip}
              className="press mt-4 w-full min-h-[52px] rounded-[14px] bg-blue-600 text-white text-[17px] font-semibold active:bg-blue-700"
            >
              查看我的成绩
            </button>
          </>
        )}
      </div>
    </div>
  );
}
