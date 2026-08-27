# Exam Paper System

一个仓库，**两个产品面**，共用同一套 API 和同一个数据库。
GitHub: `publicmain/exam-paper-system`。

## 产品面 1 —— 教师 / 管理后台

国际课程学校（CIE / Edexcel / O-Level / IGCSE / A-Level）试卷生成：老师选
科目 / 章节 / 时长 / 总分 / 题型配比 → 从打标签的题库抽题 → 可编辑试卷 →
导出 PDF + 答案卷。另含题库、判分队列、班级管理、排课、看板、家长门户。

权威文档：`README.md` + `docs/PRD/exam-paper-system-overhaul.md`。

## 产品面 2 —— 学生每日英语 App

账号制、全天可进入的英语学习 App。

**正式流程（线性七步）**：

```
账号登录 / 注册 → 今天的课 → 阅读 → 阅读结果
  → 学习本次单词 → 正式单词测试 → 今日总结
```

**同一外壳内的独立页面**：历史成绩、生词本自由练习、错题重练、账号设置。

**身份规则**：

- 身份**只来自服务端验证过的学生令牌**
- canonical URL **不携带姓名或 studentId**
- **不依赖**扫码、考勤、姓名查询
- 令牌失效 → 回登录页，**不是**姓名输入页

### 三个状态，别混为一谈

**生产：未核实（UNVERIFIED）**。仓库能证明的是 —— **重建期的那批提交
（P7 / P8 / P8.5 / P9 / P9.5 / RC1 / RC1.1）不在 `origin/main` 上**，
只存在于本地分支；RC1.1 只推到过 `staging-manual-test` 分支。
**生产实际跑哪个提交，本仓库无从判断** —— 那需要部署平台自己的记录。
所以：**既不得声称 RC1.1 已发布 / 已部署 / 学生每天在用，也不得断言它
没有** —— 要结论就去查部署平台。
（历史事实：更早的早测能力确实存在过、也服务过真实班级，3.0 / 4.0 的业务
规则是逐步落地的 —— 但这**不能**推出完整的 RC1.1 流程在生产。）

**本地 / staging**：P1–P9.5 / RC1.1 的学生能力**已在本地分支实现**并通过本地
验证，已部署到**独立的 staging 环境**（独立 Railway 项目 + 独立库 + 八个虚构
账号），正在做**真机人工验证**（见 `docs/manual-device-test-plan.md`）。
学生前端**还在 `apps/web` 里**与教师端混着，账号制页面与早期的扫码 / 姓名
查询 / `/my-history` 旧链路并存，两套外壳会互相跳。**这不是最终形态。**

**目标**：物理隔离的 **`apps/student-web`**。

> **`apps/student-web` 还不存在。** 重建除文档与冻结基线外**尚未实施**；
> 阶段 3（部署闭环 spike，阻断项）**未开始**。

> **写文档时的规矩**：代码里实现了 ≠ 上线了。除非有部署侧证据，
> 一律写「已实现」「在 staging 验证中」，不写「已上线」「每天在用」。

### 学生产品的权威顺序（高覆盖低）

1. `docs/reconstruction/product-contract.md` —— 目标产品定义
2. `docs/reconstruction/product-decisions.md` —— 已定的产品决定 D1–D6
3. `docs/reconstruction/migration-plan.md` —— 16 阶段迁移计划

支撑文档：`student-route-inventory.md`（入口清单与分类）、
`legacy-retirement-map.md`（引用矩阵）、`student-web-architecture.md`
（路由契约 + CI 守卫）、`freeze-manifest.md`（冻结范围）。

**`docs/PRD/*` 里的学生端文档是历史证据** —— 记录当时为什么那样决定，
**不能覆盖**上面三份。README 同理：它描述现状，学生产品的目标形态以
上面三份为准。

### 冻结

旧学生代码按 `docs/reconstruction/freeze-manifest.md` **冻结**：只接受
阻断性缺陷、安全修复、单向兼容适配器。**任何新的学生行为归未来的
`apps/student-web`**，不写进 `apps/web`。任何旧页面都不得成为新的
canonical 落点。

## 技术栈
monorepo：`apps/api`（NestJS + Prisma + Postgres + Puppeteer/KaTeX 出 PDF）＋ `apps/web`（React 18 + Vite + Tailwind + KaTeX）。Railway 部署（2 service + managed Postgres）。

## 跑起来
```bash
docker compose up -d              # 本地 Postgres
npm run db:migrate && npm run db:seed
npm run dev                       # API :4000  Web :5173
```
demo 账户：`teacher@school.local` / `teacher123`。

## ⚠️ 铁律（最重要）
- **零 Anthropic API 调用**：用户 Anthropic 额度已空、且按 flat-fee Cowork 计费 → 出题 / QA 审核 / 短答评分**全部由我（Claude）在 chat 里做**，不走代码里的 AI 路径。
- 用户说 **「判分 / 批今天的早测 / grade 早测 / 人工判分」** → 走 `/api/marker/*` 排空 marker 队列；**绝不触发 AI grader / `regradeSession`（会调 Claude API）**。
- 新 PDF→fixture **必须过 10 项 AI 审计**（passage / stem / mark-scheme / schema / AI-grader 精确+改写+拒答 / UI 渲染）才能 push，无例外。
- **未经当前对话明确批准，不得 git push、部署或执行生产迁移**。
- 版权：past-paper 只存元数据（如 `9702/22/M/J/19/Q3`）不存原文；seed 题 `source_type=original_school`。

## 日常
早测（morning-quiz）考勤同步到 Seiue（`OL_MO_English` + `MO_English`）。

---
> 本仓库另有 auto-memory（约 12 个文件）会随本目录会话自动加载，含 M365 迁移 / 早测考勤 / ESIC 网站等更细的运维记忆。**始终用中文回答。**
