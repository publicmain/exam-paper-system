import { useEffect, useState } from 'react';
import { BASE } from '../../lib/api';

/**
 * 考试中的查词面板 —— 早测 2.0。
 *
 * ## 为什么 1.x 明令禁止在考试中查词，2.0 又开了
 *
 * 原始约束（见 TappablePassage 顶部与生词本 PRD §2.2）：早测里有词义题
 * （「'shadow' 这个词暗示什么」），考试中能查词 = 直接送答案。
 * 这个顾虑是对的，但它只对**那几个被考的词**成立，而不是对文章里
 * 另外七百多个词成立。
 *
 * 2.0 的处理是精确屏蔽而不是一刀切：`blockedWords` 由本卷题干算出
 * （所有词义题里被引号引住的目标词），点到这些词只提示"本卷考点"，
 * 不给释义；其余词照常查。
 *
 * 为什么值得开：全历史诊断显示打字类题目空白率 36-64%，学生不是做错
 * 是根本不写；而查词入口原先只挂在"历史成绩详情页"，学生要用它得
 * 交卷→进历史→点开某一场，四层深 —— 上线两周只有 1 名学生用过。
 * 词卡出现在他真正卡住的那一刻才有意义。
 *
 * ## 填空题取词
 *
 * 填空题的指令本来就是 "Choose NO MORE THAN TWO WORDS FROM THE PASSAGE"，
 * 答案就在原文里，所以"把选中的词填进第 N 题"不泄漏任何东西 —— 学生
 * 仍然必须自己判断该填哪个词、填到哪一题。它剥掉的只是拼写与打字负担，
 * 而那正是空白率的来源。永远需要显式点按钮，绝不自动填。
 */

type Entry = {
  word: string;
  phonetic: string | null;
  translation: string;
  pos: string | null;
  tag: string[];
};

const EXAM_TAGS: Record<string, string> = {
  ielts: '雅思', toefl: '托福', gre: 'GRE', cet4: '四级',
  cet6: '六级', gk: '高考', zk: '中考', ky: '考研',
};

export type FillTarget = { questionId: string; label: string; hasValue: boolean } | null;

export default function ExamWordSheet({
  word,
  blocked,
  fillTarget,
  studentName,
  onFill,
  onClose,
}: {
  word: string | null;
  blocked: boolean;
  fillTarget: FillTarget;
  studentName?: string | null;
  onFill: (questionId: string, word: string, append: boolean) => void;
  onClose: () => void;
}) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'notFound' | 'failed'>('idle');

  useEffect(() => {
    if (!word || blocked) { setEntry(null); setState('idle'); return; }
    let cancelled = false;
    setState('loading');
    setEntry(null);
    const ctl = new AbortController();
    // 冷启动实测能到 15 秒，考试中不能让学生干等 —— 8 秒判失败并给重试
    const timer = setTimeout(() => ctl.abort(), 8000);
    (async () => {
      try {
        const qs = '?word=' + encodeURIComponent(word) +
          (studentName ? '&name=' + encodeURIComponent(studentName) : '');
        const r = await fetch(`${BASE}/api/vocab/lookup${qs}`, { signal: ctl.signal });
        if (cancelled) return;
        if (r.status === 404) { setState('notFound'); return; }
        if (!r.ok) { setState('failed'); return; }
        const j = await r.json();
        if (j?.found === false) { setState('notFound'); return; }
        setEntry(j.entry ?? j);
        setState('ok');
        // 记进生词本（sourceType=click）。学生在考试中查的词就是真正卡住
        // 他的词 —— 这既是最有价值的诊断信号，也正是他该背的词。
        // 失败静默：查词本身已经成功，记不上不该影响考试。
        if (studentName) {
          fetch(`${BASE}/api/vocab/words`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ studentName, word }),
          }).catch(() => {});
        }
      } catch {
        if (!cancelled) setState('failed');
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => { cancelled = true; ctl.abort(); clearTimeout(timer); };
  }, [word, blocked, studentName]);

  if (!word) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full bg-white rounded-t-2xl shadow-2xl p-5 pb-7 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-xl font-semibold text-gray-900 break-words">{word}</div>
            {entry?.phonetic && (
              <div className="text-sm text-gray-500 mt-0.5">/{entry.phonetic}/</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-400 text-2xl leading-none px-2 -mt-1"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {blocked ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3 text-sm text-amber-900">
            这个词是本卷的考点，考试期间不显示释义。
            <div className="text-xs text-amber-700 mt-1">交卷后在「我的记录」里可以查。</div>
          </div>
        ) : (
          <>
            {state === 'loading' && <div className="text-sm text-gray-400 py-2">查询中…</div>}
            {state === 'notFound' && (
              <div className="text-sm text-gray-500 py-2">本词典未收录这个词。</div>
            )}
            {state === 'failed' && (
              <div className="text-sm text-gray-500 py-2">
                查询失败。
                <button
                  type="button"
                  className="ml-2 text-blue-600 underline"
                  onClick={() => setState((s) => (s === 'failed' ? 'idle' : s))}
                >
                  收起
                </button>
              </div>
            )}
            {state === 'ok' && entry && (
              <>
                {entry.pos && <div className="text-xs text-gray-400 mb-1">{entry.pos}</div>}
                <div className="text-[15px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {entry.translation}
                </div>
                {entry.tag?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {entry.tag
                      .filter((t) => EXAM_TAGS[t])
                      .map((t) => (
                        <span key={t} className="text-[11px] rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">
                          {EXAM_TAGS[t]}
                        </span>
                      ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 填空取词。屏蔽词也允许填 —— 屏蔽的是"释义"，不是"这个词存在于原文"。 */}
        {fillTarget && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { onFill(fillTarget.questionId, word, fillTarget.hasValue); onClose(); }}
              className="w-full rounded-lg bg-blue-600 text-white font-medium py-3 active:bg-blue-700"
            >
              {fillTarget.hasValue ? `追加到${fillTarget.label}` : `填入${fillTarget.label}`}
            </button>
            <div className="text-[11px] text-gray-400 mt-2 text-center">
              填空题答案本来就要从原文里取词；填进去之后仍可手动修改
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
