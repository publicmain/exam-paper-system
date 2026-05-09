# Agent 6 — ExamContext / Provider 性能审查

> 审查范围：`_audit_review/exam/ExamContext.tsx`、`_audit_review/exam/QuestionTypeRegistry.tsx`、`_audit_review/pages/MorningQuizTake.tsx`、`_audit_review/exam/questions/*.tsx`、`_audit_review/exam/shared/*.tsx`
>
> **方法说明**：本报告所有性能判断均为基于代码静态阅读 + React 渲染语义的推理，未做实测（无 React DevTools profiler 数据、无 100/200 题量级真机帧率测试）。涉及具体题量阈值的结论会显式注明「估算」。
>
> 题量参考：早测一份卷常见 5–20 题；IELTS Reading 一篇 paper 13–14 题，3 篇 ≈ 40 题；O-Level cloze 通常 10–15 个空。下文按 N=题数粗算复杂度。

---

## Finding 1 【高】Provider value 依赖 `answers` 对象引用 → 任何答题动作都触发整树 re-render

- **文件:行**：`_audit_review/exam/ExamContext.tsx:179-190`
- **性能影响（题目数量级）**：N≥30 时开始可感知；N≥80（多 paper 串联）会出现明显输入卡顿。是本次审查中**最关键**的性能问题。
- **重现**：
  1. 打开任一含 N=20 的 IELTS reading paper（IELTSReadingPassage 一次性挂出 20 个 `<QuestionRow>`）。
  2. 学生在第 1 题点选 radio。
  3. `setAnswer` → `setAnswers(prev => ({...prev, [qid]: ans}))` → `answers` 引用变化。
  4. `useMemo<ExamContextValue>(...)` 依赖数组里有 `answers`，因此 value 是新对象。
  5. **每个**调用 `useExam()` 的组件都重新订阅、重新 render。具体重 render 的范围：
     - `QuestionRow` × 20（每个都 `const { answers, setAnswer, savingId, isFlagged, mode } = useExam()`，第 222 行）
     - `QuestionItem` × 20（第 279 行又调一次）
     - `QuestionFlag` × 20（第 7 行 `useExam()`）
     - `OfflineBadge`、`FontSizeAdjuster`、`Timer`（仅前两者订阅 ExamContext，但都会重 render）
     - `ExamShellChrome` 自身（第 140 行 `useExam()`，并触发 `useMemo answeredCount` 重算）
  6. 即便每个子组件 render 很快（~0.05ms），20×3 个组件 ≈ 60 个组件 × 每次答题点击 = 60 次 reconciliation + DOM diff。
- **建议修复**：拆 context。最小拆分：
  ```tsx
  // 三个 context，每个 value 独立 memo
  ExamMetaContext       // mode, fontScale, setFontScale, isOffline, savingId
  ExamFlagsContext      // isFlagged, toggleFlag, flaggedCount
  ExamAnswersContext    // answers, setAnswer
  ```
  更激进的方案：把 `answers` 改为 selector 模式（`useAnswer(qid)`）—每个 `QuestionRow` 只订阅自己的那一项，靠 `useSyncExternalStore` 或 zustand 实现。这一步对 N≥50 才需要。
- **次级问题**：第 190 行依赖数组里写的是 `flagged.size`（标量），看起来是想避免 flagged Set 引用变化导致 value 变化，但 `isFlagged` 的依赖是 `[flagged]`（第 177 行），所以每次 toggle 时 `isFlagged` 函数引用就变了 → value 还是会变。合并 useMemo 依赖也意味着标记一题 → 整树重 render，与 answers 同病。

---

## Finding 2 【中】`setAnswer` useCallback 依赖 `timersRef`（来自 useMemo） → 该依赖永远稳定，不构成 bug；但写法误导

- **文件:行**：`_audit_review/exam/ExamContext.tsx:134, 163`
- **性能影响**：无实际影响；属代码味道。
- **说明**：第 134 行 `const timersRef = useMemo(() => new Map(), [])` 等价于 `useRef(new Map()).current`。把 Map 写在 `useMemo` 里再加进 `useCallback` 的依赖数组，读者会以为它有依赖意义。
- **建议**：改成 `const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())`，访问时 `timersRef.current`。从 useCallback 依赖里删掉。

---

## Finding 3 【中】`setAnswer` 闭包捕获 `ans` —— debounce 触发时 server 收到的是按钮按下瞬间的值，不是最新值

- **文件:行**：`_audit_review/exam/ExamContext.tsx:147-154`
- **性能影响**：不是性能 bug，是潜在的**正确性 bug**。但和性能审查有交集（debounce 设计意图）。
- **重现**（推理）：
  1. 学生在题 q1 textarea 快速输入 "hello"，每个字符触发一次 `setAnswer('q1', { textAnswer: 'h' })`、`setAnswer('q1', { textAnswer: 'he' })`...
  2. 每次都 clearTimeout 上一个，并新建一个 setTimeout。**最终**只有最后一个 timer 会真的 fire。
  3. 最后一个 timer 的回调闭包里 `ans` 指向 `{ textAnswer: 'hello' }` —— 没问题。
  4. 但若 `setAnswer` 的 caller 从两个不同来源（如 Highlighter 自动写、用户手动写）交错触发，第二次调用 clear 第一次 timer 后又被第三次调用 clear，最终留下的 timer 闭包到的 `ans` **可能不是 setAnswers 提交后的最终值**——因为 `ans` 是从外部传入的，与 React state 解耦。
- **当前代码下风险有限**：当前所有 `setAnswer` 调用方都用 `(prev) => setAnswer(qid, { ...prev, ...delta })` 模式吗？查 `IELTSReadingPassage.tsx:294,306,317,333,342` —— 都是直接传新对象，不依赖 prev answer。所以单一来源场景下闭包是新鲜的。
- **建议**：把 server save 的 payload 也写成 `setAnswers(next => { ... ; schedulePersist(qid, next[qid]); return next })` 或者干脆在 timer 触发时从 React state 读最新值（需要 ref 镜像 answers）。

---

## Finding 4 【中-高】`setAnswer` 每次调用都 `localStorage.setItem(JSON.stringify(整个 answers map))`

- **文件:行**：`_audit_review/exam/ExamContext.tsx:139-141`
- **性能影响（题目数量级）**：
  - N=20、每题平均 30 字符答案 → JSON ≈ 1KB，每次输入字符同步序列化 + localStorage 写入，估算 < 1ms/次，可忽略。
  - N=100、每题 200 字符（textArea 自由作答） → JSON ≈ 30KB，每次 keystroke 都要序列化整个对象 + 同步阻塞 localStorage 写。这在 iPad Safari 上可能进入 1–3ms/次范围，叠加 Finding 1 的整树 re-render，**输入会有视觉延迟**。
- **重现**：N=100 题，textarea 题型，按住一个键不放（每秒 ≈ 30 次重复）。
- **建议修复**：
  1. localStorage 写入也走 debounce（和 server save 同一节奏，600ms）—— 关掉浏览器/刷新场景下最多丢 600ms 的输入，可接受。
  2. 或者 `requestIdleCallback` 包一层。
  3. 当前 quota error 直接吞掉（第 141 行 `catch { /* quota — ignore */ }`）—— 写到 30KB+ 的稳定 paper 还行；如果一份卷 essay 题学生写到 5MB（quota 上限），现在的 fallback 是「啥也不发生」，本地缓存丢失但不报错。**这是 UX 问题不是性能问题**，但建议至少 `console.warn`。

---

## Finding 5 【中】`flagged: Set<string>` 用 useState 存可变对象，`isFlagged` 引用每次都变

- **文件:行**：`_audit_review/exam/ExamContext.tsx:95-102, 165-177`
- **性能影响**：和 Finding 1 同源——当 `flagged` 变化时 `isFlagged` 函数引用变 → value memo 失效 → 整树重 render。但这正好是预期行为（标记后调色板要更新），所以问题在于**所有不关心 flag 的组件也跟着 re-render**。
- **重现**：标记任一题 → 20 个 QuestionRow 全部重 render（其中只有 1 个 flag 状态变了）。
- **建议**：把 flag 拆成独立 context（见 Finding 1 拆分方案）；进一步可改成 selector：`useIsFlagged(qid)` 只在 flag 状态对自己变化时订阅。

---

## Finding 6 【低】useEffect 缺依赖 / 多依赖 — 暂未发现明显 bug，但 `Timer.tsx` 有一个隐性问题

- **文件:行**：`_audit_review/exam/shared/Timer.tsx:22-27`
- **性能影响**：低；正确性问题。
- **重现**：第二个 useEffect 依赖 `[remainingMs, fired, onTimeUp]`。
  - `remainingMs` 每秒变一次（来自第一个 effect 的 setInterval）→ effect 每秒重新订阅、重新比较。
  - 父组件（`MorningQuizTake.handleSubmit`）没有 useCallback 包装（第 69-83 行 `async function handleSubmit`），所以**每次 MorningQuizTake render 时 onTimeUp 引用都新建**。
  - 不会引起多次 onTimeUp 触发（有 `fired` 守门），但会让 effect 高频重订阅，在低端 iPad 上每秒一次额外的 effect 开销，无意义。
- **建议**：
  1. 把 `handleSubmit` 用 `useCallback` 包起来（同时也修了 `<Timer onTimeUp={onSubmit}>` 在 ExamShellChrome 重 render 时的引用变化）。
  2. Timer 的零检测可以单独走一个 effect，依赖只 `[remainingMs===0, fired]`（先 const 一个 boolean）。

---

## Finding 7 【高】IELTS Passage 整页一次性渲染所有 group → 切换答题 = N 个 group + 全部 QuestionRow re-render

- **文件:行**：`_audit_review/exam/questions/IELTSReadingPassage.tsx:158-161, 205-208`
- **性能影响（题目数量级）**：N=14 单 paper 时可接受；3 paper 串联 N=40 时开始卡（估算）。
- **重现**：
  1. IELTS shell 把 `groups.map((g, gi) => <TaskGroupView ...>)` 一次性渲染（无虚拟化）。
  2. `TaskGroupView` 又 `group.questions.map((q) => <QuestionRow ...>)` 全部展开。
  3. 学生在 Q3 选 radio → 因 Finding 1，所有 14 个 QuestionRow + 14 个 QuestionItem + 14 个 QuestionFlag + RadioGroup（每个 5 个 option）共 140+ 个组件全部 re-render。
  4. **更糟糕**：Highlighter（第 141 行）在 passage 字数 > 1500 词时，`renderHighlighted` 里要切片 + 拼接 React node。每次 setAnswer 触发 IELTSReadingPassage re-render → 走到 Highlighter 的 props（body / highlights / onChange）。
     - body 是 useMemo `passageBody`（第 102 行），稳定。
     - highlights 是 `useStoredHighlights` 的 state，稳定除非高亮变。
     - onChange 是 `setHighlights`：来自 `useStoredHighlights` 第 144 行 `const set = (next) => {...}` —— **每次 hook 调用都新建函数**！没 useCallback。
     - → Highlighter 被 props change 标脏 → `renderHighlighted` 每次重跑（虽然 React.memo 没用上，但即便 memo 了也会因 onChange 变化失效）。
- **建议修复**：
  1. `useStoredHighlights` 的 `set` 用 `useCallback` 包，依赖空 `[storageKey]`。`useStoredNotes` 同病（第 29 行 `persist`、`add`、`edit`、`remove` 全都每次新建）。
  2. `QuestionRow` 加 `React.memo`（外加上面 Finding 1 的 context 拆分，否则 memo 失效）。
  3. N>30 时考虑 `react-window` 或者按 task group 折叠，只渲染当前可视的 group。

---

## Finding 8 【高】Highlighter 的 `renderHighlighted` 把整个 passage 切成多段 React 节点；passage 越长越慢

- **文件:行**：`_audit_review/exam/shared/Highlighter.tsx:57-82`
- **性能影响**：和 passage 字数线性相关。500 词 passage + 5 高亮 ≈ 微秒级；2000 词 passage + 20 高亮 ≈ 几毫秒，叠加 Finding 7 的频繁重 render，**每次答题点击都重算一次** → 低端 iPad 可感知。
- **重现**：长 passage（IELTS Reading Passage 3 通常 900–1100 词）+ 学生标了 10 处高亮，然后开始答题。每次 setAnswer 都重新 sort highlights + 切 8 段字符串。
- **建议修复**：
  1. `renderHighlighted` 用 useMemo 包，依赖 `[body, highlights]`。这个修复不依赖 Finding 1 的 context 拆分，应优先做。
  2. 内层 `<mark onClick={() => onRemove(h.id)}>` 每次重建箭头函数 → 不影响 React，但属于代码味道；可改 `data-id` + 单一委托 onClick。

---

## Finding 9 【中】`QuestionTypeRegistry.pickRenderer` 是裸 if/switch，无 fallback 出错信息

- **文件:行**：`_audit_review/exam/QuestionTypeRegistry.tsx:30-72`
- **性能影响**：每次 `<ExamRenderer paper={paper}>` render 都跑一遍 pickRenderer（第 75 行）。逻辑是 O(1) 字符串比较，约几十微秒，无 caching 也可接受。
- **正确性影响**：
  - 未知题型 fallback 到 `OLevelMcqList`（第 71 行）—— OLevelMcqList 假设 `q.snapshotOptions` 是 MCQ 选项；如果未知 `taskType` 是 essay 那种没选项的，会 fall through 到第 70-77 行的 textarea 分支，能渲染但**忽略所有数据特征**（passage、bank 等），用户体验为「界面不对劲」。
  - **没崩，但也没告警**——QA 不会发现。
- **建议**：
  1. 加 `console.warn` for unknown taskType。
  2. 或加 `fallback` 显式占位组件「Unsupported question type: <tt>」+ Sentry 上报。
- **registry lookup 性质（你问的）**：
  - 是 if/switch（第 38-71 行）不是 Map。
  - 注册时机是 module init —— 静态 import（第 2-7 行）一次性绑定，无运行时注册。
  - 每次 ExamRenderer render 都查一次（无 memo）—— 切题不会影响（renderer 选定后由各 shell 内部管 idx），但 **paper prop 引用变化（如父组件重 render 重建 ExamPaper 对象）会导致整个渲染器替换**：

---

## Finding 10 【高】`paper` 对象在每次 MorningQuizTake render 都重建 → ExamRenderer 看到新引用

- **文件:行**：`_audit_review/pages/MorningQuizTake.tsx:97-110`
- **性能影响**：高。这是隐藏在「为什么 IELTSReadingPassage 偶尔感觉慢」背后的元凶之一。
- **重现**：
  1. MorningQuizTake 任何 state 变化（如 `submitted` 切换、URL 参数变化、StrictMode 双 render）都重 render。
  2. 第 97-110 行 `const paper: ExamPaper = { ... questions: view.paperQuestions.map(...) }` **每次都新建顶层对象 + 新建 questions 数组 + 每题新建对象**。
  3. ExamShellChrome 收到新 `paper` prop → useMemo `answeredCount` 失效（第 143-150 行依赖 `paper.questions`）→ 重算。
  4. ExamRenderer 收到新 paper → IELTSReadingPassage 收到新 paper → useMemo `passageBody`/`groups` 失效（依赖 `passageContent.passage` / `paper.questions`）。passageBody 因为 string equality 还能稳定；groups 因为 questions 数组引用变 → 每次都重算。
- **建议修复**：
  ```tsx
  const paper = useMemo<ExamPaper>(() => ({
    sessionId: view.sessionId, ...
    questions: view.paperQuestions.map((pq) => ({ ... })),
  }), [view]);
  ```
  并把 ExamShellChrome 的 useMemo 依赖改为 `paper`（已经隐式包含 questions）。
- **额外**：ExamShellChrome 的 `answeredCount` 也是 N×Σ 的扫描，每次答题都跑（依赖 answers）—— 可接受，但可以改成增量计数器（在 setAnswer 里 ++/-- 计数）。

---

## Finding 11 【中】OLevelComprehension/OLevelVocab/OLevelSentenceTransformation 用本地 `idx` state，但跟 ExamContext 答题状态隔离

- **文件:行**：`_audit_review/exam/questions/OLevelComprehension.tsx:28`、`OLevelVocabInContext.tsx:24`、`OLevelSentenceTransformation.tsx:27`、`OLevelMcqList.tsx:14`
- **性能影响**：实际是**优势**——这些 shell 是分页的，只挂 1 题，不存在 IELTS 那种 N 题全展开的整树问题。
- **隐患**：
  - QuestionNavBar 跳转时（`document.getElementById('q-${qid}')`，MorningQuizTake.tsx:155-163）—— 在 paged shell 上，如果跳的 qid 不是当前 idx 的题，**id 不存在于 DOM**，只 setPaletteOpen(false)，没有切到对应 idx。
  - 这是功能 bug 不是性能 bug。MorningQuizTake.handleJump 不知道当前 shell 的 idx state，无法把 idx 对齐到目标题。
- **建议**：把 `idx` 提升到 ExamContext（或者新增 nav context），shell 通过 `useExamNav` 读 currentIdx；handleJump 写 currentIdx。本次性能审查范围外但顺手指出。

---

## Finding 12 【低】OLevelSentenceTransformation 的 textarea **同时**触发 setText（local）+ setAnswer（ctx），每次 keystroke 双写

- **文件:行**：`_audit_review/exam/questions/OLevelSentenceTransformation.tsx:101-105`
- **性能影响**：N=10 题（每题展开 1 个）时低；高频输入下叠加 Finding 1 + Finding 4，每次按键都触发：
  1. setText 重渲染本组件
  2. setAnswer 重渲染整个 Provider 树（Finding 1）
  3. setAnswer 序列化整个 answers map 写 localStorage（Finding 4）
  4. setAnswer 每次重置 600ms server timer
- **重现**：在 Sentence Transformation 题里快速打字，每秒 ~10 字符 → 每秒 10 次 ×（重渲 + localStorage 写 + clearTimeout/setTimeout）。在低端设备 + N>30 同卷展开的 IELTS shell 上叠加会显著慢；但 SentenceTransformation 一次只显示 1 题，所以问题被规模化抑制。
- **对照**：IELTSReadingPassage 的 `DebouncedTextarea`（第 430-448 行）和 `BlankAwareInput`（第 450-488 行）都用了 local state + onBlur flush，避免按键级 setAnswer。`OLevelCloze` 通过 `InlineGapInput` 也是 onBlur flush。**只有 SentenceTransformation 没遵循这个模式**。
- **建议**：和其他 shell 对齐——textarea 用 local state，onBlur 时 setAnswer，或加 200ms debounce。

---

## Finding 13 【中】OLevelMcqList textarea 没 debounce（落入 fallback 时同病）

- **文件:行**：`_audit_review/exam/questions/OLevelMcqList.tsx:71-77`
- **性能影响**：低（只在题目无 options 时走 fallback，且单题展开）。
- **建议**：复用 IELTSReadingPassage 的 `DebouncedTextarea`，提到 shared/。

---

## Finding 14 【低】`Highlighter` 的 selectionchange 没 debounce / 没用 mouseup 也用了 touchend

- **文件:行**：`_audit_review/exam/shared/Highlighter.tsx:122-125`
- **性能影响**：低；mouseup/touchend 是事件级触发，不是 selectionchange 的高频流。OK。
- **小问题**：`captureSelection` 没 useCallback —— 每次 Highlighter 重 render 都重新绑定 listener。React 会自动 detach + reattach。N 次 setAnswer 触发的整树 re-render（Finding 1）会带来 N 次 `mouseup`/`touchend` listener rebinding。**实际成本可忽略**。

---

## Finding 15 【中】StickyNote 用 `prompt()` 阻塞 UI；这不是性能但写在这

- **文件:行**：`_audit_review/exam/shared/StickyNote.tsx:74, 88`
- **性能影响**：阻塞主线程直到用户关闭原生对话框。在 iOS Safari 上 `prompt` 行为不一致（部分版本被阻止）。
- **建议**：替换为受控 Modal。

---

## Finding 16 【低】DraggableSplit 用 `window.innerWidth` 直接读 → 不响应窗口 resize

- **文件:行**：`_audit_review/exam/shared/DraggableSplit.tsx:98, 124`
- **性能影响**：无；行为问题。`typeof window !== 'undefined' && window.innerWidth >= mobileBreakpoint` 在 SSR 安全但 desktop 上窗口 resize 不会重新评估。
- **建议**：用 `useMediaQuery('(min-width: 1024px)')` hook。

---

## Finding 17 【中】Timer 的 setInterval 1000ms 节奏 + 整树 re-render → 每秒一次「整个 ExamShellChrome subtree refresh」

- **文件:行**：`_audit_review/exam/shared/Timer.tsx:13-19`
- **性能影响**：自身不重——Timer 自己 `useState now`，重 render Timer 自己。**但**：MorningQuizTake → ExamShellChrome（含 Timer + ExamRenderer）—— Timer 是 ExamShellChrome 的子，Timer 重 render 不会冒泡 push 父级。所以这条不是问题。
- **更细查**：第二个 effect（第 22-27 行）依赖 `[remainingMs, fired, onTimeUp]`，每秒 effect 重订阅 + cleanup。无副作用，但浪费。改为 `if (remainingMs <= 0 && !fired)` 检查在 setInterval 回调内做更直观。

---

## 整体结论

### 按代码静态推理估算的卡顿阈值

| 题量 N | 题型混合 | 设备 | 预期体验 |
|---|---|---|---|
| ≤ 15 | 任意 | 中端 iPad / 笔电 | 流畅 |
| 15–30 | IELTS shell（一次性展开） | 中端 iPad | 答题点选 ~50ms 延迟（可感但可接受） |
| 30–50 | IELTS shell + 长 passage（>1000 词） + 5+ 高亮 | iPad Air 2018 | 输入有视觉延迟（每键 ~80–150ms），高亮长 passage 卡顿明显 |
| 50–100 | 全 textarea + IELTS shell | 任何设备 | 输入丢字符（结合 Finding 4 的同步 localStorage 写 + Finding 1 整树 re-render） |
| ≥ 100 | 任意 | 低端 Android tablet / 老 iPad | 不可用（每次 setAnswer 触发 100+ 组件 re-render） |

> ⚠ **以上数字是凭代码读出的、按 React 渲染语义估算的，未经 profiler 实测验证**。真实拐点可能向左或向右偏移 30–50%。建议在 N=30、N=60、N=100 各做一次 React DevTools 的 commit duration 抓取再下定论。

### 当前架构能撑住的现实题量

- **早测原始场景（N ≤ 20，paged shell 居多）**：完全没问题。当前所有 finding 的实际触发概率低。
- **IELTS Reading 单 paper（N=14，passage ~900 词，shell 全展开）**：能用，但答题手感会比同体量的纯 paged 卷子明显差；高亮 + 答题混用时尤其。
- **IELTS Reading 整套 3 篇 paper（N=40，3×passage）**：**已接近卡顿阈值**。这才是当前代码下最值得担心的真实工作负载。

### 优先级建议（按 ROI 排序）

1. **(P0)** Finding 10 — `paper` 对象 useMemo 化（MorningQuizTake.tsx:97）。改 5 行修复一个根因。
2. **(P0)** Finding 8 — `renderHighlighted` useMemo（Highlighter.tsx:57）。改 3 行，对长 passage 收益直接。
3. **(P1)** Finding 7（部分） — `useStoredHighlights` / `useStoredNotes` 的 setter 用 useCallback。改 4 行。
4. **(P1)** Finding 1 — 拆 ExamContext 为 meta / flags / answers 三 context。中等改动（~80 行），是消除 N≥30 卡顿的根本方案。
5. **(P2)** Finding 4 — localStorage 写 debounce。
6. **(P2)** Finding 12 — SentenceTransformation textarea 用 local state + onBlur。
7. **(P3)** Finding 9 — registry 加 unknown taskType 的 console.warn。
8. **(P3)** Finding 6 — handleSubmit useCallback。

### 没问题的地方（正面观察）

- ExamProvider 的 `mode`、`fontScale`、`isOffline` 等标量值已经走 useMemo，引用稳定。
- `setFontScale`、`toggleFlag` 用了 useCallback。
- localStorage hydration 是 lazy init（`useState(() => ...)`），不会每次重 render 都读 localStorage。
- 大部分 textarea/input（IELTS 系、Cloze 系）已自觉用 local state + onBlur flush 避免按键级 ctx 写。
- registry 静态注册（module init），符合预期。
- Timer 的 onTimeUp 用了 `fired` guard 防止重复触发。

### 没在代码中看到、但生产环境可能放大问题的因素（推测）

- React StrictMode：双 render 会让所有 finding 中的 re-render 数翻倍。代码里没看到是否启用 StrictMode（需查 main.tsx），如果启用了，N=15 时已可能感受到 finding 1 的影响。
- iPad Safari 的 localStorage 同步写性能比 Chrome 慢约 2–3 倍（凭过往经验，未在本仓库实测）—— 放大 Finding 4 的影响。

---

**审查结束。所有结论基于代码静态阅读，未跑实测；本人无 profiler 数据支持。建议在合并前对 N=30 / N=60 各做一次 React DevTools commit duration 抓取以验证拐点位置。**
