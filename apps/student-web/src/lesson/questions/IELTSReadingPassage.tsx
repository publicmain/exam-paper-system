import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ExamPaper, ExamQuestion, ExamOption } from '../examTypes';
import { useExam } from '../ExamContext';
import { clean, reflowPassage, splitStem } from '../shared/textUtils';
import { Highlighter, useStoredHighlights } from '../shared/Highlighter';
import { useStoredNotes, StickyNoteRail } from '../shared/StickyNote';
import { DraggableSplit } from '../shared/DraggableSplit';
import { QuestionFlag } from '../shared/QuestionFlag';
import { ExamWordSheet, type FillTarget } from '../ExamWordSheet';

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
  // 2026-09-05 盲测 P0：一组配对题共用「第一题的选项库」，可第二题的
  // 选项根本是另外四个 —— 学生按第一题的库选，字母碰巧对上才算对。
  // 组里只要有一题的选项和库不一样，就不共享，各题各显示自己的选项。
  for (const group of groups) {
    if (!group.bank || group.taskType !== 'matching_features') continue;
    const bankKey = JSON.stringify(group.bank.map((o) => [o.key, o.text]));
    const consistent = group.questions.every(
      (q) => JSON.stringify((q.snapshotOptions ?? []).map((o) => [o.key, o.text])) === bankKey,
    );
    if (!consistent) group.bank = null;
  }
  return groups;
}

/**
 * 「这台设备已经查过词了」的标记（阶段 12C）。
 *
 * 只是一个**发现性提示**的开关：那行提示要被看见一次，不该长期占版面。
 * 用 localStorage 而不是本场次的 state —— 一个学生只需要被提醒一次，
 * 下周再考时不该又被当成新手。
 *
 * 旧端这个键叫 `mq:lookedUpOnce`。新端**一律 `sw:` 前缀**，这样
 * `identity.ts` 的前缀扫除能一次清干净（守卫 G1 钉住）。
 * 这里**只存这一个 '1'** —— 不存词条、不存身份、不存令牌、不存答案、
 * 不存待写队列。
 */
const LOOKED_UP_KEY = 'sw:reading:looked-up-once';

/**
 * 把「我是当前的填空目标」登记上来。
 *
 * 用**记住**而不是等弹卡时读 `document.activeElement`：手机上点文章会先
 * 让输入框 blur，等卡片弹出来时活动元素早就不是它了。
 */
const FillFocusCtx = createContext<((id: string | null) => void) | null>(null);

/**
 * 找出目标词所在的那句原文。
 *
 * 找不到就返回 null —— **不编**。段落标记行（`Paragraph A`）跳过。
 */
export function sentenceContaining(passage: string, word: string): string | null {
  if (!passage || !word) return null;
  const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^A-Za-z])${safe}([^A-Za-z]|$)`, 'i');
  for (const line of passage.split(/\n+/)) {
    const t = line.trim();
    if (!t || /^Paragraph\s+[0-9A-H]+$/i.test(t)) continue;
    for (const raw of t.split(/(?<=[.!?]['"’”]?)\s+/)) {
      const sen = raw.trim();
      if (sen && re.test(sen)) return sen.length > 260 ? sen.slice(0, 257) + '…' : sen;
    }
  }
  return null;
}

/**
 * 本卷考点词 —— 点到这些词**连查都不查**。
 *
 * 1.x 一刀切禁止考试中查词，理由是早测有词义题（「'shadow' 这个词暗示
 * 什么」），能查词等于送答案。这个顾虑**只对被考的那几个词成立**，对文章
 * 里另外七百多个词不成立 —— 所以这里做精确屏蔽。
 *
 * 判定与后端 `extractQuotedWord` 同一套：必须是「问这个词什么意思」的
 * 问法，叙事引语不算（否则《The Uniform》Q6 的 'good' 也会被误判成考点）。
 */
export function blockedWordsOf(questions: ExamQuestion[]): Set<string> {
  const out = new Set<string>();
  for (const q of questions ?? []) {
    const stem = String(q.snapshotContent?.stem ?? '');
    const asks =
      /\bwhat does\b/i.test(stem) && /\b(suggest|mean|means|imply|convey)\b/i.test(stem);
    if (asks || /\bthe word\s*['‘’"“”]/i.test(stem)) {
      const m = stem.match(/['‘’"“”]([A-Za-z][A-Za-z'’-]{1,30})['‘’"“”]/);
      if (m) out.add(m[1].toLowerCase());
    }
    const tw = q.snapshotContent?.targetWord;
    if (typeof tw === 'string' && tw.trim()) out.add(tw.trim().toLowerCase());
  }
  return out;
}

export function IELTSReadingPassage({ paper }: { paper: ExamPaper }) {
  // All hooks run on every render — round-7 C-E2. The empty-paper early
  // return previously sat between useState and useMemo / useStoredX hooks,
  // so the first non-empty render after a refetch reordered them and
  // React threw the "Rules of Hooks" violation.
  const { fontScale } = useExam();
  // 阶段 7C 返工 —— **窄屏不再是「原文 / 题目」二选一**。
  //
  // 旧端在窄屏上把另一块 hidden 掉，靠一个分段控件切换。2026-07-24 的事故
  // 就出在它身上：默认停在题目那一页，学生在手机上「看不到文章」。冻结的
  // 移动端要求是两块都在文档流里、原文在上题目在下 —— 那就没有可切换的
  // 状态，控件本身也一并去掉。
  const passageContent = paper?.questions?.[0]?.snapshotContent ?? {};
  /**
   * **真的**篇目标题，没有就是空串（返工 1/2 B-2）。
   *
   * 它和下面那个显示用的标题是两件事：屏幕上没标题时摆一个「Reading
   * Passage」是善意的兜底，但把那个兜底**存进生词本**，那条记录就永远指向
   * 一个不存在的篇目 —— 学生复习时点进去什么都找不到，而且没有任何办法
   * 分辨「这卷真叫 Reading Passage」和「这卷根本没标题」。
   *
   * **显示可以兜底，落库不许兜底。**
   */
  const sourceTitle = clean(passageContent.passageTitle ?? '').trim();
  /** 只给屏幕看的标题。 */
  const passageTitle = sourceTitle || 'Reading Passage';
  const passageBody = useMemo(() => reflowPassage(clean(passageContent.passage ?? '')), [passageContent.passage]);
  const groups = useMemo(() => groupQuestions(paper?.questions ?? []), [paper?.questions]);

  const hlKey = `sw:reading:hl:${paper?.sessionId ?? ''}`;
  const noteKey = `sw:reading:nt:${paper?.sessionId ?? ''}`;
  const [highlights, setHighlights] = useStoredHighlights(hlKey);
  const [notes, addNote, editNote, removeNote] = useStoredNotes(noteKey);

  // ── 阶段 12C：考试中查词 / 填空取词 ──────────────────────────
  //
  // 阶段 7C 曾把这一块整体摘掉，因为旧实现带姓名写生词本。12C 按
  // token-only 重写后挂回来 —— 请求边界见 `../ExamWordSheet.tsx`。
  const { answers, setAnswer } = useExam();
  const [pickedWord, setPickedWord] = useState<string | null>(null);
  const [pickedSentence, setPickedSentence] = useState<string | null>(null);
  /** 最后聚焦过的那道单行填空题。见 `FillFocusCtx` 的注释。 */
  const [fillTargetId, setFillTargetId] = useState<string | null>(null);
  /**
   * 目标会过期（2026-09-05 盲测 P2-11）：学生在第 7 题的空里点过一下，
   * 转头去做第 10 题，再点文章查词时弹出来的还是「追加到第 7 题」。
   * 学生一答别的题，这个目标就作废。
   */
  const prevAnswersRef = useRef(answers);
  useEffect(() => {
    const prev = prevAnswersRef.current;
    prevAnswersRef.current = answers;
    if (!fillTargetId) return;
    for (const [qid, a] of Object.entries(answers)) {
      if (qid !== fillTargetId && prev[qid] !== a) {
        setFillTargetId(null);
        return;
      }
    }
  }, [answers, fillTargetId]);

  /**
   * 这台设备上从没查过词 —— 决定那行提示是**显眼版**还是常态小字
   * （返工 1/2 B-3：第一版写了这个键却从来不读，提示前后一模一样，
   * 等于一个没人看的写操作）。
   *
   * 情境化提示的全部价值就在「第一次显眼、之后收起」这个对比上：
   * 不收起，它就从「帮你发现功能」退化成长期占版面的噪音。
   */
  const [neverLookedUp, setNeverLookedUp] = useState(() => {
    try {
      return localStorage.getItem(LOOKED_UP_KEY) !== '1';
    } catch {
      return true; // 隐私模式：当作没查过，大不了每场再提示一次
    }
  });

  const blockedWords = useMemo(() => blockedWordsOf(paper?.questions ?? []), [paper?.questions]);

  /** 「填入第 N 题」只有当前确实有一道单行填空被聚焦过才出现。 */
  const fillTarget: FillTarget = useMemo(() => {
    if (!fillTargetId) return null;
    const q = (paper?.questions ?? []).find((x) => x.id === fillTargetId);
    if (!q) return null;
    return {
      questionId: fillTargetId,
      label: `第 ${q.sortOrder} 题`,
      hasValue: Boolean(answers[fillTargetId]?.textAnswer?.trim()),
    };
  }, [fillTargetId, paper?.questions, answers]);

  const onWordTap = useCallback(
    (w: string) => {
      setPickedSentence(sentenceContaining(passageBody, w));
      setPickedWord(w);
      // 提示条**这一场内一定收起**（本地 state），落盘只是为了下一场也记得。
      // 所以写失败不影响任何东西 —— 尤其不影响查词本身。
      setNeverLookedUp(false);
      try {
        localStorage.setItem(LOOKED_UP_KEY, '1');
      } catch {
        /* 隐私模式：这场内仍然收起，只是下场再出现一次 */
      }
    },
    [passageBody],
  );

  const closeWordSheet = useCallback(() => {
    setPickedWord(null);
    setPickedSentence(null);
  }, []);

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
      <FillFocusCtx.Provider value={setFillTargetId}>
      <DraggableSplit
        storageKey={`sw:reading:split:${paper.sessionId}`}
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
              {/*
                情境化提示（just-in-time）。签到那一屏只让学生「知道有这回事」，
                真正的操作提示要落在用到它的地方。所以这行字在学生**还没查过
                任何词**时是一个显眼的蓝色提示条，查过一次就永久缩回小灰字 ——
                它的任务是被发现一次，不是长期占着版面。
              */}
              {neverLookedUp ? (
                <div
                  data-testid="lookup-hint-prominent"
                  className="mb-3 rounded-xl bg-blue-50 px-4 py-3 text-[14px] text-blue-800 leading-relaxed"
                >
                  <div className="font-medium">不认识的词，轻轻一点就能查</div>
                  <div className="text-[13px] text-blue-700/90 mt-0.5">
                    不用长按
                    {fillTargetId ? '，还能直接填进正在作答的填空题' : ''}
                    ；拖选文字可以加高亮。
                  </div>
                </div>
              ) : (
                <div data-testid="lookup-hint-compact" className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                  轻点一个单词可以查词；拖选文字可以加高亮，点高亮可移除。
                </div>
              )}
              <Highlighter
                body={passageBody}
                highlights={highlights}
                onChange={setHighlights}
                onWordTap={onWordTap}
                testId="passage-body"
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
        /* **真标题**，不是屏幕上那个兜底 —— 见 sourceTitle 的注释 */
        passageTitle={sourceTitle}
        blocked={!!pickedWord && blockedWords.has(pickedWord.toLowerCase())}
        fillTarget={fillTarget}
        onFill={(qid, w, append) => {
          // 走既有的 `setAnswer` —— 持久化仍然归 ReadingProvider 管，
          // 查词卡**不自己发保存请求**。
          const cur = answers[qid]?.textAnswer ?? '';
          setAnswer(qid, { textAnswer: append && cur ? `${cur.trim()} ${w}` : w });
        }}
        onClose={closeWordSheet}
      />
    </div>
  );
}


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
  const { answers, savingId, isFlagged, mode } = useExam();
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
          questionId={q.id}
          onChange={(v) => setAnswer(q.id, { textAnswer: v })}
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
              // 读屏能听出「选中 / 未选中」，不只靠颜色（2026-09-05 盲测 P2-19）
              aria-pressed={checked}
              aria-label={`${opt.key}${opt.text && opt.text !== opt.key ? ` ${opt.text}` : ''}`}
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
      aria-label={`Answer ${placeholder}`}
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
        aria-label="Your answer"
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
  /** 给了才可能成为「填空取词」的目标（阶段 12C）。 */
  questionId?: string;
}) {
  // 聚焦时把自己登记为取词目标。**必须记住**而不是等弹卡时读
  // `document.activeElement`：手机上点文章会先让本框 blur，那时活动元素
  // 早就不是它了。多行的 O-Level 长答题走的是 DebouncedTextarea，
  // 根本不经过这里 —— 所以它不会被误当成填空目标。
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
        onFocus={() => { if (questionId) registerFill?.(questionId); }}
        onChange={(e) => {
          // R15-followup-6 — live save (see LetterInput comment).
          const v = e.target.value;
          setLocal(v);
          onChange(v);
        }}
        onBlur={() => { if (local !== value) onChange(local); }}
        placeholder="Your answer…"
        aria-label="Your answer"
        className="border rounded-lg px-4 py-3 text-base w-full max-w-md min-h-[48px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </>
  );
}
