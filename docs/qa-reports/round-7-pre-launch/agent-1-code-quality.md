# Agent 1 — Code Structure & Quality (Round 7 Pre-Launch)

工作目录：`C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2`
HEAD：`7e8bf9b`
范围：`e6cb442^..7e8bf9b`（22 commit）
执行时间：2026-05-09

> 工具就绪环境：`npm install` 在 worktree 根跑过一次，`npx prisma generate` 跑过一次（不然 tsc 会报 ~80 个 `@prisma/client` enum 缺失，那不是仓库的问题，是 prisma 客户端没生成的副作用）。

---

## 0. 体检命令的真实输出

### 0.1 TypeScript strict 编译

```
$ cd apps/api && npx tsc --noEmit
EXIT=0
```

```
$ cd apps/web && npx tsc --noEmit
EXIT=0
```

→ **API + WEB 在 strict 下零编译错误**。本项 clean。

### 0.2 循环依赖（madge）

```
$ npx madge --circular --extensions ts apps/api/src/
Processed 156 files (1.1s)
✔ No circular dependency found!

$ npx madge --circular --extensions ts,tsx apps/web/src/
Processed 69 files (875ms)
✔ No circular dependency found!
```

→ **零循环依赖**。本项 clean。

### 0.3 测试有效性

```
apps/web   5 files / 27 tests passed (2.54s)
apps/api   3 files / 61 tests passed (1.30s)
```

每个测试都有真实 `expect(…)` 断言，没有 `it.skip`、空 `it()`、被注释掉的 expect。详见 §8。

### 0.4 `any` 滥用统计

| 范围                | `: any` 出现数 | `as any` 出现数 |
|---------------------|----------------|-----------------|
| `apps/api/src`      | 266 across 64 files | 142 across 36 files |
| `apps/web/src`      | 230 across 35 files | 28 across 17 files |

> 这些数字含 MERGE_INSTRUCTIONS.md 里的 fenced code block（grep 不区分 .md vs .ts），实际 TS 中数字略低，但仍属高位。

---

## 1. Findings

---

### F-1 【Critical】`MorningQuizWeeklyCron.runOnce` 永远把成功当失败 — 协议错位

- **位置**：`apps/api/src/morning-quiz/morning-quiz-weekly-cron.ts:95-102`
- **现象**：
  ```ts
  const items: any[] = (result as any)?.items ?? (result as any)?.results ?? [];
  for (const item of items) {
    if (item?.error) errors.push({ ... });
    else succeeded++;
  }
  ```
  但 `MorningQuizService.batchGenerateForWeek` 实际返回的是 `{ outcomes: Outcome[] }`（`apps/api/src/morning-quiz/morning-quiz.service.ts:468 → return { outcomes }`）。键名不匹配 `items` 也不是 `results`，所以 `items` 永远是 `[]`。
  即使匹配了，`Outcome` 的失败形状是 `{ ok: false, code }`，没有 `error` 字段——所以全部成功的项也会进 `else` 分支被错误地加进 `succeeded`，全部失败的项会被认成成功。
- **影响**：
  1. Sunday 18:00 cron 跑完，`classesSucceeded=0` 永远（因为 items 为 []），dashboard 永远显示 "0 classes generated"。
  2. 错误也不会进 `errors[]`，所以 `notify.fire('morning_quiz_cron_failed', …)` 不会触发——AI 出题失败、QA reject 全栈、Anthropic 宕机，运维**得不到任何告警**。
  3. `MORNING_QUIZ_AUTO_GENERATE=true` 一旦上线，Dan 周一来发现部分班级没有早测，只能事后排查。
- **复现**：
  ```bash
  cd apps/api
  grep -n "items" src/morning-quiz/morning-quiz-weekly-cron.ts   # line 95
  grep -n "return {" src/morning-quiz/morning-quiz.service.ts | head -5  # 468 → return { outcomes }
  ```
  现有 spec 反而 GREEN 因为 mock 返回 `{ items: [...] }`，see `apps/api/test/morning-quiz.spec.ts:943,963`——**测试和实现犯同一个错**，互相掩护。
- **建议修复**：
  ```ts
  const outcomes = (result as { outcomes?: Outcome[] })?.outcomes ?? [];
  for (const o of outcomes) {
    if (o.ok) succeeded++;
    else errors.push({ classId: o.classId, error: o.code });
  }
  ```
  同时改 `morning-quiz.spec.ts:943,963` mock 为 `{ outcomes: [...] }` 并断言 `succeeded` 和 `failed` 计数正确。

---

### F-2 【High】学生提交回看走 `student.service.ts` 路径——绕过 round-3 C1 redaction whitelist

- **位置**：`apps/api/src/student/student.service.ts:266-301` 与 `apps/api/src/morning-quiz/morning-quiz.service.ts:56-110` 比对
- **现象**：
  - morning-quiz 的 `redactSnapshotForStudent`（第 93 行）是 **deny-by-default whitelist**，未列入 `SAFE_SNAPSHOT_SCALAR_FIELDS` 的字段全部丢弃。
  - 但 `student.service.ts.redactForStudent`（第 266 行）—— /student 普通回看路径——仍是**omit-list**：line 282 只是 `markScheme: undefined, answerContent: undefined`，**`correctOption`、`correctAnswer`、`solution`、`explanation`、`exampleAnswer` 等都直通**。
  - Round-3 SUMMARY C1 ("redaction whitelist") 修了 morning-quiz 路径但没修 /student 路径。
- **影响**：
  - 学生在 /student 进入已交卷的 submission（e.g. Practice 模式查看历史），如果题目 snapshotContent 里有 `correctOption: 'B'` 或 `solution: '答案是…'`，就会通过 `getOwnSubmission` 直接喷给前端。
  - 同一份 paper 在 morning-quiz 路径下安全，在 student 路径下泄露；攻击者可以挑路径来拿答案。
  - 现有测试只覆盖 morning-quiz path（`MorningQuizService — student view redaction (Round 1 critical + Round 3 C1)`），没覆盖 student path——所以这条永远是绿的。
- **复现**：
  ```bash
  grep -n "redactForStudent\|markScheme: undefined" apps/api/src/student/student.service.ts
  # student.service.ts:282 看 omit-list 形式
  grep -n "SAFE_SNAPSHOT_SCALAR_FIELDS" apps/api/src/morning-quiz/morning-quiz.service.ts
  # morning-quiz.service.ts:56 看 whitelist 形式
  ```
- **建议修复**：把 `redactSnapshotForStudent` 提到 `apps/api/src/common/snapshot-redact.ts`（或 student 的某个 util），让 `student.service.redactForStudent` 内部也调用同一个 whitelist。同时给 `/student` 加 fuzz 测试（"drops every unknown field"），跟现有 morning-quiz 测试同形。

---

### F-3 【High】`@CurrentUser() user: any` 全栈 36+ 处——AuthUser 类型已经存在却完全未使用

- **位置**（在 scope 内的代表性 10 处）：
  | 严重度 | 文件:行 |
  |---|---|
  | High | apps/api/src/morning-quiz/morning-quiz.controller.ts:77,85,97,109,135,162,172,182,206,220,231,240,247,260,270,287（16 处） |
  | High | apps/api/src/morning-quiz-qa/morning-quiz-qa.controller.ts:23,30,41,54,63（5 处） |
  | High | apps/api/src/codegrader/codegrader.controller.ts:47,68,80,94,112（5 处） |
  | High | apps/api/src/marker/marker.controller.ts:49,59,71,86,102（5 处） |
- **现象**：`apps/api/src/common/current-user.decorator.ts:5` 明确写了 `(_data: unknown, ctx: ExecutionContext): AuthUser`，`AuthUser` 在 `apps/api/src/common/auth.guard.ts:12` 是个完整的 interface（id/role/email/...）。但所有控制器都写 `@CurrentUser() user: any`，扔掉了类型保护。
- **影响**：
  1. 任何 `user.role` 拼写错误（`user.roel`）静默通过编译，运行期才发现 ForbiddenException 永远不抛——这种 bug 历史上正是 round-1/round-3 各种安全 finding 的源头。
  2. 重构（如新增 `user.classId` 字段）时编译器无法告诉你哪些 controller 还没接到。
  3. `as any` 加 `: any` 在 controller 层等于自愿弃权 strict mode。
- **复现**：
  ```bash
  grep -n "@CurrentUser() user: any" apps/api/src/{morning-quiz,morning-quiz-qa,codegrader,marker}/*.controller.ts
  ```
- **建议修复**：全局批替换 `@CurrentUser() user: any` → `@CurrentUser() user: AuthUser`，加一行 `import { AuthUser } from '../common/auth.guard';`。这条改完编译器可能会暴露 1~2 处隐性的 `user.foo` 错字，那是真红利。

---

### F-4 【High】`codegrader.service.ts` 9 处 `(this.prisma as any).codeQuestionTestCase / codeSubmissionResult` 全部多余

- **位置**：`apps/api/src/codegrader/codegrader.service.ts:92,103,129,153,155,197,225,286`（9 处）
- **现象**：`prisma generate` 之后，`PrismaClient` 类型已经把 `codeQuestionTestCase`、`codeSubmissionResult` 暴露出来：
  ```bash
  $ grep -nE "codeQuestionTestCase|codeSubmissionResult" node_modules/.prisma/client/index.d.ts | head -5
  1039:   * `prisma.codeQuestionTestCase`: Exposes CRUD operations …
  1046:    get codeQuestionTestCase(): Prisma.CodeQuestionTestCaseDelegate<ExtArgs>;
  1056:    get codeSubmissionResult(): Prisma.CodeSubmissionResultDelegate<ExtArgs>;
  ```
  我直接写了 minimal repro 验证 `prisma.codeQuestionTestCase.findMany()` 不需要任何 cast 就能编译通过（`tsc --noEmit` exit 0）。
- **影响**：
  1. 类型完全丢失：这 9 处 query 的 `where`、`data`、返回值 全是 `any`。
  2. 已经触发了 line 96 这种丑陋的二次断言：`const currentMarks = existing.reduce((s: number, c: { marksPerCase: number }) => s + c.marksPerCase, 0);`——本来 prisma 自动推出 `marksPerCase: number`。
  3. 留 `as any` 是上线前的"债"信号：哪个开发者忘了哪一步产生的，没人知道。
- **复现**：
  ```bash
  grep -n "this.prisma as any" apps/api/src/codegrader/codegrader.service.ts
  # 9 行，都可以删掉 ' as any' 套壳
  ```
- **建议修复**：批量删除 `(this.prisma as any)` → `this.prisma`。可以同时去掉 line 96/138 的手写型注。

---

### F-5 【High】`MorningQuizTake.tsx` 计时到点 auto-submit 跳过 `flushPendingSaves`

- **位置**：`apps/web/src/pages/MorningQuizTake.tsx:300`
- **现象**：
  ```tsx
  <Timer endsAt={paper.quizEnd} onTimeUp={onSubmit} />
  ```
  `onSubmit` 是 `handleSubmit`（行 90），直接 `await submitToServer()`。没有调用 `onSubmitClick`（行 197），后者才包了 `flushPendingSaves()`（round-3 H6 修复点）。
  代码注释 line 92-95 自承认这个差距："which can't await flush"——但 `onTimeUp` 完全可以是 `async`，下一行就 `await flushPendingSaves()` 然后 submit。
- **影响**：
  - 学生在 09:00:00 那一刻还在打字，最后 600ms（debounce 窗口）的答案永远丢——这正是 round-3 H6 想关闭的丢失窗口，但只在"用户主动按 Submit"时关闭，"时间到"时仍泄露。
  - 8:59:59 输入的最后几个字 → 9:00:00 时间到 → 服务端只记到 8:59:59-600ms 的答案。
- **复现**：
  ```bash
  grep -n "onTimeUp\|onSubmitClick\|flushPendingSaves" apps/web/src/pages/MorningQuizTake.tsx
  # 看 line 197 (onSubmitClick) 和 line 300 (onTimeUp)
  ```
- **建议修复**：
  ```tsx
  <Timer
    endsAt={paper.quizEnd}
    onTimeUp={async () => {
      try { await flushPendingSaves(); } catch { /* surfaced via saveError */ }
      onSubmit();
    }}
  />
  ```
  或者更干净——`onSubmit` 就由 `ExamShellChrome` 直接传 `onSubmitClick` 给 Timer。

---

### F-6 【Medium】`generateAttendanceWorkbook` 单方法 236 行——可读性 / 测试性瓶颈

- **位置**：`apps/api/src/morning-quiz/morning-quiz-export.service.ts:47-282`
- **现象**：单个 method 拉了 3 张表 + 拼 3 个 sheet + 写表头/zebra/数据行/汇总行/审计行，全在一个函数里。
- **影响**：
  1. 单元测试只能整张 .xlsx 校验"3 sheet + row 数"（现有 spec 第 ~840 行的覆盖度），没法独立校验单个 sheet 的列顺序、染色、边界格式。
  2. 想加第四张 sheet 必须读完前三张才知道在哪嵌入。
  3. 未来给 export 加 i18n（中英表头）会再扩 100 行。
- **测度**（top 5 长函数，scope 内）：
  ```
  236L morning-quiz-export.service.ts:47-282     generateAttendanceWorkbook
  119L morning-quiz.service.ts:709-827           getStudentView
   99L marker.service.ts:51-149                  listQueue
   98L codegrader.service.ts:171-268             submit
   96L morning-quiz.service.ts:207-302           createSession
  ```
- **复现**：上面那个 awk/python 扫描脚本任选其一即可。
- **建议修复**：拆出 `buildAttendanceSheet(wb, rows)`、`buildScoreSheet(wb, rows)`、`buildAbsenceSheet(wb, rows)` 三个 private helper；主方法只留 query + helper dispatch + audit log，预计降到 ~80 行。

---

### F-7 【Medium】`TEACHER_ROLES` 常量在两个 controller 里重复定义，role-check 逻辑全栈散布 19 处

- **位置**：
  - `apps/api/src/morning-quiz/morning-quiz.controller.ts:61` `const TEACHER_ROLES = new Set(['teacher', 'head_teacher', 'admin']);`
  - `apps/api/src/morning-quiz-qa/morning-quiz-qa.controller.ts:15` 同上，独立常量
  - `apps/api/src/codegrader/codegrader.service.ts:?` 用 `ROLES_TEACHER`
  - `apps/api/src/morning-quiz/morning-quiz.service.ts:208,310,360,682` 散布 4 处 inline `if (!['teacher','head_teacher','admin'].includes(actor.role))`
  - `apps/api/src/morning-quiz/morning-quiz-export.service.ts:48` 又一份 inline
- **现象**：`grep -n "teacher_required" apps/api/src` 共 19 处 throw，写法分四种风格（Set+has / array+includes / Set+has 不带 code / 带 code）。
- **影响**：
  - 想加新角色（例如 `vice_principal`）要改 10+ 个文件，漏一个就是 silent privilege bug。
  - controller 偶有漏检（morning-quiz-qa.controller.ts:54 `approve` 没 check role），靠 service 兜底——defense-in-depth 不一致。
- **建议修复**：抽 `apps/api/src/common/role-guards.ts`：
  ```ts
  export const TEACHER_ROLES = new Set(['teacher', 'head_teacher', 'admin']);
  export function assertTeacher(actor: { role: string }) {
    if (!TEACHER_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
  }
  ```
  service / controller 全部走这一个。配合 F-3 的 `AuthUser` 类型化。

---

### F-8 【Medium】控制器构造 `actor` 对象的 5-token 字面量重复 18 次

- **位置**：每个 morning-quiz / morning-quiz-qa / codegrader / marker controller 的 5+ method。
- **现象**：
  ```ts
  return this.svc.foo(arg, {
    id: user.id,
    role: user.role,
    ip: req.ip ?? null,
  });
  ```
  在 `apps/api/src/morning-quiz/morning-quiz.controller.ts` 至少 6 次，`marker.controller.ts` 5 次，`morning-quiz-qa.controller.ts` 4 次，`codegrader.controller.ts` 4 次——总 19 次同结构 inline 字面量。
- **影响**：与 F-7 同类——加字段（如 actor.classId）要改 19 处，统计性人为错误。
- **建议修复**：在 `common/current-user.decorator.ts` 旁边加：
  ```ts
  export function actorOf(user: AuthUser, req: Request): ActorCtx {
    return { id: user.id, role: user.role, ip: req.ip ?? null };
  }
  ```
  Controller 一行 `actorOf(user, req)`。

---

### F-9 【Medium】`MERGE_INSTRUCTIONS.md` 散落在 10 个 src 子目录里——构建产物 / 历史脚手架污染

- **位置**：
  ```
  apps/api/src/admin-cost/MERGE_INSTRUCTIONS.md
  apps/api/src/admin-syllabus/MERGE_INSTRUCTIONS.md
  apps/api/src/ai-tutor/MERGE_INSTRUCTIONS.md
  apps/api/src/analytics/MERGE_INSTRUCTIONS.md
  apps/api/src/codegrader/MERGE_INSTRUCTIONS.md
  apps/api/src/marker/MERGE_INSTRUCTIONS.md
  apps/api/src/paper-variants/MERGE_INSTRUCTIONS.md
  apps/api/src/perf-routing/MERGE_INSTRUCTIONS.md
  apps/api/src/quality-feedback/MERGE_INSTRUCTIONS.md
  apps/api/src/watermark/MERGE_INSTRUCTIONS.md
  ```
- **现象**：这些是 sub-agent 生成各 feature 时的"merge 这块代码到 main 的步骤说明"，已经合完，**残留在源码树里没清理**。其中含过时的代码片段（e.g. codegrader/MERGE_INSTRUCTIONS.md line 53 `data: any` 是早期草稿）。
- **影响**：
  - grep 噪音（`grep ': any' src` 把 .md 也带上，干扰真实统计）。
  - 新人看到会以为是当前还要执行的 TODO，浪费时间。
  - 文件随 docker image 进部署，膨胀镜像（虽然小）。
- **建议修复**：`git rm apps/api/src/*/MERGE_INSTRUCTIONS.md`，归档到 `docs/historical/merge-instructions/`，或者直接删除——本就该是 PR description 而不是源码。

---

### F-10 【Medium】`morning-quiz-qa.controller.ts:54 approve` 漏 controller-level role check（依赖 service 兜底）

- **位置**：`apps/api/src/morning-quiz-qa/morning-quiz-qa.controller.ts:53-56`
- **现象**：
  ```ts
  @Post('papers/:id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.svc.approve(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }
  ```
  没有 `if (!TEACHER_ROLES.has(user.role)) throw …`。同文件 line 23/31/44 都查了，line 54 的 `approve` 单独漏了。
- **影响**：service 层 `approve(...)` line 565-567 兜底，所以**当下不可被滥用**。但：
  - 防御纵深风格不统一——其他 endpoint 双层守，这条单层守。
  - 如果某天 service 重构把 role 检查迁出去（"已经在 controller 守过了"），这里就单点失守。
- **建议修复**：加一行 `if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');`，跟同文件其他 method 风格一致。或采用 F-7 的 `assertTeacher()`。

---

### F-11 【Low】`MorningQuizTake.tsx:376` SVG path 语法可疑

- **位置**：`apps/web/src/pages/MorningQuizTake.tsx:376`
- **现象**：
  ```tsx
  <path d="M4 3a1 1 0 011-1h11l-2 4 2 4H5v8H3V3a0 0 0 011 0z" />
  ```
  最后那段 `a0 0 0 011 0z`：`a` 弧线命令需要 7 个参数 `rx ry x-rot large-arc sweep x y`，这里 `0 0 0 011 0` 是 `0,0,0,0,1,1,0` 的 squashed form——rx=ry=0 的弧本来就是退化点。
- **影响**：图标渲染无害（多数浏览器忽略），但视觉上 "已标记 flag" 图标可能比设计稿瘦——是上线前 polish 的小毛刺。
- **建议修复**：找设计稿原 path，或者直接换成 lucide-react / heroicons 的 `<FlagIcon />`。

---

### F-12 【Low】`MorningQuizWeeklyCron.runOnce` 注释和单元测试一致 mock 错协议——证据保留

- **位置**：`apps/api/test/morning-quiz.spec.ts:943,963` 与 F-1 配套
- **现象**：单元测试 mock `batchGenerateForWeek` 返回 `{ items: [...] }`、`{ items: [{ classId: 'C1', error: 'AI timeout' }] }`，但**生产代码返回 `{ outcomes }`**。测试通过仅因为 mock 与 cron 都用了同一个错的协议——是 F-1 的活佐证。
- **影响**：单测看似覆盖，实际什么也没保护。Round-7 之后下一次有人把 cron 修对了，这个 spec 立刻翻红——此时如果不知道历史，会以为是 cron 的修改有 regression。
- **建议修复**：跟 F-1 一并修。修 cron 的同时把 spec 改对：mock 返回 `{ outcomes: [{ ok: true, ... }, { ok: false, code: 'ai_timeout', ... }] }`，断言 `succeeded=1, failed=1`。

---

### F-13 【Nit】`as any` 在 morning-quiz-qa cache_control 处可以改成 SDK 类型

- **位置**：`apps/api/src/morning-quiz-qa/morning-quiz-qa.service.ts:249`
- **现象**：`system: [{ ... cache_control: { type: 'ephemeral' } }] as any`——SDK `@anthropic-ai/sdk@0.32.x` 已经支持 prompt caching block。
- **影响**：丢类型提示。
- **建议修复**：`system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } } satisfies Anthropic.TextBlockParam]` 或者升级 SDK。低优先级。

---

### F-14 【Nit】commit `6ce57ff` 描述说 MorningQuizTake "从 1100 行收缩到 ~250 行"，当前 404 行——后续 commit 加回去 154 行

- **位置**：`apps/web/src/pages/MorningQuizTake.tsx`（404 行）
- **现象**：commit `6ce57ff` 说收缩到 ~250；后续 `03a3292`、`db4dca1` 又加回了 H6/H17/H19/H22 等修复（约 +130 行）。当前 404 行——commit message 当时写得没错，但 changelog 视角看会以为现在还是 250。
- **影响**：纯文档/沟通漂移，不影响运行。
- **建议修复**：不必改历史 commit。如果出 round-7 changelog，注明"实际当前 404 行，含 round-3 后续补丁"。

---

## 2. 不算 finding 的核查（说明已查过）

- ✅ `prisma generate` 后 strict tsc 全过——这意味着 5037 LOC + 2722 LOC 的 in-scope 代码类型安全（除 `any` 外）。
- ✅ madge 跑 `apps/api/src` 和 `apps/web/src` 全无循环依赖。
- ✅ `morning-quiz-qa.module.ts` 没显式 import `AuditModule`，但 `AuditModule` 是 `@Global()`（`audit.module.ts:5`），DI 正常。
- ✅ `apps/web/src/components/exam/__tests__/*.test.{ts,tsx}` 共 5 个文件 27 测试，**每条都有真实 `expect(…)` 断言**，没有空体 it / it.skip / 注释掉的 expect。
- ✅ apps/api 的 61 个 vitest 全是真测试，含 `MorningQuizService — student view redaction` 8 个、`AbsenceAlertService.runOnce dedup` 2 个、`MorningQuizExportService.generateAttendanceWorkbook` 2 个 等关键路径覆盖。

---

## 3. 严重度统计

| 严重度 | 数量 | 编号 |
|--------|------|------|
| Critical | 1 | F-1 |
| High | 4 | F-2, F-3, F-4, F-5 |
| Medium | 5 | F-6, F-7, F-8, F-9, F-10 |
| Low | 2 | F-11, F-12 |
| Nit | 2 | F-13, F-14 |
| **总计** | **14** | |

---

## 4. 上线前优先级建议

1. **必须修**（阻断上线）：F-1（cron 永远报 0 成功，且 `MORNING_QUIZ_AUTO_GENERATE=true` 一旦打开会让运维彻底瞎）。
2. **强烈建议修**（任何一项被攻击者触发都是事故）：F-2（学生路径 redaction 漏洞）、F-5（计时到点丢答案）。
3. **进 round-7 cleanup PR**（不阻断但应在上线后第一周清掉）：F-3（`AuthUser` 类型化）、F-4（codegrader 多余 `as any`）、F-7/F-8（TEACHER_ROLES + actorOf 抽公共）、F-9（删 MERGE_INSTRUCTIONS.md）、F-10（approve role check 一致性）。
4. **可拖到 round-8**：F-6、F-11、F-12、F-13、F-14。

— Agent 1 / Code Structure & Quality / 2026-05-09
