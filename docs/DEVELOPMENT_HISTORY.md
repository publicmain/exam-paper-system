# 开发历程 · exam-paper-system

> ⚠️ **接手本系统请先读 [`HANDOVER.md`](HANDOVER.md)** —— 那是面向接手人的
> 交接文档（运维 SOP、红线、故障排查、代码地图）。本文档是项目开发过程的
> 记录，内容与 HANDOVER 有重叠，仅在需要追溯"当初为什么这么做"时参考。

> 面向工程读者的项目档案：架构、数据模型、关键子系统的实现取舍、
> 生产事故的根因，以及这些取舍留下的技术债。
>
> 统计截止 **2026-08-14**。所有数字由 git 与源码统计生成，复现命令见
> [附录 A](#附录-a统计口径与复现命令)。

---

## 一、速览

| | |
|---|---|
| 仓库 | `publicmain/exam-paper-system`，npm workspaces monorepo |
| 作者 | publicmain（设计 / 开发 / 运维 / 线上判分） |
| 周期 | 2026-04-27 ~ 2026-08-14，110 天，475 次提交（46 天有提交） |
| 运行状态 | 生产环境每工作日运行，G11 一个班，两个难度层并行 |
| 语言 | TypeScript（strict）、Python 3（PDF worker）、SQL |
| 后端 | NestJS 10 · Prisma 5 · PostgreSQL · Puppeteer 23 · KaTeX |
| 前端 | React 18 · Vite 5 · Tailwind 3 · react-router 6 · zustand 5 |
| 部署 | Railway：API / Web / pdf-worker / ops-dashboard 四个 service + managed Postgres |

### 代码规模

| 目录 | 行数 | 文件 | 说明 |
|---|---:|---:|---|
| `apps/api/src` | 41,713 | 197 | NestJS 后端 |
| `apps/web/src` | 32,150 | 116 | React 前端 |
| `apps/api/scripts` | 5,330 | 38 | 一次性运维 / 回填 / 判分脚本 |
| `apps/api/prisma` | 3,571 | 16 | schema + 18 个 migration + seed |
| `apps/ops-dashboard` | 1,012 | 1 | 只读运维台（独立 service） |
| `services/pdf-worker` | 387 | 1 | FastAPI，PyMuPDF / schemdraw / RDKit |
| `apps/miniprogram` | 297 | 4 | 微信小程序壳 |
| **合计（不含测试）** | **84,460** | **373** | |
| 测试 | 7,076 | 49 | 460 项断言，全绿 |

### 后端结构量化

| 指标 | 值 |
|---|---:|
| NestJS module | 44 |
| controller | 42 |
| service | 71 |
| HTTP 端点 | 282（GET 117 / POST 115 / PATCH 27 / DELETE 16 / PUT 7） |
| Prisma model | 63 |
| `@@index` / `@@unique` | 95 |
| migration | 18 |
| 遗留 TODO / FIXME | 1 |

---

## 二、架构

### 2.1 服务拓扑

```
                    ┌──────────────┐
   学生手机 / iPad ──│  apps/web    │  React SPA + PWA（Vite 构建，静态托管）
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
                    │ PG  │  │ services/pdf-   │  FastAPI
                    │     │  │ worker (Python) │  PyMuPDF 渲染 / OCR
                    └──▲──┘  │                 │  schemdraw 电路
                       │     │                 │  RDKit 化学结构
                 只读   │     └─────────────────┘
                 SELECT │
                    ┌──┴──────────────┐
                    │ ops-dashboard   │  Express + node-pg，独立 service
                    └─────────────────┘  只读 / 无 PII / 不碰主 API
```

**为什么 PDF 处理拆成 Python 服务**：理科题目的图不是贴图，是渲染出来的
——电路走 `schemdraw`、化学结构走 `RDKit`、PDF 页面栅格化走 `PyMuPDF`。
这三个库在 Python 生态里成熟且无可替代，Node 侧没有等价物。拆成独立
service 而非在 Node 里 spawn Python，是因为 Railway 上每个 service 独立
构建镜像，Python 依赖（RDKit 尤其重）不必污染 API 的构建。

代价：跨服务传图只能走 base64 over HTTP —— Railway 的 volume 是 service
私有的，没有共享文件系统。单页大约几百 KB 到几 MB，对内部调用可接受，
`main.py` 顶部的 docstring 里明确记了这个取舍。

**ops-dashboard 为什么独立**：三条硬约束写在 `server.js` 头部 —— 只读
（只跑 SELECT）、只出聚合量（无学生姓名、无个人分数）、不碰主 API。
因为它要暴露在一个可以随手打开的 URL 上，把它和主 API 物理隔离，
误操作和数据泄露的面就都被限制住了。

### 2.2 monorepo 布局

```
apps/api              NestJS 后端
apps/web              React 前端
apps/ops-dashboard    只读运维台
apps/miniprogram      微信小程序
packages/shared-types 前后端共享类型
services/pdf-worker   Python PDF / 图形渲染
```

npm workspaces，根 `package.json` 用 `concurrently` 同时起 API 和 Web。
`packages/shared-types` 刻意保持得很薄 —— Prisma 生成的类型已经覆盖了
大部分数据结构，再往上抽象只会增加耦合。

### 2.3 请求链路上的三层守卫

`app.module.ts` 里全局注册，顺序有意义：

```ts
{ provide: APP_GUARD, useClass: RateLimitGuard },   // 先
{ provide: APP_GUARD, useClass: AuthGuard },        // 后
{ provide: APP_FILTER, useClass: GlobalExceptionFilter },
```

RateLimit 排在 Auth 之前，这样匿名请求打 `/auth/login` 的暴力破解会在
认证之前就被挡掉。顺序反过来的话，`@Public` 路由直接穿过 AuthGuard，
限流形同虚设。

限流器是自己写的进程内固定窗口（`common/rate-limit.guard.ts`），没用
`@nestjs/throttler`。理由写在文件头：单副本部署下进程内计数就够，省一个
运行时依赖和它的 `cache-manager` peer。装饰器签名 `@RateLimit({ limit,
windowSec, scope })` **刻意和 throttler 保持一致**，将来上多副本时换成
throttler + Redis 是机械替换。

---

## 三、数据模型

63 个 model。核心链路是四张表：

```
PaperAssignment ──1:N── StudentSubmission ──1:N── AnswerScript
       │                        │
       │                        └──1:1── Attendance
       └── Paper ──1:N── PaperQuestion
```

### 3.1 快照模式

`PaperQuestion` 存 `snapshotContent` / `snapshotOptions`，而不是外键指向
`Question` 的当前内容。试卷一旦发出去，题目内容必须冻结 —— 题库里的题
会被编辑、会被撤回、会出新版本，而学生三个月后回看自己的答卷，看到的
必须是当时那道题。

同理，`MistakeEntry` 收录错题时冻结题干 / 学生答案 / 评语 / 正确答案
四份快照。`mistake.service.ts` 头部写了原因：卷子可能被改、分数可能被
重判，而错题本必须能长期回看。

**唯一的例外是客观题解析**：2026-08-13 决定把解析写进题库（`Question`），
不冻结进错题本。因为解析会持续迭代（人工补写了 155 条），冻结等于把
所有学生锁在第一版解析上。读取时 join，接受这一次额外查询。

### 3.2 级联删除策略不统一，三种模式各有理由

| 关系 | 策略 | 理由 |
|---|---|---|
| `StudentSubmission.student` | `onDelete: Restrict` | 删学生账号不能把成绩审计链一起删掉 |
| `AnswerScript.submission` | `onDelete: Cascade` | 答卷是提交的一部分，无独立意义 |
| `GradeAppeal.paperQuestion` | `onDelete: SetNull` | 申诉可以针对整张卷（`paperQuestionId` 为 null） |

`Restrict` 那条是踩过才加的 —— schema 注释里标着 `B4`。

### 3.3 索引按实际查询加，不按直觉

95 个索引 / 唯一约束，好几个带着为什么要加的注释：

```prisma
// Round-7 H15 — MorningQuiz schedule reads use
// `WHERE classId = ? AND date >= ?`；unique 是 (date, classId)，
// 对这个过滤条件列序不对，planner 需要 (classId, date)。
@@index([classId, date])
```

```prisma
// Round-7 H17 — MarkerService.listQueue 按 status='submitted'
// 且存在未判 script 过滤。没有 (assignmentId, status) 时
// planner 会回退到 (assignmentId, studentId) 再内存过滤。
@@index([assignmentId, status])
```

### 3.4 一个被唯一约束绊住的设计

`StudentSubmission` 原本有 `@@unique([assignmentId, studentId])`。加练习
模式时发现：学生不能在有正式提交的同时再有一份 `practice` 提交。

Postgres 支持带 `WHERE` 的部分唯一索引，但 Prisma schema 表达不了。
最后的做法是**去掉约束，把非练习提交的唯一性下沉到 service 层**
（`finalSubmit` 和发卷流程都先 `findFirst`），练习提交自由写入，
全局靠 `status != 'practice'` 过滤。

这是一处真实的取舍：用应用层不变量换掉了数据库层保证。代价是每一处
统计查询都必须记得排除 `practice` —— 2026-08-14 判分时漏过一次，
练习提交污染了导出。

---

## 四、关键子系统

### 4.1 扫码考勤：两代 QR token

`apps/api/src/qr/qr.service.ts`

**v1 — 轮转码**（投影仪场景）：

```
v1.<windowStartMs>.<hmac16>.<sessionId>
```

每 `qrRotationSeconds`（默认 15s）一个窗口，HMAC-SHA256 用 session 自己
的 `qrSecret` 签 `${sessionId}.${windowStart}`，取前 16 位十六进制。
校验用 `timingSafeEqual`，先比长度再比内容。

容差 `TOLERANCE_MS = 60_000`，是从 30s 调上来的。文件里记了原因：
学生从「举起手机」到「扫码 API 被调用」的真实延迟在忙碌的早晨常常
30–60 秒 —— 抬手、对焦、点开页面、输名字、选难度。原来 30s 容差 + 15s
窗口 = 45s 总接受窗口，正在误杀合法扫码，学生那头看到的是「二维码失效」。
现在 60 + 15 = 75s，仍然紧到能拒掉昨天截屏的码。

**v2 — 静态码**（贴墙场景）：

```
v2.<classId>.<hmac16>              三段，原始码
v2.<classId>.<variant>.<hmac16>    四段，带标签的分身码
```

不含时间戳、不含 session secret，只签 classId，所以可以提前几个月生成、
印一次、贴墙上，不用每天架笔记本和投影仪。签名用 `JWT_SECRET`，输入做了
域分隔（`qr-static.v2.<classId>`）以免和真的 JWT 撞上。

这里签名的作用被明确降级了 —— 注释写着：classId 本身不是秘密（它就印在
公开的墙上），HMAC 只是让 `verify` 能快速拒掉手打的垃圾 token。真正的
考勤完整性靠下游没变的几道闸门：时间窗、名单校验、设备去重、现场监考。

代价也写清楚了：`JWT_SECRET` 一旦轮换，所有印出去的 v2 码全部失效，
必须重印。可接受 —— 密钥轮换很罕见且动静很大。

**分身码（variant）是个诱捕机制**：贴墙码固定不变，学生完全可以拍成
照片带回家扫。做法是同一个班同时签发多张**都能用**的码，各带一个标签；
换墙上那张时不通知学生。当天扫到旧标签的，用的必然是之前拍的照片。
两张码扫起来体验完全一样，后台能分辨。

```ts
export function normaliseVariant(v?: string | null): string | undefined {
  const s = (v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (s === ORIGINAL_VARIANT) return undefined;   // 'original' 是旧码保留名
  return /^[a-z0-9-]{1,16}$/.test(s) ? s : undefined;   // 带点会破坏分段解析
}
```

`verify` 同时接受三段和四段，返回值多一个 `qrVariant` 字段，
`ORIGINAL_VARIANT` 代表未带标签的旧码。

注释里也标了这个机制的**有效期**：这是一次性证据 —— 换码当天有效，
之后新码同样会被拍照传播，需要定期换标签。

### 4.2 扫码的五道闸门

`attendance.service.ts::scanQr`

1. **QR 校验** —— HMAC + 新鲜度（v1）或签名（v2）
2. **session 状态** —— 必须 `active`
3. **名单** —— 输入的姓名要能解析到该班在册（`isActive`）的学生
4. **时间窗** —— `on_time` / `late` / `absent` / 补考
5. **设备去重** —— 同一 `deviceUuid` 在同一 session 里不能签两个人

`deviceUuid` 是设备首次访问时 localStorage 生成的 UUID，之后每次扫码
带上。防的是「一台手机代签 30 个人」。冲突时硬拒并返回冲突学生姓名；
合法边界情况（B 手机没电借了 A 的）走人工更正流程。`userAgent` 也存，
但只用于取证，不参与判定。

**重扫不覆盖已有状态**。这是修出来的：学生 08:31:54 扫码（on_time），
页面刷新或退回去，08:36:01 又扫一次 —— 原来的 upsert 无条件写
`scanTime = now` 并用 `now` 重算状态，于是第二次扫码把记录从 on_time
翻成了 late。2026-05-14 有真实学生因此被记迟到。

```ts
const existing = await this.prisma.attendance.findUnique({ ... });
const isAlreadyPresent = !!existing &&
  (existing.status === AttendanceStatus.on_time ||
   existing.status === AttendanceStatus.late);
// 已 present 的行：只刷新指纹元数据，保留 scanTime 和 status
// absent 的行（lock cron 提前种下的）：允许用 now 提升
```

### 4.3 补考：为什么另开一对时间窗

学校 2026-08 新政：早上无故缺席 → 中午补考。

第一次补考（2026-08-13）没有这个功能，只能用 `debug-activate` 把正式
时间窗整个挪到 13:21。后果是早上的真实时间和缺席记录一起没了，三名
补考学生还被记成「准时出勤」。

修法是在 `MorningQuizSession` 上加一对独立字段，正式窗口永远不动：

```prisma
makeupStart      DateTime?
makeupEnd        DateTime?
makeupOpenedById String?
```

Gate 5 多一个分支：

```ts
} else if (isMakeupWindowOpen(session, now)) {
  attendanceStatus = AttendanceStatus.absent;   // 照旧记缺席
  isMakeupScan = true;                          // 只额外盖一个 makeupAt
}
```

出勤状态保持 `absent` 是有意的 —— 早上确实没来是既成事实，同步 Seiue
要照实报；补考补回的是学业内容，不是出勤。面板据 `makeupAt` 显示
「缺席 · 已补考」。

连带要改 lock cron，否则中午一开补考，每分钟跑的 cron 立刻把它锁掉
（`quizEnd` 早上 9 点就过了），补考窗口活不过一分钟：

```ts
OR: [{ makeupEnd: null }, { makeupEnd: { lt: now } }],
```

### 4.4 防作弊：确定性打乱

`apps/api/src/shuffle/shuffle.service.ts`

每个 (学生, 试卷) 对生成一份持久化的置换表，存进 `QuestionShuffleMap`：

```ts
const seedHex = createHash('sha256')
  .update(`${studentId}.${paperId}`)
  .digest('hex').slice(0, 16);
const rng = mulberry32(seedFromHex(seedHex));
const questionOrder = fisherYates(indices, rng);
```

Mulberry32（32 位状态的小型确定性 PRNG）+ Fisher-Yates。用确定性 PRNG
而不是 `Math.random()`，是为了 seed 可复现 —— 排查「学生说他看到的题跟
别人不一样」时能重放出他当时看到的顺序。

选项置换按 `paperQuestionId` 建键，而不是 questionId：

```ts
// Key by paperQuestionId so the answer-grading path can resolve directly
// off AnswerScript.paperQuestionId without a join back to Question.
optionOrders[pq.id] = fisherYates(ids, rng);
```

判分时 `unmapOptionIndex` 把学生看到的下标反解回原始下标，
既有判分逻辑不用知道打乱这回事。

**缓存失效处理**：试卷被编辑（加题 / 删题）后，缓存的 `questionOrder`
长度就对不上了，`applyToPaper` 会抛长度不匹配；MCQ 的 `optionOrders`
缺键则会静默跳过打乱。所以 `getOrCreate` 每次都校验缓存是否仍然有效
（题数一致、每个 MCQ 的选项数一致），无效就删掉重新生成 —— 宁可重算，
不能给学生发一个错位的半截置换。

### 4.5 判分流水线：三段式 lockOne

`morning-quiz.cron.ts`

cron 每分钟跑，管两个状态转移：

- `attendanceStart` 前 5 分钟 → `scheduled` 翻 `active`
- `quizEnd` 到点 → `active` 翻 `locked`，强制交卷 + 补缺席行

**预激活为什么是 5 分钟而不是 30 秒**：cron 只在整分钟跳。原来 30s 缓冲
在 08:29:00 那一跳，`upper = 08:29:30 < attendanceStart = 08:30:00`，
不激活；真正激活要等 08:30:00 那一跳，等于窗口在 08:30:00 整点才开。
08:29:5x 扫码的学生（手机相机 + Chrome 冷启动延迟）看到「考勤窗口尚未
开启」然后慌了，改用微信扫又成了 —— 这是 2026-05-28 的真实报障。改成
5 分钟后，08:25:00 那一跳就激活。Gate 5 仍然挡住提前提交，所以只是名单
查询提前可用，不会多录一条考勤。

**lockOne 拆成三段，中间不持有事务**：

```
Phase 1  一个小而快的事务：session → locked，in_progress → submitted
         （autoScore=0 占位），补缺席行，统计 claim 率
Phase 2  事务外加载每份提交的 scripts
Phase 3  逐份提交：判分（慢），然后一个极小的写事务；单份失败只记日志不影响其余
```

拆开的原因是 Prisma 交互式事务默认 5 秒超时。30 个学生 × 10 道短答，
判分调用轻易超时，整个 lock 回滚，session 卡在 `active` 状态过了
`quizEnd` 还没锁。

**幂等守卫**（2026-08-13 事故后加），两层：

```ts
// 提交级：已定稿的卷子不重判
const allSubs = await this.prisma.studentSubmission.findMany({
  where: { assignmentId, status: { notIn: ['practice', 'marked'] } },
});
// script 级：markedById 有值的绝不覆盖
const already = await tx.answerScript.findUnique({
  where: { id: u.id }, select: { markedById: true },
});
if (already?.markedById) continue;
```

### 4.6 多难度层带来的组合问题

一个班一天可以跑多个难度层（`ClassEnglishLevel` 是 1:N）。学生扫码时
只选一个层，于是产生了两个 bug：

**缺席行爆炸**：47 人的班 × 3 个层 = 每天 141 条考勤行，其中 94 条是
另外两个层的假缺席。修法是只有当天**第一个锁定的** session 插缺席行，
后锁的兄弟 session 看到已有兄弟 `locked` 就跳过；再叠一层 —— 今天在该班
任意 session 有非缺席记录的学生，一律不插。

**全员缺席误报**：`mass_absence` 告警（本来是防投影仪坏了）在兄弟层上
每天早上都误触发，因为那两个层 `claimedCount = 0`。修法是把统计口径
从「本 session」改成「整个班这一天」—— 只有全班今天在哪儿都没扫，
才是真的出事了。阈值：名单 ≥ 5 人且 ≥ 90% 没扫。

还有一层纵深防御：周末的 session 不插缺席行。2026-05-10 是周日，有一场
session 漏过了创建时的边界检查，全班被记了一次缺席。

### 4.7 间隔重复：FSRS 及其一个陷阱

`apps/api/src/vocab/vocab-review.service.ts`，用 `ts-fsrs`（MIT，纯本地
计算，不涉及任何 API 调用）。

选 FSRS 而不是 SM-2：FSRS 基于约 7 亿次真实复习数据训练，同等记忆留存下
比 SM-2 少 20–30% 的复习量。本场景每天只能挤出 2–3 分钟（复习寄生在
交卷后的既有流程里），这 20–30% 是决定性的。

**踩到的坑值得单独说**：

```ts
const PARAMS = generatorParameters({
  enable_fuzz: false,
  learning_steps: [],      // ← 取消日内学习步进
  relearning_steps: [],
});
```

FSRS 默认 `learning_steps = ['1m','10m']`，卡片要连续答对两次才毕业到
Review 态，而「现在处于第几步」记在 `Card.learning_steps` 上。我们把调度
状态**拆成列**存在 `StudentWord` 里（stability / difficulty / reps /
lapses / elapsedDays / scheduledDays…），**唯独没有这一列**，还原 Card 时
只能填 0 —— 于是每次复习都把卡片重置回第一步，永远毕业不了，间隔恒为
0 天，间隔重复完全失效。实测连续答对 6 次仍是 0 天。

去掉日内步进后，第一次答对即进入 Review 态，间隔按天走：
**2 → 11 → 46 → 163 → 497 天**。

顺带一提，学生看到的 `state` 标签（learning / review / known）**不参与
调度**，纯粹按下次间隔长短分档：< 7 天叫「还在学」，≥ 60 天叫「已掌握」
（`due` 查询跳过它）。调度完全由 FSRS 的 stability / difficulty 决定。
FSRS 有 New/Learning/Review/Relearning 四态，我们没有 Relearning，
落库时归为 learning；`known` 送进 FSRS 时按 Review 处理。

每日上限默认 5 个，硬编码上界 20。理由写在方法注释里：复习是插在交卷后
的，学生已经答了 30 分钟题，给 20 个词只会让他直接跳过。

### 4.8 错题本：收录规则是纯函数

`apps/api/src/vocab/mistake.service.ts`

第一设计目标是**短**。全班每天约 34 份卷、每份 13–19 题，全收一周上千条；
生词本已经验证过这条路走不通 —— 80 条到期未复习积压着没人动。

四条规则，实现成一个可测的纯函数：

```ts
export function shouldCollect(s, repeatCount): MistakeReasonKey | null {
  if (s.awarded >= s.maxMarks) return null;          // 满分不收
  if (!s.studentAnswer.trim()) return null;          // 规则1：空白不收
  if (extractVocabWord(s.stem)) return 'vocabulary'; // 规则3：词义题
  if (s.maxMarks >= 2) return 'long_answer';         // 规则4：长答题
  if (repeatCount + 1 >= REPEAT_THRESHOLD) return 'repeated_tasktype';
  return null;
}
```

**规则 1（空白不收）是最重要的一条**。上线两周的数据：准时到的学生空白率
26.5%，迟到 20 分钟以上的高达 95.6%。空白是行为问题不是知识问题 —— 学生
不是「不会」，是「没写」。把空白塞进错题本，等于用一堆「你没写」淹掉真正
值得复盘的那几道。空白率有它自己的指标盯着（技能画像、周报）。

**阈值 `REPEAT_THRESHOLD = 2` 是刻意定低的**：一周只有 4 场早测，每场
每题型 3–4 道，阈值定高了整学期都触发不了。

**销账规则**是 FSRS 的极简版：

```ts
export function nextPracticeState(prev, correct, now) {
  if (!correct) return { correctStreak: 0, resolved: false };
  const today = sgtDayOf(now);
  const lastDay = prev.lastPracticedAt ? sgtDayOf(prev.lastPracticedAt) : null;
  let streak = prev.correctStreak;
  if (streak <= 0) streak = 1;
  else if (lastDay !== today) streak += 1;   // 同一天不叠加
  return { correctStreak: streak, resolved: streak >= 2 };
}
```

做对一次 streak 升 1，**隔天**再做对才升到 2 并自动销账。同一天内反复
做对不叠加 —— 刚看完答案马上重做是短时记忆，不算掌握。错题量级小
（人均几十条），两点确认足够，不需要完整的记忆曲线调度。

「隔天」必须按新加坡自然日判定：

```ts
export function sgtDayOf(d: Date): string {
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
```

练习的作答方式由题型推导，不是配置出来的：

```ts
export function practiceKindOf(taskType, passage) {
  if (taskType === 'true_false_not_given')
    return { kind: 'tfng', options: ['TRUE', 'FALSE', 'NOT GIVEN'] };
  if (taskType === 'yes_no_not_given')
    return { kind: 'tfng', options: ['YES', 'NO', 'NOT GIVEN'] };
  if (taskType === 'matching_information') {
    // 从原文里抠出实际存在的段落字母，而不是假定 A–G
    const letters = [...new Set(
      [...passage.matchAll(/Paragraph\s+([A-Z])\b/g)].map((m) => m[1]))];
    if (letters.length >= 3) return { kind: 'letters', options: letters.sort() };
  }
  return { kind: 'reveal', options: [] };   // 主观题：Anki 式翻卡自评
}
```

`matching_headings` 刻意不走 letters 分支 —— 它的答案是标题编号（i–x），
跟段落字母不是一套体系。

### 4.9 前端：题型渲染注册表

`apps/web/src/components/exam/QuestionTypeRegistry.tsx`

六种题型组件（IELTS Reading passage、O-Level 的 Comprehension / Cloze /
VocabInContext / SentenceTransformation / McqList），由 `pickRenderer`
按**数据**而非 `level` 字段分派：

1. `paperMode === 'passage_pick'` 或首题 `taskType` 属于 IELTS 家族
   （`matching_*` / `*_completion` / `true_false_not_given` …）→ IELTS 壳
2. 首题 `snapshotContent.uiKind` 为 `cloze` / `vocab` / `transformation`
   → 对应 O-Level 壳
3. 有 passage 但没有 IELTS taskType → Comprehension
4. 兜底 → McqList

注释里写明了意图：一切由题目数据驱动，registry 保持 level-agnostic，
`level` 只是提示不是判据。加一种新题型 = 这里一个 case 加一个组件文件。

还有一张空卷兜底卡 —— schema 并不严格禁止零题的 paper（管理员改到一半、
AI 生成半失败、清理竞态），而早期渲染器直接索引 `questions[0]`。

考试外壳的共享件在 `components/exam/shared/`：计时器、题号导航、
可拖拽分栏、字号调节、荧光笔、便签、离线徽章、行内填空输入。

### 4.10 出卷 PDF

`pdf.service.ts` 持有一个常驻的 Puppeteer `Browser` 实例（`browserPromise`
懒加载，`OnModuleDestroy` 时关闭），把 HTML 模板渲染成 PDF。数学公式走
KaTeX **服务端**渲染成 HTML，不依赖浏览器里的 JS。

学科图表分两路：能用 SVG 直接画的（几何、受力、波形、能级、光路）在
Node 侧生成（`ai/svg-diagram.service.ts`，1167 行）；需要专业库的
（电路 schemdraw、化学结构 RDKit）走 pdf-worker。

pdf-worker 的所有端点（除 `/health`）都要 `X-Internal-Token`。原本
`/render_circuit` 和 `/render_molecule` 是开放的，而 pdf-worker 在 Railway
上默认有公网 URL —— 任何人都可以用复杂 SMILES 或 30 元件电路把它打挂。

---

## 五、原创设计与经验

这一节记录**别处抄不来**的部分：从真实课堂数据里长出来的判断，
以及把无解的问题转成可检测问题的几个做法。功能清单读代码就有，
这一节是读代码读不出来的。

### 5.1 把无解的弱点，转成可检测的信号

**贴墙码分身** —— `qr/qr.service.ts`

贴墙的静态二维码有个根本性弱点：它固定不变，学生完全可以拍成照片带回家扫，
服务端无从分辨人是否真的站在墙前。这个问题**没有正面解法**——码必须固定
（否则就得每天架投影仪），固定就必然可被复制。

做法是不解决它，而是把它变成一个诱捕装置：同一个班**同时签发多张都能用的码**，
每张带一个标签；换墙上那张时不通知学生。两张码扫起来体验一模一样，
学生察觉不到任何异样，但后台记录下了扫的是哪一张。

```
v2.<classId>.<hmac16>              旧码 → qrVariant = 'original'
v2.<classId>.w35.<hmac16>          新码 → qrVariant = 'w35'
```

换码当天，扫到旧标签的人手里拿的必然是之前拍的照片。

诚实地说清代价：这是**一次性证据**。换码当天有效，之后新码同样会被拍照
传播，需要定期换标签才能维持有效性。忘了换，这个机制就退化成零。
这句话写在了 schema 的字段注释里，不是留在某个人的记忆里。

**逐份水印** —— `watermark/watermark.service.ts`

老师给某个学生单独打印试卷时，那一份要能追溯到人。做法不是重新生成 PDF，
而是复用既有的 `exportPaper` 再用 pdf-lib 叠一层水印——出卷管线一个字不动。

token 用 **Crockford base32**（去掉了 I / L / O / U，避免和 1 / 0 / V 混淆），
5 字节随机数正好 8 个字符，约 40 bit 熵。为什么是这个编码：如果泄露的是
一张**扫描件或照片**，追查时要靠人肉抄那串字符，字形歧义会直接毁掉整条线索。
40 bit 对一所学校的学生规模绰绰有余，而 8 个字符是人愿意手抄的长度。

`(paperId, studentId)` 唯一索引保证同一对学生和试卷永远解析到同一个 token，
所以昨天发的和今天补发的指向同一条取证链。

### 5.2 数据先说话，再决定改什么

**超时不是终点，是存档点** —— `components/exam/TimeUpMakeup.tsx`

早测 8:30–9:00 固定收卷。按到场时间分组看真实数据：

| 到场 | 样本 | 平均得分率 | 空白率 |
|---|---:|---:|---:|
| 0–10 分钟 | 158 | 52.3% | 26.5% |
| 11–20 分钟 | 31 | 24.8% | 56.7% |
| 21 分钟后 | 14 | 1.7% | **95.6%** |

迟到二十分钟以上的学生几乎整张卷子空着。**不是不会做，是算出来「反正做不完」
之后直接不做了**——这是动机问题，不是能力问题。

老师的原始诉求是「时间到了让学生继续答」。没有直接照做，三个理由写在组件
头部：

1. 这是雅思班，**限时阅读本身就是要练的能力**，取消计时等于取消训练；
2. 9:00 之后是正课，物理上不可能让学生答到 9:20；
3. 统一的正式作答窗口是**成绩可比的前提**——每人时长不同，分数之间就没法
   横向比较，周报和技能画像都会失真。

最终方案：保留 9:00 硬性收卷（正式成绩定格），但把终点改成**存档点**。
交卷后立刻告诉学生「你还有 N 题没做完，现在做完仍然算数」，一键进入补做
（复用既有的 practice 机制，服务端照常判分、进历史、错题照常被收录）。
补做不计入正式分——公平性不受影响，但「做完」重新变得有意义。

**空白率被提拔成一级指标** —— `morning-quiz/skill-profile.service.ts`

每道题都存了 `taskType`，但系统从来没按它聚合过——学生只看到一个总分，
老师也不知道该重讲哪一类题。2026-08-11 对全历史作答做了一次诊断：

| 题型族 | 得分率 | 空白率 |
|---|---:|---:|
| 选择型（TFNG / 段落匹配 / 多选） | 58–67% | 6–12% |
| 打字型（句子填空 / 流程图 / 图表） | 28–53% | 36–51% |
| O-Level 短答（全卷都要打字） | 19% | **64%** |

同一批学生、同一份卷子、同一篇文章，**差别只在作答方式**。

结论是：空白率必须和得分率**并列**成为一级指标。只看得分率会把「不会做」
和「懒得打字」混为一谈，而这两者的教学干预完全不同——前者要重讲，
后者要改作答习惯。代码里因此显式维护了一个 `TYPED` 集合标记哪些题型
需要打字。

同一个洞察的另一面是错题本的**第一条收录规则：空白不收**。空白是行为问题
不是知识问题，塞进错题本等于用一堆「你没写」淹掉真正值得复盘的那几道。

### 5.3 零 AI 约束下的本地智能

铁律是零 Anthropic 调用。这个约束反而逼出了几个更好的设计——因为不能
「扔给模型」，就必须真的想清楚规则是什么。

**同义词干扰项的 bigram 启发式** —— `vocab/vocab-quiz.service.ts`

生词自测要出选择题，干扰项不能是正确答案的同义词（否则题目无解）。
判断两个中文释义是不是近义，正常思路是上词向量或调模型。这里用了一个
极便宜的启发式：

> 候选词释义与正确答案释义若**共享任何两个连续汉字（bigram）**，就弃用。

「干涉 / 干扰」「松开 / 松散」这类近义碰撞几乎都逃不过这一关。误杀
（碰巧同字不同义）无所谓——候选池够大。零依赖、零延迟、可单测。

干扰项优先从**该学生自己的其他生词**里取：难度天然同档，还白赚一次曝光。
不够再从词典补，且限考纲词 + 高频段，避免抽到生僻词一眼看穿。

**原句填空题型** —— 同一文件

三种自测题型里，`cloze`（挖空学生**自己读过的那句原话**）是优先出的。
理由写在注释里：这是本产品独有的资产，百词斩类应用给不了原句语境。
`StudentWord.contextSentence` 从加词那一刻就存下来了，就是为了这个。

顺带说清楚了为什么在自评式复习之外还要做客观自测：

> **最需要背单词的学生恰恰是最会骗自己的**，连点四下「记得」只要两秒钟。
> 客观选择题把判断权从学生手里拿回来：选错就是选错，FSRS 收到的是真实
> 信号，调度才准。

**从原文正则抠出段落字母** —— `vocab/mistake.service.ts`

段落匹配题练习时要给选项。不是硬编码 A–G，而是从冻结的原文里正则抠出
实际存在的段落标记：

```ts
const letters = [...new Set(
  [...passage.matchAll(/Paragraph\s+([A-Z])\b/g)].map((m) => m[1]))];
if (letters.length >= 3) return { kind: 'letters', options: letters.sort() };
```

`matching_headings` 刻意**不**走这个分支——它的答案是标题编号（i–x），
跟段落字母不是一套体系。看起来相似的两种题型，判据完全不同。

### 5.4 公平性：让「撤回」和「取消」永远赢

**撤题即全班给分** —— `student.service.ts::applyRetractionCredits`

一道题事后被发现答案键有错（真实发生过：某道 TFNG 的标准答案与原文矛盾），
撤回后要给全班补分。麻烦在于**任何一次重判都会把补的分冲掉**——而重判
在这个系统里有好几条路径（cron 锁场次、老师手动重判、脚本回填）。

做法是不在某一条路径上打补丁，而是把撤题补分做成**所有判分结果的最后一道
后处理**：

```ts
const { autoScore, scriptUpdates } =
  await applyRetractionCredits(this.prisma, sub.scripts, rawGrade);
```

`finalSubmit` 和 lock cron 都调它，它无条件把 `awardAllStudents` 的撤题
覆写成满分。**撤回永远赢过重判**——这个不变量不依赖调用方记得处理。

**停考释放题目回池**

2026-05-19 校园网故障，早测取消。取消的场次占用了一篇文章，如果不处理，
这篇文章就永久退出候选池了——学生从没见过它，却再也抽不到。

所以候选池查询显式排除了 cancelled 的场次：

```prisma
OR: [
  { morningQuizSession: null },
  { morningQuizSession: { status: { not: 'cancelled' } } },
]
```

同理，Paper 行被删除（强制重新生成）时，它的 `paperKey` 静默回到池子里。

**去版本号去重** —— `morning-quiz.service.ts::storyKey`

铁律是「一个班永远不重复做同一篇文章」。文章按 `paperKey` 去重，但内容
治理时会把 fixture 从 `_v1` 重新校准成 `_v2`——于是同一篇文章换了个 key，
**悄悄重新变得可抽**。真实后果：某个班第二周撞上 5/12 的重复率。

```ts
export function storyKey(key: string): string {
  return key.replace(/_v\d+/g, '');   // 终身去重按「故事」而非按 key
}
```

这个 bug 的性质值得记一笔：它不是代码写错了，是**两个都正确的机制
（版本化 + 去重）在交界处失配**。这类问题测不出来，只能靠事后核对
全历史重复率发现——所以现在每周生成后有一道全历史重复检查。

### 5.5 克制：少收数据、少留后门

**埋点只记三件事** —— `vocab/page-view.service.ts`

老师问「到底有多少人真的打开过自己的成绩 / 错题 / 生词本」。做法是只记
**谁、哪类页面、哪天**——不记 IP、不记 User-Agent、不记停留时长、
不记点击轨迹。

> 这是给老师看班级参与度的教学指标，不是行为画像 —— 学生是未成年人，
> 能少收就少收。

同一学生同一天重复打开同类页面只累加 `hits` 不新增行，表的增长上限是
33 人 × 5 类 = 165 行/天，一学期两万行封顶。

还有一处细节：刻意把「打开成绩列表」和「点进逐题详情」分成两个指标。
因为交卷后系统会**自动跳转**到成绩页，那不是主动查看；真正说明「他在
复盘」的是点进某一场的逐题详情，那一步必须手动点。两个数一起看才知道
多少人来了、其中多少人真的往里走了。

**发现一个只靠「没钱」挡着的后门**

铁律是零 Anthropic 调用。但代码审查时发现：判分路径无条件把 evaluator
传下去，`ShortAnswerEvaluatorService` 只要 `ANTHROPIC_API_KEY` 不是占位值
就会建出真实 client——**线上这个 key 是真的**。

也就是说每个考试日 09:00 都在对每份提交发真实请求，挡住它的**只是账户
余额是空的，不是任何开关**。一旦充值就会静默开始自动判分，没有任何日志
会提示这件事发生了。

这类"隐性开启"是最危险的一种缺陷：它不报错、不告警，只是安静地做了你
以为不会做的事。修法是收敛成一个显式开关并默认关闭，
`MORNING_QUIZ_AI_GRADING=on` 才启用。

**窄权 handoff token**

学生用手机扫码，但想换到 MacBook 上答题（AirDrop 题目 URL）。签一个
`scope='mq_handoff'` + `mqs=<sessionId>` 的 token，AuthGuard 在**除了**
`@AllowHandoff` 装饰的路由之外的所有路由上拒绝它，并且只在路由的 session id
与 `mqs` 匹配时放行。

一个泄露的 handoff 链接只能碰那一场考试，别的什么都碰不到。

### 5.6 用 git 做教学审计

`grade:` 是这个仓库独有的一类提交前缀。每天人工判分之后，**判分脚本和
判分结果一起提交**：

```
grade(morning-quiz): 2026-08-06 人工判分 51 项
grade(morning-quiz): 2026-08-07 人工判分 30 项（本周收官）
```

这不是记流水账。它带来三件事：

1. **可追溯**——三个月后学生质疑某次给分，能翻出当时依据的原始脚本；
2. **可重放**——判分脚本是幂等的，数据库出问题时能重跑；
3. **可核对**——08-13 那次 43 条判分被冲掉，正是靠对比 `grade:` 提交里的
   分数和数据库当前值，才在半小时内定位并还原的。

副作用是提交历史里 `fix` 多于 `feat`，看起来"不好看"。但这份历史的作用
是让人能回答"当时到底判了什么"，不是给人看的简历。

---

## 六、横切关注点

### 6.1 三种 token

`common/auth.guard.ts`

| token | 用途 | 约束 |
|---|---|---|
| 普通 JWT | 老师 / 管理员 / 学生登录 | `expiresIn` 默认 7d |
| scan token | 扫码成功后签发，让前端能调 take / answer / submit | `role='student'`，短时效 |
| handoff token | 从扫码的手机换到第二台设备答题（AirDrop 题目 URL 到 MacBook） | `scope='mq_handoff'` + `mqs=<sessionId>` |

handoff token 是刻意做窄的凭证：它是一个合法的学生 JWT（能过 verify），
但 AuthGuard 在**除了** `@AllowHandoff` 装饰的路由之外的所有路由上拒绝它，
并且只在路由的 session id 与 `mqs` 匹配时放行。所以一个泄露的 handoff
链接只能碰那一场考试，别的什么都碰不到。

### 6.2 判分开关

铁律是零 Anthropic 调用（出题 / 审核 / 判分全部人工在 chat 里做）。
但代码里原本无条件把 evaluator 传下去，`ShortAnswerEvaluatorService`
只要 `ANTHROPIC_API_KEY` 不是占位值就会建出真实 client —— 线上这个 key
是真的。也就是说每个考试日 09:00 都会对每份含长参考答案短答的提交发
一次真实请求，挡住它的**只是额度是空的，不是任何开关**。一旦充值就会
静默开始自动判分。

现在收敛成一个显式开关，默认关：

```ts
const aiGradingOn = process.env.MORNING_QUIZ_AI_GRADING === 'on';
const rawGrade = aiGradingOn
  ? await autoGradeScripts(sub.scripts, this.evaluator)
  : await autoGradeScripts(sub.scripts, undefined, { deferAi: true });
```

`deferAi` 路径下 MCQ 照常即时判，短答一律 park 进人工队列。人工判分走
`/api/marker/*`：`GET queue` → `POST claim` → 逐条 `PATCH scripts/:id`
→ `POST finalize/:submissionId`，finalize 之后提交状态变 `marked`，
就被 §4.5 的幂等守卫保护住了。

`autoGradeScripts` 的返回契约里，`autoCorrect: null` 表示「AI 失败 /
无结论 / 被 defer」→ 进人工队列，与 `false`（判定为错）区分开。

### 6.3 时区

`quizStart` / `quizEnd` / `attendanceStart` 是 `timestamp without time zone`，
存的是 UTC 挂钟时间（00:30 = 08:30 SGT）。**所有跨日计算必须在 SQL 里做，
不能在 JS 里做** —— 这是踩过好几次的地方。`sgtDayOf`（API）和 ops-dashboard
的 `sgtToday()` 都是为此存在的辅助函数。

QR 的 `resolveTodaySession` 也依赖这个约定：静态码只带 classId，
扫码时按「当前 UTC 日历日」定位当天的 session，因为考勤窗口 08:30 SGT
== 同一日期的 00:30 UTC。

---

## 七、测试

49 个测试文件，460 项断言，7,076 行，vitest。

| | 文件 | 断言 |
|---|---:|---:|
| 后端（`*.spec.ts`） | 31 | 348 |
| 前端（`*.test.tsx`） | 18 | 112 |

测试集中在**纯函数和边界判定**，而不是端到端：`shouldCollect`、
`nextPracticeState`、`practiceKindOf`、`gradeMcq`、`hasWrittenAnswer`、
`cleanMarkerComment`、`normaliseVariant`、rate-limit 窗口、
auth guard 的 handoff 约束、试卷结构校验器、补考窗口判定。

这是刻意的：这个系统里最容易出错、后果最重的地方是判定逻辑
（这道题该不该收、这次扫码算不算迟到、这条评语该不该显示给学生），
而不是 HTTP 管道。所以关键判定一律抽成可导出的纯函数。

测试文件本身带着事故背景。`MyHistoryDetailPending.test.tsx` 头部：

> 坑在于：**没作答的题在数据库里根本没有答题记录行**，接口是拿试卷
> 题目补出来的，`awardedMarks` 因此是 null —— 和「写了但还没判」完全
> 一样。原来只看 `awardedMarks`，于是每一道留空的简答题都被显示成
> 「⏳ 待老师批改」…… 这个班空白率 26%–95%，等于绝大多数复盘页永久
> 挂着一条假提示，学生会一直等一个永远不会来的分数。

---

## 八、时间线

| 阶段 | 时间 | 天数 | 提交 | feat | fix | 主题 |
|---|---|---:|---:|---:|---:|---|
| **P1** 试卷生成 MVP | 04-27 ~ 05-06 | 10 | 83 | 34 | 46 | 题库、抽题、PDF、学科图表渲染 |
| **P2** 早测系统 | 05-07 ~ 06-04 | 29 | 268 | 108 | 103 | 扫码考勤、在线答题、判分、运维硬化 |
| 需求沉淀 | 06-05 ~ 07-12 | 38 | 0 | — | — | 学期末 / 假期；系统在线运行 |
| **P3** 作业系统 v2 | 07-13 ~ 08-02 | 21 | 59 | 31 | 19 | 收发闭环、Apple Pencil 批改、rubric |
| 日常运维 | 08-03 ~ 08-09 | 7 | 5 | 0 | 1 | 每日人工判分（`grade:` 提交） |
| **P4** 学生自助闭环 | 08-10 ~ 08-14 | 5 | 60 | 19 | 28 | 生词本、错题本、PWA、补考、分身码 |

提交类型：`fix` 197 · `feat` 192 · `docs` 27 · `chore` 14 · `grade` 10 ·
其他 35。**fix 多于 feat**，对一个每天在真实课堂运行的系统是正常形态。

`grade:` 是一类专属前缀 —— 每天人工判分后把判分脚本和结果一起提交，
既是审计留痕也是可回溯的判分依据。08-03 ~ 08-09 那一周只有这类提交，
是纯运维周：没有功能开发，但系统每天在跑。

06-05 ~ 07-12 是真正的零提交期（38 天，学期末 + 假期）。P3 的产品形态
（对标 Canvas SpeedGrader 与 Examplify）是在这段时间定下来的。

### 关键技术决策

| 日期 | 决策 | 原因 |
|---|---|---|
| 05-21 | 取消早测的校园网 IP 白名单 | 学生用移动数据时被误挡 |
| 05-22 | 引入 v2 静态贴墙码 | 免去每天架笔记本 / 投影仪；接受「可被拍照」的已知弱点 |
| 05-28 | PWA 而非原生 App | 无需应用商店与 ICP 备案 |
| 05-28 | 扫码容差 30s → 60s | 真实抬手到调用的延迟是 30–60s，原值在误杀合法扫码 |
| 06-02 | 抽出 `AsyncState` UI 原语 | 统一加载 / 错误 / 重试形态 |
| 07-27 | 停用 `ielts_simplified` 难度层 | 内容质量不达标，三层收敛为两层 |
| 08-12 | FSRS 取消日内学习步进 | 调度状态拆列存储缺 `learning_steps`，卡片永远毕业不了 |
| 08-13 | 补考另开时间窗，不改正式窗口 | 见事故 #4 |
| 08-13 | 客观题解析写进题库，不冻结进错题本 | 解析会迭代，冻结会锁死旧版本 |
| 2026-08 | 零 Anthropic 调用收敛成显式开关 | 额度耗尽；且原实现只靠「额度是空的」挡着，充值即静默启用 |

---

## 九、生产事故

已在生产发生并影响到学生或数据的问题，按时间倒序。

| # | 日期 | 现象 | 根因 | 修复 |
|---:|---|---|---|---|
| 1 | 08-14 | 判对的题显示红叉 | 前端取 `autoCorrect`（交卷时的自动比对结果），人工改判后不同步 | 判过分之后一律以 `awardedMarks` 为准，并新增「部分得分」状态（`69c8ffd`） |
| 2 | 08-13 | 空白题永久显示「待老师批改」 | 未作答的题**没有 `AnswerScript` 行**，接口拿试卷题目补出来，`awardedMarks` 为 null，与「写了没判」无法区分 | 引入 `hasWrittenAnswer(studentAnswer)` 区分（`beb1f83`） |
| 3 | 08-13 | **43 条人工判分被冲掉** | 中午重新激活场次开补考，窗口关闭后 lock cron 再跑一次，`lockOne` Phase 2 无条件重判整场；而 AI 判分是关的（走 `deferAi`），于是人工分被重置回 `null` + `[ai-pending]`，`totalScore` 被覆盖成只算选择题 | Phase 2 排除 `status='marked'`；per-script 跳过 `markedById` 非空（`4a98274`） |
| 4 | 08-13 | 三名补考学生被记成「准时出勤」 | 用 `debug-activate` 开补考，它原地改写了正式时间窗（08:30/08:40/09:00 → 13:21/13:42/13:52）并删掉已生成的缺席行 | 补考改为独立窗口字段 + Gate 5 新分支（`3434c74`） |
| 5 | 08-13 | 错题采集从未真正触发 | `MistakeService` 的采集只挂在判分 controller 上，而实际判分走的是 `scripts/marker-apply.ts` | 在脚本中补上采集调用（`d16b439`） |
| 6 | 08-13 | 剑桥雅思原文误入库 | `git add apps/api` 把未跟踪的 fixture 一起扫进去 | 移除 + `.gitignore` 兜底；确立「逐个文件 add」规则 |
| 7 | 08-12 | 学生装完 PWA 身份变成「测试学生」 | 默认身份写死 | 三层修复 |
| 8 | 08-12 | 生词自测抽出冒犯性干扰项 | 干扰项从 ECDICT 随机取，无过滤 | 加黑名单 + 词性匹配 |
| 9 | 05-28 | 08:29:5x 扫码报「窗口尚未开启」 | cron 只在整分钟跳，30s 预激活缓冲在 08:29:00 那一跳不生效，窗口实际 08:30:00 整才开 | 预激活提前到 5 分钟 |
| 10 | 05-14 | 学生重扫被改记迟到 | upsert 无条件写 `scanTime = now` 并重算状态 | 已 present 的行只刷新指纹元数据 |
| 11 | 05-10 | 周日 session 全班记缺席 | 创建时的周末边界检查被绕过 | lock cron 加纵深防御：周末 session 不插缺席行 |

### 固化下来的规则

1. 绝不 `git add -A` 或 `git add <目录>`，逐个文件添加 —— 版权风险。
2. 开补考只用 `makeup/open` 端点，绝不用 `debug-activate`。
3. 判完分后如果又动了场次状态，必须回查一次 `ai-pending` 条数。
4. 任何「批量重算」路径必须对已定稿数据幂等。
5. 面向学生的判分评语不写记账流水、不用 markdown、必须给可迁移的方法。

---

## 十、已知技术债

**`morning-quiz.service.ts` 4166 行**。全项目最大的文件，早测的排课、
生成、判分、导出、画像都堆在里面。该拆，但它同时是改动最频繁的文件，
拆分的冲突成本目前高于收益。

**练习提交的唯一性只有应用层保证**。见 §3.4。每一处统计都要记得
`status != 'practice'`，已经漏过一次。正解是 Postgres 部分唯一索引，
但要绕过 Prisma schema 写 raw migration。

**单副本假设**。进程内限流、Puppeteer 常驻实例、cron 无分布式锁 ——
都建立在「只有一个 API 副本」上。上多副本时这三处会同时出问题。

**base64 传图**。pdf-worker 的跨服务传输，单页几 MB。Railway 没有共享
volume，短期没有更好的方案；长期应该走对象存储。

**`mass_absence` 的 `claimedCount` 是近似值**。Prisma 的 `count()` 不支持
distinct，靠 scanQr 的重复扫码保护让它约等于唯一学生数。

**v2 静态码的固有弱点**。可被拍照。分身码是缓解不是根治，且需要人工
定期换标签才有效 —— 一旦忘记换，这个机制就退化成零。

**git 历史里仍有剑桥雅思原文**（事故 #6）。工作区已清理，历史未清理；
彻底清除需要 `filter-repo` + 强推。

---

## 附录 A：统计口径与复现命令

```bash
# 提交总数 / 跨度 / 有提交天数
git log --oneline | wc -l
git log --format="%ad" --date=short | sort -u | wc -l

# 按阶段的提交量与类型（示例：P2）
git log --oneline --since=2026-05-07 --until="2026-06-04 23:59:59" | wc -l
git log --format="%s" --since=2026-05-07 --until="2026-06-04 23:59:59" | grep -cE '^feat'

# 代码规模（排除测试）
find apps/api/src -name "*.ts" ! -name "*.spec.ts" | xargs cat | wc -l
find apps/web/src \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" | xargs cat | wc -l

# 后端结构
find apps/api/src -name "*.module.ts"     | wc -l    # 44
find apps/api/src -name "*.controller.ts" | wc -l    # 42
find apps/api/src -name "*.service.ts"    | wc -l    # 71
grep -rhoE "@(Get|Post|Put|Patch|Delete)\(" apps/api/src --include=*.controller.ts | wc -l   # 282
grep -c "^model " apps/api/prisma/schema.prisma              # 63
grep -c "@@index\|@@unique" apps/api/prisma/schema.prisma    # 95

# 测试
cd apps/api && npx vitest run    # 31 files, 348 tests
cd apps/web && npx vitest run    # 18 files, 112 tests
```

## 附录 B：本地起服务

```bash
docker compose up -d          # Postgres
npm run db:migrate && npm run db:seed
npm run dev                   # API :4000  Web :5173
```

demo 账户 `teacher@school.local` / `teacher123`。

关键环境变量：

| 变量 | 作用 |
|---|---|
| `JWT_SECRET` | JWT 签名**以及 v2 静态 QR 签名** —— 轮换会让所有印出去的墙贴失效 |
| `MORNING_QUIZ_AI_GRADING` | `on` 才启用 AI 判分短答；默认关，走人工队列 |
| `INTERNAL_API_TOKEN` | API ↔ pdf-worker 之间的共享令牌 |
| `BOOTSTRAP_CONTENT_DISABLED` | 关掉启动时的题库幂等 seed |
| `MOCK_AUTH` | 开发用，跳过 JWT |

Railway 部署入口在根 `railway.json`：

```json
"startCommand": "sh -c 'npx prisma migrate deploy && node dist/main.js'",
"healthcheckPath": "/api/health"
```

## 附录 C：如何续写本文档

1. 数字一律用附录 A 的命令取，**不要凭印象写**；
2. 新子系统写进 §4，格式对齐：先说做了什么，再说**为什么这么做**，
   附上关键代码片段和文件路径 —— 只有 what 没有 why 的段落没有价值，
   因为 what 读代码就有；
3. 关键技术决策进 §7 的表，必须写原因；
4. 生产事故进 §8，必须有现象 / 根因 / 修复提交号；
5. 技术债进 §9，不要删 —— 债还了才划掉，并在提交信息里说明。
