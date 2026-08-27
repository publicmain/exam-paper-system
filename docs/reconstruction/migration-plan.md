# 迁移计划

> R0 · 基线 `82b9cb0` · **R0.1 修订** · 基线 `8303d1e`
> **冻结基线：`4ad1ead`**（标签 `pre-student-reconstruction-4ad1ead`，不变）
> **阶段 1 已完成**（2026-08-27）· **阶段 2 已完成**（2026-08-27，R1）
> **阶段 3 未开始，且是阻断项** —— 在它有结论之前不写任何页面代码。

产品决定见 [product-decisions.md](./product-decisions.md)。
依赖关系见 [legacy-retirement-map.md §4](./legacy-retirement-map.md)。

---

## 阶段总览

| # | 阶段 | 状态 | 阻断？ | 独立提交 | 独立回滚 |
|---|---|---|---|---|---|
| 1 | 冻结与安全点 | **✅ 已完成** | | ✓ | ✓ |
| 2 | 修正仓库最高级产品说明 | **✅ 已完成** | | ✓ | ✓ |
| **3A** | **部署预检（不碰 staging）** | **✅ 已完成** | | ✓ | ✓ |
| **3B** | **部署闭环 spike（S1–S7）** | 🔶 **S1 / S2 已完成；S3A 已完成；S3B 与 S4–S7 未完成 · 阻断 · 需单独授权** | **是** | ✓ | ✓ |
| 4 | 新端空壳与认证 | ⬜ | | ✓ | ✓ |
| 5 | token-only 身份（后端五层） | ⬜ | | ✓ | ✓ |
| 6 | 今天的课（`/app/today`） | ⬜ | | ✓ | ✓ |
| **7** | **阅读页（单独阶段）** | ⬜ | | **✓ 单独** | **✓ 单独** |
| 8 | 阅读结果页 | ⬜ | | ✓ | ✓ |
| 9 | 课程学词 + 正式测试 | ⬜ | | ✓ | ✓ |
| 10 | 今日总结 | ⬜ | | ✓ | ✓ |
| 11 | 账号制历史成绩 | ⬜ | | ✓ | ✓ |
| 12 | 生词本与错题本 | ⬜ | | ✓ | ✓ |
| 13 | 旧 URL 单向适配 | ⬜ | | ✓ | ✓ |
| 14 | staging 八账号实机验收 | ⬜ | | — | — |
| 15 | 灰度切换（1 → 5 → 整班） | ⬜ | | — | 开关 |
| 16 | 观察期后关旧通道与删代码 | ⬜ | | 分多次 | 见 §回滚 |

---

## 阶段 1 —— 冻结与安全点　**✅ 已完成**（2026-08-27）

- [x] 记录基线：**`4ad1ead`**，工作区干净，本地领先 `origin/main`
      （**不得 reset / rebase / 丢弃**）
- [x] 打标签 **`pre-student-reconstruction-4ad1ead`**（annotated，
      精确指向 `4ad1ead`，仅本地）
- [x] 冻结 `apps/web` 的学生页面 —— 冻结范围与例外写进
      [freeze-manifest.md](./freeze-manifest.md)
- [x] staging 的 8 个测试账号与播种脚本纳入版本管理：
      **`apps/api/scripts/staging/seed-eight-test-accounts.js`**
      （原来只在临时目录里）

**退出条件（已满足）**：

| 判据 | 结果 |
|---|---|
| 标签存在且指向 `4ad1ead` | ✓ |
| 冻结清单存在 | ✓ `docs/reconstruction/freeze-manifest.md` |
| 八账号夹具已版本化、有生产闸门 | ✓ **四道闸门**，见夹具文件头 |
| `apps/web/src/pages/My*.tsx` 无未提交改动 | ✓ |

**关于「阶段 1 有没有碰过数据库」—— 确切事实**：

阶段 1 **对 staging 与生产数据库零接触**，也**没有执行过本夹具**
（没有任何一次完整播种，没有任何写操作）。

但**发生过一次非计划的只读查询**，必须记下来：

- **时间**：闸门测试期间，环境快照修复**之前**
- **过程**：测试「不传 `DATABASE_URL` 会怎样」时，
  `require('@prisma/client')` 已经从仓库根 `.env` 把
  `DATABASE_URL` 填成了**本机开发库**，于是第 4 道闸门连上并执行了
  一次 `SELECT id, name FROM "User" … LIMIT 5`
- **结果**：查到 5 个非夹具学生，闸门**正确拒绝**并退出
- **写操作**：**零**。第 4 道闸门在所有 `DELETE` / `INSERT` 之前抛出
- **触及范围**：只有本机开发库 `localhost:5432/exam_paper_system`。
  **staging 与生产数据库自始至终没有被连接过**
- **已修复**：环境快照现在在 `require` **之前**取，`PrismaClient`
  也显式传库。同样的命令现在**在连库之前**就被第 3 道闸门拒绝
  （已复测）

这次意外正是第 3 道闸门被加上的原因。

**夹具目前还不能执行** —— 它的安全执行环境尚未确定（`stg-api` 是
`NODE_ENV=production`，第 1 道闸门会拒绝，而闸门不加覆盖开关）。
这件事列为阶段 3 与阶段 14 的前置。

---

## 阶段 2 —— 修正仓库最高级产品说明　**✅ 已完成**（2026-08-27，R1）

- [x] `README.md`：删掉 "Out of scope: **student-facing UI**"；改写为
      「两个产品面」+ 一节 **CURRENT vs TARGET**；写明
      `apps/student-web` **尚不存在**、重建**未完成**；保留全部安装步骤
      与教师工作流
- [x] `CLAUDE.md`：补上两个产品面、学生端**七步**正式流程、身份规则、
      冻结说明，以及**权威顺序**；铁律逐条保留
- [x] 四份旧 PRD 加状态头（**正文一字未改**）：
      `morning-quiz-2.0` 历史；`3.0` 已实施的能力层、身份/导航/时间窗
      被取代；`4.0` 已实施至 RC1.1、不再是「设计稿」；
      `student-auth-and-home` 部分被取代（§6.3 归
      `student-registration.md`）
- [x] `product-contract.md` 设为学生端最高权威，并更正其状态表述
      （业务能力已存在 ≠ 目标 App 已实施），七步流程补上**「阅读结果」**

**退出条件（已满足）**：

| 判据 | 结果 |
|---|---|
| README / CLAUDE.md 不再声称学生端不在范围内 | ✓ |
| CLAUDE.md 不再把 README 与全部 PRD 当作同级学生产品权威 | ✓ 明确权威顺序，PRD 降为历史证据 |
| 四份历史 PRD 都有无歧义的状态头 | ✓ |
| 正式流程含「阅读结果」，与 architecture §4.3 一致 | ✓ |
| 没有任何文档声称 `apps/student-web` 已存在或重建已完成 | ✓ |
| **发布状态措辞准确**（不把「代码里实现了」写成「已上线」） | ✓ 首版写成了「已上线、每天在用」，随后更正 —— 三个状态（生产 / 本地·staging / 目标）在 README、CLAUDE.md 与 `product-contract.md` 里口径一致 |

**没有改动**：应用代码、测试、schema、迁移、夹具行为、部署配置。
阶段 1 的审计事实与冻结基线/标签**原样保留**。

> **一处自我更正**：本阶段首版把 P1–P9.5 / RC1.1 写成「已上线、每天
> 在用」。那是从「代码里实现了」推断出来的，没有部署侧证据支持 ——
> `origin/main` 停在 `b72212e`（P1 完成登记），本地领先 42 个提交，
> RC1.1 只推到过 `staging-manual-test`。措辞已更正为「已实现，
> 在隔离 staging 上做真机验证」，权威口径见
> [product-contract.md 的三状态表](./product-contract.md)。

**风险**：无（纯文档）

---

## 阶段 3A —— 部署预检　**✅ 已完成**（2026-08-27）

不碰 staging 的那一半，产出
[deployment-spike-preflight.md](./deployment-spike-preflight.md)：

- [x] 二十条**仓库可证明**的部署事实（nginx 单 SPA、`/` SPA 兜底、
      无 `/app` 分流、`BrowserRouter` 无 basename、旧 SW 作用域 `/`、
      缓存 `zaoce-pwa-v4`、导航 network-first / 同源静态 cache-first、
      manifest `start_url=/my-lesson` `scope=/`、生产 CORS 必须显式配…）
- [x] **只用 Railway 官方文档**的能力调研（含出处与访问日期），
      文档已答的 5 条与 **UNKNOWN 的 5 条**分开列
- [x] 两种拓扑（独立源 / 同源 `/app/*` 分流）在 9 个维度上的对比
- [x] **推荐拓扑 + 退路 + 会推翻它的具体观察**
- [x] S1–S7 全部写成可执行检查（前置 / 动作 / 目标 / 证据 / 判据 /
      回滚 / **授权类别**）
- [x] S2 与 S3 的完整设计（路由矩阵、旧路由回归、拆除步骤、SW/PWA
      测试矩阵、iPhone 人工证据要求）
- [x] S4–S6 的设计结论 —— 其中关键一条：**学生 ID 只有认证之后才知道，
      所以边缘层不可能按 ID 分流，灰度开关必须归 API**
- [x] S7 的三种执行环境对比（四道闸门一条不减）
- [x] **七类授权矩阵**，互不继承

**没有执行任何外部动作**：未跑 Railway CLI、未开面板、未部署、
未建服务或域名、未改环境变量、未连数据库、未执行夹具、未动设备。

---

## 阶段 3B —— 部署闭环 spike 🚧 **阻断 · 未开始 · 需单独授权**

**S1（C1 只读）与 S2（受限写）已完成；S3 只完成了 S3A；S3B 与 S4–S7 未完成。**

**S3A 结果（2026-08-27，C5，用户本人的一次性测试 iPhone）**：
设备基线与四格观察全部拿到（见
[预检文档 §10.5](./deployment-spike-preflight.md)）。其中**最关键的一格**：
**断网后旧 PWA 照常打开、渲染的是缓存里的旧壳**，请求根本没出网 ——
这把 §3.1 那条更正从推理**升级为实测证实**：离线时 Edge Rule 重定向
**不可能触发**，方案 C 的适用边界只在联网路径。

**但 S3 不能记 PASS** —— 矩阵里的 **M10**（在已装的旧 PWA **内部**发起
到新源的导航）**无法触发**：旧端代码里**不存在**任何能导航到外部源的
现成路径（服务端 `next-action` 与 `quizUrl` 都只输出站内路径；未校验的
`then=` 进的是 React Router 的 `navigate()`，去不到外部源），而
standalone 壳里也没有地址栏。记为 **BLOCKED BY TEST HARNESS**，
**不是** O2，**不否决拓扑 A**。
没有这些结论，不写任何页面代码。

**S1 结果：PASS。** 关键结论（详见
[预检文档 §2](./deployment-spike-preflight.md)）：

- **U1 定案** —— Railway 的 **Edge Rules 能按路径匹配**，但它的五个动作
  （block / allow / challenge / redirect / override cache）里**没有一个
  能把请求转发到另一个 Railway 服务**。所以要区分两件事：
  **路径匹配 + 重定向 = 支持**；**同源路径级多服务反向代理 = 平台不提供**
  （只能自建代理）。
- **U3、U5 定案，U4 部分定案**（一服务可多域名且有套餐限额；Railway
  **没有**一次性任务/作业执行形态；私有 DNS 在 2025-10-16 之后创建的
  环境解析 IPv4+IPv6、更早的仅 IPv6，且内网流量不计 egress）。
- **拓扑推荐重算为三选一**：**A 独立源**为主、**C 边缘重定向到独立源**
  作迁移期加速器、**B 同源反代**降为最后退路。
  **重定向不等于反向代理** —— C 的终点仍是独立源。
- staging 勘察前后状态**逐项一致**，未创建 / 修改任何东西。

**S2 结果：PASS**（2026-08-27，受限写授权）。在 staging 里新建了**一个
一次性**静态服务 `stg-student-web-spike` 并给它生成了**一个** Railway
域名，验证了：

- 新源的 `/` 与深层路径（`/app/today` 等）全部 **200**，带
  `X-Spike-Service: student-web-origin` 与 `Cache-Control: no-store`，
  **SPA 兜底成立**
- **既有三个服务零退化** —— `Postgres` / `stg-api` / `stg-web` 的部署 id
  与域名**全部未变**；旧端 8 条路由的状态码、大小、内容指纹逐项一致；
  旧源上的 `/app/today` 仍由旧端应答，不带 spike 头
- 未建自定义域名、未加 Edge Rule、未建代理、未改任何环境变量

spike 服务**刻意保留在线**供 S3 使用，随时可删（与既有服务零耦合）。

> **一处重要更正**（见
> [预检文档 §3.1](./deployment-spike-preflight.md)）：S1 那一版写
> 「边缘重定向旧 SW 也拦不住」是**错的**。旧 SW 的作用域是 `/`，
> 从旧源发起的那次导航**先经过它**，边缘才在后面。在线时它是
> network-first 所以请求能出去、能碰到重定向；**离线时它会返回缓存的
> 旧壳，重定向根本不会发生**。新源在旧 SW 作用域之外这一点，
> **只有在导航真正抵达新源之后才成立**。**方案 C 在 S3 完成前一律记
> UNVERIFIED。**

**授权要求**：阶段 3B 的每一个外部动作都属于
[预检文档 §6](./deployment-spike-preflight.md) 里的某一类，
**各类之间不继承授权** —— 批准「Railway 只读」不等于批准部署，
批准部署不等于批准动数据库。

理由见 [architecture §7](./student-web-architecture.md#7-部署闭环编码前的阻断项)：
「独立域名」和「同域名双 SPA 分流」对路由前缀、CORS、Service Worker、
灰度判定层、旧链接跳转目标的要求完全不同，而**同域名方案有一个
既成事实的硬风险** —— 旧 Service Worker（作用域 `/`，缓存
`zaoce-pwa-v4`）已经装在全班 35 台手机上。

- [x] **S1** ✅ **PASS**（2026-08-27，C1 只读）—— 平台**不提供**路径级
      多服务转发；Edge Rules 能按路径匹配但无转发动作
- [x] **S2** ✅ **PASS**（2026-08-27，受限写）—— 用**一个**一次性空白页
      服务验证独立源拓扑；既有三服务零退化
- [ ] **S3** 在**已装旧 SW** 的浏览器上验证新端能正确更新、不吃旧缓存；
      确定旧 SW 的退役方式
- [ ] **S4** 确定灰度判定发生在哪一层
- [ ] **S5** 确定 `STUDENT_APP_ORIGIN` 的取值与注入方式
- [ ] **S6** 确定新端 API 调用形态（同源相对路径 / 跨域 + CORS）

### S7 —— 八账号夹具的安全执行环境 🔒

夹具（`apps/api/scripts/staging/seed-eight-test-accounts.js`）在阶段 1
已经版本化，但**至今没有执行过，也不得执行**，直到下面四项全部有结论：

- [ ] **S7-1 执行环境**。`stg-api` 服务是 `NODE_ENV=production`，
      第 1 道闸门会拒绝。**不加覆盖开关** —— 要找的是安全的执行位置，
      不是更弱的闸门。候选（都未验证）：
      非 production 的一次性任务容器 / 给 staging 的 Postgres 开临时
      外网通道从本机跑 / staging 单独用一个非 production 的 `NODE_ENV`
- [ ] **S7-2 库隔离**。确认目标库是 staging / 测试专用，与生产库
      **没有任何共享**（不同项目、不同实例、不同凭据）。
      第 4 道闸门会做一次兜底检查，但那是最后一道，不是第一道
- [ ] **S7-3 外发通知必须先关掉并验证过**。播种会写
      `StudentSubmission`、`VocabQuizAttempt`、`DailyLessonCompletion`，
      这些是通知的触发面。落任何数据之前必须确认：
      `NotificationConfig` 里 `enabled = true` 的行数为 **0**，
      `NotificationLog` 为 **0**，且 `TEACHER_DAILY_DIGEST` /
      `MORNING_QUIZ_ABSENCE_ALERTS` 等外发开关未设置。
      **验证在前，播种在后**
- [ ] **S7-4 知情同意**。执行会让这八个账号的
      `studentAuthVersion` +1，**所有已签发的令牌立刻失效**，
      正在测试的设备会被踢回登录页。开跑前要知道这一点

**在 S7 四项全部满足之前，禁止执行本夹具。**

**产出**：一份部署方案结论（追加到 architecture §7），两个 staging 空壳，
以及夹具执行环境的结论
**退出条件**：两个空白页面同时可访问；旧 SW 环境下新端能正确更新；
灰度开关能把一个学生 ID 路由到新端；**S7 四项有结论**
**风险**：低（只有空白页面）
**回滚**：删掉 spike 服务

---

## 阶段 4 —— 新端空壳与认证

**目标**：能登录、能显示「你好，X」、**除此之外什么都没有**。

- [ ] `apps/student-web`：Vite + React + Tailwind，独立 `package.json`
- [ ] `routes.contract.ts`（守卫 G6/G9 的基础）
- [ ] `kind → 路由` 映射表（[architecture §4.3](./student-web-architecture.md)）
- [ ] `/app/login`、`/app/register`、`/app/account`、`/app/today` 占位
- [ ] **认证与生命周期 12 项**里的 1–7、10
      （注册 / 消歧 / 登录 / 改密码 / 教师重置 / 令牌失效 / 退出 / 404）
- [ ] 令牌存取：**只读令牌**，不写不读 `mq:history:*`
- [ ] 守卫 **G1 / G2 / G6 / G9**

**退出条件**：8 个测试账号都能登录；`grep -r "my-history"
apps/student-web/src` 为空；教师重置后学生被踢回登录页并能重注册
**风险**：低（旧端不受影响）
**回滚**：删包

---

## 阶段 5 —— token-only 身份（后端五层）

**目标**：新端一个请求都不带 `name`/`studentId` 也能跑通。

- [ ] **Guard**：无 `name`/`studentId` 时有令牌即通过；冲突仍 403
      `identity_mismatch`；`teacher_view` 仍只读；规则 3 暂不动
- [ ] **Controller + schema**：`vocab.controller.ts` 19 个、
      `lesson.controller.ts` 2 个（`vocab-taught`/`vocab-cursor`）、
      `morning-quiz.controller.ts` 3 个（`history-by-name`/`history-detail`/
      `appeals`）——姓名字段一律 `.optional()`，令牌优先
- [ ] **Service**：`resolveStudent` 加令牌快路径（**绕开同名消歧与近似
      姓名建议**）；`vocab-review` / `vocab-quiz-attempt` /
      `morning-quiz` 同步
- [ ] **测试**：每个改动端点新增「只带令牌」用例；
      新建 `student-identity.guard.spec.ts` 覆盖四种情形；
      **反向对照**（改回姓名口径必须变红）
- [ ] 守卫 **G8**（新端出站请求不含身份参数）

**关键约束**：旧端**继续发**姓名，必须继续工作。这一阶段是纯增量。

**退出条件**：`apps/api` 全量测试绿；用裸令牌手工打通 19+2+3 个端点；
旧端 staging 行为无变化
**风险**：中 —— 改动面广，但每处都是「加一条快路径」
**回滚**：`git revert` 本阶段提交（向后兼容，旧端不受影响）

---

## 阶段 6 —— 今天的课

- [ ] `/app/today`：读 `/lesson/today`（**不带姓名**）
- [ ] `POST /lesson/start` 的开始按钮
- [ ] `kind` → 路由映射生效（此时下游页面还是占位）
- [ ] 完成度、连续天数、无内容/未定级/窗口关闭三种停留态

**退出条件**：8 个账号的 `/app/today` 显示与旧端一致
**回滚**：`git revert`

---

## 阶段 7 —— 阅读页 🔺 **单独阶段、单独提交、单独回滚**

> `MorningQuizTake.tsx` 1029 行，是整个迁移里唯一一个「一个页面等于
> 一个阶段」的地方。它同时承载：题型渲染注册表、P8.5 服务端草稿保存
> （`clientSeq` 单调序号）、离线徽标、返回键拦截（`pushState`）、
> 倒计时、交卷幂等。这每一条都在阅读的关键路径上 —— 任何一条坏掉，
> 学生当天就交不了卷或丢答案，都是 P1。

- [ ] `/app/lesson/reading`
- [ ] 题型渲染（复用 `components/exam/*` 或重建 —— spike 时确定）
- [ ] 逐题自动保存 + `clientSeq` 乱序拒绝
- [ ] 离线态与重连补传
- [ ] 返回键拦截与「确认离开」
- [ ] 交卷幂等，交卷后按 `kind` 走（此时下游是阶段 8 的占位）

**独立提交**：本阶段**只含阅读页**，不夹带任何其他页面的改动
**退出条件**：8 个账号在 staging 手机上各交一次卷；断网中途答题后
重连，答案不丢；返回键不丢答案
**风险**：**最高**
**回滚**：单独 `git revert` 本阶段提交 —— 阶段 6 的 `/app/today` 仍可用，
`kind=resume_reading` 时改为跳回旧端阅读页（跳转目标可配置，见
[architecture §4.5](./student-web-architecture.md)）

---

## 阶段 8 —— 阅读结果页

- [ ] `/app/lesson/reading/result`：逐题解析
- [ ] 申诉入口（[D2](./product-decisions.md#d2--历史成绩第一版的范围)）
- [ ] **不接**趋势图、技能画像、重做

**回滚**：`git revert`；`kind=read_result` 暂跳旧端

---

## 阶段 9 —— 课程学词 + 正式测试

- [ ] `/app/lesson/vocab`（课程队列，读 `/vocab/lesson-cards`）
- [ ] `/app/lesson/test`（正式，计入成绩，**退出需二次确认**）
- [ ] **与自由练习/自测拆成不同路由**
- [ ] 离线队列（`reviewQueue` 的等价物）
- [ ] 删除 `then=` / `after=submit` 协议
- [ ] 守卫 **G3 / G4**

**退出条件**：RC1.1 的九个修复点在新端逐条复验（词序、教学卡、
即时判定、阶段推进、自由练习隔离…）
**回滚**：`git revert`；两个 kind 暂跳旧端

---

## 阶段 10 —— 今日总结

- [ ] `/app/lesson/summary`（纯读 `/lesson/today`）

**至此七步链在新端跑通。**

---

## 阶段 11 —— 账号制历史成绩

- [ ] `/app/scores`、`/app/scores/:submissionId`
- [ ] 只做 [D2](./product-decisions.md#d2--历史成绩第一版的范围) 六项：
      日期 / 文章 / 阅读分 / 正式词测分 / 完成状态 / 逐题解析 + 申诉
- [ ] **砍掉**姓名输入框、候选人「输名字」入口、IP 门禁那一整套

**退出条件**：不输姓名能看到自己全部历史；看不到别人的

---

## 阶段 12 —— 生词本与错题本

- [ ] `/app/vocab`、`/app/vocab/practice`、`/app/vocab/selftest`
- [ ] `/app/mistakes`、`/app/mistakes/practice`
- [ ] 自由练习与课程队列的隔离**用路由表达**

**退出条件**：G3 覆盖这四页的完成/跳过/出错/刷新

---

## 阶段 13 —— 旧 URL 单向适配

- [ ] `apps/web` 为 8 类旧 URL 加**单向** replace 适配，目标用
      `STUDENT_APP_ORIGIN` 拼接
- [ ] 适配器**只跳转、不渲染旧页面**
- [ ] 旧 PWA `start_url` `/my-history` → 新端 `/app/today`，
      且**不再要求 `mq:history:name`**
- [ ] 新 manifest `start_url` 指向新端
- [ ] 守卫 **G5**
- [ ] **不适配** `/student/homework*`、`/student/tutor`
      （[D1](./product-decisions.md#d1--homework--ai-tutor-暂留旧系统)）

**退出条件**：G5 绿；从新端任何页面**无法**回到旧页面
**风险**：中 —— 已装 PWA 的学生是主要受影响面

---

## 阶段 14 —— staging 八账号实机验收

**前置（来自阶段 3 的 S7，必须逐项确认后才能播种）**：

- [ ] 夹具的安全执行环境已确定并验证（S7-1）
- [ ] 目标库确认是隔离的 staging / 测试库（S7-2）
- [ ] **外发通知已关闭并验证**：`NotificationConfig` 中
      `enabled = true` 为 0、`NotificationLog` 为 0、外发开关未设置
      （S7-3）—— **先验证，再播种**
- [ ] 知悉播种会使 `studentAuthVersion` +1、踢掉所有在测设备（S7-4）

以上任何一项没有结论 → **不得执行夹具**，本阶段不能开始。

- [ ] 新 staging 部署新端 + 适配后的旧端
- [ ] 8 个账号在**手机 / 平板 / 电脑**上跑
      [manual-device-test-plan.md](../manual-device-test-plan.md) 的 A–G
- [ ] 额外验收本轮契约：
      - 地址栏**从头到尾没有** `name=` / `studentId=`
      - 令牌过期 / 教师重置后回**登录页**，不是姓名页
      - 空态 / 失败 / 跳过 / 完成 / 刷新 / 返回键 / 离线 / PWA 冷启动 /
        PWA 更新 / 直接打开旧链接 —— 十种情形都留在新端
      - 打开 `/my-history` → 单向落到新端，且回不去
      - teacher_view 令牌下写操作被拒且有明确提示
- [ ] 数据库对账（沿用现有 8 项）

**退出条件**：无 P1；P2 全部有结论

---

## 阶段 15 —— 灰度切换（按学生 ID）

- [ ] 生产部署新端，`STUDENT_APP_V2` **默认关**
- [ ] `STUDENT_APP_V2=student:<id>` —— **1 人**，观察 ≥3 个教学日
- [ ] 扩到 **5 人**，观察 ≥5 个教学日
- [ ] 扩到**整班**
- [ ] 每一档观察：完成率、阶段推进、错误率（按 `x-request-id` 定位）
- [ ] 旧端保持可用

**禁止**：复用 `MORNING_QUIZ_ALL_DAY`（语义不同、粒度不同，
见 [architecture §6](./student-web-architecture.md#6-v2-灰度开关独立)）

**风险**：**高**（真实学生）
**回滚**：改一个环境变量，秒级；数据不受影响（同一个库）

---

## 阶段 16 —— 观察期后关旧通道与删代码

**前置**（两个条件都要满足，以晚者为准）：

- 整班切换满 **2 周**（[D4](./product-decisions.md#d4--二维码不再新增或重印已有的保留到整班切换满两周)）
- 整班后 **≥10 个真实教学日无 P1**
  （[D6](./product-decisions.md#d6--整班后观察至少-10-个真实教学日无-p1-才能关旧通道)；
  出现 P1 则**计数归零重来**）

按下面的顺序，**每一条一次提交**：

- [ ] **16a** 停止回写 `mq:history:*`（旧端 `Me.tsx`）
- [ ] **16b** 关闭姓名读通道（`student-identity.guard.ts` 规则 3）
- [ ] **16c** 停用二维码物料（运营动作，不是代码）
- [ ] **16d** 删除旧学生页面：`/my-history*`、`/my-vocab*`、
      `/my-mistakes*`、`/my-lesson*`、`/me`、`/scan/*`、
      `/practice/:id` 及其测试
- [ ] **16e** 删除 `next-action.ts` 的 `href` 字段
      （[architecture §4.3](./student-web-architecture.md) 第 4 条）
- [ ] **16f** 删除 AirDrop handoff（`lib/auth.ts` 的 `#h=` 采纳）
- [ ] **16g** 删除后端姓名口径的兼容分支

**不删**：`/student/homework*`、`/student/tutor` 及其后端
（[D1](./product-decisions.md#d1--homework--ai-tutor-暂留旧系统)）

**退出条件**：`grep -r "my-history" apps/` 只剩 CHANGELOG 与本目录文档

---

## 回滚说明

> **R0.1 修正**：R0 原稿把阶段 10 整体写成「无法回滚」。不准确 ——
> **删代码是可以 `git revert` 的**。真正不可逆的是**数据删除**和
> **破坏性迁移**。

### 代码改动：全部可回滚

| 阶段 | 回滚方式 | 说明 |
|---|---|---|
| 1–2 | `git revert` | 纯文档 |
| 3 | 删 spike 服务 | 只有空白页面 |
| 4 | 删 `apps/student-web` | 旧端不受影响 |
| 5 | `git revert` | 纯增量，旧端继续用姓名口径 |
| 6–12 | `git revert` 单个阶段 | 该 `kind` 暂时跳回旧端 |
| **7（阅读页）** | **单独 `git revert`** | 其余阶段不受影响 |
| 13 | `git revert` | 旧链接回到原样 |
| 15 | **改环境变量**（秒级） | 不需要部署 |
| 16a–16g | `git revert` | **删掉的代码可以还原** |

**关键设计**：阶段 1–15 全程**两个前端共用同一个 API 和同一个数据库**，
任何时候切回旧端，学生的进度、成绩、词队列都在。

### 真正高风险的是数据操作 —— 本计划里**没有**，将来也不得混入

| 类型 | 例子 | 规则 |
|---|---|---|
| **数据删除** | 清 `Attendance`、删旧 `StudentSubmission`、清 `mq:history:*` 之外的持久化 | 本计划**不包含**任何数据删除 |
| **破坏性迁移** | `DROP COLUMN`、`ALTER … NOT NULL`、改枚举取值、删表 | 本计划**不包含**任何破坏性迁移 |

**硬规则**：

1. **数据删除 / 破坏性迁移不得与代码改动放在同一个提交里。**
   代码可以 revert，数据不能；混在一起 revert 会得到「代码回去了、
   数据回不来」的半状态。
2. 将来若确实需要（例如删掉 `User` 上再无人读的旧字段），必须：
   单独立项 → 先备份 → 单独提交 → 单独部署 → 有回填脚本。
3. 阶段 16 的删代码**不触碰任何一行数据**。

---

## 尚未确定的问题

以下**不是**产品决定（那 6 项已定，见
[product-decisions.md](./product-decisions.md)），是等 spike 或实施
时才能定的技术项：

1. **部署形态**：独立域名 vs 同域名分流 —— 阶段 3 的 S1/S2 给结论
2. **旧 Service Worker 的退役方式** —— S3
3. **灰度判定层** —— S4（旧端路由层 / 入口代理 / 新端自校验）
4. **`STUDENT_APP_V2` 与 `STUDENT_APP_ORIGIN` 的最终命名与注入方式** —— S5
5. **`/lesson/today` 的 `segments` 是否已含正式测试的 `attemptId`**
   —— 阶段 4 开工第一件事确认；缺则加一个只读字段
6. **题型渲染组件**：新端复用 `components/exam/*` 还是重建 —— 阶段 7 前确定
7. **`GET upcoming-for-name`** 新端是否需要 —— 阶段 6 确定
