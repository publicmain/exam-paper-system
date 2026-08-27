# 真机体验测试计划（手机 / 平板 / 电脑）

你亲自在真实设备上把产品用一遍。这份文档给你地址、账号、每一步该看到
什么，以及测完之后怎么对账。

**不是**自动化测试的替代品 —— 自动化已经全绿了，这一轮要抓的是它抓不到
的东西：手感、文案、在真实网络和真实屏幕上的样子。

---

## 1. 测试环境

### 跑的是哪一版

| | |
|---|---|
| 产品代码 commit | **`82b9cb0`**（`docs: RC1.1 本地验收记录`） |
| 分支 | `staging-manual-test` |
| 分支 tip 比它多什么 | 只多一个部署配置提交（`apps/web/railway.json`：从 `apps/web` 目录上传时的 `dockerfilePath` 与健康检查路径）。**不含任何产品代码改动** |
| 内容范围 | P1–P9.5 + RC1 + **RC1.1**（staging 上一轮人工测试抓到的九个问题的修复） |

上一轮人工测试（2026-08-27 上午）报的 A–I 九项，这一版全部修掉了。
第 4 节里标了 **`[RC1.1]`** 的就是这次要重点复验的。

### 跟生产完全隔开

Railway 项目 **`exam-staging-manual`**，与生产项目 `exam-paper-system`
是两个独立项目，三个服务：

| 服务 | 作用 |
|---|---|
| `stg-api` | NestJS API |
| `stg-web` | 静态站点（nginx） |
| `Postgres` | **staging 专用库**，与生产库无任何连接 |

关键环境变量（`stg-api`）：

| 变量 | 值 | 为什么 |
|---|---|---|
| `NODE_ENV` | `production` | 与正式部署一致的运行模式 |
| `MORNING_QUIZ_ALL_DAY` | `true` | 全天开放，任何时刻都能进课程 |
| `MORNING_QUIZ_TZ_OFFSET_MIN` | `480` | 新加坡时间 |
| `DATABASE_URL` | 指向本项目内的 Postgres | **不是**生产库 |
| `MOCK_AUTH` | `false` | 真登录 |
| `ANTHROPIC_API_KEY` | **未设置** | AI 评分路径直接短路（日志打 `[ai_grade_skipped]`），不会产生任何 API 调用 |

构建与启动方式与生产**完全一致**：同一个 `apps/api/Dockerfile`、同一条
启动命令 `npx prisma migrate deploy && node dist/main.js`。

### cron 只作用于 staging

`stg-api` 里的定时任务读写的是它自己的 `DATABASE_URL`，也就是 staging
库。会往外发消息或调用外部服务的那几条，**全部因为环境变量没设而直接
跳过**：

| cron | 时间 | 在 staging 上 |
|---|---|---|
| `morning-quiz` 锁场/开窗 | 每分钟 | **会跑** —— 只动 staging 库的场次和答卷 |
| `absence-alert-daily` | 09:30 | 跳过（`MORNING_QUIZ_ABSENCE_ALERTS` 未设） |
| `teacher-todo` 早晚摘要 | 08:30 / 18:30 | 跳过（`TEACHER_DAILY_DIGEST` 未设） |
| `morning-quiz-weekly-generate` | 周日 18:00 | 跳过（`MORNING_QUIZ_AUTO_GENERATE` 未设） |
| `morning-quiz-daily-fallback` | 06:30 | 跳过（`MORNING_QUIZ_DAILY_FALLBACK` 未设） |
| `morning-quiz-review-fail-open` | 周一 06:30 | 跳过（`MORNING_QUIZ_REVIEW_FAIL_OPEN` 未设） |
| `morning-quiz-vocab-attach` | 06:45 | 会跑，但只处理 staging 库当天的场次 |

微信/企业微信通知只在 `NotificationConfig` 有 `enabled=true` 的行时才发。
staging 库里这张表是**空的**（第 7 节的检查里会再确认一次）。

### 按时间定位日志

API 给每个请求打了关联 ID：

- 响应头 **`x-request-id`**（你自己带 `x-request-id` 进来它就沿用，
  否则服务端生成一个 uuid）
- 同一个 id 会出现在该请求的服务端日志行里

手机上不方便看响应头，所以第 5 节的问题记录格式里让你记**时间（精确到
分钟）+ 账号**，我按时间在 `railway logs` 里捞。如果你用电脑的开发者
工具，顺手把 `x-request-id` 抄下来最省事。

---

## 2. staging 地址

### 手机可以直接打开（HTTPS）

**学生入口 —— 从这里开始：**

```
https://stg-web-production.up.railway.app/me
```

API（一般不用手工打开，排查时可能用到）：

```
https://stg-api-production-46cf.up.railway.app/api/health
```

### ⚠️ 学生入口是 `/me`，不是裸域名

直接打开 `https://stg-web-production.up.railway.app/` 会跳到**教师**登录
页（邮箱 + 密码），那不是学生用的。**必须带 `/me`**。

建议手机上把 `/me` 存成书签或加到主屏幕。

---

## 3. 测试账号

**全部是虚构数据，不含任何真实学生。**

登录要填三样：**姓名 + 学号 + 6 位 PIN**。

**PIN 统一是 `246810`**（仅 staging；生产上每个学生自己设，教师可重置）。

| 姓名 | 学号 | 预期初始状态 |
|---|---|---|
| 测试一号 | `t1_normal` | 正常已定级学生（`olevel`）。今天有阅读卷 + 4 个词。**主力账号，用它走完整流程** |
| 测试二号 | `t2_nolevel` | `englishLevel = null`。开始课程时应该被**自动定级**，然后正常拿到卷子 |
| 测试三号 | `t3_noatt` | 没有任何考勤记录。**照样能上课** —— 全天课程不依赖考勤 |
| 测试四号 | `t4_newwords` | 4 个词**全都没教过**（纯新词）。词卡应该是「第一次学」的教学卡 |
| 测试五号 | `t5_review` | 4 个词**都教过、都已到期**（纯复习）。词卡应该是挖空的复习卡 |
| 测试六号 | `t6_done` | **今天的课已经做完了**。进去应该直接看到总结，不该再有「开始」按钮 |
| 测试七号 | `t7_nocontent` | 在另一个班（`G12 无内容班`），**今天没有任何内容**。应该显示「今天的课程还没有发布」 |
| 测试八号 | `t8_zero` | 正式词汇测试考了 **0 分**。且这一行是**故意留的坏数据**：卷子交了但阶段字段没推进（RC1.1 之前的 bug 留下的旧行）。用来确认它**不会卡住学生** |

四个班里的词（固定 8 个，方便你对照）：

`harbour` 海港 · `lantern` 灯笼 · `meadow` 草地 · `pebble` 卵石 ·
`ripple` 涟漪 · `vessel` 船 · `willow` 柳树 · `anchor` 锚

> 数据点乱了随时说一声，我一条命令把 8 个账号重置回上表的初始状态。

---

## 4. 手机测试步骤与预期结果

每一步右边那栏是**应该看到什么**。对不上就按第 5 节记下来。

### A. 完整流程（测试一号）

这是最重要的一遍。手机上从头走到尾，不要跳步。

| 步骤 | 预期 |
|---|---|
| 1. 打开 `/me`，填姓名 + 学号 + PIN | 登录成功，看到「你好，测试一号」 |
| 2. 点「今天的课」 | 看到今天的任务：阅读 + 单词，**完成度不是 3/3** |
| 3. 点「开始今天的课程」 | 直接进阅读卷 —— **不需要扫码，不需要老师点名** |
| 4. 读文章、答 4 道题 | 题目和文章能正常显示；输入框不吞字 |
| 5. 交卷 | **`[RC1.1-G]` 弹窗里不该出现「16:00」「下午」「先存着」这类早测时代的话** |
| 6. 阅读结果页 | 看到分数；下方有「顺便把今天的词过一遍」 |
| 7. 点进词卡 | **`[RC1.1-A]` 标题不该写「不计分自测」**；**`[RC1.1-C]` 第一张应该是 `harbour`** |
| 8. 翻完 4 张 | 计数 1/4 → 4/4，**分母始终是 4，不会缩水** |
| 9. 点「去考今天的单词」 | **`[RC1.1-A]` 页面应标明「· 计入成绩」** |
| 10. 答题，故意错一道对一道 | **`[RC1.1-D]` 选对了要打 ✓，选错了那道要把正确答案标出来**。（上一轮的 bug 是选对也打 ✗） |
| 11. 交卷 | 看到分数 |
| 12. 看今天的总结 | 三段都显示完成；**`[RC1.1-E]` 不该再出现「还差单词测试」这种自相矛盾的话** |

### B. 中途退出与恢复（测试四号 —— 纯新词）

| 步骤 | 预期 |
|---|---|
| 1. 走到词卡，翻到**第 2 张** | 显示「今日生词 2 / 4」「第一次学」 |
| 2. 直接杀掉浏览器 / 切走 App | — |
| 3. 重新打开 `/me` 登录，回到词卡 | **`[RC1.1-C]` 还是第 2 张、还是同一个词、还是「第一次学」的教学卡**（上一轮的 bug 是回到第 1 张、而且换成了挖空复习卡） |
| 4. 学完 4 张，开始正式测试，答一题后杀掉 | — |
| 5. 重新登录进测试 | 回到**同一份**测试的**下一题**，已答那题保留，不会从头重来 |

### C. 换设备（测试五号 —— 纯复习）

| 步骤 | 预期 |
|---|---|
| 1. **手机上**登录，做阅读，做到一半不交卷 | — |
| 2. **平板或电脑上**用同一账号登录 | 答案**跟过来了**，接着写 |
| 3. 进词卡 | **`[RC1.1-H]` 复习卡正面要有中文释义提示**（挖空的是英文拼写，但得让你知道该回忆哪个词） |

### D. 特殊状态（测试二 / 三 / 六 / 七 / 八号）

| 账号 | 预期 |
|---|---|
| 测试二号 | 开始课程时自动定级，然后正常拿到卷子（不该卡住、不该报错） |
| 测试三号 | 没有考勤记录照样能上课 |
| 测试六号 | 进去直接是「今天的课完成了」，没有「开始」按钮；**反复刷新、退出重登，不该多出记录也不该退回上一步** |
| 测试七号 | **`[RC1.1-F]` 显示「今天的课程还没有发布」，完成度 0/3，连续天数 0**（上一轮的 bug 是显示「🎉 今天的课完成了 · 连续 1 天」） |
| 测试八号 | 卷子交了但阶段字段是旧的坏值 —— **应该仍能看到总结，不该卡死**。它的正式词汇测试是 0 分 |

### E. 换账号（任意两个账号）

| 步骤 | 预期 |
|---|---|
| 1. 用测试一号登录，然后退出 | — |
| 2. 立刻用测试四号登录 | **`[RC1.1-I]` 头部不该闪出「测试一号」**，哪怕一秒也不行 |

### F. 时段感受（任意账号，一天里分几次）

早上、下午、晚上各开一次。**任何时刻都应该能进课程**，不该出现
「已经过了作答时间」「等下午的窗口」这类话。

### G. 设备与网络

- 手机竖屏 / 横屏都看一遍；平板上的排版
- 弱网（把 WiFi 关掉用 4G，或到信号差的地方）：翻卡和答题会不会丢
- 屏幕小的手机上，按钮够不够大、字够不够清楚

---

## 5. 问题记录格式

看到不对的地方，按这个格式记（微信发我或直接贴到对话里都行）：

```
【问题】一句话说清楚现象
【账号】测试X号
【时间】2026-08-27 14:23        ← 精确到分钟，我按它去捞日志
【设备】iPhone 15 / Safari      ← 或 iPad / Chrome / 电脑
【步骤】1. …  2. …  3. …
【看到】实际发生了什么
【期望】你觉得应该是什么
【截图】有就附上
【严重度】P1 用不了 / P2 很别扭 / P3 小瑕疵
```

**`x-request-id`**（可选，用电脑测的话）：开发者工具 → Network → 点那条
请求 → Response Headers 里的 `x-request-id`。抄给我能直接定位到那一次
请求的日志。

只要记不准也别不记 —— 现象 + 大致时间 + 账号就够我查了。

---

## 6. 测试完成后的数据库检查（只读）

以下命令**只读，不写任何东西**。

连接串在 Railway 面板：`exam-staging-manual` 项目 → `Postgres` 服务 →
Variables → `DATABASE_PUBLIC_URL`。**不要贴进聊天或提交进仓库。**

```bash
export STG_DB_URL='<从 Railway 面板复制>'
```

### 每个测试账号做到哪一步了

```bash
psql "$STG_DB_URL" -c "
SELECT u.name AS 姓名,
       COALESCE(d.stage, '(今天没有任务)') AS 阶段,
       COALESCE(d.\"vocabCursor\", 0)              AS 学到第几个词,
       COALESCE(jsonb_array_length(d.\"vocabWords\"), 0) AS 词队列长度,
       COALESCE(d.\"vocabTarget\", 0)              AS 词目标
FROM \"User\" u
LEFT JOIN \"DailyLessonCompletion\" d ON d.\"studentId\" = u.id
WHERE u.id LIKE 't_%' OR u.id ~ '^t[1-8]_'
ORDER BY u.id;"
```

### 阅读答卷与词汇测试成绩

```bash
psql "$STG_DB_URL" -c "
SELECT u.name AS 姓名, s.status AS 答卷状态, s.score AS 阅读得分,
       a.status AS 测试状态, a.correct AS 答对, a.total AS 总题, a.score AS 词汇分
FROM \"User\" u
LEFT JOIN \"StudentSubmission\" s ON s.\"studentId\" = u.id
LEFT JOIN \"VocabQuizAttempt\"  a ON a.\"studentId\" = u.id
WHERE u.id ~ '^t[1-8]_' ORDER BY u.id;"
```

### 五条必须成立的对账（都该返回 0 行）

```bash
psql "$STG_DB_URL" -c "
-- ① 同一份卷子不该有两条正式答卷
SELECT '① 重复答卷' AS 检查, \"studentId\", \"assignmentId\", count(*)
FROM \"StudentSubmission\" WHERE status <> 'practice'
GROUP BY 2,3 HAVING count(*) > 1;"

psql "$STG_DB_URL" -c "
-- ② 一个任务不该有两份正式词汇测试
SELECT '② 重复测试' AS 检查, \"dailyLessonCompletionId\", count(*)
FROM \"VocabQuizAttempt\" WHERE \"dailyLessonCompletionId\" IS NOT NULL
GROUP BY 2 HAVING count(*) > 1;"

psql "$STG_DB_URL" -c "
-- ③ 交了卷的测试，它的任务阶段必须是 done（测试八号那条旧坏行除外）
SELECT '③ 阶段没推进' AS 检查, a.id, d.stage
FROM \"VocabQuizAttempt\" a JOIN \"DailyLessonCompletion\" d ON d.id = a.\"dailyLessonCompletionId\"
WHERE a.status = 'submitted' AND d.stage <> 'done' AND a.id <> 'att_t8';"

psql "$STG_DB_URL" -c "
-- ④ 不该有「三段目标全是 0 却标记完成」的伪完成行
SELECT '④ 伪完成' AS 检查, id, \"studentId\"
FROM \"DailyLessonCompletion\"
WHERE stage = 'done' AND \"readTarget\" = 0 AND \"vocabTarget\" = 0 AND \"drillTarget\" = 0;"

psql "$STG_DB_URL" -c "
-- ⑤ staging 不该给任何人发消息
SELECT '⑤ 外发通知' AS 检查, count(*) FROM \"NotificationConfig\" WHERE enabled = true
UNION ALL SELECT '⑤ 已发日志', count(*) FROM \"NotificationLog\";"
```

### 词队列有没有被自由练习改小（RC1.1-B）

```bash
psql "$STG_DB_URL" -c "
SELECT u.name AS 姓名,
       jsonb_array_length(d.\"vocabWords\") AS 队列长度,
       d.\"vocabTarget\" AS 目标,
       d.\"vocabWords\" AS 队列
FROM \"DailyLessonCompletion\" d JOIN \"User\" u ON u.id = d.\"studentId\"
WHERE d.\"vocabWords\" IS NOT NULL ORDER BY u.id;"
```

**队列长度必须等于目标**，且内容是当初冻结的那几个词 —— 中途去自由
练习不该让它变短。

### 按时间捞日志

```bash
railway logs --service stg-api | grep "14:2"
```

（先 `railway link` 到 `exam-staging-manual` 项目。）

---

## 7. staging 清理步骤

测完之后按需要执行。**这些只动 staging，碰不到生产。**

### 只清测试数据，环境留着

```bash
node scratchpad/stg-accounts.js      # 幂等重播种：8 个账号回到初始状态
```

### 整个 staging 环境删掉

Railway 面板 → `exam-staging-manual` 项目 → Settings → Delete Project。

三个服务和那个数据库一起消失。**生产项目 `exam-paper-system` 完全不受
影响** —— 它们是两个独立项目。

### 分支清理

```bash
git push origin --delete staging-manual-test
git branch -D staging-manual-test
git worktree remove <staging worktree 路径>
```

`staging-manual-test` 分支上只比 `main` 多一个部署配置提交，**没有任何
产品代码只存在于这个分支上**，删掉不会丢东西。

---

## 8. 部署后的自查（我已经跑过）

上线后我自己跑了一遍 smoke test，结果见对话里的报告。自查**只读**，
没有改任何产品行为。

---

## 9. 已知边界（不是 bug，测到了不用记）

- **还没开始上课时完成度显示 `1/3`** —— 因为今天没有练习题，那一段算
  作已完成。修复前就是这样，RC1.1 没动它。要不要改是产品决定
- **教师端仍是 08:30/09:00 的早测口径** —— 排课页、看板的文案没跟着改
- **贴墙二维码还能用** —— 旧扫码链路留着做兼容，但学生不该再需要它
- **生词本等页面上还有「← 返回我的记录」** —— 会跳到旧版页面。功能
  冻结期没动，等你决定是删是留
- **`/my-history` 系列旧页面仍可访问** —— 同上
