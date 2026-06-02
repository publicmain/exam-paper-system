# Exam Paper System（试卷生成系统）

国际课程学校（CIE / Edexcel / O-Level / IGCSE / A-Level）试卷生成：老师选科目 / 章节 / 时长 / 总分 / 题型配比 → 从打标签的题库抽题 → 可编辑试卷 → 导出 PDF + 答案卷。GitHub: `publicmain/exam-paper-system`。`docs/PRD` / `README.md` 为准。

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
- 版权：past-paper 只存元数据（如 `9702/22/M/J/19/Q3`）不存原文；seed 题 `source_type=original_school`。

## 日常
早测（morning-quiz）考勤同步到 Seiue（`OL_MO_English` + `MO_English`）。

---
> 本仓库另有 auto-memory（约 12 个文件）会随本目录会话自动加载，含 M365 迁移 / 早测考勤 / ESIC 网站等更细的运维记忆。**始终用中文回答。**
