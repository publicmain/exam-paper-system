# 重构审计（只读）—— 新学生全链路追踪与七项重点检查

> 2026-08-26 v2。只读审计，未修改任何代码。所有结论均来自实际代码
> 阅读，证据格式：`文件路径`（函数/标识符/行号）。
> 目标流程：注册/登录 → 确定难度 → 阅读测试 → 提交并查看阅读结果 →
> 学习本次单词 → 单词测试 → 查看任务总结。

## 一、新学生的真实代码链路（现状）

一个新学生今天实际会经历的顺序（与目标流程**顺序不同**）：

```
教师建档          Classes 页 → POST /classes/:id/roster
  ↓
① 教室扫码        /scan/v2.<classId>.<hmac>（贴墙码）
    页面   apps/web/src/pages/MorningQuizScan.tsx
    路由   App.tsx 三处重复注册 /scan/:token（见 §六）
    API    GET qr 校验 → POST /api/attendance/scan
    服务   attendance.service.scanQr()：Gate1 姓名对花名册 →
           Gate3 场次 active → 写 Attendance → findFirst+create
           StudentSubmission → 推词表(levelPushesWordlist) →
           签发当天 scanToken(至 23:59) + handoff token
    库     Attendance / StudentSubmission / StudentWord
  ↓
② 选难度          同一页：meta.siblingSessions 五场现选
    （MorningQuizScan.tsx:193-206 chosenSessionId=useState，不持久化）
  ↓
③ 答题→交卷      MorningQuizTake.tsx → student.service.finalSubmit()
    恢复   600ms 自动保存 + existingAnswers 回填（唯一达标的恢复）
  ↓
④ 看结果          结果页（分数门=status；答案门=finalSubmittedAt）
  ↓
⑤ 翻卡学词        MyHistoryDetail.tsx:261 → /my-vocab/review?after=submit
    （MyVocabReview.tsx:91 afterSubmit 分支：新词优先、≥4 张给自测入口）
  ↓
⑥ (自愿)自测      MyVocabQuiz.tsx → 结果只写 POST /vocab/review(FSRS)
  ↓
⑦ 回家打开 App    此时才弹注册卡（lib/registration.ts checkRegistration:
                  需 localStorage 已有姓名）→ RegistrationSheet
  ↓
（无总结页；/my-lesson 是进行中状态，非总结）
```

**结论**：注册发生在第 ⑦ 步而非第 ① 步；难度是第 ② 步的**当日临时
选择**；单词测试自愿且无成绩；总结缺失。

## 二、七项重点检查

### 1. 重复身份和注册逻辑

**同一个学生此刻可以同时持有 7 种身份形态**：

| 形态 | 签发处 | 有效期 | 证据 |
|---|---|---|---|
| 匿名姓名直读 | 无凭证 | 永久 | `vocab.controller.ts` 各 @Public GET；`morning-quiz.controller.ts` history-by-name |
| localStorage 伪身份 | 扫码/查询时写 | 永久 | `MorningQuizScan.tsx:236` 写 `mq:history:name`（测试班除外） |
| deviceUuid | 前端生成 | 永久 | `MorningQuizScan.tsx:121-127`；考勤去重用 |
| 扫码日令牌 | scanQr | 当天 23:59 | `attendance.service.ts:608-616`，**无 av 不查撤销** |
| handoff 令牌 | scanQr | 短 | `attendance.service.ts:630-638` scope:mq_handoff |
| 30 天登录令牌 | register/login | 30 天 | `student-auth.service.ts` register()/login()，带 av 可撤销 |
| teacher_view | 教师签发 | 15 分钟 | `student-auth.service.ts` issueTeacherViewToken() |

**重复的注册/设密码逻辑三套并存**：
- `register()`（现行，2026-08-26）
- `setPin()`（v1 遗留，**闸已移除、端点仍活**，`student-auth.controller.ts:139`）
- claim-window 四个端点（v2 遗留，**UI 已撤、API 仍活**，
  `student-auth.controller.ts:189-230` + `Class.pinClaimOpenUntil` /
  `User.pinClaimOpenUntil` 两个已无用途的列）

**收敛缺失**：注册后匿名读路径原样全开（`STUDENT_READ_REQUIRES_AUTH`
从未实现）；`api.ts token()` 里 teacher_view 优先于学生自己的 token
（`apps/web/src/lib/api.ts:16-23`）——非核心功能织进了核心取token路径。

### 2. 难度的事实来源 —— 没有单一事实来源

难度信息散落四处，**无一挂在学生身上**：

| 位置 | 语义 | 证据 |
|---|---|---|
| `ClassEnglishLevel` | 班级今天开哪几层 | schema.prisma（注释明言 single source of truth **for class**） |
| `MorningQuizSession.level` | 某场次是哪层 | schema.prisma:1549 附近 |
| 扫码现选 | 学生今天进哪层 | `MorningQuizScan.tsx:193-206` siblingSessions → chosenSessionId（useState，**不写任何存储**） |
| `Paper.config` / weekly-track | 该层词表 | `weekly-track.ts` resolveWeeklyTrack；`levelPushesWordlist` |

**后果**：学生可每日跳层；词表跟当日选择走 → 跳层=词表混层；
`User` 无 level 字段（已 grep 确认 `studentLevel/preferredLevel/lastLevel`
零命中）。目标流程的「确定难度」阶段在数据模型上不存在。

### 3. 阅读提交与重复记录

**唯一约束已被移除**：`schema.prisma` StudentSubmission 注释（R14
Feature 16）——为练习模式共存，`@@unique([assignmentId, studentId])`
被撤，只剩普通索引（:63-72）。唯一性靠「service 约定」维持。

**findFirst+create 竞态点两处**：
- `attendance.service.ts:501`（scanQr 主路径）
- `attendance.service.ts:803`（教师手工补登路径）

两设备同时扫码（手机+平板 handoff 场景真实存在）可各自 findFirst 落空
→ 双 create → **同一学生同一卷两条非 practice 答卷**。下游
`lesson.service.readState`（已按 finalSubmittedAt desc 排序取一条）、
判分队列、history-by-name 均假定单条。未发现生产已发生的证据，
但无防线。

**另**：测试班旋转门会 delete 已交答卷（`attendance.service.ts` 【测试】
分支）——仅限班名前缀，已有单测钉死真实班不走。

### 4. 单词首次学习和测试是否混在一起

**三处「测」，边界不一致**：

| 环节 | 新词(reps=0)处理 | 证据 |
|---|---|---|
| 翻卡（学） | ⚠️ **学的形态是考**：新词与复习词共用回想式挖空卡，正面是从未读过文章的挖空，不可回答；仅加「新词」徽标 | `MyVocabReview.tsx:389` clozeSentence 对所有卡同一处理；:399-403 徽标 |
| 自测（测） | ✅ 已隔离：出题优先 reps>0；**但兜底会捞 reps=0**（due 不够 limit 时） | `vocab-quiz.service.ts:189`（reps>0）与 **:196（reps:0 兜底）** |
| 卷内词汇题（考） | ❌ 不看学习状态：本周主线词按天轮转直接进卷，学没学过都考 | `vocab-attach.service.ts` pickWordsForDay，无 reps 过滤 |

即：**「先学后测」只在自测主路径成立**；翻卡的"学"本身长着"测"的脸
（违反产品规则 1）；自测兜底与卷内题都会考未学的词。原始 PRD
（vocabulary-notebook.md:161）规定卡片=「挖空+**中文提示**」，实现
丢了中文提示（正面无任何提示，`MyVocabReview.tsx:448-449`）。

### 5. 任务状态及退出恢复

**无任务阶段实体**。隐式流程由以下状态拼出（实录）：

- 前端瞬时：`gate('whatsnew'|'install')`、`pendingQuizUrl`、`chosenSessionId`、
  `revealed`、`idx`、`manualEntry`（均 useState，刷新即失）
- localStorage：`mq:history:name`、`mq:history:studentId`、`auth_token`、
  `reg:done`、`lesson:launch-redirected`(sessionStorage)、`reviewQueue`、
  deviceUuid、hasSeenWhatsNew/InstallGuide
- 服务端：`StudentSubmission.status`（5 值字符串）+ `submittedAt` +
  `finalSubmittedAt` + `submitSource`（三列组合出 6+ 隐式状态）；
  `DailyLessonCompletion`（最接近阶段实体：三段 target/progress/doneAt，
  但**无 stage 字段**，也不含单词测试与总结阶段）

**各阶段刷新恢复实测口径**：

| 阶段 | 刷新后 | 证据 |
|---|---|---|
| 阅读答题 | ✅ 无损 | `MorningQuizTake.tsx` existingAnswers + 600ms 自动保存 |
| 翻卡 | ⚠️ 回第 1 张（已评的因 FSRS 不再到期，半自愈） | `MyVocabReview.tsx:96` idx=useState(0) |
| 自测 | ❌ 全丢重新出题 | `MyVocabQuiz.tsx` 无持久化 |
| 扫码三道门 | ⚠️ 引导门重来（whatsnew/install 有已读标记，setpin 门已删） | `MorningQuizScan.tsx` |
| 整体位置 | ❌ 无「走到第几步」 | 无实体 |

### 6. 重复页面、路由、API 和入口

- **路由重复**：`/scan/:token` 在 App.tsx 注册 **3 次**（:216 公开分支、
  :241 未登录分支、:294 学生登录分支）——同组件，纯粹为绕过三层路由
  守卫的复制。
- **页面级重复实现**：`/me` 的「今天的课」三段是**前端手拼**
  （`Me.tsx:16-17` 自述"复用既有接口，不新建 lesson API"，:142/175/191
  三个裸 fetch），与 `lesson.service.today()`（服务端权威口径：目标
  冻结、submitSource 语义）**并存且口径不同**——/me 不知道 auto_closed、
  不知道目标冻结。
- **词汇入口 6 个**：交卷后 after=submit、/my-vocab、/my-vocab/review、
  /my-vocab/quiz、/my-lesson 背段、/me 背段（已 grep：6 文件引用
  my-vocab/review）。
- **"单词测试"两套互不相通**：自测（无成绩实体）与卷内词汇题（分数
  混入阅读 totalScore，vocabTrack 标记可拆，实测卷面 6→8 分）。
- **死 API 活着**：set-pin、claim-window×4（见 §1）；死列：
  `Class.pinClaimOpenUntil/pinClaimOpenedBy`、`User.pinClaimOpenUntil`。
- **成绩查看入口 4 个**：/my-history、/me 读段、/my-lesson 读段、
  扫码门厅（AfterQuizPortal）。

### 7. 非核心功能造成的依赖（织进核心路径的）

| 非核心物 | 织进了哪 | 证据 |
|---|---|---|
| teacher_view 令牌 | 学生端**所有**请求的 token() 取值首位 | `api.ts:16-23`、`api-student.ts:23`、`Me.tsx tokenStudent()` |
| 测试班特例 | 生产扫码解析与交卷路径各一处分支 | `qr.service.resolveTodaySession` 回退；`attendance.service` 旋转门 |
| PWA 迁移跳转 | /my-history 挂载最早处 | `MyHistory.tsx` lessonLaunchRedirect |
| whatsnew/install 引导门 | 扫码→答题必经序列 | `MorningQuizScan.tsx` gate 链 |
| 第二作答窗 | 交卷语义一分为二（暂存/最终），答案门由此而生 | `morning-quiz.service.ts` answersReleased |
| 连胜/冻结 | 翻卡评分路径内 | `vocab-review.service` streakFromDays |
| 考勤行（已停用的功能） | scanQr 仍写 Attendance，缺勤提醒 cron 仍读 | `attendance.service.ts:446`；absence-alert.cron |
| 申诉/练习模式 | 挂在 StudentSubmission 上，是 @@unique 被拆的直接原因 | schema R14 注释 |

## 三、风险与建议切片（沿用 v1，据本轮证据修订）

风险排序不变：身份收敛最后（匿名读在用）→ 难度属性不动排课 →
成绩分离先做展示层（vocabTrack 可拆、零迁移）。

| # | 切片 | 本轮新增依据 |
|---|---|---|
| S1 | 新词教学卡 + 复习卡中文提示 + 来源名人话化 | §二.4 |
| S2 | VocabQuizAttempt 成绩实体 + 展示；**顺手堵自测 reps=0 兜底** | §二.4 |
| S3 | 阅读结果页按 vocabTrack 拆示 | §二.4 |
| S4 | 学→测串联（after=submit 翻完 ≥4 张已有入口，改为默认续接） | §一.⑤⑥ |
| S5 | 任务总结页（DailyLessonCompletion + S2） | §二.5 |
| S6 | 任务阶段字段 + 各页恢复 | §二.5 |
| S7 | User.englishLevel 偏好（扫码预选，不动排课）；**顺手给 StudentSubmission 加部分唯一索引堵竞态**（`WHERE status <> 'practice'` 的 partial unique，需迁移+回滚说明） | §二.2/3 |
| S8 | 身份收敛（双模式灰度）+ 清死 API/死列 | §二.1/6 |

**未验证项**（本审计只读，未运行）：双答卷竞态未在生产复现，仅静态
推理；/me 与 lesson 口径差异未逐字段比对；死 API 无调用方是按前端
grep 零引用推断，未查外部脚本。
