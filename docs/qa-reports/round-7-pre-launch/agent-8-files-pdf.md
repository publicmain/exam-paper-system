# Agent 8 — File / PDF / Generation pipeline 审计报告

**Round:** 7 上线前 audit
**范围:** `services/pdf-worker/`, `apps/api/src/{pdf,papers,templates,watermark}/`, `apps/api/src/morning-quiz/` Excel export, AI 生成 (claude-api), IELTS passage_pick 30 天去重, KaTeX
**审计时间:** 2026-05-09
**仓库 commit:** `7e8bf9b`

> 总体结论:**有 1 处 critical(中文 PDF 不能正常渲染) + 4 处 high + 5 处 medium**。打通后才能放心上线。

---

## 1. pdf-worker docker-compose / 容器

### 1.1 [HIGH] **顶层 docker-compose.yml 没有 pdf-worker 服务,无法本地起完整链路**
- **位置:** `docker-compose.yml`(15 行)
- **现象:** 顶层 compose 文件只起 `postgres`,完全没有 `pdf-worker` / `api` / `web`。所以本地开发只能各自 `npm run dev` + 手起 worker,没有"`docker-compose up` 一键起栈"的能力。如果 Railway 配置乱了,本地无法复现。
- **stdout:**
  ```
  $ cat docker-compose.yml
  version: "3.9"
  services:
    postgres:
      image: postgres:15-alpine
      ...
  volumes:
    exam-postgres-data:
  ```
- **修复:** 把 `services/pdf-worker/Dockerfile` 拉进 docker-compose,加上 `api` build 和 `web` build。否则上线前没有任何"完整闭环"的本地烟测办法。

### 1.2 [LOW] pdf-worker Dockerfile 没有 healthcheck 指令(只在 railway.json 配)
- **位置:** `services/pdf-worker/Dockerfile`
- **现象:** Dockerfile 没写 `HEALTHCHECK`。Railway 通过 `healthcheckPath: /health` 探活(railway.json),但脱离 Railway 单独跑容器(`docker run`)无法判断 ready。
- **修复:** 加 `HEALTHCHECK --interval=10s CMD curl -f http://localhost:8080/health || exit 1`。

### 1.3 命名误导 — pdf-worker 不是 puppeteer
brief 说 "puppeteer 渲染服务",实际 `services/pdf-worker/main.py` 是 **PyMuPDF + FastAPI**,处理的是**输入**侧(过往真题 PDF → 切页/OCR/抽块)。**输出**侧 PDF 渲染在 `apps/api/src/pdf/pdf.service.ts` 用 puppeteer(Node 容器内),**和 pdf-worker 是两个不同服务**。这是部署文档应该写清楚的事,目前没写。

---

## 2. PDF 字段溢出 / 长公式 / 长题干

### 2.1 [HIGH] **答案区高度可达 140mm,长题干 + 多 part 必然撑爆 A4**
- **位置:** `apps/api/src/pdf/templates.ts:178-181, 331-339`
- **现象:**
  ```ts
  // 12mm/分,封顶 140mm
  const answerMm = (marks: number) => Math.min(140, Math.max(14, Math.round((marks || 1) * 12)));
  ```
  + `.question { page-break-inside: avoid }` 强制整个 `<div class=question>` 不分页。
  A4 内容区高度约 261mm(297 − 18 上 − 18 下)。一道结构题:500 字题干 ≈ 60mm + 4 个 part × (短文本 5mm + answer-area 12mm × marks)。当 part = `[10 marks]` 时 answer-area = 120mm,4 个 part = 480mm 加 stem = 540mm。**远超一页**。
  Chromium 在内容超过页高时会忽略 `page-break-inside: avoid`,行为变成不可预测的"中间断"。
- **修复:**
  - 把 `page-break-inside: avoid` 从 `.question` 移到 `.q-head` + `.q-stem`(题头题干不拆),让 part 自然分页;或
  - 把 `answerMm` 上限降到 60mm,长答题用横线纸单独附页。
- **回归测试:** 拿任一 4-part × 10-mark 结构题导 PDF,看会不会断成两页。

### 2.2 [MEDIUM] 长公式没有 horizontal overflow 处理
- **位置:** `apps/api/src/pdf/templates.ts:114-209`(整段 baseStyles)
- **现象:** `katex` server-side render 出来的 `.katex-display` 是 `display:block` 默认,长公式(比如积分式连续 80 字符)会**横向溢出右边距**。CSS 没设 `overflow-x: auto / max-width` 兜底。Web 端有滚动条,PDF 没有 — 直接被裁掉。
- **修复:** 加
  ```css
  .katex-display { max-width: 100%; overflow-x: auto; }
  ```
  并把超长公式提示用户 `\\` 手动断行。

### 2.3 [MEDIUM] cover page `page-break-inside: avoid`,内容多了会被裁
- **位置:** `apps/api/src/pdf/templates.ts:128-135`
- **现象:** `.cover { page-break-inside: avoid }`。logo 50mm + course-line 16pt 多行 + subject 18pt + paper 14pt + exam 17pt + 5mm 间距 + instructions 3 行 12pt + class-line + student-name + marker-table(12mm 顶距 + 3 行 13mm = 39mm) ≈ 200mm,留得不多。如果 subjectName 折两行(比如 "Cambridge International AS Level Mathematics — Pure Mathematics 1")就会超。Chromium 同样会忽略 `page-break-inside: avoid`,出现奇怪布局。
- **修复:** 把 marker-table 拆出来用 `position: absolute; bottom: 18mm`,或改用 grid 主动算空间。

### 2.4 [MEDIUM] 长 stem(>800 字)直接整段塞进 HTML 没有截断
- **位置:** `apps/api/src/pdf/templates.ts:316`(`renderInline(q.content?.stem || '')`)
- **现象:** 没有 stem 长度上限。AI 生成或导入 IELTS passage 时,8000 字 passage 会整块塞进 `.q-stem` 一个 div + `page-break-inside: avoid`(继承自 `.question`)→ 一页放不下,行为同 2.1。
- **修复:** 实际上 IELTS passage 应该单独渲染成"阅读材料"块(独立 `.passage` div,允许 page-break),而不是塞进每道题的 stem。当前架构是 morning-quiz 给 13 道题各塞同一段 passage 还是只第一题?需要看 `morning-quiz.service.ts:585` 附近 — 看代码每个 `paperQuestion` 各自 snapshot 自己的 content,所以 passage 应只在题 1 stem 里出现一次。**但题 1 的 stem 可达 4000 字**,会撑爆 page-break-inside: avoid。

### 2.5 watermark 在所有页都叠加 — 验证通过
- **位置:** `apps/api/src/watermark/watermark.service.ts:265-302`
- **现象:** `for (const page of doc.getPages())` — 包括 cover、所有题目页、附录页。中心大字 + 顶右 + 底左 三层。✅ 多页 PDF 正确叠加。
- **不过:** rotate 30° 中心点计算用的是手算 cos/sin,不一定刚好打在页面正中(注释也承认 "near the page center")。视觉小瑕疵,不阻塞上线。

### 2.6 [LOW] watermark download 不给 watermark answer_key
`watermarkService.download()` 写死 `pdfService.exportPaper(row.paperId, 'paper')`(:170)。不能把答案 key 加水印分发给学生 — 这是设计上的安全选择(答案不发学生),但应该在 controller 层显式拒绝 answer_key 请求,目前是隐式忽略。

---

## 3. KaTeX

### 3.1 [CRITICAL] **KaTeX CSS 走 jsdelivr CDN + waitUntil:'networkidle0' — CDN 抽风时 PDF 渲染整体挂 30 秒后超时**
- **位置:**
  - `apps/api/src/pdf/templates.ts:7` — `const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';`
  - `apps/api/src/pdf/pdf.service.ts:111` — `await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });`
- **现象:**
  - KaTeX **渲染本身**是 server-side(`katex.renderToString` 在 templates.ts L30/39),所以 HTML 里数学符号是已经布好版的 span/svg。
  - **但字体**(KaTeX 的特殊字体集 KaTeX_Main / KaTeX_Math / KaTeX_AMS 共 30+ 文件)是通过 katex.min.css 里的 `@font-face url(./fonts/...)` 拉的 — Puppeteer 在容器里发起 HTTPS 请求到 jsdelivr。
  - 一旦 jsdelivr 在中国不可达 / 限速 / 挂(常见),`networkidle0` 会一直等到 30 秒超时,整个 PDF 导出 5xx。学校在内地 Railway 部署遇到 jsdelivr 抽风的概率不低。
  - 即使只是慢,每次 PDF 都要等 networkidle0 = 至少 500ms 空网络。
- **修复:** 把 `katex` npm 包里的 CSS + fonts 在 build 阶段拷贝到 `apps/api/dist/assets/katex/`,模板里改成 `file://...` 或同源 `/static/katex/...`。这步 5 分钟事,但**不做的话上线第一次 jsdelivr 抽风就是事故**。

### 3.2 [LOW] waitUntil 'networkidle0' 太严
即便 CDN 正常,`networkidle0` 要求 500ms 内零网络,字体加载完成后还要等 500ms 静默。改成 `'load'` 或 `'domcontentloaded'` + 显式 `await page.evaluateHandle('document.fonts.ready')`,导出速度能从 ~2s 降到 ~500ms。

---

## 4. Excel 三 sheet (commit f01ca5d)

### 4.1 sheet 内容与 brief 描述不一致
brief 说 "sheet1=班级总览, sheet2=学生明细, sheet3=题目分析",**实际代码是**:
- sheet1: **考勤明细 Attendance**(每个 student × 每天一行)
- sheet2: **成绩明细 Scores**(每个 submission 一行,MCQ 分/总分/等级)
- sheet3: **缺勤汇总 Absences**(每个 student 缺勤天数 / streak / 出勤率)

**brief 描述错误**,代码本身合理。但**没有"题目分析"sheet** — 即没有"哪道题正确率最低"统计。如果产品说必须有,需要新加 sheet4。

### 4.2 [HIGH] **空数据导出会产生只有表头、无数据行的 .xlsx — 不报错也不告警**
- **位置:** `morning-quiz-export.service.ts:48-282`
- **现象:** 当 sessions / attendances / submissions 都为空时,代码无 fallback,直接生成 3 个只有标题行的工作表。教师看到一个 "成功下载" 的空文件,容易误以为系统坏了。
- **修复:** sessions 为空时直接 throw `BadRequestException({ code: 'no_data_in_range' })`,前端弹"该时间段无数据"。

### 4.3 [MEDIUM] **千名学生时全量 attendance/submissions in-memory aggregation 会 OOM**
- **位置:** `morning-quiz-export.service.ts:71-98, 209-227`
- **现象:**
  ```ts
  const attendances = await this.prisma.attendance.findMany({ where: { sessionId: { in: sessionIds } }, include: { student } })
  const submissions = await this.prisma.studentSubmission.findMany({ where: { id: { in: submissionIds } }, include: { scripts } })
  ```
  1000 学生 × 30 天 = 30000 attendance 行 + 30000 submission 行 + 30000 × 13 scripts = **390000 row 全部装进 V8 内存**,加上 sessionById / submissionById Map。Node 堆默认 1.5GB,跑 4 个并发导出能打爆。Railway 容器 1GB 默认。
- **修复:**
  - 限制日期范围 ≤ 90 天(参考 admin-cost 默认 30 天)。Controller 层 422 拒绝。
  - 改成 cursor / batch 流式遍历 + ExcelJS streaming writer (`useStyles: true, useSharedStrings: true`)。

### 4.4 [LOW] 中文字段对齐策略偏左
- `row.alignment = { vertical: 'middle', horizontal: 'left' }` 全表 left。但成绩、人数这些数字应该 right 对齐,百分比应该 right。视觉细节问题。
- 列宽是固定值(width: 18 / 14 / 12 / 20),长班级名 "高三(12)实验班(理科)" = 19 字会被截。建议 `s.columns.forEach(c => c.width = Math.max(c.width, autoWidth(...)))`。

### 4.5 [LOW] 没有 column 限频 — 同一教师 1 秒发 50 个 export 直接打爆 DB
没有任何 rate limit / lock。配合 4.3 的全量 in-memory,容易被一个教师误操作打挂。

---

## 5. IELTS passage_pick 30 天去重

### 5.1 验证通过 — 边界正确
- **位置:** `morning-quiz.service.ts:535-548`
- **代码:**
  ```ts
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  const recentPapers = await this.prisma.paper.findMany({
    where: { assignments: { some: { classId } }, createdAt: { gte: cutoff } },
    select: { config: true },
  });
  for (const p of recentPapers) {
    const cfg = p.config as { passageRef?: string } | null;
    if (cfg?.passageRef) usedPassageRefs.add(cfg.passageRef);
  }
  ```
- **边界:** 第 30 天的 paper(`createdAt = cutoff`)仍被排除(`gte`);第 31 天能复用。✅ 符合 brief 描述。

### 5.2 [MEDIUM] **dedup 不区分 paperType / subject**
- **现象:** `where` 没限制 `subjectId` / `paper.config.mode = 'passage_pick'`。如果一个班同时有 IELTS / Math / 物理 三科 morning quiz,30 天会拉 ~90 张 paper(每科每天一张),全部 select config。
- **后果:** 数据量增长。逻辑正确(因为只有 IELTS passage_pick 才有 `passageRef`),但浪费查询。
- **修复:** `where` 加 `subjectId: subject.id, config: { path: ['mode'], equals: 'passage_pick' }`(Prisma JSON filter)。

### 5.3 [MEDIUM] 全部 passage 都用过会"循环复用"但**没告警**
- **代码:**
  ```ts
  const pick = candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : Array.from(byPassage.keys())[0]; // all used recently — recycle anyway
  ```
- **现象:** 班级题库见底时静默回收第一个 passage。没有 log,没有 audit metadata 标志,没有给教师看的 banner。教师可能连续两周看到同一篇。
- **修复:** `if (candidates.length === 0)` 时:
  1. 加 `this.logger.warn(...)`,
  2. audit metadata 加 `recycled: true`,
  3. 前端 morning-quiz dashboard 显示一个橙色提示。

### 5.4 [LOW] random 选择不带 seed,无法复现
对调试无大影响,但出问题难复现 "为什么这班今天选了 P3 而不是 P1"。建议用 `paper.generatedSeed` 同一逻辑。

---

## 6. AI 生成 (claude-api)

### 6.1 ✅ 用 `@anthropic-ai/sdk` 0.32.1
`apps/api/package.json:25`,正确。

### 6.2 ✅ 模型走 ENV
`process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'`(ai.service.ts:34, ai-question-generator.service.ts:237, morning-quiz-qa.service.ts:16, ielts-repair.service.ts:44)。**默认值**到处硬编码同一个字符串,要改得改 5 处。建议提一个 constants.ts。

### 6.3 [HIGH] **模型名 `claude-sonnet-4-6` / `claude-opus-4-6` 不是合法 Anthropic 模型 ID**
- **位置:** `morning-quiz-qa.service.ts:16-18`,`ai.service.ts:34`,`.env.example:30`
- **现象:** Anthropic 公开 API model id 用 dash + 日期格式,如 `claude-sonnet-4-5-20250929`。`claude-sonnet-4-6` / `claude-opus-4-6` 是**别名**或**项目内部命名**,需要确认 Anthropic 是否真的开放了这两个 alias。如果用户没在 Console 配 alias,SDK 会返回 404 model_not_found。
- **stdout 旁证(README):**
  ```
  README.md:196: ... calls Claude (`claude-sonnet-4-6` by default) ...
  docs/qa-reports/qa-review-evidence/sample-rejection.md: "model": "claude-sonnet-4-6"  ← 真实 Railway 调用成功
  ```
  所以 alias **在生产环境的某个 Anthropic 账号下确实可用**(QA 报告显示真调通了)。但**任何换账号 / 换 region 部署立刻挂**。
- **修复:** 默认值改成完整 dated id `claude-sonnet-4-5-20250929` + `claude-opus-4-1-20250805`,允许 ENV 覆盖成 alias。这是上线必修。

### 6.4 ✅ Prompt caching 已启用
- `ai-question-generator.service.ts:945` — `cache_control: { type: 'ephemeral' }` 在 system block。
- `ai.service.ts:92` — 同样在 system 内的 topics 列表上。
- `morning-quiz-qa.service.ts:247` — system prompt 上。
都正确。批量调用同 subject / 同审核 prompt 5 分钟内有 90% 缓存折扣。

### 6.5 [HIGH] **完全没有 retry / 失败回退**
- **位置:** `ai-question-generator.service.ts:380-400`,`morning-quiz-qa.service.ts:240-257`
- **现象:** Anthropic API 偶发 529 / 502 / 网络抖动。当前代码是单次 `messages.create` + try/catch 抛 503。整个早测自动化流程(`scheduled batch`)碰一次抖动就会**整批失败**,没有指数退避。
- **修复:** SDK 自带 `maxRetries: 2`(默认 2)是构造时 `new Anthropic({ apiKey, maxRetries: 3 })`。当前代码 `new Anthropic({ apiKey })` 用默认值。建议显式 3 + 加 jitter。529 (overloaded) 应该 sleep 5s 后重试。

### 6.6 [LOW] cost cap 是单进程内存 reservation,多实例无效
- **位置:** `ai-question-generator.service.ts:226-230` 注释承认了这点
  > "Single-process atomicity only — multi-instance deployments would need a DB-backed reservation table."
- 上线如果 Railway 跑 ≥2 个 replica,cap 会被绕过。Railway 默认单实例,但**横向扩容时会出问题**,加 README 警告。

---

## 7. 文件上传(security)

### 7.1 ✅ 没有任何 FileInterceptor / multer 路径
- **stdout:**
  ```
  $ Grep "FileInterceptor|@UploadedFile|multipart" → No files found
  ```
- 所有 PDF 是从 GitHub 公共 PDF URL **拉**(pdf-worker `process_pdf` fetch_url),不是用户上传。本身规避了大部分 file-upload 攻击面。✅

### 7.2 ✅ 路径遍历防御
- `apps/api/src/ai/question-asset.controller.ts:18` — 严格 regex `^[a-z0-9-]+$` 校验 qid 和 filename,不会被 `../` 突破。
- `apps/api/src/ingest/source-files.controller.ts:33` — pageNum 走 `parseInt`,id 走 DB 查存在性。**但**仍把 `id` 直接拼进 `path.join(RENDER_STORE, id, fname)`。`id` 是 cuid/uuid 来自 DB,DB 行存在 → id 是受信的。无攻击面。✅

### 7.3 [MEDIUM] pdf-worker `/render_circuit` 与 `/render_molecule` **没有 INTERNAL_TOKEN 校验**
- **位置:** `services/pdf-worker/main.py:253, 330`
- **现象:** `process_pdf` 检查 `if not INTERNAL_TOKEN: raise 500`(L82),但两个 render endpoint **完全不校验 token**。`apps/api/src/ai/remote-render.service.ts:35-38` 调用时也没传 X-Internal-Token。
- **后果:** 如果 pdf-worker 暴露在公网(Railway 默认有公网 URL),任何人能调 `/render_circuit` 任意调度 schemdraw/matplotlib 渲染 → CPU/内存 DoS。元素上限 30 个有简单防护,但 1000 并发请求会打挂。
- **修复:** 给两个 endpoint 加 `Depends(verify_internal_token)`,API 侧 `remote-render.service.ts` 传 header。或在 Railway 把 worker 设为 private network。

### 7.4 [LOW] 全局 body 没有 size limit
- `apps/api/src/main.ts` 没有 `app.use(json({ limit: '...' }))`,Nest 默认 100kb。AI generated questions 可能 > 100kb 单 paper(80 题 × 2KB ≈ 160KB)。如果偶发触发,会返回 413,**没有专门错误 handling**。
- **修复:** `app.useBodyParser('json', { limit: '5mb' })`。

---

## 8. PDF 容器字体 — **CRITICAL** 中文不能渲染

### 8.1 [CRITICAL] **API 容器只装了 fonts-liberation,没有 CJK fonts**
- **位置:** `apps/api/Dockerfile:19-24`
- **stdout:**
  ```dockerfile
  RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      ca-certificates \
      git \
      && rm -rf /var/lib/apt/lists/*
  ```
- **影响:**
  - cover page `data.classLabel` 用 escapeHtml(`高三(12)班`)→ Chromium 找不到字体 → 渲染成 ☐☐☐(豆腐块)。
  - `data.examBoardName` / `data.subjectName` 如果是中文(老师在 admin 自定义 subjectName "数学" / "雅思阅读")→ 同样豆腐。
  - 学生姓名(watermark 顶右"Confidential · 张三 · zhangsan@school.cn")— **watermark 用 pdf-lib 内置 Helvetica,完全不支持中文**!`page.drawText('张三', { font: helv })` 会抛 `WinAnsiEncoding can not encode character 张` 或静默渲染成空格。
- **stdout 验证:**
  ```
  $ grep -rn "fonts-noto-cjk|fonts-wqy-zenhei|fonts-arphic|noto-sans" apps/api/Dockerfile
  (无匹配)
  ```
- **修复:**
  1. apps/api/Dockerfile 加 `fonts-noto-cjk` (Debian 包 ~50MB)。
  2. watermark.service.ts 改用 `embedFont(NotoSansCJK.ttf bytes)` 替代 StandardFonts.Helvetica。否则中文学生名一律渲染失败(或水印形同虚设)。
- **优先级:** 上线 prerequisite。学校在 SG-Cambridge 但学生名很多中文,这个不修不能上。

---

## 9. 其它已查项

### 9.1 ✅ Puppeteer args 合理
`--no-sandbox`(容器必须),`--disable-dev-shm-usage`(避免 /dev/shm 不够大),`--font-render-hinting=medium`(PDF 字体清晰)。OK。

### 9.2 ✅ Puppeteer browser 单例
`browserPromise` 缓存 browser instance,`onModuleDestroy` 关闭。多并发 PDF 共享 browser,新开 page。OK。

### 9.3 [LOW] PDF_TIMEOUT_MS 30 秒可能不够
30 题 × KaTeX + assets data URI(每图最大 75% × 280px ≈ 200KB)= 单 paper HTML body 5-10MB,Chromium 解析慢机器要 20s。建议 60s。

### 9.4 ✅ Excel writeBuffer 类型转换正确
`(await wb.xlsx.writeBuffer()) as ArrayBuffer` → `Buffer.from(buf)`。✅

---

## 上线 blocker(必修)

| 优先级 | 编号 | 内容 |
|------|------|------|
| **CRITICAL** | 8.1 | API 容器加 fonts-noto-cjk,watermark 换 CJK 字体 |
| **CRITICAL** | 3.1 | KaTeX CSS + fonts 自托管,去掉 jsdelivr 依赖 |
| **HIGH** | 6.3 | 模型 ID 默认值改成完整 dated id |
| **HIGH** | 6.5 | Anthropic SDK 加 maxRetries: 3 |
| **HIGH** | 2.1 | 长答题 page-break-inside: avoid 重新设计 |
| **HIGH** | 4.2 | 空数据 Excel 导出 422 拒绝 |
| **HIGH** | 1.1 | 顶层 docker-compose 补 pdf-worker / api / web |

## 强烈建议(上线后第一周)

| 优先级 | 编号 | 内容 |
|------|------|------|
| MEDIUM | 7.3 | pdf-worker /render_* endpoint 加 INTERNAL_TOKEN |
| MEDIUM | 4.3 | Excel export 限制 ≤90 天 + streaming writer |
| MEDIUM | 2.2 | 长公式 overflow-x: auto |
| MEDIUM | 5.2 | passage dedup 加 subjectId 过滤 |
| MEDIUM | 5.3 | passage 全用过时告警 |
| MEDIUM | 2.3 | cover page 重新布局 |

## 参考代码位置(绝对路径)

- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\apps\api\src\pdf\pdf.service.ts`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\apps\api\src\pdf\templates.ts`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\apps\api\src\watermark\watermark.service.ts`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\apps\api\src\morning-quiz\morning-quiz-export.service.ts`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\apps\api\src\morning-quiz\morning-quiz.service.ts` (passage_pick at L488-615)
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\apps\api\src\ai\ai-question-generator.service.ts`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\apps\api\src\ai\ai.service.ts`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\apps\api\src\ai\remote-render.service.ts`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\apps\api\src\morning-quiz-qa\morning-quiz-qa.service.ts`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\apps\api\Dockerfile`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\services\pdf-worker\Dockerfile`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\services\pdf-worker\main.py`
- `C:\Users\yaoke\Projects\exam-paper-system\.claude\worktrees\agitated-pasteur-ac58d2\docker-compose.yml`
