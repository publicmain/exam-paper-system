/**
 * 考试中的查词卡（阶段 12C）。
 *
 * ## 它为什么曾经被摘掉，又为什么回来
 *
 * 旧端有过这张卡，阶段 7C 整体摘除 —— **不是因为功能不该有，而是因为它
 * 把学生姓名当身份写进生词本**，违反已冻结的身份契约。
 * 阶段 12C 把身份边界重写成 token-only 之后挂回来：
 * 查词与写本子都只带 Bearer，请求里**一个身份字段都没有**。
 *
 * ## 考试中查词，只屏蔽被考的那几个词
 *
 * 1.x 一刀切禁止考试中查词，理由是早测有词义题（「'shadow' 这个词暗示
 * 什么」），能查词等于送答案。这个顾虑**只对那几个被考的词成立**，对文章
 * 里另外七百多个词不成立。所以这里做精确屏蔽：`blocked` 由本卷题干算出
 * （调用方负责），点到考点词时**连查都不查**。
 *
 * 注意「不查」和「查了不显示」是两件事：后者的答案材料已经到了浏览器，
 * 任何人打开网络面板就能看见。所以屏蔽必须落在**发请求之前**。
 *
 * ## 查词与收藏是两件事
 *
 * 学生点词只代表「我想看看是什么意思」，不代表「我要把它加入生词本」。
 * 查词成功后只准备好收藏内容，必须由学生明确点「加入生词本」才写入；
 * 加入后也可以在同一张卡里移出。
 *
 * ## 写生词本要说实话
 *
 * 旧实现是「发了就当成了」（成功回调直接置位、失败回调空着）
 * —— 失败静默，学生以为存上了。这里三种结果分开说：
 *
 *   · `created: true`  → 存进去了
 *   · `created: false` → 本来就在本子里（**不是失败**）
 *   · 失败 / 形状不对  → 明说没存上，并给一个重试
 *
 * 重试**原样重发同一个请求体**：服务端按「学生 + headword」查重，同一个
 * 词提交两次只会拿到 `created: false`，所以不需要 requestId，也不该发明一个。
 *
 * ## 词义与语境分层
 *
 * 先让学生一眼看到「这个词是什么意思」，再用单独的「所在原句 / 整句翻译」
 * 区域帮他回到文章语境。英文词典释义收进可展开区，避免它与中文主词义
 * 抢视线。桌面 / iPad 是居中卡片，手机仍是好单手操作的底部抽屉。
 *
 * 原句中的标注用 React 节点拼，**不用 `dangerouslySetInnerHTML`**：那句话是服务端
 * 来的文本，不是可信标记。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type DictEntry } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

/** 考试标签的人话。认不出来的**不显示** —— 做题当下多一个陌生缩写没帮助。 */
const EXAM_TAGS: Readonly<Record<string, string>> = {
  ielts: '雅思',
  toefl: '托福',
  gre: 'GRE',
  cet4: '四级',
  cet6: '六级',
  gk: '高考',
  zk: '中考',
  ky: '考研',
};

export function usefulTags(tag: string[] | undefined): string[] {
  return (tag ?? []).map((t) => EXAM_TAGS[t]).filter((t): t is string => !!t);
}

/**
 * 把语境句里的目标词标出来。
 *
 * 词形可能与词典词条不同（looked / looking），所以按**学生点的那个词形**
 * 匹配；匹配不到就原样显示，**不做任何猜测**。
 */
export function highlightWord(sentence: string, surface: string): React.ReactNode {
  if (!sentence || !surface) return sentence;
  const i = sentence.toLowerCase().indexOf(surface.toLowerCase());
  if (i < 0) return sentence;
  return (
    <>
      {sentence.slice(0, i)}
      <mark className="bg-yellow-200 rounded px-0.5">{sentence.slice(i, i + surface.length)}</mark>
      {sentence.slice(i + surface.length)}
    </>
  );
}

/**
 * 服务端回执长得对不对。**整条都验**，形状不对一律按「没存上」处理。
 *
 * `headword` 不是可有可无的装饰：它是服务端**查过词典之后**定下来的那个
 * 词条（`looked` → `look`）。回执里没有它，说明服务端根本没走到那一步 ——
 * 这次到底记的是哪个词无从谈起。这种半截响应报成功，学生下次翻生词本
 * 找不到那个词，只会以为系统把东西弄丢了。
 *
 * 返工 1/2（B-1）：第一版只验了 `created`，于是 `{created:true}`、
 * `{created:true, headword:123}` 这些都被当成成功。
 */
export function addSucceeded(r: unknown): r is { created: boolean; headword: string } {
  if (!r || typeof r !== 'object') return false;
  const { created, headword } = r as { created?: unknown; headword?: unknown };
  if (typeof created !== 'boolean') return false;
  return typeof headword === 'string' && headword.trim().length > 0;
}

export type FillTarget = { questionId: string; label: string; hasValue: boolean } | null;

// ─────────────────────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────────────────────

type LookupPhase =
  | { s: 'idle' }
  | { s: 'loading' }
  | { s: 'ok'; entry: DictEntry }
  | { s: 'notFound' }
  | { s: 'failed' };

/** 写本子的三种结果 —— 与「查词」分开，因为查成功了写失败是常见组合。 */
type SavePhase =
  | { s: 'idle' }
  | { s: 'saving' }
  | { s: 'created'; headword: string }
  | { s: 'already'; headword: string }
  | { s: 'failed' }
  | { s: 'removing'; headword: string }
  | { s: 'removed' }
  | { s: 'removeFailed'; headword: string };

export function ExamWordSheet({
  word,
  contextSentence,
  passageTitle,
  blocked,
  fillTarget,
  onFill,
  onClose,
}: {
  /** null = 不显示这张卡。 */
  word: string | null;
  /** 该词在原文里所处的那句话。没有就不显示这一块。 */
  contextSentence?: string | null;
  /** 收录来源，只在写本子时带上；空串就不带。 */
  passageTitle?: string | null;
  /** 本卷考点词 —— **连查都不查**。 */
  blocked: boolean;
  fillTarget: FillTarget;
  onFill: (questionId: string, word: string, append: boolean) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<LookupPhase>({ s: 'idle' });
  const [save, setSave] = useState<SavePhase>({ s: 'idle' });

  /**
   * 请求代次。
   *
   * 换一个词、关掉卡片、卸载 —— 都让在途的响应作废。没有它的话，
   * 上一个词的迟到释义会画到这一个词的卡上，学生看到的是**张冠李戴的
   * 答案**，而且完全没有迹象说明它错了。
   */
  const gen = useRef(0);
  const saving = useRef(false);
  /** 待重发的写入体 —— 重试原样重发，不重新组装。 */
  const pendingAdd = useRef<{ word: string; contextSentence?: string; contextTranslation?: string; sourcePassageTitle?: string } | null>(null);

  /** 学生明确选择之后才记进生词本。 */
  const sendAdd = useCallback(async (mine: number) => {
    const body = pendingAdd.current;
    if (!body) return;
    const token = readToken();
    if (!token) return;
    if (saving.current) return;
    saving.current = true;
    setSave({ s: 'saving' });
    try {
      const r = await api.vocabAddWord(token, body);
      saving.current = false;
      if (mine !== gen.current) return;
      // **形状不对 = 没存上**，不因为 fetch resolve 了就报成功
      setSave(
        addSucceeded(r)
          ? (r.created ? { s: 'created', headword: r.headword } : { s: 'already', headword: r.headword })
          : { s: 'failed' },
      );
    } catch (e) {
      saving.current = false;
      if (handleAuthFailure(e)) return;
      if (mine !== gen.current) return;
      setSave({ s: 'failed' });
    }
  }, []);

  /** 已确认在本子里的词，学生也可以当场移出。 */
  const sendRemove = useCallback(async (mine: number, headword: string) => {
    const token = readToken();
    if (!token || saving.current) return;
    saving.current = true;
    setSave({ s: 'removing', headword });
    try {
      const r = await api.vocabWordRemove(token, { headword });
      saving.current = false;
      if (mine !== gen.current) return;
      setSave(r?.deleted === 1 ? { s: 'removed' } : { s: 'removeFailed', headword });
    } catch (e) {
      saving.current = false;
      if (handleAuthFailure(e)) return;
      if (mine !== gen.current) return;
      setSave({ s: 'removeFailed', headword });
    }
  }, []);

  const lookup = useCallback(
    async (w: string) => {
      const token = readToken();
      if (!token) return;
      const mine = ++gen.current;
      setPhase({ s: 'loading' });
      setSave({ s: 'idle' });
      pendingAdd.current = null;
      try {
        const r = await api.vocabLookup(token, w, contextSentence);
        if (mine !== gen.current) return;
        if (!r || r.found !== true || !r.entry) {
          setPhase({ s: 'notFound' });
          return;
        }
        setPhase({ s: 'ok', entry: r.entry });
        // 查到了才准备收藏内容；**这里不写库**，等学生自己点按钮。
        pendingAdd.current = {
          word: w,
          ...(contextSentence ? { contextSentence } : {}),
          ...(r.entry.contextTranslation ? { contextTranslation: r.entry.contextTranslation } : {}),
          ...(passageTitle ? { sourcePassageTitle: passageTitle } : {}),
        };
      } catch (e) {
        if (handleAuthFailure(e)) return;
        if (mine !== gen.current) return;
        setPhase({ s: 'failed' });
      }
    },
    [contextSentence, passageTitle],
  );

  useEffect(() => {
    // 关掉 / 换词 / 卸载 —— 在途响应一律作废
    gen.current++;
    saving.current = false;
    pendingAdd.current = null;
    if (!word) {
      setPhase({ s: 'idle' });
      setSave({ s: 'idle' });
      return;
    }
    if (blocked) {
      // **考点词：一个请求都不发**
      setPhase({ s: 'idle' });
      setSave({ s: 'idle' });
      return;
    }
    void lookup(word);
    return () => {
      gen.current++;
    };
  }, [word, blocked, lookup]);

  if (!word) return null;

  const tags = phase.s === 'ok' ? usefulTags(phase.entry.tag) : [];

  return (
    <div
      data-testid="word-sheet"
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-sheet-title"
        className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-2xl sm:rounded-[28px] lg:max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-5 shrink-0 sm:hidden flex items-center justify-center">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <header className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-1 sm:px-7 sm:pb-5 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {passageTitle ? (
                <div className="mb-1.5 truncate text-xs font-medium text-slate-400">
                  来自 · {passageTitle}
                </div>
              ) : null}
              <h2 id="word-sheet-title" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span data-testid="word-sheet-word" className="break-words text-[30px] font-semibold tracking-tight text-slate-950 sm:text-[34px]">
                  {word}
                </span>
                {phase.s === 'ok' && phase.entry.phonetic ? (
                  <span data-testid="word-sheet-phonetic" className="text-[15px] font-normal text-slate-500 sm:text-base">
                    /{phase.entry.phonetic}/
                  </span>
                ) : null}
              </h2>
            </div>
            <button
              type="button"
              data-testid="word-sheet-close"
              onClick={onClose}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-100 text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="min-h-[96px]">
            {blocked ? (
              <div
                data-testid="word-sheet-blocked"
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-[15px] text-amber-950"
              >
                <div className="font-medium">这个词是本卷的考点，考试期间不显示释义。</div>
                <div className="mt-1 text-[13px] text-amber-700">交卷后在成绩详情里可以看。</div>
              </div>
            ) : (
              <>
                {phase.s === 'loading' ? (
                  <div data-testid="word-sheet-loading" className="rounded-2xl bg-slate-50 px-4 py-5 text-[15px] text-slate-500">
                    正在查词和翻译原句…
                  </div>
                ) : null}
                {phase.s === 'notFound' ? (
                  <div data-testid="word-sheet-not-found" className="rounded-2xl bg-slate-50 px-4 py-5 text-[15px] text-slate-600">
                    本词典未收录这个词。
                  </div>
                ) : null}
                {phase.s === 'failed' ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4">
                    <div data-testid="word-sheet-failed" className="text-[15px] text-rose-700">
                      查询失败 —— 网络不太好。
                    </div>
                    <button
                      type="button"
                      data-testid="word-sheet-retry-lookup"
                      onClick={() => void lookup(word)}
                      className="mt-3 min-h-[44px] rounded-xl bg-blue-600 px-4 text-sm font-medium text-white"
                    >
                      重试
                    </button>
                  </div>
                ) : null}
                {phase.s === 'ok' ? (
                  <div className="space-y-5">
                    <section className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4 sm:px-5">
                      <div className="mb-1.5 text-xs font-semibold tracking-wide text-blue-600">词义</div>
                      <div
                        data-testid="word-sheet-translation"
                        className="whitespace-pre-wrap text-[18px] font-medium leading-relaxed text-slate-950 sm:text-[19px]"
                      >
                        {phase.entry.translation}
                      </div>
                    </section>

                    {contextSentence ? (
                      <section aria-label="所在原句" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
                        <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500">所在原句</div>
                        <p data-testid="word-sheet-sentence" className="font-serif text-[16px] leading-7 text-slate-800 sm:text-[17px]">
                          {highlightWord(contextSentence, word)}
                        </p>
                        {phase.entry.contextTranslation ? (
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <div className="mb-1 text-xs font-semibold tracking-wide text-slate-400">整句翻译</div>
                            <p data-testid="word-sheet-sentence-translation" className="text-[15px] leading-7 text-slate-700 sm:text-base">
                              {phase.entry.contextTranslation}
                            </p>
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {phase.entry.definition ? (
                      <details className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-5">
                        <summary className="cursor-pointer select-none text-sm font-medium text-slate-600">查看英文词典释义</summary>
                        <div
                          data-testid="word-sheet-definition"
                          className="mt-3 whitespace-pre-wrap border-t border-slate-200 pt-3 text-[14px] leading-relaxed text-slate-600 sm:text-[15px]"
                        >
                          {phase.entry.definition}
                        </div>
                      </details>
                    ) : null}

                    {tags.length > 0 ? (
                      <div data-testid="word-sheet-tags" className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pb-5">
          {/* 填空取词。屏蔽的是「释义」，不是「这个词存在于原文」，
              所以考点词也允许填。 */}
          {fillTarget ? (
            <button
              type="button"
              data-testid="word-sheet-fill"
              onClick={() => {
                onFill(fillTarget.questionId, word, fillTarget.hasValue);
                onClose();
              }}
              className="mb-2 min-h-[48px] w-full rounded-[14px] bg-blue-600 text-[17px] font-semibold text-white shadow-sm"
            >
              {fillTarget.hasValue ? `追加到${fillTarget.label}` : `填入${fillTarget.label}`}
            </button>
          ) : null}

          {/* 查词不自动收藏。加入、移出都必须是学生自己的明确动作。 */}
          {(save.s === 'idle' || save.s === 'removed') && phase.s === 'ok' ? (
            <div className="space-y-2">
              {save.s === 'removed' ? (
                <div data-testid="word-sheet-removed" className="text-[13px] font-medium text-slate-600">
                  已移出生词本
                </div>
              ) : null}
              <button
                type="button"
                data-testid="word-sheet-add"
                onClick={() => void sendAdd(gen.current)}
                className="min-h-[48px] w-full rounded-[14px] bg-blue-600 text-[16px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                {save.s === 'removed' ? '重新加入生词本' : '加入生词本'}
              </button>
              {save.s === 'idle' ? (
                <div className="text-center text-xs text-slate-400">只查词不会自动收藏</div>
              ) : null}
            </div>
          ) : null}
          {save.s === 'saving' ? (
            <button type="button" disabled className="min-h-[48px] w-full rounded-[14px] bg-slate-200 text-[15px] font-medium text-slate-500">
              正在加入…
            </button>
          ) : null}
          {save.s === 'created' || save.s === 'already' ? (
            <div className="flex items-center justify-between gap-3">
              <div data-testid="word-sheet-saved" className="flex items-center gap-2 text-[13px] font-medium text-emerald-700">
                <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-emerald-100 text-[11px]">✓</span>
                {save.s === 'created' ? '已存入生词本 · 以后会安排复习' : '已经在生词本里了'}
              </div>
              <button
                type="button"
                data-testid="word-sheet-remove"
                onClick={() => void sendRemove(gen.current, save.headword)}
                className="min-h-[44px] shrink-0 rounded-xl border border-slate-200 px-3 text-[13px] font-medium text-slate-600"
              >
                移出
              </button>
            </div>
          ) : null}
          {save.s === 'removing' ? (
            <div className="text-[13px] font-medium text-slate-500">正在移出…</div>
          ) : null}
          {save.s === 'failed' ? (
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span data-testid="word-sheet-save-failed" className="text-rose-600">
                没能存进生词本
              </span>
              <button
                type="button"
                data-testid="word-sheet-retry-save"
                onClick={() => void sendAdd(gen.current)}
                className="min-h-[44px] rounded-lg border border-slate-300 px-3 font-medium"
              >
                重试
              </button>
            </div>
          ) : null}
          {save.s === 'removeFailed' ? (
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span data-testid="word-sheet-remove-failed" className="text-rose-600">没能移出生词本</span>
              <button
                type="button"
                data-testid="word-sheet-retry-remove"
                onClick={() => void sendRemove(gen.current, save.headword)}
                className="min-h-[44px] rounded-lg border border-slate-300 px-3 font-medium"
              >
                重试
              </button>
            </div>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
