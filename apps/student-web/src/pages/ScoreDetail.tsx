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
import { Button } from '../design/Button';
import { BackButton } from '../design/Page';
import { InlineStatus, StatusView } from '../design/Status';
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
      <Frame navigate={navigate}>
        <StatusView kind="loading" title="载入中" />
      </Frame>
    );
  }

  if (phase.s === 'denied') {
    return (
      <Frame navigate={navigate}>
        <div className="mx-auto max-w-md py-8">
          <div data-testid="detail-denied">
            <InlineStatus tone="warning">没有找到这份成绩 —— 它可能不属于你，或者已经不在了。</InlineStatus>
          </div>
          <BackToScores navigate={navigate} />
        </div>
      </Frame>
    );
  }

  if (phase.s === 'error') {
    return (
      <Frame navigate={navigate}>
        <StatusView
          kind="error"
          title="这份成绩没打开"
          message={phase.message}
          secondary={
            <>
              <Button block data-testid="retry" icon="refresh" onClick={() => void load()}>
                重试
              </Button>
              <BackToScores navigate={navigate} />
            </>
          }
        />
      </Frame>
    );
  }

  return (
    <Frame navigate={navigate}>
      {/* 与答题页、刚交卷结果同一个阅读工作区（审计 IOS-05）；返回在顶上，不用滚到最底 */}
      <ResultView
        result={phase.result}
        submissionId={phase.submissionId}
        onAuthLost={() => void load()}
        footer={<BackToScores navigate={navigate} />}
      />
    </Frame>
  );
}

/** 历史详情在「学习记录」这个 tab 里：顶上一个返回，内容用整宽给左右分栏。 */
function Frame({ children, navigate }: { children: React.ReactNode; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <main id="main" className="safe-x mx-auto w-full max-w-[1400px] pb-8 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="-ml-2 mb-2 flex min-h-[44px] items-center">
        <BackButton label="学习记录" onClick={() => navigate(ROUTES.scores)} />
      </div>
      {children}
    </main>
  );
}

function BackToScores({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <Button data-testid="back-to-scores" variant="neutral" block onClick={() => navigate(ROUTES.scores)} className="mt-4">
      回到学习记录
    </Button>
  );
}
