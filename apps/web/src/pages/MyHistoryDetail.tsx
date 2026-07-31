import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import AppealModal, { type AppealQuestionContext } from '../components/AppealModal';
import { formatCNDateTime } from '../lib/dateCN';
import { Spinner } from '../components/AsyncState';
import { prettifyPaperName, commonStemPrefix, stripStemPrefix } from '../lib/paperName';
import { TappablePassage } from '../components/vocab/TappablePassage';

/**
 * Public per-submission per-question detail page. Public, IP-gated
 * (school WiFi) + name-matched on the server. Reached from /my-history.
 *
 * Mirrors the existing /student/result/:sessionId page but doesn't
 * require a fresh login — the student types their name on /my-history,
 * clicks into a row, and lands here.
 */

interface ResultItem {
  paperQuestionId: string;
  sortOrder: number;
  marks: number;
  questionType: string;
  snapshotContent: any;
  snapshotOptions: Array<{ key: string; text: string }> | null;
  studentAnswer: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  awardedMarks: number | null;
  autoCorrect: boolean | null;
  isCorrect: boolean | null;
  markerComment: string | null;
  // Source of markerComment: 'teacher' (human marker — the norm) vs 'ai'
  // (AI-grader fallback). Drives the comment label. Older API responses may
  // omit it → treated as teacher.
  commentSource?: 'teacher' | 'ai' | null;
  // Full mark-scheme text for non-MCQ review. Display-only — never affects
  // the ✓/✗ correctness rendering.
  referenceAnswer?: string | null;
}

interface ResultPayload {
  sessionId: string;
  paperName: string;
  status: string;
  autoScore: number | null;
  manualScore: number | null;
  totalScore: number | null;
  maxScore: number;
  submittedAt: string | null;
  items: ResultItem[];
}

export default function MyHistoryDetail() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [params] = useSearchParams();
  const name = params.get('name') ?? '';
  const studentId = params.get('studentId') ?? '';
  const [data, setData] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // F10 — open AppealModal for either the whole paper (paperQuestionId
  // undefined) or one specific question (full context inlined).
  const [appealTarget, setAppealTarget] = useState<
    | { kind: 'paper' }
    | { kind: 'question'; paperQuestionId: string; ctx: AppealQuestionContext }
    | null
  >(null);

  useEffect(() => {
    if (!submissionId || !name) return;
    api
      .morningQuizHistoryDetail({ submissionId, name })
      .then((r) => setData(r as ResultPayload))
      .catch((e: any) => {
        const msg = String(e?.message ?? e);
        if (msg.includes('name_mismatch') || msg.includes('Forbidden')) {
          setError('姓名不匹配 — Name does not match this submission.');
        } else if (msg.includes('not_found') || msg.includes('Not Found')) {
          setError('找不到这份提交 / 已被删除');
        } else {
          setError(msg);
        }
      });
  }, [submissionId, name]);

  // 生词本 P2 —— 已在本子里的词（原形），用于点词卡按钮显示「已加入」。
  // 拉取失败不影响复盘页任何功能，静默降级为空集。
  const [vocabWords, setVocabWords] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    api
      .vocabList({ name, studentId: studentId || undefined })
      .then((r: any) => {
        if (!cancelled) setVocabWords(new Set((r?.words ?? []).map((w: any) => w.headword)));
      })
      .catch(() => { /* 生词本不可用时静默降级 */ });
    return () => { cancelled = true; };
  }, [name, studentId]);

  const backToHistory = `/my-history?name=${encodeURIComponent(name)}`;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto py-12 px-6 text-center">
          <div className="text-rose-700 text-lg mb-4" role="alert">⚠️ {error}</div>
          <Link className="text-sm text-blue-600 underline" to={backToHistory}>← 返回我的记录</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Spinner label="加载中…" />
      </div>
    );
  }

  // The long "Read the narrative… Qn." preamble repeats on every
  // Section-B question's stem; pull the shared part out so we can show it
  // once at the top instead of burying each question under it.
  const commonIntro = commonStemPrefix(
    data.items.map((it) => {
      const sc = it.snapshotContent ?? {};
      return typeof sc.stem === 'string'
        ? sc.stem
        : typeof sc.text === 'string'
        ? sc.text
        : '';
    }),
  );
  // 生词本 P1 —— 从任意一题的 snapshotContent 里取出文章原文。
  // 一份卷子的所有题共享同一篇 passage（Exercise 2 的指引段除外，它很短，
  // 这里取最长的一个即为正文）。后端 redactSnapshotForStudent 保留了 passage。
  const passage = (() => {
    let best: { text: string; title: string | null } | null = null;
    for (const it of data.items) {
      const sc = it.snapshotContent ?? {};
      const t = typeof sc.passage === 'string' ? sc.passage : '';
      if (t.length > (best?.text.length ?? 0)) {
        best = { text: t, title: typeof sc.passageTitle === 'string' ? sc.passageTitle : null };
      }
    }
    return best && best.text.length > 200 ? best : null;
  })();

  const score = data.totalScore ?? data.autoScore ?? 0;
  const max = data.maxScore || 1;
  const pct = Math.round((score / max) * 100);
  const pctColor =
    pct >= 80 ? 'text-emerald-700' :
    pct >= 60 ? 'text-blue-700' :
    pct >= 40 ? 'text-amber-700' : 'text-rose-700';

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link to={backToHistory} className="text-sm text-blue-600 hover:underline">
            ← 返回我的记录
          </Link>
          {/* F10 — whole-paper appeal entry point. The modal handles
              graceful 404 if the backend hasn't deployed /appeals yet. */}
          <button
            type="button"
            onClick={() => setAppealTarget({ kind: 'paper' })}
            className="text-xs px-3 py-1.5 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium"
          >
            🚩 申诉整张卷 · Appeal whole paper
          </button>
        </div>

        <header className="bg-white rounded-xl border shadow-sm p-5">
          <div className="text-sm text-gray-500">{prettifyPaperName(data.paperName)}</div>
          <div className={`text-4xl font-bold mt-2 ${pctColor}`}>
            {score}<span className="text-2xl text-gray-500 font-normal"> / {max}</span>
            <span className={`text-base ml-2 ${pctColor}`}>({pct}%)</span>
          </div>
          {data.items.some((it) => it.questionType !== 'mcq' && it.awardedMarks == null) && (
            <div className="mt-3 text-sm rounded-lg bg-sky-50 border border-sky-200 text-sky-800 px-3 py-2">
              ⏳ 选择题已即时评分;<strong>简答题正由老师人工批改</strong>,批改完成后总分会更新,请稍后再来查看。
            </div>
          )}
          {data.submittedAt && (
            <div className="text-xs text-gray-500 mt-2">
              提交时间:{formatCNDateTime(data.submittedAt)}
            </div>
          )}
        </header>

        {/* 生词本 P1 — 复盘时重读原文，并可点词查义。
            ⚠️ 只在这里（交卷后）开放；考试进行中禁用，否则词义题直接送答案。
            见 docs/PRD/vocabulary-notebook.md §2.2。 */}
        {passage && (
          <section className="bg-white rounded-xl border shadow-sm p-5">
            <TappablePassage
              text={passage.text}
              title={passage.title}
              addedWords={vocabWords}
              onAdd={async ({ headword, surfaceForm, contextSentence }) => {
                // 乐观更新：先标记已加入，失败再回滚 —— 网络慢时不让学生等
                setVocabWords((prev) => new Set(prev).add(headword));
                try {
                  await api.vocabAdd({
                    studentName: name,
                    studentId: studentId || undefined,
                    word: surfaceForm,
                    contextSentence,
                    sourcePassageTitle: passage.title ?? undefined,
                  });
                } catch {
                  setVocabWords((prev) => {
                    const n = new Set(prev);
                    n.delete(headword);
                    return n;
                  });
                }
              }}
            />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 px-1">逐题回顾</h2>
          {commonIntro && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              <div className="text-xs font-semibold text-gray-500 mb-1">
                试卷说明 · Instructions
              </div>
              {commonIntro}
            </div>
          )}
          {data.items.map((it) => (
            <ResultRow
              key={it.paperQuestionId}
              item={it}
              commonIntro={commonIntro}
              onAppeal={(ctx) =>
                setAppealTarget({
                  kind: 'question',
                  paperQuestionId: it.paperQuestionId,
                  ctx,
                })
              }
            />
          ))}
        </section>

        {appealTarget && submissionId && (
          <AppealModal
            submissionId={submissionId}
            paperQuestionId={
              appealTarget.kind === 'question' ? appealTarget.paperQuestionId : undefined
            }
            studentName={name}
            studentId={studentId || undefined}
            questionContext={
              appealTarget.kind === 'question' ? appealTarget.ctx : undefined
            }
            onClose={() => setAppealTarget(null)}
          />
        )}
      </main>
    </div>
  );
}

function ResultRow({
  item,
  onAppeal,
  commonIntro,
}: {
  item: ResultItem;
  onAppeal: (ctx: AppealQuestionContext) => void;
  commonIntro: string;
}) {
  const sc = item.snapshotContent ?? {};
  const rawStem: string =
    typeof sc.stem === 'string' ? sc.stem :
    typeof sc.text === 'string' ? sc.text : '';
  const stem = stripStemPrefix(rawStem, commonIntro);
  const isMcq = item.questionType === 'mcq';
  const isCorrect = item.isCorrect ?? item.autoCorrect;
  const awarded = item.awardedMarks;
  const showAwarded = awarded != null;
  // A written (non-MCQ) answer with no mark yet is waiting for the teacher
  // to grade it by hand — show that clearly instead of a bare "—" / no
  // score, which reads as "you got zero". (Grading is teacher-done, never
  // described as AI.)
  const isPending = !isMcq && awarded == null;
  // F10 — appeal eligibility: any row where the auto-grader said wrong OR
  // where the student scored less than full marks. Also enabled for null
  // (manual-mark-pending) so students can still flag a misgraded short
  // answer once it gets a score they disagree with.
  const canAppeal =
    item.autoCorrect === false ||
    (awarded != null && awarded < item.marks);
  const correctTone =
    isPending ? 'border-sky-200 bg-sky-50' :
    isCorrect === true ? 'border-emerald-300 bg-emerald-50' :
    isCorrect === false ? 'border-rose-300 bg-rose-50' :
    'border-gray-200 bg-white';
  const icon = isPending ? '⏳' : isCorrect === true ? '✓' : isCorrect === false ? '✗' : '—';
  const iconColor = isPending ? 'text-sky-600' : isCorrect === true ? 'text-emerald-700' : isCorrect === false ? 'text-rose-700' : 'text-gray-400';

  return (
    <div className={`border rounded-lg p-4 ${correctTone}`}>
      <div className="flex items-start gap-3">
        <div className={`text-2xl font-bold ${iconColor} shrink-0`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <span>Q{item.sortOrder}</span>
            <span className="px-1.5 py-0.5 bg-gray-100 rounded">{item.questionType}</span>
            <span>[{item.marks} mark{item.marks !== 1 ? 's' : ''}]</span>
            {showAwarded && (
              <span className="font-mono">得分:{awarded} / {item.marks}</span>
            )}
            {isPending && (
              <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">
                ⏳ 待老师批改 · Pending teacher marking
              </span>
            )}
          </div>
          {stem && <div className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{stem}</div>}
          {isMcq && item.snapshotOptions && (
            <div className="text-xs text-gray-600 mb-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {item.snapshotOptions.map((o) => {
                const isSelected = String(item.studentAnswer ?? '').trim().toLowerCase() === String(o.key).toLowerCase();
                const isCorrectOpt = String(item.correctAnswer ?? '').trim().toLowerCase() === String(o.key).toLowerCase();
                return (
                  <div
                    key={o.key}
                    className={`px-2 py-1 rounded ${
                      isCorrectOpt ? 'bg-emerald-100 text-emerald-800' :
                      isSelected ? 'bg-rose-100 text-rose-800' : 'bg-white border'
                    }`}
                  >
                    <span className="font-mono mr-1">{o.key}.</span>
                    {o.text}
                    {isSelected && ' ← 我的答案'}
                    {isCorrectOpt && ' ✓ 正确'}
                  </div>
                );
              })}
            </div>
          )}
          {!isMcq && (
            <div className="text-xs text-gray-600 space-y-1">
              <div>
                <span className="text-gray-500">我的答案:</span>{' '}
                <span className="text-gray-800">
                  {item.studentAnswer ? item.studentAnswer : <em className="text-gray-400">(空答)</em>}
                </span>
              </div>
              {(item.referenceAnswer ?? item.correctAnswer) && (
                <div className="mt-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                  <span className="font-semibold text-emerald-800">参考答案 · Model answer:</span>{' '}
                  <span className="text-emerald-900 whitespace-pre-wrap">
                    {item.referenceAnswer ?? item.correctAnswer}
                  </span>
                </div>
              )}
            </div>
          )}
          {item.markerComment && (
            <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
              <span className="font-semibold">老师评语:</span>{' '}
              {item.markerComment}
            </div>
          )}
          {item.explanation && (
            <div className="mt-2 text-xs text-gray-600 italic">{item.explanation}</div>
          )}
          {/* F10 — per-question appeal. Shown only where the row was
              marked wrong or partial; "submit" path goes through the
              shared AppealModal, which gracefully degrades on 404. */}
          {canAppeal && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() =>
                  onAppeal({
                    sortOrder: item.sortOrder,
                    stem,
                    studentAnswer: item.studentAnswer,
                    correctAnswer: item.correctAnswer,
                    marks: item.marks,
                    awardedMarks: item.awardedMarks,
                  })
                }
                className="text-xs px-2 py-1 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium"
              >
                🚩 申诉这题 · Appeal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
