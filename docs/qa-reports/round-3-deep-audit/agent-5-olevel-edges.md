# Round-3 深度审查 · Agent 5：O-Level 五种题型边界审查

审查范围（实际位于 `_audit_review/exam/` 下）：

- `_audit_review/exam/questions/OLevelCloze.tsx`
- `_audit_review/exam/questions/OLevelComprehension.tsx`
- `_audit_review/exam/questions/OLevelMcqList.tsx`
- `_audit_review/exam/questions/OLevelSentenceTransformation.tsx`
- `_audit_review/exam/questions/OLevelVocabInContext.tsx`
- `_audit_review/exam/shared/InlineGapInput.tsx`
- `_audit_review/exam/shared/textUtils.ts`
- `_audit_review/exam/__tests__/textUtils.test.ts`

> 严重度分级：P0（数据损坏 / 学生无法作答 / 越权安全） · P1（关键 UX 错误，特定数据下出错）· P2（可见瑕疵但可绕过） · P3（极端 / 可接受的退化）。

---

## 1. OLevelCloze.tsx

### F-1.1【P1】`[BLANK]` 数量与 `subQuestions.length` 不匹配 → 静默退化为列表降级
- 文件 / 行：`_audit_review/exam/questions/OLevelCloze.tsx:42`
- 输入示例：
  ```ts
  passage = "The (1) [BLANK] crossed the (2) [BLANK]."  // 2 个 BLANK
  paper.questions = [q1, q2, q3]                       // 3 题（数据多了一个）
  ```
- 实际行为：`segments.length - 1 === paper.questions.length` 不成立 → 整个文章式渲染被放弃，掉到底部 `ClozeRowFallback` 列表，而 `ClozeRowFallback` 又依赖 `q.snapshotContent.stem`（如果 stem 没有 `[BLANK]`，那么 `stem.split` 后只有一个 part，`i === 0` 那一段输入框位置紧贴 stem 末尾）。学生根本看不出"哪里少了 BLANK"，只是"页面突然变难看"。
- 期望行为：开发态/测试态应至少在 console 输出 mismatch 警告；UI 层保留正确数量的输入框；多余的 BLANK 应渲染为占位下划线，多余的 question 应作为单独项追加到末尾。
- 建议修复：在 `useMemo` 旁加一段 `if (segments && segments.length - 1 !== paper.questions.length) console.warn(...)`，并把降级路径细分为"按 BLANK 渲染、缺失 question 用 placeholder"或"按 question 渲染、缺失 BLANK 用 (n)＿＿"。
- 备注：这是 schema/数据治理问题，不是组件 bug，但当前组件对此完全沉默，定级 P1。

### F-1.2【P2】嵌套 `[BLANK [BLANK]]` 被拆成 3 个空格 + 文字 `]`
- 文件 / 行：`_audit_review/exam/questions/OLevelCloze.tsx:39`（`split(/\[BLANK\]/i)`）
- 输入示例：
  ```ts
  passage = "He [BLANK [BLANK]] reached the summit."
  ```
- 实际行为：正则按字面 `[BLANK]` 切。`"He [BLANK [BLANK]] reached..."` → split 后变成
  `["He [BLANK ", "] reached..."]`（其实只匹配到内层一个 `[BLANK]`）。即外层 `[BLANK ` 漏出来作为字面文字，且 segment 数与 question 数大概率失配，进而落入 F-1.1 的降级。
- 期望行为：嵌套语法本身就属于数据病灶。组件至少不应把 `[BLANK ` 当作正文展示。
- 建议修复：写一条 schema 校验（在数据导入或 `pickRenderer` 之前）拒绝带嵌套 BLANK 的 passage；组件内可以预先用 `passage.replace(/\[BLANK[^\]]*\]/g, '[BLANK]')` 兜底。

### F-1.3【P1】用户原文里就有 `[BLANK]` 字面会被吞掉
- 文件 / 行：`_audit_review/exam/questions/OLevelCloze.tsx:39`
- 输入示例：题干本身在讨论 "fill the [BLANK] symbol"：
  ```ts
  passage = "Replace the [BLANK] with a word: He went to the [BLANK]."
  paper.questions.length = 1
  ```
- 实际行为：split 出来 3 段，需要 question 数 = 2，但只有 1 → 触发 F-1.1 降级。无任何转义机制。
- 期望行为：支持 `\[BLANK\]` 这样的转义（split 时排除带反斜杠前缀的）或者改用更不容易冲突的占位符（如 `{{BLANK}}` / `[[BLANK]]` / ` BLANK `）。
- 建议修复：在 `textUtils.ts` 中提供 `splitByBlank(passage)` 函数，统一处理转义（例：将 `\\[BLANK\\]` 视为字面）；组件改为调用它。这条同时影响 `ClozeRowFallback` line 120。
- 备注：当前代码完全没有 splitByBlank/parseGap 函数，仅有 inline 的 `passage.split(/\[BLANK\]/i)`。这个测试覆盖也是缺的。

### F-1.4【P2】句首 `[BLANK]` 渲染时 segments[0] 为空字符串，可正常工作但 leading 空 Fragment 会触发空白处理；句尾 `[BLANK]` 触发 segments 末尾空字符串，不会被映射为 input（因为 `i < segments.length - 1` 才渲染输入框）
- 文件 / 行：`_audit_review/exam/questions/OLevelCloze.tsx:55`
- 输入示例：
  ```ts
  passage = "[BLANK] is the answer."          // 句首
  passage = "The answer is [BLANK]"            // 句尾（注意末尾无标点也无空格）
  paper.questions.length = 1
  ```
- 实际行为：
  - 句首：`segments = ["", " is the answer."]`，length-1 = 1 ✓，输入框正确插在最前 → 工作正常。
  - 句尾：`segments = ["The answer is ", ""]`，length-1 = 1 ✓，输入框正确插入；但 `whitespace-pre-wrap` 容器的最后一个 `<Fragment>` 渲染空字符串，无视觉问题。
  - 但是当数据是 `"...is [BLANK]"`（有空格但末尾无标点）+ 输入框 + 空字符串。在 mobile + 行末 wrap 时输入框宽度受 minWidth 4rem 强制，视觉上可能溢出右边距（行内 inline-flex span）。
- 期望行为：基本 OK，但行末 `[BLANK]` 在窄视口（<360px）会换行、且 `<span class="inline-flex">` + `min-w-[4rem]` 可能超出父级宽度 ⇒ 横向滚动。
- 建议修复：在 `InlineGapInput` 外层 span 加 `max-w-full`，并把 `inline-flex` 改成 `inline-block` 让 input 能在容器内 wrap。

### F-1.5【P2】连续两个 `[BLANK][BLANK]` 中间无空格 → 两个输入框紧贴
- 文件 / 行：`_audit_review/exam/questions/OLevelCloze.tsx:37-39`
- 输入示例：
  ```ts
  passage = "phrasal verbs like [BLANK][BLANK] need two words."
  paper.questions.length = 2
  ```
- 实际行为：`segments = ["phrasal verbs like ", "", " need two words."]`，length-1 = 2 ✓，两个 InlineGapInput 之间是空字符串 `""`，于是两个标号 `1)` `2)` 紧贴，且两个 input 中间无可视分隔 → 学生不易区分。在 `whitespace-pre-wrap` 下空字符串确实显示为零宽。
- 期望行为：相邻 BLANK 之间应自动留出最小间距（mx-0.5 已有但不够），或者校验时拒绝连续 BLANK。
- 建议修复：渲染输入框前判断 `segments[i] === '' && i > 0`，若为真在前面追加 `<span className="mx-1">·</span>` 或类似分隔。或者数据层禁止此 pattern（罕见但合法的 Singapore O-Level 题型确实存在此设计）。

### F-1.6【P2】没有 `[BLANK]` 但 `subQuestions.length > 0` → 静默退到列表降级
- 文件 / 行：`_audit_review/exam/questions/OLevelCloze.tsx:38, 42`
- 输入示例：
  ```ts
  passage = "An ordinary article without markers."
  paper.questions.length = 3
  ```
- 实际行为：`segments = ["An ordinary..."]` → length-1 = 0，不等于 3 → 落入 fallback。fallback 渲染每题 `stem.split(/\[BLANK\]/i)`，若 stem 也没有 BLANK 则只有一个段且 `i === 0` 一定为真 → input 出现在 stem 之后。
- 期望行为：被 `pickRenderer` 误路由的 paper 应有更友好的提示（"This paper has no blanks – please contact support"）而不是默默渲染一个无 BLANK 的列表。
- 建议修复：开发态加 console.warn；prod 渲染一个橙色 banner 提示数据异常。

### F-1.7【P1】`[BLANK]` 大小写敏感性的不一致
- 文件 / 行：`_audit_review/exam/questions/OLevelCloze.tsx:39, 120`
- 输入示例：`passage = "He [blank] crossed."` 或 `[Blank]` 或 `[BLANK]`。
- 实际行为：`split(/\[BLANK\]/i)` 用了 `i` flag，所以大小写都匹配；但 `clean()` 之前并不规范化。 `[BLANK ]`（多空格）`[BLANK1]`（带数字）`[ BLANK]` 都不会匹配。
- 期望行为：要么严格"大写 + 无空格"并 schema 校验，要么放宽到 `/\[\s*BLANK\d*\s*\]/i`。
- 建议修复：统一为 `/\[\s*BLANK\s*\]/i`，并在 `splitByBlank` 单元测试里覆盖 lowercase / 多空格 / 编号变体。

### F-1.8【P2】字数限制（OLevelCloze 不直接消费 maxWords，但题型说明声称"Fill each blank with one word"）—— 没做强制
- 文件 / 行：`_audit_review/exam/questions/OLevelCloze.tsx:48`
- 实际行为：组件顶部写 "Fill each blank with one word"，但 `InlineGapInput` 接受任意字符（含空格、emoji、HTML），不做拼写或词数校验。学生可输入 `"a great big house"`，组件不会警告。
- 期望行为：要么做软警告（红色描边 if value contains whitespace），要么显式说明"系统不会拦截多词输入"。
- 建议修复：在 `InlineGapInput` 加可选 prop `maxWords` 与 `singleWord`；OLevelCloze 默认传 `singleWord`。

### F-1.9【P1】InlineGapInput 宽度自适应：极长输入撑爆行
- 文件 / 行：`_audit_review/exam/shared/InlineGapInput.tsx:53`
- 输入示例：用户在一个空里输入 `antidisestablishmentarianismantidisestablishmentarianism…`（200 字符）。
- 实际行为：`style={{ width, minWidth: '4rem' }}` 的 `width` 是常量 `'5rem'`，input 没有 auto-grow。值超过 5rem 时浏览器**横向滚动 input 内部**（光标可见但段前文本看不见），段落本身行高不变。这不是溢出 bug，但视觉上输入看起来"被截断"，学生无法看到自己写了什么前半段。
- 期望行为：input 自动按 value 长度增宽（用 `<span>` 测量或使用 `field-sizing: content`，或 `<span contenteditable>`）。
- 建议修复：用 `useLayoutEffect` 测一个 hidden span 的宽度并把它写进 input.style.width；或当 modern Chrome 支持 `field-sizing: content` 时用 CSS 一行解决。最低成本：当 `local.length * 0.55rem > 5rem` 时把 width 临时调大。

### F-1.10【P3】`maxWords = 0 / 负数 / NaN` —— OLevelCloze 不消费 maxWords，本节不适用，但 OLevelSentenceTransformation 中相关 → 见 F-2.4。

### F-1.11【P2】`paper.questions[0]` 不存在时 `passageContent` 为 `{}`，渲染降级路径会空数组 map → 显示空 `<ol>`。
- 文件 / 行：`_audit_review/exam/questions/OLevelCloze.tsx:32, 102-108`
- 输入示例：`paper.questions = []`
- 实际行为：`passage = ''`，`segments = null` → 不进入文章式分支；fallback 渲染空 `<ol>`，UI 上是个空白区域，没有任何提示。
- 期望行为：显示 "No questions in this paper" 占位。
- 建议修复：在组件顶部加 `if (!paper.questions.length) return <EmptyState/>;`。

### F-1.12【P2】passage 中含 `<script>`、HTML 标签等 → React `whitespace-pre-wrap` 文本节点会按字面渲染为可见文本（不会执行），所以没有 XSS。✅

### F-1.13【P1】practiceFeedback 比较忽略 trim/全角空格/标点
- 文件 / 行：`_audit_review/exam/questions/OLevelCloze.tsx:59-65`
- 输入示例：`correct = "won"`，学生输入 `"won "` 或 `"Won."` 或 `"won"`（半角）vs `"ｗｏｎ"`（全角）。
- 实际行为：仅做 `cur.toLowerCase() === correct.toLowerCase()`，trim 在前，但末尾标点、全角字符、连字符变体 → 全部判错。
- 期望行为：cloze 题至少应忽略首尾标点（`.,;:!?`）和不可见字符；或在 schema 上强制 correctAnswer 仅含字母 + 连字符。
- 建议修复：抽出 `isAnswerEqual(student, correct, opts)` 工具函数，统一所有 O-Level 题型；测试覆盖 trim / 大小写 / 全角 / 末尾标点。

---

## 2. OLevelSentenceTransformation.tsx

### F-2.1【P3】`starter` 是空字符串 / null —— 处理正确
- 文件 / 行：`_audit_review/exam/questions/OLevelSentenceTransformation.tsx:61, 95-99`
- 输入示例：`c.starter = ''` 或 `c.starter = null` 或 `c.starter = undefined`。
- 实际行为：`clean(c.starter ?? '')` 返回 `''`；`{starter && (...)}` 渲染断言为空 → 不渲染那一块。`starter ? 'starting with...'` 也不显示。textarea 的 placeholder 走 `'Write your rewritten sentence…'` 分支。✅ 合理。
- 期望行为：✅
- 建议：保留。

### F-2.2【P1】`starter` 含 HTML / 特殊字符 —— React 会转义；但 placeholder 字符串可能被插入到 attribute 上下文，仍被 React 转义。安全 ✅。但样式会破：starter 含换行 `\n` 时 `<p>` 元素的 `whitespace` 默认是 normal，换行被吞，starter 显示成单行，与作答 textarea 中的预期不一致。
- 文件 / 行：`_audit_review/exam/questions/OLevelSentenceTransformation.tsx:96-98`
- 输入示例：`starter = "Although he was tired,\nhe"`
- 实际行为：`<p>` 渲染为 `Although he was tired, he`（换行变空格），但 placeholder 也变成 `Continue from "Although he was tired,\nhe"…`，placeholder 有字面 `\n` 的转义形式。
- 期望行为：starter 应规范为单行短语；如果数据真有多行，至少应 `pre-wrap`。
- 建议修复：schema 层禁止 starter 含换行；组件加 `whitespace-pre-wrap` 与单行截断兜底。

### F-2.3【P2】`maxWords = 0` —— 永远 `overLimit = (0 > 0) = false`，但 wordCount 1 都会变 over → 实际触发也合理；但显示 "max 0 words" 让学生不知所措
- 文件 / 行：`_audit_review/exam/questions/OLevelSentenceTransformation.tsx:62, 69, 92, 117`
- 输入示例：`c.maxWords = 0`
- 实际行为：`maxWords = 0`，`overLimit = wordCount > 0`。学生写一个字就立刻红框警告 + "0 words / 0 — over limit"。
- 期望行为：`maxWords = 0` 应被视为"无限制"或"数据错误，忽略"。
- 建议修复：`const maxWords = typeof c.maxWords === 'number' && c.maxWords > 0 ? c.maxWords : null;`

### F-2.4【P1】`maxWords` 为负数或 NaN
- 文件 / 行：`_audit_review/exam/questions/OLevelSentenceTransformation.tsx:62`
- 输入示例：`c.maxWords = -1` 或 `c.maxWords = NaN` 或 `c.maxWords = "12"`（字符串）。
- 实际行为：
  - `-1`: 任何非空文本 `wordCount > -1` 永远为 true，永远显示 over limit。
  - `NaN`: `wordCount > NaN` 永远为 false，over 警告永不触发；但显示 "max NaN words"，UI 露馅。
  - `"12"`: typeof 检查为 `'string'`，被忽略 → maxWords = null。这是默默的"数据格式错误"。
- 期望行为：负数视为无限制；NaN 视为无限制；字符串数字应解析或被警告。
- 建议修复：同 F-2.3，加 `Number.isFinite` 与 `> 0` 双重校验；可选地用 `Number(c.maxWords)` 解析字符串数字并提示数据错误。

### F-2.5【P1】用户填写超过限制：仅警告不阻止 —— 这是设计选择，但与"submit 时是否扣分"无配合
- 文件 / 行：`_audit_review/exam/questions/OLevelSentenceTransformation.tsx:108-119`
- 输入示例：限制 12 词，学生输入 30 词。
- 实际行为：textarea 保持红描边 + "over limit"，但 `setAnswer` 仍照常调用，答案被保存。提交时后端是否拒绝/扣分未知。
- 期望行为：注释里写"我们不 gate 提交"，OK；但应在 textarea aria-invalid 上加上 `true`，让屏幕阅读器学生知道。
- 建议修复：`<textarea aria-invalid={overLimit ? 'true' : 'false'} aria-errormessage={overLimit ? 'wc-error' : undefined}>`，把 word count `<span>` 加 `id="wc-error"`。

### F-2.6【P1】没有 `original`、没有 `stem` —— 显示空 italic block，不报错，但学生面前是空白
- 文件 / 行：`_audit_review/exam/questions/OLevelSentenceTransformation.tsx:60, 84-86`
- 输入示例：`snapshotContent = {}`
- 实际行为：`original = ''` → `<p>` 渲染空。学生看到 "Original sentence" 标题但下面没字 → 完全无法作答。
- 期望行为：开发态 console.warn；UI 显示占位 "(原句缺失)"。
- 建议修复：组件内增加 `if (!original) return <DataErrorCard reason="original missing" />;`。

### F-2.7【P2】`text` state 与 `ans?.textAnswer` 双源同步 → 在 idx 切换瞬间可能旧值残留
- 文件 / 行：`_audit_review/exam/questions/OLevelSentenceTransformation.tsx:65-66`
- 输入示例：在 q1 输入 "abc"，未触发持久化（< debounce），按 Next。`useEffect` 依赖 `[ans?.textAnswer, q.id]` 重置 text。
- 实际行为：q1 → q2 切换时，q2 的 `ans?.textAnswer` 可能还是 undefined（debounce 未 flush，全局 answers 已经在 setAnswer 内部 setAnswers 同步更新了，所以应正确），但若网络持久化失败 + 离线 + 全局 answers 更新有竞态，可能用 stale 值覆盖。详细看 ExamContext line 136-143：setAnswers 是同步调用，所以 `answers[q.id]` 在 setAnswer 返回前已更新 → 实际 OK。
- 期望行为：✅ 当前实现安全。但保持警惕：如果有人之后把 setAnswers 改成异步，就会出问题。
- 建议修复：（无需）但加个测试覆盖"快速 type + click Next"。

### F-2.8【P3】`q.id` 切换 + 卸载时已挂起的 onChange 防抖未清理 —— 由 ExamContext 管理，不在本组件范围。

### F-2.9【P2】placeholder 中插入 starter 没做 escape：`starter = '"; alert(1)//'`
- 文件 / 行：`_audit_review/exam/questions/OLevelSentenceTransformation.tsx:107`
- 实际行为：React 会把 placeholder 当字符串属性 → 自动转义。但 `Continue from "${starter}"…` 中的双引号会被嵌入 placeholder 文本本身，看起来很怪：placeholder = `Continue from ""; alert(1)//"…`。无 XSS，但视觉乱。
- 期望行为：用单引号 + 截断：``starter ? `Continue from '${starter.slice(0, 30)}'…` : ...``。
- 建议修复：截断 + 转义引号字符（替换 `"` 为 `'`）。

---

## 3. OLevelVocabInContext.tsx

### F-3.1【P0/数据】4 个选项里 0 个 correct（数据错误）
- 文件 / 行：`_audit_review/exam/questions/OLevelVocabInContext.tsx:61-63`
- 输入示例：`c.correctOption = null`（或缺失）。
- 实际行为：`correctKey = null` → `showFeedback = false`。在 practice 模式下学生选完任何答案都不显示对错反馈。学生不会被告知"题目数据有问题"，只是默默没反馈，会以为系统坏了。
- 期望行为：开发态 warn；practice 模式应明示"无法评分（缺答案数据）"。
- 建议修复：`if (!correctKey && mode === 'practice') console.warn('[VocabInContext] missing correctOption for ' + q.id);` 并加 UI 提示。

### F-3.2【P1/数据】4 个选项里 ≥2 个 correct
- 文件 / 行：`_audit_review/exam/questions/OLevelVocabInContext.tsx:61, 92`
- 实际行为：`correctOption` 是单个 string，无法表达多正确。schema 不支持，当前组件以单选 radio 渲染。如果数据中误给两个 option 标记 `isCorrect`（`ExamOption.isCorrect`），组件**完全忽略** `opt.isCorrect`，只看顶层 `correctOption`。所以双 correct 在 schema 里只能落地为一个 key — 但 generation pipeline 可能产出 2 个 key，schema 层也未拒绝。
- 期望行为：schema 校验 + 拒绝；或改为 `correctOptions: string[]`。
- 建议修复：在数据导入侧加 invariant；组件不变。这是 schema 漏洞，不是组件 bug。

### F-3.3【P1】长目标词截断 / 复合词
- 文件 / 行：`_audit_review/exam/questions/OLevelVocabInContext.tsx:84-87, 131-143`
- 输入示例：`targetWord = "antidisestablishmentarianism"`（28 字符）；context 中匹配到。
- 实际行为：`<strong>` 长单词在 `text-center` `<p>` 中正常 wrap（CSS 默认 break-word 否，会扩出容器）。在窄屏 360px 下整个词不换行 → 容器横向滚动。"What is the meaning of antidisestablishmentarianism in this sentence?" 一行扛不住。
- 期望行为：`<strong>` 加 `break-words`；目标词若 > 25 字符，sentence 改为左对齐 + truncate hint。
- 建议修复：`<strong className="font-bold underline ... break-words">`。

### F-3.4【P1】`renderWithEmphasis` 大小写不敏感但只匹配第一处
- 文件 / 行：`_audit_review/exam/questions/OLevelVocabInContext.tsx:131-143`
- 输入示例：
  ```ts
  contextSentence = "He ran fast. The Cars ran past."
  targetWord = "ran"
  ```
- 实际行为：`indexOf` 只找第一次出现 → 只第一个 "ran" 被高亮，后续 "ran" 无加强。学生若指着第二处理解，反而以为高亮的那个才是题目目标。
- 期望行为：要么明确"只高亮第一次"是 by design，要么高亮所有匹配。
- 建议修复：用 `split` + 重新拼接，把所有匹配（保留大小写）都包到 `<strong>` 中。

### F-3.5【P1】复数 / 词形变体未匹配
- 文件 / 行：`_audit_review/exam/questions/OLevelVocabInContext.tsx:132`
- 输入示例：`targetWord = "run"`，contextSentence = `"He runs every morning."`。
- 实际行为：`indexOf("run")` 找到 "runs" 中的 "run"（位置 3）→ 把 "run" 中 3 个字母加粗，"s" 不加粗 → 视觉上 `run` `s` 变成两段。看起来像两个不同的 token。
- 期望行为：要么按词边界匹配（`\brun\b`），要么 schema 要求 targetWord 与原文完全一致。
- 建议修复：用正则 `new RegExp('\\b' + escapeRegExp(targetWord) + '\\w*', 'i')` 把整个词族高亮，或严格按 word boundary 匹配且要求一致。

### F-3.6【P1】跨段 targetWord（context 含换行 + targetWord 跨行）
- 文件 / 行：`_audit_review/exam/questions/OLevelVocabInContext.tsx:131-143`
- 输入示例：context 中 `"the runn-\ner"` 因 PDF 换行而有连字符 + 换行；`targetWord = "runner"`。
- 实际行为：`indexOf` 找不到 `"runner"` → 不高亮，组件回退到无高亮渲染。但 sentence 里仍含连字符。
- 期望行为：preprocess context 去掉连字符 + 换行；这本是 PDF-ingest 层的问题。
- 建议修复：在 `clean()` 中加 `.replace(/-\n/g, '')` 处理连字符断行。

### F-3.7【P2】`options` 数量不是 4（3 / 5 / 0）
- 文件 / 行：`_audit_review/exam/questions/OLevelVocabInContext.tsx:89-90`
- 输入示例：`q.snapshotOptions = []` 或 3 个 / 5 个。
- 实际行为：`(q.snapshotOptions ?? []).map(...)`。0 个 → 空 `<ul>`，学生看到题干但没有选项，无法作答，没有错误提示。
- 期望行为：组件描述写"4 MCQs"，应至少 warn 当数量 ≠ 4，但不应崩。
- 建议修复：`if (options.length === 0) return <DataErrorCard/>;`；其他数量保留但 console.warn。

### F-3.8【P3】`opt.text` 含 markdown / HTML —— React 字符串节点会自动转义，无 XSS。✅

---

## 4. OLevelMcqList.tsx

### F-4.1【P1】`paper.questions = []` → `paper.questions[0]` undefined → `useState(0)` 后 `q = undefined`，下面 `q.id` 抛异常
- 文件 / 行：`_audit_review/exam/questions/OLevelMcqList.tsx:14-18`
- 输入示例：`paper.questions = []`
- 实际行为：`q = paper.questions[0] = undefined`；line 18 `q.snapshotContent` → TypeError，组件崩溃，整个 ExamRenderer 树 unmount。
- 期望行为：早期 return 空状态。
- 建议修复：`if (!paper.questions.length) return <EmptyExamState/>;` 在 line 14 之前。同样的问题在 OLevelComprehension（line 30）、OLevelVocabInContext（line 26）、OLevelSentenceTransformation（line 29）都存在。

### F-4.2【P1】`options` 为空数组 → 落入 textarea 自由作答分支
- 文件 / 行：`_audit_review/exam/questions/OLevelMcqList.tsx:37, 70-77`
- 输入示例：`q.snapshotOptions = []`
- 实际行为：条件 `q.snapshotOptions && q.snapshotOptions.length > 0` 为 false → 渲染 textarea。MCQ 题被错配成自由文本，学生输入文字，提交后无法对照 correctKey。
- 期望行为：明显数据错误，应显示 "（选项缺失）" 警告，而不是悄悄换题型。
- 建议修复：再加一个分支 `else if (q.snapshotOptions && q.snapshotOptions.length === 0) return <DataErrorCard/>;`。

### F-4.3【P1】`options` 内多 correct —— 同 F-3.2，schema 漏洞，组件无能为力。

### F-4.4【P1】选项文字含 HTML / markdown / 链接
- 文件 / 行：`_audit_review/exam/questions/OLevelMcqList.tsx:64`
- 输入示例：`opt.text = "<img src=x onerror=alert(1)>"`
- 实际行为：React 文本节点 `{clean(opt.text)}` 自动转义，HTML 显示为字面字符 → 安全 ✅。但 markdown 不被渲染（`**bold**` 字面显示） — 看 schema 是否允许 markdown。如果题干来自 AI 生成且含 `**强调**`，学生看到的是字面 `**强调**`，丑陋但安全。
- 期望行为：明确 schema：option text 必须是纯文本。
- 建议修复：schema 校验拒绝 < / > 等危险字符；或 sanitize + 渲染白名单 markdown。

### F-4.5【P2】单选 vs 多选区分
- 文件 / 行：`_audit_review/exam/questions/OLevelMcqList.tsx:55-58`
- 实际行为：硬编码 `<input type="radio">`，无多选支持。`ExamAnswer.selectedOption` 也是单 string。所以多选题 schema 就不存在 → 这是产品决策。
- 期望行为：如果未来要加多选，answers schema 与组件都得改；目前限制是 by design。
- 建议修复：（无）；维护时记得 RegisterRenderer 不要混入多选 schema。

### F-4.6【P2】`correctOption` 不在 options 列表中
- 文件 / 行：`_audit_review/exam/questions/OLevelMcqList.tsx:20`
- 输入示例：options keys = ['A','B','C']，`correctOption = 'D'`。
- 实际行为：`showFeedback` 为 true，`isCorrect = ans.selectedOption === correctKey = false`（学生不可能选 D）→ 学生选任何答案都被判错；底部显示 "✗ Correct: D"，学生看不到 D 选项，茫然。
- 期望行为：组件应校验 `correctOption ∈ options.keys`；不在则视为数据错误。
- 建议修复：导入侧 schema 校验；组件兜底 `if (correctKey && !options.find(o => o.key === correctKey)) console.warn(...);`。

---

## 5. OLevelComprehension.tsx

### F-5.1【P1】`subQuestions = []`（即 `paper.questions = []`）→ `q = undefined` → 崩溃
- 文件 / 行：`_audit_review/exam/questions/OLevelComprehension.tsx:30, 49`
- 同 F-4.1。

### F-5.2【P2】段落超长滚动行为
- 文件 / 行：`_audit_review/exam/questions/OLevelComprehension.tsx:40, 48`
- 输入示例：passage = 8000 字符的散文。
- 实际行为：`lg:max-h-[calc(100dvh-9rem)] lg:overflow-auto` 在 ≥lg 屏限定高 + 滚动，OK。但在 < lg（手机/平板竖屏）**没有 max-height 限制**，passage 与题目都堆在一个长滚动页 → passage 会把 question card 推到屏幕外 1000px+，学生需要疯狂滚回。
- 期望行为：在 mobile 加 collapsible passage（"Show passage / Hide" toggle），或固定 passage 区域 max-height + 内部滚动。
- 建议修复：mobile 加 `max-h-[40vh] overflow-auto` 或 sticky header 跳转按钮。

### F-5.3【P2】题与题之间状态隔离 —— 由 ExamContext 管理 answers，应隔离 ✅；但 `idx` 是 OLevelComprehension 内部 state，**切换题不会重置 textarea / radio 选择**（受控自 answers），OK ✅。但 `<textarea autoFocus>` 不存在；`FreeTextAnswer` 在切题时不会自动聚焦，对老师演示不便。
- 期望行为：（次要）切题时应 focus 第一个交互控件。
- 建议修复：在 `ComprehensionQuestionCard` 内 `useEffect` 监听 `q.id` 变化时 focus 第一个 input/textarea。

### F-5.4【P1】practice 模式下 `correctOption` 验证只看 `selectedOption`，但 free-text 题（无 options）的 `textAnswer` 没有任何评分逻辑
- 文件 / 行：`_audit_review/exam/questions/OLevelComprehension.tsx:88-91, 142-146`
- 实际行为：`showFeedback = mode === 'practice' && ans?.selectedOption && correctKey`。如果题型是 free-text，`ans?.selectedOption` 永远为 undefined → 永远无 feedback → practice 模式形同 test 模式（针对 free-text）。
- 期望行为：free-text 题在 practice 模式下应显示 model answer / sample answer 供对比。
- 建议修复：增加 `c.modelAnswer` 字段，在 practice 模式下学生提交后展开。

### F-5.5【P2】passage 与题目共享同一 `passageTitle` —— 设计正确，但若 questions 中有多个不同 passage 会显示不出来（O-Level 一般一个 paper 一个 passage，schema 隐含此约束）。

### F-5.6【P2】`reflowPassage` 对带 `[BLANK]` 的 passage 会保留 `[BLANK]` 字面（O-Level Comprehension 不应该有 BLANK，但若误路由数据进来，会显示字面 `[BLANK]`）— 走 `pickRenderer` 已经分流，但可作为 defense-in-depth：在 reflow 后过滤可疑 token。

---

## 6. shared/textUtils.ts

### F-6.1【P1】**没有** `splitByBlank` / `parseGap` 函数
- 文件 / 行：`_audit_review/exam/shared/textUtils.ts`（全文）
- 实际：仅 `clean`、`reflowPassage`、`splitStem`。所有 `[BLANK]` 切分都散落在 OLevelCloze 内 inline 正则。
- 期望：抽出 `splitByBlank(passage: string): string[]`，统一支持转义、大小写、连续 BLANK 等边界。
- 建议修复：见 F-1.3 / F-1.7。

### F-6.2【P1】`clean` 只处理 `�` 与 CRLF，未处理：
- BOM (`﻿`)：`clean('﻿hello')` → `'﻿hello'`，`split` 时 BOM 计入第一个 segment 第 0 位 → 不可见但占位。
- 不间断空格 (` `)：`split(/\s+/)` 会保留，wordCount 错误（OLevelSentenceTransformation 用 `text.trim().split(/\s+/)`，`\s` 包含 ` ` ✅）；但视觉上 NBSP 与空格不易区分，学生 paste 来的文字可能被多算词。
- 零宽字符 (`​/C/D`)：从 PDF 抓的字符串可能含此类，`split` 不切，但显示为空、`length` 计入 → 引起 over-limit 误判。
- 期望：`clean` 中 `.replace(/[﻿​-‍]/g, '')`。
- 建议修复：扩展 `clean` 函数，并在测试覆盖 BOM、ZWSP。

### F-6.3【P2】`reflowPassage` 对带 `\t` 的输入未规范化
- 文件 / 行：`_audit_review/exam/shared/textUtils.ts:19-20`
- 实际：`replace(/\s{2,}/g, ' ')` 把多个空白合一，但 `\t` 单独 1 个时不被合，留作字面 tab，渲染时 `whitespace-pre-wrap` 会显示 tab gap → 视觉对齐错乱。
- 期望：先 `replace(/\t/g, ' ')` 再合 spaces。
- 建议修复：在 `reflowPassage` 起始追加 `.replace(/\t/g, ' ')`。

### F-6.4【P1】`reflowPassage` 把段落首字母推断（`A The Babylonians…`）应用到所有匹配 → 会误命中 "I am happy"、"A book" 等正常英文句首
- 文件 / 行：`_audit_review/exam/shared/textUtils.ts:22`
- 输入示例：`"He bought a fruit. A apple is red."` （这里 A 不是段落标记）
- 实际行为：正则 `(^|[^\n])\s+([A-Z])\s+(?=[A-Z][a-z])` —— 要求 capital + space + 下一个 capital + lowercase。`"A apple"` 中 `A apple` 后是 `is` → A apple is → next token `is`， `A` then `apple` → 实际匹配是 `[A-Z]\s+(?=[A-Z][a-z])` 要求**下一个**单词以 capital + lowercase 开头，所以 `A apple` 不会匹配（apple 全小写）。但 `A The` 会匹配 → 把 "A The Babylonians" 拆成新段。看起来限定够。
- 但反例：`"in 2020. A The new policy..."` 文本可能本身就是段落标记 + 句首大写，此时也会拆，没问题。
- 反例 2：`"Mr. A The Great"`（人名缩写）→ 也会被拆成段落 → 错。极少见。
- 期望：可接受的退化，但应在测试中加入反例覆盖。
- 建议修复：要求 A-Z 前为换行或句号 + 空格（更强约束）：`(\.\s+|\n)([A-Z])\s+(?=[A-Z][a-z])`。

### F-6.5【P1】`splitStem` 对单段无空行的复杂 stem 直接 instruction 留空
- 文件 / 行：`_audit_review/exam/shared/textUtils.ts:30-37`
- 输入示例：`"Read the following: A) Apple B) Banana. Which is yellow?"` （无空行）
- 实际：`matches.length === 0` → instruction 空，整段塞 item。Instruction 与 item 没分开，单独 item 显示完整一段，不会出错但 UI 上没有 instruction 区分。
- 期望：可考虑 fallback，按 `^[A-Z]\)` 列表项前的内容作为 instruction。
- 建议：低优先级，等数据格式稳定再调。

### F-6.6【P0/测试】测试覆盖严重不足
- 文件 / 行：`_audit_review/exam/__tests__/textUtils.test.ts`（全文 50 行）
- 当前覆盖：`clean`（FFFD、null/undefined/empty、CRLF）；`reflowPassage`（段落、单 newline 折叠、ABC 段落标记、空字符串）；`splitStem`（最后一空行、无空行）。
- 缺失：
  - `splitByBlank` 函数本身不存在 → 测试也不存在（最重要的 cloze 切分逻辑零测试）。
  - `clean` 未测：BOM、ZWSP、NBSP、emoji（surrogate pair）、tab。
  - `reflowPassage` 未测：包含 `[BLANK]` 的输入、tab 字符、混合 \r\n、超长输入（10MB）、纯空白输入、纯换行输入。
  - `splitStem` 未测：`\r\n\r\n`、连续多空行、首尾空行、stem 全是空行。
- 期望：每个函数至少 8-10 个用例覆盖边界。
- 建议修复：补 `textUtils.test.ts`，并把目前散落在组件中的 inline 正则抽到 utils（F-6.1）后一并测。

---

## 7. InlineGapInput.tsx 通用问题（贯穿所有 cloze 题）

### F-7.1【P2】`onCommit` 仅在 blur 时触发，按 Tab 切到下一个 input 时本控件 blur 触发 commit，OK；但**用户从未 focus 过这个 input** 时，`local !== value` 永远为 false（初始相等），也就不会 commit "空值"。但如果父组件先填了 value，然后 InlineGapInput 内部 setLocal（`useEffect`），用户改值 + 组件被 unmount（如父组件因 idx 切换重新渲染） → onCommit 没触发，未保存。
- 文件 / 行：`_audit_review/exam/shared/InlineGapInput.tsx:28, 45`
- 实际行为：在 OLevelCloze 中由于 idx 不变（无切换），不太会触发；但若添加分页或重新挂载就会丢字。
- 期望：unmount cleanup 时 commit。
- 建议修复：
  ```tsx
  useEffect(() => () => { if (localRef.current !== value) onCommit(localRef.current); }, []);
  ```

### F-7.2【P2】`autoFocus` prop 未在 OLevelCloze 中使用 → 学生进入填空页面后没有自动 focus，多 4 个空时尤其需要 focus 第一个。
- 建议：在 OLevelCloze 给 `i === 0` 的 InlineGapInput 传 `autoFocus`。

### F-7.3【P3】`spellCheck={false}` 默认关闭 → 对填空写作有利（不要红浪线干扰），by design ✅。但会和 sentence transformation textarea 不一致（textarea 无显式 spellCheck）。

### F-7.4【P3】`type="text"` + 移动端虚拟键盘默认显示英文 capital → 应加 `inputMode="text"` 与 `autoCapitalize="none"`，否则学生在 iPad 输入会被自动首字母大写，与 cloze 答案大小写比较冲突（虽然 case-insensitive，但视觉上别扭）。
- 文件 / 行：`_audit_review/exam/shared/InlineGapInput.tsx:42-50`
- 建议：`autoCapitalize="off"` + `inputMode="text"`。

---

## 8. 跨组件共性

### F-8.1【P1】所有 O-Level 组件**都不**校验 `paper.questions` 是否为空 → 一旦上游误送空数组，整个 ExamRenderer 崩溃。
- 建议：统一在 `ExamRenderer` / `pickRenderer` 层兜底。

### F-8.2【P1】所有组件直接 `q.snapshotContent ?? {}` 不校验类型 —— 如果 `snapshotContent` 是 `null` 字符串（"null"，AI 误生成）或 `[]`，访问 `c.stem` 都返回 undefined，渲染空，无 warning。
- 建议：统一 `assertObject(c)` 或 schema 校验。

### F-8.3【P2】practice 模式正确性比较只在 OLevelCloze 中实现，其他四个组件 practice 模式行为依赖 `correctOption`（MCQ 题型），sentence transformation 没有自动批改（合理）。但 OLevelCloze 的 `practiceFeedback` 比较逻辑（lowercase 直比）与其他题型逻辑不一致，应抽到工具函数。

### F-8.4【P2】所有 O-Level 组件都**不**显示题目编号 `{q.sortOrder}`，只显示运行时 idx。如果数据里 sortOrder 与 idx 不一致（少题、跳号），学生看不到正式题号。
- 建议：header 改为 `Q{q.sortOrder} / {total}`。

---

## 整体结论

### 量化总览
- P0: 1 条 (F-6.6 测试严重缺失)
- P1: 18 条
- P2: 18 条
- P3: 5 条

### 主要问题分类

**1. Schema/数据治理漏洞（最严重）** —— 大半边界都源于上游数据可能错乱，但前端没有任何 invariant 检查或友好提示：
- `[BLANK]` 数量与 question 数失配（F-1.1）
- 嵌套 / 字面 `[BLANK]`（F-1.2 / F-1.3）
- `correctOption` 缺失或不在选项里（F-3.1 / F-4.6）
- `maxWords` 0/负数/NaN（F-2.3 / F-2.4）
- `original` / `stem` 为空（F-2.6）
- `snapshotOptions = []` 被误当 free-text（F-4.2）

**建议**：在数据导入边界（IELTS repair pipeline、AI 生成 pipeline、import job）加一道 zod schema validation；前端组件保留 defensive console.warn + `<DataErrorCard/>` 兜底，永远不要默默退化。

**2. 组件 bug（确认是组件而非数据）**：
- 空 `paper.questions` 直接崩（F-4.1 / F-5.1）—— 必须修，几行代码。
- `InlineGapInput` 不 auto-grow，长输入溢出（F-1.9）—— 一行 CSS `field-sizing: content` 或 useLayoutEffect 测量。
- `renderWithEmphasis` 只匹配第一处、不处理词形变体、不按 word boundary（F-3.4 / F-3.5）—— 算法逻辑要重写。
- `clean` 不处理 BOM/ZWSP/NBSP/tab —— 简单 regex 扩展。

**3. 测试覆盖**：
- 整个 cloze 切分逻辑（最容易出错的部分）零单元测试。
- `splitByBlank` 函数尚未抽出。
- 现有 `textUtils.test.ts` 仅 7 个用例，不足以保护边界。

**4. UX 一致性**：
- 4 个题型都有"上一题/下一题"按钮 + idx state，但没有共享导航 hook → 升级时容易漏改。
- 题号显示用 idx 而非 sortOrder，不一致。
- practice 模式批改逻辑（大小写、首尾标点、全角、词形）每题型各自实现 / 缺失 → 应抽公用 `isAnswerEqual()`。

### 风险评估

> **首要修复（如 demo 在即）**：F-4.1 / F-5.1 / F-2.6（空数据导致崩溃或完全空白）— 这些会让学生在 prod 看到白屏或错误 boundary。

> **其次（数据治理）**：F-1.1 / F-1.3 / F-3.1 / F-4.2 / F-4.6 — 当前 pipeline 一旦产出小错就静默退化，导致学生练了一道题但根本没法获得反馈。强烈建议加 zod schema 在数据落库前拦截。

> **可暂缓**：F-3.5 (词形高亮)、F-1.4 (句尾 BLANK)、F-7.4 (移动端 autocapitalize) 等 P2/P3 视觉与 UX 体验问题。

> **测试债**：F-6.6 是 P0 但不是用户可见的 bug —— 是工程债。建议在下一次 sprint 计划中安排 1 天写 textUtils 全覆盖测试 + 抽 `splitByBlank` 工具。

### 不是 bug 的设计决策（确认）
- maxWords 超限只警告不阻断 —— by design，注释里明确写了。
- `<input type="radio">` 单选硬编码 —— schema 不支持多选，by design。
- O-Level Comprehension 的 50/50 分屏不可拖动 —— 注释明示是为了"考试压力下不让学生误碰分隔条"。
- `clean` 把 U+FFFD 替换为 en-dash —— 与 PDF ingest 的字体替换问题对齐，by design。

以上四条不要"修"。
