# Round-3 深度审查 · Agent 8 · 练习模式判分诚信切片

审查范围: `git diff a3398dc^..5bb3a04` (commits a3398dc → 5bb3a04, 含 7 commits)
审查目标: `?mode=practice` 是否引入答案/解释泄漏到学生端的回归

---

## 核心结论 (TL;DR)

**Critical 安全回归 — 设计层面已确认前端读取本应受保护的判分字段，redaction 函数与设计契约不一致。**

- 学生在练习模式下，**只要 `Question.content` 中存在 `correctOption` / `correctAnswer` / `exampleAnswer` / `explanation` 字段，就会被原封不动地序列化到 GET `/morning-quiz/sessions/:id` 响应里**。
- 当前生产数据未必填充这些字段（AI 生成器与 IELTS 真题种子都没写入它们），所以**当前数据下尚无实际泄漏**；但设计契约 (docs/UI-QUESTION-TYPES.md) 明确把这四个字段列为"练习模式判分用"，前端组件已硬编码读取它们。**只要任何一条种子数据/AI prompt 改动给 `Question.content` 加入这些字段，redaction 就会立即穿透**。
- `?mode=practice` 是**纯前端开关**，后端 `GET /morning-quiz/sessions/:id` 不接收 `mode` 参数 → **学生只要修改 URL 就可以触发"练习反馈" UI**，前端会用同一份 GET 响应去判分。**判分根本不区分练习/考试** — 只要响应中带答案，DevTools 立刻可读。

**结论 = critical**：redaction 设计与 UI 契约严重脱节。当前没爆雷只是因为数据"恰好"没填这些字段，**不是因为有防御机制**。

---

## 详细 Findings

### 🔴 Critical-1 ─ Redaction 黑名单与 UI 设计契约不同步：四个判分字段未被剥离

**严重度**: Critical（设计漏洞 + 已落入代码）

**证据**:

1. 后端 redactor (`apps/api/src/morning-quiz/morning-quiz.service.ts:632-642`，commit `5bb3a04`)：
   ```ts
   const stripOptions = (opts: unknown) => {
     if (!Array.isArray(opts)) return opts;
     return opts.map((o: any) => ({ key: o?.key, text: o?.text }));
   };
   const stripSnapshotContent = (sc: unknown) => {
     if (!sc || typeof sc !== 'object' || Array.isArray(sc)) return sc;
     const { markScheme, answerContent, ...rest } = sc as Record<string, unknown>;
     return rest;  // ← 只剥 markScheme 和 answerContent, 其余原样保留
   };
   ```

2. 前端组件读取以下字段（来自同一 commit）：

   | 字段 | 文件:行 | 用途 |
   |---|---|---|
   | `snapshotContent.correctOption` | `apps/web/src/components/exam/questions/OLevelMcqList.tsx:20` | MCQ 正确选项 key |
   | `snapshotContent.correctOption` | `apps/web/src/components/exam/questions/OLevelComprehension.tsx:89` | 阅读理解 MCQ 正确答案 |
   | `snapshotContent.correctOption` | `apps/web/src/components/exam/questions/OLevelVocabInContext.tsx:61` | 语境词汇 MCQ 正确答案 |
   | `snapshotContent.correctOption` | `apps/web/src/components/exam/questions/IELTSReadingPassage.tsx:226` | IELTS 选择题正确答案 |
   | `snapshotContent.correctAnswer` | `apps/web/src/components/exam/questions/OLevelCloze.tsx:58` | 完形填空标准答案文本 |
   | `snapshotContent.exampleAnswer` | `apps/web/src/components/exam/questions/OLevelSentenceTransformation.tsx:63` | 句型转换示范答案 |
   | `snapshotContent.explanation` | `OLevelMcqList.tsx:82`, `OLevelComprehension.tsx:150`, `IELTSReadingPassage.tsx:259` | 错题解析 |

3. 设计文档 `docs/UI-QUESTION-TYPES.md`（commit `5bb3a04`）显式声明这些字段属于 `snapshotContent`，并标注"练习模式判分用 (可选)"：
   - 第 79 行：`correctOption: string  — 练习模式判分用(可选)`
   - 第 87 行：`correctOption: string  — 练习反馈`
   - 第 92 行：`每题: correctAnswer: string — 练习模式判分(大小写不敏感)`
   - 第 104 行：`exampleAnswer: string (可选)  — 练习模式可展开查看`
   - 第 108 行：`correctOption: string`

4. 测试 `apps/web/src/components/exam/__tests__/OLevelMcqList.test.tsx:20` 直接构造：
   ```ts
   snapshotContent: { stem: 'Choose the correct word.', correctOption: 'B' }
   ```
   说明设计意图就是让 `correctOption` 在 `snapshotContent` 里到达前端。

**攻击场景 / 绕过路径**:

A) **当下（今天的种子数据）**：grep 结果显示当前 AI generator (`apps/api/src/ai/quick-paper.service.ts`) 与 IELTS 真题种子 (`apps/api/scripts/seed-local-mq.ts`) 都未在 `Question.content` 中写入 `correctOption / correctAnswer / exampleAnswer / explanation`。**今天直接抓 GET 响应拿不到 string 形式的答案 key**——这是巧合，不是防御。

B) **导火索 — 任意一条数据加入这些字段就立刻穿透**：
   - 教师在 `QuestionEdit.tsx` 中通过 `correctOption` radio 切换的实际是 `option.correct: boolean`（被 redactor 剥）。但任何一次 schema 演进（例如把 boolean 转成 string key 存到 `content.correctOption`，或 AI prompt 改为生成 `explanation`）都会让答案立即流到 F12。
   - `docs/UI-QUESTION-TYPES.md` 已经把这些字段列为契约。下一个 PR 写后端时**没有任何 typecheck / lint / 测试**会阻止开发者把它们塞进 `Question.content`。
   - 后端测试 `apps/api/test/morning-quiz.spec.ts:322-336` 只验证 `markScheme + answerContent` 被剥。**显式把 `correctOption: 'B'` 放进 fixture 跑同一测试，会通过** — 因为 redactor 不动它。

C) **学生攻击路径**：
   1. 学生扫码进入早测页面 → URL 加 `?mode=practice`（前端就接受）。
   2. F12 Network → 抓 GET `/morning-quiz/sessions/:id` 响应。
   3. 一旦数据中有 `correctOption`，直接读 → 满分。
   4. **更恶劣**：即使 URL 不写 `?mode=practice`（即正常考试模式），GET 响应仍带 `correctOption`，因为 mode 是纯前端的。F12 同样可见。

**建议修复**:

1. 立刻在 `stripSnapshotContent` 增加黑名单：
   ```ts
   const { markScheme, answerContent, correctOption, correctAnswer, exampleAnswer, explanation, ...rest } = sc;
   ```
   同时在 `apps/api/src/student/student.service.ts:280-283` 的 `redactForStudent` 同步加。
2. 把 `redactSnapshotForStudent` 和 `getStudentView` 用的 helper **抽出成单一 export 共享**，并在 spec 里 fuzz：传入一个夹带所有可疑 key 的 snapshotContent，断言出来全部 undefined。
3. **架构层**：考虑改成"**白名单**" — `snapshotContent` 进学生端时只透传明确允许的字段（`stem`, `passage`, `passageTitle`, `taskType`, `headingsBank`, `wordBank`, `original`, `starter`, `maxWords`, `targetWord`, `contextSentence`, `uiKind`, `passageCleaned` 等），其余 drop。黑名单永远跟不上 schema 演进。
4. **判分必须在后端**：练习模式如果要"即时反馈"，应当 `POST /morning-quiz/sessions/:id/check { paperQuestionId, answer }` 由后端比对，仅返回 `{ correct: boolean, explanation?: string }`。前端不该持有任何 ground truth。这同时回答了"练习模式判分需要后端额外路径"的暗示。

---

### 🔴 Critical-2 ─ `?mode=practice` 是纯前端开关，没有后端校验

**严重度**: Critical（设计缺陷，与 Critical-1 复合）

**证据**:

1. 前端解析 `apps/web/src/pages/MorningQuizTake.tsx:46`:
   ```ts
   const mode = searchParams.get('mode') === 'practice' ? 'practice' : 'test';
   ```
2. GET 调用 `apps/web/src/lib/api.ts:270-271` 不传 mode:
   ```ts
   morningQuizSession: (sessionId: string) =>
     request('GET', `/morning-quiz/sessions/${sessionId}`),
   ```
3. 后端 controller `apps/api/src/morning-quiz/morning-quiz.controller.ts:138-141`:
   ```ts
   @Get('sessions/:id')
   getSession(@Param('id') id: string, @CurrentUser() user: any) {
     if (user.role !== 'student') throw new ForbiddenException('student_only');
     return this.svc.getStudentView(id, user.id);
   }
   ```
   完全不接收 mode/practice 参数。`getStudentView` 内部也没有 practice 分支。

**攻击场景**:

- 早测（强制考试）和"练习/复习"用同一份 GET 响应 → **后端无法区分，redaction 必须无条件最严**。
- 前端 mode 仅控制 UI 反馈展示。学生在考试中改 URL 为 `?mode=practice` 会激活"即时显示对错"的视觉反馈。**今天没爆只是因为响应不含 `correctOption`**；一旦 Critical-1 中的字段进入数据，**考试模式下加 `?mode=practice` 即时作弊**。
- 反之亦然：`?mode=test` 不会"补回"任何防御 — 只是不渲染绿/红边框，但响应里若有答案，F12 一样可见。

**建议修复**:

- 在 controller 接收 `?mode=practice|test` 并写入审计 (`audit.log`) — 至少留下"学生在 morning quiz 期间用 practice mode 抓包"的证据。
- 真要支持练习时的即时反馈，走专属 POST `/check` 路由，由后端在数据库读取真值后只返回 boolean + 可选 explanation；GET 路由始终不带答案。
- 如果当前 session 是 `MorningQuizSession` (status=active)，**禁止** `?mode=practice` 触发反馈 UI。即：mode 只在"非早测"上下文（自学/复习路径）有效。

---

### 🟠 High-1 ─ 后端单元测试覆盖率盲点 — 只覆盖两个字段

**严重度**: High（流程问题）

**证据**: `apps/api/test/morning-quiz.spec.ts:322-336`：
```ts
it('strips markScheme + answerContent from snapshotContent', () => {
  const pq = {
    snapshotOptions: null,
    snapshotContent: {
      stem: 'Explain photosynthesis.',
      markScheme: '6CO2 + 6H2O -> C6H12O6 + 6O2 (3 marks)',
      answerContent: { text: 'plants use sunlight…' },
      passage: 'visible legitimate field',
    },
  };
  const out = redactSnapshotForStudent(pq) as any;
  expect(out.snapshotContent).not.toHaveProperty('markScheme');
  expect(out.snapshotContent).not.toHaveProperty('answerContent');
  ...
});
```

测试只断言这两个字段缺失。注释（行 273-280）说明这是 Round 1 的"answer-key leak"回归守护，但 Round 2/3 引入的 `correctOption / correctAnswer / exampleAnswer / explanation` 都没有对应回归测试。

**建议**: 重写这条 test 为"未知键白名单测试"：传入一个 snapshotContent 包含 100 个随机字段，断言只有 `stem / passage / passageTitle / taskType / ...` 这些显式允许的字段还在。

---

### 🟠 High-2 ─ 前端测试不覆盖练习模式分支的"无后端答案时"行为

**严重度**: High

**证据**: 前端测试套件（commit e482df8 / 5bb3a04）：
- `apps/web/src/components/exam/__tests__/OLevelMcqList.test.tsx` 显式构造 `correctOption: 'B'` → 走 happy path。
- `apps/web/src/components/exam/__tests__/ExamProvider.test.tsx` 测 mode 字符串透传，不测判分。
- 没有任何测试断言"如果 `snapshotContent.correctOption` 缺失，组件不应崩溃，也不应渲染答案"。

**攻击场景**：当后端正确实施 redaction 后，`correctOption` 会变 undefined。前端组件用 `?.` 防御性读取没问题。但缺测试 → 下一次手滑去掉 `?.` 不会被发现。

**建议**: 加测试 case："practice mode + 无 correctOption" → 不应渲染绿边框、不应显示 `Correct: X`、不应抛错。

---

### 🟡 Medium-1 ─ Highlighter / StickyNote 写 localStorage 没考虑跨学生设备

**严重度**: Medium（隐私/数据卫生）

**证据**: `IELTSReadingPassage.tsx:160-161`:
```ts
const hlKey = `mq:hl:${paper.sessionId}`;
const noteKey = `mq:nt:${paper.sessionId}`;
```
key 只用 `sessionId`，不带 `studentId`。同一 iPad 第二位学生扫码进入相同 session（早测一个班共用 sessionId）会读到上一位学生的笔记/高亮。

**攻击/泄漏场景**: A 学生在原文上高亮了答题位置 + 写笔记 → 提交退出 → B 学生扫码 → IELTSReadingPassage 加载时直接显示 A 的笔记和高亮。**=笔记里写"答案是 D"就直接给下一位看了**。

**建议**: localStorage 写入路径全部加 `studentId`：`mq:hl:${sessionId}:${studentId}`。需要从 ExamProvider 注入 student id。同时 `mq:answers:${sessionId}` 也有同样问题（ExamContext.tsx:74）。

---

### 🟡 Medium-2 ─ `level` 字段从 ClassEnglishLevel 推断时可能透露 IELTS Reading 是 passage_pick

**严重度**: Medium（信息披露，影响小）

**证据**: `morning-quiz.service.ts:653-657`：返回的 `level` 在没有 ClassEnglishLevel 行时会根据 `paper.config.mode === 'passage_pick'` 推断为 `ielts_authentic`。这本身正确，但 paperMode 直接暴露给学生：`paperMode: 'passage_pick' | 'standard' | null`。学生即可知道当天是不是真题套卷。

**影响**: 不是答案泄漏；只是题型标签泄漏，没有直接利用价值，列在这只为完整。

**建议**: 维持现状或不返回 paperMode，让前端通过 question 数据自行推断（registry 里已经有 `ieltsTaskTypes` 检测）。

---

## 跨切片对老师/管理员视图的影响

`getDashboard` (`morning-quiz.service.ts:787-817`) 仅返回 attendance/score 元数据，不返回 `snapshotContent` —— **老师视图层面这次改动未触及，没有新的老师→学生泄漏面**。

老师查看个人 submission 的路径走的是另一个 controller (`student.service.ts` / `analytics.service.ts`)，**不在本次切片内**。同样的 `correctOption / explanation` 黑名单缺失会影响老师视图，但那是横切问题，建议 Agent 1/2 切片处理。

---

## 总体结论

**Critical**。

Round-3 切片在前端引入了一整套"练习模式即时反馈" UI，并通过 `docs/UI-QUESTION-TYPES.md` 把 `correctOption / correctAnswer / exampleAnswer / explanation` 列为前端读取的合法字段，但**后端 redactor 黑名单完全没有同步更新**。当前没爆雷的唯一原因是数据未填充——这是巧合而不是防御。任意一个 PR 给 AI prompt 加 explanation、给种子数据加 correctOption，都会让早测在 F12 网络面板裸奔。

`?mode=practice` 是**纯前端字符串**，后端不感知 → 即便 redaction 修好，仍需明确：练习模式与考试模式必须共享"最严格"的响应；任何"友好反馈"必须走独立 `POST /check` 端点，由后端持有 ground truth。

强烈建议在合并 a3398dc..5bb3a04 之前先：(1) 把上述 4 个字段加入 `stripSnapshotContent` 的黑名单，(2) 把 redactor 切成白名单实现，(3) 加一条 fuzz 测试守门。
