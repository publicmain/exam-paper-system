import { useCallback, useState } from 'react';
import { api } from '../../lib/api';

/**
 * 可点词的文章渲染器（生词本 P1）。
 *
 * ⚠️ 使用约束 —— 见 docs/PRD/vocabulary-notebook.md §2.2：
 * **考试进行中绝对不可使用本组件**。早测里本来就有词义题
 * （OLevelVocabInContext，以及 coax / crumpled / slick 这类短答），
 * 考试中能点词查义 = 直接送答案，考试效度归零。
 * 本组件只允许出现在：①交卷后的复盘页 ②练习模式 ③老师推送的预习材料。
 *
 * 分词规则与后端 normalizeWord / candidateForms 保持一致：
 * 保留词内撇号与连字符，其余字符原样输出（不可点）。
 */

interface Entry {
  word: string;
  query: string;
  phonetic: string | null;
  translation: string;
  pos: string | null;
  tag: string[];
  via: string;
}

/** 把一段文本切成 [可点词 | 原样片段]，保持原文完全可还原。 */
function segment(text: string): Array<{ t: string; word: boolean }> {
  const out: Array<{ t: string; word: boolean }> = [];
  const re = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), word: false });
    out.push({ t: m[0], word: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), word: false });
  return out;
}

const EXAM_TAGS: Record<string, string> = {
  ielts: '雅思',
  toefl: '托福',
  gre: 'GRE',
  cet4: '四级',
  cet6: '六级',
  gk: '高考',
  zk: '中考',
  ky: '考研',
};

export function TappablePassage({
  text,
  title,
  onAdd,
  addedWords,
}: {
  text: string;
  title?: string | null;
  /** 提供时显示「加入生词本」按钮（P2 接入；P1 不传即为纯查词） */
  onAdd?: (payload: { headword: string; surfaceForm: string; contextSentence: string }) => void;
  /** 已在生词本里的词（原形），用于按钮显示「已加入」 */
  addedWords?: Set<string>;
}) {
  const [active, setActive] = useState<{
    surface: string;
    sentence: string;
    loading: boolean;
    entry: Entry | null;
    notFound: boolean;
    /** 查询失败（网络/超时/服务端错误）—— 与「词典没这个词」是两回事 */
    failed: boolean;
  } | null>(null);

  /**
   * 查词。
   *
   * ⚠️ 必须把「词典未收录」和「查询失败」分开显示。
   * 早先两者都显示成"本词典未收录"，结果 API 冷启动慢了 15 秒时，学生看到的是
   * 「本词典未收录 coax」—— 一个彻头彻尾的谎话，会让人以为词典缺常用词。
   * （这是真机验证时实际发生的。）
   * 超时也要兜住：宁可 8 秒后告诉他"网络慢，重试"，也不要转圈转到天荒地老。
   */
  const lookup = useCallback(async (surface: string, sentence: string) => {
    setActive({ surface, sentence, loading: true, entry: null, notFound: false, failed: false });
    try {
      const r: any = await Promise.race([
        api.vocabLookup(surface),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      if (r?.found) {
        setActive({ surface, sentence, loading: false, entry: r.entry, notFound: false, failed: false });
      } else {
        setActive({ surface, sentence, loading: false, entry: null, notFound: true, failed: false });
      }
    } catch {
      setActive({ surface, sentence, loading: false, entry: null, notFound: false, failed: true });
    }
  }, []);

  // 段落切分：保留空行结构
  const paragraphs = text.split(/\n{2,}/);

  return (
    <div className="relative">
      {title && (
        <div className="text-base font-bold text-gray-900 mb-1">{title}</div>
      )}
      <div className="text-[11px] text-gray-500 mb-2">💡 点任意单词查释义</div>
      <div className="text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap">
        {paragraphs.map((para, pi) => {
          // 该词所在句子（用于生词本上下文），简单按句末标点切
          const sentences = para.split(/(?<=[.!?])\s+/);
          return (
            <p key={pi} className="mb-3">
              {sentences.map((sent, si) => (
                <span key={si}>
                  {segment(sent).map((seg, i) =>
                    seg.word ? (
                      <span
                        key={i}
                        role="button"
                        tabIndex={0}
                        onClick={() => lookup(seg.t, sent.trim())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            lookup(seg.t, sent.trim());
                          }
                        }}
                        className={`cursor-pointer rounded px-[1px] transition-colors hover:bg-amber-100 active:bg-amber-200 ${
                          addedWords?.has(seg.t.toLowerCase()) ? 'bg-emerald-50 underline decoration-emerald-300' : ''
                        }`}
                      >
                        {seg.t}
                      </span>
                    ) : (
                      <span key={i}>{seg.t}</span>
                    ),
                  )}{' '}
                </span>
              ))}
            </p>
          );
        })}
      </div>

      {/* 释义卡：底部弹出，移动端优先 */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl shadow-xl p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xl font-bold text-gray-900 break-words">
                  {active.entry?.word ?? active.surface}
                </div>
                {active.entry?.phonetic && (
                  <div className="text-sm text-gray-500 mt-0.5">/{active.entry.phonetic}/</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="关闭"
                className="shrink-0 text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
              >
                ×
              </button>
            </div>

            {active.loading && <div className="mt-3 text-sm text-gray-500">查询中…</div>}

            {active.notFound && (
              <div className="mt-3 text-sm text-gray-600">
                本词典未收录 <span className="font-medium">{active.surface}</span>
                <div className="text-xs text-gray-400 mt-1">
                  多为人名、地名或本地词汇 —— 文章末尾的 Glossary 通常有解释。
                </div>
              </div>
            )}

            {active.failed && (
              <div className="mt-3 text-sm text-gray-700">
                查询失败，可能是网络慢。
                <button
                  type="button"
                  onClick={() => lookup(active.surface, active.sentence)}
                  className="ml-2 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  重试
                </button>
              </div>
            )}

            {active.entry && (
              <>
                {active.entry.tag.filter((t) => EXAM_TAGS[t]).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {active.entry.tag
                      .filter((t) => EXAM_TAGS[t])
                      .map((t) => (
                        <span
                          key={t}
                          className={`text-[11px] px-1.5 py-0.5 rounded ${
                            t === 'ielts'
                              ? 'bg-purple-100 text-purple-700 font-semibold'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {EXAM_TAGS[t]}
                        </span>
                      ))}
                  </div>
                )}
                <div className="mt-2.5 text-[15px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {active.entry.translation}
                </div>
                {active.surface.toLowerCase() !== active.entry.word && (
                  <div className="mt-1.5 text-xs text-gray-500">
                    你点的是 <span className="font-medium">{active.surface}</span>
                  </div>
                )}
                <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[13px] text-gray-700">
                  <span className="text-gray-500">原句：</span>
                  {active.sentence}
                </div>
                {onAdd && (
                  <button
                    type="button"
                    disabled={addedWords?.has(active.entry.word)}
                    onClick={() => {
                      onAdd({
                        headword: active.entry!.word,
                        surfaceForm: active.surface,
                        contextSentence: active.sentence,
                      });
                      setActive(null);
                    }}
                    className="mt-4 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-gray-300 text-white font-semibold text-base touch-manipulation"
                  >
                    {addedWords?.has(active.entry.word) ? '✓ 已在生词本' : '+ 加入生词本'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
