# 学生端设计系统（2026-09-11）

这是「每日英语」学生端（`apps/student-web`，React / Vite 的 Web / PWA）的设计系统说明。
目标是**借鉴** Apple 的信息层级、导航、适应性和交互质量，不是原生 App，也不宣称
「Apple 认证」或「100% 原生效果」。下面凡是具体的像素、颜色、圆角、断点，都是**本项目的方案**，
不是 Apple 规定的 Web 数值。

## 1. 依据（2026-09-11 用浏览器打开核对过的页面）

| 编号 | 页面 | 本次读到并采用的要点 |
|---|---|---|
| H1 | [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines) | 层级、一致性、适应窗口。 |
| H2 | [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)（已读正文前半） | Liquid Glass 是控件 / 导航的功能层，**不要用在内容层**，且要克制；内容层用标准材质或实色；有大量文字的组件用 regular 变体（会模糊背景以保证可读）。→ 文章、题目、词卡一律实色；只有顶栏 / 标签栏 / 侧栏用轻材质，并有实色回退。我们的 CSS blur **不是** Liquid Glass。 |
| H3 | [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)（页面标注 2026-09-09 更新，已读前半） | 按重要性从上到下排；相关的放一组；**渐进展开**减少首屏内容；区分控件与内容；适应尺寸、方向、多任务窗口。→ 首页旧待办默认收起、按可用宽度收起次要列。 |
| H4 | [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)（未逐段重读，沿用审计提示词的核对） | 清楚的文字层级、少用字体、放大后仍完整；用系统字体，不嵌入系统字体文件。 |
| H5 | [UI Design Dos and Don'ts](https://developer.apple.com/design/tips/)（已读全文） | 控件至少 44×44 pt；文字至少 11 pt；主要内容不需要缩放或横向滚动；足够对比；控件靠近它修改的内容。→ Web 目标：按钮 / 图标命中区 ≥ 44×44 CSS px，辅助文字 ≥ 13 CSS px。 |
| H6 | [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)（已读全文） | 标签栏用于导航不用于动作；切换区块时**保留各自的导航状态**；在各区块间保持可见（模态遮住时除外）；**不要禁用或隐藏标签**，区块为空就说明原因；标签用简短文字；选中建议用填充图标；iPadOS 的标签栏在上方或可转为侧栏。 |
| H7 | [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)（已读前半） | 面板用于和当前上下文紧密相关的有限任务；关闭 / 取消、完成、返回三种按钮语义不同；**同一时间只显示一个面板**；复杂多步流程考虑全屏。 |
| H8 | [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts)（沿用审计提示词的核对） | 简短说明、具体动作名、安全退出。 |
| H9 | [Color](https://developer.apple.com/design/human-interface-guidelines/color) / [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)（沿用） | 语义色一致、适应浅深与高对比。 |
| H10 | [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)（沿用） | 搜索位置按内容定，支持清除。 |
| W1 | [WCAG 2.2 · 1.4.3 对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | 正文 ≥ 4.5:1。16–17px 的按钮字不算大字。 |
| W2 | [WCAG 2.2 · 1.4.11 非文字对比度](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | 识别控件所必需的边界 ≥ 3:1。 |
| W3 | [WCAG 2.2 · 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | 320 CSS px 宽不丢功能、不双向滚动。 |
| W4 | [WAI-ARIA APG · Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | 焦点进入、Tab 不跑到背景、Esc 关闭、关闭后归还焦点。 |

「沿用」= 本次没有重新打开整页，依据审计提示词 §2 在同一天的核对；没读全的页面不声称读全。

## 2. 颜色 token（`src/design/tokens.css`）

颜色只能用语义名。原生调色板类名（`text-slate-400`、`bg-blue-600`…）被
`src/__tests__/design-system.test.ts` 拦截；token 的对比度在同一份测试里按浅深两套**现读现算**。

| token | 用途 | 浅色 | 深色 | 关键对比度（浅 / 深） |
|---|---|---|---|---|
| `canvas` | 页面底 | #f2f2f7 | #0e0e11 | — |
| `surface` | 内容面：文章、题目、词卡、列表组 | #ffffff | #1c1c1e | — |
| `surface-2` | 内容面里的次级区块 | #f7f7f9 | #232326 | — |
| `fill` / `fill-strong` | 控件填充、分段控件底、标签底 | #e9e9ee / #dedee4 | #2c2c2e / #3a3a3c | — |
| `line` | 分隔线（装饰，不承担识别） | #d8d8de | #38383a | — |
| `control` | 输入框、复选框边界 | #8a8a8e | #7c7c82 | 白底 3.43、页底 3.08 / 内容面 4.10 |
| `ink` | 主要文字 | #1c1c1e | #f5f5f7 | 页底 15.2 / 内容面 15.6 |
| `ink-2` | 次要文字 | #3c3c43 | #d1d1d6 | 白底 10.9 / 11.2 |
| `ink-3` | 辅助文字（日期、说明） | #636366 | #a1a1a8 | 白底 5.99、填充底 4.95 / 填充底 5.43 |
| `ink-4` | 纯装饰符号 | #aeaeb2 | #636366 | 不承载信息，不要求 |
| `accent` | 可操作文字、图标、链接 | #0062cc | #5eaeff | 白底 5.80 / 内容面 7.27 |
| `accent-fill` | 主按钮底（白字） | #0062cc | #1167cc | 白字 5.80 / 5.47 |
| `accent-soft` | 选中底、次按钮底 | #e6effa | #0f2a47 | 主色字其上 5.00 / 6.22 |
| `success` / `warning` / `danger` | 状态文字 | #1a7f37 / #955800 / #c4261d | #4cc36b / #ffb340 / #ff7066 | 各自浅底 ≥ 4.5 |
| `*-soft` | 状态浅底 | … | … | 同上 |
| `danger-fill` / `success-fill` | 实色状态按钮底（白字） | #c4261d / #1a7f37 | #c9362b / #1e7a38 | 白字 5.77 / 5.19、5.08 / 5.39 |
| `highlight` | 文章划线底 | #fef08a | #6e5c12 | 主文字其上 14.6 / 6.02 |
| `inverse` | 反色提示条 | #1c1c1e | #f2f2f7 | ≥ 15 |

为什么主色不用 #007aff：白字配它只有 4.02:1，按钮字达不到 4.5:1。这是具体字 / 底组合的问题，
不是「Apple 蓝不能用」。

状态不能只靠颜色：完成 / 失败 / 待批一律同时给文字，完成与错误再配图形（`Badge`）。

## 3. 形状、间距、字号

- 间距序列 4 / 8 / 12 / 16 / 24 / 32（Tailwind 1 / 2 / 3 / 4 / 6 / 8）；页边距手机 16、≥768px 24（`--page-x`，并与安全区取大）。
- 圆角：控件 12（`rounded-control`）、内容分组 16（`rounded-group`）、临时面板 22（`rounded-sheet`）。
- 阴影只给浮层（`shadow-overlay`）；内容面不叠阴影、不模糊。
- 字号全部 rem（跟随浏览器文字大小与缩放），不等于原生 Dynamic Type：
  `caption` 13 · `footnote` 14 · `callout` 15 · `body` 17 · `reading` 18（行高 1.75）· `title3` 20 · `title2` 24 · `title1` 28 · `large` 32。
- 文章行宽从 68ch 起（`.reading-prose`）；宽屏双栏各自滚动。

## 4. 外壳与导航（IOS-01）

| 可用宽度 | 顶层导航 |
|---|---|
| < 768px（手机） | 底部标签栏，图标 + 文字，停在安全区之上 |
| 768–1023px（iPad 竖屏、分屏） | 左侧窄栏，图标在上文字在下 |
| ≥ 1024px（iPad 横屏、桌面） | 左侧栏，图标与文字并排 |

四个目的地固定：**今日 / 我的单词 / 学习记录 / 账号**。暂停的错题本不占位置（从学习记录里进，页面只有一段「暂未开放」说明）。

- 每个 tab 记住上次停的页面（含查询串）与滚动位置；点已选中的 tab 回根页。只在内存，换账号清空。
- 阅读、学词、正式词测、今日总结是**专注任务**：没有标签栏，顶栏（`FocusHeader`）固定显示返回目标、
  任务原日期、实际难度、保存 / 提交状态；主操作条固定在底部（`FocusLayout` 的 `footer`）。
- 返回永远在顶部，不在长页面底部。

## 5. 组件（`src/design/`）

| 组件 | 什么时候用 | 规矩 |
|---|---|---|
| `Page` | 顶层目的地和它的子页 | 大标题 + 可选副标题 / 右侧动作；返回放标题上方 |
| `FocusLayout` + `FocusHeader` | 专注任务 | 见上 |
| `Section` / `Group` / `Row` / `RowButton` / `RowLink` | 设置、记录、列表 | 行高 ≥ 52px，整行一个命中区，进下一层才有 chevron |
| `Surface` | 内容卡片 | 实色，16 圆角，不叠阴影 |
| `Button` | 动作 | 一屏一个 `primary`；次动作 `secondary` / `neutral` / `plain`；删除类 `destructive`。按钮写具体动作名，`busy` 时改成「正在交卷…」 |
| `IconButton` | 纯图标动作 | 必须有 `label`（读屏名字），命中区 44×44 |
| `Segmented` | 原文 / 题目切换（`tabs` 语义）、筛选值（`toggle` 语义） | 选中项实色面 + 加粗 |
| `Badge` | 状态 | 永远带文字 |
| `Dialog`（`placement="center"`） | 确认交卷、离开提醒 | 错误显示在窗内；忙碌时不能关；动作名具体 |
| `Dialog`（`placement="sheet"`，可带 `anchor`） | 查词、筛选、自助抽查表单 | 手机从底部升起，iPad 贴近触发点或居中；一次只开一个 |
| `StatusView` | 整块区域：加载 / 错误 / 断网 / 会话过期 / 空态 / 暂停 | 12 秒后换成「还在加载」并给出路；不留点了没用的重试 |
| `InlineStatus` | 一块模块局部失败 / 提醒 | 只影响这一块，别的照常可用 |
| `useToast` | 「已加入 · 撤销」这类就地反馈 | 一次一条；带撤销的多留一会儿 |
| `Icon` | 所有图标 | 本项目自绘；装饰性图标 `aria-hidden` |

## 6. 文案

- 说清发生了什么、有没有保存、下一步做什么。「交卷没成功，你的答案都在，重试一次。」
- 不把错误码、堆栈或一个空「出错了」给学生。
- 待批就写「已交卷，待老师批」，不写 0 分、不写「未完成」。
- 按钮不写「确定」。写「确认交卷」「继续答题」「重试保存」。

## 7. 响应式与验证

- 布局看**可用宽度**；组件内部用 `flex-wrap` + 基准宽度自然折行，不写死列数。
- 不许用根上的 `overflow-x: hidden / clip` 掩盖溢出（守卫测试断言）。
- 截图矩阵：`apps/student-web/dev-fixtures/shoot.mjs`，页面 × 场景 × 10 个视口（320 … 1366）× 浅 / 深，
  同时量横向溢出与 < 44px 命中区。**这是 Chromium 视口模拟，不是 Safari 真机**；真机、PWA 安装、
  软键盘与 VoiceOver 结果单独记，没测的写「真机待验」。
