# 早测系统 · 完整设计文档

> 版本：4.0 设计稿　·　生成于 2026-08-25　·　用途：**交付外部协作方（ChatGPT）对接**
>
> 本文档自包含：读它不需要访问代码库。凡「现状」与「4.0 计划」不同处，
> 均分别标注。**4.0 尚未实施**，当前生产运行的是 3.0。

---

## 目录

1. [系统是什么](#1-系统是什么)
2. [角色与入口](#2-角色与入口)
3. [五个难度层](#3-五个难度层)
4. [时间线](#4-时间线)
5. [内容生产：文章怎么来](#5-内容生产文章怎么来)
6. [质检：10 项审计](#6-质检10-项审计)
7. [入库与排课](#7-入库与排课)
8. [学生答题流程](#8-学生答题流程)
9. [判分流程](#9-判分流程)
10. [单词系统](#10-单词系统)
11. [错题系统](#11-错题系统)
12. [数据模型](#12-数据模型)
13. [API 清单](#13-api-清单)
14. [技术栈与部署](#14-技术栈与部署)
15. [铁律与约束](#15-铁律与约束)
16. [4.0 改动清单](#16-40-改动清单)

---

## 1. 系统是什么

新加坡一所国际课程学校的**每日英语训练系统**，服务对象是 G11 一个班（35 人）。

学生每天完成一节「课」：读一篇英文文章并答题、背当天的词、重做以前的错题。
系统负责出内容、判分、调度词汇复习、给老师看班级情况。

**核心定位（4.0 起）**：这不是考试系统，是**学习任务系统**。评估只是副产品。

### 1.1 一天的产物

| 产物 | 数量 | 来源 |
|---|---|---|
| 阅读卷 | 5 张（每层一张） | 提前一周由 Claude 在 chat 里撰写 → 入库 |
| 卷内词汇题 | 2–3 道 × 2 层 | 由本周主线词自动生成（纯本地计算） |
| 词表推送 | 每生 8–23 词 | 扫码时按其所选层级推送 |
| 判分 | MCQ 自动 + 简答人工 | 人工部分由 Claude 在 chat 里做 |

### 1.2 规模

- 学生：35 人（单班）
- 每日答卷：约 11–20 份
- 生词本总量：约 700 词
- 题库：雅思自撰 6 篇 + 雅思轻量 10 篇 + O-Level 系列 64 篇

---

## 2. 角色与入口

| 角色 | 认证方式 | 主入口 |
|---|---|---|
| **学生** | **无需登录**：姓名匹配（读）+ 扫码签发的学生 token（写） | `/my-lesson`（4.0）/ `/scan/:token`（扫码） |
| **教师** | JWT 登录 | `/`（管理台）、班级仪表盘 |
| **管理员** | JWT + role=admin | 同上 + 管理端点 |
| **家长** | 一次性 token 链接 | `/parent/:token` |

### 2.1 学生身份模型（重要）

学生**不登录**。身份分两级（2026-08-25 外部审查后收紧）：

**读操作** —— 姓名匹配 + localStorage 记忆：
- 姓名解析要求：`role=student` ∧ `isActive` ∧ 至少一个未归档班级的在读选课
- 同名 → 返回候选列表，前端让学生选班级消歧（`needDisambiguation: true`）
- 查无此人 → 返回 `suggestions`（编辑距离 ≤1 的相近姓名，最多 3 个）

**写操作**（加词/删词/复习评分/撤销/错题销账）—— **必须带学生 token**：
- token 由扫码时签发（`scanToken`，含 studentId，有效期到当天 23:59 SGT）
- 前端存 localStorage `auth_token`，请求自动带 `Authorization: Bearer`
- 服务端 `StudentIdentityGuard`：带 token 时必须与请求的 name/studentId **一致**，
  否则 403 `identity_mismatch`；写操作无 token 一律 403 `student_token_required`

⚠️ **已知的剩余风险，不要误以为已解决**：

1. **没有校园网 IP 门禁。** 早期文档与代码注释都提到过它，**实现中并不存在**
   —— 只有按 IP 的**限流**（那是配额，不是授权）。2026-08-25 外部审查指出，
   核查属实，本文档已更正。
2. **知道姓名仍可读到该生的成绩/错题/生词本。** `/my-history` 这个入口的
   设计前提就是「不登录、输姓名就能查」，一刀切要求 token 会让没扫码的学生
   （补看历史、家长陪同）用不了。要彻底关闭需引入学生登录（PIN / 学校账号），
   属产品决策，未做。
3. 已经关掉的是危害更大的那一半：**任何人都无法再写别人的数据**。

对照 OWASP API1:2023（Broken Object Level Authorization）：写路径已修，
读路径为**已知接受的风险**。

**扫码流程**：教室墙上贴二维码（每 15 秒轮换），学生扫码 → 输姓名 → 选难度层 → 进入当天的课。
扫码同时会：① 建考勤记录（不再用于出勤统计，仅作数据关联）② **按所选层推送当天词表 + 本周主线词**。

---

## 3. 五个难度层

学生**每天扫码时自选**，不预先绑定。五层同时开课，互不影响。

| 枚举值 | 对外名称 | 内容规格 | 题量/分值 | 题库桶 |
|---|---|---|---|---|
| `ielts_authentic` | 雅思真题 | 自撰学术文 700–900 词 | 13–14 题 | `ielts_authentic` |
| `ielts_light` | 雅思轻量 | 短文 250–350 词 | 6 题（+2–3 词汇题）= 8–9 分 | `ielts_light` |
| `olevel` | O-Level 标准 | §B 记叙文 440–650 词 | 14 题 19 分 | `olevel_standard` |
| `olevel_intermediate` | O-Level 进阶 | 记叙文 500–790 词 | 11 题 | `olevel_simplified` |
| `ielts_simplified` | **O-Level 基础** | 精简短文 | 5 题（+2–3 词汇题）= 7–8 分 | `olevel_basic` |

### 3.1 ⚠️ 枚举名与语义不一致（历史包袱）

`ielts_simplified` 这个枚举位**装的是「O-Level 基础」内容**，与雅思无关。
2026-07-24 原「轻雅思」停用，8-14 起该位改装 O-Level 基础层。库里挂着数月的
场次/答卷，重命名要回填全部历史行，风险大于收益。

**规约：任何地方都不得硬编码等级中文名**，一律走 `LEVEL_REGISTRY` 映射表。

### 3.2 题型清单

| taskType | 说明 | questionType | 判分 |
|---|---|---|---|
| `true_false_not_given` | TRUE/FALSE/NOT GIVEN 三选一 | `mcq` | 自动 |
| `yes_no_not_given` | YES/NO/NOT GIVEN | `mcq` | 自动 |
| `matching_information` | 段落匹配（选段落字母） | `short_answer` | 自动（字符串比对） |
| `matching_headings` | 小标题匹配 | `short_answer` | 自动 |
| `matching_features` | 特征匹配 | `mcq` | 自动 |
| `sentence_completion` | 句子填空（原文取词） | `short_answer` | 自动比对失败 → 人工 |
| `summary_completion` | 摘要填空 | `short_answer` | 同上 |
| `table_completion` | 表格填空 | `short_answer` | 同上 |
| `diagram_label_completion` | 图标注 | `short_answer` | 同上 |
| `multiple_choice` | 四选一 | `mcq` | 自动 |
| `short_answer` | O-Level §B 简答 | `short_answer` | 人工为主 |

### 3.3 词汇题（4.0 新增，仅轻量两层）

只给 `ielts_light` 和 `ielts_simplified` 加，因为其余三层题量已满、学生时间紧。

- 每天 **2–3 道**（3 道时正好一周考满 15 个主线词）
- 题型固定 `multiple_choice` + `questionType='mcq'` → **确定性判分、零 AI、不进人工队列**
- 两种题：① 原句填空（给例句语境，没背熟也能推理）② 看词选义（纯记忆）
- 词源：**本周主线词**（该层全员统一，扫码时已推送）。绝不从个人生词本出题——
  `PaperQuestion` 是卷子级的，全班共用一份

---

## 4. 时间线

### 4.1 一天（4.0 新设计）

```
00:00  ─┬─ 当天场次自动激活（5 层各一场）
        │
        │   ★ 全天开放：学生可在任意时刻完成
        │
08:30  ─┼─ 【建议时间】大部分学生在此扫码（社会证明，非强制）
        │
16:30  ─┼─ 【建议时间】第二批学生
        │
23:59  ─┴─ cron 收尾：未最终提交的答卷自动最终化 + 公布答案
                      写入当天完成度快照（DailyLessonCompletion）

次日     教师/Claude 判简答题 → 分数公布 → 错词自动收进生词本
```

**与 3.0 的区别**：3.0 是两个固定窗（08:30–09:00 正式窗、16:00–17:30 第二窗），
9:00 强制收卷成「暂存」，17:30 最终化。4.0 取消窗口概念，全天开放，23:59 收尾。

**读段不限时**（2026-08-25 决策修正）：原设计有 20 分钟倒计时，被实测数据否决——
近两周 79 人次的实际用时中位 12.4 分钟、90 分位 23.6 分钟，**24% 超过 20 分钟**；
且倒计时防不住"看题→退出→查答案→回来填"，与全天开放的动机互相抵消。
改为**显示建议用时（约 15 分钟）+ 记录实际用时供教师观察**，不强制。

### 4.2 一周

| 时点 | 动作 | 执行者 |
|---|---|---|
| 周日 | 撰写下周主线词表 `weekly-track/<ISO周>.json`（每层 15 词 + 例句） | Claude in chat |
| 周日 | 生成下周 5 天 × 5 层 = 25 张卷子（或从已有 fixture 排课） | Claude in chat + 入库脚本 |
| 周日 | 给轻量两层的卷子挂词汇题 | `attach-vocab-questions.ts` |
| 周一–周五 | 每日一课 | 学生 |
| 每日 | 判简答题 | Claude in chat（`marker-dump` → `marker-apply`） |
| 周末 | 无课 | — |

### 4.3 cron 职责（每分钟一跳）

| 函数 | 3.0 行为 | 4.0 行为 |
|---|---|---|
| `activateDueSessions` | 到 08:30 激活 | 到 00:00 激活 |
| `lockPastSessions` | 09:00 收卷成暂存 | **23:59 收尾并最终化** |
| `autoOpenSecondWindows` | 16:00 开第二窗 | **删除** |
| `releaseStrandedDrafts` | 兜底解锁卡住的暂存答卷 | 判据改为「过当天 23:59」 |
| （新）`snapshotLessonCompletion` | — | 23:59 写完成度快照 |

---

## 5. 内容生产：文章怎么来

### 5.1 铁律：零 Anthropic API 调用

**所有内容生产由 Claude 在对话中完成，不走代码里的 AI 路径。**

原因：用户 API 额度为零，采用 flat-fee 的 Claude Code 订阅，因此 chat 内的
生成是免费的，而代码调用 API 要付费。

代码库里存在 `MorningQuizQaService`（AI 质检状态机）和 `autoGradeScripts` 的
AI 分支，但 **`ANTHROPIC_API_KEY` 未设置 → 这些路径不激活**。对接方务必知道：
**看到 AI QA 代码 ≠ 系统在用它**。

### 5.2 文章来源

| 类型 | 说明 | 版权处理 |
|---|---|---|
| **自撰**（当前主力） | Claude 按各层规格原创 | `sourceType = original_school`，可自由使用 |
| **过去卷引用** | 剑桥雅思等 | **只存元数据**（如 `9702/22/M/J/19/Q3`），**不存原文** |

⚠️ **版权铁律**：past-paper 原文不得入库、不得进 git 历史。

### 5.3 Fixture 格式

文章以 JSON fixture 形式存放于 `apps/api/test-fixtures/<系列目录>/`：

```json
{
  "setCode": "ielts_light_2026",
  "provenanceTag": "ai_authored_ielts_light",
  "level": "ielts_light",
  "passageTitle": "Working Against the Clock",
  "note": "AI-authored original passage; not from a past paper.",
  "passage": "Every human body keeps time. Deep in the brain...",
  "questions": [
    {
      "n": 1,
      "questionType": "mcq",
      "taskType": "true_false_not_given",
      "instruction": "Do the following statements agree with...",
      "item": "The body's internal clock is set mainly by light.",
      "answer": "TRUE",
      "marks": 1
    }
  ],
  "wordlist": [
    { "word": "melatonin", "example": "As darkness falls the body produces melatonin." }
  ]
}
```

**`wordlist` 字段**：短文层的配套词表（8–10 词），扫码时推给该层学生。
高层级的词表改为内嵌在卷子 `Paper.config.wordlist` 里。

### 5.4 ⚠️ setCode 命名禁忌

**`setCode` 绝不能以 `_v<数字>` 结尾。**

去重逻辑 `storyKey()` 会剥掉 `_vN` 后缀（用于识别同一故事的不同版本），
`ielts_authored_2026_v6` 会被规范化成 `ielts_authored_2026`，与库里既有的
**内容完全不同**的一批撞成同一个 story → 6 篇全被判「已服务过」→ 候选池归零
→ 每天抽到重复卷。（2026-08-24 真实事故，改名 `aug2026` 后恢复。）

### 5.5 ⚠️ 硬规约：绝不重复

**任何班级绝不重复做同一个 story**（版本无关）。
- 去重按 story 而非 paperId：`ielts_light_05_farms_v1` 与 `_v2` 视为同一个
- 题库不足时**排课直接失败**（`BankExhaustedError`），不静默回收
- 每周生成后必须跑一次全历史重复检查

**2026-08-25 修正**：此前文档写的是这条政策，**代码干的却是相反的事** ——
两个抽题分支在候选耗尽时都会静默挑一个最久未用的继续排课，只留一条
warning。外部审查指出后已改为默认硬失败：抽题发生在周日批量生成时，
离学生用卷还有一周，这时失败我有七天补内容；静默回收则要等学生第二次
做到同一篇文章才会有人发现。

紧急出口：`MORNING_QUIZ_ALLOW_REPEAT=on` 退回 LRU 行为 ——「学生明早
没卷子」比「重复一篇」更糟，但它必须是显式决策，不能是默认。

---

## 6. 质检：10 项审计

每份新 fixture 入库前，Claude 在 chat 里逐项过：

| # | 检查项 | 判据 |
|---|---|---|
| 1 | **原文质量** | 长度符合该层规格；语言自然；无事实错误；无敏感内容 |
| 2 | **题干可答** | 每题的答案确实能从原文推出；不依赖外部知识 |
| 3 | **答案唯一** | 不存在第二个同样成立的答案（填空题尤其危险） |
| 4 | **Mark scheme 正确** | 参考答案与原文逐字对照；填空题词形与原文一致 |
| 5 | **Schema 合规** | 字段齐全；`taskType` 合法；分值合计正确 |
| 6 | **选项完整性** | MCQ/TFNG 必须有 ≥2（TFNG ≥3）个选项，答案存**字母** |
| 7 | **判分精确匹配** | 标准答案能被自动判分器判对 |
| 8 | **判分改写容忍** | 合理的改写表述不会被误判为错 |
| 9 | **判分拒答** | 明显错误的答案不会被误判为对 |
| 10 | **UI 渲染** | 实际渲染无溢出/乱码/组件选择错误 |

### 6.1 ⚠️ TFNG 入库硬闸

雅思 TFNG 题必须：`questionType='mcq'` + 三个选项（TRUE/FALSE/NOT GIVEN）+
**答案存字母**（`A`/`B`/`C`）。

否则撞 `validatePaperStructure` 的 `EMPTY_OPTIONS` 硬闸。且失败姿势很脏：
`Paper` 和 `PaperQuestion` 已建好才抛异常，留下孤儿 paper，其 `passageRef`
已进 used 集合污染去重 —— **清理时必须连 Paper 一起删**。

### 6.2 词表选词的两道检查

新增主线词表 / 卷内词表时，每个词必须过：

1. **ECDICT 存在性** —— 查不到释义的词推了也白推
2. **与当周该层各卷答案撞词检查** —— 词表词绝不能是本卷/本周答案（**泄题**）
   （2026-08-24 实拦 9 个：swell、arithmetic、discipline 等）
3. **例句独占性**（填空题用）—— 空格处必须只有目标词填得进去
   （2026-08-25 发现 empty/tidy、approach/method 等同批词互相填得通）

---

## 7. 入库与排课

### 7.1 入库

```
fixture JSON  →  ingest 脚本  →  Question（题库主记录）
                              →  Paper + PaperQuestion（快照）
```

- `Question` 是题库主记录（可复用）
- `PaperQuestion` 存**快照**（`snapshotContent` / `snapshotAnswer` / `snapshotOptions`），
  与 Question 解耦 —— 题库改了不影响已发出的卷子

入库脚本：`ingest-ielts-batch.ts`、`ingest-basic-band.ts`、`ingest-local.ts`

### 7.2 排课

```
Paper → PaperAssignment（发给某班某天）→ MorningQuizSession（一场课）
```

`MorningQuizSession` 唯一约束 `(date, classId, level)` —— 一个班一天每层一场。

### 7.3 卷内词汇题挂载（4.0）

`attach-vocab-questions.ts --date YYYY-MM-DD [--apply]`

- 只处理 `ielts_light` / `ielts_simplified` 两层
- 从 `weekly-track/<ISO周>.json` 取该层主线词，**按天轮转**（周一取 index 0–1，
  周二 2–3…），保证一周内不重复
- 干扰项从同批主线词里选，过近义过滤（中文释义 bigram 碰撞检测）
- 默认干跑打印题目，`--apply` 才落库
- 幂等：已挂过当天词汇题的卷子跳过

---

## 8. 学生答题流程

### 8.1 4.0：今天的课

学生扫码或直接访问 → 落到 **`/my-lesson`**（不再直接进卷子）：

```
┌─────────────────────────────────┐
│  今天的课 · 8月26日 周三          │
│  ●●○   2/3 完成                  │
├─────────────────────────────────┤
│ ① 读  《Working Against the Clock》│
│    8 题 · 通常 15 分钟            │
│    ✓ 已完成    7/9 分  →         │
├─────────────────────────────────┤
│ ② 背  今日词汇                    │
│    23 个词 · 约 4 分钟            │
│    ● 进行中   8/20   继续 →      │
├─────────────────────────────────┤
│ ③ 补  错题重练                    │
│    3 道 · 约 3 分钟               │
│    ○ 未开始          开始 →      │
├─────────────────────────────────┤
│  🔥 连续 4 天完成                 │
└─────────────────────────────────┘
```

**设计约束**：
- 三段**并列，不强制顺序**（强制顺序会重蹈「词汇挡在成绩前面」的覆辙）
- 每段标注预计时长，都是小数字
- 未开始的段落**不用红色**——这是学习任务不是欠债

### 8.2 完成度判定（必须可达成）

| 段 | 完成判定 |
|---|---|
| ① 读 | `StudentSubmission.finalSubmittedAt` 非空 |
| ② 背 | 当天复习次数 ≥ `min(今日到期词数, reviewBatchSize)` |
| ③ 补 | 当天错题队列清空 **或本来就是空的** |

⚠️ **关键设计**：目标必须可达成。积压 200 词的学生，过完当天配额（≤20 张）
就是 100%，不欠账。否则完成度会变成第二个「只涨不落的债」，激励反向。

**完成度衡量「做了」，不衡量「做得好」** —— 读段交卷即完成，分数不影响完成度。

### 8.3 答题页

- 渲染器由**第一题的 taskType** 决定（`pickRenderer`）：
  - 雅思系 → `IELTSReadingPassage`（左原文右题目分栏）
  - O-Level 多篇 → `OLevelComprehension`
  - 独立 MCQ → `OLevelMcqList`
- 答案自动保存（600ms 防抖）+ localStorage 兜底
- 中途退出可回来继续（暂存状态）
- 考试进行中**禁用点词查义**（否则词义题直接送答案）

### 8.4 提交语义（两段式，4.0 复用）

| 动作 | 效果 |
|---|---|
| **暂存提交** | 答案保存，**不公布答案**，可回来继续改 |
| **最终提交**（「交卷并看答案」） | 锁定，**立即公布答案**，走完成度 |
| 23:59 cron | 未最终提交的自动最终化 |

---

## 9. 判分流程

### 9.1 两类题

| 类型 | 判分方式 | 时机 |
|---|---|---|
| `mcq` | `gradeMcq` 确定性比对 | **交卷即时** |
| `short_answer` | 三条路径（见下） | 部分即时 + 部分人工 |

### 9.2 short_answer 的三条路径

```
1. 精确匹配（归一化后字符串相同，且参考答案 ≤80 字符）→ 自动给分
2. 空答案 → 自动 0 分
3. 其余 → 进人工判分队列（marker queue）
```

⚠️ 路径 3 在代码里原本会调 Claude API（`autoGradeScripts` 的 `aiGrader` 参数），
**当前一律走 `deferAi: true`**，即直接入人工队列。

### 9.3 主观题判分（每日）—— **AI 辅助 + 教师负责**

⚠️ **用词澄清（2026-08-25 外部审查 P0-6）**：项目内部长期把这条流程叫
「人工判分」，那是**内部术语**，含义是「不走代码里的 AI API 路径」，
用来与 `autoGradeScripts` 的 AI 分支相区别 —— 它区分的是**谁调用、谁付费**。

但对学生和家长而言，真实情况是：**答案由 Claude 在对话中判定，教师负责**。
文档与任何对外说明都应如此表述，不得称为「人工批改」。

当前缺口（未做，需产品决策）：判分未记录模型版本 / rubric 版本 / 判分理由
的结构化留存，也没有金标校准集与申诉 SLA。导出内容含学生姓名（见 §15.11）。

由 Claude 在 chat 里执行，**绝不触发 AI grader / regradeSession**：

```
1. marker-dump.ts          导出当天待判队列（含原文、题干、mark scheme、学生答案、差异标注）
2. Claude 在 chat 逐题判   读原文 → 按该题型的真实规则给分 → 写评语
3. marker-apply.ts         把判分决定写回（内嵌 GRADES 映射表）
                           → 重算 autoScore/manualScore/totalScore
                           → status: submitted → marked
```

### 9.4 ⚠️ answer-diff 只是辅助，绝不自动给分

`marker-dump` 会为每道题标注差异类型（`typo` / `plural` / `extra_words` /
`different` 等）并给出「真考算错」之类的措辞 —— **那是按雅思填空规则写的**。

**不同题型的评分规则完全不同**：

| 题型 | 规则 |
|---|---|
| 雅思填空 | 必须照抄原文词形；拼写必须正确；超出词数限制算错 |
| O-Level §B 短答 | 「One or two words are enough」是**建议不是限制**；整句作答只要内容正确就给分；数字形式（81）与文字（eighty-one）等价 |

2026-08-25 实例：3 道 O-Level 短答被 diff 标为「真考算错」，人工判定**给分**
（学生写了完整句、或用了数字形式）。照 diff 走会白扣 3 分。

### 9.5 分数门与答案门（两道独立的门）

```
答案门 answersReleased  ← finalSubmittedAt 非空
  控制：correctAnswer / referenceAnswer / explanation

分数门 scoresReleased   ← status === 'marked'
  控制：awardedMarks / autoCorrect / isCorrect / markerComment
        autoScore / manualScore / totalScore
```

**当前效果**：学生最终提交后立即看到正确答案（MCQ 选项绿色标出正确项、
红色标出自己选的），但**分数要等人工判完**（次日）。

⚠️ 已知问题：卷内词汇题是自动判分的 MCQ，但因整卷有简答题未判，
`scoresPending=true` 会把它的对错标记也剥掉。学生能通过绿红对照自行判断，
但没有「+2 分」的即时反馈。**是否让 MCQ 类题目脱离分数门待定。**

---

## 10. 单词系统

### 10.1 全景

```
采集（三来源）  →  生词本  →  FSRS 调度  →  三种练习  →  卷内考试
     ↑                                                      │
     └──────────────── 答错自动收录 ←───────────────────────┘
```

### 10.2 采集三来源

| sourceType | 触发 | 上限 |
|---|---|---|
| `click` | 学生复盘时点击原文里的词 | 无 |
| `wrong_answer` | 判分后自动收录答错的词义题/填空题目标词 | **每份提交 ≤5 词** |
| `teacher_push` | 扫码时按层推送（当天文章词表 + 本周主线词） | 词表长度 |

**`wrong_answer` 的目标词提取顺序**：
1. `snapshotContent.targetWord`（词义题显式字段）
2. 题干里被引号括起的词（O-Level 词义题固定写法）
3. 填空题的**参考答案本身**（雅思卷没有引号词义题，不靠这条一个词都收不到）

来源 3 的词额外过一道 `isWorthLearning` 筛子：带进阶考纲标签 ∧ 非牛津核心词
∧ BNC 排名 >3000。否则会把 hole / mirror / twice 这类学生明明认识、只是读错
段落的常用词灌进来。

**考纲范围**：只收雅思 / O-Level 范围内的词。**只带 toefl/gre 标签的词一律不收**
（本校两条通道都不考这两个试）。

### 10.3 FSRS 调度

采用 **FSRS**（Free Spaced Repetition Scheduler，ts-fsrs，MIT，纯本地计算）。

```js
参数：enable_fuzz: false, learning_steps: [], relearning_steps: []
```

⚠️ **必须关闭日内步进**：FSRS 默认 `learning_steps: ['1m','10m']`，卡片要连续
答对两次才毕业到 Review 态，而「现在处于第几步」记在 `Card.learning_steps` 上。
本系统把调度状态拆成列存在 `StudentWord` 里，没有这一列，还原 Card 时只能填 0
→ 每次复习都重置回第一步 → **永远毕业不了，间隔恒为 0 天**（实测连续答对 6 次
仍是 0 天）。关掉后间隔按天走：2 → 11 → 46 → 163 → 497 天。

**状态标签**（只给学生看，不参与调度）：

| state | 判据 |
|---|---|
| `new` | 从未复习 |
| `learning` | 间隔 < 7 天 |
| `review` | 7 ≤ 间隔 < 21 天 |
| `known` | **间隔 ≥ 21 天**（纯展示标签，**不影响调度**） |

> 毕业门槛 2026-08-25 从 60 天降到 21 —— 470 词只有 6 个毕业，几乎没学生
> 见过「一个词从每日复习里消失」的正反馈。
>
> ⚠️ **同日修掉一个真 bug**：原来 due / stats / quiz 的查询都带
> `state != 'known'`，于是词一旦被标成 known 就**永远不再出现**，即使
> FSRS 算出的 due 日到了 —— 早先文档写的「以后仍会在更长间隔上考它」
> 是假的。发现时 16 个 known 词的 due 全在未来（最早 8/31），bug 已装好
> 定时器但尚未爆发。现在所有到期查询只看 `due <= now`，known 纯粹是
> 展示标签。回归测试：`known-not-permanent.spec.ts`。

### 10.4 每日配额

```js
reviewBatchSize(backlog):
  backlog > 100 → 20
  backlog > 20  → min(10 + backlog/40, 20)
  否则          → 5

newWordQuota(reviewDebt, batchSize):
  reviewDebt > 20 → 2        // 欠账重，先还债
  否则            → min(8, batchSize)
```

⚠️ **`reviewDebt` 必须只数 `reps > 0` 的词**，不能用总积压。
`StudentWord.due` 默认 `now()`，新词一进本子就计入积压 → 「新词多 → 少给新词
→ 新词更多」自我锁死。2026-08-24 事故：2798/2959（95%）的词从未被翻开，
最老的饿了 24 天。

**新词排序**：一半取最新加入（趁热），一半取等最久（防早期词永久饿死）。

### 10.5 三种练习

| 形式 | 入口 | 判分 | 写 FSRS |
|---|---|---|---|
| **翻卡** | 课程页②段 | 自评（两档：忘了/记得） | 是 |
| **自测** | 翻卡后「趁热考」/ 主动 | 客观（4 选 1） | 对→good 错→again |
| **拼写** | 自测内混入 ≤2 道 | 客观（打字比对） | 同上 |

**翻卡的两道反作弊防线**（2026-08-25 加）：

首日实测：每张卡停留中位数从 5.1 秒掉到 1.6 秒，21 次评分 100% 是「记住了」，
一名学生 25 秒刷完 10 张、最后四张不到 1 秒 —— 两档评分把绿色按钮钉死在右边，
闭眼连点比四档时代还省事。

```
① 前端：显示答案后 1.5 秒内评分按钮禁用 + 说明「先读一遍上面的意思…」
② 服务端：elapsedMs < 1500 的 good/easy 不写 FSRS，只留流水，due 不动
          （返回 tooFast:true，前端显示「太快了，这次不算 · 它还会再来」）
```

⚠️ 服务端这道**只拦正面评分**：
- 秒选「忘了」是**诚实**的（一眼看出不认识，且只会让词更早回来，无作弊动机）
- `elapsedMs = 0` 是自测线（客观判分，前端不传耗时），**绝不能误伤**

### 10.6 挖空定位（`findClozeSpan`）

翻卡和 cloze 题都要把例句里的词挖空。**不能用 `indexOf`**：

```
坏例（2026-08-24 生产实测 764 条 = 26%）：
  agree ⊂ agreed → 挖出「＿＿＿d」，残缺又漏答案
  例句里根本没有该词 → 原样显示整句，答案直接可见（72 条）
```

正确算法（三级降级）：
1. 完整词形 + 词边界匹配
2. 词干前缀（去尾 e，≥4 字母）命中 → 挖整个 token
3. 3 字母词只认白名单变形（`+s` / `+es` / `+ed` / 双写辅音 `+ing` / `+ed`）
   —— 不能用宽前缀，否则 `car ⊂ carrying` 会误挖
4. 定位不到 → **返回 null，绝不硬挖**（调用方降级成学习卡 / 换题型）

**长句开窗**：`windowAroundSpan` 把超过 180 字符的句子围绕挖空处开窗，
两端在词边界收口加省略号 —— wrong_answer 收录的词带着雅思学术长句，
对轻量层学生是墙不是提示。

### 10.7 每周主线（2026-08-25 上线）

**问题**：伴随式采集人均每周只进约 1.5 个核心词。按 Nation 的研究，
3000 词族才有 95% 文本覆盖率（能靠上下文自学的门槛），这个速度永远到不了。
但吞吐数据（人均单日 4.5 次评分）又撑不起「每天 10 个主线新词」的大词书。

**方案**：有限游戏 —— 每周 15 词，周内清账，下周换一批。

```
test-fixtures/weekly-track/<ISO周>.json
{
  "week": "2026-W35",
  "tracks": {
    "ielts_light":      [ { "word": "evidence", "context": "There is strong evidence that..." }, ... ],
    "ielts_simplified": [ { "word": "borrow",   "context": "May I borrow your pen..." }, ... ]
  }
}
```

- 试点两个轻量层，扩层只需在 json 里加一个键（零代码）
- 扫码时随当天词表一并推送（`sourcePassageTitle = "每周主线 2026-W35"`）
- 生词本页显示「🧭 本周主线 已学 X/15」
- **每天的卷内词汇题从这 15 词里出** —— 这是整条动机链的关键

### 10.8 动机链（为什么词汇题要进卷子）

首日数据：683 词、74% 从没翻开、35 人里 23 人从没打开过任何词汇页面，
成绩页自愿横幅转化率 20%（10 人看成绩 → 2 人点）。

结论：**症结不是入口不顺手，是背单词没有回报**。而这套系统里唯一
100% 生效的强制力是早测本身。所以：主线词 → 每天推 → 卷子里考 → 有分数。

生词本页必须显著告知「本周主线词会出现在每天的早测里」—— 学生不知道会考，
动机链就是断的。

### 10.9 弱网与容错

| 场景 | 处理 |
|---|---|
| 评分 POST 失败 | 进 localStorage 队列，下次打开词汇页自动补传 |
| 重发去重 | 每次评分带 `requestId`（UUID），服务端唯一约束去重 |
| 补传超 48 小时 | 丢弃（那时该词多半已被复习过，补传反而搅浑调度） |
| 4xx 失败 | 丢弃（词被删了/姓名解析不了，重试无意义） |
| 词典/接口不可用 | 静默降级，**绝不挡住学生看成绩** |

### 10.10 撤销

误触防线：`POST /vocab/review/undo`
- 只撤该词**最近一条**流水、**10 分钟内**、且带调度快照（`prevState`）
- 从快照精确还原（不能靠「再评一次」纠正 —— 同日二评在 FSRS 里是叠加不是覆盖）

---

## 11. 错题系统

### 11.1 收录

判分后自动收录（有门槛，不是每道错题都进）。

### 11.2 销账规则

```
做对 → correctStreak 0 → 1
隔天再做对 → 2 → 自动销账（resolved）
同一天再做对 → streak 不涨（刚看完答案马上重做是短时记忆）
做错任何一次 → streak 归零
```

### 11.3 重练队列

`GET /vocab/mistakes/practice-queue` —— 每天最多 10 道，**带完整原文下发**
（段落匹配/判断题离开原文没法真正重做）。

---

## 12. 数据模型

### 12.1 核心表

```
User ─┬─ ClassEnrollment ── Class
      ├─ Attendance ── MorningQuizSession ── PaperAssignment ── Paper ── PaperQuestion ── Question
      ├─ StudentSubmission ── AnswerScript ──┘
      ├─ StudentWord ── WordReviewLog
      ├─ MistakeEntry
      └─ StudentPageView
```

### 12.2 关键字段

**MorningQuizSession**（一场课）
```
id, date(Date), classId, level(EnglishLevel), paperAssignmentId(unique)
attendanceStart, attendanceEnd, lateCutoff, quizStart, quizEnd   ← 4.0 后语义变为「当天 00:00–23:59」
makeupStart, makeupEnd                                            ← 4.0 废弃
qrSecret, qrRotationSeconds(15), status(scheduled|active|locked)
@@unique([date, classId, level])
```

**StudentSubmission**（一份答卷）
```
id, assignmentId, studentId, status(in_progress|submitted|marked|locked|practice)
submittedAt, finalSubmittedAt      ← 答案门依据
autoScore, manualScore, totalScore, maxScore
（4.0 新增）startedAt              ← 实际用时观察
```

**AnswerScript**（一道题的作答）
```
id, submissionId, paperQuestionId
selectedOption, textAnswer          ← MCQ 存字母，简答存文本
awardedMarks, autoCorrect, markerComment, markedById, markedAt
```

**PaperQuestion**（卷子里的一道题，快照）
```
id, paperId, questionId, sortOrder, marks
snapshotContent  { stem, passage?, taskType, passageTitle?, vocabTrack?, headword?, vocabQtype? }
snapshotAnswer   { text }            ← MCQ 存字母 'A'|'B'|'C'|'D'
snapshotOptions  [{ key, text, correct }]
```

**StudentWord**（生词本一条）
```
id, studentId, headword(词典原形), surfaceForm(文中形态)
sourceType(click|wrong_answer|teacher_push)
sourcePaperQuestionId?, sourcePassageTitle?, contextSentence
state(new|learning|review|known)
due, stability, difficulty, elapsedDays, scheduledDays, reps, lapses, lastReview
@@unique([studentId, headword])
```

**WordReviewLog**（一次复习）
```
id, studentWordId, rating(again|hard|good|easy), reviewedAt
elapsedMs           ← 停留时长，秒选判定用
prevState(Json?)    ← 评分前的调度快照，undo 用
requestId(unique?)  ← 弱网重发去重
```

**DictEntry**（本地词典，ECDICT）
```
word, phonetic, translation, tag[], bnc, oxford, ...
```

**DailyLessonCompletion**（4.0 新增）
```
studentId, date, readDone, vocabDone, drillDone, completedAt
@@unique([studentId, date])
```

---

## 13. API 清单

### 13.1 学生端（公开 + 姓名匹配 + IP 门禁 + 限流）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/lesson/today?name=&studentId=` | **（4.0 新增）** 今天的课 + 完成度 |
| GET | `/api/morning-quiz/history-by-name?name=` | 我的记录（404 带 `suggestions`） |
| GET | `/api/morning-quiz/history-detail?submissionId=&name=` | 逐题详情 |
| GET | `/api/morning-quiz/sessions/:id` | 发卷 |
| PATCH | `/api/morning-quiz/sessions/:id/answer` | 保存单题答案 |
| POST | `/api/morning-quiz/sessions/:id/submit` | 提交（`{final: boolean}`） |
| POST | `/api/attendance/scan` | 扫码签到（触发词表推送） |
| GET | `/api/vocab/words?name=` | 我的生词本 |
| POST | `/api/vocab/words` | 加词 |
| POST | `/api/vocab/words/remove` | 移除 |
| GET | `/api/vocab/due?name=` | 今日待复习卡片 |
| POST | `/api/vocab/review` | 提交评分（`{rating, elapsedMs, requestId}`） |
| POST | `/api/vocab/review/undo` | 撤销最近一次评分 |
| GET | `/api/vocab/quiz?name=` | 自测出题 |
| GET | `/api/vocab/stats?name=` | 我的词汇统计 |
| GET | `/api/vocab/lookup?word=` | 查词 |
| GET | `/api/vocab/mistakes?name=` | 我的错题 |
| GET | `/api/vocab/mistakes/practice-queue?name=` | 今日重练队列 |
| POST | `/api/vocab/mistakes/practice-result` | 上报重练结果 |
| POST | `/api/vocab/page-view` | 埋点（history / submission_detail / vocab / vocab_review / vocab_practice / vocab_banner / mistakes / mistake_practice） |

### 13.2 教师端（JWT + 班级权限）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/morning-quiz/sessions/:id/dashboard` | 场次仪表盘 |
| GET | `/api/morning-quiz/classes/:classId/date/:date/dashboard` | 班级当日总览 |
| POST | `/api/morning-quiz/batch-generate` | 批量生成周卷 |
| GET | `/api/morning-quiz/bank-stats` | 题库余量 |
| GET | `/api/marker/queue` | 待判队列 |
| POST | `/api/marker/finalize/:submissionId` | 判分定稿 |
| GET | `/api/vocab/class/:classId/top` | 班级高频生词（今天该讲哪几个词） |
| GET | `/api/vocab/class/:classId/stats` | 班级词汇执行情况 |
| POST | `/api/vocab/push` | 老师推词给全班 |
| GET | `/api/vocab/class/:classId/engagement` | 班级参与度 |

### 13.3 限流口径（重要）

**限流 scope 是 IP，而学校是 NAT ——「全班共用一个配额」。**

35 人在同一分钟内走「交卷 → 翻卡（≤20 次评分）→ 自测 → 错题重练」，
单是 `POST /vocab/review` 就可能冲到 400+/分钟。现行阈值按
「35 人并发峰值 × 1.5」估：

```
review 480/min, lookup 240, words/due/stats/mistakes 180,
quiz/practice-queue 120, practice-result 360, page-view 240
```

---

## 14. 技术栈与部署

```
monorepo
├── apps/api           NestJS + Prisma + PostgreSQL
│                      Puppeteer + KaTeX（PDF 导出）
│                      ts-fsrs（间隔重复，纯本地）
├── apps/web           React 18 + Vite + TailwindCSS + KaTeX
└── apps/ops-dashboard 运维面板（独立部署）
```

**部署**：Railway
- `exam-paper-system`（API）+ `nurturing-radiance`（Web）+ managed PostgreSQL
- push main → 两个服务自动部署
- 迁移随容器启动执行：`npx prisma migrate deploy && node dist/main.js`

**本地开发**：
```bash
docker compose up -d          # PostgreSQL
npm run db:migrate && npm run db:seed
npm run dev                   # API :4000  Web :5173
```

⚠️ **生产运维脚本不要起 NestFactory**（会耗尽连接）。
用 `new PrismaClient()` + 直接实例化只依赖 Prisma 的 service。

⚠️ **时区**：session 时间字段存的是 **UTC 挂钟**（`00:30` = SGT `08:30`）。
`MORNING_QUIZ_TZ_OFFSET_MIN` 默认 480。

⚠️ **未作答不产生 `AnswerScript` 行**（历史上踩过 3 次）。查「谁没答」
要用 `scripts.length === 0`，不是 `awardedMarks === null`。

---

## 15. 铁律与约束

| # | 铁律 | 原因 |
|---|---|---|
| 1 | **零 Anthropic API 调用** | 出题 / QA / 短答判分全部由 Claude 在 chat 完成 |
| 2 | 用户说「判分」→ 走 `/api/marker/*`，**绝不触发 AI grader / `regradeSession`** | 那些路径会调 API |
| 3 | 新 fixture 必须过 **10 项审计**才能 push | 无例外 |
| 4 | past-paper **只存元数据不存原文** | 版权 |
| 5 | `setCode` 不得以 `_v<数字>` 结尾 | 撞垮终身去重 |
| 6 | TFNG 入库必须 mcq + 三选项 + 答案存字母 | EMPTY_OPTIONS 硬闸 |
| 7 | **任何班级绝不重复做同一个 story**（版本无关） | 教学质量 |
| 8 | 每份卷子、每个层级都必须**内容真实可答** | 结构对 ≠ 内容对，必须读原文核对 |
| 9 | 生产脚本不起 NestFactory | 连接耗尽 |
| 10 | 出勤已全面停用（2026-08-24 起） | 早测不再记出勤 |
| 11 | 学生数据（姓名/答卷/成绩）导出给外部 AI 前应**去标识化** | PDPC 义务；当前 marker-dump 仍含姓名，属**已知未修** |
| 12 | 学生端写操作必须带扫码签发的 token | 防「知道姓名即可改他人数据」（OWASP API1:2023） |

---

## 16. 4.0 改动清单

### 16.1 相对 3.0 的变化

| 维度 | 3.0（当前生产） | 4.0（本设计） |
|---|---|---|
| 时间 | 两个固定窗（08:30–09:00 / 16:00–17:30） | **全天开放**，23:59 收尾 |
| 读段限时 | 窗口即限时（30 分钟） | **不限时**，只显示建议用时 + 记录实际用时 |
| 主指标 | 分数 | **完成度**（三段） |
| 学生入口 | 直接进卷子 | **`/my-lesson` 今天的课** |
| 词汇定位 | 成绩页的自愿横幅（转化率 20%） | **课的第二段** + 卷内考试 |
| 第二窗 | 自动开启 | 废弃（机制复用为「全天可继续」） |

### 16.2 分三步迁移（不一次切）

| 阶段 | 内容 | 前置 | 风险 |
|---|---|---|---|
| **A** | 上线 `/my-lesson` + 完成度接口，**时间窗照旧** | 无 | 极低（纯新增） |
| **B** | 放开时间窗（全天）、关掉第二窗自动开启 | A 跑满一周、参与率无下滑 | 中 |
| **C** | 教师端完成度看板；`DailyLessonCompletion` 落表 | B 稳定 | 低 |

**为什么不一次切**：时间窗字段有 **74 处引用**、cron 四个职责互相咬合，
一次全改的爆炸半径覆盖「学生能不能答题」这条最关键路径。

⚠️ 现有 `quizEnd` 引用中大部分是「窗口是否开着」的判断，改成全天后恒真，
但**不能直接删** —— 它们同时承担「这场是不是今天的」职责。必须逐处审。

### 16.3 已知风险与对策

| 风险 | 对策 |
|---|---|
| **题目泄露**（早做的告诉晚做的） | 选项乱序（`QuestionShuffleMap` 已有）；**接受剩余风险** —— 日常练习非选拔考试，抄来的分没用，抄词汇题的人下周还会被同一批词考到 |
| **没有 deadline，完成率可能更低** | ① 保留 08:30 建议时间（社会证明）② 完成度看板给老师，把推力从系统转到人 ③ **上线两周对比参与率，低于基线立即回滚读段窗口** |

### 16.4 度量基线（2026-08-25 实测）

| 指标 | 基线 | 目标 |
|---|---|---|
| 日参与率 | 11/35 = **31%** | ≥ 50% |
| 背段完成率 | 3/35 = **9%** | ≥ 40% |
| 补段完成率 | 1/35 = **3%** | ≥ 30% |
| 词汇「已开始」占比 | **25%**（169/683） | ≥ 40% |
| 读段实际用时 | 中位 12.4 分 / 90 分位 23.6 分 | 观察 |

---

## 附录 A：待定问题

1. 周末是否有课（现状：无场次）
2. 卷内词汇题的分数是否脱离整卷分数门（即时反馈 vs 一致性）
3. 每天词汇题 2 道还是 3 道（3 道正好一周考满 15 词）
4. 拼写题是否进卷子（产出效果最好，但判分会进人工队列）

## 附录 B：术语表

| 术语 | 含义 |
|---|---|
| **story** | 一篇文章的身份，去重单位；`xxx_v1` 与 `xxx_v2` 视为同一个 |
| **fixture** | 文章的 JSON 源文件，入库前的形态 |
| **暂存提交 / 最终提交** | 前者可继续改、不给答案；后者锁定、立即给答案 |
| **分数门 / 答案门** | 两道独立的可见性闸，前者看 status，后者看 finalSubmittedAt |
| **主线词** | 每周 15 个统一推送的核心词，卷内词汇题的题源 |
| **秒选** | 停留 <1.5 秒的正面评分，不写 FSRS |
| **marker queue** | 人工判分队列 |
