import { useEffect, useRef, useState } from 'react';
import { BASE } from '../../lib/api';

/**
 * 考试中的查词卡 —— 早测 2.0。
 *
 * ## 为什么 1.x 明令禁止在考试中查词，2.0 又开了
 *
 * 原始约束（见 TappablePassage 顶部与生词本 PRD §2.2）：早测里有词义题
 * （「'shadow' 这个词暗示什么」），考试中能查词 = 直接送答案。
 * 这个顾虑是对的，但它只对**那几个被考的词**成立，而不是对文章里
 * 另外七百多个词成立。所以 2.0 做的是精确屏蔽而不是一刀切：
 * `blocked` 由本卷题干算出，点到这些词只提示、不给释义。
 *
 * ## 2026-08-11 真机反馈后的改版
 *
 * 老师在手机上实测后指出卡片「设计上很不好」。逐条对应：
 *
 * 1) **遮挡** —— 卡片盖住了正在读的那句话。查词是为了读懂那句话，
 *    结果那句话没了。NN/g 对底部抽屉的结论很直接：它天然遮挡，只适合
 *    放补充信息，不能放「当下必需的东西」。这里两手处理：调用方在弹卡
 *    之前把文章滚到该词位于卡片上方（Kindle 新版同样的做法），
 *    同时把**那句原文直接印在卡片顶部**并高亮该词 —— 即使滚动失败，
 *    学生也不会失去语境。Kindle 的生词卡也是这么做的。
 *
 * 2) **三个词性并列，没说此处是哪个** —— 暂时无法自动判定词性（需要
 *    词性标注器），但把原文那句话放在最上面，学生自己就能对上。
 *
 * 3) **六个考试标签占一整行** —— 做题当下知道它是 GRE 词毫无帮助。
 *    收成一行小字，放到最底下。
 *
 * 4) **词已被存进生词本，学生完全不知道** —— 加一行确认。
 *
 * 另外把本地词典里一直没显示的**英文释义**（DictEntry.definition）
 * 放出来：学生生词本里 40 个词有 39 个带英文释义，一直白存着。
 * 中英对照本身就是学习者词典的标准做法。
 */

type Entry = {
  word: string;
  phonetic: string | null;
  translation: string;
  definition: string | null;
  pos: string | null;
  tag: string[];
  collins: number | null;
  oxford: boolean;
};

const EXAM_TAGS: Record<string, string> = {
  ielts: '雅思', toefl: '托福', gre: 'GRE', cet4: '四级',
  cet6: '六级', gk: '高考', zk: '中考', ky: '考研',
};

export type FillTarget = { questionId: string; label: string; hasValue: boolean } | null;

/** 把语境句里的目标词标出来。词形可能与词典词条不同（looked / looking），
 *  所以按 surfaceForm 匹配，匹配不到就原样显示，不做任何猜测。 */
function highlightWord(sentence: string, surface: string) {
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

export default function ExamWordSheet({
  word,
  contextSentence,
  blocked,
  fillTarget,
  studentName,
  onFill,
  onSheetMetrics,
  onClose,
}: {
  word: string | null;
  /** 该词在原文里所处的那句话。没有就不显示这一块。 */
  contextSentence?: string | null;
  blocked: boolean;
  fillTarget: FillTarget;
  studentName?: string | null;
  onFill: (questionId: string, word: string, append: boolean) => void;
  /**
   * 报告卡片真实的顶边与高度，供调用方把被查的词顶到卡片上方。
   *
   * 为什么必须由卡片来报：卡片是自适应高度，且内容异步（「查询中…」的
   * 小卡 → 有中英释义的大卡），外面按 vh 估必然估错。挂载时报一次，
   * 之后每次尺寸变化再报（ResizeObserver）。
   */
  onSheetMetrics?: (top: number, height: number) => void;
  onClose: () => void;
}) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'notFound' | 'failed'>('idle');
  const [saved, setSaved] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // 主信号是 React 自己的渲染，不是 ResizeObserver。
  //
  // 首版只挂 ResizeObserver，生产实测发现它构造了却一次回调都不触发
  // （卡片从「查询中…」的 264px 长到有释义的 344px，RO 全程沉默），
  // 于是只有挂载那一次量到的小卡尺寸生效，词还是被压在卡片下面。
  // 反正「内容变了」这件事组件自己最清楚 —— 把状态放进依赖直接重量，
  // RO 留着兜底（字体加载后换行变化这类 React 看不见的重排）。
  //
  // rAF 是必须的：state 刚变成 ok 时这一帧的布局还没跑完，
  // 同步 getBoundingClientRect 量到的是旧高度。
  useEffect(() => {
    if (!word || !onSheetMetrics) return;
    const el = sheetRef.current;
    if (!el) return;
    let raf = 0;
    const report = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        onSheetMetrics(r.top, r.height);
      });
    };
    report();
    // 卡片是 fixed 的，滚动不会改变它的尺寸 —— 不会和调用方的滚动互相触发
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(report) : null;
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [word, state, entry, blocked, saved, contextSentence, onSheetMetrics]);

  useEffect(() => {
    if (!word || blocked) { setEntry(null); setState('idle'); setSaved(false); return; }
    let cancelled = false;
    setState('loading');
    setEntry(null);
    setSaved(false);
    const ctl = new AbortController();
    // 冷启动实测能到 15 秒，考试中不能让学生干等 —— 8 秒判失败
    const timer = setTimeout(() => ctl.abort(), 8000);
    (async () => {
      try {
        const r = await fetch(`${BASE}/api/vocab/lookup?word=${encodeURIComponent(word)}`, { signal: ctl.signal });
        if (cancelled) return;
        if (!r.ok) { setState('failed'); return; }
        const j = await r.json();
        if (j?.found === false) { setState('notFound'); return; }
        setEntry(j.entry ?? j);
        setState('ok');
        // 记进生词本（sourceType=click）。考试中查的词就是真正卡住学生的词，
        // 既是最有价值的诊断信号，也正是他该背的。失败静默 —— 查词本身
        // 已经成功，记不上不该打扰考试。
        if (studentName) {
          fetch(`${BASE}/api/vocab/words`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              studentName,
              word,
              contextSentence: contextSentence ?? undefined,
            }),
          }).then(() => { if (!cancelled) setSaved(true); }).catch(() => {});
        }
      } catch {
        if (!cancelled) setState('failed');
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => { cancelled = true; ctl.abort(); clearTimeout(timer); };
  }, [word, blocked, studentName, contextSentence]);

  if (!word) return null;

  const shownTags = (entry?.tag ?? []).filter((t) => EXAM_TAGS[t]).map((t) => EXAM_TAGS[t]);

  return (
    <div className="ui-ios fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25" />
      <div
        ref={sheetRef}
        className="relative w-full bg-white rounded-t-[24px] shadow-2xl max-h-[58vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部小横条 —— iOS 抽屉的标准可拖拽暗示 */}
        <div className="sticky top-0 bg-white pt-2.5 pb-1 flex justify-center">
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pb-7">
          {/* 语境句放最上面：查词是为了读懂这句话 */}
          {contextSentence && (
            <p className="text-[15px] text-gray-600 leading-relaxed mb-3 font-serif">
              {highlightWord(contextSentence, word)}
            </p>
          )}

          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[26px] font-semibold text-gray-900 break-words">{word}</span>
              {entry?.phonetic && (
                <span className="ml-2 text-[15px] text-gray-500">/{entry.phonetic}/</span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hit press shrink-0 text-gray-400 text-2xl leading-none -mr-2"
              aria-label="关闭"
            >
              ×
            </button>
          </div>

          {/* 给释义区一个下限高度：卡片从「查询中…」长到有中英释义会高出
              一大截，每次变高都要重新把词顶上去一次，学生看到文字连跳两下。
              先占住位置，多数情况下就只滚一次。 */}
          <div className="min-h-[96px]">
          {blocked ? (
            <div className="mt-3 rounded-[14px] bg-amber-50 px-4 py-3.5 text-[15px] text-amber-900">
              这个词是本卷的考点，考试期间不显示释义。
              <div className="text-[13px] text-amber-700 mt-1">交卷后在「我的记录」里可以查。</div>
            </div>
          ) : (
            <>
              {state === 'loading' && <div className="mt-3 text-[15px] text-gray-400">查询中…</div>}
              {state === 'notFound' && (
                <div className="mt-3 text-[15px] text-gray-500">本词典未收录这个词。</div>
              )}
              {state === 'failed' && (
                <div className="mt-3 text-[15px] text-gray-500">查询失败，请再点一次。</div>
              )}
              {state === 'ok' && entry && (
                <>
                  <div className="mt-3 text-[17px] text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {entry.translation}
                  </div>
                  {/* 英文释义：本地词典一直有，从来没显示过。中英对照是
                      学习者词典的标准做法 —— 中文帮理解，英文帮建立语感。 */}
                  {entry.definition && (
                    <div className="mt-3 pt-3 text-[15px] text-gray-600 whitespace-pre-wrap leading-relaxed"
                         style={{ borderTop: '1px solid var(--ios-sep)' }}>
                      {entry.definition}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          </div>

          {/* 填空取词。屏蔽的是「释义」，不是「这个词存在于原文」，所以
              考点词也允许填。 */}
          {fillTarget && (
            <button
              type="button"
              onClick={() => { onFill(fillTarget.questionId, word, fillTarget.hasValue); onClose(); }}
              className="press w-full mt-4 min-h-[48px] rounded-[14px] bg-blue-600 text-white text-[17px] font-semibold active:bg-blue-700"
            >
              {fillTarget.hasValue ? `追加到${fillTarget.label}` : `填入${fillTarget.label}`}
            </button>
          )}

          {/* 考试标签降级成一行小字，和「已存入生词本」并排 —— 做题当下
              知道它是 GRE 词没有帮助，但复习时有参考价值，所以留着不删。 */}
          {(saved || shownTags.length > 0) && (
            <div className="mt-4 flex items-center gap-2 flex-wrap text-[13px] text-gray-400">
              {saved && <span className="text-emerald-600">已存入生词本</span>}
              {saved && shownTags.length > 0 && <span>·</span>}
              {shownTags.length > 0 && <span>{shownTags.join(' / ')}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
