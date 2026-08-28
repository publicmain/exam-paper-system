# 阅读页迁移设计 —— `/lesson/reading`

> `task_id: S7A-READING-MIGRATION-DESIGN` · `contract_version: 1.0` ·
> `base_commit: e1ab4dc`
>
> **本文件是设计，不是实现。** 证据层级 = **源码 + 既有自动化测试**。
> 全文**没有任何** staging、真机或真实数据库的验证声明 —— 凡是只由源码
> 或测试支撑的结论，都按「源码可证 / 测试可证」标注；未解决的写「未决」。

---

## 0. 一句话结论

`apps/web/src/components/exam/` 这棵子树**几乎是纯的** —— 18 个文件里
只有 `ExamContext.tsx` 一行 `import { BASE } from '../../lib/api'` 与旧端
耦合。但学生端的 Docker 构建上下文**只有 `apps/student-web` 一个目录**，
跨应用直接 import **在部署层面不可能成立**。因此选 **方案 C：把纯能力
按文件重建进 student-web**，并把 `ExamContext` 的网络耦合改成注入。

---

## 1. AC-02 —— 行为清单

`apps/web/src/pages/MorningQuizTake.tsx` 1029 行 + `components/exam/` 子树
18 个文件 4039 行。逐项分类如下。

### 1.1 依赖图（源码可证）

`MorningQuizTake.tsx` 的 import（第 1–12 行）：

```
react, react-router-dom
../lib/api                    ← 旧端 API 客户端
../lib/auth                   ← 旧端 useAuth
../components/exam/TimeUpMakeup
../components/exam/ExamContext        { ExamProvider, useExam }
../components/exam/QuestionTypeRegistry { ExamRenderer }
../components/exam/shared/{Timer,FontSizeAdjuster,QuestionNavBar,OfflineBadge}
../components/exam/types              { ExamPaper, EnglishLevel }
```

`components/exam/` 子树的**对外**依赖（逐文件扫描，源码可证）：

| 文件 | 外部依赖 |
|---|---|
| `ExamContext.tsx` | **`../../lib/api` 的 `BASE`**（唯一的旧端耦合） |
| `draftMerge.ts` `types.ts` `shared/textUtils.ts` | 无 |
| `shared/{DraggableSplit,Highlighter,InlineGapInput,StickyNote,Timer}.tsx` | 无（纯 react） |
| `shared/{FontSizeAdjuster,OfflineBadge,QuestionFlag,QuestionNavBar}.tsx` | 仅 `../ExamContext` |
| `questions/*.tsx`（6 个） | 仅 `../types` `../ExamContext` `../shared/*` `../ExamWordSheet` |
| `QuestionTypeRegistry.tsx` | 仅 `./types` `./questions/*` |

**结论**：整棵子树对旧端的耦合面 = **1 个符号**（`BASE`），用于
`ExamContext` 内部的 `fetch(\`${BASE}/api/health\`)` 连通性探测
（第 411 行）。

### 1.2 行为分类

| # | 行为 | 位置 | 分类 |
|---|---|---|---|
| 1 | 六个题型渲染器（IELTS 阅读 / O-Level 理解 / 完形 / 词汇 / 句子转换 / MCQ 列表） | `questions/*.tsx`、`QuestionTypeRegistry.tsx` | **REUSE_PURE_LOGIC** |
| 2 | 渲染器选择（显式 `rendererKey` 优先，多段落回退，backref 伪段落过滤，启发式兜底） | `QuestionTypeRegistry.tsx:69-170` | **REUSE_PURE_LOGIC** |
| 3 | 草稿合并（按 `clientSeq` 判新旧、算出 `resend` 列表） | `draftMerge.ts` 全文 49 行 | **REUSE_PURE_LOGIC** |
| 4 | 逐题防抖自动保存（600 ms） | `ExamContext.tsx:507-518` | **REBUILD_IN_STUDENT_WEB** |
| 5 | `clientSeq` 分配与单调规则 | `ExamContext.tsx:491-499` | **REQUIRED_CANONICAL** |
| 6 | 重试沿用同一 `seq`（`pendingSeqRef`） | `ExamContext.tsx:452-454` | **REQUIRED_CANONICAL** |
| 7 | 离线检测（`navigator.onLine` + `/api/health` 主动探测，防 captive portal） | `ExamContext.tsx:391-444` | **REBUILD_IN_STUDENT_WEB**（探测地址要换成学生端自己的 API base） |
| 8 | 断线重连后补传（`resend` 队列） | `ExamContext.tsx:545+` | **REQUIRED_CANONICAL** |
| 9 | 多标签所有权（tab UUID + 心跳 + 10 秒过期 + 显式接管） | `ExamContext.tsx:239-340` | **REBUILD_IN_STUDENT_WEB** |
| 10 | `flushPendingSaves()`（交卷前强制落盘） | `ExamContext.tsx:524-542` | **REQUIRED_CANONICAL** |
| 11 | `saveError` / `hasPendingSaves` 可见化 | `ExamContext.tsx:45-53` | **REQUIRED_CANONICAL** |
| 12 | 本地缓存（答案 / 序号 / 旗标 / 字号） | `ExamContext.tsx:110-133` | **REBUILD_IN_STUDENT_WEB**（键名换 `sw:*`） |
| 13 | 旧键清理（`mq:answers:*` / `mq:flags:*` 前缀扫除） | `ExamContext.tsx:155-165` | **LEGACY_DROP**（新端从不写这些键） |
| 14 | 倒计时 Timer（用 `quizEnd`，不是 `regularQuizEnd`） | `shared/Timer.tsx`、`MorningQuizTake` | **REBUILD_IN_STUDENT_WEB** |
| 15 | 字号调节 A- / A+ | `shared/FontSizeAdjuster.tsx` | **REUSE_PURE_LOGIC** |
| 16 | 题目导航条 + 旗标 | `shared/QuestionNavBar.tsx`、`shared/QuestionFlag.tsx` | **REUSE_PURE_LOGIC** |
| 17 | 高亮 / 便签 / 可拖分栏（IELTS 外壳） | `shared/{Highlighter,StickyNote,DraggableSplit}.tsx` | **REUSE_PURE_LOGIC** |
| 18 | 生词表 `ExamWordSheet` | `ExamWordSheet.tsx` 243 行 | **STAGE8_OR_LATER**（属词汇线，不属阅读页最小可用） |
| 19 | `WhatsNewSheet`（版本更新提示） | `WhatsNewSheet.tsx` 315 行 | **LEGACY_DROP** |
| 20 | `TimeUpMakeup`（超时补考弹窗） | `TimeUpMakeup.tsx` 120 行 | **UNKNOWN** —— 语义绑第二作答窗，见 §7 未决 U-3 |
| 21 | 交卷后跳 `/my-history?name=…` | `MorningQuizTake.tsx:205-214, 292, 462-463` | **LEGACY_DROP** |
| 22 | `mq:history:name` 读写 | `MorningQuizTake.tsx:212` 注释所述的门户联动 | **LEGACY_DROP** |
| 23 | 扫码回退栈处理（`/scan/:token` 在 back stack 里） | `MorningQuizTake.tsx:124-125` | **LEGACY_DROP** |
| 24 | `?mode=practice` URL 参数 | `MorningQuizTake.tsx:87` | **STAGE8_OR_LATER**（练习模式不在阶段 7） |
| 25 | 考勤相关错误码分支（`attendance_window_closed`） | `MorningQuizTake.tsx:379-383` | **LEGACY_DROP** |
| 26 | 已交卷时 3 秒后跳门户 | `MorningQuizTake.tsx:680-683` | **REBUILD_IN_STUDENT_WEB**（改为走路由契约） |
| 27 | `useAuth`（旧端登录态） | `MorningQuizTake.tsx:5` | **REBUILD_IN_STUDENT_WEB**（换成 `auth-store` + `sw:token`） |

> **没有任何一项仅因为「有个同名组件」就被判为可复用。** 上表的
> REUSE_PURE_LOGIC 全部有 §1.1 的零外部依赖扫描支撑。

---

## 2. AC-03 —— 复用边界决策

### 2.1 三个方案

| | A. 跨应用直接 import | B. 抽共享包 | C. 选择性重建进 student-web |
|---|---|---|---|
| 依赖影响 | student-web 需要 `apps/web` 的整棵依赖树 | 新增一个 workspace 包 + 两个应用都改依赖 | 仅 react（现有依赖不变） |
| 遗留耦合 | 直接继承 `lib/api` / `lib/auth` | 需先把 `BASE` 耦合拆出来才能抽 | 拆耦合是重建的一部分 |
| 构建影响 | **不可行** —— 见 §2.2 | 需改两处 Dockerfile + 两份 lockfile | 零构建改动 |
| 物理边界影响 | **摧毁**「物理隔离的 `apps/student-web`」这一目标 | 引入第三方共享物，边界从两方变三方 | 边界保持两方，新端自包含 |

### 2.2 方案 A 被否决的硬证据（源码可证）

`apps/student-web/Dockerfile`：

```
19: COPY package.json package-lock.json ./
20: RUN npm ci --include=dev
22: COPY . ./
31: RUN npm run build
```

配合部署命令 `railway up apps/student-web --path-as-root`（阶段 4B1 / 6B
均如此），**构建上下文就是 `apps/student-web` 这一个目录**，
`apps/web` 的源码根本不在上下文里。

`apps/student-web/tsconfig.json` 只有 `"include": ["src", "vite.config.ts"]`
—— 无 `paths`、无 project references。
`apps/student-web/package.json` 的 dependencies 只有
`react` / `react-dom` / `react-router-dom`。

**结论**：跨应用 import 不是「不优雅」，是**构建会直接失败**。
按合同「需要明确的架构安全性证明，否则否决」——**否决**。

### 2.3 方案 B 被否决的理由

抽共享包要先解掉 `ExamContext → lib/api.BASE` 这一处耦合（否则包会把
旧端 API 客户端拖进来），也就是说**方案 C 的拆解工作是方案 B 的前置**。
在只有一个消费者（新端）且旧端即将退役（阶段 16）的前提下，先付一个
共享包的构建 / 版本 / 双 lockfile 成本，收益是负的。**否决**，
但**保留为阶段 16 的可选重构**（届时旧端退役，包也就不必存在）。

### 2.4 选定：方案 C —— 选择性重建

**按文件迁移，逐个说明处理方式**，不是「整目录复制」：

| 来源 | 去向 | 处理 |
|---|---|---|
| `draftMerge.ts` | `student-web/src/lesson/draftMerge.ts` | **逐字搬**（纯函数，零依赖） |
| `types.ts` | `student-web/src/lesson/examTypes.ts` | 搬；删掉阶段 7 用不到的字段 |
| `shared/textUtils.ts` | `student-web/src/lesson/shared/textUtils.ts` | 逐字搬 |
| `shared/{DraggableSplit,Highlighter,InlineGapInput,StickyNote,Timer}.tsx` | 同名 | 逐字搬（零外部依赖） |
| `shared/{FontSizeAdjuster,OfflineBadge,QuestionFlag,QuestionNavBar}.tsx` | 同名 | 搬；`useExam` 改指向新 Context |
| `questions/*.tsx`（6 个） | 同名 | 搬；import 路径改写；`ExamWordSheet` 的挂点在阶段 7 留空 |
| `QuestionTypeRegistry.tsx` | `student-web/src/lesson/QuestionTypeRegistry.tsx` | 逐字搬（选择逻辑是纯函数，`registry.test.ts` 已覆盖） |
| `ExamContext.tsx` | `student-web/src/lesson/ExamContext.tsx` | **重建**：`BASE` 改为 **props 注入的 `healthProbe` 回调**；存储键换 `sw:*`；删旧键清理 |
| `MorningQuizTake.tsx` | `student-web/src/pages/Reading.tsx` | **重建**，只取 §1.2 里 REQUIRED_CANONICAL / REBUILD 的部分 |
| `ExamWordSheet` `WhatsNewSheet` `TimeUpMakeup` | —— | 阶段 7 **不搬** |

> **迁移不等于复制**：`ExamContext` 与页面壳是重建，其余是搬运 + 改
> import 路径。搬运项在阶段 7 结束时必须连同其既有测试一起进新端
> （`registry.test.ts` / `draft-merge.test.ts` / `textUtils.test.ts` /
> `OLevelMcqList.test.ts` / `OLevelSentenceTransformation.test.ts` /
> `QuestionNavBar.test.ts`），否则搬过来的代码在新端是无测试状态。

---

## 3. AC-04 —— 路由与身份契约（冻结）

| 项 | 冻结值 |
|---|---|
| 路由 | **`/lesson/reading`**，无 `/app` 前缀（已在 `routes.contract.ts` 注册，阶段 6A） |
| 会话资源来源 | **`GET /lesson/today` 的 `segments[key==='read']`**，取 `sessionId` 与 `submissionId`；**不从 URL 参数取** |
| 身份 | **只有 Bearer 令牌**（`sw:token`）。URL 与请求体**零** `name` / `studentName` / `studentId` |
| 禁止 | `mq:history:*` 读写；`/scan`；考勤跳转；`then=`；`after=submit`；`#h=`；handoff 令牌 |
| 资源缺失 / 非法 | `segments.read.sessionId == null` → **不进阅读页**，`/today` 上按 `nextAction` 的停留态呈现；直接访问 `/lesson/reading` 而无会话 → 回 `/today`（不报错页） |
| 导航来源 | **只从 `routes.contract.ts` + `NextActionKind`**；后端 `nextAction.href` **永不参与** |

依据：`docs/reconstruction/product-contract.md` §2.3（身份只来自令牌、
canonical URL 不带姓名）、`student-web-architecture.md` §4.3（忽略 href）、
阶段 6A 已落地的 `routes.contract.ts`。

---

## 4. AC-05 —— API 契约（逐条源码可证）

### 4.1 会话加载

```
GET /api/morning-quiz/sessions/:id
```

| 项 | 事实 | 证据 |
|---|---|---|
| 认证 | 全局 `AuthGuard`（无 `@Public()`）→ **任意有效 JWT**；handler 内再校 `user.role !== 'student'` → 403 `student_only` | `morning-quiz.controller.ts:517-522` |
| 额外装饰器 | `@AllowHandoff()` —— 允许 handoff 令牌 | 同上 |
| 所有权 | `getStudentView(id, user.id)`，全程按 `user.id` 查 | `morning-quiz.service.ts:1778` |
| **考勤依赖** | **有闸，但可绕过**：`hasRealSubmission || attendanceOk` 二选一；有正式答卷即放行 | `service.ts:1815-1828` |
| 返回 `clientSeq` | **是** —— `existingAnswers[pqId].clientSeq` | `service.ts:1969` |
| 返回 `submissionId` | **是**，取自真实答卷（考勤行只是回退） | `service.ts:2004-2005` |
| 倒计时字段 | `quizEnd = effectiveEndsAt(session)`；另有仅供展示的 `regularQuizEnd` | `service.ts:2007-2010` |
| **是否泄露答案** | **否** —— 显式白名单脱敏：`stripOptions` 只留 `{key,text}`，`redactSnapshotForStudent` 处理 snapshotContent | `service.ts:1883-1895` |
| 错误码 | `session_not_found`(404) · `session_cancelled`(400) · `no_lesson_started`(403) · `paper_archived`(400) | `service.ts:1783,1785,1826,1838` |

### 4.2 逐题保存

```
PATCH /api/morning-quiz/sessions/:id/answer
body: { paperQuestionId, selectedOption?, textAnswer?, clientSeq? }
```

| 项 | 事实 | 证据 |
|---|---|---|
| schema | `paperQuestionId: string` · `selectedOption: string(≤2)\|null` · `textAnswer: string(≤20000)\|null` · **`clientSeq: int ≥ 0`（可选）** | `controller.ts:83-89` |
| 成功返回 | `{ applied: true, clientSeq, updatedAt }` | `service.ts:2244, 2277` |
| 过期写返回 | `{ applied: false, superseded: true, clientSeq: <服务端现值>, … }` | `service.ts:2266-2270` |
| 竞态重试返回 | `{ applied: retry.count>0, superseded: retry.count===0, clientSeq }` | `service.ts:2295-2299` |
| 错误码 | `session_not_found`(404) · `quiz_window_closed`(400) · `no_submission`(404) · **`submission_locked`(400，带 status)** · `paper_question_mismatch`(404) | `service.ts:2163,2166,2176,2178,2185` |

> **`clientSeq` 在加载与保存两侧都存在** —— 加载给出每题服务端已接受的
> 最大序号，保存据此拒绝乱序旧请求。这是新端能安全跨设备续答的基础。

### 4.3 最终交卷

```
POST /api/morning-quiz/sessions/:id/submit
body?: { final?: boolean }   // 缺省视为 final=true
```

| 项 | 事实 | 证据 |
|---|---|---|
| 先查答卷 | `findSubmissionForSession(id, user.id)`，无则 400 `no_submission_for_session` | `controller.ts:563-565` |
| 实际执行 | `student.finalSubmit(submission.id, {…}, { deferAi: true, final })` | `controller.ts:571-575` |
| **重复提交** | **非幂等** —— `sub.status !== 'in_progress'` 时抛 **400 `submission already <status>`** | `student.service.ts:639-641` |
| 所有权 | `sub.studentId !== student.id` → 403 | `student.service.ts:638` |
| 返回 | 更新后的 `studentSubmission` 行 | `student.service.ts:765, 810` |

> **交卷返回的是答卷行，不含 `nextAction`。** 因此「交卷后去哪」**必须**
> 由随后的 `/lesson/today` 刷新决定（见 §6）。

### 4.4 交卷后刷新

`GET /api/lesson/today`（Bearer，零身份参数）—— 阶段 5A/6A 已冻结，
返回含 `nextAction.kind`，新端据此走 `NEXT_ACTION_ROUTE`。

### 4.5 事实分级

- **源码可证**：以上全部带 file:line 的条目。
- **测试可证**：`clientSeq` 的乱序拒绝与重试语义 —— `answer-seq.spec.ts`、
  `answer-diff.spec.ts`（本轮执行，25 通过）。渲染器选择 —— `registry.test.ts`。
  草稿合并 —— `draft-merge.test.ts`。
- **未决**：见 §7。

---

## 5. AC-06 —— 状态与持久化契约

### 5.1 状态机

```
loading ──成功──▶ active-clean ──改答案──▶ active-dirty
   │                   ▲                        │ 600ms 防抖
   └──失败──▶ terminal-error                    ▼
                                             saving
                          ┌──applied:true────────┤
                          │                      ├──superseded:true──▶ active-clean（丢弃本次）
                     active-clean                ├──网络失败 + 离线──▶ offline-queued
                                                 └──网络失败 + 在线──▶ save-error
offline-queued ──重连──▶ replaying ──全部落盘──▶ active-clean
save-error ──重试成功──▶ active-clean
active-clean ──点交卷──▶ submitting ──成功──▶ submitted ──刷新 today──▶ 按 kind 路由
                            └──already submitted(400)──▶ submitted（视为已完成，不报错）
```

### 5.2 冻结的规则

| 规则 | 内容 | 依据 |
|---|---|---|
| `clientSeq` 归属 | **客户端分配**，每题独立、单调递增；初值取自加载响应的该题 `clientSeq`（无则 0） | `ExamContext.tsx:491-493`、`service.ts:1969` |
| 分配时机 | **在 `setAnswer` 时分配**，不是发请求时 —— 保证「先写的拿更小的号」 | `ExamContext.tsx:491-493` |
| 重试规则 | 重试**沿用同一个 seq**（`pendingSeqRef`），不得换更大的号 | `ExamContext.tsx:452-454` |
| 过期写处理 | `superseded:true` **不是失败**：清 pending、清 dirty、不置 `saveError` | `ExamContext.tsx:461-466` |
| 最新答案优先 | 防抖计时器到点时取 `latestAnswerRef` 的当前值，不用闭包捕获值 | `ExamContext.tsx:513-515` |
| 防抖 | 600 ms（`SAVE_DEBOUNCE_MS`） | `ExamContext.tsx:133` |
| 交卷前强刷 | `flushPendingSaves()`：先清空所有计时器，再并行 `Promise.allSettled` 落盘 | `ExamContext.tsx:524-542` |
| 重连补传顺序 | 按 `mergeDrafts` 算出的 `resend` 列表补传；**只跑一次**；次要标签不补传 | `draftMerge.ts`、`ExamContext.tsx:545+` |
| 有限重试 | 失败保留 dirty，**不做无限自动重试**；靠「重连」与「交卷前强刷」两个时机重来 | `ExamContext.tsx:467-472` |
| 次要标签 | tab UUID + 心跳；10 秒过期；次要标签**本地照写、服务端不写**；提供显式接管 | `ExamContext.tsx:239-340, 500-503` |
| 交卷阻塞 | `hasPendingSaves` 为真或 `saveError` 未清时**不得提交** | 新端新增约束（旧端仅靠 flush） |

### 5.3 存储键（新端自有，全部 `sw:` 前缀）

| 键 | 内容 | 作用域 |
|---|---|---|
| `sw:token` | 学生令牌（**已存在**，唯一身份来源） | 全局 |
| `sw:reading:answers:<sessionId>:<submissionId>` | 答案缓存 | 每会话每答卷 |
| `sw:reading:seqs:<sessionId>:<submissionId>` | 每题 `clientSeq` | 同上 |
| `sw:reading:flags:<sessionId>:<submissionId>` | 旗标集合 | 同上 |
| `sw:reading:tab-owner:<sessionId>` | 标签所有权心跳 | 每会话 |
| `sw:fontScale` | 字号偏好 | 全局 |

**分桶规则**：用 `submissionId` 分桶（与旧端同一思路），
**不用姓名、不用 studentId 作为键的一部分** —— 答卷 id 已经隐含了学生，
且它来自服务端而不是本地推断。

**清理规则**：`logout()` 与账号切换时，清掉**全部 `sw:` 前缀键**
（现有 `clearIdentity()` 只清 `sw:token`，阶段 7 需扩展为按前缀扫除）。
**绝不读写 `mq:*` 任何键。**

---

## 6. AC-07 / AC-08 —— 渲染与交卷

### 6.1 题型矩阵（取自真实注册表与测试）

`RENDERERS`（`QuestionTypeRegistry.tsx:60-67`）共 **6 个**：

| rendererKey | 渲染器 | 响应形状 | 可编辑答案形状 | 需要的渲染能力 | 移动端风险 | 逻辑纯度 |
|---|---|---|---|---|---|---|
| `ielts_reading` | `IELTSReadingPassage`（1066 行） | 段落 + 分组题目（13 种 taskType） | `selectedOption` / `textAnswer` | 可拖分栏、高亮、便签、分组标题 | **高** —— 分栏在窄屏无意义，需改为上下堆叠 | 纯（仅依赖 ExamContext + shared） |
| `olevel_comprehension` | `OLevelComprehension`（349 行） | 段落 + 逐题分页 | 同上 | 分页、回溯找所属段落 | 中 | 纯 |
| `olevel_cloze` | `OLevelCloze`（149 行） | 带空的连续文本 | `textAnswer` | 行内空格输入 | 中 —— 行内输入在小屏易被键盘遮挡 | 纯 |
| `olevel_vocab` | `OLevelVocabInContext`（151 行） | 词 + 语境句 | `textAnswer` / `selectedOption` | —— | 低 | 纯 |
| `olevel_transformation` | `OLevelSentenceTransformation`（139 行） | 原句 + 改写要求 | `textAnswer` | —— | 低 | 纯（有测试） |
| `olevel_mcq` | `OLevelMcqList`（137 行） | 独立选择题列表 | `selectedOption` | —— | 低 | 纯（有测试） |

选择顺序（源码可证，`QuestionTypeRegistry.tsx:69-170`）：
① 显式 `rendererKey`（查不到则 `console.warn` 并回退）→
② IELTS 家族（`paperMode==='passage_pick'` 或 13 种 taskType 之一），
其中**多真实段落**（过滤掉 `refer to…` 之类 backref 伪段落后 >1）
回退到 `OLevelComprehension` → ③ `uiKind` 显式提示 → ④ 长段落 + 多题
启发式 → ⑤ 兜底 `OLevelMcqList`。空卷 → `EmptyPaperCard`。

`ExamAnswer` 形状（`types.ts:43-45`）：`{ selectedOption?: string; textAnswer?: string }`
—— 两者可**同时存在**（passage-pick 的双写），保存时分别传两个字段，
**不得**塞回单一 `content` 字段（那是给老客户端的兼容字段）。

### 6.2 冻结的产品行为

| 项 | 冻结 |
|---|---|
| 倒计时 | 用加载响应的 **`quizEnd`**（= `effectiveEndsAt`），**不用 `regularQuizEnd`** —— 后者在第二窗内早已过期，会当场自动交卷 |
| 全天语义 | 服务端已在全天模式下把 `secondWindowToday` 置 false（`service.ts:1990`）；**前端不自己猜配置**，只读该字段 |
| 离线指示 | 保留 `OfflineBadge`；探测改用学生端自己的 API base |
| 进度 / 导航 | 保留 `QuestionNavBar` + 旗标 |
| 后退 / beforeunload | 有未保存内容时 `beforeunload` 提示；浏览器后退**回 `/today`**，不回 `/scan`、不回 `/my-history` |
| 交卷确认 | 需二次确认；文案由 `secondWindowToday` 驱动 |
| 无障碍最低线 | 所有输入有 `<label>`；焦点可见；触控目标 ≥ 44 px；错误用 `role="alert"` |
| **不保留** | 考勤语义、早测语义、旧历史页语义 —— 即使旧页面里有 |

### 6.3 交卷序列（AC-08，幂等）

```
1. flushPendingSaves()                      ← 清空防抖 + 并行落盘
2. if (hasPendingSaves || saveError) 中止    ← 有未落盘内容不许交
3. POST /morning-quiz/sessions/:id/submit   ← 只发一次
4. 若 400 且 message 匹配 /already (submitted|graded|locked)/
      → 视为**已完成**，不报错，继续第 5 步
5. GET /lesson/today                        ← 刷新权威状态
6. NEXT_ACTION_ROUTE[nextAction.kind] → navigate
```

阶段 8 的结果页在阶段 7 **仍是占位**：第 6 步若得到 `read_result`，
落到 `/lesson/reading/result` 的占位页。**不得**跳 `/my-history`
或任何旧页面。

---

## 7. AC-09 —— 矛盾与阻断项审计

| # | 问题 | 结论 | 证据 |
|---|---|---|---|
| Q1 | `getStudentView` 是否仍有考勤依赖？ | **仍有，但不是必要条件**：判据是 `hasRealSubmission \|\| attendanceOk`。账号制路径下 `POST /lesson/start {begin:true}` 会建正式答卷，因此可通过。**不阻断** | `service.ts:1815-1828`；注释明写「P9 课程不再依赖考勤」 |
| Q2 | `lesson/start` 如何创建/定位 session 与 submission？ | `today({freeze:true, begin:true})` 在 `readNow.availability==='ready' && !opened && assignmentId` 时调 `createRealSubmissionSafe(assignmentId, studentId, maxScore)`；`sessionId` / `submissionId` 随后由 `readState` 回填进 `segments.read`。**不阻断** | `lesson.service.ts:209-226` |
| Q3 | 会话所有权是否全程 token-only？ | **不是纯 token-only**：`GET/PATCH/POST sessions/:id` 走的是**全局 `AuthGuard`**（任意有效 JWT + handler 内 role 检查），不是 `StudentIdentityGuard`。学生 PIN 令牌满足条件，所以**可用**；但它与阶段 5A 的 token-only 体系是**两套闸**。**不阻断阶段 7，记为 BACKLOG** | `controller.ts:517-522`；`auth.guard.ts` 全局 APP_GUARD |
| Q4 | 加载是否提供 `clientSeq` 初始化所需的全部值？ | **是** —— 每题 `clientSeq` + `submissionId` + `sessionId` 齐备 | `service.ts:1969, 2004-2005` |
| Q5 | 交卷返回是否足以确定路由？ | **否** —— 只返回答卷行，无 `nextAction`。**设计已应对**：交卷后必须刷 `/lesson/today`（§6.3 第 5 步）。**不阻断** | `student.service.ts:765, 810` |
| Q6 | 全天倒计时语义是否与目标产品冲突？ | **不冲突**：服务端已给 `quizEnd = effectiveEndsAt` 且全天模式下 `secondWindowToday=false`。**前提是前端用对字段** —— 用错就会当场误交卷（2026-08-24 实测事故） | `service.ts:1990, 2007-2010` |
| U-1 | `@AllowHandoff()` 在三个端点上都开着 | 新端**不使用** handoff 令牌，但端点仍接受它。属旧通道，阶段 16 退役时一并处理。**BACKLOG** | `controller.ts:518, 526, 555` |
| U-2 | 重复交卷返回 400 而非幂等 200 | 新端按 §6.3 第 4 步容错。**不阻断**，但服务端语义值得单独讨论。**BACKLOG** | `student.service.ts:639-641` |
| U-3 | `TimeUpMakeup` 的产品语义 | 绑第二作答窗；全天模式下是否还需要**未决**。阶段 7 不搬，先不显示。**记为未决** | `TimeUpMakeup.tsx` |

**S7B 判定：`S7B_GO`。** 上述六个问题全部有确定答案，无未解决的实现依赖。
U-1 / U-2 / U-3 是记录项，不构成阻断。

---

## 8. AC-10 —— 后续实施蓝图

> **本节是划分，不是执行合同。** 各子阶段的冻结合同另行下发。

### S7B —— 地基 / API / 状态引擎

- **目标**：新端能加载一场阅读会话、逐题自动保存、离线排队、重连补传。
- **预期文件**：
  `student-web/src/lib/api.ts`（加 3 个端点 + 类型）、
  `student-web/src/lesson/{draftMerge,examTypes}.ts`（搬运）、
  `student-web/src/lesson/ExamContext.tsx`（重建，注入 healthProbe）、
  `student-web/src/lesson/storage.ts`（`sw:reading:*` 键 + 前缀清理）、
  `student-web/src/__tests__/reading-state.test.tsx`（新）、
  `student-web/src/__tests__/draft-merge.test.ts`（随搬运）
- **测试层级**：本地行为测试（真组件 + 打桩 fetch），含 `clientSeq` 单调、
  `superseded` 处理、离线队列、重连补传、次要标签阻断。
- **回滚边界**：单个提交；不触碰路由与页面，`/lesson/reading` 仍是占位。
- **前置**：无（本设计即前置）。

### S7C —— 题型渲染与阅读界面

- **目标**：六个渲染器 + 外壳在新端跑起来，`/lesson/reading` 变成真页面。
- **预期文件**：`student-web/src/lesson/{QuestionTypeRegistry,shared/*,questions/*}.tsx`（搬运 + 改路径）、
  `student-web/src/pages/Reading.tsx`（重建）、
  随搬运的 6 个既有测试文件。
- **测试层级**：渲染器选择的纯函数测试 + 页面级行为测试。
- **回滚边界**：单个提交；回滚后 `/lesson/reading` 退回占位页。
- **前置**：S7B 完成。

### S7D —— 本地集成与回归

- **目标**：加载 → 作答 → 离线 → 重连 → 交卷 → 刷 today → 按 kind 路由，全链本地跑通。
- **预期文件**：仅测试文件 + 必要修补。
- **测试层级**：`apps/student-web` 全量 + `apps/web` 与 `apps/api` 零 diff 核验。
- **回滚边界**：单个提交。
- **前置**：S7C 完成。

### S7E —— staging / 真机验收

- **目标**：部署学生端，用八个虚构账号验证阅读页。
- **预期文件**：仅 `migration-plan.md`。
- **测试层级**：实机（部署 + 浏览器 + 真 API）。
- **回滚边界**：部署回滚锚点。
- **前置**：S7D 完成；**且需要一场当天可用的阅读会话** —— 当前八个账号
  的 `read` 段全是 `none`（2026-08-28 实测），**没有可作答的卷子**。
  这是 S7E 的硬前置，与夹具重建绑定。

---

## 9. BACKLOG（记录，本轮不处理）

- **BL-A** 阅读三端点走全局 `AuthGuard` 而非 `StudentIdentityGuard`，与阶段 5A 的 token-only 体系是两套闸（Q3）。
- **BL-B** `@AllowHandoff()` 仍开在三个端点上（U-1）。
- **BL-C** 重复交卷返回 400 而非幂等 200（U-2）。
- **BL-D** `TimeUpMakeup` 在全天模式下的语义未决（U-3）。
- **BL-E** 八账号夹具已漂移，`read` 段全为 `none`，S7E 无卷可考。
- **BL-F** `student-web` 的 `clearIdentity()` 目前只清 `sw:token`，阶段 7 需扩展为 `sw:` 前缀扫除。
