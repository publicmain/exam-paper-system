/**
 * `/scores` —— 历史成绩（阶段 11）。
 *
 * 同一外壳里的**独立页面**，不是七步链的一环：随时能进，进了也不改变今天
 * 的课走到哪一步。所以它**不读 `/lesson/today`** —— 一读就把「看历史」和
 * 「今天走到哪」绑在了一起，而它们本来毫无关系。
 *
 * ## 两段，分开
 *
 * 阅读成绩来自 `GET /morning-quiz/history-by-name`，正式单词测试成绩来自
 * `GET /vocab/quiz/attempts`。**它们是两条互不相干的记录**，页面把它们
 * 摆成两个区块，**绝不按日期拼成一条**「那天的成绩」——
 *
 * 拼起来看着整齐，但那是前端凭日期臆造的关联：一天可能只考了阅读没做单词，
 * 也可能补做的单词测试落在另一天；一旦拼错，学生看到的是一份从来不存在的
 * 成绩单，而且没有任何办法发现它错了。分开显示是**不好看但诚实**的那一种。
 *
 * ## practice 不是成绩
 *
 * 后端的 `history-by-name` 会带上 `status: 'practice'` 的行（旧端要做练习
 * 回放）。**新端一条都不显示** —— 练习是另一条产品线，混进成绩列表会让
 * 学生把自己随便点开重做的一遍当成正式成绩。
 *
 * ## 分数照搬
 *
 * 服务端说「还在判分」就说还在判分，**绝不补一个 0**；真的 0 分要如实显示
 * 成 0。正式测试那一段的分数直接用服务端的 `score`（交卷时算一次就冻住），
 * **不拿 `correct / total` 重算** —— 两边一旦对不上，前端重算只会造出第二
 * 套成绩。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  api,
  type ReadingHistoryRow,
  type VocabAttemptRow,
} from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES, scoreDetailPath } from '../routes.contract';
import { Button, Card, Notice, Screen } from '../ui';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

/**
 * 只留正式答卷。
 *
 * **顺序原样保留** —— 服务端已经按 `submittedAt desc` 排好，前端再排一次
 * 就等于用一个可能不同的口径覆盖它（比如 `date` 为 null 的行会跳到头）。
 */
export function formalRows(rows: ReadingHistoryRow[]): ReadingHistoryRow[] {
  return rows.filter((r) => r.status !== 'practice');
}

/**
 * 一行显示哪一天。
 *
 * `date` 是 `MorningQuizSession.date`（Prisma `@db.Date`），序列化成 UTC
 * 零点的 ISO 串，所以取前十位**就是**库里存的那个日历日 —— 不是时区换算，
 * 是读出原值。没有 session 的答卷（`date: null`）**不编日期**。
 */
export function rowDay(row: ReadingHistoryRow): string | null {
  return row.date ? row.date.slice(0, 10) : null;
}

/**
 * 分数那一句。**五种情况，一种都不许含混过去**（与今日总结同一套口径）。
 */
export function scoreLine(row: ReadingHistoryRow): string {
  if (row.scoresPending) return '还在判分';
  if (row.totalScore == null || row.maxScore == null) return '还没有分数';
  return `${row.totalScore} / ${row.maxScore} 分`;
}

/**
 * 完成状态那一句。
 *
 * **只看服务端下发的三个字段** —— `status` / `answersPending` /
 * `reopenable`。不把阅读和单词凑成一个「今天全部完成」：那是另一层语义，
 * 服务端没说过，前端不能造。
 */
export function stateLine(row: ReadingHistoryRow): string {
  if (row.answersPending) {
    return row.reopenable ? '已提交 · 现在还能回去改' : '已提交 · 还没最终交卷';
  }
  return row.status === 'auto_closed' ? '被系统收尾了' : '已交卷';
}

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

type Data = { reading: ReadingHistoryRow[]; attempts: VocabAttemptRow[] };

type Phase =
  | { s: 'loading' }
  | { s: 'error'; message: string }
  | { s: 'ready'; data: Data };

export default function ScoresPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });

  /** 请求代次 —— 与 `Today.tsx` / `LessonSummary.tsx` 同一套。 */
  const gen = useRef(0);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    const mine = ++gen.current;
    setPhase({ s: 'loading' });
    try {
      // 两条互不依赖 —— 并发发，各一次。
      const [history, quiz] = await Promise.all([
        api.readingHistory(token),
        api.vocabQuizAttempts(token),
      ]);
      if (mine !== gen.current) return;
      setPhase({
        s: 'ready',
        data: {
          reading: formalRows(history.submissions ?? []),
          attempts: quiz.attempts ?? [],
        },
      });
    } catch (e) {
      if (mine !== gen.current) return;
      if (handleAuthFailure(e)) return;
      // 网络 / 服务端故障 —— **留着票**，停在这一页给一个重试
      setPhase({ s: 'error', message: '没能打开历史成绩 —— 网络不太好，重试一下。' });
    }
  }, []);

  useEffect(() => {
    void load();
    // 卸载后让在途响应作废
    return () => {
      gen.current++;
    };
  }, [load]);

  if (phase.s === 'loading') {
    return (
      <Screen>
        <p className="text-center text-slate-400">载入中…</p>
      </Screen>
    );
  }

  if (phase.s === 'error') {
    return (
      <Screen>
        <Card>
          <Notice kind="error">{phase.message}</Notice>
          <Button onClick={() => void load()}>
            <span data-testid="retry">重试</span>
          </Button>
          <BackToToday navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  const { reading, attempts } = phase.data;

  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-semibold mb-1">历史成绩</h1>
        <p className="text-sm text-slate-500 mb-5">阅读和单词测试是两份记录，分开看。</p>

        {/* ① 阅读 */}
        <section data-testid="reading-section" className="mb-6">
          <h2 className="text-base font-medium mb-2">阅读</h2>
          {reading.length === 0 ? (
            <p data-testid="reading-empty" className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              还没有阅读成绩。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {reading.map((row) => (
                <li
                  key={row.submissionId}
                  data-testid={`reading-row-${row.submissionId}`}
                  data-row-id={row.submissionId}
                  className="rounded-xl bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{row.paperName}</span>
                    {rowDay(row) ? (
                      <span className="text-slate-500 tabular-nums shrink-0">{rowDay(row)}</span>
                    ) : null}
                  </div>
                  <p data-testid={`reading-score-${row.submissionId}`} className="mt-1 text-sm text-slate-700">
                    {scoreLine(row)}
                  </p>
                  <p data-testid={`reading-state-${row.submissionId}`} className="mt-1 text-sm text-slate-500">
                    {stateLine(row)}
                  </p>
                  <Link
                    data-testid={`reading-link-${row.submissionId}`}
                    to={scoreDetailPath(row.submissionId)}
                    className="mt-2 inline-block text-sm text-blue-600 underline"
                  >
                    看逐题回顾 →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ② 正式单词测试 —— 这一版没有逐题回顾，所以没有详情入口 */}
        <section data-testid="quiz-section">
          <h2 className="text-base font-medium mb-2">正式单词测试</h2>
          {attempts.length === 0 ? (
            <p data-testid="quiz-empty" className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              还没有单词测试成绩。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {attempts.map((a) => (
                <li
                  key={a.id}
                  data-testid={`quiz-row-${a.id}`}
                  data-row-id={a.id}
                  className="rounded-xl bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium tabular-nums">
                      答对 {a.correct} / {a.total}
                    </span>
                    <span className="text-slate-500 tabular-nums shrink-0">{a.date}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    得分{' '}
                    <span data-testid={`quiz-score-${a.id}`} className="tabular-nums">
                      {a.score}
                    </span>
                  </p>
                  <p data-testid={`quiz-state-${a.id}`} className="mt-1 text-sm text-slate-500">
                    已交卷
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <BackToToday navigate={navigate} />
      </Card>
    </Screen>
  );
}

function BackToToday({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button
      type="button"
      data-testid="back-to-today"
      onClick={() => navigate(ROUTES.today)}
      className="mt-6 w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      回到今天的课
    </button>
  );
}
