# 每日英语 App —— Claude 开发迁移日志

> 更新日期：2026-09-03（Asia/Singapore）  
> 仓库：`publicmain/exam-paper-system`  
> 当前基线：`main` / `0c17ab1` / tag `production-backlog-2026-09-02`  
> 文档目的：让 Claude 在不重新猜产品、不退回旧流程的前提下，直接继续维护和完善已经上线的学生每日英语 App。

## 盲测与修复 —— 2026-09-05（晚）

叶老师让一个**对产品一无所知**的测试员（子代理，只拿到链接和一个测试账号）
用浏览器把学生端从注册到改密码走了一遍，挑出 19 条；叶老师要求 **100% 修复**。
逐条如下（编号与报告一致），全部已改、有测试、本地通过：

| # | 问题（测试员原话摘要） | 修法 |
|---|---|---|
| P0-1 | 配对题组共用第一题的选项库，第二题选项其实不同 | 外壳：组内选项不一致就不共享（`groupQuestions`）；内容包：指令与题目之间改成空行（外壳按空行拆指令，原来单换行导致指令在每题里重复）；25 份卷已重发 |
| P0-2 | 交完卷再打开答题页是一张空白可编辑卷 | 答卷视图新增 `submissionStatus` / `finalSubmitted`；答题页已交卷直接 replace 到结果页；保存撞上 `submission_locked` 显示「已经交了」+「看结果」 |
| P1-3 | 周末首页说有单词任务、点进去是死胡同 | `lib/teaching-day.ts`；周末且无当日会话时首页单词卡「暂未开放」、主行动改为说明；`/coach/learn` 周末页有「回首页」；「我的单词」周末不显示开始按钮 |
| P1-4 | 交卷不提示有题没答 / 标记了 | 确认框写明「还有 N 题没作答，M 题还标着」 |
| P1-5 | 一个词的填空「还在判分」；历史页看不到客观分 | 精确匹配判出的短答算确定性判分（`deterministicallyGraded` 认 short_answer，AI 判的仍不算）；结果 / 历史 / 课程页新增 `releasedScore` 小计「客观题 6 / 6 · 其余等老师批」 |
| P1-6 | 结果页没解析 | 上一轮已修（`resolveResultExplanation`） |
| P1-7 | 登录报错指向不存在的「还没注册？」 | 文案改为页面上的「第一次使用？注册」 |
| P1-8 | 单词抽查答完没有对错、没有回顾 | 每题答完先给对错 + 正确答案，点「下一题」再走；交卷后逐题回顾（错的排前面） |
| P2-9 | 音标混西里尔 ә、有的没斜杠 | `lib/word-display.ts` `formatPhonetic`，七处显示统一 |
| P2-10 | 「other. n. 大灾难」 | 显示层 `posLabel` 不显示 other、释义自带 n. 时不重复；API `collect()` 词性为空时从释义首行推（`inferPosFromTranslation`） |
| P2-11 | 「高考 六级 考研」标签、[化] 义项、「追加到第 7 题」看不懂 | 标签只留雅思 / 托福 / GRE；`cleanTranslation` 去掉专业义项行；填空按钮改为「把 “X” 填进第 7 题的空」，学生答了别的题目标就作废 |
| P2-12 | 「加入我的单词」和「稍后再学」结果一样 | 服务端：加入 = 第 2 阶、到期今天；稍后 = 第 1 阶、到期明天；两处 UI 加一行说明 |
| P2-13 | 「服务器 / 数据库 / 测试待办」 | 文案全部改成学生话 |
| P2-14 | 中文标点后多空格 | JSX 里不在标点后换行（Register / Account / MistakePractice） |
| P2-15 | 「盲测乙IAL26W」粘连；输名字就能看到班级 | 分隔符单独一个节点；**登录改为先核密码再消歧**：密码对得上一个直接登录，对得上多个才列班级，都不对统一 invalid_credentials |
| P2-16 | 改密码被强制登出；登录页两条提示叠加 | change-pin 返回新 token，本机换票不登出（其它设备照样作废）；登录页有错误时不显示旧提示 |
| P2-17 | 没交卷的卡片写「成绩还没出来」 | 未交卷显示「还没交卷」 |
| P2-18 | 密码框弹全键盘、不限长 | `Field numericPin`（inputMode=numeric）；注册页两框 maxLength=6；登录不过滤字符（旧账号密码可能带字母） |
| P2-19 | 配对按钮无选中态、首页卡片无名字 | `aria-pressed` + `aria-label`；卡片 `aria-label="阅读：完成，…"` |

**盲测环境**：`scripts/pilot/smoke-session-today.js` 造了一个注册页看不见的
「QA 盲测班」（`p1_class_qa`，code `QASMOKE`）并把 09-04 的五份卷挂成当天场次；
账号 `QA盲测甲`（已挪进 QA 班）+ 测试员自己注册的两个「盲测乙」（OL26W / IAL26W）。
这些账号周一前归档，QA 班场次用 `--remove` 删。

**没修的（按测试员说法是设计，叶老师没另说）**：无。

## 后续决定 —— 2026-09-05（首发前最后一轮修复）

叶老师原话：「判完直接推」「旧账清掉」「现在开始修复所有问题」。据此做了
下面几件事，全部已在本机验证；**push / 部署仍需叶老师批准**（见文末部署记录）。

1. **判分改成一步直推。** 每晚叶老师在聊天说「判分」→ Claude 倒出待批
   队列（`marker-dump.ts --dates=… --json=…`，匿名代号）→ 按 rubric 判 →
   写判分文件 `.local/grades/<日期>.json` → `marker-apply.ts --file=…` 写回、
   重算总分、submitted → marked。**不再等「确认发布」**。回聊天的是汇总 +
   拿不准的题。`marker-apply.ts` 不再内嵌 GRADES 表（历史表在 git 里）。
2. **旧账已清。** 旧早测班 `G11 IELTS Test (morning-quiz)`
   （classId `cmoux0jj900m9oc28r4sptjj0`）08-24 ~ 09-04 仍是 `submitted` 的
   **31 份**答卷，用 `marker-apply.ts --close-legacy --class-id=… --dates=…`
   翻成 `marked`：未判的主观题**不给分**，只写评语「旧早测已停用，本题未判分
   （不计分）」，总分按已判部分算。答卷 ID 见 `.local/grades/legacy-close-2026-09-05.log`
   （本机，不进仓库）。清完后判分队列只剩 1 份 09-01 IAL28S 的归档测试号
   （`cmtjkuijk0150utrzmzjlt1tq`），故意没动。
3. **答案位置修复。** 首发周内容包里四选一题的正确项原来固定在最后一个
   选项（生产里 30/30 填空题答案都是 D）。`week2/adapters.js` 的 `mcqOptions`
   改成按选项文字做确定性打乱；重发后分布 multiple_choice A8/B4/C11/D2、
   sentence_completion A7/B6/C9/D8。判断题（A/B/C 固定映射 TRUE/FALSE/NG）
   与段落配对（答案即段落字母）不打乱，这是题型本身的规矩。
4. **250 题盖住答案全部重做。** 五档 × 5 天，客观题 150 道盲答与答案键
   0 不一致；主观题 100 道与要点吻合。工具在会话 scratchpad
   （`blind-dump.js` / `blind-diff.js`），不进仓库。
5. **结果页解析。** 发布脚本把 `explanation` / `evidence` 写在
   `answerContent` 与 `snapshotAnswer`，而 `getStudentResult` 只读
   `snapshotContent.explanation` —— 首发周 250 题在结果页一条解析都没有。
   新增 `resolveResultExplanation`（snapshotContent → snapshotAnswer →
   question.answerContent 三级回退），结果页 / 历史详情 / 练习卷三条路径共用，
   并多发一个 `evidence`（原文依据）字段，与 `explanation` 同一道答案门。
   学生端 `ResultView` 在解析下面渲染「原文依据：…」。
6. **老师批卷页参考答案。** `MarkerScript.tsx` 原来只有原文 / 题干 / 学生
   答案 / 打分框。现在主观题上方有「参考答案 · 评分标准」块：参考答案、
   也算对（accept 里与参考答案不只差大小写的写法）、评分标准（rubric，兼容
   旧 markScheme）、原文依据。
7. **发布脚本的答卷指纹门是真的会拦。** 重发 09-08 那天，我同时在清旧账
   （写 `StudentSubmission`），脚本比对前后指纹发现变了，整天回滚、退出码 1。
   这是它该做的事。教训：**发布期间不要对生产库做任何写操作**，一天发完
   再做别的。09-08 之后单独重发了一次。

叶老师下午追加「单词这块今天全部完成」，于是同一天又做了三件（见 §4.10）：

8. **去重只看拼写。** 「见过」= 这个拼写在学生名下任何归属行里出现过
   （不管来自 NGSL / NAWL / 老师词表 / 阅读时自己加的 personal 词）。原来
   按 senseId 判，换词表、升版本、或者学生阅读时加过同一个词，都会再推一遍。
   `seenHeadwords()` + `collectUnseenFromList()`。
9. **每日新词凑够 10 个才停。** 原来读词表前 100 个再去掉见过的，学生学到
   词表后半段、或阅读时加过很多词之后，那天会不足 10 个。现在顺着游标读到
   凑够（多凑 5 个给规划器挑），主表读完去备用表接着凑。
10. **老师词表流水线 `scripts/vocab-v2/publish-word-list.ts`。** 叶老师只给
    词表 + 周次 +（可选）班级，其余全由脚本 + 我完成。三堵墙拆掉：每天 1–20
    个（默认往 10 凑）、词表外的词允许（我在 content.json 里补释义例句）、
    发布前有预览与按班查重报告。新增 `VocabularyV2AssignmentItem.force`
    列（migration `20260905160000_vocabulary_assignment_force`）：老师标
    `*word` 的词，见过的学生也照推；其余见过的学生在开始当天任务时各自跳过，
    老师的词全学过的学生当天回到档位词表。**本地空库跑通了 publish → verify
    → 三种历史的学生各开任务（跳过 / force / 回退档位词表）**；生产库要等
    迁移随部署上去之后才能发（`force` 列现在还不存在）。

### 2026-09-05 生产记录

| 时间（SGT） | 动作 | 结果 |
|---|---|---|
| 15:30–15:37 | 重发 09-07 | ✓ |
| 15:37–15:45 | 重发 09-08 | ✗ 答卷指纹变了（我同时在清旧账），整天回滚 |
| 15:45 | 清 G11 旧账 31 份（`--close-legacy`） | ✓ 队列只剩 1 份归档测试号 |
| 15:45–16:10 | 重发 09-09 / 09-10 / 09-11 | ✓ |
| 16:10–16:17 | 单独重发 09-08 | ✓ 指纹未变 |
| 16:18 | 只读核验 | 25 组合齐；250 题快照与内容包逐题一致、都有解析；四选一答案位置 A8/B4/C11/D2 + A7/B6/C9/D8 |

代码改动（结果页解析、批卷页参考答案、判分脚本）**尚未 push / 部署**，
等叶老师批准：push `main` 触发 API + 教师端自动部署；学生端另跑
`cd apps/student-web && railway up -s student-web -e production --detach`。

## 后续决定 —— 2026-09-04

**每日新词只来自档位词表（NGSL / NAWL），与当天文章无关。这是设计，不要改。**

叶老师原话：学生就是要学每天从词表推送的词；阅读时自己选择加入生词本的词
是额外的、自愿的。每个学生这学期要学会的词是固定的一套，别把设计想复杂。

由此明确三件事，省得以后有人"修"它：

1. `Paper.config.lessonWords` / `lessonWordReserves`（内容包里按文章挑的词）
   和发布脚本每天写的 `StudentWord` 行，**学生端根本不消费**——学习页走
   `/vocab-v2/daily/start`，按 `level-policy.ts` 从官方词表取。这些字段是旧
   路径的遗留，留着无害，但**不要再花时间维护它们的质量**。
2. 每天 10 个词（`StudentVocabularyProfile.dailyTarget` 默认 10），不是文档
   和 `s12m-launch.md` 里写的 12。对外说法按 10。
3. 老师布置接口（`POST /vocab-v2/teacher/assignments`）保留，但不用它把文章
   词塞进去。

## 后续决定 —— 2026-09-03（下午）

叶老师在这次对话中明确的四条，优先级高于本文其余内容：

1. **产品尚未上线**。文中「已部署 production、学生每天在用」要按此修正：
   生产库里那 41 个账号**全是测试账号**（09-01 注册 27 个、09-02 注册 15 个），
   不是真学生。所以「41 人里只有 3 人进过阅读」是测试行为，不是产品缺陷。
2. **首发日是 2026-09-07（周一）**。
3. **旧早测（`G11 IELTS Test (morning-quiz)` 班，35 人）要停掉**，那批学生
   迁到新 App。因此他们**读过的**文章不能再发给他们。
4. **测试账号与其数据暂不清理**，上线前再定。

### 这次做完的事

**首发周内容包（2026-09-07 ~ 09-11）已完成**：五档 × 五天 = 25 天，
250 道题，500 个词条，318 句例句中文（全部人工复核）。代码在
`scripts/pilot/content/week2/`，装配进 `content/index.js`。

内容来源按「**学生读没读过**」筛选，不是「题库里有没有」：

| 档位 | 改编 | 原创 |
| --- | --- | --- |
| ielts_simplified | `basic-06/08/09` | The Library Clock、The Long Way Round |
| olevel_intermediate | `lost-wallet`、`new-glasses`、`paper-lantern`、`swimming-lesson` | The Wrong Name |
| olevel | `the-tutor`、`void-deck-wake`、`recipe-card`、`letter-from-tekong` | Taking the Other Side |
| ielts_light | `light-07/08/09` | Keeping Time by Rail、The Smell of Rain |
| ielts_authentic | `p06-tea-trade`、`adapted-v5/test2-passage1` | The Root Network、Cement That Heals、The Horse Before the Wheel |

**仓库的 fixture 库基本用尽**：约一百篇里只有 17 篇没发到过学生手上，
这 25 天正建立在那 17 篇加 9 篇原创上。**第三周起必须自己写**，没有存货了。

### 顺带修掉的四个问题（都会影响学生）

1. **发布查重门口径错了**。原来比「题库里有没有」，而这道门要回答的是
   「学生会不会重复读到」。题库里躺着 78 篇从未发出去的文章，按旧口径全被
   拦死。已改为只比**挂过作业且真有学生答卷**的内容
   （`prepare-pilot-week.js` 的 `deliveredHistory`）。
2. **查重比错了对象**。原来拿整条题干比，而同一题组的指令是故意完全相同的
   （雅思标准指令一天三道判断题共用一份）。实测第一周相似度 0.788、
   首发周 0.818，一个刚好在 0.8 阈值下、一个刚好在上 —— 通不通过取决于题面
   长了几个词。已改为只比指令之后的题目本身（`content-similarity.js` 的
   `questionItem`）。
3. **配对题的选项库不统一 + 答案成等差**。IELTS 外壳的共享选项区取自该组
   **第一题**的 options，而 `simplified-*` 那批库文件每题选项顺序不同 ——
   学生照第一题的字母表作答，后三题按各自映射判分，答对判错。另有三份库文件
   四道题答案原样就是 A、B、C、D。已在 `from-1128.js` 统一选项库并做确定性
   打乱，排出等差序列就换种子重排。
4. **词表是多义项堆叠**。ECDICT 把一个词所有义项塞进一个字段，`umbrella`
   的英文释义里有「在地面作战上空维持的军用机编队」，`cleaning` 的中文里有
   「家畜的胞衣」。已加义项裁剪（`build-week2-vocab.js` 的 `trimSense`）。
   **第一周那两个改编档没有回改** —— 它们的词表已提交，而第一周 09-04 结束、
   09-07 才上线，那批卡片不会发到真学生手上。

另外：库文件的 exercise 2 指令里带着一句内部说明
（"each blank is split into its own MCQ so each sub-part can be auto-graded
independently"），会原样显示给学生，已换成自己写的短指令。

### 验收状态

- 内容合同测试 860 条全过（`pilot-week-content.spec.ts`，已扩到两周）
- API 2654 条通过；`morning-quiz-qa.spec.ts` 有 **2 条本来就红**（提示词断言，
  与本次改动无关，单独跑也红）
- 学生端 825 条全过；API typecheck / build / `prisma validate` 均通过
- 拿生产库做了只读演练：**首发周五天、五档全部能过发布查重门**

### 发布结果（2026-09-03，叶老师批准后执行）

**首发周五天已全部发布到 production**，逐天跑
`prepare-pilot-week.js --day=…`，25 个「日期 × 档位」组合全部核验通过：
每档每天 1 份卷、10 道题、12 个主词 + 12 个同文备用词、10 个班各一场。
每次发布后脚本的硬断言都是 ✓：答卷指纹、非试点生词、复习流水、错题 / 申诉、
当日任务行**全部未变**。

发布过程中修的两个问题：

1. **事务超时**。`upsertDictionary` 原来遍历 `content.allWords()`（内容包
   所有日期），内容包变成两周后是 795 条，每条一次 `findUnique` 跨洋往返，
   把 Prisma 的 5 分钟事务预算跑爆。抛出来的是
   「Transaction not found. Transaction ID is invalid…」，看着像连接问题，
   实际是超时 —— 第一次发布因此整体回滚（已核对：无半截数据）。已改成
   按天补录（`content.wordsForDay`，约 100 条）+ 一次 `findMany` 批量取回，
   事务预算同时放宽到 15 分钟。
2. **`PARK_UNTIL` 写死成 `2026-09-14`**。第一周（到 09-04）时它在教学日
   之外没问题；内容包按周累加后，写死的日期迟早会落进某一周的教学日里，
   把「推到以后」的词推到学生正在上课的那天，且不会报错。已改成从内容包
   最后一天推算（今天算出来仍是 09-14，等价）。

### 2026-09-04 部署记录（叶老师批准后执行，19:52–19:54 SGT）

| 服务 | 来源 | 部署 ID | commit | 回滚点 |
| --- | --- | --- | --- | --- |
| exam-paper-system（API） | GitHub `main` 自动 | `ae3c6d33` | `732b3a4` | 部署 `ff94f50a` / `0c17ab1` |
| nurturing-radiance（教师端） | GitHub `main` 自动 | `1fa57a51` | `732b3a4` | `5e232f1d` / `0c17ab1` |
| pdf-worker | GitHub `main` 自动 | `9d1bd571` | `732b3a4` | `368c48aa` / `0c17ab1` |
| student-web | `railway up` 手动（apps/student-web） | `68aa63e5` | `732b3a4` | `7807354b` |

烟测：`/api/health` 回报 commit `732b3a4`；注册页班级列表 9 个班；学生端首页
200，线上 bundle `index-BHn-mTX-.js` 含新文案；API 启动后 cron 正常 tick
（`daily tasks ready for 6/6`）。无数据库迁移。

启动日志里有一条 **`[ContentBootstrap] bootstrap failed (continuing): ENOENT
…cambridge-ielts-gt-14/test1-section1.json`** —— 这是本次之前就有的：那批
剑桥原文在提交 `4ce1184` 因版权被移出仓库并 .gitignore，镜像里自然没有，
服务照常启动。与本次改动无关，也不影响学生端。

### 2026-09-04 审查后修掉的三处（已部署，见上表）

按「周一真学生会撞上什么」逐段追代码，修了三处，均带回归测试：

1. **周末不再生成每日新词**。`daily-task.cron.ts` 原来一周七天每 10 分钟给
   所有活跃学生建任务，`startDailySession` 也没有工作日判断；周一打开首页
   会多出周六、周日两条「新词没学完」的欠账。现在 cron 和按需创建都只认
   周一到周五（新加坡日历，`isTeachingDay`）；周末打开学习页会明确说
   「周六周日没有新词任务」，而不是报「无法生成」。
2. **「稍后再学」的词会回来**。原来 skip 只把项标成 `skipped`，会话照样
   completed，而该词的归属行让它被 `unseenCandidates` 永久排除、词表游标
   也早已越过它 ——「稍后」等于「再也不」。现在 `startDailySession` 把
   `deferredSenseIds`（点过稍后、之后从未学完、仍在我的单词里且未被移出 /
   未标已会）排到当天任务最前面，且不回拨词表游标。
3. **0 题的词测待办不再出现**。全点「稍后」会得到一个 completed 但 0 个
   completed 项的会话；`pendingDailySessions` 原来不看可测题数，首页会列出
   「9月7日 · 0 个词 · 开始」，点了后端 400、前端没有 catch、按钮像死了。
   现在规则层过滤掉 0 可测项的日期（学生首页与教师总表同口径），首页的
   开始按钮也加了错误提示。

未改、已记录的：`pick-session.ts` 的 `LEVEL_ORDER` 只有三档（仅在某档当天
漏发时才有影响）；34 个自助抽查会话卡在 in_progress（脏数据，不显示）；
`POST /student/submissions/:id/submit` 这条旧路由没挂 AI 判分开关（学生端
不走它）。

### 还没做的（上线前必须）

1. **阅读链路没有真人走查**。41 个测试账号里只有 3 个进过阅读，等于这条链路
   基本没被人走过。上线前必须在手机和 iPad 各走一遍完整闭环。
2. ~~周一早上要不要重跑一次发布~~ —— **不需要**。这条原本担心真学生没有
   发布脚本建的 `StudentWord` 行；2026-09-04 已确认学生端根本不消费那些行
   （见顶部「后续决定」），每日新词由 vocab-v2 按需 / cron 从词表生成。
   不要为此重跑发布。
3. 判分队列积着 34 份（其中 20 份是 8 月 25-27 日的旧早测遗留）。
4. 测试账号与旧早测班的收尾（含注册页要开哪几个班）。
5. 上线物料：正式二维码、安装教程 PDF。

---

## 0. Claude 接手前必须先看这一节

这不是一个从零开始的“试卷系统”。当前仓库同时包含两类产品：

1. 教师/管理端的 Exam Paper System；
2. 已从旧页面中拆出的独立学生端“每日英语 App”。

学生端已经存在于 `apps/student-web`，并已部署到 production。旧 `CLAUDE.md` 和部分 `docs/reconstruction/*` 仍保存重建早期的状态说明，例如“`apps/student-web` 不存在”“生产未核实”“七步必须线性完成”。这些句子已经过期。

Claude 读取资料时按以下优先级处理冲突：

1. 叶老师在当前对话中的最新明确要求；
2. 本迁移日志；
3. `docs/PRD/vocabulary-coach-v2-acceptance.md`；
4. 当前代码、数据库 schema、契约测试与 Railway 实际部署状态；
5. `docs/reconstruction/*` 中仍未被后续决定覆盖的架构原则；
6. 旧 PRD、旧 staging 验收包和历史开发日志只作背景证据，不能覆盖前五项。

接手后不要再进行没有直接用户价值的架构深挖。优先保证真实学生每天能完成阅读、学词和测验，老师能看到进度、判分与成绩；小范围上线后按真实反馈快速修复。

## 1. 当前真实状态

### 1.1 代码与部署

- 当前 Git：`main` / `origin/main` 在 `732b3a4`（2026-09-04 部署基线；原文写本日志时是 `0c17ab1`）。
- Railway 项目：`glorious-motivation`，环境：`production`。
- 学生正式入口：`https://student-web-production-5a21.up.railway.app`
- API：`https://exam-paper-system-production.up.railway.app`
- 教师/旧 Web：`https://nurturing-radiance-production.up.railway.app`
- 运营后台：`https://ops-dashboard-production-9b67.up.railway.app`
- 数据库：Railway managed Postgres。
- 学生端、API、教师端均有成功的 production 部署记录；API/旧 Web 对应当前 Git 基线。
- 学生端由 CLI 部署，平台不记录 commit SHA，所以每次部署都要像上面的「部署记录」那样把 commit 与部署 ID 写进本文件。当前学生端 = `68aa63e5` / `732b3a4`。

### 1.2 绝对不能混用的地址

`https://stg-student-web-spike-production.up.railway.app` 是 staging，不是正式学生入口。

任何通知、二维码、PDF、主屏安装教程和家长/学生消息都必须使用正式入口。发布物料前必须实际扫码并核对最终落点，不能因为地址中都含 `production.up.railway.app` 就误判。

### 1.3 秘密与凭据

- Azure Translator 密钥已经通过运行环境配置使用，但密钥本身不得写入文档、Git、日志、截图或聊天回复。
- Anthropic API 额度已到限制，当前铁律是默认零 Anthropic API 调用。
- 未经叶老师在当前对话明确批准，不得 push、部署、运行生产迁移或进行不可逆数据操作。
- 生产排障优先只读；必须写库时先限定学生、日期、会话或记录 ID，先 dry-run/快照，再执行并留下审计。

## 2. 产品目标与不可回退原则

叶老师要的是一个学生每天愿意打开、老师能够运营的成熟英语 App，不是“能跑就算完成”的毛坯页。

核心原则：

- 学生第一次打开即可自己注册，不依赖老师预建账号，也不依赖二维码或姓名查询链路。
- 注册时自己选择班级；不使用班级码。
- 班级与英语难度是两件独立的事，界面不要解释“某班对应某难度”。
- 学生自己选择五档难度，系统记住；以后可在设置中修改。
- 已开始和历史课程按冻结时的难度完成，改难度只影响下一次尚未开始的内容。
- 首页不是一道封闭的线性门。学生能进入阅读、我的单词、历史成绩；错题本如显示，只能显示“暂未开放”。
- 阅读、结果与历史详情必须像同一个产品、同一份试卷，不能三套布局。
- 每日遗漏任务不消失、不覆盖；第二天同时看到旧待办与当天任务。
- 生词本和词汇教练必须是一套功能、一份数据，名称统一为“我的单词”。
- 不安排系统复习任务，不做强制错词重测，不用 FSRS 生成学生待办。
- 所有重要操作都要有明确回执；不能让学生猜是否保存、加入、移出、换词或交卷成功。
- 手机与 iPad 都是正式目标端。iPad 必须利用宽屏，不得把所有内容塞进 448px 的手机窄栏。

## 3. 学生完整流程

### 3.1 第一次注册与登录

注册步骤：

1. 选择当前开放的班级；
2. 输入姓名；
3. 自设 PIN/密码；
4. 从五档中自行选择英语难度；
5. 注册成功后进入“今天”。

约束：

- 不显示或要求班级码。
- 班级列表只能返回未归档、允许自助注册且完整提供五档内容的班级。
- 同一班级内姓名归一后不能重复注册；姓名显示保留学生输入的正常大小写。
- PIN 必须阻止明显弱口令；错误提示要说人话。
- 身份只来自服务端验证的学生令牌。URL 不携带姓名或 `studentId`。
- 令牌失效回登录页；不能回到旧的姓名查询或扫码页。
- 第二台设备要正常重新登录，不迁移旧 `#h=` AirDrop 令牌方案。

五档顺序与对外名称：

1. `ielts_simplified` —— O-Level 基础
2. `olevel_intermediate` —— O-Level 进阶
3. `olevel` —— O-Level 标准
4. `ielts_light` —— 雅思轻量
5. `ielts_authentic` —— 雅思 · 真题型

当前实现位置：

- 服务端白名单：`apps/api/src/student-auth/pilot-levels.ts`
- 学生端名称与说明：`apps/student-web/src/lib/levels.ts`
- 注册：`apps/student-web/src/pages/Register.tsx`
- 设置中换难度：`apps/student-web/src/pages/Account.tsx`

两端难度列表有契约测试，修改时必须同步，不能再次退成三档。

### 3.2 首页与任务模型

首页要清楚回答三件事：今天有什么、以前欠什么、下一步点哪里。

任务按日期独立保存，不得用“今天状态”覆盖旧任务：

- 阅读欠交：保留原日期、文章与草稿，可继续完成。
- 新词没学完：保留原日期、已完成位置与剩余词。
- 正式词测未完成：按学习日期一直保留。
- 如果学生某天只做了阅读，单词学习/单词测试继续欠着。
- 如果只做了单词，阅读继续欠着。
- 如果两项都没做，两个任务都保留；第二天还会出现当天的新任务。
- 管理后台也必须使用同一口径统计，不能学生端说欠两项、后台却显示完成。

当前 V2 `overview` 已返回 `readingBacklog`、`learningBacklog`、`pendingTests`；生产基线包含“跨日保留学生任务”的实现与验收脚本。

### 3.3 每日阅读

- 每天按学生当前难度提供一篇文章与一组题。
- 答题顶栏显示“本次难度”；不要倒计时。
- 草稿必须自动保存，刷新、临时离开、换设备后能够恢复。
- 返回/退出按钮在顶部可达位置，不能放在长列表最底部。
- 提交前提示未答题；重复点击不得重复交卷。
- 保存失败、离线、补传中、补传成功都要有可见状态。
- 阅读文章中点词可查实时翻译；查词本身不等于收藏。

### 3.4 阅读结果、成绩历史与界面一致性

答题页、刚交卷后的结果页、以后从历史成绩打开的详情页必须复用同一套：

- 文章渲染；
- 题型组件；
- 左文章/右题目宽屏结构；
- 手机纵向或文章/题目切换结构；
- 字号、题号、选项、学生答案与解析样式。

历史详情必须还原学生当时作答的冻结版本：文章、题目、选项、正确答案、学生答案、得分、解释/评分点。不能用后来被修改的实时题目覆盖历史。

选择题可立即显示客观结果；仍有人工题待批时清楚显示“待批改”，不得把部分分伪装成最终总分。教师完成判分后，历史成绩与后台同步显示最终分数。

当前相关实现：

- 阅读：`apps/student-web/src/pages/Reading.tsx`
- 结果：`apps/student-web/src/pages/ReadingResult.tsx`
- 历史：`apps/student-web/src/pages/Scores.tsx`
- 历史详情：`apps/student-web/src/pages/ScoreDetail.tsx`
- 共用结果组件：`apps/student-web/src/components/ResultView.tsx`
- 共用阅读/题型组件：`apps/student-web/src/lesson/*`

不要为了改历史页复制第四套题型渲染器。

## 4. “我的单词”最终设计

### 4.1 一个入口、一份数据

学生端只保留“我的单词”这一产品概念。旧“生词本”“词汇教练”“复习队列”不能作为三套并行数据继续生长。

主数据是词义级实体：同一拼写不同词性/词义可以是不同 sense；同一词义从多个来源进入时只能有一份学生归属记录。

核心表：

- `VocabularyLexeme`：词形和官方词表来源；
- `VocabularySense`：词性、英文释义、中文释义、内容版本；
- `VocabularyContext`：短而聚焦的例句、例句翻译和来源；
- `StudentVocabularySense`：学生是否拥有、是否在“我的单词”、掌握状态、实际学习次数；
- `VocabularyCollectionEvent`：从阅读、搜索、每日推送或老师布置等来源进入的事件；
- `VocabularyV2Session` / `VocabularyV2SessionItem`：每日学习、正式词测和自助抽查的冻结会话与题目快照；
- `VocabularyV2Assignment`：老师按班级和日期发布的 12 词列表。

旧 `StudentWord`、旧复习服务和旧 `VocabQuizAttempt` 仍存在是为了迁移/兼容，不代表可以重新用它们开发一套新入口。所有新学生行为优先走 `vocab-v2`。

### 4.2 单词从哪里来

当前正式口径：

1. 老师当天为班级明确布置的 12 个词，优先级最高；
2. 没有老师列表时，按学生五档难度，从版本化的 NGSL/NAWL 官方词表选新词并补足学生的每日目标；
3. 学生在阅读查词卡中主动选择“加入我的单词”；
4. 学生主动搜索后选择加入；
5. 阅读错误暴露出的薄弱词可以记录为来源，但当前不能因此自动生成强制复习任务。

“阅读加入/主动搜索加入”会进入个人单词集合，可用于自助抽查，但不能在以后又伪装成“从未学过的每日新词”。

### 4.3 全局去重（2026-09-05 起只看拼写）

生成每日新词前，排除这个学生曾经以任何来源见过的**拼写**（2026-09-05 起
不再按 sense / lexeme 判 —— 换词表、升版本、阅读时加的 personal 词都算同一个词），包括：

- 待学习；
- 学习中；
- 已学完；
- 已掌握；
- 已移出；
- 曾点击“我会了，换一个”；
- 曾从阅读或搜索加入。

唯一例外是老师明确强制布置；强制布置可重新激活以前学过或移出的词。除此之外，“新词”绝不能重复推送。

代码入口：`apps/api/src/vocab-v2/unified-vocabulary-rules.ts` 的 `seenHeadwordSet` /
`collectUnseenFromList` / `teacherItemsForStudent`，以及 `VocabularyV2Service.seenHeadwords()`
（`startDailySession` 与 `createTeacherDailySession` 共用）。

### 4.4 换词

学生点击“这个词我会了，换一个”时：

- 原词记为已会/已见过；
- 原词不算“今天实际学完”；
- 原词不进入当天正式测试；
- 系统在原位置换入一个从未向该学生出现、同样通过质量门的词；
- 总目标数量不变，学习游标不应错误前进；
- 以后自动推送不再选原词；只有学生主动重新学习或老师强制布置才可回来；
- UI 立即换卡并提示成功，失败则保留原卡并说明原因。

### 4.5 学习页只教不考

这是反复出现过回归的硬规则。

每个词只保留两个有真实信息的教学屏：

1. 词义/发音；
2. 短例句/中文翻译/必要的用法提示。

禁止在学习阶段出现中译英、拼写题、填空题、四选一或任何“先考再教”的页面。

某个信息块没有可靠数据时直接隐藏，不能多出一个空步骤，也不能显示“这一项暂时没有可靠内容”。学生截图中 `belong` 的空“常见搭配/词族/易混词/记忆提示”就是明确的反例。

只有点击“学完这个词”才计入累计学词。点击“稍后再学”不计入；点击“我会了，换一个”也不计入。

### 4.6 每日正式单词测验

当天所有新词处理完成后：

- 服务器自动生成一份正式单词测验；
- 测验词集严格等于当天点击“学完这个词”的词；
- 被换掉、标为会了、稍后再学的词不得进入；
- 学生自动回首页；
- 不显示“今天考”“明天考”“现在测试”或“延后”按钮；
- 首页出现按日期命名的“单词测试待办”；
- 学生想什么时候做就什么时候做；
- 没完成就永久保留，不能被第二天覆盖；
- 多天欠测时逐日列出；
- 提交后不自动生成任何复习、重测或错词任务。

测试题必须公平：

- 选择题干扰项只能来自这份冻结学习清单，并优先同词性；
- 不能拿学生从未学过的奇怪词当干扰项，使学生仅凭“只有一个认识”猜答案；
- 同词性、不同释义不足三个时，宁可改成拼写题，也不要填随机词；
- 题数必须等于冻结词数，不允许学 21 个只考 10 个，或只答 13 题就显示 21/21；
- `answered`、`cursor`、`completed`、`target` 必须来自同一份服务端会话状态，不能客户端各自推算。

当前正式题构造器：`apps/api/src/vocab-v2/formal-test.ts`。不要把旧 `vocab` 里的四题型生成器或 `daily-planner.ts` 的旧复习配额混入正式每日测试。

### 4.7 自助抽查

“我的单词”里另有一个自助练习窗口：

- 学生选择 5、10、20 或当前全部单词；
- 只从当前仍在“我的单词”里的词随机抽取；
- 这是个人练习，不写正式成绩，不改变掌握状态，不生成待办；
- 提交后可展示即时结果，然后删除/结束临时会话；
- 管理后台不把它算成每日任务或正式成绩。

### 4.8 移出单词

学生可从“我的单词”移出一个词，含义是“我会了，不再保留”。

- `inNotebook=false` / `removedAt` 记录状态；
- 不硬删除历史、来源、曾学次数或曾参加的冻结测试；
- 不再出现在个人抽查和普通列表；
- 不会因为移出而重新成为“每日新词”；
- 如果学生主动选择重新学习，可以恢复。

### 4.9 不要重新启用系统复习

最终确认的简化方案明确“不需要安排任何复习任务”。仓库里仍有 `FSRS`、`review` source、`due`、`stability`、`difficulty` 和旧复习服务，是历史兼容结构。

当前 daily session 的实际创建路径只把未见过的 `level_gap` 词放入候选；`daily-planner.ts` 里仍保留带 `review` 权重的通用旧算法。Claude 不得因为看到这些字段就把“到期复习”重新放进首页或每日推送。若要清理旧代码，先证明没有迁移/历史读取依赖，再另做安全任务。

### 4.10 老师词表流水线（2026-09-05）

叶老师发来「词表 + 哪一周 +（可选）哪几个班」→ 我做完下面这些 → 回一页确认单。
全程在仓库根目录，零 Anthropic API。

```bash
# 0. 把词表存进仓库：apps/api/scripts/vocab-v2/wordlists/<周一日期>/words.txt
#    一行一个词；# 注释；word, 备注；*word 或 word! = force（见过的也推）。样例见 wordlists/_sample/

# 1. 预览（只读）：清洗、查词、按班按拼写查重、按词性排天；缺释义例句的词写进 needs-content.json
railway run -s Postgres -e production -- npx ts-node apps/api/scripts/vocab-v2/publish-word-list.ts \
  --week=2026-09-14 --words=apps/api/scripts/vocab-v2/wordlists/2026-09-14/words.txt --preview

# 2. 我把 needs-content.json 补成 content.json（词性 / 音标 / 英释 / 中释 / 两句例句 + 中文），再预览一次直到「缺内容 0 个」
#    格式见 wordlists/_sample/content.json。官方词表里的词也可以放进去，用来覆盖库里质量差的 Tatoeba 例句。

# 3. 发布（写库；两道门：确认串 + railway 目标必须是 glorious-motivation/production）
WORDLIST_CONFIRM=PUBLISH_WORD_LIST_PRODUCTION railway run -s Postgres -e production -- npx ts-node \
  apps/api/scripts/vocab-v2/publish-word-list.ts --week=2026-09-14 --words=… --content=… --publish
#    发完自动 --verify：从库里读回，写 confirm.md（每天哪些词、各班少了哪些、每个词是否可发布、有无重复）

# 可选：--classes=IAL26S1,IAL27W（默认九个注册班）、--per-day=8（默认 auto 往 10 凑）、--title=…
```

口径：
- 排天：12 个词 → 周一周二各 6，其余三天回到档位词表；37 个 → 四天 10/9/9/9；
  最多一周 100 个；只排今天及以后的教学日。词性混排，同词性内保持老师顺序。
- 查重：一个班**所有**在册学生都见过、且不 force 的词，这个班不发（预览里列出）；
  部分学生见过的照发，学生开始当天任务时各自跳过（`settingsSnapshot.skippedSeen` 记着）；
  老师的词全学过的学生当天回到档位词表，不会「今天没词」。
- 重发同一周会原地更新（version +1），已开始的学生会话不受影响（会话是快照）；
  天数缩短时多出来的旧布置（标题以「老师词表 <周>」开头的）自动删掉。
- 老师词表那几天档位词表暂停（游标不动），词表发完自动接回。

## 5. 实时翻译与收词

### 5.1 翻译链路

- 优先调用 Azure Translator；默认 4 秒超时。
- 服务进程内缓存 24 小时，降低重复请求延迟与成本。
- Azure 不可用时存在免密降级翻译路径；降级结果仍需做空值与警告文本过滤。
- 查单词时不仅翻译词，还把学生点击位置所在的完整原句提交翻译，必须显示自然的中文例句翻译。
- 例句必须是短、聚焦、能看出目标词义的句子。不能把整篇很长的文章段落复制给每个词；不能多个词都显示同一长段落。
- 对词性/词义要有明确选择，避免 `still` 这种多义词把错误 sense 带入教学与考试。

当前实现：

- 实时翻译：`apps/api/src/vocab/realtime-translation.service.ts`
- 查词服务：`apps/api/src/vocab/vocab.service.ts`
- V2 内容生产：`apps/api/src/vocab-v2/content-producer.ts`
- 内容质量门：`apps/api/src/vocab-v2/content-quality.ts`

### 5.2 查词后的四个选择

查词不应自动加入。学生明确选择：

- 加入我的单词；
- 我已经会了；
- 稍后再学；
- 只查一下。

不要同时出现“加入生词本”和“加入学习计划”。一个点击只能写 V2 数据，不要再双写旧生词本。

## 6. 阅读内容、题目与不重复机制

### 6.1 已有内容基线

第一周试点包包含：五档难度、五个教学日、25 篇原创文章、250 道题；每档每天一篇、每篇 10 题，并准备每日 12 个主词及同文备用词。

这只是第一周冻结内容，不是永远重复使用的模板。以后每周必须准备新文章、新题与对应词汇，并过同一套发布门。

### 6.2 当前去重是复用后增强，不是另一套孤立逻辑

现有发布脚本 `apps/api/scripts/pilot/prepare-pilot-week.js` 使用 `content-similarity.js`：

- 文本先归一为英文 token；
- 文章按连续 5 词 shingle 计算 containment similarity；
- 题干按连续 4 词 shingle 计算；
- 同一内容包内文章阈值为 `0.25`，题干阈值为 `0.8`；
- 发布当天内容前，还读取数据库内最多 10,000 条非试点历史 Question，从其中抽取文章与题干做相同检查；
- 命中阈值就阻止发布。

这保留了旧 Exam Paper System “发布前查重”的思路，并补了“当前周 + 数据库历史”的检查。以后不要另建一套互不相认的去重服务；应该把这段逻辑抽成统一发布质量门，让手工内容、AI 辅助内容和脚本导入都走同一个入口。

诚实边界：当前算法是词面 shingle containment，不是真正的语义向量查重；数据库读取上限也是 10,000 条。因此可以显著拦截复制/近似改写，但不能承诺“永远不重复”。下一步改进应该是在保留该硬门的基础上增加语义 embedding 相似度与人工复核，而不是删掉已验证的规则重写。

### 6.3 内容发布质量门

每一篇正式内容至少满足：

1. 难度、篇幅、题型符合对应档位；
2. 每题有唯一可判定答案，或清楚的评分点；
3. 每题绑定原文证据/解释；
4. 选项结构、答案键、总题数、总分一致；
5. 目标词确实出现在文章或可靠教学语境中；
6. 与同周及历史文章/题目完成词面和语义查重；
7. 用独立解题过程重新做一遍并与答案核对；
8. 不一致内容进入人工审核，禁止发布；
9. 发布后生成版本与内容快照；
10. 有学生开始作答后不得静默修改。发现坏题要走撤题/补分和审计流程。

不能向叶老师或学生承诺“绝对准确、永远不重复”；可以承诺可执行的质量门、发现问题后的可追溯修复和不篡改历史。

## 7. 判分与成绩

### 7.1 当前判分逻辑

- 选择题：确定性判分，不调用模型。答案优先读取冻结选项中的 `correct`，并兼容 `acceptedKeys`、`correctOption`、`correctAnswer` 与最终答案键；大小写和首尾空白归一。
- 短答题：规范化后，如果标准答案不超过 80 字符且学生答案精确匹配，自动满分；空白答案自动 0 分。
- 非空但不能精确判断的短答、长评分标准、structured、essay：进入人工判分队列，不自动判 0。
- `MORNING_QUIZ_AI_GRADING` 默认关闭。不得为了方便打开它或触发会消耗 Anthropic API 的 `regradeSession`。
- 撤题且全员给分的规则必须高于后续重算，不能被 cron 覆盖回 0。
- 人工题未完成前，学生端只显示待批/部分客观分，不把它称为最终成绩。

核心文件：

- `apps/api/src/grading/grade.ts`
- `apps/api/src/student/student.service.ts`
- `apps/api/src/marker/marker.controller.ts`
- `apps/api/src/marker/marker.service.ts`

### 7.2 用户在聊天里说“判分”时（2026-09-05 定稿：判完直接推）

「判分」= 授权读队列、判、写回、发布成绩，一步到位。全程零 Anthropic API。
在仓库根目录跑：

```bash
# 1. 倒出待批队列（只读；匿名代号 S-xxxx；默认今天，补判加 --dates=2026-09-07,2026-09-08）
railway run -s Postgres -e production -- npx ts-node apps/api/scripts/marker-dump.ts --json=.local/grades/2026-09-07.dump.json

# 2. Claude 在聊天里按 rubric / accept / evidence 判，写判分文件 .local/grades/2026-09-07.json：
#    { "dates": ["2026-09-07"], "grades": { "<scriptId>": { "awardedMarks": 2, "reason": "…" } } }

# 3. 先 dry-run 看一眼，再真写（写回 + 重算 + submitted→marked + 生词本/错题本采集）
railway run -s Postgres -e production -- npx ts-node apps/api/scripts/marker-apply.ts --file=.local/grades/2026-09-07.json --dry-run
railway run -s Postgres -e production -- npx ts-node apps/api/scripts/marker-apply.ts --file=.local/grades/2026-09-07.json

# 4. 复核：再跑一次 marker-dump，应为 0 份
```

判分文件里的评语会引学生原话，所以放 `.local/`（已 gitignore），不进仓库。
`dates` 让脚本把那几天**所有**非练习答卷都收尾（全客观题、空白卷也翻成
marked）；没判完主观题的那份只写分数、状态不动，第二天补判再收。

回聊天的内容：每档几份、平均分、拿不准的题（附匿名代号 + 学生原话 + 我的判法），
不贴姓名。切换到另一个 Claude 对话不会自动拥有 Railway 连接；要在那个
环境先 `railway login` + link 到 `glorious-motivation`。

### 7.3 后台与学生端显示

最终分数要同时保存并显示在：

- 教师 marker/成绩后台；
- 学生历史成绩列表；
- 学生单次答卷详情；
- 班级进度/统计需要分数时的汇总。

人工 finalize 会重算 `manualScore` 和 `totalScore`，并把 submission 变为 `marked`。若后台有分、学生端没有，先核对学生详情是否错误读取 `autoScore` 而不是最终 `totalScore`，以及缓存/状态是否仍是 pending。

## 8. 教师管理后台

叶老师需要的不是几张分散页面，而是一张能运营真实班级的总表。

按班级筛选后，每名学生至少显示：

- 账号与姓名；
- 当前五档难度；
- 今日阅读状态；
- 累计欠交文章数；
- 待人工判分数量；
- 今日新词学习状态；
- 尚未学完的词数；
- 按日期累计的正式词测待办数与待测词数；
- 当前“我的单词”数量；
- 累计实际学完的单词数；
- 已掌握/已移出的单词数；
- 阅读最终成绩与历史详情入口。

当前 API 已有 `GET /vocab-v2/teacher/class/:classId/progress`，服务端按学生返回上述大部分阅读与词汇统计；发布班级 12 词使用 `POST /vocab-v2/teacher/assignments`。教师前端仍需持续检查是否把这些字段真正统一呈现，而不是只看旧课程表。

统计口径：

- “累计学词”只数 `reps > 0`，不是收到过、查过或换掉过的词；
- “我的单词”只数 `inNotebook=true`；
- “欠阅读”从入班日期起、按学生难度与已发布 assignment 计算；系统自动收尾不算学生完成；
- “欠词测”只数已完成 daily learning 但 formal test 未 submitted 的日期；
- 自助抽查不计成绩、不计每日完成度。

## 9. UI/UX 规范

### 9.1 总体风格

- iOS 风格：简约、留白、清晰层级、低噪声、克制的蓝色主行动和自然圆角。
- 不用大段开发术语、内部状态码、英文枚举或“系统阶段”教育学生。
- 一屏一个主要行动；次要行动视觉降级，但仍有至少 44×44 px 触控区域。
- 重要状态使用中文和明确下一步，不只靠颜色。
- 加载、空数据、错误、离线、成功、重复提交都要有界面状态。

### 9.2 手机

- 单列阅读；需要时用“看原文/做题”切换或自然纵向结构。
- 底部操作区要考虑 `safe-area-inset-bottom` 和软键盘。
- 长单词、长选项、中文解释不能溢出。
- 弹层优先底部抽屉；关闭和主按钮都容易点击。

### 9.3 iPad/桌面

- 1024px 左右横屏优先使用左文章/右题目双栏；分隔比例可调并支持触控取消事件。
- 内容主容器可放宽到约 1180–1280px，不得全站固定 `max-w-md`。
- iPad 竖屏可使用单栏或文章/题目切换，但不能出现横向溢出。
- 字号放大、旋转、软键盘、长文章滚动和题号导航必须专项测试。

### 9.4 已知高风险回归

- 学词页多出空白第三/第四阶段；
- 中文释义正确但例句翻译缺失；
- 多个词共享同一长段落；
- “换一个”按钮无效或分母变化；
- 学了 N 词，测验题数却不是 N；
- `12/12` 后仍显示“做了一部分/学今天的新词”；
- 首页待办未更新或旧日期被覆盖；
- 历史页与答题页完全不同；
- iPad 仍被挤在窄窗口；
- 顶部没有返回，学生必须滚到底；
- 点击加入/移出后无提示。

这些都已有用户真机截图证据。修复时要加回归测试，不能只修截图对应的一个单词或一个账号。

## 10. 错题本的范围

错题本功能已经被叶老师明确暂停。

- 页面可以保留入口并显示“暂未开放”；
- 不生成错题复习任务；
- 不把 `drill` 计入每日完成度；
- 不继续开发错题列表、重练、掌握状态或提醒；
- 只有叶老师以后明确重新开启，才重新排期。

当前前后端开关都应保持 `paused`。路由和旧服务保留只为兼容，不表示功能可用。

## 11. 路由和模块地图

学生端路由唯一事实源：`apps/student-web/src/routes.contract.ts`。

主要 canonical 路由：

- `/login`、`/register`、`/account`
- `/today`
- `/lesson/reading`、`/lesson/reading/result`
- `/scores`、`/scores/:submissionId`
- `/vocab`
- `/coach/learn`、`/coach/test`

兼容路由 `/lesson/test`、`/vocab/practice`、`/vocab/selftest`、`/coach` 应重定向统一入口，不创建第二套页面状态。

主要模块：

- `apps/student-web`：独立学生 App；
- `apps/api/src/student-auth`：学生注册、登录、班级和难度；
- `apps/api/src/lesson`：今天、下一步、阅读/跨日课程状态；
- `apps/api/src/vocab-v2`：统一单词、每日学习、正式测试、自助抽查、教师词汇进度；
- `apps/api/src/vocab`：旧兼容、实时翻译与部分查词能力；
- `apps/api/src/student` / `morning-quiz`：阅读提交与结果；
- `apps/api/src/marker`：人工判分；
- `apps/web`：教师/管理端以及仍保留的旧学生兼容页面；不要把新的学生功能写回这里。

## 12. 上线通知、二维码与安装教程

正式上线物料另有明确要求：

- 使用 Equistar International College 的正式 logo；
- 文案正式、简短，不要啰嗦；
- 学生入口位置使用二维码，不展示一条很长的裸 URL；
- 二维码必须指向 production 学生入口，不能再用 staging；
- PDF 排版需整洁，主功能介绍避免重复编号和拥挤；
- iPhone、iPad、Android 的“添加到主屏幕”教程分别尽量占独立一页；
- 复用旧 Exam Paper System 中已经存在的真机教程与截图：`apps/web/src/components/InstallGuideSheet.tsx`、`apps/web/public/install-guide/*`；
- 每个平台生成后都要渲染 PDF 逐页检查二维码可扫、中文不乱码、图片不拉伸、没有内容被截断。

仓库内旧 `docs/pilot/s12m-launch.md` 使用的是 staging 地址，只能作历史文案参考，不能直接发给学生。

## 13. 测试与发布门

### 13.1 最低自动验证

涉及学生端时至少运行：

```bash
npm test -w @app/student-web
npm run typecheck -w @app/student-web
npm run build -w @app/student-web
```

涉及 API/数据库时至少运行：

```bash
npm test -w @app/api
npm run typecheck -w @app/api
npm run build -w @app/api
npx prisma validate --schema apps/api/prisma/schema.prisma
```

内容包还要运行其专用单元测试、结构审计、当周与历史去重检查。不要只用首页 200 或 build 成功代替业务验收。

### 13.2 必须覆盖的真实闭环

用新注册学生，在手机和 iPad 至少各走一遍：

1. 注册选班级与五档难度；
2. 进入今天并开始阅读；
3. 自动保存，刷新后继续；
4. 点词，看到词义和例句翻译；
5. 分别验证“加入我的单词”和“只查一下”；
6. 交卷，看到客观分/待批状态；
7. 从历史打开同一份冻结答卷；
8. 学当天新词，验证两个教学屏；
9. 换一个词，确保总数不变、原词不入测试；
10. 学完后自动回首页并出现日期待办；
11. 正式词测题数等于实际学完词数；
12. 人为保留旧日期待办，跨到次日核对阅读/学词/词测三类都不丢；
13. 自助抽查不生成正式成绩；
14. 教师后台核对同一学生的难度、欠交、学词、待测、单词数和得分。

### 13.3 发布顺序与证据

- 发布前备份/确认数据库可恢复；审查 Prisma migration 是否有删除、默认值回填或锁表风险。
- API 先向后兼容，再部署学生端；避免新端先调用尚未上线的端点。
- 部署后检查 `/health`、`/ready`、CORS、登录、真实数据读取和一次只读后台查询。
- 保存 commit SHA、Railway deployment ID、服务名、时间、迁移结果、烟测账号范围和回滚点。
- 任何真实学生数据修复都记录目标 ID、修复前后值和原因。

## 14. Claude 接手后的建议顺序

### P0：先建立可靠事实源

1. 先读本日志和 `docs/PRD/vocabulary-coach-v2-acceptance.md`。
2. 核对 Railway 当前部署，不相信旧 reconstruction 的“未上线”描述。
3. 把 `CLAUDE.md` 的产品状态更新为当前事实，并保留“无授权不部署/不 push”的铁律。
4. 对 production 学生端建立 commit-to-deployment 追踪。

### P0：真实学生阻塞项

1. 核对当天及未来一周五档内容均已发布，不只第一周 fixtures。
2. 用干净新账号复跑“阅读→查词→学词→自动待办→正式测试→历史→后台”。
3. 对题数/学习进度/跨日待办做服务端一致性断言。
4. 核对 Azure 翻译、例句翻译和降级路径；不在 UI 暴露供应商错误。
5. 核对 marker 队列和最终分数在后台与学生历史同步。

### P1：成熟度提升

1. 把阅读、结果、历史详情彻底收敛到同一组件体系。
2. 对 iPad 横/竖屏、旋转、软键盘、触控分栏做真机验收。
3. 把教师进度字段集中成一张可筛选总表。
4. 将文章/题目查重抽成所有发布入口共用的质量门，并增加语义查重。
5. 补齐正式 production 上线 PDF 与各平台单页安装教程。

不要做的事：

- 不重建第三套词汇系统；
- 不重新引入强制复习；
- 不恢复班级码；
- 不把五档缩成三档；
- 不把错题本重新开发；
- 不把 staging 二维码发给学生；
- 不以“100% 完成”代替可核实的测试证据；
- 不对已有学生答卷静默改题或改答案。

## 15. 完成定义

一项学生端任务只有同时满足以下条件才算完成：

- 行为符合本日志的产品规则；
- 前后端状态口径一致；
- 回归测试覆盖用户曾经遇到的同类问题，而不是只覆盖一个 fixture；
- 手机与 iPad 的关键尺寸验证通过；
- 错误、空数据、网络慢和重复点击均有合理结果；
- 不泄露学生数据、答案、密钥或跨账号信息；
- production 部署有明确 commit、部署 ID、烟测证据和回滚点；
- 叶老师能用非技术语言理解“改了什么、怎么验、还有什么风险”。

本日志记录的是截至 2026-09-03 的设计和接手边界。以后叶老师有新的明确决定，应在本文件顶部增加带日期的“后续决定”，并同步修改契约测试，避免只在聊天里改变、代码和文档继续漂移。
