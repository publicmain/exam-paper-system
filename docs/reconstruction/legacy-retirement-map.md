# 旧产品引用矩阵与退役地图

> R0 · 2026-08-27 · 审计基线 commit `82b9cb0`
> **本轮只统计，不删除、不修改。**

「不得只修截图里的一个返回按钮」—— 下面是完整清单。

---

## 1. 引用总量

`/my-history` 在 `apps/` 下共 **94 处、41 个文件**（含注释）。
下面按符号逐项归属。

| 符号 | 生产代码 | 测试 | 后端 | 说明 |
|---|---|---|---|---|
| `/my-history` | 前端 ~55 处 / 22 文件 | 5 处 / 4 文件 | **7 处 / 6 文件** | 后端有硬编码（见 §2.1） |
| `/scan/` | 16 处 / 7 文件 | 2 处 | — | 扫码时代 |
| `mq:history:name` | 15 处 / 10 文件 | 2 处 | — | 旧身份键 |
| `mq:history:studentId` | 8 处 / 7 文件 | 1 处 | — | 同上 |
| `name=` / `studentId=`（URL 身份） | **前端 30+ 处；`lib/api.ts` 里 13 个端点** | 4 处 | 8 个端点硬性要求 | 见 §2.2 |
| `then=` | 5 处 / 3 文件 | 1 处 | — | 任意返回 URL |
| `after=submit` | 6 处 / 4 文件 | 1 处 | — | 链式跳转协议 |
| `teacher_view` | 6 处 / 4 文件 | 0 | 1（守卫） | 教师以学生视角查看，与本次重建不冲突 |

---

## 2. 必须优先处理的引用

### 2.1 后端硬编码前端路由（最高优先）

| 文件:行 | 内容 | 影响 |
|---|---|---|
| `apps/api/src/lesson/next-action.ts:114` | `href: /morning-quiz/${sessionId}` | 七步链第 3 步指向旧页面 |
| `apps/api/src/lesson/next-action.ts:121` | `href: /my-history/submission/${submissionId}` | 第 4 步指向旧页面 |
| `apps/api/src/lesson/next-action.ts:126,133,135` | `/my-vocab/review`、`/my-lesson/summary`、`/my-vocab/quiz` | 需随新路由契约同步 |

**后端在给前端指路。** 不改这里，前端怎么改都会被拉回去。
`next-action.spec.ts:1` 有一条测试把这些地址断言成正确行为。

其余后端命中为注释或运维脚本：`vocab.controller.ts`（2，注释）、
`student-word.service.ts`（1，注释）、`student-identity.guard.ts`（1，注释）、
`marker.service.ts`、`morning-quiz.{cron,controller,service}.ts`、
`student.service.ts`、`attendance.service.ts`、`admin-cleanup.service.ts`、
`name-suggest.ts`、`scripts/merge-duplicate-student.ts`、
`scripts/e2e-second-window-ui.ts`。

### 2.2 URL 身份 —— 前端与 API 契约双重耦合

**`lib/api.ts` 里 13 个学生端点把 `name`（+ 可选 `studentId`）拼进查询串**：
`:419` history-detail、`:428` vocab/words、`:451` vocab/lesson-cards、
`:463` vocab/due、`:517` lesson/today、`:605` quiz/attempt/current、
`:633` quiz/attempts、`:641` vocab/mistakes、`:649` practice-queue、
`:661` vocab/quiz。

**实测（staging，真实 HTTPS）**：

```
不带 name/studentId：
  lesson/today                  200 OK      ← 纯令牌
  student-auth/me               200 OK      ← 纯令牌
  vocab/words                   400 name_required
  vocab/lesson-cards            400 name_required
  vocab/due                     400 name_required
  vocab/mistakes                400 name_required
  vocab/mistakes/practice-queue 400 name_required
  vocab/quiz/attempt/current    400 name_required
  vocab/quiz/attempts           400 name_required
```

身份收口在 `apps/api/src/vocab/student-word.service.ts:26`
`resolveStudent(rawName, studentId?)` —— **一个函数**，所有 `/vocab/*`
都走它。这是好消息：加一条「令牌优先」的分支只需要改这一处。

**越权已被堵住**（不是安全问题，是耦合问题）：带 A 的令牌请求 B 的数据，
`lesson/today`、`vocab/words`、`vocab/lesson-cards`、`vocab/mistakes`
一律 `403 identity_mismatch`（实测）。

**但姓名读通道仍然开着**（`student-identity.guard.ts` 第 3 条规则，
注释里写明是「刻意保留的已知缺口」）：完全不带令牌，实测仍可读到
`vocab/words` 200、`vocab/mistakes` 200、`morning-quiz/history-by-name` 200。

### 2.3 新流程对旧身份键的硬依赖

| 文件:行 | 内容 |
|---|---|
| `pages/Me.tsx:104-105` | PIN 登录成功后**回写** `mq:history:name` / `mq:history:studentId` |
| `pages/MyLesson.tsx:146,155` | 无 URL 参数时从这两个键取身份 |
| `pages/TaskSummary.tsx:65` | 同上 |
| `lib/lesson-entry.ts:63,85` | PWA 冷启动改道**必须**有 `mq:history:name`，否则不跳 |
| `lib/registration.ts:41-42,49` | 注册检查同样读这两个键并拼进 URL |
| `components/RegistrationSheet.tsx:91-92` | 注册成功后写这两个键 |

**结论**：这两个键现在是新流程的承重结构，不能先删。退役顺序见 §5。

### 2.4 canonical 页面里的 legacy 出口（逐条）

| 文件:行 | 出口 | 触发情形 |
|---|---|---|
| `Me.tsx:353` | `/my-history` 裸链 | 未登录提示 |
| `Me.tsx:461` | `/my-history?name=&studentId=` | 「成绩记录」卡片 |
| `MyLesson.tsx:423` | `/my-history?qs` | 页脚 |
| `MyVocab.tsx:142,143` | `/my-history` | 空身份提示「请从『我的记录』进入生词本」 |
| `MyVocab.tsx:153,154,174` | `/my-history?name=` | 「← 返回我的记录」×2 |
| `MyVocabReview.tsx:163` | `historyUrl` | **空队列** |
| `MyVocabReview.tsx:204` | `historyUrl` | **接口失败** |
| `MyVocabReview.tsx:267` | `historyUrl` | **完成学习** |
| `MyVocabReview.tsx:494,501` | `historyUrl` | **跳过**（文案「返回我的记录 →」） |
| `MyVocabReview.tsx:538` | `historyUrl` | 结束 |
| `MyVocabQuiz.tsx:225` | `historyUrl` | **完成测试** |
| `MyVocabQuiz.tsx:381,382` | `/my-history` | 空身份提示「请从『我的记录』进入生词自测」 |
| `MyVocabQuiz.tsx:595` | `historyUrl` | 「查看成绩」 |
| `MyVocabQuiz.tsx:622` | `backUrl` | **✕ 退出自测**（正式测试也可退） |
| `MyMistakes.tsx:135,136` | `/my-history` | 空身份提示 |
| `MyMistakes.tsx:145,161` | `/my-history?name=` | 「← 返回我的记录」 |
| `MyMistakesPractice.tsx:142` | `/my-history` | 空身份提示 |
| `MorningQuizTake.tsx:207,214` | `/my-history*` | **阅读交卷** |
| `MorningQuizTake.tsx:239` | **`/student`** | **阅读页出错** |
| `MorningQuizTake.tsx:292,462` | `/my-history?name=` | 窗口关闭 |
| `App.tsx:250` | `/my-history` | **未登录学生流兜底** |
| `App.tsx:312` | `/student` | **JWT 学生的未知 URL 兜底** |

合计 **22 处**，其中 **10 处在七步链的非正常路径上**（空态、失败、跳过、
完成、出错）。

### 2.5 旧语义文案（canonical 页面内）

| 文件:行 | 文案 | 问题 |
|---|---|---|
| `MyVocab.tsx:141` | 「请从『我的记录』进入生词本」 | 把旧页面写成了必经之路 |
| `MyVocab.tsx:154,174` | 「← 返回我的记录」 | 用户两次指出过 |
| `MyVocab.tsx:211,215` | 「主线词每天进**早测**卷」 | 早测语义 |
| `MyVocabQuiz.tsx:381` | 「请从『我的记录』进入生词**自测**」 | 旧页面 + 混淆正式/自测 |
| `MyVocabReview.tsx:501` | 「返回我的记录 →」 | 同上 |
| `MyMistakes.tsx:135` | 「请从『我的记录』进入错题本」 | 同上 |
| `MyMistakesPractice.tsx:142` | 「→ 我的记录」 | 同上 |
| `App.tsx:714` | 「扫码考勤 →」 | 扫码语义 |
| `components/InstallAppCard.tsx:75,101` | 「不用再扫码、不用再输名字」「扫码小窗口」 | 安装引导整套建立在扫码上 |
| `components/InstallGuideSheet.tsx:79,133,134,186` | 「扫码打开的页面」「必须用 Chrome 的相机扫码」、URL 写死 `/my-history` | 同上 |
| `components/exam/ExamWordSheet.tsx:188` | 「交卷后在『我的记录』里可以查」 | 同上 |
| `components/exam/WhatsNewSheet.tsx:251` | 同上 | 同上 |

---

## 3. 把旧行为当作正确答案的测试

| 文件 | 它锁死了什么 | 处理 |
|---|---|---|
| `lib/__tests__/lessonEntry.test.ts:29,48,52,58-59,63` | PWA 从 `/my-history` 启动 + `mq:history:*` 存在 → 跳 `/my-lesson?name=…&studentId=…`。**把 URL 身份写进了断言** | 过渡期保留（它保护的是真实的兼容行为）；切换后随 adapter 一起退役 |
| `pages/__tests__/MyVocabReviewRouting.test.tsx:45-46,52,102,108` | 词卡在**空队列**和**接口失败**时必须落到 `RESULT PAGE`（= `/my-history/submission/:id`）；`AFTER_SUBMIT` 常量把 `?name=&after=submit&then=%2Fmy-history%2F…` 写成正确输入 | **必须改写** —— 它正在保护契约要禁止的行为 |
| `pages/__tests__/MyVocabResume.test.tsx:56` | 注册 `/my-history` 作为跳转目标 | 同上 |
| `pages/__tests__/MyVocabDwellLock.test.tsx:59` | 同上 | 同上 |
| `pages/__tests__/ScanLevelSkip.test.tsx` | 扫码定级流程 | 随 `/scan` 一起退役 |
| `apps/api/src/lesson/next-action.spec.ts` | 断言 `href` 等于 `/my-history/submission/:id` 等旧地址 | **必须随后端路由契约同步改写** |

> 注意 `MyVocabReviewRouting.test.tsx:124` 有一条 **反向** 断言
> （`expect(screen.queryByText('HISTORY PAGE')).toBeNull()`）—— 它已经在
> 保护「不要把人赶去旧页面」。这是现有测试里唯一站在新契约一边的。

---

## 4. 谁依赖谁（退役必须按这个顺序）

```
mq:history:name / mq:history:studentId
        ↑ 写                      ↑ 读
   Me.tsx（PIN 登录）        MyLesson / TaskSummary / lesson-entry / registration
                                          ↑
                                  PWA 冷启动改道
                                          ↑
                              已装设备的 /my-history 图标
```

```
next-action.ts（后端）
   ├→ /morning-quiz/:id ──→ MorningQuizTake ──交卷──→ /my-history/submission/:id
   └→ /my-history/submission/:id ──词汇横幅──→ /my-vocab/review ──完成──→ historyUrl
                                                                        └→ /my-history
```

**读法**：从下往上退役。先把新端立起来并让后端指向新地址，再切断
`historyUrl` 链，最后才动 `mq:history:*` 和 PWA 改道。

---

## 5. 退役地图（阶段 → 动作 → 前置条件）

| 阶段 | 动作 | 前置条件 |
|---|---|---|
| **R1** | 改 `README.md` / `CLAUDE.md` / PRD 头部的产品说明；给四份旧 PRD 标「已被 X 取代」 | 无（纯文档） |
| **R2** | 新端立壳 + 令牌认证，不接任何旧页面 | R1 |
| **R3** | `resolveStudent` 加令牌优先分支；`/vocab/*` 允许无 `name=` | R2 |
| **R4** | 后端 `next-action.ts` 改为输出新路由（旧路由由适配层翻译） | R3 + 新端有对应页面 |
| **R5** | 阅读页、阅读结果页在新端重建 | R4 |
| **R6** | 词卡 / 词测在新端重建，**课程学词与自由练习拆成两条路由**，`then=` 协议删除 | R5 |
| **R7** | 历史成绩、生词本、错题本在新端重建（账号制，无姓名） | R6 |
| **R8** | 旧 URL 单向适配：`/my-history`、`/my-history/submission/:id`、`/scan/:token`、旧 PWA `start_url` → 新端对应页；**适配器只出不进** | R7 |
| **R9** | 停止回写 `mq:history:*`；PWA 改道改为读令牌 | R8 + 全班已迁移 |
| **R10** | 关闭姓名读通道（`student-identity.guard.ts` 规则 3） | R9 + 观察期通过 |
| **R11** | 删除 `/my-history*`、`/student/*`、`/practice/:id`、`/scan/*` 及其测试 | R10 + 稳定观察 |

---

## 6. 不动的东西

- `teacher_view`（教师以学生视角查看）—— 与本次重建不冲突，保留。
- 教师后台全部路由与页面。
- 数据库、迁移、`apps/api` 的业务规则（P1–P9.5 + RC1.1 已验证）。
- `apps/miniprogram`、`apps/ops-dashboard`。
