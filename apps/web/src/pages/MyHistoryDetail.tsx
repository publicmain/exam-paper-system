import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { track } from '../lib/track';
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
  /** 2026-08-14 新政：交卷即见答案，分数评语等老师判分定稿后下发。
   *  true = 服务端已把分数/对错/评语剥掉，本页只展示答案对照。 */
  scoresPending?: boolean;
  /** 答案还没公布 —— 这份是「暂存提交」，学生今天 16:00-17:30 还能
   *  回来改，改完点「交卷并看答案」才给答案。 */
  answersPending?: boolean;
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

  // 错题本「看原文」带 #q-<paperQuestionId> 跳进来。数据是异步加载的，
  // 浏览器原生锚点在渲染时找不到目标，所以数据到位后手动滚一次，
  // 并给那道题一个短暂的高亮 —— 学生要找的就是这一道，不能让他
  // 在 13 道题里自己翻（8000px 的页面，实测根本找不到）。
  useEffect(() => {
    if (!data || !location.hash.startsWith('#q-')) return;
    const el = document.getElementById(location.hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.style.transition = 'box-shadow 0.4s';
    el.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.55)';
    el.style.borderRadius = '12px';
    const t = setTimeout(() => { el.style.boxShadow = 'none'; }, 2200);
    return () => clearTimeout(t);
  }, [data]);

  useEffect(() => {
    if (!submissionId || !name) return;
    api
      .morningQuizHistoryDetail({ submissionId, name })
      .then((r) => {
        setData(r as ResultPayload);
        // P6 埋点：submission_detail 才是"他真的在复盘"的信号 ——
        // 打开成绩列表可能只是交卷后被自动带过来的，点进逐题详情
        // 必须手动点。两个指标一起看才知道有多少人真的往里走了。
        track('submission_detail', name);
      })
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
          {data.scoresPending ? (
            <>
              <div className="text-3xl font-bold mt-2 text-gray-400">— / {max}</div>
              {data.answersPending ? (
                // 暂存提交。学生最需要知道的两件事：答案为什么没有、
                // 什么时候能拿到。不写清楚的话，他会以为系统坏了。
                <div className="mt-3 text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
                  📝 答卷已保存,<strong>今天 16:00–17:30 可以回来继续答或修改</strong>。
                  <div className="mt-1 text-amber-800">
                    回来的方式：<strong>再扫一次教室墙上那张二维码</strong>,就会回到这份答卷继续答。
                  </div>
                  <div className="mt-1 text-amber-800">
                    答案要等你按「交卷并看答案」之后才公布 —— 先看答案再改就没有意义了。
                    到 17:30 仍未交的会自动交卷并公布答案。
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2">
                  ✅ 已交卷,<strong>每道题的答案已公布</strong>,可以对照下方复盘。
                  得分与老师评语将在人工批改完成后显示。
                </div>
              )}
            </>
          ) : (
            <div className={`text-4xl font-bold mt-2 ${pctColor}`}>
              {score}<span className="text-2xl text-gray-500 font-normal"> / {max}</span>
              <span className={`text-base ml-2 ${pctColor}`}>({pct}%)</span>
            </div>
          )}
          {!data.scoresPending && data.items.some(
            (it) => it.questionType !== 'mcq' && it.awardedMarks == null && hasWrittenAnswer(it),
          ) && (
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
            <div key={it.paperQuestionId} id={`q-${it.paperQuestionId}`}>
            <ResultRow
              item={it}
              scoresPending={!!data.scoresPending}
              commonIntro={commonIntro}
              onAppeal={(ctx) =>
                setAppealTarget({
                  kind: 'question',
                  paperQuestionId: it.paperQuestionId,
                  ctx,
                })
              }
            />
            </div>
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

/**
 * 这道题学生有没有写东西。
 *
 * 关键：**没作答的题在数据库里根本没有答题记录行**，接口是拿试卷题目
 * 补出来的，于是 awardedMarks 是 null —— 和「写了但还没判」长得一模
 * 一样。只看 awardedMarks 会把空白题显示成「正在人工批改」，而这个班
 * 空白率很高，等于绝大多数复盘页都永久挂着一条假横幅
 * （2026-08-12 叶雅滋 Q12 即如此）。
 */
/**
 * 老师评语里的记账前缀和 markdown 都不该出现在学生眼前。
 *
 * 判分时写的是给自己看的流水：「填11:patchwork,判对。1。」——题号、
 * 学生答案、判定、分数，这四样卡片上都已经显示了，重复一遍只会把真正
 * 的讲解挤到后面。markdown 的 ** 更是直接以星号原样印在屏幕上
 * （2026-08-13 叶雅滋 Q11 实例）。
 */
export function cleanComment(raw: string | null | undefined): string {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  // 记账前缀：填11:xxx,判对。1。 / 段3:B,正解 F。0。 / Q4:
  s = s.replace(
    /^(?:填|段|Q)\s*\d+(?:\([ivx]+\))?\s*[:：][^。]*?(?:判对|正解[^。]*)?。\s*\d+(?:\.\d+)?。\s*/,
    '',
  );
  s = s.replace(/^(?:填|段|Q)\s*\d+(?:\([ivx]+\))?\s*[:：]\s*/, '');
  // markdown 粗体/斜体标记：终端里是强调，屏幕上就是一堆星号
  s = s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(?<!\*)\*(?!\*)/g, '');
  return s.trim();
}

export function hasWrittenAnswer(it: { studentAnswer?: unknown }): boolean {
  const a = it.studentAnswer;
  if (a == null) return false;
  return typeof a === 'string' ? a.trim() !== '' : true;
}

function ResultRow({
  item,
  onAppeal,
  commonIntro,
  scoresPending = false,
}: {
  item: ResultItem;
  onAppeal: (ctx: AppealQuestionContext) => void;
  commonIntro: string;
  /** 2026-08-14 新政：true = 判分未定稿。本行只做「答案对照」——
   *  不显示 ✓/✗/⏳/得分/评语（服务端也没下发），避免把每道题都
   *  渲染成「待老师批改」的刷屏。 */
  scoresPending?: boolean;
}) {
  const sc = item.snapshotContent ?? {};
  const rawStem: string =
    typeof sc.stem === 'string' ? sc.stem :
    typeof sc.text === 'string' ? sc.text : '';
  const stem = stripStemPrefix(rawStem, commonIntro);
  const isMcq = item.questionType === 'mcq';
  // 判过分之后，对错一律以分数为准。autoCorrect 是交卷时自动比对的
  // 结果，老师改判后它不会跟着变 —— 2026-08-13 叶雅滋 Q11 就是：
  // patchwork 判对给了 1/1，卡片却因为 autoCorrect=false 显示红叉。
  const gradedCorrect =
    item.awardedMarks != null ? item.awardedMarks >= item.marks : null;
  const isCorrect = gradedCorrect ?? item.isCorrect ?? item.autoCorrect;
  /** 长答题常见的「拿了一半」——既不该是绿勾也不该是红叉 */
  const isPartial =
    item.awardedMarks != null && item.awardedMarks > 0 && item.awardedMarks < item.marks;
  const awarded = item.awardedMarks;
  const showAwarded = awarded != null;
  // A written (non-MCQ) answer with no mark yet is waiting for the teacher
  // to grade it by hand — show that clearly instead of a bare "—" / no
  // score, which reads as "you got zero". (Grading is teacher-done, never
  // described as AI.)
  const isBlank = !isMcq && !hasWrittenAnswer(item);
  const isPending = !scoresPending && !isMcq && awarded == null && !isBlank;
  // F10 — appeal eligibility: any row where the auto-grader said wrong OR
  // where the student scored less than full marks. Also enabled for null
  // (manual-mark-pending) so students can still flag a misgraded short
  // answer once it gets a score they disagree with.
  const canAppeal =
    item.autoCorrect === false ||
    (awarded != null && awarded < item.marks);
  const correctTone =
    isPending ? 'border-sky-200 bg-sky-50' :
    isBlank ? 'border-gray-200 bg-gray-50' :
    isPartial ? 'border-amber-300 bg-amber-50' :
    isCorrect === true ? 'border-emerald-300 bg-emerald-50' :
    isCorrect === false ? 'border-rose-300 bg-rose-50' :
    'border-gray-200 bg-white';
  const icon = isPending ? '⏳' : isBlank ? '—' : isPartial ? '◐' : isCorrect === true ? '✓' : isCorrect === false ? '✗' : '—';
  const iconColor = isPending ? 'text-sky-600' : isPartial ? 'text-amber-600' : isCorrect === true ? 'text-emerald-700' : isCorrect === false ? 'text-rose-700' : 'text-gray-400';

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
            {isBlank && (
              <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-medium">
                未作答 · Not answered
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
          {cleanComment(item.markerComment) && (
            <div className="mt-2 text-[13px] leading-relaxed text-gray-900 bg-blue-50 border border-blue-200 rounded p-2.5 whitespace-pre-wrap">
              <span className="font-semibold text-blue-800">老师评语</span>{'　'}
              {cleanComment(item.markerComment)}
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
