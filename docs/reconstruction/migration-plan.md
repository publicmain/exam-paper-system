# 迁移计划

> R0 · 基线 `82b9cb0` · **R0.1 修订** · 基线 `8303d1e`
> **冻结基线：`4ad1ead`**（标签 `pre-student-reconstruction-4ad1ead`，不变）
> **阶段 1 已完成**（2026-08-27）· **阶段 2 已完成**（2026-08-27，R1）
> **阶段 3 已收口**（2026-08-27）：**COMPLETE WITH DEFERRED INTEGRATION
> CHECKS**。拓扑定案为**方案 A（学生端独立源）**，见
> [D7](./product-decisions.md#d7--部署拓扑方案-a学生端独立源)。
> **阶段 4 = GO。**

产品决定见 [product-decisions.md](./product-decisions.md)。
依赖关系见 [legacy-retirement-map.md §4](./legacy-retirement-map.md)。

---

## 阶段总览

| # | 阶段 | 状态 | 阻断？ | 独立提交 | 独立回滚 |
|---|---|---|---|---|---|
| 1 | 冻结与安全点 | **✅ 已完成** | | ✓ | ✓ |
| 2 | 修正仓库最高级产品说明 | **✅ 已完成** | | ✓ | ✓ |
| **3A** | **部署预检（不碰 staging）** | **✅ 已完成** | | ✓ | ✓ |
| **3B** | **部署闭环 spike（S1 / S2 / S3A）** | **✅ 已收口** —— 拓扑定案 A；余项已改归属 | 不再阻断 | ✓ | ✓ |
| **4** | **新端空壳与认证（总）** | 🔶 **CONDITIONAL PASS** —— 认证生命周期尚有一条出口判据未验证（教师重置链条），已具名移交阶段 14 | | — | — |
| **4A** | **新端空壳与认证（本地）** | **✅ 已完成** | | ✓ | ✓ |
| **4B1** | **打包 + staging 部署 + CORS + 单账号 smoke** | **✅ 已完成** | | ✓ | ✓ |
| **4B2** | **八账号认证验收** | 🔶 **PARTIAL / CONDITIONAL PASS** —— 教师重置链条 BLOCKED，已移交阶段 14 | | ✓ | ✓ |
| **5** | **token-only 身份（后端五层）** | ⬜ **PENDING** —— 5A 本地已 PASS，5B 部署验证待授权 | | ✓ | ✓ |
| **5A** | **本地实现（五层接线 + 运行期 + 服务链测试 + G8 加固）** | **✅ PASS**（第三轮更正后） | | ✓ | ✓ |
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

## 阶段 3B —— 部署闭环 spike　**✅ 已收口**（2026-08-27）

**S1、S2、S3A 已完成。** 余下的检查项**不再挂在阶段 3 名下** ——
已按归属重新分配（表见
[预检文档 §12](./deployment-spike-preflight.md)）。

**出口判定：COMPLETE WITH DEFERRED INTEGRATION CHECKS。**
部署形态这个问题已经回答完；推迟的每一项都指名了新归属阶段，
没有一项悬空。**阶段 3 不再阻断阶段 4。**

**拓扑定案：方案 A（学生端独立源）** —— B 否决（不必要的基础设施），
C 可选且推迟（只对整班全量切换有意义，非阶段 4 / 灰度前提），
A4 随之非阻断。见 [D7](./product-decisions.md)。

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

理由见 [architecture §7](./student-web-architecture.md)：
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

## 阶段 4A —— 新端空壳与认证（本地）　**✅ 已完成**（2026-08-27）

**目标**：能登录、能显示「你好，X」、**除此之外什么都没有**。

- [ ] `apps/student-web`：Vite + React + Tailwind，独立 `package.json`
- [ ] `routes.contract.ts`（守卫 G6/G9 的基础）
- [ ] `kind → 路由` 映射表（[architecture §4.3](./student-web-architecture.md)）
- [ ] `/app/login`、`/app/register`、`/app/account`、`/app/today` 占位
- [ ] **认证与生命周期 12 项**里的 1–7、10
      （注册 / 消歧 / 登录 / 改密码 / 教师重置 / 令牌失效 / 退出 / 404）
- [ ] 令牌存取：**只读令牌**，不写不读 `mq:history:*`
- [ ] 守卫 **G1 / G2 / G6 / G9**
- [ ] **（原 S5）** 新端从 API 运行期取 `studentAppOrigin`，
      **不把 origin 写死在构建里** —— 这是「生产主机名尚未确定」不阻断
      本阶段的前提
- [ ] **（原 S6）跨源请求形态与 CORS** —— 移交为本阶段的 staging
      集成出口条件：把新源加进 API 的 `CORS_ORIGINS`，验证带
      `Authorization` 的预检通过、`GET /api/lesson/today` 返回 200，
      且 API 仍能正常启动（F13：白名单配错会直接拒绝启动，
      **还原时要还原成原值、不是空值**）

**4A 退出条件（已满足，全部本地）**：

| 判据 | 结果 |
|---|---|
| `apps/student-web` 独立包，四条 canonical 路由 | ✓ `/login` `/register` `/today` `/account`，**无 `/app` 前缀** |
| `routes.contract.ts` 是单一事实源 | ✓ 守卫 G6 断言注册集合 === 契约集合 |
| **十个** `NextActionKind` 全部有映射 | ✓ 守卫 G9（后端类型联合是 10 个，含 `none`） |
| 认证生命周期 1–7 与 10 | ✓ 34 条测试 |
| 只存一个命名空间令牌 | ✓ `sw:token`；**不读不写 `mq:history:*`** |
| 旧路由 / 旧存储键静态扫描 | ✓ 守卫 G1（**剥注释后**扫代码，不误伤解释性注释） |
| student-web test / typecheck / 生产构建 | ✓ 34 passed · tsc 无错 · build 成功 |
| api 与 web 无回归 | ✓ api 923 · web 236 · 双端 tsc 无错 |
| 数据库 / schema / 迁移 | ✓ 零改动 |
| `apps/web` 的学生行为 | ✓ 零改动 |

---

## 阶段 4B1 —— 打包 / 部署 / CORS / 单账号 smoke　**✅ PASS**（2026-08-27）

### 授权范围内实际做的 Railway 变更（五项，仅此五项）

| # | 服务 | 变更 |
|---|---|---|
| 1 | `stg-student-web-spike` | 设 `VITE_API_URL`（构建期 API 地址，**仅此一个变量**） |
| 2 | `stg-student-web-spike` | 部署 `apps/student-web`（**沿用原有 Railway 域名，未新建域名**） |
| 3 | `stg-api` | `CORS_ORIGINS` **追加**学生源 —— 原条目保留且仍在第一位，未删未重排 |
| 4 | `stg-api` | 设 `STUDENT_APP_ORIGIN` = 学生源 |
| 5 | `stg-api` | 从 HEAD 部署 |

**未做**：生产、push、自定义域名、Edge Rule、代理、新建服务、执行夹具、
任何手工数据库命令、schema/迁移改动。
**`STUDENT_APP_V2` 保持未设（= off）** —— 没有任何现有学生被重定向。

**部署 `stg-api` 前的硬检查**：`git diff 82b9cb0..HEAD -- prisma/migrations/`
**为空**，迁移基线一致（35 个文件，两边相同），因此安全。

### 变更前 / 变更后

| 服务 | 部署 | 域名 |
|---|---|---|
| `Postgres` | **未变** ✓ | 未变 |
| `stg-web` | **未变** ✓ | 未变 |
| `stg-student-web-spike` | 已更新（预期内） | **未变**（沿用原域名） |
| `stg-api` | 已更新（预期内） | 未变 |

旧端 8 条路由（`/` `/me` `/my-lesson` `/my-history` `/my-vocab`
`/my-mistakes` `/sw.js` `/manifest.webmanifest`）状态码、大小**逐项一致**，
`sw.js` 与 `manifest` 的**内容指纹未变**，且都不带新端的 `X-Student-App` 头。

### 新端验证

| 项 | 结果 |
|---|---|
| `/` `/login` `/today` `/account` `/register` `/deep/unknown/route` | 全部 **200**，`X-Student-App: v2`，`Cache-Control: no-store` |
| SPA 深层兜底 | ✓ 任意深层路径回同一个外壳 |
| 指纹资源缓存 | ✓ `public, max-age=31536000, immutable` |
| 旧 spike 身份残留 | **0** —— `X-Spike-Service` 已不存在 |
| 浏览器：未登录访问深层路由 | → `/login` ✓ |
| 浏览器：地址栏身份参数 | **无** ✓ |
| 浏览器：未登录时的存储键 | **空** ✓ |

### CORS 与认证 smoke（测试一号，虚构账号）

| 项 | 结果 |
|---|---|
| API health | 200 |
| 预检 `OPTIONS /api/student-auth/me`（Origin = 学生源） | **204**；`allow-origin` 精确回学生源；`allow-headers: authorization,content-type`；`allow-methods` 含 GET/POST/PATCH；`allow-credentials: true` |
| 未认证 `/me` | **403 `student_token_required`**（正常失败）且**仍带正确的 CORS 头** |
| 旧源仍在白名单 | ✓ 用旧源发请求，`allow-origin` 回旧源 |
| 登录 | **201**，拿到令牌（**未打印**） |
| 认证后 `/me` | **200**，身份正确 |
| `appVersion` | **`v1`** ✓（v2 未开，不重定向任何人） |
| `studentAppOrigin` | 与学生源**完全一致** ✓（运行期下发，未编进镜像） |

### 一项未能完成的验证（如实记录）

**浏览器里的「登录后问候语 + 登出清 `sw:token`」没有在 staging 上做。**

原因：在浏览器工具里完成登录必须把口令写进工具调用，那会让它进入
对话记录，与本轮「不打印口令」的要求冲突。

**替代证据**：① 服务端认证链路已完整验证（登录 → `/me`，含
`appVersion` / `studentAppOrigin`）；② 问候语渲染、登出清票、退出后
本包键一个不剩，由 **41 条本地自动化测试**逐条覆盖，且部署的就是同一份
代码。**这一项移交 4B2**，那时用真机手动输入口令即可，不经过工具调用。

### 回滚就绪（已记录，未执行）

| 目标 | 回滚方式 |
|---|---|
| `stg-student-web-spike` | 重新部署 `bb5a5c31-98e3-4642-863b-f89a633747a6` |
| `stg-api` 代码 | 重新部署 `a4d9d2d8-95bc-413a-82ce-e8ab9bed05aa` |
| `CORS_ORIGINS` | 还原为**原来那一条**（旧端源）—— **绝不还原成空值**：生产模式下白名单为空会让 API 直接拒绝启动 |
| `STUDENT_APP_ORIGIN` | 原本**未设**，回滚即删除该变量 |
| `STUDENT_APP_V2` | 全程未动，保持未设 |

---

## 阶段 4B2 —— 八账号认证验收　🔶 **PARTIAL / CONDITIONAL PASS**（2026-08-27）

> **状态更正**：首版记成了无条件 PASS。不准确 —— **认证生命周期里有一条
> 出口判据（教师重置 → 旧令牌撤销 → 重新注册）自始至终没有被验证过**。
> 已通过的观察全部保留在下面，一条不减；但整体状态是
> **PARTIAL / CONDITIONAL PASS**，条件是那条链条日后补验。

用户在自己的设备上手动完成，**每一次口令都由用户私下输入，从未经由对话
或工具调用**。证据标识 `4B2-EV-*`，截图不入库。

### 证据分级

| 记号 | 含义 |
|---|---|
| **OBSERVED** | 用户在真实设备上看到并确认 |
| **API-OBSERVED** | 我通过应用端点观察到（不读库） |
| **CODE/TEST-VERIFIED** | 由代码或自动化测试证明 |
| **NOT APPLICABLE** | 当前夹具下不适用 |
| **UNVERIFIED** | 未验证 |

### 步骤 0 —— 基线

四服务 Online，部署 ID 与 4B1 结束时**完全一致**（API-OBSERVED）。
八个账号全部虚构；最终状态要求 = 测试计划记录的原始 staging 口令。

**教师重置通道不可用。** 证据按可证明程度分级 —— 首版把其中一条错标成了
CODE-VERIFIED，这里更正：

| 分级 | 事实 |
|---|---|
| **OBSERVED** | 当前**没有可用的 staging 教师凭据**。我们手里没有能登进教师端的账号 |
| **CODE-VERIFIED** | `MOCK_AUTH=false` 下的正常启动**不创建 demo 教师**。`auth.guard.ts:55` 那个 `mock-teacher` 是 `MOCK_AUTH=true` 时伪造的**请求用户**，不写库；demo 账户只在 `prisma/seed.ts`（手动 `npm run db:seed`），不在启动路径 |
| **CODE-VERIFIED** | **版本化**的种子（`apps/api/scripts/staging/seed-eight-test-accounts.js:268`）把教师口令哈希的是一个**常量占位串** `staging-fixture-placeholder-not-a-login-path` |
| **CODE-VERIFIED** | 教师行的插入是 `INSERT … ON CONFLICT (id) DO NOTHING`（`:284-286`）。**因此重跑版本化种子也不会替换已存在的教师口令** —— 对照：学生行是 `ON CONFLICT DO UPDATE SET "pinHash"=EXCLUDED."pinHash"`，那才会覆盖 |
| **UNVERIFIED EXTERNAL HISTORY** | **当前部署上的那条教师口令究竟由哪个脚本、用什么输入创建的** —— 那是一个**未版本化的早期脚本**，仓库里没有它，我无法证明它用了什么 |

> **更正说明**：首版写「口令是用 `bcrypt.hash('staging-only-' + Date.now(), 4)`
> 生成的」并标为 CODE-VERIFIED。**那个表达式不在仓库里**（`git grep` 为空），
> 它来自一个已删除的临时脚本 —— 从仓库出发无法证明，因此不能标 CODE-VERIFIED。
> 已改为如实记为 UNVERIFIED EXTERNAL HISTORY。
>
> **对阶段 14 有用的一条推论**：由于教师行是 `DO NOTHING`，**重跑版本化种子
> 并不能给出一个可用的教师凭据**。要打开这条通道需要另想办法（新建教师、
> 或在种子里显式处理教师口令）—— 这属于阶段 14 的夹具规划。

### 步骤 1 —— 八账号矩阵　**PASS**（OBSERVED）

`测试一号` 完整走了六项：登录 → `/today` → 问候语「你好，测试一号」→
刷新恢复 → 深层未知 URL 自动回 `/today` → `/account` 退出 → 退出后
刷新与后退**都回不到** `/today`。

其余七个账号各验**登录 / 问候语逐个对上 / 退出**（外壳行为是同一段代码，
只验一次）。**八个全部通过，问候语无一串号** —— 旧端的 RC1.1-I
（换账号时残留上一个人的姓名）在新端未复现。

> **4B1 遗留的两项在这里补上了**：浏览器里的问候语显示、以及退出后
> 无法再回到已登录页面 —— 均为 **OBSERVED**。

### 步骤 2 —— 失败路径　**PASS**（OBSERVED）

| 子项 | 结果 |
|---|---|
| 2a 输错一次密码 | 可读的错误提示；**不跳转**；**没有**旧端那句「打开 App 时会引导注册」 |
| 2b 立刻用正确密码 | 登录成功 —— 一次失败没有锁住账号，失败计数正常恢复 |
| 2c 用已注册账号去 `/register` | **被拒绝**，提示去登录 / 找老师重置 |
| 2d 2c 之后用原密码登录 | **成功** —— 证明公开注册端点**不会覆盖已有凭据** |

> 2c→2d 这一对是刻意设计的：注册是公开端点，若它在账号已存在时默默
> 覆盖密码，任何知道姓名的人就能改别人的密码。已排除。

### 步骤 3 —— 改密码往返（测试三号）　**PASS**（OBSERVED）

动手前先确立恢复路径：用户自选并记住一个临时口令（**从未告知我**）。

| 子项 | 结果 |
|---|---|
| 3b 改成临时口令 | 成功；**令牌当场作废**，被送回登录页并显示「密码已经改好了 —— 用新密码重新登录一次」 |
| 3c 用旧口令登录 | **失败**（符合预期） |
| 3d 用临时口令登录 | 成功 |
| 3e 改回原始口令 | 成功；同样被送回登录页 |
| **3f 用原始口令登录** | **成功** —— 恢复完成 |

### 步骤 4 —— 锁定 / 教师重置 / 重新注册　**BLOCKED（前置不满足）**

规则要求「破坏性凭据测试前必须先证明恢复路径可用」。教师重置通道打不开
（步骤 0），因此**没有执行这条链的任何一步，也没有锁定任何账号**。

**刻意不做局部版本**：这条判据是整链通过，缺了教师重置无论如何都过不了；
单独去锁只能换来一条 `pin_locked` 提示的观察，代价是 15 分钟锁定期 +
最终审计时账号处于异常态。而那条提示已由本地测试逐字钉住
（断言提示含「15 分钟」）—— **CODE/TEST-VERIFIED**。

**移交**：整条链移交**阶段 14**，作为一条**具名的硬验收项**（见该阶段）。
**不得被静默勾掉** —— 它是认证生命周期里唯一未验证的出口判据。

### 步骤 5 —— 同名消歧　**NOT APPLICABLE TO CURRENT FIXTURE**

八个账号姓名唯一。按规则**不新建重复账号、不枚举无关用户**。

- 现场同名验证：**NOT APPLICABLE**
- 登录 / 注册的消歧逻辑：**CODE/TEST-VERIFIED**（两条测试覆盖
  「返回 candidates → 选中 → 只在这一次请求里带 studentId → 不落盘、
  不进 URL」）
- **现场重复姓名的验证移交阶段 14 的夹具规划**

### 步骤 6 —— 最终恢复审计

| 判据 | 结果 |
|---|---|
| 八个账号用**原始口令**登录 | **8/8 ✓**（API-OBSERVED） |
| 无账号被锁 / 未注册 | ✓（八个全部登录成功即证明） |
| 所有测试会话已退出 | ✓（OBSERVED，用户确认） |
| 旧 staging PWA 仍在测试机上、未动 | ✓（OBSERVED，用户确认） |
| 四服务部署 ID 与域名 | **全部未变** ✓ |
| `stg-api` 配置 | `CORS_ORIGINS` 仍 2 条且旧端在第一位；`STUDENT_APP_ORIGIN` 已设；**`STUDENT_APP_V2` 仍未设**（无人被重定向）；变量总数 23，与 4B1 结束时一致 |

#### 一处课程场景漂移（**不是本轮造成的**）

审计发现 `测试一号` 的当日场景是 `vocab_test`，而种子初始态应为
`ready_to_start`。

**已排除本轮嫌疑**（CODE-VERIFIED）：`login` / `register` / `changePin` /
`me` 四个方法体里，对 `dailyLessonCompletion`、`studentSubmission`、
`vocabQuizAttempt`、`studentWord`、`morningQuiz` 的引用**全部为零** ——
认证操作在代码层面碰不到课程状态。

**未能确定来源（UNVERIFIED）**：把 `测试一号` 推到 `vocab_test` 的**确切
操作与 cron 序列，我没有证据**。要确定它需要服务端日志或读库，两者本轮
都未授权。

> **更正说明**：首版写「来源是 S1 准备阶段调过 `POST /lesson/start`，
> 此后 cron 继续推进」。那是一个**合理的推测**，但我没有日志或数据库证据
> 支持它 —— 单靠 `lesson/start` 也解释不了为什么会走到 `vocab_test`
>（它只会把阶段推到 `reading`）。在拿到证据之前不该断言具体历史原因，
> 已改为如实记 UNVERIFIED。

**影响与处置**：不影响认证验收（八个账号都能登、都不锁）。但
staging 的 `测试一号` 已不在其种子场景上。**重新播种即可恢复** ——
归阶段 14（其 S7 前置本来就要处理夹具执行环境）。

---

## 阶段 5 —— token-only 身份（后端五层）

**目标**：新端一个请求都不带 `name`/`studentId` 也能跑通。

拆成 **5A（本地实现）** 与 **5B（部署验证）**：5A 只改代码、跑本地测试，
不碰 staging / 生产 / 数据库；5B 需另行授权。

### 阶段 5A —— 本地实现　**✅ PASS**（2026-08-28，第三轮更正后）

> 本轮 PASS 建立在**运行期**证据上：26 个在范围内端点逐条调起真实
> handler 通过 —— 既验执行到达依赖、也验回给调用方的响应。
>
> 2026-08-28 早些时候的那次 PASS **已作废** —— 它只有源码扫描证据，
> 放过了两个真实的 token-only 失败，且对 vocab-cursor 的诊断本身是错的。
> 作废的原因与修复都保留在下面，不删。

- [x] **Guard**：先审计再动手 —— 审计结论是**现有逻辑已经正确，不改**
      （见下「Guard 审计」）
- [x] **Controller + schema**：vocab 19 + lesson 4 + morning-quiz 3，
      姓名字段一律可选，令牌优先
- [x] **Service**：`resolveStudent` / `resolveStudentByName` 各加一个
      令牌快路径（**绕开同名消歧与近似姓名建议**，但不放宽资格）
- [x] **测试**：逐端点表驱动 + 兼容契约 + 反向对照
- [x] 守卫 **G8** 加固（前缀无关的全量清点）

#### 从代码推导的端点矩阵（**在范围内共 26 条**，不采信文档里的 19+2+3）

下表是**清点与接线**证据。每条端点的**执行**证据见
`apps/api/src/common/token-only-runtime.spec.ts`（逐条调起真实 handler）。

| 方法 / 路径 | 身份来源 | 需令牌 | schema 字段 | 解析器 |
|---|---|---|---|---|
| `GET /vocab/words` | query name | 否（公开读） | TS 可选 | service(authStudentId) |
| `POST /vocab/words` | body studentName | **是** | zod .optional() | service(authStudentId) |
| `POST /vocab/words/remove` | body studentName | **是** | zod .optional() | service(authStudentId) |
| `GET /vocab/due` | query name | 否（公开读） | TS 可选 | service(authStudentId) |
| `GET /vocab/lesson-cards` | query name | 否（公开读） | TS 可选 | service(authStudentId) |
| `POST /vocab/review` | body studentName | **是** | zod .optional() | service(authStudentId) |
| `POST /vocab/review/undo` | body studentName | **是** | zod .optional() | service(authStudentId) |
| `GET /vocab/quiz` | query name | 否（公开读） | TS 可选 | service(authStudentId) |
| `GET /vocab/mistakes` | query name | 否（公开读） | TS 可选 | words.resolveStudent |
| `POST /vocab/mistakes/resolve` | body studentName | **是** | zod .optional() | words.resolveStudent |
| `GET /vocab/mistakes/practice-queue` | query name | 否（公开读） | TS 可选 | words.resolveStudent |
| `POST /vocab/mistakes/practice-result` | body studentName | **是** | zod .optional() | words.resolveStudent |
| `POST /vocab/page-view` | body studentName | **是** | zod .optional() | words.resolveStudent |
| `GET /vocab/stats` | query name | 否（公开读） | TS 可选 | service(authStudentId) |
| `POST /vocab/quiz/attempt/start` | body name | **是** | zod .optional() | service(authStudentId) |
| `GET /vocab/quiz/attempt/current` | query name | **是** | TS 可选 | service(authStudentId) |
| `POST /vocab/quiz/attempt/answer` | body name | **是** | zod .optional() | service(authStudentId) |
| `POST /vocab/quiz/attempt/submit` | body name | **是** | zod .optional() | service(authStudentId) |
| `GET /vocab/quiz/attempts` | query name | **是** | TS 可选 | service(authStudentId) |
| `GET /lesson/today` | query name | **是** | TS 可选 | controller 内 id 优先 |
| `POST /lesson/start` | body studentName | **是** | zod .optional() | controller 内 id 优先 |
| `POST /lesson/vocab-taught` | body name | **是** | zod .optional() | service(authStudentId) |
| `POST /lesson/vocab-cursor` | body name | **是** | zod .optional() | service(authStudentId) |
| `GET /morning-quiz/history-by-name` | query name | 否（公开读） | TS 可选 | controller 内 id 优先 |
| `GET /morning-quiz/history-detail` | query name | 否（公开读） | TS 可选 | controller 内 id 优先 |
| `POST /morning-quiz/appeals` | body studentName | **是** | zod .optional() | service(authStudentId) |

数量核对：**在范围内 26 = vocab 19 + lesson 4 + morning-quiz 3**。
vocab 的 19 = `vocab.controller.ts` 里全部 24 个端点 − 4 个教师端
（`class/:classId/{top,stats,engagement}` + `push`）− 无身份的 `lookup`；
lesson 4（计划说 2，`today`/`start` 本就已是 id 优先，本轮只验证不改写）；
morning-quiz 3。计划里的 19 与 3 经代码确认无误，**2 应为 4**。

明确排除、且**已由测试钉住不得被拉进来**：`upcoming-for-name`、`trend`、
`skill-profile`、`practice`、考勤、`student-auth/*` 的 pre-auth 端点；
阅读三件套（`sessions/:id`、`answer`、`submit`）已走 JWT，不改写。

#### Guard 审计（先审计后改）

`StudentIdentityGuard` 的四件事逐条对照阶段 5A 的兼容契约：

| 契约 | 现状 | 结论 |
|---|---|---|
| 有令牌 + 无姓名 → 放行并置 `req.studentAuth` | 已实现 | 不动 |
| 令牌与声明身份冲突 → 403 `identity_mismatch` | `identityConflicts()` 已实现 | 不动 |
| 写操作无有效令牌 → 403 `student_token_required` | `@RequireStudentToken()` 已实现 | 不动 |
| `teacher_view` 只读，写 → 403 `teacher_view_is_read_only` | 已实现 | 不动 |

**所以本阶段没有改这个文件。** 计划里写着「改 Guard」，但可用的安全逻辑
不因为计划这么写就该重写 —— 重写只会引入回归。

#### 身份优先级与资格

- 优先级：`req.studentAuth.id` > 请求里的 `studentId` > 姓名。
  由 `common/student-identity-input.ts::identityOf()` **单点**产出，
  三个 controller 共用，杜绝各写一份慢慢长出差异。
- 精确 ID 解析在 `common/authenticated-student.ts`：用 `findFirst({ where: { id } })`，
  **不查姓名、不消歧、不给近似姓名建议**。
- **资格不放宽**：取两个旧解析器里更严的一套
  （`role='student'` + `isActive` + `archivedAt=null` + 在读于未归档班级）。
  令牌证明「你是谁」，不证明「你还在读」。
- 新错误码 `student_not_eligible`（403）**只可能出现在已认证路径上**，
  旧的无令牌路径走不到，因此不影响任何既有客户端的错误契约。

#### 精查中发现的问题（含 2026-08-28 更正轮推翻的两条）

**1. `POST /lesson/vocab-cursor` 缺学生写接口的元数据。**（已在更正轮修复）

它既没有 `@Public()` 也没有 `@RequireStudentToken()`。真实后果是：

- 全局 `AuthGuard` **接受任何角色的有效 JWT**（该 handler 上没有
  `@Roles`），**不是**「要求教师 JWT」。学生的 PIN 令牌与教师令牌
  由同一个 `JwtService` 签发校验，两者都能过。
- 因为缺 `@RequireStudentToken()`，`StudentIdentityGuard` 的第 ② 步与
  ②b 步都不生效 → **拿一个普通教师 JWT、请求体里写上任意学生姓名，
  就能替那个学生写断点**；教师的**只读**学生视角令牌（`teacher_view`）
  同样写得进去。这才是真正的风险，而不是「学生被 401」。
- 顺带缺限流。
- 完全不带令牌的旧调用（`apps/web` 的 `MyVocabReview.tsx`，用
  `.catch(() => {})` 吞错误）确实拿 401，但那只是这个缺陷的一个侧面。

> **上一版本文档在这里写错了**：它称「全局 `AuthGuard` 因此要求教师
> JWT，学生端调用一律 401」。`AuthGuard` 从不要求特定角色 —— 只要
> handler 上没有 `@Roles`，任何有效 JWT 都放行。该说法已删除。

**修复**：把本属于它、却飘在 `vocab-taught` 上方的那套装饰器
（`@Public()` + `@RequireStudentToken()` + `@RateLimit(120/60s)`）
移回 `vocab-cursor`。**业务逻辑一行未动。**

对现有调用方的影响（`apps/web` 的 `request()` 会带上 localStorage 里的
`auth_token`）：

| 调用方 | 修复前 | 修复后 |
|---|---|---|
| 已用 PIN 登录的学生 | 通过（靠 AuthGuard 收任意 JWT） | 通过（靠学生令牌，且有限流） |
| 未登录的学生 | 401 `Missing token`（被 `.catch(() => {})` 吞掉） | 403 `student_token_required`（同样被吞掉） |
| 教师的 `teacher_view` 只读令牌 | **能写进去** | 403 `teacher_view_is_read_only` |
| 普通教师令牌 + 请求体带姓名 | **能替学生写** | 403 `student_token_required` |

最后两行是这次修复真正堵掉的洞：教师翻看学生视角时，不会再悄悄把
那个学生的翻卡断点推着走。

**2. `lesson.controller.ts` 的孤儿装饰器块。**（同上，已随 1 一并修复）

那套装饰器夹在「描述 vocab-cursor 的 JSDoc」和「vocab-taught 的 JSDoc」
之间，于是两套都落在 `vocab-taught` 上（元数据幂等，所以无害），而
`vocab-cursor` 一套都没有。现在每条路由各自恰好一套，并由测试钉住。

**3. lesson 在范围内是 4 个不是 2 个** —— `today`/`start` 本就已是 id
优先（`resolveByIdOrName` 先按 id 查），本轮只验证不改写；但它们必须
计入矩阵，否则「2 个」会让人以为它们不接受令牌身份。
**在范围内的端点总数是 26 = 19 + 4 + 3。**

#### 2026-08-28 更正轮：静态测试放过去的两个真缺陷

**缺陷**：`GET /vocab/quiz/attempt/current` 与 `GET /vocab/quiz/attempts`
在 `identityOf()` 之前各有一句无条件的

```ts
if (!name) throw new BadRequestException({ code: 'name_required' });
```

带有效令牌、不带姓名的请求因此当场 400 —— **token-only 在这两个端点上
根本不成立**。已删除；判据交还给 `identityOf()`（有令牌姓名可省，
无令牌无姓名仍报 `name_required`，旧口径不变）。

**为什么上一轮全绿**：上一轮的端点矩阵是**源码扫描**，判据是「方法体里
出现了 `identityOf(`」。这两个 handler 同时满足「有 `identityOf(`」和
「第一行就把请求拒了」，扫描无从分辨。

> **证据分级**：源码扫描只能证明**清点与接线**，不能证明**执行**。
> 引用 `endpoint-matrix.spec.ts` 的结论时只可说「端点清单与接线完整」，
> **不可**说「验证了 token-only 请求可用」。

**补救**：新增 `common/token-only-runtime.spec.ts` —— 26 个在范围内端点
**逐条把真实 handler 调起来**（真实控制器实例 + mock 服务 / Prisma，
`req.studentAuth` 有值、零身份入参、最小合法非身份载荷），判据是
**执行确实到达了预期依赖**并带着令牌 id，外加「不抛 `name_required`」。
另有一条静态兜底：任何 `name_required` 必须写在确认无令牌之后
（`if (!auth && !name)`），无条件的姓名闸一律判红。

这一组测试在修复前对 `3e5dcb5` 跑出 **12 条红**（两个 GET 各 2 条、
静态兜底 1 条、vocab-cursor 元数据与守卫 7 条），修复后全绿。

#### G8 加固与后续的 fail-closed 修补

旧版 `apiBlocks()` 拿 `/student-auth/` 路径字面量当锚点 —— 只要新端开始
调 `/lesson/*`、`/vocab/*`，守卫就静默地什么都不查，而测试仍然是绿的。
改为：

- 从 `request(...)` 的**调用点**切块，前缀无关；扫描范围取整个方法块
  （签名 + 调用），因为身份可以藏在签名里再原样传下去；
- 只有三个 pre-auth 端点（`login` / `register` / `registration-status`）
  可以带身份，其余一律按已认证处理，URL 与请求体都不许带；
- **未在 `KNOWN_ENDPOINTS` 登记的新请求直接判红**；
- **路径不是字面量、静态判不出来的调用，上报为 `<dynamic/unclassified>`
  并判红**。上一版这里是 `if (!p) continue` —— 一句
  `request('GET', SOME_PATH, …)` 会被静默跳过，守卫等于没有。
  helper 自身的函数声明单独排除，不会被误报；
- 一条「没有绕过 `request()` 的裸 `fetch`」，否则清点本身就是漏的；
- 不误伤**响应类型**与 pre-auth 消歧载荷里的 `name`/`studentId`。

变异验证全部被抓到：`/lesson/today?name=`、新增未登记端点、签名里藏
`studentId`、以及路径为变量的请求。

#### 更正轮之二（同日）：token-only 的响应回显

**缺陷**：`GET /morning-quiz/history-by-name` 在**只带令牌**时返回
`student.name === ""`。

链条是：请求不带 `rawName` → 局部 `name` 成了空串 → 已认证候选**已经
正确地从库里查了出来** → 拼响应时用的却仍是那个空的查询串。

鉴权、解析、资格全都对，**只有回显是错的** —— 这正是上一轮判据的盲区：
「执行到达了预期依赖」不等于「回给调用方的东西是对的」。

> 上一版文档把它写成「留给 5B / 阶段 11 的已知残留」。**那个定性是错的**：
> 它不是 UI 问题，是 token-only 路径引入的 **API 响应契约缺陷**，
> 属于阶段 5A 自己的范围。该段已删除。

**修复**：回显取**解析出来的那条候选**的姓名
（`auth ? candidates[0].name : name`）。

- 取的是**库里那行**，不是 `auth.name` —— 令牌签发之后姓名可能改过，
  这一路的唯一事实源是刚刚按 id 查出来的那行；
- 没有重新引入按姓名查、同名消歧或近似姓名建议：查询仍是
  `where: authenticatedStudentWhere(auth.id)`，且全程只查一次；
- **无令牌的旧路径一字未动**，仍回显调用方给的姓名；
- **响应形状未变**：仍是 `{ student: { name, matchedCount, classes }, submissions }`。

**另外 25 条的同类审查**（先审查再动手，未扩大范围）：只有五个 handler
会自己拼响应，其余 21 个直接透传依赖返回值。

| 端点 | 响应里有身份吗 | 取自哪里 | 结论 |
|---|---|---|---|
| `GET /vocab/mistakes` | `student:{id,name}` | `resolveStudent()` 的库返回值 | 本来就对 |
| `GET /vocab/mistakes/practice-queue` | `student:{id,name}` | 同上 | 本来就对 |
| `GET /vocab/lesson-cards` | 无 | 依赖结果 / 固定空壳 | 无此类风险 |
| `POST /vocab/page-view` | 无 | 固定 `{ ok: true }` | 无此类风险 |
| `GET /morning-quiz/history-by-name` | `student.name` | **曾取自查询串** | **已修** |

**没有发现第二处响应语义缺陷。** 但前两个的正确性此前**没有测试保护**
（上一轮只断言了「`resolveStudent` 被用 auth id 调过」，没断言回显值），
现已补上；21 个透传型端点也补了一条「依赖的返回值原样回给调用方，没被
吞掉」。

#### 更正轮之三（同日）：身份在**服务内部**丢失

**缺陷**：token-only 的 `POST /lesson/vocab-taught` 会**先写一半，再报身份错误**。

链条：控制器把 `authStudentId` 交给 `markTaughtAndAdvance()` → 它正确解析出
学生 → 事务里写 `firstTaughtAt` / `vocabWords` / `vocabCursor` → **提交** →
然后调 `startOrResumeToday()`，却只转了 `studentName` 与 `studentId`。
token-only 请求里这两个都是空的 → `today()` 落到
`resolveByIdOrName(undefined, '')` → `name_required`。
**写已经落库，请求却 400。**

根子比这更深：`today()` 的**入参类型里根本没有 `authStudentId`**。
`getToday` / `startOrResumeToday` 都声明了它、也都 `...input` 传了进来，
但 `today()` 从不读它。`GET /lesson/today` 之所以能跑通，是因为控制器
把令牌 id 塞进了 `studentId` 这个槽位 —— 能用，但那是绕过去的，任何
**直接调服务**的地方都会掉进坑里。

**为什么上一轮的 26 条运行期用例没抓到**：它们用**真控制器 + 假服务**，
证明的是「控制器把 `authStudentId` 交给了服务」，到此为止。服务内部再调
另一个身份相关方法时把它丢掉 —— 假服务根本不执行那段代码，于是全绿。

> **证据边界（必须照实引用）**
>
> | 文件 | 证明了什么 | **没有**证明什么 |
> |---|---|---|
> | `endpoint-matrix.spec.ts` | 端点清单与控制器接线 | 跑起来能不能过 |
> | `token-only-runtime.spec.ts` | 控制器 → 服务边界的身份与响应 | **服务内部**的调用链 |
> | `service-identity-chain.spec.ts` | 真服务 + 假 Prisma 的**服务内部**身份链 | 真库、真部署 |
>
> **26 个端点没有做到端到端的真服务全链覆盖。** 已覆盖的是：两个已知的
> 服务→服务身份组合点，加上 lesson 的三个入口。其余端点的服务方法都是
> 「解析一次然后自己干活」的叶子，不存在第二次解析。

**修复**（业务逻辑一行未动：cursor、firstTaughtAt、stage、队列口径全部照旧）：

1. `today()` 入参加上 `authStudentId`，并**真的用它** ——
   `resolveAuthenticatedStudent()`，与 vocab / morning-quiz 同一套资格谓词。
2. `markTaughtAndAdvance()` 把 `authStudentId` 转给 `startOrResumeToday()`。
3. `VocabQuizAttemptService.start()` 把 `authStudentId` 转给 `buildQuiz()`。
4. 控制器的 `today` / `start`：有令牌时**只传 `authStudentId`**，不再把
   令牌里的姓名塞进 `studentName`（令牌签发后姓名可能改过）。
   `student_required` 这个旧错误码原样保留。

#### 内部身份组合点审计（26 条链，控制器边界之外）

| 位置 | 形态 | 结论 |
|---|---|---|
| `LessonService.markTaughtAndAdvance` → `startOrResumeToday` | 服务调服务 + 二次解析 | **缺陷，已修** |
| `VocabQuizAttemptService.start` → `VocabQuizService.buildQuiz` | 服务调服务 + 二次解析 | **缺陷，已修**（发生在建 attempt **之前**，无脏数据，但端点不可用） |
| `LessonService.today` → `mistakes.practiceQueue(studentId, …)` | 传的是**已解析的 id** | 安全 |
| `VocabQuizService.buildQuiz` → `review.streakDays(student.id)` | 传的是**已解析的 id** | 安全 |
| `LessonService.classBoard` → `getToday({name, id})` | 教师端，传库里查出的 id | 不在学生令牌链上 |
| vocab 五个服务的其余方法 | 叶子：解析一次后自己干活 | 无二次解析 |
| morning-quiz 的 `skillProfileByName` / `upcomingForName` / `startPractice` / `getPractice` / `submitPractice` / `historyTrendByName` | 两参数解析 | **范围外，未改**（并由测试钉住不得被顺手改动） |

#### 一处需要点名的行为变化

token-only 的 `GET /lesson/today` 与 `POST /lesson/start`，资格判据从
**旧的 id 路径**（只查 `isActive` + 在读班级）换成了**阶段 5A 的那一套**
（另加 `role='student'` + `archivedAt=null`）。**是收紧不是放宽**，且与
vocab / morning-quiz 一致。受影响的只有一种人：拿着扫码当天令牌
（不带 `av`、守卫不查库）却已经被归档或改了角色的学生 —— 他们现在会拿到
`student_not_eligible`。**旧的无令牌路径判据一字未改**，并有测试钉住。

**退出条件（5A）**：`apps/api` / `apps/student-web` / `apps/web` 全量绿；
26 个端点**逐条运行期**通过（含响应回显）；**服务内部的身份组合点
全部由真服务测试覆盖**
**风险**：中 —— 改动面广，但每处都是「加一条快路径」
**回滚**：`git revert` 本阶段提交（纯增量，旧端不受影响）

### 阶段 5B —— 部署与联调验证　⬜ **未授权**

设计已成形，**尚未执行、也未申请执行**。以下是本轮更正后的口径。

#### 两个判据必须分开记

| 判据 | 含义 |
|---|---|
| **IDENTITY-PASS** | 已部署的请求带令牌、零身份入参地**走到了业务层** —— 没有 `name_required`、`student_token_required`、`identity_mismatch`，也没有触发按姓名查人 |
| **BUSINESS-PASS** | 端点走完了它**正常的成功路径** |

阶段 5B 验的是 **token-only 身份集成**。因此：**一个由代码可证明的、
状态依赖的业务错误**（`no_task` / `no_attempt` / `stage_not_ready` /
`{updated:0}`）**可以记 IDENTITY-PASS，但永远不能记 BUSINESS-PASS。**
两者分列两栏，不得合并成一个「通过数」。

#### 加词 / 删词往返：`zzqx-probe` 是无效设计

`addWord()` 第二步就是 `vocab.lookup(word)`，查不到直接
400 `word_not_in_dictionary`（CODE-VERIFIED）。造词永远进不了成功路径。

正确的可逆探针：

1. 先挑一个**真实词典里有**的词；
2. `GET /vocab/words` 确认它**不在**该学生的生词本里（不确认就做，删除
   步骤会把学生本来就有的词连同复习历史一起删掉）；
3. `POST /vocab/words` 加；
4. `POST /vocab/words/remove` 删；
5. `GET /vocab/words` 复核已回到第 2 步的状态。

另有一条**零写入**的成功路径：拿一个该学生**已经有**的词去 `addWord`，
返回 `{created:false}`，不写库。它同时是 IDENTITY-PASS 与 BUSINESS-PASS。

#### 授权不得混用

**C1（Railway 只读）+ C3（部署 stg-api）+ L-R（实机只读 GET）
不能授权任何 POST 探针** —— 哪怕代码可证明它不写库。

要跑「预期零写入的 POST 身份探针」（`{cursor:0}`、删一个不存在的词、
拿已有的词 addWord、t7 的 `lesson/start`），需要一项单独的窄授权
**L-P（expected-no-write POST identity probes）**，逐条列出请求体；
否则这些探针**不进 5B1**，整体推到 5B2。

#### 阶段 5 不挂靠阶段 14 的夹具重建

除非某条**身份属性**离开夹具就无法验证，否则不得把阶段 5 的完成度绑在
阶段 14 上。身份属性（令牌解析、精确 id、无消歧、无姓名回落）**不依赖**
课程状态 —— 状态依赖的只是 BUSINESS-PASS。所以：
**IDENTITY-PASS 覆盖 26/26 是阶段 5B 的完成判据；BUSINESS-PASS 的缺口
如实列出，随夹具重建另行补齐，不阻塞阶段 5。**

#### 关于 staging 现况的一切断言均为 UNVERIFIED

以下都是**从代码与夹具脚本推导**的预期，**没有一条被实机观察过**，
执行时必须先观察再断言：

- 错题本为空（夹具从不建 `MistakeEntry`）
- 测试七号今天「无内容」
- 今日 `DailyLessonCompletion` / `VocabQuizAttempt` 不存在
  （夹具的日期作用域行钉在运行当天）
- 八个账号仍在其原始场景上（4B2 已观察到 `测试一号` 漂移，其余七个未审计）

#### 执行前仍需先记录的部署事实

`stg-api` 当前部署 ID 与其对应提交 —— **UNVERIFIED**，它同时是回滚锚点。
迁移不变可离线证明：`git diff <目标> -- apps/api/prisma/migrations/` 为空、
`schema.prisma` 无差异、迁移目录 35 项。健康检查 `GET /api/health`（liveness）
与 `GET /api/health/ready`（readiness）。`STUDENT_APP_V2` **全程保持未设**。

**5B 未做之前，阶段 5 整体仍为 PENDING。**

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
- [ ] **（原 M10，显性残余风险）** 真实适配器建好之后，在**已装旧 PWA
      的设备**上验证：从 standalone 壳里点进适配器 → 能否真的到达新源、
      到达后是留在壳里还是弹回 Safari。**这是阶段 3 推迟过来的一项**，
      当时因缺测试载体无法验证，**当时也刻意没有为它临时造载体**
- [ ] **（原 M6–M9）SW 退役与更新行为**：旧端更新是否生效、
      `unregister()` 旧 SW、删除 `zaoce-pwa-v4` 缓存、以及这些操作的
      回滚。本阶段是第一次真正实现 SW 退役，这几格归这里

**退出条件**：G5 绿；从新端任何页面**无法**回到旧页面
**风险**：中 —— 已装 PWA 的学生是主要受影响面

---

## 阶段 14 —— staging 八账号实机验收

### 🔴 具名硬验收项（从阶段 4B2 移交）

**教师重置链条 —— 认证生命周期里唯一未验证的出口判据。**

- [ ] 打通 staging 的教师登录（**注意**：重跑版本化种子**不能**解决 ——
      教师行是 `ON CONFLICT DO NOTHING`，不会替换已存在的口令。
      需要另建教师账号，或在夹具里显式处理教师口令，属本阶段夹具规划）
- [ ] 在测试机上登录 `测试七号` 并保持会话
- [ ] 另开干净浏览器，连错到锁定阈值（**5 次**）→ 验 `pin_locked` 与
      可读的重试时间
- [ ] 教师**只重置 `测试七号`**
- [ ] 回到原先已登录的会话刷新 → 验旧令牌被拒为 `token_revoked`、
      身份被清、回到 `/login`、显示重置提示
- [ ] 用原始 staging 口令**重新注册** → 直达 `/today` → 退出 → 再登录
- [ ] 确认该账号不再处于锁定态

**这一项不得被静默勾掉。** 它在阶段 4B2 因恢复路径无法证明而未执行
（不是失败，是缺条件）。

### 🔴 具名残留项（从阶段 4B2 移交）

- [ ] **`测试一号` 的课程场景已偏离种子初始态**（观察到 `vocab_test`，
      种子应为 `ready_to_start`）。**成因 UNVERIFIED** —— 需日志或读库
      才能确定。重新播种可恢复；播种前后各记一次场景分类

### 🔴 具名残留项（从阶段 4B2 移交）—— 同名消歧

- [ ] 现场重复姓名验证（当前八账号夹具姓名唯一，**NOT APPLICABLE**）。
      本阶段规划夹具时决定是否引入一对同名账号

---

**前置（来自阶段 3 的 S7，必须逐项确认后才能播种）**：

- [ ] 夹具的安全执行环境已确定并验证（S7-1）
- [ ] 目标库确认是隔离的 staging / 测试库（S7-2）
- [ ] **外发通知已关闭并验证**：`NotificationConfig` 中
      `enabled = true` 为 0、`NotificationLog` 为 0、外发开关未设置
      （S7-3）—— **先验证，再播种**
- [ ] 知悉播种会使 `studentAuthVersion` +1、踢掉所有在测设备（S7-4）

以上任何一项没有结论 → **不得执行夹具**，本阶段不能开始。

> **（原 S7）** 这四项是阶段 3 移交过来的，现在是**本阶段的硬前置**。
> 它**不阻断阶段 4** —— 阶段 4 不需要播种任何数据。

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
