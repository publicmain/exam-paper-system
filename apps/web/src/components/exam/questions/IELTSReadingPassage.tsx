import { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext } from 'react';
import type { ExamPaper, ExamQuestion, ExamOption } from '../types';
import { useExam } from '../ExamContext';
import { clean, reflowPassage, splitStem } from '../shared/textUtils';
import { Highlighter, useStoredHighlights } from '../shared/Highlighter';
import { useStoredNotes, StickyNoteRail } from '../shared/StickyNote';
import { DraggableSplit } from '../shared/DraggableSplit';
import { QuestionFlag } from '../shared/QuestionFlag';
import ExamWordSheet from '../ExamWordSheet';

/**
 * IELTS Computer-Delivered-style reading shell.
 *
 *  - Left pane: shared passage with selection-driven highlighting + a
 *    notes rail. iPad-portrait collapses into a tab toggle ("看原文")
 *    so the question side stays at a comfortable reading width.
 *  - Right pane: scrollable list of grouped tasks (matching, TFNG, MCQ,
 *    completion). Each task carries its own instruction and shared bank
 *    when applicable.
 *  - Resizable: the divider between panes can be dragged on lg+, and
 *    the chosen ratio sticks across reloads.
 *  - Mark for review: every question has a flag button which lights up
 *    the bottom palette. Wired through ExamContext.
 */

type TaskType =
  | 'matching_information'
  | 'matching_headings'
  | 'matching_features'
  | 'multiple_choice'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'sentence_completion'
  | 'summary_completion'
  | 'note_completion'
  | 'table_completion'
  | 'flow_chart_completion'
  | 'diagram_label_completion'
  | 'short_answer'
  // R15-followup-14b — Cambridge "classify the following events" task.
  // Stem looks like an MCQ ("Write the correct letter, A, B or C.")
  // but ingest tags it as `classification`. Was missing from the union →
  // QuestionItem's switch fell to default → bare textarea → student
  // typed the letter into textAnswer instead of selecting an option.
  | 'classification';

const TASK_TITLES: Record<string, string> = {
  matching_information: 'Matching Information',
  matching_headings: 'Matching Headings',
  matching_features: 'Matching Features',
  multiple_choice: 'Multiple Choice',
  true_false_not_given: 'True / False / Not Given',
  yes_no_not_given: 'Yes / No / Not Given',
  sentence_completion: 'Sentence Completion',
  summary_completion: 'Summary Completion',
  note_completion: 'Note Completion',
  table_completion: 'Table Completion',
  flow_chart_completion: 'Flow-chart Completion',
  diagram_label_completion: 'Diagram Labelling',
  short_answer: 'Short Answer',
  // R10 follow-up — OLEVEL Cambridge IGCSE 0510 Exercise 2 sets four
  // mini-reviews (texts A–D) and asks "which writer says…"; ingest tags
  // these as taskType=multi_match. Without an entry here the shell fell
  // back to "_other" → "Question", which read like a placeholder. Same
  // pattern for Ex 3 note-completion (we keep that under note_completion
  // already). Add the OLEVEL families explicitly.
  multi_match: 'Multi-text Matching',
  olevel_short_answer: 'Short Answer',
  olevel_comprehension: 'Comprehension',
  classification: 'Classification',
  _other: 'Question',
};

interface TaskGroup {
  taskType: TaskType | '_other';
  instruction: string;
  bank: ExamOption[] | null;
  bankLabel: string;
  questions: Array<ExamQuestion & { itemText: string; localIdx: number }>;
}

function groupQuestions(qs: ExamQuestion[]): TaskGroup[] {
  const groups: TaskGroup[] = [];
  let cur: TaskGroup | null = null;
  qs.forEach((pq, idx) => {
    const c = pq.snapshotContent || {};
    const tt = (c.taskType as TaskType) ?? '_other';
    const { instruction, item } = splitStem(c.stem ?? '');
    const sameAsCurrent = cur && cur.taskType === tt && cur.instruction === instruction;
    if (!sameAsCurrent) {
      let sharedBank: ExamOption[] | null = null;
      let bankLabel = '选项库 · Bank';
      if (tt === 'matching_features' && pq.snapshotOptions && pq.snapshotOptions.length > 2) {
        sharedBank = pq.snapshotOptions;
      } else if (tt === 'matching_headings' && Array.isArray(c.headingsBank) && c.headingsBank.length > 0) {
        sharedBank = c.headingsBank;
        bankLabel = '标题列表 · List of Headings';
      } else if (tt === 'summary_completion' && Array.isArray(c.wordBank) && c.wordBank.length > 0) {
        sharedBank = c.wordBank;
        bankLabel = '词库 · Word Bank';
      }
      cur = { taskType: tt, instruction, bank: sharedBank, bankLabel, questions: [] };
      groups.push(cur);
    }
    cur!.questions.push({ ...pq, itemText: item, localIdx: idx + 1 });
  });
  return groups;
}

/** 2.0 —— 记录"最后聚焦的填空题",供文章侧的取词面板使用。
 *  只在本文件内传递,不污染共享的 ExamContext。 */
const FillFocusCtx = createContext<((id: string | null) => void) | null>(null);

/**
 * 取出某个词在原文里所处的那句话，放进词卡顶部当语境。
 *
 * 切句规则与后端 student-word.service 的 splitSentences 保持一致：
 * 先按换行拆、丢掉「Paragraph X」标记行，再按句末标点切（允许尾随引号）。
 * 朴素的 split(/(?<=[.!?])\s+/) 会在 `liked.'` 这种「句号+引号」处不切，
 * 也会把段落标记当成句子的一部分。
 * 找不到就返回 null —— 宁可不显示，也不给一句不含该词的话。
 */
/**
 * 找到真正在滚动的那个祖先元素。
 *
 * 不能假定是 window 或 <aside>：手机上原文和题目是同一块内部滚动区里的
 * 两个面板，lg 以上才是 aside 各自滚。首版写死这两种，手机上两边都没滚成。
 */
function scrollParentOf(node: Node | null): HTMLElement | null {
  let el: HTMLElement | null =
    node && node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : (node?.parentElement ?? null);
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if (/(auto|scroll|overlay)/.test(oy) && el.scrollHeight > el.clientHeight + 4) return el;
    el = el.parentElement;
  }
  return null;
}

function sentenceContaining(passage: string, word: string): string | null {
  if (!passage || !word) return null;
  const re = new RegExp(`(^|[^A-Za-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`, 'i');
  for (const line of passage.split(/\n+/)) {
    const t = line.trim();
    if (!t || /^Paragraph\s+[0-9A-H]+$/i.test(t)) continue;
    for (const raw of t.split(/(?<=[.!?]['"’”]?)\s+/)) {
      const s = raw.trim();
      if (s && re.test(s)) return s.length > 260 ? s.slice(0, 257) + '…' : s;
    }
  }
  return null;
}

export function IELTSReadingPassage({ paper }: { paper: ExamPaper }) {
  // All hooks run on every render — round-7 C-E2. The empty-paper early
  // return previously sat between useState and useMemo / useStoredX hooks,
  // so the first non-empty render after a refetch reordered them and
  // React threw the "Rules of Hooks" violation.
  const { fontScale } = useExam();
  // Mobile pane toggle — below lg the split collapses to a stack and only
  // ONE side is shown at a time; the student switches with the segmented
  // control below.
  //
  // 2026-07-24 incident: on 07-24 the ielts_authentic session ran a real
  // Cambridge reading passage (cambridge_ielts_8/Test1/P1). Students on
  // phones reported "扫码后看不到文章，只能看到题目" — the split defaulted
  // to the Questions pane and the old toggle (grey text, no border) didn't
  // read as tappable, so they never found the passage. iPad-landscape
  // users (lg+, both panes visible) were unaffected, which is why "not
  // everyone" hit it. Fix: default to the PASSAGE side so the first thing
  // a student sees is the text they're worried about missing, and make the
  // toggle an unmistakable segmented control (see the tablist below).
  const [mobileSide, setMobileSide] = useState<'left' | 'right'>('left');
  const passageContent = paper?.questions?.[0]?.snapshotContent ?? {};
  const passageTitle = clean(passageContent.passageTitle ?? 'Reading Passage');
  const passageBody = useMemo(() => reflowPassage(clean(passageContent.passage ?? '')), [passageContent.passage]);
  const groups = useMemo(() => groupQuestions(paper?.questions ?? []), [paper?.questions]);

  const hlKey = `mq:hl:${paper?.sessionId ?? ''}`;
  const noteKey = `mq:nt:${paper?.sessionId ?? ''}`;
  const [highlights, setHighlights] = useStoredHighlights(hlKey);
  const [notes, addNote, editNote, removeNote] = useStoredNotes(noteKey);

  // ── 2.0 考试中查词 / 填空取词 ──────────────────────────────
  const [pickedWord, setPickedWord] = useState<string | null>(null);
  const [pickedSentence, setPickedSentence] = useState<string | null>(null);
  /** 这台设备上从没查过词 —— 决定上面那条提示是显眼版还是常态小字。
   *  用 localStorage 而不是本场次的 state：一个学生只需要被提醒一次,
   *  下周再考时不该又被当成新手。 */
  const [neverLookedUp, setNeverLookedUp] = useState(() => {
    try {
      return localStorage.getItem(LOOKED_UP_KEY) !== '1';
    } catch {
      return true;
    }
  });

  /**
   * 点词后的处理：记住这个词在文档里的位置，再取出它所在的那句原文。
   *
   * 遮挡问题（2026-08-11 真机反馈）：弹卡在底部，会盖住正在读的那句话，
   * 而查词恰恰是为了读懂那句话。Kindle 新版的做法是弹卡时把正文推上去，
   * 保证被查的词仍然可见 —— 这里照做，但滚动交给 onSheetMetrics：
   * 卡片高度是异步变化的（「查询中…」→ 有释义就长高一截），只有卡片
   * 自己知道它最终多高，这里靠 vh 猜必然猜错（首版按 42vh 估，实测
   * 卡片顶边在 57.6vh，滚动量算少了一半，等于没滚）。
   */
  function handleWordTap(w: string, range: Range) {
    wordRangeRef.current = range;
    // 先让位、再开卡。顺序反过来的话卡片会盖住词、下一帧再把它推出来,
    // 那一下就是"抖"。
    liftWordAboveSheet(range);
    setPickedSentence(sentenceContaining(passageBody, w));
    setPickedWord(w);
    if (neverLookedUp) {
      setNeverLookedUp(false);
      try {
        localStorage.setItem(LOOKED_UP_KEY, '1');
      } catch {
        /* 隐私模式：提示条这场考试内仍会收起,只是下场再出现一次 */
      }
    }
  }

  /** 被查的词在文档里的位置。存 Range 不存 rect —— 每滚一次 rect 就过期。 */
  const wordRangeRef = useRef<Range | null>(null);
  /** 为把末尾的词顶上去而临时加的底部留白，关卡时还原。 */
  const padRef = useRef<{ el: HTMLElement; prev: string } | null>(null);

  const restorePad = useCallback(() => {
    const p = padRef.current;
    if (!p) return;
    p.el.style.paddingBottom = p.prev;
    padRef.current = null;
  }, []);

  /**
   * 把词顶到卡片上方。**在卡片出现之前同步做完，只做一次。**
   *
   * 关键是不用去量卡片：它贴着底边、`max-h` 写死 58vh，所以顶边最低
   * 也就到 42vh（撑满时 100vh − 58vh）。只要把词底边顶到 42vh 以上，
   * 任何高度的卡片都遮不住它 —— 不必等它渲染、不必测它多高、更不必
   * 等释义加载完再校正一次。
   *
   * 上一版为了拿到"卡片真实高度"跑了个 1.8 秒 / 12 次的自收敛循环,
   * 每次都读一遍布局、可能再写一次 scrollTop。老师的原话是"很卡、
   * 不跟手" —— 就是它:卡片正在滑上来的同时,文章底下还在被反复推,
   * 两个动作打架。改成一次算准,循环整个删掉。
   *
   * (当初第一版其实就是按 42vh 估的,失败原因是滚动容器找错了 ——
   *  写死了 aside/window,手机上两个都不是。我当时把两件事混在一起,
   *  误判成"vh 估算错",绕了一大圈。容器那个 bug 早已修掉。)
   */
  const liftWordAboveSheet = useCallback((r: Range) => {
    let rect: DOMRect;
    try {
      rect = r.getBoundingClientRect();
    } catch {
      return; // Range 所在节点已被替换（高亮重渲染），放弃滚动
    }
    if (!rect.width && !rect.height) return;
    const vh = window.innerHeight;
    const worstSheetTop = vh * 0.42; // 卡片撑满 58vh 时的顶边
    const overlap = rect.bottom - (worstSheetTop - 16);
    if (overlap <= 4) return; // 本来就没被遮住 —— 别乱滚，学生会失去上下文

    const el = scrollParentOf(r.startContainer) ?? (document.scrollingElement as HTMLElement | null);
    if (!el) {
      window.scrollBy({ top: overlap });
      return;
    }
    // 词在文章最后一段时容器已经滚到底，再滚不动 —— 临时把底部撑高，
    // 这样任何位置的词都能被顶到卡片上方（iOS 键盘避让就是这么做的）。
    //
    // 撑的是**文章容器本身**，不是滚动容器。整页滚动时滚动元素是
    // documentElement，而这个布局里 html 和 body 都被固定成 100dvh
    // （812px）、靠内容溢出产生滚动条 —— padding 加在它们身上会被溢出的
    // 内容淹没，scrollHeight 一点不变（两版实测余量都还是 0、词纹丝不动）。
    // 文章容器在正常流里，撑它一定能把文档变高。
    const room = el.scrollHeight - el.clientHeight - el.scrollTop;
    if (room < overlap) {
      const host = r.startContainer.parentElement?.closest<HTMLElement>('.select-text');
      const pad = host ?? el;
      if (!padRef.current) padRef.current = { el: pad, prev: pad.style.paddingBottom };
      pad.style.paddingBottom = `${Math.round(vh * 0.58) + 24}px`;
    }
    // 瞬时滚动。这一下发生在卡片渲染之前，学生看到的是「文章先让开，
    // 卡片再滑上来」两个分开的动作；换成 smooth 会和卡片的入场动画
    // 叠在一起同时跑，反而糊。
    el.scrollTop += overlap;
  }, []);

  const closeWordSheet = useCallback(() => {
    restorePad();
    wordRangeRef.current = null;
    setPickedWord(null);
    setPickedSentence(null);
  }, [restorePad]);
  // 最后聚焦过的填空题。用"记住"而不是读 document.activeElement：手机上
  // 点文章会先让输入框 blur，等面板弹出时活动元素早就不是它了。
  const [fillTargetId, setFillTargetId] = useState<string | null>(null);

  const { answers, setAnswer } = useExam();

  /** 面板上的"填入第 N 题"按钮：只有当前确实有一道填空题被聚焦过才出现。 */
  const fillTarget = useMemo(() => {
    if (!fillTargetId) return null;
    const q = (paper?.questions ?? []).find((x) => x.id === fillTargetId);
    if (!q) return null;
    return {
      questionId: fillTargetId,
      label: `第 ${q.sortOrder} 题`,
      hasValue: Boolean(answers[fillTargetId]?.textAnswer?.trim()),
    };
  }, [fillTargetId, paper?.questions, answers]);

  /**
   * 本卷考点词 —— 点到这些词只提示、不给释义。
   *
   * 1.x 明令禁止考试中查词，理由是早测有词义题（「'shadow' 这个词暗示
   * 什么」），能查词就等于送答案。这个顾虑只对**被考的那几个词**成立，
   * 对文章里另外七百多个词不成立 —— 所以这里做精确屏蔽而不是一刀切。
   *
   * 来源是词义题题干里被引号引住的目标词。判定与后端 extractQuotedWord
   * 保持同一套规则：必须是"问这个词什么意思"的问法，叙事引语不算
   * （否则《The Uniform》Q6 的 'good' 也会被误判成考点）。
   */
  const blockedWords = useMemo(() => {
    const out = new Set<string>();
    for (const q of paper?.questions ?? []) {
      const stem = String(q.snapshotContent?.stem ?? '');
      const asks = /\bwhat does\b/i.test(stem) && /\b(suggest|mean|means|imply|convey)\b/i.test(stem);
      if (!asks && !/\bthe word\s*['‘’"“”]/i.test(stem)) continue;
      const m = stem.match(/['‘’"“”]([A-Za-z][A-Za-z'’-]{1,30})['‘’"“”]/);
      if (m) out.add(m[1].toLowerCase());
      const tw = q.snapshotContent?.targetWord;
      if (typeof tw === 'string' && tw.trim()) out.add(tw.trim().toLowerCase());
    }
    return out;
  }, [paper?.questions]);

  if (!paper?.questions?.length) {
    return (
      <div className="max-w-xl mx-auto py-12 px-6 text-center text-amber-800">
        该卷尚未出题，请联系老师。
      </div>
    );
  }

  // R10 follow-up — `zoom` was unreliable: Firefox doesn't support it
  // and Chrome's behaviour with nested overflow:auto + dvh height
  // calculations is glitchy enough that students reported the passage
  // panel ignoring A+/A−. Switch to a CSS variable that descendants
  // reference via explicit inline-style font-size; works the same in
  // every browser and means the passage Highlighter, question stems
  // and option labels all scale together.
  return (
    <div
      // ui-ios：学生端统一的界面语言（44pt 触控目标、按压回弹、iOS 字阶）。
      // 这里只加作用域，不改本页既有的字号类 —— 考试页的正文字号由学生自己
      // 用 A± 控制（--mq-fs），不能被外部统一值覆盖。
      className="ui-ios lg:h-[calc(100dvh-9rem)]"
      style={{ ['--mq-fs' as any]: String(fontScale) }}
    >
      {/* Mobile pane switch — only visible below lg.  On lg+ the split
          renders both panes side-by-side (no toggle needed).

          Rendered as a full-width segmented control: a filled container
          with two equal tabs and a white "pill" on the active one. The
          old version was two loose buttons where the inactive one was
          plain grey text with no border, so it didn't look tappable and
          students missed the passage (2026-07-24 incident). Both tabs now
          clearly read as a two-way switch, with an icon for instant
          recognition. */}
      {/* 2026-08-11 触屏可用性：这个切换原来只有 36px 高,低于 Apple HIG 的
          44pt 最小触控目标 —— 而它是全页后果最严重的控件（点不中就整场
          只做题不看原文）。改用 .seg 分段控件,内含 40px 按钮 + 外层 padding
          正好到 46px,并去掉了描边改用浮起的白色药丸表示当前页。 */}
      <div className="ui-ios lg:hidden sticky top-14 z-10 glass glass-top px-3 py-2">
        <div className="seg" role="tablist" aria-label="切换原文 / 题目">
          <button
            type="button"
            role="tab"
            aria-selected={mobileSide === 'left'}
            data-on={mobileSide === 'left'}
            onClick={() => setMobileSide('left')}
            className="press"
          >
            原文
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileSide === 'right'}
            data-on={mobileSide === 'right'}
            onClick={() => setMobileSide('right')}
            className="press"
          >
            题目
          </button>
        </div>
      </div>

      <FillFocusCtx.Provider value={setFillTargetId}>
      <DraggableSplit
        storageKey={`mq:split:${paper.sessionId}`}
        mobileSide={mobileSide}
        left={
          // R15-Audit#2 — same hidden-scrollbar pattern as the OLEVEL bug.
          // On iPad-landscape (1024×768 exactly at lg) the inner scrollbar
          // is ~2px wide; students don't realize the passage continues.
          // Keeping lg:max-h-full to respect the parent's calc-height
          // container, but switching to overflow-y-auto + scrollbar-gutter:
          // stable so the gutter is reserved (visible) at all breakpoints.
          <aside className="bg-white lg:rounded-lg lg:border lg:shadow-sm lg:max-h-full lg:overflow-y-auto h-full [scrollbar-gutter:stable]">
            <div className="px-5 py-5 lg:px-6 lg:py-6">
              <h2 className="font-semibold text-xl lg:text-2xl mb-1">{passageTitle}</h2>
              {/* 对比度：原来 text-gray-400 (2.54:1) + text-blue-500 (3.68:1)
                  都低于 WCAG AA 的 4.5:1，而这行正是要让学生发现查词功能的。
                  换成 gray-600 / blue-600 并从 12px 提到 13px。
                  措辞也从「选中」改成「点」—— 手势已经变了。 */}
              {/* 情境提示（just-in-time）。签到时那一屏只让学生"知道有这
                  回事",真正的操作提示要落在用到它的地方 —— 公开数据里
                  情境化提示的功能采纳率是预先讲解的 2.9 倍(42.6% vs
                  14.7%),因为学习时机和使用时机贴在一起。
                  所以这行字在学生**还没查过任何词**时是一个显眼的蓝色
                  提示条,查过一次就永久缩回原来的小灰字 —— 它的任务是
                  被发现一次,不是长期占着版面。 */}
              {neverLookedUp ? (
                <div className="mb-3 rounded-[12px] bg-blue-50 border border-blue-200 px-3.5 py-2.5">
                  <div className="text-[14px] text-blue-900 font-medium">
                    看不懂的词，点一下就有意思
                  </div>
                  <div className="text-[12px] text-blue-700/80 mt-0.5">
                    不用长按，轻轻一点
                    {fillTargetId && '，还能直接填进正在作答的填空题'}
                    ；拖选文字可以加高亮。
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                  <span className="text-blue-600 font-medium">点单词查词义</span>
                  {fillTargetId && <span className="text-blue-600 font-medium">（可填进正在作答的填空题）</span>}
                  ；拖选文字加高亮，点高亮可移除。
                </div>
              )}
              <Highlighter
                body={passageBody}
                highlights={highlights}
                onChange={setHighlights}
                onWordTap={handleWordTap}
                className="text-gray-800 leading-[1.75] font-serif"
                // Apply the user-controlled font scale via inline style
                // (overrides any inherited text-* class). 1.125rem is the
                // baseline that text-lg used at fontScale=1.
                style={{ fontSize: `calc(1.125rem * var(--mq-fs, 1))` }}
              />
              <StickyNoteRail
                notes={notes}
                onAdd={addNote}
                onEdit={editNote}
                onRemove={removeNote}
              />
            </div>
          </aside>
        }
        right={
          <div className="lg:max-h-full lg:overflow-y-auto space-y-5 px-4 lg:px-4 py-4 lg:py-4 [scrollbar-gutter:stable]">
            {groups.map((g, gi) => (
              // B3-H12/H13 perf — `content-visibility: auto` lets the
              // browser skip layout / paint for off-screen task groups
              // (each ~3-13 questions). `contain-intrinsic-size` reserves
              // a placeholder height so the scrollbar doesn't jump as
              // groups become visible. iPad Safari respects both.
              <div
                key={gi}
                style={{
                  contentVisibility: 'auto' as any,
                  containIntrinsicSize: '600px',
                }}
              >
                <TaskGroupView group={g} gi={gi} />
              </div>
            ))}
          </div>
        }
      />
      </FillFocusCtx.Provider>

      <ExamWordSheet
        word={pickedWord}
        contextSentence={pickedSentence}
        blocked={!!pickedWord && blockedWords.has(pickedWord.toLowerCase())}
        fillTarget={fillTarget}
        studentName={paper?.studentName ?? null}
        onFill={(qid, w, append) => {
          const cur = answers[qid]?.textAnswer ?? '';
          setAnswer(qid, { textAnswer: append && cur ? `${cur.trim()} ${w}` : w });
        }}
        onClose={closeWordSheet}
      />
    </div>
  );
}

/** 「这台设备已经查过词了」的标记 —— 提示条只需要被发现一次。 */
const LOOKED_UP_KEY = 'mq:lookedUpOnce';

/** 各题型指令的中文一句话摘要。查不到就不显示，绝不猜。 */
const INSTRUCTION_GIST: Record<string, string> = {
  matching_information: '找出下列信息各在哪一段，填段落字母',
  matching_headings: '给每段配一个小标题，填标题编号',
  matching_features: '把下列内容与选项库里的对象对应起来',
  classification: '按题目给的类别给每一项归类，填字母',
  true_false_not_given: '判断与原文是否一致：TRUE / FALSE / NOT GIVEN',
  yes_no_not_given: '判断与作者观点是否一致：YES / NO / NOT GIVEN',
  multiple_choice: '从选项中选一个最合适的',
  multi_select: '按题目要求选出指定数量的选项',
  sentence_completion: '从原文取词填空，不超过两个词',
  summary_completion: '从原文取词把摘要补全，不超过两个词',
  note_completion: '从原文取词把笔记补全，不超过两个词',
  table_completion: '从原文取词把表格补全，不超过两个词',
  flow_chart_completion: '从原文取词把流程图补全，不超过两个词',
  diagram_completion: '从原文取词把图示补全，不超过两个词',
  diagram_label_completion: '从原文取词标注图中各处，不超过两个词',
  short_answer: '用自己的话简答',
  multi_match: '从词库里选一个最贴切的词',
};

/**
 * 题型指令块。
 *
 * 2026-08-11 触屏审计：每组指令平均 261 个字符纯英文，渲染出来 152px 高。
 * 手机上除去上下固定栏只剩 614px 可用高度，指令一项就吃掉 25%。
 * 而 O-Level 那批学生的瓶颈本来就是英文 —— 读不懂
 * 「Write the correct letter, A–H, in boxes 1–4 on your answer sheet」
 * 而丢分是纯粹的浪费，那句话考的不是阅读能力。
 *
 * 处理：默认只显示一行中文摘要 + 「英文原文」展开按钮。英文一字不改、
 * 随时可看，但不再默认占据四分之一屏。没有对应摘要的题型（含未来新增的）
 * 直接照旧显示英文全文，不做任何猜测。
 */
function InstructionBlock({ text, taskType }: { text: string; taskType?: string }) {
  const [open, setOpen] = useState(false);
  const gist = taskType ? INSTRUCTION_GIST[taskType] : undefined;
  const fs = { fontSize: `calc(0.9375rem * var(--mq-fs, 1))` };

  if (!gist) {
    return <p className="mt-2 text-gray-700 whitespace-pre-wrap leading-relaxed" style={fs}>{text}</p>;
  }
  return (
    <div className="mt-2">
      <p className="text-gray-800 leading-relaxed" style={fs}>{gist}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="press hit -ml-2 px-2 text-[13px] text-blue-600 font-medium rounded-lg"
      >
        {open ? '收起英文原文' : '英文原文'}
      </button>
      {open && (
        <p className="text-gray-600 whitespace-pre-wrap leading-relaxed mt-1" style={fs}>{text}</p>
      )}
    </div>
  );
}

function TaskGroupView({ group, gi }: { group: TaskGroup; gi: number }) {
  const firstNum = group.questions[0].localIdx;
  const lastNum = group.questions[group.questions.length - 1].localIdx;
  const range = firstNum === lastNum ? `${firstNum}` : `${firstNum}–${lastNum}`;
  const taskTitle = TASK_TITLES[group.taskType] ?? 'Question';
  return (
    <section className="bg-white rounded-md border border-gray-200 overflow-hidden">
      <header className="bg-gray-50 border-b border-gray-200 px-4 lg:px-5 py-3">
        <div className="flex items-baseline gap-2 flex-wrap text-sm">
          <span className="text-gray-500">Section {gi + 1}</span>
          <span className="text-gray-300">·</span>
          <span className="font-semibold text-gray-900">{taskTitle}</span>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-gray-500">Q{range}</span>
        </div>
        {group.instruction && (
          <InstructionBlock text={clean(group.instruction)} taskType={group.taskType} />
        )}
      </header>
      {group.bank && (
        <div className="px-4 lg:px-5 py-3 bg-amber-50/60 border-b border-amber-100">
          <div className="text-xs text-amber-900 font-semibold tracking-wide uppercase mb-2">
            {group.bankLabel}
          </div>
          <ul
            className="space-y-1 sm:columns-2 sm:gap-x-6"
            style={{ fontSize: `calc(0.9375rem * var(--mq-fs, 1))` }}
          >
            {group.bank.map((b) => (
              <li key={b.key} className="break-inside-avoid leading-snug">
                <span className="font-mono text-gray-500 mr-2 font-semibold">{b.key}.</span>
                <span>{clean(b.text)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ol className="divide-y divide-gray-100">
        {group.questions.map((q) => (
          <QuestionRow key={q.id} q={q} taskType={group.taskType} hasBank={!!group.bank} />
        ))}
      </ol>
    </section>
  );
}

function QuestionRow({
  q,
  taskType,
  hasBank,
}: {
  q: ExamQuestion & { itemText: string; localIdx: number };
  taskType: TaskType | '_other';
  hasBank: boolean;
}) {
  const { answers, setAnswer, savingId, isFlagged, mode } = useExam();
  const flagged = isFlagged(q.id);
  const a = answers[q.id];
  const correctKey =
    typeof q.snapshotContent?.correctOption === 'string' ? q.snapshotContent.correctOption : null;

  const showFeedback = mode === 'practice' && a?.selectedOption && correctKey;
  const isCorrect = showFeedback && a.selectedOption === correctKey;

  return (
    <li
      id={`q-${q.id}`}
      className={`px-4 lg:px-5 py-4 transition-colors ${flagged ? 'bg-orange-50/40' : ''} ${
        showFeedback
          ? isCorrect
            ? 'border-l-4 border-green-400'
            : 'border-l-4 border-rose-300'
          : ''
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-gray-100 text-gray-700 font-mono text-sm font-semibold tabular-nums">
          {q.localIdx}
        </span>
        <span className="text-[13px] text-gray-500 tabular-nums">{q.marks} 分</span>
        {savingId === q.id && <span className="text-xs text-blue-500">saving…</span>}
        <div className="flex-1" />
        <QuestionFlag qid={q.id} />
      </div>
      <QuestionItem q={q} taskType={taskType} hasBank={hasBank} />
      {showFeedback && (
        <div
          className={`mt-2 text-sm font-medium ${
            isCorrect ? 'text-green-700' : 'text-rose-700'
          }`}
        >
          {isCorrect ? '✓ Correct' : `✗ Correct answer: ${correctKey}`}
          {q.snapshotContent?.explanation && !isCorrect && (
            <span className="block text-gray-600 font-normal mt-1">
              {clean(q.snapshotContent.explanation)}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function QuestionItem({
  q,
  taskType,
  hasBank,
}: {
  q: ExamQuestion & { itemText: string };
  taskType: TaskType | '_other';
  hasBank: boolean;
}) {
  const { answers, setAnswer } = useExam();
  const answer = answers[q.id];
  const itemNode = clean(q.itemText);

  switch (taskType) {
    case 'yes_no_not_given':
    case 'true_false_not_given':
    case 'multiple_choice':
    case 'matching_features':
    // R15-followup-14b — Cambridge IELTS "classification" tasks (e.g.
    // "Classify the following events as occurring during the Medieval
    // Warm Period (A) / Little Ice Age (B) / Modern Warm Period (C)")
    // were missing from this switch and fell to the default branch — a
    // bare textarea. The stem says "Write the correct letter, A, B or
    // C." so students typed the letter; it got stored as textAnswer
    // with selectedOption=null and the MCQ grader silently dropped the
    // mark. Adding `classification` here renders the RadioGroup so the
    // letter lands in selectedOption like every other MCQ. The grader
    // textAnswer fallback (autoGradeScripts) still credits any
    // pre-2026-05-14 submissions that went through the old textarea.
    case 'classification': {
      // R15-followup-22 — defensive fallback for TFNG/YNG tasks shipped
      // with empty snapshotOptions. 5/26 ielts_authored_2026_v1/Test2/P1
      // Q6-Q10 (true_false_not_given) had `snapshotOptions: []` from an
      // AI-fixture ingest bug, so the RadioGroup rendered no buttons and
      // students left them blank. Synthesise the standard 3 options so
      // the student can ALWAYS pick — never an empty radio group.
      const TFNG_FALLBACK = [
        { key: 'A', text: 'TRUE' },
        { key: 'B', text: 'FALSE' },
        { key: 'C', text: 'NOT GIVEN' },
      ];
      const YNG_FALLBACK = [
        { key: 'A', text: 'YES' },
        { key: 'B', text: 'NO' },
        { key: 'C', text: 'NOT GIVEN' },
      ];
      const haveRealOpts = Array.isArray(q.snapshotOptions) && q.snapshotOptions.length > 0;
      const opts = haveRealOpts
        ? q.snapshotOptions!
        : taskType === 'true_false_not_given'
          ? TFNG_FALLBACK
          : taskType === 'yes_no_not_given'
            ? YNG_FALLBACK
            : [];
      return (
        <>
          <div
            className="text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug"
            style={{ fontSize: `calc(1rem * var(--mq-fs, 1))` }}
          >
            {itemNode}
          </div>
          <RadioGroup
            options={opts}
            value={answer?.selectedOption}
            onChange={(opt) => {
              // Dual-write: selectedOption for the MCQ grader path,
              // textAnswer for the short_answer grader path. When a
              // TFNG question ships with questionType=short_answer
              // (the 5/26 ingest bug), only the textAnswer path runs;
              // dual-writing means whichever branch grades, it sees the
              // student's pick. Safe for real MCQs — textAnswer is
              // unused there.
              const text = opts.find((o) => o.key === opt)?.text ?? '';
              setAnswer(q.id, { selectedOption: opt, textAnswer: text });
            }}
            compact={hasBank}
          />
        </>
      );
    }
    case 'matching_information':
      return (
        <>
          <div
            className="text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug"
            style={{ fontSize: `calc(1rem * var(--mq-fs, 1))` }}
          >
            {itemNode}
          </div>
          <LetterInput
            placeholder="A–H"
            value={answer?.textAnswer ?? ''}
            onChange={(v) => setAnswer(q.id, { textAnswer: v })}
          />
        </>
      );
    case 'matching_headings':
      return (
        <>
          <div
            className="text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug"
            style={{ fontSize: `calc(1rem * var(--mq-fs, 1))` }}
          >
            {itemNode}
          </div>
          <LetterInput
            placeholder="i, ii, iii…"
            value={answer?.textAnswer ?? ''}
            onChange={(v) => setAnswer(q.id, { textAnswer: v })}
            wider
          />
        </>
      );
    case 'sentence_completion':
    case 'summary_completion':
    case 'note_completion':
    case 'table_completion':
    case 'flow_chart_completion':
    case 'diagram_label_completion':
    case 'short_answer': {
      // 2.0 —— 单行框 vs 多行框。
      //
      // 雅思的 completion / short_answer 答案是「不超过两个词」，单行框正好；
      // 但 O-Level 的 short_answer 完全是另一回事：2 分题要写 1-3 句，
      // Section C 的 8 分题要写 80 词连续文章，全都挤在一个单行 input 里。
      // 线上实测（8/5、8/7 两场）：8 分题作答词数中位 46、最长 93 —— 学生
      // 确实硬写进去了，但 O-Level 短答整体 64% 直接空着不答，全历史得分率
      // 只有 19%，而同一批学生做选择型题目空白率只有 6-12%。
      // 输入门槛是这条曲线上最可解释的因素，先把框给够。
      //
      // 判据用 uiKind（只有 O-Level 卷带这个字段）+ 分值，雅思路径一字不动。
      const sc = q.snapshotContent ?? {};
      const isOlevelProse = sc.uiKind === 'olevel_short_answer' || q.marks >= 2;
      if (isOlevelProse) {
        return (
          <>
            <div className="text-base text-gray-800 mb-2.5 whitespace-pre-wrap leading-relaxed">
              {clean(q.itemText)}
            </div>
            <DebouncedTextarea
              value={answer?.textAnswer ?? ''}
              onChange={(v) => setAnswer(q.id, { textAnswer: v })}
              minRows={q.marks >= 5 ? 8 : 3}
              showWordCount={q.marks >= 5}
            />
          </>
        );
      }
      return (
        <BlankAwareInput
          item={q.itemText}
          value={answer?.textAnswer ?? ''}
          onChange={(v) => setAnswer(q.id, { textAnswer: v })}
          questionId={q.id}
        />
      );
    }
    default:
      // R15-followup-14b — defensive fallback: when the question is an
      // MCQ (questionType==='mcq') with populated snapshotOptions but
      // an unrecognised taskType, render as RadioGroup instead of
      // textarea. Without this, any new IELTS-family taskType the
      // generator might invent (e.g. another "Write the letter" task)
      // would silently route to textarea and re-introduce the same
      // selectedOption=null + textAnswer data-shape mismatch the
      // 5/14 classification block exposed.
      if (q.questionType === 'mcq' && Array.isArray(q.snapshotOptions) && q.snapshotOptions.length > 0) {
        return (
          <>
            <div
              className="text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug"
              style={{ fontSize: `calc(1rem * var(--mq-fs, 1))` }}
            >
              {itemNode}
            </div>
            <RadioGroup
              options={q.snapshotOptions}
              value={answer?.selectedOption}
              onChange={(opt) => setAnswer(q.id, { selectedOption: opt })}
              compact={hasBank}
            />
          </>
        );
      }
      return (
        <>
          <div
            className="text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug"
            style={{ fontSize: `calc(1rem * var(--mq-fs, 1))` }}
          >
            {itemNode}
          </div>
          <DebouncedTextarea
            value={answer?.textAnswer ?? ''}
            onChange={(v) => setAnswer(q.id, { textAnswer: v })}
          />
        </>
      );
  }
}

function RadioGroup({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: ExamOption[];
  value: string | undefined;
  onChange: (key: string) => void;
  compact?: boolean;
}) {
  // R10 follow-up — option text scales with the user's A+/A− setting via
  // the same `--mq-fs` CSS variable used elsewhere on this page. Default
  // 1rem is what `text-base` resolved to before; the calc() multiplies it.
  const optStyle = { fontSize: `calc(1rem * var(--mq-fs, 1))` } as const;
  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-2'}>
      {options.map((opt) => {
        const checked = value === opt.key;
        if (compact) {
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={`min-w-[44px] min-h-[44px] px-4 py-2 rounded-lg border font-semibold transition-colors touch-manipulation ${
                checked
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-blue-50'
              }`}
              style={optStyle}
            >
              {opt.key}
            </button>
          );
        }
        return (
          <label
            key={opt.key}
            className={`flex gap-3 items-start p-3 rounded-lg border cursor-pointer transition-colors touch-manipulation min-h-[48px] ${
              checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50 active:bg-blue-50'
            }`}
            style={optStyle}
          >
            <input
              type="radio"
              checked={checked}
              onChange={() => onChange(opt.key)}
              className="mt-1 w-5 h-5"
            />
            <span className="font-mono text-gray-500 w-6">{opt.key}.</span>
            <span className="flex-1 leading-snug">{clean(opt.text)}</span>
          </label>
        );
      })}
    </div>
  );
}

function LetterInput({
  value,
  onChange,
  placeholder,
  wider = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  wider?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => {
        // R15-followup-6 — save IMMEDIATELY on every keystroke instead
        // of waiting for blur. The blur-only save lost answers when a
        // student tapped "Done" right after typing: the input lost
        // focus AND the Submit handler fired in the same tick, racing
        // React's state batching — the parent saw the old value and
        // posted (空答) to the backend. Live save matches the rest of
        // the renderer's behavior (LetterInput is short — "ii", "iii"
        // — so per-keystroke debounce in ExamProvider isn't a hot path).
        const v = e.target.value;
        setLocal(v);
        onChange(v);
      }}
      onBlur={() => { if (local !== value) onChange(local); }}
      placeholder={placeholder}
      className={`border rounded-lg px-4 py-3 text-lg font-mono uppercase tracking-wider min-h-[48px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${wider ? 'w-40' : 'w-28'}`}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
    />
  );
}

function DebouncedTextarea({
  value,
  onChange,
  minRows = 3,
  showWordCount = false,
}: {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  showWordCount?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  // R15-followup-6 — save on every keystroke (same fix as LetterInput).
  // The blur-only save raced the Done button and dropped answers; for
  // 1-3 sentence short answers per-keystroke save is cheap.
  const words = local.trim() ? local.trim().split(/\s+/).length : 0;
  return (
    <>
      <textarea
        value={local}
        rows={minRows}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          onChange(v);
        }}
        onBlur={() => { if (local !== value) onChange(local); }}
        placeholder="Your answer…"
        className="w-full border rounded-lg px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      {/* 8 分摘要题有 80 词上限，写的时候看得见才好控制 —— 只提示不拦截，
          超了由老师按 SEAB 的口径扣分，前端不替考官做判断。 */}
      {showWordCount && (
        <div className={`mt-1 text-xs tabular-nums ${words > 80 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
          {words} 词{words > 80 ? ' · 已超过 80 词上限' : ' / 80'}
        </div>
      )}
    </>
  );
}

function BlankAwareInput({
  item,
  value,
  onChange,
  questionId,
}: {
  item: string;
  value: string;
  onChange: (v: string) => void;
  questionId?: string;
}) {
  // 2.0 —— 聚焦时把自己登记为「取词目标」。必须记住而不是等弹面板时读
  // document.activeElement：手机上点文章会先让本框 blur，那时活动元素
  // 早就不是它了。
  const registerFill = useContext(FillFocusCtx);
  const cleaned = clean(item);
  const hasBlank = /\[BLANK\]/i.test(cleaned);
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <>
      <div className="text-base text-gray-800 mb-2.5 whitespace-pre-wrap leading-relaxed">
        {hasBlank
          ? cleaned.split(/(\[BLANK\])/i).map((part, i) =>
              /\[BLANK\]/i.test(part) ? (
                <span key={i} className="inline-block px-2.5 mx-0.5 bg-amber-100 border border-amber-200 rounded text-amber-800 text-sm font-medium">
                  ___
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )
          : cleaned}
      </div>
      <input
        type="text"
        value={local}
        onChange={(e) => {
          // R15-followup-6 — live save (see LetterInput comment).
          const v = e.target.value;
          setLocal(v);
          onChange(v);
        }}
        onFocus={() => { if (questionId) registerFill?.(questionId); }}
        onBlur={() => { if (local !== value) onChange(local); }}
        placeholder="Your answer…"
        className="border rounded-lg px-4 py-3 text-base w-full max-w-md min-h-[48px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </>
  );
}
