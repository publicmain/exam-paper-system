# Round 7 上线前 audit — Agent 10：Production Readiness

仓库：`C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2`
分支：`claude/agitated-pasteur-ac58d2`
部署目标：Railway（API + Web + Postgres + pdf-worker 共 4 服务）

> 已知前提：Railway 已配置 `CORS_ORIGINS / JWT_SECRET / NODE_ENV / DATABASE_URL / ANTHROPIC_API_KEY`。

---

## TL;DR

- **总体打分：可上线但有显著缺口**。基础设施（健康检查 / Dockerfile / CORS / JWT 守门）做得不错，但
  **`.env.example` 至少缺 12 个 prod 行为开关、main.ts fail-fast 校验只覆盖 2 个 env、根本没有 prisma migrations 目录（用 `db push`）、没有 `/metrics` 与 request-id、没有 README 部署 / 回滚 SOP**。
- **必须上线前修**：
  1. main.ts 必须 fail-fast 校验 `MOCK_AUTH=false`、`SCHOOL_IP_BYPASS=false`、`MORNING_QUIZ_DEBUG=false`、`ALLOW_PROD_SEED!=true`、`SCHOOL_PUBLIC_IPS` 非空（在 prod NODE_ENV 下）。
  2. `.env.example` 补齐缺失项（详见 §A.1）。
  3. README 加 "紧急回滚 SOP" + Railway 回滚步骤。
- **可 WAIVE 但要显式记录**：DB 自动备份、prompt cache 已用、用 `db push` 而非 migrate（trade-off）。

---

## A. 环境变量审查

### A.1 `.env.example` 完整性

**实跑 `cat .env.example` stdout（已截）：**

```
# =====================================================================
# Exam Paper System — environment variables
# =====================================================================

DATABASE_URL=postgresql://exam:exam@localhost:5432/exam_paper_system?schema=public
API_PORT=4000
NODE_ENV=development
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d
CORS_ORIGINS=
VITE_API_URL=http://localhost:4000
ANTHROPIC_API_KEY=sk-ant-replace-with-your-real-key
ANTHROPIC_MODEL=claude-sonnet-4-6
STORAGE_DIR=./uploads
AI_IMAGE_STORAGE_PATH=
RENDER_STORAGE_PATH=
PDF_TIMEOUT_MS=30000
SCHOOL_PUBLIC_IPS=
SCHOOL_IP_BYPASS=false
SCHOOL_NAME=Demo School
MORNING_QUIZ_TZ_OFFSET_MIN=480
MORNING_QUIZ_DEBUG=false
MOCK_AUTH=false
ALLOW_PROD_SEED=false
```

**实跑 `grep -rE "process\.env\.[A-Z_]+" apps/api/src` 全量统计：80 处使用，34 个文件。**

**未在 .env.example 出现，但代码里读取的 env vars：**

| Env Var | 来源 | 严重度 |
|---|---|---|
| `ALLOWED_ORIGINS` | `main.ts:19`（`CORS_ORIGINS` 的 alias） | LOW（README 文档化即可） |
| `PORT` | `main.ts:77`（Railway 自动注入） | LOW |
| `ANTHROPIC_MONTHLY_USD_CAP` | `ai-question-generator.service.ts:238` | **HIGH** — 不设值就没月度封顶 |
| `OPENAI_API_KEY` | `openai-image.service.ts:74` | MED — 图像生成会静默 disable |
| `OPENAI_MONTHLY_USD_CAP` | `openai-image.service.ts:75` | HIGH |
| `OPENAI_IMAGE_MODEL` | `openai-image.service.ts:78` | LOW |
| `TUTOR_DAILY_USD_PER_STUDENT_CAP` | `ai-tutor.service.ts:63` | **HIGH** — 不设就无每生每日封顶 |
| `MORNING_QUIZ_AUTO_GENERATE` | `morning-quiz-weekly-cron.ts:39` | MED — 不设就不跑 |
| `MORNING_QUIZ_ABSENCE_ALERTS` | `absence-alert.cron.ts:21` | MED — 不设就不发 |
| `JUDGE0_URL` / `JUDGE0_USE_BATCH` / `JUDGE0_AUTH_TOKEN` / `JUDGE0_RAPIDAPI_KEY` / `JUDGE0_RAPIDAPI_HOST` / `JUDGE0_LANG_OVERRIDES` | `codegrader.service.ts:302-380` | MED — codegrader 会无声 stub |
| `INTERNAL_API_TOKEN` | `pdf-dispatcher.service.ts:42`、`internal-auth.guard.ts:29` | **HIGH** — 不设则 pdf-worker 回调链断 |
| `PDF_WORKER_URL` | `pdf-dispatcher.service.ts:40` | HIGH |
| `PUBLIC_API_URL` | `pdf-dispatcher.service.ts:41`（pdf-worker 回调用） | HIGH |
| `RAW_STORAGE_PATH` | `ingest.service.ts:38` | LOW |
| `SKIP_SYLLABUS_SEED` | `syllabus-seed.service.ts:55` | LOW |
| `TARGET_DATABASE_URL` / `SKIP_PAGES` | `migrate-9618-to-target.ts` 一次性脚本 | N/A |

**发现：**

- **HIGH 严重度** / 位置 `apps/api/src/ai/ai-question-generator.service.ts:238` 等 / 现象：`ANTHROPIC_MONTHLY_USD_CAP` / `OPENAI_MONTHLY_USD_CAP` / `TUTOR_DAILY_USD_PER_STUDENT_CAP` 在 `.env.example` 完全缺席；如果运维不知道这些变量，prod 就跑无 cap，恶意或 bug 在一夜烧掉数千刀。/ 修复：在 `.env.example` 补齐并写明默认 cap 推荐值（如月 $50，单日单生 $0.5）。

- **HIGH** / `pdf-dispatcher.service.ts` / pdf-worker 回调链至少需要 `INTERNAL_API_TOKEN` + `PDF_WORKER_URL` + `PUBLIC_API_URL` 三件套，全缺。如果 PDF 走 worker，会 silently 返回 stub 或断链。/ 修复：补 `.env.example` + 在 main.ts 中如果检测到 `PDF_WORKER_URL` 非空但其他两个为空时 fail-fast。

- **MED** / `codegrader.service.ts` / 6 个 JUDGE0 env 全缺，缺 URL 时静默 stub 无 cap。/ 修复：在 `.env.example` 加注释说明缺 URL = stub 模式。

### A.2 fail-fast 启动检查

`apps/api/src/main.ts` **只校验 2 项**：

```ts
// L25-30: prod 下 CORS_ORIGINS 缺失就 exit(1)
// L40-48: prod 下 JWT_SECRET 缺/默认就 exit(1)
```

**没校验**（prod 下应该全部 fail-fast 或 sanity-warn）：

| 应该校验的项 | 现状 | 风险 |
|---|---|---|
| `DATABASE_URL` | 不校验，让 Prisma 自己报错 | 启动时报错信息晦涩 |
| `ANTHROPIC_API_KEY` | 各 AI service 在构造时 `logger.warn` 后回 stub | prod 下 stub 模式静默运行（teacher 看不出来） |
| `MOCK_AUTH` | 不校验 | **高危** — prod 误设 `true` 后任何请求都会被赋 mock-teacher 身份 |
| `SCHOOL_IP_BYPASS` | 不校验 | **高危** — prod 误设 `true` 后 attendance/scan 完全公开 |
| `MORNING_QUIZ_DEBUG` | 不校验 | 高危 — prod 误设 `true` 后 `/sessions/:id/debug-activate` 可强制激活 |
| `ALLOW_PROD_SEED` | seed.ts 自检（`prisma/seed.ts:128`）但 main.ts 不查 | LOW（seed 不会自动跑） |
| `SCHOOL_PUBLIC_IPS` | guard 内部 fail-closed，但启动不报错 | MED — 静默 fail-closed 比启动 crash 更难发现 |
| `JWT_EXPIRES_IN` | `'7d'` 默认 | LOW |

**建议（伪代码）：**

```ts
if (process.env.NODE_ENV === 'production') {
  const fatal: string[] = [];
  if (!process.env.DATABASE_URL) fatal.push('DATABASE_URL');
  if (process.env.MOCK_AUTH === 'true') fatal.push('MOCK_AUTH=true forbidden in prod');
  if (process.env.SCHOOL_IP_BYPASS === 'true') fatal.push('SCHOOL_IP_BYPASS=true forbidden in prod');
  if (process.env.MORNING_QUIZ_DEBUG === 'true') fatal.push('MORNING_QUIZ_DEBUG=true forbidden in prod');
  if (process.env.ALLOW_PROD_SEED === 'true') fatal.push('ALLOW_PROD_SEED=true forbidden in prod');
  if (!process.env.SCHOOL_PUBLIC_IPS) fatal.push('SCHOOL_PUBLIC_IPS empty (every wifi-gated request will 403)');
  if (fatal.length) {
    bootstrapLogger.error('Refusing to start: ' + fatal.join('; '));
    process.exit(1);
  }
}
```

- **HIGH** / `apps/api/src/main.ts` / 关键安全开关无 fail-fast，运维一次错配就让整个 IP 网关 / mock 身份打开。/ 修复：把上面 5 条 boolean 开关接进 bootstrap 校验。

### A.3 `railway.json` / `Dockerfile` / start 脚本

**`railway.json` stdout：**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "apps/api/Dockerfile"
  },
  "deploy": {
    "startCommand": "sh -c 'npx prisma db push --accept-data-loss --skip-generate && node dist/main.js'",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

- **HIGH** / `railway.json:7` / 用 `prisma db push --accept-data-loss`，**不使用 migrations**。`apps/api/prisma/migrations/` 目录不存在。每次部署都把 schema 推到 DB；schema 改成不兼容（删字段、改类型）时会 **直接丢数据**，且无回滚轨迹。/ 修复：上线前生成 baseline migration（`prisma migrate dev --name baseline`），把 startCommand 改成 `prisma migrate deploy && node dist/main.js`。临时 WAIVE 也行，但要在 README 标红"DDL 改动必须人工审过 db push 结果"。

- LOW / `apps/api/Dockerfile:36` / `EXPOSE 4000` 是文档性的，Railway 用 `PORT` 注入。代码 `main.ts:77` `Number(process.env.API_PORT || process.env.PORT || 4000)` 处理正确。/ 不用改。

- LOW / `Dockerfile` 用 `node:20-bookworm-slim` + 系统 chromium，没固定 chromium 版本。Railway 重建时 chromium 版本可能漂移导致 PDF 渲染回归。/ 可 WAIVE。

- MED / `Dockerfile` runtime stage 没有 `HEALTHCHECK` 指令。Railway healthcheck 配了 `/api/health` 已经覆盖；本地 `docker run` 不会自动健康检查。/ 可 WAIVE。

---

## B. 日志与可观测性

### B.1 结构化日志

实跑 `grep -r "pino\|winston\|bunyan" .` → **0 命中**。
实跑 `grep -rc "new Logger(" apps/api/src` → 36 处用 NestJS 内置 `Logger`。

- MED / 全部 service / NestJS 默认 Logger 输出 **plain text 带颜色**，prod 容器日志里 ANSI 转义会污染日志聚合（Railway 的 Logs UI 没问题，但 export 到 Datadog/Loki 会麻烦）。/ 修复（可选）：接入 `nestjs-pino` 或在 `main.ts` `NestFactory.create` 时传 `logger: ['log', 'warn', 'error']` 关闭 verbose，并把 prod ANSI 关掉。

### B.2 sensitive data leak

实跑 `grep -rE "logger\.(log|info|warn|error).*(token|password|secret|apiKey)" -i apps/api/src`：

```
apps/api/src/ingest/pdf-dispatcher.service.ts:99:  this.logger.warn('INTERNAL_API_TOKEN not set — skipping dispatch');
apps/api/src/ai/ai.service.ts:36:  this.logger.warn('ANTHROPIC_API_KEY not configured — AI calls will return stub responses.');
```

两处都只是 log **变量名 / 状态**，不打 value，**安全**。

实跑 `grep -rE "console\.(log|info|warn|error)" apps/api/src` → 7 处 in 2 文件。其中 `audit.service.ts:40` 的 `console.error` 在 audit 失败时打 `event.action` 加 error，但 **不打 actor token / password**。安全。

- CLEAN — 没发现日志泄露 secret。

### B.3 request-id / trace-id

实跑 `grep -rEi "request[- ]?id|trace[- ]?id|x-request-id" apps/api/src` → **0 命中**。

- MED / 全局 / 没有 request-id middleware，故障排查时无法把同一请求的多条日志关联。Railway 自身没有 request-correlation。/ 修复：加一个 middleware 注入 `x-request-id`（如缺则用 `crypto.randomUUID()`），再在 NestJS Logger 上下文里把它带出来。可上线后第一周做。

### B.4 metrics 端点

实跑 `grep -r "/metrics" apps/api/src` → **0 命中**。

- MED / 全局 / 没有 `/metrics` Prometheus 端点。Railway 自带 CPU/Mem/Net 监控可用，业务 metrics（DB 连接池、puppeteer 实例数、AI 调用 QPS）暴露不出来。/ 修复（可选）：上线后再加 `prom-client`。/ WAIVE 一期可。

### B.5 `/health` 与 Railway healthcheck

`apps/api/src/health.controller.ts:1-12`：

```ts
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() { return { ok: true, ts: new Date().toISOString() }; }
}
```

- `setGlobalPrefix('api')` + `@Controller('health')` → 实际路径 `/api/health`。
- `@Public()` 装饰器（`apps/api/src/common/auth.guard.ts:6-7`）→ 跳过 AuthGuard，AuthGuard 里 `if (isPublic) return true`（L25）。
- railway.json `healthcheckPath: /api/health` 完全匹配。

- CLEAN — healthcheck 路径正确、不会被 auth 拦截、返回 200 + JSON。

但有个改进：

- LOW / `health.controller.ts:9` / 当前 health 只看 process 活着，**不验证 DB / Anthropic API 可达**。如果 DB 凭据失效，进程依然返回 ok=true，导致流量不被切走。/ 修复（可选）：加一个 `/api/health/deep` 跑 `prisma.$queryRaw\`SELECT 1\``。一期 WAIVE 可。

---

## C. 备份与运维

### C.1 DB 备份

- WAIVE / Railway managed Postgres 默认提供每日自动备份（Railway 文档），但仓库里**没有任何 export-to-S3 cron 或 pg_dump 脚本**。/ 必须在 Railway dashboard 手动确认 backup 已开启，并把"备份已开启"写进 launch checklist。

### C.2 secret 轮换流程

- HIGH / 全局 / 没有 secret 轮换文档。/ 现状：
  - **JWT_SECRET 轮换**：改 env → Railway 重启服务（约 30 秒）→ **所有 active session 立即失效**（已签的 JWT 验签失败）。可接受但要发公告。
  - **ANTHROPIC_API_KEY 轮换**：改 env → 重启 → 立即生效。无 session 影响。
  - **DATABASE_URL 轮换**：必须先创新库 → migrate → 改 env → 重启。
  / 修复：README 加 §"Secret 轮换 SOP"。

### C.3 回滚策略

- MED / 全局 / Railway 自带"Rollback to previous deploy"按钮可用（一键），但：
  - **DB schema 改动不可逆**（用 `db push --accept-data-loss`），rollback 应用代码不会 rollback schema。
  - 没有 prisma migrations 目录意味着**没有 down migration**。
  / 修复：上线前 snapshot DB（`pg_dump` 在 Railway 控制台手工触发一次），README 加"DDL 变更前必须 snapshot"。

---

## D. 成本监控

### D.1 Anthropic API

实跑 `grep -rEi "cache_control|prompt[ _-]?cach" apps/api/src`：

```
apps/api/src/ai-tutor/ai-tutor.service.ts:500   cache_control: { type: 'ephemeral' }
apps/api/src/ai/ai-question-generator.service.ts:945  cache_control: { type: 'ephemeral' }
apps/api/src/morning-quiz-qa/morning-quiz-qa.service.ts:247  cache_control: { type: 'ephemeral' }
apps/api/src/ai/ai.service.ts:92  cache_control: { type: 'ephemeral' }
```

- CLEAN — **prompt caching 全部 4 处大用量调用都用了**。

**每生成一份 paper 的 token 估算（参考 `ai-question-generator.service.ts`）：**
- 系统 prompt 含 few-shot 6 题 + 大纲，预估 input ~3-5k tokens（cache hit 后只算 1/10 价）。
- output 单题 ~500-1500 tokens × N。
- 默认 `count` 上限 10 题（L292 `Math.max(1, Math.min(input.count ?? 1, 10))`）。
- 单次 paper 大约 $0.05-0.20 sonnet-4-6 价位（粗估）。

**限流防 abuse：**
- `ai-tutor.service.ts:222-235`：per-student daily cap（cap=`TUTOR_DAILY_USD_PER_STUDENT_CAP`），有 429 返回。
- `ai-question-generator.service.ts:238`：`ANTHROPIC_MONTHLY_USD_CAP` 月度封顶（在 `monthToDateUsd()` 检查）。
- 都 ✅ 有，但 .env.example **没列出来**（见 §A.1）。

**daily/monthly 预算告警：**
- `apps/api/src/admin-cost/admin-cost.service.ts` 提供 `/admin-cost/summary` 端点，admin 可手动查。
- **没有自动告警**（webhook / email when X% of cap reached）。
- MED / 修复：上线后第一周加 wechat-notify 推送 daily 摘要（已有 `wechat-notify.service.ts` 基础设施）。/ 一期可 WAIVE。

### D.2 Railway 资源

- 仓库不能验证 replica 数 / scale-to-zero（在 Railway dashboard）。/ 写进 launch checklist。
- **puppeteer 内存峰值**：单次 PDF 渲染 ~150-300 MB。Railway 默认 512 MB 计划下，2 个并发 PDF 渲染可能 OOM。
- HIGH / `apps/api/src/pdf/pdf.service.ts` / 没有 puppeteer 实例数限流（每个请求开 new browser）。/ 修复：上线后视监控决定，或加一个简单 mutex 把 PDF 渲染串行化。/ 可 WAIVE 但要监控。

---

## E. 文档

### E.1 README.md

实跑 `cat README.md` 重点段：

- ✅ 本地开发 setup：完整（L9-56）
- ✅ 部署流程：有，Railway 三服务（L203-234）
- ❌ **没有紧急回滚 SOP** — README 完全没提 rollback。
- ❌ **没有 on-call 联系人**。
- ❌ **没有 secret 轮换**。
- ❌ **L33** "your Anthropic API key (already filled in)" — 这句话在 README 公开仓库里是**严重的事实错误**（`.env.example` 里是占位 `sk-ant-replace-with-your-real-key`，没有 key）。如果 README 给出现错误暗示，新人会以为 .env.example 有真 key 而去 commit `.env`。
- ❌ **L217** "The Dockerfile runs `prisma migrate deploy`" — **错误**，实际 startCommand 是 `prisma db push`（railway.json:7）。文档与现实脱节。

- **HIGH** / `README.md:33` 与 `:217` / 两处事实错误。/ 修复：删 L33 的"already filled in"，把 L217 改成"prisma db push（注意：DDL 不可逆，详见回滚 SOP）"。

### E.2 CLAUDE.md / 内部文档一致性

仓库根没有 `CLAUDE.md`。`docs/` 下有 `AI-QA-REVIEW.md`、`UI-QUESTION-TYPES.md`、`qa-reports/`。docs/qa-reports/round-7-pre-launch/ **空目录**（即本报告位置）。

- LOW / 全局 / 缺 RUNBOOK / on-call. / 修复：README 加一个"§ Operations"小节。

---

## 上线就绪 Checklist

| # | 项 | 状态 | 备注 |
|---|---|---|---|
| 1 | `.env.example` 列出所有代码读取的 env | **NO** | 缺 12+ 项（§A.1），上线前补 |
| 2 | main.ts fail-fast 校验 prod 关键 env | PARTIAL | 只校验 JWT_SECRET / CORS_ORIGINS。MOCK_AUTH/SCHOOL_IP_BYPASS/MORNING_QUIZ_DEBUG/ALLOW_PROD_SEED/SCHOOL_PUBLIC_IPS 必须加 |
| 3 | DATABASE_URL 启动校验 | NO | 让 Prisma 自报 — 错误信息晦涩 |
| 4 | JWT_SECRET 不是默认值 | YES | `main.ts:40-48` |
| 5 | CORS_ORIGINS 在 prod 必须显式 | YES | `main.ts:25-30` |
| 6 | trust proxy 已启用（识别真实 IP） | YES | `main.ts:69` |
| 7 | `/api/health` 公开、不被 AuthGuard 拦截 | YES | `health.controller.ts` + `auth.guard.ts:25` |
| 8 | Railway healthcheck 路径正确 | YES | `railway.json` `/api/health` 匹配 |
| 9 | DB 用 migrations 而非 db push | **NO** | `railway.json:7` 用 `db push --accept-data-loss`，无 migrations 目录。WAIVE 但需 README 标红 |
| 10 | Dockerfile multi-stage、prod 不含 devDeps | YES | `apps/api/Dockerfile` builder/runtime 拆分 |
| 11 | PORT 走 env 不硬编码 | YES | `main.ts:77` `process.env.API_PORT \|\| process.env.PORT \|\| 4000` |
| 12 | `.dockerignore` 排除 .env | YES | `.dockerignore:5-7` |
| 13 | 无日志 leak secret | YES | grep clean |
| 14 | 结构化日志（JSON） | NO | 用 NestJS 默认 plain Logger。WAIVE |
| 15 | request-id correlation | NO | WAIVE 一期 |
| 16 | `/metrics` Prometheus | NO | WAIVE 一期 |
| 17 | DB 自动备份 | UNVERIFIED | Railway dashboard 手工确认 |
| 18 | 回滚 SOP（README） | **NO** | 必加 |
| 19 | secret 轮换 SOP | **NO** | 必加 |
| 20 | Anthropic prompt caching | YES | 4/4 大调用都用了 |
| 21 | Anthropic 月度 USD cap | YES（代码） / NO（.env.example） | 代码里有 cap，但 env 没 doc，运维不知道要设 |
| 22 | OpenAI 月度 USD cap | YES（代码） / NO（.env.example） | 同上 |
| 23 | Tutor 单生每日 USD cap | YES（代码） / NO（.env.example） | 同上 |
| 24 | AI cost 自动告警 | NO | WAIVE 一期，第一周加 |
| 25 | Puppeteer 并发限流 | NO | WAIVE，监控到 OOM 再加 |
| 26 | README 部署流程准确 | **NO** | L33 + L217 两处事实错误必修 |
| 27 | RUNBOOK / on-call | NO | 必加（哪怕只是写个 "联系 X"） |
| 28 | seed.ts 防 prod 误跑 | YES | `seed.ts:128` 检查 `ALLOW_PROD_SEED` |
| 29 | IpAllowlist guard fail-closed | YES | `ip-allowlist.guard.ts:69-72,89-92` |
| 30 | unhandled rejection / uncaughtException 捕获 | YES | `main.ts:54-59` |

---

## 必修清单（上线前 must-fix）

按优先级：

1. **`apps/api/src/main.ts` 加 prod 安全开关 fail-fast**：MOCK_AUTH / SCHOOL_IP_BYPASS / MORNING_QUIZ_DEBUG / ALLOW_PROD_SEED 在 prod 任一为 `true` 就 `exit(1)`；SCHOOL_PUBLIC_IPS 为空则 `exit(1)`。（§A.2）
2. **补齐 `.env.example`**：至少把 `ANTHROPIC_MONTHLY_USD_CAP` / `OPENAI_MONTHLY_USD_CAP` / `TUTOR_DAILY_USD_PER_STUDENT_CAP` / `INTERNAL_API_TOKEN` / `PDF_WORKER_URL` / `PUBLIC_API_URL` 加进去并写明默认推荐值。（§A.1）
3. **修 README 两处事实错误**：L33 删 "already filled in"；L217 把 `prisma migrate deploy` 改成实际命令。（§E.1）
4. **README 加 §Operations**：紧急回滚步骤（Railway dashboard rollback + DB snapshot 提示）、secret 轮换 SOP、on-call 联系人。（§C.2 §C.3 §E.1）
5. **launch checklist 写进 README**：Railway 自动备份已开启 / replica 数 / 内存配额 / DDL 变更前 pg_dump。（§C.1 §D.2）

## 强烈建议（上线后第一周）

- 加 request-id middleware（§B.3）
- 接入 nestjs-pino 输出 JSON 日志（§B.1）
- AI cost 日报推 wechat（§D.1）
- 生成 prisma migrations baseline 并切到 `migrate deploy`（§A.3 §C.3）
- `/api/health/deep` 加 DB ping（§B.5）

## 可 WAIVE（记录后接受）

- `/metrics` Prometheus 端点
- Puppeteer 并发限流
- AI 自动告警 webhook

---

报告完。
