# Round 7 上线前 audit — Agent 9 报告

范围:**错误处理 / 安全 / 边界**。
仓库工作树:`C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2`
日期:2026-05-09。

---

## 0. npm audit 真实输出(强制)

### 0.1 `apps/api`(`npm audit --omit=dev`)

```
# npm audit report

@nestjs/core  <=11.1.17
Severity: moderate
Depends on vulnerable versions of @nestjs/platform-express
@nestjs/core Improperly Neutralizes Special Elements in Output Used by a Downstream Component ('Injection') - https://github.com/advisories/GHSA-36xv-jgw5-4q75
fix available via `npm audit fix --force`
Will install @nestjs/core@11.1.19, which is a breaking change
node_modules/@nestjs/core
  @nestjs/platform-express  <=11.1.14 || >=12.0.0-alpha.0
  Depends on vulnerable versions of @nestjs/core
  Depends on vulnerable versions of multer
  node_modules/@nestjs/platform-express

basic-ftp  <=5.3.0
Severity: high
basic-ftp allows a malicious FTP server to cause client-side denial of service via unbounded multiline control response buffering - https://github.com/advisories/GHSA-rpmf-866q-6p89
fix available via `npm audit fix`
node_modules/basic-ftp

file-type  13.0.0 - 21.3.1
Severity: moderate
file-type affected by infinite loop in ASF parser on malformed input with zero-size sub-header - https://github.com/advisories/GHSA-5v7r-6r5c-r473
file-type: ZIP Decompression Bomb DoS via [Content_Types].xml entry - https://github.com/advisories/GHSA-j47w-4g3g-c36v
fix available via `npm audit fix`
node_modules/file-type
  @nestjs/common  10.4.16 - 10.4.22 || 11.0.16 - 11.1.16 || >=12.0.0-alpha.0
  Depends on vulnerable versions of file-type
  node_modules/@nestjs/common

ip-address  <=10.1.0
Severity: moderate
ip-address has XSS in Address6 HTML-emitting methods - https://github.com/advisories/GHSA-v2v4-37r5-5v8g
fix available via `npm audit fix`
node_modules/ip-address

lodash  <=4.17.23
Severity: high
Lodash has Prototype Pollution Vulnerability in `_.unset` and `_.omit` functions - https://github.com/advisories/GHSA-xxjr-mmjv-4gpg
lodash vulnerable to Code Injection via `_.template` imports key names - https://github.com/advisories/GHSA-r5fr-rjxr-66jc
lodash vulnerable to Prototype Pollution via array path bypass in `_.unset` and `_.omit` - https://github.com/advisories/GHSA-f23m-r3pf-42rh
fix available via `npm audit fix --force`
Will install @nestjs/config@4.0.4, which is a breaking change
node_modules/@nestjs/config/node_modules/lodash
  @nestjs/config  1.1.6 - 4.0.2
  Depends on vulnerable versions of lodash
  node_modules/@nestjs/config

multer  <=2.1.0
Severity: high
Multer vulnerable to Denial of Service via incomplete cleanup - https://github.com/advisories/GHSA-xf7r-hgr6-v32p
Multer vulnerable to Denial of Service via resource exhaustion - https://github.com/advisories/GHSA-v52c-386h-88mc
Multer Vulnerable to Denial of Service via Uncontrolled Recursion - https://github.com/advisories/GHSA-5528-5vmv-3xc2
fix available via `npm audit fix --force`
Will install @nestjs/platform-express@11.1.19, which is a breaking change
node_modules/multer

9 vulnerabilities (5 moderate, 4 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force
```

### 0.2 `apps/web`(`npm audit --omit=dev`)

```
found 0 vulnerabilities
```

> apps/api 还停在 NestJS 10.x。Nest 10 全系列已 EOL,后续无安全修复 — 见 SEC-08。

---

## A 错误处理与异常路径

### A1【高】NestJS 没有全局 ExceptionFilter,prod 会泄露 stack/Prisma 内部信息

- **位置**:`apps/api/src/main.ts`(整个文件 82 行,无 `useGlobalFilters` 调用);`apps/api/src/app.module.ts`(无 `APP_FILTER` provider)。
- **现象**:任何未被 `try/catch` 接住的异常(Prisma `P2002` / `P2025`、`TypeError: Cannot read properties of undefined`、连接池耗尽等)直接由 Nest 默认 BaseExceptionFilter 序列化为 500,响应 body 在 prod 也会带上 message + stack(取决于 NODE_ENV,不可靠)。
- **场景**:学生扫码时打错 `studentId`,Prisma 抛 `P2025`,响应包里包含表名 / 列名,攻击者据此倒推 schema。
- **修复**:写一个 `AllExceptionsFilter`,在 `NODE_ENV==='production'` 时只回 `{ statusCode, code }`;非 prod 才带 stack。`app.useGlobalFilters(new AllExceptionsFilter(logger))`。同时屏蔽 `error.stack`、Prisma `code/meta` 字段。

### A2【中】`audit.log` 失败用 `console.error` 直接打印整个事件 + diff

- **位置**:`apps/api/src/audit/audit.service.ts:38-41`。
  ```ts
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to persist event', event.action, e);
  }
  ```
- **现象**:`event.diff` / `event.metadata` 经常包含**手机号、姓名、答案 JSON、wechat webhook URL** 等;`event.action` 包含 `attendance.scan` 时 metadata 里有 paperId、ip。Audit 自己挂掉(DB 慢、磁盘满)就把这些塞进 stdout 里。生产 stdout 通常进了集中日志,这就形成 PII 二次暴露。
- **场景**:DB 连接池耗尽 → 每条请求 audit 失败 → console 反复打印学生名 / 答案到 Railway log。
- **修复**:打到 Logger 而不是 console;只 log `action + entityType + entityId + 错误码`,**不要**打印 diff/metadata。也可以写本地落盘的 dead-letter file 让运维隔天补录。

### A3【高】`StudentService.finalSubmit` 没有 `$transaction`,race winner 可能"半提交"

- **位置**:`apps/api/src/student/student.service.ts:189-231`。先做条件 `updateMany`(claim row),然后**在事务外**循环 `answerScript.update`(L223-228)。
- **现象**:winner claim 成功后,中间 DB 抖一下任意一条 `answerScript.update` 抛异常,submission 已经是 `submitted` 了,但 `awardedMarks` / `autoCorrect` 只写了一半 → totalScore 偏低、无法重试。对比 `morning-quiz.cron.ts:87-145` 里的 `lockOne` 用了 `$transaction` 包裹,是对的。
- **场景**:学生 8:59:50 点交卷 →winner;DB 对应那一秒抖动 → 12 题里只有 5 题写完 → 学生看分数 5/12 实际答对 11/12。
- **修复**:整段(claim + autoGrade write-back)放进 `prisma.$transaction(async (tx) => { ... })`。和 cron 的 `lockOne` 保持完全一致。

### A4【中】QA review 没有事务,verdict + paper 状态可能不一致

- **位置**:`apps/api/src/morning-quiz/morning-quiz.service.ts:160-205` `generateWithQaLoop`。
- **现象**:
  1. `qaReview.reviewPaper` 写入 verdict + tokens + cost(L288-299 update)。
  2. 紧接着 service 自己 `paper.update({ data: { qaReviewRetries: attempt } })`(L167-170)。
  3. reject 时再 `paper.update({ status: 'archived' })`(L177-180)。
  这三个 update 不在事务里。reject 路径里第二个 update 挂了,paper 既不是 archived 也不是 retry — 进入孤立态,batch outer try/catch 会忽略它。
- **场景**:DB 网络抖动导致 archive 没写下去,papers 表里 `status='draft'` 但 verdict='reject';下个 cron tick 看见 draft 直接给学生用了。
- **修复**:`generateWithQaLoop` 一个 attempt 内的所有 paper.update 包到一个 `$transaction` 里;或者至少在 reject 分支里 `update({ data: { status: 'archived', qaReviewRetries: attempt } })` 一次写完。

### A5【中】学生答案 autosave 没指数退避,只靠 `online` 事件 replay

- **位置**:`apps/web/src/components/exam/ExamContext.tsx:171-236`。
- **现象**:`persistOne` 失败 → `dirtyRef` 留着,等 `window.online` 才再次触发 `flushPendingSavesRef.current()`。但是:
  1. Wi-Fi 没断,只是后端 503/408,浏览器**不会**触发 `online` 事件,这条答案就一直静默 dirty 直到学生再点选项 / 提交。
  2. 没有任何指数退避或定时重试 — 学生看到 `saveError` 红条但答案不会自动重发。
  3. 没有 timeout — `fetch` 默认无 timeout,卡住的请求会无限挂。
- **场景**:iPad WiFi 断了 30 秒(没断 socket,只是丢包) → 写最后两题时 fetch 全 timeout,但浏览器始终是"online" → 30 秒后网络恢复,这两题永远不重发。
- **修复**:加显式 timeout(`AbortController` 8s) + 失败队列指数退避(1s, 2s, 4s, 8s, capped 30s)定时器扫 dirtyRef;同时在 `saveError !== null` 时把 banner 改成红色 + 拒绝学生点 submit 按钮,避免学生在认为已保存的状态下交卷。

### A6【中】`MorningQuizCron.lockOne` 没有 `for update`,跨进程多实例可能双重写

- **位置**:`apps/api/src/morning-quiz/morning-quiz.cron.ts:86-150`。
- **现象**:cron 每分钟跑一次。`updateMany ... data: { status: locked }` 是幂等的,但中间的 `findMany inProgress` + 逐个 `updateMany('submitted')` 在两个 worker 同时跑时:
  - Worker A 看到 sub#42 状态 in_progress,准备 force-submit。
  - Worker B 同时看到 sub#42 状态 in_progress。
  - A 先 updateMany 成功(count=1),A 再去更新 answerScript。
  - B 的 updateMany count=0(被 A 抢走),B 的 if (claim.count === 1 && ...) 跳过 → OK。
  
  这点 race-safe 还行。但 `attendance.createMany skipDuplicates` 跨实例会两个都通过 unique 校验同时提交,Postgres 会让晚到的报错。整段 `$transaction` 里抛的话,A 已经提交的 force-submit 会**回滚**(submission 又变回 in_progress),下个 tick 重做但 createdAt 已经是在 quiz 后了 → 时间戳乱。
- **场景**:Railway 多实例部署 + 一个实例的 cron 没禁用,两个 cron 同时 9:00 触发。
- **修复**:
  1. cron 加 advisory lock:`SELECT pg_try_advisory_lock(hash('morning-quiz-cron'))`,只有抢到的进程才执行;否则跳过。
  2. 或者用 `@nestjs/schedule` 提供的 `SchedulerRegistry` 配合 Redis lock。
  3. 更便宜的方案:Railway 上把 API instances 设为 `replicas=1`(运维确认)。

### A7【中】QA 重试链 + retry_exhausted 后没有阻止 paper 上线

- **位置**:`apps/api/src/morning-quiz/morning-quiz.service.ts:194-205`。
- **现象**:`retry_exhausted` 时只写了一条 audit log,然后**返回 lastPaperId**(L204);上层 `batchGenerateForWeek` 接着 `createSession({ paperId })` 把这张未通过审核的卷子直接接到 session 上(L436-439)。配合 cron 8:30 把 session 翻成 active,学生就能看到。
- **场景**:Sunday-night cron 自动跑 → 3 次 reject(同一段题永远过不了)→ 兜底直接给学生(代码里再没人手动 review)。`qaTeacherAction=null && qaReviewVerdict='reject'` 的 paper 应该被拦,但目前 `getStudentView` / `attendance.scanQr` / `lockOne` 都不检查 `qaReviewVerdict` 字段。
- **修复**:`generateWithQaLoop` 在 retry-exhausted 分支返回 null 或抛 `BadGenError`,`batchGenerateForWeek` 把这条记成 `failed: 'qa_retry_exhausted'`,**不**调用 `createSession`;Sunday cron 在 wechat-notify 里加一条 "本周有 N 张卷子审核未过 — 老师手动顶上"。同时在 `getStudentView` 入口校验 `qaReviewVerdict !== 'reject' || qaTeacherAction === 'approved'`,作为兜底。

### A8【低】QA reject 是否终态 — 老师可 unreject

- **位置**:`apps/api/src/morning-quiz-qa/morning-quiz-qa.service.ts:587-610` `rejectByTeacher`(写 `status='archived'` + `qaTeacherAction='rejected'`)。
- **现象**:`approve` / `rejectByTeacher` 都对 `qaTeacherAction` 字段写值,**没**做幂等检查。一张已经 `rejected` 的卷子,老师再点 approve,可以把 `qaTeacherAction='approved'` 但 `status` 仍然 `archived`(approve 路径没改 status 回 draft)。这虽然不影响学生(archived 不会被 attendance 流捡到),但是审计困惑 — paper 同时被批准又被归档。
- **修复**:approve 检查 `if (current.qaTeacherAction === 'rejected') throw ConflictException`;或者 approve 主动 `status: 'draft'` 反向覆盖。我的建议是:reject 后想救活,要走 admin endpoint(单独审计),不要让 approve 静悄悄破坏档案状态。

### A9【低】wechat-notify cron 失败兜底依赖自身 — `notify.fire` 挂掉就丢

- **位置**:`apps/api/src/morning-quiz/morning-quiz-weekly-cron.ts:108-120`、`absence-alert.cron.ts:25-32`。
- **现象**:Sunday cron 失败时调 `notify.fire('morning_quiz_cron_failed', ...)` — 但这个 `fire` 自己会调 `prisma.notificationConfig.findMany`、`prisma.notificationLog.create`,DB 挂的话两路都挂,通知就丢了。`absence-alert.cron` 干脆只 `logger.error`,**没有任何外发**。
- **修复**:cron 失败再加一条**带外**告警(stdout JSON 一条 `level=fatal kind=cron-failed`,运维端 Loki/Datadog 报警);或者在 `notify.fire` 失败时本地落盘 `notification-deadletter.log`,有第二个进程消费。`absence-alert.cron` 应该和 weekly 一样调 fire。

### A10【中】`exec(` / `child_process` 唯一调用是 `git clone`,但 url 没强校验

- **位置**:`apps/api/src/ingest/ingest.service.ts:476-491`(`gitClone`),`apps/api/src/sources/sources.service.ts:48` 校验 `^https?://(www\.)?github\.com/...`。
- **现象**:校验只在创建 `SourceRepository` 时跑(`AddSource`);但 admin 之后通过 `prisma update` 直改 url 可以绕过。`spawn('git', ['clone', '--depth', '1', '--single-branch', url, dest])` 没用 shell,所以**不会 shell-injection**。但 git 接受 `--upload-pack=command` 风格的选项注入 — 因为 `url` 在 argv 第 5 位,前面已固定 `--depth 1 --single-branch`,所以 `--upload-pack` 不会被解析。**风险偏低**,主要在于将来如果有人加了 `git fetch` 等等。
- **修复**:在 `gitClone` 入口再加一次 `if (!/^https:\/\/[\w.-]+\//.test(url)) throw`(只允许 https / 不允许 `-` 开头),把校验从 controller 抬到 worker 入口。

---

## B 安全 OWASP Top 10

### SEC-01【严重】A02/A07 — `AuthService.login` 不检查 `User.isActive`

- **位置**:`apps/api/src/auth/auth.service.ts:10-23`(整段没引用 `isActive`)。Schema `apps/api/prisma/schema.prisma:30` 注释明确写 "AuthService login should reject when isActive=false"。代码没实现。
- **现象**:admin 在 `/admin-rbac` 把一个老师停用 → 老师下次 login 仍然返回 token + 7 天 expiry。停用功能形同虚设。
- **场景**:解雇的老师,IT 在面板里点 "deactivate",离职老师当晚还能进系统拉成绩单。
- **修复**:
  ```ts
  if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
  ```
  顺便:即使 token 还活着,`AuthGuard` 解码后应再 `prisma.user.findUnique({ id, isActive: true })` 校验,否则 7 天 JWT 期内学生退学/老师停用不能立即生效。
  ➕ 加 token revocation 表或者把 JWT 短化(1h)+ 加 refresh 流程。当前是 7 天硬过期,见 SEC-04。

### SEC-02【高】A04/A10 — wechat-notify webhookUrl 是用户可控的 outbound,无 SSRF 防护

- **位置**:`apps/api/src/wechat-notify/dto.ts:21-25` 只校验 `z.string().min(1)`;`wechat-notify.service.ts:144-200` 直接 `fetch(url, ...)`。
- **现象**:admin 角色可以把 webhookUrl 设为 `http://127.0.0.1:6379/RPUSH%20key%20val`、`http://169.254.169.254/latest/meta-data/`、`file:///etc/passwd`(虽 fetch 不支持 file 但 `http://localhost:5432` 能打 PG)。Container 内能访问的内网服务全部暴露。POST + 任意 JSON body 在 Redis / memcached 上能造成 CRLF 注入(经典 SSRF→Redis RCE)。
- **场景**:被拿下的 admin(或 SQL injection 后写 NotificationConfig)→ 一次性 RCE。
- **修复**:
  1. 强 schema:`z.string().url().refine(u => /^https:\/\/(qyapi\.weixin\.qq\.com|oapi\.dingtalk\.com)\//.test(u))` —— 白名单域名,拒绝其他。
  2. dispatch 前 DNS 解析,丢弃私有段 / loopback / link-local(`10/8`、`172.16/12`、`192.168/16`、`127/8`、`169.254/16`、`::1`、`fc00::/7`)。
  3. Strip URL credentials(`http://user:pass@evil.com`)避免上游凭据泄露。
  4. fetch 显式禁 redirects 或限制 redirect 后再做一次同样的 IP/domain 校验。
- 当前 `noop://` 前缀逻辑是好的,问题在非-noop 分支不限。

### SEC-03【高】A05 — body 没 size limit,`textAnswer` max 20000 字符不等于 max 20KB request body

- **位置**:`apps/api/src/main.ts` 没设 `app.use(express.json({ limit: '...' }))`;controller schema(如 `SaveAnswerSchema` 仅校 `textAnswer.max(20000)`)只在解析后限。
- **现象**:Nest/Express 默认 body limit 是 100KB,但是没显式锁。攻击者发 50MB JSON,parser 全吞下,内存峰值打满才发现 zod reject。配合 multer(已知 multiple DoS CVE,见 SEC-08)和 50 个学生同时扫码,一秒就能耗完 Node heap。
- **场景**:恶意学生 / 外部扫描器 POST `/morning-quiz/sessions/X/answer` 带 50MB body,几个并发就 OOM。
- **修复**:`main.ts` 里 `app.use(json({ limit: '256kb' }))`,文件上传单独 multer route 用 `limits: { fileSize: 50 * 1024 * 1024 }`。

### SEC-04【高】A07 — JWT 7 天 + 无刷新 + 无 revoke

- **位置**:`apps/api/src/app.module.ts:54-55` `signOptions: { expiresIn: '7d' }`,`auth.service.ts` 无 refresh,无 blacklist。
- **现象**:学生 / 老师手机被偷 7 天内有效;停用账户 7 天内有效(还叠加 SEC-01)。前端 `localStorage` 存 token(`MorningQuizScan.tsx` 等),XSS 直接拿走。
- **修复**:把 access token 缩到 1h;加 refresh token + 数据库 session id;每次 AuthGuard 命中查一下 `Session.revokedAt`。前端把 token 移到 httpOnly cookie + sameSite=strict + secure(HTTPS),并加 CSRF 防护(CORS 已 configurable but no CSRF token)。

### SEC-05【中】A05 — `MOCK_AUTH=true` + `SCHOOL_IP_BYPASS=true` 在 prod 没硬阻断

- **位置**:`apps/api/src/common/auth.guard.ts:31`、`apps/api/src/wifi-gate/ip-allowlist.guard.ts:64-67`、`apps/api/src/auth/auth.service.ts:15`(`MOCK_AUTH=true` 时**密码错也接受**)。
- **现象**:JWT_SECRET 默认值在 `main.ts` 里有硬阻断,但 `MOCK_AUTH=true` / `SCHOOL_IP_BYPASS=true` 在 prod 也能起 — 没有 `if (NODE_ENV==='production') process.exit(1)` 的硬墙。运维误把 `.env.dev` 部署到 Railway 就一刀切失守。
- **修复**:`main.ts` 启动时:
  ```ts
  if (process.env.NODE_ENV === 'production') {
    if (process.env.MOCK_AUTH === 'true' || process.env.SCHOOL_IP_BYPASS === 'true') {
      log.error('MOCK_AUTH / SCHOOL_IP_BYPASS not allowed in prod'); process.exit(1);
    }
  }
  ```

### SEC-06【中】A05 — `helmet` / `x-powered-by` 全部缺失

- **位置**:`apps/api/src/main.ts` 整段未引入 helmet,Express 默认带 `X-Powered-By: Express`。`grep helmet` 全仓 0 命中。
- **现象**:版本指纹直接漏出来;无 `Content-Security-Policy`;无 `X-Content-Type-Options: nosniff`;无 `Referrer-Policy`;教师后台 PDF 渲染如果出 XSS 直接连 IDS 都没。
- **修复**:`pnpm add helmet`,`main.ts`:`app.use(helmet())` + `app.disable('x-powered-by')`(后者通过 `(app.getHttpAdapter().getInstance()).disable('x-powered-by')`)。

### SEC-07【中】A09 — 审计有覆盖但失败静默,且 Audit Log 没出口

- **位置**:`audit.service.ts:24-42`(swallow + console);`apps/api/src` 全仓没有任何"导出 audit log"或"按日落盘"endpoint。
- **现象**:Audit 主要数据沉在 PG `AuditLog` 表里,没 archive、没出口、没保留期 — 一年后表会膨胀;同时审计本身失败(DB 抖)就丢,留不了证据。
- **修复**:建一个 `audit-archive` cron 把 90+ 天的 row 落 S3 / 对象存储 + delete;audit 失败时**至少**写本地 `audit-deadletter.ndjson`,运维一天合并一次。

### SEC-08【高】A08 — 9 个 npm 漏洞,其中 4 个 high

详见 0.1。摘最关键 3 条:

| 包 | CVSS / 类型 | 影响 |
| --- | --- | --- |
| `multer <=2.1.0` | 多个 high DoS(uncontrolled recursion、resource exhaustion) | 文件上传路由打挂整个 worker |
| `lodash <=4.17.23` (via `@nestjs/config`) | high — 原型污染 + `_.template` 代码注入 | 配置层读 envar 走 lodash,打不到直接 RCE 但是种子 |
| `basic-ftp <=5.3.0` | high DoS via 控制响应缓冲 | 间接(通过 `puppeteer` 依赖链),对我们不直接面向 attacker |

加上 `@nestjs/core` 的 GHSA-36xv-jgw5-4q75(injection,UI:R),教师后台老师点带恶意 query 的链接可能触发。

**修复**:`npm audit fix --force` 把 Nest 升到 11,但破坏性改动较大;或者**至少** `npm audit fix`(non-breaking 那一批先吃掉)。上线前必须做。

### SEC-09【中】A03 — `$executeRaw` 用于 admin-cleanup,字符串拼了模板插值但参数化 OK

- **位置**:`apps/api/src/admin-cleanup/admin-cleanup.service.ts:31-52`。
- **现象**:`$executeRaw` 使用了 tagged template 的 `${fffd}` 形式,Prisma 会自动参数化 — 不构成 SQL injection。但是 `${'%' + fffd + '%'}` 把 `%` 拼到 SQL 模式里没问题,因为整个字符串作为绑定参数传过去,LIKE 模式由参数解释。**OK**。要看的是任何**新增**的 raw 调用 — 当前仅这一处,可控。
- **维持**:加 lint 规则 `no-restricted-syntax` 阻止未来出现 `$executeRawUnsafe` 或者字符串拼接的 raw。

### SEC-10【低】morning-quiz-qa controller approve / detail 没在 controller 加 role 守卫

- **位置**:`apps/api/src/morning-quiz-qa/morning-quiz-qa.controller.ts:53-56` `approve`(无 role check),`rejectByTeacher` 同理。
- **现象**:学生 JWT 也能调 POST `/morning-quiz-qa/papers/:id/approve` — 不过 service 层 `if (!['teacher','head_teacher','admin'].includes(actor.role))` 会 403,所以**实际**安全;但是 API surface 没显式 deny,defense-in-depth 缺一层。
- **修复**:加 `if (!TEACHER_ROLES.has(user.role)) throw ForbiddenException`,和文件里其他三个 endpoint 风格一致。

### SEC-11【中】A05 — 所有 endpoint **没 rate limit**

- **位置**:全仓 `grep RateLimit | throttler | rate-limit | express-rate-limit` 命中只在 `ai-tutor.service.ts`(应用层自旋的 cooldown,不是 HTTP 层)。`AppModule` 里没有 `ThrottlerModule`。
- **现象**:`/api/auth/login` 没限频 → 在线密码爆破。`/api/attendance/scan` 也没限 → 一台机器无限刷 student-name(虽然 deviceUuid 防了同 session 内重复但跨 session 仍可)。`/api/morning-quiz/ai-grade/short-answer`(老师角色)挂上去刷爆 Anthropic 配额。
- **修复**:`pnpm add @nestjs/throttler`,`AppModule` 顶层 `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])`,登录 endpoint 单独 `@Throttle({ default: { ttl: 60000, limit: 5 } })`。

---

## C 边界 / 极端场景

### EDGE-01【中】50 学生同时扫码:PaperAssignment + StudentSubmission upsert 没有冲突防护

- **位置**:`apps/api/src/attendance/attendance.service.ts:197-247`。
- **现象**:50 个学生在 8:30:00 ± 1 秒同时打 `/attendance/scan`,每个调用都做 `attendance.upsert` + `studentSubmission.upsert` + `shuffle.getOrCreate`。Postgres 在 unique upsert 下基本能撑,但每个学生顺序跑了 4 个 round-trip(findUnique conflict + upsert attendance + upsert submission + 可能 update attendance.submissionId + getOrCreate shuffle)。50 并发 ≈ 200+ 连接秒。
- **场景**:PG 默认 connection pool ~100,Prisma 默认 num_connections=2*CPU+1=5(单 instance)。50 并发刷穿连接池,后来者 P2024 timeout。
- **修复**:
  1. Prisma `connection_limit=20`(URL 参数),pgbouncer。
  2. attendance.scan 改成单 SQL:`INSERT ... ON CONFLICT(sessionId, studentId) DO UPDATE` 一发到位,避免 4 round-trips。
  3. 加显式 backpressure:Throttler 5/s/IP(配合 SEC-11)。

### EDGE-02【低】`textAnswer max 20000` 字符,但 50 个学生并发提交 = 1MB JSON 同时入 PG

- **位置**:controller schema 限 20000 char,但 `paperQuestions` 12 题 × 50 学生 × 20000 char = 12MB 内存。autosave 间隔 600ms,稳态吞吐还好;但 submit 那一瞬间 50 人同时 flushPendingSaves 各 12 题就是 600 个 fetch 同时打。
- **修复**:见 SEC-03(body limit)+ EDGE-01(throttler);此外 textAnswer max 改 5000(IELTS short_answer 通常 ≤ 200 词)。

### EDGE-03【高】老师误删 Class — Cascade 雪崩

- **位置**:`apps/api/prisma/schema.prisma:78`(`ClassEnrollment.classId onDelete: Cascade`),L93、95(`PaperAssignment` 的 paper/class 都 Cascade),进而 `StudentSubmission.assignmentId` Cascade(L119),`AnswerScript.submissionId` Cascade(L149)。
- **现象**:任何走 `prisma.class.delete({ where: { id }})` 的路径会瞬间删掉:
  - 该班所有 ClassEnrollment(学生选课关系)
  - 该班所有 PaperAssignment(布置历史)
  - 进而所有 StudentSubmission(学生作业)
  - 进而所有 AnswerScript(每一道题的答题)
  - 还有 MorningQuizSession(L70 back-relation)→ Attendance
  
  Class 不可恢复 — 对应的就是整学期数据全没。代码里 `admin-cleanup.service.ts:263` 有 `class.deleteMany`,只是测试 fixture 清理,但同样的"prisma client 拥有 class 上的 delete 能力"在任何 admin endpoint 出现就是雷。当前没有面向用户的 class delete endpoint(已确认),但**没有**护栏阻止下次有人加。
- **修复**:
  1. Schema 改:`ClassEnrollment` / `PaperAssignment` / `MorningQuizSession.classId` 改 `onDelete: Restrict`,逼调用方先显式清空才能删 Class。
  2. 加 `Class.deletedAt` 软删除字段;统一走 `markDeleted` 而不是 hard delete。
  3. 任何"清空一个班"的操作必须二次确认 + audit log + 限制为 super_admin。

### EDGE-04【中】DB 连接池耗尽时 cron 行为不可控

- **位置**:`morning-quiz.cron.ts:32` 每分钟 tick — 没有 catch,`tick` 抛了之后 `@nestjs/schedule` 默认行为是日志 + 下次仍然跑。
- **现象**:9:00 一窝蜂力打 PG,connection pool 耗尽 → cron 也拿不到连接 → `lockOne` 全部抛 → 提交了一半的学生 stuck `in_progress`,要等下一分钟 cron 再打 → 反复打 → 雪球。
- **修复**:
  1. cron 整段 wrap `try/catch`,失败一次后 backoff(下次跳过 N 个 tick)。
  2. 单独的 cron pool(Prisma 多 client 实例),不和用户请求争连接。

### EDGE-05【低】AI API 限流 / 超时

- **位置**:`morning-quiz-qa.service.ts:240-258`(单次 Claude call 没 timeout — Anthropic SDK 默认 timeout 60s),`ai/quick-paper.service.ts`(类似)。
- **现象**:Anthropic 抽风时 batch generate 整个串行卡 60s/卷 × 5 天 × 10 班 = 50 分钟。控制流走的是 `try/catch` 各自吞,所以不会全挂,但 controller HTTP 请求自身可能 504。
- **修复**:`new Anthropic({ apiKey, timeout: 30_000 })`;controller 里把 batch 操作改成"立即返回 jobId,后台跑",前端轮询。

### EDGE-06【低】学生改自己的成绩 — A04 设计漏洞

- **复核**:`student.service.finalSubmit` 写 `autoScore`;教师 marker 写 `manualScore` / `totalScore`;`StudentService.getOwnSubmission` 是 readonly + redact。前端没暴露 PATCH `submissions/:id` 给学生。Controller 里搜:
  - `student.controller.ts` 只有 GET 和 finalSubmit。
  - `marker.*` 角色守卫了 `marker | head_teacher | admin`。
  - `morning-quiz-qa` approve / reject 角色守卫(service 层)。
- **结论**:目前看不到学生自助改分的路径。**OK**。但 EDGE-03 的 cascade 删除如果学生误打了 admin path 是另一回事(不在他能力内,跳)。

### EDGE-07【中】QA queue 同一 paperId 被两个 worker 同时拿走

- **位置**:`morning-quiz-qa.service.reviewPaper` 没拿 lock,直接 `paper.update({ where: { id } })`。
- **现象**:`generateWithQaLoop` 一次只在一个进程内调,这一路 OK。但如果 admin 在 web 上点 "rerun review" 同时 cron 也在跑同一 paper(早上 8:00 admin 手动重审 + 8:30 cron 顺路审),两路会各自调 Anthropic、各自 update 同一行 paper。最后的 verdict 谁先写完谁说了算 — 偶尔会回退到老 verdict。
- **修复**:`paper` 加 `qaReviewInFlight: Boolean`,review 起手 `updateMany({ where: { id, qaReviewInFlight: false }, data: { qaReviewInFlight: true } })` 抢锁,失败抛 409。

---

## 总结表

| ID | 严重度 | 类别 |
| --- | --- | --- |
| A1 | 高 | 全局 ExceptionFilter 缺失 |
| A2 | 中 | audit 失败 console 泄 PII |
| A3 | 高 | finalSubmit 无事务 |
| A4 | 中 | QA review update 无事务 |
| A5 | 中 | autosave 无指数退避 / timeout |
| A6 | 中 | cron 跨实例无 advisory lock |
| A7 | 中 | retry_exhausted 仍会上线 |
| A8 | 低 | reject 后 approve 状态混乱 |
| A9 | 低 | absence-alert 失败无告警 |
| A10 | 低 | gitClone url 边界依赖 controller |
| SEC-01 | 严重 | login 不查 isActive |
| SEC-02 | 高 | wechat webhookUrl SSRF |
| SEC-03 | 高 | body 无 size limit |
| SEC-04 | 高 | JWT 7 天 + 无 refresh / revoke |
| SEC-05 | 中 | MOCK_AUTH / IP_BYPASS prod 未硬阻 |
| SEC-06 | 中 | helmet / x-powered-by 缺失 |
| SEC-07 | 中 | audit 无出口 / 失败静默 |
| SEC-08 | 高 | 9 个 npm 漏洞(4 high) |
| SEC-09 | 低 | $executeRaw 当前 OK 需 lint |
| SEC-10 | 低 | qa controller defense-in-depth |
| SEC-11 | 中 | 全局无 rate limit |
| EDGE-01 | 中 | 50 并发扫码连接池打满 |
| EDGE-02 | 低 | 大 textAnswer 内存峰值 |
| EDGE-03 | 高 | Class cascade 雪崩 |
| EDGE-04 | 中 | cron 在 pool 耗尽时不可控 |
| EDGE-05 | 低 | AI 调用无 timeout |
| EDGE-06 | — | 未发现学生改分路径 |
| EDGE-07 | 中 | 同 paper 两路 review 抢写 |

---

## 上线前必修 (P0)

1. **SEC-01** — `AuthService.login` 加 `isActive` 检查。一行代码。
2. **SEC-02** — wechat webhookUrl 限白名单域名 + 拒私网段。
3. **SEC-03** — `app.use(json({ limit: '256kb' }))`。
4. **SEC-08** — `npm audit fix`(non-breaking 那批);`@nestjs/core` 升 11 排到 P1。
5. **A1** — 写一个 `AllExceptionsFilter` 屏蔽 stack/Prisma meta。
6. **A3** — `finalSubmit` 包 `$transaction`。
7. **A7** — `generateWithQaLoop` retry_exhausted 不要静默上线。
8. **EDGE-03** — 把 Class 相关 onDelete 改 Restrict,或加软删除。

P1(2 周内):SEC-04 / SEC-06 / SEC-11 / A5 / EDGE-01。

P2:其余。
