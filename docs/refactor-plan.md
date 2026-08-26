# 渐进式重构计划

> 2026-08-26。依据 docs/refactor-audit.md v2 的证据制定。
> 原则：一次一个垂直切片；每片可独立测试、独立回滚；数据损坏 →
> 重复提交 → 身份冲突 → 任务恢复优先；产品规则修复随后；入口收敛
> 与身份收敛最后。每片实施前后更新 docs/refactor-progress.md。
> 状态标记：⬜ 未开始 · 🔶 进行中 · ✅ 完成 · ⛔ 回滚

---

## P1 ⬜ 答卷唯一性防线（数据损坏 / 重复提交）

**解决**：审计 §二.3 —— `@@unique` 被拆后仅靠 service 约定，两处
findFirst+create 竞态可产生同学生同卷双答卷。

**切片范围**：只加数据库防线 + 让两处竞态点在撞墙时自愈。不动
practice 模式、不动任何页面。

| 项 | 内容 |
|---|---|
| 文件 | `apps/api/prisma/migrations/<new>/migration.sql`；`apps/api/src/attendance/attendance.service.ts`（:501、:803 两处 create 包 try/catch 撞唯一键→重查）；schema.prisma 注释更新 |
| API | 无新增无变更 |
| DB | **迁移**：先跑对账 SQL 找存量重复（同 assignmentId+studentId 的非 practice 多条）→ 若有，保留「finalSubmittedAt 非空者优先，其次 submittedAt 最新」的一条，其余改标 status='practice' 并记 AuditLog（**不删数据**）；再建 `CREATE UNIQUE INDEX "StudentSubmission_one_real_per_assignment" ON "StudentSubmission"("assignmentId","studentId") WHERE status <> 'practice'`（partial unique，Prisma 不原生支持 → raw SQL 迁移 + schema 注释说明）。**兼容**：练习模式不受影响（practice 行不在索引内）；测试班旋转门先 delete 再 create，天然兼容。**回滚**：`DROP INDEX`，代码 catch 分支无害可留 |
| 风险 | 低。存量若有重复，降级为 practice 可能让该生历史页多一条练习记录（可接受，保数据）；迁移在生产跑 CREATE INDEX 会短暂锁表（35 人量级，秒内） |

**验收标准**：
1. 并发测试：同一学生两路并发 scan（脚本模拟）→ 库中仅 1 条非 practice 答卷，两路请求都成功返回
2. 对账 SQL 在生产返回 0 组重复
3. api 全量测试 + nest build 通过；正常扫码答题交卷生产走查无回归
4. 测试班旋转门仍可无限重来

---

## P2 ⬜ 清除死身份代码（身份冲突）

**解决**：审计 §二.1 —— 三套注册逻辑并存：`setPin`（v1 遗留）、
claim-window 五个端点（v2 遗留，UI 已撤）。死代码活端点=攻击面+
后来者误用源。

**切片范围**：只删**确认零引用**的端点与服务方法。数据库死列
（pinClaimOpenUntil×2、pinClaimOpenedBy）**本片不动**（留 P10，
避免本片含破坏性迁移）。`admin/claim-status`（注册看板在用）与
`admin/view-token`（学生视角在用）**保留**。

| 项 | 内容 |
|---|---|
| 文件 | `student-auth.controller.ts`（删 set-pin、claim-window GET、admin/claim-window/open·close·student 共 5 端点）；`student-auth.service.ts`（删 setPin、claimWindow、openClassClaimWindow、closeClassClaimWindow、openStudentClaimWindow 及 claimWindowState 辅助）；`claim-window.ts` + `claim-window.spec.ts`（整体删除）；`student-auth.service.spec.ts`（删对应用例）；`api.ts`（删 studentSetPin、openClaimWindow、closeClaimWindow、openStudentClaimWindow 前端封装） |
| API | **删除** 5 个端点（删除前逐一 grep 全仓引用并记录于 progress 文档；外部脚本目录 scripts/ 一并搜） |
| DB | 无变更 |
| 风险 | 低。唯一隐患是未知外部调用方 —— 上线后观察 Railway 日志 404 一天 |
| 验收 | ① 全仓 grep `set-pin`、`claim-window` 仅剩历史文档命中；② register/login/重置/学生视角/注册看板 生产 E2E 全通；③ api+web 测试与构建通过 |

**回滚**：单 commit revert 即可（无迁移）。

---

## P3 ⬜ 任务阶段实体 + 退出恢复（任务恢复）

**解决**：审计 §二.5 —— 无「走到第几步」实体，刷新只有阅读答题可恢复。

**切片范围**：给每日任务加显式阶段；打开 app 恢复到阶段对应页面；
翻卡断点续翻。**不改**各页面内部逻辑，只加"读阶段→路由"一层。

| 项 | 内容 |
|---|---|
| 阶段定义 | `reading → reading_done → vocab_learn → vocab_test → done`（账号级的 registered/level 不进这里，见 P4） |
| 文件 | `apps/api/prisma/migrations/<new>`；`lesson.service.ts`（today() 返回 stage，进度写回时推进 stage）；`lesson-rules.ts`（纯函数 `deriveStage()` + 测试）；`MyLesson.tsx`（按 stage 高亮"继续"入口）；`MyVocabReview.tsx`（idx 存 sessionStorage 按日 key，刷新续翻）；`lib/lesson-entry.ts`（PWA 启动跳转带上 stage） |
| API | `GET /lesson/today` 响应新增 `stage` 字段（向后兼容，纯新增） |
| DB | `DailyLessonCompletion` 加 `stage TEXT NOT NULL DEFAULT 'reading'`。**兼容**：存量行默认 reading，首次访问由 deriveStage 按三段完成情况重算写回。**回滚**：代码回退即可，列留着无害 |
| 风险 | 中低。stage 与三段 doneAt 可能出现不一致 → deriveStage 以事实（doneAt/成绩记录）为准、stage 只是缓存，规则写进 lesson-rules 测试 |
| 验收 | ① 在读/学/测各阶段刷新或重开 app → 回到该阶段对应页面；② 翻卡翻到第 5 张刷新 → 从第 5 张继续；③ deriveStage 单测覆盖全部转移；④ 全量测试构建通过 |

---

## P4 ⬜ 难度的单一事实来源

**解决**：审计 §二.2 —— 难度不是学生属性，每日现选可跳层、词表混层。

**切片范围**：加 `User.englishLevel`（偏好）；首次选层落定，之后扫码
**预选并默认锁定**（教师在班级页可改；学生不能自由跳层）。**不动**
一班一天五场的排课模型。

| 项 | 内容 |
|---|---|
| 文件 | migration；`attendance.service.ts`（scanQr 后写 User.englishLevel 若为空）；`qr.service` / scan meta（返回学生偏好层）；`MorningQuizScan.tsx`（有偏好→直进该层场次，不再显示选择器；无偏好→现选一次）；`Classes.tsx`（花名册显示/修改学生层级）；新 API `PATCH /admin/users/:id/english-level`（教师，canActOnClass） |
| DB | `User.englishLevel TEXT NULL`。**回填**：迁移脚本按「该生最近一次非 practice 答卷所在场次的 level」回填（SQL 写在迁移内，可空则留 NULL）。**兼容**：NULL=沿用现选行为。**回滚**：DROP COLUMN 前无其他依赖，或代码回退列留存 |
| 风险 | 中。学生真实需要换层时必须找教师（产品语义变化，符合章程"确定难度"）；回填口径可能错个别人 → 教师端可改即兜底 |
| 验收 | ① 新生首扫选层后，次日扫码直进同层无选择器；② 教师改层后次日生效且词表跟层走；③ 有偏好学生的扫码请求指定其他层 → 服务端拒绝；④ 全量测试构建通过 |

---

## P5 ⬜ 新词教学卡（产品规则 1）

**解决**：审计 §二.4 —— 新词第一面是不可回答的挖空；复习卡丢中文提示；来源显内部编号。

| 项 | 内容 |
|---|---|
| 文件 | 仅 `MyVocabReview.tsx`（新词 reps=0 渲染教学面：词+音标+中文+原句词高亮，按钮「记住了，继续」计一次 good 起点？——**不写评分**，只标已见：调用现有 review 接口 rating=again 会污染调度 → 方案：教学面点继续时按 rating='good' 且 elapsed 正常写入，作为首次学习记录，与 0bb422d"先翻卡"语义一致）；复习卡正面加中文释义提示行；来源名过 `readablePaperTitle`（从 lesson-rules 导入或复制到 web 端 lib） |
| API/DB | 无变更（复用 POST /vocab/review） |
| 风险 | 低。纯前端一文件；教学面写 good 会让新词 1 天后再见（FSRS 首评语义），符合"明天复习"预期 |
| 验收 | ① 新词卡直接显示词/音标/释义/例句，无猜词步骤；② 复习卡正面有中文提示；③ 来源显示《人话标题》；④ 教学面点继续后该词次日到期；⑤ web 测试构建通过 |

---

## P6 ⬜ 单词测试成绩实体 + 堵未学先考

**解决**：审计 §二.4/6 —— 自测无成绩记录；兜底会考 reps=0 的词。

| 项 | 内容 |
|---|---|
| 文件 | migration（新表 `VocabQuizAttempt`: id/studentId/date/total/correct/detail Json/createdAt）；`vocab-quiz.service.ts`（出题去掉 reps=0 兜底；新增 `POST /vocab/quiz/attempt` 落成绩）；`MyVocabQuiz.tsx`（结束页显示本次成绩并上报）；`MyVocab.tsx`（历史成绩列表） |
| API | 新增 `POST /vocab/quiz/attempt`（学生 token 必带）、`GET /vocab/quiz/attempts` |
| DB | 纯新增表，零存量影响。**回滚**：删表 |
| 风险 | 低。FSRS 写回路径不动（成绩是**另存**，符合"分开保存"） |
| 验收 | ① 自测一轮 → 成绩页显示 N/M 并入库；② 出题永不含 reps=0 词（单测）；③ 生产走查 + 全量测试 |

---

## P7 ⬜ 阅读/词汇成绩拆分展示

**解决**：审计 §二.4 —— 卷内词汇分混入 totalScore。

**切片范围**：仅展示层拆分（按 `snapshotContent.vocabTrack` 拆算），
存储不动 —— totalScore 语义保持（判分队列/看板/历史对账不破）。

| 项 | 内容 |
|---|---|
| 文件 | 结果页 + `MyHistoryDetail.tsx`（显示「阅读 X/Y · 词汇 Z/2」）；服务端结果接口附 `vocabScore` 字段（由 AnswerScript×vocabTrack 现算） |
| API | 结果响应纯新增字段 |
| DB | 无 |
| 风险 | 低 |
| 验收 | 轻量层交卷 → 两个分数分行显示、相加等于 totalScore；其他层无词汇行；测试构建通过 |

---

## P8 ⬜ 学→测串联 + 任务总结页

**解决**：审计 §一.⑤⑥⑦ —— 测是自愿的；无总结。

| 项 | 内容 |
|---|---|
| 文件 | `MyVocabReview.tsx`（after=submit 翻完 → 直接进自测，替换现"≥4 张给入口"）；新 `TaskSummary.tsx`（读 DailyLessonCompletion + VocabQuizAttempt + 当日答卷：三段状态/阅读分/词汇测试分/连胜）；自测完成 → 跳总结；`lesson.service` stage 推进到 done |
| API | 复用 lesson/today + quiz/attempts，必要时总结聚合端点 |
| DB | 无（依赖 P3 stage、P6 表） |
| 风险 | 低中。串联加长交卷后的必经路径 → 保留「跳过」到总结（学习不强制，总结必达） |
| 验收 | 新生完整走一遍 = 章程七阶段逐屏对应；每阶段刷新恢复（P3 验收在此复验）；测试构建通过 |

---

## P9 ⬜ 入口与实现去重

**解决**：审计 §二.6 —— /scan 路由×3、/me 三段手拼与 lesson API 双口径、成绩入口×4。

| 项 | 内容 |
|---|---|
| 文件 | `App.tsx`（/scan 归一为守卫前单点注册）；`Me.tsx`（三段改调 `api.lessonToday`，删 3 个裸 fetch —— 口径统一到服务端，auto_closed/目标冻结自然生效）；成绩入口保留 /my-history 单一详情源，其余为链接 |
| API/DB | 无 |
| 风险 | 中。Me 页行为变化（口径更严）需向教师说明：被系统收卷的读段从 ✓ 变「已自动收卷」 |
| 验收 | /me 与 /my-lesson 三段状态逐项一致；/scan 三种登录态均可达；测试构建通过 |

---

## P10 ⬜ 身份收敛 + 死列清理（最后）

**解决**：审计 §二.1 —— 匿名读路径与正式账户并存；死列。

**切片范围**：双模式灰度：`STUDENT_READ_REQUIRES_AUTH` 按班开关；
已注册学生的读接口要求 token，未注册班级维持姓名读；教师端显示未注册
名单（注册看板已有）。死列（pinClaim×3）在确认零引用后单独迁移 DROP。

| 项 | 内容 |
|---|---|
| 风险 | 高（把人关在门外的历史教训）。前置：注册覆盖率报表；灰度从测试班→轻量层班 |
| DB | DROP 3 列：迁移+回滚（列可重建、数据本为空）说明随片提交 |
| 验收 | 开关关=零行为变化；开关开的班：无 token 读 401、有 token 正常；未注册学生在开关班有兜底提示；覆盖率 100% 的班才允许开启（服务端校验） |

---

## 依赖关系与顺序依据

```
P1 P2 互不依赖（先 P1：数据防线优先级最高）
P3 独立；P4 独立
P5 独立；P6 独立；P7 独立
P8 依赖 P3(stage) + P6(成绩表)
P9 依赖 P3（Me 切到 lesson 口径前，stage 语义先稳定）
P10 依赖注册覆盖率，永远最后
```

用户批准某片后：把该片标 🔶 → 按章程工作法实施 → 验证 → 标 ✅ 并在
docs/refactor-progress.md 记录 修改文件/验证结果/未验证项。
