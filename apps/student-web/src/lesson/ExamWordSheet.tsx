/**
 * 考试中的查词卡（阶段 12C）。
 *
 * ## 它为什么曾经被摘掉，又为什么回来
 *
 * 旧端有过这张卡，阶段 7C 整体摘除 —— **不是因为功能不该有，而是因为它
 * 把学生姓名当身份写进生词本**，违反已冻结的身份契约。
 * 阶段 12C 把身份边界重写成 token-only 之后挂回来：
 * 查词与加入「我的单词」都只带 Bearer，请求里**一个身份字段都没有**。
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
 * ## 查词与收录是两件事
 *
 * 学生点词只代表「我想看看是什么意思」，不代表「我要把它加入我的单词」。
 * 查词成功后只展示结果，必须由学生明确选择「加入我的单词」、
 * 「我已经会了」、「稍后再学」或「只查一下」。所有收录都通过 V2 统一数据，
 * 不再同时写入旧生词本。
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
  /** 收录来源，只在学生选择加入时带上；空串就不带。 */
  passageTitle?: string | null;
  /** 本卷考点词 —— **连查都不查**。 */
  blocked: boolean;
  fillTarget: FillTarget;
  onFill: (questionId: string, word: string, append: boolean) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<LookupPhase>({ s: 'idle' });
  const [coachChoice, setCoachChoice] = useState<'idle' | 'saving' | 'learn' | 'known' | 'later' | 'lookup_only' | 'failed'>('idle');

  /**
   * 请求代次。
   *
   * 换一个词、关掉卡片、卸载 —— 都让在途的响应作废。没有它的话，
   * 上一个词的迟到释义会画到这一个词的卡上，学生看到的是**张冠李戴的
   * 答案**，而且完全没有迹象说明它错了。
   */
  const gen = useRef(0);
  const saving = useRef(false);
  /** 查词之后由学生明确决定是否进入 V2；查询本身绝不自动收藏。 */
  const chooseCoachAction = useCallback(async (
    mine: number,
    action: 'learn' | 'known' | 'later' | 'lookup_only',
    entry: DictEntry,
  ) => {
    const token = readToken();
    if (!token || saving.current) return;
    saving.current = true;
    setCoachChoice('saving');
    try {
      const result = await api.vocabV2Collect(token, {
        headword: entry.word || word || '',
        action,
        source: 'reading_lookup',
        ...(contextSentence ? { contextSentence } : {}),
        ...(entry.contextTranslation ? { contextTranslation: entry.contextTranslation } : {}),
        ...(passageTitle ? { sourceTitle: passageTitle } : {}),
      });
      saving.current = false;
      if (mine !== gen.current) return;
      setCoachChoice(result?.ok === true ? action : 'failed');
    } catch (error) {
      saving.current = false;
      if (handleAuthFailure(error)) return;
      if (mine !== gen.current) return;
      setCoachChoice('failed');
    }
  }, [contextSentence, passageTitle, word]);

  const lookup = useCallback(
    async (w: string) => {
      const token = readToken();
      if (!token) return;
      const mine = ++gen.current;
      setPhase({ s: 'loading' });
      setCoachChoice('idle');
      try {
        const r = await api.vocabLookup(token, w, contextSentence);
        if (mine !== gen.current) return;
        if (!r || r.found !== true || !r.entry) {
          setPhase({ s: 'notFound' });
          return;
        }
        setPhase({ s: 'ok', entry: r.entry });
      } catch (e) {
        if (handleAuthFailure(e)) return;
        if (mine !== gen.current) return;
        setPhase({ s: 'failed' });
      }
    },
    [contextSentence],
  );

  useEffect(() => {
    // 关掉 / 换词 / 卸载 —— 在途响应一律作废
    gen.current++;
    saving.current = false;
    if (!word) {
      setPhase({ s: 'idle' });
      return;
    }
    if (blocked) {
      // **考点词：一个请求都不发**
      setPhase({ s: 'idle' });
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

          {/* 查词不自动收录；四个选择只写入统一的「我的单词」数据。 */}
          {phase.s === 'ok' ? (
            <section aria-label="我的单词选择" className="mb-3">
              <p className="mb-2 text-xs text-slate-500">查词不会自动加入，你可以自己决定：</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" data-testid="word-sheet-coach-learn" disabled={coachChoice === 'saving'} onClick={() => void chooseCoachAction(gen.current, 'learn', phase.entry)} className="min-h-[44px] rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white">加入我的单词</button>
                <button type="button" data-testid="word-sheet-coach-known" disabled={coachChoice === 'saving'} onClick={() => void chooseCoachAction(gen.current, 'known', phase.entry)} className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm">我已经会了</button>
                <button type="button" data-testid="word-sheet-coach-later" disabled={coachChoice === 'saving'} onClick={() => void chooseCoachAction(gen.current, 'later', phase.entry)} className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm">稍后再学</button>
                <button type="button" data-testid="word-sheet-coach-lookup" disabled={coachChoice === 'saving'} onClick={() => void chooseCoachAction(gen.current, 'lookup_only', phase.entry)} className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm">只查一下</button>
              </div>
              {coachChoice !== 'idle' && coachChoice !== 'saving' ? (
                <p role="status" data-testid="word-sheet-coach-status" className={`mt-2 text-xs ${coachChoice === 'failed' ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {coachChoice === 'learn' ? '已加入我的单词。' : coachChoice === 'known' ? '已标记为会，以后不会作为新词推送。' : coachChoice === 'later' ? '已加入我的单词，之后可以再学。' : coachChoice === 'lookup_only' ? '本次只查询，没有加入。' : '没有保存，请重试。'}
                </p>
              ) : coachChoice === 'saving' ? <p className="mt-2 text-xs text-slate-500">正在保存选择…</p> : null}
            </section>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
