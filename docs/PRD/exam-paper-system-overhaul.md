# Exam Paper System · 产品成熟度改革 PRD

| | |
|---|---|
| **状态** | Draft（待评审） |
| **创建日期** | 2026-06-02 |
| **负责人** | yaokexiang |
| **触发来源** | 老板转发《从 Vibe Coding 到可售产品的 AI Agent 升级报告》+ "对整个系统做大刀阔斧的改革，不局限于 morning quiz" |
| **本文定位** | 改革方向的**唯一事实源**。后续每个 issue / PR 都应能回指本文的某个 Phase 与验收标准。 |

> 配套阅读：`README.md`（原始 MVP 范围）、`docs/AI-QA-REVIEW.md`（现行 10 项 AI 审计）、`CLAUDE.md`（铁律）。

---

## 1. Understanding Summary（理解锁定）

- **在做什么**：把一套已经能跑、但仍是"原型级编排"的考试系统，升级为**可预测、可解释、可运维、可演进、最终可售**的产品；范围覆盖整个系统，不只 morning quiz。
- **为什么**：系统"显得稚嫩"的根因不是模型能力，而是工程成熟度——契约不严、可观测性弱、eval/CI Gate 缺失、UX 失败恢复不系统、商业化能力（多租户/计费/治理）为零。
- **为谁**：① 现阶段——本校老师与学生（morning quiz + 出卷）；② 未来阶段——可付费的其它国际学校（SaaS）。
- **关键约束（铁律）**：**运行时零 Anthropic API**。出题 / QA / 判分当前全部由 Claude 在 chat 内完成（flat-fee Cowork），代码里不走 AI 路径。
- **范围演进事实**：原始 MVP（见 README）明确把"自动判分、学生端 UI、多租户 SaaS"列为 out-of-scope，但 morning quiz 已经长出了全部三者。本次改革要**正视并收编这个漂移**。
- **非目标（现在不做，YAGNI）**：planner-executor、多代理、运行时 RAG、MCP/A2A 协议互通、ToT 等"高自治"能力——**等基础闭环验证有效、且开始为运行时 AI 付费后再议**。

---

## 2. Assumptions（显式假设）

1. 团队规模按"1 产品/架构 + 1–2 全栈 + 0.5 设计/测试"估算（报告同款）。
2. 现有栈不换：NestJS + Prisma + Postgres + Puppeteer/KaTeX（api）、React 18 + Vite + Tailwind（web）、Railway 部署。**不引入 LangGraph / Dify / Agent 框架**——本系统运行时不做 agent 编排，引框架是负 ROI。
3. "可售"指**多校 SaaS**，不是单文件软件出售。
4. 现有资产可复用：Zod DTO、`paper-structure-validator`、56 项 morning-quiz 测试、10 项 AI 审计、marker 人工判分队列、role-based AuthGuard。
5. 运行时 AI 的接入是**未来事件**，触发条件在 Phase 3 量化（付费客户数 / 日判分量阈值）。

---

## 3. Decision Log（决策日志）

| # | 决策 | 备选 | 选择理由 |
|---|---|---|---|
| D1 | 改革采用**组合/分阶段**：Tier 1 工程打底 → 分阶段扩功能/商业化 | (a) 直接冲 SaaS (b) 只补工程 (c) 只扩功能 | 先打底风险最低、ROI 最高；扩功能与商业化按节奏推进，避免一次性大重写 |
| D2 | **现零-API；有客户/预算后接运行时 AI** | (a) 永久零-API (b) 立即接 AI | 当前成本模型决定零-API；但"卖给多校"必然要求自动化，故**架构预留 AI-ready 接缝** |
| D3 | **不引入 Agent 框架 / 不上 planner-executor·多代理·运行时 RAG** | 按报告上 LangGraph 等 | 报告 60–70% 的 agent 建议假设运行时调用 LLM，与 D2 当前态冲突；属 YAGNI |
| D4 | 报告的 RAG/引用/groundedness 在零-API 下**重解读**为"题库 tagging + 出处溯源 + 10 项审计" | 直接上 RAG 栈 | 产品运行时不答题，无需检索增强；但 tagging/溯源是将来 RAG 的语料底座 |
| D5 | 核心架构原则：**workflow-first；AI 工作（判分/出题）封装成可替换接缝** | 让所有逻辑进自由 agent | 与报告"workflow-first, agent-second"一致；接缝让"人→模型"切换零重写 |

> 评审时如需改动以上任一条，请在此追加一行并注明日期，不要静默修改。

---

## 4. 核心论点：零-API 与"可售"的矛盾，及其解法

报告默认**产品在运行时自己调用 LLM**（RAG、critic 循环、planner-executor、LLM-as-judge 在线评分全是运行时 API）。本系统铁律相反：运行时零 API，AI 由 Claude 在 chat 内人工完成。

两个推论：

1. 报告的"AI agent"那一半（约 60–70%）对**当前模式不适用**；真正适用的是"工程成熟度"那一半：结构化输出/契约、可观测、eval 纪律、UX、安全治理、商业化。
2. **"Claude 在 chat 里免费兜底"撑不起多校 SaaS**——一旦付费客户每天产生几百份短答判分，人工兜底必然崩。

**解法（本 PRD 的脊梁）**：

> 现在用"人（Claude in chat）"占住 AI 的位置，但把**判分**和**出题/QA**各自封装成一个**有严格输入/输出契约 + golden eval 的可替换接缝**。
> 现阶段接缝背后是"人"；Phase 3 有预算后，把背后换成付费 LLM + 报告的 evaluator-optimizer/groundedness gate 当安全底座，**业务代码零重写**。

这把报告最该先做的事（结构化输出 / Skill / eval 纪律）前置：**现在为人服务，将来为模型服务**。

---

## 5. 现状映射（报告优先级 → 本系统现实）

| 报告优先级 | 系统现有 | 零-API 可行 | Phase | 结论 |
|---|---|---|---|---|
| ① 结构化输出 / 类型契约 | Zod DTO + Prisma + `paper-structure-validator` | ✅ | 1 | 扩覆盖面 + ingest repair/fallback |
| ② Skill 库 / 仓库自定义指令 | `CLAUDE.md` + auto-memory + 10 项审计 + marker 流程（皆在 chat） | ✅ | 1 | 固化成版本化 SKILL + golden fixtures |
| ③ RAG + 引用 + groundedness | 题库 tagging + past-paper 元数据 / `source_type` | ⚠️ 运行时 RAG 不适用 | 2 | 重解读为"溯源 + 审计"，做 RAG 语料底座 |
| ④ 可观测 / eval / CI Gate | 56 测 + 结构校验；**缺** trace/health/golden-gate | 多数 ✅ | 1 | 补 health/trace/成本看板 + 审计做成 CI Gate |
| ⑤ UX 状态 / 失败恢复 | AirDrop/my-history 已修；take 页有守卫 | ✅ | 1 | 全站系统化 loading/empty/error/retry |
| ⑥ Planner-Executor | 无 | ❌ | — | 跳过（YAGNI） |
| 商业化：多租户/RBAC/计费/admin/审计导出 | 单租户；有 admin/teacher/student 角色 | ✅（工程量大） | 3 | 要卖才做；此时接运行时 AI |

---

## 6. 分阶段路线图

### Phase 1 ｜ 工程打底·去稚嫩（纯零-API，2–4 周）

**目标**：把"偶尔能用、偶尔崩"的脆弱性消除；让系统从 demo 感跃迁到产品感。

**工作项**
1. **契约硬化**：Zod + `paper-structure-validator` 扩到所有 ingest/生成路径；ingest 失败走 repair / fallback；关键中间产物全部 JSON Schema 化。
2. **固化 Skill**：把"出题 + 10 项 AI 审计 + 人工判分"沉淀为版本化 `SKILL.md` + golden fixtures（现在指导 Claude，将来当 eval 数据集）。
3. **全站 UX 状态系统**：loading / empty / error / retry / 来源徽章 / 可撤销；高风险步骤加人工确认。
4. **可观测**：`/health` 端点、`trace_id` 贯穿请求、基础设施（Railway/DB）成本看板、错误预算。
5. **CI Gate**：push 前必过"结构校验 + golden fixtures + 56 测"；把"新 PDF→fixture 必过 10 项审计"制度化为流水线门禁。
6. **🔌 AI 接缝（关键产出）**：定义两个稳定接口（见 §7），现在背后是"人"，契约现在就冻结。

**验收标准**
- Structured-output 合法率 ≥ 99%；ingest 解析失败率显著下降。
- 全部学生/老师页面具备 loading/empty/error/retry 四态。
- 任一请求可由 `trace_id` 定位；`/health` 返回成功率/p95/队列深度。
- CI 在结构校验或 golden fixtures 失败时**自动阻断 push**。
- 判分/出题接缝接口契约文档化、有契约测试。

### Phase 2 ｜ 扩出 morning quiz（按原 PRD，仍零-API）

**目标**：兑现原始 PRD 的完整出卷产品，覆盖多学科。

**工作项**
- 完整出卷流：选科目 / 章节 / 时长 / 总分 / 题型配比 → 题库抽题 → 可编辑试卷 → 导出 PDF + 答案卷。
- 从单一英语扩到**多学科**（CIE/Edexcel/O-Level/IGCSE/A-Level 各科）。
- 题库 **tagging / 出处溯源**体系做扎实（版权合规：past-paper 只存元数据，seed 题 `source_type=original_school`）——即报告"RAG 引用"的零-API 对应物，**也是将来 RAG 语料底座**。

**验收标准**
- 老师可在 N 分钟内从零生成一份可导出的多题型试卷 + 答案卷。
- 每道题可追溯出处与标签；版权红线（不存 past-paper 原文）有自动校验。

### Phase 3 ｜ 商业化 + 接入运行时 AI（触发条件驱动）

**触发条件（满足任一）**：付费客户 ≥ N 所 ／ 日均判分量 > X 份。（N、X 待 §10 量化。）

**工作项**
- 多租户隔离、RBAC/ABAC、配额/计费、运营后台、审计导出、按校品牌。
- **启用 Phase 1 的 AI 接缝**：判分/出题背后从"人"换成付费 LLM；套报告的 **evaluator-optimizer + groundedness gate** 当自动化安全底座（自动判分前必过 critic + 抽样人工校准）。
- 安全治理：OWASP LLM Top 10、ASVS、NIST AI RMF 对照；最小权限 + 工具 allowlist。

**验收标准**
- 多租户数据隔离通过渗透/越权测试。
- 自动判分与人工判分在 golden set 上的一致率 ≥ 目标阈值，否则不允许全自动。
- 单位成功任务成本（含 token）可计量、可下降。

---

## 7. AI-Ready 接缝契约（Phase 1 冻结）

两个接口现在背后是"Claude in chat"，将来换成付费 LLM 时业务侧零改动。

**判分接缝 `GradeService`**
- 输入：`{ questionType, stem, passage?, studentAnswer, markScheme, maxMarks }`
- 输出：`{ awardedMarks, isCorrect|null, reason, confidence, needsHumanReview }`
- 现实现：MCQ 走确定性自动判分；short_answer 入 marker 队列由人判（零 API）。
- 未来实现：付费 LLM + critic 复核；`needsHumanReview=true` 时回落人工。

**出题/QA 接缝 `AuthoringService`**
- 输入：`{ spec: 科目/章节/题型/难度/篇章来源 }`
- 输出：`{ paper, perQuestion: { content, answer, auditVerdict } }`
- 现实现：passage_pick / chat 内人工授题 + 10 项审计。
- 未来实现：付费 LLM 生成 + groundedness/critic gate（即 `docs/AI-QA-REVIEW.md` 的自动化版）。

> 设计要点：接缝是**同步契约 + golden eval**，不是 agent 循环。已知路径走 workflow，永远不要把判分塞进自由 agent。

---

## 8. 成功度量（六维，零-API 友好）

沿用报告六维，但把"AI 成本"替换为"基础设施成本"，"在线 groundedness"替换为"10 项审计通过率"。

| 维度 | 指标 | 目标 | 采集 |
|---|---|---|---|
| 可靠性 | 任务成功率 / p95 延迟 | ≥85% / 简单<4s | OTel + 埋点 |
| 正确性 | structured-output 合法率 / 审计通过率 | ≥99% / 100% | 运行时校验器 + CI |
| 体验 | 四态覆盖 / 错误恢复成功率 | 全覆盖 / ≥70% | 会话回放 |
| 交付 | 部署频率 / 变更失败率 / MTTR | 周≥1 / <15% / <2h | CI/CD（DORA） |
| 成本 | 单位成功任务基础设施成本 | 持续下降 | Railway/DB 账单 |
| 治理 | 安全事件率 / 审计可导出 | 持续下降 / 是 | 安全日志 + 红队 |

---

## 9. 风险与护栏

- **最大风险**：零-API 的人工（Claude）兜底**无法规模化** → Phase 1 的 AI 接缝就是这份保险。
- **过度工程**：不为"显得 AI"加运行时调用、不提前上 agent 框架（违反 D2/D3）。
- **Skill 老化**：固化的出题/审计 Skill 必须版本化、变更跑回归 eval。
- **范围漂移**：morning quiz 已超原 MVP；Phase 2 必须把新旧 PRD 对齐，避免再次失控。

---

## 10. Open Questions（待量化/待定）

1. Phase 3 触发阈值 N（付费校数）与 X（日判分量）具体取值？
2. 运行时 AI 接入时选哪家模型/价位？需先做一轮"若自动判分，月 API 成本"估算。
3. 多学科扩展的优先顺序（先哪门）？
4. SaaS 计费模型（按校 / 按生 / 按卷）？

---

## 11. References

- 《从 Vibe Coding 到可售产品的 AI Agent 升级报告》（老板转发，2026）
- Anthropic《Building Effective Agents》《Writing effective tools for AI agents》
- 成熟度框架：SRE 四黄金指标、OpenTelemetry、DORA、OWASP LLM Top 10、ASVS、NIST AI RMF
- 本仓内：`README.md`、`docs/AI-QA-REVIEW.md`、`CLAUDE.md`
