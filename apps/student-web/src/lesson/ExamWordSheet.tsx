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
 * ## 语境句放最上面
 *
 * 卡片贴底会盖住正在读的那句话，而查词恰恰是为了读懂那句话。所以把那句
 * 原文直接印在卡片顶部并标出该词 —— Kindle 的生词卡也是这么做的。
 * 标注用 React 节点拼，**不用 `dangerouslySetInnerHTML`**：那句话是服务端
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

/** 服务端回执长得对不对。形状不对一律按**没存上**处理。 */
export function addSucceeded(r: unknown): r is { created: boolean; headword: string } {
  return !!r && typeof r === 'object' && typeof (r as { created?: unknown }).created === 'boolean';
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
  | { s: 'created' }
  | { s: 'already' }
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
  const pendingAdd = useRef<{ word: string; contextSentence?: string; sourcePassageTitle?: string } | null>(null);

  /** 记进生词本。考试中查的词就是真正卡住学生的词，也正是他该背的。 */
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
      setSave(addSucceeded(r) ? (r.created ? { s: 'created' } : { s: 'already' }) : { s: 'failed' });
    } catch (e) {
      saving.current = false;
      if (handleAuthFailure(e)) return;
      if (mine !== gen.current) return;
      setSave({ s: 'failed' });
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
        const r = await api.vocabLookup(token, w);
        if (mine !== gen.current) return;
        if (!r || r.found !== true || !r.entry) {
          setPhase({ s: 'notFound' });
          return;
        }
        setPhase({ s: 'ok', entry: r.entry });
        // 查到了才记本子 —— 词典里没有的词记进去也没有释义可复习
        pendingAdd.current = {
          word: w,
          ...(contextSentence ? { contextSentence } : {}),
          ...(passageTitle ? { sourcePassageTitle: passageTitle } : {}),
        };
        void sendAdd(mine);
      } catch (e) {
        if (handleAuthFailure(e)) return;
        if (mine !== gen.current) return;
        setPhase({ s: 'failed' });
      }
    },
    [contextSentence, passageTitle, sendAdd],
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
    <div data-testid="word-sheet" className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25" />
      <div
        className="relative w-full bg-white rounded-t-[24px] shadow-2xl max-h-[58vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white pt-2.5 pb-1 flex justify-center">
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pb-7">
          {/* 语境句放最上面：查词是为了读懂这句话 */}
          {contextSentence ? (
            <p data-testid="word-sheet-sentence" className="text-[15px] text-gray-600 leading-relaxed mb-3 font-serif">
              {highlightWord(contextSentence, word)}
            </p>
          ) : null}

          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <span data-testid="word-sheet-word" className="text-[26px] font-semibold text-gray-900 break-words">
                {word}
              </span>
              {phase.s === 'ok' && phase.entry.phonetic ? (
                <span data-testid="word-sheet-phonetic" className="ml-2 text-[15px] text-gray-500">
                  /{phase.entry.phonetic}/
                </span>
              ) : null}
            </div>
            <button
              type="button"
              data-testid="word-sheet-close"
              onClick={onClose}
              className="shrink-0 text-gray-400 text-2xl leading-none -mr-2 min-h-[44px] px-2"
              aria-label="关闭"
            >
              ×
            </button>
          </div>

          <div className="min-h-[96px]">
            {blocked ? (
              <div
                data-testid="word-sheet-blocked"
                className="mt-3 rounded-[14px] bg-amber-50 px-4 py-3.5 text-[15px] text-amber-900"
              >
                这个词是本卷的考点，考试期间不显示释义。
                <div className="text-[13px] text-amber-700 mt-1">交卷后在成绩详情里可以看。</div>
              </div>
            ) : (
              <>
                {phase.s === 'loading' ? (
                  <div data-testid="word-sheet-loading" className="mt-3 text-[15px] text-gray-400">
                    查询中…
                  </div>
                ) : null}
                {phase.s === 'notFound' ? (
                  <div data-testid="word-sheet-not-found" className="mt-3 text-[15px] text-gray-500">
                    本词典未收录这个词。
                  </div>
                ) : null}
                {phase.s === 'failed' ? (
                  <>
                    <div data-testid="word-sheet-failed" className="mt-3 text-[15px] text-gray-500">
                      查询失败 —— 网络不太好。
                    </div>
                    <button
                      type="button"
                      data-testid="word-sheet-retry-lookup"
                      onClick={() => void lookup(word)}
                      className="mt-2 min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-sm"
                    >
                      重试
                    </button>
                  </>
                ) : null}
                {phase.s === 'ok' ? (
                  <>
                    <div
                      data-testid="word-sheet-translation"
                      className="mt-3 text-[17px] text-gray-900 whitespace-pre-wrap leading-relaxed"
                    >
                      {phase.entry.translation}
                    </div>
                    {phase.entry.definition ? (
                      <div
                        data-testid="word-sheet-definition"
                        className="mt-3 pt-3 border-t border-gray-200 text-[15px] text-gray-600 whitespace-pre-wrap leading-relaxed"
                      >
                        {phase.entry.definition}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </div>

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
              className="w-full mt-4 min-h-[48px] rounded-[14px] bg-blue-600 text-white text-[17px] font-semibold"
            >
              {fillTarget.hasValue ? `追加到${fillTarget.label}` : `填入${fillTarget.label}`}
            </button>
          ) : null}

          {/* 写本子的结果 —— 三种分开说，失败绝不静默 */}
          {save.s === 'created' || save.s === 'already' ? (
            <div data-testid="word-sheet-saved" className="mt-4 text-[13px] text-emerald-600">
              {save.s === 'created' ? '已存入生词本' : '已经在生词本里了'}
            </div>
          ) : null}
          {save.s === 'failed' ? (
            <div className="mt-4 text-[13px]">
              <span data-testid="word-sheet-save-failed" className="text-rose-600">
                没能存进生词本
              </span>
              <button
                type="button"
                data-testid="word-sheet-retry-save"
                onClick={() => void sendAdd(gen.current)}
                className="ml-2 min-h-[44px] px-3 rounded-lg border border-gray-300"
              >
                重试
              </button>
            </div>
          ) : null}
          {tags.length > 0 ? (
            <div data-testid="word-sheet-tags" className="mt-2 text-[13px] text-gray-400">
              {tags.join(' / ')}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
