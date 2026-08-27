# 学生端入口清单与分类

> R0 · 2026-08-27 · 审计基线 commit `82b9cb0`（工作区干净，本地领先
> `origin/main` 37 个提交，未 push）
> **R0.1 修订** · 基线 `8303d1e` —— 按 D1/D2 调整分类与计数。
> 全部结论有代码位置或实测证据。**未修改任何行为。**

产品决定见 [product-decisions.md](./product-decisions.md)。

分类口径：

| 记号 | 含义 |
|---|---|
| **CANONICAL** | **能力**在新学生端保留 —— 页面本身仍须按新契约重写，不是搬代码 |
| **ADAPTER** | 只作旧链接兼容跳转 |
| **LEGACY** | 过渡期保留，新流程禁止进入 |
| **LEGACY_RETAINED** | 保留在旧系统，新端不展示，**且没有删除计划**（R0.1 新增，见 [D1](./product-decisions.md#d1--homework--ai-tutor-暂留旧系统)） |
| **DELETE_LATER** | 稳定切换后删除 |
| **TEACHER_ONLY** | 教师端专用 |

---

## 0. 先说三条决定性的结构事实

这三条不是某个页面的毛病，是**架构层面的**，决定了后面所有分类。

### 事实一：学生端有两个互不相干的外壳

`apps/web/src/App.tsx` 里，学生请求会落进**两个完全不同的分支**：

1. **公开白名单分支**（`App.tsx:130-174`）—— `/me`、`/my-lesson`、
   `/my-lesson/summary`、`/my-history*`、`/my-vocab*`、`/my-mistakes*`。
   不走教师 JWT 守卫，自带 PIN 登录卡。
2. **JWT 学生角色分支**（`App.tsx:264-318`）—— `/student/*`、`/practice`、
   **`/morning-quiz/:sessionId`**。渲染的是教师时代的学生外壳：英文导航
   `📝 My Papers / Homework / 错题本 / Past-Paper Practice` + Logout。

**实测**：PIN 登录签发的就是完整学生 JWT ——

```
POST /api/student-auth/login  →  token
GET  /api/auth/me  (Bearer token)  →  200
{"id":"t1_normal","role":"student",...}
```

所以刷新之后 `useAuth().user.role === 'student'` 成立，**任何不在白名单里
的 URL 都会落进第二个外壳**，而它的兜底是
`<Route path="*" element={<Navigate to="/student" replace />} />`
（`App.tsx:312`）—— 账号制 App 的 404 落点是教师时代的「My Papers」。

### 事实二：阅读页和阅读结果页本来就是旧产品的页面

服务端的 next-action **硬编码**了这两个地址
（`apps/api/src/lesson/next-action.ts`）：

| 行 | 阶段 | href |
|---|---|---|
| 114 | `resume_reading` | `/morning-quiz/${sessionId}` ← JWT 学生外壳 |
| 121 | 阅读结果 | `/my-history/submission/${submissionId}` ← 姓名查询族 |
| 126 | `learn_vocab` | `/my-vocab/review` |
| 133 | `summary` | `/my-lesson/summary` |
| 135 | `vocab_test` | `/my-vocab/quiz` |

七步链里**第 3、4 步整体落在旧产品的页面上**，而且是后端指定的。
`MorningQuizTake.tsx:207` 交卷后 `navigate('/my-history/submission/:id?name=…')`，
`:214` 无姓名时 `navigate('/my-history')`，`:239` 出错时
`navigate('/student')`。

这就是「为什么总是能跳回 `/my-history`」的答案 —— **不是某个返回按钮
没改，是主流程本身就走在那里。**

### 事实三：身份在三个地方，且新流程依赖旧的那个

| 层 | 身份来源 | 证据 |
|---|---|---|
| 服务端 `/lesson/*` | **只认令牌** | 无 token → `403 student_token_required`（实测） |
| 服务端 `/vocab/*` | **硬性要求 `name=`** | 无参数 → `400 name_required`（实测，8 个端点） |
| 服务端旧读通道 | **姓名即身份** | 无 token 直接读到 `/vocab/words`、`/vocab/mistakes`、`/morning-quiz/history-by-name`（实测 200） |
| 前端 `/my-lesson` | **URL 参数 → localStorage，不看令牌** | `MyLesson.tsx:143-159` |
| PWA 冷启动改道 | **必须有 `mq:history:name`** | `lib/lesson-entry.ts:63,85` |

`Me.tsx:104-105` 在 PIN 登录成功时**主动回写** `mq:history:name` /
`mq:history:studentId` —— 新账号体系在给旧姓名体系喂数据，因为下游
（`/my-lesson`、PWA 改道、`/vocab/*`）离了它跑不起来。

**安全性说明**：越权是被堵住的 —— 带 A 的令牌请求 B 的数据一律
`403 identity_mismatch`（实测 4 个端点）。问题不是越权，是**耦合**。

---

## 1. 逐入口清单

### `/me` —— 学生个人主页

| 项 | 内容 |
|---|---|
| 产品时代 | 账号制（`student-auth-and-home.md`，2026-08-25） |
| 认证 | 公开路由白名单 + 页内 PIN 登录卡 |
| 身份来源 | 登录后 `auth_token`；**同时回写** `mq:history:name/studentId` |
| 数据来源 | `/student-auth/login`、`/student-auth/me`、`/lesson/today`、`/vocab/*` |
| 进入路径 | 手输、书签、`/scan/:token` 页的「/me」链接（`MorningQuizScan.tsx:439`） |
| 出口 | `/my-lesson?name=&studentId=`（`Me.tsx:411,426`）· `/my-history?name=&studentId=`（`:461`）· `/my-vocab?name=`（`:462`）· `/my-mistakes?name=`（`:463`）· **`/my-history` 裸链**（`:353`）· `/my-history/submission/:id?qs`（`:176`） |
| 新流程使用 | 是 —— 它是登录入口 |
| 分类 | **CANONICAL 能力**（登录 + 账号设置）—— 页面重写：去掉 URL 身份、停止回写 `mq:history:*`、注册触发条件重设 |

### `/my-lesson` —— 今天的课

| 项 | 内容 |
|---|---|
| 产品时代 | 4.0 每日一课（P8/P9） |
| 认证 | 公开白名单 |
| 身份来源 | **URL `?name=&studentId=` 优先，其次 localStorage；不读令牌**（`MyLesson.tsx:143-159`） |
| 数据来源 | `POST /lesson/start`（打开页面 = 命令） |
| 进入路径 | 新装 PWA 的 `start_url`、`/me` 主按钮、PWA 冷启动改道、`/my-lesson/summary` 返回 |
| 出口 | `nextAction.href + ?qs`（五种，见事实二）· 页脚 `/my-history?qs`（`:423`）· 页脚 `/me`（`:426`）· 阅读段卡片 → `/my-history/submission/:id?qs` |
| 空/错状态 | 无 `name` → 文案「请从个人主页进入」（`:178`）—— **令牌有效也照样报错** |
| 新流程使用 | 是 —— 主入口 |
| 分类 | **CANONICAL 能力** —— 页面重写：身份改令牌、`kind` → 路由映射在新端 |

### `/my-lesson/summary` —— 今日总结

| 项 | 内容 |
|---|---|
| 产品时代 | P8 |
| 认证 | 公开白名单 |
| 身份来源 | URL 参数 / localStorage（`TaskSummary.tsx:65`） |
| 数据来源 | `GET /lesson/today`（纯读，不写） |
| 进入路径 | nextAction `summary` |
| 出口 | `/my-lesson?qs`（`:110`） |
| 新流程使用 | 是 |
| 分类 | **CANONICAL 能力** —— 页面重写（工作量最小的一个） |

### `/my-history` —— 我的记录（姓名查询）

| 项 | 内容 |
|---|---|
| 产品时代 | 早测 2.0（2026-08-11），学生**不登录** |
| 认证 | 公开；**无令牌可用** |
| 身份来源 | URL `?name=` / 页内输入框 / `mq:history:name` |
| 数据来源 | `/morning-quiz/history-by-name`（**无 token 实测 200**） |
| 进入路径 | 已装 PWA 图标（烧死的 `start_url`）· 大屏二维码（`MorningQuizDisplay.tsx:158`）· 扫码页（`MorningQuizScan.tsx:663`）· `/me` 的「成绩记录」· **未登录学生流的兜底**（`App.tsx:250`）· 生词本 / 错题本 / 词测 的返回链接 · 阅读交卷兜底 |
| 出口 | `/my-history/submission/:id?name=` · `/practice/:id?name=` · `/my-vocab?name=` · `/my-vocab/quiz?name=` · `/my-mistakes?name=` |
| 新流程使用 | **是（不该）** —— 它是七步链第 4 步的父级，也是多处返回目标 |
| 分类 | **LEGACY**（过渡期保留）→ 之后 **ADAPTER** → **DELETE_LATER** |

### `/my-history/submission/:submissionId` —— 阅读结果页

| 项 | 内容 |
|---|---|
| 产品时代 | 早测 2.0 |
| 认证 | 公开 + 姓名匹配 |
| 身份来源 | `?name=` |
| 数据来源 | `/morning-quiz/history-detail?submissionId=&name=` |
| 进入路径 | **服务端 next-action 硬编码**（`next-action.ts:121`）· `/my-lesson` 阅读段 · `/morning-quiz/:id` 交卷跳转 |
| 出口 | `/my-history?name=`（`:195` 返回）· `/my-vocab/review?…&after=submit&then=…`（`:263` 词汇横幅） |
| 新流程使用 | **是** —— 它就是七步链的「阅读结果」 |
| 分类 | 能力 **CANONICAL**，载体 **LEGACY** → 必须在新端重建 |

### `/my-vocab` —— 生词本

| 项 | 内容 |
|---|---|
| 产品时代 | 生词本 P2 |
| 认证 | 公开 + 姓名（读操作无令牌可用，实测） |
| 身份来源 | `?name=&studentId=` |
| 数据来源 | `/vocab/words`（**要求 `name=`**） |
| 进入路径 | `/me` 卡片 · `/my-history` · `/scan/:token` 页（`:669`） |
| 出口 | **`/my-history` 裸链**（`:142`）· `/my-history?name=`（`:153`）· `/my-vocab/review` · `/my-vocab/quiz` |
| 新流程使用 | 否（属于四个独立页面之一，不在七步链上） |
| 分类 | 能力 **CANONICAL**，当前出口 **LEGACY 依赖** |

### `/my-vocab/review` —— 词卡（课程学词 + 自由练习共用）

| 项 | 内容 |
|---|---|
| 产品时代 | 词汇 loop v2（2026-08-24）+ RC1.1（2026-08-27） |
| 认证 | 公开白名单；写操作要令牌 |
| 身份来源 | `?name=&studentId=` |
| 数据来源 | `/vocab/lesson-cards`（RC1.1 新，课程队列）；拿不到则退回 `/vocab/due`（自由练习） |
| 进入路径 | nextAction `learn_vocab` · 阅读结果页词汇横幅（带 `after=submit&then=`）· `/my-vocab` |
| 出口 | **`historyUrl` 共 5 处**（`:163` 空队列 / `:204` 接口失败 / `:267` 完成 / `:494` 跳过 / `:538` 结束）—— 它等于 `then=` 参数或 `/my-history?name=`（`:155`）· `/my-vocab?qs`（`:438`）· `/my-vocab/quiz?…&after=submit&then=…`（`:484`） |
| 新流程使用 | 是（七步链第 4 步） |
| 分类 | 能力 **CANONICAL**，**全部出口指向 LEGACY** |

> **课程学词与自由练习共用同一条路由**，靠 `lessonContext` 和 URL 参数
> 区分。契约要求两者路由分明 —— 这是必须拆的一处。

### `/my-vocab/quiz` —— 正式单词测试 / 自测

| 项 | 内容 |
|---|---|
| 产品时代 | 同上 |
| 身份来源 | `?name=&studentId=` |
| 数据来源 | `/vocab/quiz/attempt/*`（要求 `name=`） |
| 进入路径 | nextAction `vocab_test` · 词卡页 · `/my-vocab` · `/my-history`（`:588`） |
| 出口 | `backUrl` = `/my-vocab?name=`（`:138`，共 5 处）· `historyUrl`（`:225`）· **`/my-history` 裸链**（`:382`）· `historyUrl`「查看成绩」（`:595`）· ✕ 退出 → `backUrl`（`:622`） |
| 新流程使用 | 是（七步链第 5 步） |
| 分类 | 能力 **CANONICAL**，出口 **LEGACY 依赖** |

> 同一条路由同时承载「正式测试（计入成绩）」和「自测（不计分）」。
> 契约要求分明 —— 必须拆。

### `/my-mistakes` · `/my-mistakes/practice` —— 错题本

| 项 | 内容 |
|---|---|
| 产品时代 | 错题本 v2 |
| 身份来源 | `?name=&studentId=` |
| 数据来源 | `/vocab/mistakes`、`/vocab/mistakes/practice-queue`（要求 `name=`） |
| 进入路径 | `/me` 卡片 · `/my-history`（`:607`） |
| 出口 | **`/my-history` 裸链**（`MyMistakes.tsx:136`、`MyMistakesPractice.tsx:142`）· `/my-history?name=`（`:145`）· **「← 返回我的记录」**（`:161`）· `/my-mistakes?qs` · `then` 参数（`:88,97,188`） |
| 新流程使用 | 否（独立页面） |
| 分类 | 能力 **CANONICAL**，出口 **LEGACY 依赖** |

### `/scan/:token` —— 扫码

| 项 | 内容 |
|---|---|
| 产品时代 | 早测 1.0 |
| 认证 | **无登录**，扫码令牌 |
| 身份来源 | 扫码 token + 学生手输姓名 |
| 数据来源 | `/attendance/scan` 等 |
| 进入路径 | 墙上/大屏二维码 · `/scan?token=` 查询式（`App.tsx:729` 改写为路径式） |
| 出口 | `window.location.replace(quizUrl)` → `/morning-quiz/:id`（`:360,404,415`）· `/me`（`:439`）· `/my-history?name=`（`:663`）· `/my-vocab?name=`（`:669`） |
| 新流程使用 | 否（P9 已解除依赖，页面自己也这么写：`:446`「现在不用扫码也能上课」） |
| 分类 | **ADAPTER**（旧二维码兼容）→ **DELETE_LATER** |

### `/morning-quiz/:sessionId` —— 阅读答题页

| 项 | 内容 |
|---|---|
| 产品时代 | 早测 1.0/2.0 |
| 认证 | **只注册在 JWT 学生角色分支**（`App.tsx:311`） |
| 身份来源 | `useAuth().user`（PIN 令牌满足）；AirDrop 跨设备接力 `#h=<jwt>`（`lib/auth.ts:56-70`） |
| 数据来源 | `/morning-quiz/sessions/:id`、`PATCH …/answer`、`POST …/submit` |
| 进入路径 | nextAction `resume_reading` · 扫码跳转 · AirDrop 链接 |
| 出口 | 交卷 → `/my-history/submission/:id?name=`（`:207`）· 无姓名 → `/my-history`（`:214`）· **错误 → `/student`**（`:239`）· 窗口关闭 → `/my-history?name=`（`:292,462`）· 返回键 → `pushState` 拦截（`:136,141`） |
| 新流程使用 | **是** —— 它就是七步链第 3 步 |
| 分类 | 能力 **CANONICAL**，载体 **LEGACY** → 必须在新端重建 |

### `/student` · `/student/homework` · `/student/homework/:id` · `/student/mistakes` · `/student/take/:id` · `/student/result/:id` · `/student/tutor`

| 项 | 内容 |
|---|---|
| 产品时代 | 教师组卷系统的学生端（最早） |
| 认证 | JWT（教师签发的学生账号） |
| 身份来源 | JWT |
| 进入路径 | 该外壳的英文导航；**以及 PIN 学生刷新后任何未白名单 URL 的兜底**（`App.tsx:312`） |
| 出口 | 各自页面；`*` → `/student` |
| 新流程使用 | 否 —— 但**会被误落进去** |
| 分类 | **LEGACY_RETAINED**（[D1](./product-decisions.md#d1--homework--ai-tutor-暂留旧系统)：作业与 AI 家教暂留旧系统，新端不展示、不删除）。唯一要修的是那条 `*` 兜底：新端有自己的 404 语义，不再落到 `/student` |

### `/practice` · `/practice/:practiceSubmissionId`

| 项 | 内容 |
|---|---|
| 产品时代 | `/practice` 教师时代；`/practice/:id` R14 重做模式 |
| 注册位置 | **`/practice/:id` 注册了两次**（`App.tsx:196` 公开分支、`:309` 学生分支） |
| 身份来源 | `?name=` |
| 进入路径 | `/my-history` 的「🔄 重做」（`MyHistory.tsx:336`） |
| 出口 | `/my-history`（`PracticeMode.tsx` 4 处） |
| 新流程使用 | 否（[D2](./product-decisions.md#d2--历史成绩第一版的范围)：重做暂不迁移，新端不提供入口） |
| 分类 | `/practice/:id` **LEGACY**（过渡后自然无人访问，是否删留到阶段 16 再看）；`/practice` **TEACHER_ONLY** |

### PWA `start_url`

| 项 | 内容 |
|---|---|
| manifest 现值 | `/my-lesson`（`apps/web/public/manifest.webmanifest`） |
| 已装设备实际值 | **`/my-history`** —— 装过的图标烧死了，改 manifest 不生效 |
| 改道机制 | `lib/lesson-entry.ts`：standalone + URL 无任何参数 + **本地存过 `mq:history:name`** + 本会话未跳过 → 跳 `/my-lesson?name=…&studentId=…` |
| 风险 | 改道**硬依赖旧身份键**。清掉 `mq:history:name` 会让已装 App 冷启动停在 `/my-history` |
| 分类 | 改道逻辑 **ADAPTER** |

### 其他（非学生）

| 路由 | 分类 |
|---|---|
| `/display`、`/display/:sessionId`、`/qr-print` | TEACHER_ONLY |
| `/quick-attendance` | TEACHER_ONLY（教师个人工具） |
| `/parent/:token` | 非学生（家长门户） |
| `/login` | TEACHER_ONLY；但 `App.tsx:251,258` 把未登录学生也送这里 |
| 教师后台 40+ 条（`/papers`、`/questions`、`/marker`、`/classes` …） | TEACHER_ONLY |

---

## 2. 非正常路径的逐项审计

不是只看按钮 —— 下面每一行都对应契约里「不得导航到 legacy 页面」的一次
实际违反或风险。

| 情形 | 现在会发生什么 | 违反契约？ |
|---|---|---|
| **空状态**：今天没有词 | `MyVocabReview.tsx:163` → `historyUrl`（`/my-history`） | ✗ 违反 |
| **空状态**：到期队列空 | 停在页内并给「做一轮自测」链接（`:115` 测试锁死） | ✓ 可以 |
| **请求失败**：词卡接口挂 | `:204` → `historyUrl` | ✗ 违反 |
| **请求失败**：阅读页 | `MorningQuizTake.tsx:239` → **`/student`** | ✗ 严重违反 |
| **请求失败**：课程页无 name | 文案「请从个人主页进入」，不跳 | ⚠ 令牌有效也报错 |
| **令牌过期** | `lib/auth.ts` 清 token → `App.tsx:250` 学生流 → **`/my-history`** | ✗ 违反（应回登录页） |
| **阶段不允许** | 服务端 `409 stage_not_ready`（实测），前端按 nextAction 走 | ✓ 可以 |
| **没有内容** | `no_content`，`href: null`，停在课程页 | ✓ 可以（RC1.1 修复） |
| **点击跳过**（词卡） | `:494` → `historyUrl` | ✗ 违反 |
| **点击跳过**（词测 ✕） | `:622` → `backUrl` = `/my-vocab?name=` | ⚠ 正式测试可被 ✕ 退出 |
| **完成学习**（词卡） | `:267` → `historyUrl`；有 `then=` 时落到 `/my-history/submission/:id` | ✗ 违反 |
| **完成测试** | `:225` → `historyUrl` | ✗ 违反 |
| **浏览器刷新** | 白名单页正常；**非白名单页落进 JWT 学生外壳** | ✗ 违反 |
| **浏览器返回** | 阅读页用 `pushState` 拦截；其余页无拦截，可回到任意历史页 | ⚠ |
| **PWA 冷启动** | 已装图标 → `/my-history` → 改道（依赖 `mq:history:name`）→ `/my-lesson` | ⚠ 依赖旧键 |
| **直接打开旧链接** | 全部可达，且可反向进入新页面（`/my-history` → `/my-vocab/quiz`） | ✗ 违反「旧链接只能单向」 |
| **未知 URL** | JWT 学生 → `/student`；未登录 → `/login` | ✗ 违反 |

---

## 3. 分类计数

| 分类 | 条数 | 明细 |
|---|---|---|
| **CANONICAL 能力**（须在新端重建） | 9 | `/me`（登录+账号）、`/my-lesson`、`/my-lesson/summary`、阅读页、阅读结果、生词本、词卡、词测、错题本（含练习） |
| **LEGACY**（过渡保留，新流程禁入） | 3 | `/my-history`、`/my-history/submission/:id`、`/practice/:id` |
| **LEGACY_RETAINED**（保留且不删） | 7 | `/student` × 7（作业、AI 家教等） |
| **ADAPTER** | 3 | `/scan/:token`、`/scan?token=` 改写、PWA 改道 |
| **DELETE_LATER** | 11 | `/me`、`/my-lesson*`、`/my-history*`、`/my-vocab*`、`/my-mistakes*`、`/scan/*`、`/practice/:id` 的旧载体 |
| **TEACHER_ONLY** | 40+ | 教师后台全部 + `/display*`、`/qr-print`、`/quick-attendance`、`/practice`、`/login` |

**R0.1 的两处调整**：

- R0 原稿把三个页面记为「CANONICAL 直接保留」。**改了** —— 它们的
  身份来源、返回语义、路由假设都建立在旧契约上，**同样要重写**，
  只有业务判据可以参考。所有现有学生页一律是**待移植能力**。
- `/student/*` 从 `LEGACY → DELETE_LATER` 改为 **LEGACY_RETAINED**
  （[D1](./product-decisions.md#d1--homework--ai-tutor-暂留旧系统)）。

（`DELETE_LATER` 是 CANONICAL 旧载体与 LEGACY 在阶段 16 的去向，
不与上面重复计数。）

**学生端代码体量**：13 个页面文件 **7840 行**。
