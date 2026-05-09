# Round 7 上线前 Audit — Agent 4: AuthN & AuthZ

仓库 worktree: `agitated-pasteur-ac58d2`
审核范围: `apps/api/src/**/*.controller.ts` + 关键 service 层（IDOR 抽样）+ guards/中间件
日期: 2026-05-09

---

## 0. Auth Module 全局结构

### 全局守卫链（按执行顺序）

Nest 把所有 `APP_GUARD` provider 注册成全局，按 provider 注册顺序执行：

1. **`AuthGuard`** (`apps/api/src/common/auth.guard.ts`) — 在 `AppModule.providers` 注册
   - 读取 `@Public()` metadata，public 路由直接放行
   - 读取 `Authorization: Bearer …`，缺失时抛 401（但 `MOCK_AUTH=true` 会注入 `mock-teacher` 用户）
   - 用 `JwtService.verifyAsync` 校验 token，把 payload `{id, email, role, name}` 挂到 `req.user`
   - 读取 `@Roles(...)` metadata，role 不匹配抛 401（消息 "Insufficient role"，技术上应是 403）
2. **`InternalGuard`** (`apps/api/src/internal/internal-auth.guard.ts`) — 在 `InternalModule.providers` 注册
   - 同样是 APP_GUARD，但只对带 `@Internal()` 标记的路由生效；其他路由 `return true` 直接放过
   - 校验 `X-Internal-Token` header 与 `process.env.INTERNAL_API_TOKEN` 严格相等（非 timing-safe，但短 token 风险低）
   - 配合 `@Public()`（`@Internal()` 装饰器内部自动加 `@Public()`），跳过 JWT、走 token

### 模块级守卫

- **`IpAllowlistGuard`** (`apps/api/src/wifi-gate/ip-allowlist.guard.ts`) — 不是全局，仅在 `qr.controller.ts` / `attendance.controller.ts` 通过 `@UseGuards(IpAllowlistGuard)` 显式装。fail-closed：`SCHOOL_PUBLIC_IPS` 未配置时 403 拒绝所有请求。`SCHOOL_IP_BYPASS=true` 全部放行（dev only）。

### 缺装饰器的默认

全局 `AuthGuard` 在没有 `@Public()` 时**强制要求** JWT。**没有 `@Roles()`** 时只校验 token 合法、不限角色（即 4 类角色都可访问），这是 IDOR 滋生的高危区。

### 已知 fail-fast 启动检查（main.ts）

- `NODE_ENV=production` 且 `JWT_SECRET` 未设或 = `'dev-secret'` → `process.exit(1)` ✅
- `CORS_ORIGINS`/`ALLOWED_ORIGINS` 在 production 必须显式设置 → 否则 `process.exit(1)` ✅
- **没有** 对 `MOCK_AUTH` 的 prod 拦截 ❌（见 Finding F-1）
- **没有** 对 `SCHOOL_PUBLIC_IPS` 的 prod 拦截（运行时 fail-closed，但启动时静默）

### Token 模型

- 唯一 token 来源：`POST /api/auth/login`（密码校验，bcrypt） + `POST /api/attendance/scan`（扫码 mint scan token）
- payload: `{ id, email, role: 'student'|'teacher'|'head_teacher'|'admin', name }` —— **没有 jti、iat 之外的会话标识**
- 有效期: `JWT_EXPIRES_IN || '7d'`（默认 7 天）
- 刷新: **无 refresh token、无 logout 端点、无黑名单**。前端清 localStorage 即"登出"，但 token 在服务端继续 7 天有效（被盗即危）
- scanToken: 与登录 JWT **同 secret 同 shape**，仅 `expiresIn` 改成 `(quizEnd - now)`（最长 30 分钟左右）

### 可猜性 / Session ID 形态

- 所有 ID 都是 Prisma `cuid()`（`@default(cuid())`），不可顺序枚举 ✅
- `qrToken` = `v1.<windowStartMs>.<hmac16>.<sessionId>`，HMAC-SHA256 + 30s 容忍窗口 + 固定 session secret，timing-safe 比对 ✅

---

## 1. 角色矩阵

下面"行 = endpoint × 列 = 角色"。
列符号: ✅=允许 / ❌=拒绝 / 🌐=Public（任何人，包括未登录） / 🔒=条件允许（service 层进一步收窄） / 🔑=要 X-Internal-Token

| Endpoint | 守卫装饰器 | student | teacher | head_teacher | admin | public 未登录 |
|---|---|---|---|---|---|---|
| `GET /api/health` | `@Public` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `POST /api/auth/login` | `@Public` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `GET /api/auth/me` | (auth only) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/exam-boards` `/subjects` `/components` `/topics` | `@UseGuards(AuthGuard)` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `POST /api/admin/users`, `GET /api/admin/users` | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `* /api/admin-cleanup/*` | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `* /api/admin-cost/*` | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `* /api/admin-rbac/*` | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `* /api/admin-syllabus/*` | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `* /api/sources/*` | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `POST /api/classifier/sources/:id/run-rules` | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `POST /api/wechat-notify/*` (configs/test/logs) | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `POST /api/ai/generate-questions` | inline `admin\|head_teacher` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `POST /api/ai/backfill-topics` | inline `admin\|head_teacher` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `POST /api/ai/quick-paper` | inline `admin\|head_teacher` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `POST /api/ai/suggest-labels` | (auth only) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `POST /api/ai/generate-diagram` | inline teacher+ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/ai/image-budget`, `/question-budget` | (auth only) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `* /api/review/items/*` | `@Roles('admin','head_teacher')` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `* /api/papers/*` | `@Roles('admin','head_teacher','teacher')` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `* /api/questions/*` | `@Roles('admin','head_teacher','teacher')` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `* /api/templates/*` | `@Roles('admin','head_teacher','teacher')` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `* /api/marker/*` | `@Roles('admin','head_teacher','teacher')` | ❌ | ✅🔒 | ✅🔒 | ✅ | ❌ |
| `* /api/analytics/*` | `@Roles('admin','head_teacher','teacher')` | ❌ | ✅🔒❌ | ✅ | ✅ | ❌ |
| `* /api/perf-routing/*` | `@Roles('admin','head_teacher','teacher')` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `* /api/quality/*` | `@Roles('admin','head_teacher','teacher')` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `POST /api/paper-variants/generate-for-class` `GET /api/paper-variants/assignment/:id` | `@Roles('admin','head_teacher','teacher')` | ❌ | ✅🔒❌ | ✅ | ✅ | ❌ |
| `GET /api/paper-variants/student/:sid/assignment/:aid` | `@Roles('admin','head_teacher','teacher','student')` | ✅🔒（仅自己） | ✅ | ✅ | ✅ | ❌ |
| `GET /api/codegrader/.../test-cases` | `@Roles('admin','head_teacher','teacher','student')` | ✅（hidden 屏蔽） | ✅ | ✅ | ✅ | ❌ |
| `POST /api/codegrader/.../test-cases`, `DELETE` | `@Roles('admin','head_teacher','teacher')` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `POST /api/codegrader/submit` | `@Roles('student')` | ✅🔒 | ❌ | ❌ | ❌ | ❌ |
| `GET /api/codegrader/result/:scriptId` | `@Roles('admin','head_teacher','teacher','student')` | ✅🔒 | ✅ | ✅ | ✅ | ❌ |
| `* /api/ai-tutor/sessions[/:id/messages]` | `@Roles('student'[,...])` | ✅🔒 | (read only) | (read only) | (read only) | ❌ |
| `GET /api/ai-tutor/usage` | `@Roles('admin','head_teacher')` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `POST /api/papers/:paperId/assign` | inline teacher+ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/student/assignments` | inline `student` | ✅🔒 | ❌ | ❌ | ❌ | ❌ |
| `POST /api/student/submissions` | inline `student` | ✅🔒 | ❌ | ❌ | ❌ | ❌ |
| `PATCH /api/student/submissions/:id/scripts` | inline `student` | ✅🔒 | ❌ | ❌ | ❌ | ❌ |
| `POST /api/student/submissions/:id/submit` | inline `student` | ✅🔒 | ❌ | ❌ | ❌ | ❌ |
| `GET /api/student/submissions/:id` | inline `student` | ✅🔒 | ❌ | ❌ | ❌ | ❌ |
| `GET /api/classes` | inline (按角色) | ✅（仅自己班）| ✅（仅自己班）| ✅（全部）| ✅（全部）| ❌ |
| `GET /api/classes/:id` | (auth only) | ✅❌ | ✅❌ | ✅ | ✅ | ❌ |
| `POST /api/classes`, `enrollments`, `roster`, `unenroll` | inline teacher+ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/practice/topics` `/questions` | (auth only) | ✅❌ | ✅ | ✅ | ✅ | ❌ |
| `PATCH /api/practice/questions/:id/topic` | `@Roles('admin','head_teacher','teacher')` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/source-files/:id/pages/:page` | `@Public` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `GET /api/source-files/:id/text` | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `GET /api/question-assets/by-question/:qid/:filename` | (auth only) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/internal/pdf-bytes/:sha256` | `@Internal()` | ❌ | ❌ | ❌ | ❌ | 🔑 |
| `* /api/watermark/papers/.../token`, `download`, `tokens/:id/revoke`, `lookup` | `@Roles('admin','head_teacher','teacher')` + admin-only on revoke/lookup | ❌ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/watermark/lookup` | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `POST /api/watermark/tokens/:id/revoke` | `@Roles('admin')` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `POST /api/morning-quiz/weekly-generate/run-now` | inline `admin` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `GET /api/morning-quiz/absence-alerts/current` | inline teacher+ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `POST /api/morning-quiz/absence-alerts/run-now` | inline teacher+ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `POST /api/morning-quiz/ai-grade/short-answer` | inline teacher+ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/morning-quiz/export/attendance` | inline teacher+ | ❌ | ✅🔒❌ | ✅ | ✅ | ❌ |
| `POST /api/morning-quiz/sessions` | service-layer teacher+ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `POST /api/morning-quiz/batch` | service-layer teacher+ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `POST /api/morning-quiz/batch-generate` | service-layer teacher+ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/morning-quiz/scheduled` | (auth only) | ✅❌ | ✅ | ✅ | ✅ | ❌ |
| `PATCH /api/morning-quiz/sessions/:id/debug-activate` | inline `admin` + env flag | ❌ | ❌ | ❌ | ✅ | ❌ |
| `PATCH /api/morning-quiz/sessions/:id/cancel` | service-layer teacher+ | ❌ | ✅🔒❌ | ✅ | ✅ | ❌ |
| `GET /api/morning-quiz/sessions/:id/dashboard` | inline + service-layer class-check | ❌ | ✅🔒 | ✅ | ✅ | ❌ |
| `GET /api/morning-quiz/sessions/:id` | inline `student` | ✅🔒 | ❌ | ❌ | ❌ | ❌ |
| `PATCH /api/morning-quiz/sessions/:id/answer` | inline `student` | ✅🔒 | ❌ | ❌ | ❌ | ❌ |
| `POST /api/morning-quiz/sessions/:id/check` | inline `student` | ✅🔒 | ❌ | ❌ | ❌ | ❌ |
| `POST /api/morning-quiz/sessions/:id/submit` | inline `student` | ✅🔒 | ❌ | ❌ | ❌ | ❌ |
| `PATCH /api/morning-quiz/classes/:cid/english-level` | service-layer admin\|head | ❌ | ❌ | ✅ | ✅ | ❌ |
| `GET /api/morning-quiz-qa/pending` | inline teacher+ | ❌ | ✅🔒❌ | ✅ | ✅ | ❌ |
| `GET /api/morning-quiz-qa/papers/:id` | inline teacher+ | ❌ | ✅🔒❌ | ✅ | ✅ | ❌ |
| `POST /api/morning-quiz-qa/papers/:id/review` | inline teacher+ | ❌ | ✅🔒❌ | ✅ | ✅ | ❌ |
| `POST /api/morning-quiz-qa/papers/:id/approve` | service-layer teacher+ | ❌ | ✅🔒❌ | ✅ | ✅ | ❌ |
| `POST /api/morning-quiz-qa/papers/:id/teacher-reject` | service-layer teacher+ | ❌ | ✅🔒❌ | ✅ | ✅ | ❌ |
| `GET /api/qr/current` | `@Public + IpAllowlistGuard` | 🌐🛡️ | 🌐🛡️ | 🌐🛡️ | 🌐🛡️ | 🌐🛡️ |
| `GET /api/attendance/scan-roster` | `@Public + IpAllowlistGuard` | 🌐🛡️ | 🌐🛡️ | 🌐🛡️ | 🌐🛡️ | 🌐🛡️ |
| `POST /api/attendance/scan` | `@Public + IpAllowlistGuard` | 🌐🛡️ | 🌐🛡️ | 🌐🛡️ | 🌐🛡️ | 🌐🛡️ |
| `POST /api/attendance/correct` | inline teacher+ + service-layer class-check | ❌ | ✅🔒 | ✅ | ✅ | ❌ |
| `GET /api/attendance/history` | inline teacher+ + service-layer class-check | ❌ | ✅🔒 | ✅ | ✅ | ❌ |

🔒 = service 层进一步限制（自己/班级/校验）
❌（在允许列里）= 当前**没**做该限制但应当做（IDOR 风险）—— 见下方 findings
🛡️ = IpAllowlistGuard

**矩阵审阅总结**：除下列 finding 外，整体 RBAC 一致性较好（管理类全admin，老师面板 teacher+, 学生写自己 submission）。但**多处 service 层缺少 class-ownership 二次校验**，导致跨班 IDOR。

---

## 2. Findings

> 严重度分级: **CRITICAL**（线上必须先修） / **HIGH**（一周内修）/ **MEDIUM**（计划修）/ **LOW**（记账）

---

### F-1. `MOCK_AUTH=true` 在 production 没有 fail-fast 拦截 — **CRITICAL**

**位置**:
- `apps/api/src/common/auth.guard.ts:30-34`
- `apps/api/src/auth/auth.service.ts:14-17`
- `apps/api/src/main.ts:36-50`（fail-fast 块缺一项）

**现象**:
- `auth.guard.ts` 中，未带 `Authorization` header 的请求若 `MOCK_AUTH=true` 会直接被注入为 `mock-teacher` 用户（id=`'mock-teacher'`、role=`'teacher'`），跳过 JWT。
- `auth.service.ts:15` 中，密码 bcrypt 比对失败时若 `MOCK_AUTH=true` 仍签发 token，相当于"知道 email 即登录"。
- main.ts 仅在 `JWT_SECRET` 缺失/默认时 `process.exit(1)`，对 `MOCK_AUTH` 无任何 prod 拦截。

**攻击场景**:
- 运维误把 dev `.env` 推到 Railway，或某个工具自动设了 `MOCK_AUTH=true` —— 攻击者直接 `curl https://api/.../api/morning-quiz/sessions/xxx/dashboard` 不带任何 token，立刻拿到 teacher 视图（full mark scheme）。
- 或者攻击者拿到任意一个 teacher email（公开课表泄露过），用任意密码登录成功，签得 7 天合法 JWT。

**修复**:
```ts
// main.ts
if (process.env.NODE_ENV === 'production' && process.env.MOCK_AUTH === 'true') {
  bootstrapLogger.error('MOCK_AUTH=true is forbidden in production. Refusing to start.');
  process.exit(1);
}
```
同时加 `MOCK_AUTH` 仅在 NODE_ENV !== 'production' 时生效的运行时检查（防止运行中被环境变量注入）。

---

### F-2. Practice 端点把 `markSchemeItems` 喂给学生 — **CRITICAL**

**位置**:
- `apps/api/src/practice/practice.controller.ts:14-33`（`@Get('questions')` 无 `@Roles`）
- `apps/api/src/practice/practice.service.ts:71`（`include: { markSchemeItems: ... }`）

**现象**:
`PracticeController` 类级别没有 `@Roles()`，仅 `PATCH /questions/:id/topic` 有方法级 `@Roles(teacher+)`。`GET /practice/questions` 与 `GET /practice/topics` 对所有已登录用户开放，包括 `student`。
`practice.service.listQuestions` 在 `include` 里**包含了 `markSchemeItems`**（mark scheme 行级数据 = 答案与给分要点）。

**攻击场景**:
任意学生登录后 `curl /api/practice/questions?limit=200` 翻所有过往真题答案。早自习 quiz 或日常作业前一晚刷一遍，事实满分。
该端点也允许 `search` 参数，学生可定向搜某题干关键词秒得答案。

**修复**:
- 紧急: `practice.service.ts` 不再 include `markSchemeItems`，仅返回学生该看的字段（题干、选项无 correct flag）。
- 长期: `PracticeController` 加类级 `@Roles('admin','head_teacher','teacher')`，并新建一个学生专用的 read-only 子端点，service 层做 redact（按 `student.service.redactForStudent` 同款套路）。

---

### F-3. `morning-quiz-qa` 的 approve/teacher-reject 缺 class-ownership — **HIGH**

**位置**:
- `apps/api/src/morning-quiz-qa/morning-quiz-qa.controller.ts:53-75`
- `apps/api/src/morning-quiz-qa/morning-quiz-qa.service.ts:564-610`

**现象**:
service 层只校验 `actor.role in {teacher, head_teacher, admin}`，没有校验该 paper 是否属于 actor 任教的班级。Paper 的 `assignments[0].class` 上有 classId，但完全没用。

**攻击场景**:
英语老师 A 教 9C 班；隔壁班 9B 的数学组（也是 teacher）某 paper 有 needs_review verdict。9B 老师可 `POST /papers/<9C-paper-id>/teacher-reject { reason: "废" }` —— 整张卷子被 archived，9C 下周一早自习直接 404。
或反方向：A 给 B 班的 reject 卷点 approve，绕过 QA 卷子被推到学生，造成"假学生测验"。

**修复**:
service 层在 approve/reject 之前 join `paper.assignments -> classId`，调用 `canActOnClass(prisma, actor, classId)`。如果 paper 还没绑定到 class（例如 batch-generate 失败前的草稿），仅 admin/head_teacher 可处置。
顺便 `pending`/`detail`/`rerun` 也建议过滤为只显示 actor 任教班级的 paper（admin 全部、teacher 仅自己的）。

---

### F-4. `MorningQuizService.cancelSession` 缺 class-ownership — **HIGH**

**位置**: `apps/api/src/morning-quiz/morning-quiz.service.ts:681-703`

**现象**:
`cancelSession` 只检查 `actor.role in {teacher, head_teacher, admin}`，无 `canActOnClass` 调用。`getDashboard`（line 1083+）和 `attendance.correct` 都已修；`cancelSession` 漏了。

**攻击场景**:
任意 teacher 知道任意 sessionId（cuid 不可枚举但泄露途径有：URL 截图、wechat 群发、批量 schedule 接口返回值）即可 `PATCH /sessions/:id/cancel` 把别班的早自习取消。学生 8:30 来扫码全 410，老师没反应过来直接旷课。

**修复**:
```ts
const session = await this.prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
if (!session) throw new NotFoundException(...);
if (!(await canActOnClass(this.prisma, actor, session.classId))) {
  throw new ForbiddenException({ code: 'not_your_class' });
}
```

---

### F-5. AnalyticsService 全部 4 个端点缺 class-ownership — **HIGH**

**位置**:
- `apps/api/src/analytics/analytics.controller.ts:20-41`
- `apps/api/src/analytics/analytics.service.ts:23+`（注释明确写"trusts its caller"）

**现象**:
`/analytics/class/:classId/overview`、`/paper/:paperId/wrong-answers`、`/class/:classId/topic-mastery`、`/student/:studentId/history` 全部仅用 `@Roles(teacher+)`，service 层没有任何 class enrollment 校验。
注释 line 20-22 显式声明 "Authorization is handled at the controller layer; this service trusts its caller"。

**攻击场景**:
- 任意 teacher 调 `GET /analytics/class/<别班 id>/overview` 就拉到该班全员姓名 + 总分 + 错题分布。
- 教 9A 的老师可调 `/student/<9D 学生 id>/history` 拿对方所有 submission 的 autoScore/totalScore（学生隐私）。
- 校际数据泄露场景：某老师从前任校或合作校调来仍保留 teacher 角色但已经无班级，仍能拉所有班数据。

**修复**:
service 每个方法第一行 `if (!(await canActOnClass(prisma, actor, classId))) throw ...`。
对 `/student/:studentId/history` 改成: 取 student 当前所有 enrollment classId，要求 actor 至少在其中一个班 canActOnClass。
admin/head_teacher 自然放过。

---

### F-6. `marker.getSubmissionForMarker` + `listQueue` 跨班可见 — **HIGH**

**位置**: `apps/api/src/marker/marker.service.ts:51` (`listQueue`) 与 `:388` (`getSubmissionForMarker`)

**现象**:
- `listQueue` 接受可选 `classId/paperId` 过滤参数，但**不强制**用 actor 的 classIds 收敛 where。
- `getSubmissionForMarker` 仅根据 submissionId 查询，未校验 actor 是否在该 submission 对应班级里任教。
- `claim` 流程（line 152+）也没做 class-ownership 检查；任何 teacher 可 claim 任何 submission，然后 score / finalize 别人班学生的分数。

**攻击场景**:
A 老师 `GET /marker/queue` 不带 classId → 看到全校 unmarked submission，每条带 student.name/email + paper name + class.name。点开任意一条 `GET /marker/submissions/<id>` → 拿到完整 mark scheme + 学生答卷。然后 `POST /marker/claim` 抢锁，`PATCH /marker/scripts/:scriptId` 给自己心仪的人加分。

**修复**:
- `listQueue`: 若 actor.role === 'teacher'（非 head/admin），强制 inject `assignment.class.enrollments.some(userId=actor.id, role!='student')` 到 where。
- `getSubmissionForMarker` / `claim` / `scoreScript` / `finalize`: 取 submission.assignment.classId，调 `canActOnClass`。

---

### F-7. `paper-variants.listForAssignment` 跨班可见 — **MEDIUM**

**位置**: `apps/api/src/paper-variants/paper-variants.controller.ts:39-42`

**现象**: 类级 `@Roles(teacher+)` 通过，但 service 没有 `canActOnClass(assignment.classId)`。

**攻击场景**: 教 A 班的老师 `GET /paper-variants/assignment/<B 班 assignment id>` 拿到 B 班所有学生（id+name）的考卷形式分配，便于针对单生作弊（让 B 班学生抄 form 1 同学答案）。

**修复**: service 层 join assignment.class、调 canActOnClass。

---

### F-8. `morning-quiz/export/attendance` 缺 class-ownership — **MEDIUM**

**位置**: `apps/api/src/morning-quiz/morning-quiz.controller.ts:130-157`、 service `morning-quiz-export.service.ts:49`

**现象**: 只检查 `teacher+`。`classId` query 参数可选；不传时直接导出**全校** attendance Excel。

**攻击场景**: 任意 teacher 一键拉走全校 attendance + score 工作簿，含每个学生姓名/班级。

**修复**: 不带 classId 时仅 admin/head_teacher 允许；带 classId 时 `canActOnClass`。

---

### F-9. `source-files/:id/pages/:page` 完全 public，无 IpAllowlistGuard 也无 RateLimit — **MEDIUM**

**位置**: `apps/api/src/ingest/source-files.controller.ts:25-63`

**现象**:
代码注释明确说"opening it up doesn't expose any pending-review or restricted content"，但实际：
1. 没有 `@UseGuards(IpAllowlistGuard)`，违反"`@Public()` 必须配 IpAllowlistGuard 或限流"的硬性规则。
2. 没有任何 rate-limit。`id` 是 cuid 不可枚举，但只要任何课件页面 leak 一次 sourceFileId，攻击者可遍历 page 1..1000 全量下载真题图片。
3. 仍属"已 approved 真题"，但被剑桥 / CIE 等版权方追责时这是 unauthorised redistribution。

**攻击场景**: 校外学生（非校 WiFi）从合法学生那里 leak 一个 `source-files/abc/pages/3` URL，立即可枚举该 paper 全部 page 图。

**修复**:
- 加 `@UseGuards(IpAllowlistGuard)` —— 仅校 WiFi 内可看（与 `/api/qr/current`、`/api/attendance/scan` 同策略）。
- 或退一步：去掉 `@Public()` 改成签名 URL（HMAC 短期 token）。
- 加 simple per-IP rate-limit（nestjs-throttler，每分钟 60 次）。

---

### F-10. 没有 logout 端点 / 无 token revocation — **MEDIUM**

**位置**: 整个 `apps/api/src/auth/`

**现象**:
- 无 `POST /auth/logout`，无 refresh token，无 jti、无 revocation 表。
- JWT 有效期固定 7 天（`JWT_EXPIRES_IN || '7d'`）。
- 学生扫码后 mint 的 scanToken 也是同 secret 普通 JWT，仅 `expiresIn` 短，但同样不能撤销。

**攻击场景**:
- 教师手机被偷 → bearer token 拿到 → 7 天内攻击者完全冒充该教师，无法撤销。改密码也无效（密码改动不旋 secret，旧 JWT 仍有效）。
- 学生离校转学后 token 仍 7 天有效，可继续访问数据。
- admin 误授权某 teacher 角色后即使马上 demote，旧 token 内的 `role: teacher` 在 7 天内仍被 AuthGuard 接受（payload role 不读 DB）。

**修复**:
- 短期: 加 `User.tokenInvalidatedAt: DateTime?`；AuthGuard 解 token 后查 DB，若 `iat < tokenInvalidatedAt` 拒绝。logout 端点把这个字段更新为 now。
- 中期: 把 token 拆 access (15min) + refresh (7d)，refresh 走 DB 表可单独 revoke。
- 立即生效降险: 把默认 `JWT_EXPIRES_IN` 改成 `1d` 或 `12h`，强制每天重登。

---

### F-11. `IpAllowlistGuard` IPv6 仅做 exact-string 匹配 — **LOW**

**位置**: `apps/api/src/wifi-gate/ip-allowlist.guard.ts:30, :40`

**现象**: IPv6 规则不 parse CIDR，只做 `===` 字符串比对。学校如果将来切到 IPv6 出口（电信宽带常见），允许的网段一变就全锁。fail-closed 行为本身正确，但运维体验差。

**修复**: 用 `ip-cidr` 包补上 IPv6/CIDR 解析（或从 `node:net` 自实现），与 v4 路径同流。

---

### F-12. 学生主动签 token 重放可重复扫码（device check 仅同 session 内） — **LOW**

**位置**: `apps/api/src/attendance/attendance.service.ts:182-195` + `:252-261`（scanToken 颁发）

**现象**:
- scanToken 是 `expiresIn = quizEnd - now`（最多约 30min），无 jti，不绑 deviceUuid。
- 同一 session 同一 deviceUuid 不能切学生（gate 5 的 `device_already_used` 检查），但**跨 session** 没限制。
- 学生 A 把今天的 scanToken 偷给学生 B，B 在 quizEnd 之前的任意时刻可以以 A 的身份提交 saveAnswer / submit —— 因为 AuthGuard 不感知该 token 是 scan 颁发还是 login 颁发。

**攻击场景**:
A 帮 B 答题：A 扫码后把 localStorage 的 `auth_token` 通过截图/微信发给 B；B 在自己电脑打开 `/morning-quiz/<id>` 用 A 的 token 提交答案，A 拿满分。
（注：B 可见但不能扫码，因为还有班级 enrollment 校验，但 saveAnswer 只看 submission.studentId 与 token.id 匹配 = A，所以 A 的 submission 被 B 写。）

**修复**:
- scanToken payload 加 `kind: 'scan'` + `sessionId`；AuthGuard 对 `kind=scan` 路由白名单收紧到 morning-quiz 学生端点。
- 进一步: scanToken 绑定 deviceUuid，每次 saveAnswer 校验 header 中 deviceUuid === token.deviceUuid。

---

### F-13. `auth.guard.ts` 角色不匹配抛 401 而非 403 — **LOW（语义/审计）**

**位置**: `apps/api/src/common/auth.guard.ts:46-48`

**现象**: 角色不足时抛 `UnauthorizedException('Insufficient role')` —— HTTP 401。语义应为 403 Forbidden（已认证但权限不够）。前端把 401 当作"token 过期 → 登出"，导致用户被踢回登录页而非提示"无权限"。
也影响 audit log 区分"未登录探测"与"权限越界尝试"。

**修复**: 改 `ForbiddenException`。

---

### F-14. `practice.questions` / `analytics.studentHistory` 等无业务限流 — **LOW**

**位置**: 全局无 `nestjs-throttler` 接入。

**现象**: 关键大查询（practice 列表、attendance.history、analytics overview）无 per-user 限流。被一台脚本机轮询可拉数据库 / 拖性能。`@Public` 端点（`/health`、`/auth/login`、`/qr/current`、`/attendance/scan`、`/source-files/:id/pages`）也都无限流，违反硬性要求"`@Public()` 必须额外有 RateLimit"。

**修复**: 接 `@nestjs/throttler` 全局开 60 req/min/IP，登录端点收紧到 5 req/min/IP（防 credential stuffing）。

---

### F-15. `auth/login` 无登录失败计数 / 无 lockout — **LOW**

**位置**: `apps/api/src/auth/auth.service.ts:10-23`

**现象**: bcrypt 慢 hash 抑制了离线爆破，但在线 credential stuffing 没保护。失败不写 audit。

**修复**:
- 失败时 `audit.log({ action: 'auth.login.failed', metadata: { email } })`。
- 同 email 5 次失败/10 分钟 → 临时锁 30 分钟。

---

## 3. 与硬性要求对照

| 要求 | 状态 |
|---|---|
| `@Public()` 端点必须有 IpAllowlistGuard / RateLimit / 操作日志 | ❌ 见 F-9（source-files/pages 公开但无 IP 闸 + 无限流）；`/health`、`/auth/login` 无限流（F-14） |
| JWT_SECRET fail-fast | ✅ main.ts 已实现 |
| MOCK_AUTH prod fail-fast | ❌ F-1 |
| token 过期合理 / refresh 安全 | ❌ F-10（无 refresh、无 revoke、默认 7 天） |
| scanToken 单次 / 不可重放 | ❌ F-12（同 quizEnd 内可重放，无绑 device） |
| 跨班 IDOR — getDashboard | ✅ canActOnClass 已加 |
| 跨班 IDOR — submit 自己 submission | ✅ student.service 校验 `sub.studentId === student.id` |
| 跨班 IDOR — admin/teacher 视角 | ❌ F-3（qa approve/reject）/ F-4（cancelSession）/ F-5（analytics 全套）/ F-6（marker queue+detail+claim）/ F-7（paper-variants list）/ F-8（attendance export 全校） |
| Session ID 不可猜 | ✅ cuid()，全字段统一 |
| 登出 / 多端策略 | ❌ F-10 |
| wechat-notify 回调签名 | ✅ N/A — wechat-notify 是 outbound only，无 inbound 回调 |
| wifi-gate 鉴权 | ✅ fail-closed，但 IPv6 弱（F-11） |

---

## 4. 优先级建议

**上线前必须修（CRITICAL）**:
1. F-1 MOCK_AUTH 在 prod 没拦
2. F-2 Practice 把 markSchemeItems 喂给学生

**上线后第一周（HIGH）**:
3. F-3 qa-review approve/reject 跨班
4. F-4 cancelSession 跨班
5. F-5 Analytics 全套跨班 + 学生历史泄露
6. F-6 marker queue/detail 跨班 + 改分

**两周内（MEDIUM）**:
7. F-7 paper-variants
8. F-8 attendance export 全校
9. F-9 source-files page 公开
10. F-10 logout / refresh
11. F-12 scanToken 重放

**记账（LOW）**:
12. F-11 / F-13 / F-14 / F-15

---

## 附录: 用到的硬性证据

- 全局 `APP_GUARD` 注册: `app.module.ts:99-102`、`internal.module.ts:8-10`
- `Public/Roles` 装饰器与守卫主体: `common/auth.guard.ts:6-51`
- `canActOnClass` 实现: `common/roles.ts:46-58`
- IDOR 已修区: `morning-quiz.service.ts:1103`、`attendance.service.ts:305, 380`
- IDOR 漏修区: 见各 finding 引用行号
- main.ts fail-fast: `main.ts:36-50`
- JWT 配置: `app.module.ts:52-56`
- scanToken 发行: `attendance.service.ts:252-261`
- QR token HMAC: `qr.service.ts:35-89`
