# Agent 10 — 测试覆盖盲区审查

**审查范围**：`_audit_review/exam/__tests__/*.test.{ts,tsx}` 5 个文件 + `apps/web/test-setup.ts` + `apps/web/vite.config.ts` + `apps/web/package.json`

**结论先行（TL;DR）**：所谓"26 用例全绿"是**虚构事实**。以下三件事，每一件都是 **Critical** 级别的红旗：

1. **测试文件不在产品代码里**。它们位于 `_audit_review/exam/__tests__/`——一个 git untracked 的散落目录，没有任何代码引用过它。任务里写的路径 `apps/web/src/components/exam/__tests__/` **根本不存在**。
2. **`apps/web/package.json` 没有任何测试依赖**：没有 `vitest`、没有 `@testing-library/react`、没有 `@testing-library/user-event`、没有 `jsdom` / `happy-dom`，没有 `npm test` 脚本。`vite.config.ts` 里也没有 `test` 配置块和 `setupFiles`。
3. **`test-setup.ts` 文件不存在**——`Glob "**/test-setup*"` 0 命中。
4. 真正运行 `npx vitest run _audit_review/exam/__tests__/` 的输出是 **3 个 React 测试套件直接 fail（"Failed to load url @testing-library/react"），只有 2 个纯函数 / 纯函数路由的文件 17 用例 pass**。

> **真实数字：跑通 17 / 期待 26。9 个 React 用例（ExamProvider, OLevelMcqList, OLevelSentenceTransformation）全部跑不起来**——更糟的是，被审查的组件本身（`_audit_review/exam/ExamContext.tsx`、`questions/*.tsx`、`shared/*.tsx`、共 1813 行）也**完全不在生产 web 应用里**——`apps/web/src/components/` 只有 3 个文件（`AuthImage.tsx`、`CodeAnswerInput.tsx`、`MathHtml.tsx`），生产 `MorningQuizTake.tsx` 1126 行没有 import 任何 `_audit_review` 路径。

测试和被测对象**双双脱钩于真实产品**。这是"刷数字"——而且数字还刷得不对。

---

## 1. 测试运行状态

### 1a. 用 `npm test` 跑

```text
$ cd apps/web && npm test
npm error workspace @app/web@0.1.0
npm error Missing script: "test"
```

`apps/web/package.json` 没有 `test` 脚本：

```json
"scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview ..." }
```

根 `package.json` 的 `"test"` 只跑 api（NestJS Jest），不跑 web。

### 1b. 直接 `npx vitest run` （绕过缺失的脚本）

```text
$ npx vitest run _audit_review/exam/__tests__/
 ❯ _audit_review/exam/__tests__/OLevelMcqList.test.tsx (0 test)
 ❯ _audit_review/exam/__tests__/ExamProvider.test.tsx (0 test)
 ❯ _audit_review/exam/__tests__/OLevelSentenceTransformation.test.tsx (0 test)
 ✓ _audit_review/exam/__tests__/textUtils.test.ts (9 tests)
 ✓ _audit_review/exam/__tests__/registry.test.ts (8 tests)

 FAIL  _audit_review/exam/__tests__/ExamProvider.test.tsx
 FAIL  _audit_review/exam/__tests__/OLevelMcqList.test.tsx
 FAIL  _audit_review/exam/__tests__/OLevelSentenceTransformation.test.tsx

Error: Failed to load url @testing-library/react
       (resolved id: @testing-library/react)
       in _audit_review/exam/__tests__/ExamProvider.test.tsx.
       Does the file exist?

 Test Files   3 failed | 2 passed (5)
      Tests   17 passed (17)
```

实测结果：**3 套件 fail，2 套件 pass，0 用例失败但 9 个 React 用例从未执行**（"0 test" 是因为 import 阶段 throw 了，根本没有进入用例发现）。

### 1c. 缺失依赖核对

```text
$ ls node_modules/@testing-library/    → No such file or directory
$ ls node_modules/jsdom                → No such file or directory
```

`vitest` 因为是另一个工作区拽进来的 transitive dep 才存在；React 测试需要的 `@testing-library/react`、`@testing-library/user-event`、`jsdom`/`happy-dom` 全没装。

### 1d. 测试针对的代码也"漂浮"

```text
$ git status --short _audit_review/
?? _audit_review/

$ git ls-files _audit_review/
(empty)
```

`_audit_review/` 是 **untracked**——既没 commit、也没被任何 import 引用、连 `tsconfig` 的 `include` 都不覆盖（`apps/web/tsconfig.json` 只看 `src/`）。

**初步严重度：High（整套测试就是 paper tiger）。**

---

## 2. 五个测试文件的用例清单（共 26 计划用例 / 17 实跑 / 0 失败）

### `textUtils.test.ts` — 9 用例 ✓

```text
clean
  - replaces U+FFFD with en-dash
  - handles null and empty
  - normalises CRLF to LF
reflowPassage
  - keeps paragraph breaks
  - folds single newlines into spaces
  - separates ABC paragraph markers
  - returns empty for empty input
splitStem
  - splits on the LAST blank line
  - returns empty instruction when no blank line
```

### `registry.test.ts` — 8 用例 ✓

```text
pickRenderer
  - routes passage_pick papers to IELTS
  - routes IELTS taskType regardless of paperMode
  - routes uiKind=cloze to OLevelCloze
  - routes uiKind=vocab to OLevelVocabInContext
  - routes uiKind=transformation to OLevelSentenceTransformation
  - routes long-passage MCQs to OLevelComprehension
  - falls back to OLevelMcqList for plain MCQ
  - does not crash on empty paper
```

### `ExamProvider.test.tsx` — 4 用例 ✗（套件 fail，0 执行）

```text
ExamProvider
  - exposes mode and updates font scale
  - toggles flagged questions and persists
  - caches answers locally and debounce-fires server save
  - hydrates from localStorage on mount
```

### `OLevelMcqList.test.tsx` — 3 用例 ✗（套件 fail，0 执行）

```text
OLevelMcqList
  - renders the first question + options
  - lets the user pick an option and shows feedback in practice mode
  - Next button advances to question 2
```

### `OLevelSentenceTransformation.test.tsx` — 2 用例 ✗（套件 fail，0 执行）

```text
OLevelSentenceTransformation
  - renders the original sentence and starter
  - shows live word count and over-limit warning
```

总计 **9 + 8 + 4 + 3 + 2 = 26 计划用例，实际通过 17，剩 9 个连导入都失败**。

---

## 3. 覆盖矩阵

被测对象：`_audit_review/exam/` 1813 行 React + utils 代码。

| 维度 | 场景 | 覆盖? | 说明 |
|---|---|---|---|
| **数据层** | clean / reflow / splitStem 边界 | ✓ | textUtils 9 用例覆盖良好 |
| **路由** | pickRenderer 8 个分支 | ✓ | registry.test.ts 全覆盖 |
| **路由** | first question 没有但后续题有 IELTS taskType | ✗ | 只看 `paper.questions[0]`，没测异质 paper |
| **Context 基础** | mode / fontScale / flag toggle / answers debounce / hydrate | ◐ | **代码写了但跑不起来**（套件 fail） |
| **错误路径** | onPersistAnswer 抛异常时 UI 行为（savingId 是否清掉、是否提示） | ✗ | catch 里只是 `/* swallow */`，**没人测过 reject 路径** |
| **错误路径** | localStorage 满 / 抛 QuotaExceeded | ✗ | 代码里 `try {} catch { ignore }`，未验证用户感知 |
| **错误路径** | localStorage JSON 损坏（被改过） | ✗ | hydrate 里 `try/catch ignore`，会静默丢答案，无测试 |
| **错误路径** | 401 token 过期、500 服务器错 | ✗ | 调用层没有 status 区分，testing 也没覆盖 |
| **网络失败** | 离线时 setIsOffline 触发 | ✗ | 只在 useEffect 监听 `online`/`offline`，无 jsdom 模拟 |
| **网络失败** | 重连后未刷写的 answer 是否补 flush | ✗ | 代码**根本没有重连补传逻辑**，无测试也无功能 |
| **网络失败** | 请求 timeout vs 断网 | ✗ | 同上 |
| **并发** | 两个 tab 同时改 localStorage | ✗ | 没监听 `storage` 事件，无测 |
| **并发** | debounce 期间快速切题、中途取消 | ✗ | timer map 在 unmount 时未清，可能调用 setState on unmounted |
| **并发** | 同一 qid 600ms 内连击多次 | ◐ | 测了 1 次后 fire，没测"持续输入永远 fire 不了"反例 |
| **跨题型组合** | 一份卷子 MCQ + Cloze + IELTS 段落混排 | ✗ | pickRenderer 只看第 1 题，**架构上无法支持混排** |
| **mode=practice 分支** | MCQ 显示反馈 | ◐ | OLevelMcqList 测了一行 `Correct: B`，没测正确情况、没测 explanation 显示 |
| **mode=practice 判分诚信** | practice 模式不应该把 correctOption 一直发给 client（潜在作弊） | ✗ | snapshotContent 直接含 correctOption；无测试无防护 |
| **重做/二进** | initialAnswers 与 localStorage 冲突合并 | ✗ | 代码写了 `{ ...cached, ...initialAnswers }` 但**没测顺序**；二进时旧答案应展示 |
| **重做/二进** | 已提交后再次进入应只读 | ✗ | 无 readonly mode，无测 |
| **Cloze [BLANK]** | 数量与答案数不匹配 | ✗ | OLevelCloze.tsx 138 行，**0 测试**（registry 里仅路由测） |
| **Cloze [BLANK]** | 嵌套 / 同一段多个 BLANK 顺序 | ✗ | 同上 |
| **VocabInContext** | 多 correct（answer 可多选） | ✗ | OLevelVocabInContext.tsx 143 行，**0 测试** |
| **VocabInContext** | 0 correct（题目数据缺失 correctOption） | ✗ | 同上 |
| **IELTSReadingPassage** | DraggableSplit 拖拽分栏 | ✗ | 488 行最复杂的组件，**0 测试** |
| **IELTSReadingPassage** | Highlighter 选区高亮 / 取消 | ✗ | Highlighter.tsx 149 行，0 测 |
| **IELTSReadingPassage** | StickyNote 创建 / 编辑 / 删除 / 持久化 | ✗ | StickyNote.tsx 102 行，0 测 |
| **IELTSReadingPassage** | matching/true_false/sentence_completion 各 task type 渲染 | ✗ | 12 种 IELTS taskType，0 测 |
| **OLevelComprehension** | 长 passage + 多 MCQ 的滚动联动 | ✗ | 172 行，0 测 |
| **Timer** | 倒计时到 0 自动提交 | ✗ | Timer.tsx 45 行，0 测；MorningQuizTake 是否监听 onExpire 不可知 |
| **Timer** | quizEnd 已是过去时间 | ✗ | 0 测 |
| **键盘导航** | Tab / Enter / 方向键切题 | ✗ | 0 测，组件也没有 keydown handler |
| **键盘导航** | 屏幕阅读器 ARIA | ✗ | 0 测 |
| **OfflineBadge** | 离线时是否出现、文案 | ✗ | OfflineBadge.tsx 19 行，0 测 |
| **InlineGapInput** | 焦点切换、输入校验 | ✗ | 57 行，0 测 |
| **QuestionNavBar** | 跳题 / flagged 视觉差异 / Submit 入口 | ✗ | 55 行，0 测 |

**汇总**：被测对象 1813 行，有意义的行为覆盖 ≤ 15%。

---

## 4. 覆盖盲区 Findings

### Finding 4.1 [Critical] —— 测试 + 被测代码同时游离于产品

- **缺失**：`_audit_review/` 是 git untracked 的散落目录，里面 1813 行组件 + 5 个测试文件，**没人 import**。生产 `apps/web/src/pages/MorningQuizTake.tsx`（1126 行）是另一份截然不同的实现。
- **用户影响**：产品里真正运行的 MorningQuiz 代码 **0 单元测试**。任何"我们测过了"的话术对于真实用户场景**完全无效**。如果声称"重构覆盖在测试下"，那是误导——重构成果根本没合进 web app。
- **建议**：
  1. 决定 `_audit_review/exam/*` 是要合进 `apps/web/src/components/exam/` 还是丢弃，写到 ADR。
  2. 合并后再迁移测试。
  3. `git rm`（或 `.gitignore` 中明确忽略）现在的 `_audit_review/`，避免误导后续审查者。

### Finding 4.2 [Critical] —— `npm test` 不存在；vitest / testing-library 未安装

- **缺失**：`apps/web/package.json` 没 `test` 脚本、没 vitest、没 `@testing-library/*`、没 `jsdom`/`happy-dom`。`vite.config.ts` 没 `test:` block。`test-setup.ts` 不存在。
- **用户影响**：CI 跑 `npm test` 走根脚本只会跑 api 的 jest，web 这边一行都不跑。任何 web 端的回归（按钮坏了、debounce 漏 fire、localStorage 损坏）**都进不到 CI 信号**。
- **建议**：补依赖

  ```bash
  npm i -D -w @app/web vitest @testing-library/react @testing-library/user-event \
              @testing-library/jest-dom jsdom @vitest/ui
  ```

  `vite.config.ts` 加：

  ```ts
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  }
  ```

  `package.json` 补 `"test": "vitest run"`、`"test:watch": "vitest"`。
  `src/test-setup.ts` 至少要 `import '@testing-library/jest-dom'`。

### Finding 4.3 [High] —— 错误路径 0 测试

- **缺失**：`onPersistAnswer` reject 时只 `catch {}`，没改 UI 也没测；localStorage `setItem` 抛 quota 同样吞；JSON.parse 失败也吞。
- **用户影响**：学生答了 10 道题，token 过期了或 backend 500，**前端不显示任何错误**，他以为答案存了，关浏览器 → 数据丢失。隐性、不可观测的 failure。
- **建议**：补 3 用例
  1. `onPersistAnswer` 抛错 → `savingId` 应清掉、应 surface 给 toolbar 一个 `lastSaveError`。
  2. localStorage.setItem 用 `vi.spyOn` 抛 QuotaExceeded → UI 应提示"本地存储满，请清理"。
  3. localStorage 中 `mq:answers:s4` 是非法 JSON → hydrate 不应崩，且应记录到 console.warn（用 spy 验证）。

### Finding 4.4 [High] —— 网络失败 / 离线 / 重连

- **缺失**：online/offline 监听有，但**没有重连后 flush** 未保存答案。也没测离线 banner 是否出现。
- **用户影响**：地铁场景：学生进隧道（offline），答 5 题；出来（online），这 5 题**永远不会送到服务器**——因为代码没有 retry 逻辑，仅依赖 600ms debounce timer，那个 timer 可能已经 reject 完了。
- **建议**：
  - 加 retry queue：online 事件触发时把 localStorage 里的 answers diff 跟 lastServerKnown 对比，flush 差异。
  - 用例：fireEvent online → expect(persist).toHaveBeenCalledTimes(N)。
  - 用例：navigator.onLine=false 时 OfflineBadge 出现；true 时消失。

### Finding 4.5 [High] —— Cloze / VocabInContext / Comprehension / IELTSReadingPassage / Timer 全 0 测试

- **缺失**：这 5 个组件合计 1063 行，最复杂的逻辑（拖拽分栏、高亮、便签、12 种 IELTS task type、计时器到 0 自动提交）**一行都没测**。registry.test.ts 只测了"哪个 paper 选哪个组件"，组件本体行为没碰。
- **用户影响**：IELTS 学生主要场景在 IELTSReadingPassage——这是被测系统的 P0 路径。任何回归都不会被捕获。
- **建议**：每个组件至少 3 用例（happy path + 2 边界），共约 15 用例：
  - Cloze: BLANK 数量与 answers 数量匹配 / 多余 / 不足。
  - Vocab: 多 correct、0 correct、targetWord 在 stem 中高亮。
  - Comprehension: 长 passage 渲染、滚动同步、Q1→Q5 切换不丢答案。
  - IELTS: 每种 taskType 一个 smoke render 测、Highlighter 选区、StickyNote 增删。
  - Timer: 用 `vi.useFakeTimers()` 推进到 quizEnd → expect(onExpire).toHaveBeenCalled()。

### Finding 4.6 [High] —— Timer 到 0 自动提交未验证

- **缺失**：Timer.tsx 45 行，`MorningQuizTake.tsx` 是否调用 `onExpire={() => submit()}` 未知，零测试。
- **用户影响**：考试模式 P0——若 expire 不触发提交，学生超时的卷子永远 PENDING，后端没任何提交触发，老师看不到分数。
- **建议**：
  - `vi.useFakeTimers()` + `vi.setSystemTime`，把 quizEnd 设成 +500ms，然后 `vi.advanceTimersByTime(600)`，断言 submit fn 被调一次（且只调一次）。

### Finding 4.7 [High] —— Practice 模式判分诚信无测试 + 数据层就泄露

- **缺失**：`OLevelMcqList.tsx` 第 20 行 `correctKey = c.correctOption`——这是从 `snapshotContent` 直接读的。**snapshotContent 是后端塞 client 的 JSON**，意味着即便 mode=test，正确答案也在浏览器内存里。
- **用户影响**：开发者工具 → Network → 看 `/api/morning-quiz/session/:id` response → 直接看到 correctOption。这是一个**作弊向量**，不是测试盲区，是**架构盲区**。但 0 测试（也没有测试能描述"test 模式下不应有 correctOption"）。
- **建议**：
  - 这是 backend 责任：`/api/.../take` endpoint 应在 mode=test 时把 `correctOption` 从 snapshotContent 里摘掉。
  - 用例：mock paper, snapshot 不含 correctOption → MCQ 渲染不应崩、selecting wrong 不应显示 ✗ Correct: B。
  - 这条建议可能与 Agent 6（数据/API）重叠。

### Finding 4.8 [Medium] —— 跨题型组合无支持 + 无测试

- **缺失**：`pickRenderer` 只看 `paper.questions[0]`。一份混合卷只能用第一题决定整张卷的 shell。
- **用户影响**：现实 IELTS Reading 一篇 passage 里就同时有 multiple_choice + true_false_not_given + matching_headings；但若 backend 把它们混在同一 paper 里，渲染器只挑一种。
- **建议**：
  - 改成 group-by-passage 渲染（IELTSReadingPassage 内部按 task 分块）。
  - 用例：一个 passage_pick paper 含 3 种 taskType → 都渲染出来。

### Finding 4.9 [Medium] —— 重做 / 二进无测试，且 hydrate 顺序可疑

- **缺失**：ExamContext 里 `{ ...cached, ...initialAnswers }`——server 的 `initialAnswers` 覆盖 cached。但**当 server 答案比本地旧时（如刚从其他设备回来），用户最新输入会被覆盖**。0 测试。
- **用户影响**：跨设备做题：A 设备答了 q3=B，自动保存；B 设备打开 → server 给 initialAnswers={q3:B}，但 B 设备 localStorage 残留了 q3=A → 最终展示 B（因 server 覆盖 local）。但若顺序反了或时间戳不在，恢复行为容易出错。
- **建议**：
  - 加 `updatedAt` 时间戳，比较取新。
  - 用例：本地 cached={q1:'A'} updatedAt=t2，initialAnswers={q1:'B'} updatedAt=t1 → 最终 q1='A'。

### Finding 4.10 [Medium] —— 并发 / 多 tab 无测试

- **缺失**：没监听 `storage` 事件，A tab 改答案 B tab 看不到，且双方都向 localStorage 写最后一个胜出。
- **用户影响**：学生在两个 tab 同时打开同一份卷子（误操作很常见）→ 两边来回切题，答案互相覆盖。
- **建议**：
  - 监听 `storage` 事件，远端变更时 setState 更新。
  - 用例：fireEvent storage → answers state 更新，textarea reflect new value。

### Finding 4.11 [Medium] —— 键盘导航 / 无障碍 0 测试

- **缺失**：MCQ 没 `<fieldset>`，textarea 没 `aria-describedby`，QuestionNavBar 不知是否可 Tab 进入。
- **用户影响**：依赖键盘 / 屏幕阅读器的学生体验差；学校采购评估时常被打回。
- **建议**：用 `axe-core/react` 加 1 用例验证 0 violation。

### Finding 4.12 [Medium] —— React act() warning 风险无可观测

- **缺失**：debounce setTimeout 在 setSavingId(qid) 后还有 await onPersistAnswer，async 完成之后 setSavingId(null)。如果组件在那之前 unmount（quick navigate），就是经典"setState on unmounted"——会出 act() warning 但只在测试运行时打印。
- **用户影响**：开发体感差；生产可能没问题但是噪声警告掩盖真问题。
- **建议**：
  - useEffect 返回 cleanup，把 timersRef 里所有 timer 清掉。
  - 用 isMountedRef 守护。
  - 用例：render → setAnswer → unmount → vi.advanceTimersByTime(700) → expect(no console.error)。

---

## 5. 错配的测试粒度

### 5.1 ExamProvider 测试是真集成测——但被砍成只用 Probe 组件

`ExamProvider.test.tsx` 有 4 用例都用 `<Probe>` 这个手写小探针，访问 hook 的所有字段，做 button click 触发——这本质是 **集成测**。问题在于：

- 它**不去渲染真正的 children（OLevelMcqList 之类）**，所以"用户在 MCQ 里点 A，答案存入 localStorage 并 600ms 后 persist"这条**真实流**实际上没有任何端到端的测试，只有"按 button → state 变了"这种空心断言。
- 一旦有人重命名 hook 字段或修改 Provider 接口，这些 Probe 也得改——测试和实现同样耦合，不比测内部状态强。

### 5.2 OLevelMcqList 的"feedback in practice mode"测试断言粒度太弱

```ts
const wrong = screen.getByLabelText(/A\./);
await user.click(wrong);
expect(screen.getByText(/Correct: B/)).toBeInTheDocument();
```

只测了 wrong → display "Correct: B"。**没测**：
- 选对时显示 ✓ Correct
- explanation 出现 / 不出现的两条分支
- test 模式不显示 feedback（关键的 mode 区分）

3 个分支只覆盖 1 个，又是"刷数字"型测试。

### 5.3 OLevelSentenceTransformation 的 word count 测试与实现耦合

```ts
await user.type(ta, 'Because she was tired she did not go to the party tonight');
await user.type(ta, ' really');
expect(screen.getByText(/over limit/)).toBeInTheDocument();
```

测试硬编码"刚好 12 个 + 1"。这等于在重写 `wordCount > maxWords` 逻辑，没测：
- 12 词整（边界，应**不**显示 over）
- 13 词（应显示）
- 0 词（应显示 0 words 而不是 NaN）
- 多空格 / 全空白（不该算 1 word）

### 5.4 registry.test.ts —— 这一项是合格的纯函数测试，但太"表面"

`pickRenderer` 8 用例 ≈ 行覆盖 100%。但全部断言形如 `expect(pickRenderer(p)).toBe(IELTSReadingPassage)`——只验证选中了哪个组件类，**没验证选中后真的能跑**。如果 IELTSReadingPassage 直接 throw，这测试照样 ✓。这是 mock 太到看不见 bug 的典型。

---

## 6. 测试基础设施

| 项 | 状态 |
|---|---|
| `apps/web/test-setup.ts` | **不存在**（Glob 0 命中） |
| `apps/web/vite.config.ts` 中 `test:` 配置 | **完全没有**（仅 `plugins, server, build` 三块） |
| `package.json` `test` 脚本 | **没有** |
| `vitest` 依赖 | **未列入 package.json**（运行 `npx vitest` 能跑只是 npm 缓存或 transitive 偶然） |
| `@testing-library/react` | **未安装**（node_modules 中无） |
| `jsdom` / `happy-dom` | **未安装** |
| `@testing-library/jest-dom` matchers | **未引入**（测试里用 `toBeInTheDocument`，但这 matcher 没注册——即使 testing-library 装好，也会运行时报错） |

最后一条尤其讽刺：即便补齐 `@testing-library/react`，测试**仍然会失败**——因为 `expect(...).toBeInTheDocument()` 需要 `import '@testing-library/jest-dom/vitest'` 的 setup，而那个文件不存在。换言之，**这 5 个测试文件里没有一个真正在过去某天跑过并且通过过**——它们是写出来糊审查的，从未执行过。

---

## 7. 测试质量信号

| 信号 | 评价 |
|---|---|
| `expect` 漏掉（render but no assert） | 没漏，每个用例都有 expect |
| Mock 是否 mock 到看不见 bug | **是**——`onPersistAnswer = async () => {}` 在 4/5 用例里用空 fn，意味着任何"persist 实际效果"的 bug 都看不到 |
| act() warning | **无法观察**——测试根本没跑过；且 ExamContext 里 setTimeout + setState 是 act warning 高发场景，未来跑起来很可能炸 |
| 实现细节耦合 | 中等——textarea 用 `getByRole('textbox')` 还行；但"Correct: B" 那种文案断言一改文案就坏 |
| Snapshot 测试 | 没有（这反而是好事） |
| 用例命名 | 命名清晰、describe 分组合理 |
| AAA 模式 | 整体良好 |
| flake 风险 | `waitFor(() => persist).toHaveBeenCalledOnce(), { timeout: 2000 }` 这个 600ms debounce + 2s 超时，CI 慢机器有 flake 概率 |

---

## 8. 整体结论

**这 26 用例不是"真覆盖了风险"，是"刷数字 + 自欺"。**

1. **数字本身就是假的**：26 = 17 真 + 9 永远跑不起来。
2. **基础设施压根没搭**：`apps/web` 没装 vitest、没装 testing-library、没 setup 文件、没 npm script。
3. **被测对象游离于产品**：1813 行 `_audit_review/exam/*` 是 untracked 草稿，生产里**根本没人用它**。生产 `MorningQuizTake.tsx` 1126 行是另一份代码，**0 单元测试**。
4. **就算把基础设施补全跑通**：覆盖范围也很表面——5 个组件中**只测了 2 个**（MCQ + Transformation），最复杂的 IELTSReadingPassage（488 行）、Cloze、Vocab、Comprehension、Timer、StickyNote、Highlighter、DraggableSplit 全是 0 测试。
5. **核心风险路径完全不在测试覆盖里**：
   - 网络失败 / 重连补传 / 离线行为
   - Timer 到点自动提交
   - 多 tab 并发
   - Practice 模式判分诚信（同时是数据泄露）
   - 跨题型混排
   - 第二次进入恢复
   - 错误路径（500 / token 过期 / quota / JSON 损坏）

**整体严重度：Critical**（"测试覆盖"这一项本身在该 PR 中是误导）。

### 优先级建议

1. **本次 PR 必须做**：
   - 决定 `_audit_review/` 命运（合并 or 删除），明确告知评审。
   - 撤回"26 测试用例全绿"的话术；如实改为"17 utility/纯函数用例通过；9 React 用例所需测试基础设施缺失"。
2. **下一个 PR 必做**：补 vitest + testing-library 依赖、`test-setup.ts`、`vite.config.ts` test 块、`npm test` 脚本，并把 9 个 React 用例**真正跑起来**。
3. **再下一个 PR**：按 §4 各 Finding 补齐错误路径 / 网络失败 / Timer / Cloze / Vocab / IELTS shell 用例。

---

## 附录 A：相关文件路径（绝对路径）

- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\intelligent-snyder-70adcc\_audit_review\exam\__tests__\ExamProvider.test.tsx`（4 用例，套件 fail）
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\intelligent-snyder-70adcc\_audit_review\exam\__tests__\OLevelMcqList.test.tsx`（3 用例，套件 fail）
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\intelligent-snyder-70adcc\_audit_review\exam\__tests__\OLevelSentenceTransformation.test.tsx`（2 用例，套件 fail）
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\intelligent-snyder-70adcc\_audit_review\exam\__tests__\registry.test.ts`（8 用例 ✓）
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\intelligent-snyder-70adcc\_audit_review\exam\__tests__\textUtils.test.ts`（9 用例 ✓）
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\intelligent-snyder-70adcc\apps\web\package.json`（缺 test 脚本和依赖）
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\intelligent-snyder-70adcc\apps\web\vite.config.ts`（缺 test config）
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\intelligent-snyder-70adcc\apps\web\src\pages\MorningQuizTake.tsx`（生产实现，1126 行，0 测试）
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\intelligent-snyder-70adcc\_audit_review\pages\MorningQuizTake.tsx`（重构草案，297 行，未合并）

## 附录 B：vitest 实测输出片段

```text
$ npx vitest run _audit_review/exam/__tests__/
RUN  v2.1.9

 ❯ _audit_review/exam/__tests__/OLevelMcqList.test.tsx (0 test)
 ❯ _audit_review/exam/__tests__/ExamProvider.test.tsx (0 test)
 ❯ _audit_review/exam/__tests__/OLevelSentenceTransformation.test.tsx (0 test)
 ✓ _audit_review/exam/__tests__/textUtils.test.ts (9 tests) 3ms
 ✓ _audit_review/exam/__tests__/registry.test.ts (8 tests) 3ms

⎯⎯⎯⎯ Failed Suites 3 ⎯⎯⎯⎯
FAIL  _audit_review/exam/__tests__/ExamProvider.test.tsx
FAIL  _audit_review/exam/__tests__/OLevelMcqList.test.tsx
FAIL  _audit_review/exam/__tests__/OLevelSentenceTransformation.test.tsx

Error: Failed to load url @testing-library/react (resolved id:
       @testing-library/react) in
       _audit_review/exam/__tests__/ExamProvider.test.tsx.
       Does the file exist?

 Test Files   3 failed | 2 passed (5)
      Tests   17 passed (17)
   Duration   577ms
```
