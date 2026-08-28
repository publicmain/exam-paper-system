# 阅读页迁移设计 —— `/lesson/reading`

> `task_id: S7A-READING-MIGRATION-DESIGN` · `contract_version: 1.0` ·
> `base_commit: e1ab4dc`
>
> **本文件是设计，不是实现。** 证据层级 = **源码 + 既有自动化测试**。
> 全文**没有任何** staging、真机或真实数据库的验证声明 —— 凡是只由源码
> 或测试支撑的结论，都按「源码可证 / 测试可证」标注；未解决的写「未决」。

---

## 0. 一句话结论

`apps/web/src/components/exam/` 这棵子树**大部分是纯的** —— 18 个文件里
只有**两处**碰旧端，都是同一个符号 `BASE`：`ExamContext.tsx` 的连通性探测，
以及 `ExamWordSheet.tsx` 的查词与生词本写入（后者还带 `studentName`，
违反身份契约）。因此 `IELTSReadingPassage` **不是纯组件** —— 它 import 了
词表（见 §1.3）。

学生端的 Docker 构建上下文**只有 `apps/student-web` 一个目录**，跨应用直接
import **在部署层面不可能成立**。因此选 **方案 C：把纯能力按文件重建进
student-web**，把 `ExamContext` 的网络耦合改成注入，**并在阶段 7 摘掉词表
挂点**（能力去向阶段 12）。

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
| `questions/OLevel*.tsx`（5 个） | 仅 `../types` `../ExamContext` `../shared/*` |
| `questions/IELTSReadingPassage.tsx` | `../types` `../ExamContext` `../shared/*` **+ `../ExamWordSheet`** ← 非纯，见 §1.3 |
| `ExamWordSheet.tsx` | **`../../lib/api` 的 `BASE`**（第二处旧端耦合，首版漏记） |
| `QuestionTypeRegistry.tsx` | 仅 `./types` `./questions/*` |

**结论（返工 1/2 更正）**：整棵子树对旧端的耦合面 = **1 个符号（`BASE`），
但有两个使用点** —— `ExamContext.tsx:411` 的 `/api/health` 连通性探测，
以及 **`ExamWordSheet.tsx:110/121` 的查词与生词本写入**。首版只记了前者，
因而误判 `IELTSReadingPassage` 为纯组件。
### 1.2 行为分类

| # | 行为 | 位置 | 分类 |
|---|---|---|---|
| 1 | 五个题型渲染器（O-Level 理解 / 完形 / 词汇 / 句子转换 / MCQ 列表） | `questions/OLevel*.tsx`、`QuestionTypeRegistry.tsx` | **REUSE_PURE_LOGIC** |
| 1b | **IELTS 阅读渲染器** | `questions/IELTSReadingPassage.tsx` | **REBUILD_IN_STUDENT_WEB** —— **不是纯的**，见 §1.3 |
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
| 18 | 生词表 `ExamWordSheet` | `ExamWordSheet.tsx` 243 行 | **STAGE8_OR_LATER → 具体为阶段 12** —— 且**必须先重写成 token-only**（现版本带 `studentName` 写库，违反 §3）。见 §1.3 |
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


### 1.3 `IELTSReadingPassage` 不是纯组件（返工 1/2 更正）

首版把六个渲染器统统标成 REUSE_PURE_LOGIC，**是错的**。
`IELTSReadingPassage.tsx:9` 有一行：

```
import ExamWordSheet from '../ExamWordSheet';
```

并在 `:492-503` 真的挂载它。而 §1.2 又把 `ExamWordSheet` 判为
STAGE8_OR_LATER「阶段 7 不搬」—— **搬了渲染器不搬依赖，编译不过**。
这是首版文件计划里的一个硬矛盾。

更糟的是，`ExamWordSheet` 不只是「多一个依赖」：

| 事实 | 证据 |
|---|---|
| 它自己也耦合旧端 | `ExamWordSheet.tsx:2` `import { BASE } from '../../lib/api'` |
| 它查词 | `:110` `GET ${BASE}/api/vocab/lookup?word=…` |
| **它带姓名写生词本** | `:121-129` `POST ${BASE}/api/vocab/words`，body 含 **`studentName`** |
| 姓名从卷子载荷取 | `IELTSReadingPassage.tsx:495` `studentName={paper?.studentName ?? null}` |
| 它还写旧命名空间的键 | `:135` `LOOKED_UP_KEY = 'mq:lookedUpOnce'` |

**`studentName` 写入直接违反 §3 已冻结的身份契约**（URL 与请求体零
`name`/`studentName`/`studentId`）。所以它既不能逐字搬，也不能只改
import 路径了事 —— 必须重写成 token-only 才谈得上迁移。

#### 阶段 7 的处置：**方案 (b) —— 摘掉词表挂点，改写渲染器**

选 (b) 而不是 (a)（连词表一起迁），理由有三：

1. 迁它就必须同时重写它的两个网络调用（token-only）、换掉 `mq:` 键、
   重新定义「考试中记生词」的产品语义 —— 这三件事都不属于阅读页；
2. 它写的是**生词本**，那条线的 canonical 归属在阶段 12；
3. 阶段 7 的退出条件是「能读、能答、能交卷、不丢答案」，查词是增强而非
   必要路径 —— 学生仍可手打答案。

**阶段 7 的确切替代行为**（S7C 必须照此实现）：

- 迁移后的 `IELTSReadingPassage` **不 import、不挂载** `ExamWordSheet`；
- 删除只服务于词表的 props 与状态：`pickedWord` / `pickedSentence` /
  `blockedWords` / `fillTarget` / `onFill` / `closeWordSheet` / `restorePad`
  的滚动让位逻辑；
- **保留**与词表无关的选中能力：`Highlighter`（划线）、`StickyNote`（便签）、
  `DraggableSplit`（分栏）—— 三者零外部依赖，逐字搬；
- 长按 / 双击选中单词时**不弹任何面板**，选中态仍可用于划线；
- 因此**丢失一项便利**：原来「点段落里的词 → 填进填空题答案框」的
  `onFill` 快捷路径没有了。学生手动输入，功能不缺，只是多敲几个字。
  这一点必须在 S7C 的实现说明里写清，不得静默丢弃。

**能力去向：阶段 12（生词本与错题本）。** 届时需要：
`/vocab/lookup` 与 `/vocab/words` 改走 token-only（阶段 5A 已让这两个
端点支持 `authStudentId`，客户端只需停止发送 `studentName`）、
`mq:lookedUpOnce` 换成 `sw:` 键、并把词表重新挂回阅读页。
**这是阶段 12 的一个具名子项，不是阶段 7 的遗留。**

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
| `questions/OLevel*.tsx`（5 个） | 同名 | 搬；只改 import 路径 |
| `questions/IELTSReadingPassage.tsx` | 同名 | **搬 + 改写** —— 删掉 `import ExamWordSheet` 与它的挂载、以及只服务于词表的 props/状态；其余逐字保留。详见 §1.3 |
| `QuestionTypeRegistry.tsx` | `student-web/src/lesson/QuestionTypeRegistry.tsx` | 逐字搬（选择逻辑是纯函数，`registry.test.ts` 已覆盖） |
| `ExamContext.tsx` | `student-web/src/lesson/ExamContext.tsx` | **重建**：`BASE` 改为 **props 注入的 `healthProbe` 回调**；存储键换 `sw:*`；删旧键清理 |
| `MorningQuizTake.tsx` | `student-web/src/pages/Reading.tsx` | **重建**，只取 §1.2 里 REQUIRED_CANONICAL / REBUILD 的部分 |
| `ExamWordSheet` | —— | 阶段 7 **不搬**；能力归**阶段 12**，且届时必须先重写成 token-only（现版本 POST `studentName`，违反 §3）。见 §1.3 |
| `WhatsNewSheet` `TimeUpMakeup` | —— | 阶段 7 **不搬** |

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
| 过期写返回 | `{ applied: false, superseded: true, clientSeq: <服务端现值>, updatedAt }` —— **不含答案内容**，这是 §5.4 必须另发一次权威重载的根本原因 | `service.ts:2266-2270` |
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
                          │                      ├──superseded:true──▶ 见 §5.4 对账
                     active-clean                ├──网络失败 + 离线──▶ offline-queued
                                                 └──网络失败 + 在线──▶ save-error
offline-queued ──重连──▶ replaying ──全部落盘──▶ active-clean
save-error ──重试成功──▶ active-clean
reconciling ──重载成功──▶ active-clean（可能被服务端值覆盖）
reconciling ──重载失败──▶ conflict-unverified ──重试同步──▶ reconciling
active-clean ──点交卷──▶ submitting ──成功──▶ submitted ──刷新 today──▶ 按 kind 路由
                            └──already submitted(400)──▶ submitted（视为已完成，不报错）
```

### 5.2 冻结的规则

| 规则 | 内容 | 依据 |
|---|---|---|
| `clientSeq` 归属 | **客户端分配**，每题独立、单调递增；初值取自加载响应的该题 `clientSeq`（无则 0） | `ExamContext.tsx:491-493`、`service.ts:1969` |
| 分配时机 | **在 `setAnswer` 时分配**，不是发请求时 —— 保证「先写的拿更小的号」 | `ExamContext.tsx:491-493` |
| 重试规则 | 重试**沿用同一个 seq**（`pendingSeqRef`），不得换更大的号 | `ExamContext.tsx:452-454` |
| 过期写处理 | `superseded:true` **不是失败，但也不是干净** —— 旧端「清 dirty 即完事」的做法在新端**作废**，改按 §5.4 对账 | 旧端行为见 `ExamContext.tsx:461-466`；作废理由见 §5.4 |
| 最新答案优先 | 防抖计时器到点时取 `latestAnswerRef` 的当前值，不用闭包捕获值 | `ExamContext.tsx:513-515` |
| 防抖 | 600 ms（`SAVE_DEBOUNCE_MS`） | `ExamContext.tsx:133` |
| 交卷前强刷 | `flushPendingSaves()`：先清空所有计时器，再并行 `Promise.allSettled` 落盘 | `ExamContext.tsx:524-542` |
| 重连补传顺序 | 按 `mergeDrafts` 算出的 `resend` 列表补传；**只跑一次**；次要标签不补传 | `draftMerge.ts`、`ExamContext.tsx:545+` |
| 有限重试 | 失败保留 dirty，**不做无限自动重试**；靠「重连」与「交卷前强刷」两个时机重来 | `ExamContext.tsx:467-472` |
| 次要标签 | tab UUID + 心跳；10 秒过期；次要标签**本地照写、服务端不写**；提供显式接管 | `ExamContext.tsx:239-340, 500-503` |
| 交卷阻塞 | `hasPendingSaves` 为真、`saveError` 未清、**或存在未证实的题（§5.4）** 时**不得提交** | 新端新增约束（旧端仅靠 flush） |

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

### 5.4 `superseded` 的对账规则（返工 1/2 更正，冻结）

首版把 `superseded:true` 直接接回 `active-clean` 并清 dirty，**是错的**。
理由是一条硬事实：

| 事实 | 证据 |
|---|---|
| 保存接口在过期写时**只回序号和时间戳，不回答案内容** | `service.ts:2266-2270` `select: { clientSeq: true, updatedAt: true }` |
| 服务端接受写的条件是 `stored === null \|\| stored < incoming` | `answer-seq.ts:39-43`、`answer-seq.spec.ts:52-59` |
| 因此 `superseded` 的返回值必然满足 `res.clientSeq >= 本次发出的 seq` | 上一行的逆否 |

所以「过期写」意味着**库里有一个本客户端没写进去的值，而客户端不知道
那个值是什么**。首版的处理会让界面显示本地答案、同时报「已保存」——
**屏幕上是未经证实的答案，状态却是干净的**。这正是本设计要防的那类
「学生以为存上了，其实没有」。

#### 冻结规则

设该题本地已分配的最大序号为 `L`、本次请求发出的序号为 `N`、
服务端回的现值为 `S`（恒有 `S >= N`）。**只有两种情况**：

**情况 A —— 本地自己更新（良性）：`L > N`。**
在途期间学生又改了答案，那次改动已经拿到更大的号、有它自己的保存生命
周期。处理：只从 `pendingSeq` 里摘掉 `N` 这一项；**`dirty` 保持为真**
（更新的那次还没落盘），`verified` 保持为假，不置 `saveError`，
**不进 `active-clean`**。等更大的号那次写回来再定状态。

**情况 B —— 本地没有更新的写（真冲突）：`L === N`。**
库里的 `S` 不是本客户端能解释的（其他设备、第二作答窗、服务端补写，
或者本次是「上一次其实写成功了但响应丢了」的重试）。处理：

1. 该题标 `verified = false`、`dirty = false`（再重发只会再被拒），
   进入 `reconciling`；
2. 触发一次**权威重载** `GET /api/morning-quiz/sessions/:id/student-view`
   —— **单飞**：多题同时冲突只发一个请求，同一时刻只允许一个在途，
   在途期间新冲突的题挂在同一个 promise 上；
3. 回来后按题取 `existingAnswers[qid]`（`{selectedOption, textAnswer,
   clientSeq}`，`service.ts:1963-1975`）覆盖本地：
   `answers[qid] ← 服务端值`、`seqs[qid] ← existingAnswers[qid].clientSeq ?? S`、
   `verified[qid] = true`，该题回 `active-clean`，同时落盘到
   `sw:reading:answers:*` 与 `sw:reading:seqs:*`；
4. **不静默覆盖**：若服务端值与覆盖前的本地显示值不同，弹一条需要学生
   点掉的提示 ——「这道题在别的地方改过，已经取服务器上的版本」。
   相同则不打扰；
5. 重载失败（401 以外）→ 该题停在 `conflict-unverified`：横幅常显、
   提供「重试同步」、**交卷被阻塞**。401 交给既有的 `handleAuthFailure`
   走登出。

`L < N` 不可能（`N` 取自 `L`）。若真出现，**按情况 B 处理**（fail-closed）。

#### 连带的三条约束

- **交卷阻塞**扩一项：`hasPendingSaves || saveError || hasUnverifiedAnswers`
  为真时不得提交（原来只有前两项）。
- `flushPendingSaves()` 交卷前不仅要等在途保存，**还要等在途的对账重载**；
  对账后若仍有 `verified=false` 的题，`flush` 判定为失败，交卷不发出。
- **`verified` 只存在内存里，不进 localStorage。** 刷新页面本来就会重新
  拉权威会话并跑 `mergeDrafts`，那条路径已经把本地和服务端对齐了 ——
  再持久化一份未证实标记只会制造第二个真相源。

---

## 6. AC-07 / AC-08 —— 渲染与交卷

### 6.1 题型矩阵（取自真实注册表与测试）

`RENDERERS`（`QuestionTypeRegistry.tsx:60-67`）共 **6 个**。下表是分派与
风险概览，**逐字段的数据契约见 §6.1.1**：

| rendererKey | 渲染器 | 响应形状 | 可编辑答案形状 | 需要的渲染能力 | 移动端风险 | 逻辑纯度 |
|---|---|---|---|---|---|---|
| `ielts_reading` | `IELTSReadingPassage`（1066 行） | 段落 + 分组题目（13 种 taskType） | `selectedOption` / `textAnswer` | 可拖分栏、高亮、便签、分组标题 | **高** —— 分栏在窄屏无意义，需改为上下堆叠 | **不纯** —— import 了 `ExamWordSheet`，见 §1.3 |
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

### 6.1.1 逐渲染器的数据契约（返工 1/2 补，源码可证）

首版只给了「响应形状 / 需要的渲染能力」这类描述性说法，**没有列出每个
渲染器真正读的字段** —— S7C 照着首版搬，任何一个漏掉的可选字段都要到
真机上才暴露。下表逐文件扫描得出，**必填**指缺了就渲染不出内容或崩，
**可选**列出实际的兜底行为。

**共同前提**：所有渲染器都通过 `useExam()` 取 `fontScale`（驱动
`--mq-fs` CSS 变量），除 `IELTSReadingPassage` 外都不读 `paper` 本身，
只读传进来的 `q: ExamQuestion`。`ExamQuestion` 的完整形状见
`types.ts:34-41`：`{ id, sortOrder, marks, questionType, snapshotContent, snapshotOptions }`。

#### (1) `IELTSReadingPassage`（`questions/IELTSReadingPassage.tsx`）

| 来源 | 字段 | 必填？ | 兜底 |
|---|---|---|---|
| `ExamPaper` | `sessionId` | 可选 | `?? ''`，用于 `mq:hl:` / `mq:nt:` 键（`:181-182`；新端换 `sw:`） |
| `ExamPaper` | `questions[]` | **必填** | `?? []`（`:179`） |
| `ExamPaper` | `studentName` | 可选 | `?? null`（`:497`）—— **阶段 7 随词表一并删除，见 §1.3** |
| `ExamQuestion` | `id` | **必填** | 无 —— React key + 答案键 |
| `ExamQuestion` | `sortOrder` | 可选 | 仅用于填空跳转的标签「第 N 题」（`:314`） |
| `ExamQuestion` | `snapshotContent` | **必填** | `?? {}`（`:176`） |
| `ExamQuestion` | `snapshotOptions` | 可选 | 见下方 TFNG/YNG 合成兜底 |
| `ExamQuestion` | `marks` `questionType` | 可选 | 仅展示/分支参考 |
| **派生**（非后端字段） | `itemText` `localIdx` | —— | 由 `groupQuestions()` 在 `:105` 现算：`itemText` = 拆掉指令后的题干，`localIdx` = 组内序号 |
| `snapshotContent` | `passage` | **必填**（取 `questions[0]` 那份） | `?? ''` → 左栏空白（`:178`） |
| `snapshotContent` | `passageTitle` | 可选 | `?? 'Reading Passage'`（`:177`） |
| `snapshotContent` | `taskType` | **决定分支** | `?? '_other'` → 走 default 分支＝纯文本框（`:87`） |
| `snapshotContent` | `stem` | **必填** | `?? ''`，再由 `splitStem()` 拆成 `instruction` + `item`（`:88`） |
| `snapshotContent` | `headingsBank` | 条件必填 | 仅 `matching_headings` 用；非数组或空 → 该组无题库（`:95-96`） |
| `snapshotContent` | `wordBank` | 条件必填 | 仅 `summary_completion` 用；同上（`:98-99`） |
| `ExamContext` | `fontScale` `answers` `setAnswer` `savingId` `isFlagged` `mode` | —— | `:161, 305, 625, 682` 四处 `useExam()` |

**两个必须原样保留的特例**：

- **TFNG / YNG 空选项合成**（`:704-724`）：`snapshotOptions` 为空数组时，
  `true_false_not_given` 合成 `TRUE/FALSE/NOT GIVEN`、`yes_no_not_given`
  合成 `YES/NO/NOT GIVEN`，**永不渲染空单选组**。这是修过的线上事故
  （5/26 ingest bug），不是可选的防御。
- **双写 `selectedOption` + `textAnswer`**（`:747`）：TFNG / YNG /
  `multiple_choice` / `matching_features` / `classification` 五个 case
  在选中时同时写两个字段（`textAnswer` 存选项文本），因为同一道题可能
  以 `questionType=short_answer` 出库、只跑短答判分路径。**搬到新端时
  必须连这行一起搬**，否则那批题重新静默丢分。

**分组是渲染器自己算的**：`groupQuestions()`（`:85-108`）按
「相同 `taskType` + 相同 `instruction`」把连续题合成一组，
组内共享题库。后端不返回 group 字段。

**backref 伪段落**由注册表（不是渲染器）处理：`QuestionTypeRegistry.tsx:126-143`
在数多段落时先过滤掉以 `see passage` / `refer to` / `using the passage above`
等开头的短伪段落，避免单真段落的 O-Level 卷被误判成多段落。

#### (2) `OLevelComprehension`（349 行）

| 来源 | 字段 | 必填？ | 兜底 |
|---|---|---|---|
| `ExamQuestion` | `id` | **必填** | 答案键 |
| `ExamQuestion` | `marks` | 可选 | 展示「N 分」 |
| `ExamQuestion` | `snapshotContent.passage` | **必填** | 取首题那份作共享段落 |
| `ExamQuestion` | `snapshotContent.stem` | **必填** | `sc?.stem` 可选链 |
| `ExamQuestion` | `snapshotOptions` | 可选 | 无选项 → 渲染文本框而非单选 |
| `ExamContext` | `fontScale` `answers` `setAnswer` `mode` | —— | `:31, 229` |

答案写入：有选项 → `setAnswer(q.id,{selectedOption: opt.key})`（`:308`）；
无选项 → `setAnswer(q.id,{textAnswer: v})`（`:321`）。**不双写。**

#### (3) `OLevelCloze`（149 行）

| 来源 | 字段 | 必填？ | 兜底 |
|---|---|---|---|
| `ExamQuestion` | `id` | **必填** | 答案键 |
| `ExamQuestion` | `snapshotContent.passage` | **必填** | 带空的连续文本 |
| `ExamQuestion` | `snapshotContent.stem` | 可选 | 单题视图的题干 |
| `ExamContext` | `fontScale` `answers` `setAnswer` `mode` | —— | `:34, 123` |

只写 `textAnswer`（`:81, 138`）。读答案时用 `answers[q.id]?.textAnswer ?? ''`
判断该空是否已填（`:97`）。

#### (4) `OLevelVocabInContext`（151 行）

| 来源 | 字段 | 必填？ | 兜底 |
|---|---|---|---|
| `ExamQuestion` | `id` `marks` | **必填** / 可选 | —— |
| `ExamQuestion` | `snapshotContent.targetWord` | **必填** | 缺了就没有要考的词 |
| `ExamQuestion` | `snapshotContent.contextSentence` | **必填** | 语境句 |
| `ExamQuestion` | `snapshotContent.stem` | 可选 | 题干 |
| `ExamQuestion` | `snapshotContent.correctOption` | **仅 practice 模式** | `test` 模式下不得渲染 |
| `ExamQuestion` | `snapshotOptions` | **必填** | 单选项 |
| `ExamContext` | `fontScale` `answers` `setAnswer` `mode` | —— | `:23, 63` |

只写 `selectedOption`（`:119`）。

#### (5) `OLevelSentenceTransformation`（139 行）

| 来源 | 字段 | 必填？ | 兜底 |
|---|---|---|---|
| `ExamQuestion` | `id` `marks` | **必填** / 可选 | —— |
| `ExamQuestion` | `snapshotContent.original` | **必填** | 原句 |
| `ExamQuestion` | `snapshotContent.starter` | **必填** | 给定开头 |
| `ExamQuestion` | `snapshotContent.stem` | 可选 | 指令 |
| `ExamQuestion` | `snapshotContent.maxWords` | 可选 | 有则显示字数上限提示 |
| `ExamQuestion` | `snapshotContent.exampleAnswer` | **仅 practice 模式** | `test` 模式下不得渲染 |
| `ExamContext` | `fontScale` `answers` `setAnswer` `mode` | —— | `:26, 65` |

只写 `textAnswer`（`:112`）。**无 `snapshotOptions`。**

#### (6) `OLevelMcqList`（137 行）

| 来源 | 字段 | 必填？ | 兜底 |
|---|---|---|---|
| `ExamQuestion` | `id` `marks` | **必填** / 可选 | —— |
| `ExamQuestion` | `snapshotContent.stem` | **必填** | 题干 |
| `ExamQuestion` | `snapshotContent.correctOption` | **仅 practice 模式** | `test` 模式下不得渲染 |
| `ExamQuestion` | `snapshotContent.explanation` | **仅 practice 模式** | 同上 |
| `ExamQuestion` | `snapshotOptions` | 可选 | **无选项时退化成文本框**（`:93`），这是兜底渲染器的兜底 |
| `ExamContext` | `fontScale` `answers` `setAnswer` `mode` | —— | `:13` |

有选项 → `selectedOption`（`:67`）；无选项 → `textAnswer`（`:93`）。

> **`correctOption` / `explanation` / `exampleAnswer` 三个字段只在
> `mode==='practice'` 下渲染。** 阶段 7 的阅读页是 `mode='test'`，
> 服务端也已按 §4.1 的白名单删掉答案键 —— 两道闸都要在，缺一不可。

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
| Q7 | 六个渲染器是否都能只改 import 路径就搬走？ | **否** —— `IELTSReadingPassage` import 了 `ExamWordSheet`，而后者不搬且自带旧端耦合与 `studentName` 写入。**首版的文件计划编译不过**。已按 §1.3 改为「搬 + 摘掉词表挂点」，能力归阶段 12。**不阻断阶段 7** | `IELTSReadingPassage.tsx:9, 492-503`；`ExamWordSheet.tsx:2, 110, 121-129` |
| Q8 | 保存接口的 `superseded` 能否直接当成「已同步」？ | **否** —— 它只回序号不回答案内容，直接接回 `active-clean` 会让界面「显示未证实的答案却报已保存」。已按 §5.4 冻结对账规则（本地更新 / 真冲突两种情况 + 权威重载 + 交卷阻塞）。**不阻断阶段 7** | `service.ts:2266-2270`；`answer-seq.ts:39-43` |

**S7B 判定：`S7B_GO`（返工 1/2 后维持）。** 上述八个问题全部有确定答案，
无未解决的实现依赖。Q7 / Q8 是本轮评审提出、并在本轮**在设计内**解决的，
不是延后项。U-1 / U-2 / U-3 是记录项，不构成阻断。

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
  离线队列、重连补传、次要标签阻断，以及 **§5.4 对账的四个用例**：
  1. **情况 A**：发出 seq=1 → 学生再改（本地 seq=2）→ seq=1 回 superseded
     → 断言该题**仍是 dirty、未证实**，界面没有显示「已保存」；
  2. **情况 B 有差异**：本地 seq=1、服务端回 `superseded, clientSeq:5`，
     重载给出不同答案 → 断言本地答案与 seq **被服务端值覆盖**、已落盘、
     弹出一次冲突提示、该题回干净；
  3. **情况 B 无差异**（重试撞上自己已落盘的写）→ 断言覆盖后**不弹**提示；
  4. **重载失败**：`student-view` 返回 500 → 断言该题停在 `conflict-unverified`、
     横幅可见、**点交卷不发出 submit 请求**。
- **回滚边界**：单个提交；不触碰路由与页面，`/lesson/reading` 仍是占位。
- **前置**：无（本设计即前置）。

### S7C —— 题型渲染与阅读界面

- **目标**：六个渲染器 + 外壳在新端跑起来，`/lesson/reading` 变成真页面。
- **预期文件**：`student-web/src/lesson/{QuestionTypeRegistry,shared/*}.tsx`（搬运 + 改路径）、
  `student-web/src/lesson/questions/OLevel*.tsx`（5 个，搬运 + 改路径）、
  `student-web/src/lesson/questions/IELTSReadingPassage.tsx`（**搬运 + 按 §1.3 摘掉词表挂点**）、
  `student-web/src/pages/Reading.tsx`（重建）、
  随搬运的 6 个既有测试文件。
  **不含** `ExamWordSheet.tsx` —— 它不进新端（§1.3）。
- **测试层级**：渲染器选择的纯函数测试 + 页面级行为测试；
  另加一条**编译/依赖断言**：新端 `questions/` 下没有任何文件 import
  `ExamWordSheet`，且 `npm run build` 通过（首版的文件计划正是在这里
  编译不过）。
- **数据契约**：按 §6.1.1 逐字段核对，特别是 TFNG/YNG 空选项合成与
  五个 case 的 `selectedOption` + `textAnswer` 双写 —— 这两处漏搬会静默丢分。
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
- **BL-G** 考试中查词记生词本（`ExamWordSheet`）：能力归**阶段 12**，届时要把 `/vocab/lookup` 与 `/vocab/words` 的客户端调用改成 token-only（停发 `studentName`）、把 `mq:lookedUpOnce` 换成 `sw:` 键。阶段 7 起该能力**在新端不存在**（§1.3）。
