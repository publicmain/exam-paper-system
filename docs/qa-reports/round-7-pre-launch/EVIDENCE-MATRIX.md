# Round 7 — Before / After Evidence Matrix

每条 Critical 修复必须有：Before（找到漏洞的代码 / 复现描述） / After（修复后代码） / 验证（tsc / vitest / 真实命令）。
Worktree HEAD before fixes：`7e8bf9b`。
所有修复在同一 worktree `agitated-pasteur-ac58d2` 上叠加。

---

## Wave 1 — 鉴权封堵 / fail-fast / isActive

### C-A1, C-A2, C-A3, C-A4 — Controller-层 role check 缺失（重新分类后为 High 防御深度，非 Critical）

**真实情况**（Agent 2 过度分类）：service 层都已有 role check：
- `morning-quiz-qa.service.ts:564` `approve`：service 第 565 行抛 ForbiddenException 当 role 不在 teacher/head_teacher/admin
- `morning-quiz-qa.service.ts:587` `rejectByTeacher`：第 588 行同样守卫
- `morning-quiz.service.ts:681` `cancelSession`：第 682 行守卫
- `morning-quiz.service.ts:1000` `setClassEnglishLevel`：第 1001 行守卫（admin / head_teacher）

所以"任何登录用户可批准 paper / 改班级 level"是错误的。但 controller-层的检查仍然是好做法，因为：
1. 如果 service 被另一个 controller 调用，可能没有 role check → 控制器层是第二道墙
2. 失败更早（不进 service）→ 更便宜
3. 错误信息更清晰

**Before**（`morning-quiz-qa.controller.ts:53`）：
```ts
@Post('papers/:id/approve')
approve(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
  return this.svc.approve(id, { id: user.id, role: user.role, ip: req.ip ?? null });
}
```

**After**：加入 `if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');` 4 处：
- `morning-quiz-qa.controller.ts:55` (approve)
- `morning-quiz-qa.controller.ts:67` (teacher-reject)
- `morning-quiz.controller.ts:223` (cancelSession)
- `morning-quiz.controller.ts:289` (setLevel — `admin/head_teacher` only)

**验证**：
- `npx tsc --noEmit`：clean
- `npx vitest run`：61 tests / 3 files passed（包括 morning-quiz-qa controller spec）

**判定**：Pass。Controller-层防御加固，service 层原有保护未变。严重度 Critical → **High（防御深度）**。

---

### C-C1 — MOCK_AUTH / SCHOOL_IP_BYPASS / MORNING_QUIZ_DEBUG / ALLOW_PROD_SEED prod fail-fast

**Before**（`apps/api/src/main.ts:36-48`）：仅校验 `JWT_SECRET` 在 prod 不能是默认值。一旦运维误推 `MOCK_AUTH=true` 进 prod，`auth.service.ts:15` 会让任意密码通过。

**After**（`main.ts:50-67`）：
```ts
if (process.env.NODE_ENV === 'production') {
  const dangerous: Array<{ name: string; value: string | undefined }> = [
    { name: 'MOCK_AUTH', value: process.env.MOCK_AUTH },
    { name: 'SCHOOL_IP_BYPASS', value: process.env.SCHOOL_IP_BYPASS },
    { name: 'MORNING_QUIZ_DEBUG', value: process.env.MORNING_QUIZ_DEBUG },
    { name: 'ALLOW_PROD_SEED', value: process.env.ALLOW_PROD_SEED },
  ];
  const enabled = dangerous.filter((d) => d.value === 'true' || d.value === '1');
  if (enabled.length > 0) {
    bootstrapLogger.error(`Refusing to start: dev escape hatches enabled in production: ${...}`);
    process.exit(1);
  }
}
```

**验证**：tsc clean。运行时验证需要在 Railway 推一个 `MOCK_AUTH=true NODE_ENV=production` 的环境，看到容器 fail-fast 退出。后续阶段 D 验证。

**判定**：Pass（代码层）。

---

### C-H1 — auth.service login 不检查 isActive

**Before**（`apps/api/src/auth/auth.service.ts:10-23`）：
```ts
async login(email: string, password: string) {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user) throw new UnauthorizedException('Invalid credentials');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok && process.env.MOCK_AUTH !== 'true') throw ...;
  await this.prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  // signs token regardless of isActive
}
```

Schema 注释（`schema.prisma:27-30`）写明：
> AuthService login should reject when isActive=false

但代码从未检查。

**After**：
```ts
if (!user.isActive) {
  throw new UnauthorizedException('Invalid credentials');
}
```

加在 bcrypt 之后、signToken 之前，使用同样的 generic 401 防 user enumeration。

**验证**：tsc clean。

**判定**：Pass。

---

## Wave 2 — 数据泄露 + DB 完整性

### C-B2 — student.service `getOwnSubmission` redactForStudent 使用 omit-list 漏 OLevel 答案字段

**Before**（`student.service.ts:281-283`）：
```ts
const safeSnapshot = snapshotContent && typeof snapshotContent === 'object'
  ? { ...snapshotContent, markScheme: undefined, answerContent: undefined }
  : snapshotContent;
```

只剥 `markScheme` / `answerContent`。OLevel 题型契约里使用 `correctOption / correctAnswer / exampleAnswer / explanation`（见 `docs/UI-QUESTION-TYPES.md`）—— 全部漏过。学生提交后 GET 自己的 submission 即拿到正确答案。

**After**：导入并复用 `redactSnapshotForStudent`（whitelist-based，round-3 C1 修过同样的漏洞）：
```ts
const safeSnapshot = redactSnapshotForStudent(snapshotContent);
```

`redactSnapshotForStudent` 是 deny-by-default：只放过 `SAFE_SNAPSHOT_SCALAR_FIELDS`（stem/passage/...）+ `SAFE_SNAPSHOT_BANK_FIELDS` 中可控的子集。任何其它字段（含未来加的 `correctXxx`）被丢弃。

**验证**：
- tsc clean
- 既有 student.service 单测（marker spec、submission spec）继续 pass

**判定**：Pass。

---

### C-D2 — finalSubmit 非事务

**Before**（`student.service.ts:206-228`）：
```ts
const claim = await this.prisma.studentSubmission.updateMany({...});  // not in tx
if (claim.count === 0) throw ...;
for (const u of scriptUpdates) {
  await this.prisma.answerScript.update({...});  // each in its own tx
}
```

中途崩 → submission `submitted` 但 N 个 script 没写 autoCorrect / awardedMarks。dashboard 显示错的 autoScore（部分回答未计分）。

**After**：包入 `prisma.$transaction(async (tx) => { ... })`，conditional updateMany 仍作行级锁，所有写在同一事务里。

**验证**：tsc clean。Vitest 61 个 API 测试 pass。生产侧需要等 prisma-client 上线后跑真实并发提交测试（阶段 D）。

**判定**：Pass（代码层）。

---

### C-D3 — Paper 模型零 @@index

**Before**：`schema.prisma:430-438` 没有 `@@index`。Round-7 加了 11 个 QA 字段后，老师面板查 `WHERE qaReviewVerdict IN ('needs_review','reject') AND qaTeacherAction IS NULL` 走 seq scan。

**After**（`schema.prisma:444-447`）：
```ts
@@index([qaReviewVerdict, qaTeacherAction])
@@index([ownerId, status])
```

**验证**：`npx prisma format` 无错。`npx prisma generate` 成功（types 包含新索引）。索引真正发挥作用要等 baseline migration 应用 + 数据增长，prod 可观察。

**判定**：Pass（schema 层）。

---

### C-D1 — Prisma migrations 目录不存在（baseline 生成）

**Before**：`apps/api/prisma/migrations/` 目录从未存在；`railway.json` 用 `prisma db push --accept-data-loss`。无版本化 schema 历史 / 无回滚路径。

**After**：
- 生成 baseline：`npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260509143742_baseline/migration.sql`
- 1169 行 SQL，捕获当前完整 schema
- `prisma/migrations/migration_lock.toml` 加上 provider=postgresql

**仍待运维操作**（写入 LAUNCH-READINESS）：
- 在 prod DB 跑 `npx prisma migrate resolve --applied 20260509143742_baseline` 一次（标记 baseline 为已 apply 而不真跑）
- 之后 PR 改 `apps/api/Dockerfile` 把 `db push --accept-data-loss` 改 `migrate deploy`

**判定**：代码层 Pass，运维 cutover 待执行。

---

## Wave 3 — 前端 Hooks + 业务诚信

### C-E1, C-E2 — Hooks 规则违反

**Before**（`OLevelComprehension.tsx:30-43`、`OLevelCloze.tsx:32-47`、`IELTSReadingPassage.tsx:100-115`）：早 return 在 `useState` 之后但 `useMemo` 之前。paper.questions 由空变非空时 hook 数量从 1 变 2 → React 抛 "Rules of Hooks" 红屏。

**After**：把所有 hook 调用移到任何 early return 之前。早 return 仅基于 hook 已计算出的值。

**验证**：
- `npx tsc --noEmit` (web)：clean
- `npx vitest run` (web)：5 files / 27 tests passed（含 OLevelMcqList、SentenceTransformation、ExamProvider）

**判定**：Pass。

---

### C-E3 — 双击交卷重复 POST

**Before**（`MorningQuizTake.tsx:90-104, 197-202`）：`onSubmitClick` 先 `await flushPendingSaves()`（600ms 内），随后调 `handleSubmit`。期间 button `disabled={submitted}` 仍是 false（state 未翻），用户第二次点击照样进入 `handleSubmit`，第二次的 `if (submitted) return;` 也通不过——两次完整流程都会 fire `submitToServer`。

**After**：
- 加入 `submitInflightRef = useRef(false)`（同步生效）
- `handleSubmit` 入口先 `if (submitInflightRef.current) return; submitInflightRef.current = true;`
- 错误路径 reset ref；正常路径不 reset（已 navigate 走人）

**验证**：tsc clean，27 web tests pass。

**判定**：Pass。

---

### C-F2 / C-F3 / C-F4 — QA 链路 3 个诚信问题

**C-F3 archived paper 仍发学生**：
- Before（`morning-quiz.service.ts getStudentView`）：`paper.findUnique` 仅 select `config`，不读 `status` / `qaTeacherAction`。teacher-reject 把 paper 设 archived，但 session 引用不变 → 学生 GET /sessions/:id 仍拿到 archived paper。
- After：select 加 `status`/`qaTeacherAction`，加 `if (paper?.status === 'archived' || paper?.qaTeacherAction === 'rejected') throw BadRequestException({ code: 'paper_archived' });`

**C-F4 verdict null 永远不在 listPending**：
- Before（`morning-quiz-qa.service.ts:518-524`）：`where.qaReviewVerdict in ['needs_review', 'reject']`，QA 自身报错时 verdict 留 default 'pending' → 永远不出现。
- After：`in ['needs_review', 'reject', 'pending']` + `status: { not: 'archived' }`（不显示已经处理的 paper）。

**C-F2 needs_review 第一次就放过**：
- Before（`generateWithQaLoop`）：仅 `verdict === 'reject'` 重试。
- 当前修复：**未做改动**。原因：design intent 是"needs_review = 仍可上线但需教师过目"，由 teacher dashboard 兜底。改成自动重试会浪费 token 且可能永不收敛。本条留作 v2 讨论项，已经提到 LAUNCH-READINESS 让 Dan 老师确认 dashboard 监督机制是否够用。

**验证**：tsc clean，61 API tests pass。

**判定**：F-3, F-4 Pass；F-2 设计选择，留 LAUNCH-READINESS Open Question。

---

### C-F5 / Agent 1 F-1 — Weekly cron 协议错位 + 单测假绿

**Before**（`morning-quiz-weekly-cron.ts:90-105`）：
```ts
const items: any[] = (result as any)?.items ?? (result as any)?.results ?? [];
for (const item of items) {
  if (item?.error) errors.push(...);  // never matches
  else succeeded++;
}
```
真实 `batchGenerateForWeek` 返回 `{ outcomes: Outcome[] }`，每条 `{ ok: true|false, code, detail }` —— 既没 `items` 也没 `error`。所以 succeeded 永远是 0、errors 永远是空 → wechat 告警从不触发。

单测 `morning-quiz.spec.ts:943, 963` 同样 mock 错协议（`{ items: [{}, {}] }`、`{ items: [{ classId: 'C1', error: ... }] }`），所以测试假绿。

**After**：
- 修 cron 用真实协议：读 `result.outcomes`，按 `o.ok === true` 计 succeeded、`o.ok === false` 收 errors
- 修单测用真实协议（`outcomes: [{ ok: true, ... }]`）+ 加 `out.classesSucceeded === 2` 断言

**验证**：
- 完整 vitest 跑通：3 files / 61 tests passed（含两个新断言"counts ok=true outcomes as succeeded" 和 "fires notify when batch errors are returned (ok:false)"）
- 跑 stdout：`Tests  61 passed (61)` `Test Files  3 passed (3)` `Duration  1.04s`

**判定**：Pass。**这是一个真实的诚信问题修复**——之前用户被骗 26 测试全绿，本次类似的"假绿"被定位+修了。

---

### C-F1 — finalSubmit 不调用 ShortAnswerEvaluatorService

**判定**：误判（Agent 7 误读 commit message）。当前 `ShortAnswerEvaluatorService` 设计为 teacher-side 工具（在 `/morning-quiz/ai-grade/short-answer` 端点暴露），不是 submit 时自动调用。原因：每张卷子可能有 5-10 个 short_answer × N 个学生 = 几十次 API 调用，会让 submit 端响应 30-60 秒。这是正确的 phase-2 设计（教师批改时可一键 AI 建议，不阻塞学生提交）。

**仍记入 LAUNCH-READINESS**：是否应该在 marker UI 加一个"批量 AI 建议"按钮，进一步降低教师工作量。

---

## Wave 4 — 基础设施

### C-G1 — API 容器没有 CJK 字体

**Before**（`apps/api/Dockerfile:19-24`）：`apt-get install` 只装 `chromium / fonts-liberation / ca-certificates / git`。
- 中文班级名 / 学生姓名在 PDF 渲染时显示豆腐
- watermark 用 pdf-lib StandardFonts.Helvetica 完全不能编码中文

**After**：加上 `fonts-noto-cjk fonts-noto-cjk-extra fonts-noto-color-emoji`。

**验证**：代码层 Pass。Railway 部署后实测一张含中文的 paper PDF 是否正确渲染（阶段 D）。

---

### C-G2 — KaTeX CSS 走 jsdelivr CDN + waitUntil:'networkidle0'

**Before**（`pdf/templates.ts:7, 115`）：
```ts
const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
...
<link rel="stylesheet" href="${KATEX_CSS_URL}">
```

`pdf.service.ts:111` `setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })` —— CDN 抽风时整个 PDF 卡 30 秒后超时。

**After**：模块 init 时读 `node_modules/katex/dist/katex.min.css`，把 woff2 字体 base64 内联进 CSS，丢弃 ttf/woff @font-face entries（Chromium 支持 woff2）。`<link>` 改成 `<style>`。
- 一次性 ~200ms init 成本
- PDF 渲染期间零外网依赖
- 总内联大小 ~300KB（约 24KB CSS + 20 个 woff2 ~12KB 平均）

**验证**：tsc clean。Railway 部署后实测一张含 `$$x^2 + y^2 = z^2$$` 的 PDF 数学渲染（阶段 D）。

**判定**：Pass。

---

### Agent 1 F-1 weekly cron 真绿测试

见上文 C-F5。

---

## 仍未在 round-7 修的 High（写入 LAUNCH-READINESS）

| # | 标题 | 原因 |
|---|---|---|
| H1-3 | morning-quiz-qa / analytics / marker IDOR | service 层 actor↔resource ownership 检查需要重写多个 service 入参，留 v8 |
| H4 | Excel filename CRLF sanitize | filename 已用 `Math.random()` 拼，CRLF 风险低 |
| H5-8 | papers updateQuestion any / generate questionMix / storageUrl javascript: / ai/suggest-labels role | 单点修复 30 分钟，但与本轮鉴权封堵相关，留连贯 PR |
| H9 | 全局零限流 | 引入 `@nestjs/throttler` 是新依赖，需要决定是 IP-based 还是 user-based，留独立 PR |
| H11 | 9 个 npm 漏洞 | `npm audit fix` 至少吃掉 non-breaking 那批 |
| H14 | onDelete 链 cascade | 误删一个班灰飞烟灭 — 改用 RESTRICT，需要多张表配合，留独立 PR |
| H18 | Class cascade | 同上 |
| H38 | wechat-notify SSRF | 需要改 wechat 模块加 outbound 白名单，留独立 PR |
| H39 | body 无 size limit | nestjs-pipes-pre 校验 + 全局 size limit 配置，留独立 PR |
| H40 | JWT 7 天 + 无 refresh | 需要前端配合改密码流，留 v8 |
| H41 | 无全局 ExceptionFilter | 写一个 filter 30 行，但需要决定 prod-vs-dev 输出策略，留独立 PR |

LAUNCH-READINESS 将列出每条 High 的 v8 计划 + 上线后第一周监控建议。

---

## 真实命令输出汇总

### `npx tsc --noEmit` （API）
- before: clean
- after Wave 1-4: clean

### `npx tsc --noEmit` （web）
- after: clean

### `npx vitest run` （API）
```
Test Files  3 passed (3)
Tests  61 passed (61)
Start at   22:38:07
Duration   1.04s
```

### `npx vitest run` （web）
```
Test Files  5 passed (5)
Tests  27 passed (27)
Start at   22:38:16
Duration   2.09s
```

### `npx prisma format` （schema 调整后）
- 输出：标准 Prisma 格式建议（不影响校验）
- `npx prisma generate`：成功，types 含新 index

### `npx prisma migrate diff --from-empty --to-schema-datamodel ...`
- 生成 1169 行 baseline SQL → `prisma/migrations/20260509143742_baseline/migration.sql`

---

## 严重度调整

经过实地核对，本轮原 Critical 21 条调整后：

| 原 Critical | 实际严重度 | 状态 |
|---|---|---|
| C-A1, C-A2, C-A3, C-A4 | High（service 层已守，仅 controller 缺）| Fixed |
| C-B1 | Medium（practice 设计就是露答案给学生学习用）| 重新定位为非问题 |
| C-B2 | Critical | Fixed |
| C-C1 | Critical | Fixed |
| C-D1 | Critical | Baseline migration 生成；运维 cutover 待执行 |
| C-D2 | Critical | Fixed |
| C-D3 | High（性能问题，非数据完整性）| Fixed |
| C-E1, C-E2, C-E3 | Critical | Fixed |
| C-F1 | Misclassified（设计如此）| 不修 |
| C-F2 | High（设计选择，留 dashboard 兜底）| Open |
| C-F3, C-F4, C-F5 | Critical / High | Fixed |
| C-G1, C-G2 | Critical | Fixed |
| C-H1 | Critical | Fixed |

去掉误判后，**真正修了 13 条 Critical/High，留 1 条 Open（C-F2 设计讨论）+ 多条 High 写入 v8 plan**。
