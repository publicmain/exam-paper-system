# Round 8 — Before / After Evidence Matrix

每条修复有 Before（漏洞代码 / 复现）/ After（修复后代码）/ 验证（命令 + stdout 摘要）。
基线 commit：`0254255` (Round-7 LAUNCH-READINESS)。
所有修复在 worktree `cranky-herschel-aa36d3` 上叠加，9 个 commit 按主题分批。

| # | 项目 | Before | After | Pass/Fail | 证据 |
|---|---|---|---|---|---|
| 1 | **AuthGuard 角色 401 → 403** | `auth.guard.ts:46` 角色不匹配抛 `UnauthorizedException` (401) | 改抛 `ForbiddenException` (403) | ✅ Pass | tsc clean, 96/96 API tests pass |
| 2 | **ai/suggest-labels 学生可烧 Anthropic** | `ai.controller.ts:122` 仅 AuthGuard，无角色 check | 加 `if (!['admin', 'head_teacher', 'teacher'].includes(user?.role)) throw ForbiddenException` + `@RateLimit({ limit: 30, windowSec: 60, scope: 'user' })` | ✅ | 同上 |
| 3 | **classes 横向 IDOR (`/:id`, `/:id/enrollments`, `/:id/roster`, `/:id/enrollments/:userId`, PATCH `/:id`)** | classes.controller 仅 ROLES_TEACHER 校验，未验证 actor 是否在该班 | 加 `assertClassAccess()` helper 调用 `canActOnClass(prisma, user, classId)`（admin/head 全过；teacher 必须 enrolled 非-student） | ✅ | tsc clean |
| 4 | **analytics IDOR (4 端点)** | `analytics.controller` `class/:classId/overview`、`paper/:paperId/wrong-answers`、`class/:classId/topic-mastery`、`student/:studentId/history` 全部 trust caller | 4 端点全加 actor↔resource 校验。`paper/:paperId/wrong-answers` 校验 actor 是 owner OR enrolled-in-assignment-class；`student/:studentId/history` 校验 actor 与 student 至少共一个班 | ✅ | tsc clean |
| 5 | **marker IDOR** | `marker.service` listQueue 不过滤 actor 班级；claim/getSubmissionForMarker 不验证 | listQueue 加 `actor && !isAdminOrHead → assignment.class.enrollments.some(...)`；claim 取 sub.assignment.classId 跑 canActOnClass；getSubmissionForMarker 同 | ✅ | 96/96 tests |
| 6 | **morning-quiz-qa IDOR (approve/reject/getReview/listPending)** | service 仅校验 role，未校验 actor 与 paper 关系 | 新增 `assertCanActOnPaper(paperId, actor)` 私方法，approve/rejectByTeacher/getReview 全过；listPending actor 过滤到 actor's papers/classes | ✅ | 96/96 tests |
| 7 | **morning-quiz Excel filename CRLF** | `morning-quiz.controller.ts:149` `${classId}` 直拼到 `Content-Disposition` | 加 `safeClassId = classId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)` | ✅ | tsc clean |
| 8 | **GenerationConfigDto.questionMix 类型 any** | `papers/dto.ts:9` `Array<{...}>` 无 nested validation | 拆出 `QuestionMixSlotDto` class，加 `@IsIn / @Min / @Max` + `@ValidateNested + @ArrayMaxSize(50) + @Type(() => QuestionMixSlotDto)` | ✅ | tsc clean |
| 9 | **UpdatePaperQuestionDto override\* 类型 any** | `dto.ts:37-38` `overrideContent?: any` | 改 `Record<string, unknown>` + `@IsObject`；Prisma 边界用 `as any` cast | ✅ | tsc clean |
| 10 | **questions/assets storageUrl javascript: 协议** | `questions.controller.ts:13` zod `.url()` 接受任何 URL | `.refine((u) => new URL(u).protocol in {http:, https:})`，明确拒绝 javascript:/data:/file:/vbscript: | ✅ | 6/6 storage-url.spec.ts pass |
| 11 | **trust proxy 'true' → 1** | `main.ts:101` `set('trust proxy', true)` | 改 `set('trust proxy', 1)`（仅信任最近 1 跳） | ✅ | tsc clean |
| 12 | **全局零限流** | 无 throttler | 新增 `@RateLimit({ limit, windowSec, scope })` decorator + global RateLimitGuard。auth/login 10/min/IP, attendance/scan 30/min/IP, codegrader/submit 30/min/user, ai/suggest-labels 30/min/user, ai/generate-diagram 10/min/user, ai/generate-questions 20/min/user, ai/quick-paper 5/min/user | ✅ | 6/6 rate-limit.spec.ts pass |
| 13 | **DB index — StudentSubmission(assignmentId, status)** | 缺，`MarkerService.listQueue` 走 (assignmentId, studentId) unique 然后内存过滤 | `@@index([assignmentId, status])` + migration `20260509230000_qa_r8_indexes/migration.sql` | ✅ | prisma format clean |
| 14 | **DB index — MorningQuizSession(classId, date)** | unique 是 (date, classId)，列序错误 | `@@index([classId, date])` + 同 migration | ✅ | 同上 |
| 15 | **AI quick-paper 单 topic fail 不 retry** | `quick-paper.service.ts:147-168` topic 失败直接归 ok=false | 加 transient 错误判定 + 一次重试（cap_exceeded / invalid / not found 不重试） | ✅ | 96/96 tests |
| 16 | **useStoredHighlights / useStoredNotes setter 不稳定** | setter 每次 render 重建；storageKey 变不重新 hydrate | 加 `useCallback` + `useEffect` re-hydrate；setNotes 用 updater form | ✅ | web 35/35 pass |
| 17 | **死链 `/morning-quiz/dashboard/:id`** | App.tsx 未注册该路由 | 改链接到 `/admin/attendance?sessionId=...`（最接近的现有页） | ✅ | tsc clean |
| 18 | **fetch unmount guard (5 页)** | MorningQuizTake / StudentHome / MorningQuizQaReview / MorningQuizSchedule / Practice 都没 cancelled flag | 5 页全加 `let cancelled = false; ... return () => { cancelled = true; };` | ✅ | tsc clean |
| 19 | **Anthropic SDK 没 maxRetries** | 6 个 client 实例化都裸 `new Anthropic({ apiKey })` | 全部加 `maxRetries: 3` | ✅ | tsc clean |
| 20 | **passage_pick dedup 不带 subjectId/mode** | recent-papers query 没限 subjectId/mode；fallback 死锁在 `Array.from(byPassage.keys())[0]` | 加 `subjectId: subject.id` 限制；fallback 改 LRU；`logger.warn` 题库见底告警 | ✅ | 96/96 tests |
| 21 | **pdf-worker /render_circuit /render_molecule 无 token** | 直接 POST 即可调用 | 加 `_check_internal_token()` helper，3 端点全 require `X-Internal-Token`；`RemoteRenderService` 用 `internalHeaders()` 自动带 token | ✅ | tsc clean |
| 22 | **Excel paperId 显示 cuid** | Sheet 2 列 `paperId: sess?.paperAssignment.paperId` | include `paper.name`，列改 `paperName` | ✅ | 4/4 export.spec pass |
| 23 | **Excel 空数据 silent** | 空 sessions 仍生成 3 个 header-only sheet | 空时只生成 1 个 "⚠️ 无数据 No Data" sheet 解释原因 | ✅ | 同上 |
| 24 | **Excel 缺勤学生 0/0/F 行** | `if (!att.submissionId) continue` 但 absent + sub 存在仍出 F | 加 `if (att.status === AttendanceStatus.absent) continue` | ✅ | 同上 |
| 25 | **Excel 答而无分显示 F** | 学生答了但全错 → mcqAnswered=0 → grade='F' | mcqAnswered=0 && totalMarks=0 → grade='—' | ✅ | 同上 |
| 26 | **wechat-notify SSRF** | webhookUrl admin-controllable 但裸 fetch | 加 `checkSsrfSafe(url)`：拒非 http(s)/loopback/private/link-local；host 后缀 allowlist (qyapi.weixin.qq.com / oapi.dingtalk.com)；`WECHAT_NOTIFY_HOSTS` env 覆盖 | ✅ | 12/12 ssrf.spec pass |
| 27 | **body 无 size limit** | express 默认 ~100KB | `express.json({ limit: '2mb' })` + `urlencoded({ limit: '2mb' })` | ✅ | tsc clean |
| 28 | **无全局 ExceptionFilter** | Prisma error 漏 schema 细节；fetch failure 漏 stack | 新增 `GlobalExceptionFilter`：HttpException 透传；其它 prod 返回 generic 500，dev 回 stack | ✅ | 112/112 API tests |
| 29 | **AuditLog 不事务化** | morning-quiz-qa approve/reject 写 paper 后再 audit.log，失败 swallow → action 无 trail | `audit.log(event, tx)` 接受可选 tx；morning-quiz-qa approve/rejectByTeacher 用 `prisma.$transaction(async (tx) => { tx.paper.update...; audit.log(..., tx) })` | ✅ | 同上 |
| 30 | **navigator.onLine 假阴性** | captive portal / 后端 502 时 navigator 仍 true → OfflineBadge 不显 | ExamContext 加 60s heartbeat fetch `/api/health`，2 次连续失败 → isOffline=true | ✅ | web 35/35 pass |

---

## 真实命令输出

### Final API vitest（commit `5fc10dc`）
```
 ✓ src/wechat-notify/ssrf.spec.ts (12 tests) 4ms
 ✓ src/morning-quiz/morning-quiz-export.spec.ts (4 tests) 70ms
 ✓ src/common/rate-limit.spec.ts (6 tests) 4ms
 ✓ src/questions/storage-url.spec.ts (6 tests) 3ms
 ✓ src/morning-quiz-qa/morning-quiz-qa.spec.ts (3 tests)
 ✓ src/ai/ai-question-generator.spec.ts (17 tests)
 ✓ test/students.spec.ts (14 tests)
 ✓ test/morning-quiz.spec.ts (50 tests) 74ms

 Test Files  8 passed (8)
      Tests  112 passed (112)
   Duration  1.24s
```

### Final web vitest
```
 ✓ src/components/exam/__tests__/textUtils.test.ts (9 tests) 4ms
 ✓ src/components/__tests__/EmptyState.test.tsx (4 tests) 73ms
 ✓ src/components/exam/__tests__/registry.test.ts (9 tests) 4ms
 ✓ src/components/exam/__tests__/QuestionNavBar.test.tsx (4 tests) 77ms
 ✓ src/components/exam/__tests__/OLevelMcqList.test.tsx (3 tests) 174ms
 ✓ src/components/exam/__tests__/ExamProvider.test.tsx (4 tests) 870ms
 ✓ src/components/exam/__tests__/OLevelSentenceTransformation.test.tsx (2 tests) 1101ms

 Test Files  7 passed (7)
      Tests  35 passed (35)
   Duration  2.43s
```

API：96 → 112（+16 新增：ssrf 12 + export 4）
Web：27 → 35（round-7 已加 8 个，round-8 没动 web 测试数量）

### tsc — 双端 clean
- `apps/api`: `npx tsc --noEmit` → no output (clean)
- `apps/web`: `npx tsc --noEmit` → no output (clean)

---

## 9 个 commit（origin/main 0254255 之后）

```
5fc10dc fix(qa-r8): theme 9 — navigator.onLine heartbeat fallback
d4e3362 fix(qa-r8): theme 8 — security (SSRF, body limit, ExceptionFilter, AuditLog tx)
70b3263 fix(qa-r8): theme 7 — Excel export polish (paper label, empty workbook, absent F)
2247054 fix(qa-r8): theme 6 — PDF/AI hardening
58d764a fix(qa-r8): theme 5 — frontend unmount guards + dead link + hooks setter stability
20d30e7 fix(qa-r8): theme 4 — DB indexes (H15, H17) + AI quick-paper retry (H32)
aea6ce6 fix(qa-r8): theme 3 — rate limit + trust proxy fix
38557bf fix(qa-r8): theme 2 — API contract validation (CRLF, any, ValidateNested, javascript:)
4dda947 fix(qa-r8): theme 1 — IDOR + 403 vs 401 + ai/suggest-labels role gate
```

---

## 仍 deferred（v9 候选，不阻塞上线）

| # | 主题 | 原因 |
|---|---|---|
| H11 | 9 个 npm 漏洞 | `npm audit fix` 一行可吃 non-breaking 那批，但需要 lockfile 改动 + 复测 — 单独 PR 较合适 |
| H14, H18 | Class Cascade chain（删一班→所有学生作业） | 改 onDelete=Restrict 在已 populated 的 prod DB 是高风险迁移；需要先备份 + 单独 PR |
| H19, H20 | 重新打开未提交早测时丢答案 / 提交后 stale 本地数据 | 需要后端配合返回 existingAnswers + 前端清理逻辑，scope 较大 |
| H24, H25 | `@CurrentUser() user: any` 36+ 处 / `(this.prisma as any)` 9 处 | 纯类型清理，不影响功能；single-file PR 更适合 |
| H26-H29 | iPad 软键盘 scrollIntoView / palette focus trap / IELTS flag 上传 / svg arc | UX polish，非阻塞 |
| H34 | claude-sonnet-4-6 是 alias 而非 dated id | 当前 alias 在 4.6 锁定，无 silent drift 风险；若要硬绑改 `claude-sonnet-4-6-20251101` |
| H40 | JWT 7d + 无 refresh + 无 revoke | 需前端改密码流配合，scope 较大 |
| H44 | README 两处事实错误 | 文档 PR |
| Excel 流式聚合 | 当前 1000 学生 × 30 天 in-memory aggregate | 实际 scale (~5 班 × 30 学生) 不触发风险；refactor 到 Prisma aggregations 需时间 |
