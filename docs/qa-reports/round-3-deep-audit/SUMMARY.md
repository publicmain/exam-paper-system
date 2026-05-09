# Round-3 深度审查汇总

**审查范围**：`a3398dc^..5bb3a04` 共 7 个 commit
**审查方式**：10 个 agent 并行扫描，从代码 / 数据 / 逻辑 / 意外四个层面
**汇总时间**：2026-05-09
**Worktree**：`claude/intelligent-snyder-70adcc`

---

## 元发现（必须先看）

**事实更正**：审查中部分 agent（4 / 5 / 9 / 10）独立报告了"代码在 `_audit_review/exam/` 不在 `apps/web/src/components/exam/`"的路径错位，最初汇总也据此写了"未合并到 main"的元发现。

**复核后真相**（`git ls-tree origin/main apps/web/src/components/exam/` 确认）：

- `origin/main` HEAD = `5bb3a04`，**这 7 个 commit 确实已在 main 上**，`apps/web/src/components/exam/` 在 main 上完整存在
- 当前 worktree HEAD = `81c55b5` + 本审查 commit，是 main 的**祖先**——`5bb3a04` 是 `81c55b5` 的线性后代（不是分叉），merge-base 是 `81c55b5`
- `_audit_review/` 是这个 worktree 本地 git-untracked 的副本（被预先 ckpt 下来供审查），不在远程
- agent 看不到 `apps/web/src/components/exam/` 是因为本 worktree 只是**未 fetch**到 origin/main 的最新状态

**含义**：
1. 用户的"刚 push 到 main"叙述**正确**，代码确实在 main 上跑。
2. Agent finding 全部仍然成立——它们读的 diff (`a3398dc^..5bb3a04`) 是有效源；路径只是 `apps/web/src/components/exam/` 而非 `_audit_review/exam/`，请按报告里给出的相对路径再加 `apps/web/src/components/` 前缀映射。
3. 这 4 个 Critical 和 22 个 High **是已上线代码的实际风险**，不是合并前预警。
4. **下一步动作**：尽快修 C1（redaction 白名单）+ C2（practice mode 前端可绕）+ C3（空数组 crash）+ C4（测试基础设施虚构），这是 main 上当下的状态。

---

## 严重度计数

| 级别 | 数量 | 备注 |
|---|---|---|
| Critical | **4** | 含 1 个测试基础设施诚信问题、2 个安全设计漏洞、1 个空数据 crash |
| High | **22** | 跨 7 个切片，去重后 |
| Medium | **35+** | 详见各分报告 |
| Low / Nit | **40+** | 详见各分报告 |

10 份分报告共 2963 行，分布：
- agent-1-types-static.md（161 行）— 类型 / tsc / any 滥用
- agent-2-rewrite-regression.md（151 行）— MorningQuizTake 重写回归
- agent-3-autosave-offline.md（163 行）— 自动保存 / 离线 / 并发
- agent-4-ielts-interactions.md（458 行）— IELTS 7 件套交互
- agent-5-olevel-edges.md（462 行）— O Level 题型边界
- agent-6-context-perf.md（280 行）— ExamContext 性能
- agent-7-backend-contract.md（159 行）— 后端契约 / redaction
- agent-8-practice-mode-integrity.md（222 行）— practice 模式判分诚信
- agent-9-mobile-a11y.md（448 行）— 移动端 / a11y
- agent-10-test-coverage.md（459 行）— 测试覆盖盲区

---

## Critical 全文

### C1（Agent 8 #1）安全设计漏洞：redaction 黑名单与 UI 契约脱节

**当前未爆雷，但结构上不防 — 下一个 PR 写入即穿透到学生端。**

- **证据**：
  - 后端 `apps/api/src/morning-quiz/morning-quiz.service.ts:632-642` 的 `stripSnapshotContent` 是 omit-list，只剥 `markScheme` 和 `answerContent`
  - 前端五个 question 组件（OLevel{Mcq,Cloze,Comprehension,Vocab,SentenceTransformation}）硬编码读取 `snapshotContent.correctOption / correctAnswer / exampleAnswer / explanation`
  - `docs/UI-QUESTION-TYPES.md:79/87/92/104/108` 已把这四个列为 UI 契约字段
  - 回归测试 `apps/api/test/morning-quiz.spec.ts:322-336` 只覆盖 markScheme/answerContent 两字段
- **攻击路径**：任何下游数据生成器（AI 生成、PDF parse、admin 手填）只要往 `snapshotContent` 里塞 `correctOption` 等字段，redaction 不会拦，学生 GET /morning-quiz/sessions/:id 即拿到答案
- **修复**：把 omit-list 改成 **按 questionType 的白名单**；加 fuzz 测试断言"任意附加字段都被剥掉"

### C2（Agent 8 #2）安全设计漏洞：`?mode=practice` 是纯前端字符串

- **证据**：
  - `apps/web/src/pages/MorningQuizTake.tsx:46` 解析 `mode` 仅用于切 UI 反馈
  - `GET /morning-quiz/sessions/:id` 不接收 mode 参数 → 后端无法区分练习 vs 正式
  - 服务端 grep `practice` 零命中
- **攻击路径**：学生在正式考试中加 `?mode=practice` 到 URL → 前端激活作弊反馈 UI；只要 C1 数据通道开放，立即看到正确答案
- **修复**：服务端独立 endpoint（如 `POST /morning-quiz/sessions/:id/check`）接管即时判分；前端不再持有 correctness 数据

### C3（Agent 1 + Agent 5 重复发现）空 `paper.questions` 数组致整树 crash

- **位置**（_audit_review/ 路径）：
  - `OLevelMcqList.tsx:14-18`
  - `OLevelComprehension.tsx:30`
  - `OLevelVocabInContext.tsx:26`
  - `OLevelSentenceTransformation.tsx:29`
  - `pickRenderer` 把空 paper 路由到的恰好是会崩的 `OLevelMcqList`
- **重现**：管理员上架一份 questions 为空的 paper（schema 不防）→ 学生进入 → 整页白屏
- **修复**：renderer 入口判空返回 `<DataErrorCard>`；schema 层加 invariant

### C4（Agent 10）测试基础设施虚构

诚信问题，不直接影响生产但影响所有"26 用例全绿"的判断依据。

- **真相**：5 个测试文件中只有 2 个跑通（17 / 26 用例），3 个 React 测试套件因为 `@testing-library/react` 不存在直接 fail
- **基础设施真空**：`apps/web/package.json` 没装 vitest、testing-library、jsdom；`vite.config.ts` 没 test block；`test-setup.ts` 不存在
- **位置错位**：测试文件在 git-untracked 的 `_audit_review/exam/__tests__/`，没被任何 import 引用
- **修复**：要么搭基础设施 + 把测试合进 apps/web，要么撤回"26 用例覆盖"叙事

---

## High 22 条总表

| # | Agent | 标题 | 文件:行 |
|---|---|---|---|
| H1 | A1 | `ExamAnswer` 在 `types.ts` 和 `ExamContext.tsx` 重复定义（schema drift 风险） | _audit_review/exam/types.ts + ExamContext.tsx |
| H2 | A1 | `snapshotContent: any` 是最大类型逃生口（10+ 字段无静态保护） | _audit_review/exam/types.ts |
| H3 | A1 | `useMemo([])` 持有 setTimeout Map（应用 `useRef`） | _audit_review/exam/ExamContext.tsx |
| H4 | A3/F2 | 多 tab/多设备并发无版本控制（`prisma.answerScript.upsert` 最后一写赢） | apps/api/src/morning-quiz/morning-quiz.service.ts |
| H5 | A3/F3 | 离线积压不重传（OfflineBadge "will sync on reconnect" 是虚假承诺） | _audit_review/exam/ExamContext.tsx |
| H6 | A3/F5 | submit 与 autosave 竞态（600ms 内最后修改可能被 `submission_locked` 吞掉） | _audit_review/pages/MorningQuizTake.tsx |
| H7 | A4/§7.3 | FontSizeAdjuster 实际不工作（fontScale 不传递到子元素的 Tailwind text-xx） | _audit_review/exam/shared/FontSizeAdjuster.tsx |
| H8 | A4/§5.1 | QuestionNavBar 用非法 Tailwind class `grid-cols-13` | _audit_review/exam/shared/QuestionNavBar.tsx |
| H9 | A4/§1.2 | DraggableSplit `onTouchStart` 没 `preventDefault` — iPad 拖不动 | _audit_review/exam/shared/DraggableSplit.tsx |
| H10 | A4/§2.1 | Highlighter offset 与 `reflowPassage` 强耦合无版本号 — 实现一变历史高亮全错位 | _audit_review/exam/shared/Highlighter.tsx |
| H11 | A6/F1 | Provider value 依赖 `answers` 引用 → 整树 re-render | _audit_review/exam/ExamContext.tsx |
| H12 | A6/F7 | IELTS Passage 一次性展开所有 group + setter 没 useCallback | _audit_review/exam/questions/IELTSReadingPassage.tsx |
| H13 | A6/F8 | `renderHighlighted` 没 useMemo，每次重渲都重切整段 passage | _audit_review/exam/questions/IELTSReadingPassage.tsx |
| H14 | A6/F10 | `MorningQuizTake.tsx:97` 每次 render 新建 `paper` 对象 → 下游 useMemo 全失效（**最高 ROI**） | _audit_review/pages/MorningQuizTake.tsx:97 |
| H15 | A9/P1-1 | DraggableSplit 用 `window.innerWidth` 在 inline style — iPad 旋转不响应 | _audit_review/exam/shared/DraggableSplit.tsx |
| H16 | A9/P1-2 | InlineGapInput 高度 ~28px、DraggableSplit 分隔条 6px — 触摸目标过小 | _audit_review/exam/shared/{InlineGapInput,DraggableSplit}.tsx |
| H17 | A9/P1-3 | 键盘弹出遮挡底部 fixed 输入框 + 交卷按钮（无 scrollIntoView/visualViewport） | apps/web/src/pages/MorningQuizTake.tsx |
| H18 | A9/P1-4 | 题号状态仅靠颜色区分，违反 WCAG 1.4.1 Level A | apps/web/src/pages/MorningQuizTake.tsx + _audit_review |
| H19 | A9/P1-5 | `100dvh` 老 iOS Safari (<15.4) 不支持 + 1024px lg: 与 `window.innerWidth` 双判不一致 | _audit_review/exam/questions/IELTSReadingPassage.tsx |
| H20 | A4 | LetterInput / Textarea onBlur 才 setAnswer — 跳题/超时若未失焦丢失当前输入 | _audit_review/exam/questions/IELTSReadingPassage.tsx |
| H21 | A4 | StickyNote 用 `prompt()` + 闭包覆盖（PWA 失效，快速连点丢便签） | _audit_review/exam/shared/StickyNote.tsx |
| H22 | A2 | 服务端写答案错误被静默吞掉（老版会冒泡红条，新版 catch 里 `// ignore`） | _audit_review/exam/ExamContext.tsx |

---

## Medium 概要（按切片）

完整内容见各分报告。

- **Agent 1（5）**：localStorage 反序列化无校验、Timer 接非法 `endsAt` 显示 `NaN:NaN`、taskType unsafe assertion、Sentence-Transformation textarea 每键 setAnswer 与其他输入不一致、字号 localStorage 全局共享。
- **Agent 2（3）**：MCQ radio 失去"点击即保存"（统一 600ms debounce）、dispatcher 用首题 taskType 判 IELTS（脏数据误判）、O-Level 渲染器无 saving 指示。
- **Agent 3（3）**：跨 session localStorage 残留无 GC、timer 卸载不 clearTimeout、initialAnswers 闭环没接通（新设备登录看到空卷）。
- **Agent 4（12）**：DraggableSplit 不响应 resize、Highlighter mouseup 不区分左右键、iOS touchend 立即清选区、StickyNote 跨 paper 共享、fontScale 浮点累加超 1.6 静默重置等。
- **Agent 5（10+）**：textUtils 仅 7 用例无 cloze 切分覆盖、`[BLANK]` 数量失配静默退化、字面 `[BLANK]` 必崩、InlineGapInput 不自适应宽度、renderWithEmphasis 三 bug、maxWords = 0/负/NaN 无防御。
- **Agent 6（12+）**：闭包正确性、localStorage 同步写阻塞、registry 未知题型 silent fallback、Timer effect 重订阅、prompt() 阻塞 UI、QuestionNavBar 跳转 paged shell 失效。
- **Agent 7（2）**：`@Get('scheduled')` 完全没 RBAC（任何登录用户能拉全校排表 + paperId）；`stripSnapshotContent` 是 omit-list 脆弱（已升 C1）。
- **Agent 8（1）**：localStorage key (`mq:hl:`/`mq:nt:`/`mq:answers:`) 用 sessionId 而非 studentId — 同设备多学生数据互见。
- **Agent 9（6）**：Highlighter iOS 选区时机异步、`sm:grid-cols-13` silent 失效、Timer aria-live 在屏幕阅读器上不靠谱、Practice mode 选项反馈色盲不可读、IELTS 分栏 Tab 顺序乱、QuestionPalette modal 缺 focus trap。
- **Agent 10（10+）**：错误路径、网络失败重连、多 tab 并发、跨题型混排、第二次进入、Cloze [BLANK] 边界、VocabInContext 多 correct、IELTSReadingPassage 488 行 0 测试、Timer 到 0 自动提交、键盘导航 — 全部 0 覆盖。

---

## 矛盾 / 重复发现去重

| 现象 | 重复来源 | 处理 |
|---|---|---|
| 空 paper.questions 让 OLevel 渲染器 crash | A1.Critical / A5.P1 | 合并为 C3 |
| DraggableSplit 触摸不工作 | A4.P0 / A9.P1-1 | A4 = `preventDefault` 缺失；A9 = 旋转不响应 — 是两个独立 bug，都保留（H9 + H15） |
| 24 字段 redaction 脆弱 | A7.M / A8.C1 | A7 是 schema-drift 担忧；A8 是已确认的 UI 契约脱节 — 升级合并为 C1 |
| 多 tab / 多设备并发数据互见 | A3.F2 / A8.M | 升级到 H4，并补 A8 同设备多学生 key 错位为独立 Medium |
| InlineGapInput 不自适应 | A4 / A5 / A9 | 同 bug，归到 H16（触摸尺寸）+ Medium（横向滚动 UX） |
| FontSizeAdjuster 不工作 + fontScale 重置 | A4.§7.3 / A4 Medium | 同根因，归到 H7 |

无内部矛盾——10 个 agent 在共同看到的细节上**结论一致**，特别是 A4 / A9 都独立指出了 DraggableSplit 触摸问题、A1 / A5 都独立指出了空数组 crash、A4 / A6 / A9 / A10 都独立发现路径错位。

---

## 整体结论

### 这批代码当前状态

1. **已在 main 上跑**（origin/main HEAD = `5bb3a04`）——元发现复核后确认。
2. **代码本身有可救价值**——架构合理（题型注册表 + 薄壳 + ExamContext），重写比 1126 行单文件清爽很多。
3. **但 4 个 Critical 是已上线的真实风险**——C1 和 C2 是设计层安全漏洞，应当立即开 hotfix 分支修。

### 建议路径

**Tier 1（hotfix，立即修，估计半天到 1 天）**：

- C1：redaction 改白名单 + 加 fuzz 测试 — 后端工作
- C2：把 practice mode 即时判分搬到服务端 endpoint，前端不持 correctness — 全栈工作
- C3：四个 OLevel renderer 加判空 + DataErrorCard
- C4：装 vitest + testing-library + jsdom，让 React 测试真跑起来；不然别声称"26 用例覆盖"
- H14：`MorningQuizTake.tsx:97` paper useMemo 一行修 — 顺手做掉
- H8：`grid-cols-13` 替成合法 class
- H7：FontSizeAdjuster 真正传递 fontScale（CSS variable / context-based 字号）

**Tier 2（强烈建议本周内修，估计 1-2 天）**：

- H4 / H5 / H6：autosave 三件套（版本号、reconnect flush、submit-flush-pending）
- H9 / H15 / H16 / H17 / H18：iPad 实考 5 件套（先在 iPad 9.7 + Pro 11 实测一次再说）
- H22：错误冒泡到学生可见

**Tier 3（跟进项，可拆 ticket）**：

- H1 / H2 / H3：类型层精修
- H10 - H13 / H19 - H21：性能 + 交互细节
- 全部 Medium

### 一句话总结

> **这批改动已在 main 上跑，4 个 Critical 是真实在线风险。**
> 优先级：C1/C2 是安全设计漏洞，下一个往 `snapshotContent` 写答案字段的 PR 即触发线上事故；C3 是数据状态崩溃；C4 是测试诚信问题。建议立即开 hotfix 分支修 Tier 1（4 个 Critical + 3 个高 ROI High），其余按 Tier 推。

---

## 报告索引

- [Agent 1 — 类型 / 静态分析](agent-1-types-static.md)
- [Agent 2 — MorningQuizTake 重写回归](agent-2-rewrite-regression.md)
- [Agent 3 — 自动保存 / 离线弹性](agent-3-autosave-offline.md)
- [Agent 4 — IELTS 7 件套交互](agent-4-ielts-interactions.md)
- [Agent 5 — O Level 题型边界](agent-5-olevel-edges.md)
- [Agent 6 — ExamContext / Provider 性能](agent-6-context-perf.md)
- [Agent 7 — 后端契约 / redaction](agent-7-backend-contract.md)
- [Agent 8 — 练习模式判分诚信](agent-8-practice-mode-integrity.md)
- [Agent 9 — 移动端 / a11y](agent-9-mobile-a11y.md)
- [Agent 10 — 测试覆盖盲区](agent-10-test-coverage.md)
