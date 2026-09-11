# 给 Claude 的实施提示词：每日英语 App 全量审计整改与 iOS / iPadOS 体验重造

> 用户交办：把本文件作为完整实施任务执行，不要只写计划或再交一份审计报告。修复前两轮审计问题，并依据下列已核实的官方资料重新设计学生端与相关教师工作流。已有功能与真实学生数据必须保留。
>
> 仓库：`C:/Users/yaoke/Projects/exam-paper-system`。本文件于 2026-09-11 编制；原审计基线为 `471b3fb`、`a96268c`，编制期间最新看到 `66eec47`。这些是定位线索，不代表你接手时的最新提交或生产版本。
>
> 本文件包含：用户要求、官方设计依据、逐页改造规范、两轮审计的完整去重清单、原审计结果与限制、执行顺序、验收矩阵。不要只挑 UI 做，也不要以安全修复为由取消 UI 重造。

## 0. 先建立边界，再直接实施

1. 先阅读仓库 `CLAUDE.md`、`docs/HANDOFF-TO-CLAUDE-2026-09-03.md` 的后续决定，以及本文件全文。旧文档中“学生端尚不存在”“只有测试账号”“固定线性七步”等是历史，不能覆盖当前产品。
2. 核对当前分支、HEAD、工作树与正在进行的其他工作。编制期间其他工作刚提交了第三周内容及发布性能优化，曾修改 `prepare-pilot-week.js`；不得覆盖、回退或冒领这些修改。重新定位文中行号，先复现再改；已修复项以新证据关闭，不要重复实现。
3. 在现有 React / Vite / NestJS / Prisma 项目内实施。不重写成原生 Swift App，不新建“词汇 V3”，不再形成另一套独立账户、词汇库、任务或去重系统。不为风格改造迁移托管平台。
4. 本任务允许本地实现、补测试和准备数据修复方案；生产部署、push、生产迁移、历史成绩修订或批量数据变更，必须遵守当前会话明确授权。旧对话中的“确认上线”不自动成为这次修改的生产授权。
5. 不调用 Anthropic 付费 API，不擅自开通付费模型、订阅或翻译供应商。代码里的收费 AI grader 不得因为“完善判分”被启动。API 密钥只在服务器使用，不写前端、文档、日志或截图。
6. 对生产的调查先只读、最小化、优先聚合。需要修复真实数据时，先给出 dry-run、具体受影响记录范围、备份/恢复和审计方案，再执行获批操作。不借“修 bug”清空学生学习记录。
7. 创建一份按本文件 ID 追踪的整改台账：待复现 / 已确认 / 已修复待验证 / 已验证 / 已有修复 / 需要明确决定 / 外部阻塞。每项关联代码与测试。阶段性汇报可以简短，但不能把未完成的项隐藏。

## 1. 用户已经确定的产品规则：不得退回旧方案

- 学生自行注册、选择实际班级；不需要班级码，也不在班级旁显示“这个班对应什么难度”。班级和难度独立。
- 五档难度必须保留，学生自己选、系统记住、设置里可调整。开始过的任务按当时冻结难度继续；修改当前难度不能重新计算过去的任务归属或成绩。
- 学生可独立进入阅读、每日学词和正式单词测试，不强迫先做阅读才准学词。首页主推荐可以有先后，但导航不能强制串行。
- 每日新词和学生在阅读中主动加入的词进入同一个“我的单词”数据体系。保留已经存在的主动搜索加入、老师布置来源；来源可解释、可筛选，不另建平行词汇产品。
- 现行每日默认10词；优先当天有效老师词表，否则按学生档位从NGSL/NAWL选取。阅读中主动加入是额外自愿收词，不自动混入每日新词包；不要因统一词库而擅自改变这个来源边界。
- 查词不是自动收藏。只查一下不改变收藏和掌握状态；加入、已会、稍后处理分别按学生明确选择执行。不能将学生传来的释义自动升级为共享教材。
- 学词页面只负责教学，显示可靠释义、短例句和中文；不要在教学阶段夹进正式考题，也不要显示没有内容的词族/搭配/记忆提示空卡。
- “我会了，换一个”要一对一替换，原词被正确标会；普通新词推送按规范化拼写跨来源去重，排除已见、已学、已会、已移出、已安排的词。老师只有明确强制布置时才是例外。
- 保留最新 2026-09-10 已批准设计：学完后可“背一背”，正式词测包含当天实际学完的新词，加最多 3 个符合条件的旧词抽查。旧词不足时不硬凑。不能用更早的“严格只考当天词”覆盖这个后续决定。
- 学完自动形成按日期保留的正式测试待办；不出现“今天才能考 / 明天才能考”的限制。当天应完成，没做就保留，第二天仍有当天任务和旧待办。不能第二天覆盖，也不能强制等待倒计时。
- 被换掉、明确延后的词不进入当天“实际学完的新词”测试集合。回看教学卡、背一背不能重复增加学习量或创建另一份正式卷。
- 不新增系统强制复习队列、FSRS 待办、强制错词重测。内部掌握度可用于既有抽查规则，但不能重新变成学生负担。
- 自助抽查：从生词本随机取用户指定数量，数量不足要说清楚；仅个人练习，不进入正式成绩、教师每日完成度或系统待办，不永久保留练习记录。临时运行状态要有清理和可恢复设计。
- 学生可将词移出生词本，表示已会；保留必要历史、去重和正式成绩。恢复成员关系与真正“重新学习”必须命名准确，不能因此重复算新词。
- 错题本继续暂停，仅保留低干扰的“暂未开放”说明，不继续开发错题功能、不计入每日完成度。
- 阅读、阅读结束页、历史答卷共享一致的信息与题型展示规则；iPad 宽屏左文章右题目，窄屏可切换，回顾只是只读和解释层不同。顶部显示任务实际难度，保持无倒计时。
- 教师应能准确查看账号、班级、难度、阅读与词汇学习/正式测试的当日和累计记录、按日期欠账、待批、成绩。待批不是零分；取消、未分配、入班前任务不能当欠交。
- 现行聊天判分决定是：用户明确说“判分”时，通过已有安全导出→对话判分→审核写回流程发布，不额外恢复旧的“每次再确认发布”步骤。但本文件的整改任务不是现在让你批改真实答卷，也不授权修改既有成绩。
- 保留已上线的写作自查、发音、提醒等功能；缺配置时明确可用性，不为美化移除有效功能。安装、二维码和通知只能指向已核实正式入口，不能把 staging 发给学生。

## 2. 官方设计依据：必须实际阅读，不得编造“苹果规定”

本项目是跨平台 Web / PWA，不是 UIKit / SwiftUI 原生应用。目标是借鉴 Apple 的信息层级、导航、适应性和交互质量，不宣称“Apple 认证”“100% 原生效果”或 App Store 合规认证。原生 API、Dynamic Type、pt 和 Web CSS 不可直接等同。

以下资料由本次编制实际查阅，日期 2026-09-11。实施时若官方页更新，记录你采用的页面与核对日期；只读到搜索片段时不得声称完整阅读。必要时用浏览器打开官方页面。

| 编号 | 官方来源及本次核实要点 | 本项目如何使用 |
| --- | --- | --- |
| H1 | [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)：层级、协调、一致性，平台惯例与窗口适应。 | 作为设计方向，不把“多圆角、多阴影”当完成标准。 |
| H2 | [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)：Liquid Glass 用于导航/控件的功能层，避免放进内容层，且需克制使用。标准材质与 Liquid Glass 不同。 | 长文章、题目和词卡优先稳定实色底；只有必要导航/临时浮层可用轻材质。当前 CSS blur 不是原生 Liquid Glass；不能说 Apple 禁止一切半透明内容。 |
| H3 | [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)：适应方向与窗口变化，尊重安全区，iPad 可调整窗口；宽度不足时逐步收起次要列。 | 按可用容器宽度布局，测 iPad 分屏/窄窗、横竖屏和键盘，不只认设备型号。 |
| H4 | [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)：清楚的文字层级、减少字体种类、放大后保持可读与完整；采用系统字体，不把系统字体文件嵌入项目。 | Web 使用 system font stack、相对字号和放大测试；不声称设置了 font-family 就实现了原生 Dynamic Type。 |
| H5 | [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) 与 [UI Design Dos and Don’ts](https://developer.apple.com/design/tips/)：可读、足够对比、触控友好；后者建议至少 44×44 points 的触控目标。 | 本项目采用至少 44×44 CSS px 的按钮/图标命中区作为 Web 实施目标，并验证缩放与触控。不是把原生 point 直接换算成 CSS pt，也不是声称所有正文词链接必须铺成 44px 方块。 |
| H6 | [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)：用于顶层导航，不是动作按钮；切换区块应保留导航状态。 | 手机稳定四个顶层目的地；“交卷”“开始测试”不是 tab。专注任务可进入清楚的独立任务外壳。 |
| H7 | [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)：用于当前上下文的有限任务、清楚区分关闭/取消/完成/返回，避免层层叠 sheet。 | 查词/筛选为轻量临时面板；iPad 可采用锚定浮层或居中表单，不机械放大手机底部抽屉。 |
| H8 | [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts)：简短说明发生什么、明确动作名、提供安全退出。 | “重试保存”“继续答题”“确认交卷”代替含糊“确定”；错误必须出现在用户正操作的层。 |
| H9 | [Color](https://developer.apple.com/design/human-interface-guidelines/color) 与 [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)：颜色语义一致，适应浅/深及对比需求，不能仅硬抄某版系统色数值。 | 语义色变量与浅/深主题；成功/失败同时给图形及文字，禁用不能只把字变得几乎看不见。 |
| H10 | [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)：搜索位置取决于内容与导航；支持明确范围与清除。 | 生词本搜索和筛选稳定可达，位置按本项目任务选，不宣称 Apple 规定所有搜索框必须在顶部。 |

Web 实现另采用下列公开无障碍依据，不能冒充 HIG 原文：

- [WCAG 2.2 文字对比度说明](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)：普通文字至少 4.5:1；符合其定义的大文字至少 3:1。不要把所有加粗小字当大文字。
- [非文字对比度](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)：用于识别控件和状态的必要视觉信息通常需与相邻色达到 3:1；不是要求所有装饰分隔线都达到此值。
- [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)：一般纵向内容在 320 CSS px 宽等效视口下仍能使用，不要求双向滚动；确需二维呈现的表格/图等有边界例外。
- [WAI-ARIA 模态对话框模式](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)：开窗后焦点进入，Tab 不跑到背景，Esc 可关闭，关闭后合理归还焦点，名称和模态语义准确。

以下所有颜色、圆角、间距、列宽、断点和动效时长，若未明确标为官方建议，都是本项目方案；允许基于实际截图修正，但要保持系统一致并记录理由。

## 3. 本次 iOS 设计核查：已有基础与确切缺口

已有基础应保留：系统字体栈、部分 44px 触控区、可见焦点、减弱动画、安全区、阅读宽屏分栏和手机原文/题目切换。不要说当前项目完全没有 iOS 适配。

- `apps/student-web/src/index.css` 的 `.app-glass` 对所有 Card 使用半透明、20px blur、较大阴影；正文与功能层区别不清。它不是原生 Liquid Glass。改为区分 page / content / raised / overlay / navigation，不统一涂玻璃。
- `color-scheme: light`、散落的固定蓝/白/灰、少量变量不足以形成浅深主题和状态体系。基于 CSS 声明值计算，白字配 `#007aff` 对比约 4.017:1，hover `#087ff5` 约 3.915:1；现有 16–17px 按钮字不属于 WCAG 大文字，不能满足 4.5:1。这是具体文字/底色组合问题，不是“Apple 蓝不能用”。参考 `#0062cc` 配白字约 5.803:1，但最终颜色由项目语义 token 与实测决定。
- `ui.tsx` 在 640–767px 宽时仍可能用 `max-w-md` 容器，而 `VocabularyCoach.tsx` 的筛选行已在 sm 断点启用 `1fr 220px 220px`。扣除页/卡片内边距后固定两列就装不下。必须按容器折行；不得用根级 `overflow-x: clip` 隐藏被裁掉的控件假装无溢出。
- 首页完整展开旧待办，今日三项任务与常用导航在其后。前轮用 Chrome 390×844、1024×768 视口检查，五条旧待办已明显挤占首屏。此证据是浏览器尺寸模拟，不是 Safari 真机验收。
- 常用导航、返回、按钮和页头多在各页独立实现；阅读与结果虽部分共用，但仍是不同题型展示链，不能只说“都有分栏所以一致”。
- 部分小号浅色标签、随意多层卡片、大蓝色横条按钮与固定宽度没有统一语义；需要逐页看实际使用效果，不是全站统一加 padding 即结束。

## 4. 这次要实现的设计系统与页面规范

### IOS-01：统一外壳与导航

- 学生主区四个固定目的地：今日 / 我的单词 / 学习记录 / 账号。名称可轻微优化，但所有页面保持同一套，不加入暂停的错题 tab。
- 手机用带图标和文字的底部顶层导航；iPad 足够宽时可转换为紧凑侧栏或宽屏导航。选择一种实现并保持状态、返回路径、选中标记一致，不要求复制原生悬浮玻璃效果。
- 阅读与正式词测采用专注任务外壳，保留“回到哪里”、任务日期、实际难度、保存/提交状态；不是随机在普通子页隐藏导航。
- 返回尽量回来源目的地，并保持筛选/列表/阅读滚动位置。离开未保存工作必须能保存或明确提醒。返回按钮不能只在长页面底部。
- 图标统一采用项目可合法使用的 SVG 图标集；不要使用 emoji/随意 Unicode 拼出混杂导航。装饰图标 aria-hidden，纯图标按钮具备准确名称。

### IOS-02：视觉 token 与层级

- 建立背景、内容面、浮层面、主/次/辅助文字、分隔线、交互色、成功/提醒/错误/焦点/禁用等语义变量；完成浅色与深色，不只深色翻转背景。
- 先做清楚的实色长文本界面；玻璃只在有必要的导航/临时层克制使用。`backdrop-filter` 不支持或用户需要减少透明时，实色回退仍可读。
- 项目建议间距序列 4/8/12/16/24/32 CSS px；手机页面边距约 16px、宽屏约 24px，最终依截图与安全区校正。
- 项目建议控件圆角 10–14px、内容分组 14–18px、临时面板 20–24px；不要所有组件一律 22px，不叠重阴影制造“高级感”。
- 品牌标识低干扰，保留学校识别；阅读文章不是宣传海报。主色表达可操作，不与普通标题、失败和待完成混用。
- 去掉无必要整屏渐变和每颗按钮的大阴影。文字、留白、分隔和明确状态承担主要层级。

### IOS-03：字体、触控与可访问性

- 使用系统字体栈（Apple 设备走系统中文/西文字体，Android 有合理 fallback），不下载打包 SF 字体。
- 项目初始值：正文约 17 CSS px；阅读正文约 18px、行高约 1.65–1.8；辅助信息约 13–15px；页标题约 28–32px。以 rem/可调整文本设置实现，并验证放大；这些不是 Apple 规定的 Web 像素值。
- 正文不得挤成整屏超长行，也不能宽屏仍一条窄列。阅读每列可从约 60–75ch 的可读行宽开始调整，双栏充分利用空间。
- 按钮和图标操作实际命中区至少 44×44 CSS px，不只给内部图片设尺寸；主要表单控件可 48–52px 高。段控件、分栏拖柄、关闭按钮都要检查。
- 所有文字组合实测对比度，包含 hover/selected/focus/error 和两种主题；状态不可只靠红绿区分。
- 放大 200% 仍可读可操作；320px 等效窄屏不丢主要功能；不要以 `overflow:hidden`、截断必要文字或禁用浏览器缩放规避问题。
- 保持可见焦点、合理标题层级/label、VoiceOver 名称、键盘顺序。减少动画有效；字体放大不导致按钮字被裁切。

### IOS-04：首页按学生任务重排

- 页头显示日期和清楚的身份/当前档位入口，不用整段规则占首屏。
- 今日阅读、每日新词、正式词测三项是主体，各有状态、实际进度和直接动作。可以显示尚未生成测试及生成条件，但不能用 2/2 暗示词测已完成。
- 旧待办按日期分组，显示阅读/新词/测试分别欠多少；默认有限展开，提供“查看全部待办”。不无限铺在今日任务之前。没有截止强锁，不阻止先做今天。
- 全做完才显示真实完成总结。待批显示“已交卷，待老师批”，不是未做或 0 分；全部延后不叫学完。
- 加载失败、无排课、无需测试、周末、没有旧待办、未选档位分别呈现，不把未知当零。下游出错不能吞掉所有任务。
- 暂停错题只留一处低干扰说明，或放功能说明中，不占每日主任务的一席。

### IOS-05：阅读、结果、历史使用同一阅读工作区

- 提取可复用外壳、文章面板、题目结构、题号导航、字号和状态组件。答题 / 已交待批 / 已发布历史通过模式改变编辑能力、答案与解释，不另画三套题型。
- iPad 横屏/桌面：左文章、右题目，各自合理滚动，顶部元信息和底部必要操作可达；允许调整分栏且可键盘操作。窄窗先收起辅助控件，再转原文/题目切换。
- 手机：原文/题目切换稳定保留位置和输入；键盘弹出时当前输入及必要操作可见。不要高亮、查词、滚动和分栏手势互相抢事件。
- 返回、原日期、实际档位、保存状态清楚；无倒计时。结果不按新一天/当前档位重新定位。
- 已交待批的客观分、主观待批、总分未发布各自清楚；已发布回顾对应学生当时的题面、选项和答案。

### IOS-06：查词面板

- 手机可用底部面板，iPad 可用靠近点击词的浮层或稳定侧面板；不遮住全部原文。扩展面板只为查看完整内容，不强迫额外确认页。
- 词形、词性、核心中文为第一层；一个短例句及中文为第二层；更多可靠义项/搭配按需展开，无数据整块隐藏。
- 发音控件有播放/加载/失败反馈。查词失败和例句翻译失败分别可重试，不把报错文本当译文。
- 只查不入本；加入后就地显示“已加入”及可撤销行为。动作绑定当前显示的词条，不绑定另一个正在编辑的搜索字符串。
- 关闭/返回/取消语义清楚、触控可达，不叠第二个空面板。焦点、底部安全区、键盘和滚动边界通过测试。

### IOS-07：学词、背一背、正式词测

- 一屏教清一个词：英文、发音、词性、核心中文、短例句与中文；可靠扩展信息可展开，无内容不显示占位四宫格。
- “学完这个词”为明确主动作，“已会换一个”“稍后再学”为次动作；反馈说明发生了什么及数量是否变化。
- 进度区区分处理数、实际学完数、延后数；不能将翻过/跳过等同学会。完成后显示按日期形成的测试待办。
- 背一背可从对应待测任务再次打开，不计新学习量、不重建测试。无需强制等待或新增强制复习。
- 正式测试清楚标注日期、新词数、旧词抽查数和总题数；每一题能知道考什么，不用生僻干扰项凑数。正误反馈符合现行规则，不泄露未作答题答案。
- 回顾支持原日期定位、稳定返回；已保存未交卷和已交卷清楚区分。误触处理有明确规则，不以隐藏状态让学生猜。

### IOS-08：我的单词与自助抽查

- “生词列表 / 测试待办 / 已移出”的组织清楚，保留统一入口。搜索不卸载输入框，筛选按实际容器宽度折行，结果数与来源一致。
- 长列表完整可访问，分页/加载更多/合理虚拟列表任选合适方案；返回保留搜索、筛选和位置，不能只能看前 30 个。
- 自助抽查在清楚的小表单里选择范围和数量，展示可抽上限，明确不计正式记录。结束/退出/刷新都有退路和临时数据清理。
- 移出提供确认程度合适的就地反馈/撤销，不误删历史。恢复成员关系写“重新加入”；只有真正打开教学流程才写“重新学习”。

### IOS-09：账号与学习记录

- 账号用清晰分组列表展示姓名、班级、难度、提醒、密码和退出；加载中不是“还没选”。换难度说明生效范围，不承诺代码未做到的历史冻结。
- 阅读历史、正式词测历史按日期和类型组织，保留真实未批/已发布状态；自助练习不要混入。
- 历史详情使用 IOS-05 工作区；顶部直接返回，不要求从长页面底部找出口。
- 改密码失败不清草稿/登出有效会话，换账号时又不能泄露上一人的内容。安全与恢复两项同时满足。

### IOS-10：教师工作台

- 教师桌面优先密度和准确性，不把整张表变成手机大卡片。平板可用，窄屏逐层收起次要列；表头、学生标识、筛选和主要动作稳定可达。
- 统一账号总数、任务分配、欠交、学习量、生词本数量、正式词测和待批口径；每个汇总能追到按日期的明细。
- 待批 / 批改中 / 已评分待发布 / 已发布明确区分。保存状态按题显示，保护未保存输入；发布前检查全部脏数据。
- 不展示必然被 API 拒绝的操作；已取消/不属于该生的任务不催交；五档名称和词表数量规则与学生端一致。

### IOS-11：加载、错误、空态与对话框

- 统一有限等待、重试、取消/返回、无数据、无权限、网络中断、会话过期和服务器故障的状态组件。不能剩一个永远无效的“重试”。
- 列表刷新保留输入与已有数据，局部加载不整页闪白；丢弃过期响应，避免旧结果覆盖新选择。
- 模态框的错误在框内；焦点进入/限制/归还、Esc、关闭按钮、屏幕阅读器名称完整；无未保存内容时退出顺畅，有未保存内容时明确选择。
- 提示短而具体：发生什么、是否保存、下一步是什么。不要把服务端错误码、堆栈或空“出错了”直接抛给学生。

### IOS-12：响应式与性能验收不是截图装饰

- 按实际可用宽度/高度，而非仅 `iPad` 名称，决定布局；至少验证 320、390、430、640、744、768、820、1024、1366px 宽及相应高度。
- 验证 iPad 竖屏、横屏、窄窗/分屏；iPhone Safari/PWA 安全区；Android Chrome；软键盘出现/收起；放大字体；后台恢复。
- 不把 Chrome 改视口称为 Safari 真机通过。条件不足就明确写“真机待验”，不能报完全完成。
- 长文章、100/1000 词列表、多周待办、长学生姓名和长中文翻译都有固定测试数据。检查无裁切、误滚、意外失焦、输入丢失。
- 减少大面积 blur 和多层 shadow，选择本机可测的页面性能预算并记录结果；不宣称未测设备上的 60fps 或 API 延迟。

## 5. 两轮审计整改台账（后续各节均属于本任务，不得遗漏）

证据类型：L＝线上只读检查；M＝真实代码配模拟数据/组件复现；C＝代码路径确认；D＝设计改进；O＝运行保障或待验证项。M/C 不等于真实学生已经受影响。严重度用于排序，不替代复核。

所有源文件行号是审计时定位线索，后续提交会移动；请用方法名重新定位。每项须在最终台账给出对应测试及结论。

### 5.1 安全与身份（S01–S08）

#### S01 · P1 · 未提交答卷接口包含答案快照【M/C】

旧 `getOwnSubmission` 脱敏删除部分字段后展开 `...rest`，保留 `snapshotAnswer`，学生可在答题时拿到答案/评分规则。采用按答题状态的响应字段白名单，检查新旧答题、恢复和详情接口，不只补删一个字段。

- 定位：[student.service.ts:884](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/student/student.service.ts:884)、[student.controller.ts:73](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/student/student.controller.ts:73)。
- 验收：在各题型答案、rubric、快照内放入唯一测试标记；学生未交卷的所有响应递归搜索均无标记。他人答卷拒绝访问，已发布历史按规则展示。正式词测同类问题另见 VOC04。

#### S02 · P1 · 旧历史接口把姓名当授权凭据【C/L】

`history-by-name` / `history-detail` 允许无令牌进入按姓名查询的业务路径。线上只用虚构姓名/编号观察到业务 404，未读取真实学生隐私。取消匿名姓名回退，以验证后的学生身份校验归属；教师走有班级权限的读取接口。

- 定位：[morning-quiz.controller.ts:620](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/morning-quiz/morning-quiz.controller.ts:620)、[同文件:663](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/morning-quiz/morning-quiz.controller.ts:663)。
- 验收：无令牌在查询学生前统一拒绝；学生 A 输入 B 的姓名/编号仍不能读取 B，错误响应不提供候选、班级或成绩。不要用真实姓名继续探测漏洞。

#### S03 · P1 · 旧接口绕过令牌撤销和教师视角写保护【C】

旧 `AuthGuard` 验签后的学生路径未统一核对当前启用/归档状态、`studentAuthVersion` 和 `teacher_view` 只读范围；旧开卷、保存、提交只检查角色。统一新旧身份生命周期，而非只保护新 UI 调用的接口。

- 定位：[auth.guard.ts:62](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/common/auth.guard.ts:62)、[student.controller.ts:47](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/student/student.controller.ts:47)。
- 验收：重置密码、撤销、停用、归档后旧令牌在新旧接口均失效；教师视角所有写操作拒绝且零写库；正常学生及限场次 `mq_handoff` 不受误伤。合法只读边界见 S08。

#### S04 · P1 · 后台“停用”与学生真实登录状态脱节【M/C】

RBAC 停用只改 `passwordHash` 前缀，而学生认证使用 `pinHash`；`isActive` 和认证版本未同步，可能后台已停用而仍可登录。用真正账户字段和统一撤销机制处理。

- 定位：[admin-rbac.service.ts:175](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/admin-rbac/admin-rbac.service.ts:175)、[student-auth.service.ts:96](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/student-auth/student-auth.service.ts:96)。
- 验收：停用后数据库、列表、新登录、现有会话全部一致；恢复启用不复活已撤销令牌；保留防止管理员自我停用及操作审计。

#### S05 · P1 · 运维判分入口缺少正式业务约束【M/C】

持有效运维凭据时，`applyGrade()` 不充分校验班级归属、状态、题型和认领，并用最早管理员作为判分人；返回 `marked` 可能与实际状态不一致。内存复现可对其他班级、答题中客观题进入写分路径。复用正式判分服务或完整同等约束，记录真实授权操作人。

- 定位：[server.js:365](C:/Users/yaoke/Projects/exam-paper-system/apps/ops-dashboard/server.js:365)、[同文件:401](C:/Users/yaoke/Projects/exam-paper-system/apps/ops-dashboard/server.js:401)。
- 验收：未授权班级、草稿、错误题型、不可改已发布答卷拒绝且零写入；返回状态真实；重试和并发不重复累加/覆盖；总分与有效明细一致。缺少访问 key 时生产应拒绝启动或拒绝访问。
- 边界：线上无 key 请求已返回 401，不是“线上裸奔”；当前顺序重复加分未复现，不能当事实。部署元信息未能证明运维服务正在运行该源码版本，需重新核对。

#### S06 · P2 · 按用户限流实际共享校园 IP【M/C】

全局限流早于认证运行，且只读 `req.user` 而新版使用 `req.studentAuth`，导致已声明 user scope 的请求落到 IP 桶。两学生同 IP 的模拟中 B 被 A 的配额牵连返回 429。

- 定位：[app.module.ts:145](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/app.module.ts:145)、[rate-limit.guard.ts:72](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/common/rate-limit.guard.ts:72)。
- 验收：真实守卫顺序下 A 用尽配额不影响 B；A 换 IP 不能绕开用户额度；匿名暴力请求仍受合理 IP 防护。不从未验签 JWT 直接信任用户 ID。

#### S07 · P2 · 同名登录分支未触发失败锁定【M/C】

多个同名候选时只增加失败计数，未复用正常单账号分支的锁定。模拟 7 次失败仍无锁定时间。共用原子失败计数/锁定逻辑，保留先验密码再展示候选的隐私保护。

- 定位：[student-auth.service.ts:133](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/student-auth/student-auth.service.ts:133)、[pin.ts:8](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/student-auth/pin.ts:8)。
- 验收：按当前配置的 5 次失败/15 分钟锁定测试单人和同名分支、并发尝试及解锁；无正确密码不能枚举班级候选。

#### S08 · P2 · 教师只读学生视角又被过度拦截【C】

`@RequireStudentToken()` 同时表达必须认证和拒绝教师视角，使 profile/overview/center/tests 等 GET 也被拒绝。分离读取身份与本人写入权限；会隐式生成任务的 GET 必须拆成真正只读查询。

- 定位：[student-identity.guard.ts:193](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/common/student-identity.guard.ts:193)、[vocabulary-v2.controller.ts:27](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.controller.ts:27)。
- 验收：授权教师可查看该生首页、任务、词汇、历史，完整浏览零写库；所有状态改变仍拒绝。与 S03 一起测试，不能一边修一边重新放开写权限。

### 5.2 学生任务与页面逻辑（UI01–UI15）

#### UI01 · P1 · 改当前难度重算历史欠阅读【C】

过去日期按 `user.englishLevel` 重新匹配文章，改档可能让原欠账消失或生成当时未分配的新欠账。以实际分配日期、难度、任务/试卷身份为历史事实；修改设置只影响约定的后续未冻结任务。历史修复不得猜测学生当时的档位。

- 定位：[vocabulary-v2.service.ts:943](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:943)、[教师过滤:255](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:255)、[student-auth.service.ts:622](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/student-auth/student-auth.service.ts:622)。
- 验收：A 档未做/做一半/已完成各一份，改 B 后文章、难度、草稿、状态不变；下次新分配为 B；教师和学生欠账一致。另核对入班日期，不能补生入班前任务。

#### UI02 · P2 · 查词结果按钮操作了另一个输入词【M/C】

查出 apple 后把输入改 banana，卡片仍是 apple，而动作读取输入框，操作 banana。按钮必须绑定当前显示结果的稳定身份；查询改动/过期时清楚禁用或更新结果。

- 定位：[VocabularyCoach.tsx:58](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/VocabularyCoach.tsx:58)。
- 验收：查询后改输入、不查询即点加入/已会/稍后，不能改错对象；慢查询返回、切词、重复点击也不串词。

#### UI03 · P2 · 生词本只有前 30 项，无后续入口【C】

服务默认分页而页面未接通，学生无法查看全部单词。完整实现分页/加载更多与总数、筛选、移出后的边界行为。

- 定位：[vocabulary-v2.service.ts:386](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:386)、[VocabularyCoach.tsx:162](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/VocabularyCoach.tsx:162)。
- 验收：31/65/500 词全部可达、跨页不漏不重，筛选后总数准确，移出末页最后一项不会困在空页。不仅增大默认 limit。

#### UI04 · P2 · 搜索每个字符导致整页卸载、失焦【M/C】

搜索触发全页 loading，输入节点被卸载。改为保留输入的局部查询、合理防抖和过期响应保护。

- 定位：[VocabularyCoach.tsx:34](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/VocabularyCoach.tsx:34)、[同文件:112](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/VocabularyCoach.tsx:112)。
- 验收：连续输入完整词、中文输入法组合、快速清空、慢网时光标与软键盘保持；旧请求不覆盖新条件。

#### UI05 · P1 · 概览失败被吞成“没有待办”【C】

`overview.catch(() => null)` 隐藏欠阅读/词汇/词测相关区域，未知数据被当成零。每个模块独立加载和恢复，区分没有任务与暂未加载。

- 定位：[Today.tsx:189](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Today.tsx:189)、[同文件:281](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Today.tsx:281)。
- 验收：阅读成功而概览 500/超时，阅读可用，词汇显示失败和重试，不得“全部完成”；恢复后各类待办重新出现。

#### UI06 · P2 · 教师档位名称及词数规则过时【C】

教师词表页把 `ielts_simplified` 标为“雅思强化”、`olevel` 标为“O-Level 基础”，且仍强制恰好 12 词。复用统一五档映射；后端当前为 1–20、默认 10，前端必须一致。此项覆盖 T04/T05，不重复开发。

- 定位：[VocabClass.tsx:26](C:/Users/yaoke/Projects/exam-paper-system/apps/web/src/pages/VocabClass.tsx:26)、[同文件:68](C:/Users/yaoke/Projects/exam-paper-system/apps/web/src/pages/VocabClass.tsx:68)、[levels.ts:28](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/lib/levels.ts:28)。
- 验收：`ielts_simplified=O-Level 基础`、`olevel_intermediate=O-Level 中级`、`olevel=O-Level 标准`、`ielts_light=雅思轻量`、`ielts_authentic=雅思 · 真题型`；注册/设置/答题/历史/教师一致。1/10/12/20 合法，0/21/重复给准确提示。

#### UI07 · P1 · 共用设备换账号后推送归属不一致【C/L】

页面按浏览器有订阅即显示启用，而后台订阅可能仍属于前一账号。推送绑定、解绑、失效和展示必须按已认证账号处理，不能把 A 的个人提醒给 B。线上当时 VAPID 已配、订阅数 0；确认的是代码风险，不是已发生泄露。

- 定位：[push.ts:74](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/lib/push.ts:74)、[同文件:127](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/lib/push.ts:127)、[auth-store.ts:85](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/lib/auth-store.ts:85)。
- 验收：A 开提醒→退出→B 登录，B 状态真实且不收 A 个人任务；令牌过期、权限撤销、订阅失效、重绑均正确。不要擅自向真实学生发测试通知。

#### UI08 · P2 · iPad 拖动被取消后仍处于拖动状态【M/C】

分栏处理 touchend 但未正确处理 touchcancel。模拟取消后普通移动仍把比例改到 70% 并拦截滚动。统一指针生命周期、取消、卸载清理和键盘替代；细线不等于小命中区。

- 定位：[DraggableSplit.tsx:104](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/lesson/shared/DraggableSplit.tsx:104)。
- 验收：start→cancel→move 不改变比例；旋转/缩放/双指/背景切换不留下监听器，拖动与页面滚动合理共存；命中区与 IOS-03 一致。

#### UI09 · P1 · 保存偶发失败后无法再交卷【M/C】

保存 500 后 `saveError` 留存，在线健康检查成功不触发补传，交卷又因 saveError 禁用。模拟健康检查成功 8 次仍只保存过 1 次。建立有限自动重试/手动补传、明确本地与服务端保存状态，交卷前可恢复 flush。

- 定位：[ReadingProvider.tsx:375](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/lesson/ReadingProvider.tsx:375)、[Reading.tsx:183](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Reading.tsx:183)、[同文件:456](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Reading.tsx:456)。
- 验收：设备始终在线、首次 500 后服务恢复，不改答案/不切飞行模式也能补传交卷；重复提交不生成重复卷。不能把 HTTP 500 当“服务健康”。

#### UI10 · P1 · 今日总结与旧课程状态冲突【M/C】

首页用 V2 显示完成，总结却按旧 `nextAction` / 旧词测统计，造成首页→总结→首页循环。总结统一读取本次有效阅读、V2 学习与正式词测事实，不强迫旧流程补步骤。

- 定位：[Today.tsx:337](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Today.tsx:337)、[LessonSummary.tsx:147](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/LessonSummary.tsx:147)、[lesson.service.ts:1155](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/lesson/lesson.service.ts:1155)。
- 验收：三项完成能进入并刷新总结；词测成绩来自实际正式卷，待批标记真实；未全部完成时也能查看已做部分而不误报全完。

#### UI11 · P1 · 跨午夜交卷打开了新一天而非刚交结果【M/C】

结果页重新查询 today，而非用刚提交的 submission。以服务器返回的、校验归属后的答卷 ID 定位结果及冻结日期。

- 定位：[Reading.tsx:314](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Reading.tsx:314)、[ReadingResult.tsx:121](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/ReadingResult.tsx:121)。
- 验收：23:59 开始、00:01 交卷；新日无课/有未做任务/另设备已做三种情况，均打开刚交卷结果，不跳首页或另一份成绩。

#### UI12 · P2 · 提交错误在弹窗背后且焦点不受约束【M/C】

错误条 z20 在仍打开的 z40 确认窗后，学生看不见；交卷/退出弹窗缺少完整焦点管理。统一 IOS-11 的模态组件与内部请求状态。

- 定位：[Reading.tsx:445](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Reading.tsx:445)、[同文件:476](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Reading.tsx:476)。
- 验收：交卷 503 在窗内可见并可重试，无重复提交；Tab/Shift+Tab、Esc、初始焦点、关闭归还、屏幕阅读器全部验证。查词和退出也覆盖。

#### UI13 · P1 · 首页“学词”仍强迫先开阅读【M/C】

`ready_to_start` 路径对不同卡片统一执行 `lessonStart` 并跳阅读；`no_content` 又把独立 V2 词任务挡住。入口只启动其对应任务，不依赖另一产品模块是否有内容。

- 定位：[Today.tsx:81](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Today.tsx:81)、[api.ts:570](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/lib/api.ts:570)。
- 验收：首次登录未开始阅读可直接学词；无阅读内容但有每日词也可学、可测；反向先阅读同样自由；点击卡片不会偷偷创建另一任务。

#### UI14 · P2 · 今日“2/2”漏算仍欠着的正式词测【M/C】

首页将阅读+学词当作全部完成，即使有正式词测待办。完成度以三类任务的适用性及真实状态计算，区分尚未生成、不适用、待完成和完成，不能只把分母改成 3。

- 定位：[Today.tsx:330](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Today.tsx:330)。
- 验收：阅读完成+学词完成+待测一份时不报全完；全跳过、不需要测试、旧日待办、只做部分等状态准确。配合 VOC06/VOC08/UI10 验证。

#### UI15 · P1 · 临时认证网络失败导致重登并清本地草稿【M/C】

初始化临时网络失败被当 anonymous，虽还保留 token，却跳登录；同账号重登的 `adoptSession` 随后清 `sw:` 数据，未同步草稿丢失。模拟确认失败时 token/草稿仍在、重登后草稿消失。区别暂不可验证、令牌真正无效、主动换人，按身份隔离草稿。

- 定位：[auth-store.ts:50](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/lib/auth-store.ts:50)、[同文件:85](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/lib/auth-store.ts:85)、[App.tsx:59](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/App.tsx:59)。
- 验收：临时断网、503、超时提供重试，不假登出；同账号恢复保留草稿；真正换到 B 不得展示/提交 A 草稿；撤销令牌不能因离线恢复而继续写入。

### 5.3 词汇学习、内容与测验（VOC01–VOC15）

#### VOC01 · P1 · 学完操作不幂等，并发最后两词可能不结束【M/C】

完成使用旧的 `session.items` 判断剩余，最后两词并发都看到另一个未完成；重复请求还能重复增加 reps。以内层原子状态转换/事务、最新剩余数和唯一正式任务保证一次结算。

- 定位：[vocabulary-v2.service.ts:1269](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:1269)。
- 验收：重复点击、重试、两个标签同时完成最后两词，学习量只增一次、session 完成、只生成一份正式卷；旧回调不能覆盖新进度。线上当周聚合未发现该异常，不等于不存在风险。

#### VOC02 · P1 · 换词存在跨词义重复与候选池耗尽问题【C】

排除主要按 sense，可能同拼写另一词义仍入选；老师词表/有限前 100 候选导致无可替换，而更大等级池仍有词。按规范化 headword 全局排除，采用合理候选顺序和可继续搜索的补足机制。

- 定位：[vocabulary-v2.service.ts:1337](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:1337)。
- 验收：跨每日/阅读/搜索/已会/已移出/其他词义不重复；明确强制布置例外有标记。成功替换保持总数/位置且原词标会；真正耗尽时不先删原词、不虚报成功，解释可选动作。

#### VOC03 · P1 · 选项有两个相同正确释义却只认一个下标【M/C】

选项按词条而非规范化展示释义去重，例如 big/large 都显示“大的”。需排除等价正确释义，并选择词性、难度和目标词义合适的干扰项；选项不足使用可可靠评分的退路，不硬塞乱码或生僻词。

- 定位：[formal-test.ts:32](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/formal-test.ts:32)、[adaptive-test.ts](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/adaptive-test.ts)。
- 验收：重复中文、大小写/空格/标点变体、同义选项、候选不足都不形成双正确；选项展示与服务端判分一致。线上当时重复选项数 0，不把模拟案例描述为真实错误判分。

#### VOC04 · P1 · 正式拼写题通过 audioText 直接送出答案【C】

答题响应包含待拼写的明文目标词，遮住 UI 无法防止查看网络答案。客户端仅获得不泄题的题面/音频标识，服务端保留答案；已交回顾与进行中分清白名单。

- 定位：[formal-test.ts:27](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/formal-test.ts:27)、[vocabulary-v2.service.ts:850](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:850)。
- 验收：进行中 payload 不含 `audioText` 答案、sense 嵌套明文或可直接解码出目标词的链接；普通中译英拼写题继续不提供目标词发音，仅明确的听写题保留不泄露目标词明文的必要音频。只改前端 hidden 不通过。

#### VOC05 · P1 · 普通学生输入可写入共享 ready 教学上下文【C】

collect 接口将客户端内容写成全局 `VocabularyContext` 的 `ready/article_original`，未证明来源与归属；某些 lookup_only 路径也发生内容写入。把个人输入、查词结果与可发布教材分离；可信文章例句必须从服务端已授权文章提取。

- 定位：[vocabulary-v2.service.ts:629](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:629)、[context-progression.ts:20](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/context-progression.ts:20)。
- 验收：学生提供伪释义、整段垃圾例句、他人文章 ID，不污染其他人的教学卡或共享 ready 内容；只查不改变个人收藏/学习状态；合法自加词及可靠上下文仍可用。

#### VOC06 · P2 · 正式卷已 13 题，多个页面仍显示 10【M/C】

部分概览/教师统计从当天学习 target 推算，正式卷却有当天 10 + 最多 3 个旧词。生成后以冻结 items/target 为唯一事实，生成前明确预计与生成条件；保留现行最多 3 旧词规则。

- 定位：[vocabulary-v2.service.ts:295](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:295)、[实际组卷:1460](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:1460)。
- 验收：旧词 0/1/2/3 个时，首页、学完提示、试卷、进度、教师全一致；不硬写每次 13。不能重建学生已开始/已交的旧卷来“修一致”。本项覆盖 T03。

#### VOC07 · P2 · 延后词在多天重复生成未做待办【C】

过滤仅排除部分 skipped/completed 关系，周一延后→周二已安排未做→周三可能再次安排。一个延后词只允许一个有效待处理归属；已安排未完成不能再次分配。

- 定位：[vocabulary-v2.service.ts:1152](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:1152)、[unified-vocabulary-rules.ts:65](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/unified-vocabulary-rules.ts:65)。
- 验收：连续三天、跨周、每日任务并发生成均只有一条有效待处理；学生再次明确延后时按新状态迁移，不复制旧任务、不生成强制复习队列。

#### VOC08 · P1 · 全部延后被标为学完，教师却等一份不存在的考试【C】

10 个全部 skip 时 session completed/completed10，但 learned0，无正式卷；部分教师逻辑仍报待测。区分“已处理、实际学会、延后、需要正式卷”以及学习阶段结束，不统一塞入 completed 文案。

- 定位：[vocabulary-v2.service.ts:1763](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:1763)、[Today.tsx:313](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/Today.tsx:313)。
- 验收：全延后、部分延后、全换词、部分完成，计数不混；0 个实际学完不生成空卷/永久待测；UI 清楚说明仍未学习的词去向，不宣传“已学 10 个”。

#### VOC09 · P2 · 来源标签能显示，来源筛选却查不到【C】

`daily_pushed` 等事件缺 `studentSenseId`，展示经 sense 事件读、筛选却经 owned.events 读，关系不一致。来源定义与查询统一，补历史关系要先做可验证 dry-run。

- 定位：[vocabulary-v2.service.ts:389](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:389)、[事件写入:1231](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:1231)。
- 验收：每日/阅读/搜索/教师来源单独及组合筛选与可见标签、总数一致；原来显示 daily1 而过滤0的模拟样例通过；不得盲目给全部历史词伪造来源。

#### VOC10 · P2 · 自助练习临时状态缺生命周期【C】

开始练习会创建临时数据库 session，退出仅导航、缺清理；提交立即删除，结果路由刷新 404，若响应丢失无法恢复。设计取消/过期清理及短期结果恢复，仍遵守“不永久保留个人练习记录”。

- 定位：[vocabulary-v2.service.ts:528](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:528)、[提交清理:1637](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:1637)、[VocabularyCoachTest.tsx:99](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/VocabularyCoachTest.tsx:99)。
- 验收：开始退出、多次开始、刷新结果、提交响应丢失、过期链接均有正常恢复/退出；临时记录按期清理；不写正式成绩、学习总数、教师完成度或 SRS 复习安排。现有“练习不进正式记录”部分已有效，保留。

#### VOC11 · P2 · 造句判分把 apple apple apple 当正确句子【M/C】

active_use 只检验词数与目标正则，不能声称语法/语义正确。选择可确定评分题型，或如实展示“检测到目标词，未评估句子质量”；不为此擅自启动付费 AI。

- 定位：[adaptive-test.ts:70](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/adaptive-test.ts:70)、[VocabularyCoachTest.tsx:108](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/VocabularyCoachTest.tsx:108)。
- 验收：重复目标词、随机词、仅包含子串不能获“句子正确”；若检查词形，覆盖不规则变化。用户不想要的复杂作文评分不要硬塞进词汇练习。

#### VOC12 · P3 · “背一背”完成后缺稳定回看入口【D/C】

刚学完时会留在“背一背”，但刷新或重新进入已完成学习任务时被送回首页，不能稳定回看当天这批教学卡。保留按任务日期重新打开只读教学/背诵的入口，不增加新词数或重复生成正式卷。

- 定位：[VocabularyCoachLearn.tsx:39](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/VocabularyCoachLearn.tsx:39) 的已完成重定向、[同文件:152](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/VocabularyCoachLearn.tsx:152) 的 `Recite` 组件、[VocabularyCoach.tsx:135](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/VocabularyCoach.tsx:135)。
- 验收：背诵结束、刷新、次日回看，都能看原冻结词；这是一项体验补足，不是声称原批准的一次性背诵实现违反当时需求。

#### VOC13 · P3 · “重新学习”实际只恢复生词本成员关系【D/C】

动作恢复 inNotebook/阶段，却没有开始教学，名称承诺大于行为。若仅恢复集合，改成“重新加入”；如确有可选重学则清楚区分，不把已学旧词计为首次新词。

- 定位：[vocabulary-v2.service.ts:715](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:715)、[VocabularyCoach.tsx:162](C:/Users/yaoke/Projects/exam-paper-system/apps/student-web/src/pages/VocabularyCoach.tsx:162)。
- 验收：移出→重新加入后收藏数正确、历史保留、无强制复习/重复每日新词/重复学习总数；按钮名称与实际发生的事情一致。

#### VOC14 · P2 · 内容生成 running 任务没有失效恢复【C/L】

worker 只领取 queued/failed，进程中断遗留 running 没有 lease 回收。前轮线上见 1 项自 9 月 2 日新加坡时间起长期 running。实现租约、重试上限、退避、幂等产物和可观测失败；避免重试无限付费。

- 定位：[content-producer.ts:420](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/content-producer.ts:420)。
- 验收：领取后模拟崩溃、超时、网络失败与多 worker 竞争，过期任务可恢复且同一版本只发布一次；损坏内容不标 ready。生产具体记录先只读核对是否仍卡住。

#### VOC15 · P2 · Azure 失败时的降级与说明不一致【C】

配置 Azure key 后实际只走 Azure，超时返回 null；代码仅在没 key 时走其他免费路径，并非文档暗示的自动故障切换。明确定义已授权缓存/字典/重试/暂不可用策略，保持诚实反馈。

- 定位：[realtime-translation.service.ts:24](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab/realtime-translation.service.ts:24)。
- 验收：Azure 429/500/超时/无中文/只缺例句译文均有可理解结果和重试；不显示假翻译，不把长整段当每个词例句。增加第三方需先核对隐私、费用与授权，不静默把学生文本送另一供应商。

### 5.4 判分与教师统计（M01–M04、T01–T06）

#### M01 · P1 · 最后一题保存后从待批队列消失但未发布【M/C】

队列只选存在空分数的题，全部逐题保存后卷仍 submitted、claim active，但队列从1变0。保留“已评分待发布”队列和恢复入口，发布才完成状态迁移。

- 定位：[marker.service.ts:98](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/marker/marker.service.ts:98)、[MarkerScript.tsx:244](C:/Users/yaoke/Projects/exam-paper-system/apps/web/src/pages/MarkerScript.tsx:244)。
- 验收：保存最后题后离开、刷新、重登仍可找回发布；发布仅一次、释放认领，学生最终成绩可见。不是物理数据删除，但现有正常入口缺失。

#### M02 · P1 · 保存一题清空其他题未保存输入【M/C】

单题 save 后全量 load 重建编辑状态，丢掉其他题分数/评语，也可能丢掉请求期间新输入；发布使用库中旧值忽略脏数据。保留逐题编辑缓冲与版本，提供保存全部/离开提示，发布前明确处理未保存内容。

- 定位：[MarkerScript.tsx:96](C:/Users/yaoke/Projects/exam-paper-system/apps/web/src/pages/MarkerScript.tsx:96)、[同文件:150](C:/Users/yaoke/Projects/exam-paper-system/apps/web/src/pages/MarkerScript.tsx:150)。
- 验收：第二题输入2分及评语、保存第一题后内容完整；慢网继续打字不丢；有脏数据/保存中不能静默发布旧分数；失败后可恢复。

#### M03 · P2 · 客观题覆写按钮点击必被后端拒绝【M/C】

页面提供 MCQ 手动覆写，正式服务却返回400禁止手判。默认移除不成立的编辑控件并保留只读自动分；若用户另行选择保留纠分，需走授权、审计、版本与总分重算的完整契约，不用旧运维绕过。

- 定位：[MarkerScript.tsx:422](C:/Users/yaoke/Projects/exam-paper-system/apps/web/src/pages/MarkerScript.tsx:422)、[marker.service.ts:319](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/marker/marker.service.ts:319)。
- 验收：页面不存在“可以编辑却永远保存不了”的假功能；任何合法纠分有真实权限和学生历史/后台一致的结果，越界/无权限仍拒绝。

#### M04 · P2 · 待批队列前20份之外没有翻页入口【C；本轮汇总补充确认】

服务默认20而页面无翻页；前20份都被认领时仍可能挡住后续可处理答卷。接通分页、总数、认领和阶段筛选，不仅提高 limit。

- 定位：[MarkerQueue.tsx:31](C:/Users/yaoke/Projects/exam-paper-system/apps/web/src/pages/MarkerQueue.tsx:31)、[marker.service.ts:89](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/marker/marker.service.ts:89)。
- 验收：45份三页可达、不重不漏；前20锁定仍能访问后续可认领卷，保存和发布后页数/总数正确。

#### T01 · P2 · 已取消阅读仍计入教师欠交【M/C】

教师统计未排除取消场次，而学生待办排除，产生学生无法完成的欠账。统一有效分配、取消和历史留档资格。

- 定位：[vocabulary-v2.service.ts:224](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:224)、[学生过滤:944](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/vocab-v2/vocabulary-v2.service.ts:944)。
- 验收：取消未做场次，学生和教师欠交同步减少；已交历史按留档保留，不误删。原模拟 cancelled 仍 assigned1/overdue1 应转为正确口径。

#### T02 · P2 · 旧班级统计按全班×全部档位试卷虚增缺交【M/C】

一个学生只需一档，却按当天五档全算，模拟应交5/已交1/缺交4；均分标签“仅已批”也与筛选不符，补核对见 marked0仍有50%均分。统一实际任务分母、入班日期、正式答卷和已发布成绩；不能只修新的总览而留下旧导航中的错误表。

- 定位：[analytics.service.ts:69](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/analytics/analytics.service.ts:69)、[同文件:127](C:/Users/yaoke/Projects/exam-paper-system/apps/api/src/analytics/analytics.service.ts:127)、[ClassStats.tsx:170](C:/Users/yaoke/Projects/exam-paper-system/apps/web/src/pages/ClassStats.tsx:170)。
- 验收：五档齐发但该生实际分配1且已做，必须1/1/0；未批不进“仅已批”均分，后入班不欠入班前任务。旧系统其他用途需要保留时按产品范围区分，不能一刀切改坏。

以下为前轮报告中的跨端重复项，保留映射以便逐条对账，不另写第二套实现：

| 历史条目 | 统一整改项 | 必须核对的教师结果 |
| --- | --- | --- |
| T03 正式13题但统计10 | VOC06 | 教师待测数与冻结正式卷、学生进度一致。 |
| T04 词表仍固定12 | UI06 | 1–20合法规则、默认数量、实际发布一致。 |
| T05 档位名字错误 | UI06 | 五档名称/顺序与注册设置一致，无班级绑定难度暗示。 |
| T06 改档改变历史欠账 | UI01 | 原日期分配不变，旧草稿/成绩/未做都可追溯。 |

### 5.5 阅读教材与发布（PUB01–PUB03、CONTENT01）

#### PUB01 · P1 · 重发同周内容会覆盖已经开始/提交的题目快照【C】

发布脚本更新现有题面、答案、rubric，保护仅涉及外来 ID，不充分保护已开始/已答版本。区分未使用草稿、已发布未开始和已被学生使用的冻结版本；相同内容重跑应无害，改内容必须新版本/新任务或明确修订流程。

- 定位：[prepare-pilot-week.js](C:/Users/yaoke/Projects/exam-paper-system/apps/api/scripts/pilot/prepare-pilot-week.js)，查题目 upsert/update 及已存在场次检查；旧基线约605–637/807行，66eec47之后已移动。
- 验收：学生做一半/已交/已判三份卷后重跑，原题面、选项、答案、证据、分数不变；相同版本二次发布幂等；必要纠错保留审计和受影响范围，不静默覆盖。

#### PUB02 · P1 · 发布 hard assert 在事务提交后才执行【C】

原脚本先提交并断开连接，后运行硬断言；检查失败不能回滚，出现“日志失败但库已改变”。关键发布前置检查和最终约束须在提交前完成；事务预算和可恢复操作设计不能削弱校验。

- 定位：同一 [prepare-pilot-week.js](C:/Users/yaoke/Projects/exam-paper-system/apps/api/scripts/pilot/prepare-pilot-week.js)，旧基线 transaction结束约975、disconnect978、assert1010行。
- 验收：向隔离测试库注入缺词/缺题/分配数错误，失败后内容、场次和学生安排全部回滚；超时重试不半发布/重复；成功日志只在完整成功后出现。
- 新基线说明：`66eec47` 将 StudentWord 安排批量化以缩短事务，不能仅凭该提交把 PUB01/PUB02 关闭；它修性能，不自动修冻结和校验顺序。

#### PUB03 · P2 · 去重已复用，但全历史覆盖与质量门禁不足【C/O】

现有脚本复用旧的 shingle/相似度去重，检查 P1 内容包及已投放非P1历史；不是“没复用，完全另造”。但历史只取前10000、未完整分页，不能等于永久全覆盖。新增周内容已有部分语言/语义校验，需核对实际发布路径，不泛称全仓没有。

- 定位：从 [prepare-pilot-week.js](C:/Users/yaoke/Projects/exam-paper-system/apps/api/scripts/pilot/prepare-pilot-week.js) 追踪 history query、dedup 引用、内容校验及 tests；沿用现有引擎补边界。
- 验收：超过10000条历史仍全部分页比较；已归档但曾投放内容仍在去重历史；同文改标题、近似改写、重复题干/答案结构、小文本处理有测试。保留输入/算法版本和拒绝原因。
- 教材发布门禁：标清对应五档目标与题型依据；每题绑定原文证据/评分点，验证分值、字数、答案格式和唯一正确选项；用独立复核流程核对做题结果，分歧不发布。需要新付费模型或老师实际终审时报告依赖，不能伪造“双模型/人工通过”。
- 不承诺“永远零重复、永远正确”。做可测的覆盖、拦截、版本追溯与纠错机制；不是趁机重写一套大架构或无期限内容研究。

#### CONTENT01 · P1 · 已发布题目1分但rubric写两点各1分【L/C】

9月9日雅思轻量 Gandhi 题 `p1_ielts_light_20260909_pq09`，marks=1，而评分说明为两点各1分。前轮只读见有2条 AnswerScript，未据此断言两个学生已被错判。内容和已作答快照需分别处理。

- 定位：[content/week2/ielts_light.js:213](C:/Users/yaoke/Projects/exam-paper-system/apps/api/scripts/pilot/content/week2/ielts_light.js:213)，以及按题目 ID 只读查询正式快照。
- 验收：新增一致性回归，分值与评分点冲突不能发布；先核对受影响记录和发布状态，提出明确纠错/重算方案，经授权执行并保留历史。仅改内容文件不能宣告历史问题修完。

### 5.6 发布、测试与运营保障（OPS01–OPS07）

#### OPS01 · P1 · 新学生端未纳入完整构建/CI门禁【C/O】

前轮根级 build/typecheck/test:all 及 CI 主要覆盖 API 和旧 web，没有完整覆盖 student-web；main 未配置保护，Railway 自动部署未证明受成功 CI 门禁控制。

- 定位：[package.json](C:/Users/yaoke/Projects/exam-paper-system/package.json)、[.github/workflows](C:/Users/yaoke/Projects/exam-paper-system/.github/workflows)。
- 验收：API、student-web、teacher web 和被改的 worker/脚本均有类型、测试、生产构建；任一必要任务失败不能产生可发布结果。分支保护/自动部署设置若需外部权限，给出待执行项，不假称已配置。

#### OPS02 · P2 · 依赖安全告警需复核修复【O】

前轮 `npm audit --omit=dev` 为19个受影响依赖条目：8 high、10 moderate、1 low、0 critical。它们不是19个已被利用的线上漏洞。涉及 Nest 上传/Express、multer、Puppeteer 等依赖链，按最新锁文件及可达性重新核查。

- 验收：兼容范围内升级并跑上传、PDF/浏览器相关回归；记录保留项的可达性、缓解及上游约束。禁止无脑 `npm audit fix --force`、整锁文件重写、未经测试的主版本升级。

#### OPS03 · P2 · 错误监控、任务失败告警不足【L/O】

前轮 API/student 的 Sentry 配置关闭、健康信息显示监控未启用；不等于完全没有日志。需要至少可观测请求失败、卡住内容任务、发布失败和敏感流程失败，明确报警接收方和脱敏。

- 验收：测试错误可追踪、关联请求且不记录密码/token/完整学生作答；长期 running 可发现；缺少 DSN/接收方/外部收费授权时给出准确未完成项，不能私开订阅。现有日志方案能满足时不强制选 Sentry。

#### OPS04 · P1 · 后续真实内容供给必须再次核对【L/O，时间敏感】

第一轮看到9月7–11五档25篇250题、10个班级每天50场；当时9月14–18为0。之后出现第三周内容提交与66eec47发布优化，所以“下周0篇”是历史快照，不能不复查就继续宣称现在缺内容。

- 验收：按最新生产状态核对目标上课日期×五档文章/题/答案/可靠词汇、各班级场次与实际学生任务；不足给出明确日期和范围。经授权发布才写库；不拿测试fixture当真实教材。

#### OPS05 · P2 · 备份恢复、容量与真实设备验证尚缺证据【O】

前轮未验证完整恢复演练、班级同时答题容量、Safari真实设备/PWA全流程、付费API故障与延迟预算。线上200和桌面缩视口不能证明这些能力。

- 验收：隔离环境恢复备份且核对关键记录；在授权非生产环境模拟预期并发保存/交卷/查词并记录延迟和失败率；不得擅自压测生产或产生翻译费用；无真机/无授权则列为未验依赖。

#### OPS06 · P2 · 正式入口、安装教程、部署版本须一致【O】

用户已发现二维码指 staging；此次所有界面入口、PWA manifest/start_url、分享/二维码、安装说明、通知链接需核对实际正式域名。不要按服务名带 production 就推定对学生开放，也不要未经要求重做已确认 PDF 文案。

- 验收：登录、内部跳转、安装后启动、密码恢复、推送链接均不串 staging/教师/其他账号；记录当前服务部署提交与数据库环境。提示词编制期间见到的新本地 HEAD 不等于已上线。

#### OPS07 · P2 · 全量回归基线必须重新建立【O】

前轮曾有一条本地未提交周内容测试失败，后来工作树与HEAD已改变。不要把过去“4169通过1失败”当现在结果，更不能删除失败断言让绿灯出现。自动化测试需隔离数据库和外部供应商；补足本文件已复现但原测试遗漏的场景。

- 验收：记录最终HEAD、命令、退出码、用例数与构建结果；每个风险对应失败前/修复后证据；原有测试无回退。真实库只能在授权的只读检查或明确发布/修复步骤访问。

## 6. 原两轮审计的结果快照与排除项（必须保留，不可夸大）

以下是2026-09-11两轮审计与本轮汇总时的观察，不是本文件生成后持续监控结果。

| 原核查事项 | 当时结果与使用边界 |
| --- | --- |
| 测试及类型 | API 3010通过/1失败（3011，134文件中1失败）；学生908/908（40文件）；教师251/251（38文件）。合计4169通过/1失败；三端类型检查通过。失败是当时WIP周内容对Gandhi评分点的断言 expected2/got null。该WIP后来已提交/变化，实施必须重跑。 |
| 生产可访问 | [学生端](https://student-web-production-5a21.up.railway.app)、[API](https://exam-paper-system-production.up.railway.app)、[教师端](https://nurturing-radiance-production.up.railway.app) 当时返回200。正确ready路径为 `/api/health/ready`，当时数据库up、约42ms；错误猜测路径 `/api/ready` 的404不是故障。 |
| 内容 | 当周25篇/250题及场次完整，但发现 CONTENT01。下周缺口是第一轮时间快照，已有新工作后必须复查。 |
| 词汇库存 | 当时 VocabularySense 4214，3个缺有效ready已译上下文；内容任务4211 published、2 rejected、1 running；WordAudio 4181。库存量不等于每个学生每日分配/例句质量都正确。 |
| 学生数量 | 当时库总体528账号、443 active，含旧数据/测试；当前符合试运行范围41含验收账号，40个P1注册且在真实班级的账号。不得把528或443宣传成真实活跃使用人数。 |
| 运行配置 | VAPID 已配、当时订阅0；LanguageTool 已配、Azure Translator key已配；Azure OpenAI endpoint/key/deployment未配。未配新付费AI不是必须开通的bug。Sentry关闭见OPS03。任何凭据值不得复制进交接。 |
| 已观察不到的异常 | 当周线上正式词测重复展示选项、item/session完成不一致的聚合数当时均为0；模拟可复现风险仍需修，不能说真实学生已全部遭遇。 |
| 依赖/发布 | 依赖告警见OPS02；main保护及CI见OPS01；运维服务看到旧部署时间但缺提交hash，不能推定当前源码全部在线。 |

已做对或已排除的部分：

1. 正式 Marker 服务已有角色、班级、认领和分值边界保护；应复用，不能为方便聊天判分去掉。问题是漏网入口与工作台状态，不是“完全没有权限体系”。
2. 新版 StudentIdentityGuard 已检查带版本令牌的启用/归档/撤销；旧路径缺口见S03，新GET过严见S08。
3. 运维入口线上无key返回401；顺序正常手判按题汇总，未证实自动分+人工分必然双加。并发与幂等仍应补测试。
4. 内部PDF路由虽然有Public标记，但另有实际内部访问校验；不把单一装饰器作为无认证的证据。
5. 已有五档、无倒计时、阅读本地草稿、部分响应式、安全区、可见焦点与减弱动画；历史和刚交卷结果已有共用ResultView。重造是在此基础上补统一阅读渲染、恢复和可访问性。
6. 自助练习不计正式成绩/每日完成度的已有部分有效；暂停错题本的产品方向保留。不要误恢复旧复习系统。
7. 内容已经复用旧去重逻辑，并非凭空新建；不能承诺绝对不重，也不能因为有测试就说答案绝对正确。
8. 只检查到受跟踪的示例环境文件，未完成专门全历史密钥扫描；“未发现提交密钥”不等于已证明没有泄漏。不得为证明而在报告输出密钥。
9. 原模拟和只读审计不是正式生产写入验证，没有执行真实判分、修改真实学生进度或发布；不要冒领这些尚未做的操作。
10. 未确认的注册认领循环、转班历史问题、任意SQL注入，不列为已确认漏洞。可在回归中验证，但要另记证据，不捏造严重结论。

## 7. Claude 的实施顺序：用可交付小阶段完成，不无限深挖架构

### 阶段A：复核与复现

读全文和最新仓库指引，记录HEAD/工作树/部署版本，盘点已有修复。建立所有ID台账，将原内存复现转为可持续回归；只补定位这些问题所需调查，不再重新做一轮无边界审计。对会影响方案的真实歧义一次简洁提问，其他按本文件执行。

### 阶段B：先修数据安全、状态与业务契约

先堵答案泄露、越权、停用/撤销、共享内容污染及危险发布路径，再修学习幂等/换词/组卷、历史任务、身份恢复、保存交卷、教师评分草稿和队列。共享状态/查询契约作为UI唯一事实来源；不新增第三套词汇系统。可以边补测试边交付，不要求为所有问题重建整库。

### 阶段C：设计系统及代表性页面

依据官方来源实现tokens、导航壳、表单/列表/按钮、dialog/sheet和状态组件。先把“首页、阅读工作区、我的单词”各做手机/平板的成功态和失败态，检查文字、对比、间距、触控和滚动。达到统一质量后复用至所有剩余页面；不要只改首页截图。

### 阶段D：覆盖整站与教师闭环

迁移注册设置、学词/背诵、正式词测、自助练习、历史结果和教师判分/统计；去除重复入口/空卡/假按钮。检验页面间返回、保存、实际难度、成绩及完成度一致；保留现有有效功能及新旧用户数据兼容。

### 阶段E：验证与发布准备

跑完整自动化、生产构建、端到端和可访问性/响应式矩阵。按授权进行必要外部操作；无生产授权时交付可发布构建、迁移dry-run、备份/回滚和逐步发布说明，明确尚未上线。授权后再备份、部署、只读核对和测试账号冒烟，不能用真实学生账号随意提交测试成绩。

## 8. 必须执行的验收矩阵

### 8.1 功能与异常场景

| 场景组 | 必须覆盖 |
| --- | --- |
| 身份 | 新注册自选班级与五档；正常/同名登录；错误锁定；停用/恢复；改密码撤销；教师只读；同设备换账号；临时认证故障恢复草稿。 |
| 日历与任务 | 阅读先做/词先做/两者都不做；一项漏做/两项漏做/仅漏正式测验；多天/跨周欠账；跨午夜交卷；改档前后；入班前/取消/无内容；首页与教师同口径。 |
| 每日词 | 0/1/10/20词；连续换词；跨来源/同拼写不同sense；候选耗尽；部分延后/全延后；最后两词并发；刷新/重试/跨设备；教学卡短例句和译文不重复整段；不显示无内容步骤。 |
| 正式词测 | 实际新词+0/1/2/3旧词的冻结集合；重复选项与正确答案泄漏；待办按日期保留；任意时间补做；重复交卷；待测/已答/剩余数全端一致；已交历史不被重新组卷覆盖。 |
| 我的单词/练习 | 来源筛选、搜索防抖/失焦/过期响应、31+词分页；移出与重新加入；自定题数大于库存；练习取消/过期/刷新/响应丢失；练习不影响正式记录。 |
| 阅读 | 各题型、长文章、长选项、空答案提醒；查词只查不加；加词对象准确；自动保存失败恢复；弹窗内错误；答题/刚交/待批/已发布历史共享界面并保护答案。 |
| 教师 | 多题未保存输入保护；最后题保存后继续发布；45份以上队列；班级/权限/认领；五档/词数；实际分配分母；未批不计最终均分；审计可追溯。 |
| 内容与部署 | 老去重引擎全历史分页、近似/精确重复；分值rubric矛盾拦截；既有快照冻结；事务失败完整回滚；worker租约/重试；正式域名/安装链接；配置缺失安全失败。 |

### 8.2 页面与设备

- 页面全部覆盖：注册、登录、首页/全部待办、阅读、结果、历史列表与详情、我的单词、学习、背一背、正式词测、自助抽查、账号设置、暂停说明、教师列表/学生详情/待批队列/逐题判分/成绩统计。
- 手机：320×568、390×844、430×932，长内容与横竖屏；平板/桌面窗口：640/744/768/820/1024/1180/1366宽，包含窄窗和分屏临界点。实际高度需同时变化，不能只固定一个宽度截图片。
- 浏览器：iPhone Safari、iPad Safari、Android Chrome、PWA独立窗口；桌面辅助键盘验证。浏览器视口模拟、真机触控、真实PWA安装分别记结果，不混称。
- 无障碍：文本放大200%、320CSSpx reflow、键盘/焦点、屏幕阅读器关键流程、减少动画、浅/深色、必要颜色对比。自动扫描不能替代交卷/查词/软键盘人工操作。
- 极端数据：0/1/5/30旧待办、0/1/30/31/500/1000单词、长姓名、最长难度名称、长中英翻译、软键盘占屏、网络慢/500/断网、部分接口失败。
- 截图证据必须包含关键成功和失败态，标明尺寸、模式与数据前提；不能为了图好看用短文本替代全部真实长内容。

### 8.3 工程检查与测试安全

1. 从最新package scripts确认正确命令，分别跑API、student-web和teacher web测试/类型/生产构建，不以根脚本名推定已覆盖所有端。
2. 新增回归应调用实际服务/组件与身份守卫次序；数据库只用隔离测试库/内存模拟，外部收费API用契约mock，不能写真实库凑测试通过。
3. 发布事务回滚、冻结快照和幂等除了mock，还需要隔离数据库集成验证；标清未具备环境时的限制。
4. 对所有变更检查diff，保留别人的修改；不顺手格式化全仓、不升级无关框架、不删失败测试、不降低阈值迎合当前结果。
5. 每个ID建立“原症状→修复位置→新增测试→实测结果→剩余依赖”。本文件已有重复映射的T03–T06可共享证据，但不能漏掉教师侧。

## 9. 交付物与完成定义

必须交付：

1. 可运行的应用修改及可持续回归测试，不只是设计稿或计划。
2. 设计变量、主要组件和导航结构的简明说明，逐项注明采用的Apple/W3C来源；自定像素值不冒充官方。
3. 所有 S/UI/VOC/M/T/PUB/CONTENT/OPS 和 IOS-01–IOS-12 的整改台账，每条有结论；“已在新HEAD修复”也要证据。
4. 手机与iPad关键页面前后对照及操作测试，覆盖阅读/历史一致性和异常态，而非仅首页。
5. 测试/类型/构建报告，最终HEAD与被验证部署版本；需要真实数据修复的清单、dry-run和恢复方案。
6. 明确还需要用户提供的外部权限、设备、监控接收方、生产发布/历史成绩修订授权。没有条件时报告，不擅自补授权或假装通过。

完成状态分开写：

- **本地实现完成**：所有可实施问题已修复/证明已有修复，回归、构建和可用环境验证通过，未留未说明的功能缺口。
- **具备发布条件**：必要配置、迁移/备份/恢复、教材和发布门禁核对完成，已知高风险未悬空；外部待批项不能藏在“100%”里。
- **生产已验收**：只有实际获授权部署并核对真实版本、完成约定上线检查，才能这样描述；真机未测必须明示。

不要使用“100%符合苹果官方规范”“保证永远不出错”这种无法证实的结论。用户要的是可靠、完整、清爽、可用的学习系统，不是术语包装。能继续安全完成的本地工作就继续；遇到真正需要新授权的环节，交付已完成证据和明确请求，不假称整个任务结束。

最终向用户用直白中文回答：改了什么、学生/老师现在怎样使用、已验证什么、是否已上线、还有什么未完成。不要只给提交号，也不要再次要求用户逐项重讲本文件已有的需求。
