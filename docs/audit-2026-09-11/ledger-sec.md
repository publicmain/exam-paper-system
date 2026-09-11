# 整改台账 · 身份与安全（S01–S04、S06–S08、UI07 后端）

- 分支：`audit/sec`（worktree `.local/wt/sec`，基于 `6f85e6d`）
- 编制：2026-09-11
- 范围：`docs/CLAUDE-AUDIT-AND-IOS-REBUILD-PROMPT-2026-09-11.md` §5.1 的 S01–S04、S06–S08，以及 §5.2 UI07 的后端部分。S05（运维判分入口 `apps/ops-dashboard`）不在本组范围。
- 证据类型沿用文档 §5：**M**＝真实代码 + 内存模拟数据复现；**C**＝代码路径确认。本台账所有测试都用内存假对象 / Nest testing，**没有连接任何真实数据库**；没有 push、没有部署、没有写生产、没有调用任何 Anthropic API。
- 「已实现」≠「已上线」：以下全部只在本地分支实现与验证，**未部署**。

## 状态总览

| ID | 状态 | 一句话 |
|---|---|---|
| S01 | 已验证 | 学生答题 / 恢复 / 详情响应改为按答题状态的字段白名单 |
| S02 | 已验证 | 历史接口取消匿名姓名回退，只认验签令牌；同名时不再给候选 |
| S03 | 已验证（教职工令牌一处剩余依赖） | 新旧接口统一令牌生命周期；教师只读视角所有写操作 403 且零写库 |
| S04 | 已验证（存量数据修复待授权） | 停用改写 `isActive` + 撤销会话；库 / 列表 / 新登录 / 现有会话一致 |
| S06 | 已验证 | 限流按「已验证且仍有效的身份」分桶；学生身份那一路全部 user scope |
| S07 | 已验证 | 同名分支与单人分支共用原子失败计数 / 锁定 |
| S08 | 已验证（3 个隐式写 GET 留给其他组） | 「读身份」与「本人写入」分开；只放开核实零写库的 GET |
| UI07（后端） | 已验证（前端部分归学生端组） | 订阅按已认证账号绑定；新增 `POST /push/status`；cron 跳过不可用账号 |

## 提交列表（`6f85e6d..HEAD`）

| 提交 | 内容 |
|---|---|
| `83a9bc7` | 接手上一位的未提交工作（S02/S03/S08），复核后保留并补齐：同名时强制按令牌 id、历史组限流改 user、可达清单推导与零写库证据 |
| `a692917` | S06：限流守卫自行验签 + 生命周期判据分桶 |
| `6519579` | S04：停用写 `isActive` + 撤销会话 + 旧版前缀兼容 |
| `c2cac16` / `d6d6b28` | S07：共用 `recordPinFailure`；用例类型修正 |
| `98b8d0e` | S01：字段白名单 |
| `e429a4a` | UI07 后端：`POST /push/status`、归属、cron 过滤、撤销时清订阅 |
| `feaf9f0` | S03：穷举测试 —— 教师只读视角 × 全部非 GET 路由 |
| `3d28040` | S06：学生身份那一路的 `@RateLimit` 全部改 user scope |

## 接手复核记录

上一位工作者因额度中断，未提交的修改在工作树里（15 个已跟踪文件 + 6 个新文件）。逐文件复核结论：

- **保留**：`common/account-lifecycle.ts`（统一判据）、`common/student-access.ts`（读 / 写两种声明）、`common/global-guards.ts`（守卫顺序单一来源）、`AuthGuard` / `StudentIdentityGuard` / `student-auth.controller` 改用同一判据、各控制器的 `@RequireStudentReadToken` / `@AllowTeacherView` 标注、`history-by-name` / `history-detail` 只认令牌、`guard-chain.e2e.spec.ts`（真实守卫链）。
- **修正**：
  1. `trend` / `skill-profile` / `upcoming-for-name` / 练习三条只加了守卫门，服务层仍按姓名解析 —— **同名时冒名者与令牌姓名一致，仍会拿到同名候选（含班级）**。改为控制器把 `studentId` 强制设为令牌 id（`tokenBoundIdentity`）。
  2. `RateLimitGuard` 只加了 `JwtService` 注入，按用户分桶的逻辑没写（S06 实际未修）。已补完。
  3. `student-access.ts` 注释称「教师视角只能到达显式标注的路由」，与 `StudentIdentityGuard` 实际行为（未标注的可选身份 GET 也可读）不符。改注释，并把可达清单改为按两道守卫的真实判据从元数据推导，补上旧 vocab 可选身份 GET 的零写库证据。
- **被取代的旧断言（行为按审计要求变更，理由写在测试注释里）**：
  - `student-identity.spec`「扫码当天票（无 av）不查库」→ S03 要求停用 / 归档后旧令牌在新旧接口均失效，当天票现在也查一次（与全局守卫同请求共用结果）。
  - `token-only-runtime.spec`「无令牌时 history-by-name 仍按姓名查」「旧口径回显姓名」→ 这正是 S02 漏洞本身，改为无令牌 403 且零查库。
  - `student-auth.service.spec`「同名失败调用了 updateMany」→ 改为直接数每个同名账号的失败计数（更严）。
  - `push.service.spec`「归档账号不推」的全等 where → 条件变严，按新条件整条全等钉死。
- 事故记录：接手中途一次脚本替换失败把 `morning-quiz.controller.ts` 截成空文件；已用 `HEAD` 版本 + 上一位 diff 逐块重建，并用既有测试（`token-only-runtime` / `history-identity` / 守卫链 e2e）确认重建后行为一致，然后才继续。

---

## S01 · 未提交答卷接口包含答案快照 —— 已验证

**原症状（M，修前可复现）**
`getOwnSubmission` 用黑名单删几个字段后 `...rest` 展开：`PaperQuestion.snapshotAnswer` / `overrideAnswer` / `overrideContent`、`Paper.qaReviewSummary` / `qaReviewIssues` / `config`、`QuestionAsset.aiPrompt`、`Question.sourceRef` / `provenanceTag` 都在答题中的响应里。开卷、交卷、作业列表把整行原样返回；系统收卷后重开（`system_eod → in_progress`）的答卷行上残留旧的 `autoCorrect` / `awardedMarks` / `markerComment`，保存与恢复时一并下发；交卷时只有客观题部分分的 `autoScore` 也在返回体里。新用例在修前 **8 条红 / 3 条绿**（绿的 3 条是本就合规的阅读答题页、阅读结果页与「他人答卷 403」）。

**修复位置**
- 新增 `apps/api/src/student/student-submission-view.ts`：只列要给的字段。题干取 `overrideContent ?? snapshotContent`（与 PDF 同口径）再过阅读卷白名单脱敏器 `redactSnapshotForStudent`；选项只留 `key/text`；**答案键在任何状态都不经这组接口**。
- 分数 / 判分放行与阅读结果页 `stripUnreleasedScores` 同一口径：整卷分数 = `scoresReleased(status)`；逐题得分与对错 = 已定稿，或（已最终提交且确定性判分 `deterministicallyGraded`）；评语只跟整卷分数门走（并剥 `[ai-grade]` 前缀）。
- `student.service.ts#getOwnSubmission` 改用 `submissionDetailView`（删除旧 `redactForStudent`）。
- `student.controller.ts`：作业列表、开卷、保存、交卷的返回体走白名单。
- `morning-quiz.controller.ts`：`POST sessions/:id/open`、`POST sessions/:id/submit` 的返回体走 `submissionRowView`（学生端只读 `id` / `status`）。
- 已核实本就合规、未改：`GET /morning-quiz/sessions/:id`（`getStudentView` 显式投影）、`student-result` / `history-detail`（两道门）、练习卷（practice 按规则即时给）。

**新增测试**：`apps/api/src/student/submission-whitelist.spec.ts`（11 条）
- 未交卷：`GET /student/submissions/:id`、`POST /student/submissions`、`PATCH …/scripts`、`GET /student/assignments`、暂存提交（`finalSubmittedAt` 为空）、`GET /morning-quiz/sessions/:id`、`GET /morning-quiz/student-result`（窗口已关、从未最终提交）、`POST /morning-quiz/sessions/:id/open` 与 `/submit` —— 在各题型（判断 / 选择 / 短答 / 完形词库 / 老师改过题干）的答案、rubric、快照、覆盖内容、QA 意见、资源 aiPrompt 里埋唯一标记 `LEAK·<位置>`，所有响应**递归**搜不到标记，也不出现答案类键名。
- 他人答卷 → 403。
- 已最终提交未判完：确定性判的选择题放出对错与得分，整卷分数仍等定稿。
- 已发布（marked）：整卷分数、逐题得分与评语放出；答案键仍不经这个接口。

**实测**：`npx vitest run src/student/submission-whitelist.spec.ts` → 11/11 通过（修前 8 红）。

**剩余依赖 / 影响**
- 旧 `apps/web` 的 `StudentTake` 交卷后弹窗读 `autoScore`，现在按分数门给 `null` → 显示「0 / 满分」。旧端冻结，不在本组改；按 2026-08-14 成绩发布口径这是预期（分数要么定稿、要么没有）。
- 正式词测（vocab-v2 `test`）同类问题见 VOC04，归词汇组。

## S02 · 旧历史接口把姓名当授权凭据 —— 已验证

**原症状（C，修前可复现）**
`history-by-name` / `history-detail` 为 `@Public`，无令牌时按姓名查人、按姓名比对归属；同名时返回候选（班级、邮箱前缀），查无此人时返回相近姓名建议。同类的 `history-by-name/trend`、`skill-profile`、`upcoming-for-name`、练习回看 / 开练 / 交练同样按姓名解析。

**修复位置**：`apps/api/src/morning-quiz/morning-quiz.controller.ts`
- `history-by-name` / `history-detail` 标 `@RequireStudentReadToken()`（学生本人或教师只读视角；零写库）；handler 再兜一层无令牌 403。只按令牌 id 查人；查询串 `name` / `studentId` 由守卫核对（不一致 403 `identity_mismatch`，响应体只有错误码）。他人答卷与不存在的答卷**同一个 404**。
- trend / skill-profile / upcoming / 练习三条：必须带令牌，且 `tokenBoundIdentity` 把 `studentId` **强制设为令牌 id**（守卫只能核对姓名一致，同名时冒名者也一致）—— 服务层只解析出令牌本人，不再列同名候选。
- 这一组限流改 `scope: 'user'`（见 S06）。
- 新学生端只带 Bearer 调这两个端点：照常可用（e2e 与单测覆盖）。

**新增 / 变更测试**
- `apps/api/src/morning-quiz/history-identity.spec.ts`（18 条）：无令牌在查学生前统一 403（`rec` 为空 = 一次库都没查）；A 的令牌 + B 的姓名 / 编号 → `identity_mismatch`；A 读 B 的答卷与不存在同一 404；B 读自己的照常；带令牌永不按姓名查、不返回候选；同名场景下 trend / skill / upcoming / 练习 × 3 服务层拿到的都是令牌 id；绕过守卫直接调用无令牌 → 403 且零调用；历史组全部 user scope。
- `token-only-runtime.spec.ts`：旧的「无令牌按姓名查」两条改为钉新行为（见上「被取代的旧断言」）。
- `guard-chain.e2e.spec.ts`：真实守卫链上无令牌 403 `student_token_required`、教师只读视角可读。

**实测**：`npx vitest run src/morning-quiz/history-identity.spec.ts` → 18/18 通过（新增的同名 7 条修前红）。

**剩余依赖 / 影响**
- 旧 `apps/web` 的 `/my-history`（按姓名匿名查）从此 403 —— 这就是本条要堵的路，旧端冻结不改。
- `student.service.ts#finalSubmit` 发的微信通知 `resultUrl` 仍指向 `/my-history?name=…`（旧端匿名页），点开会要求登录。建议主线把链接改到学生端历史页（本组未改：属通知文案 / 旧端）。
- 令牌签发后学生被改名时，trend / skill 等按「姓名 + 令牌 id」解析会 404 `student_not_found`（该路径的相近姓名建议理论上可能列出名册里的近似姓名；只有改名学生会走到）。彻底解法是服务层这四个方法接收 `authStudentId`（`resolveStudentByName` 已支持），属 morning-quiz 服务层，建议主线处理。

## S03 · 旧接口绕过令牌撤销和教师视角写保护 —— 已验证（教职工令牌一处剩余依赖）

**原症状（C）**
全局 `AuthGuard` 验签后只查角色：重置 / 改密码、停用、归档后，旧令牌打 `/student/*`、`/morning-quiz/sessions/:id/*` 照样能开卷、保存、交卷；`teacher_view` 令牌的 role 是 student，旧开卷 / 保存 / 交卷只比角色，教师点两下就记成「学生自己交的卷」。扫码当天票（不带 `av`）停用 / 归档后还能用到 23:59。

**修复位置**
- `apps/api/src/common/account-lifecycle.ts`：全仓库唯一的令牌生命周期判据（学生：存在、仍是 student、账号可用、带 av 比版本号；教职工：存在、账号可用、角色一致、带 av 比版本号）。「账号可用」= `isActive` · 未归档 · 非旧版停用标记。按请求缓存，一次请求只查一次库。
- `common/auth.guard.ts`：验签后调用上面判据；`teacher_view` 只能读显式 `@AllowTeacherView()` 的 GET，其余一律 403 `teacher_view_is_read_only`（在查库之前拒）。
- `common/student-identity.guard.ts`、`student-auth/student-auth.controller.ts#requireStudent`：改用同一判据（当天票也查）。
- 重置密码 / 改密码 / 教师重置 / 后台停用都走 `REVOKE_ALL_SESSIONS`（版本号 +1）并在同一事务清推送订阅（见 S04、UI07）。

**新增测试**：`apps/api/src/common/guard-chain.e2e.spec.ts`（真实 Nest HTTP 应用、全局守卫按 `GLOBAL_GUARDS` 注册、控制器与 StudentIdentityGuard 都是真的，Prisma 为记账假库）
- 「S03 —— 新旧接口统一令牌生命周期」：正常学生不误伤；版本号递增 / 停用 / 归档 × 15 个新旧读写接口 → 403 `token_revoked`、业务零调用、零写库；扫码当天票停用 / 归档后新旧接口均失效；`mq_handoff` 本场照常、换场 / 其他接口 403、停用后失效；教职工停用 / 归档 / 降级后旧令牌 401；一次请求只查一次账号状态。
- 「S03 —— 教师只读视角：所有写操作拒绝且零写库」：33 条代表性新旧写接口（旧 7 + 新 26）；视角令牌同样受撤销约束。
- 「S03 —— 穷举」：从控制器元数据列出**全部 68 条非 GET 路由**（排除不读令牌的登录 / 注册入口），教师只读视角逐条 403 `teacher_view_is_read_only`、业务零调用、零写库。
- `common/auth.guard.spec.ts`、`common/student-identity.spec.ts`（当天票两条改钉新行为）。

**实测**：`npx vitest run src/common/guard-chain.e2e.spec.ts` → 191/191 通过。

**剩余依赖**
- **教职工令牌**：`auth/auth.service.ts#login` 签发的 7 天令牌不带 `av`。现在停用 / 归档 / 降级即时失效，但「后台重置教职工密码」与「停用后再恢复」**不能**让已签发的教职工令牌永久作废（恢复后在 7 天内复活）。判据已为此预留（带 `av` 就比对）；需要 `auth.service` 在签发时写入 `av: user.studentAuthVersion` —— 该文件不在本组可改范围，列入跨组事项。
- 学生端所有 30 天令牌的撤销依赖版本号；本组所有撤销入口均已递增。

## S04 · 后台「停用」与学生真实登录状态脱节 —— 已验证（存量数据修复待授权）

**原症状（M，修前可复现）**
`AdminRbacService.update({ isActive:false })` 只在 `passwordHash` 前加 `!DEACTIVATED!:`；学生用 `pinHash` 登录，`isActive` 与 `studentAuthVersion` 都没动 —— 列表显示已停用，学生照样能登录、旧令牌照样能用。新用例修前 **9 红 / 3 绿**。

**修复位置**
- `apps/api/src/admin-rbac/admin-rbac.service.ts`：停用 = `isActive=false` + 版本号 +1 + 删除该账号推送订阅 + 审计，**同一事务**；恢复启用只翻 `isActive`，不回退版本号（撤销的令牌不复活）；重复停用是 no-op。重置密码 = 登出所有设备（版本号 +1、清订阅），停用状态保持。保留防自我停用 / 自我降级；审计改为与变更同事务（`AuditService.log(event, tx)`），不含明文与摘要。
- 旧版前缀停用的存量行：列表、学生登录 / 认领（`student-auth.service` 的 where 用 `ENABLED_ACCOUNT_WHERE`）、令牌生命周期都按「已停用」处理；管理员再操作时去掉前缀并**补一次撤销**（否则去前缀那一刻旧令牌复活）。

**新增测试**：`apps/api/src/admin-rbac/admin-rbac.service.spec.ts`（12 条）—— 一份内存用户表同时驱动真实 RBAC、真实学生登录、真实令牌判据：
- 停用学生：`isActive=false`、版本号 +1、推送订阅清掉、密码摘要不再被改写。
- 停用之后：列表显示已停用、新登录失败、停用前签发的令牌当场失效。
- 恢复启用：能重新登录，但停用前的旧令牌不会复活。
- 防自我停用仍在（400、零写库）；审计 diff 为真实前后状态、操作人为当前管理员；重复停用 no-op；停用教职工旧令牌 401。
- 旧版前缀存量行：修复前三处都按停用处理；恢复启用去前缀并撤销（旧令牌不复活、订阅清掉、审计标记 `legacyDeactivationNormalised`）；再次停用规范化。
- 重置密码：旧令牌失效、订阅清掉、停用保持、审计不含明文 / 摘要；旧版前缀行重置后规范化。

**实测**：`npx vitest run src/admin-rbac` → 12/12 通过。

**剩余依赖 —— 存量数据修复（需要主线授权后执行，本组未碰生产）**
运行时已把旧前缀行当作停用处理，所以这项修复**不紧急**，只是为了以后能删掉兼容分支。只读 dry-run：

```sql
-- dry-run：列出按旧办法停用的账号（不改任何东西）
SELECT id, role, "isActive", "archivedAt", "studentAuthVersion", "lastLogin"
FROM "User"
WHERE "passwordHash" LIKE '!DEACTIVATED!:%';
```

获批后（先备份上面查出的行）在一个事务里：

```sql
BEGIN;
DELETE FROM "PushSubscription"
 WHERE "studentId" IN (SELECT id FROM "User" WHERE "passwordHash" LIKE '!DEACTIVATED!:%');
UPDATE "User"
   SET "isActive" = false,
       "passwordHash" = substring("passwordHash" from 15),   -- 前缀 14 个字符
       "studentAuthVersion" = "studentAuthVersion" + 1
 WHERE "passwordHash" LIKE '!DEACTIVATED!:%';
COMMIT;
```

回滚：用备份行把 `isActive` / `passwordHash` / `studentAuthVersion` 写回（订阅无法恢复，学生重新打开提醒即可）。

## S06 · 按用户限流实际共享校园 IP —— 已验证

**原症状（M，修前可复现）**
`RateLimitGuard` 是第一个全局守卫，只读 `req.user`，而此时还没有任何守卫挂身份（新接口的身份在更靠后的 `req.studentAuth`）→ 所有 `scope:'user'` 路由落 IP 桶。真实守卫顺序 e2e 修前：A 用尽 `push/subscribe` 配额后同 IP 的 B 被 429、A 换 IP 反而放行、历史接口同 IP 两个学生共用 10 次。另外学生身份那一路几乎全部声明 `scope:'ip'`（如 `vocab-v2/test/answer` 120 次 / 分，一个班同时答题就互相 429）。

**修复位置**
- `apps/api/src/common/rate-limit.guard.ts#userScopeId`：已有验证过的 `req.user` 就用；否则**自行验签** Bearer（绝不信未验签 JWT 的 id），再用 `account-lifecycle.tokenStillValid` 确认令牌仍有效（账号状态按请求缓存，后续守卫复用，不多查一次库）。无令牌 / 签名不对 / 已撤销 → 落 IP 桶。教师只读视角按「教师 + 学生」单独分桶。
- `common/global-guards.ts`：守卫顺序唯一来源（`app.module` 与 e2e 共用）。
- 学生身份那一路（vocab-v2 / lesson / vocab / morning-quiz 的 `@Public` + StudentIdentityGuard）的 `@RateLimit` 全部改 `scope:'user'`；student-auth 的 `change-pin`、`me` 同样改。匿名入口（登录 / 注册 / 注册状态 / 班级列表 / staging 夹具）保持 IP。

**新增测试**
- `guard-chain.e2e.spec.ts`「S06 —— 按用户限流在真实守卫顺序下按已验证身份分桶」（7 条，每条独立应用）：A 用尽不影响同 IP 的 B；A 换 IP 仍 429；匿名同 IP 第 11 次 429；伪造签名自称 B 落 IP 桶且不耗 B 的额度；废票不配拥有用户桶、刷不掉本人额度；`lesson/today`（原 IP 桶）同 IP 的 A 用尽 120 次后 B 照常；历史接口同 IP 两个学生各 10 次。
- `common/rate-limit-scope.spec.ts`（9 条）：从元数据清点，学生身份那一路的限流一律 user；student-auth 带令牌的 user、匿名入口 IP。用 `git stash` 回到未改的控制器验证：清点 5 条 + e2e `lesson/today` 1 条修前红。
- 既有 `rate-limit.spec.ts`（6 条）原样通过。

**实测**：两份 spec 合计 16 条 S06 用例全部通过。

**剩余依赖**：`PATCH /student-auth/me/english-level` 属词汇组 UI01 的方法，本组未动其装饰器，仍是 IP 桶（20 次 / 分，全校共用）—— 建议词汇组顺手改 `scope:'user'`。

## S07 · 同名登录分支未触发失败锁定 —— 已验证

**原症状（M，修前可复现）**
同名分支只 `updateMany({ pinFailedCount: { increment: 1 } })`，从不上锁：连错 7 次两个账号 `pinLockedUntil` 仍为 null。新用例修前 **5 红 / 5 绿**（红：同名 5 次 / 7 次 / 锁定期正确密码 / 并发 / 解锁；绿：单人、只锁了一个、无正确密码不给候选、带 studentId、改密码 —— 原逻辑在这些路径上本就正确，本次改为共用同一个函数）。

**修复位置**：`apps/api/src/student-auth/student-auth.service.ts`
- 抽出 `recordPinFailure`（数据库原子递增；满 `MAX_FAILED_ATTEMPTS`=5 次锁 `LOCK_MINUTES`=15 分钟并清零），单人登录、同名登录、改密码旧密码校验三处共用；`pinLocked()` 统一锁定回答（只有 `code` 与 `retryAfterSec`）。
- 同名：锁着的账号**不比对密码**（比对了就是「猜中」信号）；全部锁着、或这一次把剩下的都锁上 → 与单人分支一样 `pin_locked`；否则 `invalid_credentials`。仍是先核对密码再给候选。

**新增测试**：`apps/api/src/student-auth/login-lockout.spec.ts`（10 条，内存用户表 `findMany` 返回快照、`update` 原子累加）：单人 5 次锁 15 分钟清零（回归）；同名 5 次两账号都锁；审计原复现 7 次；锁定期正确密码仍 `pin_locked` 且不签发令牌；只锁一个时另一个照常、失败只记在没锁的；并发 7 个请求两账号都锁；15 分钟后解锁并清零；无正确密码的响应体只有错误码（不含班级 / 候选）；带 `studentId` 走单人分支同一套锁定；改密码旧密码连错 5 次锁、锁定期旧密码对了也 `pin_locked`。

**实测**：`npx vitest run src/student-auth` → 全部通过（`login-lockout` 10 条、`student-auth.service` 25 条）。

**剩余依赖**：无。（并发时在锁生效前的瞬间，多个并发请求仍可能各比对一次密码 —— 与单人分支原有行为一致；彻底收紧需「先原子占用一次尝试再比对」，改变现有契约，未做。）

## S08 · 教师只读学生视角又被过度拦截 —— 已验证（3 个隐式写 GET 留给其他组）

**原症状（C）**
`@RequireStudentToken()` 同时表达「必须认证」与「拒绝教师视角」，`lesson/today`、`vocab-v2/center`、`tests` 等纯读 GET 也拒教师视角。

**修复位置**
- `apps/api/src/common/student-access.ts`：`@RequireStudentToken()`（本人写，语义不变）、`@RequireStudentReadToken()`（读身份，必须认证、教师视角可读）、`@AllowTeacherView()`（全局 AuthGuard 那一路的读放行）。两道守卫对教师视角的**非 GET 一律拒绝**（兜底）。
- 已核实零写库并放开：`vocab-v2/search | center | daily | tests | test | source-meta`、`lesson/today`、`vocab/quiz/attempt/current`、`vocab/quiz/attempts`、`morning-quiz/student-result/:id | history-by-name | history-detail | upcoming-for-name | practice/:id | history-by-name/trend | skill-profile`、`push/config`、`writing-check/status`、`student/assignments`、`student/submissions/:id`、`student-auth/me`；以及一直可读、本次逐条核实零写库的旧 vocab 可选身份 GET：`vocab/lookup | words | due | lesson-cards | quiz | mistakes | mistakes/practice-queue | stats`。
- 服务层一行未改（`vocab-v2/*.service.ts`、`lesson.service.ts` 不在本组范围）。

**新增测试**
- `apps/api/src/common/student-access.spec.ts`（15 条）：守卫按读 / 写分开判（读放行并标记教师、本人写 403、读误标到 POST 仍 403、学生本人读写照常、读身份仍必须认证、未标注可选身份 GET 可读、未标注非 GET 拒）；**可达清单按两道守卫真实判据从元数据推导并全等钉死**；隐式写库 GET 仍是本人写；服务层证据（真实 `VocabularyV2Service` 的 profile/overview 会 upsert；search/center/daily/tests/test/source-meta 零写；真实旧 vocab 服务 10 个读方法零写）。
- `guard-chain.e2e.spec.ts`「S08」：15 条核实 GET 教师视角 2xx 且零写库；5 条旧 vocab 可选身份 GET 同样；3 条隐式写 GET 仍 403 零写库；学生本人读照常；无令牌读身份 GET 一律 403。

**实测**：`student-access.spec` 15/15、e2e S08 组全部通过。

**剩余依赖**：见文末「留给其他组的端点」—— 教师视角首页的 `vocab-v2/overview` / `profile` 仍被拒，首页概览卡片在教师视角下会失败，需服务层拆成纯读后换成 `@RequireStudentReadToken()`。

## UI07 · 共用设备换账号后推送归属不一致（后端部分）—— 已验证（前端部分归学生端组）

**原症状（C）**
页面按「浏览器有订阅」就显示已开启，库里那一行可能仍属于上一个账号；后端没有「当前账号 + 本设备」的查询；cron 只排除归档账号（停用、旧版停用标记、所有令牌都已过期的账号照推）；改密码 / 教师重置 / 后台停用后，被登出设备上的订阅仍然收提醒。新用例修前 **10 红**。

**修复位置**
- `apps/api/src/push/push.service.ts`：`status(studentId, endpoint)`（纯读取，别人名下一律 false）；`deliverableStudentWhere`（`role=student`、`ENABLED_ACCOUNT_WHERE`、`lastLogin` 或 `pinSetAt` 在 `STUDENT_TOKEN_TTL_DAYS`=30 天内）用于 cron 与 `sendToStudent`（双层）。`subscribe` 同一 endpoint 换人即转归属、`unsubscribe` 只删自己名下（原逻辑，补测试）。
- `push/push.controller.ts`：新增 `POST /push/status`。
- 撤销即清订阅：`student-auth.service.ts` 的 `changePin`、`adminResetPin`（同一事务），`admin-rbac.service.ts` 的停用 / 重置密码（S04）。
- `student-auth.service.ts` 导出 `STUDENT_TOKEN_TTL_DAYS`（令牌有效期单一来源）。

**新增测试**：`apps/api/src/push/push-ownership.spec.ts`（14 条）：A 订阅 → B 同设备订阅即转给 B（A 的 status false、B true）；转走后 A 的提醒不再发到这台设备；B 拿 A 的 endpoint 退订 → A 的原样保留；status 只看当前账号 + endpoint、零写库、推送未配置也能答；cron 跳过停用 / 归档 / 旧版停用标记 / 30 天内无令牌签发 × 4；只注册过（没单独登录）的照常推；直接 `sendToStudent` 停用账号也发不出去；`POST /push/status` 控制器契约（身份只取令牌、坏请求体 / 多余字段 400）。另：`student-auth.service.spec` 新增改密码 / 教师重置清订阅 3 条；`push.routes.spec` 路由契约加 `POST /api/push/status`；e2e 教师视角打 `POST /push/status` 403。

**实测**：`npx vitest run src/push` → 全部通过（`push-ownership` 14、`push.service` 10、`push-reminder.rules` 10、`push.routes` 1）。**没有向任何真实学生发送测试通知**（web-push 全程 mock）。

**产品取舍（按文档 §1「不能把 A 的个人提醒给 B」执行）**
- 改密码会清掉该账号**全部**订阅，包括正在用的这台（分不出哪一行是本机）。学生端改完密码应按 `/push/status` 显示真实状态，想要提醒就在本机重新打开。
- 账号 30 天内没有签发过任何长期令牌（登录 / 注册 / 改密码）→ 不再推它的提醒（设备很可能已换人）；学生重新登录后自动恢复（订阅仍在）。

**剩余依赖（学生端组）**
- 页面加载 / 登录 / 切换账号后用 `POST /push/status` 显示真实状态，不再只看 `pushManager.getSubscription()`。
- 退出登录时（令牌仍有效）调用 `POST /push/unsubscribe`，并在本机 `subscription.unsubscribe()`。
- 收到 `token_revoked` 时后端已清订阅；前端应在本机 `unsubscribe()`，避免下次登录误显示。

---

## 最终验证（worktree `.local/wt/sec`，HEAD `3d28040`）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `cd apps/api && npx vitest run` | 0 | **142 个测试文件 / 3304 条全部通过**（接手时基线 137 / 3153，含上一位未提交的工作） |
| `npm run typecheck -w @app/api`（worktree 根） | 0 | 无错误 |
| `npm run build -w @app/api`（worktree 根） | 0 | `nest build` 成功（`dist/` 已被 .gitignore） |

测试全程只用内存假对象 / Nest testing，未连接任何数据库；未 push、未部署、未写生产、未跑 railway 写操作、零 Anthropic API 调用。

## API 契约变化

| 端点 | 变化 | 调用方需要做什么 |
|---|---|---|
| `POST /api/push/status` | **新增**。请求体 `{ endpoint }`（strict，url ≤ 2000），响应 `{ subscribed: boolean }`；学生本人令牌；按用户限流 30 次 / 分；零写库 | 学生端用它显示提醒开关的真实状态（UI07 前端） |
| `GET /morning-quiz/history-by-name`、`GET /morning-quiz/history-detail` | 必须带学生令牌（本人或教师只读视角）；无令牌 403 `student_token_required`；不再返回 `needDisambiguation` / `candidates` / `suggestions`；他人答卷 404 `submission_not_found`（原 403 `name_mismatch`） | 新学生端只带 Bearer，无需改；旧 `apps/web` 匿名页失效（预期） |
| `GET /morning-quiz/history-by-name/trend`、`/skill-profile`、`/upcoming-for-name`、`GET/POST /morning-quiz/practice/*` | 必须带令牌；身份一律取令牌（同名不再返回候选）；`name` 可省略（取令牌姓名） | 无 |
| 学生身份那一路（vocab-v2 / lesson / vocab / morning-quiz）及 `student-auth/change-pin`、`me` | 限流改按学生分桶（无令牌仍按 IP）；阈值数字未改 | 无 |
| `GET /student/submissions/:id` | 响应改为字段白名单：去掉 `snapshotAnswer` / `overrideAnswer` / `overrideContent` / QA 字段 / 资源 AI 字段 / 内部判分字段；题干取老师改过的版本；分数与判分按两道门，未放行时为 `null`；新增 `scoresPending` | 旧端读的字段（题干、选项、配图、作答、`status`、`maxScore`、放行后的分数）都在 |
| `POST /student/submissions`、`PATCH …/scripts`、`POST …/submit`、`GET /student/assignments`（`mySubmission`）、`POST /morning-quiz/sessions/:id/open`、`POST /morning-quiz/sessions/:id/submit` | 返回白名单行；未定稿 `autoScore` / `manualScore` / `totalScore` 为 `null`，新增 `scoresPending` | 新学生端只读 `id` / `status`，无需改；旧 `StudentTake` 交卷弹窗会显示 0 分（预期，见 S01） |
| 所有非 `@Public` 接口（全局 AuthGuard） | 每次请求核对账号状态：学生令牌撤销 → 403 `token_revoked`；教职工账号停用 / 归档 / 角色变更 → **401 `token_revoked`** | 教师端按既有 401 处理重新登录 |
| 教师只读视角（`teacher_view`）令牌 | 可读清单见 S08；任何非 GET 与未放行的读一律 403 `teacher_view_is_read_only` | 无 |
| `PATCH /admin-rbac/users/:id`、`POST …/reset-password` | 停用写 `isActive` 并登出所有设备、清推送订阅；重置密码同样登出所有设备；响应形状不变 | 无 |
| 学生改密码、教师重置 PIN | 额外清掉该账号全部推送订阅 | 学生端改密码后重新查 `/push/status` |

## 留给其他组的端点 / 事项

**仍需服务层改成只读的 GET（目前保持拒绝教师只读视角）**

| 端点 | 服务方法 | 写了什么 | 归属 |
|---|---|---|---|
| `GET /vocab-v2/profile` | `VocabularyV2Service.profile()` | `studentVocabularyProfile.upsert({ where:{studentId}, create:{studentId}, update:{} })` —— 没有档案时建一行默认档案 | 词汇组（`vocab-v2/*.service.ts`） |
| `GET /vocab-v2/overview` | `VocabularyV2Service.overview()` → `profile()` | 同上 upsert | 词汇组 |
| `GET /morning-quiz/sessions/:id`（答题页） | `MorningQuizService.getStudentView()` → `ShuffleService.getOrCreate()` | 非 passage_pick 卷：`questionShuffleMap.upsert` 建乱序表；卷子被改过时先 `delete` 旧表 | 主线（morning-quiz 服务层） |

建议：GET 改为「找不到就返回默认值、不落库」的纯读查询，建档 / 建乱序表挪到对应的 POST（开始学习 / 开卷）里；改完把控制器装饰器换成 `@RequireStudentReadToken()`（答题页走全局守卫那一路则加 `@AllowTeacherView()`），并在 `student-access.spec.ts` 的清单里挪位置。`lesson.service.ts` 这一侧的 GET（`lesson/today`）已由 `read-only-invariant.spec` 证明零写库，无需改。

**跨组事项**
1. `auth/auth.service.ts#login`（教职工）签发令牌时加 `av: user.studentAuthVersion`，并拒绝 `archivedAt` 非空的账号 —— 让「停用后恢复」「后台重置密码」对教职工令牌同样永久生效（判据已预留）。
2. `PATCH /student-auth/me/english-level`（UI01）限流仍是 IP 桶，建议改 `scope:'user'`。
3. 微信通知 `score_ready` 的 `resultUrl`（`/my-history?name=…`）指向已不能匿名访问的旧页，建议改到学生端历史页。
4. trend / skill-profile / upcoming / 练习四个服务方法接收 `authStudentId`（`resolveStudentByName` 已支持），彻底去掉按姓名解析。
5. 存量「旧版前缀停用」数据修复（S04 的 dry-run / 事务 SQL），需主线授权执行；执行后可删除 `isLegacyDeactivated` 兼容分支。
6. UI07 前端三件事（见 UI07「剩余依赖」）。
