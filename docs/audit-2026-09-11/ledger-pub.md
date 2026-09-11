# 台账：阅读教材发布、内容一致性与运维保障（PUB / CONTENT01 / OPS）

负责范围：`docs/CLAUDE-AUDIT-AND-IOS-REBUILD-PROMPT-2026-09-11.md` §5.5 / §5.6，
PUB01–PUB03、CONTENT01、OPS01–OPS07。

工作树：`C:/Users/yaoke/Projects/exam-paper-system/.local/wt/pub`，分支 `audit/pub`。
接手时 HEAD = `6f85e6d`（上一位工作者已改到一半、未提交）。本次会话结束时 HEAD：

```
2feae25 feat(ops): OPS03/OPS04 只读巡检脚本 —— 卡住的内容任务 + 未来教学日覆盖
a0b05f3 ci(ops01): 根 scripts 与 CI 补上 student-web 与 ops-dashboard 语法检查
5b5e8dc chore(content): CONTENT01 —— 准备好生产订正脚本，默认 dry-run，未执行
fe64f2d fix(content): CONTENT01 —— 09-09 甘地题评分标准订正为一分（marks 本来就对）
8f5e5c3 fix(pilot): 发布内容冻结、事务前置校验、去重全量分页（PUB01/PUB02/PUB03）
6f85e6d（接手基线，未改动）
```

零 Anthropic API 调用；本会话没有 `git push`、没有部署、没有对生产写库。

---

## PUB01 · 重发同周内容会覆盖已开始/已交的题目快照

**状态：已修复，已验证。**

**原症状**：`prepare-pilot-week.js` 对每一档每一行做 `upsert`——重跑同一天会
把题面、答案、评分标准原样再写一遍。内容包在发布之后如果改过，已经开卷、
交卷、判过分的学生手里那份冻结快照会被悄悄换掉；老师取消的场次也会被
`status: 'active'` 的 upsert 悄悄恢复。

**修复位置**：`apps/api/scripts/pilot/prepare-pilot-week.js`
- `lessonRows` / `dayRows`：纯函数，算出「一天应该落库的行」。
- `loadExisting`：一次性读出库里已有的行，以及每份卷子的使用情况
  （挂过作业且有答卷 / 有作答行 = 用过）。
- `planDay`：逐字段比对，把每一档分成 `new` / `unchanged` / `changed`。
- `assertPlanAllowed`：已被使用的卷子内容一改就拒绝（`--revise-unstarted`
  也不放行）；没人用过的卷子改了默认拒绝，需要显式 `--revise-unstarted`
  才放行，并逐条列出改了哪些字段。
- `writeDay`：新建的行批量 `createMany`；`--revise-unstarted` 放行的修订
  逐行 `update`；未变的一行不碰；已有场次的状态一律不动。
- 新增 `--check`：只读核对某天有没有完整发布（`SET TRANSACTION READ ONLY`），
  发布断线、不确定有没有成功时先跑它，不需要确认串。

**新增测试**：
- `scripts/pilot/__tests__/prepare-pilot-week-freeze.spec.ts`（25 例，纯函数/假
  事务）：新建、未变、改了的判定；使用情况统计；放不放行的四种组合；写入
  只写新建的行、重跑零写入、修订只改改了的行。
- `scripts/pilot/__tests__/pilot-publish.db.spec.ts`（9 例，需要
  `PILOT_IT_DATABASE_URL`，见下方「隔离库集成测试」）：真实 CLI × 真实
  Postgres 验证「学生已开始/交卷的卷子内容一改就拒绝，题面答案分数一个字
  不动」「没人开始的卷子改了默认拒绝，加 `--revise-unstarted` 才更新」
  「相同内容重跑零写入」「被取消的场次不会被悄悄恢复成 active」。

**实测结果**：
- 纯函数测试：25/25 通过。
- 隔离库集成测试：9/9 通过（本机 PGlite，见下方）。
- 全量回归见 OPS07。

**剩余依赖**：无。已有场次/作业状态的「不该动」逻辑覆盖到位；真正的内容
修订仍然需要人工走 `--revise-unstarted`（未被使用时）或本台账 CONTENT01
式的专用一次性脚本（已被使用时）。

---

## PUB02 · 发布 hard assert 在事务提交后才执行

**状态：已修复，已验证。**

**原症状**：原脚本 `$transaction(...)` 返回、`$disconnect()` 之后才跑硬断言
（「不该动的东西有没有动」）。断言失败时事务早已提交，日志说「动了不该动
的东西」，库却已经改了——失败信息与实际库状态不一致。

**修复位置**：同一文件，`publishDay()`：
- 发布后约束（`verifyDayPublished`：五档卷子与题、每班每档场次、词典、
  每个有档位在册学生今天的词都齐全）与「不该动的没动」（`foreignChanges`：
  答卷指纹、非试点生词、复习/错题/申诉/当日任务行等计数）现在**都在事务
  回调内、提交之前**执行；任何一条不过就 `throw`，整笔回滚。
- 成功日志（`已发布`）只在 `$transaction` 正常返回（即已提交）之后打印。
- 事务预算保留 `66eec47` 的批量化成果（一天约 650 次查询、三四分钟），
  `maxWait: 30_000, timeout: 900_000` 未削弱。

**新增测试**：
- `prepare-pilot-week-freeze.spec.ts`：`foreignChanges` 的九类计数、答卷
  指纹、非试点生词逐一命中；`assertEnvGates` 的 `--check` 免确认串但其余
  七道闸门不少一道。
- `pilot-publish.db.spec.ts`：用触发器故障注入（`installTamperTrigger`
  在写 `Paper` 时顺手改一份别人的答卷；`installDropWordTrigger` 让某个
  学生的某个词插入被吞掉）验证「事务真的整笔回滚」「失败时不打印已发布」
  ——这两条只有真实 Postgres 事务语义才能验证，纯函数/假事务测不出来。

**实测结果**：9/9 集成测试通过，其中两条直接验证 PUB02（触发器注入 →
整笔回滚 → 不打印「已发布」）。

**新基线说明确认**：`66eec47` 只是把 `StudentWord` 排词批量化以缩短事务，
没有触动断言顺序或冻结逻辑——本次修复独立于它，不是重复劳动。

**剩余依赖**：无。

---

## PUB03 · 去重全历史覆盖与质量门禁

**状态：已修复，已验证。**

### 3.1 历史只取前 10000 条 → 完整分页

**原症状**：`deliveredHistory` 用 `take: 10000` 一次取完、不排序；超过一万
条之后多出来的历史（按物理顺序往往正是最新投放的）根本不参与比较。

**修复**：`deliveredHistory(tx, { excludePaperIds, pageSize = 2000 })` 按
`id asc` 完整分页取完，不设上限。生产当时 1,286 条历史（`pub03.deliveredRows`
只读核对结果，见下），还没撞到过旧上限，这是预防性修复。

**已归档但曾投放的内容仍在历史里**：查重口径原来就是「挂过作业且有学生
答卷」，与 `status`/`archivedAt` 无关，这次没有改这条口径，新增测试专门
钉住「已归档的历史卷子仍然计入查重」（`pilot-publish.db.spec.ts` 的
「以前发过、后来内容包里改掉了的 p1 版本，仍然算学生读过」）。

**排除范围收窄**：原来整体排除所有 `p1_` 卷子（怕把自己比自己），代价是
内容包里已经改掉的旧版本（发出去以后才换的）漏查。现在只排除**正在发布
的这一天自己的五份卷子**，其余学生读过的 `p1_` 历史卷子一并对照。

### 3.2 短文本查重兜底

**原症状**：shingle containment 对不足一个片段的短文本恒为 0——两道一模
一样的短题干（如 "Who won?"）永远查不出来。

**修复**：`content-similarity.js` 新增 `fingerprint()`／`similarityOf()`：
片段集合不足一个片段时，退化为「归一化后逐词相同」判重；≥ 一个片段的
文本判定结果与旧版（v1）逐位相同（测试 `pilot-week-content.spec.ts` 已有
覆盖，`prepare-pilot-week-freeze.spec.ts` 也补了一份）。算法版本号
（`shingle-containment/v2`）随拒绝原因一起打印，方便事后核对「当时是哪
一版规则拦的」。

### 3.3 发布路径上的内容门禁

新增 `apps/api/scripts/pilot/publish-gates.js`：把内容测试第 6 节（评分
标准与满分矛盾、Paragraph 依据、判断题/配对题/选择题结构、篇幅与超纲词）
搬到**发布脚本自己的路径上**——发布某一天之前逐档逐题检查，有问题一行都
不写。测试文件的实现保持独立（互为对照），`publish-gates.spec.ts` 钉住
两者对全部内容包的结论一致。这条同时是 CONTENT01 的发布路径回归。

**新增测试**：`publish-gates.spec.ts`（19 例）+ `prepare-pilot-week-freeze.spec.ts`
的 PUB03 小节（历史分页、口径、shingle 边界）+ `pilot-publish.db.spec.ts`
的「10,050 条历史排在最后的一条也拦得住」「以前发过后来改掉的 p1 版本仍算
读过」两条真实库集成测试。

**实测结果**：全部通过（见文末汇总）。生产只读核对：`pub03.deliveredRows`
= 1286，`archivedPaperRows` = 0（当前没有已归档投放过的卷子，但代码口径
已经覆盖这种情况），`allNonP1PaperQuestions` = 1794，`p1DeliveredRows` = 210。

**不承诺**：与需求文件一致——不承诺永远零重复、永远正确；这是可测的覆盖、
拦截、版本追溯与纠错机制，不是无期限的内容研究或重写去重引擎。

**剩余依赖**：无。

---

## CONTENT01 · 09-09 甘地题满分 1 分、评分标准写两分

**状态：内容已订正、发布路径回归已加；生产冻结快照的文字订正待用户授权。**

### 根因（不是「marks 字段错了」，是评分标准文字错了）

定位：`apps/api/scripts/pilot/content/week2/ielts_light.js` 的 `buildDay()`：

```js
const human = HUMAN[key].map(([taskType, stem, answer, evidence, rubric], i) => ({
  ...
  marks: i === 2 ? 1 : 2,   // 每篇文章的四道简答题里，第三道固定按 1 分算
  ...
}));
```

这是**跨五天一致的内容设计**：07 tidal-power / 08 libraries / 09 salt /
original-rail-time / original-smell-of-rain 五组 `HUMAN[key]`，每组第三题
（`i===2`）在设计上就是全组唯一的 1 分题，其余三题是 2 分题。逐一核对
（脚本核对，见下）发现：07 / 08 / rail-time / smell-of-rain 四天的第三题
评分标准都正确写「一分：……」，唯独 09-salt 这一组把第三题（甘地那道）的
评分标准写成了「两分：行为……与……各 1 分」的两点模板——**内容作者用错
了模板，`marks: 1` 这个赋值本身完全正确**。

（复核用的一次性脚本：把 `HUMAN` 对象逐组按 `i` 打印 `rubric` 声明分数与
`i===2?1:2` 的赋值对比，五组里只有 salt 组在 `i=2` 处不一致；未保留为仓库
脚本，过程见本节文字，结论已经被下方的自动化测试钉住。）

### 只读核对生产（未打印学生姓名或作答原文）

```
paperQuestion  p1_ielts_light_20260909_pq09  marks=1  sortOrder=9
question       p1_ielts_light_20260909_q09   marks=1
paper          p1_ielts_light_20260909_paper totalMarksActual=13 totalMarksTarget=13
               pqCount=10 pqMarksSum=13   ← 总分内部自洽，marks=1 从发布起就没变过
scripts (AnswerScript, group by)：
  submissionStatus=marked, finalSubmitted=true, submitSource=student,
  awardedMarks=1, marked=true, hasMarker=true, answered=true, maxScore=13, n=2
submissionsForPaper：in_progress×1（还没做到这题）、marked×2（都已判且都有这题的作答）
appeals=0  retraction=0
```

同卷 `pq09`（siblingPq09，10 条）全部 `marks=1`；只有 09-09 这条的 rubric
文字是「两分」，其余都是「一分：……」——与上面的根因分析完全对得上。

**结论**：`marks=1` 从发布起就是对的，两个学生当时都拿了满分（1/1），
**没有学生被少判分**。唯一的问题是评分标准文字与分值自相矛盾，容易让日后
复核的人（老师、家长、或另一个批改会话）看着「两分」的文字却只给了 1 分
而怀疑判错。

### 已经做的修复

1. **发布路径回归**（属于 PUB03 的一部分，见上）：`publish-gates.js` 的
   `rubricMarksConflict` 在发布前逐题检查评分标准声明的分数是否等于满分，
   09-09 这种矛盾若发生在未发布的日期上会被拒绝，一行都不写。
   `publish-gates.spec.ts` 用当年这道题的真实文字做回归用例
   （`两分：行为…与…各 1 分`, marks=1 → 必须报「开头写 2 分，满分却是 1
   分」）。
2. **内容文件订正**：`week2/ielts_light.js` 里这道题的评分标准改成
   「一分：写出「走到海边自制盐」或「打破了英国对制盐的垄断」任一点即可
   给分。」——与同组其余三天第三题的「一分」风格一致，与 `marks=1` 不再
   矛盾。改动处保留了详细注释说明根因与决策依据。
3. **测试同步更新**（不是弱化，是把「历史真实 bug」的证明方式换成「克隆
   夹具复现」，检查逻辑本身的抓漏能力不变）：
   - `pilot-week-content.spec.ts`：原「09-09 甘地那道题会被抓到」测试
     改为断言订正后一致；新增一条用克隆对象复现订正前文字，证明
     `declaredMarks` 这个检查函数本身仍然认得出这类矛盾。
   - `publish-gates.spec.ts`：「六十个档×天」测试从「只有 09-09 过不了」
     改为「全部可发」；新增一条直接断言 09-09 现在的评分标准与 marks 一致。

### 尚未做、需要用户授权的部分

**生产里的冻结快照文字没有改**——`PaperQuestion.snapshotAnswer.rubric` /
`Question.answerContent.rubric` 仍然是订正前的「两分：……」。这是 PUB01
明确保护的「已被使用的版本，发布脚本不能改」范围，需要走独立的、经授权的
纠错脚本，不是本次内容文件修改的一部分。

已准备好、**未执行**的一次性订正脚本：
`apps/api/scripts/fix-20260909-gandhi-rubric-text.ts`

- 只订正 `snapshotAnswer.rubric` / `answerContent.rubric` 这一个 JSON 字段
  的文字，`text` / `evidence` / `explanation` 原样保留；
- **不改 `marks`，不碰任何 `AnswerScript.awardedMarks` 或
  `StudentSubmission` 分数**——两个学生当时的判分本来就是对的，不需要
  重算；
- 默认 dry-run（只打印现状与将写入的值，连库都会连，但只做 SELECT）；
  写库需要显式 `P1_CONFIRM=S12M_FIX_20260909_RUBRIC_TEXT`；
- 写之前会核对库里现状与预期的「订正前文字」逐字相等，不一致就拒绝执行
  （防止误伤已经被别的方式改过的行）。

dry-run 命令（**本次会话未执行**）：

```bash
railway run -s Postgres -e production -- \
  npx ts-node apps/api/scripts/fix-20260909-gandhi-rubric-text.ts
```

**是否要执行这一步，等用户看过本节后决定**（见文末「需要用户授权的真实
数据操作」）。不执行也不影响学生成绩的正确性——已经是对的；执行的价值
纯粹是让生产记录的文字自洽，避免以后复核时的困惑。

**实测结果**：`publish-gates.spec.ts` 19/19、`pilot-week-content.spec.ts`
1094/1094 通过（含新增的两条）。

---

## OPS01 · 新学生端未纳入完整构建/CI 门禁

**状态：已修复（仓库内可控部分），已验证；分支保护/部署门禁列为外部待办。**

**原症状**：根 `package.json` 的 `build` / `test:all` / `typecheck` 只覆盖
`@app/api` 与 `@app/web`（教师/管理端），`@app/student-web` 完全没被跑到；
CI workflow 同理。`apps/ops-dashboard/server.js`（独立部署到 Railway 的一个
小 Express 服务）没有任何语法/构建检查。

**修复位置**：
- `package.json`：`build` / `test:all` / `typecheck` 三个聚合脚本都加上
  `@app/student-web`；新增 `build:student-web` / `test:student-web` /
  `typecheck:student-web` / `dev:student-web` 单跑入口；新增
  `check:ops-dashboard`（`node --check apps/ops-dashboard/server.js`）。
- `.github/workflows/ci.yml`：三步分别改名为「api + web + student-web」，
  新增一步 `Syntax-check ops-dashboard server.js`。
- pilot 发布脚本的 spec（`scripts/pilot/__tests__/*.spec.ts`）确认本来就在
  vitest 默认 include glob 里，随 `npm run test -w @app/api` 一起跑，不需要
  单独的 CI 步骤（已核实：本次新增的 5 个 pilot spec 文件全部出现在
  `npm run test -w @app/api` 的输出里）。

**实测结果**：
- `npm run typecheck`：api / web / student-web 三个都通过。
- `npm run test:all`：api 3069 passed + 9 skipped、web 251/251、
  student-web 908/908。
- `npm run build`：api / web / student-web 三个都构建成功。
- `npm run check:ops-dashboard`：通过（语法正确）。
- `.github/workflows/ci.yml` 经 `js-yaml` 解析确认语法合法（本地没有跑
  GitHub Actions runner，没有实际触发一次线上 CI）。

**剩余依赖（外部待执行，本次会话无权限代为配置）**：
1. **分支保护**：GitHub 仓库设置里给 `main` 加「required status check」
   指向这条 CI，需要仓库管理员权限。
2. **Railway 自动部署门禁**：Railway 目前是「push 到 main 即自动部署」，
   与 GitHub Actions 的结果无关联；要做到「CI 不过就不部署」，需要在
   Railway 项目设置里把部署触发源从 GitHub push 改为 GitHub Actions
   成功后的 deploy hook（或改用 Railway 的「Wait for CI」类似功能），
   需要 Railway 项目的部署配置权限。
3. 以上两项都没有代为配置，也不假称已配置。

---

## OPS02 · 依赖安全告警复核

**状态：只读复核完成；未执行任何修复（未跑 `npm audit fix`，未改锁文件，
未升级任何包）。**

`npm audit --omit=dev --json`（工作树根目录）：**19 条，8 high / 10
moderate / 1 low / 0 critical**——与审计基线数字完全一致，无漂移。

逐条可达性复核（结论：**多数是构建期/内部依赖链，真正暴露给外部输入的
只有 multer 与 qs**）：

| 包 | 严重度 | 真实可达性 | 结论 |
| --- | --- | --- | --- |
| **multer** 2.0.2 | high（7 条 CVE，多是多段表单字段名 DoS） | **可达**：`homework.controller.ts` / `student-homework.controller.ts` 用 `FilesInterceptor` 接学生/老师的作业上传（`fileSize: 25MB`、最多 10–15 个文件），认证用户可发送畸形 multipart 请求 | 优先级最高的一条；多个 CVE 是字段名解析层面的资源耗尽，不受当前 `fileSize` 限制约束 |
| **qs** 6.14.2（经 body-parser） | moderate | **可达**：Express 的 `urlencoded` 中间件与查询串解析都经过 qs，任何请求都会经过 | 需要刻意构造的畸形数组/逗号语法才触发，DoS 而非数据泄露 |
| **body-parser** 1.20.4 | low | 低：`main.ts` 显式设置 `limit: '2mb'`（合法字符串），漏洞是「无效 limit 值静默失效」，本项目的配置值本身合法 | 复核后判定不可达 |
| **@nestjs/common → file-type → fflate** | moderate（各一条 DoS） | **不可达**：全仓没有任何地方调用 `FileTypeValidator` / `ParseFilePipe` 或直接 `require('file-type')`；`file-type` 只是 `@nestjs/common` 打包进来、从未被本项目代码触发的依赖 | 不可达，优先级最低 |
| **js-yaml**（经 `puppeteer`→`cosmiconfig` 与 `@nestjs/cli`→`cosmiconfig`） | high（CPU DoS） | **不可达**：`cosmiconfig` 只在进程启动时读**本地、受信任**的配置文件（如 `.puppeteerrc`），不解析任何外部/用户输入的 YAML | 不可达 |
| **exceljs → uuid** 8.3.2 | moderate | **基本不可达**：漏洞要求调用方显式传入 `buf` 参数；exceljs 内部生成 id 用的是默认无 buffer 的调用形式（未逐行核对 exceljs 源码，判断依据是常见用法模式，标记为「基本不可达」而非「确认不可达」） | 低优先级 |
| **puppeteer / puppeteer-core / @puppeteer/browsers / extract-zip** | high（symlink 遍历/任意文件写） | **不可达**：`extract-zip` 只在 `npm install` / `puppeteer browsers install` 阶段解压**从官方 CDN 下载的 Chromium 二进制**，不解压任何运行期用户输入的 zip；本项目用 puppeteer 生成 PDF，运行时不涉及解压第三方 zip | 构建期风险，不是运行期攻击面 |
| **react-router / react-router-dom** 6.30.6 | moderate（open redirect / SSR 反序列化注入） | **不可达**：两端都是纯客户端 Vite SPA，没有 SSR，「SSR Hydration」CVE 无适用场景；仓库内没有找到任何 `useSearchParams` 驱动的动态 `Navigate to=`/`useNavigate()` 目标（已 grep 排查），open-redirect 的利用前提不存在 | 不可达 |
| **@nestjs/config → lodash** ≤4.17.23 | high（原型污染/`_.template` 代码注入） | **基本不可达**：`@nestjs/config` 只在启动时用 lodash 合并**本地配置对象**（`.env` / 代码里写死的默认值），不处理运行期外部输入 | 低优先级 |
| **@nestjs/core**（GHSA-36xv-jgw5-4q75，输出转义不当/注入） | moderate | 未逐行核对具体触发路径（需要读 NestJS 内部异常渲染代码），标记为「未定级，需要下一轮专门复核」 | 未定级 |

**可用的安全修复路径（本次未执行，因为不能在此工作树/主仓库运行
`npm install`）**：

- `npm audit` 报告里 `fixAvailable: true`（**不需要任何父包升级主版本，
  原地打补丁即可**）的有：`@nestjs/common`（连带修 file-type/fflate）、
  `js-yaml`、`qs`。这三个可以用不带 `--force` 的 `npm audit fix` 解决，
  风险最低，**建议下一个有 `npm install` 权限的会话优先做**，做完跑一遍
  上传（homework）与 PDF/puppeteer 相关回归。
- `multer` 的可达修复需要 `@nestjs/platform-express` 升到 12.0.1（npm
  audit 认为这是 major bump）——但 `@nestjs/platform-express@10.4.22`
  对 multer 是**精确版本**依赖（`"multer": "2.0.2"`，不是 range），multer
  本身从 2.0.2 → 2.3.0（修完全部已知 CVE）只是**同大版本的 minor bump**，
  理论上可以用 `package.json` 的 `overrides` 字段强制 multer 版本而不动
  NestJS 版本；**这条没有实测**（本次环境不能跑 `npm install`），需要下一
  个有安装权限的会话验证 `overrides: { "multer": "2.3.0" }` 之后 NestJS
  的 `FilesInterceptor` / `MulterModule` 行为是否兼容，并跑一遍上传回归
  再决定要不要落地。
- `exceljs → uuid`：`npm audit fix` 给出的建议是把 `exceljs` **降到**
  3.4.0（比当前 4.4.0 低），这是 npm 解析算法的误导性建议，**不要采纳**；
  真正安全的路径是 `overrides` 强制 `uuid@^11`，但需要验证 exceljs 4.4.0
  对新版 uuid 的 ESM/CJS 互操作是否兼容，未测试。
- `react-router-dom`：修复需要升到 7.x（major bump），鉴于两个前端应用的
  实际攻击面（无 SSR、无动态重定向目标）判定为不可达，**建议列为「已知、
  暂不处理」，不是本轮优先级**。

**禁止事项均已遵守**：本次会话没有跑 `npm audit fix`（含 `--force`），
没有升级任何包的主版本，没有修改 `package-lock.json`。

---

## OPS03 · 错误监控、任务失败告警

**状态：现状复核 + 最小可行方案已写；DSN/接收方需用户提供，未擅自开通任何
收费订阅。**

**现状**（只读核对，2026-09-11 当次会话）：
- `apps/api/src/instrument.ts` 已经实现 Sentry 接入（09-10 那次 502 事故
  后加的）：`SENTRY_DSN` 未配置时 `Sentry.init` 完全不调用（fail-safe，
  不影响服务启动）；`sendDefaultPii: false`，不采集请求体/cookie/header；
  `release` 用 `RAILWAY_GIT_COMMIT_SHA`，能对回具体部署。
- 生产 `/api/health` 实测：`"monitoring":"off"`——**代码已经就绪，但生产
  没有配置 `SENTRY_DSN`**，当前完全没有错误聚合/告警。
- 前端（`apps/student-web/src/lib/sentry.ts`、`apps/web` 的
  `ErrorBoundary.tsx`）同样是「配了 DSN 才生效」的模式，同样未在生产配置。
- 本次只读运行 `apps/api/scripts/ops/daily-ops-check.ts` 发现一条真实的
  「长期 running 未收尾」的内容任务（见下），证明「卡住的内容任务没有
  自动发现机制」不是假设性风险。

**本次新增（可用、不需要额外收费服务）**：
`apps/api/scripts/ops/daily-ops-check.ts`——只读巡检脚本，两件事：
1. `VocabularyContentJob` 停在 `running` 超过阈值（默认 30 分钟）；
2. 从今天起 N 个教学日（跳过周末）的五档发布与场次覆盖（这条同时服务
   OPS04，见下）。

生产实测（2026-09-11，`--days=7 --stuck-min=30`）：

```
== 卡住的内容任务 ==
cmtjq1lx008tqutrz8fu8pant  sense=cmtjif5a400qve8d08yhbvdk3
  provider=tatoeba+azure_translator  跑了 12871 分钟（约 8.9 天）  attempts=1
```

这条任务从很早期就卡在 `running`，此前没有任何机制发现它——直接证明了
OPS03 问题陈述里「卡住的内容任务无告警」是真实存在、不是假设。**本次只
读出这一条，没有做任何写库操作去清理/重置它**——是否要人工把它标记为
`failed` 或重新入队，属于内容流水线的运维决定，不在本次只读审计授权范围
内，留给用户/下一次内容流水线会话处理。

**最小可行方案（分阶段，按缺什么写清楚，不是全量 Sentry 落地）**：

1. **立即可做、零成本**：把 `daily-ops-check.ts` 接到一个定时任务（cron 或
   `railway run` 手动/`scheduled-tasks` 技能）——只要每天跑一次并把非零
   退出码报给人看，就能补上「卡住的任务」「今天到未来 5 个教学日缺内容」
   这两类目前完全没有告警的场景。这一步不需要 Sentry、不需要新的收费
   服务，脚本本身已经具备。
2. **中期（需要用户提供接收方）**：给 `daily-ops-check.ts` 加一个可选的
   webhook（企业微信群机器人 / Slack / 邮件，任选其一都行）——**这一步
   需要用户提供一个 webhook URL 或邮箱**，本次没有代为选择或开通。
3. **如果要请求失败追踪/关联**：`SENTRY_DSN` 配置到 Railway 的 `Postgres`
   （不对，是 `exam-paper-system`/`student-web`/`nurturing-radiance`
   三个服务）的环境变量里——Sentry 免费版额度通常够用，但**开通 Sentry
   账号本身、拿到 DSN 是需要用户操作的一步**（代码侧已经就绪，读到 DSN
   立即生效，不需要再改代码）。是否要开这个免费账号，请用户决定；本次
   没有代为开通任何账号。
4. **脱敏已经到位**：学生端 URL 本来就不带姓名/studentId（身份规则），
   Sentry 配置里 `sendDefaultPii: false`——按现有规则，即使开了 Sentry，
   事件里最多出现路径/方法/状态码/堆栈，不会出现密码/token/完整学生作答。

**现有日志能满足的部分，不强制上 Sentry**：Railway 自带的部署日志 +
`prepare-pilot-week.js` 已有的分阶段 `[秒数 · 查询次数]` 进度输出，已经能
覆盖「发布卡在哪一步」这类场景（`docs/HANDOFF-TO-CLAUDE-2026-09-03.md`
§6.4「发布的教训」）；OPS03 缺的是**日常、非发布时段**的被动监控，
`daily-ops-check.ts` + 定时任务是针对这个缺口的最小方案。

---

## OPS04 · 未来教学日内容供给复核

**状态：已按最新生产状态只读核对，缺口明确，未发布任何内容。**

用 `daily-ops-check.ts` 与 `ro-prod-audit-1.js`（前一位工作者写的只读聚合
脚本，本次重新在同一时点重跑过一次，两次结果逐字节相同，确认无漂移）
在生产上只读核对：

| 日期 | 星期 | 本地内容包 | 生产发布状态 | 场次 |
| --- | --- | --- | --- | --- |
| 2026-09-11 | 五（今天） | 有 | **已发布** | 50/50 |
| 2026-09-14 | 一 | 有 | **已发布** | 50/50 |
| 2026-09-15 | 二 | 有 | **已发布** | 50/50 |
| 2026-09-16 | 三 | **没有** | 未发布 | 0/50 |
| 2026-09-17 | 四 | **没有** | 未发布 | 0/50 |
| 2026-09-18 | 五 | **没有** | 未发布 | 0/50 |
| 2026-09-21 | 一（下周） | **没有** | 未发布 | 0/50 |

（「场次」= 五档 × 十个试点班 = 50；已发布的三天每天都是满额 50。）

09-11/09-14/09-15 与任务描述里「09-14、09-15 已发布各 50 场」完全对得上，
证明这不是过期快照。**真正的缺口从 09-16（周三）开始，到本次检查覆盖到
的 09-21 为止，本地内容包（`scripts/pilot/content/week3/`）里一天都还没
写**——`content.DATES` 目前止于 `2026-09-15`。

`MORNING_QUIZ_DAILY_FALLBACK` 已于 09-11 关闭（CLAUDE.md 已确认），所以
09-16 没写完的直接后果是：那天学生打开 App 会看到「今天的课程还没有发布」，
**不会**被静默塞旧题库的卷子——这是产品已经决定要的行为，不是本次要修的
bug；本节只负责把缺口日期和范围说清楚。

**不在本次授权范围内**：本次会话没有写文章、没有出题、没有发布任何一天
的内容——铁律不变（写文章/出题/审题在聊天里做，不调用付费模型）。

---

## OPS05 · 备份恢复、容量、真实设备验证

**状态：方案已写；实际执行缺关键前置条件（真机、独立可压测环境），本次
未做，如实列出未验依赖。**

### 5.1 备份恢复演练

只读核对到的现状：
- Railway 托管 Postgres，卷 `postgres-volume` 已用 2094MB / 50000MB
  （4.2%，容量有充足余量）。
- Railway CLI 没有暴露备份策略的只读查询命令（`railway volume list` 只给
  卷的挂载与用量，不给备份计划/保留期）——**Railway 是否已经给这个
  Postgres 开启自动备份、备份保留几天，需要在 Railway 网页控制台的
  Postgres 服务设置里查看，CLI 查不到，本次没有代为确认**。

**可执行方案**（下一个有 Railway 控制台访问权限、且被授权做恢复演练的
会话）：
1. 网页控制台确认当前备份策略（有没有开、保留几天、是否为 PITR）。
2. 在**新建的、独立的** Railway Postgres 实例（不是生产库）里恢复一份最近
   的备份。
3. 恢复后跑只读核对（可以直接复用 `ro-prod-audit-1.js` 之类的聚合查询）
   确认关键表的行数、几个已知的关键记录（比如本轮台账 PUB03 提到的
   `pub03.deliveredRows=1286`）能对得上。
4. 记录耗时与是否有数据缺口，写进下一版台账。

**未验依赖**：需要 Railway 项目的「新建服务/还原备份」权限，本次会话未
执行（避免在没有明确恢复演练授权的情况下操作生产关联的备份系统）。

### 5.2 班级同时答题容量

代码侧已知信息：发布脚本的教训（09-11，见 handoff §6.4）显示单次发布
约 650 次数据库查询、三四分钟，跨洋公网代理单次往返约 0.44 秒——这是
**发布**（写路径、老师侧、低频）的实测数据，不是**学生同时交卷**（读写
混合、高频、并发）的容量数据，两者不能互相替代。

**未验依赖**：没有独立于生产的可压测环境（不能压测生产），也没有构造
「50 个试点班 × 若干学生同时保存/交卷/查词」的并发脚本并实际跑过。
**可执行方案**：在专门的 staging/scratch 环境（若用户能提供一个独立
Postgres + API 部署，不复用生产库）里，用类似 `pilot-publish.db.spec.ts`
的 PGlite 或一个真实的 staging Postgres，写一个并发压测脚本模拟保存/
交卷/查词的高峰并发，记录 p50/p95 延迟与失败率。本次没有这样的环境，
未执行。

### 5.3 真机 / PWA 全流程

**未验依赖**：本次会话没有 iPhone/iPad/Android 真机，浏览器视口模拟
（如 `resize_window` 的 mobile/tablet 预设）不能替代真实触控、真实 Safari
的 PWA 安装流程、软键盘遮挡等场景——这在审计文件 §8.2 里已经明确要求
「浏览器视口模拟、真机触控、真实 PWA 安装分别记结果，不混称」。

**可执行方案**：需要用户或老师提供至少一台 iPhone、一台 iPad 跑一次完整
「Safari 打开 → 添加到主屏幕 → 独立窗口登录 → 阅读 → 交卷 → 学词 → 正式
测验」流程，并截图关键成功/失败态。本次未做，不假称已验证。

### 5.4 付费 API 故障与延迟预算

代码侧已确认：`MORNING_QUIZ_AI_GRADING` 默认关闭（不触发 Anthropic
API）；`ShortAnswerEvaluatorService` 在 `ANTHROPIC_API_KEY` 未配置时返回
`null` 而不是抛错或挂起（本次全量测试的日志里能看到这条 WARN，行为符合
预期：缺配置时明确不可用，不是静默假装成功）。`RealtimeTranslation` 与
`WritingCheckService` 同样在依赖服务失败时有降级路径（测试日志里的
`translation_failed:azure_429`、`mymemory_fallback:mymemory_429`、
`writing check failed: ECONNREFUSED` 均为**测试里刻意模拟的失败场景，
验证降级路径**，不是生产故障）。**没有在生产环境真的制造一次 Azure
Translator / LanguageTool 故障来测延迟预算**——这需要短暂调整生产配置
制造真实故障，风险与授权都超出本次只读审计范围，列为未验依赖。

---

## OPS06 · 正式入口一致性（manifest / 二维码 / 分享链接 / 推送）

**状态：只读核对完成，当前部署未发现 staging 泄漏；一处历史遗留说明写
在下面，未修改 `apps/student-web` / `apps/web`（按要求只报告不改）。**

### 核对方法与结果

1. **PWA manifest**：`apps/student-web/public/manifest.webmanifest`
   （`start_url: "/today"`）与 `apps/web/public/manifest.webmanifest`
   （`start_url: "/my-lesson"`）都用**相对路径**，不含任何域名——manifest
   本身不可能把 staging 域名带进生产部署。
2. **实际部署产物核对（浏览器直接抓生产构建产物，只读，未登录）**：
   - `https://student-web-production-5a21.up.railway.app` 的
     `index-BeFwJ9yB.js`（442,600 字符）里唯一出现的 `*.up.railway.app`
     域名是 `exam-paper-system-production.up.railway.app`（正确的生产
     API）——`VITE_API_URL` 在这次构建里配置正确，没有 staging 域名。
   - `https://nurturing-radiance-production.up.railway.app`（教师端）的
     构建产物同样只包含 `exam-paper-system-production.up.railway.app`。
   - 两处都确认是本次审计当次实测（不是读代码推断）。
3. **Staging 免密夹具登录**（`apps/api/src/student-auth/staging-fixture-login.ts`
   + `apps/student-web/src/pages/Login.tsx`）：这是一条已经存在、专门给
   staging 真机验证用的临时登录后门，本身有三层自我保护——
   `STAGING_FIXTURE_LOGIN` 必须逐字等于 `t6_done`，`RAILWAY_PROJECT_ID`
   必须逐字等于 staging 项目 id，`RAILWAY_PUBLIC_DOMAIN` 必须逐字等于
   staging 的 API 域名——生产的这三个值不可能同时满足，属于「配置缺失/
   不匹配就安全失败」的设计。**实测**：生产的登录页（对应源码里的
   `stagingFixtureLoginEnabled()` 判定）没有渲染「Staging：一键登录测试
   六号」按钮，前端构建里虽然打包了 `t6_done` 这个字符串常量（比较用，
   不代表已启用），但实际渲染结果确认功能未激活。**建议**（不是本次
   OPS06 范围内的修改）：既然试点已经上线，这条临时通道按它自己的文件
   头注释（「上线前必须拆掉」）已经到了该退役的时间点，建议开一个独立的
   小任务专门做这件事（涉及删除 `apps/api/src/student-auth/staging-fixture-login.ts`
   与前端对应代码，超出「只报告不改前端」的 OPS06 范围，故未在本次动手，
   已用 `spawn_task` 机制提请后续处理）。
4. **QR / 分享链接生成**（`apps/web/src/pages/MorningQuizQrPrint.tsx`、
   `MorningQuizDisplay.tsx`、`InstallGuideSheet.tsx`）：全部用
   `window.location.origin` 动态拼接，不是硬编码域名——代码本身没有把
   staging 域名写死的 bug。**用户此前发现的「二维码指向 staging」更可能
   是操作层面的问题**：有人在 staging 部署的教师端页面上打开/打印了二维
   码，而不是代码缺陷。建议运维层面提醒：生成/打印给学生的二维码，一律
   从生产域名 `nurturing-radiance-production.up.railway.app` 打开该页面。
5. **推送通知链接**：`push-reminder.rules.ts` 里的 `url: '/today'` 是相对
   路径，由 Service Worker 在点击时用自身注册的 origin 解析——不会跨域
   打开 staging。
6. **API 侧生成链接的地方**（按要求，这部分若有问题本次可以直接改）：
   `qr.service.ts` 只签发 token，不拼接完整 URL；`push.service.ts` 同样
   不在服务端拼域名。**核实后没有需要修改的地方**。

### 未覆盖的部分

- 没有检查独立的 staging Railway 项目本身（`ed8c31c0-...`）当前的
  `VITE_API_URL`/`VITE_STAGING_FIXTURE_LOGIN` 配置——本次 Railway CLI
  只链接到生产项目 `glorious-motivation`，没有 staging 项目的访问权限，
  也没有必要为了这条只读检查去申请另一个项目的权限。
- 安装说明的 PDF/图片文案本身没有重新审查——按指示「未经要求不重做已
  确认 PDF 文案」，只检查了其中出现的 URL 是否可能因为动态拼接而跨环境
  出错（结论：不会，见上）。

---

## OPS07 · 全量回归基线

**状态：已重新建立，记录如下（最终 HEAD `2feae25`）。**

### 命令与退出码

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| API 单测 | `cd apps/api && npx vitest run` | **137 files passed, 1 skipped**（`pilot-publish.db.spec.ts`，见下）；**3069 passed, 9 skipped**，退出码 0 |
| API 单测（含隔离库集成测试） | `PILOT_IT_DATABASE_URL=... npx vitest run scripts/pilot/__tests__/pilot-publish.db.spec.ts` | **9/9 passed**，退出码 0 |
| API 类型检查 | `npm run typecheck -w @app/api` | 通过，退出码 0 |
| API 构建 | `npm run build -w @app/api` | 通过，退出码 0 |
| 学生端单测 | `npm run test -w @app/student-web` | **40 files, 908/908 passed**，退出码 0 |
| 学生端类型检查 | `npm run typecheck -w @app/student-web` | 通过 |
| 学生端构建 | `npm run build -w @app/student-web` | 通过（`dist/` 产物：JS 442.46kB / gzip 140.94kB） |
| 教师端单测 | `npm run test -w @app/web` | **38 files, 251/251 passed**，退出码 0 |
| 教师端类型检查 | `npm run typecheck -w @app/web` | 通过 |
| 教师端构建 | `npm run build -w @app/web` | 通过 |
| ops-dashboard 语法检查 | `npm run check:ops-dashboard` | 通过 |

**与开工基线对比**：API 3020/3020 → 3069 passed + 9 skipped（净增 52 条：
`publish-gates.spec.ts` 18 + `prepare-pilot-week-freeze.spec.ts` 25 +
`pilot-publish.db.spec.ts` 9[默认 skip] = 52，与新增测试数量精确对上）；
学生端 908/908、教师端 251/251 与基线**逐位相同**，确认没有引入学生端/
教师端回归。原基线提到的「WIP 周内容对 Gandhi 评分点的断言 expected 2/got
null」那一条失败，属于当时未提交的 WIP，本次以 CONTENT01 的方式正式修复
并补了回归，不是「删掉了失败断言」。

**未回退任何现有测试**：全程只新增/按需调整了因内容订正而需要更新的两处
断言（`pilot-week-content.spec.ts` 的 09-09 甘地题、`publish-gates.spec.ts`
的「六十个档×天」清单），两处都改成了更严格或对等的验证方式（克隆夹具
复现历史 bug），没有删除或弱化任何断言。

**`npm run test:all` 连跑三端时观察到的偶发超时（与本次改动无关）**：单独
跑 `test -w @app/web` 两次都是 251/251；但在同一 shell 里连续跑完 api →
web → student-web 三套（外加本机当时还开着 PGlite 服务、浏览器标签页）之
后，`@app/web` 出现过一次 2/251 因 `Test timed out in 5000ms` 失败
（`Me.test.tsx`、`MyVocabQuiz.test.tsx`，都是账号/生词页，与本次改动的
pilot 发布脚本毫无关系），单独重跑立即转绿。判断是本机资源竞争下的计时
类偶发抖动，不是断言层面的真实回归——但如果 CI runner 资源紧张，
`test:all` 一次跑三端也可能出现类似抖动，值得留意；不建议因为一次偶发
超时就去调大全局 `testTimeout` 掩盖过去，真出现时应先看是不是资源问题。

### 隔离测试数据库（Docker 本机坏了，用 PGlite 代替）

`.local/tools/pglite/`（gitignored，独立目录，未触碰仓库 node_modules）：

```bash
cd .local/tools/pglite && npm init -y && \
  npm install @electric-sql/pglite @electric-sql/pglite-socket
```

`server.mjs` 起一个监听 `127.0.0.1:55432` 的 PGlite socket 服务（Postgres
wire 协议，真实事务/触发器/约束语义）。踩过的两个坑（已写进
`server.mjs` 与 `pilot-db.ts` 的注释里，供下次直接复用）：

1. **连接串必须带 `pgbouncer=true`**——否则同一个 PGlite 后端服务的多条
   TCP 连接共享 prepared statement 命名空间，第二条连接一建立就报
   `prepared statement "s0" already exists`（42P05）。
2. **`PGLiteSocketServer` 的 `maxConnections` 默认是 1**——上一条连接的
   进程退出、到服务端把它从活跃连接表摘除之间有个异步窗口，紧接着来的
   下一条连接会被当作「连接数超限」直接拒绝，Prisma 把这个错误包装成
   语焉不详的 `Can't reach database server`。`server.mjs` 里已经调到 8。

起服务、跑 migration、跑集成测试的完整流程：

```bash
# 1. 起服务（用真正独立于 Bash 工具进程树的方式启动，避免工具调用结束
#    时把子进程一起杀掉——这是本次踩到的第三个坑：用 Bash 里 `cmd &`
#    起的后台进程，在下一次 Bash 工具调用时可能已经不响应新连接了）
cd .local/tools/pglite && node server.mjs &   # 或用系统级的进程管理方式

# 2. 建表（用仓库的 Prisma schema，一次性）
cd apps/api && DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable&connection_limit=1' \
  npx prisma migrate deploy

# 3. 跑集成测试
PILOT_IT_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable&connection_limit=1&pgbouncer=true' \
  npx vitest run scripts/pilot/__tests__/pilot-publish.db.spec.ts
```

Prisma 与 PGlite **兼容**（不需要退回内存假事务）：9/9 通过，包括真实
事务回滚、触发器故障注入两类只有真实 Postgres 语义才能验证的场景。

**CI 上的行为**：`pilot-publish.db.spec.ts` 用 `describe.skip`（当
`PILOT_IT_DATABASE_URL` 未设置时）——已验证 `npx vitest run`（不设这个环境
变量）时该文件显示为 `1 skipped / 9 skipped tests`，退出码仍是 0，不会让
常规 CI 变红。

---

## 需要用户授权的真实数据操作（dry-run，本次均未执行）

1. **CONTENT01**：`apps/api/scripts/fix-20260909-gandhi-rubric-text.ts`——
   只订正 `p1_ielts_light_20260909_pq09` / `_q09` 冻结快照里的评分标准
   文字（`两分：……` → `一分：……`），不改 `marks`、不碰任何学生分数。
   Dry-run 命令见 CONTENT01 一节。**不执行也不影响任何学生的实际分数**，
   纯粹是让生产记录的文字自洽。

## 外部待执行项（本次会话无权限，未假称已完成）

1. **OPS01**：GitHub 仓库分支保护（`main` 需要这条 CI 通过）——需要仓库
   管理员权限。
2. **OPS01**：Railway 自动部署改为「CI 通过后才部署」——需要 Railway
   项目部署配置权限，当前仍是「push 到 main 即自动部署」。
3. **OPS02**：`npm audit fix`（`@nestjs/common`/file-type/fflate、
   js-yaml、qs，均为原地打补丁、不涉及主版本升级）——需要能在有
   `npm install` 权限的环境里执行并跑一遍上传/PDF 回归，本工作树/主仓库
   规则不允许在此运行 `npm install`。
4. **OPS02**：`multer` → 2.3.0、`uuid` → 11.x 的 `overrides` 方案——需要
   验证兼容性，同样需要 `npm install` 权限的环境。
5. **OPS03**：开通 Sentry 账号拿 `SENTRY_DSN`，或提供一个 webhook 接收方
   （企业微信/Slack/邮件）——需要用户决定要不要开，本次未代为开通任何
   订阅。
6. **OPS04**：`scripts/pilot/content/week3/` 补齐 09-16 起的内容（写文章、
   出题、审题按铁律在聊天里做，不调用付费模型）——这是内容创作工作，
   不在本次「发布/一致性/运维」审计范围内，只负责把缺口说清楚。
7. **OPS05**：Railway 控制台确认 Postgres 备份策略、做一次独立环境的恢复
   演练；独立于生产的并发压测环境；至少一台 iPhone/iPad 的真机 PWA 全
   流程验证——均需要用户提供环境/设备/权限。
8. **OPS06**：`staging-fixture-login` 通道的退役——已用 `spawn_task`
   提请为独立任务，不在本次一并处理。
