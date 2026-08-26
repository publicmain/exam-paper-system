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

**已批准合并到本地分支**（2026-08-26，仍不 push / 不部署 / 不跑生产迁移）。

**非阻塞事项**（合并时记录，留待后续处理，不阻断 P4）：
1. **`DLC.stage='done'` 的语义是「本次课程完成」**，不是「此刻无待复习词」。
   当天课程完成后词汇再次到期（自主加练、FSRS 重排）**不使 stage 倒退**。
   这是设计选择：一天的课只上一次。读取方不得反推「stage=done ⇒ 无 due 词」。
2. **旧数据 `stageAt=null` 必须被读取方容忍。** P3 迁移前的存量行只有
   `stage` 的默认值而无时间戳；任何按 `stageAt` 排序/计时/算时长的代码
   必须显式处理 null（不得假定非空、不得用 null 参与比较）。目前无消费方，
   将来新增消费方时须遵守。
3. **iOS Safari / iPad 断点恢复留作发布前真机验证。** 桌面 Chrome 已过；
   iOS 的 `pagehide`/`visibilitychange` 与存储清理行为不同，上线前须真机跑
   「翻卡 → 切后台/锁屏 → 回来 → 断点仍在」一遍。


## P4 ✅ 难度的单一事实来源（2026-08-26，commit d1dfe22，**本地提交未 push**）

**根因**：难度散落四处，**无一挂在学生身上**。`ClassEnglishLevel` 是班级
今天开哪几层，`MorningQuizSession.level` 是那一场是哪层，扫码现选是当天
的 useState（不写任何存储），词表跟着当天的选择走。学生因此可以天天跳层
→ 词表混层 → 卡片例句来自他没读过的文章。章程要求的「确定难度」阶段在
数据模型上根本不存在。

### 难度来源清单（改动前，按语义分类）

| 来源 | 语义 | 位置 | P4 处理 |
|---|---|---|---|
| `ClassEnglishLevel.level` | **排课配置** —— 班级今天开哪几层 | schema | **不动**（P4 不碰排课） |
| `MorningQuizSession.level` | **任务快照** —— 那一场是哪层 | schema:1562 | **不动**（历史，永不改写） |
| 扫码现选 `chosenSessionId` | **临时输入** —— 这次点了哪个按钮 | `MorningQuizScan.tsx` useState | 保留为「未落定」时的入口 |
| `sessionIdOverride` | **临时输入** —— 传给服务端的那次选择 | `attendance.controller.ts:42` | 保留，但受难度门约束 |
| `Paper.config.wordlist` / weekly-track | 内容选择，**跟着场次的层走** | `wordlist-source.ts` / `weekly-track.ts` | 不动（它读的是 session.level） |
| 前端 localStorage | —— | grep 零命中 | 难度从未被前端持久化 |
| 教师端修改入口 | 只有**班级**层级（`ClassEnglishLevel`） | `Classes.tsx` / admin-syllabus | **新增**学生层级入口 |
| `User.englishLevel` | **学生属性** | **不存在** | **本片新增 = 事实来源** |

**冲突**：没有任何一处回答「这个学生现在是哪一层」。学生跳层时，
「他的词表」和「他读过的文章」立刻脱节，而系统无从察觉。

### 最终事实来源规则

`User.englishLevel`（`EnglishLevel?`，null = 尚未落定）是唯一事实来源。
写入路径**只有两条**：

1. **学生首次扫码成功后落定** —— `updateMany WHERE id AND englishLevel IS NULL`，
   单调性交给 PG 行锁。位置在答卷建好之后（确认这次扫码真的成功），
   不是在门口 —— 否则「扫码失败了难度却被定死」。
2. **教师 `PATCH /admin/users/:id/english-level`** —— 走既有的
   `canActOnClass`；handler 上的 `@Roles('admin','head_teacher','teacher')`
   覆盖 controller 级的 admin-only。`level: null` 可清空（退回现选）。

**学生端没有任何接口能改写已落定的值。** 已落定的人扫别的层时，服务端
在 **Gate 4.5**（身份已知、任何写操作之前）返回 `403 level_locked` +
`correctSessionId`，前端自动切过去重试一次，学生无感。

两处**刻意的放行**，避免规则伤人：
- 他那层今天没排 → 放行到别的层，**且不改写他的难度**（拒绝就等于把人
  挡在早测门外，代价远大于让他临时做一次别的层）
- **【测试】班** → 既不落定也不上锁（教师随意测试不会把自己锁进某一层）

**教师修改只影响后续内容选择**：`setEnglishLevel` 只写 `User` 一行、
只写 `englishLevel` 一个字段（有测试断言 Prisma 调用集合）。历史答卷、
成绩、场次快照、已生成的当日任务一律不碰。

### 修改文件

- **DB**：`schema.prisma` 加 `User.englishLevel EnglishLevel?`；迁移
  `20260827000000_user_english_level`
- **API**：新增 `morning-quiz/level-lock.ts`（`decideLevel` 纯函数）；
  `attendance.service.ts`（Gate 4.5 难度门 + 落定条件写入 + Gate 1 select）；
  `users.service.ts` / `users.controller.ts` / `users.module.ts`
  （`PATCH /admin/users/:id/english-level`）；`student-auth.service.ts`
  （`/me` 返回 englishLevel）；`classes.service.ts`（花名册带 englishLevel）
- **Web**：`MorningQuizScan.tsx`（已落定则跳过选择器 + `level_locked`
  自动重试一次）；`Classes.tsx`（花名册行内难度下拉）；`lib/api.ts`
- **测试**：`level-lock.spec.ts` 9 条、`users/english-level.spec.ts` 9 条、
  `users/english-level.routes.spec.ts` 3 条、`ScanLevelSkip.test.tsx` 5 条

### 数据库

`ALTER TABLE "User" ADD COLUMN "englishLevel" "EnglishLevel";` —— 可空、
**无默认值、不回填**。

**为什么不回填**（计划原稿建议按「最近一次答卷所在场次的层」回填，本次
按指示放弃）：回填只能靠猜，而学生换过层、代答过、或那天他那层没开时
都会猜错；猜错的后果是他明天被锁进错的难度还得找老师改。让 35 个人各自
选一次，比错锁其中几个便宜。

**兼容**：null = 沿用旧行为（扫码时现选），首扫成功后落定。
**回滚**：`ALTER TABLE "User" DROP COLUMN "englishLevel";` —— 该列不含
任何原有数据，删除不影响历史答卷 / 成绩 / 场次。代码回退后列留存也无害。

### 实际验证结果

**迁移实跑**（本地 Postgres，无 Docker）：
| 库 | 场景 | 结果 |
|---|---|---|
| `p4_test` | 空库从零跑全部迁移 | All migrations have been successfully applied |
| `p4_legacy` | 跑到 P4 前 → 灌 3 个旧用户 → 跑 P4 迁移 | 同上 |

迁移后抽样：3 个旧用户一条未丢，`englishLevel` **全部 NULL**（未批量
指定默认难度），列定义 `EnglishLevel nullable=YES default=(无)`。

**真实 API 端到端**（起真服务连 `p4_legacy`）：**21 项全 PASS**

| # | 验收 | 实测 |
|---|---|---|
| ① | null 新生首选后落库 | 首扫选 olevel → 201，库值 olevel |
| ② | 并发/重复首选不产生不确定结果 | 三路并发 → 201/403/403，落定 ielts_authentic；重复提交后不变 |
| ③ | 已有难度不再要求选择 | `/student-auth/me` 返回 englishLevel；前端 5 条测试覆盖跳过选择器 |
| ④ | 学生不能覆盖现有难度 | 指定别层 → 403 `level_locked`；**库值未变**；附 correctSessionId；走对场次 201 |
| ⑤ | 教师可以合法修改 | 本班教师 PATCH → 200 且落库 |
| ⑥ | 未授权不能修改 | 外班教师 403 `not_your_class` / 学生自己 403 / 无 token 403；三次尝试后库值不变 |
| ⑦ | 教师改后新任务用新难度 | 改成 olevel 后扫 authentic 场 → 锁回 olevel 场；新答卷挂在 olevel 场次上 |
| ⑧ | 历史保持不变 | 历史答卷（状态/分数/所属场次/场次 level）一字未动；DLC 数量未变；场次快照未改写 |
| ⑨ | 旧用户 null 有明确处理 | 照常扫码并落定；**他那层今天没开 → 201 放行且难度不变** |
| ⑩ | 所有难度同一套流程 | 三种难度拿到的都是 `/morning-quiz/<sessionId>#h=<token>` |
| 附 | 【测试】班旋转门 | 扫码后 englishLevel 仍 null，不落定不上锁 |

**反向对照已做**：临时禁用「按已落定难度自动选场」的 effect 后，
「已定难度的学生不显示选择器」必红 —— 证明测试有鉴别力。

**全量复验**：api **711 tests / 66 files** 全过（+21）、web **186 tests /
31 files** 全过（+5）、双端 `tsc --noEmit` 无错、`nest build` +
`vite build` 均成功。

**Git diff 范围核查**：只碰 attendance / users / student-auth / classes /
扫码页 / 花名册。**未动 `morning-quiz.service.ts`、`morning-quiz.cron.ts`
等排课代码**；未创建 `preferredLevel` / `selectedDifficulty` 之类的第二套
字段；未删除任何任务难度快照。

### 尚未验证

- **生产数据库未执行迁移**（按约束禁止）。生产有 35 个存量学生，全部会
  是 null，各自首扫时落定 —— 这条路径只在 `p4_legacy` 的仿制数据上验证过
- 教师端花名册的难度下拉**未在真实浏览器点过**（只有 tsc + build + 服务端
  接口实测）
- 多实例并发未实测（条件写入的正确性由 PG 行锁保证，与实例数无关）
- `level_locked` 的**前端自动重试**只有 tsc 覆盖，未在真实浏览器跑过整条
  「点错层 → 被拒 → 自动切回 → 进卷」链路
- 一个学生同时在多个班（转班历史）时，`setEnglishLevel` 取「任一在读班有
  权限即可」—— 逻辑有单测，但没有真实的多班学生数据验证过

**未 push、未部署、未执行生产迁移**（等明确批准）。

**清理**：临时库 `p4_test` / `p4_legacy`、临时 API 进程、`dist-p4` 产物已删。

---

---

### P4 产品语义（合并时确立，后续所有阶段必须遵守）

1. **`User.englishLevel` 是学生的长期默认层级。** 它回答「这个学生现在
   属于哪一层」，会随教师调整而变，全系统只有这一份。它**不是**任何一次
   具体任务的属性。

2. **`MorningQuizSession.level` 是单次任务的层级快照。** 它回答「那一场
   是哪一层」，写入即冻结，**永不回填、永不改写**。历史答卷、成绩、面板
   统计一律挂在它上面 —— 教师今天把学生从雅思真题调成 O-Level，上周那场
   仍然是雅思真题的成绩。

3. **默认层当天未开时，允许临时参加其他层，但不改变长期层级。** 学校今天
   没排他那一层时，服务端放行到当天开着的其他层（拒绝就等于把人挡在早测
   门外），并且**不写 `User.englishLevel`**。那一次的 session.level 记录
   他实际做了什么，他的长期层级保持不变，明天照旧回自己那层。

4. **本次阅读和词汇内容必须跟随任务快照，不得直接依据
   `User.englishLevel` 重算。** 出卷、词表推送、卷内词汇题、周主线一律读
   `session.level`（以及由它选定的 `Paper.config`）。
   理由：`User.englishLevel` 是会变的，用它重算会让「复习你自己读过的
   句子」这个承诺在教师调层的那一刻对该学生失效 —— 卡片例句会来自他从没
   读过的文章，而历史面板上的分数也会对不上当时的卷子。
   **判断准则**：凡是回答「这次是什么」的，读快照；只有回答「他下次该去
   哪一层」的，才读 `User.englishLevel`。

---

### P4 合并前验证 · 真实浏览器（2026-08-26）

环境：隔离库 `p4_browser`（迁移 + 种子）、API :4200、Vite :5273、
Chrome 实际点击。**未碰生产**。

**① 误点其他已开层级 → 自动纠正**

学生林小满（`englishLevel=ielts_authentic`），本机无 token（`/me` 查不到
自己是哪层）→ 难度选择器如期显示 → **误点「O-Level 标准」** → 输入姓名
→ 「开始答题」。

网络记录（`POST /api/attendance/scan` 全部请求，共 **2 次**）：
| # | 结果 | 响应 |
|---|---|---|
| 1 | **403** | `{"code":"level_locked","lockedLevel":"ielts_authentic","lockedLevelLabel":"雅思真题","correctSessionId":"sess_authentic"}` |
| 2 | **201** | `quizUrl: /morning-quiz/sess_authentic#h=…` |

- **只自动重试一次**：第三次请求不存在
- 页面落在「雅思真题 短文 / The Cambridge harbour has served the town
  for four centuries.」= `paper_auth`，**正确的卷子**
- 数据库：答卷 **1 条**（`session=sess_authentic, level=ielts_authentic`）、
  考勤 **1 条**、`englishLevel` 仍是 `ielts_authentic` —— **无重复答卷、
  误点未改写长期层级**
- 无循环请求（scan-roster 的两次 GET 是 React StrictMode 开发模式双渲染，
  非重试）

**② 教师在花名册改难度**

班主任（`t_home`，本班）打开 G11 英语花名册 → 行内难度下拉正确回显库值
（林小满=雅思真题、周允行=未定）→ 把周允行改为「O-Level 标准」。

- `PATCH /api/admin/users/stu_zhou/english-level` → **200**
  `{"ok":true,"id":"stu_zhou","englishLevel":"olevel"}`
- **刷新页面后保持**：重新打开花名册，下拉仍是「O-Level 标准」
- **后端回读一致**：`GET /api/classes/cls_g11` 返回 `englishLevel=olevel`；
  数据库直读 `olevel`；审计留痕
  `user.english_level_set stu_zhou {"englishLevel":{"from":null,"to":"olevel"}}`

**无权限用户**（生产口径实例，`MOCK_AUTH=false`）：
| 身份 | 结果 |
|---|---|
| 无 token | **401** `Missing token` |
| 外班教师 | **403** `not_your_class`（连该班花名册都读不到，同样 403） |
| 学生本人 | **403** `Insufficient role` |

全部越权尝试之后，两名学生的难度未变，难度变更审计**仅 1 条**（教师那次
合法修改）。

> 说明：本地 `.env` 里 `MOCK_AUTH=true` 会给无凭证请求注入一个假教师，
> 所以在默认开发实例上「无 token」返回的是 403 `not_your_class` 而不是
> 401 —— 这是既有的开发开关，与 P4 无关。即使在那个最宽松的设置下，
> 假教师仍被 `canActOnClass` 挡住，P4 的授权防线成立。

**本轮仍未验证**：
- 生产数据库仍未执行迁移（按约束禁止）
- iOS Safari / iPad 上的这两条链路未真机验证（仅桌面 Chrome）
- 「误点 → 自动纠正」只测了默认层**当天开着**的情形；默认层当天未开时的
  临时参加（语义 3）只有服务端接口实测，未在浏览器点过
- 教师把已落定的学生**清空为「未定」**的浏览器路径未点过（接口有测试）

**未 push、未部署、未执行生产迁移。**

---

## P5 ✅ 新词教学卡（2026-08-27，commit a5df8e5，**本地提交未 push**）

**根因**：系统里唯一能表示「学生见过这个词」的东西是 FSRS 的 `reps`，
而 `reps` 只有**提交一次评分**才前进。于是「把新词标记成已教」除了让
学生对一个从没见过的词打分之外没有别的做法 —— 教学被迫长成考试的样子
（挖空 → 显示答案 → 认识/不认识），而那次评分又被 FSRS 当成真实信号
写进调度：学生第一次见到 harbour 就被迫宣称自己「没记住」，这个词从此
被标成困难词天天来烦他。**「学」和「测」混在一起的根源就是这一个缺失
的字段。**

### 事实来源

新增 `StudentWord.firstTaughtAt`（可空、无默认值、不回填）。判据收在
`apps/api/src/vocab/first-teaching.ts` 一处：

    needsFirstTeaching = firstTaughtAt IS NULL AND reps = 0

两个条件都**不需要回填**：`reps > 0` 的存量词学生一定评过分（当复习词
处理）；`reps = 0` 的存量词从没被评过分（本来就该补一次教学）。前端只
读服务端结论（`needsFirstTeaching`），字段缺失时的兜底用同一条式子，
不构成第二套判据。**不用 localStorage 作事实来源。**

它不是成绩、不是熟练度、不参与调度 —— P6 的词汇测试成绩是另一件事，
不挂在这里。

### 首次教学的最终行为

第一面**直接给全**：词 + 音标 + 词性 + 中文释义 + 英文释义 + 他刚读过
那篇文章里的原句 + 来源，底部只有一个「下一个 · Next」。字段缺失一律
隐藏那一行，**绝不编造**音标 / 词性 / 释义 / 例句。

教学面上**没有**：挖空猜词、显示答案、认识/不认识、待会儿再见、撤销、
任何成绩。

「下一个」只做两件事：
1. 条件写入 `firstTaughtAt`（`WHERE firstTaughtAt IS NULL`，幂等，
   重复提交与双标签页都 no-op）
2. 推进 P3 的 `vocabCursor`（服务端持久化，只增不减）

它**不写** `WordReviewLog`，**不动** `due / stability / difficulty /
reps / lapses / state`。标记失败不拦学生 —— 失败的后果是安全的：这个词
明天再教一次，绝不会被错标成已教。

### 复习词边界

复习词保持原有必要交互（挖空 → 显示答案 → 两档评分 → 间隔反馈 → 撤销）。
两条分支在**同一个组件**里由 `needsFirstTeaching` 分开，没有复制页面、
没有重写间隔重复算法、没有提前实现 P6。教学面不显示上一张的评分回执
（那里面含「撤销」，出现在教学卡上会让学生以为刚才那一下被记了分）。

### 修改文件

- **DB**：`schema.prisma` 加 `StudentWord.firstTaughtAt`；迁移
  `20260827120000_word_first_taught`
- **API**：新增 `vocab/first-teaching.ts`（判据纯函数）；
  `vocab-review.service.ts`（`due` 卡片补 `needsFirstTeaching` /
  `pos` / `definition`，新增 `markFirstTaught`）；`vocab.controller.ts`
  （`POST /vocab/first-taught`，`@RequireStudentToken`）；
  `lesson.service.ts`（`unlearned` 判据同步）
- **Web**：`MyVocabReview.tsx`（教学分支 + `teachNext`）；`lib/api.ts`
- **测试**：`first-teaching.spec.ts` 11 条、`MyVocabFirstTeaching.test.tsx`
  10 条、`MyVocabReviewRouting.test.tsx` 徽标断言更新

**关键连带修正**：`lesson.service` 的 `unlearned` 判据从 `reps=0` 换成
`firstTaughtAt IS NULL AND reps=0`。不改就是死循环 —— 首次教学不再写
评分之后 `reps` 永远是 0，`unlearned` 永远不降，`stage` 卡在
`vocab_learn` 出不去，学生天天被教同一批词。

### 数据库

`ALTER TABLE "StudentWord" ADD COLUMN "firstTaughtAt" TIMESTAMP(3);`
可空、无默认、不回填。**兼容**：null 的存量词按上面的判据自然分流。
**回滚**：`DROP COLUMN "firstTaughtAt";` —— 该列不含任何原有数据，
删除不影响历史复习流水 / FSRS 调度 / 熟练度。

### 实际验证结果

**迁移实跑**：隔离库 `p5_browser` 从零跑全部迁移，
`All migrations have been successfully applied`。

**真实浏览器**（API :4300 + Vite :5274 连隔离库，Chrome 实际点击）：

| 场景 | 结果 |
|---|---|
| **A** 全新学生进入词汇阶段 | 第一张（故意造的缺字段词 `thicket`）直接显示教学内容，**优雅隐藏**缺失的音标/词性/释义且不崩；页面按钮只有「跳过 / 🔊 / 下一个」；程序化断言：无挖空下划线、无显示答案、无认识不认识、无待会儿再见、无撤销。第二张 `lantern` 数据齐全 → 词+音标+词性+中英释义+原句+来源全在 |
| **B** 翻到第 3 张 → 清空 localStorage+sessionStorage → 重新登录 | 刷新后仍停在**第 3 张 meadow**；旧标签页随后上报 cursor 0 与 1，库值稳在 2 **不倒退** |
| **C** 完成全部首次教学卡 | stage 由 `vocab_learn` → **`vocab_test`**（当前设计规定的下一阶段）；5 个词全部 `firstTaughtAt` 已标记而 `reps=0 / state=new / stability=0` **一字未动**；`WordReviewLog` **0 条** —— 教学不产生任何词汇测试成绩 |
| **D** 混合队列（2 新 + 2 复习） | 第 1–2 张走教学卡（带「第一次学」徽标、只有「下一个」）；第 3 张切回**挖空「The ? lay still…」+ 显示答案 + 忘了/记得**，评分后出现「4 天后再见 · 撤销」。库里只有复习词 `meadow` 产生 1 条流水，两个新词一条都没有 |

**网络请求**：点「下一个」只发出 `POST /vocab/first-taught` 与
`POST /lesson/vocab-cursor`，**全程没有 `/vocab/review`**。

**历史不动**：历史丙的已判分答卷（16/20）、词的 `reps=6 / state=review /
stability=3`、1 条历史复习流水，P5 全程未增未减。全库「已教过但 reps
仍为 0」的词 7 个 —— 教学不动 FSRS 的直接证据。

**反向对照已做**：临时把教学分支禁用（`teaching = false`）后，前端
10 条测试 **9 条必红** —— 证明测试有鉴别力。

**全量复验**：api **722 tests / 67 files** 全过（+11）、web **196 tests /
32 files** 全过（+10）、双端 `tsc --noEmit` 无错、`nest build` +
`vite build` 均成功。

**Git diff 范围核查**：只碰 vocab / lesson 的词汇状态与翻卡页。未创建
词汇测试成绩实体、未改阅读成绩展示、未创建任务总结页、未进入 P6–P8。

### 尚未验证

- **生产数据库未执行迁移**（按约束禁止）。生产上存量词会按判据自然分流
  （`reps>0` 当复习、`reps=0` 补一次教学），这条路径只在仿制数据上验过
- 教学卡在 **iOS Safari / iPad** 上未真机验证（仅桌面 Chrome）
- **弱网/离线下的教学标记未走队列**：`teachNext` 是 best-effort，失败
  只是这个词明天再教一次（安全），但没有像评分那样进 `reviewQueue` 补传
- **自测出题的 `reps=0` 兜底仍在**（`vocab-quiz.service.ts`）：可考词
  不足时仍会捞未评分的词入题，其中包括刚教过的。「堵未学先考」属 P6，
  本片按约束未动
- 刚教过的词当天再打开词汇页会以**复习卡**形态出现（`due` 未改，
  `firstTaughtAt` 已标）。这符合「先学后测」，但没有在浏览器里走过
  「同一天教完再回来」这一遍
- 教学卡上的 🔊 发音依赖浏览器 TTS，未在真机核对读音

**未 push、未部署、未执行生产迁移。**

**清理**：隔离库 `p5_browser`、API/Vite 进程、`dist-p5` 产物已删。

---

### P5 收尾 · 两个边界（2026-08-27，commit 5bedcc1）

#### 一、firstTaughtAt 与 vocabCursor 的一致性

**故障注入实测的结论**：原来「下一个」分别打 `/vocab/first-taught` 与
`/lesson/vocab-cursor`，两者之间是一个**会导致永久死锁**的窗口。

| 注入的故障 | 修复前的后果 | 修复后 |
|---|---|---|
| ① first-taught 失败、cursor 成功 | **cursor 前进但 firstTaughtAt 仍 null** → 那个词永远 unlearned、而 cursor 已越过它 → **stage 永久停在 vocab_learn，进不了 vocab_test** | 单事务，要么都成要么都不成 |
| ② first-taught 超时但服务端写成功 | 前端吞掉异常照常前进 —— 恰好一致，纯属侥幸 | 重发幂等（条件写入），结果相同 |
| ③ first-taught 成功、cursor 失败 | 刷新后回到同一张 → **重复教学**，且那张卡已变成复习卡形态（挖空），学生看到刚教过的词突然变考题 | 事务回滚，两者都不生效 |
| ④ 两个请求乱序返回 | 两个独立请求，组合仍落进 ①/③ | 只有一个请求，不存在乱序 |
| ⑤ 连续点击「下一个」 | 接口极快返回时 `busy` 已放开而 `idx` 未重渲染 → 旧闭包再推一格，**中间那张卡从未教过而 cursor 已越过它** | `teachingRef` 去重 + `setIdx` 用确定值、副作用移出 updater |
| ⑥ 最后一张发生故障 | 最后一张**根本不上报 cursor**，标记失败即无声吞掉 → 完成页照常弹出，学生以为学完了，实则那个词未标记、stage 出不去 | 失败不进完成页，提示重试 |

**修复**（用户指定的优先方案）：新增 `POST /lesson/vocab-taught`，
一个事务里
1. 条件设置 `firstTaughtAt`（`WHERE firstTaughtAt IS NULL`）
2. 单调推进 `vocabCursor`（`WHERE vocabCursor < wanted`）
3. 返回**真实的** cursor 与 stage

本子里没这个词 → 整笔回滚，cursor 绝不前进。没有 localStorage、没有额外
布尔字段、没有前端推测补偿。

**失败时前端不前进**，显示「没存上，再点一次 · 这一下没有被记录」。
往前走等于页面撒谎：进度条动了、完成页出来了，而库里那张卡从没被教过。
代价是接口持续故障时学生停在词汇段（见「尚未验证 / 已知取舍」）。

**死端点已清除**：`/vocab/first-taught` 与 `markFirstTaught` 收尾后
已无生产调用方，留着就是留着那条能单独写标记的旁路 —— 删掉，并加路由
契约测试钉死它不再存在。`/lesson/vocab-cursor` **保留**（复习卡的评分
路径仍在用，那条路没有配对的标记动作）。

#### 二、首次教学卡的「跳过」

**追踪结果**：「跳过」只做 `navigate`，**不写任何库**（不推进 cursor、
不写 firstTaughtAt）。所以它本身不制造不一致 —— 学生跳走时 cursor 没动，
是安全方向。

按指示**只在首次教学分支隐藏**：一个第一次见到这个词的学生，不需要在
「学」和「不学」之间做选择。复习卡的「跳过」原样保留（有测试断言）。

#### 验收结果（隔离库 `p5_browser` + 真实浏览器）

| # | 验收 | 结果 |
|---|---|---|
| 1 | 正常点击下一张 | 一次 `POST /lesson/vocab-taught` → 201 `{cursor:1,stored:true,alreadyTaught:false,stage:"vocab_learn"}`；**没有**旧的两步调用 |
| 2 | 双击下一张 | 只发出一次请求（`lantern@cursor2`），前进一张；单测另断言「越过几张就标记了哪几张、cursor 无跳号、同卡不重复标记」 |
| 3 | first-taught 故障（reject / HTTP 500） | 停在原地，提示「没存上，再点一次」；库里 `vocabCursor=1`、4 个词仍未教 → **cursor 未越过任何未教的词** |
| 4 | cursor 故障 | 与 ③ 同为一个事务，整笔回滚；连续三击全部失败后卡片与库值均不动 |
| 5 | 最后一张发生故障 | **不进完成页**，停在 5/5 并提示重试 |
| 6 | 刷新后恢复 | 刷新后准确回到第 3 张（meadow）、第 5 张（pebble，未教的那张） |
| 7 | 最终进入 vocab_test | 全部教完 → `stage = vocab_test`，未教过的词 **0** 个 |
| 8 | 不产生 WordReviewLog | **0 条**（多轮故障注入后仍为 0） |
| 9 | 不改 reps/due/stability/difficulty | 5 个词全部 `reps=0 lapses=0 state=new stability=0 difficulty=5`，一字未动 |
| 10 | 教学卡不再出现「跳过」 | 页面按钮只剩 `["🔊","下一个 · Next"]` |
| 11 | 全量测试 / 双端 tsc / build | api **728 tests / 68 files**、web **201 tests / 32 files** 全过；双端 `tsc --noEmit` 无错；`nest build` + `vite build` 成功 |
| 12 | Git diff 只含 P5 收尾 | 9 改 1 新，全部在 lesson / vocab / 翻卡页 |

#### 尚未验证 / 已知取舍

- **失败时学生被挡在词汇段**：接口持续故障时，教学卡既不前进也没有
  「跳过」出口，学生只能关掉 App（不丢数据，明天重教）。这是「不撒谎」
  与「不挡路」之间的取舍，选了前者；若上线后真的出现，再考虑连续失败
  N 次后给一个明确标注「今天先不学了」的出口
- 教学标记**仍未走弱网队列**（复习评分有 `reviewQueue` 补传，教学没有）
- **生产数据库未执行迁移**（按约束禁止）
- iOS Safari / iPad 未真机验证（仅桌面 Chrome）
- 自测出题的 `reps=0` 兜底仍在（属 P6「堵未学先考」，本片未动）
- 浏览器验证期间的一次「真实鼠标点击无反应」经查是页面 reload 后事件
  尚未绑定所致，程序化点击立即生效 —— 非产品缺陷，但**真机上快速连点
  刚加载完的页面**这一情形没有专门验证
- 构建期间发现 `apps/api/tsconfig.tsbuildinfo` 会被我临时用的
  `tsc --outDir dist-xxx` 污染，导致 `nest build` 静默不产出 `.js`。
  已删缓存重建确认产物完整；**这是验证流程的坑，不是产品问题**，但值得
  记一笔：以后临时构建不要复用同一个 tsconfig 的增量缓存

**未 push、未部署、未执行生产迁移。**

**清理**：隔离库 `p5_browser`、API/Vite 进程、`dist-p5b` 与陈旧的
`tsconfig.tsbuildinfo` 已删。

---

## P6 ⬜ / P7 ⬜ / P8 ⬜ / P9 ⬜ / P10 ⬜
