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


## P3 ✅ 任务阶段实体化与退出恢复（2026-08-26，commit 4880420，**本地提交未 push**）

**根因**：无「学生走到第几步」的实体 —— 流程由 12+ 个散落的布尔/字符串
状态隐式拼出；翻卡页 `idx` 只在 useState，刷新即回第 1 张。

**设计要点**：
- **stage 是缓存不是真相**：真相始终是三段事实字段与答卷。
  `deriveStage(facts)` 纯函数每次从事实重算，`clampStage` 单调钳制后
  只在**严格前进**时写库 —— stage 与事实短暂不一致会被下一次读纠正，
  不会出现「stage 卡住学生进不去」的死锁
- `done` 单向不可逆：做完一天的课再自主加练，不会被打回 vocab_learn
- **断点存服务端**（`DailyLessonCompletion.vocabCursor`）而非 localStorage
  —— 换设备、重新登录同样恢复；`clampCursor` 对越界/脏值一律回 0，
  最坏退化成今天的行为

**阶段**：reading → reading_done → vocab_learn → vocab_test → done

**修改文件**：
- `lesson-rules.ts` 新增 LessonStage / deriveStage / clampStage /
  clampCursor / stageRank / STAGE_ORDER（纯函数）
- `lesson.service.ts` today() 算 stage 并前进时写回；vocabState 补
  unlearned 信号；新增 saveVocabCursor（单调钳制、只写 cursor 不动 stage）
- `lesson.controller.ts` 新增 POST /lesson/vocab-cursor（@RequireStudentToken）
- `prisma/schema.prisma` + 迁移 `20260826230000_lesson_stage`
- `MyVocabReview.tsx` 断点恢复 + 评分后上报（只持久化 idx）
- `MyLesson.tsx` 按 stage 高亮当前该做的段
- `lib/api.ts` lessonVocabCursor 封装
- 测试：lesson-rules.spec +17 条、新增 MyVocabResume.test.tsx 5 条、
  新增 lesson.routes.spec.ts、MyVocabDwellLock.test.tsx 补 mock

**数据库**：ADD COLUMN stage(default 'reading') / stageAt / vocabCursor(default 0)。
**兼容**：纯新增带默认值，不改不删任何现有列或行；存量行首次被 today()
读到时由 deriveStage 按事实重算写回（昨天完成三段的旧记录修正为 done，
不倒退）。**回滚**：代码回退即可（三列无人读、无害）；彻底回滚 =
`DROP COLUMN stage, stageAt, vocabCursor`，三列不含任何原有数据。

**验证结果**（全部本地，未接触生产）：
- 验收 7 项测试全覆盖：正常进入 / 翻卡中退出（上报断点）/ 刷新恢复 /
  重新登录恢复（断点来自服务端，非本机）/ 完成后不可退回旧阶段 /
  旧任务兼容（stage 缺省可被事实推上去）/ 越界与接口失败兜底
- **反向对照已做**：临时禁用 cursor 恢复逻辑后「断点 3 → 第 4 张」
  必红，证明测试有鉴别力
- api 683 tests / web 181 tests（+5）/ 双端 tsc + build 全过
- git diff 范围核查：只碰 lesson 模块与翻卡/课程页，**未动排课逻辑**，
  未提前实施 P4–P7

**未验证项**：
- **迁移未在任何数据库上实跑**（按指示不用 Docker、禁止生产操作）——
  SQL 为纯 ADD COLUMN 带默认值，但未经真实执行
- `POST /lesson/vocab-cursor` 未起真实服务打过（路由契约 spec 断言
  端点存在于 Nest 路由表；服务方法逻辑无独立单测，仅经类型检查）
- stage 写回的并发行为（同一学生两个标签页同时打开课程页）未测
- 端到端「翻卡→退出→重进」真机链路未跑（需数据库）

**未 push、未部署、未执行生产迁移**（等明确批准）。

## P4 ⬜ / P5 ⬜ / P6 ⬜ / P7 ⬜ / P8 ⬜ / P9 ⬜ / P10 ⬜
