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
 * 抢视线。
 *
 * ## 摆法（2026-09-11 审计 IOS-06）
 *
 * 用统一的 design/Dialog：手机是底部面板；iPad / 宽屏贴着点到的那个词弹出，不遮住
 * 整篇文章。焦点进出、Tab 限制、Esc、关闭后焦点回到正文都由它负责。发音按钮有
 * 加载 / 放不出来的反馈；原句翻译没取到时单独可重试，不把报错文本当译文。
 *
 * 原句中的标注用 React 节点拼，**不用 `dangerouslySetInnerHTML`**：那句话是服务端
 * 来的文本，不是可信标记。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type DictEntry } from '../lib/api';
import { playWord } from '../lib/speak';
import { Button } from '../design/Button';
import { Dialog } from '../design/Dialog';
import { Icon } from '../design/Icon';
import { InlineStatus, Spinner } from '../design/Status';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { cleanDefinition, cleanTranslation, formatPhonetic } from '../lib/word-display';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

/** 考试标签的人话。认不出来的**不显示** —— 做题当下多一个陌生缩写没帮助。 */
// 2026-09-05 盲测 P2-11：这批学生考的是 O-Level / IAL / 雅思，
// 「高考 六级 考研」这类标签对他们只是噪音，只留国际考试的。
const EXAM_TAGS: Readonly<Record<string, string>> = {
  ielts: '雅思',
  toefl: '托福',
  gre: 'GRE',
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
      <mark className="bg-warning-soft rounded px-0.5">{sentence.slice(i, i + surface.length)}</mark>
      {sentence.slice(i + surface.length)}
    </>
  );
}

export type FillTarget = { questionId: string; label: string; hasValue: boolean; singleWord?: boolean } | null;

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
  anchor,
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
  /** 点到的那个词在屏幕上的位置 —— iPad 上面板贴着它弹出，不遮住整篇文章（IOS-06）。 */
  anchor?: DOMRect | null;
}) {
  const [phase, setPhase] = useState<LookupPhase>({ s: 'idle' });
  const [coachChoice, setCoachChoice] = useState<'idle' | 'saving' | 'learn' | 'known' | 'later' | 'lookup_only' | 'failed'>('idle');
  const [speech, setSpeech] = useState<'idle' | 'loading' | 'playing' | 'failed'>('idle');

  /**
   * 请求代次。换一个词、关掉卡片、卸载 —— 都让在途的响应作废，否则上一个词的迟到释义会
   * 画到这一个词的卡上（张冠李戴，而且没有迹象说明它错了）。
   */
  const gen = useRef(0);
  const saving = useRef(false);

  /**
   * 查词之后由学生明确决定是否进入「我的单词」；查询本身绝不自动收藏。
   * 动作绑定**当前显示的这张词条**（`entry` 与发起时的代次一起传进来），
   * 换了词、卡片关了，迟到的回执一律作废（审计 UI02 同一原则）。
   */
  const chooseCoachAction = useCallback(
    async (mine: number, action: 'learn' | 'known' | 'later' | 'lookup_only', entry: DictEntry, shownWord: string) => {
      const token = readToken();
      if (!token || saving.current) return;
      saving.current = true;
      setCoachChoice('saving');
      try {
        const result = await api.vocabV2Collect(token, {
          headword: entry.word || shownWord,
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
    },
    [contextSentence, passageTitle],
  );

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
    setSpeech('idle');
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
  const phonetic = phase.s === 'ok' ? formatPhonetic(phase.entry.phonetic) : null;

  const speak = async () => {
    if (speech === 'loading') return;
    setSpeech('loading');
    const r = await playWord(phase.s === 'ok' ? phase.entry.word || word : word);
    setSpeech(r === 'failed' ? 'failed' : 'playing');
    if (r !== 'failed') window.setTimeout(() => setSpeech((s) => (s === 'playing' ? 'idle' : s)), 1500);
  };

  const chosenText: Record<string, string> = {
    learn: '已加入我的单词。',
    known: '已标记为「会」，以后不会作为新词推送。',
    later: '先收进我的单词，不算学过，之后在我的单词里能找到。',
    lookup_only: '本次只查询，没有加入。',
  };

  return (
    <Dialog
      open
      onClose={onClose}
      placement="sheet"
      anchor={anchor ?? null}
      size="lg"
      testId="word-sheet"
      closeTestId="word-sheet-close"
      initialFocus="panel"
      eyebrow={passageTitle ? `来自 · ${passageTitle}` : undefined}
      title={
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span data-testid="word-sheet-word" className="break-words text-title1 text-ink">
            {word}
          </span>
          {phonetic ? (
            <span data-testid="word-sheet-phonetic" className="text-callout font-normal text-ink-3">
              {phonetic}
            </span>
          ) : null}
        </span>
      }
      titleAccessory={
        blocked ? null : (
          <button
            type="button"
            data-testid="word-sheet-speak"
            onClick={() => void speak()}
            aria-label={speech === 'failed' ? `发音放不出来，再试一次` : `播放 ${word} 的发音`}
            aria-busy={speech === 'loading' || undefined}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full px-2 ${
              speech === 'failed' ? 'text-danger' : 'text-accent'
            } hover:bg-accent-soft`}
          >
            {speech === 'loading' ? <span className="spinner !h-4 !w-4 !border-2" aria-hidden="true" /> : <Icon name="speaker" size={22} />}
            {speech === 'failed' ? <span className="text-caption">放不出来</span> : null}
          </button>
        )
      }
      footer={
        <div className="flex w-full flex-col gap-2">
          {/* 填空取词。屏蔽的是「释义」，不是「这个词存在于原文」，所以考点词也允许填。 */}
          {fillTarget ? (
            <Button
              data-testid="word-sheet-fill"
              block
              onClick={() => {
                // 只填一个词的题永远是替换；简答题才追加（2026-09-06 上线验收）
                onFill(fillTarget.questionId, word, fillTarget.hasValue && !fillTarget.singleWord);
                onClose();
              }}
            >
              {!fillTarget.hasValue
                ? `把 “${word}” 填进${fillTarget.label}的空`
                : fillTarget.singleWord
                  ? `用 “${word}” 换掉${fillTarget.label}的答案`
                  : `把 “${word}” 加到${fillTarget.label}的答案后面`}
            </Button>
          ) : null}

          {/* 查词不自动收录；选择只写入统一的「我的单词」数据。 */}
          {phase.s === 'ok' ? (
            <section aria-label="要不要加入我的单词">
              {coachChoice === 'idle' || coachChoice === 'saving' || coachChoice === 'failed' ? (
                <>
                  <p className="mb-2 text-footnote text-ink-3">查词不会自动加入，你来决定：</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Button data-testid="word-sheet-coach-learn" size="md" disabled={coachChoice === 'saving'} onClick={() => void chooseCoachAction(gen.current, 'learn', phase.entry, word)} className="col-span-2 sm:col-span-1">
                      加入我的单词
                    </Button>
                    <Button data-testid="word-sheet-coach-known" size="md" variant="neutral" disabled={coachChoice === 'saving'} onClick={() => void chooseCoachAction(gen.current, 'known', phase.entry, word)}>
                      我已经会了
                    </Button>
                    <Button data-testid="word-sheet-coach-later" size="md" variant="neutral" disabled={coachChoice === 'saving'} onClick={() => void chooseCoachAction(gen.current, 'later', phase.entry, word)}>
                      稍后再学
                    </Button>
                    <Button data-testid="word-sheet-coach-lookup" size="md" variant="plain" disabled={coachChoice === 'saving'} onClick={() => void chooseCoachAction(gen.current, 'lookup_only', phase.entry, word)} className="col-span-2 sm:col-span-1">
                      只查一下
                    </Button>
                  </div>
                </>
              ) : (
                // 选过了就不再摆四个活按钮 —— 让人看不出选没选（2026-09-06 复测新发现 4）
                <p data-testid="word-sheet-coach-chosen" className="flex min-h-[44px] items-center gap-2 text-callout font-medium text-success">
                  <Icon name="checkCircle" size={20} />
                  {coachChoice === 'learn' ? '已选「加入我的单词」' : coachChoice === 'known' ? '已选「我已经会了」' : coachChoice === 'later' ? '已选「稍后再学」' : '已选「只查一下」'}
                  <button type="button" className="ml-auto min-h-[44px] px-2 text-footnote font-normal text-accent" onClick={() => setCoachChoice('idle')}>
                    改选
                  </button>
                </p>
              )}
              {coachChoice !== 'idle' && coachChoice !== 'saving' ? (
                <p role="status" data-testid="word-sheet-coach-status" className={`mt-1 text-footnote ${coachChoice === 'failed' ? 'text-danger' : 'text-success'}`}>
                  {coachChoice === 'failed' ? '没有保存成功，再点一次试试。' : chosenText[coachChoice]}
                </p>
              ) : coachChoice === 'saving' ? (
                <p className="mt-1 text-footnote text-ink-3">正在保存…</p>
              ) : null}
            </section>
          ) : null}
        </div>
      }
    >
      <div className="min-h-[96px] pb-2">
        {blocked ? (
          <div data-testid="word-sheet-blocked">
            <InlineStatus tone="warning">
              <div className="font-medium">这个词是本卷的考点，考试期间不显示释义。</div>
              <div className="mt-1 text-footnote">交卷后在成绩详情里可以看。</div>
            </InlineStatus>
          </div>
        ) : (
          <>
            {phase.s === 'loading' ? (
              <div data-testid="word-sheet-loading" className="rounded-group bg-surface-2 px-4 py-5">
                <Spinner label="正在查词和翻译原句" />
              </div>
            ) : null}
            {phase.s === 'notFound' ? (
              <div data-testid="word-sheet-not-found" className="rounded-group bg-surface-2 px-4 py-5 text-callout text-ink-2">
                本词典没有收录这个词。
              </div>
            ) : null}
            {phase.s === 'failed' ? (
              <InlineStatus tone="error" onRetry={() => void lookup(word)} retryLabel="重新查询" retryTestId="word-sheet-retry-lookup">
                <span data-testid="word-sheet-failed">查词没成功 —— 网络不太好。</span>
              </InlineStatus>
            ) : null}
            {phase.s === 'ok' ? (
              <div className="space-y-4">
                {/* 第一层：核心中文 */}
                <section className="rounded-group bg-accent-soft px-4 py-4">
                  <div className="mb-1 text-caption font-semibold text-accent">词义</div>
                  <div data-testid="word-sheet-translation" className="whitespace-pre-wrap text-title3 font-medium text-ink">
                    {cleanTranslation(phase.entry.translation)}
                  </div>
                </section>

                {/* 第二层：原句与整句翻译；翻译失败单独可重试，不把报错当译文 */}
                {contextSentence ? (
                  <section aria-label="所在原句" className="rounded-group border border-line px-4 py-4">
                    <div className="mb-2 text-caption font-semibold text-ink-3">所在原句</div>
                    <p data-testid="word-sheet-sentence" className="font-serif text-body leading-7 text-ink">
                      {highlightWord(contextSentence, word)}
                    </p>
                    <div className="mt-3 border-t border-line pt-3">
                      <div className="mb-1 text-caption font-semibold text-ink-3">整句翻译</div>
                      {phase.entry.contextTranslation ? (
                        <p data-testid="word-sheet-sentence-translation" className="text-callout leading-7 text-ink-2">
                          {phase.entry.contextTranslation}
                        </p>
                      ) : (
                        <p data-testid="word-sheet-sentence-translation-missing" className="flex flex-wrap items-center gap-x-2 text-callout text-ink-3">
                          这句的翻译暂时没取到。
                          <button type="button" onClick={() => void lookup(word)} className="min-h-[44px] font-medium text-accent">
                            再取一次
                          </button>
                        </p>
                      )}
                    </div>
                  </section>
                ) : null}

                {/* 第三层：按需展开；没有就整块不显示 */}
                {phase.entry.definition ? (
                  <details className="rounded-group bg-surface-2 px-4 py-2">
                    <summary className="flex min-h-[44px] cursor-pointer select-none items-center text-callout font-medium text-ink-2">查看英文词典释义</summary>
                    <div data-testid="word-sheet-definition" className="mt-1 whitespace-pre-wrap border-t border-line pb-2 pt-3 text-callout leading-relaxed text-ink-2">
                      {cleanDefinition(phase.entry.definition)}
                    </div>
                  </details>
                ) : null}

                {tags.length > 0 ? (
                  <div data-testid="word-sheet-tags" className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-fill px-2.5 py-1 text-caption font-medium text-ink-2">
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
    </Dialog>
  );
}
