# 上线说明 · `audit-ios-rebuild-2026-09-11`

**现在的状态：已上线**（2026-09-11 16:38 新加坡时间，`main` = `3825422`；过程、回滚点与上线后核对见文末「上线记录」）。
以下是当时按授权执行的步骤说明，保留作下次上线的模板。

## 这次上线会带上什么

- 三端代码：API（安全与身份、词汇后端、判分队列、发布脚本）、学生端（整站重做）、教师端（判分页、班级统计、词表页、词汇进度表）。
- **一个数据库迁移**：`apps/api/prisma/migrations/20260911120000_student_level_change` —— 只新建 `StudentLevelChange` 表、
  一个索引、一个外键（`ON DELETE CASCADE` 到 `User`）。不改已有表、不删数据、不回填。
- 没有新的环境变量。

## 迁移预演（已在本机隔离库做过）

`.local/audit/final/migrate-dryrun.txt`（本机 PGlite，真 Postgres 语义；只连 127.0.0.1）：

1. 先按 `6f85e6d`（生产现状）的 44 个迁移建库 —— 全部成功；
2. 再跑本分支 —— 只多应用 `20260911120000_student_level_change`，成功；
3. `prisma migrate status`：Database schema is up to date；
4. `prisma migrate diff`（库 → 本分支 schema）只剩两条 `DROP INDEX`（`Attendance_qrVariant_idx`、
   `MorningQuizSession_makeupEnd_idx`）—— **`6f85e6d` 的 schema 对着同一个库也有这两条**，是早就存在的
   「迁移建了、schema 没声明」的索引差异，不是这次引入的；部署走 `migrate deploy`，不会去删它们。

同一个隔离库上，发布脚本的集成测试 9 / 9 通过（`.local/audit/final/pilot-publish-db.txt`）。

## 上线顺序（授权后）

1. **不要在发布内容的时候上线**：确认当时没有 `prepare-pilot-week.js` 在跑（它比对答卷指纹，库有写入会整天回滚）。
2. **备份**：Railway 控制台给 Postgres 做一次手动备份 / 快照，记下时间点。
3. **合并到 main 并推送**：推前在本机再跑一遍 `npm run build -w @app/api`（vitest 不做类型检查，TS 错误只会在 Railway 构建时炸）。
   推送后 API 和教师端按现在的配置自动构建部署。
4. **API 启动时自动迁移**：`railway.json` 的启动命令是 `npx prisma migrate deploy && node dist/main.js` ——
   这一步就是生产迁移。迁移失败时新实例起不来、健康检查不过；按 Railway 的部署机制旧实例应继续服务 ——
   上线时在控制台确认这一点，不要假定。
5. **学生端**：当前是手动 `railway up`（`apps/student-web`，nginx 静态包）。等 API 健康检查通过后再发学生端 ——
   新学生端依赖新接口（`/vocab-v2/daily/review`、`/vocab-v2/notebook/restore`、`/vocab-v2/custom-test/cancel`、
   `/vocab-v2/test/audio`、overview 的 `home`）；这几处前端都有「老服务端没有」的兜底，但顺序仍然是先 API 后学生端。
6. **只读核对**：`/api/health` 的 commit 等于合并后的 main；`/api/health/ready` 数据库 up；学生端首页 200。
7. **测试账号冒烟**（不用真实学生账号）：用 `p1_qa_acc_*` 验收号走「今日 → 学词 → 背一背 → 测试 → 总结」和一次阅读答题；
   教师端看判分队列三栏、词汇进度表。不对真实学生提交任何答卷。

## 回滚

- **代码**：Railway 上把 API / 教师端 / 学生端重新部署到 `6f85e6d` 那一版（或 `git revert` 合并提交后推送）。
- **数据库**：新表是纯新增，旧代码不读它，**回滚代码时不需要回滚迁移**；表留着无害。确实要删时再单独授权执行
  `DROP TABLE "StudentLevelChange";`，并把 `_prisma_migrations` 里那一行一并删除。
- 这次没有改写任何已有数据，所以不需要数据回滚；如果上线后发现问题，用第 2 步的备份做时间点恢复是最后手段。

## 不随这次上线执行、需要单独授权的真实数据操作（都只是 dry-run）

| 事项 | 脚本 / 方案 | 影响 | 分台账 |
|---|---|---|---|
| CONTENT01 · 09-09 甘地题评分标准文字订正 | `apps/api/scripts/fix-20260909-gandhi-rubric-text.ts`（默认 dry-run） | 只改冻结快照里的文字，不改分数 | ledger-pub |
| S04 · 旧版前缀停用账号的状态修复 | ledger-sec S04 一节的 dry-run / 事务 SQL | 把「名字带停用前缀」的旧账号写成真实停用 | ledger-sec |
| 词汇 D1–D6 · 历史数据修复 | ledger-vocab「需要真实数据修复的 dry-run 方案」 | 延后词重复、来源关系、共享例句污染等历史数据 | ledger-vocab |

每一项执行前：先备份、先跑 dry-run 给你看影响行数、再等你说「执行」。

---

## 上线记录 · 2026-09-11（你在对话里说「可以，按 RELEASE.md 上线」之后执行）

| 步骤 | 时间（UTC / 新加坡） | 结果 |
|---|---|---|
| 预检 | 08:30 / 16:30 | `origin/main` 仍是 `6f85e6d`（快进合并，没有别人的新提交）；本机没有发布内容的进程 |
| 备份 | 08:34 / 16:34 | 在 Postgres 容器里 `pg_dump -Fc`，全部表结构 + 除 `PdfPage`（697 MB 的 PDF 页图，只读、这次不碰）以外的全部数据，79 张表有数据；39,520,135 字节，sha256 `cc2919258097a8a746e4388c1eac003d1eece2d5450ca75e8449bf8a0ca06028`，下载到本机后逐字节校验一致。文件：`.local/backups/pre-release-20260911T083425Z.dump`（不进仓库，含学生数据）。容器里的临时文件已删 |
| 推送 | 08:36 / 16:36 | `main` 快进 `6f85e6d → 3825422` |
| API 部署 | 08:38 / 16:38 | 部署 `b4c00def`，启动时 `Applying migration 20260911120000_student_level_change` 成功；`/api/health` 报 `3825422`，`/api/health/ready` 数据库 up |
| 教师端 / pdf-worker | 08:38 | `c5647369` / `936a2a4f` 成功 |
| 学生端 | 08:39 / 16:39 | `railway up` 部署 `8dec027e` 成功；线上包 `index-CbohkcCX.js`，含新页面文案 |

**回滚点**（上线前的活动部署）：API `6b86b29b`、教师端 `27f4cd14`、pdf-worker `191c38ee`、学生端 `dab34e67`。

**上线后只读核对**：学生端 / 深链 `/vocab` / 教师端 200；不带令牌访问 `/vocab-v2/overview`、`/lesson/today`、
`/vocab-v2/daily/review` 都是 403 `student_token_required`，答题页 401；注册页班级 9 个；API 自启动以来除一条
早就存在的 `ContentBootstrap ENOENT`（上一版部署日志里同样有，缺的是早年因版权删掉的剑桥原文夹具）外没有错误。

**上线后定时任务的两次写入（新代码的设计行为，如实记录）**：

1. **更正本文前面「不回填」的说法**：词汇模块每 10 分钟的档位观察任务第一次运行时，给 43 名有档位的在册学生
   各写了一行 `StudentLevelChange`（source=`baseline`，「从上线这一刻起他在这一档」）。只写新表、只增不改，
   不碰任何已有表、成绩或进度。之后只有档位真的变了才会再写。
2. 内容生成任务的超时回收（VOC14）第一次运行就收回了那条卡在 `running` 约 8.9 天的任务并重新跑完：
   `content batch selected=1 published=1 rejected=0 failed=0 reclaimed=1`。
3. 每日新词任务照常：`daily tasks ready for 41/41 active students`。

**测试账号冒烟（16:45–17:05，叶老师的「老师测试号」，你自己登录后我接着走）**：

- 今日：三张卡、旧待办按日期、测试提醒弹窗都在；
- 阅读：打开今天的卷子（新的只读答题页 GET），答 1 题 → 顶上「已保存」、题号 1 标已答；点词查「motion」→ 释义 + 原句 + 整句翻译；
  **没有交卷**（当时以为晚上会被系统收卷；09-14 只读核对：没有收卷，卷子仍开着、不在判分队列 —— 测试账号）；
- 学词：1 个稍后再学 + 9 个学完，每步反馈对（「学完 9 · 延后 1 · 还剩 0」）→ 背一背：9 个词、「12 题（新词 9 + 旧词抽查 3）」；
- 测试：打开的是学完时自动生成的那份，12 题答完交卷（随手作答，记为 0 / 12）→ 逐题回顾 12 条；
- 回到今日 2 / 3、总结「还有 1 项没做完」、再开背一背是「回看这一天学的词 · 看测试回顾」；我的单词 50 个 · 加载更多；
  学习记录两块都出来、无横向溢出。
- 发现一处：手机宽度的阅读页有 **1px 横向溢出**（「原文 / 题目」吸顶条的 -1px 边距）—— 截图量尺原来有 1px 容差把它放过了。
  已在本地修掉并把量尺改成零容差：34 场景 × 320 / 390 / 430 / 1180 = 136 张 0 溢出；把 -1px 临时放回，同一把尺
  抓到阅读页 391 / 390、431 / 430，量尺有效。**等你同意再发学生端**。
- 教师端没走（需要教师账号登录）。

---

## 补推 · 2026-09-14（你在对话里说「推」之后执行）

09-11 你说「推送」后，推前检查被本机 Git Bash 的 fork 报错打断，当时没有推出去；这次补上。

| 步骤 | 时间（UTC / 新加坡） | 结果 |
|---|---|---|
| 推前检查 | 推送前 | `origin/main` 仍是 `3825422`（快进）；本机没有发布内容的进程；类型检查、API 构建、学生端 46 个文件 1048 个测试、学生端构建全过；之前 CI 上失败的用例单独连跑 8 次全过 |
| 推送 | 03:11 / 11:11 | `main` 快进 `3825422 → 24717a5`（两条上线记录、CI 时序修复、阅读页 1px 溢出修复、收卷说法更正） |
| API / 教师端 / pdf-worker | 03:14 / 11:14 | `11308b93` / `9692fe80` / `67bc3e0b` 成功，业务代码与上一版相同；`/api/health` 报 `24717a5`，`/api/health/ready` 数据库 up |
| 学生端 | 03:15 / 11:15 | `railway up` 部署 `59537101` 成功；线上包 `index-CbohkcCX.js` → `index-bcxW8d3t.js`，包里是修好的吸顶条样式、已没有 `-mx-px` |
| CI | 03:15 / 11:15 | main 的 CI 运行 `34801759805` 通过（上一次在 `3825422` 上因时序竞争失败） |

**回滚点**（这次之前的活动部署）：API `b4c00def`、教师端 `c5647369`、pdf-worker `936a2a4f`、学生端 `8dec027e`。

**上线后只读核对**：学生端首页、`/vocab`、`/today` 200；不带令牌访问 `/vocab-v2/overview`、`/lesson/today`、
`/vocab-v2/daily/review` 仍是 403 `student_token_required`。没有数据库迁移，没有数据改动。

本节只在本机提交，没有推送（避免为一条文档再触发一次部署）。
