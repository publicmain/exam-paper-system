# Exam Paper System

> **2026-09-03 当前接手入口**：学生每日英语 App 已经存在于
> `apps/student-web` 并已部署到 production。下文“student-web 不存在”、
> “生产未核实”和旧线性七步说明是重建期历史，不能再作为当前状态。
> Claude 开始学生端工作前必须先完整阅读
> `docs/HANDOFF-TO-CLAUDE-2026-09-03.md`；若与下文状态说明冲突，以该
> 迁移日志、当前代码/契约测试和 Railway 实际部署为准。

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

### 当前状态（2026-09-03 核实）

以下每一条都在这一天对生产库 / Railway 做过只读核对，不是从代码推断的。

**`apps/student-web` 已存在并已部署到 production**，入口
`https://student-web-production-5a21.up.railway.app`。API 在
`https://exam-paper-system-production.up.railway.app`，`/api/health` 回报的
commit 与 `main` 一致。下文若还有「student-web 不存在」「重建尚未实施」
之类的话，是重建期的历史，已不成立。

**但产品还没有对真学生开放。** 生产库里的学生账号**全是测试账号**，
首发日是 **2026-09-07（周一）**。所以看到「41 个账号里只有 3 个做过阅读」
这类数字时，那是测试行为，不是产品缺陷 —— 别照着它去修 bug。

**内容**：五档 × 十天已发布到生产（试点第一周 08-31~09-04，首发周
09-07~09-11）。首发周的内容包在 `scripts/pilot/content/week2/`。
仓库自带的 fixture 题库**基本用尽**，第三周起的文章必须新写。

**旧早测（`G11 IELTS Test (morning-quiz)` 班）要停掉**，那 35 名学生迁到
新 App。他们读过的文章不能再发给他们 —— 发布查重门已按「学生读没读过」
而不是「题库里有没有」来判（见 `prepare-pilot-week.js` 的 `deliveredHistory`）。

> **写文档时的规矩**：代码里实现了 ≠ 上线了。除非有部署侧或数据库侧证据，
> 一律写「已实现」，不写「已上线」「学生每天在用」。上面每一条都附了
> 核实方式，照此办理。

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
- 用户说 **「判分 / 批今天的早测 / grade 早测 / 人工判分」** → `marker-dump.ts --json` 倒队列 → 在聊天里判 → 写 `.local/grades/<日>.json` → `marker-apply.ts --file` 写回并发布，**判完直接推，不再等「确认发布」**（2026-09-05 定稿，SOP 见 `docs/HANDOFF-TO-CLAUDE-2026-09-03.md` §7.2）；**绝不触发 AI grader / `regradeSession`（会调 Claude API）**。
- 新 PDF→fixture **必须过 10 项 AI 审计**（passage / stem / mark-scheme / schema / AI-grader 精确+改写+拒答 / UI 渲染）才能 push，无例外。
- **未经当前对话明确批准，不得 git push、部署或执行生产迁移**。
- 版权：past-paper 只存元数据（如 `9702/22/M/J/19/Q3`）不存原文；seed 题 `source_type=original_school`。

## 日常
早测（morning-quiz）考勤同步到 Seiue（`OL_MO_English` + `MO_English`）。

---
> 本仓库另有 auto-memory（约 12 个文件）会随本目录会话自动加载，含 M365 迁移 / 早测考勤 / ESIC 网站等更细的运维记忆。**始终用中文回答。**
