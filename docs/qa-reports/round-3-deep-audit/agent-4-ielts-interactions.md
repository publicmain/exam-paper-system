# Agent 4 · IELTS 7 件套交互层 深度审查报告

**审查日期**：2026-05-09
**审查范围**：IELTS Reading 壳与配套 7 件套交互组件
**源路径**：`_audit_review/exam/`（注意：当前生产代码路径是 `_audit_review/`，并非 `apps/web/src/components/exam/`，本身就是个待迁移信号；下文行号均基于此路径下文件。）

> 严重度等级：**P0**=阻塞考试 / 数据丢失；**P1**=明显交互失灵或体验破口；**P2**=优化或边缘场景；**P3**=轻微/可观察改进。

---

## 1. DraggableSplit（`_audit_review/exam/shared/DraggableSplit.tsx`）

### 1.1 【P1 / DraggableSplit.tsx:20-21,38】最小宽度被硬编码为 25%，但描述里说"拖到 0% / 100% 一栏宽度为 0"——验证：实际不可能拖到 0%

`min=0.25, max=0.75` 是兜底默认；只要调用方不显式覆盖（`IELTSReadingPassage.tsx:131-163` 没传 min/max）就有 25%/75% 保护，因此「拖到 0% 致使一栏宽度为 0」这个 edge case **不会触发**。
但 line 38 的 hydration 校验里写的是 `n >= min && n <= max`，如果**之前的 storageKey 在更早版本里允许过 0–1**，本次新值直接落在保护区间外，会 fallback 到 `initial=0.5`，**用户上次拖动的位置静默丢失**。

- **重现**：旧版本写入 `mq:split:S1 = 0.85` → 新版本加载 → 直接重置为 0.5。
- **影响**：跨版本升级用户分栏比例丢失（一次性）。
- **建议**：hydration 时若超界则 clamp 到 `[min, max]` 而不是回退 initial。

### 1.2 【P0 / DraggableSplit.tsx:64-69】触摸（iPad）拖动逻辑写了，但 **touchstart 时没调用 e.preventDefault()**，会被浏览器吞掉变成滚动手势

line 112 `onTouchStart={() => { draggingRef.current = true; }}`——没有 `preventDefault`，在 iPad 上按住分隔条往左右拖，浏览器把它解释成页面滚动 / 文本选择。`onTouch` 里有判断 `draggingRef.current` 但 touchmove 早被滚动消化掉了。

- **重现**：iPad 上长按分栏条左右拖。
- **影响**：iPad 用户拖不动分栏条。这跟用户 commit `f93ae2b` "iPad-friendly take-paper layout" 的目标直接冲突。
- **建议**：onTouchStart 里 `e.preventDefault()`；并且 `touchmove` 监听器已经 `passive: false`（line 73），是对的，但需要在拖动激活后真的调用 `e.preventDefault()`（line 64-69 当前没有调）。

### 1.3 【P1 / DraggableSplit.tsx:70】mouseup 监听绑在 window 上，离开窗口的场景 OK；但 **document.body.style.cursor 在离开浏览器再回来时可能没清干净**

`stop()` 把 cursor 清空只在 mouseup 触发时。如果用户拖着拖着切走窗口（alt+tab）再回来，浏览器版本 mouseup 是否被吞看实现；Chrome 一般会 fire 但 Safari 历史上有遗漏。一旦没 fire，body 永远 col-resize 鼠标，全页面光标都变拉伸。

- **重现**：拖动过程 alt+tab → 在另一窗口松开鼠标 → 切回。
- **影响**：全页光标卡 col-resize，无法恢复直到刷新。
- **建议**：监听 `pointercancel` + `blur`/`visibilitychange` 双保险 reset。

### 1.4 【P1 / DraggableSplit.tsx:98,124】 **resize（窗口缩放）后没有响应**——width 是 SSR-time 一次性求的

```tsx
style={{ width: typeof window !== 'undefined' && window.innerWidth >= mobileBreakpoint ? leftPct : '100%' }}
```
这个 `window.innerWidth` 在组件首次渲染时执行，之后窗口缩放（横竖屏切换、外接显示器拔出）**不会重新计算**，因为没有 resize listener 触发 re-render。

- **重现**：iPad 横屏 → 进考试 → 拨 Smart Connector 改竖屏 → 分栏布局错乱。
- **影响**：iPad 横竖屏切换、外接屏拔出后布局不对。
- **建议**：`useEffect` + `window.addEventListener('resize', ...)` 或 `matchMedia` 监听 lg breakpoint，触发 re-render。或者用纯 CSS（`@media (min-width: 1024px) { width: var(--split-left) }`）让 CSS 自适应。

### 1.5 【P2 / DraggableSplit.tsx 全文】没有「双击重置」

按 IELTS CD 客户端约定双击分隔条恢复默认比例。当前没有 `onDoubleClick`，键盘可达性虽然有（ArrowLeft/Right 步进 2%），但缺少快速回到 50% 的方式。

- **影响**：体验缺失，不阻塞。
- **建议**：`onDoubleClick={() => persist(initial)}`。

### 1.6 【P2 / DraggableSplit.tsx:107-111】onMouseDown 只 set draggingRef，**没有阻止 grab 时浏览器内置的拖拽**

虽然 `e.preventDefault()` 调了，但分隔条没有 `draggable={false}`，某些 Safari 版本仍可能弹出拖拽 ghost。

- **影响**：偶发幽灵 drag 视觉。
- **建议**：`draggable={false}` 显式声明。

### 1.7 【P1 / DraggableSplit.tsx:34-41】localStorage 用完整 storageKey 但 **storageKey 默认 'exam:split' 全局共享**，多套卷子互相覆盖

调用方 `IELTSReadingPassage.tsx:132` 传了 `mq:split:${paper.sessionId}`，所以**当前没问题**；但默认值 `'exam:split'` 是全局的，万一后续别处用 `<DraggableSplit/>` 不传 storageKey，多个组件互踩。Round-3 范围内 OK，但属于潜在坑。

- **建议**：去掉默认值，强制必传。

---

## 2. Highlighter（`_audit_review/exam/shared/Highlighter.tsx`）

### 2.1 【P0 / Highlighter.tsx:111,57-82】**调用方传的 body 在视图层 reflow 过，offset 永久错位**

`IELTSReadingPassage.tsx:102` ：`reflowPassage(clean(passageContent.passage ?? ''))`，结果传给 `Highlighter` 作为 `body`。
**如果 `reflowPassage` 在不同版本输出长度不同（多/少换行），存进 localStorage 的 highlight `{start,end}` 在新版加载时就指向错误字符**。注释说"源字符串永不变"——前提是 `reflowPassage` 是纯函数且实现稳定。这条耦合**没有锁版本号**。

- **重现**：v1 高亮 "global warming"（offset 1234-1248）→ 升级 v2 reflowPassage 多吞了 2 个空格 → 重新打开 → mark 飘到错误位置。
- **影响**：所有历史高亮静默错位（不会报错，看起来更糟糕——学生以为自己当时高亮错了）。
- **建议**：highlight 里同时存 `bodyHash` 或 `bodyVersion`；hash 不匹配时清空高亮并 console.warn。

### 2.2 【P1 / Highlighter.tsx:99-113】**跨段 / 跨节点选区 OK，但 captureSelection 没区分鼠标左键 vs 右键**

`onMouseUp={captureSelection}` 是任意 mouseup；右键调出菜单时浏览器也 fire mouseup，触发 captureSelection。后果：用户右键想 copy，结果选区被 `sel.removeAllRanges()` 清掉，菜单立马消失；或者高亮被意外创建。

- **重现**：选一段文本 → 右键。
- **影响**：右键菜单不可用、误高亮。
- **建议**：`onMouseUp={(e) => { if (e.button !== 0) return; captureSelection(); }}`。

### 2.3 【P1 / Highlighter.tsx:104-105】**range.commonAncestor 不检查同一 root 之外，如果选区跨出 Highlighter（如选到 StickyNote）会被 silently 忽略**

`!root.contains(range.startContainer) || !root.contains(range.endContainer)` 是对的——但 IELTSReadingPassage.tsx:141-152 把 `<StickyNoteRail>` 也放在同一个 `<aside>` 里、Highlighter 外，但都在 select-text 文档流中。用户从 passage 一路选到 sticky note 列表会被丢弃。**这不是 bug，是没提示**。

- **影响**：体验静默失败，学生以为高亮坏了。
- **建议**：选区跨界时 toast 提示"请只选 passage 内文字"，或显式给 sticky note 加 `select-none`。

### 2.4 【P0 / Highlighter.tsx:39-55】**mergeHighlight 把 id 改成新加的 id，但只 push 一次合并块。多块同时与新选区重叠时 id 链断裂**

```js
for (const h of existing) {
  if (h.end < merged.start || h.start > merged.end) {
    out.push(h);
  } else {
    merged = { id: merged.id, start: Math.min(merged.start, h.start), end: Math.max(merged.end, h.end) };
  }
}
```
逻辑上是吃掉所有相交的旧块，最后 push 一个 merged——这部分对的。
**但是**：`h.end < merged.start` 用的是已合并的 merged 范围更新——遍历顺序敏感。考虑 existing = [{0,5},{20,30}]，新选 {4, 21}：
- 第一个 {0,5}：相交 → merged 变成 {0,21}
- 第二个 {20,30}：`h.end=30 < merged.start=0`? 否；`h.start=20 > merged.end=21`? 否 → 相交 → merged 变成 {0,30}。✓

考虑 existing = [{20,30},{0,5}]（顺序反过来）：
- 第一个 {20,30}：与 {4,21} 相交 → merged = {4,30}
- 第二个 {0,5}：`5 < 4`? 否；`0 > 30`? 否 → 相交 → merged = {0,30}。✓

实际上算法 OK，但**id 全部丢失**（合并后用的是新选区的 id，旧 id 都没了）——这本身不是 bug，只是注释说"merges into one"，是对的。**保留**该判断。

> 经过推演，这条只是"id 不稳定"，不影响功能。降为 **P3**。

### 2.5 【P1 / Highlighter.tsx:24-26】**uid() 使用 Math.random，存在碰撞概率（虽然小）**

`Math.random().toString(36).slice(2,10)` ≈ 8 字符 base36 ≈ 41-bit。一次会话累积几十个高亮，碰撞极小但非零。**真正问题**：`mergeHighlight` 里 `merged.id` 用的是新生成的 id 替换旧的，所以即便有旧 id 碰撞也只影响 id 字符串，不会错合并块。安全。

- **影响**：可忽略。
- **建议**：可换 `crypto.randomUUID()`。

### 2.6 【P1 / Highlighter.tsx:122-123】**touchend 触发 captureSelection——iOS 长按弹出复制菜单同时触发 captureSelection 会闪退菜单**

iOS 上长按文本 → 系统弹放大镜 → 松手 → touchend 触发 → `sel.removeAllRanges()` 立即清掉选区，系统复制菜单一瞬间消失。

- **重现**：iPad 上长按某词。
- **影响**：iPad 上无法 copy 一段文字。
- **建议**：检测是否 iOS（`'ontouchstart' in window` + UA）时延迟 `removeAllRanges` 或不做。或者只在 touchstart 是单指拖选（非长按）时高亮。

### 2.7 【P2 / Highlighter.tsx:133-149】**useStoredHighlights 的 set 函数不是 useCallback**，每次渲染产生新引用

```js
const set = (next: Highlight[]) => { ... };
return [hs, set];
```
传给 `<Highlighter onChange={...}/>` → Highlighter 没用 React.memo，所以问题不大；但若以后被包 `useEffect deps`，引用每次新会无限循环。

- **建议**：`const set = useCallback(...)`。

---

## 3. StickyNote（`_audit_review/exam/shared/StickyNote.tsx`）

### 3.1 【P1 / StickyNote.tsx:73-74,87-92】**用 prompt() 是反模式——iOS Safari 在某些版本 prompt 被 PWA / 全屏模式禁用**

`prompt('便笺内容')`：在标准浏览器 OK，在 iOS PWA 模式（"添加到主屏幕"启动）某些 iOS 版本 prompt 直接返回 null 或被静默吞掉。注释「最小但每个设备都行」是过度乐观。

- **重现**：iPad 把 take-paper 加为主屏 → 全屏打开 → 点 + Add → 没反应。
- **影响**：PWA 学生无法添加便签。
- **建议**：内嵌 textarea 或 modal。

### 3.2 【P2 / StickyNote.tsx:26-32】**localStorage 隔离 key 由调用方控制，IELTSReadingPassage.tsx:106 用 `mq:nt:${sessionId}`**

`sessionId` 隔离 OK，但 sessionId 是「考试会话」级别，不是 paper 级别。同一 sessionId 切到下一篇 passage（IELTS 一份卷子 3 篇 passage）时**便签会跨 passage 共享**。

- **重现**：在 Passage 1 写「记得查 paragraph 5」→ 滚到 Passage 2 → 便签还在。
- **影响**：学生记忆负担混乱。
- **建议**：key 应该带 passage/paper id：`mq:nt:${sessionId}:${paperId}`（同理 highlight key）。

### 3.3 【P2 / StickyNote.tsx 全文】**没有"拖到屏幕外能拽回"的问题——因为根本不能拖**

注释说"自由浮动便签栏"——**实际是栏式列表**（`<ul>`），没有自由摆放。所以 edge case "拖到屏幕外" 不存在。**但这与注释不符**：注释说"free-floating in a side rail"，实现是 inline list。

- **影响**：注释误导维护者。
- **建议**：删除/修正注释，或真的实现拖动。

### 3.4 【P1 / StickyNote.tsx:34-42】**add/edit/remove 闭包捕获了 notes 旧值——快速连续添加会丢**

```js
const add = (text: string) => {
  if (!text.trim()) return;
  persist([...notes, { ... }]);  // notes 是闭包里旧的
};
```
`useStoredNotes` 不是返回 setter 而是返回函数式 add/edit/remove；这些函数闭包绑了上一轮 render 的 `notes`。React 18 batching 下连续两次 add（用户快速点 + Add 两次）第二次仍基于第一次前的 notes，**第一次的 add 被覆盖**。

- **重现**：500ms 内点两次 + Add 输两次内容 → 只剩第二条。
- **影响**：便签丢。
- **建议**：用 `setNotes(prev => [...prev, ...])` 函数式更新，并且 persist 也基于 prev 生成的 next。

### 3.5 【P2 / StickyNote.tsx:74-76】**prompt 的返回值 null（取消）传给 onAdd 不会执行 add（`if (t !== null)`）；但 trim 后空字符串会调 add，add 内部又 return**

逻辑上没漏，**但**：
```js
const t = prompt('便笺内容');
if (t !== null) onAdd(t);  // t 可能是 ''
```
`onAdd('')` → `add('')` → `text.trim()` 为空 → return。OK，但这个二次防卫不直观。
- **影响**：可读性。
- **建议**：在 prompt 处直接 `if (t && t.trim()) onAdd(t)`。

### 3.6 【P2 / StickyNote.tsx:81-82】**open 状态控制便签可见，count 显示在按钮上；但 open=false 时 + Add 仍能加，但用户看不到结果**

学生加完便签发现"啥都没出现"——其实是收起状态没展开。
- **影响**：困惑体验。
- **建议**：add 后自动 setOpen(true)。

---

## 4. QuestionFlag（`_audit_review/exam/shared/QuestionFlag.tsx`）

### 4.1 【P3 / QuestionFlag.tsx:1,6-8】**flag 状态来自 ExamContext，跨 IELTSReadingPassage / QuestionNavBar 同步 OK**

`useExam()` 拿到的 isFlagged/toggleFlag 是同一 provider，state 一致。✓
`QuestionFlag` 在 IELTSReadingPassage 内 toggle → ExamContext flagged Set 变化 → `QuestionNavBar.tsx:24` 同样 `useExam()` 拿到新 flagged → 重渲染圆点。✓ 同步路径正常。

### 4.2 【P2 / QuestionFlag.tsx:27-29】**SVG path 写错了——`a 0 0 0 1 0` 不合法**

```jsx
<path d="M4 3a1 1 0 011-1h11l-2 4 2 4H5v8H3V3a0 0 0 011 0z" />
```
`a0 0 0 1 0` —— elliptical arc 指令需要 `rx ry x-axis-rotation large-arc sweep x y`，而 `a0 0` 是退化弧，**很多浏览器渲染时直接画一条直线**，导致旗子图标右下角是个奇怪的尖。
- **重现**：肉眼看图标。
- **影响**：图标不规则；不影响功能。
- **建议**：换成正确路径或用 lucide/heroicons 的 Flag。

### 4.3 【P2 / QuestionFlag.tsx:11-15】**toggleFlag 没有视觉反馈延迟**

ExamContext.tsx:165-175 toggleFlag 不持久化到后端、只 localStorage——所以离线场景下也无碍。但 **flagged 状态丢失场景**：清浏览器缓存 / 切设备 → flag 全丢（后端没存）。
- **影响**：跨设备 flag 不同步。
- **建议**：把 flag 也送到后端 attempt 数据里。

### 4.4 【P2 / QuestionFlag.tsx:6】**qid 唯一性假设依赖于 ExamQuestion.id**

如果同一卷子（罕见但可能）出现 id 冲突，flag 互相影响。Round-3 内未发现实际冲突，**待 Agent 1/2 确认**。

---

## 5. QuestionNavBar（`_audit_review/exam/shared/QuestionNavBar.tsx`）

### 5.1 【P0 / QuestionNavBar.tsx:23】**`grid-cols-10 sm:grid-cols-13` 是非法 Tailwind class**

默认 Tailwind 只到 `grid-cols-12`；`grid-cols-13` 不存在，运行时被忽略 → 在 sm+ 屏幕上回退到 grid-cols-10（继承）→ 但因为没有该 class 实际 grid-template-columns 没变。
- **重现**：sm+ 屏幕看导航条列数和 mobile 一样。
- **影响**：iPad 上每行 10 题，120 题占 12 行，过高。
- **建议**：要么 `grid-cols-12`，要么 tailwind.config 加 `gridTemplateColumns: { '13': 'repeat(13, minmax(0, 1fr))' }`。

### 5.2 【P1 / QuestionNavBar.tsx:24-51】**100 题以上：每个 cell 都是 `h-9 sm:h-10`，宽度由 grid 自适应；100+ 数字三位会挤**

font-mono text-xs 显示 "100" 三字符在 ~36px 宽 cell 里勉强 fit。120 题以上若数字四位或更小屏幕会溢出。
- **影响**：题目编号显示截断 / 溢出（CIE 试卷可能 60+ 题，IELTS 40 题没事；但 cross-page 用其他壳的话风险）。
- **建议**：当 question 数 > 100 时缩小字号或加 overflow-x scroll。

### 5.3 【P1 / QuestionNavBar.tsx:33】**onJumpTo 是同步回调，不会触发 autosave / 提交**

ExamContext 已有 600ms 防抖（`SAVE_DEBOUNCE_MS = 600`，line 69）。如果用户在最后一个回答后 < 600ms 立刻点 nav 跳题，**正在编辑的输入框没失焦，textAnswer 没 setAnswer，跳题后输入丢失**——因为 LetterInput / DebouncedTextarea 是 onBlur 才上报（IELTSReadingPassage.tsx:420, 443, 482）。
- **重现**：在 BlankAwareInput 输入后立即点 nav 跳题（不点别的地方）。
- **影响**：未提交输入丢失。
- **建议**：跳题前 dispatch focusout / 或者 input 实现改为 onChange 直接 setAnswer + 防抖在 ExamContext。

### 5.4 【P2 / QuestionNavBar.tsx:25-26】**answered 判定 `selectedOption || textAnswer.trim()`**——空字符串被判 unanswered ✓

OK。但 textAnswer 是 `'   '`（全空格）也被算未答。注意：`a.textAnswer.trim()` 为空时 `answered=false`。✓

### 5.5 【P2 / QuestionNavBar.tsx:34-37】**flagged 用 `ring-2 orange`，answered 用 `bg-blue-600`**——已答 + flagged 同时是蓝底+橙环+橙圆点，可读性 OK；但**未答 + flagged + current 三态叠加**（外层 outline + ring + 顶角圆点）视觉拥挤

iPad 屏幕 36px 高 cell 上三个边框层叠，识别困难。
- **建议**：选一个主导色，或者 flagged 改用顶部色块而非 ring。

---

## 6. Timer（`_audit_review/exam/shared/Timer.tsx`）

### 6.1 【P0 / Timer.tsx:13-19】**setInterval 1 秒漂移，长时间运行会落后**

setInterval 在 tab 后台 throttle 到 ≥1s，前台 60s 后实际可能跑了 55-58 次。但因为 `now = Date.now()` 是绝对时间戳，**每次 tick 都是从绝对时间重算 remainingMs**——所以 throttle 不会让倒计时变慢，只是 UI 跳秒。✓
**真正问题**：tab 后台 throttle 到 60s/次，**学生切走又回来**，最坏情况 UI 跳变 60 秒，体验突兀。但答题剩余时间不丢，OK。
- **影响**：UI 跳秒。
- **建议**：visibilitychange 事件回前台时立刻 setNow(Date.now())。

### 6.2 【P1 / Timer.tsx:22-27】**onTimeUp 在 `remainingMs === 0` 时触发——系统时钟回拨到 endsAt 之前可能再次触发？**

`fired` 状态阻止二次触发。✓ 但 `Math.max(0, ...)` 保证 remainingMs 不为负。✓
**Edge**：endsAt 是字符串，`new Date(endsAt).getTime()` 若 endsAt 不合法 → NaN → `Math.max(0, NaN) = NaN` → `NaN === 0` → false → onTimeUp 永远不触发。学生时间到了但不自动提交。
- **重现**：endsAt 传 `"invalid"` / null。
- **影响**：考试不自动提交（依赖宿主页是否额外 fallback）。
- **建议**：useMemo 里校验 endsAt 合法，否则 console.warn 并按已结束处理。

### 6.3 【P1 / Timer.tsx:全文】**没有 visibilitychange 暂停机制**

实考一般不暂停（IELTS CD 也不暂停），所以**这个行为是正确的**。✓ 但**前提是 endsAt 是绝对时间戳**——确实是，所以 tab 切走再回来时间不丢。OK。

### 6.4 【P2 / Timer.tsx:20-21】**系统休眠 / 时钟回拨**

`Date.now()` 受系统时钟控制。学生考试中改系统时间（误调或恶意）→ remainingMs 变大 → 倒计时回涨。
- **重现**：Mac 上把系统时间往前调一小时。
- **影响**：作弊 / 误操作时间被延长。
- **建议**：endsAt 应来自服务端绝对时间，且 Timer 同时 `performance.now()` 做相对校验；或服务端限时强制 enforce（提交时 server 拒绝超时）。**最低**：客户端 endsAt 校验只是 UI，server 必须独立校验。

### 6.5 【P3 / Timer.tsx:39】**aria-live=polite 在 danger 时**

最后 5 分钟每秒读 `Remaining time XX:XX` polite 模式不会打断但会排队读——屏幕阅读器用户听到一长串。
- **建议**：只在分钟变化时更新 aria 文本，或 aria-live 仅在最后 60 秒开启。

### 6.6 【P2 / Timer.tsx:23-26】**setFired 是 setState 异步——onTimeUp 可能被调多次**

```js
if (remainingMs === 0 && !fired) {
  setFired(true);
  onTimeUp?.();
}
```
React 18 strict mode + 双调用 effect 时 effect 可能跑两次。`setFired(true)` 异步，第二次 effect 跑时 `fired` 还是 false → onTimeUp 调两次。
- **重现**：StrictMode 开发模式下首次 endsAt 跨过 0。
- **影响**：自动提交可能重复触发。
- **建议**：用 useRef 而非 useState 做 fired 守卫；或 onTimeUp 内部幂等。

---

## 7. FontSizeAdjuster（`_audit_review/exam/shared/FontSizeAdjuster.tsx`）

### 7.1 【P1 / FontSizeAdjuster.tsx:9,18-19,28-30 + ExamContext.tsx:113-117】**fontScale 步长 0.1 + 浮点累加 → 显示 89% 不是 90%**

```js
onClick={() => setFontScale(fontScale - 0.1)}
```
`1 - 0.1 - 0.1 - 0.1 = 0.7000000000000001`，clamp 到 0.7 OK；但 `1 + 0.1 + 0.1 = 1.2000000000000002`，pct = `Math.round(1.2 * 100) = 120`，OK；但 ExamContext 校验 `n <= 1.6`——`1.6000000000000003 > 1.6` → 失败 fallback 到 1。
- **重现**：连点 A+ 6 次。
- **影响**：到达 160% 后下次刷新意外 fallback。
- **建议**：clamp 后 round 到 1 位小数：`Math.round(clamped * 10) / 10`。

### 7.2 【P2 / FontSizeAdjuster.tsx:19,29】**disabled 边界判定 `<=0.7` `>=1.6`，但浮点累加可能让你停在 0.7000001，再点 A- 仍触发不到 disabled 直到溢出**

延伸 7.1。
- **建议**：同上，规整到 1 位小数。

### 7.3 【P1 / IELTSReadingPassage.tsx:111】**fontScale 应用方式：`style={{ fontSize: `${fontScale}rem` }}`——这是把根字号设为 fontScale rem，=  16px × fontScale**

`rem` 本身相对根 html。`${fontScale}rem` = fontScale × 16px。所以 fontScale=1 → 16px，fontScale=1.6 → 25.6px。
**问题**：内部 child 用 Tailwind `text-base` `text-lg` 等 = 1rem / 1.125rem，**这些 rem 是相对 html 根字号 16px，不是相对父容器**。所以**改 fontScale 实际只影响没显式 `text-*` 的元素**——passage 体（line 145 `text-[1.0625rem]`）还是 17px 不变。
- **重现**：A+ 多次后 passage 字根本不变大；只有未指定字号的元素变。
- **影响**：FontSizeAdjuster 几乎无效。**这是核心 bug**。
- **建议**：用 CSS `--font-scale` 变量，passage 内部所有字号写成 `calc(var(--font-scale) * 1rem)`；或者改为 `style={{ fontSize: `${fontScale * 16}px` }}` 在最外层但仍然要让子元素相对父字号（用 `em` 而非 `rem`）。

### 7.4 【P3 / FontSizeAdjuster.tsx 全文】**切下一题 fontScale 是否保留：通过 ExamContext 全局 + localStorage `mq:fontScale`，跨 paper 跨 session 保留 ✓**

OK，符合注释。

### 7.5 【P2 / FontSizeAdjuster.tsx:18-19】**点击事件 = setFontScale(fontScale - 0.1)** 不是函数式更新

如果用户连按很快，每次 click 都基于 React closure 中的 fontScale；ExamContext setFontScale 内部立刻 clamp 并 setState。但**两个 click 在同一渲染帧里**（罕见），第二次仍读老 fontScale → 只生效一次。
- **影响**：极少见。
- **建议**：`setFontScale((s) => s - 0.1)` 但 ExamContext 当前签名是 `(n: number) => void`——需要改签名。

---

## 8. IELTSReadingPassage 整体（`_audit_review/exam/questions/IELTSReadingPassage.tsx`）

### 8.1 【P1 / IELTSReadingPassage.tsx:105-106】**localStorage key 用 sessionId，没含 paperId / passageId**

一个 session 内多 paper 时高亮、便签、分栏比例混在一起。详见 §3.2。

### 8.2 【P1 / IELTSReadingPassage.tsx:413-427, 437-447, 461-486】**LetterInput / DebouncedTextarea / BlankAwareInput 都是 onBlur 才 setAnswer**

跳题（QuestionNavBar）/ 自动提交（Timer）时如果 input 没失焦，最后输入丢失。详见 §5.3。
- **建议**：input onChange 直接传 setAnswer，由 ExamContext 防抖统一处理；或者跳题前调 `document.activeElement.blur()`。

### 8.3 【P0 / IELTSReadingPassage.tsx:225-229】**setAnswer 在 useEffect 之外被调用——但变量名 `setAnswer` 在 QuestionRow（line 222）destructure 后未使用！**

```js
const { answers, setAnswer, savingId, isFlagged, mode } = useExam();
```
QuestionRow 拿了 setAnswer 但 **本函数体内没用**（用的是 a / showFeedback / isCorrect）。setAnswer 在 QuestionItem 里独立 `useExam()` 拿（line 279）。
- **影响**：无功能 bug，但是冗余 destructure，编译器/eslint 会警告 `setAnswer` 未使用。
- **建议**：移除 line 222 的 setAnswer。

### 8.4 【P2 / IELTSReadingPassage.tsx:100-103】**passageContent 取 `paper.questions[0]`——假设 q[0] 一定有 passage**

如果 paper.questions 是空数组（边缘 case，比如数据修复脚本中间态），`[0]?` 是安全的，但 `groupQuestions(paper.questions)` 返回空 groups → 整个右栏空白；左栏"Reading Passage" 标题但内容空。**不会崩**，**但 UI 不友好**。
- **影响**：空状态丑陋。
- **建议**：empty state 提示「未加载到题目」。

### 8.5 【P2 / IELTSReadingPassage.tsx:111】**`lg:h-[calc(100dvh-9rem)]`**

dvh 在旧 Safari (<15.4) 不支持 → 高度为 0 → 整个容器塌陷。考试关键页面需要降级。
- **建议**：`min-h-[calc(100vh-9rem)] lg:h-[calc(100dvh-9rem)]` 双兜底。

### 8.6 【P2 / IELTSReadingPassage.tsx:228】**`mode === 'practice' && a?.selectedOption && correctKey` 的 feedback**

practice 模式下 setAnswer 立即触发 feedback——学生看到答案立即知道对错；但 textAnswer 类（completion）类的 feedback 完全没显示，只有 `selectedOption` 的有。**功能不一致**。
- **影响**：填空题 practice 模式无即时反馈。
- **建议**：扩展 feedback 到 textAnswer。

### 8.7 【P3 / IELTSReadingPassage.tsx:114-129】**mobileSide 状态不持久化**

切走再回来重置为 'right'。无大碍。

---

## 整体结论

### 必须 P0 修的（阻塞考试或数据丢失）
1. **§2.1** Highlighter 的 offset 与 reflowPassage 输出强耦合，没版本号 → 跨版本静默错位。
2. **§5.1** QuestionNavBar 用 `grid-cols-13` 非法 class，sm+ 布局没生效。
3. **§7.3** FontSizeAdjuster 改 `font-size: Xrem` 在容器层，对子元素的 rem 不传递 → 调字号几乎无效。**这是用户已交付功能的事实失效**。
4. **§1.2** DraggableSplit 的 onTouchStart 没 preventDefault → iPad 拖不动分栏（直接打脸 iPad-friendly 提交）。

### 必须 P1 修的（明显交互失灵）
- §1.4 resize 不响应（iPad 横竖屏）
- §1.7 storageKey 默认值全局共享
- §2.2 mouseup 不区分左右键 → 右键菜单不可用
- §2.6 iOS touchend 立即清选区 → 复制菜单闪退
- §3.1 prompt() 在 PWA 模式被阻
- §3.4 add/edit/remove 闭包覆盖 → 快速连点丢便签
- §5.3 跳题不强制 blur → 当前输入丢失
- §6.2 endsAt 非法时 onTimeUp 不触发
- §6.6 React 18 StrictMode 下 onTimeUp 重复
- §7.1 浮点累加导致 fontScale 越界 fallback
- §8.2 onBlur 才上报答案 → 跳题丢字
- §8.3 QuestionRow 的 setAnswer 未使用（编译噪声 / 死代码）

### 设计层面的核心问题（一致性 / 整体性）

1. **ExamContext + 各组件状态契约不清晰**。
   - `setAnswer` 接受完整 answer 对象，但每次调用都覆盖（不是 patch）；如果未来加 `attachments` 字段，老调用会清空。
   - flagged 不持久化到后端，跨设备丢；与 answers 持久化路径不对称。

2. **localStorage key 设计粒度不统一**。
   - answers / flags 用 sessionId；fontScale 全局；高亮 / 便签 / split 用 sessionId。
   - 但 IELTS 一个 session 可有多 paper / 多 passage，**所有 passage-级的 UI 状态实际上现在跨 passage 共享**。建议层级：`mq:<feature>:<sessionId>:<paperId>[:<passageId>]`。

3. **iPad 体验声称做了，但触摸细节多处遗漏**。
   - DraggableSplit touchstart 不 preventDefault（§1.2）
   - Highlighter touchend 立即清选区（§2.6）
   - prompt() 在 PWA 模式失效（§3.1）
   - 这与 commit `f93ae2b` "iPad-friendly take-paper layout" 的承诺有差距。建议**做一次专项 iPad 物理设备测试**。

4. **答案提交模型不统一**：
   - RadioGroup 是 onClick 直接 setAnswer（即时）。
   - LetterInput / TextInput / Textarea 是 onBlur 才 setAnswer（延迟）。
   - 时间到 / 跳题 / 强制提交时无机制 flush onBlur。
   - **建议**：统一改成 onChange + 客户端防抖；setAnswer 内部 600ms 防抖已经存在，叠两层即可。

5. **路径 `_audit_review/exam/` 本身**：
   git log 主分支已合并 `feat(morning-quiz)` 多次，但代码还在 `_audit_review/`。要么是 review-only 副本（生产是别处），要么是未迁入的草稿。这个**结构性歧义**应该尽快澄清——审查报告的 file:line 行号只在 `_audit_review/` 路径下有效。

### 测试覆盖

`_audit_review/exam/__tests__/` 只有 `ExamProvider.test.tsx`、`OLevelMcqList.test.tsx`、`OLevelSentenceTransformation.test.tsx`，**7 件套交互层组件全部没有测试**：
- DraggableSplit、Highlighter、StickyNote、QuestionFlag、QuestionNavBar、Timer、FontSizeAdjuster。

P0/P1 修完应一并补单元测试 + Playwright 端到端（专门跑一遍 iPad 模拟）。

### 优先级排序建议

1. **本周**：§7.3（fontScale 失效）+ §5.1（grid-cols-13）+ §1.2（iPad 拖分栏）+ §2.1（高亮飘移）。这四个是用户能直接感知的硬伤。
2. **下周**：§5.3 + §8.2（输入丢失）+ §3.1（PWA prompt）+ §6.2（endsAt 非法）+ §6.6（StrictMode 双触发）。
3. **后续 sprint**：localStorage key 粒度重构 + iPad 测试套件 + flag 后端持久化。

---

**审查者诚实声明**：以上 finding 中部分（§2.4）经过推演降级为非 bug；§4.1 的"flag 同步"路径走通是好消息。但 §7.3 是已部署但实际不工作的功能，§1.2 是 iPad 提交承诺与现实差距，建议优先级直接抬到本周必修。
