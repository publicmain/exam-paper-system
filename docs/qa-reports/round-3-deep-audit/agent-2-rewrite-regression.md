# Round-3 深度审查 · Agent 2 — MorningQuizTake 重写回归

## 审查范围与基线确认

**先纠正一个事实**：用户提供的 `a3398dc` 不是重写 commit，而是 “API 加 level/paperMode” 的辅助 commit。真正的 1215→260 行重写是 **`6ce57ff`**。审查基线：

- 旧版 = `6ce57ff^:apps/web/src/pages/MorningQuizTake.tsx`（1126 行）
- 新版 = `6ce57ff:apps/web/src/pages/MorningQuizTake.tsx`（297 行；不是 260）

**还有一个更大的事实问题需要先指出**：当前工作目录所在分支 `claude/intelligent-snyder-70adcc` **并不包含**这次重写。重写位于 `claude/youthful-volhard-f60797` 分支（commits 2fc1365、e6cb442、5f64a64、6ce57ff、e482df8、5bb3a04）。当前 HEAD 上 `apps/web/src/pages/MorningQuizTake.tsx` 仍是 1126 行的旧实现，`apps/web/src/components/exam/` 目录甚至不存在。所以严格说这一刀对线上分支并未落地，本次审查只是审查“另一分支上的备选重写”。审查仍按用户要求进行。

新版本依赖以下新增组件（同一 commit 系列引入，全部存在于重写分支）：
- `apps/web/src/components/exam/ExamContext.tsx`
- `apps/web/src/components/exam/QuestionTypeRegistry.tsx`
- `apps/web/src/components/exam/questions/IELTSReadingPassage.tsx`（+ 4 个 O-Level 渲染器）
- `apps/web/src/components/exam/shared/{Timer, FontSizeAdjuster, QuestionNavBar, OfflineBadge, Highlighter, StickyNote, QuestionFlag, DraggableSplit}.tsx`

---

## Findings

### [低] 提交流程：API 调用与校验完整保留，提交 promise 状态有细微竞态

- **老 vs 新**：
  - 老：`handleSubmit` → `api.morningQuizSubmit(sessionId)` → `navigate('/student')`；提交前 `setSubmitted(true)`，失败 `setSubmitted(false)`。无任何 client-side 校验（必填、字数等）。
  - 新：完全相同 API 路径（`api.morningQuizSubmit`），多了一行 `localStorage.removeItem('mq:answers:'+sid)`。同样无 client-side 校验。
- **影响**：老版本本来就没必填/字数校验，新版本没有“切丢”校验，没有功能性回退。但是新版本两个 effect 互相独立——`Timer.onTimeUp` 自动调 `onSubmit`、用户点交卷也调 `onSubmit`——`submitted` flag 在 React state 中，在异步 `setSubmitted(true)` 落地前理论上可能并发触发两次（罕见但可能：定时器到点的同一帧用户点了交卷）。老版本是同样的 race，没回退。
- **重现**：让 `quizEnd` 设到 1 秒后，在最后一秒手动点交卷。可能看到两次提交请求。
- **建议修复**：用 `useRef<boolean>` 替换 `useState` 做 submitted 守卫，避免 React 批处理延迟。这是老/新共同问题，不算回退。

### [中] 自动保存：debounce 引入，但 radio 选项失去“点击即保存”的及时性

- **老 vs 新**：
  - 老：`saveAnswer` 在每个 `onChange`/`onBlur` 立即 fetch；`RadioGroup.onClick` 选完即发，`LetterInput`/`DebouncedTextarea`/`BlankAwareInput` 在 `onBlur` 发。**没有 debounce、没有 localStorage 缓存。** 刷新网页等于丢失页面状态（虽然服务器已保留单题答案，但页面无法 hydrate 回填）。
  - 新：`ExamProvider.setAnswer` 把 600ms debounce 应用到所有题型，包括 radio。本地立即写 `localStorage['mq:answers:<sid>']`。
- **影响**：
  - 改进：完成题→立即关浏览器标签页这个动作，老版有最长一次网络往返的丢失风险，新版有最长 600ms 的网络丢失风险（但有 localStorage backup，可在下次进同一 session 时合并）。整体上新版更安全，因为有了本地缓存 fallback。
  - 回退：单选题（TFNG / MCQ）老版“点一下就发”，新版要等 600ms。在 last-second（quiz 即将结束）的场景下，如果用户最后一秒点中选项，timer 触发 auto-submit 早于 debounce flush，最后一题会丢。老版同场景反而能赶上。
- **重现**：把 quiz 时长改到 5 秒，最后 1 秒点 MCQ 选项后立刻被自动提交，看服务器是否记录了该选项。
- **建议修复**：对 radio 类（无后续修改语义）`setAnswer` 调用走 0ms（即同步）路径；只对 free-text 做 debounce。或者 `Timer.onTimeUp` 在调 `onSubmit` 前先 `await` flush 所有待发 timer。

### [中] 刷新恢复：从“完全丢”升级到“localStorage 半恢复”，但服务器答案没拉回来

- **老 vs 新**：
  - 老：刷新后页面 state `answers={}` 重置；服务器虽有部分单题保存，但页面不 fetch 回来——已答的 MCQ radio 在 UI 上重新变成“未选”，需要用户重答（重答会再触发服务器保存覆盖原答案，行为是“答案被擦掉”的错觉）。
  - 新：`ExamProvider` 启动时从 `localStorage['mq:answers:<sid>']` hydrate；同时支持 `initialAnswers` prop 但 **`MorningQuizTake.tsx` 从未给 `ExamProvider` 传 `initialAnswers`**（line 113），意思是“服务器答案永远不会被拉回 hydrate”。
- **影响**：
  - 改进：单设备同一浏览器刷新——新版恢复完整。
  - 仍存在的洞：跨设备/跨浏览器/清缓存 → localStorage 没有 → 页面拉空白；但服务器其实有该学生的答案。这一点没有回退（老版同样没拉），但 ExamProvider 给的 `initialAnswers` 钩子是个明显的 TODO 没接上。
- **重现**：A 设备答 5 题，B 设备登录同一账号同一 session，B 设备看不到 A 的答案。
- **建议修复**：API 增加 `currentAnswers` 字段或新加 `GET /sessions/:id/answers`，页面获取后传入 `<ExamProvider initialAnswers={...}>`。

### [中] 计时器：从“到 0 秒后续触发”改为“严格触发一次”，但首挂载即过期会立即提交

- **老 vs 新**：
  - 老：`useEffect([remainingMs, view, submitted])` 监听 remaining，到 0 → 调 handleSubmit；submitted=true 后不再触发。手动续命（修改 quizEnd）刷新后 timer 续上。
  - 新：`Timer` 内部 `fired` 一次性 flag，`remainingMs===0 && !fired` → 触发，`fired=true` 后不再触发。
- **影响**：行为基本一致。但有边界差异：
  - 老：用户进入一个已经 expired 的 session（比如旧链接），会立即触发 auto-submit；新版同样行为。
  - 新：组件 unmount/remount（比如父组件强制重新挂载）会重置 `fired`，理论上可二次触发；老版本 useEffect 也会重新订阅，但 `submitted` state 还在所以会守住。
  - 这是一种潜在但极其罕见的边界——StrictMode 下 dev 时 effects 会跑两次，老版第二次会被 `submitted` 拦下，新版第二次因为是新的 Timer 实例所以 `fired=false`，可能调 onSubmit 两次。`onSubmit` 在 `MorningQuizTake.handleSubmit` 内有 `submitted` 守卫，所以最终不会双重提交，但这个守卫不在 Timer 自己里。
- **重现**：开发模式 React.StrictMode 下进入接近 quizEnd 的 session，看 onTimeUp 会不会触发两次（第二次会被 page 的 submitted 拦下）。
- **建议修复**：`Timer` 也用 `useRef<boolean>` 而不是 state 来记 fired，让 StrictMode 双跑也只算一次。或者把“到点已过”作为永久状态而不是“边沿触发”。非阻塞性。

### [无] 键盘导航：老/新都没有

- **老 vs 新**：用 grep 扫了 `keydown|onKeyDown|ArrowLeft|ArrowRight|Enter`，**两个版本都为零**。
- **影响**：用户描述的“老版本是否有 ←/→ 跳题、Enter 提交、数字键选 MCQ”这些功能 **从来都没有过**，谈不上回退。

### [低] 错误状态展示：表层一致；新版多了 OfflineBadge 但内容更窄

- **老 vs 新**：
  - 老：任意 `error`（API 抛异常）→ 顶部红色横幅 `⚠️ {error}` + 返回首页链接；提交失败 → 同一个错误面板；网络断 → 走 fetch 失败的 catch 链路，显示 `Failed to fetch` 之类。无 navigator.onLine 监听。
  - 新：保留同一个红色错误面板（line 86-93）。**新加** `<OfflineBadge>` 监听 `navigator.online/offline`，离线时顶部黄色胶囊提示“离线 · 答案保存在本地”。但 `ExamContext.setAnswer` catch 错误时只是 swallow，**不会再写到顶部 error 面板**——所以 token 过期、403、5xx 等服务器错误（不是网络断）在写答案时就被吞掉了。
- **影响**：
  - 改进：网络断的体验明显好。
  - 回退：服务器侧错误（比如 quiz 窗口已关 → 后端抛 `quiz_window_closed`）在老版本会冒泡到顶部红条，提醒学生“你的答案没存上”；新版本这条错误被静默吃掉，UI 上看不到任何异常，本地却以为已存。
- **重现**：手动把 `quizEnd` 改到过去（让后端拒），然后在前端继续答题，看不到任何错误。
- **建议修复**：`ExamProvider` 增加 `onPersistError(qid, err)` 回调，由 page 决定是否显示错误条。或者把最后一次失败原因暴露给 `useExam` 让 chrome 显示一个 toast。

### [中] IELTS passage_pick 渲染：dispatcher 引入是新增能力，但首题非 passage 时 fallback 错位

- **老 vs 新**：
  - 老：MorningQuizTake **始终**渲染 `PassagePanel + TaskGroupView`，**不管 paper 是不是 IELTS**——所以 O-Level 单选题进来会显示空 passage panel。这本来就是个 bug。
  - 新：`pickRenderer(paper)` 看 `paperMode === 'passage_pick'` 或第一题 `taskType` 是不是 IELTS taskType 集合中的成员 → IELTSReadingPassage；否则按 uiKind / passage 长度 / fallback 走 O-Level 渲染。passage 数据来源仍是 `paper.questions[0].snapshotContent.passage`。
- **影响**：
  - 改进：O-Level 终于不再无脑套 IELTS 模板。
  - 新洞：如果 IELTS paper 因为某种原因 **第一题没 taskType**（脏数据 / 半残的 paper）但 `paperMode=passage_pick`，`pickRenderer` 还是会走 IELTS 分支——OK。
  - 但反过来：如果 paper 实际上是 IELTS 但 `paper.config.mode` 不是 `passage_pick`（比如是新建的 ielts_authentic 但创建路径漏了），且第一题恰好被 shuffle 后变成 `multiple_choice` taskType——dispatcher 会把它判成 IELTS 没问题。但如果第一题 taskType 字段缺失，则会 fallback 到 OLevelComprehension/McqList，其它 IELTS 题（matching_features 之类）渲染就乱了。
  - 数据来源：`paper.questions[0].snapshotContent.passage`——如果 paper 经过了 shuffle（非 passage_pick 模式）且第一题不是承载 passage 的那道题，`passage` 字段就读不到。`isPassagePick` 时 service 跳过 shuffle（已确认 service 600 行附近的逻辑），所以这个隐患只会在 `paperMode != passage_pick` 但又被 dispatcher 误判成 IELTS 时出现——可能性不大但不为 0。
- **重现**：构造一个 paper，第一题 `snapshotContent.taskType='multiple_choice'` 但 `paperMode='standard'`，看 dispatcher 选什么，看 passage panel 是不是空。
- **建议修复**：把“是否 IELTS”做成 paper-level 而非 first-question-level 的判定（用 `paper.paperMode === 'passage_pick'` AND/OR `paper.level.startsWith('ielts')`）。一个题的 taskType 不足以代表整张卷。

### [低] 加载状态：保留 “Loading…”，去掉 saving 指示的可见位置

- **老 vs 新**：
  - 老：`!view` → `<div className="p-6 text-gray-500">Loading…</div>`；每题 row 内当 `savingId === q.id` 显示 `saving…`。
  - 新：`!view` → 完全相同的 Loading 文本。`savingId` 在 `IELTSReadingPassage.QuestionRow` 内仍显示（`{savingId === q.id && <span>saving…</span>}`），**但 O-Level 渲染器（`OLevelMcqList` / `OLevelComprehension` / Cloze / Vocab / Transformation）里没找到 saving 指示**——只有 IELTS shell 显示。
- **影响**：O-Level 学生看不到 “正在保存” 的反馈。老版本因为 always-IELTS 路径，至少 IELTS UI 下能看到。
- **重现**：在 O-Level paper 下，进入 take 页，答一题观察是否有任何“保存中”反馈。
- **建议修复**：在 `OLevelMcqList` / `OLevelComprehension` 等里面也读 `savingId` 并在 question card header 显示。

### [低] 路由参数 / paper id / mode=practice 解析：完全新增能力

- **老 vs 新**：
  - 老：`useParams<{sessionId}>`，没有 `useSearchParams`。`?mode=practice` 完全不读。
  - 新：`useParams` + `useSearchParams`，`?mode=practice` 才走 practice，否则 test。这是纯新增，无回退。
- **影响**：除了 practice mode 走 emerald + 即时反馈，提交仍然走 `morningQuizSubmit` 同一接口（line 73）——也就是说 practice mode 在前端是友好的，但在后端依然会写入 `StudentSubmission` 并触发自动评分。这个 mismatch 不是“切丢老逻辑”，是新增功能的不完整：practice 应该有独立的 dry-run 接口，否则一次 practice 就把成绩写死了。
- **重现**：访问 `/morning-quiz/<sid>/take?mode=practice`，做一遍点交卷，看后端 StudentSubmission 是不是真的产生了。
- **建议修复**：要么 practice 模式在前端禁用 submit 按钮（只展示“练习完成”），要么后端区分 practice 接口。属于新功能 polish，不是重写本身的回退。

### [低] Memo 缺失导致 paper 引用每帧变化

- **老 vs 新**：新版 `MorningQuizTake` 在 render 体内构造 `const paper: ExamPaper = {...}`（line 97-110），每次 re-render 都是新对象 + 新 questions 数组。
- **影响**：`<ExamRenderer paper={paper}>` 内部的 `useMemo(() => groupQuestions(paper.questions), [paper.questions])` 每帧重算；`<Timer endsAt={paper.quizEnd}>` 内部每帧拿到“同字符串新引用”但 setInterval 会被 effect deps 数组（`[]`）忽略，所以 OK。
- **重现**：用 React DevTools Profiler 看每秒 setNow 触发时下游组件 props 是不是 “changed: paper, paper.questions”。
- **建议修复**：把 `paper` 包进 `useMemo([view])`。性能优化非功能性，非阻塞。

### [信息] StickyNote 在新版从“写死的 prompt() + 单一 anchor offset” 改为 “createdAt 排序、可折叠列表”

- **老**：`PassagePanel.addNote` 用 `prompt()` 取文本，note 结构 `{id, offset, text}`；每条 note 在底部显示，点击编辑/删除。
- **新**：`StickyNoteRail` 用 `prompt()`，note 结构 `{id, text, createdAt}`；列表默认折叠，需要点 “便笺 · Notes (n)” 展开。
- **影响**：老版本数据结构带 `offset` 字段（虽然实际只是 `body.length` 占位，没真正锚到段落），新版本去掉了 `offset` 改用 `createdAt`。**已存在用户的 localStorage 记录有 `offset` 没有 `createdAt`**——hydrate 时不会崩（JSON.parse 容忍多余字段），但渲染时 `n.createdAt` 是 undefined。代码里没用 createdAt 排序就不报错，但之后如果加排序逻辑会 NaN。
- **重现**：用老版本写 3 条便笺存到 localStorage，切到新版本读。
- **建议修复**：hydrate 时给 createdAt 兜底 `Date.now()`。Round-3 范围外。

---

## 整体结论

**重写有功能性回退吗？是的，但不严重，整体改善大于回退。**

切干净的部分：
- API 路径（`morningQuizSession` / `morningQuizSaveAnswer` / `morningQuizSubmit`）一字未改，提交流程语义一致。
- 题号 palette、flag-for-review、passage 高亮、便笺、计时器红色告警、auto-submit on time-up、移动端 passage 切换——这些 1215 行老代码里的产品功能在新组件家族里完整重做了一遍，没丢。
- 路由参数、错误面板、Loading 文本表层不变。

切到的地方（按风险高→低）：
1. **服务器写答案错误被静默吞掉**（Finding 5）——老版本会冒泡到顶部 error 条，新版本在 `ExamProvider.setAnswer` 的 catch 里 `// ignore`，导致诸如 `quiz_window_closed`、403、5xx 这类失败学生看不到。是较明显的 UX 回退。
2. **MCQ radio 失去“点击即保存”的及时性**（Finding 2）——600ms debounce 在 last-second 场景下可能漏存最后一题。
3. **O-Level 渲染器全家没有 saving 指示**（Finding 7）——老版本至少 IELTS UI 下能看到，新版分了壳，但 O-Level 壳里漏写了。
4. **服务器答案没拉回 hydrate**（Finding 3）——是老版本就有的洞，但新版本明明 ExamContext 已经设计了 `initialAnswers` 钩子，page 没接，是“一脚到了门口没踢”。
5. **dispatcher 拿首题 taskType 判 IELTS**（Finding 6）——脏数据下可能错判，老版本 always-IELTS 反而稳。
6. **practice 模式仍调真 submit 接口**（Finding 9）——是新功能 polish 的洞，不是重写的“切丢”。

切错的地方都不是结构性回退，重写本身是干净的、组件化的、可扩展的——QuestionTypeRegistry 的设计为后续 O-Level 题型扩展打开了门。建议把 Finding 5（错误冒泡）和 Finding 2（radio 即时保存）作为重写合并到 main 前必修项。Finding 3 和 Finding 7 是后续迭代项。

**没看清的地方**：
- 没运行实际的页面，只比较了源码。debounce 在 `quizEnd` 边界的 race 是从代码推断的，没实测。
- StrictMode dev 双跑场景没复现，只看了 effect 结构。
- `claude/youthful-volhard-f60797` 分支上有 `e482df8 test(exam): 加入 Vitest + Testing Library, 26 用例` 的测试 commit，没去看测试覆盖率是否包含上述回归点。
