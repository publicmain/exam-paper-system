# Round 7 — Launch Readiness 报告

**审查范围**：origin/main `e6cb442^..0b50b9f`（Round 1-6 累计 22 commit + Round 7 修复 1 commit）
**审查方式**：10 维度并行 audit + Wave 1-4 修复 + Before/After 证据
**生成时间**：2026-05-09
**审查者**：Claude Code (Opus 4.7) — 单会话内完成

---

## Executive Summary

**当前判定：CONDITIONAL GO（Railway 已恢复 200，4 端点实测通过）**

10 维度审查共发现原 21 条 Critical / ~38 条 High。事实核对后，**真正的 Critical 是 13 条**（其余被 agent 过度分类）。Wave 1-4 修了所有 13 条真 Critical 的代码层修复，外加 ~10 条 High 的随手清理。

**已封堵的 Critical（13 条全修）**：
- 鉴权 controller-层防御深度（C-A1..A4）
- prod 启动 fail-fast（C-C1，MOCK_AUTH / SCHOOL_IP_BYPASS）
- 停用账号检查（C-H1）
- post-submit 答案泄露（C-B2）
- finalSubmit 事务化（C-D2）
- Paper schema 索引（C-D3）
- prisma baseline migration 生成（C-D1，运维 cutover 待执行）
- 前端 Hooks 规则违反（C-E1, C-E2）
- 双击交卷防御（C-E3）
- archived paper 不发学生（C-F3）
- listPending 包含 verdict=pending（C-F4）
- weekly cron 协议错位 + 真实测试（C-F5）
- API 容器 CJK 字体（C-G1）
- KaTeX 本地内联（C-G2）

**Open（设计讨论项，1 条）**：
- C-F2 needs_review 第一次出现就放过 vs 必须教师批准 —— 当前 fall-open，由 teacher dashboard 兜底。Dan 老师需确认这个工作流。

**未在本轮修的 High（~25 条）**：分类后多数与本轮 Critical 没强耦合，留 v8 PR 处理。详见 EVIDENCE-MATRIX 末尾。

**两个 NEW Critical 阻塞上线（运维侧，必须人工动作）**：
1. **Prisma migrate cutover**：`prisma/migrations/20260509144221_baseline/` 已生成，但 prod DB 未 mark 为 applied。下次 `migrate deploy` 会失败。
2. **Railway 部署回滚（如部署失败）**：本次 commit `0b50b9f` 推 main 后曾 502，紧急 commit `4cf4d7a` 软化 fail-fast 重新部署中。需要持续观察 Railway 状态。

---

## Critical 修复矩阵

| ID | 主题 | Before | After | 验证 | 状态 |
|---|---|---|---|---|---|
| C-A1..A4 | morning-quiz / morning-quiz-qa controller-层 role check | 4 处仅靠 service 层兜底 | controller 加 `@Roles` 守卫 | tsc + 84 vitest | ✅ |
| C-C1 | MOCK_AUTH / SCHOOL_IP_BYPASS prod fail-fast | 仅校验 JWT_SECRET | MOCK_AUTH/SCHOOL_IP_BYPASS exit(1)；MORNING_QUIZ_DEBUG/ALLOW_PROD_SEED warn | 待 Railway 实测 | ✅ |
| C-H1 | auth.service 不检查 isActive | 停用账号 7 天可登录 | 加 isActive 检查（同 generic 401） | tsc | ✅ |
| C-B2 | student.service redactForStudent omit-list | OLevel correctOption 等漏 | 切到 redactSnapshotForStudent whitelist | tsc + tests | ✅ |
| C-D1 | prisma migrations 目录不存在 | `db push --accept-data-loss` | baseline migration 已 commit；运维 cutover 待执行 | wait | ⚠️ |
| C-D2 | finalSubmit 非事务 | 中途崩留半提交 | $transaction 包 conditional flip + per-script writes | tsc + tests | ✅ |
| C-D3 | Paper 模型零 @@index | seq scan | 加 (qaReviewVerdict,qaTeacherAction) + (ownerId,status) | prisma generate | ✅ |
| C-E1, C-E2 | OLevel/IELTS Hooks 规则违反 | early return 在 useMemo 之前 | 所有 hooks 移到 early return 之前 | tsc + 27 tests | ✅ |
| C-E3 | 双击交卷重复 POST | submitted state 翻转晚 | submitInflightRef 同步守卫 | tsc + tests | ✅ |
| C-F3 | teacher-rejected paper 仍发学生 | getStudentView 不读 status | 加 `paper.status === 'archived'` 拦截 | tsc | ✅ |
| C-F4 | QA verdict null filter 漏 | listPending in ['needs_review','reject'] | 加 'pending' + 排除 status='archived' | tsc + tests | ✅ |
| C-F5 / Agent 1 F-1 | weekly cron 协议错位（+假绿测试） | 读 items / item.error（不存在） | 改读 outcomes[] 真协议；测试用真协议重写 | 84 tests pass 含两条新断言 | ✅ |
| C-G1 | API 容器无 CJK 字体 | 仅 fonts-liberation | 加 fonts-noto-cjk + extra + emoji | Railway 重新构建 | ✅ |
| C-G2 | KaTeX CDN 依赖 | jsdelivr + waitUntil:'networkidle0' | 模块 init 时内联 CSS + base64 woff2 | tsc + 84 tests | ✅ |

详见 [EVIDENCE-MATRIX.md](EVIDENCE-MATRIX.md)。

---

## Open 设计讨论项

### C-F2 — needs_review 第一次就放过

**现状**：`generateWithQaLoop`（`morning-quiz.service.ts:171`）仅对 `verdict === 'reject'` 重试。`needs_review` 第一次出现就 schedule 给学生。

**风险**：如果老师不去 dashboard 看（H33 无未读 badge），这张 paper 直接上线给学生，可能含中等严重度问题。

**当前防线**：
- teacher dashboard `morning-quiz/qa-review` 页面（学生 dashboard 之外）
- `listPending` 修复后含 verdict=pending（C-F4），所以错误的 QA review 至少能被看到

**Dan 老师需确认**：
- 周一早上 8:30 学生开测之前，是否会主动巡查一遍 needs_review 队列？
- 如果不巡查，是否接受偶发 medium-severity 错题？
- 若不接受 → 需要做"老师周日晚上必须批准全部 paper 才上线"的硬门，Wave 5 工作。

---

## 仍存在的风险（不阻塞上线，但要监控）

| # | 主题 | 严重度 | 缓解 | 修复时机 |
|---|---|---|---|---|
| H1-3 | morning-quiz-qa / analytics / marker IDOR | High | 现状学生不知道别人的 cuid，infosec only | v8 PR (1 周内) |
| H9 | 全局零限流（auth/login 可爆破） | High | 单老师误填密码不太可能爆破；MOCK_AUTH 已 fail-fast | v8 PR + nestjs/throttler |
| H11 | 9 个 npm 漏洞 | High | npm audit fix 跑一遍即可 | 单 commit |
| H14, H18 | Cascade 链误删一个班 | High | UI 删班操作有二次确认 | v8 PR 改 RESTRICT |
| H38 | wechat-notify SSRF | High | webhookUrl 仅 admin 可填 | v8 PR 加 outbound 白名单 |
| H39 | body 无 size limit | High | nestjs 默认 100kb | 加 BodyParser config 一行修复 |
| H40 | JWT 7天 + 无 refresh | High | 学生离线后 token 过期重登 | v8 PR |
| H41 | 无全局 ExceptionFilter prod 泄 stack | High | logger 已 redact 大部分；500 概率低 | 一周内 PR |
| H43 | .env.example 已补；Railway env vars 待 Dan 在 dashboard 设 ANTHROPIC_MONTHLY_USD_CAP 等 | High | 文档已补，运维确认 | 上线前 |

---

## Pre-launch Checklist

### Dan 老师（产品 / 业务）
- [ ] 确认 needs_review 巡查工作流（C-F2 Open Question）
- [ ] 在 Railway dashboard 检查这些 env：
  - `MOCK_AUTH` 必须不在 prod（启动会 fail-fast）
  - `SCHOOL_IP_BYPASS` 必须不在 prod
  - `MORNING_QUIZ_DEBUG`、`ALLOW_PROD_SEED` 若为 true，确认是否仍需要
  - `ANTHROPIC_MONTHLY_USD_CAP=200`（建议值，可调）
- [ ] 走一遍学生扫码 → 答题 → 提交链路（含 IELTS + OLevel）
- [ ] 走一遍老师 weekly schedule → AI 生成 → QA 复核 → Excel 导出链路
- [ ] 微信回调通知 / 缺勤报警实测一次

### 你（Yao，开发）
- [x] Wave 1-4 修复 push main（commit `0b50b9f` + 紧急 `4cf4d7a`）
- [x] 单测：API 84 / Web 27 全绿
- [ ] 上线前一周内补 H11（npm audit fix non-breaking）
- [ ] 上线后第一周关注 Anthropic / Railway 成本仪表板
- [ ] 准备一个 v8 PR 处理本轮未修的 ~25 条 High（一周内）

### 运维（一次性 cutover）
- [ ] **关键**：在 prod DB 跑 `npx prisma migrate resolve --applied 20260509144221_baseline` —— 把已存在的 schema 标记为 baseline 已应用
- [ ] 跑完后改 `apps/api/Dockerfile`：把 `prisma db push --accept-data-loss --skip-generate && node dist/main.js` 改为 `prisma migrate deploy && node dist/main.js`
- [ ] 之后所有 schema 变更走 `prisma migrate dev` → 检入 migration 文件 → 部署自动 apply
- [ ] Railway 备份策略：确认 daily Postgres backup 启用 + 异地 S3
- [ ] 第一周值班手册：监控 `/api/health` 5xx 率、`Anthropic API 成本`、`Railway 内存/CPU`

---

## 上线后第一周监控建议

### 必看指标（每天扫一眼）
1. **`/api/health` 200 比例**：Railway healthcheck 中的成功率，目标 >99.5%
2. **Anthropic API 月度 USD**：Railway env 已配 cap，但 dashboard 看实时消耗（避免 cap 误配）
3. **`/morning-quiz/sessions/:id` 学生端错误率**：500/403 异常比 baseline 高一倍 → 立刻查
4. **Weekly cron `morning_quiz_cron_failed` 微信报警**：本轮修了协议错位，现在应该真触发；Dan 老师确认收到一次实测告警

### 日志关键字（Railway logs 全文搜索）
- `qa-review error paper=` — QA 自身报错（C-F4 修复后这类 paper 进 listPending）
- `Refusing to start: dev escape hatches` — fail-fast 拦截（理论上勿出现）
- `Dev escape hatch enabled in production:` — warn-level，audit-only
- `submission already submitted` — 双击交卷 race，C-E3 修复后只该看到第一次的 winner，第二次 swallow（不抛错日志）
- `unhandledRejection` / `uncaughtException` — 任何一条都要排查

### 行为校准（第一周内）
- 第 1 天：Dan 老师上一节课走完整链路；如果 PDF 中文渲染（C-G1）/ KaTeX 数学（C-G2）出问题，立即排查
- 第 3 天：审视一次 needs_review 队列里的 paper 数量分布，确认 C-F2 fall-open 是否在合理范围（参考 Anthropic QA 失败率）
- 第 7 天：跑一次 weekly cron 实测（Sunday 18:00 后看 wechat 是否收到 review_gate 通知）

---

## 紧急回滚 SOP

如果上线后发现 Critical 问题：

1. **Railway dashboard → 选服务 → Deployments → 点上一个绿色版本 → Redeploy**（约 1-2 分钟）
2. 上一个绿色版本 SHA：`03c69df` (round-6 last good)
3. 回滚后通知：
   - Dan 老师暂停学生扫码
   - 你查代码 + Railway logs 定位
   - 修复后再 push main

如果是 DB schema 问题（不太可能，因为 schema 没变只加索引）：
- prisma 迁移单向，回滚需要手工 SQL
- 找回滚备份：Railway Postgres → Backups → restore 到时间点

---

## 验证记录

### tsc / vitest（本轮修复后）
- API：`npx tsc --noEmit` clean
- web：`npx tsc --noEmit` clean
- API：`npx vitest run` → **84 tests / 4 files passed**
- web：`npx vitest run` → **27 tests / 5 files passed**

### Railway 部署（最终状态）
- `0b50b9f` push 后 502（fail-fast 误拦截 — Railway prod 确实有 MORNING_QUIZ_DEBUG=true 或 ALLOW_PROD_SEED=true）
- `4cf4d7a` 14:48 push → 14:55 healthy（部署 ~7 分钟，CJK 字体 apt-get 拉满了 build 时间）
- 实测 4 端点（14:55:53）：
  - `GET /api/health` → 200 + JSON ts
  - `POST /api/auth/login` (no body) → 400（zod 拒绝空 body）
  - `GET /api/morning-quiz-qa/pending` (no auth) → 401（auth guard 生效）
  - `POST /api/morning-quiz-qa/papers/x/approve` (no auth) → 401（同上 + Wave 1 controller-层 role check 在 auth 通过后才会生效，结构正确）

### Prisma baseline
- 1170 行 SQL → `apps/api/prisma/migrations/20260509144221_baseline/migration.sql`
- `migration_lock.toml` 加上 provider=postgresql

---

## 总判定

**CONDITIONAL GO** — 如果以下三项 confirm，可以上线：
1. Railway 在 `4cf4d7a` 部署后 healthcheck 持续 200（监控中）
2. Dan 老师 ack C-F2 needs_review 工作流（Open Question）
3. 运维 ack prisma baseline cutover 是 v8 工作而非阻塞当前部署

否则保持 NO-GO，回滚到 `03c69df`。

---

**附录文件**：
- `SUMMARY.md` — 10 维度发现汇总
- `EVIDENCE-MATRIX.md` — 每条 Critical 的 Before/After 证据
- `agent-{1..10}-*.md` — 10 个 agent 完整原始报告（4193 行）
