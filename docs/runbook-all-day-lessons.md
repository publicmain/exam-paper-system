# 全天课程首次上线手册

**适用范围**：把 `MORNING_QUIZ_ALL_DAY` 从关闭切到打开，让学生一整天都能
开始或继续当天的课程。

**发布候选**：P1–P9.5 功能冻结，本手册对应的代码已在 staging 验证通过
（18/18，`NODE_ENV=production`，场次窗口保持 08:30–09:00 未放宽）。

---

## 0. 先读这一条

> **必须先设好环境变量，再重启服务。**

收卷 cron 每分钟按 `quizEnd <= now` 跑一轮。开关没生效时，当天场次会在
09:00 被锁成 `locked`；而课程入口只认 `status='active'` 的场次 ——
**已经锁掉的场次不会因为之后打开开关而复活**。顺序错了，当天就废了，
只能手工把场次改回 `active`（见 §6 回滚）。

---

## 1. 配置环境变量

| 变量 | 值 | 说明 |
|---|---|---|
| `MORNING_QUIZ_ALL_DAY` | `true` | 全班全天。按班灰度写 `class:<classId>[,<classId>]` |
| `MORNING_QUIZ_TZ_OFFSET_MIN` | `480` | 已有值，确认没被改动（SGT = UTC+8） |

**合法值只有这些**：`on` / `true` / `all` / `1`（开），
`off` / `false` / `0` / 空（关），`class:<id>,...`（按班灰度）。

其余一律非法，**生产环境会拒绝启动**并在日志里说明原因。这是故意的：
`MORNING_QUIZ_ALL_DAY=ture` 曾经会被当成一个叫 `ture` 的班 —— 每个班都
不开，而日志里一切正常，运维以为已经打开了。

> ⚠️ 不带 `class:` 前缀的班级列表（旧写法 `c1,c3`）在生产环境**不再接受**，
> 因为它和拼错的布尔值长得一样。灰度请写 `class:c1,c3`。

---

## 2. 部署时间窗口

选**当天没有课**的时段操作，最稳的是**傍晚 17:30 之后到次日 00:00 之前**：

- 当天的课已经结束，不会打断正在作答的学生
- 次日 00:00 之后新的一天开始，配置从第一分钟就是对的

**不要在 08:00–09:00 之间切**：那是学生正在作答的时段，重启会打断连接，
而且当时场次状态正在从 `scheduled` 翻到 `active`。

---

## 3. 部署步骤

```bash
# ① 设置环境变量（Railway：Variables 面板；自建：改 .env / systemd 环境）
MORNING_QUIZ_ALL_DAY=true

# ② 重启 API 服务，等待启动完成
```

启动日志里必须出现这一行（**没有它就是没生效**）：

```
[Bootstrap] all-day lessons: all [MORNING_QUIZ_ALL_DAY=true]
```

按班灰度时是：

```
[Bootstrap] all-day lessons: per-class (classes: c1, c3) [MORNING_QUIZ_ALL_DAY=class:c1,c3]
```

若配置非法，服务**不会启动**，日志里是：

```
[Bootstrap] Refusing to start: MORNING_QUIZ_ALL_DAY 的值无法识别。合法写法：…
```

---

## 4. 检查已 locked 的场次

如果切换发生在当天 09:00 之后，今天的场次可能已经被 cron 锁掉了。

```sql
-- 今天有没有被锁掉的场次？
SELECT id, "classId", level, status,
       ("quizEnd" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore')::time AS 收窗
FROM "MorningQuizSession"
WHERE date = (now() AT TIME ZONE 'Asia/Singapore')::date
ORDER BY "classId", level;
```

- 全是 `active` → 正常，继续第 5 步
- 出现 `locked` → 当天这一场已经收尾、答案已公布。**不要**简单地改回
  `active`：学生的答卷已经被强制提交、可能已经判了分，改回去会让「已交卷」
  和「可继续作答」并存。正确处理是**当天不再开全天**，等次日零点之后
  自然生效（新一天的场次由 cron 按新配置创建，窗口直接是 00:00–23:59）。

  只有在确认「当天没有任何学生已交卷」时，才可以手工恢复：

  ```sql
  -- 确认没人交过卷（返回 0 才可以往下做）
  SELECT count(*) FROM "StudentSubmission" s
  JOIN "PaperAssignment" pa ON pa.id = s."assignmentId"
  JOIN "MorningQuizSession" mq ON mq."paperAssignmentId" = pa.id
  WHERE mq.date = (now() AT TIME ZONE 'Asia/Singapore')::date
    AND s."finalSubmittedAt" IS NOT NULL;
  ```

---

## 5. 验证生效

```bash
# ① 公开健康端点 —— 看模式
curl -s https://<api-host>/api/health | jq .lessons
# 期望：{"allDay":"all","allDayClassCount":0,"tzOffsetMin":480}
```

`allDay` 的四种取值：`off`（关）/ `all`（全班）/ `per-class`（灰度）/
`invalid`（配置错，生产下根本起不来）。

> 这个端点是公开的，所以**只回显模式与班级数量** —— 原始环境值和班级 id
> 不在这里，要看完整值去看启动日志。

```bash
# ② 用一个真实学生账号走一遍（09:00 之后做才有意义）
#    登录 → 今天的课 → 开始今天的课程 → 进入阅读 → 写一句 → 看是否「已保存」
```

**关键观察点**：进入阅读页后，顶部倒计时应该是**几百分钟**（到当天 23:59），
不是 `00:00 ⏰ 时间到`。看到「时间到」说明 `effectiveEndsAt` 没生效 ——
立刻回滚。

```sql
-- ③ 确认 cron 没有在 09:00 收卷（切换后过一分钟再查）
SELECT id, status FROM "MorningQuizSession"
WHERE date = (now() AT TIME ZONE 'Asia/Singapore')::date;
-- 期望：全部仍是 active
```

---

## 6. 回滚

回滚只需要**改回一个环境变量并重启**，不涉及数据库：

```bash
MORNING_QUIZ_ALL_DAY=off
```

重启后启动日志应显示 `all-day lessons: off`。

回滚之后：

- 当天场次会在下一次 cron tick（一分钟内）按 `quizEnd` 收卷 —— 若此刻已过
  09:00，**正在作答的学生会被强制交卷**。所以回滚同样要挑没人作答的时段，
  或者接受这个代价（数据不丢，答案照常保留并判分）
- 已经建出来的答卷、任务行、词汇成绩**全部保留**，不需要清理
- 学生端页面会回到「今天的作答时间已经结束了」这个诚实状态

**不需要**回滚代码：关掉开关后所有行为与 P9.5 之前一致（有测试钉住
「开关关着 = 零行为变化」）。

---

## 7. 小班试用观察清单

首次打开建议先用 `class:<一个班的 id>` 灰度一天。

### 每天要看的四件事

| # | 看什么 | 怎么算正常 | 不正常时 |
|---|---|---|---|
| 1 | 有没有人被挡在门外 | 无 `window_closed` / `no_content` 投诉 | 查 §8 查询 ①，确认场次 `active` 且挂了卷子 |
| 2 | 答卷是不是一人一份 | §8 查询 ② 返回 0 行 | 有重复说明挑场次不确定 —— 立即回滚并报告 |
| 3 | 有没有被提前收卷 | §8 查询 ③ 里当天 `locked` 为 0 | 有 → cron 的 all-day 判断没生效，回滚 |
| 4 | 作答时段的分布 | §8 查询 ④ —— 这是打开全天的**收益证据** | 全部集中在 08:30–09:00 说明学生还不知道可以随时来 |

### 试用期的判断标准

- **可以扩大**：连续 3 个上课日，查询 ②③ 都是 0，且查询 ④ 显示有学生
  在 09:00 之后完成课程
- **应当回滚**：出现重复答卷、被提前收卷、或当天完成率低于打开之前

---

## 8. 关键数据库查询

```sql
-- ① 今天的场次是否可用（每个班每层一行）
SELECT mq.id, c.name AS 班级, mq.level, mq.status,
       (mq."quizStart" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore')::time AS 开窗,
       (mq."quizEnd"   AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore')::time AS 收窗,
       (mq."paperAssignmentId" IS NOT NULL) AS 挂了卷子
FROM "MorningQuizSession" mq
JOIN "Class" c ON c.id = mq."classId"
WHERE mq.date = (now() AT TIME ZONE 'Asia/Singapore')::date
ORDER BY c.name, mq.level;
```

```sql
-- ② 有没有人拿到两份正式答卷（**必须返回 0 行**）
SELECT s."studentId", u.name, s."assignmentId", count(*) AS 份数
FROM "StudentSubmission" s
JOIN "User" u ON u.id = s."studentId"
WHERE s.status <> 'practice'
GROUP BY s."studentId", u.name, s."assignmentId"
HAVING count(*) > 1;
```

```sql
-- ③ 今天有没有场次被提前锁掉（全天模式下当天应当全是 active）
SELECT status, count(*) FROM "MorningQuizSession"
WHERE date = (now() AT TIME ZONE 'Asia/Singapore')::date
GROUP BY status;
```

```sql
-- ④ 今天的作答时段分布 —— 打开全天的收益就看这一张
SELECT date_trunc('hour', s."finalSubmittedAt" AT TIME ZONE 'UTC'
                            AT TIME ZONE 'Asia/Singapore') AS 时段,
       count(*) AS 交卷人数
FROM "StudentSubmission" s
JOIN "PaperAssignment" pa ON pa.id = s."assignmentId"
JOIN "MorningQuizSession" mq ON mq."paperAssignmentId" = pa.id
WHERE mq.date = (now() AT TIME ZONE 'Asia/Singapore')::date
  AND s."finalSubmittedAt" IS NOT NULL
GROUP BY 1 ORDER BY 1;
```

```sql
-- ⑤ 今天走到了哪一步（阶段分布）—— 卡在某一阶段的人多就是有问题
SELECT stage, count(*) FROM "DailyLessonCompletion"
WHERE date = (now() AT TIME ZONE 'Asia/Singapore')::date
GROUP BY stage ORDER BY 2 DESC;
```

```sql
-- ⑥ 有没有人开始了却一个字没写（可能是进得去、存不下）
SELECT u.name, s."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' AS 开始时间
FROM "StudentSubmission" s
JOIN "User" u ON u.id = s."studentId"
JOIN "PaperAssignment" pa ON pa.id = s."assignmentId"
JOIN "MorningQuizSession" mq ON mq."paperAssignmentId" = pa.id
WHERE mq.date = (now() AT TIME ZONE 'Asia/Singapore')::date
  AND s.status = 'in_progress'
  AND NOT EXISTS (SELECT 1 FROM "AnswerScript" a WHERE a."submissionId" = s.id)
ORDER BY 2;
```

```sql
-- ⑦ 考勤已与课程解耦 —— 这个数字**不该**再影响任何人能不能上课。
--    留着只是为了确认「开始课程不会伪造考勤」。
SELECT count(*) AS 今日考勤行 FROM "Attendance" a
JOIN "MorningQuizSession" mq ON mq.id = a."sessionId"
WHERE mq.date = (now() AT TIME ZONE 'Asia/Singapore')::date;
```

---

## 9. 已知边界

- **全天 = 当天**，不是永久。跨过午夜之后昨天那场就关了：23:58 开始的
  学生 00:02 不能接着写（数据一条不丢，只是不能再改）。这是刻意的 ——
  否则一份卷子会被无限期续答、永远不判分
- **贴墙二维码上的「08:30–08:40 扫码签到」未改**（教师端物料）。扫码入口
  仍作为 deprecated 兼容保留，不再是必要入口
- 教师看板与排课页仍按 08:30 / 09:00 的口径展示
