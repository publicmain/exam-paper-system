/**
 * `/scores/:submissionId` —— 翻开历史里的某一份阅读答卷（阶段 11）。
 *
 * ## 资源怎么定位
 *
 * **路径参数是唯一的选择器**。这一页不问 `/lesson/today`（那是「今天」，
 * 与「历史」无关），不读姓名、不读 localStorage、不读后端的 `href`。
 * 只有一个请求：`GET /morning-quiz/history-detail?submissionId=<路由参数>`。
 *
 * 归属由**服务端**判定：带令牌时它比对 `submission.studentId === token.id`，
 * 不是我的就 403 —— 客户端拿到 id 也翻不出别人的卷子。
 *
 * ## 客户端再核一道
 *
 * 服务端过了，这里**还要**确认「回来的就是我问的那一份」：
 *
 *   `response.submissionId === 路由里的 submissionId`
 *
 * 对不上就一个字都不显示。这不是不信任服务端，而是这一页上挂着**申诉**
 * （唯一的写操作）：申诉认的那个 submissionId 必须来自这条校验过的链，
 * 否则「结果响应」就成了另一个可以指定写入目标的入口。响应形状不对
 * （少了 `submissionId`、`items` 不是数组）同样按「不显示」处理。
 *
 * ## 呈现规则与刚交完卷那一屏是同一份
 *
 * 见 `components/ResultView.tsx`：分数门与答案门都是服务端的，
 * 这里不重算分数、不判对错、不补 0、不猜答案。
 *
 * **唯一的例外是得分率**：`history-detail` 的响应里没有百分比字段，那个
 * 数只能由前端 `totalScore / maxScore` 除出来。翻旧账的时候凭空多一个
 * 服务端没说过的数字，学生分不清哪个才是真成绩 —— 所以这一屏**不显示
 * 它**（`showDerivedPercentage` 默认就是关的，这里连传都不用传）。
 * 交完卷那一屏显示它是既有行为，冻结不动，由它自己在调用点显式打开。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ResultView } from '../components/ResultView';
import { ApiError, api, type ReadingResult } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

/**
 * 这份响应能不能显示。
 *
 * 三条全过才算数：形状对、带 `submissionId`、而且**等于我问的那一个**。
 * 其中任何一条不过，调用方一律按「什么都不显示」处理 —— 不降级、不部分
 * 渲染、不给申诉入口。
 */
export function ownsResult(result: unknown, submissionId: string): result is ReadingResult {
  if (!result || typeof result !== 'object') return false;
  const r = result as Partial<ReadingResult>;
  if (typeof r.submissionId !== 'string' || r.submissionId !== submissionId) return false;
  return Array.isArray(r.items);
}

/** 服务端明说「不是你的 / 没这份」——安全空态，不是「重试一下」。 */
const DENIED_CODES = new Set([
  'name_mismatch',
  'submission_not_found',
  'no_submission',
  'no_session_for_submission',
  'session_not_found',
]);

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

type Phase =
  | { s: 'loading' }
  /** 不是你的 / 没这份 / 响应对不上 —— 一个字的答案材料都不显示。 */
  | { s: 'denied' }
  | { s: 'error'; message: string }
  | { s: 'ready'; result: ReadingResult; submissionId: string };

export default function ScoreDetailPage() {
  const navigate = useNavigate();
  const { submissionId } = useParams<{ submissionId: string }>();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });

  /** 请求代次 —— 重试与卸载之后回来的响应一律作废。 */
  const gen = useRef(0);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    const id = (submissionId ?? '').trim();
    if (!id) {
      navigate(ROUTES.scores, { replace: true });
      return;
    }
    const mine = ++gen.current;
    setPhase({ s: 'loading' });
    try {
      const result = await api.readingHistoryDetail(token, id);
      if (mine !== gen.current) return;
      // **回来的必须就是我问的那一份**（见文件头）
      if (!ownsResult(result, id)) {
        setPhase({ s: 'denied' });
        return;
      }
      setPhase({ s: 'ready', result, submissionId: id });
    } catch (e) {
      if (mine !== gen.current) return;
      if (handleAuthFailure(e)) return;
      if (e instanceof ApiError && (e.status === 403 || DENIED_CODES.has(String(e.body.code)))) {
        setPhase({ s: 'denied' });
        return;
      }
      setPhase({ s: 'error', message: '没能打开这份成绩 —— 网络不太好，重试一下。' });
    }
  }, [navigate, submissionId]);

  useEffect(() => {
    void load();
    return () => {
      gen.current++;
    };
  }, [load]);

  if (phase.s === 'loading') {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-slate-50">
        <p className="text-slate-400">载入中…</p>
      </div>
    );
  }

  if (phase.s === 'denied') {
    return (
      <Shell>
        <div
          role="alert"
          data-testid="detail-denied"
          className="rounded-xl bg-amber-50 text-amber-900 px-4 py-3 text-sm mb-4"
        >
          没有找到这份成绩 —— 它可能不属于你，或者已经不在了。
        </div>
        <BackToScores navigate={navigate} />
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
          data-testid="retry"
          onClick={() => void load()}
          className="w-full rounded-xl bg-blue-600 text-white py-3 text-base font-medium min-h-[44px]"
        >
          重试
        </button>
        <BackToScores navigate={navigate} />
      </Shell>
    );
  }

  return (
    <Shell>
      <ResultView
        result={phase.result}
        submissionId={phase.submissionId}
        onAuthLost={() => void load()}
        footer={<BackToScores navigate={navigate} />}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-6">
      {/* S12L —— 宽屏放宽到 1280，给「左原文 / 右题目」腾出地方 */}
      <div className="mx-auto w-full max-w-2xl lg:max-w-6xl xl:max-w-7xl">{children}</div>
    </div>
  );
}

function BackToScores({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button
      type="button"
      data-testid="back-to-scores"
      onClick={() => navigate(ROUTES.scores)}
      className="mt-6 w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      回到历史成绩
    </button>
  );
}
