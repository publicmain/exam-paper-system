# 真机体验测试计划（手机 / 平板 / 电脑）

本轮目标：在真实设备上把学生流程走一遍，看**体验**，不是找功能缺陷。
P1–P9.5 与 RC1 已功能冻结，测试期间不改代码。

---

## 1. 测试环境

| 项 | 值 |
|---|---|
| 分支 | `staging-manual-test` |
| 测试环境 commit | `fa3cd63`（= `d56c11b` RC1 + 一个 staging 部署配置提交） |
| Railway 项目 | `exam-staging-manual`（**独立项目**，与生产项目无任何共享） |
| 数据库 | 该项目内独立的 Postgres，全新空库 |
| `NODE_ENV` | `production` |
| `MORNING_QUIZ_ALL_DAY` | `true` |
| `MORNING_QUIZ_TZ_OFFSET_MIN` | `480` |
| 构建/启动 | 与正式部署一致：`apps/api/Dockerfile` → `npx prisma migrate deploy && node dist/main.js` |

**生产未受影响**：`main` 分支没有 push，生产的环境变量、数据库、服务一律
未触碰。staging 是新建项目里的新服务 + 新数据库。

### 地址（手机可直接打开）

| | 地址 |
|---|---|
| **学生入口（用这个）** | **https://stg-web-production.up.railway.app/me** |
| API（一般不用打开） | https://stg-api-production-46cf.up.railway.app |
| 健康检查 | https://stg-api-production-46cf.up.railway.app/api/health |

⚠️ **必须带 `/me`**。裸域名会落到教师登录页，见下一节。

健康检查应返回 `"lessons":{"allDay":"all", ...}` —— 这是全天模式生效的证据。

### cron 只作用于 staging

收卷 / 开窗 / 提醒这些定时任务跟着 API 进程跑，连的是 staging 自己的
数据库。另外 **staging 的 `NotificationConfig` 表是空的**，所以企业微信
之类的外发通知一条都不会发 —— 真实老师不会收到任何 staging 消息。
（第 7 节的检查命令 ⑦ 可以随时确认这一点。）

---

## 2. 测试账号

**全部是虚构账号，不含任何真实学生数据。**

登录方式：打开学生入口 → `/me` → 输入**姓名 + 密码**。

**所有账号的临时密码：`246810`**

| # | 姓名 | 场景 | 预期初始状态 |
|---|---|---|---|
| 1 | 测试一号 | 正常已定级学生（olevel） | 主按钮「**开始今天的课程**」 |
| 2 | 测试二号 | `englishLevel = null` 未定级 | 「**开始今天的课程**」；开始后难度自动落定为 olevel |
| 3 | 测试三号 | 无任何考勤记录 | 「**开始今天的课程**」——**没有考勤也能上课** |
| 4 | 测试四号 | 纯新词（4 个词都没教过） | 「开始今天的课程」；阅读交卷后进「学今天的新词」，每张卡写着「第一次学」 |
| 5 | 测试五号 | 纯复习（4 个词都教过、已到期） | 「开始今天的课程」；词段是复习卡不是教学卡 |
| 6 | 测试六号 | 今天已全部完成（词汇满分） | 主按钮「**看今天的总结**」，词汇成绩 4/4 · 100 分 |
| 7 | 测试七号 | 今天没有内容（另一个班没排课） | 「**今天的课程还没有发布**」，灰色提示不是蓝色按钮 |
| 8 | 测试八号 | 正式词汇测试 0 分 | 「看今天的总结」，词汇成绩 **0/4 · 0 分**（不是「还没考」） |

> 一号到六号、八号在 `G11 实测班`，七号在 `G12 无内容班`。
> 今天的样卷是 4 道短答题《Harbour Town（实测样卷）》。

**账号可以重置**：测试把数据点乱了，让我重新跑一次种子脚本，
8 个账号就回到上表的初始状态。

---

### ⚠️ 学生入口是 /me，不是裸域名

直接打开 `https://stg-web-production.up.railway.app`（不带路径）会落到
**教师登录页**（Email + Password 的那个「Exam Paper System」），学生用不了它。

学生请始终从这个地址进：

**https://stg-web-production.up.railway.app/me**

页面标题是「我的每日英语」，两个输入框是**姓名**和**密码**。

> 这是既有的路由行为（`/` → `/login` 是教师端守卫），不是本轮引入的。
> 已记入问题清单，等测试结束一起评估。

## 3. 手机测试步骤

建议顺序：**先用测试一号走完整条路**，再用其它账号看各自的特殊状态。

### A. 完整流程（测试一号）

1. 手机浏览器打开 **https://stg-web-production.up.railway.app/me**
2. 输入姓名 `测试一号`、密码 `246810`，点登录
3. 看主页顶部的**唯一主按钮**
4. 点「开始今天的课程」
5. 进入阅读页，**先看顶部倒计时**
6. 四道题各写一句话，注意每题写完后的保存提示
7. 点「交卷」→「交卷并看答案」
8. 回「今天的课」（或从成绩页返回）
9. 点「学今天的新词」，翻完 4 张卡
10. 点「去考今天的单词 →」，做完 4 题
11. 点「看今天的总结 →」

### B. 中途退出与恢复（测试四号）

1. 登录 → 开始课程 → 阅读页写两题
2. **直接关掉浏览器**（或切到别的 App 放一会儿）
3. 重新打开、重新登录
4. 看能不能回到刚才的位置、答案还在不在

### C. 换设备（测试五号）

1. 在**手机**上登录 → 开始课程 → 写一题
2. 在**平板或电脑**上用同一个账号登录
3. 看手机上写的那题在不在

### D. 各个特殊状态（测试二 / 三 / 六 / 七 / 八号）

分别登录，只看**主页第一屏**：主按钮写的是什么、三段各显示什么。

### E. 时段感受（任意账号，一天里分几次）

上午、下午、晚上各打开一次，确认**任何时候都能进**、不会被"时间到"打断。

---

## 4. 每个场景的预期结果

| # | 步骤 | 预期 | 不符就记下来 |
|---|---|---|---|
| A-3 | 主页主按钮 | 只有一个蓝色大按钮「开始今天的课程 →」 | 出现多个并列按钮、或写着「扫码」 |
| A-4 | 点开始 | 直接进入阅读页，不需要扫码 | 停在原地、报错、要求扫码 |
| A-5 | 倒计时 | 显示**几百分钟**（到当天 23:59） | 显示 `00:00` 或「时间到」 |
| A-6 | 写答案 | 停顿约半秒后出现「已保存」 | 一直「保存中…」、或红色错误条 |
| A-7 | 交卷 | 跳到逐题回顾页，能看到自己写的答案 | 交卷失败、答案丢失 |
| A-8 | 回课程页 | 主按钮变成「学今天的新词 →」 | 仍是「开始今天的课程」 |
| A-9 | 翻卡 | 每张卡有词义、例句、发音按钮 | 卡片空白、翻不动 |
| A-10 | 单词测试 | 顶部标着「计入成绩」 | 没有标注、或标成「不计分」 |
| A-11 | 总结 | 阅读成绩与单词成绩**分两行**显示 | 混在一起、或数字对不上 |
| B-4 | 重新登录 | 回到「继续做题」，之前写的答案还在 | 答案没了、要从头开始 |
| C-3 | 换设备 | 手机上写的答案在另一台设备上看得到 | 看不到、或被清空 |
| D-2 | 测试二号 | 开始后难度落定；再看「我的」，难度已是 olevel | 一直没定级、或落成别的层 |
| D-3 | 测试三号 | 与一号完全一样能上课 | 被拦下、提示考勤/扫码 |
| D-6 | 测试六号 | 主按钮「看今天的总结」，词汇 4/4 · 100 分 | 让他重新开始、或成绩不对 |
| D-7 | 测试七号 | 灰色提示「今天的课程还没有发布」 | 蓝色按钮（点了没反应）、或提示扫码 |
| D-8 | 测试八号 | 词汇成绩显示 **0/4 · 0 分** | 显示「还没考」（0 分和没考是两回事） |
| E | 三个时段 | 每次都能正常进入和继续 | 某个时段进不去、或被自动交卷 |

**体验层面也请留意**（这是本轮的重点）：

- 手机上字够不够大、按钮好不好点（尤其单手握持时）
- 阅读页文章和题目的切换顺不顺手
- 翻卡的节奏是不是太快/太慢
- 哪一步让你犹豫了「现在该点哪里」
- 平板横屏、电脑宽屏下排版有没有变形

---

## 5. 问题记录格式

每发现一个问题，记成一条：

```
【问题 N】
设备：iPhone 14 / Safari（或 iPad 横屏 / Chrome、Windows 电脑 / Edge）
账号：测试一号
时间：2026-08-27 15:42（写到分钟，我按这个时间去翻日志）
在哪一步：A-6 写第 3 题的答案时
我看到的：一直显示「保存中…」，大约 10 秒后变成红条
我以为会：写完停一下就显示「已保存」
严重程度：挡路 / 别扭 / 小瑕疵
截图：有 / 无
```

**「时间」这一栏很关键** —— 服务端每个响应都带 `x-request-id`，我可以按
时间把那一分钟的日志捞出来定位。

严重程度的判断：

- **挡路**：做不下去了（进不去、存不下、卡死）
- **别扭**：能用，但要多想一下或多点几次
- **小瑕疵**：文字、间距、颜色这类

---

## 6. 测试完成后的数据库检查

测试结束后我会跑这些（**只读**，不改数据）：

```sql
-- ① 每个测试账号今天走到了哪一步
SELECT u.name AS 姓名, d.stage AS 阶段, d."vocabCursor" AS 学词进度,
       d."readProgress" AS 读段, d."vocabProgress" AS 词段
FROM "DailyLessonCompletion" d JOIN "User" u ON u.id = d."studentId"
WHERE d.date = (now() AT TIME ZONE 'Asia/Singapore')::date
ORDER BY u.id;
```

```sql
-- ② 有没有人拿到两份正式答卷（**必须 0 行**）
SELECT s."studentId", u.name, s."assignmentId", count(*) AS 份数
FROM "StudentSubmission" s JOIN "User" u ON u.id = s."studentId"
WHERE s.status <> 'practice'
GROUP BY 1,2,3 HAVING count(*) > 1;
```

```sql
-- ③ 答案有没有真的存下来（每题一行，看 clientSeq 是否在增长）
SELECT u.name AS 姓名, a."paperQuestionId" AS 题, a."clientSeq" AS 序号,
       left(coalesce(a."textAnswer", a."selectedOption"), 30) AS 答案,
       a."updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' AS 最后修改
FROM "AnswerScript" a
JOIN "StudentSubmission" s ON s.id = a."submissionId"
JOIN "User" u ON u.id = s."studentId"
ORDER BY u.name, a."paperQuestionId";
```

```sql
-- ④ 正式词汇成绩
SELECT u.name AS 姓名, v.status AS 状态, v.correct AS 对, v.total AS 共, v.score AS 分
FROM "VocabQuizAttempt" v JOIN "User" u ON u.id = v."studentId"
WHERE v.date = (now() AT TIME ZONE 'Asia/Singapore')::date ORDER BY u.name;
```

```sql
-- ⑤ 场次有没有被 cron 提前锁掉（全天模式下当天应当全是 active）
SELECT id, status,
       ("quizEnd" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore')::time AS 收窗
FROM "MorningQuizSession"
WHERE date = (now() AT TIME ZONE 'Asia/Singapore')::date;
```

```sql
-- ⑥ 考勤行（应当一直是 0 —— 课程已与考勤解耦）
SELECT count(*) AS 考勤行 FROM "Attendance";
```

```sql
-- ⑦ 外发通知配置（**必须 0** —— staging 不该给任何人发消息）
SELECT count(*) AS 通知配置 FROM "NotificationConfig";
SELECT count(*) AS 已发通知 FROM "NotificationLog";
```

> 数据库只有内网地址，没有对外开放。这些命令由我通过 Railway 的
> 服务通道执行，测试期间你不需要碰数据库。

---

## 7. staging 清理步骤

测试结束、问题都记录完之后：

1. **删掉整个 Railway 项目** `exam-staging-manual`
   （项目一删，API / Web / Postgres 与全部测试数据一起消失）
   - Railway 面板 → 项目 → Settings → Danger → Delete Project
   - 或告诉我，我用 CLI 删
2. **删掉远端分支**：`git push origin --delete staging-manual-test`
3. **删掉本地 worktree**：我这边执行 `git worktree remove`
4. **移除 Railway SSH 公钥**（部署期间为了进容器种数据加的）：
   `railway ssh keys remove`

生产侧无需任何清理 —— 本轮没有触碰过它。

---

## 8. 部署后的自查结果（我已跑过）

时间：2026-08-27 SGT 10:2x　结果：**26 通过 / 0 失败**

- API 健康、`allDay: all` 生效、公开端点不泄露配置细节
- 前端 HTTPS 可达且是构建产物
- 八个账号全部能登录
- 八个账号的初始状态与第 2 节表格逐项一致
- 没有任何账号被要求扫码；读取不创建答卷
- 已完成学生 4/4 · 100 分；0 分学生显示 0/4 · 0 分（不是「还没考」）
- 响应带 `x-request-id`

> 自查只验证了「服务起来了、状态对」，**没有替代真机体验**——
> 字号、手感、排版、流程顺不顺，只有真机上能看出来。

---

## 9. 已知边界（不是 bug，测到了不用记）

- **昨天的课今天进不去**：全天 = 当天。跨过午夜后昨天那份卷子只能看不能改
- **贴墙二维码上的「08:30–08:40 扫码签到」还是旧文案**：扫码入口作为
  兼容保留，不再是必要入口
- **教师端页面仍按 08:30 / 09:00 的口径展示**：本轮只改了学生端
- staging 首次访问可能慢几秒（容器冷启动）
