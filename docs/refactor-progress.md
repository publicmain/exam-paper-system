# 重构实施进度

> 对应 docs/refactor-plan.md。每片完成后在此登记：修改文件 / 验证结果 /
> 未验证项。

## P1 ✅ 答卷唯一性防线（2026-08-26，commit 9a4875b）

**根因**：R14 为练习模式拆掉 `@@unique([assignmentId,studentId])`，
唯一性只剩 findFirst+create 的 service 约定，共**三处**竞态点
（审计列了 2 处，实施时发现 `student.service.ts:521`
openStudentSubmission 同型，属同一防线一并加固）：双设备同时扫码可
双双 findFirst 落空 → 同学生同卷两条真实答卷，判分/完成度/历史页
均假定单条。

**修改文件**：
- `prisma/migrations/20260826210000_submission_real_unique/migration.sql`
  （对账降级存量重复→practice+AuditLog，不删数据；partial unique
  `WHERE status<>'practice'`；回滚=DROP INDEX）
- `src/common/submission-create.ts`（新增：创建真实答卷唯一入口，
  P2002 撞墙→查赢家返回；非唯一键错误原样抛）
- `src/common/submission-create.spec.ts`（4 条单测）
- `src/attendance/attendance.service.ts`（scanQr + 教师补登两处接入）
- `src/student/student.service.ts`（openStudentSubmission 接入）
- `prisma/schema.prisma`（注释指回迁移；Prisma 无法表达 partial unique）

**验证结果**：
- 迁移前生产只读对账：存量重复 **0 组**（降级分支未触发，防御性保留）
- api 683 tests / tsc / nest build 全过
- 生产验收 4/4：①索引已建（pg_indexes 确认）②迁移后重复组 0
  ③**并发双扫实测**：两路 201、库中仅 1 条非 practice 答卷
  ④测试班旋转门回归：最终提交后重扫 201、旧卷清、新卷 in_progress

**未验证项**：
- 教师补登与学生扫码**跨路径**并发未实测（同型代码路径，仅单测覆盖
  helper；两路径生产同时触发的场景极少）
- 存量降级分支（demote→practice）未在生产触发过（存量为 0），仅
  SQL 审阅，无实测
- P2002 以外的数据库错误路径（断连重试）未在生产模拟


## P2 ✅ 清除死身份端点（2026-08-26，commit 7671768，**本地提交未 push**）

**根因**：注册体系三版并存 —— register（现行，网站式自助）+ setPin
（v1 遗留，认领窗口闸已于 8/26 移除但端点仍活）+ claim-window 四端点
（v2 集体注册窗口，UI 已撤但 API 仍活）。死端点活着 = 攻击面 +
后来者误用源。

**零调用方举证**（全搜 apps/web、apps/miniprogram、apps/ops-dashboard、
apps/api/scripts、scripts、apps/api/src）：
- api.ts 五个封装（studentSetPin / studentClaimWindow / openClaimWindow /
  closeClaimWindow / openStudentClaimWindow）**各 0 处调用**
- claim-window.ts 仅被自身 spec 与 student-auth.service 引用
- API 侧 setPin/claimWindow 无任何跨模块（cron / 其它 controller）引用

**修改文件**（纯删除 + 一个新 spec，零 schema/迁移改动）：
- `student-auth.controller.ts` 删 5 端点
- `student-auth.service.ts` 删 setPin / claimWindow /
  openClassClaimWindow / closeClassClaimWindow / openStudentClaimWindow
  + claimWindowState 辅助 + claim-window 导入
- `claim-window.ts`、`claim-window.spec.ts` 整体删除
- `student-auth.service.spec.ts` 删 setPin 测试块
- `apps/web/src/lib/api.ts` 删 5 个封装
- **新增** `student-auth.routes.spec.ts`：路由契约（5 已删 / 8 保留）
- `CLAUDE.md`：增铁律「未经明确批准不得 git push / 部署 / 生产迁移」

**验证结果**（全部本地，未接触生产）：
- 路由契约 spec：5 端点不在 Nest 路由表（= 线上必 404）、8 个保留端点
  在表内。**反向对照已做**：git stash 还原 HEAD 版 controller 后该
  断言必红，证明 spec 有鉴别力
- 残留引用：`set-pin|claim-window|claimWindow|studentSetPin` 在
  apps/**/*.ts(x) 命中 **0**（连注释残留一并清理）
- api 668 tests（+2）/ web 176 tests / 双端 tsc + build 全过
- git diff 逐块核查：7 文件、+3/-494，`git diff -- prisma/` **为空**
  —— 未删除任何用户或身份数据，pinClaim* 三列留给 P10

**未验证项**：
- **未起真实 HTTP 服务打 404**（无 Docker/本地 Postgres，按指示不使用
  Docker）。以 Nest 路由表断言替代 —— 未注册路径由 Nest 返回 404 是
  框架行为，非本次改动引入
- 注册/登录/扫码/教师身份四条流程**未做端到端实跑**（需数据库）；
  仅由 668 + 176 单测与类型/构建覆盖
- 未知外部调用方（校外脚本、他人收藏的直链）无法穷举 —— 上线后需观察
  日志中这 5 条路径的 404

**未 push、未部署、未执行生产迁移**（等明确批准）。

## P3 ⬜ / P4 ⬜ / P5 ⬜ / P6 ⬜ / P7 ⬜ / P8 ⬜ / P9 ⬜ / P10 ⬜
