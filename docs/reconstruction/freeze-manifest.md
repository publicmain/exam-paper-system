# 冻结清单（重建阶段 1）

> 2026-08-27 · 冻结基线 **`4ad1ead`**
> 标签：**`pre-student-reconstruction-4ad1ead`**（annotated，仅本地）

这份清单回答一个问题：**在 `apps/student-web` 存在之前，哪些代码可以动、
动到什么程度。**

冻结不是「一行都不许改」—— 学生每天都在用这些页面，出了阻断性缺陷
必须能修。冻结的是**方向**：旧代码不再往前长，新的学生行为一律去新端。

---

## 1. 被冻结的范围

### 1.1 学生页面（`apps/web/src/pages/`）

| 文件 | 行数 | 承载的页面 |
|---|---|---|
| `Me.tsx` | 520 | `/me` 个人主页 + PIN 登录 |
| `MyLesson.tsx` | 433 | `/my-lesson` 今天的课 |
| `TaskSummary.tsx` | 202 | `/my-lesson/summary` 今日总结 |
| `MyHistory.tsx` | 857 | `/my-history` 姓名查询成绩 |
| `MyHistoryDetail.tsx` | 556 | `/my-history/submission/:id` 逐题解析（= 阅读结果页） |
| `MyVocab.tsx` | 410 | `/my-vocab` 生词本 |
| `MyVocabReview.tsx` | 772 | `/my-vocab/review` 词卡（课程 + 自由练习共用） |
| `MyVocabQuiz.tsx` | 830 | `/my-vocab/quiz` 词测（正式 + 自测共用） |
| `MyMistakes.tsx` | 391 | `/my-mistakes` 错题本 |
| `MyMistakesPractice.tsx` | 382 | `/my-mistakes/practice` 错题重练 |
| `MorningQuizTake.tsx` | 1029 | `/morning-quiz/:sessionId` 阅读答题 |
| `MorningQuizScan.tsx` | 765 | `/scan/:token` 扫码 |
| `PracticeMode.tsx` | 693 | `/practice/:practiceSubmissionId` 重做 |

合计 **13 个文件、7840 行**。

### 1.2 学生路由与外壳（`apps/web/src/App.tsx`）

- 公开白名单分支（`/me`、`/my-lesson*`、`/my-history*`、`/my-vocab*`、
  `/my-mistakes*`）
- JWT 学生角色分支（`/student/*`、`/practice`、`/morning-quiz/:sessionId`）
  及其 `*` 兜底
- 未登录学生流的 `/my-history` 兜底
- `/scan` 查询式改写为 `/scan/:token`

### 1.3 学生端辅助模块（`apps/web/src/lib/`、`components/`）

| 模块 | 作用 |
|---|---|
| `lib/lesson-entry.ts` | PWA 冷启动从 `/my-history` 改道到 `/my-lesson` |
| `lib/registration.ts` | 网站式注册的触发判定 |
| `lib/reviewQueue.ts` | 复习评分的弱网队列 |
| `lib/teacher-view.ts` | 教师以学生视角查看的令牌保管 |
| `lib/auth.ts` 的 `adoptHandoffFromHash` | AirDrop 跨设备接力（`#h=`） |
| `lib/student-token.ts` | 学生令牌读写 |
| `components/RegistrationSheet.tsx` | 注册卡 |
| `components/TeacherViewBanner.tsx` | 只读横幅 |
| `components/InstallAppCard.tsx`、`InstallGuideSheet.tsx` | 扫码时代的安装引导 |
| `components/exam/*` 的学生侧 | 题型渲染、计时、离线徽标 |
| `public/sw.js`、`public/manifest.webmanifest` | PWA |

### 1.4 后端里被前端路由绑住的部分

| 位置 | 冻结理由 |
|---|---|
| `apps/api/src/lesson/next-action.ts` 的 `href` 字段 | 旧端在用；新端忽略它。**整个迁移过程中一行都不改**，到阶段 16e 才删 |
| `apps/api/src/lesson/next-action.spec.ts` 里对 `href` 的断言 | 同上，随字段一起删 |
| `student-identity.guard.ts` 规则 3（无令牌的姓名读放行） | 旧端在用，保留到阶段 16b |

---

## 2. 冻结期间**允许**的改动（三类，仅此三类）

### 2.1 阻断性缺陷（blocker）

学生**做不了今天的课**、**丢答案**、**看不到成绩**这一级的问题。

判据：一个学生今天无法完成七步链，或已经产生的数据被破坏。

### 2.2 安全修复

越权、身份泄露、令牌处理错误、数据可被他人读写。

不必等新端，也不必等观察期 —— 安全修复优先级高于冻结。

### 2.3 兼容适配器（compatibility adapter）

**只出不进**的单向跳转、旧 URL 到新端的翻译、旧 PWA `start_url` 的改道。
这类改动的目的是**把人送走**，不是让旧页面更好用。

---

## 3. 冻结期间**禁止**的改动

- ❌ 新功能、新页面、新入口
- ❌ 交互改良、文案润色、视觉调整
- ❌ 重构（哪怕是「顺手清理一下」）
- ❌ 给旧页面加新的数据来源或新的跳转目标
- ❌ 让某个旧页面变得「更适合当落点」

> 判断方法：如果这个改动的理由是「让旧页面更好」，它就不该做。
> 唯一正当的理由是「不改学生今天就用不了」或「不改会泄露数据」
> 或「为了把人送去新端」。

---

## 4. 三条硬规则

### 规则一：所有新的学生行为归 `apps/student-web`

冻结之后，任何新的学生端行为 —— 新页面、新流程、新的返回语义、
新的身份处理 —— **一律实现在未来的 `apps/student-web` 里**，
不在 `apps/web` 里。

`apps/web` 从这一刻起的角色是：**教师后台 + 旧链接兼容层**。

### 规则二：任何旧页面都不得成为新的 canonical 落点

具体地说，下面这些**不允许**出现在新代码里，也不允许在旧代码里
新增：

- 新端跳到 `/my-history`、`/my-history/submission/:id`、`/my-vocab*`、
  `/my-mistakes*`、`/my-lesson*`、`/me`、`/scan/*`、`/student/*`、
  `/practice/*`、`/morning-quiz/*`
- 把上述任何一个页面作为「完成 / 跳过 / 出错 / 令牌失效」的落点
- 在新端读写 `mq:history:name` / `mq:history:studentId`

这一条由守卫 **G1**（静态扫描）和 **G7**（测试扫描）执行，
见 [student-web-architecture.md §9](./student-web-architecture.md)。

### 规则三：数据操作不与代码改动同一提交

冻结期不含任何数据删除或破坏性迁移。将来若需要，必须单独立项、
单独提交、单独部署，且有回填脚本。理由见
[migration-plan.md 回滚说明](./migration-plan.md)。

---

## 5. 不在冻结范围内

| 范围 | 说明 |
|---|---|
| 教师后台全部页面与路由 | 组卷、题库、判分、班级、排课、看板、家长门户 —— 照常演进 |
| `apps/api` 的业务逻辑 | 阶段 5 的 token-only 改造是**计划内的增量**，不受本冻结约束 |
| `apps/ops-dashboard`、`apps/miniprogram` | 与学生端无关 |
| `/student/homework*`、`/student/tutor` | 暂留旧系统（[D1](./product-decisions.md#d1--homework--ai-tutor-暂留旧系统)），新端不展示、不删除。它们自己的演进不由本清单约束 |
| 数据库与迁移 | 本清单不冻结，也不授权任何破坏性变更 |

---

## 6. 阶段 1 的产出

| 产出 | 位置 |
|---|---|
| 标注标签 | `pre-student-reconstruction-4ad1ead` → `4ad1ead`（仅本地，未推送） |
| 冻结清单 | 本文件 |
| 八账号 staging 夹具 | `apps/api/scripts/staging/seed-eight-test-accounts.js` |

**夹具说明**：原来只存在于会话临时目录，换机器或换会话就没了。现在
纳入版本管理，并加了**四道闸门**：

| # | 闸门 | 在连库之前生效 |
|---|---|---|
| 1 | `NODE_ENV=production` → 无条件拒绝，无覆盖开关 | ✓ |
| 2 | 必须显式 `ALLOW_TEST_SEED=yes` | ✓ |
| 3 | `DATABASE_URL` 必须**显式传给进程** | ✓ |
| 4 | 目标库里有不属于这八个 id 的在读学生 → 拒绝 | 需一次只读查询 |

第 3 道是本轮实测补上的：`require('@prisma/client')` 会顺手加载仓库根
的 `.env`，把 `DATABASE_URL` 悄悄填成**本机开发库**。闸门若在 require
之后才读 `process.env`，「我没给连接串」就会被翻译成「那就用开发库
吧」—— 正是它要防的那类事故。现在环境快照在 require **之前**取，
且 `PrismaClient` 显式传库，不接受 dotenv 回落。

**PIN 不带默认值** —— 必须由 `STAGING_SEED_PIN` 给出，版本库里没有
任何口令值。

**关于「阶段 1 有没有碰过数据库」—— 确切事实**：

阶段 1 **对 staging 与生产数据库零接触**，也**没有执行过本夹具**
（没有任何一次完整播种，没有任何写操作）。

但**发生过一次非计划的只读查询**，必须记下来：

- **时间**：闸门测试期间，环境快照修复**之前**
- **过程**：测试「不传 `DATABASE_URL` 会怎样」时，
  `require('@prisma/client')` 已经从仓库根 `.env` 把
  `DATABASE_URL` 填成了**本机开发库**，于是第 4 道闸门连上并执行了
  一次 `SELECT id, name FROM "User" … LIMIT 5`
- **结果**：查到 5 个非夹具学生，闸门**正确拒绝**并退出
- **写操作**：**零**。第 4 道闸门在所有 `DELETE` / `INSERT` 之前抛出
- **触及范围**：只有本机开发库 `localhost:5432/exam_paper_system`。
  **staging 与生产数据库自始至终没有被连接过**
- **已修复**：环境快照现在在 `require` **之前**取，`PrismaClient`
  也显式传库。同样的命令现在**在连库之前**就被第 3 道闸门拒绝
  （已复测）

这次意外正是第 3 道闸门被加上的原因。

**夹具目前处于「已版本化但不可执行」状态** —— 安全执行环境未定，
见 [migration-plan.md](./migration-plan.md) 阶段 3 / 阶段 14 的前置。

---

## 7. 解冻条件

冻结在**阶段 16d**（删除旧学生页面）时自然结束 —— 那时这些文件
不再存在。

在此之前，冻结**始终有效**，包括：

- 新端上线之后（旧端仍在服务未灰度到的学生）
- 整班切换之后（旧端仍是回滚路径）
- 观察期之内（[D6](./product-decisions.md#d6--整班后观察至少-10-个真实教学日无-p1-才能关旧通道)：≥10 个真实教学日无 P1）
