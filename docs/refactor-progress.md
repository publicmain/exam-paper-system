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

> ⚠️ **别和 P6 的考试资格看串**：这里是「**该教**」的判据（IS **NULL**）；
> 正式测试「**该考**」的资格是 `firstTaughtAt IS **NOT** NULL`
> （见下方 P6）。两条方向相反，正反两面都有测试钉着。

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

## P6 ✅ 正式单词测试成绩实体 + 堵未学先考（2026-08-28，commit 68fa372，**本地提交未 push**）

**根因**：出题从来只按「到期」和「加入时间」挑词，**从不问「教过没有」**——
因为 P5 之前根本没有「教过」这个事实（唯一的近似是 FSRS 的 `reps`，而它
只在评分时前进）。于是选词长出了两层「凑题数」兜底：

    到期词不够 → 捞 reps = 0 的词（从没学过的）
    还不够     → 捞任意词（连到期都不要求）

短文层的词表是建场时推给学生的、他从没见过，而一进本子 `due` 就是
`now()`。两层叠起来的结果是：学生第一次打开自测，考的全是没读过的词，
全错；答错还回写 FSRS 把它们标成「困难」，往后天天来烦他。
**「凑够题数」这个目标压倒了「只考教过的东西」。**

### 资格规则

判定收在 `apps/api/src/vocab/quiz-eligibility.ts` 一处。一个词能进正式
测试，当且仅当：

1. 是这个学生自己的词
2. `firstTaughtAt != null` —— **教过**。刚教完、`reps` 还是 0 的词完全
   合格，那正是「先学后测」要考的那批
3. 属于**当天这次任务**：`due <= now`，或 `firstTaughtAt >= 当日零点`
   （今天刚教过的，哪怕 due 被别的动作挪走）

不够就明说：一个教过的词都没有 → `not_ready`；教过但当天够格的不足 4 道
→ `insufficient_items`。**绝不为凑数放宽任何一条** —— 不放宽到未教过的
词、不放宽到别的任务的词，更不看 `User.englishLevel` 重算一批。

`buildQuiz` 的两层兜底一并删除，**自由练习也只出教过的词**。

### 数据模型与幂等策略

新表 `VocabQuizAttempt`：

| 列 | 含义 |
|---|---|
| `studentId` + `date` | **唯一约束** —— 一个任务日只能有一份有效正式测试 |
| `dailyLessonCompletionId` | 当日任务行（可空：学生可能还没打开过课程页） |
| `status` / `startedAt` / `submittedAt` | in_progress → submitted |
| `total` / `correct` / `score` | 提交时算一次并落库，展示层不重算 |
| `items` (JSONB) | 逐题快照：题干、选项、正确答案、学生作答、是否正确 |

**幂等三处**：
- **创建**：先查后建，撞唯一约束（P2002）就回读同一份 —— 并发创建不可能
  产生两份
- **作答**：第一次作答为准，重复提交 no-op；条件写入 `WHERE status =
  'in_progress'`
- **提交**：条件更新 `WHERE status = 'in_progress'`，并发里后到的匹配
  0 行、回读同一份成绩

**三条硬边界**：
- **不写 FSRS**：不产生 `WordReviewLog`，不动 `due / reps / stability /
  difficulty / lapses`。考试是量一下，不是练一次
- **不写阅读答卷**：成绩落在自己的表里，`StudentSubmission` 一个字段不碰
- **作答前不下发正确答案**（下发了等于把答案放进 devtools），提交后才连
  答案一起给，供结果页逐题回看

**授权**：四个端点一律 `@RequireStudentToken`。旧的 `GET /vocab/quiz`
只认请求里的 `name` 字符串 —— 报个名字就能读别人的题；成绩实体不能重复
这个错误。

**连带必须改的一处**：背段完成的判据加「今天交了正式测试」。不加就是死锁
—— 正式测试不写复习流水，而背段进度数的正是当天流水，一个「教 5 个新词
→ 考一次」的日子里进度永远是 0，`stage` 卡死在 `vocab_test`。（与 P5 的
`unlearned` 是同一类坑。）

### 修改文件

- **DB**：`schema.prisma` + 迁移 `20260828000000_vocab_quiz_attempt`
- **API**：新增 `vocab/quiz-eligibility.ts`、`vocab/vocab-quiz-attempt.service.ts`；
  `vocab-quiz.service.ts`（删两层兜底 + 支持固定词表）；`vocab.controller.ts`
  （4 个端点）；`vocab.module.ts`；`lesson.service.ts`（背段判据）
- **Web**：`MyVocabQuiz.tsx`（同一入口先试正式测试，不够格退回自由练习）、
  `lib/api.ts`
- **测试**：`quiz-eligibility.spec.ts` 11 条、`vocab-quiz-attempt.spec.ts`
  18 条、`MyVocabFormalQuiz.test.tsx` 7 条、`MyVocabQuiz.test.tsx` mock 更新

### 实际验证结果

**迁移双场景**（隔离库）：
| 库 | 场景 | 结果 |
|---|---|---|
| `p6_empty` | 空库从零跑全部迁移 | All migrations have been successfully applied |
| `p6_legacy` | 跑到 P6 前 → 灌旧数据（词/复习流水/阅读答卷/DLC）→ 跑 P6 迁移 | 同上；旧数据 **一条未动**（w1/l1/s1/d1 计数不变，旧词 `reps=6 stab=3 diff=5 lapses=1 state=review` 原样）；新表建成且为空；三个索引齐备 |

**真实浏览器**（API :4320 + Vite :5276 连 `p6_legacy`）：

| 场景 | 结果 |
|---|---|
| **A** 未教学词不能进入测试 | `未学生`（5 个词全未教）→ `409 {"code":"not_ready","taught":0,"eligible":0,"minItems":4}`；页面退回自由练习，自由练习**也出不了题**（兜底已删）→「还出不了题」。**一题未出，无 attempt 记录** |
| **B** 刚教学、reps=0 的词可作答 | `够格生`（8 个词全教过、reps=0）→ 正常出题「选出正确的意思 / harbour」；库里建成 1 份 attempt，8 道题**全部来自教过的词**，快照含正确答案 |
| **C** 做到一半刷新恢复 | 答完前 2 题后刷新 → **精确恢复到第 3 题（meadow）**，前两题不重考；库里 `[0] harbour 答对 / [1] lantern 答对 / [2..7] 未答` |
| **D** 双击提交 + 请求重试 | 并发五连发提交 → 五次全 201、成绩全部 `2/8=25`、`alreadySubmitted: true×5`；交卷后再改答案 → `accepted=false reason=already_submitted`。**全库每个学生仍只有 1 份成绩** |
| **E** 题目快照、答案与分数 | 完成页显示落库成绩「2 / 8 答对 · 单词测试成绩 25 分」。随后**大改词库**（改 3 个词的释义与音标、删 1 个词典条目、删 1 个学生词）→ 成绩与题目选项**一个字符都没变** |
| **F** 复习日志与 FSRS | 全程 `WordReviewLog` 保持 **1 条**（种子灌的，零新增）；7 个词 `reps=0 lapses=0 state=new stability=0 difficulty=5 lastReview=null` 一字未动；历史阅读答卷 `16/20` 未被写 |
| 附 · 越权 | 别的学生读我的成绩 → 403 `identity_mismatch`；替我交卷 → 403；无 token → 403 `student_token_required`；本人读自己的 → 200 |
| 附 · 阶段推进 | 提交后 `vocab=done`，`stage = done` |

**反向对照已做**：给正式模式加回一次 FSRS 写入后，「作答走成绩接口、绝不
写 FSRS」这条测试**必红** —— 证明它有鉴别力。

**全量复验**：api **757 tests / 70 files** 全过（+29）、web **208 tests /
33 files** 全过（+7）、双端 `tsc --noEmit` 无错、`nest build` +
`vite build` 均成功。

**Git diff 范围核查**：只碰 vocab / lesson 的词汇测试链路与自测页。
未改阅读成绩展示、未创建任务总结页、未进入 P7/P8。

### 尚未验证

- **生产数据库未执行迁移**（按约束禁止）
- iOS Safari / iPad 未真机验证（仅桌面 Chrome）
- **弱网下的作答未走队列**：`vocabQuizAnswer` 失败只被 catch 掉，那一题
  按未作答计、交卷时算错。复习评分有 `reviewQueue` 补传，这里没有 ——
  取舍是「考试期间不重发」比「补传一个迟到的答案」更接近考试语义，但没有
  在真实弱网下验证过体感
- **跨天的 attempt 未验证**：`date` 用 SGT 日历日，学生在 SGT 午夜前后
  作答时会跨到新的一天（旧 attempt 停在 in_progress、新的一天开新的一份）。
  逻辑上是对的，但没有真的跑过跨午夜的场景
- **卷内词汇题（`vocab-attach.service.ts`）仍未加资格过滤**：本周主线词
  按天轮转直接进卷，学没学过都考。审计 §二.4 把它和自测并列为「未学先考」
  的三处之一，本片只处理了自测与正式测试两处 —— 它属于出卷链路，动它会
  碰到排课，按「一次一个垂直切片」留给后续
- **已提交的当天再想练**：目前页面显示成绩并给「再练一轮」按钮，但那一轮
  走的仍是正式测试分支（会直接回到成绩页）。自由练习的入口在成绩已存在时
  实际上够不着 —— 不影响成绩正确性，但体验上有个死角，未修
- 历史成绩列表端点（`GET /vocab/quiz/attempts`）已实现并有授权，但**前端
  还没有展示页面**（属 P7「阅读/词汇成绩拆分展示」，本片按约束未做）

**未 push、未部署、未执行生产迁移。**

**清理**：隔离库 `p6_empty` / `p6_legacy`、API/Vite 进程、`dist-p6` 与
`tsconfig.tsbuildinfo` 已删。

---

### P6 收尾 · 三个边界（2026-08-28，commit 063368b）

#### 一、资格条件核对（结论：代码与文档都没写反，但确实容易看串）

复查了实际代码与测试：

| 规则 | 判据 | 位置 |
|---|---|---|
| P5 **该教** | `firstTaughtAt IS **NULL** AND reps = 0` | `first-teaching.ts` |
| P6 **该考** | `firstTaughtAt IS **NOT** NULL` | `quiz-eligibility.ts`；SQL 里也是 `firstTaughtAt: { not: null }` |

两条方向相反，而在本文档里上下相邻 —— 读的时候极易看成同一条。代码没有
写反。已在 P5 那一段加了显式消歧标注，并补**正反两面**的测试：

- `firstTaughtAt = null` **绝不出题**：全是 null → `not_ready`；与够格的
  词混在一起时只取够格的（断言结果里一个 `never*` 都没有）
- `firstTaughtAt != null` **且 `reps = 0` → 可以出题**（刚教完就考，正是
  设计意图）。`reps` 根本不在资格判据里，这条同时证明它没被偷偷加回去

#### 二、绑定到具体任务

**先说核查结论**，避免在错误前提上改：
- `DailyLessonCompletion` 自己就是 `@@unique([studentId, date])` →
  **一个学生一天至多一个任务**，「同日多个任务互相冲突」在当前模型下
  不可能发生
- `rulesVersion` 变更时走的是 `update` 而不是重建 → **DLC 的 id 稳定**，
  可以安全地当作外键

真实风险不在「同日多任务」，而在**口径漂移**：attempt 服务和 lesson 服务
各算一次「今天」，SGT 午夜前后任何一处算法微调都会让测试挂到另一天的
任务上；完成条件数的也是「这个学生今天有没有交过某一份测试」而不是
「这次任务自己的那一份」。

改法：
- `start()` **先要求当日 DLC 存在**，没有就 `409 no_task`（DLC 由
  `today(freeze:true)` 创建，这里只读不建 —— 越权创建会造出 target 全 0
  的空任务行）
- 查 / 建 / 回读一律按 `dailyLessonCompletionId`
- **主约束**：partial unique index `VocabQuizAttempt_dlc_key`
  （`WHERE dailyLessonCompletionId IS NOT NULL` —— Prisma 表达不了 WHERE
  子句，写在迁移里）
- `(studentId, date)` **保留**为第二道防线，兼容收尾之前建的、还没有 DLC
  绑定的存量行
- 背段完成条件穿过 DLC 关系查，只认**本任务自己的** submitted attempt

**历史兼容**：迁移先把已有成绩按 `(studentId, date)` 回填到那一天的任务
上；回填不上的（当天没有 DLC 行）保持 NULL，仍受旧约束保护、可正常读取。
**不删任何成绩**。
**回滚**：`DROP INDEX "VocabQuizAttempt_dlc_key";`（列留着也无害，没有
约束时它只是个可空外键）。

#### 三、作答落库前不推进

原来失败被 catch 掉、照样进下一题，交卷时那一题按空白算错 —— 学生真的
选了答案，成绩单上却是空的。**这是分数造假，不是网络问题。**

现在：保存中禁用「继续」；失败则停在原题、选项保持选中、显示
「这一题还没存上 · 你的选择还在，点下面重试」+ 重试按钮；重试打**同一个
幂等接口、同样的参数**（第一次成功持久化的答案为准）。没有做离线队列。

#### 四、题目属于当前任务的事实来源

不再用全局 `due <= now` 代替任务归属。

> ⚠️ **这一版的做法（「今天动过这个词」）随后被推翻** —— 见下面的
> 「最终一致性验证」。写 `WordReviewLog` 的不止课程内的翻卡，自由练习
> 也写同一种日志，所以「今天动过」并不能代表「属于当前任务」。
> 现行做法是任务自己记下队列（`DailyLessonCompletion.vocabWords`）。

`User.englishLevel` 全程不参与（有测试断言所有查询的 where 里不含这个
字段）。

#### 验收结果（隔离库 + 真实浏览器）

| # | 验收 | 结果 |
|---|---|---|
| 1 | 未教学词 409 且不创建 attempt | `409 {"code":"not_ready","taught":0,"eligible":0,"minItems":4}`；库里 `stu_new` 一份 attempt 都没有 |
| 2 | 已教学 reps=0 正常出题 | `201`，8 道题全部来自本任务教过的词 |
| 3 | 同日两个不同 DLC 不互相占用 | 同一天、`dlc_ok` 与 `dlc_new` 各建各的，插入均成功 |
| 4 | 当前 DLC 只能有一份有效 attempt | 同任务再插一份 → 被 `VocabQuizAttempt_studentId_date_key` 拒绝 |
| 5 | 当前 DLC 的完成只由自己的 attempt 推动 | 给 `dlc_new` 塞一份 submitted 后：`stu_new` 的 vocab=done，`stu_ok` 仍 todo、不受影响 |
| 6 | **跨午夜不会错误复用或覆盖** | 同一任务、日期改成明天再插 → 被 **`VocabQuizAttempt_dlc_key`** 拒绝（任务级唯一不看日期）|
| 7 | 作答失败停留原题、不按未作答计分 | 注入 500：出现失败提示与重试按钮、**「继续」按钮不存在**；库里已作答题数 **0**（一题都没被记成空白） |
| 8 | 重试成功后正常继续 | 恢复网络点重试 → 失败提示消失、「继续」回来；库里该题 `答=n. 草地；牧场 对错=false` 真的落下了 |
| 9 | 双击/并发/重试不重复写 | 对已答题并发重发 5 次 → 全部 `accepted=false reason=already_answered`，第一次的答案保留 |
| 10 | 题目全部属于当前任务 | 快照里每个 headword 都在「本任务教过的词」集合里 |
| 11 | WordReviewLog / FSRS / 阅读答卷不变 | 流水全程 **1 条**（种子灌的）；除旧生 s1 外没有词的 FSRS 字段被动过；阅读答卷 `16/20` 未被写 |
| 12 | 空库与旧库迁移 | 两个场景均 `All migrations have been successfully applied`；旧数据一条未动；四个索引齐备（含 `VocabQuizAttempt_dlc_key`）|

**反向对照已做**：把「失败照样前进」加回去后，作答持久化那 3 条测试**必红**。

**全量复验**：api **767 tests / 70 files** 全过（+10）、web **211 tests /
33 files** 全过（+3）、双端 `tsc --noEmit` 无错、`nest build` +
`vite build` 均成功。**Git diff 只含 P6 收尾。**

#### 尚未验证 / 已知取舍

- **生产迁移未执行**（按约束禁止）
- **`no_task` 会让没打开过课程页的学生考不了正式测试**：从课程页 /
  扫码链路进来的学生都有 DLC，但直接从生词本点「自测」进来的可能没有 ——
  这时会退回自由练习（不计分）。行为正确但没在浏览器里走过那条路径
- **弱网仍无离线队列**（本阶段按要求不做）：失败靠学生手点重试。真实弱网
  下的体感未验证
- **跨午夜只验证了数据库约束层**：真的在 SGT 23:59→00:01 之间作答的完整
  链路没跑过（需要改系统时钟）
- iOS Safari / iPad 未真机验证
- 卷内词汇题（`vocab-attach.service.ts`）仍未加资格过滤 —— 属出卷链路，
  动它会碰排课，仍留给后续
- 已提交当天想再自由练习的死角仍在（「再练一轮」会回到成绩页），未修

**未 push、未部署、未执行生产迁移。**

**清理**：隔离库 `p6_empty` / `p6_legacy`、API/Vite 进程、`dist-p6b` 与
`tsconfig.tsbuildinfo` 已删。

---

### P6 最终一致性验证（2026-08-28，commit 70bd5fb）

#### 一、任务归属：「今天动过」不成立，已推翻

**先确认，再改**：`POST /vocab/review`（写 `WordReviewLog` 的唯一入口）
有两个前端调用方 ——

| 调用方 | 是不是课程内行为 |
|---|---|
| `MyVocabReview`（课程内翻卡） | 是 |
| `MyVocabQuiz` **自由练习模式** | **否** —— 出题从「所有教过的词」里挑，含陈年旧词 |

（`reviewQueue.ts` 的弱网补传也走它，补的是上面两者攒下的。）

所以「今天有 WordReviewLog」会被自由练习污染。**浏览器实测复现**：对三个
队列外的旧词（`willow / anchor / breeze`）做自由复习 → 当天日志写入
（三次 201）→ 按旧规则它们就有资格进晚上的正式测试。

**改法：任务自己记下队列。** 新增
`DailyLessonCompletion.vocabWords`（headword 数组）：

| 谁写 | 何时 |
|---|---|
| `today(freeze:true)` | 冻结当日目标时快照（与 `vocabTarget` 同一时刻、同一批词） |
| `markTaughtAndAdvance` | 课程内教学时补入新教的词（与 `firstTaughtAt` 同一个事务） |

**只有课程内的动作能写它**，自由练习碰不到。出题资格随之简化为：

    firstTaughtAt IS NOT NULL AND headword IN 任务队列

不再读 `WordReviewLog`，不再有任何日期推断。旧任务行没有快照 → 空集 →
`insufficient_items`（宁可当天不考，也不考不属于这次任务的词；第二天
新建的任务行自带快照，自然自愈）。

**迁移**：纯新增一可空列，**不回填、不删任何数据**。
**回滚**：`ALTER TABLE "DailyLessonCompletion" DROP COLUMN "vocabWords";`

#### 二、提交成功但响应丢失

注入方式：请求**真的打到服务端并落库**，然后让客户端「收不到」响应
（`await 原生 fetch(...)` 之后 `throw new TypeError('Failed to fetch')`）。

| 场景 | 结果 |
|---|---|
| answer 落库后丢响应 → 重试同答案 | `201 accepted=false reason=already_answered`；第一次的答案保留 |
| 重试时**参数被改**（换了个选项） | 同样 `already_answered`，**不覆盖**第一次的 `n. 海港；避难所 / true` |
| submit 落库后丢响应 → 连重试三次 | 四次同一个 `attemptId`、同一份成绩 `1/5 = 20`；`alreadySubmitted` 从 false 变 true 后保持 |
| 库里最终 | attempt **1 条**、已作答 **3 题**（重发没造出重复答案或重复成绩） |
| 前端不会永久停在错误态 | 进入错误态后点重试 → 提示消失、「继续」按钮回来、可以往下走；库里该题仍只有 **1 条**答案 |

#### 验收结果

| # | 验收 | 结果 |
|---|---|---|
| 1 | 当前 DLC 的题目不受自由练习日志污染 | 先自由复习 3 个队列外的词并写入当天日志 → 开正式测试，题目 `harbour/lantern/meadow/pebble/thicket` **全部来自任务队列**，自由练习的词一个没进 |
| 2 | answer commit 后丢响应可恢复 | 见上表；服务端幂等 + 前端可走出错误态 |
| 3 | submit commit 后丢响应可恢复 | 四次重试同一份成绩、同一个 attemptId |
| 4 | WordReviewLog / FSRS / 阅读答卷不受额外影响 | 流水只有自由练习那 3 条（`anchor×1 breeze×1 willow×1`），**考试一条没写**；被考的 5 个词 FSRS 被动过的 **0** 个；阅读答卷 0 条 |
| 5 | 空库与旧库迁移 | 两个场景均成功；旧数据一条未动；**旧任务行 `vocabWords` = NULL**（正确，不回填）；四个索引齐备 |
| 6 | 全量测试 / 双端 tsc / build | api **768 tests / 70 files**、web **211 tests / 33 files** 全过；双端 `tsc --noEmit` 无错；`nest build` + `vite build` 成功 |
| 7 | Git diff 只含 P6 收尾 | 6 改 1 新，全在 lesson / vocab / 迁移 |

**测试质量修正**：假 Prisma 原来无视 `where` 直接返回全部候选 —— 那样
`headword.in` 写错也不会红。已改成照着 `where` 真的过滤，随后才发现三条
用例缺任务队列（补齐后全绿）。

#### 尚未验证

- **纯复习日现在考不了正式测试**：任务队列的快照来自冻结时的到期词，
  但只有**教过的**词才够格。一个全是复习词、当天没教新词的日子，若那些
  复习词都是往日教的，它们仍在队列里、也 `firstTaughtAt != null` ——
  逻辑上够格。但这条路径**没有实测**（本轮种子都是当天教的词）
- **冻结时机与推词时机的先后没实测**：扫码推词若发生在 `today(freeze)`
  之后，那批词不在快照里，只能靠教学时补入。教学补入的代码路径有单测，
  但「先冻结后推词」的真实时序没跑过
- 生产迁移未执行；iOS / iPad 未真机验证
- 跨午夜仍只验证到数据库约束层（没改系统时钟跑完整链路）
- 弱网仍无离线队列（按要求本阶段不做）
- 卷内词汇题（`vocab-attach.service.ts`）仍未加资格过滤
- 已交卷当天想再自由练习的死角仍在

**未 push、未部署、未执行生产迁移。**

**清理**：隔离库、API/Vite 进程、`dist-p6c` 与 `tsconfig.tsbuildinfo` 已删。

---

### P6 最终核查（2026-08-28，commit d0f7d82）

#### 一、headword 的身份稳定性（结论：够格当身份，不改 studentWordId）

| 要求 | 证据 |
|---|---|
| **唯一** | `StudentWord @@unique([studentId, headword])` —— 数据库级约束 |
| **规范化** | 四条创建路径写的都是 `DictEntry` 主键（词典词元）：`student-word.service:91/285` 用 `hit.word`；`attendance:793` 用 `i.word.toLowerCase()` 且过滤到词典里存在的词；`vocab-teacher:197` 用 `lookup()` 的 `hit.word`。而查词典的候选形式一律先过 `normalizeWord`（小写 / 去首尾空白 / 弯直撇号归一） |
| **不可变** | 全仓搜索：创建之后没有任何地方改写 `headword` |
| **一词一条** | `DictEntry` 以 `word` 为主键，多义项在同一行的 `translation` 里 —— 不存在「同词不同义多条记录」 |
| **词形变化** | `surfaceForm` 存原形，`headword` 存词元；`walked/walks` 收敛到同一个 headword，不会分裂 |

**结论**：headword 唯一、规范化、不可变，可以作为任务快照的身份。
**另加一层防线**：任务队列的写入与匹配两端都过 `normalizeWord` —— 将来
任何一条路径漏了规范化，队列匹配也不会因为大小写/空白悄悄漏词。
新增 `headword-identity.spec.ts` 5 条钉住规范化（含幂等性）。

#### 二、先冻结后推词（实测抓到漏词，已修）

**实测复现**：DLC 先建（此刻本子是空的，冻结出来的队列是 `[]`）→ 之后
才推入 2 新词 + 2 **已教复习词** → 新词靠教学卡补进队列，
**复习词永远补不进去**（它们不走教学卡）→ 正式测试漏考它们。

**修复**：`vocabWords` 改成**每次读课程状态时与当前到期队列取并集**
（只增不减）。另外 `attendance` 推词时也直接关联当天任务。

> 这不是「今天动过就算」那条被推翻的规则。并进来的是**到期队列** ——
> 翻卡页真正会服务的那批词。自由练习只会把词的 `due` 推远、把它移出
> 到期队列，**永远不可能把一个词塞进来**，所以它仍然污染不了出题范围。

#### 三、阶段门

`start()` 现在要求 DLC 已进入 `vocab_test`：

| stage | 行为 |
|---|---|
| `reading` / `reading_done` / `vocab_learn` | **409 `stage_not_ready`**，不建 attempt、不出题 |
| `vocab_test` | 允许开考 |
| `done` 且无现成测试 | **409** —— 这一天已收尾，不新开第二份 |
| `done` 但已有测试 | 照常读回成绩（阶段门放在「恢复已有」之后） |

深链接和直接打 API 都绕不过 —— 门在服务端。

#### 四、纯复习日（实测抓到死路，已修）

**实测复现**：纯复习日里学生课程内复习完，背段按「复习够次数」判成
`done`，stage **直接跳过 `vocab_test`** 到 `done` —— 阶段门于是永远
拒绝，正式测试开不了。

**修复**：**这次任务考得起来的话，背段就不能靠复习次数自己收尾**，
必须等交卷（`capAtPartial`）。「考得起来」= 任务队列里教过的词
≥ `MIN_QUIZ_ITEMS`。考不起来的日子仍按复习次数判定，老行为不变。

**连带修复**：`selectEligible` 里还残留着日期过滤（「今天到期 或 今天
教过」）—— 纯复习日会把队列里的词全筛掉（复习完 `due` 被 FSRS 推远、
`firstTaughtAt` 又是往日的），实测 `taught=4 eligible=0`。已删；任务归属
现在**只**由调用方的查询决定（`headword IN 队列`）。

#### 验收结果（隔离库 `p6_final` + 真实服务，18/18）

| 组 | 结果 |
|---|---|
| ② 时序 | 冻结时队列 `[]` → 推词后教学 → 队列 `["harbour","lantern","ripple","vessel"]`，**新词与后推入的复习词都不漏** |
| ③ 阶段门 | `vocab_learn` / `reading` / `reading_done` / `done`(无测试) 四态全部 409 且不建 attempt；`vocab_test` 放行；候选集合 = 本次真实课程队列（2 新 + 2 复习，一个不多一个不少）；`done` 但已有测试 → `resumed=true` |
| ④ 纯复习日 | 课程内复习 4 个词 → `stage=vocab_test` → 开考 → **只考 `ripple/vessel/meadow/pebble`**（自由练习的 `willow/anchor/breeze` 不混入）→ 交卷 → `stage=done`，成绩 1/4 |
| 不变量 | **开考前 vs 交卷后**，7 个词的 `reps/stability/due/lastReview` 完全一致；复习流水共 7 条（4 课程 + 3 自由），**考试一条没写** |

**测试质量修正两处**：① 上一版把 FSRS 取样点放在课程复习之前 ——
课程复习本就该改 FSRS，那样测的不是「考试不改」。已挪到开考前。
② `quiz-eligibility.spec` 里断言日期过滤的那条已跟进新契约（归属上移到
调用方查询）。

**全量复验**：api **780 tests / 71 files** 全过（+12）、web **211 tests /
33 files** 全过、双端 `tsc --noEmit` 无错、`nest build` + `vite build`
均成功。**Git diff 只含 P6。**

---

### P6 生产迁移策略（部署前必读）

1. **旧 DLC 的 `vocabWords = NULL` 就是 `legacy_no_queue`，不会自愈。**

   > 这一条改过两次，最终口径以此为准。
   > · 最初写的是「当天考不了、第二天自愈」—— 错的。
   > · P7 实测发现队列并集会在**任何一次读取**（包括教师看板）时把 NULL
   >   补成当前到期队列，于是改成「首次读取时自愈」。
   > · P7 收尾把这条自愈**去掉了**：普通读取不许把 NULL 变成「此刻的到期
   >   集合」—— 那是拿部署时刻的数据伪造历史任务的考试范围。

   现在的行为：已经进行中的旧任务保持 NULL，正式词汇成绩显示
   `legacy_no_queue`（「这一天没有正式单词测试」）。**当天不补、次日不补、
   永远不补** —— 它的考试范围已经无法可靠重建。第二天新建的任务行自带
   快照，一切正常。

2. **部署应避开已有当日任务的进行窗口。** 早测窗口（08:00–09:00）与第二
   作答窗（16:00–17:30）内不要部署 —— 那时正在上课的学生，他们的任务行
   会永久停在 `legacy_no_queue`，当天没有正式单词测试。
   **建议窗口：当天最后一个作答窗结束之后、次日零点之前。**

3. **部署前统计当日会受影响的任务**：

   ```sql
   SELECT count(*) AS 受影响任务数
     FROM "DailyLessonCompletion"
    WHERE date = CURRENT_DATE
      AND "vocabWords" IS NULL
      AND stage <> 'done';
   ```

   数字不为 0 就意味着这些学生**今天**不会有正式单词测试（阅读成绩、
   复习调度、历史成绩都不受影响）。按第 2 条选好窗口，这个数字通常是 0。

4. **不得无依据自动回填。** 不要写「按当天到期词补一份 `vocabWords`」的
   回填脚本 —— 部署时刻的到期集合与学生当时真正做过的队列不是一回事
   （中途复习过的词已经离开到期集合），回填出来的是一份**看起来合理但
   与事实不符**的考试范围。让 NULL 保持 NULL，第二天自愈。

**未 push、未部署、未执行生产迁移。**

**清理**：隔离库 `p6_final`、API 进程、`dist-p6d` 与
`tsconfig.tsbuildinfo` 已删。

---

## P7 ✅ 阅读成绩与正式词汇成绩分开（2026-08-28，commit 65c3945，**本地提交未 push**）

### 一、原有成绩口径冲突

| 冲突 | 说明 |
|---|---|
| **旧计划的「vocabTrack 现算」已作废** | 旧 P7 计划是按 `snapshotContent.vocabTrack` 把**卷内词汇题**的分从阅读总分里拆出来当词汇成绩。但卷内词汇题本来就是阅读卷的一部分，它的分就在 `totalScore` 里 —— 拆出来叫「词汇成绩」等于凭展示层的一次减法，造一个数据库里不存在的分数 |
| **「完成度」被当成成绩** | 课程页背段原来只有 `progress/target`（今天复习了几次）。那是**过程指标**，不是成绩，但页面上它占着背段唯一的一行数字 |
| **看板一列「分数」含糊** | 教师看板只有一列叫「分数」，实际是阅读分。词汇没有任何成绩位 |
| **`/lesson/today` 没有身份门** | `@Public()` 且不校验学生令牌 —— 报个名字就能读别人的课程状态，而里面本来就有阅读成绩 |

### 二、最终成绩事实来源

| 成绩 | 来源 | 不算什么 |
|---|---|---|
| **阅读** | 现有正式阅读答卷 `StudentSubmission.totalScore / maxScore`（语义不动，仍含卷内词汇题的分） | —— |
| **正式词汇** | **当前 DLC 名下 `status='submitted'` 的 `VocabQuizAttempt`** | 自由练习、`WordReviewLog`、卷内词汇题一律不计入 |

**统一 DTO**（`apps/api/src/vocab/vocab-score.ts`，判别式联合，各页面只显示
不推算）：

| status | 含义 | 展示 |
|---|---|---|
| `legacy_no_queue` | 旧任务没有队列快照，开不出正式测试 | 「这一天没有正式单词测试」 |
| `not_started` | 有队列但没开考 | 「还没考」 |
| `in_progress` | 开考没交卷 | 「考试进行中 · 2/4 题」 |
| `submitted` | 交卷了 | 「3/4 · 75 分」+ 交卷时刻 |

`percentage` **直接读落库的 `score`，不重算** —— 「不重新计算历史分数」
的字面意思。两个易错点各有测试钉住：**0 分是有成绩**（不能显示成「—」）、
**没有 attempt 不是 0 分**。

### 三、修改页面与 API

- **API**：新增 `vocab/vocab-score.ts`；`lesson.service` 的 `vocabState`
  改读 attempt 行（原来只 `count`）并产出 `quizScore`，挂到背段 DTO 与
  看板行；`lesson.controller` 的 `/lesson/today` 加 `@RequireStudentToken()`
- **Web**：新增 `lib/vocabScore.ts`（文案口径）；`MyLesson.tsx` 背段加
  独立一行成绩；`LessonBoard.tsx` 把「分数」列拆成「阅读」「单词测试」两列
- **测试**：`vocab-score.spec.ts` 8 条、`LessonScoreSplit.test.tsx` 8 条

### 四、实际验证结果（隔离库 `p7_db` + 真实浏览器）

六个学生对应六种状态，**API 与页面两级都核对**：

| 场景 | API `quizScore` | 课程页显示 | 阅读 |
|---|---|---|---|
| **A** 只有阅读成绩 | `not_started` | 「单词测试 还没考」 | 已交 · 16/20 分 |
| **B** 单词测试做到一半 | `in_progress answered=2 total=4` | 「单词测试 考试进行中 · 2/4 题」 | 已交 · 16/20 分 |
| **C** 两项均已提交 | `submitted 3/4 75` | 「单词测试 3/4 · 75 分 · 8/26 22:23 交卷」 | 已交 · 16/20 分 |
| **D** 正式测试 **0 分** | `submitted 0/4 0` | 「单词测试 **0/4 · 0 分**」（不是「—」） | 已交 · 16/20 分 |
| **E** 只有自由练习（15 条复习流水，无 attempt） | `not_started` | 「单词测试 还没考」 | 已交 · 16/20 分 |
| **F** 旧任务 `vocabWords=NULL` | `legacy_no_queue` | 见下方「未验证」 | 已交 · 16/20 分 |

**教师看板**（本班教师）：六行，「阅读」与「单词测试」**两列分开**，
0 分显示 `0/4`、未考显示 `not_started`、进行中显示 `in_progress` ——
互不覆盖。

**授权**：
| 尝试 | 结果 |
|---|---|
| 学生读别人的课程页 | **403 `identity_mismatch`** |
| 无 token 读课程页 | **403 `student_token_required`** |
| 学生读自己的 | 200 |
| 学生读别人的词汇成绩 | 403 `identity_mismatch` |
| 外班教师看本班看板 | **403 `not_your_class`** |

**改词库后历史成绩不变**：改 3 个词的释义与音标 + 删 1 个词典条目 +
删 1 个学生词 → 阅读 `16/20` 与词汇 `3/4 · 75 分 · 同一交卷时刻`
**一个字符没变**。

**全量复验**：api **788 tests / 72 files** 全过（+8）、web **219 tests /
34 files** 全过（+8）、双端 `tsc --noEmit` 无错、`nest build` +
`vite build` 均成功。**Git diff 只含 P7。**

### 五、尚未验证

- **`legacy_no_queue` 在浏览器里没见到实际渲染**。API 实测确实返回它
  （学生 F 首次读取之前），文案也有单测覆盖 —— 但它**是个瞬态**：P6 收尾
  的队列并集会在第一次 `GET /lesson/today` 时把 NULL 补成真实队列
  （实测 `dlc_stu_f` 的 NULL 在一次读取后变成
  `["harbour","lantern","meadow","pebble"]`）。所以学生正常操作时基本
  看不到这个状态。**已据此更正上面 P6 的生产迁移策略** —— 原来写的
  「当天考不了、第二天自愈」是错的
- **学生历史页（`MyHistory` / `MyHistoryDetail`）未加词汇成绩**：那里按
  「每一次答卷」组织，而词汇成绩按「任务日」组织，两者对齐需要新的查询
  与列表结构 —— 超出「分开展示」这一片，未做
- **结果页（交卷后那一屏）沿用 P6 的本地显示**，没有改成读这个 DTO ——
  它拿的是 submit 的响应，数值同源，但不是同一条代码路径
- `GET /vocab/quiz/attempts`（历史成绩列表）仍无前端页面
- 生产迁移未执行；iOS / iPad 未真机验证
- **看板的写副作用未处理**：教师打开看板会触发 `today(freeze:false)`，
  而 P6 收尾的队列并集**不看 freeze 开关**，所以教师浏览也会补写学生的
  `vocabWords`。本片按「不修改 P6 逻辑」的约束没有动它，但这是个真实的
  「教师浏览污染学生数据」的口子，值得下一片处理

**未 push、未部署、未执行生产迁移。**

**清理**：隔离库 `p7_db`、API/Vite 进程、`dist-p7` 与
`tsconfig.tsbuildinfo` 已删。

---

### P7 收尾 · 读取副作用与 legacy 语义（2026-08-28，commit 58a5db5）

#### 一、写入来源清单

| 路径 | 性质 | 是否该写 vocabWords |
|---|---|---|
| `today(freeze:true)` **创建**当日任务 | 业务命令（学生打开课程页 = 明确开始今天的课） | ✅ 用当前到期队列初始化 |
| `today(freeze:true)` **重新冻结**（rulesVersion 变更） | 业务命令 | ✅ 与原队列取并集，只补不删 |
| `today(freeze:true)` 的 **reconcile** | 业务命令 | ✅ 并入新到期的词 |
| `today(freeze:false)` —— **教师看板** | **查询** | ❌ 修复前会写，现在零写入 |
| `vocabState()` | **查询**（所有读取路径都走它） | ❌ 修复前在这里落库，现在只算不写 |
| `attendance.pushListToStudent` → `attachWordsToTodayTask` | 业务命令（扫码进这一场） | ✅ |
| `markTaughtAndAdvance` 首次教学 | 业务命令（与 firstTaughtAt 同一事务） | ✅ |
| 课程内复习 | 走学生自己的 `today(freeze:true)` reconcile | ✅（间接） |
| 自由练习 / `POST /vocab/review` | 业务命令，但**不是这次任务的动作** | ❌ 从不写 |
| 后台任务 / cron | 无任何一处碰 vocabWords | —— |

**缺陷**：`today()` 原来无论 `freeze` 与否都写三样东西（进度快照、阶段、
词汇队列）。教师看板走的正是 `today(freeze:false)` —— 教师看一眼就改了
全班学生的数据，而队列内容还被「教师什么时候看的」决定：学生做完词、
`due` 被 FSRS 推远之后再补，补进来的不是他上午做过的那批。

#### 二、读写拆分

- `vocabState` 变**纯读**：只算出 `desiredQueue`，写不写由调用方决定
- `today()` 的写全部收进一个 `reconcileTask`，**只在 `freeze:true` 时调用**。
  `freeze` 的含义从「要不要创建当日记录」扩成**「这是不是一次明确的学生
  动作」**：打开课程页是，教师看板不是
- `markTaughtAndAdvance` 末尾的回读从 `freeze:false` 改成 `freeze:true`
  —— 完成一张教学卡是明确的学生动作，阶段必须真的落库（P6 的阶段门读的
  是 `DLC.stage` 这个缓存，不落库的话学生教完最后一张卡也开不了考）

#### 三、合法写入的共同守卫

四个写入口全部：幂等、只增不减、明确绑当前 DLC、不看 `User.englishLevel`、
不由 GET 触发。外加三条冻结守卫：

- `vocabWords = NULL` **不复活**
- `stage ≥ vocab_test` 不再扩充
- 已存在 attempt 不再扩充

`attendance` 那条原来没有这三条守卫，本轮一并补上（9 条单测钉住）。

#### 四、legacy_no_queue 的最终语义

- 普通读取**不再**把 NULL 变成当前到期队列
- **尚未开始**的新任务：在学生明确开始时初始化
- **已经进行中**的旧任务：保持 NULL，永远不补 —— 它的考试范围已无法可靠
  重建，用部署时刻的 `due` 集合去补就是伪造

已据此**第三次**更正上面 P6 的生产迁移策略（前两版分别写成「次日自愈」和
「首次读取自愈」，都不成立了）。

#### 五、验收结果（真实服务 + 隔离库 `p7b_db`，16/16）

| # | 验收 | 结果 |
|---|---|---|
| 1 | 教师打开看板前后，学生 DLC **逐字段**不变 | PASS（20 个字段整体 JSON 比对） |
| 2 | 连续刷新看板 5 次仍无写入 | PASS（`updatedAt / stage / vocabCursor / vocabWords` 全同） |
| 3 | legacy NULL 在教师查看后仍为 NULL | PASS；**学生自己读之后也仍是 NULL**，成绩状态 `legacy_no_queue` |
| 4 | 学生明确开始新任务 → 正确初始化队列 | PASS（教师看过板并未给他建行；他自己打开后建成，队列 = 当前到期词） |
| 5 | attendance 推词并入当前 DLC | PASS（9 条单测：并入 / 幂等 no-op / NULL 不复活 / vocab_test 后不扩 / done 后不扩 / 有 attempt 不扩 / 空表 / 出错不带崩扫码） |
| 6 | 课程内教学仍能补入 | PASS（`thicket` 在任务建好**之后**才到期，教学把它补进队列） |
| 7 | 自由练习词进不了 DLC | PASS（复习把 `due` 推远，它已不在到期队列里，学生再打开课程页也带不进） |
| 8 | `stage=vocab_test` 后队列不再变化 | PASS |
| 9 | 已存在 attempt 后队列不再变化 | PASS |
| 10 | 看板仍正确显示阅读与词汇成绩 | PASS（阅读 16/20；词汇 `submitted` / `legacy_no_queue` 各自正确） |
| 11 | 学生 `/lesson/today` 权限仍有效 | PASS（读别人 403、无 token 403、读自己 200、外班教师看板 403） |

**反向对照已做**：把写放回读取路径（`if (frozen)` 取代
`if (input.freeze && frozen)`）后，只读不变量那 4 条**必红**。

**测试质量修正**：首轮验证有两条 FAIL，查明是我造数据的时机不对 ——
`thicket` / `faraway` 在任务创建时就已到期、被初始化快照吸进队列，
于是「教学能补入」和「自由练习不能」都测不出真行为。改成**任务建好之后**
才让它们到期，两条才真正成立。

**全量复验**：api **808 tests / 74 files** 全过（+20）、web **219 tests /
34 files** 全过、双端 `tsc --noEmit` 无错、`nest build` + `vite build`
均成功。**Git diff 只含本次完整性修复。**

#### 六、尚未验证

- **纯浏览器点击未跑**：本轮验证走的是真实服务 + 真实 HTTP 请求，但没有
  在浏览器里点开教师看板页面。看板的写副作用发生在服务端，HTTP 级验证
  是等价的；页面渲染在 P7 主体已验过
- 生产迁移未执行；iOS / iPad 未真机验证
- **`today(freeze:true)` 仍有写副作用是设计如此**，但这意味着「学生打开
  课程页」这个动作会推进 stage、补队列。若将来出现「学生只想看一眼成绩、
  不想开始今天的课」的入口，需要一个只读的成绩接口，本轮没做
- P6/P7 期间新增的 `legacy_no_queue` 分支在生产里应当**永不出现**（按第 2
  条选好部署窗口），因此它的真实表现只有测试覆盖

**未 push、未部署、未执行生产迁移。**

**清理**：隔离库 `p7_db` / `p7b_db`、API 进程、`dist-p7b` 与
`tsconfig.tsbuildinfo` 已删。

---

## P8 ✅ 一条学生流程：阅读 → 学词 → 单词测试 → 任务总结

**日期**：2026-08-26　**范围**：把四件已经各自能用的事串成一条路。
不进 P9，不合并扫码入口，不清理身份字段。

### 一、原有流程的断裂与重复入口（追踪结果）

| # | 断裂 | 学生实际遇到的 |
|---|---|---|
| 1 | 课程页没有阅读入口 | 读段的链接只在**已有答卷**时才生成（指向逐题详情）。做到一半退出的学生回到课程页，找不到回卷子的路 |
| 2 | 词段永远指向翻卡 | 走到「该考」的阶段点词段，进的还是翻卡页；正式测试的入口藏在翻卡完成页里 |
| 3 | 做完之后仍是三张卡 | 没有总结。学生不知道今天到底考了多少 |
| 4 | 三张卡各挂一个「开始 →」 | 三个并列 CTA 互相竞争，学生自己判断先做哪个 |
| 5 | 旧任务的死按钮 | `vocabWords=NULL` 的任务 stage 是 `vocab_test`，按钮写「开始单词测试」，点进去必然 `insufficient_items` |
| 6 | 总结页路由落进教师守卫 | `/my-lesson/summary` 没进学生公开路径白名单 → 从测试页点「看今天的总结」到的是学生门户首页 |
| 7 | 深链接被挡时说错话 | 阶段没到就进 `/my-vocab/quiz`，看到的是「生词本里的词还太少」，且没有回到今天该做那一步的路 |
| 8 | 自由练习与正式测试长得一样 | 「再练一轮」进去的页面和正式测试无法区分，学生会以为自己在考试 |
| 9 | 「开始今天的阅读」是个打不开的门 | 答卷是**扫码时**建的。没扫码的学生点进去看得到题、答完存不下（`no_submission` / `no_attendance_record`） |

3–9 都是本轮修的；1、2 是 P8 的主目标。**6、7、9 是浏览器实测抓到的**，
服务端 E2E 全过时它们仍然存在。

### 二、最终的阶段 → 页面映射

服务端出唯一的 `nextAction`（`apps/api/src/lesson/next-action.ts`，纯函数）：

| stage | 条件 | kind | 去处 |
|---|---|---|---|
| reading / reading_done | 今天没排文章 | `none` | 不给链接 |
| reading / reading_done | **答卷还没开出来** | `scan_required` | 不给链接，写「扫码签到后开始今天的阅读」 |
| reading / reading_done | 已开卷、没交 | `resume_reading` | `/morning-quiz/:sessionId` |
| reading / reading_done | 已交卷 | `read_result` | `/my-history/submission/:id` |
| vocab_learn | — | `learn_vocab` | `/my-vocab/review` |
| vocab_test | 任务有词队列 | `vocab_test` | `/my-vocab/quiz` |
| vocab_test | 旧任务（队列 NULL） | `summary` | `/my-lesson/summary` |
| done | — | `summary` | `/my-lesson/summary` |

「能不能进阅读」的判据是**答卷是否存在**，不是考勤记录 —— 中途试过用
`Attendance` 判断，浏览器实测证明它不够：有考勤而无答卷时页面照样存不下
答案。答卷由扫码流程创建（`attendance.service.ts` 会把它挂回
`attendance.submissionId`），所以 `opened` 同时回答了「开过没有」和
「进得去吗」。

段卡片的行动链接现在**只给已完成的段和当前该做的段**，其余不给 CTA。
自由复习生词本的路没被堵（「我的主页」里一直有）。

### 三、命令与查询的边界

| 入口 | 语义 | 会写库吗 |
|---|---|---|
| `POST /lesson/start` | 开始或恢复今天的课 | 会（建任务行、推进 stage、冻结队列） |
| `GET /lesson/today` | 纯读 | 不会 |
| 课程页 `/my-lesson` | 命令 | 调 `lessonStart` |
| 总结页 `/my-lesson/summary` | 纯读 | 调 `lessonToday` |
| 教师看板 | 纯读 | 调 `getToday` |

### 四、修改清单

**新增**：`apps/api/src/lesson/next-action.ts`（+ spec 10 条）、
`apps/web/src/pages/TaskSummary.tsx`（+ test 7 条）

**改**：`lesson.service.ts`（`getToday` / `startOrResumeToday` 拆分、
读段返回 `sessionId`、顶层带 `nextAction`）、`lesson.controller.ts`
（`POST /lesson/start`）、`MyLesson.tsx`（唯一主按钮、CTA 收敛）、
`MyVocabReview.tsx`（完成页 →「去考今天的单词」）、`MyVocabQuiz.tsx`
（正式/自由练习标注、交卷后去总结、阶段被挡时的正确文案）、
`App.tsx`（总结页路由 + 学生公开路径白名单）、`api.ts`（`lessonStart`）

### 五、E2E 结果

**服务端（隔离库 `p8_db`、真实 HTTP）：21 通过 / 0 失败** —— 阶段映射 6
条、legacy 2 条、H 自由练习不算成绩、G 0 分是成绩、阶段守卫 4 条、
F 重复进入不新建、L 只读、I 纯复习日 5 条。

**真实浏览器**：

| 场景 | 结果 |
|---|---|
| A 全链路 | 扫码后的卷 → 继续做题 → 交卷 → 阅读结果 → 学新词 → 单词测试 → 总结，全程唯一主按钮 |
| A' 未开卷 | 主按钮是不可点的「扫码签到后开始今天的阅读」，页面上**没有任何**指向阅读卷的链接 |
| B 阅读做一半退出 | 回来「2/4 已答」，答案还在（草稿在本地，见第六节） |
| C 已交卷未学词 | 主按钮「学今天的新词」→ 翻卡 |
| D 学词中途清空 localStorage + sessionStorage | 重新登录后**仍从第 3 张卡继续**（进度在服务端） |
| E 测试中途退出（并清空存储） | 恢复**同一个 attempt**、同一道题；库里始终只有 1 份 |
| F/G 两项完成 | 主按钮「看今天的总结」；总结页显示阅读 3/4、词汇 `0/4 · 0 分`（不是「还没考」） |
| K 阶段未到深链接进测试 | 挡住，且文案是「还没到考单词的时候」+「回今天的课 →」 |
| 自由练习 | 做题页与完成页都标着「不计分」/「计入成绩」 |

**全量**：api **818 tests / 75 files** 全过、web **226 tests / 35 files**
全过、双端 `tsc --noEmit` 无错、`nest build` + `vite build` 均成功。
**Git diff 只含 P8。**

### 六、尚未验证 / 已知限制

- **阅读草稿仍只在浏览器本地**：交卷前不落库，所以「做到一半」这个状态
  服务端看不见 —— `resume_reading` 认的是「答卷已建」（扫码即建），
  不是「答过题」。清空浏览器存储会丢掉未交卷的阅读草稿。改这一点要动
  早测的存储模型，**不在 P8 范围**
- **正式测试不写 `WordReviewLog`、不更新 FSRS**：考完 `reps` 仍是 0，
  `vocabProgress` 仍是 0（stage 由 attempt 状态推进，所以不会卡死）。
  这是 P6 定的形态，本轮只是记录，未改
- 未跑：iOS / iPad 真机、教师端页面的点击验证（本轮教师侧只做 HTTP 级只读校验）
- 生产迁移未执行

**未 push、未部署、未执行生产迁移、未写生产数据。**

**清理**：隔离库 `p8_db`、API 进程、`dist-p8` 与 `tsconfig.tsbuildinfo` 已删。

**踩过两次的坑**：`nest build` 报成功却不产出完整 `dist` —— 用
`tsc --outDir dist-xxx` 做过临时构建后 `tsconfig.tsbuildinfo` 会污染增量
状态。修法：`rm -rf dist tsconfig.tsbuildinfo` 后全量重建。另外
`dist-p8` 这类临时产物会被 vitest 扫进去，跑全量测试前必须先删。

---

## P8.5 ✅ 未提交阅读答卷的服务端草稿保存与跨设备恢复

**日期**：2026-08-27　**范围**：只动阅读答卷的草稿保存与恢复。
不碰单词学习、正式单词测试、成绩展示、扫码入口规则。

### 一、追踪：已经有的 vs 缺的

**已经有的**（不需要重做）：

| 项 | 现状 |
|---|---|
| 题目级保存 API | `PATCH /morning-quiz/sessions/:id/answer` → `AnswerScript`，`@@unique(submissionId, paperQuestionId)` |
| 前端三种题型的 state | 都走 `ExamContext.setAnswer(qid, {selectedOption, textAnswer})`，600ms debounce |
| localStorage | `mq:answers:{sessionId}:{submissionId}` / `mq:flags:…` / `mq:tab-owner:…`，按学生分桶 |
| 服务端答案随卷子返回 | `existingAnswers`，且合并时**优先于**本地缓存 |
| 交卷 | `POST …/submit { final }` **不传答案** —— 服务端读 `AnswerScript`（目标 6 本来就成立） |
| 已提交锁 | `submission.status !== 'in_progress'` → 400 `submission_locked` |
| 双击交卷 | `submitInflightRef` 同步守卫 + 服务端拒第二次 |
| 多标签保护 | 次要标签不 autosave，页面明写「这里的输入不会被保存」并给「切回此标签」 |

**缺的**（本轮做的）：

| # | 缺口 | 实测证据 |
|---|---|---|
| 1 | 无版本号，**旧请求会覆盖新答案** | 发送「旧 → 新 → 延迟到达的旧」，库里留下的是**旧答案** |
| 2 | **选择题恢复后高亮的是另一个选项** | 学生点「the school」，刷新回来亮的是「the harbour」—— 等于系统悄悄改了他的答案 |
| 3 | `existingAnswers` 只回单字段 `content` | 同时有选项和文字的题（passage-pick 的双写）恢复时必丢一半 |
| 4 | 只在本地、没传上去的草稿**永远不会补传** | 页面显示「4/4 已答」而服务端只有 3 题 —— 交卷时那题是空的 |
| 5 | 保存失败横幅打印原始 JSON | 学生看到 `{"code":"no_submission"}` |

### 二、做法

**题目级幂等保存**（`submissionId + paperQuestionId + answer + clientSeq`）：

- 迁移 `20260829000000_answer_client_seq`：`AnswerScript.clientSeq Int?`
- 服务端**条件写入**：`updateMany WHERE clientSeq IS NULL OR clientSeq < :seq`。
  被拒不是错误 —— 返回 `{ applied:false, superseded:true }`，前端既不报
  「保存失败」也不当成「我这次写生效了」
- 序号**在 setAnswer 那一刻分配**，不是发请求时。重试沿用同一个序号 ——
  换个更大的号重试，等于让这次重试有资格盖掉学生在重试期间写下的新答案
- 换设备：序号从服务端返回的 `clientSeq` **接着往上数**，新设备的第一次
  写入不会因为「从 1 开始」被当成过期请求
- 不带序号的调用（老客户端、内部调用）照常无条件写 —— 升级期间不把还没
  刷新页面的学生挡在外面

**恢复**：`existingAnswers` 改回 `{selectedOption, textAnswer, clientSeq}`
三个字段（`content` 保留给老客户端）；MCQ 的原始 key 用
`shuffle.mapOptionIndex` **翻回学生这次看到的字母**。库里仍存原始 key ——
判分路径一个字没动。

**本地草稿补传**：打开卷子时按序号合并本地与服务端（`draftMerge.ts`），
本地更新的那些题加载后自动补传。两个方向都会出事，所以只能按序号判断：
服务端无条件优先会丢掉还没传上去的输入，本地无条件优先会让旧设备的答案
盖掉新设备刚写的。序号相同时信服务端（同一次写，服务端那份确定存下来了）。

判据抽成了两个纯函数模块，测试测的是**生产代码本身**，不是在测试里另抄
一份判断：`apps/api/src/morning-quiz/answer-seq.ts`、
`apps/web/src/components/exam/draftMerge.ts`。

### 三、验收结果

**服务端（隔离库 `p85_db`、真实 HTTP）：16 通过 / 0 失败**

**反向对照**：把条件写改回无条件 upsert 后，**7 条必红**（D / E-1 / E-2 /
D′ / A-3 / 交卷后两条）——这些测试有鉴别力。

**单元**：`answer-seq.spec.ts` 13 条、`draft-merge.test.ts` 8 条、
`ExamProvider.test.tsx` 新增 2 条（序号递增、从服务端序号接着数）。

**真实浏览器**（Vite :5285 → 隔离 API :4385）：

| 验收 | 结果 |
|---|---|
| A 做到 2/4 后刷新 | 两题都在，且高亮的是学生点的那个选项 |
| B 清空 localStorage + sessionStorage 后重新登录 | 本地缓存为空，三题（选择×2 + 文字）全部从服务端恢复 |
| C 换设备 | 新上下文看到全部答案；在新设备改成 `the mill` → 回原设备刷新看到 `the mill`（服务端盖过本地缓存），**双向都对** |
| D 连续快改 | 120ms 间隔连打 8 次，库里是「连打第 8 次」 |
| E 旧请求延迟返回 | 不覆盖；服务端明确回 `superseded` |
| F 保存失败 | 横幅「⚠️ 这一题还没存上：连不上服务器。你的答案还在这个页面上…」，保存状态停在**保存中**，页面**从未**出现「已保存」；恢复网络后自动补传、横幅消失 |
| G 已提交后修改 | 400 `submission_locked`，历史答卷一字未动 |
| H 双击交卷 | 只有一份最终结果（一个 `finalSubmittedAt`） |
| I 分数与历史 | MCQ 自动判分照常（存的仍是原始 key），结果页「我的答案」标在学生实际点的选项上 |
| 补传 | 造出「本地有、服务端没有」的一题，重新打开后自动补传落库 |

**全量**：api **831 tests / 76 files**、web **236 tests / 36 files** 全过，
双端 `tsc --noEmit` 无错，`nest build` + `vite build` 均成功。
**Git diff 只含 P8.5。**

### 四、尚未验证 / 已知限制

- **两台设备同时作答同一题**不在本轮范围：序号是**按设备**递增的，两边
  各自从服务端读到的同一个起点往上数，谁后到谁赢。真正要解决得用
  服务端序号或向量时钟。日常场景（学生换设备接着做）已经正确
- 补传只在**打开卷子时**做一次。作答途中彻底离线又直接关掉页面，
  那次输入要等下次打开才补
- 未跑：iOS / iPad 真机；第二作答窗（16:00–17:30 重开答卷）下的草稿行为
  沿用既有逻辑，本轮没有专门验证
- `clientSeq` 迁移只加了一个可空列，**生产迁移未执行**

**未 push、未部署、未执行生产迁移、未写生产数据。**

**清理**：隔离库 `p85_db`、API/Vite 进程、`dist-*` 与
`tsconfig.tsbuildinfo` 已删。

---

## P9 ✅ 账号制课程入口：解除正式课程对扫码与考勤的依赖

**日期**：2026-08-27　**产品方向变更**：本项目不再是依赖课堂扫码启动的
早测系统，而是**学生用账号登录、全天可进入和继续学习的英语课程 APP**。
原 P9「统一扫码入口」目标作废。

### 一、旧扫码依赖如何阻塞账号制课程

追踪出四道闸，每一道都足以让一个已登录的学生上不了课：

| # | 阻塞点 | 位置 | 后果 |
|---|---|---|---|
| 1 | **正式答卷只有扫码会建** | `attendance.service.scanQr` 是唯一调用 `createRealSubmissionSafe` 的学生路径 | 登录了也没有答卷 → 答案存不下 |
| 2 | **拿卷子要有考勤行** | `getStudentView` 的 `no_attendance_record` 闸 | 自助开始的学生 403，看不到题 |
| 3 | **下一步写着「去扫码」** | `nextActionOf` 的 `scan_required` | 唯一的下一步是一件学生做不到的事 |
| 4 | **登录后第一眼还是二维码** | `Me.tsx` 三个裸 fetch 手拼的读段：「今天的场次开着 · 扫教室二维码开始」 | 账号登录的意义被抵消 |

另有三处 `/scan/:token` 重复注册：`App.tsx` 的 `startsWith('/scan/')`
分支**无条件 return**，后两处（未登录分支、学生登录分支）永远不可达。

### 二、新的 canonical 学生入口

```
账号密码登录（/me）
  → 今天的课（/my-lesson）
  → 「开始今天的课程」= POST /lesson/start { begin: true }
  → 阅读（/morning-quiz/:id）
  → 学新词（/my-vocab/review）
  → 正式单词测试（/my-vocab/quiz）
  → 任务总结（/my-lesson/summary）
```

身份**只来自登录令牌**：`lesson.controller` 从 `req.studentAuth` 取 id，
请求体里的 `name`/`studentId` 降级为兼容字段（`StudentIdentityGuard` 仍
校验两者一致，对不上 403）。服务层新增 `resolveByIdOrName`：**有 id 就按
id 认人**，姓名分支只留给没登录的公开查询 —— 改过名或同名同学都不该影响
一个正常登录的学生。

### 三、课程创建与恢复规则

**开始命令**：`POST /lesson/start`

| `begin` | 语义 | 写什么 |
|---|---|---|
| 缺省 | 打开课程页 = 恢复 | 建当日任务行、对齐进度与阶段、并入新到期的词 |
| `true` | 学生点了「开始今天的课程」 | 额外**建正式答卷**、按需首次落定难度 |

分开是因为「瞄一眼课程页」不该等于「参加了今天的考试」。
`GET /lesson/today` 仍是**纯读**（教师看板、总结页走它）。

**选哪一场**（`pick-session.ts`，纯函数）：

- 只看今天、`status=active`、挂了卷子的场次
- **确定性挑选**：固定层序 + id 兜底。挑选一旦不确定，同一学生两次请求会
  落到不同 assignment —— 答卷唯一索引按 assignmentId 建，拦不住，学生
  会多出一份正式答卷
- 学生那层开着 → 进那层；没开 → 临时参加别层且**不改写** `englishLevel`
  （沿用 P4）；还没定难度且只开一层 → 进它并首次落定；开了好几层 →
  `level_not_set`，**不替他猜**（猜错会被首次落定固化成长期难度）
- 没挂卷子 → `no_content`；有内容但过了作答时间 → `window_closed`
  （不谎称没有内容）

**幂等**：答卷走 P1 的 `createRealSubmissionSafe`（partial unique +
撞墙自愈）；难度落定用 `updateMany WHERE englishLevel: null` 条件写。
浏览器里连点 5 次、API 并发 4 次，都只有一份答卷 + 一条任务行。

### 四、扫码与考勤的最终处理

- **考勤仍然记录**（扫码那条路照旧写），但**不再是课程开始的必要条件**。
  `getStudentView` 的闸从「有没有考勤行」改成「**有没有这一场的正式
  答卷**」—— 同样拦得住「拉别班/别层的卷子」，且对两条入口都成立
- **账号制开始课程不伪造考勤**：实测全流程走完，`Attendance` 表 0 行
- **旧二维码：标记 deprecated，暂时保留**。`/scan/:token` 的
  canonical 分支保留并加注；两处不可达的重复注册已删（零行为变化）。
  失效的旧码原来是死胡同（「请直接用手机相机扫描大屏」），现在给出
  「用账号登录，去今天的课 →」
- 新页面不再引导扫码：`/me` 与 `/my-lesson` 全页无「扫码」「二维码」
  字样（Me 测试里加了断言钉住）

⚠️ **要真正全天可学，还需打开 `MORNING_QUIZ_ALL_DAY`**（4.0 阶段 B 的
开关，机制早已就绪，默认关 = 08:30–09:00 + 16:00–17:30）。这是部署配置，
不在本轮代码范围。窗口关着时 `start` 会诚实返回 `window_closed`。

### 五、next-action 的表达能力

`ready_to_start` / `resume_reading` / `read_result` / `learn_vocab` /
`vocab_test` / `summary` / `no_content` / `window_closed` /
`level_not_set` / `none`。`scan_required` **已删除**。

新增事实 `hasAnyTask`：三段目标全 0 时 stage 会直接落到 `done` ——
那是「没有任何目标」的副产物，不是他做完了。给这种学生一份空总结是骗人，
现在照实说「今天的课程还没有发布」。

### 六、修改文件

**新增**：`apps/api/src/lesson/pick-session.ts`（+ spec 11 条）

**改**：`lesson.service.ts`（选场次 / 建答卷 / 落定难度 / `resolveByIdOrName` /
`hasAnyTask`）、`lesson.controller.ts`（身份取自令牌、`begin` 参数）、
`next-action.ts`（+spec）、`morning-quiz.service.ts`（考勤闸 → 答卷闸）、
`Me.tsx`（三段收口到 lesson 口径 + 主按钮 + 删 3 个裸 fetch）、
`MyLesson.tsx`（`ready_to_start` 走 POST）、`MorningQuizScan.tsx`（旧码出路）、
`MorningQuizTake.tsx`（`attendanceId` 可空）、`App.tsx`（scan 去重 + deprecated）、
`api.ts`（`lessonStart(begin)`）、`Me.test.tsx`（改为 P9 口径）

### 七、验证结果

**服务端（隔离库 `p9_db`，库里 0 考勤行 / 0 答卷）：26 通过 / 0 失败**
—— 账号登录、身份取自令牌、GET 纯读、打开页面不建答卷、开始建一份答卷、
并发 4 次不重复、难度三种情形、`no_content`、参数挑难度被忽略、
冒用身份 403、阶段守卫仍在、**无考勤也能拿卷子存答案**、教师看板只读、
改难度不影响已开始的任务。

**反向对照**：关掉「开始时建答卷」后 **6 条必红**。

**真实浏览器**（Vite :5290 → 隔离 API :4390）：

| 场景 | 结果 |
|---|---|
| A 无扫码新流程 | 登录 → 开始今天的课程 → 阅读 → 交卷 → 学新词 → 正式测试 → 总结，全程走通 |
| B 无考勤学生 | 全程结束后 `Attendance` 仍 **0 行** |
| C 中途退出 | 阅读中写一句 → 清空 localStorage+sessionStorage → 重新登录 → 「继续做题」→ 答案从服务端恢复 |
| D 重复开始 | 连点 5 次「开始今天的课程」→ 1 份答卷、1 条任务行、难度未改写 |
| E 没有发布内容 | 「今天的课程还没有发布」，渲染成静态提示而非按钮，无二维码字样 |
| F 旧扫码链接 | 失效旧码 → 「用账号登录，去今天的课 →」，不建第二套身份/课程 |
| G 已完成 | 重新进入只给「看今天的总结」 |
| H 清空存储重登 | 三段与下一步全部从服务端恢复 |

**全量**：api **847 tests / 77 files**、web **236 tests / 36 files** 全过，
双端 `tsc --noEmit` 无错，`nest build` + `vite build` 均成功。
**Git diff 只含 P9。**

### 八、尚未验证 / 已知限制

- **`MORNING_QUIZ_ALL_DAY` 未开**：隔离环境的场次窗口是手工放宽的。
  生产要「全天可学」必须打开这个开关，否则 09:00 之后 `start` 会返回
  `window_closed`
- **旧扫码路径本身未改造**：`scanQr` 仍会建考勤 + 答卷（保持明早可用）。
  真要切断需要用户确认 —— 按要求只做了 deprecated 标记
- `/me` 与 `/my-lesson` 现在都会拉 lesson 数据，同一次进入有两次查询；
  没做合并（合并会把两个页面的生命周期绑死）
- 课程页底部仍留着「大家通常在早上 8:30 做今天的文章」这句旧文案 ——
  全天开放后要改，但它属于 4.0 阶段 B 的措辞，不在本轮
- 未跑：iOS / iPad 真机；教师端页面只做了 HTTP 级只读校验
- 生产迁移未执行（本轮**没有 schema 变更**）

**未 push、未部署、未执行生产迁移、未写生产数据。**

**清理**：隔离库 `p9_db`、API/Vite 进程、`dist-*` 与
`tsconfig.tsbuildinfo` 已删。

---

## P9.5 ✅ 全天课程上线验证与产品文案收尾

**日期**：2026-08-27　**范围**：让 `MORNING_QUIZ_ALL_DAY` 这个开关**真的
管用**，并清掉学生端仍暗示「只能早上扫码参加」的文案。不清理身份字段，
不删除旧扫码兼容链路。

### 一、开关原来是半个开关（三个真缺陷）

P9 交付时写着「打开 `MORNING_QUIZ_ALL_DAY` 就能全天可学」。用真实配置
验证后发现**这句话当时不成立** —— 开关只在**建场次**时参与，已经建好的
场次身上写的还是 08:30 / 09:00：

| # | 缺陷 | 学生实际遇到的 |
|---|---|---|
| 1 | `isQuizWindowOpen` 不看开关 | 09:01 打开 App，`window_closed`，根本进不去 |
| 2 | `effectiveEndsAt` 不看开关 | 进去了，倒计时显示 **「00:00 ⏰ 时间到」**，1.5 秒后自动交卷 —— 卷子在他读完第一题之前被收走 |
| 3 | `lockPastSessions` cron 不看开关 | 每分钟按 `quizEnd <= now` 强制收卷、状态翻 locked、答案当场公布 |

三条都修了，判据统一为 `allDayEnabled(classId) && withinAllDay(date, now)`：

- **全天 = 那一场的那一天**（SGT 00:00–23:59），不是永久。昨天的卷子
  今天不能接着做，否则一份卷子会无限期地被续答、永远不判分
- 不带 `classId` 的调用方保持原行为，不因为开关而改变
- 按班灰度（`MORNING_QUIZ_ALL_DAY=c1,c3`）照旧可用

### 二、配置可观测

- **启动日志**：`all-day lessons: all [MORNING_QUIZ_ALL_DAY=true]`
- **`GET /api/health`** 回显 `lessons.allDay` / `allDayRaw` /
  `allDayClasses` / `tzOffsetMin`

两处读同一个 `allDayConfigSummary()` —— 「我以为开了」和「它真的开了」
之间的距离，是这类开关最常见的事故。原始值一并回显，因为
`MORNING_QUIZ_ALL_DAY=ture` 这种拼写错误会静默地退回旧行为（有测试
钉住这一条）。

### 三、验证方式：不靠放宽窗口冒充

隔离库 `p95_db` 的场次时间窗是**生产口径 08:30–09:00，一分未放宽**，
而验证跑在 **SGT 09:04–09:15**（已过收窗）。能不能上课完全取决于那个
真实配置：

| 模式 | 结果 |
|---|---|
| `MORNING_QUIZ_ALL_DAY` 未设置 | **4/4**：`window_closed`、不建答卷、文案不提扫码 |
| `MORNING_QUIZ_ALL_DAY=true` | **20/20**：开始、取卷、09:00 之后存得下答案、内容选择六条、幂等、跨午夜、零考勤 |

**时间矩阵（真实 HTTP，9/9）**：服务器用的是真实时间，拨不动；所以反过来
把**场次窗口**挪到 07:30 / 08:30 / 10:30 / 13:00 / 16:30 / 20:00 / 23:50
各个位置 —— 每一轮窗口都比原来更窄或已经关闭，看开关能不能让学生照样写。
七轮全部 HTTP 200 且答案真的落库。同一组时刻在
`all-day-runtime.spec.ts` 里也用生产函数覆盖了一遍。

**跨午夜（6/6）**：造出「昨天 23:58 开始并写了答案」的完整状态 ——
昨天的答卷与草稿都在、没有被重复创建、今天的任务行只对应今天、今天的
读段仍指向今天那场、**昨天的卷子今天不能接着写**（`quiz_window_closed`）
且草稿原样保留。

⚠️ **边界说明**：跨过午夜之后，昨天那场就关了。23:58 开始的学生 00:02
不能接着写 —— 这是「全天 = 当天」的直接后果，也是「旧任务和新一天任务
边界明确」的实现方式。数据一条不丢，只是不能再改。

### 四、产品文案

**改了（学生端，与账号制直接冲突）**：

| 位置 | 原文 | 现在 |
|---|---|---|
| `MyLesson.tsx` | 大家通常在早上 8:30 做今天的文章。 | **你可以在今天任何时间开始或继续课程，学习进度会自动保存。** |
| `MyHistory.tsx` | 下次**扫码**答题提交后，成绩会出现在这里 | 完成一次课程并交卷后，成绩会出现在这里 |
| `MyHistory.tsx` | **扫码**回来即可修改 | 回「今天的课」即可继续修改 |
| `MyVocab.tsx` | 每天**扫码进考场**时，当天文章的重点词会自动推给你 | 每天开始课程时，…… |
| `MyVocab.tsx` | 先去答一场早测 | 先去上一次今天的课 |
| `MyVocabReview.tsx` | 没记上 · 今天还没**扫码**，扫一下再背就能存下来 | 没记上 · 登录已过期，回「我的」重新登录一次就能存下来 |
| `App.tsx`（`/scan?token=`兜底） | 📱 请用手机相机扫描大屏二维码 | 用账号登录就能上课 + 「去登录 · 今天的课 →」 |

**没改（判断为不冲突）**：

- **「早测」作为栏目名**（`我的早测` / `今天的早测` / `早测更新了` /
  PWA 图标名「早测查询」）—— 它是这门课的名字，不是时间约束
- **安装引导里的扫码步骤**（`InstallGuideSheet` / `InstallAppCard`）——
  讲的是「用 Chrome 相机扫码才能装 PWA」这个 iOS/Android 实操，与
  「怎么上课」无关
- **教师后台**（`MorningQuizSchedule` / `QrPrint` / `Display`）——
  按要求不做无范围重写；贴墙码仍写着 08:30–08:40 签到，全天上线后需要
  教师侧另行处理（列在未验证项）

### 五、旧扫码兼容

未删任何接口或数据库字段。`/scan/:token` 仍是 deprecated 兼容入口，
失效旧码给出「用账号登录，去今天的课 →」。学生端新页面不再引导扫码。

### 六、修改文件

**新增**：`apps/api/src/lesson/all-day-runtime.spec.ts`（15 条）

**改**：`all-day.ts`（`withinAllDay` / `allDayConfigSummary`）、
`morning-quiz.service.ts`（`isQuizWindowOpen` / `effectiveEndsAt` 认开关）、
`morning-quiz.cron.ts`（全天班当天不收卷）、`lesson.service.ts`（挑场次
带上 classId/date）、`main.ts`（启动日志）、`health.controller.ts`（配置
自检）、`MyLesson.tsx` / `MyHistory.tsx` / `MyVocab.tsx` /
`MyVocabReview.tsx` / `App.tsx`（文案）

**注**：`all-day.spec.ts` 原有 6 条一度被误覆盖，已 `git checkout` 完整
恢复；P9.5 的新用例改放独立文件。

### 七、全量

api **862 tests / 78 files**、web **236 tests / 36 files** 全过，
双端 `tsc --noEmit` 无错，`nest build` + `vite build` 均成功。
**Git diff 只含 P9.5。**

**浏览器实测**（SGT 09:12–09:15，窗口 08:30–09:00 已过）：登录 →
「开始今天的课程」→ 进卷 → **倒计时 883 分钟（到当天 23:59），不再
「时间到」** → 写答案 → 「已保存」，无任何扫码字样。

### 八、尚未验证 / 上线注意

- ⚠️ **上线顺序**：cron 每分钟收卷。若先启动服务再配开关，当天场次会在
  09:00 被锁成 `locked`，而 P9 加的场次过滤只认 `active` —— 已锁的场次
  不会因为之后打开开关而复活。**必须先设好环境变量再重启服务**
- 贴墙二维码上的「每天 08:30–08:40 扫码签到」未改（教师端物料）
- 教师看板/排课页仍按 08:30/09:00 的口径展示与操作
- 真实跨午夜（等到 23:58 再看 00:02）未做 —— 用构造的「昨天」状态验证，
  时刻判定由纯函数测试覆盖
- 未跑：iOS / iPad 真机
- 本轮**无 schema 变更**，无迁移待执行

**未 push、未部署、未写生产数据。**

**清理**：隔离库 `p95_db`、API/Vite 进程、`dist-*` 与
`tsconfig.tsbuildinfo` 已删。

---

## RC ✅ Staging 发布候选：发布安全检查（P1–P9.5 功能冻结）

**日期**：2026-08-27　**范围**：只做发布安全检查，**不加功能**。
不进入 P10。

### 一、非法配置在生产下拒绝启动

原来 `MORNING_QUIZ_ALL_DAY=ture` 会被当成一个叫 `ture` 的班 —— 每个班
都不开，日志里一切正常，运维以为全天已经打开了。**静默回退是这类开关
最危险的失败方式**。

- 按班灰度改为**显式前缀** `class:<id>[,<id>]`。不带前缀的班级列表和
  拼错的布尔值长得一样，分不出来 —— 生产环境不再接受
- `assertAllDayConfig()` 并入 `main.ts` 既有的生产守卫块（与
  `JWT_SECRET` / `MOCK_AUTH` / `CORS_ORIGINS` 三道门同处），
  在服务真正起来**之前**拒绝：`Refusing to start: MORNING_QUIZ_ALL_DAY …`
- 非生产环境只告警，不挡本地开发与既有脚本
- 就算有人忽略返回值，行为上也一律按「关」处理，不会误开

**实测**：`NODE_ENV=production MORNING_QUIZ_ALL_DAY=ture` → 进程退出，
日志给出合法写法；换成 `true` → 正常启动并打印
`all-day lessons: all [MORNING_QUIZ_ALL_DAY=true]`。

### 二、公开端点不再泄露配置细节

`GET /api/health` 带 `@Public()`（Railway 健康检查要打它）。P9.5 加的
`allDayRaw`（原始环境值）与 `allDayClasses`（班级 id）已移除，只留：

```json
{ "allDay": "all", "allDayClassCount": 0, "tzOffsetMin": 480 }
```

要看完整值去看启动日志 —— 那是登录才能看到的地方。
`health.controller.spec.ts` 里有一条从另一头钉住的测试：
把配置设成 `class:cls_secret_a,cls_secret_b`，断言响应体里
**不含** `cls_secret_a` 和 `class:`。

### 三、上线手册

新增 `docs/runbook-all-day-lessons.md`，含：

- **先设变量再重启**（cron 会在 09:00 锁掉当天场次，锁了就不会因为之后
  打开开关而复活）
- 部署时间窗口：傍晚 17:30 之后到次日 00:00 之前
- 已 locked 场次的处理（**不要简单改回 active** —— 答卷可能已强制提交并
  判分，改回去会让「已交卷」和「可继续作答」并存）
- 启动日志与 `/api/health` 的验证方法，含「倒计时不是 00:00」这个关键
  观察点
- 回滚：改一个环境变量重启，不涉及数据库；已建数据全部保留
- 小班试用观察清单（4 个每日检查项 + 扩大/回滚的判断标准）
- **7 条关键 SQL** —— 全部在 staging 库真跑过（9/9 可执行）

### 四、Staging 完整验证

真实 staging 配置：`NODE_ENV=production`、`MORNING_QUIZ_ALL_DAY=true`、
`JWT_SECRET` 非默认值、`CORS_ORIGINS` 显式、`MOCK_AUTH=false`；
场次窗口 **08:30–09:00 生产口径未放宽**，验证跑在 **SGT 09:32–09:36**。

**18 通过 / 0 失败**：

| 项 | 结果 |
|---|---|
| 4 完整流程 | 登录 → 开始 → 阅读 4 题 → 交卷 → 学 4 个词 → 正式测试 → 总结（2/4 · 50 分），全程零考勤 |
| 4-3 | **倒计时截止是当天 23:59**，不是 09:00 |
| 5 三个时段 | 上午 10:30 / 下午 15:00 / 晚上 21:00 的窗口均可进入 |
| 6 cron | 等真实 cron 跑一轮后，场次仍 `active`，未交卷的答卷**没有被强制收走** |
| 7 跨日 | 昨天的卷子今天写不进去（`quiz_window_closed`），昨天的答案原样保留 |

### 五、验证过程中修掉的两个脚本缺陷

都不是产品缺陷，但值得记：

- 种子里 `due = now() - interval '1 hour'` —— `now()` 在
  `timestamp without time zone` 列里存的是会话时区墙钟（UTC+8），
  Prisma 按 UTC 读回，词的到期时间变成 **8 小时后**，永远不到期。
  改用 `timezone('UTC', now())`。这是本项目第三次踩同一个坑
- `lesson/vocab-taught` 的路径与必填 `cursor` 参数写错，教学请求
  400 但脚本没检查返回码 —— 表现为「教了 4 个词却仍停在 vocab_learn」。
  已加返回码检查

### 六、修改文件

**新增**：`docs/runbook-all-day-lessons.md`、
`apps/api/src/lesson/all-day-config-gate.spec.ts`（20 条）

**改**：`all-day.ts`（显式前缀解析 + `assertAllDayConfig`）、
`main.ts`（并入生产守卫块）、`health.controller.ts`（不回显原始值与
班级 id）、`health.controller.spec.ts`（泄露检查）

**没有功能改动** —— 学生看到的东西与 P9.5 完全一致。

### 七、全量

api **883 tests / 79 files**、web **236 tests / 36 files** 全过，
双端 `tsc --noEmit` 无错，`nest build` + `vite build` 均成功。
**Git diff 只含本轮发布安全检查。**

### 八、尚未验证 / 上线前仍需人做的事

- **手册的部署步骤没有在真实 Railway 上走过** —— 环境变量面板的操作、
  重启时长、健康检查的行为都需要实际执行时确认
- 灰度写法 `class:<真实 classId>` 未在真实班级 id 上验证（staging 用的是
  `c1` 这种短 id）
- 回滚路径只做了逻辑验证（关掉开关 → 行为回到 P9.5 之前），**没有在
  有学生正在作答时演练过**
- 贴墙二维码物料、教师看板/排课页仍是 08:30/09:00 口径
- iOS / iPad 真机未验

**未 push、未部署生产、未执行生产迁移、未写生产数据。**

**清理**：隔离库 `stg_db`、API 进程、`dist-*` 与
`tsconfig.tsbuildinfo` 已删。

---

## RC1.1 ✅（本地）—— 修 staging 人工实机测试抓到的九个问题

功能仍冻结（P1–P9.5 + RC1）。本轮只修人工测试确认的缺陷，**没有新功能、
没有数据库迁移、没有 schema 改动**。

### 一、九个问题的根因收敛

人工报告列了 A–I 九项，根因只有六处（A 与 C 同源）：

| 编号 | 现象（人工实测） | 根因 |
|---|---|---|
| **A + C** | 阅读结果页进去的词卡是「不计分自测」；刷新后从第 1 张重来但**换成了另一个词**，教过的词从教学卡变成挖空复习卡，分母 3 → 2 | 翻卡页的卡片来自 `/vocab/due`（实时到期 + 配额 + 新旧配比），**不是** DLC 冻结的 `vocabWords`。教学写 `firstTaughtAt`、复习改 `due`，都会让这个队列当场变样 |
| **B** | 先去自由练习做一张，「今日词汇」从 0/4 变 1/3，随后冻结出来的正式考试范围只剩 3 个词 | `vocabState` 的 target 用「此刻仍到期」，progress 数**全部**复习流水，冻结用的 `desiredQueue` 同一口径 |
| **D** | 正式测试里选对了也标 ✗ | 服务端正确脱敏了 `correctIndex`（防作弊），前端却拿它判即时对错 —— 作答前是 `null`，没有一个选项能"等于正确答案" |
| **E** | attempt 已 `submitted`、成绩 4/4，`DailyLessonCompletion.stage` 仍停在 `vocab_test` | 提交只写 attempt，不推进阶段 |
| **F** | 没有内容的账号进课程页看到「🎉 今天的课完成了 · 连续 1 天」 | 三段目标全 0 → `deriveStage` 判三段都 settled → done |
| **G** | 交卷弹窗仍写着 16:00 / 「先存着」 | 全天模式下 `secondWindowToday` 仍按早测口径计算 |
| **H** | 复习卡正面只有挖空句，不知道该回忆哪个词 | 卡面没给中文释义 |
| **I** | 换账号后头部约一秒仍显示上一名学生的姓名 | 退出只清了 `me` 和 `segments` |

### 二、判据提成生产代码里的纯函数

新增 `apps/api/src/lesson/rc11-rules.ts`：`vocabTargetOf` /
`vocabProgressOf` / `lessonCardOrder` / `shouldRevealAnswer` /
`stageAfterSubmit` / `hasAnyTask` / `progressForDisplay`。

**服务端真的调用它们**，测试 `rc11-invariants.spec.ts`（18 条）直接
import 这些函数 —— 不在测试里另抄一份判断，否则改回旧口径也不会红。

**反向对照**：把六条判据逐一改回旧口径 → **9 条必红**，六类缺陷全部
触发；还原后 `git diff` 无差异。

### 三、隔离库端到端复现

隔离库 `rc11_db`、API `:4311`（`MORNING_QUIZ_ALL_DAY=true`）、Vite `:5311`。

- `rc11-repro.js`：**修复前 11 红 → 修复后 19/19 全绿**
- `rc11-scenarios.js`（场景 3/6 + 数据库对账）：**19/19 全绿**

### 四、真实浏览器验收（6 个场景）

| 场景 | 证据 |
|---|---|
| 1 完整流程 | 登录 → 阅读 4 题 → 交卷（**弹窗无「16:00」、无「先存着」** = G）→ 结果页进词卡，**第一张是队列首词 `harbour`**（修复前是 `pebble`）= C → 4 张学完 → 正式测试标注**「· 计入成绩」**= A → 错选 `meadow` 标 ✗、正确项 `pebble` 标 ✓ 并写「正确答案已标出」= D → 库里 `stage=done` / `attempt=submitted` / 2 题 4 分 · 50 分 = E |
| 2 新词中断 | 第 2/4 张关页面 → **清空 localStorage + sessionStorage** → 重登 → 仍是 **`今日生词 2 / 4` · `第一次学 lantern`**（修复前回到第 1 张且变成挖空复习卡） |
| 3 测试中断 | 答完第 1 题换新 token 重登 → **同一 attemptId**（`cmtb0w4h…`）、已答 1 题保留、从第 2 题继续、**attempt 没变成两份**；恢复时**只下发已答那题的答案**（1/1） |
| 4 自由练习隔离 | 开课前做一张自由练习：词段 **0/4 → 0/4 不变**、DLC **逐字段完全一致**；随后开课冻结出的队列仍是**原本 4 个词** |
| 5 无内容 | `next=no_content`「今天的课程还没有发布」、完成度 **0/3**、连续天数 **0**、**没有建任务行** |
| 6 完成后重入 | 刷新 + 重登 + 旧测试链接 + 旧词卡链接：`{subs:5, atts:4, dlcs:5, logs:5}` → **逐项不变**；旧测试链接只回已有成绩（`submitted` / 25 分）；阶段**不倒退** |

另外钉住了阶段门：`stage=reading` 的账号开正式测试 → `409 stage_not_ready`。

### 五、数据库对账（7 项）

重复正式答卷组 0；每个任务最多一份正式 attempt；**代码写出来的
`submitted` attempt，其 DLC 必为 `done`**；无伪完成任务行；考勤行 0；
通知配置与日志 0；`vocabWords` 长度与 `vocabTarget` 处处一致。

### 六、遗留数据的诚实说明

种子里有一条**用 SQL 直接插入的 pre-fix 行**（`att_t8`：attempt 已交、
`stage` 仍 `vocab_test`），专门用来复现 E。E 的修复是**条件写入**
（`where status='in_progress'`），因此它**不会**回头修已经处于错误状态的
旧行。

实测这类行**不阻塞学生** —— 展示层仍推导出「看今天的总结」、完成度
正常。只是 `stage` 列滞后。staging 上若有同类行，需要时可单独对账修补；
**本轮没有连接也没有修改任何 staging / 生产数据**。

### 七、全量验证

api **902 tests / 80 files**、web **236 tests / 36 files** 全过；
双端 `tsc --noEmit` 无错；`nest build` + `vite build` 均成功；
全新库 `prisma migrate deploy` **34 条迁移 0 未完成 / 66 张表**。

`git diff` 17 个文件，**0 个迁移文件、0 处 schema 改动**，工作区干净。

**未 push、未部署、未连接生产库、未改生产环境变量、未进入 P10、
未删除旧扫码兼容代码、未调用 Anthropic API。**

---

## P10 ⬜
