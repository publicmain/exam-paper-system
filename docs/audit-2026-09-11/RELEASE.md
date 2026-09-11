# 上线说明 · `audit-ios-rebuild-2026-09-11`

**现在的状态：没有上线。** 分支只在本机，没有推送；生产仍是 `6f85e6d`（2026-09-11 只读核对 `/api/health`）。
下面每一步都要你在当前对话里明确说「可以推 / 可以部署」之后才做。

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
