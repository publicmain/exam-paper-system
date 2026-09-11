# 整改台账 · 判分与教师端（`audit/marker`）

依据：`docs/CLAUDE-AUDIT-AND-IOS-REBUILD-PROMPT-2026-09-11.md`（§0、§1、§2、§4
IOS-02/03/10/11、§5.4、§5.1 S05、§5.2 UI06、§6、§8.1 教师行、§8.3）。

工作范围：`M01–M04`、`T02`（含旧 `T04`→`UI06`、`T05`→`UI06` 的映射）、`UI06`、
`S05`、`IOS-10`。工作树：`C:/Users/yaoke/Projects/exam-paper-system/.local/wt/marker`，
分支 `audit/marker`，从 `6f85e6d` 切出。最终 HEAD：`807498d`。

零 Anthropic API 调用；未连任何真实数据库；未 push、未部署；未触发
`regradeSession` / AI grader；未修改任何真实成绩。

## 接手说明

前一位工作者在额度中断前已提交 `f01bf9e`（M01/M04 后端）、`5de2d69`（M02/M03/
M01 前端）、`61b45ea`（M04/M01 前端，IOS-10），并留了未提交的 T02 后端改动
（`analytics.service.ts` + `analytics-class-overview.spec.ts`，测试当时已经是
10/10 绿，只是没提交）。本轮先审了这三份提交（读 diff + 跑测试，全部仍绿，
未发现需要回退或重做的地方），直接把 T02 的未提交改动补测后提交，然后按
台账顺序做完 UI06 / S05 / ClassStats 前端 T02 部分 / IOS-10 收尾。**没有重复
实现任何前一位工作者已经做完的东西。**

## 提交列表

| 提交 | 内容 |
|---|---|
| `f01bf9e`（前手） | M01/M04 后端：判分队列分阶段（待批/批改中/已评分待发布）+ 稳定翻页 |
| `5de2d69`（前手） | M02/M03/M01 前端：逐题判分页保留未保存输入、发布前检查脏数据、客观题只读 |
| `61b45ea`（前手） | M04/M01 前端：判分队列分栏 + 翻页 + 找回待发布（IOS-10） |
| `74b2ff6` | T02 后端：`classOverview` 重写为按学生实际分配的那一份算应交/缺交 |
| `4fc36d4` | UI06/T04/T05：教师词表页五档名称对齐学生端 + 词数规则改 1–20 |
| `3f060e3` | S05：ops-dashboard `applyGrade` 补齐正式判分约束 + 真实操作人 |
| `bff6492` | T02 前端 + IOS-10：ClassStats 页把新口径说清楚 + 表格响应式 |
| `807498d` | IOS-10/a11y：VocabClass 页补 44px 命中区 + 灰字对比度 |

---

## M01 · 最后一题保存后从待批队列消失但未发布

**状态**：已验证（前手完成，本轮复核）。

**原症状**：队列只选"存在空分数的题"；逐题保存完后卷子仍 `submitted`、
`claim active`，但因为已经没有未打分的题，队列从 1 变 0——老师以为发布了，
实际上从两个入口都够不着这份卷子。

**修复位置**：
- 后端 `apps/api/src/marker/marker.service.ts`：`listQueue` 按 `stage`
  （`awaiting`/`in_progress`/`ready`/`open`/`needs_marking`）分流，`ready`
  阶段专门装"全部有分数但还没 finalize"的答卷。
- 前端 `apps/web/src/pages/MarkerScript.tsx`：保存完最后一题即显示"已评分
  待发布"状态徽标和"发布"按钮；`apps/web/src/pages/MarkerQueue.tsx`：新增
  "已评分待发布"分栏，显示"去发布 / 认领并发布"。

**新增测试**：
- `apps/api/src/marker/marker-queue-stages.spec.ts`：内存假 prisma，验证
  最后一题保存后答卷进入 `ready` 阶段而不是从队列消失；发布只经 `finalize`
  一条路径。
- `apps/web/src/pages/__tests__/MarkerScript.test.tsx`、
  `apps/web/src/pages/__tests__/MarkerQueue.test.tsx`：找回入口、发布按钮、
  释放认领。

**实测结果**：API `marker-queue-stages.spec.ts` 与 web 两份测试均在本轮全量
跑中保持绿（见文末汇总）。

**剩余依赖**：无。

---

## M02 · 保存一题清空其他题未保存输入

**状态**：已验证（前手完成，本轮复核）。

**原症状**：单题 `save` 后前端全量 `load` 重建编辑状态，丢掉其他题的分数/
评语；慢网时新输入还可能被请求期间的旧响应覆盖；发布用库里旧值，忽略脏
数据。

**修复位置**：`apps/web/src/pages/MarkerScript.tsx` 改为逐题编辑缓冲 + 服务端
已确认值分离；保存一题只更新这一题；发布前检查"有未保存/保存中的题"则
禁用发布按钮，改走"保存全部修改"；离开页面有 `beforeunload` + 站内链接
拦截 + 本标签页草稿恢复。

**新增测试**：`apps/web/src/lib/__tests__/markerStages.test.ts`（76 用例）、
`MarkerScript.test.tsx`（310 用例）覆盖脏数据保护、慢网继续输入不丢、失败
保留输入可重试。

**实测结果**：本轮全量跑绿。

**剩余依赖**：无。

---

## M03 · 客观题覆写按钮点击必被后端拒绝

**状态**：已验证（前手完成，本轮复核；本轮额外确认代码现状）。

**原症状**：页面提供 MCQ 手动覆写输入框，正式 `scoreScript` 却对 `mcq`
题型一律 400。

**修复位置**：`apps/web/src/pages/MarkerScript.tsx` 第 664 行起——`isMcq`
时只渲染只读自动分，不再渲染改分控件（本轮 grep 确认：`isMcq` 相关分支
共 6 处，读/写路径都已经区分，没有"看起来能改却存不了"的假控件）。

**实测结果**：本轮全量跑绿，无需改动。

**剩余依赖**：无——文档里提到的"若用户另行选择保留纠分需要走完整契约"
属于未来产品决定，不在本轮范围内，未做。

---

## M04 · 待批队列前 20 份之外没有翻页入口

**状态**：已验证（前手完成，本轮复核）。

**原症状**：`listQueue` 默认 `pageSize=20` 且前端没接翻页；45 份的班前 20
份都被认领时，后面的可处理答卷完全够不着。

**修复位置**：后端 `marker.service.ts#listQueue` 返回 `total`/`page`/
`pageCount`/`stageCounts`；排序 `submittedAt asc, id asc` 保证并列交卷时
`OFFSET` 翻页不重不漏。前端 `MarkerQueue.tsx` 接翻页 UI，分栏/页码写进
URL，刷新/返回回到原处。

**新增测试**：`marker-queue-stages.spec.ts` 里的"45 份三页可达、前 20 被锁
仍能访问后续可认领卷"场景；`MarkerQueue.test.tsx`（230 用例）覆盖分栏/
翻页/URL 状态。

**实测结果**：本轮全量跑绿。

**剩余依赖**：无。

---

## T02 · 旧班级统计按全班 × 全部档位试卷虚增缺交

**状态**：已验证。

**原症状**：一个学生每天只需要做自己那一档的早测，`classOverview` 却按
"全班学生 × 当天全部五档 `PaperAssignment`"算应交，虚增缺交（如实际
1/1/0，旧口径显示 5/1/4）；"平均总分（仅已批）"其实把未发布的
`submitted` 答卷的自动分也当总分算了进去（`marked=0` 时仍显示非零均分）；
入班日期、取消的场次、`practice` 答卷都没有区分。

**修复位置**：`apps/api/src/analytics/analytics.service.ts#classOverview`
（含新增的 `sgtDayKey` / `cellState` / `rankSub` 辅助函数）——重写为：

- 早测（有 `MorningQuizSession` 的布置）：每个学生每天只欠一份——那天在
  任一档交过就是那一份（按当时冻结的难度，之后改档不改历史）；没交过就
  欠"他现在所在难度"那一档，前提是场次没取消、日期在入班到今天之间、
  那天这一档确实有卷；都不满足就不欠（不是 0 分，是不算）。
- 普通布置作业（没有场次）：保留"全班都要交"的原口径，只补"入班前已
  截止不欠""还没到 `startAt` 不欠"两条。
- 已发布成绩（`marked`/`returned`）才计入"平均总分"；未发布的 `submitted`
  只算进"平均自动分"（老师内部参考）。停用/归档学生不计入应交。
- `practice` 答卷全程过滤；`submitSource=system_eod`（系统自动收卷）计入
  缺交但单列 `autoCollected` 数量，不算已交。

**新增测试**：`apps/api/src/analytics/analytics-class-overview.spec.ts`——
内存假 prisma，10 个场景：五档齐发但只分到一档且已做（1/1/0）、没做只欠
自己那一档、开始过的任务按当时那份算（改档不改历史）、后入班不欠入班前、
取消场次不欠/已交过的取消场次仍算已交、`practice` 不算 + 自动收卷单列、
停用/归档学生不计入、"仅已批"均分不含未发布、已发布与未发布混合时均分
只取已发布、普通布置作业保留原口径。

**实测结果**：`npx vitest run analytics-class-overview.spec.ts` → 10/10
通过；随本轮全量 API 测试（3039/3039）一起验证。

**剩余依赖**：无。旧系统里 `analytics.service.ts` 的其他方法（
`classTopicMastery`、`paperWrongAnswers`、`studentHistory`）未改动，超出
本条范围。

---

## T02（前端部分）· ClassStats 页把新口径说清楚

**状态**：已验证。

**原症状**：后端修完口径后，`ClassStats.tsx` 的 TS 类型和渲染没跟上——
新字段（`awaitingPublish`、`autoCollected`、`cancelled`）没有类型声明也
没有展示；已取消且没人分配到的场次仍会渲染成裸的 `0/0` 表格行，容易被
老师误读成"数据错误"或"需要催交"。

**修复位置**：
- `apps/api/src/analytics/dto.ts`：`ClassOverviewDto` 补上
  `totals.awaitingPublish` / `totals.autoCollected` 和 `perPaper[].date` /
  `.level` / `.cancelled` / `.inProgress`，与服务端实际返回形状对齐（此前
  DTO 是旧形状，只是因为走变量赋值没有触发 TS 的多余属性检查才没报错）。
- `apps/web/src/pages/ClassStats.tsx`：
  - "已交"卡片的提示里标出"含 N 自动收卷"，不与"完全没碰"的缺交混在
    一起；新增"待发布"统计卡片和表格列（前端由 `submitted - marked`
    派生，因为后端 `perPaper` 目前只在 `totals` 级别给 `awaitingPublish`）。
  - 已取消且 `studentsExpected===0` 的场次整行标"已取消 · 不涉及在读
    学生"，不再是普通行。
  - IOS-10：表格窄屏（`<md`）收起"平均自动分"列、（`<sm`）收起"满分"
    列；"知识点掌握"按钮补 `.tap`（≥44×44 CSS px）。

**新增测试**：`apps/web/src/pages/__tests__/ClassStats.test.tsx`——已取消
场次标"已取消"、缺交提示含"自动收卷"、"待发布"数字可见。

**实测结果**：3/3 通过；`tsc --noEmit` 两端均 0 报错；`npm run build`
两端均成功。

**剩余依赖**：无。

---

## UI06（含 T04 / T05）· 教师词表页五档名称及词数规则过时

**状态**：已验证。

**原症状**：`apps/web/src/pages/VocabClass.tsx` 把 `ielts_simplified` 标成
"雅思强化"、`olevel` 标成"O-Level 基础"——跟学生端 `levels.ts` 的映射
完全对调；发布词表还强制"恰好 12 个"，与后端 `publishTeacherAssignment`
早就放宽的"1–20 个、互不重复"规则不符。

**修复位置**：`apps/web/src/pages/VocabClass.tsx`：
- `LEVEL_LABEL` 改为 `ielts_simplified=O-Level 基础` /
  `olevel_intermediate=O-Level 中级` / `olevel=O-Level 标准` /
  `ielts_light=雅思轻量` / `ielts_authentic=雅思 · 真题型`，逐字对齐
  `apps/student-web/src/lib/levels.ts`（只读，核对过顺序也一致：从易到难）。
- 发布校验改为：0 个→"请至少输入 1 个单词"；>20 个→报出识别到的数量并
  说明上限 20；大小写不敏感去重后有重复→列出重复的词；1/10/12/20 都合法。
- 后端 `v2_assignment_word_count` / `_words_must_be_unique` /
  `_words_not_publishable` / `_date_invalid` / `not_your_class` 几种
  `BadRequestException` 通过 `err.body.code` 解析成中文提示（核实过 Nest
  的 `HttpException.createBody`：传对象时不会套一层 `message` 字符串，
  旧的"发布失败：${message}"在这几种情形下会把原始 JSON 甩给老师看）。

**核对过的后端真实规则**：`apps/api/src/vocab-v2/vocabulary-v2.service.ts`
`publishTeacherAssignment`（约 143 行）：`requested.length` 必须在
`1..20`，且 `Set` 去重后长度不变（即互不重复）；没有"默认 10"这一层
硬校验——UI 文案把"10 个左右"作为建议措辞，不是校验规则。

**新增测试**：`apps/web/src/pages/__tests__/VocabClass.test.tsx`（10 用例）：
五档标签正确且旧错误标签不再出现、未选难度显示"未选择"、0/21/重复三种
非法输入的提示与"不调用发布接口"、1/10/12/20 四种合法数量都能调用接口、
后端 `words_not_publishable` 拒绝时提示含具体词。

**实测结果**：10/10 通过；`tsc --noEmit` 无报错。

**剩余依赖**：无。仓库里其他还带着旧档位标签的页面（`Classes.tsx`、
`Dashboard.tsx`、`MorningQuizSchedule.tsx` 等）**没有改**——UI06 明确点名
只有 `VocabClass.tsx`，其余页面不在本条范围，需要的话应该单独立项而不是
顺手在这里改掉（避免超出这次审计条目的边界）。

---

## S05 · 运维判分入口缺少正式业务约束

**状态**：已验证（本地实现完成；线上现状复述见下方"边界"，未夸大）。

**原症状**：`apps/ops-dashboard/server.js` 的 `applyGrade()` 只检查
`awardedMarks` 落在 `0..max` 之间和"这题是不是已经判过"，没有校验：
班级归属（可以对别的班的答卷写分）、提交状态（`in_progress` 也能写）、
题型（MCQ 也能被覆写）、认领（不管别的老师是不是正在网页判分界面批这份
答卷都能写）；判分人写死成"库里最早创建的管理员"，不是真实操作人；并发/
`fallback` 分支可能盲写、返回的 `submissionStatus` 与库里真实状态不一致；
生产没配 `ACCESS_KEY` 时 `gate()` 对所有人放行。

**修复位置**：
- 新增 `apps/ops-dashboard/grading.js`：把上述每一条约束抽成纯函数
  （`checkClassOwnership` / `checkSubmissionGradable` / `checkNotMcq` /
  `checkAwardedMarksRange` / `checkClaimNotHeldByOther` /
  `checkMarkerAccount` / `computeSubmissionTotals`），以及
  `isProductionLike` / `assertAccessKeyConfigured`——不碰 Postgres，可
  离线单测，和 `apps/api/src/marker/marker.service.ts` 的
  `scoreScript`/`finalize` 是同一套业务规则，不是另造一套更松的。
- 新增 `apps/ops-dashboard/apply-grade.js`（`createApplyGrade` 工厂）：
  `applyGrade` 现在会依次校验班级归属 = 配置的 `CLASS_ID`、提交状态必须
  `submitted`、题型不能是 `mcq`、没有被别的老师在网页判分界面认领中
  （认领人是本次判分人自己则放行）；用 `FOR UPDATE OF ss` 锁住提交行，
  串行化并发判分/正式发布；`conditional finalize` 落空时不再盲写分数，
  重新查一次真实状态如实报告（带 `note` 字段说明发生了什么）。
- `server.js`：`applyGrade = createApplyGrade(pool, CLASS_ID)`；
  `/api/grade` 路由要求 `markerEmail`（400 拒绝缺失），传给
  `applyGrade` 后校验必须是启用中的 `admin`/`head_teacher`/`teacher`
  账号，写作真实 `markedById`。
- 生产（识别 `NODE_ENV=production` 或 Railway 注入的
  `RAILWAY_ENVIRONMENT_NAME`/`RAILWAY_PROJECT_ID`/`RAILWAY_SERVICE_ID`）
  缺 `ACCESS_KEY` 时，进程在 `require` 时就 `console.error` + `process.exit(1)`
  拒绝启动；本地开发（没有这些变量）行为不变。
- `apps/ops-dashboard/public/index.html`：判分队列页新增"grading as"
  邮箱输入框（存 `localStorage`，换人自己改），点"Apply"前若没填邮箱会
  聚焦该输入框并提示，不再悄悄漏掉 `markerEmail` 导致后端 400。

**新增测试**：
- `apps/ops-dashboard/__tests__/grading.test.js`（35 用例）：纯函数逐条
  覆盖，包括生产/本地判定的 4 种 Railway 变量组合、认领人是自己时放行、
  4 种角色/状态的判分人校验、`computeSubmissionTotals` 与
  `marker.service.finalize` 同口径（mcq+自动判分算自动分、人工覆写算
  人工分、不重复计分）。
- `apps/ops-dashboard/__tests__/apply-grade.test.js`（14 用例）：内存假
  `pg` pool/client（按 SQL 文本关键片段分派，不连真实 Postgres），覆盖
  正常判分/多题未判完/班级不符/状态不对/MCQ/被别人认领/认领是自己/
  邮箱查无此人/学生账号/停用账号/缺邮箱/分数越界/幂等（已判过不重复
  累加）/并发（锁行读完快照后被别处改动，不盲写、如实报告真实状态）。

**实测结果**：`npx vitest run` in `apps/ops-dashboard` → 2 files, 49/49
通过；`node --check server.js`/`apply-grade.js`/`grading.js` 均 rc=0。

**边界（如实陈述，不夸大）**：
- 线上此前已经对无 `ACCESS_KEY` 的请求返回 401（`gate()` 逻辑本身没问题，
  问题是"没配 key 时"的行为，不是"配了 key 但校验不严"）——本轮没有
  也不需要重新验证这一条，台账原文已经写明。
- "重复加分未复现"——本轮同样没有连生产库去复现，只是把缺失的约束按
  正式判分服务的同款规则补齐，并用内存假 DB 验证了幂等/并发分支的行为；
  没有证据说明生产确实发生过重复加分。
- 部署侧是否正在跑这个新版本源码，本轮未核实（未部署，未拿到运维服务的
  真实提交 hash）。

**剩余依赖**：`apps/api/scripts/marker-apply.ts`（聊天判分主流程，走
`railway run` 直接用 Prisma，不经过 `ops-dashboard`）不在本条修改范围内
（属于 `scripts/**`，文件边界明确排除）；两条判分入口现在都各自校验了
一套等价的业务约束，但没有合并成同一个实现，如果之后要收敛成一处，需要
新的授权和范围。

---

## IOS-10 · 教师工作台（队列、逐题判分、班级统计、词表页）

**状态**：已验证（四个页面均已处理；未全站重写，只做了台账点名的这四页）。

**逐条对照**：

| 要求 | 状态 | 位置 |
|---|---|---|
| 桌面密度优先，不把整张表变成手机大卡片 | 已有 | `MarkerQueue.tsx`/`MarkerScript.tsx`（前手）、`ClassStats.tsx`/`VocabClass.tsx` 保持密集表格 |
| 平板可用，窄屏逐层收起次要列 | 本轮补 | `ClassStats.tsx` 表格窄屏收起"平均自动分"/"满分"两列（前手已经在 `MarkerQueue.tsx` 做了班级/交卷时间列的收起） |
| 表头/学生标识/筛选/主要动作稳定可达 | 已有 | 前手的 `MarkerQueue.tsx` 分栏 URL 状态；本轮 `ClassStats.tsx`/`VocabClass.tsx` 未改变既有可达性 |
| 待批/批改中/已评分待发布/已发布明确区分 | 已有（前手） | `marker.service.ts#stageWhere` 四阶段 + `MarkerQueue.tsx` 三分栏 |
| 保存状态按题显示，保护未保存输入 | 已有（前手） | `MarkerScript.tsx` 逐题缓冲 |
| 发布前检查全部脏数据 | 已有（前手） | `MarkerScript.tsx` |
| 不展示必被 API 拒绝的操作 | 已有（前手，M03） | MCQ 只读；本轮未发现 ClassStats/VocabClass 有类似"看着能点却必拒绝"的控件 |
| 五档名称和词表数量规则与学生端一致 | 本轮完成 | `VocabClass.tsx`（见 UI06） |
| 按钮命中区 ≥44×44 CSS px | 本轮补 | `ClassStats.tsx`"知识点掌握"、`VocabClass.tsx`"刷新记录"/"发布词表"补 `.tap`；前手已在 `MarkerQueue.tsx`/`MarkerScript.tsx` 广泛使用 `.tap` |
| 文字对比 ≥4.5:1 | 本轮补一处 | `VocabClass.tsx` 的"/ N 词"分母从 `text-gray-400` 提到 `text-gray-500`（`ClassStats.tsx` 在 2026-06-03 的更早一次 a11y 提交里已经处理过） |
| 弹窗焦点管理（WAI-ARIA 模态） | 已有（前手） | `apps/web/src/components/Dialog.tsx`——本轮读过实现：`role=dialog`+`aria-modal`+`aria-labelledby/describedby`、Tab 循环、Esc（`busy` 时不关）、关闭后焦点归还、错误走 `role=alert`，符合 WAI-ARIA 模态对话框模式 |

**实测结果**：涉及文件的测试见前述各条；本轮新增/修改部分全部随全量
测试跑绿。

**剩余依赖**：
- 真机/真实 Safari/iPad 分屏验收未做（本任务是本地实现 + 自动化测试，
  没有可用的真机环境）；`§8.2` 的设备矩阵截图证据不在本条交付范围内。
- `ClassStats.tsx`/`VocabClass.tsx` 目前仍是密集 HTML `<table>`
  + `overflow-x-auto` 兜底，没有像 `MarkerQueue.tsx` 那样做完整的
  URL 状态化筛选——如果之后要进一步统一，需要更大范围的改动，超出本轮
  "只做这几个页面的点名问题"的边界。

---

## API 契约变化

1. `GET /api/analytics/class/:classId/overview` 返回的 `ClassOverviewDto`
   新增字段（**向后兼容，纯新增**）：
   - `totals.awaitingPublish: number`
   - `totals.autoCollected: number`
   - `perPaper[].date: string | null`
   - `perPaper[].level: string | null`
   - `perPaper[].cancelled: boolean`
   - `perPaper[].inProgress: number`

   旧字段（`expectedSubmissions`/`submitted`/`marked`/`inProgress`/
   `missing`/`meanAutoScorePct`/`meanTotalScorePct`/`perPaper[].submitted`
   /`.marked`/`.missing`/`.meanAutoScore`/`.meanTotalScore`/`.maxScore`）
   语义不变，但**数值口径变了**（T02 修复的正是这些数字算错的问题）——
   任何缓存了旧应交/缺交数字做展示或告警的下游，需要重新对一遍新数字，
   不能假设"字段名没变=数字含义没变"。

2. `POST /api/grade`（`apps/ops-dashboard`，非 `apps/api`）新增必填字段
   `markerEmail`（字符串）。缺失返回 `400 {ok:false, error:'markerEmail
   required...'}`；邮箱不是启用中的 `admin`/`head_teacher`/`teacher`
   账号同样 400。**这是破坏性变化**：任何脚本化调用这个端点（如果存在）
   都需要补上这个字段，否则会从"总是成功（拿最早的管理员顶替）"变成
   "总是 400"。已知调用方只有 `apps/ops-dashboard/public/index.html`
   自己的判分队列页，本轮已经同步更新。

## 需要其他组配合的事项

- **无阻塞性事项**。本轮工作范围内的后端契约变化都是同一个 PR 里前后端
  一起改的（analytics DTO、ops-dashboard 的 `/api/grade`），没有遗留
  "前端等后端"或"后端等前端"的半成品。
- 供 `audit/vocab` 组参考：`VocabClass.tsx` 现在读取的教师词表五档标签
  ( `LEVEL_LABEL` ) 与学生端 `apps/student-web/src/lib/levels.ts` 一致，
  如果后续 `PILOT_LEVELS` 白名单（`apps/api/src/student-auth/
  pilot-levels.ts`，`audit/vocab` 或其他组维护）增删档位，`VocabClass.tsx`
  的 `LEVEL_LABEL` 需要同步手改（目前仓库里没有跨端共享的档位标签常量，
  这是既有的重复维护点，不是本轮新增的技术债）。
- 供 `audit/pub`（内容/运维）组参考：本轮没有改 `scripts/**` 下的任何
  文件（含 `marker-apply.ts`/`marker-dump.ts`），聊天判分主流程未受影响。

---

## 最终验证（本轮结束时，HEAD=`807498d`）

在 worktree 内跑（均为退出码 0）：

| 命令 | 结果 |
|---|---|
| `cd apps/api && npx vitest run` | 136 files / 3039 tests 通过 |
| `cd apps/web && npx vitest run` | 44 files / 292 tests 通过 |
| `cd apps/ops-dashboard && npx vitest run` | 2 files / 49 tests 通过 |
| `npm run typecheck -w @app/api` | 0 报错 |
| `npm run typecheck -w @app/web` | 0 报错 |
| `npm run build -w @app/api` | 成功（`nest build`） |
| `npm run build -w @app/web` | 成功（Vite 产出，含 `ClassStats-*.js`/`VocabClass-*.js`/`MarkerQueue-*.js`/`MarkerScript-*.js`） |
| `node --check apps/ops-dashboard/server.js` | 0 |
| `node --check apps/ops-dashboard/apply-grade.js` | 0 |
| `node --check apps/ops-dashboard/grading.js` | 0 |

未删除、未弱化任何既有测试；本轮新增测试文件：
`apps/api/src/analytics/analytics-class-overview.spec.ts`（10）、
`apps/web/src/pages/__tests__/VocabClass.test.tsx`（10）、
`apps/web/src/pages/__tests__/ClassStats.test.tsx`（3）、
`apps/ops-dashboard/__tests__/grading.test.js`（35）、
`apps/ops-dashboard/__tests__/apply-grade.test.js`（14）。
