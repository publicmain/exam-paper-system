# Agent 7 — End-to-End User Flows · Round 7 上线前 audit

逐步追代码 / 数据流，把两条主链路每一步写出来。每步给：入口前端页面 + 路由、API endpoint、后端 service 方法、DB 写入 / 读取、回到前端的反馈、断点风险。

---

## 链路 A：学生晨测

### 步骤 1 — 学生扫大屏 QR，落到 `/scan/:token`
- 入口前端：`apps/web/src/pages/MorningQuizScan.tsx`（路由 `/scan/:token`，由 `App.tsx` 的 `<Public>` 段配置）
- 触发 API：`GET /api/attendance/scan-roster?qrToken=...`（`apps/web/src/lib/api.ts` 中 `attendanceScanRoster`）
- 后端：`AttendanceController.scanRoster`（`attendance.controller.ts:60`）→ `IpAllowlistGuard.canActivate`（`wifi-gate/ip-allowlist.guard.ts:80`，按 CIDR 校验校园 WiFi）→ `AttendanceService.fetchRoster`（`attendance.service.ts:54`）→ `QrService.verify` HMAC 校验 (`qr/qr.service.ts:47`) → 查 `MorningQuizSession` + `ClassEnrollment` (where role=student, isActive=true)
- DB：只读
- 前端反馈：渲染班级名 + 人数（不渲染 roster 名单本身），输入框 autoFocus
- **断点风险**：
  - `SCHOOL_PUBLIC_IPS` 未配置 → guard 返回 `allowlist_unconfigured`，所有签到全部 403（fail-closed 是对的，但部署疏忽 = 全校签不上）
  - `MorningQuizStatus !== active` → 直接 410 `session_not_active`。8:29:50 cron 才把 `scheduled → active`（`morning-quiz.cron.ts:39`，提前 30s），如果学生 8:29:00 提前扫码，会看到"窗口未开"
  - QR token 滚动期 30s + 30s 容忍 = 60s，跨窗口边界扫码有概率失败一次

### 步骤 2 — 学生输入姓名，POST 签到
- 入口前端：`MorningQuizScan.tsx:83 handleSubmit` → `api.attendanceScan(token, name, deviceUuid)`
- 触发 API：`POST /api/attendance/scan`（body: qrToken, studentName, deviceUuid）
- 后端：`AttendanceController.scan`（`attendance.controller.ts:82`）→ Zod 校验 deviceUuid 必须 UUID v4 或 `fallback-...` 格式 → `AttendanceService.scanQr`（`attendance.service.ts:98`）。五道关卡：
  1. `IpAllowlistGuard`（已在 controller 上）
  2. `qr.verify`（HMAC + freshness，`qr.service.ts:47`）
  3. `session.status === active`
  4. `ClassEnrollment` exact-name 匹配（trim、严格区分大小写）；多重匹配 → 403 `multiple_students_with_same_name`
  5. 时间窗口：`now < attendanceStart` → 410；`<= attendanceEnd` → on_time；`<= lateCutoff` → late；之后 → 写一条 absent + 410
  6. deviceUuid 冲突检查（同 session 同设备绑定不同学生 → 409 `device_already_used`）
- DB 写入：`Attendance.upsert` + `StudentSubmission.upsert`（maxScore=0，后面 finalSubmit 用 paper.totalMarksActual 不是 maxScore，这里其实就是占个坑）+ `Attendance.update` 把 submissionId 写回 + `ShuffleService.getOrCreate`（`shuffle.service.ts`，per-(student,paper) 一次写入）+ `JwtService.signAsync` 签 scanToken（exp = quizEnd 距 now 秒数，最少 60s）+ `AuditService.log`
- 前端反馈：把 scanToken 写进 `localStorage.auth_token`，`window.location.replace(quizUrl)` 跳到 `/morning-quiz/:sessionId`
- **断点风险**：
  - **H** — 跑批补录的 absent 行存在时（cron 在 8:50 之后跑过 `lockPastSessions`），`Attendance.upsert.update` 分支会把 status 从 absent 升成 on_time/late，**但 scanTime 也会被更新成 now**。如果运维在 9:00 之后想 debug 重激活，老 absent 行的 scanTime 会被覆盖。`debugActivateNow` (`morning-quiz.service.ts:1027`) 已经做了 `deleteMany({ status: absent, scanTime: null })` 兜底——OK。
  - **M** — JWT exp 用绝对秒数 `Math.max(60, ...)` 兜底。如果 attendance 在 8:59 才完成，token 只剩 60s，学生看不完一道题就被踢
  - **L** — `req.ip` 依赖 Express trust-proxy。`main.ts` 必须 `app.set('trust proxy', true)`，否则 Railway / Cloudflare 后面所有 IP 都看到 127.0.0.1

### 步骤 3 — 拉题（已 redact 答案）
- 入口前端：`MorningQuizTake.tsx:64 useEffect` → `api.morningQuizSession(sessionId)`
- 触发 API：`GET /api/morning-quiz/sessions/:id`（`morning-quiz.controller.ts:240`）
- 后端：`MorningQuizService.getStudentView`（`morning-quiz.service.ts:709`）。流程：
  1. 找 session + 校验 status !== cancelled
  2. **校验有 Attendance 行且 status !== absent**（关 4 复用，避免直接拼 sessionId 拉题）
  3. 加载 `paper.config`、`ClassEnglishLevel`（决定 IELTS / OL UI 模式）、`paperQuestion[]`
  4. 非 passage_pick 走 `ShuffleService.applyToPaper` 打乱顺序 + relabel 选项 A/B/C/D
  5. **redactSnapshotForStudent**（`morning-quiz.service.ts:93`）— 白名单制：`stem/passage/options...`，所有未在白名单的字段（含 correctOption / markScheme / explanation / answerContent / exampleAnswer）一律 drop
  6. 服务端写死 `mode: 'test'`（防 `?mode=practice` URL trick）
- DB：只读（除 ShuffleService.getOrCreate 可能写一次 ShuffleMap，已在签到时写过，幂等）
- 前端反馈：渲染 ExamProvider + ExamRenderer（IELTS 双栏 / OL 分页）
- **断点风险**：
  - 本步骤是答案泄漏的最高风险点。Round 3 SUMMARY C1 把白名单做对了。`SAFE_SNAPSHOT_SCALAR_FIELDS` (`morning-quiz.service.ts:56`) 是 deny-by-default，新加 schema 字段（如 cloze 的 `passage` + per-blank `correctAnswer`）只要不加白名单就自动安全。**新增 schema 字段必须同步更新 `docs/UI-QUESTION-TYPES.md`**——这是隐性合约。
  - 如果 `ClassEnglishLevel` 没配，回退逻辑是 `paperMode === 'passage_pick' ? 'ielts_authentic' : 'olevel'`。但 `pickPassageAndCreatePaper` 会写 `config.mode='passage_pick'`，所以这里的 fallback 一般正确。

### 步骤 4 — 答题，自动保存
- 入口前端：`ExamContext.tsx`（debounce 600ms）+ `MorningQuizTake.tsx:70 persistAnswer`
- 触发 API：`PATCH /api/morning-quiz/sessions/:id/answer`（每改一题一发，body: { paperQuestionId, selectedOption | textAnswer }）
- 后端：`MorningQuizService.saveAnswer`（`morning-quiz.service.ts:923`）
  1. 时间窗口：`now > quizEnd` → 400 `quiz_window_closed`
  2. submission.status === 'in_progress' 否则 400 `submission_locked`
  3. 校验 paperQuestionId 属于本 paper（防跨卷写入）
  4. MCQ 反向映射：把学生看到的 A/B/C/D 用 ShuffleMap unmap 回原 key
  5. `AnswerScript.upsert`
- DB 写：每改一题一行 upsert
- 前端反馈：savingId / saveError 通过 ExamContext 暴露；hasPendingSaves 用于 Submit 前的 flush
- **断点风险**：
  - **H** — Round 3 H6 修过：Submit 之前必须 `flushPendingSaves`。最后 600ms 的输入如果在 Submit 之后到达，会被 submission_locked 拒绝并丢失。`onSubmitClick`（`MorningQuizTake.tsx:197`）已经 await flush。但 **Timer 时间到 onTimeUp 走的是 raw `onSubmit` 不是 `onSubmitClick`**（`MorningQuizTake.tsx:300`），time-up 自动交卷场景**不 flush** —— Round 3 注释里的"can't await flush, but the local cache + reconnect replay covers"。如果学生在 8:59:59 写最后一笔且断网，Replay 会在新窗口失败（submission_locked），数据丢失，注释承认了这个 gap。
  - **M** — `OfflineBadge` + `mq:answers:${sessionId}` localStorage 兜底，重连后 ExamContext replay。但 replay 也要 status=in_progress；9:00 cron 锁卷后，所有未送达的 patch 都会 400。

### 步骤 5 — 提交，锁单 + 自动判分
- 入口前端：`MorningQuizTake.tsx:81 submitToServer` → `api.morningQuizSubmit(sessionId)`
- 触发 API：`POST /api/morning-quiz/sessions/:id/submit`
- 后端：`MorningQuizController.submit`（`morning-quiz.controller.ts:269`）→ `MorningQuizService.findSubmissionForSession` 找 submissionId → **委托 `StudentService.finalSubmit`**（`student.service.ts:189`）
  1. 拉 submission + scripts（含 paperQuestion + question.options）
  2. **race-safe 锁单**：`updateMany({ where: { id, status: 'in_progress' }, data: { status: 'submitted', autoScore } })`，count=0 → 400 已被并发提交（`student.service.ts:206`）
  3. `autoGradeScripts`（pure helper）：**只评 MCQ**，比对 `snapshotOptions.find(o.correct).key === selectedOption`；short_answer / structured / essay **全部跳过**
  4. 逐 script update awardedMarks + autoCorrect
- DB 写：StudentSubmission（status=submitted, autoScore, submittedAt）+ N 条 AnswerScript update
- 前端反馈：清空 `mq:answers:${sessionId}` localStorage，navigate `/student`
- **断点风险**：
  - **C** — Agent 7 关键发现：**`finalSubmit` 完全不调用 `ShortAnswerEvaluatorService`**。`short-answer-evaluator.service.ts` 只在 `POST /morning-quiz/ai-grade/short-answer`（teacher-only，per-item，手工触发）暴露。任务描述里的"提交 → server 锁单 + 判分（auto-grader 部分题型）+ AI 短答（others）"中的"AI 短答"自动跑这个分支**不存在**——所有 short_answer 题在 finalSubmit 后 awardedMarks=null，留给老师手批。`autoGradeScripts` 注释（`student.service.ts:11`）也明说 "A short_answer is left to the marker (Phase 2 plan)"。这是设计选择，但不符合 task 描述。
  - **H** — `student.service.finalSubmit` 没有调用 audit log（unlike attendance.scan）。critical 的"学生交卷"事件在 audit_log 里查不到。
  - **L** — race loser 抛 `submission already submitted`，message 字符串硬编码 + 非 i18n，前端 setError 直接渲染英文。

### 步骤 6 — 学生看到（部分）成绩
- 入口前端：`StudentHome.tsx:33`（`/student` 路由）
- 触发 API：`GET /api/student/assignments`（`api.studentAssignments()`）
- 后端：`StudentService.listAssignmentsForStudent`（`student.service.ts:92`）
- DB：只读 PaperAssignment + nested submission
- 前端反馈：`Score: ${totalScore ?? autoScore} / ${maxScore}`（`StudentHome.tsx:41`）。
  - status='submitted' → "Submitted — view"（不显示分数）
  - status='marked' / 'returned' → 显示 totalScore；fallback autoScore
- **断点风险**：
  - **M** — 立刻在 9:00 之后看，状态是 submitted（marker 未批改 short_answer），学生只看到 "Submitted — view"，看不到任何 MCQ 自动分。但 autoScore 已经写进了 DB，**前端只在 marked/returned 时才渲染**——逻辑选择，是不是产品想要的？如果想要"立刻看 MCQ 部分分"，应在 submitted 时也渲染 autoScore。
  - **L** — `maxScore` 来自 StudentSubmission 在签到 upsert 时写的 0（`attendance.service.ts:236` 的 create），从不被 finalSubmit 更新。学生看到 "Score: 12 / 0"。

### 步骤 7 — 老师在 marker 端批改
- 入口前端：`MarkerQueue.tsx` + `MarkerScript.tsx`（路由 `/marker`）
- 触发 API：`GET /api/marker/queue`、`POST /api/marker/claim`、`PATCH /api/marker/scripts/:scriptId`、`POST /api/marker/finalize/:submissionId`
- 后端：`MarkerController` + `MarkerService`（`marker/marker.service.ts`）。Whole controller `@UseGuards(AuthGuard) @Roles('admin','head_teacher','teacher')`
  1. `claim` 原子获取，409 已被持有
  2. `scoreScript` 写 awardedMarks + markerComment
  3. `finalize` 校验所有 structured script 已批改 → 写 manualScore + totalScore + status='marked'，updateMany 防并发
- DB 写：AnswerScript.awardedMarks、StudentSubmission.totalScore + status='marked'
- 前端反馈：MarkerQueue refresh
- **断点风险**：
  - **M** — `finalize` 检查 "every structured script has awardedMarks set"；如果某 short_answer script 在 finalSubmit 时还没创建（学生空着没答这题），`AnswerScript.upsert` 没被触发 → script 行根本不存在 → 'ungraded' 计数为 0 → finalize 直通过，但学生该题被记 0 分（合理）。**但**如果 paperQuestion 是 short_answer 且 student.script 不存在，scriptUpdates 也不会包含它，所以 awardedMarks 永远 null → marker 端看不到这题去批 → 学生这题的分永远是 0。这是**静默丢分**，不算 bug 但不直观。

### 步骤 8 — 学生看最终成绩
- 入口前端：StudentHome 同上 → 状态变 'marked' → 显示 totalScore
- DB：只读
- **断点风险**：
  - 同步骤 6 的 maxScore=0 bug
  - 没有"老师重批后通知学生"的事件流；学生只能 F5

---

## 链路 B：老师周排课 → AI 生成 → QA 审核 → 学生看到 → 批改 → dashboard → Excel

### 步骤 1 — 老师创建班级 / 学生 / 周排课表
- 入口前端：`Classes.tsx`（`/classes`）+ `UserAdmin.tsx`（`/admin/users`）+ `MorningQuizSchedule.tsx`（`/morning-quiz/schedule`）
- 触发 API：`POST /api/classes`、`POST /api/users` 等（标准 CRUD）+ Schedule 页拉 `GET /api/classes`、`GET /api/morning-quiz/scheduled?weekStart=...`
- 后端：`ClassesController` / `UsersController` / `MorningQuizService.listScheduled`（`morning-quiz.service.ts:665`）
- DB 写：Class、User、ClassEnrollment、ClassEnglishLevel
- 前端反馈：表格刷新
- **断点风险**：
  - **L** — 在 Schedule 页点 generate 之前必须先把每个班的 `englishLevel` 配好；UI 用 disabled checkbox 拦了（`MorningQuizSchedule.tsx:185`）。后端 `batchGenerateForWeek` 也会 hard fail `class_level_not_set`，OK。

### 步骤 2 — AI 批量生成 paper（每张过 QA loop）
- 入口前端：`MorningQuizSchedule.tsx:72 handleGenerate` → `api.morningQuizBatchGenerate({ weekStart, classIds })`
- 触发 API：`POST /api/morning-quiz/batch-generate`（`morning-quiz.controller.ts:181`）
- 后端：`MorningQuizService.batchGenerateForWeek`（`morning-quiz.service.ts:356`）。对每 (date, class)：
  1. 幂等检查 `MorningQuizSession unique(date, classId)`，存在 → 跳过
  2. 拉 `ClassEnglishLevel`，无则记 `class_level_not_set`
  3. 选 builder：
     - `ielts_authentic` → `pickPassageAndCreatePaper('IELTS','AUTH')`：从 Question bank 按 `IELTS/<book>/Test<n>/P<m>/Q<k>` sourceRef pattern grouping，过滤 30 天内本班用过的 passage，随机挑一段，创建 Paper + N 条 PaperQuestion 快照
     - `ielts_hard` / `olevel` → `quickPaper.generate(qpInput, actor)`：调 Anthropic API 按 topic 分发，approve 进 question bank，组卷
  4. 套 `generateWithQaLoop`（见步骤 3）
  5. 拿到 paperId 后 `createSession({ date, classId, paperId })` 创建 MorningQuizSession
- DB 写：Paper + PaperQuestion + Question（仅 quickPaper path）+ PaperAssignment + MorningQuizSession + AuditLog
- 前端反馈：`outcomes` 表格逐行 OK / FAIL，可以重跑（幂等）
- **断点风险**：
  - **C** — 整个 batch 是**串行 for-loop**（`for (date) for (class)` 嵌套），5 天 × 5 班 = 25 次 AI 串行调用。QuickPaper 内部 4 个 topic 又串行 + 每个 topic 一次 Anthropic 调用，每张 paper 可能 10-20s。25 张就是 5 分钟，再加 QA loop 每张额外 5-15s（需要 Sonnet 调一次） = 7-12 分钟阻塞 HTTP 请求。前端 `busy` 状态会卡 7+ 分钟。如果用户网络断开或 Railway 90s 超时（默认）—— 整个 batch 看起来失败了，但部分已落库。需要后端改成 async job + polling。
  - **H** — AI generation 单 topic 失败时（`quick-paper.service.ts:158` catch），其他 topic 正常出题，最终 paper 题数比 targetCount 少。**没有 retry**——AI 错一次就少一题。整张 paper 至少有一个 topic 成功就不抛错（`quick-paper.service.ts:165`）；意味着 18 题 paper 可能只出来 3 题就走 QA。
  - **H** — `ielts_authentic` 模式 30 天去重过滤（`morning-quiz.service.ts:537`）只看 `assignments.some(classId)`，新 archived 的 paper 会留下空 PaperAssignment 吗？看 `pickPassageAndCreatePaper` 是 Paper-only 创建，不创建 Assignment（Assignment 在 `createSession` 里建）。所以 QA reject 的 archived paper **不会被排除**——但它没有 assignment 所以也不会被 30 天 filter。问题：**bank 中的同一个 passage 在 reject 重试时仍然是候选**，重试随机化可能再选回。最坏 3 次都同 passage 同 reject，浪费 3 次 AI 调用。
  - **M** — `createSession` 抛 `session_already_exists`（idempotent 检查在 batch loop 顶部已经做了，但 race 仍可能），此时 paper 已生成 + QA 过 + 没 session — **孤儿 paper**。无清理逻辑。
  - **M** — `batch-generate` 的 outcomes 表里 ok=true 不区分 "QA 通过" vs "QA needs_review"。老师以为生成成功就不管，但 needs_review 队列没有人去看。

### 步骤 3 — QA loop（最近加的）
- 后端：`MorningQuizService.generateWithQaLoop`（`morning-quiz.service.ts:153`）+ `MorningQuizQaService.reviewPaper`（`morning-quiz-qa/morning-quiz-qa.service.ts:204`）
  1. attempt=0 → 调 `qaReview.reviewPaper(paperId, { strict: false })` 用 Sonnet
  2. Anthropic API tool_use forced `submit_review`，system prompt cache_control=ephemeral
  3. `parseToolInput` reconcile：critical → reject；pass + high/medium → needs_review（防止 Claude 自己越界放宽）
  4. 写 `Paper.qaReviewVerdict / qaReviewSummary / qaReviewIssues / qaReviewedAt / qaReviewModel / qaReviewTokens / qaReviewCostUsd`
  5. verdict=reject 且 attempt < 2 → `Paper.status='archived'`，attempt++，**升级到 Opus**（`STRICT_MODEL = 'claude-opus-4-6'`，line 18）重跑 builder 再调 `reviewPaper(strict=true)`
  6. verdict=needs_review 或 pass → 直接 return paperId
  7. 重试 cap = 2，3 次都 reject → audit `qa_review.retry_exhausted` + 返回最后一份给老师手批
- DB 写：Paper（更新 qaReview 字段）+ AuditLog
- **断点风险**：
  - **C** — **第 2 次仍 needs_review 时是放过还是 reject？** 看代码 line 171：`if (review.verdict === 'reject' && attempt < MAX_RETRIES)`。**只有 verdict==='reject' 才会重生**。`needs_review` 永远不触发重生，第一次出 needs_review 就直接 return paperId，paper 已经 schedule 给 session。理论上 needs_review 是可以放过的（"老师人工确认"），但只要 QA 找到 high/medium issue，第一次就上架了 — 老师不点 dashboard 就上线了。
  - **C** — **QA 自身失败**（`reviewPaper` 抛 `ServiceUnavailableException`）时 `generateWithQaLoop` 直接 catch + return paperId，verdict 仍是默认值。如果 paper 是新建的（无 qa 字段），此时 paper.qaReviewVerdict=null。老师 dashboard 的 `listPending`（`morning-quiz-qa.service.ts:518`）只过滤 `qaReviewVerdict IN ('needs_review','reject')`，**verdict=null 的卷子不在 dashboard 里**，老师永远看不到。Paper 直接被 createSession 用了，学生 8:30 就在做未审核卷子。
  - **H** — `ANTHROPIC_API_KEY` 未配置时（`morning-quiz-qa.service.ts:178`），verdict 写 'pending'，summary='AI 审核已跳过(ANTHROPIC_API_KEY 未配置)'。但 `listPending` filter 是 `IN ('needs_review','reject')`——'pending' **不在 dashboard**。这种情况下所有 paper 直接放给学生且老师看不到 review 状态。
  - **H** — `STRICT_MODEL = 'claude-opus-4-6'` 字面量。如果 model 名字 typo / 下线，Opus retry 整批失败 → 都退到第一次结果。建议从 env 读 + log warn。
  - **M** — `MAX_RETRIES = 2`（即 3 次总尝试）写死。一次 Opus 调用 ~$0.10-0.30；25 张全 reject = $7-22 + 7 分钟阻塞。

### 步骤 4 — 老师 review needs_review / reject 队列
- 入口前端：`MorningQuizQaReview.tsx`（路由 `/morning-quiz/qa-review`）。**入口在 Schedule 页右上角文字链接 `🤖 AI 审核待复核 →`**（`MorningQuizSchedule.tsx:138`）
- 触发 API：
  - `GET /api/morning-quiz-qa/pending`
  - `GET /api/morning-quiz-qa/papers/:id`
  - `POST /api/morning-quiz-qa/papers/:id/review`（rerun，可 strict=Opus）
  - `POST /api/morning-quiz-qa/papers/:id/approve`
  - `POST /api/morning-quiz-qa/papers/:id/teacher-reject`
- 后端：`MorningQuizQaController` + `MorningQuizQaService.{listPending, getReview, approve, rejectByTeacher}`
- DB 写：Paper（qaTeacherAction='approved'|'rejected'，qaTeacherActionBy/At；reject 时 status='archived'）+ AuditLog
- 前端反馈：双栏布局，左侧 pending list，右侧详情含 verdict / issues / passage / questions。Approve / Reject / Rerun(Sonnet) / Strict(Opus) 四个按钮
- **断点风险**：
  - **H** — Schedule 页的入口链接是**纯文字 link，无未读计数**。`MorningQuizSchedule.tsx` 没有调 `qaReviewPending`。老师周一早上看 schedule，看不出本周有没有 needs_review。回答任务问题"queue 在 teacher dashboard 实际是不是有 UI 显示"——**有 UI（独立页 `/morning-quiz/qa-review`），但 Schedule 页/主 Dashboard 上没 unread badge**。
  - **C** — **teacher-reject 后 status='archived'，但 MorningQuizSession 引用 PaperAssignment.paperId 不变**。`getStudentView`（`morning-quiz.service.ts:709`）**不校验 paper.status**。所以老师拒掉一张已经 schedule 给周三的卷子后，周三 8:30 学生还是会看到这张 archived paper。需要 reject 时 cascade cancel 对应 session。
  - **M** — `MorningQuizQaController.approve`（`morning-quiz-qa.controller.ts:53`）controller 层**没有 role check**。靠 service 层 `if (!['teacher','head_teacher','admin']...)`。其他 endpoint 都有 controller-level `if (!TEACHER_ROLES.has(user.role))`，唯独 approve 没有，不一致。功能上是 OK 的，但 defense-in-depth 缺一道。
  - **L** — 没有"为这条 issue 自动改卷"的快捷动作；老师只能 reject + 重新 generate 或手动到 PaperEdit 修。

### 步骤 5 — 学生扫码 → 拿到这张 paper
- 同链路 A 全流程，`getStudentView` 不校验 `paper.qaTeacherAction`、`paper.status`、`paper.qaReviewVerdict`。
- **断点风险**（重复但很关键）：
  - 一张 verdict=reject、teacher 还没 reject、retry_exhausted 的 paper，**会照常放给学生**。`generateWithQaLoop` 在 retry cap 后 audit 一笔但 return paperId 就走人，不阻塞 createSession。

### 步骤 6 — 老师在 marker 端批改 short_answer / structured
- 同链路 A 步骤 7
- **断点风险**：
  - **H** — Marker 端**完全没接** `ShortAnswerEvaluatorService` 的 AI 建议。老师批 short_answer 是从零开始，每题都要看 stem + studentAnswer + markScheme。任务里说"AI 短答 (others)"实际上**只有 teacher 主动调 `POST /morning-quiz/ai-grade/short-answer` 单条评估**这个手动 endpoint，没有融入 marker 流。
  - 同链路 A：`finalize` 判 ungraded 不计未创建 script → 学生空答题被静默给 0。

### 步骤 7 — 老师看 dashboard（本周成绩、班级排名、缺勤）
- 入口前端：
  - `Dashboard.tsx`（路由 `/`）—— 这是 **paper / template / question bank stats**，不是 morning-quiz 周报
  - `ClassStats.tsx`（路由 `/class-stats`）—— 班级层面统计
  - `AttendanceAdmin.tsx`（路由 `/admin/attendance`）—— 考勤记录
  - `MorningQuizSchedule.tsx`—— 排课页底部展示 scheduled sessions 列表
  - 单个 session 详情：`GET /api/morning-quiz/sessions/:id/dashboard`（`morning-quiz.controller.ts:230` → `MorningQuizService.getDashboard`）
- 后端 endpoint：
  - `getDashboard` (`morning-quiz.service.ts:1083`)：单 session 的 attendances + submission(autoScore/totalScore/submittedAt)
  - `AbsenceAlertService.findCurrentStreaks`（`morning-quiz/absence-alert.service.ts:49`）连续缺勤 ≥3 → `morning_quiz/absence-alerts/current` 调出（`morning-quiz.controller.ts:84`）
  - 班级聚合：`apps/api/src/analytics/...`（ClassStats.tsx 直接 fetch `/api/analytics/class/:id/...`）
- DB 读
- 前端反馈：表格 + 红色徽章
- **断点风险**：
  - **M** — `getDashboard` 一次查 `attendances` 全表 include `student` + `submission`，对单 session 没问题。但**缺"本周整周聚合"的 endpoint** —— 老师周五下午要看本周 5 天 5 班合计，必须 5 次 GET dashboard，前端拼。
  - **L** — Dashboard.tsx (主页) 显示 paper/template/question 数量，跟早测无关，老师周一进来不会看到任何早测 / 缺勤 / QA 待复核信息。**主路由的产品形态不对**——这 3 个最重要的指标都藏在 `/morning-quiz/schedule` 二级页。
  - **L** — `findCurrentStreaks` lookbackDays = (3+4)*2 = 14 天，对节假日多的月份可能不够。

### 步骤 8 — 导出 Excel
- 入口前端：`MorningQuizSchedule.tsx` 顶部 `<ExportAttendanceButton weekStart={weekStart}>`
- 触发 API：`GET /api/morning-quiz/export/attendance?from=&to=&classId=`（`morning-quiz.controller.ts:130`）→ stream binary `.xlsx`
- 后端：`MorningQuizExportService.generateAttendanceWorkbook`（`morning-quiz/morning-quiz-export.service.ts:47`）
  - sessions, attendances, submissions 三次独立查询 + Map 索引
  - **Sheet 1 考勤明细**：student / className / date / status (zh) / scanTime / submittedAt
  - **Sheet 2 成绩明细**：student / class / date / paperId / mcqScore / mcqTotal / mcqPct / totalMarks / grade(A-F)
  - **Sheet 3 缺勤汇总**：student / class / absentDays / lateDays / longestAbsentStreak / rate%
  - audit log：`morning_quiz.export.attendance` 含 from/to/classId/sessions/students 数
- 前端反馈：浏览器下载
- **断点风险**：
  - **M** — Sheet 2 显示 `paperId` 原值（`morning-quiz-export.service.ts:170`：`paperId: sess?.paperAssignment.paperId ?? '—'`），是 cuid 字符串，对老师无意义。应该是 paper.name。
  - **L** — Sheet 1 没有"老师"列；Sheet 2 没有"题目数 / 题目类别"列（只 mcq pct，IELTS reading 大量是 mcq + true_false + matching_features，但代码只用 `autoCorrect !== null` 判断，对 short_answer 直接漏掉）。老师拿到 Excel 看不出"短答还没批"。
  - **L** — 空数据时（指定 from-to 范围内一张 session 都没有），三个 sheet 仍然写出来，只有 header 行。**不报错、不警告**。老师可能以为下载坏了。
  - **L** — `formatDate` 用 `+8h` 加偏移然后切 ISO（line 299），如果服务器时区不是 UTC，输出错误。Railway 默认 UTC，OK；本地 dev 用户系统时区不是 UTC 的会出错。
  - **L** — `mcqPct = mcqCorrect / mcqAnswered.length`，如果学生 0 题答（in_progress 强制锁了一份空 submission），mcqAnswered.length=0 → pct=0，grade='F'。看起来 OK，但缺勤的学生不应该出现在 Sheet 2，目前会出现一行 0 分 F。

---

## 链路风险表（finding 提炼）

| # | 严重度 | 链路 / 步骤 | 位置 | 风险描述 | 修复建议 |
|---|---|---|---|---|---|
| F1 | **C** | A-5 | `apps/api/src/student/student.service.ts:189`（finalSubmit） + `morning-quiz/short-answer-evaluator.service.ts` | 学生 finalSubmit **不调用** ShortAnswerEvaluator，short_answer 题不进 AI 批改流，全部留给老师手批；与"AI 短答 (others)"任务描述不符 | finalSubmit 后异步触发 `shortAnswer.evaluate` 批量跑，写到 `markerComment='[ai-suggest]...'` + 待 marker 确认；或在 marker UI 集成 AI 建议按钮 |
| F2 | **C** | B-3 | `morning-quiz/morning-quiz.service.ts:171` | QA loop 只对 verdict=reject 重试；needs_review 第一次出现就直接放过，paper 立刻 schedule 给 session，老师不进 dashboard 看就上线 | needs_review 时阻塞 createSession（require teacher approve before assignmentId 写入），或 schedule 时把 session.status 设成 `pending_review`，scan 时校验 |
| F3 | **C** | B-4 → A-3 | `morning-quiz/morning-quiz.service.ts:709`（getStudentView） + `morning-quiz-qa/morning-quiz-qa.service.ts:587`（rejectByTeacher） | teacher-reject 把 paper.status='archived' 但 MorningQuizSession 引用不变。老师周一拒掉的卷子，周三学生扫码仍然能拿到 | rejectByTeacher 时同步 cancel 所有引用此 paper 的未来 session，或 getStudentView 校验 paper.status !== 'archived' |
| F4 | **C** | B-3 | `morning-quiz/morning-quiz.service.ts:184-191` (catch 分支) + `morning-quiz-qa/morning-quiz-qa.service.ts:518` (listPending) | QA review 自身抛错（Anthropic 5xx / parse error）时 paperId 直接返回，verdict 留 null。`listPending` filter 只看 needs_review/reject，老师**永远看不到这张未审核 paper**，学生直接做 | catch 分支把 verdict 写 'pending' + 加进 listPending；或在 catch 里把 paper.status 设成 'pending_review' 阻塞 createSession |
| F5 | **C** | B-2 | `morning-quiz/morning-quiz.service.ts:356`（batchGenerateForWeek 整体）+ `MorningQuizSchedule.tsx:80` | 整批 5×5=25 张 paper 串行生成 + 串行 QA，单次 HTTP 7-12 分钟，超 Railway/CDN 90s timeout 阈值；前端 busy 卡死 | 改异步 job（BullMQ / DB queue），返回 jobId 后前端 poll；或限制 batch size + 并行度 |
| F6 | **H** | A-4 | `MorningQuizTake.tsx:300`（onTimeUp 走 raw onSubmit）+ `ExamContext.tsx` | Timer 时间到自动交卷不调 flushPendingSaves，最后 600ms 输入会丢；offline replay 在新窗口被 submission_locked 拒 | onTimeUp 也调 onSubmitClick；或在 timeUp 触发时把 debounce 间隔降到 0 + 同步 await 最后一笔 |
| F7 | **H** | A-5 | `apps/api/src/student/student.service.ts:189`（finalSubmit） | 学生交卷未 audit-log；critical 操作在审计链中缺失 | finalSubmit 加 `audit.log({ action: 'student.final_submit' })` |
| F8 | **H** | B-2 | `apps/api/src/ai/quick-paper.service.ts:158-174` | 单 topic AI fail 时**不重试**，只要至少 1 topic 成功就不抛错。可能出 18 题paper 只 3 题 | 单 topic 加 1-2 次 retry（exponential backoff）；总成功率 < 50% 时整张抛 |
| F9 | **H** | B-3 | `morning-quiz-qa/morning-quiz-qa.service.ts:18` (`STRICT_MODEL` 字面量) | Opus model 字符串 hardcoded，model 改名 / 下线时 retry 全失败 | 从 env `STRICT_QA_MODEL` 读，启动时 ping 一次模型可用性 |
| F10 | **H** | B-4 (UI) | `apps/web/src/pages/MorningQuizSchedule.tsx:138` | 待复核入口是纯文字 link，无未读 badge / 计数；老师不点不知道有事 | 调 `qaReviewPending`，count > 0 时红圈 + 数字徽章 |
| F11 | **H** | B-3 | `morning-quiz-qa/morning-quiz-qa.service.ts:178-187` (no-key 分支) | `ANTHROPIC_API_KEY` 未配置时 verdict='pending'，**不在 listPending**，老师完全看不到。等于 QA 关闭 + 静默 | `listPending` 加上 `qaReviewVerdict IN (..., 'pending')`，或部署校验时硬阻 |
| F12 | **M** | A-2 | `apps/api/src/attendance/attendance.service.ts:252` | scan token TTL = quizEnd - now，如果 8:59 才扫上，token 1 分钟后过期；学生交卷请求会带过期 token → 401 | TTL 至少 15 分钟（覆盖 quiz 过后立刻看分），或 finalSubmit 后端用 attendance + studentId 双因子校验，不强依赖 jwt |
| F13 | **M** | A-6 / A-8 | `apps/web/src/pages/StudentHome.tsx:41` + `attendance.service.ts:236` | StudentSubmission.maxScore 在签到时写 0 从不更新；学生看到 "Score: 12 / 0" | 签到时 upsert 用 paper.totalMarksActual 替代 0；或 StudentHome 用 paper.totalMarksActual 而不是 sub.maxScore |
| F14 | **M** | B-2 | `morning-quiz/morning-quiz.service.ts:356` (batch loop)  | createSession 抛 session_already_exists 时，已生成的 paper 成为孤儿（无 session、无后续清理） | batch loop catch 内追加 `if (paperId) await prisma.paper.update({ where: {id: paperId}, data: { status: 'archived' }})` |
| F15 | **M** | B-7 | `Dashboard.tsx`（主页） | 主 dashboard 显示 paper / template / question 计数，与早测无关；老师进入系统看不到本周缺勤、QA 待复核、待批 marker 队列 | 主 dashboard 增加三块卡片：本周缺勤连击、QA 待复核数、待批改 submission 数 |
| F16 | **M** | B-8 | `morning-quiz-export.service.ts:170` | Excel Sheet 2 显示 paperId cuid 字符串，老师看不懂 | 改成 paper.name |
| F17 | **M** | B-6 | `marker.service.ts` finalize + `student.service.ts:13`（autoGradeScripts） | 学生空答的 short_answer 不生成 AnswerScript，marker 看不到 → 学生静默 0 分 | finalSubmit 时为每个 paperQuestion 创建对应 AnswerScript（即使 textAnswer=null）；或 marker queue 显示 "未作答 N 题" |
| F18 | **M** | B-4 | `morning-quiz-qa.controller.ts:53`（approve） | controller 层缺 role check（其他 endpoint 都有）；防御纵深一致性问题 | 加 `if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required')` |
| F19 | **L** | A-1 | `wifi-gate/ip-allowlist.guard.ts:69` | `SCHOOL_PUBLIC_IPS` 未配置 fail-closed，部署疏忽 = 全校签不上；启动时不显式抛 | 启动健康检查包括 SCHOOL_PUBLIC_IPS 或 SCHOOL_IP_BYPASS=true 至少一个；缺则 readiness probe fail |
| F20 | **L** | B-2 | `morning-quiz.service.ts:537` (passage 30天去重) | reject 重试时同 passage 可能再被随机选回（最坏 3 次都重复），浪费 AI 调用 | 在 builder closure 里 maintain 一个 `usedThisLoop` set，retry 时把上次 paper 的 passageRef 加进去再 filter |
| F21 | **L** | B-8 | `morning-quiz-export.service.ts` | 空数据范围下生成空 workbook 不警告（仅 header 行） | 生成前 `if (sessions.length === 0)` 在第一个 sheet A1 写 "无数据 No data in range" + 加粗 |
| F22 | **L** | B-8 | `morning-quiz-export.service.ts:163` | `mcqAnswered = scripts.filter(autoCorrect !== null)`，short_answer awardedMarks 写过的会被算进去（不会，因为 autoCorrect 只 MCQ 写）；缺勤学生 0 答会出现一行 0/0 0% F | 缺勤行不写入 Sheet 2 |

---

**总结**：链路 A（学生晨测）核心链路 mostly clean——shuffle / redact / IP gate / race-safe 锁单都做对了，唯一关键漏洞是 short_answer 完全没接 AI 批改 (F1) + audit 缺失 (F7)。链路 B（老师 → AI → QA → 学生）有 4 个 critical：QA loop 对 needs_review 不阻塞 (F2)、teacher reject 不 cascade (F3)、QA 自身抛错时 paper 静默放行 (F4)、整批生成串行阻塞超时 (F5)。这四条任意一条触发都会让"未审核 / 已驳回"的卷子直接落到学生手上，是上线前必须修的高 ROI 项。
