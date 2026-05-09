# Round-7 上线前审查 · Agent 6 · UI Layout & Mobile/iPad 响应式 + IELTS 7 件套

**审查范围:**
- `apps/web/src/components/exam/**/*.tsx` (shared + questions, 所有 13 个文件)
- `apps/web/src/pages/MorningQuizTake.tsx` (考试 host 页, 405 行)
- `apps/web/src/components/exam/ExamContext.tsx`
- `apps/web/index.html`, `apps/web/tailwind.config.js`

**方法:** 静态代码 review。**未实测 iPad 真机/iOS Safari/VoiceOver/旋转/软键盘**。所有 iOS Safari 行为均代码层推断。

**前提:** 一人一 iPad（不是共享 kiosk），主战场为 iPad（横/竖屏 + 软键盘）。

---

## 一、IELTS 7 件套逐件验证（必须每件给结论）

### 1. 拖动调整 passage / question 分栏 — **基本 OK，但仍有 3 个缺陷**

**位置:** `apps/web/src/components/exam/shared/DraggableSplit.tsx`

**已正确实现的:**
- `onMouseDown` + `onTouchStart` 双路径覆盖（line 136, 141）；touch 路径同时调 `e.preventDefault()` 阻断 iOS 默认滚动（line 143）。
- 旋转响应已修：`vw` state 订阅 `resize` + `orientationchange`（line 58-66）。横竖屏切换时 `width: leftPct` 会重算。
- 触摸命中区已修：`w-3` = 12px（line 153）—— 仍低于 WCAG 2.5.5 / iOS HIG 44pt 标准，但比之前的 6px 好很多。
- 拖拽结果 `localStorage` 持久化（line 73-75）。
- 键盘可达：`tabIndex={0}` + `ArrowLeft/Right` 调整 2% 步长（line 146-149）。
- `role="separator"` `aria-orientation="vertical"` `aria-valuenow` 都有。

**缺陷 A — 触摸 hit 区仍小于 44px，iPad 拇指拖动困难**
- 严重度: **P2**
- 位置: `DraggableSplit.tsx:153` (`className="hidden lg:flex w-3 ..."`)
- 现象: 12px 是视觉条 + hit 区合一的实际宽度。iPad 拇指最小命中圆约 44pt = 44px，12px 条件下会频繁 miss。代码注释自称已满足 WCAG 2.5.5 — 不准确（2.5.5 要 44×44）。
- 设备/方向: iPad 横屏（lg+ 才出现该 handle）
- 修复: 把视觉线保留 2px (`w-0.5`)，外层 padding 拓 16px 透明 hit 区（约 `px-2 -mx-2`），或 `::before` 延展。

**缺陷 B — 没有 `touchcancel` 监听，来电/通知后 dragging 状态卡死**
- 严重度: **P2**
- 位置: `DraggableSplit.tsx:99-109` (`stop()` 只挂在 `mouseup` / `touchend`)
- 现象: iPad 接电话、来横幅通知、Slide Over 切换会触发 `touchcancel`，但代码未监听，`draggingRef.current` 留在 `true`；下次 mousemove 会继续把分栏拽走。
- 设备/方向: iPad 任意方向
- 修复: `window.addEventListener('touchcancel', stop)` 并在 cleanup 移除。

**缺陷 C — separator 缺 `aria-valuemin` / `aria-valuemax` / `aria-label`**
- 严重度: **P3**
- 位置: `DraggableSplit.tsx:131-156`
- 现象: WAI-ARIA spec 对 `role="separator"` 推荐补全这两个属性。屏幕阅读器只读到角色不读含义。
- 修复: 加 `aria-label="Adjust passage / questions split"` `aria-valuemin={Math.round(min*100)}` `aria-valuemax={Math.round(max*100)}`。

---

### 2. 文本高亮（Highlighter）— **有缺陷**

**位置:** `apps/web/src/components/exam/shared/Highlighter.tsx`

**已正确实现的:**
- `mouseup` + `touchend` 双路径（line 137-138）。
- `WebkitUserSelect: 'text'` 显式打开（line 140）。
- `requestAnimationFrame` 缓冲 touch 选区时序（line 130-132）—— 这是修了 round-3 H10。
- 左键 guard：`if (e.button !== 0) return`（line 124）防止右键长按系统菜单 collapse 选区。
- 跨段落选区合并（`mergeHighlight` line 39-55）：相邻/重叠的高亮自动合并成一个区间。
- 序列化按 `start/end` 字符 offset（基于 `TreeWalker.SHOW_TEXT`），跨段落安全；passage 文本不可变所以 offset 长期有效。
- `localStorage` 持久化（line 152-163）。

**缺陷 A — 高亮事件无屏幕阅读器反馈**
- 严重度: **P3**
- 位置: `Highlighter.tsx:99-117`
- 现象: 选词后只是新增 `<mark>` DOM 节点，没有 `aria-live` 区域报告 "已加亮"。低视力学生用 zoom + screenreader 不知道是否成功。
- 修复: 加隐藏 `<div aria-live="polite" className="sr-only">` 在添加/移除时更新文本。

**缺陷 B — 跨段落选区文本含 `\n`/特殊字符时 reflowPassage 后 offset 漂移风险**
- 严重度: **P2**
- 位置: `IELTSReadingPassage.tsx:109` 用 `useMemo(() => reflowPassage(clean(...)), [...])`
- 现象: `reflowPassage` 是 lazy memo。如果 passage 字符串在两次 mount 间被 `clean()` 处理后产生 trim/换行差异（ai 重生成 paper 后），`localStorage` 保存的 offset 会指向错误位置 —— 高亮显示在偏移的字上。
- 设备/方向: 任意（任何刷新场景）
- 修复: `localStorage` key 不仅用 `sessionId`，也带 passage 字符串的 hash。当 passage 改变时丢弃旧高亮。

**缺陷 C — passage 容器是 `<div>`，键盘用户无法触发选区**
- 严重度: **P3**
- 位置: `Highlighter.tsx:134-144`
- 现象: 键盘用户没有可访问的"高亮"路径 — 选词需要鼠标/触摸的 selection range API。无键盘替代。
- 修复: 较大工作量，建议列入未来 round。MVP 接受。

---

### 3. 便签（StickyNote）— **OK 但功能羸弱**

**位置:** `apps/web/src/components/exam/shared/StickyNote.tsx`

**已正确实现的:**
- `localStorage` 持久化（line 26-32），刷新页面后还在。
- 添加/编辑/删除完整。
- 触摸目标 `min-h-[36px]` 在 +Add 按钮（line 72）。

**缺陷 A — 用 `prompt()` 编辑，iPad 体验粗糙、无法多行、无 Cancel 区分**
- 严重度: **P3**（功能可用但很粗糙）
- 位置: `StickyNote.tsx:73, 87`
- 现象: `prompt()` 是浏览器原生模态，单行；学生想写多行笔记不行；`prompt() === null` 用户取消才能区分，`""` 提交意味着删除（line 90），按 Enter 直接删除有点反直觉。
- 设备/方向: iPad 任意，软键盘弹出在系统对话框上方。
- 修复: 后续改成自建 modal + textarea + `aria-modal`。

**缺陷 B — 便签条目 `<li onClick>` 键盘不可达**
- 严重度: **P2**
- 位置: `StickyNote.tsx:84-97`
- 现象: `<li>` 没有 `tabIndex` / `role="button"`；键盘用户无法编辑/删除已有便签。
- 修复: 改为 `<button>` 包裹或 `tabIndex={0}` + `role="button"` + `onKeyDown` (Enter/Space 触发)。

**缺陷 C — 便签数据仅本地，**换设备/换浏览器丢失
- 严重度: **P3**
- 位置: `StickyNote.tsx:20-43`
- 现象: 便签从未上传服务端。前提"一人一 iPad"成立时影响低，但学生借同学 iPad / 临时换机的场景便签会丢。
- 设备/方向: 任意
- 修复: 列入未来 round；MVP 接受。

---

### 4. 标记题目（QuestionFlag）— **有缺陷（关键缺口）**

**位置:** `apps/web/src/components/exam/shared/QuestionFlag.tsx` + `ExamContext.tsx`

**已正确实现的:**
- `aria-pressed={flagged}` `aria-label`（line 24-25）。
- `localStorage` per-session 持久化 (`mq:flags:${sessionId}`)（`ExamContext.tsx:255-258`）。
- 颜色 + 图标 + 文字三通道（橙色背景 + 旗帜 svg + "已标记" 文字）。
- 切换 toggle 即时本地保存。

**缺陷 A — flag 状态从未发给后端**
- 严重度: **P2**
- 位置: `ExamContext.tsx:250-260` (`toggleFlag`) + `apps/api/src/morning-quiz/morning-quiz.service.ts` (没有 `flagged` 字段)
- 现象: flag 仅 `localStorage`，提交（`api.morningQuizSubmit`）只送答案，不送标记列表。教师批改端看不到学生标记的题。学生中途换设备/清缓存后 flag 丢失。
- 设备/方向: 任意
- 修复: 提交时把 `[...flagged]` 一同发后端；或写一个 `/morning-quiz/sessions/:id/flag` 端点单独同步。如果不打算实现，至少在 PRD 中明示"flag 仅本地"。

**缺陷 B — flag 触摸目标 36px 低于 iOS HIG 44pt**
- 严重度: **P3**
- 位置: `QuestionFlag.tsx:16` (`min-h-[36px]`)
- 现象: 题号尾部的小旗按钮在 iPad 上点击容易误命中相邻的 radio。
- 修复: `min-h-[44px]` 同时把按钮内 padding 略加。

**缺陷 C — 旗帜 svg 路径错误**
- 严重度: **P3**（视觉异常但功能在）
- 位置: `QuestionFlag.tsx:28` 和 `MorningQuizTake.tsx:376`
- 现象: `<path d="M4 3a1 1 0 011-1h11l-2 4 2 4H5v8H3V3a0 0 0 011 0z" />` —— 末尾 `a0 0 0 011 0z` 不是合法 SVG 命令（rx=ry=0 的 arc 退化），不同浏览器渲染会异常或忽略尾段。看起来旗帜底部缺角。
- 设备/方向: 所有
- 修复: 重写 path，例如 `M4 3a1 1 0 011-1h11l-2 4 2 4H5v8H4V3z`。

---

### 5. 题号导航（QuestionPalette / QuestionNavBar）— **有缺陷**

**位置:** `apps/web/src/components/exam/shared/QuestionNavBar.tsx` + `MorningQuizTake.tsx:307-346`

**已正确实现的:**
- 已修 `sm:grid-cols-13` 失效问题：改用 inline `gridTemplateColumns: 'repeat(auto-fit, minmax(38px, 1fr))'`（line 35）—— 任何屏宽都能优雅排列。
- 三状态视觉双通道：颜色 + 图标 + ●（line 43-77）。`statusIcon = ⚐ / ✓ / ·`，`aria-label` 含 `answered/unanswered/flagged`（line 58）—— 修了 round-3 F11。
- 触摸目标 `min-h-[44px]`（line 54）。
- 跳转后高亮 `mq-jump-flash` 动画（`MorningQuizTake.tsx:243-244`）。

**缺陷 A — Palette modal 缺 focus trap / Esc 关闭 / focus 还原**
- 严重度: **P1**（键盘+屏幕阅读器用户被困死）
- 位置: `MorningQuizTake.tsx:307-346`
- 现象:
  1. 没有 `role="dialog"` `aria-modal="true"`（grep 验证：整个 src 无任何 `aria-modal`）。
  2. 打开 palette 后 focus 不会自动跳到 modal 内；Tab 键继续穿越底层页面元素 → palette 之间。
  3. **Esc 不能关闭**（无 keydown 监听）。
  4. 关闭后 focus 不还原到打开 palette 的"题号"按钮 —— 键盘用户失去定位。
- 设备/方向: 所有，键盘用户尤其
- 修复: 加 `useEffect` 监听 `Escape`；用 react focus-trap 或手写 30 行；`paletteOpen` 切换时 ref 记忆触发按钮、关闭时还原 focus；外层 div 加 `role="dialog" aria-modal="true" aria-label="题号导航"`。

**缺陷 B — Palette 打开后 100 题导航没有"当前题号"标记**
- 严重度: **P3**
- 位置: `MorningQuizTake.tsx:331` 调 `<QuestionNavBar questions={paper.questions} onJumpTo={handleJump} />` 时**没传 `currentIdx`**
- 现象: IELTS 是 scrollable shell（没有 currentIdx），传 undefined 是设计意图；但 OLevelMcqList / OLevelComprehension 用 paged shell，host 的 palette 仍未传 idx → 学生在 palette 看不到自己当前在哪一题。代码注释中也说"Not needed for the IELTS scrollable shell" —— 但分页 shell 同样没传。
- 设备/方向: 任意（影响 OLevel 分页 shell 的导航）
- 修复: 在 PaperHost 跟踪当前题号（IELTS 用 scroll spy，OLevel paged 用本地 idx state），传 `currentIdx` 给 palette。

**缺陷 C — 100 题 palette 在 iPad 竖屏 38px minmax 仍可能换行多次造成滚动**
- 严重度: **P3**
- 位置: `QuestionNavBar.tsx:35` (`minmax(38px, 1fr)`)
- 现象: iPad 竖屏 max-w-md = 28rem ≈ 448px；除去 padding 约 400px / 38px = 10 列 → 100 题 / 10 = 10 行 × 44px = 440px 高，刚好等于 modal max-h；遇到 120+ 题（cloze 大测）modal 内会出现滚动但**没有显式 `overflow-auto`**。
- 修复: modal `<div>` 容器加 `max-h-[80vh] overflow-auto`。

**缺陷 D — `min-h-[44px]` 与 `h-11` 同时存在**
- 严重度: **P3**
- 位置: `QuestionNavBar.tsx:54` (`min-h-[44px] sm:min-h-[44px] h-11 sm:h-11`)
- 现象: 同时设 `h-11`（44px）+ `min-h-[44px]`，多余但无害；`flex flex-col items-center justify-center` 在 44px 高内挤两行（数字 + 状态图标）会很拥挤。
- 修复: 视觉小问题，pilot 后看效果再决定。

---

### 6. 倒计时（Timer）— **基本 OK**

**位置:** `apps/web/src/components/exam/shared/Timer.tsx`

**已正确实现的:**
- 时间到自动调 `onTimeUp`（line 22-27），host 接到后调 `handleSubmit` 自动交卷（`MorningQuizTake.tsx:300`）。
- `fired` flag 防止多次触发（line 14, 23）。
- 最后 5 分钟红色（`text-rose-600`）；10 分钟内黄色提示（`warn`，line 31-32）。
- 字体使用 `font-mono tabular-nums` 数字不抖动（line 36）。

**缺陷 A — 时间到自动提交未先 flush 待保存的 autosave**
- 严重度: **P1**
- 位置: `MorningQuizTake.tsx:300` (`<Timer onTimeUp={onSubmit} />`) → 调的是 `handleSubmit`（line 90）→ 直接调 `submitToServer`，**没有 await `flushPendingSaves`**
- 现象: 用户手动点交卷走的是 `onSubmitClick`（line 197），它正确 `await flushPendingSaves()` 再 submit。但**Timer 自动到时间提交走的是 raw `handleSubmit`**，没有 flush —— 学生最后 600ms 内输入的字符（debounce 还在 timer 里）会被 `submission_locked` race 吞掉。round-3 H6 仅修了手动路径，这条 timer 路径漏修。
- 设备/方向: 所有（最关键的是大考最后一秒还在打字的学生）
- 修复: `handleSubmit` 也走 `flushPendingSaves`；或把 `onTimeUp` 改指 `onSubmitClick`（要把 PaperHost 内部的 onSubmitClick 暴露给 Timer）。最简单：把 `flushPendingSaves` 上升到 host 层 useExam 拿到，handleSubmit 内 `await` 它。

**缺陷 B — Timer 切换 `aria-live` 属性不可靠（round-3 已识别但未修）**
- 严重度: **P2**
- 位置: `Timer.tsx:39` (`aria-live={danger ? 'polite' : 'off'}`)
- 现象: 平台一致性差；切换后屏幕阅读器不一定立即开始报时；一旦报时则每秒读"15:42、15:41…"，学生没法听讲解。
- 修复: 单独 `<span aria-live="polite" className="sr-only">` 只在跨阈值（5 分钟、1 分钟）时更新文本，数字 div 保持静默。

**缺陷 C — 没有 `< 1 分钟` 的明显视觉/震动提示**
- 严重度: **P3**
- 位置: `Timer.tsx:30-32`
- 现象: 5 分钟红色 → 时间到，期间没有进一步提醒（如闪烁 / 系统震动 / 提示弹窗"还剩 1 分钟"）。学生沉浸答题容易错过。
- 修复: 1 分钟内 `animate-pulse`，或加一个一次性 toast。

**缺陷 D — 时钟漂移：依赖客户端 `Date.now()`**
- 严重度: **P2**
- 位置: `Timer.tsx:13, 21` (`new Date(endsAt).getTime() - now` where `now = Date.now()`)
- 现象: 学生改 iPad 系统时间（往前调），倒计时会突然变长 → 学生发现可以"延时考试"。或者真心改时间被检测到 `endsAt` 已过，直接显示 00:00。一人一 iPad 场景下可控但无法防作弊。
- 修复: 后端给一个相对秒数 `secondsRemaining`，前端用单调递减；定期对时（每分钟拉一次后端 now 差值校准）。

---

### 7. 字号调整（FontSizeAdjuster）— **OK 但实现技术有隐患**

**位置:** `apps/web/src/components/exam/shared/FontSizeAdjuster.tsx`

**已正确实现的:**
- `localStorage` 持久化（`ExamContext.tsx:116-129`）。范围 0.7 - 1.6（70% - 160%），步长 0.1。
- 所有渲染器顶层 `<div style={{ zoom: fontScale }}>` 应用：
  - `IELTSReadingPassage.tsx:118`
  - `OLevelComprehension.tsx:46`
  - `OLevelMcqList.tsx:32`
  - `OLevelVocabInContext.tsx:36`
  - `OLevelSentenceTransformation.tsx:38`
  - `OLevelCloze.tsx:51, 110`
- A−/A+ 按钮 disable 在边界（line 19, 28）。
- A−/A+ 触摸目标 `min-h-[36px]` —— 低于 44 但是工具栏次要操作。

**缺陷 A — `style={{ zoom: ... }}` 是非标准 CSS 属性，Firefox 行为不一致**
- 严重度: **P3**（iPad Safari OK，但跨浏览器一致性差）
- 位置: 上述 6 个文件
- 现象: `zoom` 在 webkit/blink 是事实标准，FF 长期不支持；Chromium 桌面是 OK；iPad Safari 实际生效。但学生家长在 PC FF 上看 paper 时字号不变。配合 `position: fixed` 时 zoom 还会改变 fixed 元素的几何，导致底栏对位错。
- 设备/方向: 主要影响 desktop FF 用户；iPad 主用户群无感
- 修复: 改用 CSS `transform: scale()` + 容器尺寸调整，或用 CSS `font-size` 配合 rem 单位级联。MVP 接受 zoom 的现状。

**缺陷 B — `zoom` 与 `100dvh` 计算容器交互产生横向滚动条**
- 严重度: **P2**
- 位置: `IELTSReadingPassage.tsx:118` `<div className="lg:h-[calc(100dvh-9rem)]" style={{ zoom: fontScale }}>`
- 现象: 字号放大到 1.5 时，`zoom` 把内容连同 width 都放大 1.5x，但容器 height 是 `100dvh - 9rem`（视口高度），导致内容溢出右侧 → 出现水平滚动条。iPad 横屏分栏时尤其明显。
- 设备/方向: iPad 横屏，字号 ≥ 1.3
- 修复: 视觉测试后选 `transform: scale(...)` + 反向缩放 width，或限制 max font scale 到 1.2。

**缺陷 C — 字号变化时 Highlighter 已存的 char-offset 不受影响 ✅**
- **OK** —— offset 是基于字符不是基于像素，zoom 不会破坏。

**缺陷 D — 字号偏好是全局而非 per-session**
- 严重度: 设计选择
- 位置: `ExamContext.tsx:80` (`FONT_KEY = 'mq:fontScale'` 不带 sessionId)
- 现象: 一旦改大，所有未来 session 都跟着大。这是有意为之（学生爸妈视力问题应一直保持）。**OK，不需修**。

---

## 二、通用 UI / Mobile / Responsive

### G1 — 软键盘弹出已部分处理，但仍有 1 个关键漏洞

**位置:** `MorningQuizTake.tsx:208-224, 348-354`

**已正确实现的:**
- `visualViewport` API 监听（line 209-224），算出键盘高度。
- 底栏 `<div className="fixed bottom-0 ...">` 用 `transform: translateY(-${keyboardOffset}px)` 抬升（line 353）—— 修了 round-3 F9。
- `paddingBottom: 'env(safe-area-inset-bottom)'`（line 351）适配 Home Indicator。

**缺陷 — 输入框 `onFocus` 时无 `scrollIntoView`，textarea 在屏幕中下部时被键盘盖住**
- 严重度: **P1**
- 位置: 所有输入框：`IELTSReadingPassage.tsx` 中的 `LetterInput`、`BlankAwareInput`、`DebouncedTextarea`；`OLevelComprehension.tsx` 的 `FreeTextAnswer`；`InlineGapInput.tsx`；`OLevelSentenceTransformation.tsx` 的 textarea
- 现象: 底栏抬升了，但**输入框本身的位置不会自动滚到可视区**。学生 tap 进 IELTS Q40（页面底部某 BlankAwareInput）后键盘弹出，光标可能在键盘之下不可见。grep 验证：整个 src 0 处使用 `scrollIntoView`。
- 设备/方向: iPad 软键盘弹出场景（每次答题）
- 修复: 输入组件 `onFocus` 时 `e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })`，或在 `visualViewport.resize` 监听里检测当前 active element 是否在可视区，否则滚动。

### G2 — `100dvh` fallback 已加，但 `lg:h-[calc(100dvh-9rem)]` 未走 `@supports` fallback

**已正确实现的:**
- `MorningQuizTake.tsx:259-262`: `min-height: 100vh` + `@supports (min-height: 100dvh)` 双层 — root 容器 OK。

**缺陷 — IELTS / OLevel comprehension 内部容器只有 `100dvh`，无 `100vh` 兜底**
- 严重度: **P2**
- 位置:
  - `IELTSReadingPassage.tsx:118` `lg:h-[calc(100dvh-9rem)]`
  - `OLevelComprehension.tsx:47, 55` `lg:max-h-[calc(100dvh-9rem)]`
- 现象: iOS Safari < 15.4 不识别 `100dvh`，整条 `calc(100dvh-9rem)` invalid → 容器降级为 `auto`/继承高度 → IELTS 分栏 sticky 滚动失效。学校 iPad 升级慢，可能仍跑 iOS 14。
- 设备/方向: 老 iOS iPad (iOS < 15.4)
- 修复: 用 Tailwind arbitrary value 写双值 `lg:h-[calc(100vh-9rem)] lg:h-[calc(100dvh-9rem)]`（后者覆盖前者）；或用同样的 `@supports` 模式。

### G3 — viewport `user-scalable` 未禁，pinch-zoom 可用（设计选择）

**位置:** `apps/web/index.html:6` `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
- 严重度: **P3 / 设计决定**
- 现象: 默认允许双指捏合缩放 —— 视障/老花学生友好。但学生可放大屏幕作弊查附近资料（一人一 iPad 场景作弊概率低）。
- 修复: 保留现状；PRD 明示这是有意决定。后续真考严格模式可改 `maximum-scale=1.0, user-scalable=no`。

### G4 — 颜色编码 only 状态在多处仍未补图标双通道

**已修过的（对照通道双重编码 OK）:**
- QuestionNavBar 题号格子（已加 ✓ / · / ⚐ 字符）。
- IELTS practice mode feedback 总文字含 ✓/✗（line 265）。

**仍存在的:**
- **缺陷 A — IELTS 答题正确/错误的 `border-l-4 border-green-400` vs `border-rose-300`** 仅靠颜色（`IELTSReadingPassage.tsx:241-247`）。色弱学生 4px 红绿条难辨。**P3**。
- **缺陷 B — practice mode 选项 `border-green-500 bg-green-50` vs `border-rose-500 bg-rose-50`** 区分对错答（`OLevelComprehension.tsx:124-128`、`OLevelMcqList.tsx:54-58`、`OLevelVocabInContext.tsx:104-108`）— 仅颜色。round-3 F17 已识别，未修。**P2**。
- **缺陷 C — `InlineGapInput` ring-2 ring-green-400 / ring-rose-400** 仅颜色（line 47-50）。**P3**。
- 设备/方向: 任意，色盲学生（约 8% 男生）
- 修复: 错答叠加 ✗ icon、对答叠加 ✓ icon（绝对定位 in-corner 或 prepended）；不止依赖 border 色。

### G5 — `position: fixed` + iOS Safari 滚动 bug（潜在）

**位置:** 多个 `fixed` 用法
- `MorningQuizTake.tsx:309` palette overlay
- `MorningQuizTake.tsx:349` 底栏
- `OfflineBadge.tsx:13` 顶部 toast

**已正确实现的:**
- 底栏用 `transform` 抬升而非改 `bottom`，避免 iOS Safari `position: fixed` 在键盘弹出时的 jitter（line 353）。
- 给底栏 `safe-area-inset-bottom`（line 351）。

**缺陷 — IELTS sticky header 在 iOS 滚动时可能"飘"**
- 严重度: **P3**
- 位置: `IELTSReadingPassage.tsx:121` `<div className="lg:hidden flex justify-center gap-1 px-3 py-2 border-b bg-white sticky top-14 z-10">`
- 现象: `sticky top-14` 与外层 root 的 `sticky top-0` 工具栏 + IELTS 自己的 `sticky` 切换栏在 iOS Safari 滚动惯性时可能短暂错位 1-2 帧。一般可接受，但 iPad 4:3 长 passage 下感觉抖。
- 设备/方向: iPad 竖屏滚 IELTS passage / questions
- 修复: 让外层工具栏的高度精确等于 `top-14` 的 14*0.25rem = 56px；或用容器查询包裹两层 sticky。

### G6 — `-webkit-overflow-scrolling: touch` 缺失

**位置:** 全局
- 严重度: **P3**
- 现象: grep 验证：`apps/web/src` 内 0 处 `webkit-overflow-scrolling`。所有 `overflow-auto` 容器在老 iOS Safari (< 13) 没动量滚动 — 滚动突兀。新 iOS 已不必要，但 14/15 上还有差异。
- 设备/方向: 老 iPad (iOS < 13)
- 修复: 全局 CSS `*::-webkit-scrollbar { ... }` + `body { -webkit-overflow-scrolling: touch; }`。优先级低。

### G7 — 横竖屏切换数据丢失风险

**位置:** 所有渲染器
- 严重度: **OK，无丢失**
- 现象: 答案保存在 `ExamContext.answers` (Provider 不变) + `localStorage`，旋转屏幕组件不会 unmount → answers 不丢；highlights 在 `useStoredHighlights` hook 通过 `localStorage` 持久化，旋转一次性 setState 不丢。
- 验证: `DraggableSplit.tsx:55-66` 已订阅 `orientationchange` 重算 vw → ✅。
- **结论: ✅ 无数据丢失。**

### G8 — 触摸目标尺寸（汇总）

| 控件 | 文件:行 | 实际 (Tailwind class) | ≥44px? |
|---|---|---|---|
| 提交按钮 | MorningQuizTake.tsx:390 | `min-h-[48px] py-3 px-7` | ✅ |
| 题号面板按钮 | MorningQuizTake.tsx:359 | `min-h-[48px] py-2.5 px-3.5` | ✅ |
| 看原文 toggle | IELTSReadingPassage.tsx:122 | `py-1.5 px-4` ≈ 36-38px | ❌ |
| QuestionFlag | QuestionFlag.tsx:16 | `min-h-[36px]` 显式 | ❌ 36px |
| FontSizeAdjuster A−/A+ | FontSizeAdjuster.tsx:20,29 | `min-h-[36px]` | ❌ 36px |
| StickyNote +Add | StickyNote.tsx:72 | `min-h-[36px]` | ❌ 36px |
| Palette 关闭 (×) | MorningQuizTake.tsx:323 | `w-10 h-10` = 40px | ❌ |
| QuestionNavBar 题号格 | QuestionNavBar.tsx:54 | `min-h-[44px]` | ✅ |
| Compact MCQ A-F | IELTSReadingPassage.tsx:377 | `min-w-[44px] min-h-[44px]` | ✅ |
| Standard MCQ label | IELTSReadingPassage.tsx:390 | `min-h-[48px]` | ✅ |
| LetterInput | IELTSReadingPassage.tsx:429 | `min-h-[48px]` | ✅ |
| BlankAwareInput | IELTSReadingPassage.tsx:491 | `min-h-[48px]` | ✅ |
| InlineGapInput | InlineGapInput.tsx:81 | `min-h-[44px]` | ✅ (round-3 修) |
| DraggableSplit handle | DraggableSplit.tsx:153 | `w-3` = 12px | ❌ 12px |
| Prev/Next 翻页按钮 | OLevelMcqList.tsx:101,110 等 | `min-h-[44px]` | ✅ |

**结论:** 主答题控件 ≥48 OK；工具/导航类小控件 36-40 普遍偏小；**DraggableSplit 12px 仍是单点最严重**。

### G9 — `beforeunload` 未实现 — 学生误刷新风险

- 严重度: **P2**
- 位置: 全局，0 处 `beforeunload` 监听（grep 验证）
- 现象: 答题途中误下拉刷新 / 关 tab → 已 typed 但 debounce 未触发的字符丢失（虽然有 localStorage cache，但用户可能不会重开同一个 url）。
- 修复: 在 `MorningQuizTake.tsx` mount 时 `addEventListener('beforeunload', e => { e.preventDefault(); e.returnValue = '' })` —— iPad Safari 也会弹"离开此页?" 系统对话。

### G10 — 切屏检测（防作弊）未实现

- 严重度: 设计选择 / **P3**
- 位置: 0 处 `visibilitychange` 监听
- 现象: 学生可以切到笔记 app / Safari 别 tab 查资料，无任何痕迹/警告。一人一 iPad 场景下作弊路径多，至少应留记录。
- 修复: `document.addEventListener('visibilitychange', ...)` 累计离屏时长上报后端；不强行禁，仅在批改端展示。

---

## 三、各 IELTS 7 件套 OK / 缺陷 速查表

| 件 | 件名 | 状态 | 主要缺陷 |
|---|---|---|---|
| 1 | 拖动分栏 | **基本 OK** | hit 区 12px 偏小 (P2) · 缺 `touchcancel` (P2) · ARIA value range (P3) |
| 2 | 文本高亮 | **有缺陷** | 跨段落 + reflow 后 offset 漂移 (P2) · 无 a11y 反馈 (P3) · 键盘不可达 (P3) |
| 3 | 便签 | **OK 但羸弱** | `<li>` 键盘不可达 (P2) · `prompt()` 体验粗 (P3) · 仅本地存储 (P3) |
| 4 | 标记题目 | **有缺陷（关键）** | flag 从未上传后端 (P2) · svg path 错误 (P3) · 36px 触摸 (P3) |
| 5 | 题号导航 | **有缺陷（关键）** | Palette 缺 focus trap/Esc/aria-modal (P1) · 分页 shell 未传 currentIdx (P3) |
| 6 | 倒计时 | **基本 OK** | **timer 自动提交未 flush autosave (P1)** · aria-live 切换不靠谱 (P2) · 客户端时钟漂移 (P2) |
| 7 | 字号调整 | **OK 但有隐患** | `zoom` + `100dvh` 大字号横滚 (P2) · 非标准 CSS (P3) |

---

## 四、优先级总览（红/黄/绿）

### 红灯（P1，上线前必须修）
1. **倒计时自动提交未 flush 待保存的 autosave** — `MorningQuizTake.tsx:300` 路径漏修。Round-3 H6 仅修了手动路径。
2. **QuestionPalette modal 缺 focus trap + Esc 关闭 + aria-modal** — 键盘 / VoiceOver 用户无法关闭 palette。
3. **输入框 `onFocus` 缺 `scrollIntoView`** — iPad 软键盘弹出后，textarea 在屏幕中下部时被遮挡。底栏抬升了但输入框本身不滚动。

### 黄灯（P2，pilot 后必须修）
4. flag 状态不上送后端（教师批改端看不到学生标记）
5. DraggableSplit hit 区 12px、缺 `touchcancel`
6. StickyNote `<li onClick>` 键盘不可达
7. Highlighter 跨段落 + passage reflow 后 offset 漂移风险
8. Practice mode 选项对错仅靠红/绿 border（色盲不友好）
9. `lg:h-[calc(100dvh-9rem)]` 在 iOS < 15.4 上失效（缺 `100vh` fallback）
10. Timer aria-live 切换不可靠（屏幕阅读器报时混乱）
11. `beforeunload` 未实现，刷新丢未保存字符
12. `zoom: fontScale` 与 100dvh 容器在大字号下产生横向滚动条
13. Timer 客户端时钟漂移（学生改 iPad 系统时间）

### 绿灯（已修 / OK）
- 横竖屏切换无数据丢失。
- 高亮 / 便签 / 字号 持久化。
- 主答题控件触摸目标 ≥48px。
- DraggableSplit touch 路径 + orientationchange 已订阅。
- Highlighter rAF 缓冲已加。
- 题号导航三状态 ✓ / · / ⚐ 双通道。
- Auto-submit on time-up 触发链路在（虽然 flush 漏修）。
- localStorage offline-first 完整。
- `safe-area-inset-bottom/top` 已用。
- visualViewport 抬升底栏。

---

## 五、整体结论 · iPad 上线就绪度

**评分: 70%**（高于 round-3 的 60%，关键问题大多已修，但仍有 3 个 P1 阻塞上线）

**距离"可大规模上线"的最小修复集:**
1. 修复 `handleSubmit` 调用 `flushPendingSaves`（约 5 行）
2. 给 Palette modal 加 focus trap + Esc + `aria-modal`（约 30 行）
3. 输入框 `onFocus` 加 `scrollIntoView`（约 5 行 × 5 处）

**强烈建议 pilot 测试:**
- iPad 9.7（老款 iOS）+ iPad Pro 11（新款 iOS）
- 横屏 → 竖屏切换 1 次
- 软键盘弹出 → 键盘高度 ≈ 屏幕 1/2 → 写答案 → 交卷
- 离线 30s → 重连 → 验证答案不丢
- VoiceOver 走完一次 IELTS Reading 完整流程
- 色盲模拟器（Sim Daltonism）走 practice mode 反馈页

**未做（声明）:**
- ❌ 未实测 iPad 真机
- ❌ 未跑 dev server 截图
- ❌ 未 axe-core / Lighthouse a11y 自动扫描
- ❌ 未 VoiceOver / NVDA 测试
- ❌ 未跨浏览器（FF / Edge）回归

---

**审查者:** Agent 6 (Round 7 上线前)
**审查日期:** 2026-05-09
**审查方法:** 静态代码 review，对比 round-3 agent-9 已识别问题逐项确认修复状态
