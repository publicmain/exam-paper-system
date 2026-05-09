<!--
Resilience

Bend, do not break, when load and pressure rise;
Roots that hold the soil hold up the skies.
Every migration scar, every stale row,
A seed for tomorrow's stronger flow.
What outlasts the storm is not the loud or proud —
It is the quiet schema that endures the crowd.
-->

# Agent 3 — Database & Data Integrity Audit (Round 7 上线前)

> 审查范围：`apps/api/prisma/schema.prisma`（1402 行，34 个 model），迁移历史，关键事务边界，QA 状态机，PII 字段。
>
> 工作目录：`C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2`
>
> 截止 commit：`7e8bf9b docs(qa-r5): real Claude QA review evidence + Railway E2E verification`

---

## 0. `prisma migrate status` 真实输出

仓库**没有 `apps/api/prisma/migrations/` 目录**（在两个独立检查里都验证过：`ls` 报 `No such file or directory`，`find` 列出的子目录只有 `cleanup/`、`path-b-fragments/`、`seed-data/`）。

执行 `npx prisma migrate status`：

```
> npx prisma migrate status
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: DATABASE_URL.
  -->  prisma\schema.prisma:8
   |
 7 |   provider = "postgresql"
 8 |   url      = env("DATABASE_URL")
   |
Validation Error Count: 1
[Context: getConfig]
Prisma CLI Version : 5.22.0
```

注入 dummy DATABASE_URL 再跑：

```
> DATABASE_URL="postgresql://fake:fake@localhost:5432/fake" npx prisma migrate status
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "fake", schema "public" at "localhost:5432"
Error: P1000: Authentication failed against database server at `localhost`, the
provided database credentials for `fake` are not valid.
```

无法连真实 DB（worktree 没 `.env`，本地无 PG），但**migrations 目录不存在**这一事实独立于连接，本身就是 R7 上线前的 BLOCKER。下面 D1 详述。

---

## 1. 潜在问题表（按严重度排序）

| # | 严重度 | 位置 | 现象 | 影响 |
|---|---|---|---|---|
| D1 | **critical** | `apps/api/prisma/migrations/`（不存在） | 仓库完全没有迁移目录，schema 演进只能靠 `prisma db push` | 生产数据库无版本快照，回滚靠人工，`migrate deploy` 不可用 |
| D2 | **critical** | `student.service.ts:189` `finalSubmit` | 状态翻转 + N 次 `answerScript.update` 不在 `$transaction` 内 | 中途崩 → submission 已 `submitted` 但部分 script `autoCorrect=null`、`awardedMarks=null`，老师改卷面板看到错的 autoScore |
| D3 | **critical** | `Paper`（385–438） | 整个 Paper 模型**零索引**（无 `@@index`），新增 11 个 QA 字段后老师面板查 `qaReviewVerdict in (needs_review, reject)` 全表扫 | 库一上量 dashboard 卡顿；`PUT /papers/:id` 的 `findMany({ where: { ownerId } })` 也走 seq scan |
| D4 | **high** | `Paper.qaReview*` 11 个新增字段 | 全部 nullable / 有 default ✓，但旧 paper 数据没 backfill；`generateWithQaLoop` 在最坏路径下停在 `archived + qaReviewRetries=2` | 旧 paper `qaReviewVerdict='pending'` 永远停在 pending，dashboard 计数不准；retry exhausted 后 paper 仍是 archived 状态，状态机"卡死"——见 D8 |
| D5 | **high** | `MorningQuizQaService.reviewPaper` (`paper.update` + `audit.log`) | 写 QA 结果和审计日志不在事务里，且 `paper.update` 不带任何乐观锁 | Anthropic 调完后两个并发 review 互相覆盖；audit 写失败时 verdict 已落库 |
| D6 | **high** | `Paper`（无 onDelete 在 owner/template/subject/component） | 删除老师 / 模板 / 学科会被 Paper 阻塞（默认 NoAction = RESTRICT） | 卸用户 / 改 syllabus 在生产报 23001 错；除非应用层先清理 |
| D7 | **high** | `MorningQuizSession`（无 `@@index([classId])`） | 老师面板查"我班最近考试"按 classId 过滤 + `date desc` 全表扫；只有 `(date,status)` 和 `(date,classId) unique` | 一学期 N×session×30 个 class 后慢查询 |
| D8 | **high** | `Paper.qaReviewVerdict` 状态机 | `generateWithQaLoop` retry 耗尽后 paper 留在 `status=archived` + `qaReviewVerdict=reject`，但 audit 标 `retry_exhausted`；前端老师"待审"列表 `verdict in (needs_review, reject)` 仍包含它 | 自动 reject 的 paper 永远卡在面板里，老师无法关闭（没有 `qaTeacherAction='dismissed'` 出口） |
| D9 | **high** | `StudentSubmission` 无 `(assignmentId, status)` 复合索引 | marker queue / cron `lockOne` `findMany({ where: { assignmentId, status: 'in_progress' } })` 只能用 `(assignmentId, studentId)` 唯一索引前缀 | session 被锁时所有班的 in_progress 扫描 N×classSize |
| D10 | **medium** | `Attendance.deviceUuid / sourceIp / userAgent` | 明文存 IP + UA + device fingerprint，**未加密、无保留期** | PII 法规风险（学生未成年时尤甚）；schema 里没有 `deletedAt` 或 retention 字段 |
| D11 | **medium** | `User.email`（明文） | 唯一登录标识 = 邮箱，无 normalize（lowercase）、无 `@db.Citext`；DB 上 `'A@x'` ≠ `'a@x'` | 同一老师可能创建两条 User，导致登录失败或重复账户 |
| D12 | **medium** | `qaTeacherActionBy String?`（无 FK） | 字段是 String 但意图是 User.id；删 user 时不检查、不级联 | 历史审核人删除后 dangling pointer，dashboard 显示空 |
| D13 | **medium** | `PaperQuestion.snapshotContent` Json + `MorningQuizQuestionSnapshot` 模型不存在 | 任务卡里提到的 model 实际不存在（IELTS quiz 题目快照存在 `PaperQuestion.snapshotContent` 里），TS 上没固化类型 schema（zod / class-validator） | 老 IELTS paper 字段漂移时 take-paper UI 渲染崩溃；C3 类历史问题再现 |
| D14 | **medium** | `seed.ts`（205 行） | 种子代码无幂等保护（`upsert by code` 一次，但 demo question 是 `create` 不是 upsert） | 重跑 seed 在已经有数据的库上抛 unique 冲突 |
| D15 | **medium** | `AnswerScript` 无 `@@index([markedById])` | 老师面板"我已批改" / "我未批改"全表扫 | 标分 cohort 查询慢 |
| D16 | **medium** | `WatermarkToken` 关系无 onDelete + 注释说"故意" | 注释承诺"应用层 SetNull"，但实际删 paper / student 会被 token 阻塞（无 SetNull） | 删除测试学生抛 23001；与注释意图不符 |
| D17 | **low** | `path-b-fragments/b1.prisma … b10.prisma` 仍在仓库 | 已合并入 schema.prisma 但碎片文件未删，读者会以为是"未合并" | 维护者心智负担；未来漂移源 |
| D18 | **low** | `cleanup/fix-replacement-chars.sql` 是裸 SQL，无版本机制 | 一次性修复脚本，无登记记录"是否已跑" | 重复执行无害，但和正规 migrate 脱节 |
| D19 | **low** | 所有 `Json` 字段（`config`, `markScheme`, `snapshotContent`, `qaReviewIssues`, `target`, `cropBboxJson`...）共 25 处 | Prisma 不校验形状；schema 注释里描述的 shape 散落各处，无运行时校验入口 | 数据漂移；旧记录读取断 TS |
| D20 | **low** | `Paper.totalMarksActual Int`（非空，无 default） | 应用层 `validation.service.ts:36` 才检查 `paper.questions.length===0`，DB 允许 `totalMarksActual=0` 通过 | C3 empty-paper 修复仅在应用层；下次绕开校验直插仍能落地 |
| D21 | **low** | `User.passwordHash String`（必填，无 default） | 通过 OAuth / 学生扫码注册的 student 也必须有 hash | 学生 User 行需要 dummy bcrypt（占空间，且潜在攻击面） |
| D22 | **low** | `MorningQuizSession.qrSecret String`（明文） | QR 轮转 secret 直存，不加密 | DB 泄漏 → 旧 QR 可被重放（已通过时间窗 + 轮转部分缓解，但 secret 本身应加密） |

> 一共 22 条，其中 critical 3、high 6、medium 7、low 6。

---

## 2. 每个 Model 单独审查（按 schema.prisma 出现顺序）

### `User` (line 21)
- 字段类型 OK，`isActive Boolean @default(true)` 是 R6 加的软删字段 ✓。
- **D11**：`email String @unique` 没指定 `@db.Citext`，PG 默认大小写敏感唯一。前端表单若不强制 lowercase，登录会有 ghost 账号。
- **D21**：`passwordHash String`（必填），但 student 通过 QR 扫码不该需要密码——目前 seed 里 student 也有 dummy hash。
- 索引：仅 `@unique` on email；查 `role=student AND ...` 无 secondary index，但 student 列表常通过 ClassEnrollment 反查所以暂无大问题。

### `Class` (line 60)
- `classCode String @unique` ✓（短码是 join key）。
- 缺 `@@index([level])` —— 头老师按 level 过滤会扫表，但 class 总数 < 1000，可接受。

### `ClassEnrollment` (line 75)
- onDelete: Cascade ✓；`@@unique([classId, userId])` ✓；`@@index([userId])` ✓。
- `role String @default("student")` 应该改成 enum（注释说"为 per-school customisation"，但 4 个枚举值已稳定半年）。**low**。

### `PaperAssignment` (line 90)
- onDelete: Cascade on paper / class ✓；`assignedBy` 无 onDelete（删老师阻塞）—— **D6 family**。
- `status String` 是 free-form `'scheduled' | 'open' | 'closed'`，应改 enum。**low**。
- 缺 `@@index([status])` 或 `(classId, status)` —— 学生看"今天我有什么"全表扫。

### `StudentSubmission` (line 116)
- onDelete: Cascade on assignment ✓；student 无 onDelete。
- `status String`：`'in_progress' | 'submitted' | 'marked' | 'returned'` — 应 enum。
- **D9**：`@@index([studentId])` 单列，缺 `(assignmentId, status)` 复合 — cron `lockOne` 和 marker queue 都会受影响。
- `maxScore Int` 必填无 default — 老 backfill 时若无 paper.totalMarksActual 会抛。

### `AnswerScript` (line 146)
- `@@unique([submissionId, paperQuestionId])` ✓；onDelete: Cascade 双向 ✓（commit 8a99dbd 修复）。
- **D15**：`@@index([markedById])` 缺。
- `selectedOption String?`：单字符 `'A'..'D'`，Json 没必要但目前可接受。

### `Question` (line 250)
- 索引齐全（4 个 `@@index`），含 `(complianceStatus, status)` ✓。
- `subject` / `component` / `primaryTopic` / `createdBy` 都没 onDelete，意图是 RESTRICT（不该误删 → 后顾），acceptable。
- `marks Int`、`difficulty Int`：DB 不约束范围，依赖应用层。**low**。

### `Paper` (line 385)
- **D3 BLOCKER**：模型最末尾连 `@@index` 都没有！`ownerId` / `subjectId` / `qaReviewVerdict` / `status` 都是热查询字段。
- **D4**：22 个核心字段 + 11 个新增 QA 字段。新字段全部 nullable 或有 default，旧行读取 OK ✓。但 `qaReviewVerdict` 默认 `"pending"`，旧 row backfill 后老师面板会把"老 paper"也当成"待审"。
- `qaTeacherActionBy String?`（line 425）应改 `User?` 加 FK — **D12**。
- `totalMarksActual Int` 必填无 default — **D20**。

### `PaperQuestion` (line 440)
- `@@index([paperId, sortOrder])` ✓（render order）。
- `question @relation(... references: [id])` 默认 NoAction — 意图是保护题库（删 Question 阻塞），但和老师"软删 / 归档"流程冲突。注释里没说明。
- `snapshotContent Json` — **D13**：IELTS quiz 的题目结构（passage 数组、matching_features、etc.）全靠这个 Json，TS 端没 zod schema 固化，C3 类型问题再发风险。

### `PaperVersion` (line 461)
- `(paperId, versionNumber)` unique ✓。
- `changedBy` 无 onDelete — 删老师会阻塞。**low**（version 历史本应保留）。

### `QuestionUsageLog` (line 478)
- `@@index([questionId, usedAt])` ✓ — 用于"题目重复使用检查"。

### `AuditLog` (line 490)
- 索引齐全。`actorId String?`（无 FK）合理（保留删后审计）。
- 没有 retention policy 字段 — 长期堆积。**low**。

### Phase-2 Ingestion 集（`SourceRepository` … `TeacherReview`，598–811）
- onDelete 链路清晰（Repo→File→Page/Item→Part/Asset/MS/Topic）全 Cascade。
- `SourceFile.sha256 String @unique` ✓ 防重复入库。
- `QuestionItem.questionId String? @unique` ✓ 1:1 mirror。
- 索引齐全。**这一段 schema 质量明显高于 Paper**。

### Path-B 集（`MarkerAssignment` 839、`QuestionQualitySignal` 889、`PaperVariantAssignment` 968、`Notification*` 1001/1020、`Code*` 1069/1098、`Tutor*` 1169/1205、`WatermarkToken` 1267）
- `MarkerAssignment.submissionId String @unique` ✓（一个 submission 只能有一个活跃 claim）。
- `MarkerAssignment.status String` — 应 enum（`active | released`）。**low**。
- `QuestionQualitySignal.recordedById String?`（无 FK）有意为之 ✓ 注释清楚。
- `PaperVariantAssignment.@@unique([assignmentId, studentId])` ✓ 幂等。
- `WatermarkToken` — **D16**：注释说"应用层 SetNull"，但 `paper @relation(...)` 默认 NoAction，删 paper 阻塞，与注释承诺矛盾。
- `TutorSession.submission/paperQuestion onDelete: SetNull` ✓ 唯一显式 SetNull 用法。

### `MorningQuizSession` (line 1322)
- `paperAssignmentId String @unique` ✓ 1:1。
- `@@unique([date, classId])` ✓ 防重复创建。
- **D7**：`@@index([date, status])` 有，但缺 `@@index([classId, date])` — 老师查"我班最近"。
- `qrSecret String` 明文 — **D22**。
- `scheduledBy` 无 onDelete — 删老师阻塞。

### `Attendance` (line 1347)
- `@@unique([sessionId, studentId])` ✓。
- `@@index([sessionId, deviceUuid])` ✓ 防作弊（commit 2fb05f1）。
- **D10**：sourceIp/userAgent/deviceUuid 明文 PII 三连，无 retention 字段。
- `submission @relation(...)` 默认 NoAction — 删 submission 阻塞 attendance。

### `ClassEnglishLevel` (line 1378)
- `classId String @unique` ✓ 一个班一条 level。
- `effectiveFrom DateTime` 必填无 default — 应有 `@default(now())` 防忘填。

### `QuestionShuffleMap` (line 1387)
- `(studentId, paperId) @@unique` ✓。
- `optionOrders Json` 无类型固化 — **D19 family**。

---

## 3. 事务边界审查

`grep prisma.$transaction` 命中 9 处：

| 文件 | 用途 | 评估 |
|---|---|---|
| `morning-quiz/morning-quiz.cron.ts:87` `lockOne` | 锁 session + force submit + 标 absent | ✓ 全部包裹 |
| `morning-quiz/morning-quiz.service.ts` | submit / saveAnswer | **❌ 没用** — saveAnswer 是单 upsert OK；但 finalSubmit 路径在 student.service 里 |
| `student/student.service.ts:189` `finalSubmit` | submission 状态翻转 + N script update | **❌ D2** — 只有第一步原子（updateMany 条件 lock），后续 script update 在事务外 |
| `morning-quiz-qa/morning-quiz-qa.service.ts:288` | paper.update QA 结果 + audit.log | **❌ D5** — 两个独立写 |
| `practice/practice.service.ts:124` | topic remap | ✓ |
| `review/review.service.ts:278` | 审核 item | ✓ |
| `sources/sources.service.ts:173,250` | repo 同步 | ✓ |
| `ai/quick-paper.service.ts:337` | 创建 paper + paperQuestions | ✓ |
| `ai/ai-question-generator.service.ts:409` | 创建 item | ✓ |
| `admin-syllabus/admin-syllabus.service.ts:432` | bulk import | ✓ |
| `classifier/rule-classifier.service.ts:91` | 批量打 tag | ✓ |

**关键缺口**：
- `finalSubmit`（D2）— 学生交卷的 hot path 不是原子的。
- `MorningQuizQaService.reviewPaper`（D5）— QA 写库 + audit 不原子。

---

## 4. 状态机 / 卡死风险

### Paper QA 状态机（D8）
代码（`morning-quiz.service.ts:153-205`）：

```
attempt 0: build → review → reject → archive paper → loop
attempt 1: build → review → reject → archive paper → loop
attempt 2: build → review → 任何 verdict → 直接 return paperId（不 archive）
audit 'retry_exhausted' 写一次
```

观察：
- 第 2 次 retry 即使 verdict=`reject` 也直接返回 paperId，导致 paper 留在 `status=draft/published`（取决于 builder 写法）+ `qaReviewVerdict=reject` + `qaReviewRetries=2`。
- 老师 dashboard `listForReview` 用 `qaReviewVerdict in (needs_review, reject)` 拉数据，这条 paper 永远在列表里。
- 老师可以 `approve`（设 `qaTeacherAction=approved`）或 `rejectByTeacher`（设 `qaTeacherAction=rejected, status=archived`）。但 dashboard 过滤条件**没用 `qaTeacherAction is null`**（line 519-525 的 `listForReview` 只看 verdict），所以即使老师"批准"了 reject 的卷子，下次刷新还是看到——**轻度卡死**。

修复：`listForReview` 的 where 加 `qaTeacherAction: null`。

### Submission 状态机
`'in_progress' | 'submitted' | 'marked' | 'returned'` — 没看到从 `submitted` 回 `in_progress` 的路径，但 D2 描述的部分写场景会让 status 走到 `submitted` 而 script.autoCorrect 留 null，下游 marker 看 autoScore 偏低，是隐性失真。

---

## 5. PII / 敏感字段

| 字段 | 模型 | 敏感度 | 处理 |
|---|---|---|---|
| `User.email` | User | 中 | 明文，无 normalize |
| `User.passwordHash` | User | 高 | bcrypt ✓ |
| `Attendance.sourceIp` | Attendance | 中（学生 IP） | **明文**，无 retention |
| `Attendance.deviceUuid` | Attendance | 中（device fingerprint） | **明文**，无 retention |
| `Attendance.userAgent` | Attendance | 低 | **明文** |
| `MorningQuizSession.qrSecret` | MQ Session | 中 | **明文**（轮转部分缓解） |
| `NotificationConfig.target` (webhookUrl / mailing list) | Json | 中 | **明文**（外部 webhook URL 即权限 token） |
| `WatermarkToken.token` | Watermark | 低（设计为公开） | OK |
| `TutorMessage.content` | Tutor | 中（学生答题历史 + AI 回答） | **明文** + 永久保留 |

**没有**：手机号、身份证号、微信 openid（grep 全仓 0 命中 schema）。所以 PII 风险面比预期小，但 `Attendance.deviceUuid + sourceIp + userAgent` 三连足以做学生轨迹画像，且 `NotificationConfig.target` 的 webhookUrl 是一种 secret——这两个建议加密 / 加 retention。

---

## 6. 迁移历史完整性

- **`apps/api/prisma/migrations/` 不存在**。
- 仓库改 schema 走 `prisma db push`（无版本快照）。
- `apps/api/prisma/cleanup/fix-replacement-chars.sql` 是一次性 SQL 修复脚本，未挂入 migration 流。
- `apps/api/prisma/path-b-fragments/b1..b10.prisma` 是早期 path-B 的 fragment 备份，**已经合并进 schema.prisma**，但文件未删 — 维护者读起来会以为是"未合并 fragment"。

> R7 上线前的硬性建议：用 `prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script > 0001_baseline.sql` 把当前 schema 固化为 baseline 迁移，否则上线后任何回滚都是手工 SQL。

---

## 7. 修复清单（按可执行性排序）

### 立即（M：5 行内 schema 改动）
- **D3**：Paper 加 `@@index([ownerId, status])`、`@@index([qaReviewVerdict, qaTeacherAction])`、`@@index([subjectId, status])`。
- **D7**：MorningQuizSession 加 `@@index([classId, date])`。
- **D9**：StudentSubmission 加 `@@index([assignmentId, status])`。
- **D15**：AnswerScript 加 `@@index([markedById])`。
- **D8**：`MorningQuizQaService.listForReview` 加 `qaTeacherAction: null` 过滤。

### 短期（一周内）
- **D2**：`finalSubmit` 包 `$transaction`，把 N 次 `answerScript.update` 收进去（注意 `for (const u of ...)` 在 tx 内仍是顺序，但保证原子）。
- **D5**：`MorningQuizQaService.reviewPaper` 包 `$transaction`，paper.update + audit 一起落地。
- **D1**：用 `prisma migrate diff` 生成 baseline 迁移，把 `cleanup/fix-replacement-chars.sql` 转成下一条迁移。
- **D6 family**：审视所有"删除老师 / 删除学科" 的 admin 路径，决定是 `SetNull`（保留历史）还是显式应用层级联清理；不要继续依赖默认 NoAction。
- **D13**：把 `PaperQuestion.snapshotContent` 用 zod 在 service 边界做 parse / safeParse 校验，IELTS 各题型一个 discriminated union。

### 中期（上线后）
- **D10**：Attendance 加 `retentionUntil DateTime?` 字段 + cron 定期清理；或对 `sourceIp` 做 hash。
- **D11**：User 改用 `@db.Citext` + 应用层 lowercase normalize。
- **D12**：`qaTeacherActionBy` 改 `qaTeacherActionByUser User? @relation("PaperQaActor", fields: [qaTeacherActionBy], references: [id])`。
- **D14**：seed 脚本所有 create 改 upsert。
- **D17 / D18**：删除 `path-b-fragments/`，把 `cleanup/` 转为 migrations。
- **D22**：`MorningQuizSession.qrSecret` 改成应用层 envelope encryption（pgcrypto 或 KMS）。

---

## 8. 没问题的部分（清单完整性 vs gold-plating 区分）

- Phase-2 ingestion 链 (`SourceRepository → SourceFile → PdfPage → QuestionItem → QuestionPart/Asset/MarkSchemeItem`) 索引和 onDelete 全部到位。
- `MarkerAssignment.@@index([markerId, status])` + `[submissionId, status]` 设计良好，支撑 marker queue 的两个主查询。
- `Attendance.@@index([sessionId, deviceUuid])` 防作弊索引存在。
- bcrypt 密码哈希 ✓。
- `(date, classId)`、`(classId, userId)`、`(assignmentId, studentId)`、`(submissionId, paperQuestionId)` 等关键唯一约束业务 dedup 语义正确。
- `commit 8a99dbd` 修复了 `Paper→PaperQuestion→AnswerScript` 删除链的 23001 错误，方向正确。
- `MorningQuizQuestionSnapshot` model **不存在** — 任务卡里提到的这个 model 是误记；IELTS 题快照实际存在 `PaperQuestion.snapshotContent` 里（D13 已覆盖）。

---

## 9. 上线 GO / NO-GO 建议

**NO-GO，除非**：
1. D1 baseline migration 生成（5 分钟内可完成）。
2. D2 finalSubmit 事务化（30 分钟）。
3. D3 / D7 / D9 / D15 索引补齐（10 分钟）。

D8 / D5 / D10 / D13 可以接受作为已知 issue 上线，但**必须开 tracker**。其余 medium / low 列入下次迭代。
