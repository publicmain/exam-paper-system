/**
 * 学习记录（IOS-09）—— 阅读答卷与正式单词测试，按类型分两块、按日期（服务端顺序）排列。
 *
 * 规矩（沿用阶段 11 的契约，外观按设计系统重做）：
 *   · 只读。三个 GET：阅读历史、旧版单词测验、新版正式词测。不读 `/lesson/today`。
 *   · 还在判分绝不补 0；分数放出来但没给数也不编；真的 0 分就显示 0。
 *   · 练习（practice）行不显示；自助抽查从来不进这里（它不留正式记录）。
 *   · 一块加载失败只影响那一块，另一块照常显示（审计 UI05 同一原则），给一个重试。
 *   · 返回靠标签栏（今日 / 我的单词 / 学习记录 / 账号），不在页面底部藏一个出口。
 *   · 错题本暂停：只在页脚留一句低干扰说明。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ReadingHistoryRow, type V2FormalTestRow, type VocabAttemptRow } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { levelLabel } from '../lib/levels';
import { ROUTES, scoreDetailPath } from '../routes.contract';
import { Badge } from '../design/Badge';
import { Button } from '../design/Button';
import { Group, Row, RowLink, Section } from '../design/List';
import { Page } from '../design/Page';
import { InlineStatus, StatusView } from '../design/Status';
import { Link } from 'react-router-dom';

/** 旧端需要、新端不显示的练习行 —— 纯函数，测试直接驱动。 */
export function formalRows(rows: ReadingHistoryRow[]): ReadingHistoryRow[] {
  return rows.filter((r) => r.status !== 'practice');
}

/** `MorningQuizSession.date` 是 UTC 零点 ISO 串 —— 只取日期部分，不做时区换算。 */
export function rowDay(row: ReadingHistoryRow): string | null {
  return row.date ? row.date.slice(0, 10) : null;
}

/** 分数那一句。**还在判分就说还在判分**，不补 0。 */
export function scoreLine(row: ReadingHistoryRow): string {
  if (row.scoresPending) {
    const r = row.releasedScore;
    return r && r.count > 0 ? `客观题 ${r.earned} / ${r.max} · 其余等老师批` : '还在判分';
  }
  if (row.totalScore == null || row.maxScore == null) return '还没有分数';
  return `${row.totalScore} / ${row.maxScore} 分`;
}

/** 完成状态只由 status / answersPending / reopenable 推出。 */
export function stateLine(row: ReadingHistoryRow): string {
  if (row.answersPending) {
    return row.reopenable ? '已提交 · 现在还能回去改' : '已提交 · 还没最终交卷';
  }
  return row.status === 'auto_closed' ? '被系统收尾了' : '已交卷';
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function dayText(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}月${d}日 ${WEEK[wd]}`;
}

type Part<T> = { s: 'loading' } | { s: 'error' } | { s: 'ready'; rows: T };
type Parts = {
  reading: Part<ReadingHistoryRow[]>;
  attempts: Part<VocabAttemptRow[]>;
  tests: Part<V2FormalTestRow[]>;
};

const LOADING: Parts = { reading: { s: 'loading' }, attempts: { s: 'loading' }, tests: { s: 'loading' } };

export default function ScoresPage() {
  const [parts, setParts] = useState<Parts>(LOADING);
  /** 请求代次 —— 卸载或重试之后，旧响应一律丢掉。 */
  const gen = useRef(0);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    const mine = ++gen.current;
    setParts(LOADING);
    const [history, quiz, v2] = await Promise.allSettled([
      api.readingHistory(token),
      api.vocabQuizAttempts(token),
      api.vocabV2Tests(token),
    ]);
    if (mine !== gen.current) return;
    for (const r of [history, quiz, v2]) {
      if (r.status === 'rejected' && handleAuthFailure(r.reason)) return;
    }
    setParts({
      reading: history.status === 'fulfilled' ? { s: 'ready', rows: formalRows(history.value.submissions ?? []) } : { s: 'error' },
      attempts: quiz.status === 'fulfilled' ? { s: 'ready', rows: quiz.value.attempts ?? [] } : { s: 'error' },
      tests: v2.status === 'fulfilled' ? { s: 'ready', rows: v2.value.tests ?? [] } : { s: 'error' },
    });
  }, []);

  useEffect(() => {
    void load();
    return () => {
      gen.current++;
    };
  }, [load]);

  const allLoading = parts.reading.s === 'loading' && parts.attempts.s === 'loading' && parts.tests.s === 'loading';
  const anyError = parts.reading.s === 'error' || parts.attempts.s === 'error' || parts.tests.s === 'error';

  return (
    <Page title="学习记录" subtitle="阅读答卷和正式单词测试分开记录。" width="wide" testId="scores-page">
      {allLoading ? (
        <StatusView kind="loading" title="载入中" />
      ) : (
        <>
          {anyError ? (
            <div className="mb-5">
              <InlineStatus tone="error">
                有一部分记录没加载出来，其余的照常显示。
                <span className="ml-1">
                  <Button size="sm" variant="plain" data-testid="retry" onClick={() => void load()} icon="refresh">
                    重试
                  </Button>
                </span>
              </InlineStatus>
            </div>
          ) : null}
          <div className="grid gap-x-8 lg:grid-cols-2">
            <ReadingSection part={parts.reading} />
            <QuizSection tests={parts.tests} attempts={parts.attempts} />
          </div>
          <p className="mt-2 px-1 text-footnote text-ink-3">
            错题本暂未开放。答错的题目在每份答卷的逐题回顾里都能看到。{' '}
            <Link to={ROUTES.mistakes} className="font-medium text-accent">
              了解详情
            </Link>
          </p>
        </>
      )}
    </Page>
  );
}

function ReadingSection({ part }: { part: Part<ReadingHistoryRow[]> }) {
  return (
    <Section title="阅读" id="reading" testId="reading-section">
      {part.s === 'loading' ? (
        <Group>
          <div className="px-4 py-5 text-callout text-ink-3">载入中…</div>
        </Group>
      ) : part.s === 'error' ? (
        <Group>
          <div className="px-4 py-5 text-callout text-danger">阅读记录没加载出来。</div>
        </Group>
      ) : part.rows.length === 0 ? (
        <Group>
          <div data-testid="reading-empty" className="px-4 py-5 text-callout text-ink-3">
            还没有阅读成绩。
          </div>
        </Group>
      ) : (
        <Group>
          {part.rows.map((row) => (
            <div key={row.submissionId} data-testid={`reading-row-${row.submissionId}`} data-row-id={row.submissionId}>
              <RowLink
                testId={`reading-link-${row.submissionId}`}
                to={scoreDetailPath(row.submissionId)}
                ariaLabel={`${row.paperName}，${dayText(rowDay(row)) ?? ''}，${scoreLine(row)}，${stateLine(row)}，看逐题回顾`}
                title={<span className="font-medium">{row.paperName}</span>}
                subtitle={
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {rowDay(row) ? <time dateTime={rowDay(row) ?? undefined} className="tabular-nums">{dayText(rowDay(row))}</time> : null}
                    {row.level ? <span>{levelLabel(row.level) ?? ''}</span> : null}
                    <span data-testid={`reading-state-${row.submissionId}`}>{stateLine(row)}</span>
                  </span>
                }
                value={
                  <span data-testid={`reading-score-${row.submissionId}`}>
                    {row.scoresPending ? (
                      <Badge tone="warning" icon="clock">
                        {scoreLine(row)}
                      </Badge>
                    ) : (
                      <span className="tabular-nums text-ink-2">{scoreLine(row)}</span>
                    )}
                  </span>
                }
              />
            </div>
          ))}
        </Group>
      )}
    </Section>
  );
}

function QuizSection({ tests, attempts }: { tests: Part<V2FormalTestRow[]>; attempts: Part<VocabAttemptRow[]> }) {
  const testRows = tests.s === 'ready' ? tests.rows : [];
  const attemptRows = attempts.s === 'ready' ? attempts.rows : [];
  const bothEmpty = tests.s === 'ready' && attempts.s === 'ready' && testRows.length === 0 && attemptRows.length === 0;
  return (
    <Section title="正式单词测试" id="quiz" testId="quiz-section" footer="自助抽查是个人练习，不留在这里。">
      {tests.s === 'loading' || attempts.s === 'loading' ? (
        <Group>
          <div className="px-4 py-5 text-callout text-ink-3">载入中…</div>
        </Group>
      ) : bothEmpty ? (
        <Group>
          <div data-testid="quiz-empty" className="px-4 py-5 text-callout text-ink-3">
            还没有单词测试成绩。
          </div>
        </Group>
      ) : (
        <div className="flex flex-col gap-3">
          {tests.s === 'error' ? (
            <Group>
              <div className="px-4 py-5 text-callout text-danger">正式单词测试记录没加载出来。</div>
            </Group>
          ) : testRows.length > 0 ? (
            <Group>
              <div data-testid="v2-test-list" className="list-inset">
                {testRows.map((t) => (
                  <div key={t.sessionId} data-testid={`v2-test-${t.sessionId}`}>
                    <RowLink
                      to={`${ROUTES.coachTest}?sessionId=${encodeURIComponent(t.sessionId)}`}
                      ariaLabel={`${dayText(t.date) ?? t.date} 的单词测试，答对 ${t.correct} / ${t.total}，看逐题回顾`}
                      title={<span className="font-medium tabular-nums">答对 {t.correct} / {t.total}</span>}
                      subtitle={<time dateTime={t.date} className="tabular-nums">{dayText(t.date) ?? t.date}</time>}
                    />
                  </div>
                ))}
              </div>
            </Group>
          ) : null}
          {attempts.s === 'error' ? (
            <Group>
              <div className="px-4 py-5 text-callout text-danger">旧版单词测验记录没加载出来。</div>
            </Group>
          ) : attemptRows.length > 0 ? (
            <div>
              <div className="mb-2 px-1 text-footnote text-ink-3">旧版单词测验（没有逐题回顾）</div>
              <Group>
                {attemptRows.map((a) => (
                  <div key={a.id} data-testid={`quiz-row-${a.id}`} data-row-id={a.id}>
                    <Row
                      title={<span className="font-medium tabular-nums">答对 {a.correct} / {a.total}</span>}
                      subtitle={
                        <span className="flex flex-wrap gap-x-2">
                          <span className="tabular-nums">{a.date}</span>
                          <span data-testid={`quiz-state-${a.id}`}>已交卷</span>
                        </span>
                      }
                      value={
                        <span className="tabular-nums">
                          得分 <span data-testid={`quiz-score-${a.id}`}>{a.score}</span>
                        </span>
                      }
                    />
                  </div>
                ))}
              </Group>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}
