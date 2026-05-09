# Round 7 Pre-Launch 10-维度 Audit 汇总

**审查范围**：`e6cb442^..7e8bf9b` 共 22 个 commit / ~12k LOC delta（Round 1-6 全部累计改动）
**审查方式**：10 个 agent 并行扫描，每个一个独立维度
**汇总时间**：2026-05-09
**Worktree HEAD**：`7e8bf9b`（与 origin/main 同步）

---

## 一句话结论

**目前状态：NO-GO。** 10 维度共发现 **21 条 Critical + ~38 条 High**，多条直接关联学生作弊面、教师误操作面、生产数据丢失面与 PDF 中文失败面。Critical 多数 30 分钟内可单点修复，但有几条（Hooks 违反、CDN 依赖、批量生成超时、prisma migrations 历史缺失）需要更结构化的处理。

---

## 严重度计数（去重后）

| 级别 | 数量 | 说明 |
|---|---|---|
| **Critical** | 21 | 上线 blocker，覆盖鉴权/数据完整性/前端崩溃/PDF/AI 链路 |
| **High** | ~38 | 强烈建议上线前修，部分可上线后第一周修 |
| **Medium** | ~50+ | 各分报告中详列 |
| **Low/Nit** | ~40+ | 各分报告中详列 |

---

## Critical 全清单（21 条）

按所属 agent 编号 + 该 agent 内编号引用，方便回溯证据。

### A. 鉴权 / 角色守卫缺失（4 条）

| # | 来源 | 现象 | 攻击 | 位置 |
|---|---|---|---|---|
| C-A1 | Agent 2 #1 / Agent 1 F-10 | morning-quiz-qa `approve` 无 role check（仅靠 service 兜底，但 controller 层零守卫） | 学生 curl 可批准 AI paper（绕过 QA） | `morning-quiz-qa.controller.ts:53-56` |
| C-A2 | Agent 2 #2 | morning-quiz-qa `teacher-reject` 无 role check | 学生可拒绝任意 paper（DoS QA 队列） | `morning-quiz-qa.controller.ts:60-74` |
| C-A3 | Agent 2 #3 | morning-quiz `setLevel` 无 role check | 学生可改自己班的英语等级（拿简单卷子） | `morning-quiz.controller.ts:283-297` |
| C-A4 | Agent 2 #4 / Agent 4 F-4 | morning-quiz `cancelSession` 无 role check + 跨班可写 | 任何已登录用户可取消任意 session | `morning-quiz.controller.ts:216-228` |

### B. 数据泄露 / 答案给学生（2 条）

| # | 来源 | 现象 | 位置 |
|---|---|---|---|
| C-B1 | Agent 4 F-2 | `/api/practice/questions` 把 `markSchemeItems` 直接返回 student 角色 | `practice.controller.ts` + service |
| C-B2 | Agent 1 F-2 | 学生提交回看走 `student.service.ts` 路径，**绕过了 round-3 C1 修的 redaction whitelist** —— 学生在结果页可拿正确答案 | `student.service.ts` 提交回看路径 |

### C. 启动安全 / fail-fast 不全（1 条）

| # | 来源 | 现象 | 后果 |
|---|---|---|---|
| C-C1 | Agent 4 F-1 / Agent 9 SEC-05 | `MOCK_AUTH=true` / `SCHOOL_IP_BYPASS=true` 在 prod 没硬阻断 | 一次错配即"任何请求 = mock-teacher"或 IP 闸全失效 |

### D. 数据库完整性（3 条）

| # | 来源 | 现象 | 后果 |
|---|---|---|---|
| C-D1 | Agent 3 D1 / Agent 10 A.3 | `apps/api/prisma/migrations/` 目录不存在；railway.json 用 `prisma db push --accept-data-loss` | 没有版本快照、不可回滚、`migrate deploy` 不可用、DDL 不可逆改动直接丢数据 |
| C-D2 | Agent 3 D2 / Agent 9 A3 | `student.service.ts:189 finalSubmit` 状态翻转 + `for ... await update(...)` 在事务外 | 中途崩 → submission 已 submitted 但 N 个 script 的 autoCorrect/awardedMarks 留 null，dashboard 显示错的 autoScore |
| C-D3 | Agent 3 D3 | Paper 模型零 `@@index`，R7 加了 11 个 QA 字段后老师面板 `verdict in (needs_review, reject)` 全 seq scan | 班级数据增长后老师面板会越来越慢 |

### E. 前端崩溃 / Hooks 规则违反（3 条）

| # | 来源 | 现象 | 触发 |
|---|---|---|---|
| C-E1 | Agent 5 P0-2 | `OLevelComprehension.tsx:30-43` / `OLevelCloze.tsx:32-47` 早 return 在 `useMemo` 之前 | paper.questions 由空变非空时 Hook order violation → 红屏 |
| C-E2 | Agent 5 P0-3 | `IELTSReadingPassage.tsx:100-115` `useMemo`/`useStoredHighlights`/`useStoredNotes` 全部在条件 early return 之后 | 同上 |
| C-E3 | Agent 5 P0-1 | 双击 / 网络慢时手动交卷可触发两次 POST `/submit` | `MorningQuizTake.tsx:197-202` await 期间 `submitted` 仍是 false |

### F. 业务链路诚信（5 条）

| # | 来源 | 现象 | 后果 |
|---|---|---|---|
| C-F1 | Agent 7 F1 | `finalSubmit` 完全不调用 `ShortAnswerEvaluatorService` —— 与 commit f01ca5d 描述"AI 短答"不符 | 学生 short_answer 永远等老师手批，AI 接入是空头 |
| C-F2 | Agent 7 F2 | QA loop 仅对 `verdict=reject` 重试，`needs_review` 第一次出现就放过、立即 schedule 给 session | 老师不去 dashboard 看就上线 |
| C-F3 | Agent 7 F3 | teacher-reject 把 paper 设 archived，但 MorningQuizSession 引用不变；`getStudentView` 不校验 paper.status | archived paper 仍会发给学生 |
| C-F4 | Agent 7 F4 | QA 自身抛错时 paper verdict 留 null，`listPending` filter 不含 null | 出错的 paper 永远在老师面板上看不到 |
| C-F5 | Agent 7 F5 / Agent 1 F-1 | 整批 25 张串行生成 + 串行 QA，单次 HTTP 7-12 分钟超 Railway 90s timeout；且 weekly cron 把 `batchGenerateForWeek` 的 `outcomes` 错读成 `items`，永远报 0 成功，单测 mock 同款错协议反而绿 | weekly cron 是假绿（重大诚信问题）+ 真跑会超时 |

### G. PDF / 文件 / 字体（2 条）

| # | 来源 | 现象 | 后果 |
|---|---|---|---|
| C-G1 | Agent 8 §8.1 | `apps/api/Dockerfile` 只装 `fonts-liberation`，没有 CJK 字体；watermark 用 pdf-lib StandardFonts.Helvetica 完全不能编码中文 | 中文班级名 / 学生姓名一律豆腐 |
| C-G2 | Agent 8 §3.1 | KaTeX CSS 走 jsdelivr CDN + `waitUntil:'networkidle0'`+30s timeout | CDN 抽风（国内常见）整个 PDF 导出 5xx |

### H. 认证 (1 条)

| # | 来源 | 现象 | 后果 |
|---|---|---|---|
| C-H1 | Agent 9 SEC-01 | `auth.service.ts:10-23 login` 不检查 `User.isActive`，但 schema 注释说应该检查 | 停用账号仍可登录；离职老师 7 天内可继续访问 |

---

## High 全清单（按主题归并，38 条）

### 鉴权 / IDOR
- H1 Agent 4 F-3 morning-quiz-qa approve/teacher-reject 缺 class-ownership check
- H2 Agent 4 F-5 AnalyticsService 全部 4 端点 trust caller，跨班拉数据
- H3 Agent 4 F-6 marker.listQueue/getSubmission/claim/scoreScript 跨班可见可改分

### API 契约 / 校验
- H4 Agent 2 morning-quiz Excel 导出 filename 中 classId 未 CRLF sanitize
- H5 Agent 2 papers updateQuestion overrideContent/overrideAnswer 类型 `any`
- H6 Agent 2 papers/generate questionMix 数组未 `@ValidateNested`
- H7 Agent 2 questions/assets storageUrl zod `.url()` 接受 `javascript:` 协议
- H8 Agent 2 ai/suggest-labels 无 role check，学生可烧 Anthropic
- H9 Agent 2 H-0-4 / Agent 9 SEC-11 全局零限流（`auth/login` 可在线爆破）

### 配置 / 反向代理
- H10 Agent 2 H-0-3 `trust proxy=true` 应改为 `trust proxy=1`
- H11 Agent 9 SEC-08 9 个 npm 漏洞（4 high，含 multer/lodash/@nestjs/core/basic-ftp/file-type/ip-address）

### 数据库
- H12 Agent 3 D4 旧 paper qaReview 字段 backfill 隐患
- H13 Agent 3 D5 `reviewPaper` 写库 + audit 不原子
- H14 Agent 3 D6 一堆关系无 onDelete（删用户/学科被 23001 阻塞）
- H15 Agent 3 D7 `MorningQuizSession` 缺 (classId, date) 索引
- H16 Agent 3 D8 reject-retry 状态机+listForReview 缺 qaTeacherAction:null 过滤
- H17 Agent 3 D9 `StudentSubmission` 缺 (assignmentId, status) 复合索引
- H18 Agent 9 EDGE-03 Class 上 Cascade 链一直串到 AnswerScript（误删一个班 → 整学期作业灰飞烟灭）

### 前端
- H19 Agent 5 P1-4 重新打开未提交早测，localStorage 没了就丢全部答案（后端 getStudentView 不返回 existingAnswers）
- H20 Agent 5 P1-5 提交后 stale 本地数据（flags/高亮/便笺/分栏比例）不清理
- H21 Agent 5 P1-7 多个 page 初始 fetch 没 AbortController/unmount guard
- H22 Agent 5 P1-10 / Agent 5 P1 `MorningQuizSchedule.tsx:301` 的 dashboard 链接是死链
- H23 Agent 5 P1-11+12 Time-Up auto-submit 不 flush autosave + IELTS 只 onBlur commit
- H24 Agent 1 F-3 `@CurrentUser() user: any` 全栈 36+ 处（AuthUser 类型已存在却未用）
- H25 Agent 1 F-4 codegrader.service.ts 9 处 `(this.prisma as any)` 多余

### UI / a11y
- H26 Agent 6 G1 输入框 onFocus 缺 scrollIntoView（iPad 软键盘遮挡）
- H27 Agent 6 P1 QuestionPalette 缺 focus trap / Esc / aria-modal
- H28 Agent 6 IELTS flag 从未上传后端
- H29 Agent 6 IELTS palette svg path 含非法 arc

### 链路 / cron / 业务
- H30 Agent 7 F6 timer auto-submit 不 flush autosave（重叠 H23）
- H31 Agent 7 F7 学生交卷无 audit log
- H32 Agent 7 F8 单 topic AI fail 不 retry（可能产 18 题 paper 只有 3 题）
- H33 Agent 7 F10 dashboard 无 needs_review 未读 badge

### PDF
- H34 Agent 8 §6.3 模型 ID `claude-sonnet-4-6`/`claude-opus-4-6` 是 alias 不是 dated id
- H35 Agent 8 §6.5 SDK 没显式 `maxRetries`
- H36 Agent 8 §2.1 长 stem + 多 part × 140mm answer-area 撑爆 A4
- H37 Agent 8 §4.2 空 Excel 静默生成只表头无数据行

### 错误 / 安全 / 配置
- H38 Agent 9 SEC-02 wechat-notify webhookUrl 可控 outbound 无 SSRF 防护
- H39 Agent 9 SEC-03 body 无 size limit
- H40 Agent 9 SEC-04 JWT 7 天 + 无 refresh + 无 revoke
- H41 Agent 9 A1 NestJS 没全局 ExceptionFilter，prod 泄露 stack/Prisma 内部
- H42 Agent 10 main.ts fail-fast 仅校验 JWT_SECRET/CORS_ORIGINS，未校验 MOCK_AUTH/SCHOOL_IP_BYPASS/MORNING_QUIZ_DEBUG/ALLOW_PROD_SEED/SCHOOL_PUBLIC_IPS（重叠 C-C1）
- H43 Agent 10 .env.example 缺至少 12 个 env vars（含 ANTHROPIC_MONTHLY_USD_CAP / OPENAI_MONTHLY_USD_CAP / TUTOR_DAILY_USD_PER_STUDENT_CAP / INTERNAL_API_TOKEN / PDF_WORKER_URL / PUBLIC_API_URL）
- H44 Agent 10 README 两处事实错误（"key already filled in" + "Dockerfile runs prisma migrate deploy"）

> 注：H 编号有重叠合并（如 H30=H23），实际去重后是 ~35 条。

---

## 上线 GO/NO-GO 判定

**当前判定：NO-GO**

**最低 must-fix（修完才能 GO）**：21 条 Critical 全部 + 必修 High 大约 15 条。
- 鉴权 4 条 Critical（C-A1..A4）+ MOCK_AUTH（C-C1）+ isActive（C-H1）：1 小时
- 答案泄露 2 条（C-B1, C-B2）：30 分钟
- 数据库 3 条（C-D1 baseline migration / C-D2 事务化 / C-D3 索引）：1 小时
- 前端 3 条（C-E1, C-E2, C-E3）：30 分钟
- 业务诚信 5 条（C-F1..F5）：F5 需要异步队列化（最复杂），其余共 1.5 小时
- PDF 2 条（C-G1 字体 / C-G2 KaTeX 本地化）：1 小时

**总修复预估**：5-8 小时（不含 C-F5 队列化）+ 测试 + Railway 部署验证 + 真实端点验证。

---

## 修复执行计划（阶段 B）

按依赖与风险，分四波：

**Wave 1 — 鉴权封堵（30-60 min）**
1. C-A1..A4 给 morning-quiz / morning-quiz-qa controllers 加 `@Roles(...)` 守卫
2. C-C1 main.ts 加 MOCK_AUTH/SCHOOL_IP_BYPASS prod fail-fast
3. C-H1 auth.service login 检查 `isActive`

**Wave 2 — 数据泄露 + 数据完整性（60-90 min）**
4. C-B1 practice 端点 redact markSchemeItems 给 student
5. C-B2 student.service 提交回看走 redaction whitelist
6. C-D1 生成 baseline migration（`prisma migrate diff`）+ 切 railway.json 改 `migrate deploy`
7. C-D2 finalSubmit 包 `$transaction`
8. C-D3 加 Paper 索引

**Wave 3 — 前端崩溃 + 业务诚信（60-90 min）**
9. C-E1, C-E2 Hooks 规则修复（重排 hook 调用）
10. C-E3 双击交卷防御（in-flight ref）
11. C-F1 finalSubmit 接 ShortAnswerEvaluatorService
12. C-F2 needs_review 不放过（必须 teacher 批准）
13. C-F3 archived paper 不发学生（getStudentView 加 status check）
14. C-F4 listPending filter 加 null
15. C-F5 暂记入 LAUNCH-READINESS（队列化太大，需 Dan 老师评估接受 7-12min 同步生成 vs 重构）

**Wave 4 — 基础设施（30-60 min）**
16. C-G1 Dockerfile 装 CJK 字体（noto-cjk）
17. C-G2 KaTeX CSS 改本地 bundle
18. H42/H43 main.ts fail-fast 扩展 + .env.example 补齐
19. Agent 1 F-1 weekly cron 协议修正 + 改单测断言

---

## 各 agent 报告分布

| Agent | 主题 | 行数 | Critical | High | 报告路径 |
|---|---|---|---|---|---|
| 1 | Code Quality | 382 | 1 | 4 | `agent-1-code-quality.md` |
| 2 | Backend API Contracts | 727 | 4 | 8 | `agent-2-api-contracts.md` |
| 3 | Database & Data | 308 | 3 | 6 | `agent-3-database.md` |
| 4 | AuthN & AuthZ | 463 | 2 | 4 | `agent-4-authz.md` |
| 5 | Frontend State & Null | 502 | 3 | 8 | `agent-5-frontend-state.md` |
| 6 | UI Mobile / iPad | 466 | 0 | 3 | `agent-6-ui-mobile.md` |
| 7 | User Flows E2E | 258 | 5 | 7 | `agent-7-user-flows.md` |
| 8 | PDF / Files / Generation | 325 | 2 | 5 | `agent-8-files-pdf.md` |
| 9 | Errors & Security | 392 | 1 | 8 | `agent-9-errors-security.md` |
| 10 | Production Readiness | 370 | 0 | 4 | `agent-10-production-readiness.md` |
| **合计** | | **4193** | **21** | **57**(去重前) | |

去重后 Critical 21 / High 38 / Medium 50+ / Low+Nit 40+。

---

## 阶段 C/D/E 待办

- 阶段 C：每条 Critical 修复后写 Before/After 证据（`EVIDENCE-MATRIX.md`）
- 阶段 D：push 到 main，Railway 重新部署，真调端点验证修复
- 阶段 E：写 `LAUNCH-READINESS.md`（含 Dan 老师 / 你 / 运维三方 checklist + 上线后第一周监控建议）
