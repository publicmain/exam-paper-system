# exam-paper-system 交接文档

> **适用对象**：接手本系统日常开发与运维的工程师。
> **前置要求**：TypeScript、NestJS、Prisma、React 基础；能读 SQL。
> **文档状态**：2026-08-14 全量核对，对应提交 `d371320`。

---

## 0. 怎么用这份文档

| 场景 | 读哪几节 |
|---|---|
| 第一天，先建立全局认知 | §1 系统职责 → §2 红线 → §3.1 每日时间线 |
| 明天就要独立值守早测 | §3 全部（日常运维 SOP） |
| 线上出问题了 | §4 故障排查手册 |
| 要改代码 | §5.2 代码地图 → §6 数据模型 → §7 对应子系统 |
| 要改某个"看起来很怪"的设计 | §8 设计约束与由来（**改之前必读**） |
| 要部署 / 回滚 / 连生产库 | §9 环境与部署 |
| 想知道还有什么没做完 | §10 待办与技术债 |

**最低限度**：即使不读别的，也必须先读 **§2 红线**。那一节列的操作会直接
损坏学生数据。

---

## 1. 系统职责与边界

### 1.1 系统做什么

三条业务线，共用一套题库与判分基础设施：

| 业务线 | 用户 | 频次 | 状态 |
|---|---|---|---|
| **早测**（morning-quiz） | G11 一个班，约 33 人 | 每工作日 08:30–09:00 | **生产运行中，最高优先级** |
| 试卷生成 | 老师 | 按需 | 生产可用 |
| 作业系统 v2 | 老师 + 学生 | 按需 | 生产可用，使用频次低于早测 |

**早测是这个系统的核心**。它每个工作日早上准时运行，出问题会直接影响
33 名学生的当天成绩和出勤记录。其余功能出问题可以第二天再修，早测不能。

### 1.2 服务清单

| 服务 | 平台 | 作用 | 出问题的影响 |
|---|---|---|---|
| `exam-paper-system`（API） | Railway | NestJS 后端，含所有定时任务 | 全系统不可用 |
| `nurturing-radiance`（Web） | Railway | React 前端静态托管 | 学生无法答题 |
| Postgres | Railway managed | 全部业务数据 | 全系统不可用 + 数据风险 |
| `pdf-worker` | Railway | Python 图形渲染 | 仅影响出卷带图的题 |
| `ops-dashboard` | Railway | 只读运维台 | 仅影响运维查看 |

**部署方式**：push 到 `main` 自动部署 API 与 Web。ops-dashboard 需要手动
`railway up`（它不在自动部署链路里，改了记得手动发）。

### 1.3 需要交接的账号与访问

以下不写在文档里，需要口头 / 密码管理器交接：

- Railway 账号与 `RAILWAY_API_TOKEN`
- GitHub 仓库 `publicmain/exam-paper-system` 写权限
- ops-dashboard 的密钥 URL（形如 `https://<host>/?k=<ACCESS_KEY>`）
- Seiue（校务系统）账号 —— 每日出勤同步要用
- 学校微信通知的配置入口（wechat-notify 的 admin UI）

**数据库凭证**在 Railway 变量里，不要复制到本地文件。临时连生产库的方法见 §9.4，
用完立刻删掉临时文件。

---

## 2. 红线：不要做的操作

这些操作会直接损坏学生数据。每一条都是真实发生过的事故。

| 禁止 | 后果 | 正确做法 |
|---|---|---|
| 用 `PATCH /morning-quiz/sessions/:id/debug-activate` 开补考 | **原地改写正式时间窗并删除已生成的缺席行**。2026-08-13 三名学生因此被记成"准时出勤"，早上的真实记录全部丢失 | 用 `POST /morning-quiz/sessions/:id/makeup/open` |
| `git add -A` 或 `git add <目录>` | 会扫进未跟踪的版权 fixture（剑桥雅思原文）。已发生两次 | 逐个文件 `git add <file>` |
| 把 `MORNING_QUIZ_AI_GRADING` 设成 `on` | 触发真实 Anthropic API 调用。本项目铁律是零 API 调用，判分全部人工完成 | 保持默认（不设或非 `on`） |
| 判分后再动场次状态（重新激活 / 重锁）而不复查 | lock cron 可能重跑，虽已有幂等守卫，但仍应复核 | 操作后回查 `ai-pending` 条数，见 §4 |
| 直接改 `AnswerScript.awardedMarks` 而不走脚本 | 绕过 `totalScore` 重算和错题采集，分数与错题本不一致 | 用 `apps/api/scripts/marker-apply.ts` |
| 轮换 `JWT_SECRET` | **所有已印刷的贴墙二维码立即失效**（v2 静态码用它签名） | 确需轮换则同步重印所有墙贴 |
| 在 JS 里做早测的跨日计算 | 时间字段存的是 UTC 挂钟时间，JS 时区处理会算错 | 在 SQL 里算，或用 `sgtDayOf()` |

---

## 3. 日常运维

### 3.1 每日时间线

时间为新加坡时间（SGT = UTC+8）。**A = 自动，H = 需要人工**。

| 时刻 | 谁 | 动作 |
|---|---|---|
| 06:30（周二至周五） | A | `morning-quiz-daily-fallback` cron —— 当天没场次时兜底生成 |
| 08:25 | A | lock cron 把当天 session 从 `scheduled` 翻 `active`（提前 5 分钟，见 §8.2） |
| 08:30 | A | 考勤窗口开启，学生扫贴墙码 |
| 08:30 | A | `teacher-todo` 晨间摘要推送 |
| 08:40 | A | 迟到线（`lateCutoff`），之后扫码记 `late` |
| 09:00 | A | 收卷。session 翻 `locked`，未交的强制交卷，无记录的学生插 `absent` 行 |
| 09:00 后 | A | MCQ 已即时判分；短答进人工队列 |
| 09:30 | A | `absence-alert` cron —— 连续缺席 ≥3 天的学生告警 |
| 上午 | **H** | **人工判分**，见 §3.2 |
| 上午 | **H** | **出勤同步到 Seiue**（`OL_MO_English` + `MO_English`） |
| 中午（按需） | **H** | 补考，见 §3.3 |
| 18:30 | A | `teacher-todo` 晚间摘要 |
| 周日 18:00 | A | `morning-quiz-weekly-generate`（需 `MORNING_QUIZ_AUTO_GENERATE=true`，当前手动） |

### 3.2 每日判分 SOP

**背景**：短答题不走 AI，由人判。系统提供两条路径，日常用脚本路径。

```bash
# 1. 导出今天待判队列（只读，不改数据）
railway run -- npx ts-node apps/api/scripts/marker-dump.ts > dump.txt

# 2. 人工判分，把结果写进 marker-apply.ts 顶部的 GRADES_<日期> 映射
#    格式：{ scriptId: { awardedMarks: number, reason: string } }

# 3. 写回
railway run -- npx ts-node apps/api/scripts/marker-apply.ts

# 4. 复核：待判条数应为 0
```

`marker-apply.ts` 的行为（对齐 `marker.service.finalize`）：

1. 写 `awardedMarks` / `markerComment` / `markedById` / `markedAt`
2. 重算受影响提交的 `autoScore` + `manualScore` + `totalScore`
3. 所有结构化题都判完后，提交状态 `submitted` → `marked`
4. **触发错题采集**（`MistakeService`）

**幂等**：已判过的 script 会被跳过，可以安全重跑。

**评语规范**（面向学生，会直接显示在成绩页）：

- 不写记账流水（`填11:xxx,判对。1。` 这类内部记号）
- 不用 markdown
- 必须给可迁移的方法，不只是"错了"
- 长答题（≥2 分）的评语一律保留，是最有价值的教学资产

判分完成后每日提交一次，前缀用 `grade:`：

```
grade(morning-quiz): 2026-08-14 人工判分 43 项
```

这不是形式主义 —— 它是判分依据的审计留痕，08-13 恢复被冲掉的 43 条判分
就是靠它。见 §8.6。

**另一条路径**（Web UI，适合零散补判）：
`GET /api/marker/queue` → `POST claim` → `PATCH scripts/:id` → `POST finalize/:submissionId`

### 3.3 补考 SOP

学校 2026-08 政策：早上无故缺席的学生中午补考。

```
POST /api/morning-quiz/sessions/:id/makeup/open     开窗
POST /api/morning-quiz/sessions/:id/makeup/close    关窗
```

**要点**：

1. **绝不用 `debug-activate`**（见 §2 红线）
2. 补考学生的出勤状态**仍然是 `absent`**，只额外写 `makeupAt`。这是设计意图 ——
   早上没来是既成事实，同步 Seiue 要照实报；补考补回的是学业内容，不是出勤
3. 补考窗口开着时，lock cron 会跳过该场次；关窗后下一轮 tick 正常收尾
4. 补考卷判分与正常判分同流程

### 3.4 每周出卷 SOP

**硬规则：一个班永远不重复做同一篇文章**（版本无关 —— `_v1` 和 `_v2` 算同一篇）。

1. 生成下周试卷（当前手动触发 `POST /morning-quiz/batch-generate`）
2. **生成后必须跑一次全历史重复检查** —— 这是易漏步骤，见 §10.3
3. 内容质量必须逐篇核对**内容本身**（读文章 + 题干 + 答案键），不能只看结构
4. 题库不足时**补充题库**，不要降低去重标准

### 3.5 定时任务清单

| cron 表达式 | 名称 | 作用 | 开关 |
|---|---|---|---|
| 每分钟 | `MorningQuizCron.tick` | 激活 / 锁定场次 | 无（核心） |
| `30 6 * * 2-5` | `morning-quiz-daily-fallback` | 当天无场次时兜底生成 | — |
| `30 6 * * 1` | `morning-quiz-review-fail-open` | 周一审核放行 | — |
| `0 18 * * 0` | `morning-quiz-weekly-generate` | 周日晚生成下周 | `MORNING_QUIZ_AUTO_GENERATE=true` |
| `30 9 * * *` | `absence-alert-daily` | 连续缺席告警（阈值 3 天） | — |
| `30 8 * * *` / `30 18 * * *` | `teacher-todo` 晨/晚摘要 | 老师待办推送 | — |

---

## 4. 故障排查手册

### 4.1 症状对照表

| 症状 | 首先检查 | 常见原因 | 处置 |
|---|---|---|---|
| 学生扫码报"考勤窗口尚未开启" | session `status` 是否 `active` | cron 未激活，或系统时间偏移 | 查 cron 日志的 `activated sessionId=...` 行；必要时手动改 status |
| 学生扫码报"二维码失效" | token 版本 | v1 轮转码过期（容差 75s）；v2 静态码不会过期 | 若是 v2 报错，检查 `JWT_SECRET` 是否被改过 |
| 学生扫码报 `qr_no_session_today` | 当天是否有 session | 未生成，或日期算错 | 手动生成当天场次 |
| 扫码报 `device_already_used` | 同一 `deviceUuid` 是否已签他人 | 借手机（合法）或代签（不合法） | 合法情况走人工更正流程 |
| 成绩页一直显示"待老师批改" | 该题是否有 `AnswerScript` 行 | 未作答的题**没有行**，`awardedMarks` 为 null，与"未判"同形 | 已修（`hasWrittenAnswer`）。若复现，查前端判定逻辑 |
| 判对的题显示红叉 | `awardedMarks` vs `autoCorrect` | 人工改判后 `autoCorrect` 未同步 | 已修（判过分一律以 `awardedMarks` 为准） |
| **人工判分不见了 / 变回 ai-pending** | `AnswerScript.updatedAt` 是否集中在同一时刻 | lock cron 重跑重判整场 | 见 §4.2 |
| 全班被记缺席 | 是否周末 / 是否兄弟层 | 见 §8 多难度层问题 | 已有多层防御；核对 `mass_absence` 告警是否误报 |
| 出卷图渲染失败 | pdf-worker 是否存活 | Python 服务挂了或 token 不对 | 查 pdf-worker 日志，核对 `INTERNAL_API_TOKEN` |
| 数据库故障 | — | — | 见 `docs/disaster-recovery.md`（独立 runbook） |

### 4.2 处置：人工判分被冲掉

**这是最严重的一类事故**（2026-08-13 发生，43 条判分丢失）。

**判定**：查 `AnswerScript.updatedAt`，如果大量记录集中在同一秒，说明被批量重写。

**原因**：场次被重新激活后，窗口关闭时 lock cron 又跑了一次，Phase 2 重判整场。

**现状**：已加两层幂等守卫（提交级排除 `status='marked'`；script 级跳过
`markedById` 非空）。理论上不会再发生。

**恢复方法**：从当天的 `grade:` 提交里取出原始判分脚本，重跑 `marker-apply.ts`。

**预防**：判分后如果又动了场次状态，回查一次待判条数：

```sql
SELECT COUNT(*) FROM "AnswerScript" s
JOIN "StudentSubmission" sub ON sub.id = s."submissionId"
WHERE s."awardedMarks" IS NULL AND s."textAnswer" IS NOT NULL;
```

### 4.3 历史事故索引

供排查时对照。详细根因见 §8 与 git 提交。

| 日期 | 现象 | 修复提交 |
|---|---|---|
| 08-14 | 判对的题显示红叉 | `69c8ffd` |
| 08-13 | 空白题永久显示"待老师批改" | `beb1f83` |
| 08-13 | 43 条人工判分被冲掉 | `4a98274` |
| 08-13 | 补考学生被记成"准时出勤" | `3434c74` |
| 08-13 | 错题采集从未触发 | `d16b439` |
| 08-13 | 版权原文误入库 | — |
| 08-12 | PWA 安装后身份变"测试学生" | — |
| 08-12 | 生词自测抽出冒犯性干扰项 | — |
| 05-28 | 08:29:5x 扫码报窗口未开 | — |
| 05-14 | 重扫被改记迟到 | — |
| 05-10 | 周日场次全班记缺席 | — |

---

## 5. 系统架构

### 5.1 服务拓扑

```
                    ┌──────────────┐
   学生手机 / iPad ──│  apps/web    │  React SPA + PWA
   老师浏览器       └──────┬───────┘
                           │ fetch，Bearer JWT
                    ┌──────▼───────┐
                    │  apps/api    │  NestJS，单副本
                    │              │  ├ 44 module / 282 端点
                    │              │  ├ @nestjs/schedule 内置 cron
                    │              │  └ Puppeteer 常驻 browser 实例
                    └──┬────────┬──┘
             Prisma    │        │  HTTP + X-Internal-Token
                    ┌──▼──┐  ┌──▼──────────────┐
                    │ PG  │  │ pdf-worker      │  FastAPI
                    └──▲──┘  │ (Python)        │  PyMuPDF / schemdraw / RDKit
                 只读   │     └─────────────────┘
                 SELECT │
                    ┌──┴──────────────┐
                    │ ops-dashboard   │  Express + node-pg
                    └─────────────────┘  只读 / 无 PII
```

**技术栈**：TypeScript（strict）· NestJS 10 · Prisma 5 · PostgreSQL ·
Puppeteer 23 · KaTeX ｜ React 18 · Vite 5 · Tailwind 3 · react-router 6 ·
zustand 5 ｜ Python 3 + FastAPI。

### 5.2 代码地图

**要改什么，去哪里找。**

| 我要改… | 文件 |
|---|---|
| 扫码逻辑、时间窗判定、防代签 | `api/src/attendance/attendance.service.ts` |
| 二维码格式、签名、分身码 | `api/src/qr/qr.service.ts` |
| 场次激活 / 锁定 / 强制交卷 | `api/src/morning-quiz/morning-quiz.cron.ts` |
| 出卷、排课、导出、技能画像 | `api/src/morning-quiz/morning-quiz.service.ts`（4166 行，见 §10.2） |
| 判分规则（MCQ / 短答） | `api/src/student/student.service.ts::autoGradeScripts` |
| 人工判分队列 API | `api/src/marker/marker.service.ts` |
| 题序 / 选项打乱 | `api/src/shuffle/shuffle.service.ts` |
| 错题收录与练习 | `api/src/vocab/mistake.service.ts` |
| 生词本与 FSRS 调度 | `api/src/vocab/vocab-review.service.ts`、`student-word.service.ts` |
| 生词自测出题 | `api/src/vocab/vocab-quiz.service.ts` |
| 技能画像（题型聚合） | `api/src/morning-quiz/skill-profile.service.ts` |
| 鉴权 / 三种 token | `api/src/common/auth.guard.ts` |
| 限流 | `api/src/common/rate-limit.guard.ts` |
| PDF 出卷 | `api/src/pdf/pdf.service.ts`、`templates.ts` |
| 学科图表（SVG 侧） | `api/src/ai/svg-diagram.service.ts` |
| 学科图表（Python 侧） | `services/pdf-worker/main.py` |
| 考试界面题型渲染 | `web/src/components/exam/QuestionTypeRegistry.tsx` + `questions/` |
| 学生成绩复盘页 | `web/src/pages/MyHistoryDetail.tsx` |
| 错题本页面 | `web/src/pages/MyMistakes.tsx`、`MyMistakesPractice.tsx` |
| 超时补做落地页 | `web/src/components/exam/TimeUpMakeup.tsx` |
| 运维台 | `apps/ops-dashboard/server.js` |

**规模**：`api/src` 41,713 行 / 197 文件；`web/src` 32,150 行 / 116 文件；
合计（不含测试）84,460 行 / 373 文件。

### 5.3 请求链路

全局守卫在 `app.module.ts` 注册，**顺序有意义**：

```ts
{ provide: APP_GUARD, useClass: RateLimitGuard },   // 先
{ provide: APP_GUARD, useClass: AuthGuard },        // 后
{ provide: APP_FILTER, useClass: GlobalExceptionFilter },
```

RateLimit 必须在 Auth 之前 —— 否则 `@Public` 路由直接穿过 AuthGuard，
`/auth/login` 的暴力破解就没有保护。**调整守卫顺序前先确认这一点。**

---

## 6. 数据模型

63 个 model，18 个 migration，95 个索引 / 唯一约束。

### 6.1 核心链路

```
PaperAssignment ──1:N── StudentSubmission ──1:N── AnswerScript
       │                        │
       │                        └──1:1── Attendance
       └── Paper ──1:N── PaperQuestion
```

| 表 | 作用 | 注意 |
|---|---|---|
| `MorningQuizSession` | 一场早测 | 唯一键 `(date, classId, level)` —— 一个班一天每个难度层一场 |
| `Attendance` | 出勤记录 | `scanTime` 是真实扫码时刻，`createdAt` 是写入时刻，**不要混用** |
| `StudentSubmission` | 一份答卷 | `status`: `in_progress` / `submitted` / `marked` / `practice` |
| `AnswerScript` | 一道题的作答 | **未作答的题没有行**，见 §6.2 |
| `MistakeEntry` | 错题本条目 | 收录时冻结快照 |
| `StudentWord` | 生词本条目 | FSRS 调度状态按列存储 |

### 6.2 字段陷阱（必读）

**① 时区**

`quizStart` / `quizEnd` / `attendanceStart` / `lateCutoff` 是
`timestamp without time zone`，存的是 **UTC 挂钟时间**（`00:30` 表示 08:30 SGT）。

- 跨日计算一律在 SQL 里做
- JS 侧用 `sgtDayOf()`（api）或 `sgtToday()`（ops-dashboard）
- 直接 `new Date(quizEnd)` 再取本地日期**必然出错**

**② 未作答的题没有 AnswerScript 行**

空白提交产生**零条** `AnswerScript`。接口是拿 `PaperQuestion` 补出来的，
`awardedMarks` 因此是 `null` —— 和"写了但还没判"完全同形。

任何统计"出手率""空白率"的查询，**分母必须来自 `PaperQuestion` 总数**，
不能来自 `AnswerScript` 行数。这个坑造成过已发布报表的数字错误
（某学生出手率 98% 实际是 37%）。

**③ MCQ 的答案存的是选项全文**

`AnswerScript.textAnswer` 存的是选项**文本**，不是 A/B/C/D。做答案雷同
比对时不能直接比字符串。

判断题（TFNG / YNNG）例外：存的是字母（A=TRUE，B=FALSE，C=NOT GIVEN），
而学生界面上看到的是单词。展示时需要 `translateAnswerLetter()` 翻译。

**④ `status = 'practice'` 必须排除**

练习提交与正式提交共存（唯一约束已移除，见 §8.4）。**每一处统计查询都要
显式排除**，否则练习数据会污染成绩。已经漏过一次。

**⑤ 重复学生账号**

库里存在 `@esic.local` 后缀的影子账号，但未选课，不会污染出勤。查询时按
选课关系过滤即可。

### 6.3 关键不变量

改代码时不能破坏的约束：

1. `AnswerScript.markedById` 非空 = 人工已定稿，**任何批量重算都不得覆盖**
2. `StudentSubmission.status = 'marked'` = 整份定稿，批量重判必须跳过
3. 撤题补分（`applyRetractionCredits`）是所有判分路径的**最后一道后处理**，
   撤回永远赢过重判
4. 补考不修改正式时间窗，出勤状态保持 `absent`
5. 同一班的同一篇文章（去 `_vN` 后）终身只出一次
6. 学生看到的题序 / 选项序由 `QuestionShuffleMap` 持久化，刷新必须一致

---

## 7. 关键子系统

### 7.1 二维码与考勤

**两代 token 格式**：

```
v1.<windowStartMs>.<hmac16>.<sessionId>     轮转码（投影仪场景）
v2.<classId>.<hmac16>                       静态码（贴墙，三段）
v2.<classId>.<variant>.<hmac16>             静态码带标签（四段，分身码）
```

- v1：每 15s 一个窗口，HMAC 用 session 的 `qrSecret` 签，容差 60s（总接受 75s）
- v2：不含时间戳，用 `JWT_SECRET` 签，域分隔前缀 `qr-static.v2.`
- 校验一律用 `timingSafeEqual`

**扫码五道闸门**（`attendance.service.ts::scanQr`）：

1. QR 校验（HMAC + 新鲜度）
2. session 状态必须 `active`
3. 姓名能解析到该班在册（`isActive`）学生
4. 时间窗判定 → `on_time` / `late` / `absent` / 补考
5. 设备去重 —— 同一 `deviceUuid` 在同一 session 不能签两个人

**重扫行为**：已经是 `on_time` / `late` 的记录只刷新指纹元数据，
**不覆盖 `scanTime` 和 `status`**。`absent` 的行才允许提升。

### 7.2 判分流水线

lock cron 的 `lockOne` 分三段，**中间不持有事务**：

```
Phase 1  小事务：session→locked，in_progress→submitted（autoScore=0 占位），补缺席行
Phase 2  事务外加载 scripts
Phase 3  逐份：判分 → 极小写事务。单份失败只记日志，不影响其余
```

拆开的原因：Prisma 交互式事务默认 5 秒超时，30 人 × 10 道短答必然超时，
整个 lock 回滚，session 会卡在 `active` 过了 `quizEnd` 还没锁。

**幂等守卫**（不可移除）：

```ts
// 提交级
where: { assignmentId, status: { notIn: ['practice', 'marked'] } }
// script 级
if (already?.markedById) continue;
```

**AI 判分开关**：

```ts
const aiGradingOn = process.env.MORNING_QUIZ_AI_GRADING === 'on';   // 默认关
```

关闭时走 `deferAi`：MCQ 即时判，短答 park 进人工队列。
`autoCorrect: null` 表示"无结论 / 被 defer" → 人工队列，与 `false`（判错）区分。

### 7.3 防作弊：确定性打乱

每个 (学生, 试卷) 对生成持久化置换表存进 `QuestionShuffleMap`：

```ts
const seedHex = createHash('sha256').update(`${studentId}.${paperId}`)
  .digest('hex').slice(0, 16);
const rng = mulberry32(seedFromHex(seedHex));
const questionOrder = fisherYates(indices, rng);
```

- 用确定性 PRNG 而非 `Math.random()`，seed 可复现（排查纠纷时能重放）
- 选项置换按 `paperQuestionId` 建键，判分路径无需 join 回 `Question`
- `unmapOptionIndex` 把学生看到的下标反解回原始下标
- 试卷被编辑后缓存置换会失效，`getOrCreate` 每次校验，无效则重新生成

### 7.4 生词本与 FSRS

用 `ts-fsrs`（MIT，纯本地计算，无 API 调用）。

```ts
const PARAMS = generatorParameters({
  enable_fuzz: false,
  learning_steps: [],       // 不可改，见 §8.3
  relearning_steps: [],
});
```

间隔序列：2 → 11 → 46 → 163 → 497 天。
每日复习上限默认 5，硬上界 20。

学生看到的 `state`（learning / review / known）**不参与调度**，
仅按下次间隔长短分档展示。

### 7.5 错题本

**四条收录规则**（纯函数 `shouldCollect`，可单测）：

```ts
if (s.awarded >= s.maxMarks) return null;          // 满分不收
if (!s.studentAnswer.trim()) return null;          // 空白不收
if (extractVocabWord(s.stem)) return 'vocabulary'; // 词义题
if (s.maxMarks >= 2) return 'long_answer';         // 长答题
if (repeatCount + 1 >= REPEAT_THRESHOLD) return 'repeated_tasktype';
```

**销账规则**：做对一次 streak 升 1，**隔天**再做对升到 2 并自动销账。
同一天内反复做对不叠加。做错归零。

**练习作答方式**由题型推导：TFNG 三键 / 段落字母（从原文正则抠出）/
翻卡自评（主观题，Anki 模式）。

### 7.6 前端题型渲染

`QuestionTypeRegistry.pickRenderer` 按**数据**分派，不按 `level` 字段：

1. `paperMode === 'passage_pick'` 或首题 `taskType` 属 IELTS 家族 → IELTS 壳
2. 首题 `snapshotContent.uiKind` 为 `cloze` / `vocab` / `transformation` → O-Level 壳
3. 有 passage 无 IELTS taskType → Comprehension
4. 兜底 → McqList

**加新题型 = 这里加一个 case + 一个组件文件。**

---

## 8. 设计约束与由来

**本节回答"这个东西看起来很怪，能不能改"。改之前请先读对应条目。**

### 8.1 贴墙码可被拍照 —— 已知弱点，缓解而非根治

静态码固定不变，可被拍照带回家扫，服务端无法分辨。这个问题**没有正面解法**：
码必须固定（否则要每天架投影仪），固定就必然可复制。

**缓解措施**：同一班同时签发多张都能用的码，各带标签；换墙上那张时不通知学生。
当天扫到旧标签的必然用的是照片。

```
v2.<classId>.<hmac16>        → qrVariant = 'original'
v2.<classId>.w35.<hmac16>    → qrVariant = 'w35'
```

**维护要求**：这是一次性证据，**需要定期更换标签**，否则新码同样会被拍照传播，
机制退化为零。当前墙上是 `w35`。轮换周期未固化，见 §10.3。

### 8.2 cron 预激活是 5 分钟，不是 30 秒

cron 只在整分钟触发。30s 缓冲在 08:29:00 那一跳不生效
（`upper = 08:29:30 < attendanceStart = 08:30:00`），实际要等 08:30:00 整才激活。
08:29:5x 扫码的学生会看到"考勤窗口尚未开启"。

**不要把这个值改小。** Gate 5 仍然阻止提前提交，提前激活只影响名单查询可用性。

### 8.3 FSRS 的 `learning_steps` 必须保持为 `[]`

FSRS 默认 `['1m','10m']`，卡片需连续答对两次才毕业到 Review 态，
而"当前处于第几步"记在 `Card.learning_steps` 上。

本系统把调度状态**按列拆存**在 `StudentWord`（stability / difficulty / reps /
lapses / elapsedDays / scheduledDays），**没有这一列**，还原 Card 时只能填 0。
结果是每次复习都把卡片重置回第一步，永远毕业不了，间隔恒为 0 天。
实测连续答对 6 次仍是 0 天。

**要恢复日内步进，必须先加这一列。** 否则间隔重复功能会静默失效。

### 8.4 `StudentSubmission` 的唯一约束被移除

原有 `@@unique([assignmentId, studentId])` 阻止了同一学生同时拥有正式提交和
练习提交。Postgres 支持部分唯一索引，但 Prisma schema 表达不了。

现状：约束移除，非练习提交的唯一性下沉到 service 层（`finalSubmit` 和发卷
流程各自 `findFirst`）。

**代价**：每处统计都要记得排除 `practice`。见 §6.2 ④。
**正解**：写 raw migration 加部分唯一索引。见 §10.2。

### 8.5 空白率是一级指标，与得分率并列

2026-08-11 对全历史作答按题型聚合：

| 题型族 | 得分率 | 空白率 |
|---|---:|---:|
| 选择型（TFNG / 段落匹配 / 多选） | 58–67% | 6–12% |
| 打字型（句子填空 / 流程图 / 图表） | 28–53% | 36–51% |
| O-Level 短答（全卷打字） | 19% | 64% |

同一批学生、同一份卷子、同一篇文章，差别只在作答方式。

**结论**：只看得分率会把"不会做"和"懒得打字"混为一谈，两者的教学干预完全不同。
`skill-profile.service.ts` 因此维护 `TYPED` 集合标记需打字的题型。

同一依据也决定了错题本"空白不收"—— 空白是行为问题，不是知识问题。

**相关设计：超时收卷后的补做入口**（`TimeUpMakeup.tsx`）。到场时间与放弃度
高度相关（21 分钟后到场者空白率 95.6%），是动机问题不是能力问题。方案是保留
9:00 硬性收卷（正式成绩定格），但提供不计分的补做入口。

**不要改成"时间到了允许继续答"**：限时阅读是雅思班要练的能力；9:00 后是正课；
统一作答窗口是成绩可比的前提。

### 8.6 `grade:` 提交前缀是审计机制

每日人工判分后，判分脚本与结果一起提交。作用：

1. **可追溯** —— 学生事后质疑给分，能翻出当时依据
2. **可重放** —— 判分脚本幂等，数据可重建
3. **可核对** —— 08-13 的 43 条判分恢复即依赖此

**不要为了让提交历史"好看"而省略这类提交。**

### 8.7 其他不宜改动的点

| 设计 | 原因 |
|---|---|
| 水印 token 用 Crockford base32（去 I/L/O/U） | 泄露件可能是扫描件，追查靠人肉抄写，字形歧义会毁掉线索 |
| 干扰项用 bigram 判近义（共享两个连续汉字即弃用） | 零依赖零延迟，误杀无所谓（候选池够大）；换成模型会违反零 API 铁律 |
| `storyKey` 剥离 `_vN` 后缀 | 内容治理会把 fixture 从 `_v1` 升到 `_v2`，不剥离则同一篇文章重新可抽（曾致某班第二周 5/12 重复） |
| cancelled 场次释放 `paperKey` 回池 | 否则停考占用的文章永久退出候选池，学生从未见过却再也抽不到 |
| 埋点只记「谁 / 哪类页 / 哪天」 | 学生是未成年人，数据最小化；且刻意区分"打开成绩页"（交卷后自动跳转）与"点进详情"（主动复盘） |
| handoff token 的 `scope` + `mqs` 双重校验 | 泄露的换设备链接只能触及那一场考试 |

---

## 9. 环境与部署

### 9.1 环境变量

| 变量 | 作用 | 注意 |
|---|---|---|
| `DATABASE_URL` | Postgres 连接 | 生产走 Railway 内网 URL |
| `JWT_SECRET` | JWT 签名**及 v2 静态 QR 签名** | **轮换会让所有印刷墙贴失效** |
| `MORNING_QUIZ_AI_GRADING` | `on` 才启用 AI 判分 | **保持默认关闭** |
| `MORNING_QUIZ_AUTO_GENERATE` | `true` 才启用周日自动出卷 | 当前手动，未开 |
| `MORNING_QUIZ_TZ_OFFSET_MIN` | 时区偏移，默认 480（UTC+8） | 学校搬迁才需改 |
| `INTERNAL_API_TOKEN` | API ↔ pdf-worker 共享令牌 | 两边必须一致 |
| `PDF_WORKER_URL` | pdf-worker 地址 | |
| `BOOTSTRAP_CONTENT_DISABLED` | 关掉启动时的题库幂等 seed | |
| `MOCK_AUTH` | 开发用，跳过 JWT | **绝不可在生产开启** |
| `RAW_STORAGE_PATH` / `RENDER_STORAGE_PATH` | PDF 原件与渲染件路径 | |

### 9.2 部署与回滚

**部署**：push 到 `main` → Railway 自动构建 API 与 Web。
入口在根 `railway.json`：

```json
"startCommand": "sh -c 'npx prisma migrate deploy && node dist/main.js'",
"healthcheckPath": "/api/health",
"restartPolicyType": "ON_FAILURE",
"restartPolicyMaxRetries": 5
```

**注意**：启动时自动执行 `prisma migrate deploy`。**migration 一旦推上去就会跑**，
写 migration 时要确认可回滚。

**回滚**：Railway 控制台可回滚到上一个 deployment。但**数据库 migration 不会
自动回滚** —— 如果这次部署带了破坏性 migration，需要手写反向 migration。

**ops-dashboard 不在自动链路里**，改了要手动 `railway up`。

### 9.3 本地起服务

```bash
docker compose up -d              # Postgres
npm run db:migrate && npm run db:seed
npm run dev                       # API :4000  Web :5173
```

demo 账户 `teacher@school.local` / `teacher123`。

测试：

```bash
npm run test        # 后端 31 文件 348 断言
npm run test:web    # 前端 18 文件 112 断言
npm run typecheck   # 前后端全量
```

### 9.4 连接生产库

```bash
# 用 Railway CLI 代理（推荐，不落盘凭证）
railway run -- npx ts-node apps/api/scripts/<script>.ts
```

如需直连，用 `DATABASE_PUBLIC_URL`，**Prisma 必须加 `?sslmode=require`**。
临时凭证文件用完立刻删除。

### 9.5 备份与灾难恢复

见 `docs/disaster-recovery.md`（独立 runbook，含 RTO/RPO、备份脚本、
恢复步骤、演练计划）。策略为 14 天滚动 + 12 个月长期归档 + 异地副本。

---

## 10. 待办与技术债

### 10.1 未决事项

| 事项 | 状态 | 说明 |
|---|---|---|
| git 历史含版权原文 | **未处理** | 工作区已清理，历史未清。彻底清除需 `filter-repo` + 强推，会重写全部提交哈希 |
| 补考演示场次残留 | 待确认 | 测试班里的 demo session，`setup-makeup-demo.ts --drop` 可清 |
| 贴墙码标签轮换 | **需建立周期** | 当前 `w35`，无固定轮换机制，见 §8.1 |
| 判分回归检查 | 未实施 | 曾提议每晚检查是否有已判分数变回未判，未落地 |

### 10.2 技术债

| 债务 | 影响 | 建议处理 |
|---|---|---|
| `morning-quiz.service.ts` 4166 行 | 全项目最大文件，排课/生成/判分/导出/画像混在一起 | 该拆，但它也是改动最频繁的文件，拆分冲突成本高于当前收益 |
| 练习提交唯一性仅应用层保证 | 每处统计需手动排除 `practice`，已漏过一次 | 写 raw migration 加 Postgres 部分唯一索引 |
| 单副本假设 | 进程内限流、Puppeteer 常驻实例、cron 无分布式锁 | 上多副本时三处会同时失效。限流器装饰器签名已对齐 throttler，替换是机械工作 |
| pdf-worker base64 传图 | 单页几 MB | Railway 无共享 volume，长期应走对象存储 |
| `mass_absence` 的 `claimedCount` 为近似值 | 可能轻微误判 | Prisma `count()` 不支持 distinct，需改 raw SQL |

### 10.3 容易遗忘的定期动作

| 频次 | 动作 | 漏掉的后果 |
|---|---|---|
| 每日 | 人工判分 + Seiue 出勤同步 | 学生看不到成绩；出勤记录缺失 |
| 每周出卷后 | **全历史重复检查** | 学生做到重复文章（曾发生 5/12 重复） |
| 每周出卷后 | 逐篇核对内容质量（读文章+题干+答案键） | 出现无法作答或答案键错误的题 |
| 不定期 | 更换贴墙码标签 | 分身码机制失效 |
| 季度 | 灾难恢复演练 | 见 `docs/disaster-recovery.md` |

---

## 附录 A：项目背景数据

| 项 | 值 |
|---|---|
| 立项 | 2026-04-27 |
| 提交总数 | 475（截至 2026-08-14） |
| 提交类型分布 | `fix` 197 · `feat` 192 · `docs` 27 · `chore` 14 · `grade` 10 · 其他 35 |
| 开发阶段 | P1 试卷生成（04-27~05-06，83 次）· P2 早测（05-07~06-04，268 次）· P3 作业系统（07-13~08-02，59 次）· P4 学生自助（08-10~08-14，60 次） |
| 测试 | 49 文件 460 断言（后端 348 / 前端 112） |

测试集中在纯函数与边界判定（`shouldCollect`、`nextPracticeState`、
`gradeMcq`、`hasWrittenAnswer`、`normaliseVariant`、限流窗口、handoff 约束、
试卷结构校验、补考窗口判定），而非端到端。因为本系统最易出错、后果最重的
是判定逻辑而非 HTTP 管道。

统计复现命令：

```bash
git log --oneline | wc -l
find apps/api/src -name "*.ts" ! -name "*.spec.ts" | xargs cat | wc -l
grep -c "^model " apps/api/prisma/schema.prisma
cd apps/api && npx vitest run
```

## 附录 B：相关文档

| 文档 | 内容 |
|---|---|
| `CLAUDE.md` | 项目铁律与快速上手 |
| `docs/disaster-recovery.md` | 数据库灾难恢复 runbook |
| `docs/morning-quiz-authoring-and-grading.md` | 出卷与判分的接口约定 |
| `docs/ielts-ingest-workflow.md` | 雅思素材入库流程 |
| `docs/UI-QUESTION-TYPES.md` | 题型 UI 规范 |
| `docs/AI-QA-REVIEW.md` | 内容质量审核清单 |
| `docs/PRD/` | 各功能的产品需求文档 |
| `apps/api/scripts/README.md` | 运维脚本说明 |

## 附录 C：本文档的维护

交接文档会过期，过期的交接文档比没有更危险。维护规则：

1. **改了 SOP 就改 §3**，改了红线就改 §2 —— 与代码同一个 PR 提交
2. 新增"看起来很怪但不能改"的设计，写进 §8，必须说明**为什么**和**改动前提**
3. 生产事故进 §4.3 索引，处置方法进 §4.1 对照表
4. 技术债还清后从 §10.2 删除，并在提交信息里说明
5. 每学期开始时通读一遍，核对 §3 的时间线与 §9.1 的环境变量是否仍然准确
