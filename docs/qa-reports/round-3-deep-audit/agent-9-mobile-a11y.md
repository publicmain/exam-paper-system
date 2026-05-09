# Round-3 深度审查 · Agent 9 · 移动端 / 无障碍 (a11y)

**审查范围:**
- `_audit_review/exam/shared/*` (7 个 shared 组件)
- `_audit_review/exam/questions/*` (6 个 question 组件)
- `_audit_review/exam/ExamContext.tsx`、`QuestionTypeRegistry.tsx`、`types.ts`
- `apps/web/src/pages/MorningQuizTake.tsx` (生产分支已合并的真正实考页)
- `apps/web/index.html`

**方法:** 纯静态代码 review,**未实测 iPad / 屏幕阅读器**。所有 iOS Safari / VoiceOver 行为推断都标注。

**重要前提说明 — 本审查中两份代码并存:**
1. `_audit_review/exam/**` — 旧 round 引入的"组件化拆分"草稿,从未合入主线 (`apps/web/src/components/exam/` 不存在),这是 Agent 9 任务里被点名要审的代码。
2. `apps/web/src/pages/MorningQuizTake.tsx` — 当前已合入 main 的单文件实现。生产 iPad 实考真正跑的是这个,旧 `_audit_review` 那套并不会渲染。

下面 finding 标注 `[审查目标:组件草稿]` 还是 `[生产页面]`。如果本次 round-3 只评估 `_audit_review/`,生产页面的同类问题等价存在(因为草稿是从 `MorningQuizTake.tsx` 抽出来的)。

---

## 一、移动端 (iPad 主战场)

### F1 · viewport 不允许 user-scalable [生产 / 草稿共用 index.html]
**严重度:** P3 (但应有意识地决定)
**WCAG:** 1.4.4 Resize Text (AA)
**文件:** `apps/web/index.html:6`
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
**情况:** 没有显式 `user-scalable=no` / `maximum-scale=1`,**默认是允许双指捏合缩放的** — 这点反而比常见考试系统更友好。
**影响用户群:** 视障 / 老花 iPad 用户;实际作弊场景中也有 fish:这个能让学生用系统 zoom 偷看附近资料(防作弊看)。
**建议:** **保留现状**。已有 `FontSizeAdjuster` 提供 A−/A+,加上系统 zoom 双重保险。但 PRD 应**明示**这是有意决定 — 真考要禁 zoom 防偷看的话,得另起一个考试 mode。

### F2 · `window.innerWidth` 用在初次 render,屏幕旋转不响应 [组件草稿 P1]
**严重度:** P1 (iPad 横竖屏切换是核心场景)
**文件:** `_audit_review/exam/shared/DraggableSplit.tsx:98, 124`
```ts
style={{ width: typeof window !== 'undefined' && window.innerWidth >= mobileBreakpoint ? leftPct : '100%' }}
```
**问题:**
- `window.innerWidth` 在 inline style 里读 — 不订阅 resize / orientationchange,**第一次渲染后不再更新**。学生从横屏转竖屏 (`> 1024 → 768`),左/右栏的 inline width 还是按照初次值留下。
- 等 React state(在哪都没存)更新这条不会触发 — 这条 width 永远不会变。
- 实际表现:横屏起手 → 转竖屏 → 你会看到 50% 宽的 passage 卡死在屏幕一半,右栏被挤掉到屏幕外。
**影响:** **iPad 用户全部** — iPad 学生大概率横竖屏切换。
**建议:** 改成 Tailwind breakpoint 类做条件:`lg:w-[var(--split-l)]` + 一个 useEffect 订阅 `matchMedia('(min-width: 1024px)')` 决定是否应用拖拽 width;或干脆只在 lg+ 用 inline width。

### F3 · 触摸目标尺寸 — 大体合规但若干例外
**严重度:** P2
**WCAG:** 2.5.5 Target Size (AAA — 但 iOS HIG 强烈推荐 44pt+)
**对比 (静态 review):**

| 控件 | 文件:行 | 实际尺寸 (Tailwind) | 是否 ≥44px |
|---|---|---|---|
| 提交按钮 | MorningQuizTake.tsx:460 | `min-h-[48px] py-3 px-7` | ✅ |
| 题号按钮(底栏) | MorningQuizTake.tsx:434 | `min-h-[48px] py-2.5 px-3.5` | ✅ |
| 看原文 toggle | MorningQuizTake.tsx:367 | `py-2 px-3` ≈ 36px | ❌ ~36px |
| QuestionFlag | shared/QuestionFlag.tsx:16 | `min-h-[36px]` 显式 | ❌ 36px (低于 44px iOS HIG) |
| FontSizeAdjuster A−/A+ | shared/FontSizeAdjuster.tsx:20,30 | `min-h-[36px] py-1.5 px-2.5` | ❌ 36px |
| QuestionPalette 关闭(×) | MorningQuizTake.tsx:819 | `w-10 h-10` = 40px | ❌ 40px |
| QuestionPalette 题号格子 | MorningQuizTake.tsx:838 | `h-12` 高 + grid 5 列 | 高度 48 ✅ 但单格宽度在 max-w-md 屏宽下大约 60px ✅ |
| QuestionNavBar 单格 | shared/QuestionNavBar.tsx:34 | `h-9 sm:h-10` = 36-40px | ❌ <44px |
| TFNG/MCQ 单选(label) | RadioGroup label `min-h-[48px]` | ✅ |
| Compact A-F bank 按钮 | RadioGroup compact `min-w-[44px] min-h-[44px]` | ✅ (代码注释也明确说 44 是 iPad 阈值) |
| InlineGapInput 输入框 | shared/InlineGapInput.tsx | `py-0.5` = 高 ~26-28px | ❌ 严重过小 |
| StickyNoteRail + Add | shared/StickyNote.tsx:72 | `min-h-[36px]` | ❌ 36px |
| LetterInput | min-h-[48px] | ✅ |
| BlankAwareInput | min-h-[48px] | ✅ |
| DraggableSplit 分隔条 | shared/DraggableSplit.tsx:117 | `w-1.5` = 6px | ❌ **极度过窄,触摸基本无法命中** |

**重点:**
1. **InlineGapInput 高度 ~28px** — 这是 cloze 完形填空的主输入,iPad 上点 28px 高的输入框很难命中,字体放大后还是 baseline 对齐,触摸点没变大。**P1。**
2. **DraggableSplit 分隔条 6px 宽** — iOS HIG 最低 44pt,这条触摸根本不可能拖动,touch 几乎全失败。横屏 iPad 学生想调分栏比例 = 死。**P1。**
3. **QuestionFlag / FontSizeAdjuster 36px** — 不算严重违规,但 iPad 长时间作业会累。P3。
4. **QuestionNavBar 36-40px 单格** — 100 题导航这种密集格子被点错的成本高,误跳到错的题。P2。

**影响用户群:** iPad 学生 + 任何触摸用户。
**建议:** 关键控件统一拉到 `min-h-[44px]`;DraggableSplit 在视觉 6px 上叠 16-20px 不可见 hit area (`::before` 拓展或 padding)。

### F4 · iOS Safari 长按选区 vs Highlighter [组件草稿 + 生产页]
**严重度:** P2 (功能可能不工作或用户体验差)
**文件:** `_audit_review/exam/shared/Highlighter.tsx:120-126`、`MorningQuizTake.tsx:557-565`
```ts
onMouseUp={captureSelection}
onTouchEnd={captureSelection}
className="select-text whitespace-pre-wrap"
style={{ WebkitUserSelect: 'text', userSelect: 'text', ...style }}
```

**好的方面:**
- 没有阻断 `contextmenu` / `selectstart`(没找到 `e.preventDefault()` 在选区路径上)。
- `WebkitUserSelect: 'text'` 显式设置,iOS 默认行为保留。
- 同时挂 `mouseup` + `touchend`,ChromiumDesktop 跟 iOS Safari 都覆盖。

**仍存在的问题(代码 review 推断,未实测):**
1. **`touchend` 比 `selectionchange` 早,iOS 上 Selection 可能还没稳定**。iOS 选区是异步的:学生长按选词、抬手 → `touchend` 触发时 `window.getSelection()` 还在更新。代码 review 推断:可能拿到空选区或上一次的选区。建议加一个 `requestAnimationFrame` 或 `setTimeout(_, 0)` 缓冲。
2. **`sel.removeAllRanges()`(:113)在 iOS 上会让放大镜消失但选词体验仍残留** — 学生看不到选区被记下了,仅靠"突然出现一段黄底"作反馈,首次使用很迷茫。
3. **没有处理 iOS 上"选了三句话再点击别处"的 mouseup** — 实测可能在 passage 外点击不会清除 selection,导致下一次重叠选区错乱。

**影响:** iPad 学生 — 高亮功能可能丢选 / 选错范围。
**建议:** 用 `requestAnimationFrame` 缓冲 + 显式 visual feedback (如 toast)。最少要在 PRD 明示:**未在 iPad 实测**。

### F5 · DraggableSplit touch event 处理基本到位但存边界情况 [组件草稿]
**严重度:** P2
**文件:** `_audit_review/exam/shared/DraggableSplit.tsx:64-79`

**好的方面:**
- 有 `onTouchStart` + `touchmove` + `touchend`,touch 路径完整。
- `touchmove` 用 `{ passive: false }`,允许 preventDefault — 这是对的(虽然代码里没真 preventDefault)。

**问题:**
1. **没有 preventDefault 在 touchmove** — 学生横向拖分隔条,iOS Safari 同时会触发页面滚动。会感到"分栏拖不动 / 滚动一下子"。
2. **指针离开 iframe / 文档时 stop 不一定触发** — `touchcancel` 没监听 (iOS 来电 / 通知会触发 cancel)。来电后回到考试页,分隔条状态可能卡在 dragging=true。
3. F3 已说 — 6px 触发面积本身就让 touch 命中率低。

**影响:** iPad 学生想调左右栏宽度。
**建议:** 加 `touchcancel` listener 复位 dragging,touchmove 里在确认拖动方向是水平后 `e.preventDefault()`。

### F6 · StickyNote 没有拖动功能,无 touch 兼容性问题
**严重度:** N/A — 仅 `prompt()` 编辑,无拖拽。
**文件:** `_audit_review/exam/shared/StickyNote.tsx`、`MorningQuizTake.tsx:518-540`

**注:** 任务清单提到"StickyNote 拖动是否 touch 兼容",但当前实现根本没有拖动 — 只是 list + `prompt()` 编辑。这降低复杂度也降低了 a11y 风险。`prompt()` 在 iPad 上**会弹出系统对话框是 OK 的**,但有以下次要问题:

1. `prompt()` 是阻塞的、原生的,**屏幕阅读器 (VoiceOver) 处理 OK**(原生组件)。
2. `prompt()` 的可访问性比自建 modal 反而更高(系统级)。
3. 缺点:**无法预填多行**、不能格式化。

**建议:** 保留 `prompt()` 在 MVP,但在功能预算允许时换成自建 modal 配 `aria-modal` + `role="dialog"`。

### F7 · 响应式断点逻辑 — IELTS 分栏在 768/1023 之间
**严重度:** P1
**文件:** `MorningQuizTake.tsx:374-407`,`_audit_review/exam/shared/DraggableSplit.tsx`

**生产页 (`MorningQuizTake.tsx`) 的策略:**
- `lg:` (≥1024px) 才进入分栏。
- 768-1023(iPad 竖屏)走单栏 + tab 切换,这是对的。

**草稿组件 (`DraggableSplit`) 的策略:**
- 同样用 `lg:` (1024px) 作为 desktop 阈值,但 inline width 用 `window.innerWidth` 探测 — 见 F2,旋转不响应。

**iPad 主要尺寸:**
- iPad 9.7 / 10.2 横屏:1024 × 768 → ✅ 命中 lg:
- iPad 11" 横屏:1194 × 834 → ✅ lg:
- iPad Pro 12.9 横屏:1366 × 1024 → ✅ lg:
- iPad 9.7 竖屏:768 × 1024 → ❌ 单栏 (设计意图正确)
- iPad Pro 11 竖屏:834 × 1194 → ❌ 单栏

但 **iPad 横屏 1024px 正好等于 Tailwind `lg:` 阈值**,有些 iPad 报 `1024 - 1` 或 `clientWidth=1024`,边界条件可能让 `lg:` 类失效一帧。

**问题:**
- `lg:max-h-[calc(100dvh-5rem)]` (MorningQuizTake.tsx:380) — `100dvh` 在老版本 iOS Safari (<15.4) 不支持,会回落为 100% 容器高,可能导致 sticky 高度计算异常。
- 草稿组件在 lg 之间临界用 `lg:` 类 + `window.innerWidth` 双重判断,**两条逻辑可能不一致**(media query say lg, JS say not lg)。

**影响:** iPad 横屏边界尺寸用户、低版本 Safari 用户。
**建议:**
1. 添加 `100vh` 作为 `100dvh` 的 fallback。
2. DraggableSplit 改用 useEffect + matchMedia(`min-width: 1024px`) 取代 `window.innerWidth`,与 Tailwind `lg:` 完全一致。
3. 至少在 iPad 9.7 (1024×768) 上实测一遍。

### F8 · QuestionNavBar 100 题在窄屏崩溃风险 [组件草稿]
**严重度:** P2
**文件:** `_audit_review/exam/shared/QuestionNavBar.tsx:23`
```ts
<div className="px-3 py-2 grid grid-cols-10 sm:grid-cols-13 gap-1.5">
```
**问题:**
1. `sm:grid-cols-13` — Tailwind **默认没有 grid-cols-13**(只有 1-12),除非项目里扩展了 theme。没找到 tailwind.config 中扩展(草稿组件里没引这个文件)。**这条样式很可能 silently 失效**,降级到默认 13 列等价于无类。
2. 100 题 / 10 列 = 10 行,每行 100 题 / 10 列,在 iPad 竖屏 768px 减去 padding ≈ 740px / 10 = 74px 单格宽度 ✅。
3. 但 IELTS 真实题数最多 40 题 (每篇 13-14 题 × 3 篇),100 题是 cloze 大测试场景。代码可能从未压力测试过。

**影响:** 长 paper 的导航视觉错乱;iPad 竖屏勉强能用。
**建议:**
- 验证或移除 `sm:grid-cols-13` (确认 tailwind.config 是否扩展)。
- 100+ 题增加滚动容器 + sticky 当前题号高亮。

### F9 · 键盘弹出遮挡输入框 [生产页 P1]
**严重度:** P1
**文件:** `MorningQuizTake.tsx:1114-1123`(BlankAwareInput)、`:1066-1076` (DebouncedTextarea)、`:1037-1052` (LetterInput)
**问题:**
- iPad 软键盘占据屏幕下方约 40-50%,但代码**没有 scrollIntoView 或 visualViewport API 处理**。
- 学生 tap 进 textarea 后,如果 textarea 在屏幕中下部,iPad 键盘弹出可能盖住光标,学生看不到自己在打什么。
- 底栏 (`fixed bottom-0`) 会被键盘推上来 OR 被键盘遮挡(取决于 visualViewport 行为) — 没看到任何针对 `visualViewport.resize` 的处理。
- 提交按钮在底部 `fixed`,键盘弹出后**会变成不可达** — 学生写完答案要先关键盘才能点交卷。

**测试矩阵未覆盖:** iPad 软键盘弹出 + 底栏交卷按钮。
**影响:** **每个 iPad 学生** 答题时 + 交卷时。
**建议:**
1. 输入框 `onFocus` 时 `scrollIntoView({ block: 'center' })`。
2. 监听 `window.visualViewport.resize`,键盘弹出时把 `fixed bottom-0` 临时改成 `position: absolute` 或加 `bottom: env(keyboard-inset-height)`。
3. 至少 PRD 明示:学生需先收键盘再交卷,或加一个浮动 mini 交卷按钮在视口右上角。

### F10 · `100dvh` 兼容性
**严重度:** P3
**文件:** `MorningQuizTake.tsx:343, 380`、`_audit_review/exam/questions/IELTSReadingPassage.tsx:111`、`OLevelComprehension.tsx:40, 48`
**情况:** `100dvh` 在 iOS Safari < 15.4 不支持,会回退为 `auto`。
**影响:** 老 iPad (iOS 14 等) 学生 — 实际 iPad 还能升 iOS 大概是大多数,但学校 iPad 升级慢。
**建议:** 加 fallback `min-h-screen` 或 `100vh` 在 `100dvh` 之前。Tailwind 用 `min-h-screen lg:min-h-[100dvh]` 双层兜底。

---

## 二、a11y (WCAG 2.1 AA)

### F11 · QuestionPalette / QuestionNavBar 题号格子状态仅靠颜色 [组件草稿 + 生产页 P1]
**严重度:** P1
**WCAG:** 1.4.1 Use of Color (A — 必须)
**文件:** `MorningQuizTake.tsx:828-862`(palette)、`shared/QuestionNavBar.tsx:30-49`
**问题:**
- 已答 = 蓝色填充,未答 = 灰色填充,标记 = 橙色 ring。三种状态完全靠**色相**区分。
- 代码里有橙色右上角小圆点 (●) 但 `aria-hidden`,屏幕阅读器读不到。
- 色盲用户(蓝绿色弱、红绿色弱)在 iPad 上可能看不出蓝/灰对比。

**好的方面:**
- `aria-label` 文本里包含 "answered/unanswered/flagged" — 屏幕阅读器有信息。
- 非视觉补救上做了。

**仍欠:**
- **视觉**层面,没有 icon / 形状区分。蓝色填充 vs 灰色填充对色盲是低对比;橙色 ring 与蓝色按钮叠加更糟。

**影响用户群:** 色盲学生 (~8% 男性、0.5% 女性) — 平均班级肯定有。
**建议:**
- 已答 = 实心填 + ✓ 字符;未答 = 空白;标记 = 旗帜符号。形状 + 颜色双编码。
- 验证蓝/白 + 灰/灰边对比是否 ≥3:1 (UI 组件最低)。

### F12 · DraggableSplit 分隔条 a11y 部分到位
**严重度:** P3
**文件:** `_audit_review/exam/shared/DraggableSplit.tsx:103-120`

**好的方面:**
- ✅ `role="separator"` `aria-orientation="vertical"` 都有
- ✅ `tabIndex={0}` 可键盘 focus
- ✅ `onKeyDown` 监听 ArrowLeft/Right,2% 步长调整
- ✅ `aria-valuenow={Math.round(pct * 100)}`

**欠缺:**
- 没有 `aria-valuemin` `aria-valuemax` (separator 通常要补)。
- 没有 `aria-label`,屏幕阅读器只读到角色没读到含义。
- 没有键盘 Home/End 复位到中间。
- F5 提到的触摸面积过小,键盘用户没问题但触屏不可用。

**影响:** 屏幕阅读器 + 键盘用户。
**建议:** 加 `aria-label="Adjust passage / questions split"` `aria-valuemin={25} aria-valuemax={75}`。

### F13 · Timer 的 aria-live 太晚切换 [组件草稿]
**严重度:** P2
**文件:** `_audit_review/exam/shared/Timer.tsx:39`
```ts
aria-live={danger ? 'polite' : 'off'}
```
**问题:**
- 只在最后 5 分钟 (`danger`) 才打开 polite live region。
- 切换 `aria-live` 属性本身**不会让屏幕阅读器立即开始报时**,在 NVDA / VoiceOver 中切换 live region 属性的行为是平台不一致的。
- 计时器每秒重新渲染,真打开后会**每秒读"15:42、15:41…"**,学生没法听讲解,更糟。
- 应该用更稀疏的报时:每分钟、最后 5 分钟每 30s、最后 1 分钟每 10s。

**影响:** 屏幕阅读器学生(可能很少,但要面对盲考生需要)。
**建议:** 单独写一个隐藏的 `<div aria-live="polite" className="sr-only">` 只在跨阈值(15→14、5→4 分钟)时更新文本;数字本身保留视觉用,不参与 live region。

### F14 · QuestionFlag aria-pressed 已有,InlineGapInput aria-label 已有
**好的方面:** ✅
- `QuestionFlag` 用 `aria-pressed={flagged}` `aria-label`,正确。
- `InlineGapInput` 默认 `aria-label="Blank ${index}"` 兜底。

**欠缺:**
- aria-label 没有"第几题、共几空"上下文。屏幕阅读器只听到 "Blank 3" 不知道是哪题的。
**建议:** aria-label 由 host 传 "Question 5, blank 3 of 4"。当前 `OLevelCloze.tsx:72` 只传 `Blank ${i + 1}`,没传题号。

### F15 · OfflineBadge aria-live 设置正确
**好的方面:** ✅
**文件:** `_audit_review/exam/shared/OfflineBadge.tsx:11-12`
```ts
role="status" aria-live="polite"
```
对一个非紧急通知,polite 是对的。如果断网会丢答案,该用 `assertive` 但当前文案明确说"答案已保存本地",polite 合适。

### F16 · 错误状态没有 aria-invalid / aria-describedby
**严重度:** P3
**WCAG:** 3.3.1 Error Identification (A)
**文件:** `_audit_review/exam/questions/OLevelSentenceTransformation.tsx:108-118`
```ts
className={`... ${overLimit ? 'border-rose-300 ...' : '...'}`}
// 没有 aria-invalid={overLimit}
```
**问题:** 单词数超限只用红色 border 提示,未给 textarea 设 `aria-invalid`,屏幕阅读器无从得知。
**建议:** `aria-invalid={overLimit}` `aria-describedby="word-count-{q.id}"`,把 "X 个 word over limit" 文本绑定。

### F17 · Practice mode 反馈仅靠 ✓/✗ + 颜色 [组件草稿 P2]
**严重度:** P2
**WCAG:** 1.4.1 Use of Color (A)
**文件:** `IELTSReadingPassage.tsx:233-265`、`OLevelComprehension.tsx:117-125`
```ts
<div className={`... ${isCorrect ? 'text-green-700' : 'text-rose-700'}`}>
  {isCorrect ? '✓ Correct' : `✗ Correct: ${correctKey}`}
```
**好的方面:** ✓/✗ 字符是非颜色提示,色盲也能看。但单选项的 border 是仅颜色编码:
```ts
isThisCorrect ? 'border-green-500 bg-green-50'
: isThisWrong ? 'border-rose-500 bg-rose-50'
```
**问题:** 选项 border 红/绿区分,色盲学生看 4 个绿色选项(自己答的也是 hover/selected 蓝),分不清哪个是对的、哪个是错答。
**建议:** 在错答选项上叠加 ✗ icon、对答案上叠加 ✓ icon。

### F18 · 暗色模式不支持
**严重度:** P3
**情况:** 组件全部硬编码 `bg-white`、`text-gray-900` 等浅色 token,没有 `dark:` 类。
**影响:** 偏好暗色模式 / 在弱光环境用 iPad 的学生。
**建议:** 后续 round 加 `dark:` 类;早测一般在白天教室,优先级低。

### F19 · 键盘快捷键缺文档化 (Tab in Cloze)
**严重度:** P3
**文件:** `_audit_review/exam/questions/OLevelCloze.tsx:80`
```ts
<span>Tip: Tab → next blank · Shift-Tab ← previous</span>
```
**好的方面:** ✅ visible hint 在 footer,告诉学生 Tab 顺序。这是**当前文档里唯一**记录的快捷键。
**欠缺:**
- 没有 `aria-keyshortcuts` 属性。
- IELTS 没有任何 Prev/Next 快捷键,学生纯靠 mouse 导航。
- QuestionPalette 关闭没有 Esc 监听 — 键盘用户一旦打开 palette 出不来。
**建议:** 至少给 modal-style overlay (palette) 加 `Escape` 关闭 + `aria-modal`。

### F20 · Focus 顺序 — IELTS 分栏跨左右栏问题 [组件草稿]
**严重度:** P2
**文件:** `IELTSReadingPassage.tsx:131-163`
**Tab 顺序推断 (代码 review,未实测):**
1. Header buttons (mobile pane switch)
2. **DraggableSplit 分隔条** (tabindex=0)
3. Passage Highlighter <div> (`select-text` 可 focus 但默认 tabindex=-1 — 实际取决于浏览器)
4. StickyNote +Add 按钮 + 列表项
5. ⤴ DOM 顺序穿越分隔条
6. 右栏:每个 question 的 QuestionFlag、radio inputs、letter input、blank input

**问题:**
- 分隔条 tabindex=0 在 Tab 流中,学生 Tab 一次会落到分隔条 — 大多数情况下是噪音。建议 `tabindex={-1}` 或仅在 lg+ 启用 tabindex。
- StickyNote 列表项是 `<li onClick>`,**没设 tabindex 也没 role="button"** — 键盘用户根本访问不到便笺编辑(只能 mouse / touch)。
- 移动 sticky tab "原文/题目" 切换按钮没有 `aria-pressed` 表示当前哪个被选中。

**影响:** 键盘 + 屏幕阅读器用户。
**建议:** sticky list `<button>` 替代 `<li onClick>`;mobile tab 加 `aria-pressed`。

### F21 · Modal-style QuestionPalette 缺 focus trap [生产 + 草稿都没]
**严重度:** P2
**WCAG:** 2.4.3 Focus Order (A)
**文件:** `MorningQuizTake.tsx:802-866`
**问题:**
- Palette 是 fullscreen overlay,但是没有:
  - `role="dialog"` `aria-modal="true"`
  - 自动 focus 到首个题号 / 关闭按钮
  - Tab 键被困在 modal 内 (focus trap)
  - Esc 关闭
  - 关闭后 focus 还回原触发按钮
- 屏幕阅读器用户打开后会迷失在底层页面元素之间。

**建议:** 加 focus trap (用 `react-aria` 或 ~30 行手写),Esc 监听,触发器记忆 + 还原。

### F22 · 自定义 SVG icon 缺 title / 含义传达
**严重度:** P3
**例子:** `MorningQuizTake.tsx:437-442` 题号面板按钮的 svg `aria-hidden`,但按钮自身有可见文字 "题号" — 这个 OK。
但 `:822-824` palette 的关闭 × svg `aria-hidden`,按钮有 `aria-label="关闭"` — ✅ OK。

整体 SVG 全部 `aria-hidden`,文本含义都在按钮文字 / aria-label 里 — **这是对的做法**。但要 review 每一个;静态扫描下没看到漏的。

---

## 三、Highlighter / Notes 流程隐藏 a11y 缺口

### F23 · Highlighter 选区 → 高亮 整个流程屏幕阅读器不感知
**严重度:** P3
**文件:** `_audit_review/exam/shared/Highlighter.tsx:99-113`
**问题:**
- 学生选词后,新增 `<mark>` 但没有 aria-live 反馈 "Highlighted 'X words'"。
- `<mark>` 元素本身有语义("highlighted text"),屏幕阅读器**会**说"highlighted",但只在重新读到位置时才会。
- 移除高亮也没反馈。

**影响:** 屏幕阅读器学生(完全盲学生用 Highlighter 价值低,但低视力学生使用 zoom + screenreader 还是会用)。
**建议:** 加 `aria-live` 区域报告"加亮已保存 / 已移除"。

### F24 · prompt() 编辑便笺无键盘焦点还原
**严重度:** P3
**文件:** `MorningQuizTake.tsx:519-540`、`_audit_review/exam/shared/StickyNote.tsx:74,88`
**问题:** `prompt()` 是阻塞同步 API,关掉后 focus 通常会回到触发按钮,这个 OK;**但** `<li onClick>` 触发的 prompt,关闭后 focus 落在哪里浏览器行为不定。键盘用户可能 focus 丢失。
**建议:** 转成自建 modal 时一并解决。MVP 接受。

---

## 四、关键缺失对比 (Examplify / IELTS CD 实考软件标准)

| 特性 | 实考软件标准 | 当前实现 |
|---|---|---|
| 切屏检测(防作弊) | ✅ blur/visibilitychange 警告 | ❌ 未见 |
| 防止意外刷新 | ✅ beforeunload 二次确认 | ❌ 未见 — 学生误刷 = 丢未保存到服务器的字符 |
| 暗色 / 高对比度模式 | ✅ | ❌ |
| 字号无极限放大 | ✅ 通常 200% | ✅ A−/A+ 70%-160% |
| 朗读题目 (TTS) | 部分 (官方 SC IELTS 有) | ❌ |
| 缩放手势对齐 | ✅ | ✅ (未禁用) |
| 离线持久 | ✅ | ✅ localStorage(已做) |
| Auto-submit on time-up | ✅ | ✅ (`MorningQuizTake.tsx:278-283`) |
| 键盘全功能可达 | ✅ | ⚠️ 部分(分隔条好、palette modal 差) |

---

## 整体结论 · iPad 实考就绪度

**就绪度评分: 60%(可以小规模 pilot,不能大规模上线)**

**绿灯项:**
- ✅ viewport meta 合理(允许 zoom 是有意识决定)。
- ✅ 答题主控件(MCQ label、LetterInput、textarea)触摸目标 ≥48px。
- ✅ 离线持久化逻辑健壮(本地 + 服务器双保存,无网降级正常)。
- ✅ Compact A-F bank 按钮明确 44×44 设计。
- ✅ aria-pressed / aria-label 等基础 ARIA 大致到位。
- ✅ Auto-submit on time-up 有,Timer 视觉降级有。

**红灯项 (上线前必须修):**
1. **F2 — DraggableSplit 旋转不响应** [P1, iPad 横竖切换主场景]
2. **F3 — InlineGapInput 高 28px、分隔条 6px** [P1, 触摸不可用]
3. **F9 — 键盘弹出遮挡输入框 + 交卷按钮** [P1, 答题 + 交卷主流程]
4. **F11 — 题号状态仅靠颜色** [P1, WCAG A 强制]
5. **F7 — 100dvh 老 iOS 不兼容 + 边界 1024 双重判断** [P1, iPad 横屏]

**黄灯项 (pilot 后必须修):**
6. F4 — Highlighter 选区时机问题 [P2, 主功能可能丢选]
7. F8 — `sm:grid-cols-13` 可能 silent 失效 [P2, 100 题导航]
8. F13 — Timer aria-live 切换不靠谱 [P2, 屏幕阅读器]
9. F17 — Practice 反馈选项仅颜色 [P2, 色盲]
10. F20 — IELTS 分栏 Tab 顺序 + sticky 列表键盘不可达 [P2]
11. F21 — Palette modal 缺 focus trap [P2]

**额外强烈建议:**
- 加 `beforeunload` 阻止误刷新 — 当前任何键盘误操作都会失去未 flush 的输入(blur 触发保存,但学生没 blur 就刷新 = 丢)。
- 加切屏检测(visibilitychange + blur) — 即使不强行禁,也至少警告。

**测试缺口:**
- ❌ **未在 iPad 实测过任何一条**(代码注释里好几处自称"iPad-friendly"、"≥44px 是 iPad 阈值",但本审查无证据这些被实机验证)。
- ❌ 未做 VoiceOver / NVDA 测试。
- ❌ 未做色盲模拟器扫描。
- ❌ 未跑 axe / Lighthouse a11y 评分。

**建议下一步:**
1. 修 F2/F3/F9/F11/F7 五个 P1 项。
2. 拿一台 iPad 9.7 + 一台 iPad Pro 11 实机跑一遍完整答题流程(横屏 + 竖屏 + 键盘弹出 + 旋转 + 离线 + 提交)。
3. 用 Sim 加 VoiceOver 跑 IELTS Reading 一篇,记录任何"找不到答案输入"的位置。
4. axe-core 跑一遍生产页 build,目标 0 violations / WCAG 2.1 AA。

---

**审查者:** Agent 9
**审查日期:** 2026-05-09
**方法:** 静态代码 review + iOS Safari / Chromium / VoiceOver 行为推断
**未实测:** 任何真机或 emulator 表现
