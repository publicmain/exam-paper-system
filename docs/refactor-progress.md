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
- 验收 7 项测试全覆盖：正常进入 / 翻卡中退出（上报断点）/ 刷新恢复 /
  重新登录恢复（断点来自服务端，非本机）/ 完成后不可退回旧阶段 /
  旧任务兼容（stage 缺省可被事实推上去）/ 越界与接口失败兜底
- **反向对照已做**：临时禁用 cursor 恢复逻辑后「断点 3 → 第 4 张」
  必红，证明测试有鉴别力
- git diff 范围核查：只碰 lesson 模块与翻卡/课程页，**未动排课逻辑**，
  未提前实施 P4–P7

---

### P3 合并前验证（2026-08-26，commit 1d0b2ef）

上一轮登记的四条「未验证项」现已全部实跑，并因此改了代码。

**1. 迁移实跑** —— 本地 Postgres 建两个临时库（无 Docker）：
| 库 | 内容 | 命令 | 结果 |
|---|---|---|---|
| `p3_empty` | 空库，从零跑全部迁移 | `npx prisma migrate deploy` | All migrations have been successfully applied |
| `p3_legacy` | 先跑到 P3 之前，灌 3 条旧 DLC，再跑 P3 迁移 | 同上 | 同上 |

迁移后抽样（`p3_legacy` 三条旧记录）：`stage=reading` / `stageAt=null` /
`vocabCursor=0` 全部符合默认值；`readDoneAt` / `vocabProgress` /
`vocabDoneAt` / `drillDoneAt` / `rulesVersion` 旧字段完好，**3 条一条未丢**。

**2. 真实 API 实打** —— 起真服务（:4100 连 `p3_legacy`），`POST
/api/lesson/vocab-cursor` 共 14 项场景全 PASS：

| 场景 | 请求 | 响应 |
|---|---|---|
| 未登录 | 无 Authorization | 403 `student_token_required` |
| 越权 | 自己 token 报别人的名字 | 403 `identity_mismatch` |
| 合法 | `{cursor:4}` | 201 `{ok:true,cursor:4,stored:true}`，落库 4 |
| 非法 | `-5` / `2.7` / `"abc"` | 400 ×3，库值未被污染 |
| 超大 | `999999` | 400（zod max 500）；边界 `500` 接受 |
| 并发 | 同时报 9 与 2 | 库=9，旧值不覆盖 |
| 乱序 | 旧值后到 `1` | 201 no-op，回读真实值 9 |
| 已完成 | `stage=done` 后上报 | 201，cursor 更新而 **stage 仍 done** |
| 无记录 | 没打开过课程页 | 201 `stored:false`，**不创建**记录 |
| 查无此人 | ghost token | 4xx（不 500、不写库） |

**3. 服务层测试** —— 新增 `lesson.service.spec.ts` 7 条，直接断言发给
Prisma 的 where 子句（`vocabCursor: { lt: wanted }`），先读后写的实现
无法通过。其中一条抓到真缺陷：`Math.max(0, Math.floor(NaN))` 仍是 NaN，
会把脏值送进 SQL —— 已修（`Number.isFinite` 守卫）。

**4. 并发策略：改为数据库条件更新，不再先读后写**
- cursor：`updateMany({ where: { …, vocabCursor: { lt: wanted } } })`，
  单调性由 PG 在行锁内判定，落后写入匹配 0 行
- stage：`updateMany({ where: { id, stage: { in: 更早的阶段 } } })`
- **对照实验**（同一脚本、12 路乱序上报、各 8 轮）：
  先读后写 **3/8 轮丢进度（最低跌到 0）**，条件更新 **0/8**

**5. 真实浏览器链路**（Chrome 打真服务，非 jsdom）：
进入翻卡页 → 翻到第 4 张（`cursor=3` 落库）→ **清空 localStorage +
sessionStorage**（模拟重新登录/换设备）→ 刷新后页面显示「今日生词 4 / 5」
✅ 从第 4 张继续 → 翻完 → 「🎉 今日生词看完了」→ 三段达标后 `stage=done`
→ 旧标签页上报 `cursor=1` → 201 但库值不动、`stage` 仍 `done`；
再制造「词重新到期」的事实倒退，`stage` 依然 `done`。**不倒退 PASS**。

> 途中一次 `stage` 停在 `vocab_test` 经查是**测试数据不一致**（我手工把
> `vocabTarget` 写死 10，而当天队列只给 5 张，且 `vocabProgress` 由复习
> 日志实时计数、直接改库的值会被覆盖）—— 背段确实未达标，stage 忠实反映
> 事实，非产品缺陷。

**6. 全量复验**：api **690 tests / 63 files** 全过、web **181 tests / 30 files**
全过、双端 `tsc --noEmit` 无错、`nest build` + `vite build` 均成功。

**清理**：临时库 `p3_empty` / `p3_legacy`、临时进程、`dist2` /
`dist-e2e` 产物已删。

**本轮仍未验证**：
- 未在生产数据库执行迁移（按约束禁止）；生产上存量行首次被 `today()`
  读到时的实际改写结果，只在 `p3_legacy` 的仿制数据上验证过
- 多进程/多实例并发未测（本地单实例；条件更新的正确性由 PG 行锁保证，
  与实例数无关，但未实测）
- iOS Safari / iPad 上的断点恢复未真机验证（仅桌面 Chrome）

**提交列表**（均**本地提交，未 push**）：
- `4880420` feat(P3): 任务阶段实体化与退出恢复
- `05832df` docs: P3 完成登记
- `1d0b2ef` fix(P3): 光标与阶段改为数据库条件更新（本轮）

**未 push、未部署、未执行生产迁移**（等明确批准）。

## P4 ⬜ / P5 ⬜ / P6 ⬜ / P7 ⬜ / P8 ⬜ / P9 ⬜ / P10 ⬜
