# 新学生端架构、路由契约与回归守卫

> R0 · 2026-08-27 · 审计基线 commit `82b9cb0`
> **R0.1 修订** · 基线 `8303d1e` —— 修正后端职责边界、补齐 token-only
> 影响面、补部署闭环、独立灰度开关、补认证与生命周期流程。
> **设计文档，未实施。**

产品决定见 [product-decisions.md](./product-decisions.md)。

---

## 1. 根因

不是「几个返回链接没改」。是**一个前端同时服务三个产品定义**，
而且三者互相承重：

1. `apps/web` 的路由树里，学生请求会落进**两个不同的外壳**（教师时代的
   JWT 学生外壳 / 账号制公开白名单），取决于路径是否在一张手写的
   白名单里。刷新一次就可能换壳，未知 URL 的兜底是 `/student`。
2. **后端 `next-action.ts` 硬编码了旧产品的前端路由**（`/morning-quiz/:id`、
   `/my-history/submission/:id`）—— 七步链第 3、4 步本来就走在旧页面上。
3. **`/vocab/*` 的 API 契约仍是姓名制**（实测 8 个端点无 `name=` 直接 400）。
4. 新账号体系**主动回写**旧身份键 `mq:history:*`。

---

## 2. 三个方案

### 方案 A：继续在当前 `apps/web` 内修补

没有边界。同一个路由树里，任何人再加一个页面，默认还是能跳到
`/my-history`；CI 只能靠正则黑名单，无法表达「canonical 只能到
canonical」。`App.tsx` 747 行里有 4 个 return 分支决定渲染哪个外壳，
`*` 兜底有 3 个不同目标。**不推荐** —— 这正是已经试过并失败的做法。

### 方案 B：新建独立 `apps/student-web`（推荐）

**物理边界**：新包里根本不存在 `/my-history`、`/scan`、`/student`
这些路由，CI 守卫可以是一条 grep。在 `apps/web` 里做不到 —— 那里
它们全都是合法的。monorepo 已有 4 个 app 包（`api`/`web`/`miniprogram`/
`ops-dashboard`），多包不是新概念。

共享成本已统计：学生页面依赖约 25 个共享模块，主要是
`lib/api`(11)、`components/AsyncState`(9)、`lib/track`(7)、`lib/speech`(3)、
`lib/registration`(3)。多是纯函数或小组件。

**代价**：过渡期两个前端并存，需要部署闭环（见 §7）—— 这是本方案
唯一真正未解决的部分。

### 方案 C：全系统从零重写

丢掉 902 + 236 个已验证测试、34 条迁移和真实历史数据，而后端的问题
只有两类（`next-action.ts` 的 href、`/vocab/*` 的姓名口径），都是局部
修改。**不推荐**。

---

## 3. 推荐架构

```
apps/
  api/            ← 保留。业务规则、数据库、迁移不动
  student-web/    ← 新建。账号制英语学习 App
  web/            ← 冻结为教师后台 + 旧链接兼容层
  ops-dashboard/  ← 不动
  miniprogram/    ← 不动
```

---

## 4. 新路由契约

### 4.1 URL 形态

- **[已定案 2026-08-27]** 拓扑为 **A（独立源）**（[D7](./product-decisions.md)）
  → 新端**独占一个源的根路径**，**不需要 `/app` 前缀**。
  下文仍写 `/app/…` 只是为了与已有的矩阵对照方便；**实现时整体去掉
  `/app` 前缀，页面清单与矩阵不变**。
- **任何 canonical URL 不带 `name`、`studentId`、`then`、`after`**。
- 参数只允许出现**资源 id**，且服务端一律用令牌校验归属。

| 路由 | 页面 | 属于 |
|---|---|---|
| `/app/login` | 登录 | 外壳 |
| `/app/register` | 首次注册（设密码） | 外壳 |
| `/app/today` | 今天的课 | 七步链 ① |
| `/app/lesson/reading` | 阅读答题 | 七步链 ② |
| `/app/lesson/reading/result` | 阅读结果 | 七步链 ③ |
| `/app/lesson/vocab` | 学习本次单词（**课程队列**） | 七步链 ④ |
| `/app/lesson/test` | 正式单词测试（**计入成绩**） | 七步链 ⑤ |
| `/app/lesson/summary` | 今日总结 | 七步链 ⑥ |
| `/app/scores` | 历史成绩 | 独立页面 |
| `/app/scores/:submissionId` | 单场逐题解析（含申诉） | 独立页面 |
| `/app/vocab` | 生词本 | 独立页面 |
| `/app/vocab/practice` | 自由练习翻卡（**不计分**） | 独立页面 |
| `/app/vocab/selftest` | 自测（**不计分**） | 独立页面 |
| `/app/mistakes` | 错题本 | 独立页面 |
| `/app/mistakes/practice` | 错题重练 | 独立页面 |
| `/app/account` | 账号设置（改密码 / 退出） | 外壳 |

**刻意的拆分**（现在是同一条路由承载两种语义）：
`/app/lesson/vocab` ≠ `/app/vocab/practice`；
`/app/lesson/test` ≠ `/app/vocab/selftest`。

### 4.2 页面 → 可进入页面矩阵

`✓` = 允许；空 = 禁止。**没有任何一格通向旧路由。**

| 从 \ 到 | login | register | today | reading | result | l/vocab | l/test | summary | scores | scores/:id | vocab | v/practice | v/selftest | mistakes | m/practice | account |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **login** | | ✓ | ✓ | | | | | | | | | | | | | |
| **register** | ✓ | | ✓ | | | | | | | | | | | | | |
| **today** | ✓¹ | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | | | ✓ | | ✓ |
| **reading** | ✓¹ | | ✓² | | ✓ | | | | | | | | | | | |
| **result** | ✓¹ | | ✓ | | | ✓ | | ✓ | | | | | | | | |
| **l/vocab** | ✓¹ | | ✓ | | | | ✓ | ✓ | | | | | | | | |
| **l/test** | ✓¹ | | ✓² | | | | | ✓ | | | | | | | | |
| **summary** | ✓¹ | | ✓ | | ✓ | | | | ✓ | | ✓ | | | ✓ | | |
| **scores** | ✓¹ | | ✓ | | | | | | | ✓ | | | | | | |
| **scores/:id** | ✓¹ | | ✓ | | | | | | ✓ | | | | | | | |
| **vocab** | ✓¹ | | ✓ | | | | | | | | | ✓ | ✓ | | | |
| **v/practice** | ✓¹ | | ✓ | | | | | | | | ✓ | | ✓ | | | |
| **v/selftest** | ✓¹ | | ✓ | | | | | | | | ✓ | ✓ | | | | |
| **mistakes** | ✓¹ | | ✓ | | | | | | | | | | | | ✓ | |
| **m/practice** | ✓¹ | | ✓ | | | | | | | | | | | ✓ | | |
| **account** | ✓¹ | | ✓ | | | | | | | | | | | | | |

¹ 只在**令牌失效**时发生 —— 回登录页，**不是**姓名页。
² 只在**退出确认**后发生（正式测试的退出必须二次确认）。

### 4.3 课程阶段 → 页面 —— **路由映射在新端，不在后端**

> **R0.1 修正**。R0 原稿写「把后端 `href` 改成新路由，旧端反向翻译」
> —— 那是错的：它把前端路由知识**继续留在后端**，只是换了一套地址，
> 而且逼旧端做反向映射，等于新增一层只为过渡而存在的耦合。

**契约**：

1. 服务端**只负责** `NextActionKind` + **资源 ID**。
2. **新端自行把 `kind` 映射成路由**，映射表是新端的
   `routes.contract.ts`，不出现在后端。
3. 迁移期**保留现有 `href` 字段原样**（旧端继续用），
   **新端完全忽略它**。
4. **旧端退役后**（阶段 **16e**）才把 `href` 字段删掉。

**代价**：`href` 在过渡期是死字段（对新端而言）。这是刻意接受的 ——
死字段比双向翻译层便宜得多，删除时机也明确。

**好消息：后端不需要为此改任何代码。** `NextActionKind` 九个取值已经
齐备（含 `read_result`），资源 ID 也已经在 `/lesson/today` 的
`segments.read` 里返回（`lesson.service.ts:354-355`：`sessionId`、
`submissionId`）。

| `kind` | 资源 ID 来自 | 新端映射到 |
|---|---|---|
| `no_content` | — | 停在 `/app/today`，显示「今天的课程还没有发布」 |
| `level_not_set` | — | 停在 `/app/today`，提示找老师 |
| `window_closed` | — | 停在 `/app/today` |
| `ready_to_start` | — | `/app/today` 的「开始今天的课程」按钮（POST 后按新 kind 走） |
| `resume_reading` | `segments.read.sessionId` | `/app/lesson/reading` |
| `read_result` | `segments.read.submissionId` | `/app/lesson/reading/result` |
| `learn_vocab` | — | `/app/lesson/vocab` |
| `vocab_test` | — | `/app/lesson/test` |
| `summary` | — | `/app/lesson/summary` |
| `none` | — | `/app/today` |

**待确认（阶段 3 的第一件事）**：`segments` 是否已经包含正式测试的
`attemptId`。审计只确认了 `read` 段有 `sessionId`/`submissionId`；
若词测段没有，需要给 `/lesson/today` **加一个只读字段**（加字段是
向后兼容的，不违反「后端不改」的精神）。

### 4.4 返回语义

**不使用任意 `then=` URL。** 返回目标由固定路由结构决定：

| 页面 | 返回 / 完成 / 跳过 / 出错 |
|---|---|
| 七步链任一页 | 一律回 `/app/today`，由 `nextAction.kind` 决定下一步 |
| `/app/scores/:id` | `/app/scores` |
| `/app/vocab/*` | `/app/vocab` |
| `/app/mistakes/*` | `/app/mistakes` |
| 令牌失效（任意页） | `/app/login` |
| 未知 URL | `/app/today`（已登录）/ `/app/login`（未登录） |

### 4.5 旧链接的单向适配 —— **目标 origin 可配置**

> **R0.1 修正**：R0 原稿把跳转目标写成相对路径，隐含「同域名」。
> 部署形态未定（§7），所以跳转目标必须是**可配置的 student app
> origin**，不能写死。

旧端读一个构建期/运行期变量（名字待定，暂记 `STUDENT_APP_ORIGIN`），
拼接目标地址：

```
target = STUDENT_APP_ORIGIN + <新端路径>
```

- 同域名双 SPA → `STUDENT_APP_ORIGIN = ''`，得到 `/app/today`
- 独立域名 → `STUDENT_APP_ORIGIN = 'https://<新域名>'`，得到绝对地址

| 旧 URL | 目标路径 | 方向 |
|---|---|---|
| `/my-history` | `/app/scores` | 单向 → |
| `/my-history/submission/:id` | `/app/scores/:id` | 单向 → |
| `/my-vocab*` | `/app/vocab*` | 单向 → |
| `/my-mistakes*` | `/app/mistakes*` | 单向 → |
| `/my-lesson*` | `/app/today` | 单向 → |
| `/me` | `/app/today` 或 `/app/login` | 单向 → |
| `/scan/:token` | 提示页 + 「去今天的课」→ `/app/today` | 单向 → |
| 旧 PWA `start_url` `/my-history` | `/app/today` | 单向 → |

**「单向」的强制含义**：适配器只做跳转、不渲染旧页面；新端**不存在**
任何指回这些地址的链接。

**不在适配范围**：`/student/homework*`、`/student/tutor`（见
[D1](./product-decisions.md#d1--homework--ai-tutor-暂留旧系统)）——
它们留在旧端，新端既不跳过去也不从那里跳回来。

---

## 5. token-only 身份 —— 完整影响面

> **R0.1 修正**：R0 原稿只写「改 `resolveStudent`」。那不够 ——
> 身份要贯穿 **Guard → `req.studentAuth` → controller → 校验 schema →
> service → 测试** 五层，任何一层漏了，新端就还得发姓名。

### 5.0 目标口径

| | 新端 | 旧端（过渡期） |
|---|---|---|
| 发送 `name` / `studentId` | **不发** | 继续发 |
| 服务端取身份 | `req.studentAuth` | `req.studentAuth`，缺失时回退参数 |
| 令牌与参数**冲突** | — | **继续 403 `identity_mismatch`** |
| `teacher_view` 令牌 | 只读，写操作 403 `teacher_view_is_read_only` | 同 |

**参考实现已存在**：`apps/api/src/lesson/lesson.controller.ts:48-51`

```ts
const auth = (req as { studentAuth?: { id: string; name: string } }).studentAuth;
const sid = auth?.id ?? studentId;
const sname = auth?.name ?? name;
if (!sid && !sname?.trim()) throw new BadRequestException({ code: 'student_required' });
```

其余端点照这个口径改。**注意**：这不是「删掉 name 参数」，是
「令牌优先、参数变可选」。

### 5.1 Guard 层

`apps/api/src/common/student-identity.guard.ts`

- 已有：解析令牌 → 校验 `studentAuthVersion`（`av`）→ 校验 `isActive` →
  与 `name`/`studentId` **一致性比对**（不一致 403 `identity_mismatch`）
  → 写入 `req.studentAuth`。
- **要改**：当请求**没有** `name`/`studentId` 时，不得因为「无从比对」
  而拒绝；有令牌即通过并写入 `req.studentAuth`。
- **不改**：规则 3（无令牌的读放行）保留到阶段 **16b** —— 旧端还在用。
- **不改**：`teacher_view` 只读判定。

### 5.2 Controller + 校验 schema 层（逐个列全）

#### `apps/api/src/vocab/vocab.controller.ts` —— 19 个学生端点

| 端点 | 取参方式 | 已要求令牌 |
|---|---|---|
| `GET words` | `@Query('name'/'studentId')` | 否 |
| `POST words` | zod `studentName` | ✓ |
| `POST words/remove` | zod `studentName` | ✓ |
| `GET due` | `@Query` | 否 |
| `GET lesson-cards` | `@Query` | 否 |
| `POST review` | zod `studentName` | ✓ |
| `POST review/undo` | zod `studentName` | ✓ |
| `GET quiz` | `@Query` | 否 |
| `GET mistakes` | `@Query` | 否 |
| `POST mistakes/resolve` | zod `studentName` | ✓ |
| `GET mistakes/practice-queue` | `@Query` | 否 |
| `POST mistakes/practice-result` | zod `studentName` | ✓ |
| `POST page-view` | zod `studentName` | ✓ |
| `GET stats` | `@Query` | 否 |
| `POST quiz/attempt/start` | zod `name` | ✓ |
| `GET quiz/attempt/current` | `@Query` | ✓ |
| `POST quiz/attempt/answer` | zod `name` | ✓ |
| `POST quiz/attempt/submit` | zod `name` | ✓ |
| `GET quiz/attempts` | `@Query` | ✓ |

`GET lookup`（查词典）无身份，不受影响。
`class/:classId/*`、`push`、`stats` 的教师分支不受影响。

**zod schema 改动**：上述 9 个写端点的 `studentName: z.string().min(1)`
/ `name: z.string().min(1)` 一律改为 **`.optional()`**，改由 controller
在拿到 `req.studentAuth` 后决定是否必填。

#### `apps/api/src/lesson/lesson.controller.ts` —— 4 个

| 端点 | 状态 |
|---|---|
| `GET today` | **已是 token-first**（参考实现） |
| `POST start` | **已是 token-first** |
| `POST vocab-taught` | zod `name` 必填 → 改可选 |
| `POST vocab-cursor` | zod `name` 必填 → 改可选 |

#### `apps/api/src/morning-quiz/morning-quiz.controller.ts` —— 7 个

| 端点 | 本轮范围 | 依据 |
|---|---|---|
| `GET history-by-name` | **在** | D2 历史成绩第一版 |
| `GET history-detail` | **在** | D2 逐题解析 |
| `POST appeals` | **在** | D2 申诉 |
| `GET upcoming-for-name` | 待定（新端是否需要） | — |
| `GET history-by-name/trend` | **不在** | D2 暂不迁移趋势图 |
| `GET skill-profile` | **不在** | D2 暂不迁移技能画像 |
| `GET practice/:practiceSubmissionId` | **不在** | D2 暂不迁移重做 |

`sessions/:id`、`sessions/:id/answer`、`sessions/:id/submit`（阅读页三件套）
**不收 `name`**，走 JWT `@CurrentUser()` —— 已经是令牌口径，不需改。

#### `apps/api/src/student-auth/student-auth.controller.ts`

`register` / `registration-status` / `login` 收 `name` 是**正当的**
（登录前没有令牌），**不改**。
`change-pin` / `me` 已是令牌口径。

#### `apps/api/src/attendance/attendance.controller.ts`

扫码时代，新端不用，**不改**。

### 5.3 Service 层

| 文件 | 函数 | 改动 |
|---|---|---|
| `vocab/student-word.service.ts:26` | `resolveStudent(rawName, studentId?)` | **加一条 `resolveStudentByAuth(auth)` 快路径**；原函数保留给旧端 |
| `vocab/vocab-review.service.ts` | 各方法收 `studentName` | 改为收「已解析的 student」或可选姓名 |
| `vocab/vocab-quiz-attempt.service.ts` | `start/current/answer/submit` | 同上 |
| `lesson/lesson.service.ts` | `getToday` / `start` | 已支持 `studentId` 优先 |
| `morning-quiz/morning-quiz.service.ts:3440` | `resolveStudentByName` | 加令牌快路径（仅 D2 范围内的三个端点） |

**注意**：`resolveStudent` 现在还承担**同名消歧**（`candidates.length > 1`
→ 403 `multiple_students_with_same_name`）和**近似姓名建议**
（`closeNames`）。令牌路径下这两件事都不该发生 —— 令牌里有确定的 id。
快路径要绕开它们，而不是复用。

### 5.4 测试层

| 测试 | 改动 |
|---|---|
| `vocab/*.spec.ts`（多个） | 现有用例传 `studentName`，保留；**新增**同数量的「只带令牌、不带姓名」用例 |
| `lesson/read-only-invariant.spec.ts` | 假 Prisma 与请求桩需支持无姓名 |
| `common/student-identity.guard.spec.ts`（若无则新建） | **必须**覆盖：无参数 + 有令牌 → 通过；参数与令牌冲突 → 403；无令牌 + 写操作 → 403；`teacher_view` + 写 → 403 |
| `morning-quiz/*.spec.ts` | D2 范围内三个端点的令牌用例 |
| **新增反向对照** | 把令牌快路径改回姓名口径 → 新用例必须变红 |

**验收判据**：新端的集成测试**一个请求都不带** `name`/`studentId`，
全流程仍然跑通。

---

## 6. V2 灰度开关（独立）

> **R0.1 修正**：R0 原稿写「沿用 `MORNING_QUIZ_ALL_DAY` 的
> `class:<id>` 灰度写法」。**禁止**。

理由：

- `MORNING_QUIZ_ALL_DAY` 的语义是「课程是否全天开放」，与「学生用哪个
  前端」**毫无关系**。复用会让一个变量控制两件不相干的事，回滚时
  互相牵连。
- 它是**班级粒度**；[D5](./product-decisions.md#d5--灰度按学生-id1-人--5-人--整班)
  要求**学生 ID 粒度**。

**新开关**（名字待定，暂记 `STUDENT_APP_V2`）：

| 值 | 含义 |
|---|---|
| 空 / `off` / `false` / `0` | 全部走旧端（默认） |
| `on` / `true` / `all` / `1` | 全部走新端 |
| `student:<id>,<id>,…` | **只有这些学生 ID** 走新端 |

**照抄 `all-day.ts` 的两条经验**：

1. **显式前缀**（`student:`）—— 非布尔又非 `student:` 前缀的值一律
   视为配置错误。
2. **生产环境非法值直接拒绝启动**（对应 `assertAllDayConfig`）。

**未决**：灰度判定发生在哪一层 —— 旧端路由层、入口代理层，还是
新端自己校验并把不该来的人送回旧端。取决于 §7 的部署结论。

---

## 7. 部署闭环　**✅ 已收口（2026-08-27）**

> **R0.1 新增**。R0 原稿默认 `/app` 前缀 + 一个独立 Railway 服务，
> 但**两者没有闭环** —— Railway 每个服务有自己的域名，`/app` 前缀
> 只有在同域名分流时才有意义。这个矛盾必须在写第一行页面代码之前解决。

### 7.1 两个方案

#### 方案 甲：独立域名

新端一个 Railway 服务、一个自己的域名（如 `app.<域名>`）。

| | |
|---|---|
| 优点 | 部署最简单，就是现在 `stg-web` 的做法；两个 SPA 完全隔离；**Service Worker 作用域天然分开** |
| 缺点 | **跨域**：新端调 API 要 CORS（`stg-api` 已经在做，成本已知）；学生要换书签/主屏图标；旧 PWA 的图标指向旧域名，只能靠跳转把人送过去 |
| 未验证 | 新域名的申请/解析；跨域下 PWA 安装引导要重写 |

#### 方案 乙：同域名双 SPA 分流

同一个域名，`/app/*` 给新端，其余给旧端。

> **[S2 2026-08-27] 方案 甲（独立源）已在 staging 上验证通过**，
> 见预检文档的 S2 一节。方案 丙（Edge Rule 重定向）**仍 UNVERIFIED** ——
> 它并不能绕过旧 Service Worker，理由见预检文档 §3.1。
>
> **[S1 2026-08-27] 这一节的成本已从「未知」变成「已知且确定」**：
> Railway 平台**不提供**路径级多服务转发，必须自建反向代理。
> 同时新增了方案 **丙（Edge Rule 重定向到独立源）**。
> 三方案的重算对比见
> [deployment-spike-preflight.md §3](./deployment-spike-preflight.md)，
> 那里是当前权威；本节保留为设计过程记录。

| | |
|---|---|
| 优点 | 学生的书签、主屏图标、二维码**全部继续有效**；同源，无 CORS；跳转是站内 |
| 缺点 | 需要一层分流（nginx / Railway 的路由能力 / 一个反代服务）—— **现在没有** |
| **硬风险** | **Service Worker 作用域冲突** |

### 7.2 Service Worker 是同域名方案的关键风险

现状（`apps/web/src/main.tsx:27-33`，`apps/web/public/sw.js`）：

- SW 注册在 `/sw.js`，**作用域是整个 `/`**
- 缓存名 `zaoce-pwa-v4`，`skipWaiting()` + `clients.claim()`
- 导航与 `/api/*` 走 network-first，其余同源 GET 走 cache-first
- **它已经装在全班 35 台手机上**

同域名部署下，这个 SW 会**接管 `/app/*` 的导航和静态资源**。
导航是 network-first，多半能工作；但：

- 新端的 hashed 资源会被**旧 SW** 按 cache-first 缓存进
  `zaoce-pwa-v4`，缓存的生命周期由**旧端的部署**控制
- 新端若要自己的 SW，两个 SW 在同一 origin 上按作用域竞争，
  `/app/sw.js`（作用域 `/app/`）可以共存，但**旧 SW 仍会先接管**
  `/app` 的首次导航
- 清理旧 SW 需要一次 `unregister` + `caches.delete`，而那要在**旧端**
  发布一次代码才能做到

**这不是可以边写边试的东西** —— 35 台真机上装着的旧 SW 是既成事实。

### 7.3 部署 spike（阻断阶段）

在写任何页面代码之前，必须先做完并给出结论：

- [x] **S1** ✅ **已完成**（2026-08-27，C1 只读）—— **Railway 不提供**
      路径级多服务转发：Edge Rules **能按路径匹配**，但五个动作
      （block / allow / challenge / **redirect** / override cache）
      **没有一个能转发到另一个服务**。因此**同源分流只能自建反向代理**；
      另发现第三个选项 **C：Edge Rule 路径重定向到独立源**（重定向 ≠
      反向代理，终点仍是跨源）。详见
      [deployment-spike-preflight.md §2–§3](./deployment-spike-preflight.md)（新增一个 nginx 服务？旧端 nginx 加 proxy_pass？）
- [x] **S2** ✅ **PASS**（2026-08-27）—— 新源（含深层路径）返回 spike 页，
      旧端 8 条路由零退化，两个源互不串扰
- [ ] **S3** 验证 Service Worker 行为：在**已装旧 SW** 的浏览器上打开
      新端路径，确认能拿到新版本、不吃旧缓存；确定旧 SW 的退役方式
- [ ] **S4** 确认灰度判定层（§6 未决项）在选定方案下怎么实现
- [x] **S5** ✅ **设计闭合** —— API 运行期下发 `appVersion` 与
      `studentAppOrigin`；换 origin **不需要重新构建前端**；实现归阶段 4
- [x] **S6** 🔶 **已移交** —— 跨源形态与 CORS 的实现与验证归
      **阶段 4 的 staging 集成出口条件**
- [x] **S7** 🔶 **已移交** —— 归**阶段 14 的硬前置**（播种前必须满足），
      **不阻断阶段 4**。原文如下：确定**八账号夹具的安全执行环境** —— 它已版本化但**尚未、
      也不得执行**：`stg-api` 是 `NODE_ENV=production`，夹具的第 1 道
      闸门会拒绝，而闸门**不加覆盖开关**。四项子条件（执行环境 /
      库隔离 / 外发通知先关并验证 / 令牌会被撤销的知情）见
      [migration-plan.md 阶段 3 的 S7](./migration-plan.md)

**退出条件**：staging 上两个空白页面同时可访问，旧 SW 环境下新端能
正确更新，灰度开关能把一个学生 ID 路由到新端，且 **S7 四项有结论**。

**没有这个结论就开始写页面 = 押注一个未验证的部署形态。**

---

## 8. 认证与生命周期流程（新端必须覆盖）

> **R0.1 新增**。R0 原稿只提了「登录」，漏掉了下面 11 项 —— 它们
> 每一项现在都在旧端有实现，新端要么迁移、要么明确不做。

| # | 流程 | 现有实现 | 新端要求 |
|---|---|---|---|
| 1 | **首次注册**（设密码） | `POST /student-auth/register`、`GET registration-status`、`lib/registration.ts`、`components/RegistrationSheet.tsx`；触发条件是「本机已知姓名 + 服务端说未注册」，**不可跳过** | `/app/register`。**触发条件要重设** —— 新端不读 `mq:history:name`，改为登录页上「还没注册？」入口 |
| 2 | **同名消歧** | 登录/注册返回 `needDisambiguation` + `candidates[]`（`student-auth.service.ts:84,207,246`）；`Me.tsx:98` 渲染候选人 | 登录页与注册页都要处理。选中后**只在这一次请求里**带 `studentId`，之后一律用令牌 |
| 3 | **登录** | `POST /student-auth/login`；错误码 `pin_locked`（含 `retryAfterSec`）、`invalid_credentials` | `/app/login`。错误文案不得出现「姓名或密码不对。还没注册？打开 App 时会引导注册」这类依赖旧触发条件的说法 |
| 4 | **改密码** | `POST /student-auth/change-pin`；错误码 `pin_too_weak`、`password_too_weak`、`pin_locked` | `/app/account` |
| 5 | **教师重置后重注册** | `POST /student-auth/admin/reset-pin` 清 `pinHash` 并 `studentAuthVersion++`；`GET admin/claim-status`；教师端 `Classes.tsx:705` 提示「学生下次扫码时重新设置」 | 学生侧：旧令牌**立刻失效**（`token_revoked`）→ 回 `/app/login` → 走注册。**教师端的提示文案要改**（不再是「扫码」）—— 但那是旧端文案，属阶段 2 |
| 6 | **令牌过期 / 撤销** | `exp`（30 天）；`av` 与 `studentAuthVersion` 不符 → 403 `token_revoked`；`isActive=false` / `archivedAt` 同样拒绝 | 统一处理：任何 401/403 `token_revoked` → 清令牌 → `/app/login`，**不是** `/my-history` |
| 7 | **退出** | `Me.tsx` 的 `clearIdentityState()` 清 segments/profile/nextAction/streak/pinSet/candidates | `/app/account` 的退出：清令牌 + 清全部身份态 + 回 `/app/login`。**不写 `mq:history:*`** |
| 8 | **teacher_view（教师以学生视角）** | `POST admin/view-token` 签 `scope: 'teacher_view'`；令牌存 **sessionStorage**（`lib/teacher-view.ts`）以免挤掉教师自己的登录；写操作 403 `teacher_view_is_read_only`；`components/TeacherViewBanner.tsx` 常驻提示 | **要迁移**。新端必须：读 sessionStorage 令牌、显示只读横幅、写操作按钮禁用或给出明确错误 |
| 9 | **离线 / 弱网** | `lib/reviewQueue.ts`：复习评分失败进 localStorage 队列，带 `requestId` 去重，48 小时过期；`components/exam/shared/OfflineBadge` | **要迁移**。课程学词与自由练习都依赖它。阅读页的答案自动保存是另一套（P8.5 服务端草稿 + `clientSeq`），一并迁移 |
| 10 | **404 / 未知 URL** | 旧端三个不同兜底（`/login`、`/student`、`/my-history`） | 新端**唯一**兜底：已登录 → `/app/today`；未登录 → `/app/login` |
| 11 | **PWA 冷启动** | `lib/lesson-entry.ts`：standalone + 无查询参数 + **有 `mq:history:name`** + 本会话未跳过 → 跳 `/my-lesson?name=…` | 新端**不需要这套** —— 新 `start_url` 直接是 `/app/today`，身份来自令牌。旧端的改道逻辑改为跳 `STUDENT_APP_ORIGIN + /app/today`，且**不再要求 `mq:history:name`** |
| 12 | **PWA 更新** | `sw.js` v4，`skipWaiting()` + `clients.claim()`，导航 network-first | 新端要有自己的 SW 与缓存名，且**必须先解决 §7.2 的旧 SW 接管问题**。更新策略沿用 network-first（它避免了陈旧部署陷阱，这条经验要保留） |

---

## 9. 回归守卫

### G1 —— canonical 包不得出现旧路由与姓名身份（静态扫描）

对 `apps/student-web/src/**` 扫描，命中即失败：

```
/my-history   /my-lesson   /my-vocab   /my-mistakes
/scan         /morning-quiz   /student/   /practice/
mq:history:name   mq:history:studentId
then=   after=submit   name=   studentId=
#h=   adoptHandoff
```

（`#h=` / `adoptHandoff` 对应
[D3](./product-decisions.md#d3--airdrop-跨设备接力只在旧端兼容期保留)。）

### G2 —— canonical 渲染不得出现旧语义文案

页面文本不含：`我的记录` · `返回我的记录` · `我的早测` · `早测` ·
`换学生` · `输入姓名` · `扫码` · `扫二维码` · `不用输名字`

### G3 —— 独立页面的四种非正常路径不得离开新端

生词本 / 错题本的 **完成 / 跳过 / 出错 / 刷新** 落点必须在
`/app/vocab*` 或 `/app/mistakes*` 之内。

### G4 —— 课程完成后只能进入总结或账号制页面

`/app/lesson/test` 交卷后落点 ∈ `{/app/lesson/summary, /app/today}`。

### G5 —— 旧链接在过渡期仍可用

`/my-history`、`/my-history/submission/:id`、旧 PWA `start_url`
在适配层下仍能跳到新端对应页。

### G6 —— 新增学生路由必须登记

新端 `routes.contract.ts` 为单一数据源；测试断言
`<Route>` 注册集合 === 契约集合。

### G7 —— 测试不得以旧页面存在作为新流程的成功断言

对 `apps/student-web/**/__tests__/**` 扫描：出现 `/my-history`、
`HISTORY PAGE`、`RESULT PAGE` 即失败。

### G8 —— **新端请求不得携带身份参数**（替代原 G8）

> R0 原稿的 G8 是「后端 next-action 的 href 必须在契约取值内」。
> 按 §4.3 的修正，后端不再输出新路由，这条守卫失去意义。
> 换成真正要守的东西：

对新端的集成测试，断言**所有出站请求**的 URL 查询串与请求体
**不含** `name` / `studentId`（除登录、注册、消歧这三处 pre-auth 场景）。

### G9 —— 新端 kind → 路由映射必须完整

断言 `NextActionKind` 的九个取值在新端映射表里**全部有目标**，
少一个即红。防止后端将来新增 kind 时新端静默落空。

---

## 10. 后端要保留的能力（不重写）

| 模块 | 保留理由 |
|---|---|
| `lesson/`（含 `rc11-rules.ts`） | 阶段机、目标冻结、完成度、连续天数 |
| `vocab/` | FSRS 调度、队列冻结、正式测试的幂等与评分 |
| `morning-quiz/` 的答卷与判分 | 阅读答卷、草稿保存（P8.5）、锁场、成绩 |
| `student-auth/` | 注册、PIN、令牌、`studentAuthVersion` 撤销、消歧 |
| `common/student-identity.guard.ts` | 越权阻断（实测有效） |
| 数据库 + 34 条迁移 | 真实历史数据 |
| 教师端全部模块 | 组卷、题库、判分、班级、排课、看板、家长 |
| `/student/homework*`、`/student/tutor` 的后端 | [D1](./product-decisions.md#d1--homework--ai-tutor-暂留旧系统)：暂留 |

**要改的**：§5 的 token-only 五层（Guard / controller / schema /
service / 测试）。**不改**：`next-action.ts`（见 §4.3）。

---

## 11. 学生端要移植的能力

> **R0.1 修正**：R0 原稿写了「低（逻辑照搬）」「代码直接保留」。
> **删掉这个说法**。现有学生页全部是**待移植能力**，不是可以搬过去的
> 代码 —— 它们的身份来源、返回语义、路由假设都建立在旧契约上，
> 每一页都要按新契约重写，只有**业务判据**可以参考。

| 能力 | 现有载体（参考，不照搬） | 新端页面 | 工作量 |
|---|---|---|---|
| 登录 | `Me.tsx` 登录卡 | `/app/login` | 小 |
| 首次注册 + 同名消歧 | `RegistrationSheet.tsx` + `lib/registration.ts` | `/app/register` | 中（触发条件要重设，见 §8-1） |
| 账号设置（改密码 / 退出） | `Me.tsx` 改 PIN 卡 | `/app/account` | 小 |
| 今天的课 | `MyLesson.tsx`（433 行） | `/app/today` | 中（身份 + kind 映射全新） |
| 阅读答题 | `MorningQuizTake.tsx`（1029 行） | `/app/lesson/reading` | **大** —— 题型渲染、草稿保存（`clientSeq`）、离线、返回拦截、倒计时 |
| 阅读结果 | `MyHistoryDetail.tsx`（556 行） | `/app/lesson/reading/result` | 中（含申诉） |
| 课程学词 | `MyVocabReview.tsx` 的 `lessonContext` 分支 | `/app/lesson/vocab` | 中（拆分 + 离线队列） |
| 正式测试 | `MyVocabQuiz.tsx` 的 `formal` 分支 | `/app/lesson/test` | 中（拆分 + 退出确认） |
| 今日总结 | `TaskSummary.tsx`（202 行） | `/app/lesson/summary` | 小 |
| 历史成绩 | `MyHistory.tsx`（857 行） | `/app/scores` + `/app/scores/:id` | 中（**只做 [D2](./product-decisions.md#d2--历史成绩第一版的范围) 六项**；姓名查询、消歧、IP 门禁整套不迁） |
| 生词本 | `MyVocab.tsx`（410 行） | `/app/vocab` | 小 |
| 自由练习 / 自测 | 上面两个文件的另一分支 | `/app/vocab/practice`、`/app/vocab/selftest` | 中 |
| 错题本 / 重练 | `MyMistakes*.tsx`（773 行） | `/app/mistakes*` | 小 |
| teacher_view 只读 | `lib/teacher-view.ts` + `TeacherViewBanner` | 全局 | 小 |
| 离线队列 | `lib/reviewQueue.ts` | 全局 | 中 |

**明确不移植**：扫码、考勤、姓名查询、候选人「输名字」入口、
AirDrop handoff、`then=` 链式跳转、作业、AI 家教、重做、趋势图、
技能画像。
