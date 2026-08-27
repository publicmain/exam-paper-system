# 新学生端架构、路由契约与回归守卫

> R0 · 2026-08-27 · 审计基线 commit `82b9cb0`
> **设计文档，未实施。**

---

## 1. 根因

不是「几个返回链接没改」。是**一个前端应用同时服务三个产品定义**，
而且三者互相承重：

1. `apps/web` 的路由树里，学生请求会落进**两个不同的外壳**（教师时代的
   JWT 学生外壳 / 账号制公开白名单），取决于路径是否在一张手写的
   白名单里。刷新一次就可能换壳。
2. **后端 `next-action.ts` 硬编码了旧产品的前端路由**（`/morning-quiz/:id`、
   `/my-history/submission/:id`）—— 七步链第 3、4 步本来就走在旧页面上。
3. **`/vocab/*` 的 API 契约仍是姓名制**（8 个端点无 `name=` 直接 400），
   所以每个新页面都必须把姓名拼进 URL 才能取到数据。
4. 新账号体系**主动回写**旧身份键 `mq:history:*`，因为 `/my-lesson`、
   任务总结、PWA 冷启动改道都靠它。

结论：在同一个应用里「把链接改掉」不可能收敛 —— 每个被改掉的出口，
都还有后端、API 契约、身份键三条线把它拉回去。

---

## 2. 三个方案

### 方案 A：继续在当前 `apps/web` 内修补

| | |
|---|---|
| 改动面 | 22 处 legacy 出口 + 13 个 API 调用点 + 后端 next-action + 身份键 + 白名单路由树 |
| 优点 | 无新包，无构建/部署变化；共享组件零成本 |
| 致命问题 | **没有边界**。同一个路由树里，任何人（包括我）再加一个页面，默认还是能跳到 `/my-history`；CI 守卫只能靠正则黑名单，白名单式的「canonical 只能到 canonical」无法表达 |
| 证据 | `App.tsx` 747 行里有 4 个 return 分支决定渲染哪个外壳；`*` 兜底有 3 个不同目标（`/login`、`/student`、`/my-history`）。这不是能靠 lint 规则约束的结构 |
| 结论 | **不推荐** —— 它正是我们已经试过并失败的做法（用户两次指出返回链接，修完仍有下一个） |

### 方案 B：新建独立 `apps/student-web`（推荐）

| | |
|---|---|
| 改动面 | 新包 + 逐页迁移；`apps/web` 冻结在教师端 + 旧链接兼容 |
| 边界 | **物理边界**：新包里根本不存在 `/my-history`、`/scan`、`/student` 这些路由。CI 守卫可以是「这个包里出现这些字符串就失败」—— 一条 grep 就够，不需要理解跳转图 |
| 迁移成本 | 学生页面 13 个文件 7840 行，但**新端只需重建 9 个页面**（三个已 canonical 的 + 六个能力页），且可以照抄逻辑不照抄路由 |
| 共享成本 | 学生页面依赖的共享模块已统计：`lib/api`(11)、`components/AsyncState`(9)、`lib/track`(7)、`lib/speech`(3)、`lib/registration`(3) 等约 25 个模块。**大多是纯函数或小组件，复制或提到 `packages/` 都可行**；`lib/api.ts` 988 行里学生端只用得到约 13 个端点 |
| 部署 | monorepo 已有 4 个 app（`api`/`web`/`miniprogram`/`ops-dashboard`），多包部署是既成事实，不是新概念 |
| 风险 | 过渡期两个前端并存；需要一段时间双份维护 |
| 结论 | **推荐** |

### 方案 C：全系统从零重写

| | |
|---|---|
| 改动面 | 前端 37311 行 + 后端 40+ 模块 + 数据库 |
| 致命问题 | 丢掉 P1–P9.5 + RC1 + RC1.1 的全部已验证业务规则（902 个 API 测试、236 个 web 测试），以及 34 条迁移和真实历史数据 |
| 结论 | **不推荐**，且没有任何依赖证据支持它 —— 后端的问题只有两处（`next-action.ts` 的硬编码路由、`resolveStudent` 的姓名口径），都是局部修改 |

---

## 3. 推荐架构

```
apps/
  api/            ← 保留。业务规则、数据库、迁移、P1–P9.5 + RC1.1 全部不动
                     只改两处：next-action 的 href、resolveStudent 的令牌优先
  student-web/    ← 新建。账号制英语学习 App，只有七步链 + 四个独立页面
  web/            ← 冻结为教师后台 + 旧链接兼容层。学生页面逐步退役
  ops-dashboard/  ← 不动
  miniprogram/    ← 不动
```

**核心约束**：`apps/student-web` 里**不存在**任何旧路由的字符串。
不是「不跳过去」，是「拼不出那个地址」。

---

## 4. 新路由契约

### 4.1 URL 形态

- 全部挂在 `/app` 前缀下 —— 与旧路由物理隔离，nginx/路由层可整段分流。
- **任何 canonical URL 不带 `name`、`studentId`、`then`、`after`**。
- 参数只允许出现**资源 id**（`:sessionId`、`:submissionId`、`:attemptId`），
  且服务端一律用令牌校验归属。

| 路由 | 页面 | 属于 |
|---|---|---|
| `/app/login` | 登录（姓名 + 密码） | 外壳 |
| `/app/today` | 今天的课 | 七步链 ① |
| `/app/lesson/reading` | 阅读答题 | 七步链 ② |
| `/app/lesson/reading/result` | 阅读结果 | 七步链 ③ |
| `/app/lesson/vocab` | 学习本次单词（**课程队列**） | 七步链 ④ |
| `/app/lesson/test` | 正式单词测试（**计入成绩**） | 七步链 ⑤ |
| `/app/lesson/summary` | 今日总结 | 七步链 ⑥ |
| `/app/scores` | 历史成绩 | 独立页面 |
| `/app/scores/:submissionId` | 单场成绩详情 | 独立页面 |
| `/app/vocab` | 生词本 | 独立页面 |
| `/app/vocab/practice` | 自由练习翻卡（**不计分**） | 独立页面 |
| `/app/vocab/selftest` | 自测（**不计分**） | 独立页面 |
| `/app/mistakes` | 错题本 | 独立页面 |
| `/app/mistakes/practice` | 错题重练 | 独立页面 |
| `/app/account` | 账号设置 | 独立页面 |

**注意两处刻意的拆分**（当前是同一条路由承载两种语义）：

- `/app/lesson/vocab`（课程，冻结队列，计入完成度）
  ≠ `/app/vocab/practice`（自由练习，不影响课程）
- `/app/lesson/test`（正式，计入成绩，不可 ✕ 退出）
  ≠ `/app/vocab/selftest`（自测，随时退出）

### 4.2 页面 → 可进入页面矩阵

`✓` = 允许；空 = 禁止。**没有任何一格通向旧路由。**

| 从 \ 到 | login | today | reading | result | l/vocab | l/test | summary | scores | scores/:id | vocab | v/practice | v/selftest | mistakes | m/practice | account |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **login** | | ✓ | | | | | | | | | | | | | |
| **today** | ✓¹ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | | | ✓ | | ✓ |
| **reading** | ✓¹ | ✓² | | ✓ | | | | | | | | | | | |
| **result** | ✓¹ | ✓ | | | ✓ | | ✓ | | | | | | | | |
| **l/vocab** | ✓¹ | ✓ | | | | ✓ | ✓ | | | | | | | | |
| **l/test** | ✓¹ | ✓² | | | | | ✓ | | | | | | | | |
| **summary** | ✓¹ | ✓ | | ✓ | | | | ✓ | | ✓ | | | ✓ | | |
| **scores** | ✓¹ | ✓ | | | | | | | ✓ | | | | | | |
| **scores/:id** | ✓¹ | ✓ | | | | | | ✓ | | | | | | | |
| **vocab** | ✓¹ | ✓ | | | | | | | | | ✓ | ✓ | | | |
| **v/practice** | ✓¹ | ✓ | | | | | | | | ✓ | | ✓ | | | |
| **v/selftest** | ✓¹ | ✓ | | | | | | | | ✓ | ✓ | | | | |
| **mistakes** | ✓¹ | ✓ | | | | | | | | | | | | ✓ | |
| **m/practice** | ✓¹ | ✓ | | | | | | | | | | | ✓ | | |
| **account** | ✓¹ | ✓ | | | | | | | | | | | | | |

¹ 只在**令牌失效**时发生 —— 契约要求令牌失效回登录页，**不是**回姓名页。
² 只在**放弃/退出确认**后发生（正式测试的退出必须二次确认）。

**读法**：七步链是单向的（`today → reading → result → l/vocab → l/test →
summary`）；每一页都能回 `today`（App 首页语义）；四个独立页面自成闭环，
不能横穿进七步链。

### 4.3 课程阶段 → 页面矩阵

服务端 `nextAction` 是唯一权威。新契约下 `href` 只能取下表的值：

| `stage` / 情形 | `kind` | `href` | 页面显示 |
|---|---|---|---|
| 无内容 | `no_content` | `null` | today：「今天的课程还没有发布」 |
| 未定级 | `level_not_set` | `null` | today：找老师设置 |
| 未开始 | `ready_to_start` | `null` | today：「开始今天的课程」按钮（POST 后按新 href 走） |
| `reading` 未交卷 | `resume_reading` | `/app/lesson/reading` | 阅读页 |
| `reading_done` 待看结果 | `read_result` | `/app/lesson/reading/result` | 阅读结果 |
| `vocab_learn` | `learn_vocab` | `/app/lesson/vocab` | 课程词卡 |
| `vocab_test` | `vocab_test` | `/app/lesson/test` | 正式测试 |
| `done` | `summary` | `/app/lesson/summary` | 今日总结 |

**与今天的差异**：`resume_reading` 从 `/morning-quiz/:sessionId` 改为
`/app/lesson/reading`（sessionId 由 `/lesson/today` 的 `read` 段给出，
不进 URL）；阅读结果从 `/my-history/submission/:id` 改为
`/app/lesson/reading/result`。

### 4.4 返回语义

**不使用任意 `then=` URL。** 返回目标由固定路由结构决定：

| 页面 | 返回（返回键 / ← 按钮 / 完成 / 跳过 / 出错） |
|---|---|
| 七步链任一页 | 一律回 `/app/today`，由 `nextAction` 决定下一步 |
| `/app/scores/:id` | `/app/scores` |
| `/app/vocab/*` | `/app/vocab` |
| `/app/mistakes/*` | `/app/mistakes` |
| 令牌失效（任意页） | `/app/login` |
| 未知 URL | `/app/today`（已登录）/ `/app/login`（未登录） |

### 4.5 旧链接的单向适配

| 旧 URL | 适配为 | 方向 |
|---|---|---|
| `/my-history` | `/app/scores` | 单向 → |
| `/my-history/submission/:id` | `/app/scores/:id` | 单向 → |
| `/my-vocab*` | `/app/vocab*` | 单向 → |
| `/my-mistakes*` | `/app/mistakes*` | 单向 → |
| `/my-lesson*` | `/app/today` / `/app/lesson/*` | 单向 → |
| `/me` | `/app/today` 或 `/app/login` | 单向 → |
| `/scan/:token` | 提示页 + 「去今天的课」→ `/app/today` | 单向 → |
| 旧 PWA `start_url` `/my-history` | `/app/today` | 单向 → |

**「单向」的强制含义**：适配器只做 `replace` 跳转，**不渲染旧页面**，
新端也**不存在**任何指回这些地址的链接。

---

## 5. 回归守卫

守卫要能在 CI 里跑，且**新增页面默认受约束**，不靠人记得加规则。

### G1 —— canonical 包不得出现旧路由与姓名身份（静态扫描）

对 `apps/student-web/src/**` 全文扫描，命中即失败：

```
/my-history      /my-lesson      /my-vocab       /my-mistakes
/scan            /morning-quiz   /student/       /practice/
mq:history:name  mq:history:studentId
then=            after=submit
name=            studentId=
```

> 之所以能用黑名单：新包是空白起点，这些字符串**没有正当用途**。
> 在 `apps/web` 里做不到 —— 那里它们全都是合法的。

### G2 —— canonical 渲染不得出现旧语义文案（渲染断言）

对新端每个页面做一次 smoke 渲染，断言页面文本**不含**：

```
我的记录 · 返回我的记录 · 我的早测 · 早测
换学生 · 输入姓名 · 扫码 · 扫二维码 · 不用输名字
```

### G3 —— 独立页面的四种非正常路径不得离开新端

对生词本 / 错题本，逐个断言 **完成 / 跳过 / 出错 / 刷新** 后的落点在
`/app/vocab*` 或 `/app/mistakes*` 之内。

> 这四种情形正是今天全部失守的地方（`MyVocabReview.tsx:163,204,267,494`）。

### G4 —— 课程完成后只能进入总结或账号制页面

断言 `/app/lesson/test` 交卷后的落点 ∈ `{/app/lesson/summary, /app/today}`。

### G5 —— 旧链接在过渡期仍可用（兼容测试）

断言 `/my-history`、`/my-history/submission/:id`、旧 PWA `start_url`
在适配层下**仍返回 200 并 replace 到新端**。这条防止「为了干净把兼容
也砍了」。

### G6 —— 新增学生路由必须登记

新端维护一份 `routes.contract.ts`（单一数据源），路由表由它生成。
测试断言：`<Route>` 注册集合 === 契约集合。加路由不改契约 → 红。

### G7 —— 测试不得以旧页面存在作为新流程的成功断言

对 `apps/student-web/**/__tests__/**` 扫描：出现
`/my-history`、`HISTORY PAGE`、`RESULT PAGE`（旧壳桩）即失败。

> 今天 `MyVocabReviewRouting.test.tsx` 有 3 处正是这种断言。

### G8 —— 后端 next-action 只能输出契约内的 href

在 `apps/api` 加一条测试：`nextActionOf` 的所有分支返回的 `href`
∈ 4.3 表格的取值集合。防止后端再次把前端路由写死成别的东西。

---

## 6. 后端要保留的能力（不重写）

| 模块 | 保留理由 |
|---|---|
| `lesson/`（含 `rc11-rules.ts`） | 七步链的阶段机、目标冻结、完成度、连续天数 —— P8/P9/RC1.1 已验证 |
| `vocab/` | FSRS 调度、队列冻结、正式测试的幂等与评分 |
| `morning-quiz/` 的答卷与判分部分 | 阅读答卷、草稿保存（P8.5）、锁场、成绩 |
| `student-auth/` | PIN、令牌、`studentAuthVersion` 撤销 |
| `common/student-identity.guard.ts` | 越权阻断（实测有效） |
| 数据库 + 34 条迁移 | 真实历史数据 |
| 教师端全部模块 | 组卷、题库、判分、班级、排课、看板、家长 |

**只改两处**：

1. `lesson/next-action.ts` 的 `href` 取值 → 新契约（§4.3）
2. `vocab/student-word.service.ts:26 resolveStudent` → 令牌优先，
   `name` 变可选（`/vocab/*` 才能脱离 URL 身份）

---

## 7. 学生端要重建的能力

| 能力 | 现有载体 | 新端页面 | 重建难度 |
|---|---|---|---|
| 登录 / 注册 | `Me.tsx` + `RegistrationSheet` | `/app/login` | 低（逻辑照搬，去掉 `mq:history:*` 回写） |
| 今天的课 | `MyLesson.tsx` | `/app/today` | 低（改身份来源即可） |
| 阅读答题 | `MorningQuizTake.tsx`（1029 行） | `/app/lesson/reading` | **高** —— 题型渲染、草稿保存、离线、返回拦截 |
| 阅读结果 | `MyHistoryDetail.tsx`（556 行） | `/app/lesson/reading/result` | 中 |
| 课程学词 | `MyVocabReview.tsx` 的 `lessonContext` 分支 | `/app/lesson/vocab` | 中（拆出自由练习分支） |
| 正式测试 | `MyVocabQuiz.tsx` 的 `formal` 分支 | `/app/lesson/test` | 中（拆出自测分支） |
| 今日总结 | `TaskSummary.tsx` | `/app/lesson/summary` | 低 |
| 历史成绩 | `MyHistory.tsx`（857 行，含姓名查询） | `/app/scores` | 中（**砍掉**姓名查询、候选人消歧、IP 门禁那套） |
| 生词本 | `MyVocab.tsx` | `/app/vocab` | 低 |
| 自由练习 / 自测 | 同上两个文件的另一分支 | `/app/vocab/practice`、`/app/vocab/selftest` | 中 |
| 错题本 / 重练 | `MyMistakes*.tsx` | `/app/mistakes*` | 低 |
| 账号设置 | `Me.tsx` 的改 PIN 卡 | `/app/account` | 低 |

**不迁移**：扫码、考勤、姓名查询、候选人消歧、跨设备 AirDrop handoff
（`#h=` 令牌）、`then=` 链式跳转、`/student/*` 作业与家教。
其中作业（homework）与家教（tutor）如仍需要，属于**独立产品决策**，
不在本契约范围内 —— 见 [migration-plan.md](./migration-plan.md) §待决问题。
