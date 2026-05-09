# Round-3 深度审查 · Agent 1 · 类型 / 静态分析

**审查范围**：`a3398dc^..5bb3a04`（7 个 commit），共 25 个新/改文件，集中在 `apps/web/src/components/exam/` 和 `apps/web/src/pages/MorningQuizTake.tsx`。

**审查方法**：
- `git show 5bb3a04:<path>` 抽取审查版本到临时目录逐文件 Read。
- 把所有非 test 文件复制到主仓库 `apps/web/src/_audit_tmp/`，用主仓库的 hoisted `tsc` 实跑 `tsc --noEmit`，**EXIT=0，零类型错误**。
- 创建临时 git worktree 指向 `5bb3a04`、软链 `node_modules` 跑 tsc：剩余的错误全部来自 `5bb3a04` 在 `package.json` 声明但 main 分支尚未安装的 testing 依赖（`@testing-library/react`、`@testing-library/user-event`、`@testing-library/jest-dom`、`vitest`、`jsdom`），与新代码本身无关。
- 用 Grep 扫了所有 `: any`、`as `、`!.`、未使用 export、TODO/FIXME 标记。

`apps/web/tsconfig.json` 关闭了 `strict`、`noUnusedLocals`、`noUnusedParameters`、`noImplicitAny`、`noUncheckedIndexedAccess`，所以很多隐式 any、未使用变量、数组越界都不会被 TS 抓到。下面的 finding 大部分是肉眼复盘出来的运行时风险，不是 tsc 报错。

---

## [Critical] 空 `paper.questions` 数组会让所有 O-Level 渲染器立即崩

- 文件:`apps/web/src/components/exam/questions/OLevelMcqList.tsx:16-22`，同型问题在 `OLevelComprehension.tsx:30、49`、`OLevelVocabInContext.tsx:26、30`、`OLevelSentenceTransformation.tsx:29、32` 都存在。
- 影响：当 `paper.questions = []` 时，`const q = paper.questions[idx]` 返回 `undefined`，但 TS 因为 `noUncheckedIndexedAccess` 关闭把 `q` 标成非空 `ExamQuestion`。下一行立即 `const ans = answers[q.id]` 会抛 `TypeError: Cannot read properties of undefined (reading 'id')`，整个 React 树 unmount。
- `pickRenderer` 在 paper.questions 为空时返回 `OLevelMcqList`（`QuestionTypeRegistry.tsx:31-32`），等于把空 paper 直接送给一个会崩的组件——保护反而失效。
- 重现：API 返回 `paperQuestions: []`（理论上不会，但 morningQuizSession 在异常 session 状态下可能），或者后端在 paper 还没 snapshot 完就让 session 进 active —— 学生页直接白屏。
- 建议修复：要么在 `MorningQuizTake.tsx` 检测 `view.paperQuestions.length === 0` 时显示 "试卷尚未准备好"，要么在每个 `OLevel*` renderer 顶端早返回。前者更符合“薄壳”设计。

## [High] `ExamAnswer` 在 `types.ts` 和 `ExamContext.tsx` 重复定义，导致 types.ts 中的 export 实际上是 dead

- 文件:`apps/web/src/components/exam/types.ts:35-38` 与 `apps/web/src/components/exam/ExamContext.tsx:19-22`
- 影响：`types.ts` export 了 `ExamAnswer`，但项目里没有任何文件 `import` 它（grep 验证过）。`ExamContext.tsx` 自己定义了一份**结构相同**的本地 `ExamAnswer`，并以此驱动 `setAnswer` 签名和 context value。两者形状目前一致所以编译通过——但等于现在有两个真值源。
- 重现：以后给 `types.ts` 的 `ExamAnswer` 加字段（例如 `attemptedAt: string`），ExamContext 的本地版不会跟着改，`useExam().setAnswer` 调用方传新字段会被 TS 拒，但开发者会以为改了 types.ts 就够了。
- 建议修复：删除 `ExamContext.tsx:19-22` 的本地 interface，改成 `import type { ExamAnswer } from './types'`。或者反过来从 ExamContext 导出。任选一种把单一来源定下来。

## [High] `snapshotContent: any` 是审查范围内最大的类型逃生口，且每个 renderer 都在裸访问其字段

- 文件:`apps/web/src/components/exam/types.ts:31`、`apps/web/src/pages/MorningQuizTake.tsx:38`
- 影响：`ExamQuestion.snapshotContent` 声明为 `any`，所有 renderer 都做 `c.taskType`、`c.passage`、`c.correctOption`、`c.headingsBank`、`c.wordBank`、`c.original`、`c.starter`、`c.maxWords`、`c.exampleAnswer`、`c.contextSentence`、`c.targetWord`、`c.uiKind`、`c.blankIndex`、`c.correctAnswer`、`c.explanation` 等十多个字段访问，全部是 `any` 出 `any`。
- 多数访问点用了 `?? ''`、`typeof === 'string'`、`Array.isArray()` 守卫，运行时基本安全（这点写得不错），但 TS 不在帮忙——比如把 `c.correctAnswer` 当 string 比较的地方与某个 renderer 期望的字段名错位时编译器不会提示。
- 重现：把 `OLevelCloze.tsx:60` 的 `correctAnswer` typo 成 `correctAnser`，`fb` 永远是 null，`tsc` 不会报错，practice 模式反馈静默失效。
- 建议修复：把 snapshotContent 升级成一个 discriminated union（按 `uiKind` / `taskType` 分支），或者至少抽出一个 `ParsedQuestionContent` interface 描述十多个字段。即使保留 `any`，也建议加一个集中的 normalize 函数返回 typed 对象。

## [High] 在 ExamContext 用 `useMemo([])` 持有 timer Map，理论上会丢 pending 保存

- 文件:`apps/web/src/components/exam/ExamContext.tsx:134`
- 影响：`const timersRef = useMemo(() => new Map<...>(), []);` —— React 文档明确说 `useMemo` 仅是性能优化，不保证保留。如果 React 决定重新计算（罕见但可发生在 dev mode StrictMode 双调用、或未来版本的 cache eviction），新 Map 替代旧 Map → pending `setTimeout` 句柄丢失但 timer 还在跑，导致 600ms 后保存的回调中 `timersRef.delete(qid)` 操作的是新 Map，把同 qid 的下一个 timer 错误清掉，引发竞态。
- 重现：StrictMode 下 ExamProvider 双重 mount → 第一次 mount 留下的 timer 在新 Map 里没有 entry，但仍会触发一次 `onPersistAnswer`，正常情况下没问题；但若用户在两次 mount 之间快速 setAnswer，行为不可控。
- 建议修复：改成 `const timersRef = useRef(new Map<...>());`，`timersRef.current.get(qid)` 等。语义上完全一致但 React 保证 ref 稳定。

## [Medium] `mq:fontScale` localStorage 键全局共享但文件内变量名 `FONT_KEY` 是常量字符串，跨用户/学生场景会串

- 文件:`apps/web/src/components/exam/ExamContext.tsx:68`
- 影响：`ANSWERS_KEY` 和 `FLAGS_KEY` 是 `(sid) => 'mq:answers:' + sid`，按 session 隔离；但 `FONT_KEY = 'mq:fontScale'` 是单例。如果同一台设备多个学生轮流登录（机房/共享 iPad），上一个学生设的字号会保留给下一个学生——这其实是产品意图（注释明确说要 cross-session 保留），但跨**学生**未必想这样。这是产品层面的取舍，仅指出 type 上没有 user/tenant 维度。
- 建议修复：把这条记录到 known-tradeoffs，或者按 `userId` namespace 一次。不算硬 bug。

## [Medium] `localStorage` 反序列化无 schema 校验，被外部污染会让 React 渲染崩

- 文件:`apps/web/src/components/exam/ExamContext.tsx:85`、`97-98`、`apps/web/src/components/exam/shared/Highlighter.tsx:139`、`apps/web/src/components/exam/shared/StickyNote.tsx:27`
- 影响：所有 `JSON.parse(localStorage.getItem(...))` 都直接强转为期望类型（`as string[]`、`Highlight[]`、`Note[]`、`Record<string, ExamAnswer>`），没有运行时校验。如果某个 chrome 扩展/旧版本残留写了 malformed 数据，hydrate 后第一次 render 就会崩（如 `Highlight[].map` 期望对象有 `start`/`end`）。
- 重现：手动 `localStorage.setItem('mq:hl:s1', '"oops"')` 后访问 IELTS 阅读 → `[...highlights].sort` 在字符串上 OK，`renderHighlighted` 第一次 `body.slice(h.start, h.end)` 中 `h.start` 为 undefined，slice 返回空字符串，不会崩。但 `mq:answers:` 被污染成 `'"oops"'` → `{ ...cached, ...initialAnswers }` 把字符串展开成 numeric-keyed map，运行时不立刻崩但 `answers[q.id]` 永远 undefined，所有缓存丢失。
- 建议修复：每个 hydrate 处加 `Array.isArray()` / `typeof === 'object'` guard，校验失败回退默认值并清掉 localStorage。

## [Medium] `Timer` 接 `endsAt` 非法字符串时显示 `NaN:NaN` 且 `onTimeUp` 不会触发

- 文件:`apps/web/src/components/exam/shared/Timer.tsx:21-23`
- 影响：若 `paper.quizEnd` 为空字符串或非 ISO 时间，`new Date(endsAt).getTime()` 是 `NaN`，`Math.max(0, NaN - now)` 仍然是 `NaN`（`Math.max(0, NaN) === NaN`）。`mm`/`ss` 都变成 `'NaN'`，并且 `remainingMs === 0` 永远 false → auto-submit 不触发。
- 重现：API 在某条异常 path 上没回 `quizEnd` 字段、`view.quizEnd ?? ''` 默认了空串。Header 显示 `NaN:NaN` 并永不交卷。
- 建议修复：在 Timer 内 `Number.isFinite(endTimeMs)` 守卫，非法时段显示 `--:--` 并立即 `onTimeUp?.()` 或保持禁用。

## [Medium] `(c.taskType as TaskType) ?? '_other'` 是不诚实的 unsafe assertion

- 文件:`apps/web/src/components/exam/questions/IELTSReadingPassage.tsx:70`
- 影响：`c.taskType` 来自 `any`，可以是任意字符串。强转为 `TaskType` union 后，下游 `tt === 'matching_features'` 等比较在运行时仍然安全（因为 string===string），但 TS 类型系统认为只可能是这 13 个 union 值。任何拼写错误（例如服务端发 `matching_information_v2`）会落到 default 分支但**类型检查器不会提醒可能错过的 case**。
- 重现：低——现有 ieltsTaskTypes Set 在 registry 也用了同一个白名单。但白名单与 TaskType union **同步是手动的**，二者目前只匹配 13 项（一致），未来加新类型时可能漏。
- 建议修复：把 `TASK_TITLES` keys、`ieltsTaskTypes` set 和 `TaskType` union 统一为单一来源（`as const` 数组 + `typeof`+`Set`）。

## [Medium] `OLevelSentenceTransformation` 每次按键直接 `setAnswer`，与其他输入组件用 `onBlur` flush 风格不一致

- 文件:`apps/web/src/components/exam/questions/OLevelSentenceTransformation.tsx:102-105`
- 影响：`onChange={(e) => { setText(...); setAnswer(q.id, { textAnswer: e.target.value }); }}` —— 每次按键都更新 context state。其他输入（`InlineGapInput`、`LetterInput`、`DebouncedTextarea`、`BlankAwareInput`）都用 local state + `onBlur` 提交，避免每次按键 → context re-render → 整页重渲。Provider 内的 600ms server debounce 还在，所以**网络请求**没问题，但**前端 re-render** 在长 textarea 输入上会频繁。
- 重现：在 transformation 题里疯狂打字，devtools profiler 应能看到 ExamProvider 每帧重 render，所有 question card 都跟着 re-render（因为 `answers` 变化）。Provider 的 useMemo 依赖含 `answers`，所以 value 引用变了。
- 建议修复：照搬 `BlankAwareInput` 的 local + onBlur 模式，或者在 `setAnswer` 里加另一个内部 state-merge debounce。这条与 Agent 6 的 perf 切片有重叠。

## [Low] `cur!.questions.push` 用了 non-null assertion，依赖前一行的隐含约束

- 文件:`apps/web/src/components/exam/questions/IELTSReadingPassage.tsx:88`
- 影响：上一行 `if (!sameAsCurrent) { cur = { ... }; groups.push(cur); }` 之后 cur 一定 non-null；进 else 分支时 cur 也一定 non-null（因为 `sameAsCurrent` 隐含 `cur !== null`）。所以 `!` 在运行时安全。但写法把不变量交给读者去推，未来重构容易踩坑。
- 建议修复：把 cur 的初始化提前到 forEach 外（用第一个 question 初始化），或者改用 reduce，省掉 `!`。

## [Low] `Math.random().toString(36).slice(2, 10)` 生成的 uid 长度只有 8 个 base36 字符 (~10^14 空间)，多用户并发场景碰撞概率非零

- 文件:`apps/web/src/components/exam/shared/Highlighter.tsx:24-26`、`apps/web/src/components/exam/shared/StickyNote.tsx:16-18`
- 影响：单个学生同一题 highlights 数量很少 (<100)，碰撞实际不会发生。Note 同理。但既然项目已经有 sessionId，按 `${sessionId}-${counter}` 更稳。
- 建议修复：不必动手——如有 crypto.randomUUID() polyfill 可改，但优先级低。

## [Low] `useStoredHighlights` / `useStoredNotes` 返回的 setter 在每次 render 时是新引用

- 文件:`apps/web/src/components/exam/shared/Highlighter.tsx:144`、`apps/web/src/components/exam/shared/StickyNote.tsx:29-32`
- 影响：`const set = (next) => { ... }` 是普通函数声明，每次 render 都是新引用 → 传给 `<Highlighter onChange={setHighlights}>` 时 props 视为变化 → 子组件不必要地 re-render。功能正确，仅 perf 问题。
- 建议修复：用 `useCallback`。

## [Low] DraggableSplit 用 `typeof window !== 'undefined' && window.innerWidth >= mobileBreakpoint` 判断布局且未监听 resize

- 文件:`apps/web/src/components/exam/shared/DraggableSplit.tsx:98、124`
- 影响：iPad 在 portrait/landscape 切换时 innerWidth 变化，但组件不重新计算（仅在 render 时取 innerWidth）。Tailwind `lg:hidden`/`lg:block` 是 CSS-driven，所以视觉切换其实由 CSS 处理；但 inline `style={{ width: ... }}` 是 SSR/初次 render 的快照，旋转后宽度不更新——即使 CSS 让 lg 列消失，可能仍有 width 计算值滞留。
- 重现：iPad 在 IELTS 阅读页旋转屏幕，左侧 panel 宽度可能停在旧 leftPct/100% 之间。
- 建议修复：用 `matchMedia('(min-width: 1024px)')` 监听 + 触发 setState，或者干脆删掉 inline width，全用 Tailwind 的 `lg:w-[Xpct]` 配合 CSS 变量。

## [Low] `OLevelMcqList` 的 `OLevelMcqListView` re-export 和 `ExamQuestion` re-export 是 dead code

- 文件:`apps/web/src/components/exam/questions/OLevelMcqList.tsx:113-114`
- 影响：grep 全仓库无人 import 这两个名字。`OLevelMcqListView` 注释说 “Exposed so other shells can reuse the question card if needed” —— 但文件里没单独 export 出 question card 组件，re-export 整个 `OLevelMcqList` 起的别名意义不大。
- 建议修复：删除两行 re-export，或者真正抽出 `OLevelMcqCard` 子组件再 export。

## [Low] `types.ts` 的 `QuestionRenderKind` 类型完全未被使用

- 文件:`apps/web/src/components/exam/types.ts:52-58`
- 影响：注释说 “registry uses to pick a renderer”，但 `QuestionTypeRegistry.tsx` 没有 import 它，pickRenderer 直接返回 component。dead export。
- 建议修复：要么删掉，要么让 pickRenderer 返回 `{ kind: QuestionRenderKind, Renderer: ComponentType }` 让外部能 telemetry/skin 切换。

## [Low] `MorningQuizTake.tsx` 解构 `isFlagged` 但从未使用

- 文件:`apps/web/src/pages/MorningQuizTake.tsx:140`
- 影响：`const { answers, flaggedCount, isFlagged } = useExam();` —— `isFlagged` 在整个 ExamShellChrome 内没出现。`tsconfig` 关了 `noUnusedLocals`，所以编译过；但属于代码 bloat。
- 建议修复：去掉解构。

## [Low] `MorningQuizTake.tsx` `handleJump` 的 `_idx` 参数下划线表示未用，但 `QuestionNavBar` 的 `onJumpTo` 签名也不要求第二个参数

- 文件:`apps/web/src/pages/MorningQuizTake.tsx:152`
- 影响：把 `_idx` 留下没什么坏处，但与 `onJumpTo: (qid: string, idx: number) => void` 的签名约定有细微 noise。
- 建议修复：删除 `_idx` 形参。可以做也可以不做。

## [Nit] `e: any` 在两个 `.catch` 处用得很轻率

- 文件:`apps/web/src/pages/MorningQuizTake.tsx:58、79`
- 影响：`.catch((e: any) => setError(e.message ?? String(e)))` —— `e: unknown` + `e instanceof Error` narrow 是更诚实的写法，但当前模式不会出 bug（`?? String(e)` 兜底了）。
- 建议修复：换成 `unknown` + 守卫，工作量小。

## [Nit] 测试依赖 `vitest`/`@testing-library/react`/`@testing-library/user-event`/`@testing-library/jest-dom`/`jsdom` 在 `package.json` 已声明，但合并到 main 后必须先 `npm install` 才能 `tsc` 或 `npm test`

- 文件:`apps/web/package.json` (5bb3a04 版本) vs main 的 lock
- 影响：当前 worktree 分支和 main 都还没装这些依赖；如果 CI 直接 `tsc --noEmit` 或 `npm run build`（tsconfig include `src` 包含 `__tests__`），会因为 `Cannot find module '@testing-library/react'` build 失败。这不是新代码的 type bug，但发布流程上是一个阻塞步骤。
- 建议修复：合并 PR 前确保 `npm install` 在所有环境跑过；或者把 `__tests__` 路径加到 tsconfig `exclude`。

## [Nit] `splitStem` 对纯空白 stem 的行为未指定

- 文件:`apps/web/src/components/exam/shared/textUtils.ts:28-38`
- 影响：`stem.trim()` 为 `''` 时，`matchAll(/\n\s*\n/g)` 长度 0 → 返回 `{ instruction: '', item: '' }`。下游 IELTS 把 item 当 itemText 显示，UI 是空 div，不会崩。OK。
- 建议修复：无需动手。

---

## 整体结论

这个切片在 **TypeScript 编译干净度** 上没有问题——把所有非 test 文件丢进主仓库的 web 工作区跑 `tsc --noEmit` 是 EXIT=0、零错误。新代码在受 `strict: false` 庇护的当前 tsconfig 下完全过编译。审查范围内**没有 `@ts-ignore` / `@ts-nocheck`** 和明显的不安全 assertion。

主要风险是 **`snapshotContent: any` 这个大逃生口** 让大量字段访问失去 TS 保护——所有 renderer 都在裸读 `c.passage`、`c.correctOption`、`c.taskType` 等十多个字段，靠运行时 `?? ''` / `typeof` / `Array.isArray()` 兜底（兜得不错），但这意味着 schema drift 静默无声。

下面三件事建议主审查员升级到合并前必须解决：
1. **空 `paper.questions` 数组让所有 OLevel renderer crash**（Critical）——修一行守卫即可。
2. **`ExamAnswer` 在 types.ts 和 ExamContext.tsx 重复定义**（High）——简单改成 import。
3. **`useMemo([])` 持有 timer Map**（High）——改成 `useRef`，5 分钟修。

剩余 medium 多为防御编程缺口（localStorage 污染、Timer NaN）和 perf 风险（每键 setAnswer、不稳定 setter），可以在合并后跟进。test 依赖未在 main 安装是发布流程要点，不是代码 bug。

整体我给这切片**“小修后可合并”**的评价——结构清晰、命名一致、type 系统使用没有反模式，但因为 `strict: false` 加上 `any` 出 `any` 的链路，TS 实际给的保护远低于理论值。
