# Agent 7 — 后端契约 / 向后兼容 / 答案 redaction 深度审查

审查范围
- 主诊：commit `a3398dc feat(morning-quiz/api): 学生视图返回 level 和 paperMode`
- 上下文 diff：`a3398dc^..5bb3a04`
- 关联文件：
  - `apps/api/src/morning-quiz/morning-quiz.service.ts`（a3398dc 版本）
  - `apps/api/src/morning-quiz/morning-quiz.controller.ts`
  - `apps/api/src/student/student.service.ts`（redactForStudent 对照）
  - `apps/web/src/pages/MorningQuizTake.tsx`（前端预期字段）
  - `apps/api/prisma/schema.prisma`（EnglishLevel 枚举）

审查方法说明
- 任务里点名的 `apps/web/src/components/exam/types.ts` 在工作树中**不存在**（`Glob` 验证）。前端真正消费这个 endpoint 的地方是 `apps/web/src/pages/MorningQuizTake.tsx` 中本地定义的 `interface SessionView`——本报告以它为准。
- 当前分支 HEAD = `81c55b5`，**a3398dc 不在 HEAD 历史链上**（`git branch --contains a3398dc` 只列出 `claude/youthful-volhard-f60797`）。HEAD 的 `morning-quiz.service.ts` 没有 redact helper、也没有 level/paperMode。审查目标按任务要求锚定到 a3398dc 的代码内容（`git cat-file -p a3398dc:...` 已 dump，下面所有引用行号均以该版本为准）。

---

## 重头戏：答案 redaction（Round-2 Critical #1 回归检查）

### Finding R3-7-1 — stripSnapshotContent 是 omit-list，留有未来扩展盲点
- 严重度：**Medium**（潜在升级到 High，取决于内容 schema 的演进）
- 文件 / 行：`apps/api/src/morning-quiz/morning-quiz.service.ts`（a3398dc 版）行 644-648
- 是否回归：**否**——这是上一轮（69ab6a2 / 79a2993）就已存在的设计选择，本次 commit 只是把它原样保留并新增 level/paperMode 字段。但仍要标出。
- 攻击场景：
  - 当前 schema：经查 `apps/api/src/admin-cleanup/ielts-repair.service.ts:143-220`、`apps/api/src/review/review.service.ts:260-300`，IELTS 与 review-flow 入库时 `Question.content.parts` 只写入 `{label, content, marks}`，答案落在 `Question.answerContent.text`——**不会**经 snapshotContent 路径泄漏。
  - 但是 `apps/api/src/pdf/templates.ts:107` 的渲染输入类型显式写了 `parts?: { label; content; marks; answer?: string }`。这条 schema 认定 `parts[].answer` 是合法 optional 字段。一旦未来某条 ingestion 路径（手动 import、新 AI 模板、past-paper PDF 解析）把 `answer` 也写入 `Question.content`（而不是 `answerContent`），`stripSnapshotContent` 不会过滤——会经 `paperQuestions[].snapshotContent.parts[].answer` 直送学生 F12。
  - 同类风险字段：`solution`、`explanation`、`rubric`、`expected`、`expectedAnswer`、`correctAnswer`、`correct`（在 content 内嵌时）、`subQuestions[].answer`、`completion[].answer`。`stripSnapshotContent` 全部不防。
- 验证：`stripSnapshotContent` 实现只 `const { markScheme, answerContent, ...rest } = sc; return rest;`（verified by reading mq-a3398dc.ts:644-648）。`student.service.redactForStudent` 也是相同 omit-list（verified by reading student.service.ts:240-274），两处一致——但**一致地不安全**。
- 建议修复：
  - 把 `stripSnapshotContent` 改为更严格的 deep clean：递归遍历 snapshotContent，删除任何键名属于 `answer / expected / correctAnswer / explanation / solution / markScheme / answerContent / rubric / correct` 的字段（无论嵌套层级）。
  - 或者反过来，做 pick-list：把 IELTS / O-Level / MCQ 几种 schema 各自的允许字段白名单写进类型常量，stripSnapshotContent 按 questionType 路由到对应白名单。
  - 同步更新 `student.service.redactForStudent`，并在两处加共享的 `redact-for-student.ts` helper（69ab6a2 commit message 里早就承诺过这件事，但实际上代码两边各自抄了一份）。
  - 加 regression 测试：构造一个 snapshotContent 包含 `parts[].answer` / `subQuestions[].expected` / `correctAnswer` 的 fixture，断言响应里这几个 key 完全消失。

### Finding R3-7-2 — stripOptions 是 pick-list，**安全**
- 严重度：Info
- 文件 / 行：mq-a3398dc.ts:640-643
- 实现：`opts.map((o) => ({ key: o?.key, text: o?.text }))`——只保留 key + text，过滤掉 `correct`、`explanation`、`feedback`、`distractor` 等所有其他字段。
- 是否回归：否，与 Round-2 一致。
- 验证：verified by reading mq-a3398dc.ts:640-643. 与 student.service.ts:240-243 形态完全一致。

### Finding R3-7-3 — 顶层 paperQuestions 字段是 pick-list，**安全**
- 严重度：Info
- 文件 / 行：mq-a3398dc.ts:665-672
- 实现：`{ id, sortOrder, marks, snapshotContent, snapshotOptions, questionType }`——**没有 `snapshotAnswer`、没有 `overrideAnswer`**。这是关键一道防线：即使 `Question.answerContent` 被 fetch 了（实际上没 fetch，行 598-604 只 select id + questionType），它也不会出现在响应。
- 验证：mq-a3398dc.ts:598-604 的 paperQuestion include 是 `{ question: { select: { id: true, questionType: true } } }`——只两个字段。`paper.findUnique` 也只 select `config`。**真正存答案的列（`PaperQuestion.snapshotAnswer`、`Question.answerContent`、`Question.markScheme`）从来没进过查询结果**。
- 是否回归：否。

### 总评 redaction
**Round-2 Critical #1 在这个 commit 上是稳的**——三道防线（不 select 答案列 → 顶层 pick-list → 内层 strip helper）都在。本次新增的 level / paperMode 没有触碰任何答案路径，只查了 ClassEnglishLevel.level 和 paper.config.mode。

唯一的隐忧是 R3-7-1：stripSnapshotContent 的 omit-list 设计本身脆弱，schema 一旦增字段（content.parts.answer 等）就会破防。**建议 Round-3 升级为 deep-clean 或 pick-list**，把 redaction 从「靠 schema 不变」变成「靠白名单兜底」。

---

## 新增字段：level / paperMode

### Finding R3-7-4 — paper.config 没整体 spread，只挑 mode 字段，**安全**
- 严重度：Info
- 文件 / 行：mq-a3398dc.ts:582-585、656
- 实现：`select: { config: true }` 把整个 config 读出，但响应 `paperMode = (paper?.config as { mode?: string } | null)?.mode ?? null`——**只挑 `mode` 一个字段**。其他 config 字段（`passageRef`、`questionCount`、`dateIso`、`quickPaper`、`syllabusCode`、`topics`、`includeDiagrams`、`difficulty`，verified by reading morning-quiz.service.ts:413-419 + quick-paper.service.ts:350-356）都不会泄漏。
- 即使未来 config 里塞了答案 key 或 explanation，本路径也不会暴露——除非有人不小心把 `paperMode` 改成 `paper.config` 整体 spread。
- 建议：在 stripSnapshotContent 旁边加一行注释「paper.config 当前只暴露 .mode，**未来加字段需 explicit pick**」，避免后人误把整个 config 当 metadata 透出。

### Finding R3-7-5 — level 字段值域 = Prisma enum，前端类型一致，**安全**
- 严重度：Info
- 文件 / 行：mq-a3398dc.ts:592-597、656-657；schema.prisma:1293-1297
- 实现：从 `ClassEnglishLevel.level` 读 EnglishLevel 枚举，目前 3 个值 `ielts_authentic | ielts_hard | olevel`。前端 `apps/web/src/lib/api.ts:297` 的 union 一致。
- 兜底：`classLevel?.level ?? (paperMode === 'passage_pick' ? 'ielts_authentic' : 'olevel')`——**枚举值之间映射，永远是合法值**。
- BC 风险：当前**为零**。前端 `MorningQuizTake.tsx` 的 `interface SessionView` **完全没有 level 和 paperMode 字段**（verified by reading MorningQuizTake.tsx:16-22）——多余的字段对 TS 结构性类型没影响，对运行时 JSON 也只是被忽略。
- 提醒：a3398dc 单方加后端字段而前端未跟进消费，是一个 **dead field** 状态。建议同 PR 里改前端 SessionView，或在前端加一行 TODO 把 level/paperMode 接进来。

### Finding R3-7-6 — Prisma 多查一次 ClassEnglishLevel，N+1 隐忧
- 严重度：Low
- 文件 / 行：mq-a3398dc.ts:592-597
- 实现：单独 `prisma.classEnglishLevel.findUnique`，按 classId 查。本来 `paperAssignment` include 已经有 `classId`，这里又起一次往返。
- 影响：每次学生开题加 1 次 DB roundtrip。当前 `getStudentView` 已经至少 4 次查询（session、attendance、paper、paperQuestion[]），多 1 次问题不大，但本可以 piggyback 在 `paperAssignment.include` 上：
  ```ts
  paperAssignment: { include: { class: { include: { englishLevel: { select: { level: true } } } } } }
  ```
  schema.prisma:72 已确认 `Class.englishLevel: ClassEnglishLevel?` 关联存在。
- 建议：合并到一次查询。**非阻塞**。

### Finding R3-7-7 — paperMode 取值未来扩展时前端无防御
- 严重度：Low
- 文件 / 行：mq-a3398dc.ts:656；前端 MorningQuizTake.tsx 不消费 paperMode
- 实现：服务端 `paperMode = paper.config.mode ?? null`，目前可能值 = `'passage_pick' | null`。前端目前没消费。
- 风险：当前端开始消费这个字段后，如果服务端将来加了 `mode='practice' / 'mock' / ...` 而前端 union 没更新，前端 switch 落到 default 分支会拿到错误 UI。
- 建议：a3398dc 配套需要在前端加严格 union，并 default-fall-through 到 'standard'。本次 commit 范围内无修改前端，**未阻塞但需配套 PR**。

---

## practice mode 路径

### Finding R3-7-8 — service / controller 完全没有 practice 分支，**无 redact 漏洞**
- 严重度：Info
- 验证：verified by `Grep "practice|mode === 'practice'"` 在 `apps/api/src/morning-quiz/` 下零命中。controller 也没接受 mode query param。getStudentView 从不读取 query 参数，行为对所有 student 一致。
- 结论：**当前 morning-quiz 路径不存在 practice mode 分支**，所谓「practice 模式下返回 correct 答案」的潜在风险**不适用**。如果 Agent 8 在前端发现了 practice 概念，那应该是另外的 endpoint（`apps/api/src/practice/practice.service.ts` 是单独的 service，不走 morning-quiz）。

---

## DTO / Authorization

### Finding R3-7-9 — 没有 class-validator / class-transformer / @Exclude，全靠手写 mapper
- 严重度：Info（设计选择，可接受）
- 验证：verified by Grep — controller 用 `zod` 做 input 校验，response 直接返回 service 出来的 plain object。没有 ResponseDTO + class-transformer。
- 影响：本次 redact 完全靠 service 里的手写 pick-list / strip helper。**漏写一个字段就会泄漏**。这就是为什么 R3-7-1 的 omit-list 风险值得长期关注——没有装饰器层兜底。
- 建议：长期看 `redactForStudent` + `stripSnapshotContent` 应该被抽到一个通用的 `@Expose / @Exclude` plain function helper（共享给 student.service 和 morning-quiz.service），并加 unit test。本次 commit 范围内不阻塞。

### Finding R3-7-10 — `@Get('scheduled')` 端点完全没有 RBAC 校验
- 严重度：**Medium**（信息泄漏）
- 文件 / 行：`apps/api/src/morning-quiz/morning-quiz.controller.ts:97-101`
- 是否回归：**否**——这是一直存在的问题，与本次 a3398dc 无关，但既然审查后端契约就一并报。
- 攻击场景：任何登录用户（含 student）GET `/morning-quiz/scheduled?weekStart=...` 即可拿到全校所有 class 的 morning quiz 排表，包括 paperId 和 paper.name / totalMarksActual。学生借此知道「今天 1班是 IELTS Cambridge 8 Test1 P1」，可以在被点到名前先做一遍。
- 验证：verified by reading morning-quiz.controller.ts:97-101 + service.ts:501-511 — controller 只检查 `weekStart` 参数；service `listScheduled` 也无 actor / role 参数。
- 建议：controller 加 `if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required')`，与 `dashboard` 端点对齐。

### Finding R3-7-11 — `@Patch('sessions/:id/cancel')` 没 controller-level role gate（service 内有）
- 严重度：Low
- 文件 / 行：morning-quiz.controller.ts:121-133
- 验证：service.cancelSession 内部第 518-520 行有 `['teacher', 'head_teacher', 'admin']` 检查——**有兜底**。但其他端点（dashboard、debug-activate）习惯把 role check 放在 controller 第一行，cancel 没有，风格不一致。**非安全问题**。

### Finding R3-7-12 — `getStudentView` 越权防御充分
- 严重度：Info
- 验证：mq-a3398dc.ts:574-579 用 `Attendance.sessionId_studentId` 复合主键作为 gate——必须有 attendance row 且非 absent 才放过。`studentId` 来自 `@CurrentUser()`（controller:147，verified），**不是 body 字段**——不可篡改。学生 A 拿学生 B 的 sessionId 拉别人的卷子，会被 `no_attendance_record` 403 挡掉。

---

## 向后兼容

### Finding R3-7-13 — 服务端单方加字段，前端未消费，**不 break 任何老客户端**
- 严重度：Info
- 验证：
  - 前端 `MorningQuizTake.tsx` 的 `interface SessionView`（行 16-22）只声明了 `sessionId / attendanceId / submissionId / quizEnd / paperQuestions`，没有 level / paperMode。多余 JSON 字段对 fetch().json() 反序列化、TS 结构性类型都没影响。
  - level 和 paperMode 都是 nullable / 有兜底（mq-a3398dc.ts:656-657），不会因为 ClassEnglishLevel 缺失而抛 500。
- 风险：仅是 dead-field 状态，前端要消费它需要单独 PR。

### Finding R3-7-14 — paperMode 兜底逻辑可能误判
- 严重度：Low
- 文件 / 行：mq-a3398dc.ts:657
- 实现：`level = classLevel?.level ?? (paperMode === 'passage_pick' ? 'ielts_authentic' : 'olevel')`
- 边界：如果一个 class 的 level 实际是 `ielts_hard` 但管理员忘记建 ClassEnglishLevel 行（按注释说 "older sessions / non-English subjects" 会出现），fallback 会把它误标成 olevel，前端选错 shell。这个降级是软件层的不确定性，**不是安全问题**，是产品层。
- 建议：在 audit log 里 record 一下 fallback 触发，以便 ops 发现哪些 class 缺 level 行。

---

## 整体结论（针对任务最后一问）

**Round-2 Critical #1（学生视图答案泄漏）在 a3398dc 这个 commit 上是稳的。** 理由：

1. **三道防线均在位**，verified by reading mq-a3398dc.ts:598-604（不查答案列）、665-672（顶层 pick-list 不暴露 snapshotAnswer）、640-648（内层 strip helper）。
2. **本次新增的 level / paperMode 不触碰任何答案路径**——只读 ClassEnglishLevel.level 和 paper.config.mode，两者都是 metadata。
3. **paper.config 是 explicit pick** 而非整体 spread——R3-7-4 验证。
4. **顶层 pick-list 设计** 比 omit-list 健壮——即使将来某个 schema 演进让 `Question.answerContent` 顺手 join 到 paperQuestion include，也不会经过 `paperQuestions.map(({...})=>{...})` 暴露出去，因为映射的字段是手写枚举的。

**但是有一个长期隐忧**（R3-7-1）：`stripSnapshotContent` 是 omit-list 而非 pick-list / deep-clean。当前 schema 没踩雷，但 `pdf/templates.ts:107` 的类型定义已经允许 `content.parts[].answer`——只要哪天有人按那个类型往 `Question.content` 写答案，redact 就会破防。建议 Round-3 趁势把 `stripSnapshotContent` 升级成递归 deep-clean 或按 questionType 走白名单，并和 `student.service.redactForStudent` 抽出共享 helper（69ab6a2 commit message 已经承诺过但未做到）。

**额外 Medium 发现**（R3-7-10）：`@Get('scheduled')` 端点无 RBAC，与本次 commit 无关但是真实的信息泄漏，建议本轮一并修。
