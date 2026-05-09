# 学生流程零负担审查 + Dan 老师减负审计

> 审查时间: 2026-05-09 (本地工作树 HEAD = `81c55b5`,origin/main HEAD = `5bb3a04`,题型注册表 push 之后 7 commit)
> 审查者: Claude (Cowork)
> Ground truth: 用户口述场景 + 代码仓库实际行为

本报告按用户提的五个问题顺序回答。每条结论都附 `路径:行号` 锚点,可以从 git blame 复核。

---

## Q1 · A-Level vs O-Level: 怎么区分?

### 1.1 实际枚举值

仓库里有**两个**与"等级"相关的字段,容易混淆:

| 字段 | 类型 | 取值 | 用途 |
|---|---|---|---|
| `Class.level` | `String?`(自由文本) | `"O-Level"` / `"A-Level"` / null | 给老师看的便签,**没有任何代码逻辑读它** |
| `ClassEnglishLevel.level` | `EnglishLevel` enum | `ielts_authentic` / `ielts_hard` / `olevel` | **真正驱动早测出卷分支** |

枚举定义见 `apps/api/prisma/schema.prisma:1293-1297`:

```prisma
enum EnglishLevel {
  ielts_authentic
  ielts_hard
  olevel
}
```

**没有 `alevel` 这一档**。这是设计选择不是疏漏 ——「A-Level 英语班」和「准备雅思的班」实际上指向同一类教学目标(IELTS Reading-style 训练),所以 schema 把"A-Level English 班"映射到 `ielts_authentic` 或 `ielts_hard`。

### 1.2 链路追踪: scan → paper → render

用户问"student → class enrollment → class.level → paper.config.mode → 前端 paperMode → QuestionTypeRegistry 选组件"是否完整。

**实际链路是这样**(从 schema/服务/前端三处对照):

```
学生扫码 (MorningQuizScan.tsx)
    │
    ▼
attendance.service.ts:114-130  ─ 通过 ClassEnrollment 反查 student
    │
    ▼
session.classId  ──── (老师周日批量出卷时已经做过)
                 │
                 ▼
       morning-quiz.service.ts:244-270  读 ClassEnglishLevel
                 │
        ┌────────┼─────────────────────┐
        ▼        ▼                     ▼
  ielts_authentic  ielts_hard        olevel
        │        │                     │
        ▼        ▼                     ▼
  pickPassageAndCreatePaper  QuickPaperService.generate(syllabusCode='IELTS', diff=5)
    (passage_pick)            QuickPaperService.generate(syllabusCode='1123', diff=2)
        │                              │
        ▼                              ▼
    Paper.config = {mode:'passage_pick',     Paper.config = AI 生成的 metadata
                    passageRef:'IELTS/8/Test1/P1', ...}    (没有 mode 字段)
        │                              │
        └──────────────┬───────────────┘
                       ▼
              PaperAssignment
                       │
                       ▼
         MorningQuizSession.paperAssignmentId
                       │
                       ▼
       学生扫码后 → /morning-quiz/:sessionId
                       │
                       ▼
       morning-quiz.service.ts:545-621  getStudentView
                       │
       读 paper.config.mode 决定洗牌策略:
       - passage_pick:不洗题序、不洗选项 (matching_features 的 A=Babylonians 必须保持 A)
       - 其他:applyToPaper 洗题序,选项相对位置随机化
                       │
                       ▼
       前端 MorningQuizTake.tsx (本地 HEAD)
       原: useParams + groupQuestions(qs) + switch(taskType) 渲染
       origin/main 7 commit 之后:
         feat(morning-quiz): 引入题型注册表,重写 MorningQuizTake 为薄壳
                                                    (5bb3a04 之前 6ce57ff)
```

### 1.3 验证结论

**链路是完整的,但有几个细节要明确**:

1. **`Class.level` 字段彻底是"展示用便签"**。grep 整个 `apps/` 目录没有任何业务代码读它(只有 ClassesPage 渲染时显示)。所以哪怕你写 `level="A-Level"` 也不会触发任何分支。

2. **真正决定 UI 的不是 paperMode**,而是 question 自己的 `taskType` 和 `questionType` 字段。前端按 question-by-question 的 `taskType` 在 switch 里挑组件(`MorningQuizTake.tsx:887-955`),paperMode 只用于决定**要不要洗题序/选项**(`morning-quiz.service.ts:581-605`)。

3. **本地 HEAD 还没有拉到 origin/main 的"题型注册表"重构**。origin 上 `6ce57ff feat(morning-quiz): 引入题型注册表,重写 MorningQuizTake 为薄壳` + `5f64a64 feat(exam): O-Level 五种题型 UI` + `e6cb442 feat(exam): 雅思阅读机考分屏组件` 把渲染从 switch 改成了显式 registry。后续审查请基于 origin/main 重新跑一遍。

4. **`a3398dc feat(morning-quiz/api): 学生视图返回 level 和 paperMode`** 这条 commit 把 `level` 和 `paperMode` 两个字段从服务端补到 `getStudentView` 的返回值里 ——之前前端确实拿不到 paperMode,只能从 question.taskType 反推。这正是用户问的那条链。

### 1.4 要不要新增 `alevel` 枚举?

**不建议**。理由:

- A-Level English 学生的考核目标本质是"学术英语阅读"(同雅思 Reading)。`ielts_authentic`(真题模式)和 `ielts_hard`(更难的 AI 生成)已经覆盖了"难度区分",再加一档 `alevel` 只会让 Dan 老师每周配置时多一个选择困难。
- 如果未来确实要区分(比如 A-Level 加入"作文练习"),正确做法是**新增 syllabusCode**(类似现在 `IELTS` 和 `1123`)而不是新增 EnglishLevel。Schema 已经留了空间:`QuickPaperInput.syllabusCode` 是字符串。
- 用户口语里的"A-Level" ≈ `ielts_authentic` 是合理映射(因为 A-Level 的 paper 1 reading 跟雅思 Academic 阅读题型 90% 重叠)。建议在 admin UI 里给老师贴个提示:"A-Level 班请选择 IELTS-Authentic"。

---

## Q2 · 整个流程是不是真的"零负担"?

按代码路径还原"学生从打开 iPad 到提交"全流程,逐步检查暗坑。

### 2.1 5 步流程

| 步骤 | 学生动作 | 触发的代码 | 学生看到什么 |
|---|---|---|---|
| 1 | 打开 iPad 浏览器,扫教室大屏二维码 | `MorningQuizDisplay.tsx` 渲染 QR(签名 = sessionId+windowStart 用 HMAC,15s 轮换) | 大屏一直在循环刷新 QR |
| 2 | 自动跳到 `/scan/:token` | `App.tsx:62-73` 允许未登录访问 `/scan/:token`;`MorningQuizScan.tsx` 挂载 → 调 `/api/attendance/scan-roster?qrToken=…` | 显示 "{班级名} · 早测签到 · 共 30 人" |
| 3 | 输入完整真名 → 点"签到" | `attendance.service.ts:88-271` `scanQr`,五道闸:WiFi → QR → session.active → 名字精确匹配 → 时间窗口 | 服务端 mint scanToken,前端 `localStorage.setItem('auth_token', scanToken)` |
| 4 | `window.location.replace('/morning-quiz/:sessionId')` | `App.tsx:77` 检测 `user.role === 'student'` → 渲染 `MorningQuizTake` → fetch `/api/morning-quiz/sessions/:id` | 渲染分屏阅读 + 题目 |
| 5 | 答完点"交卷" | `morning-quiz.controller.ts:162-171` 委托 `student.service.ts:150-204` `finalSubmit`,MCQ 自动判分 | navigate `/student`(StudentHome) |

### 2.2 学生有没有被要求**额外输入**任何东西?

**只有"完整真名"。** `MorningQuizScan.tsx:131-150` 表单只有一个字段。

但 `attendance.service.ts:113-131` 的匹配是**严格相等**(trim 之后):
- `User.name` 必须**完全一致** —— `User.name='牟歌'`,学生输入 `'牟歌 '`,trim 后能过;但输入 `'牟 歌'` 或 `'牟歌_'` 会 404。
- 大小写也敏感:对中文学生影响不大,对英文名学生(比如 "Daniel" vs "daniel")会被卡。这是个潜在小坑。

### 2.3 有没有**下载提示**?

**没有**。grep `manifest.json` / `service-worker` / `<link rel="manifest"` 整个 `apps/web/` 都不存在(`apps/web/index.html` 也只有标准 favicon)。
- 没有 PWA install 横幅
- 没有附件下载(题目内容、图片都是 inline JSON,Passage 是纯文字)
- 没有 PDF 导出走学生路径

唯一可能弹出"下载"的场景是图片题(`questions/dto.ts` + `QuestionAsset.storageUrl`),但早测的 IELTS Reading 默认 `includeDiagrams: false`(`morning-quiz.service.ts:472, 484, 496`),所以早测没有图。

### 2.4 有没有**注册/登录界面会跳出**?

`App.tsx:61-74` 显式允许未登录访问 `/scan/:token`,签到成功后 `r.scanToken` 写 localStorage,之后 `init()` 调 `/auth/me` 验证(`auth.ts:24-33`)能过 ——因为 `auth.guard.ts:38-43` 用同一个 JWT 密钥校验,scanToken 跟正常登录 token shape 完全一样(`attendance.service.ts:243-251`)。

**唯一会被踢回 /login 的场景**:scanToken 过期(`expSeconds = quizEnd - now`,大约 30 分钟,超过 quizEnd 后所有调用返回 401)。但 9:00 之后流程已经结束,被踢回登录页是预期行为,不是暗坑。

### 2.5 缓存清理后流程会不会断?

**可能会断 —— 但不致命**。具体场景:

| 情况 | 影响 |
|---|---|
| 学生在签到前**清缓存**(localStorage 没有 deviceUuid) | 下次扫码时 `getDeviceUuid()`(`MorningQuizScan.tsx:32-43`)生成新 UUID,服务端不认得旧 UUID → 不会冲突 → **正常签到** |
| 学生答题中途**清缓存** | scanToken 也丢了 → 下一次 API 调用 401 → 跳回 /login → 学生没法继续答题 |
| 学生开**隐私模式**扫码 | localStorage 在隐私模式下持久(只是关掉标签页就丢) → 当次签到OK,但是退出标签页之前再次回到 take 页面,token 还在 |

最大的风险是**第二条**:学生中途清缓存。但 30 分钟内学生几乎不会主动清缓存,且 30 分钟后 token 也过期,所以这是低概率边缘情形。建议在 `MorningQuizTake.tsx` 里加一个 `localStorage` watcher(检测到 `auth_token` 被清就提示"请重新扫码")。

### 2.6 ⚠️ 核心矛盾:30 个学生用同一台 iPad → deviceUuid 防作弊冲突

这是用户特地点出的核心矛盾。代码侧**确实存在硬冲突**:

`attendance.service.ts:170-185`:

```ts
if (deviceUuid) {
  const conflict = await this.prisma.attendance.findFirst({
    where: { sessionId: session.id, deviceUuid, studentId: { not: studentId } },
  });
  if (conflict) {
    throw new ConflictException({
      code: 'device_already_used',
      conflictStudent: conflict.student.name,
    });
  }
}
```

**含义**:同一个 `deviceUuid` 在同一个 session 下绑定第一个签到的学生 —— 第二个学生用同一台 iPad 扫码会被硬拒。

**用户场景下会发生什么?**

- 假设 30 个学生**共享一台 iPad**:第 1 个学生签到OK,第 2 个学生扫码 → 名字校验过 → device_already_used → 硬拒绝(`ConflictException 409`)。
- `MorningQuizScan.tsx:214-217` 把这个错误友好化为:"本设备已被 {另一位同学} 用于签到。如果是你借的手机给同学,请联系老师手工补登。"

**这显然违背了用户描述的场景**。设计文档里这条规则的本意是防"一个学生帮 30 个人代签",代价是"30 个学生不能共享一台设备"。

**怎么破?三个层次的方案,按推荐度排序**:

1. **(推荐)如果场景就是"30 个学生用同一台 iPad",那 deviceUuid 这道闸的语义反了**。应该改成: same `deviceUuid` 在同一 session 内 N 次签到只允许第一个 successful login,**后续每次签到要求每个学生在同一台设备扫一次新 QR**(每 15s 轮换,连续两个学生在 30s 内连续签到自然会用不同 QR 窗口),并把 `attendance.service.ts:170` 那一段移除或者改成"**同 deviceUuid + 同 qrWindow** 才报冲突"。
   - 实现位置:`attendance.service.ts:170-185` —— 把 `where` 加上 `attendance.scanTime` 在过去 5s 内的过滤,或者加上 `qrWindow` 字段共同唯一。

2. **改成"每个学生有自己的 iPad"**(用户说的"打开自己的 iPad")。如果学生确实人手一台,那现行 deviceUuid 闸就是对的,不用改。但用户问题写的是"30 个学生用同一台 iPad"。

3. **保留 deviceUuid 闸,但加一个"共享设备"模式**:在 `MorningQuizSession` 上加个 `boolean sharedDeviceMode`,前端扫码页若该 session 是 sharedDeviceMode 就**不发** deviceUuid。这是最不破坏现有设计的改法。

实施位置:`apps/api/prisma/schema.prisma:1299` `MorningQuizSession` 加字段;`apps/api/src/attendance/attendance.service.ts:170-185` 加分支。

### 2.7 还有几个隐藏暗坑

| 暗坑 | 触发条件 | 代码位置 |
|---|---|---|
| **同名学生** | 班里有两个同名学生(虽然罕见) | `attendance.service.ts:125-130` 直接 ForbiddenException 抛 `multiple_students_with_same_name`,要求老师手工补登 |
| **WiFi 没接对** | 学生用 4G 扫码 | `ip-allowlist.guard.ts:97` 抛 `not_on_school_wifi` —— 友好化提示 OK |
| **8:50 之后扫码** | 迟到 20 分钟以上 | `attendance.service.ts:144-162` 落库 `absent` 然后 GoneException,学生看到"考勤窗口已关闭" |
| **服务端时区错位** | 部署机时区不是 UTC+8 | `morning-quiz.service.ts:38-56` 写死了 8 小时偏移,可通过 env `MORNING_QUIZ_TZ_OFFSET_MIN` 改 —— Dan 老师不会改这个 |
| **学生姓名带空格** | "John Smith"输入"john smith" | `attendance.service.ts:113-118` 大小写 + 空格全敏感,会 404 |
| **scanToken 过期但仍在答题页** | 极慢的网络让 quizEnd 提前到达 | `MorningQuizTake.tsx:278-283` auto-submit 倒数 0 时已经触发,所以这条暗坑实际被动覆盖了 |
| **`Class.level` 写 "A-Level" 但没设 ClassEnglishLevel** | 老师只填了字符串没去开 EnglishLevel | `morning-quiz.service.ts:247-249` `class_level_not_set` 错误,这条 (date,class) 整条出卷失败,但其他班继续 —— 不会全军覆没 |

---

## Q3 · 考勤怎么看 + Excel 导出

### 3.1 现有 dashboard

| 页面 | 路径 | 后端端点 | 显示内容 |
|---|---|---|---|
| 单次早测的 dashboard | `/morning-quiz/sessions/:id/dashboard`(没有专门前端,API only) | `morning-quiz.service.ts:787-817` | 今天某个 session:on_time/late/absent 计数 + 每个学生分数 + 提交时间 |
| 班级考勤历史 | `/admin/attendance` AttendanceAdmin.tsx | `/api/attendance/history?classId=&from=&to=` | 给定时间范围 + 班级:每行=一次扫码,显示 学生 / 状态 / 扫码时间 / IP 来源 / 备注 / 补登按钮 |
| 班级综合 stats | `/stats` ClassStats.tsx | `/api/analytics/class/:classId/overview` 等 | 班级整体提交完成率、均分、按 paper 分布 —— 没有 attendance 维度 |
| 周早测排期 | `/morning-quiz/schedule` MorningQuizSchedule.tsx | `/api/morning-quiz/scheduled?weekStart=...` | 显示一周排了哪些 session,可以批量生成下周 |

**缺**:跨多天 + 多班级聚合的"出勤概览"页面 —— 比如"本周 5B 班谁连续缺勤 3 天"或"今天哪些班还没有任何人签到"。

### 3.2 有没有 Excel 导出?

**没有**。grep `xlsx` / `exceljs` / `XLSX` / `csv export` 整个仓库:
- `apps/api/package.json:24-43` 依赖列表里没有 `exceljs` / `xlsx` / `node-xlsx` 任何一个
- 唯一出现 "CSV" 的地方是 `apps/api/src/classes/classes.service.ts:62` 注释,说"批量从 CSV 导入学生" —— 是**入站**,不是出站

### 3.3 实现建议:加一个 `/morning-quiz/export/attendance` 端点

按 Dan 老师"导入到另一个系统"的需求,推荐用 **`exceljs`** 而不是简单的 CSV(中文编码 + 多 sheet + 单元格样式 CSV 都做不了)。

**最小实现路径**:

1. `apps/api/package.json` 加 `"exceljs": "^4.4.0"`(MIT,无原生依赖,Node.js 纯 JS)。

2. 新文件 `apps/api/src/morning-quiz/morning-quiz-export.service.ts`:

   ```ts
   @Injectable()
   export class MorningQuizExportService {
     constructor(private prisma: PrismaService) {}

     async exportAttendance(classId: string, from: Date, to: Date): Promise<Buffer> {
       const ExcelJS = require('exceljs');
       const wb = new ExcelJS.Workbook();
       const ws = wb.addWorksheet('Attendance');
       ws.columns = [
         { header: '日期', key: 'date', width: 12 },
         { header: '学生', key: 'student', width: 16 },
         { header: '状态', key: 'status', width: 10 },
         { header: '扫码时间', key: 'scanTime', width: 12 },
         { header: '分数', key: 'score', width: 10 },
         { header: '满分', key: 'maxScore', width: 10 },
         { header: '来源', key: 'source', width: 12 },
         { header: '补登备注', key: 'note', width: 30 },
       ];
       const rows = await this.prisma.attendance.findMany({
         where: { session: { classId, date: { gte: from, lte: to } } },
         include: { student: true, session: true, submission: true },
         orderBy: [{ session: { date: 'asc' } }, { student: { name: 'asc' } }],
       });
       for (const r of rows) {
         ws.addRow({
           date: r.session.date.toISOString().slice(0, 10),
           student: r.student.name,
           status: { on_time: '✓ 准时', late: '迟', absent: '缺' }[r.status],
           scanTime: r.scanTime?.toLocaleTimeString('zh-CN') ?? '',
           score: r.submission?.totalScore ?? r.submission?.autoScore ?? '',
           maxScore: r.submission?.maxScore ?? '',
           source: r.source === 'qr_scan' ? '扫码' : '手工补登',
           note: r.correctedNote ?? '',
         });
       }
       return await wb.xlsx.writeBuffer();
     }
   }
   ```

3. `morning-quiz.controller.ts` 加端点:

   ```ts
   @Get('export/attendance')
   async exportAttendance(
     @Query('classId') classId: string,
     @Query('from') from: string,
     @Query('to') to: string,
     @Res() res: Response,
   ) {
     const buf = await this.exportSvc.exportAttendance(classId, new Date(from), new Date(to));
     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
     res.setHeader('Content-Disposition', `attachment; filename="attendance-${classId}-${from}-${to}.xlsx"`);
     res.send(buf);
   }
   ```

4. 前端在 AttendanceAdmin.tsx 工具条加按钮:

   ```tsx
   <a
     href={`${BASE}/api/morning-quiz/export/attendance?classId=${classId}&from=${from}&to=${to}`}
     download
     className="btn btn-primary"
   >📊 导出 Excel</a>
   ```

   注意:`<a download>` 走浏览器原生下载,不会带上 Authorization header,所以这个端点要么用 query string 传 token(不推荐 —— 出现在浏览器历史里),要么改用 cookie auth。**最好**的做法是前端用 fetch+blob 下载:

   ```tsx
   async function exportXlsx() {
     const r = await fetch(`/api/morning-quiz/export/attendance?...`, {
       headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
     });
     const blob = await r.blob();
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url; a.download = 'attendance.xlsx'; a.click();
     URL.revokeObjectURL(url);
   }
   ```

5. 第二个 sheet 应该叠加 **per-student summary**(每个学生的总到课率)和第三个 sheet **per-day summary**(每天的总到课人数 + 均分),这样 Dan 老师不用每次自己 pivot table。这部分实现 30 行代码以内。

### 3.4 当前 UI 缺什么

按 Dan 老师"一眼看到"的需求列:

| 需要的视图 | 现状 | 改进位置 |
|---|---|---|
| 今天哪些学生没来 | ❌ 现在要去 dashboard 一个 session 一个 session 看 | 在 `/morning-quiz/schedule` 顶上加"今日实时面板":每个 session 一行,on_time/late/absent 三个数字 |
| 这周整体到课率 | ❌ AttendanceAdmin 只显示行,不显示百分比 | AttendanceAdmin.tsx:145-149 已经有计数,加一行"到课率: 92.3%" |
| 某个学生连续缺勤 | ❌ 没法一眼看到,要跨多天找该学生的行 | 加一个 `/admin/attendance/students` 视图,row=学生,column=日期,cell=状态 —— 这是最有价值的报表 |
| 某个学生分数趋势 | 部分有(`ClassStats.tsx` 但只到 paper 粒度,不到 student-day) | 同上 |

---

## Q4 · 系统现在帮 Dan 老师减了哪些负担、还能再减什么

按"出卷 / 批改 / 考勤"三大块拆。

### 4.1 已经自动化的(✅)

| 任务 | 自动化方式 | 代码位置 |
|---|---|---|
| **每天 30 分卷子(IELTS-Authentic)** | 从 past-paper bank 抽一篇没用过的 passage,把整篇的 13 道题全部用上 | `morning-quiz.service.ts:307-451` `pickPassageAndCreatePaper` |
| **每天 30 分卷子(IELTS-Hard / O-Level)** | 调 Claude API 生成 18 道题,按 topic 配比拆分 | `morning-quiz.service.ts:453-498` `levelToQuickPaperInput` + `quick-paper.service.ts:generate` |
| **MCQ 自动判分** | 提交时把 `script.selectedOption` 跟 `snapshotOptions.find(o=>o.correct).key` 比对 | `student.service.ts:163-201` finalSubmit + `morning-quiz.cron.ts:101-138` 9:00 强制提交时也跑一遍 |
| **考勤记录** | 学生扫码 → 服务端写 Attendance 行;9:00 cron 自动给没扫的人写 absent | `attendance.service.ts:scanQr` + `morning-quiz.cron.ts:140-161` lockPastSessions |
| **签到防代签** | school WiFi → QR 15s 轮换 → 名字精确匹配 → deviceUuid 检测 → 时间窗口 | `attendance.service.ts:88-271` 五道闸 |
| **8:30 / 8:32 / 8:50 / 9:00 时间窗口管理** | cron 每分钟轮询 → 30s 内自动 active → quizEnd 自动 lock + force-submit | `morning-quiz.cron.ts:31-58 / 60-73` |
| **批量周排期** | "Sunday Night" 一键:5 天 × N 班 × QuickPaper,失败的单独报告但不阻塞 | `morning-quiz.service.ts:202-305` batchGenerateForWeek |
| **出题质量过滤** | AI 生成的 quick-paper question 加 `provenanceTag='ai_quick_paper'`,默认不进其他老师的常规出卷池 | `schema.prisma:281-288 + provenanceTag` |
| **作弊抗性** | 题目顺序按学生洗牌(passage_pick 除外)、选项 A/B/C/D 重新映射 | `morning-quiz.service.ts:581-605` + `shuffle.service.ts` |

### 4.2 仍然要 Dan 手工干的(❌)

| 任务 | 现状 | 改进难度 |
|---|---|---|
| **short_answer / structured 题判分** | `student.service.ts:167` 写明 `if (q.questionType !== 'mcq') continue` —— 非 MCQ 不进 autoScore;走 marker 队列 | 中等(B3 fragment 已有 quality-feedback 模型,但实际 short_answer judge 没接入) |
| **每周日点"Generate next week"** | `MorningQuizSchedule.tsx` 是手动按钮,不是 cron 自动跑 | 低(加 `@Cron(CronExpression.EVERY_SUNDAY_AT_22)` 即可) |
| **设置班级 EnglishLevel** | 第一次配置班级时手工 `PATCH /morning-quiz/classes/:classId/english-level`,UI 在 `MorningQuizSchedule.tsx:94-101` | 低(已有 UI,Dan 一次性设一次即可) |
| **8:30/8:32/8:50/9:00 时间硬编码** | `morning-quiz.service.ts:38-41` 写死,改时间要改源码再部署 | 中(改成读 SchoolConfig 表) |
| **AI 生成的题 Dan 是否需要看一眼** | review 流水线(`apps/api/src/review/`)存在,但批量生成路径(`quickPaper.generate` → `morning-quiz.service.ts:268`)看起来直接落库不进 review 队列 —— 需要进一步确认 | 中等 |
| **连续缺勤通知** | 没有 ——`AuditLog` 记录了 attendance.scan 和 attendance.correct,但没有任何聚合 cron 找连续缺勤的学生 | 中等(`morning-quiz.cron.ts` 加一个 daily aggregator) |
| **导出考勤 / 分数到 Excel** | 见 Q3,没做 | 低(2 小时实现) |
| **打印纸质版备用** | PDF 服务存在(`apps/api/src/pdf/`),但 morning-quiz 路径没暴露 | 低(复用 `pdf.service.ts`) |
| **同名学生的扫码冲突手工补登** | `multiple_students_with_same_name` 错误码 → AttendanceAdmin 手动补登 | 低(允许 email 二次确认) |

### 4.3 可优化的清单(按"对 Dan 减负价值/实施难度"打分)

每条 1-5 打分,**价值÷难度** 越高越优先做。

| # | 优化项 | 价值 | 难度 | 优先级 | 说明 |
|---|---|---|---|---|---|
| 1 | **Excel 导出考勤+分数(Q3)** | 5 | 1 | ⭐⭐⭐ | Dan 明确说要导到另一个系统,这是刚需 |
| 2 | **"连续缺勤 N 天自动告警"daily cron** | 4 | 2 | ⭐⭐⭐ | 当前 Dan 要手工跨日翻 AttendanceAdmin。加一个 daily aggregator + WeChat-Work 推送(B7 的 NotificationConfig 已经在 schema 里) |
| 3 | **Sunday-night 自动生成卷子的 cron** | 4 | 2 | ⭐⭐⭐ | 把 `batchGenerateForWeek` 包一层 `@Cron(EVERY_SUNDAY_NIGHT_AT_22)`,周一早上自动有新卷子。失败的发邮件给 Dan |
| 4 | **共享 iPad 模式开关(Q2.6 核心矛盾)** | 5 | 2 | ⭐⭐⭐ | 不改是 Dan 用不起来 |
| 5 | **学生×日期矩阵到课视图** | 4 | 3 | ⭐⭐ | 一眼看到谁连续缺勤,缺勤模式异常学生(只缺周三?) |
| 6 | **short_answer 自动判分(基于 markScheme)** | 5 | 5 | ⭐ | 需要 LLM 判分,涉及 prompt + 成本控制。但减负效果最大 ——30 道题里通常有 8 道 short_answer,人工判要 30 分钟 |
| 7 | **"今日早测实时面板"(给 Dan 8:30 看)** | 3 | 1 | ⭐⭐⭐ | 在 Schedule 页面顶上加一个 today 实时区,显示每个 session 的 进/迟/缺 数 |
| 8 | **8:30/8:32/8:50/9:00 时间改成数据库配置** | 2 | 2 | ⭐ | 偶尔需要(节假日推迟、考试月调整),但不是高频 |
| 9 | **AI 出的题质量自动反馈(B3 模型,签信号 → 后续 prompt 加权)** | 3 | 4 | ⭐ | schema/B3 已经有 `QuestionQualitySignal`,接入 quick-paper 生成时读分数加权 prompt |
| 10 | **WeChat 推送当日考勤报告给 Dan** | 4 | 2 | ⭐⭐ | B7 的 NotificationConfig 已经在 schema 里,加个 daily attendance summary 触发即可 |

**最值得现在就做的三个**:1, 4, 7。第 1 是显式刚需;第 4 是阻塞场景;第 7 是 1 天就能写完的"减负即效"功能。

---

## Q5 · 最终结论

### 5.1 现在的系统帮 Dan 减了什么负担(一句话)

> Dan 早上 8:30 不用人在场,系统**自动出卷 + 自动签到 + 自动判 MCQ + 自动锁卷**,他只需要每周日点一次"Generate next week",和对 short_answer 题人工评分。

### 5.2 还有什么地方可以优化(3 个最值得做的)

1. **加 Excel 导出**(2 小时实现,Q3 已给具体代码)。
2. **修共享 iPad 与 deviceUuid 的语义冲突**(用户场景的核心矛盾,见 Q2.6)。
3. **加 Sunday-night 自动生成卷子的 cron + 当日异常推送**(把"每周日手工点一次"也消掉)。

### 5.3 学生流程从扫码到提交的暗坑列表

| 暗坑 | 严重度 | 触发 | 建议 |
|---|---|---|---|
| **30 个学生用同一台 iPad → 第 2 个起被 deviceUuid 闸拒** | ⚠️ 致命 | 用户原始场景 | Q2.6 三方案任选 |
| **学生姓名带空格 / 大小写不一致 → 404** | ⚠️ 中 | 英文学生概率高 | 服务端做 case-insensitive + space-tolerant 模糊匹配,但保留 multiple-match → ForbiddenException |
| **答题中途清缓存 → token 丢 → 跳回 /login 没法继续** | ⚠️ 低 | 学生主动操作,概率低 | take 页面加 storage event 监听,token 没了就提示重新扫 |
| **同名学生硬拒** | ⚠️ 低 | 班里有重名 | 用 email 后缀或学号做 disambiguation prompt |
| **服务端时区不是 UTC+8** | ⚠️ 低 | 部署机配错 | 已有 env 兜底,运维问题 |
| **AI 生成的题 Dan 没看就上线** | ⚠️ 中 | 质量问题 | 生成后塞进 review 队列,Dan 周日批量审一次 |
| **scanToken 在 quizEnd 之后过期 → 拿 token 看历史的同学被踢回 /login(没账号)** | ⚠️ 低(预期行为) | 学生想"再看下今天的卷子" | 加只读历史接口,允许过期 token 在只读 session 里再续 N 分钟 |
| **`Class.level` 字段与 `ClassEnglishLevel.level` 字段同名但语义完全不同** | ⚠️ 中(将来挖坑) | 新 onboarding 同事困惑 | 把 `Class.level` 改名 `Class.displayLabel` 或干脆删掉(没人读) |
| **`levelToQuickPaperInput` 中 `ielts_authentic` 分支是死代码**(`morning-quiz.service.ts:466-476`,因为上层 if 已经 short-circuit) | ⚠️ 低(代码维护) | 维护者改错 | 删掉死分支或加注释说明 |
| **shared 设备上 highlights/notes/flag 全部用同一 localStorage key** (`mq:hl:${sessionId}`,`mq:nt:${sessionId}`,`mq:flags:${sessionId}` —— 不带 studentId) | ⚠️ 中 | 同一 iPad 多学生轮流用 | localStorage key 加 studentId 维度;共享 iPad 模式建议直接禁用 highlights 持久化 |
| **passage_pick 模式跳过题序洗牌**,但同班学生看到的题和顺序完全一样 | ⚠️ 低(权衡) | 防作弊 vs 题型完整性 | 文档已说明设计意图,目前可接受;考虑加"passage 选择按学生 hash"的二次随机 |

---

## 附录: 关键代码位置速查

| 主题 | 文件 | 行号 |
|---|---|---|
| EnglishLevel 枚举 | `apps/api/prisma/schema.prisma` | 1293-1297 |
| `Class.level` 字段(展示用) | `apps/api/prisma/schema.prisma` | 64 |
| 学生扫码服务端 | `apps/api/src/attendance/attendance.service.ts` | 88-271 |
| deviceUuid 防代签闸 | `apps/api/src/attendance/attendance.service.ts` | 170-185 |
| 五道闸总览 | `apps/api/src/attendance/attendance.service.ts:75-94`(注释) | |
| ielts_authentic → passage_pick | `apps/api/src/morning-quiz/morning-quiz.service.ts` | 252-270, 307-451 |
| ielts_hard / olevel → AI Quick Paper | `apps/api/src/morning-quiz/morning-quiz.service.ts` | 453-498 |
| paper.config.mode 分流 | `apps/api/src/morning-quiz/morning-quiz.service.ts` | 581-605 |
| MCQ 自动判分 | `apps/api/src/student/student.service.ts` | 163-201 |
| 9:00 cron 强制提交 + absent | `apps/api/src/morning-quiz/morning-quiz.cron.ts` | 60-167 |
| QR HMAC 校验 | `apps/api/src/qr/qr.service.ts` | 1-90 |
| WiFi 网段闸 | `apps/api/src/wifi-gate/ip-allowlist.guard.ts` | 1-99 |
| 学生扫码前端 | `apps/web/src/pages/MorningQuizScan.tsx` | 1-228 |
| 学生答题前端 | `apps/web/src/pages/MorningQuizTake.tsx` | 1-1126 |
| 老师考勤管理前端 | `apps/web/src/pages/AttendanceAdmin.tsx` | 1-252 |
| 老师周排期前端 | `apps/web/src/pages/MorningQuizSchedule.tsx` | 1-120+ |
| 单 session dashboard 后端 | `apps/api/src/morning-quiz/morning-quiz.service.ts:getDashboard` | 787-817 |
| 跨班 attendance history 后端 | `apps/api/src/attendance/attendance.service.ts:historyForClass` | 359-380 |

---

**审查完毕**。下一步建议:在 origin/main 上(本地需先 `git fetch && git pull`)拉到题型注册表的版本,我可以再针对 `feat(morning-quiz/api): 学生视图返回 level 和 paperMode` 之后的版本写一份"题型注册表 → IELTS 屏 → O-Level 屏"细化的 Q1 v2 报告。
