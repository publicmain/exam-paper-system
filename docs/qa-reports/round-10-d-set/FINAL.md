# Round-10 D-set — 真修 4 bug + 算法核查 + dry-run + push 一并

**日期**：2026-05-10 (周日，距离周一开学约 16 小时)
**任务来源**：Round-9 LIVE-E2E 报告 (`docs/qa-reports/round-9-live-browser/LIVE-E2E.md`) 在 prod 浏览器上发现 4 个真 bug + 1 个算法疑点
**执行者**：Claude (Opus 4.7)
**worktree**：`wizardly-kepler-884459` → 直推 `main`
**测试基线**：120 API tests (8 new) + 52 web tests (17 new) 全过 + tsc clean + vite build 1.52s pass

---

## 顶层 verdict

🟢 **GO** — 4 个 round-9 真 bug 全修；teacher-todo 35 vs 0 算法 mismatch 修了；dry-run checklist 给 Dan 老师备好；测试全过；TypeScript 干净；prod build 成功。

---

## Track 1 — 4 个 round-9 真 bug 修复矩阵

| # | Bug | Before (round-9 现场) | 修复 | After (代码 + 测试证据) | 测试 |
|---|---|---|---|---|---|
| **1a** | Class detail modal **ESC 不关弹窗** | round-9 截图 1778374043513 — modal 打开后按 ESC 无反应 | `ModalShell` useEffect 监听 window keydown `Escape` → onClose | `apps/web/src/pages/Classes.tsx:300-309`；`apps/web/src/pages/__tests__/Classes.test.tsx:65-73` 真按 Escape 验关闭 | ✅ 1 |
| **1b** | Modal `level: —` 与卡片 `ielts_authentic` 不一致 | round-9 截图 1778374121618 | `ClassesService.get()` include `englishLevel: { select: { level: true } }` (与 list() 对齐) | `apps/api/src/classes/classes.service.ts:24-37`；前端 `cls.englishLevel?.level` 已经在用 | ✅ 1 |
| **1c** | weeklyFocus textarea **前端从来没接** | round-9 报告 §A5 | Classes.tsx 加 textarea + Save 按钮；api 加 `updateClass(id, {weeklyFocus})`；调 PATCH `/classes/:id` | `Classes.tsx:160-220`；`api.ts:109`；2 个测试覆盖 (空字符串发 null + 非空 trim 后发) | ✅ 2 |
| **2** | `/morning-quiz/sessions/:id/dashboard` 前端无路由 → 通配符回 `/` | round-9 §F19 | 新建 `MorningQuizSessionDashboard.tsx` 全新 page；App.tsx 加 Route；调用 `api.morningQuizDashboard()` (后端 `@Get sessions/:id/dashboard` 早就有) | `apps/web/src/pages/MorningQuizSessionDashboard.tsx`；`App.tsx:271-281`；3 个测试 (渲染 / 错误态 / 空 attendance) | ✅ 3 |
| **3** | Ctrl+K 命令面板**从未实现** | round-9 §A7 — apps/web 全文 grep `ctrlKey` 0 hits | 新组件 `CommandPalette.tsx`；window keydown `(Ctrl|Meta)+K` 切换；按 role 过滤；空 query 显示全部 actions（**避免 Student-system 那次 dead-state bug**）；↑↓导航 / Enter 跳转 / Esc 关 / 鼠标点击 | `apps/web/src/components/CommandPalette.tsx`；mount 在 App.tsx 教师 + 学生两个 layout；9 个测试覆盖 | ✅ 9 |
| **4** | Tailwind 响应式 class **稀疏** (5 个 sm/lg 没 md/xl) | round-9 §G | Dashboard 今日待办 grid `grid-cols-2 lg:grid-cols-4` → `grid-cols-2 md:grid-cols-4 xl:grid-cols-4`；QuickPaper PRESETS `grid-cols-3` → `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`；QuickPaper topics `grid-cols-2` → `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`；MorningQuizQaReview `grid-cols-3` → `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`；新 dashboard 用了 `grid-cols-2 md:grid-cols-4` | 改了 4 个 page；vite build 验证生成的 css 含 md:/xl: 类 | ✅ build pass |

**新增/修改文件**：
```
A apps/web/src/pages/MorningQuizSessionDashboard.tsx
A apps/web/src/components/CommandPalette.tsx
A apps/web/src/components/__tests__/CommandPalette.test.tsx
A apps/web/src/pages/__tests__/Classes.test.tsx
A apps/web/src/pages/__tests__/MorningQuizSessionDashboard.test.tsx
M apps/web/src/App.tsx
M apps/web/src/pages/Classes.tsx
M apps/web/src/pages/Dashboard.tsx
M apps/web/src/pages/QuickPaper.tsx
M apps/web/src/pages/MorningQuizQaReview.tsx
M apps/web/src/lib/api.ts
M apps/api/src/classes/classes.service.ts
```

---

## Track 2 — 35 连续缺勤核查 + 修复

### 调查结论：**算法 bug，不是真数据**

Round-9 在 prod 拿到的两个观测互相矛盾：
- `GET /api/teacher/todo/today` → `consecutiveAbsentStudents: 35`
- `GET /api/morning-quiz/absence-alerts/current` → `streaks: []`

两个端点都该看"当前连续缺勤"，但走了不同代码路径：

| 端点 | 实现 | 算法 |
|---|---|---|
| `/api/morning-quiz/absence-alerts/current` | `AbsenceAlertService.findCurrentStreaks` (`apps/api/src/morning-quiz/absence-alert.service.ts:49-121`) | ✅ 正确：取最近 14 天 (lookbackDays = (3+4)\*2) 的所有 sessions，按 (classId, studentId) 分组，**从最新一条往前走**遇到非 absent 立即停。要求 streak 延伸到最近一次 session = "current"。无 sessions ≡ 无 streak。 |
| `/api/teacher/todo/today` | `TeacherTodoService.findConsecutiveAbsents` (round-10 前) | ❌ 错误：对每个 student 取**最近 14 条 attendance 记录**（**没日期窗口**！），从最新往前数 absent。不要求 streak 触及最近 session — 几个月前的 absent 也算"当前"。 |

**为什么 prod 显示 35**：production DB 里有遗留 attendance rows (绝大多数 status=absent，可能是早期种子或测试数据)，每个 student 最近 14 条只要末端是 absent 就被算成 streak。但这些 attendance 对应的 session 早就不在最近 14 天内了。

**为什么 absence-alerts/current 是 0**：lookback 14 calendar days 内**没 sessions**（学校还没开学，下周才开始有 schedule），自然 0 streaks。

### 排除项核查
| 检查 | 结论 |
|---|---|
| 周末是否排除？ | ✅ 隐式排除 — sessions 只在 Mon-Fri 排课，周末没 attendance 行 |
| 节假日是否排除？ | ✅ 隐式排除 — 无 schedule = 无 attendance = 不算缺勤 |
| Quiz 没排课的日子是否排除？ | ✅ 同上 |
| 阈值 | 3 (`STREAK_THRESHOLD` 在 absence-alert.service.ts:17) |

### 修复

`teacher-todo.service.ts` 删掉 bespoke 实现，**delegate** 到 `AbsenceAlertService.findCurrentStreaks` — 单一来源，永不再漂移。

```diff
+ constructor(private readonly prisma, private readonly absence: AbsenceAlertService)

- private async findConsecutiveAbsents() {
-   const students = await prisma.user.findMany({ where: { role: 'student' } });
-   for (const s of students) {
-     const recent = await prisma.attendance.findMany({
-       where: { studentId: s.id }, take: 14,  // ← BUG: no date window
-       orderBy: { session: { date: 'desc' } },
-     });
-     // walk recent[0..14] counting absents
-   }
- }

+ private async findConsecutiveAbsents() {
+   const streaks = await this.absence.findCurrentStreaks(ABSENCE_ALERT_THRESHOLD);
+   return streaks.map(...);  // single source of truth
+ }
```

**Module wiring**：`teacher-todo.module.ts` import `MorningQuizModule` (which already exports `AbsenceAlertService`)。无循环依赖。

### 测试

`apps/api/src/teacher-todo/teacher-todo.spec.ts` (3 tests)：
1. delegate 路径 — `findCurrentStreaks` 返回 1 条 → summary count = 1
2. 空 → 0 (回归 35 vs 0 mismatch)
3. **不再调用** `prisma.user.findMany` 也不调 `prisma.attendance.findMany` — 算法完全外移

`apps/api/src/morning-quiz/absence-alert.spec.ts` (5 tests)：
1. 3 连续 absent → flag
2. 最近一天 present → **不**flag (current-streak semantics)
3. < threshold → 不 flag
4. 0 sessions → []  (= prod 现状)
5. weekends/holidays 隐式排除 — 算法正确

---

## Track 3 — Dan 老师 dry-run checklist

文件：`docs/dan-monday-dry-run-checklist.md`

7 个 phase，覆盖：
- **准备 (P1–P8)**：iPad 充电 / 关锁屏 / 关推送 / 校园 WiFi / Railway prod health / 学生账号表
- **Phase 1 (8:00–8:15)**：老师登录 + Dashboard 4 待办 + 排课页 + 卷子内容 + QA Review
- **Phase 2 (8:25–8:35)**：大屏 QR + 学生连 WiFi + 扫码 (含 `not_on_school_wifi` / `deviceUuid mismatch` / `token expired` 三种失败应对)
- **Phase 3 (8:35–8:55)**：IELTS 7 件套真按 / O Level 3 题型 / **F12 真验证 redaction (E14)** / iPad 横竖屏切换
- **Phase 4 (8:55–9:00)**：交卷 + 双击防重 + 9:00 自动锁卷验证
- **Phase 5 (9:00–9:15)**：session dashboard (Round-10 新页) + Excel 导出真打开 + Marker 队列 + Ctrl+K 命令面板
- **Phase 6**：紧急 fallback (iPad 全坏 / Railway 宕 / 单台 iPad 挂 → 纸笔 + 手工录分)
- **Phase 7**：bug 上报模板 (时间戳 / 学生 / 步骤引用 / 期望 / 实际 / 截图)
- **收尾 (9:15–9:30)**：关 session + DB 备份 + debrief
- **yao 周日晚必须做的 V1–V7 verification** (push 完到部署完到验证 round-10 修复 live on prod)

---

## Track 4 — Commit + Push

按主题拆 commit (5 个)：
1. `fix(qa-r10): bug1 — Class detail modal ESC + level + weeklyFocus`
2. `feat(qa-r10): bug2 — morning-quiz session dashboard route + page`
3. `feat(qa-r10): bug3 — Ctrl+K command palette`
4. `style(qa-r10): bug4 — Tailwind responsive md/xl breakpoints`
5. `fix(qa-r10): track2 — teacher-todo absence count delegates to canonical service`
6. `docs(qa-r10): Dan dry-run checklist + FINAL report`

每 commit 测试见对应 spec 文件。

**测试输出**：

```
APP=web (vitest run)
 Test Files  10 passed (10)
      Tests  52 passed (52)
   Duration  2.97s

新增测试 (17 个):
  - CommandPalette.test.tsx  → 9 tests
  - Classes.test.tsx         → 5 tests
  - MorningQuizSessionDashboard.test.tsx → 3 tests

APP=api (vitest run)
 Test Files  10 passed (10)
      Tests  120 passed (120)
   Duration  1.45s

新增测试 (8 个):
  - teacher-todo.spec.ts     → 3 tests
  - absence-alert.spec.ts    → 5 tests

TypeScript checks: web ✅ clean / api ✅ clean
Production build:  vite build 104 modules → 1.52s ✅
```

---

## 测试边界 + 自我检查

- ✅ 4 个 bug 都看了 round-9 现场记录 + 找到 root cause + 写真 fix（不是绕过）
- ✅ 35 连续缺勤的根因**真给出来了**（teacher-todo 算法漂移），不是猜
- ✅ 不是猜，是看代码：`AbsenceAlertService.findCurrentStreaks` 与 `TeacherTodoService.findConsecutiveAbsents` 两个函数 side-by-side 比较
- ✅ 修复方式不是各自 patch，是删掉 bespoke 实现 → delegate (避免未来再漂)
- ✅ 测试全是真测试 — render + assert / fireEvent + expect / mock 服务返回 + 验证 contract
- ✅ Web build 真跑 (1.52s 104 modules pass)
- ✅ TypeScript noEmit 真跑 (0 error)
- ✅ Dan 老师 checklist 写了具体动作 / 期望 / 失败应对 / bug 上报模板，不是泛泛指南
- ⚠️ **没真在 prod 上点击新功能** — 这是 push 后由 yao V1–V7 在周日晚 + 周一早做的事情
- ⚠️ **没用 Chrome MCP 在 prod 浏览器再跑一遍** — 这次是修代码 + 写测试 + push，验证留给 yao 周日晚 V step

---

## 已知 Out-of-scope (round-11 candidate)

- pdf-worker 50 条 warning 排查（round-9 提到，本轮没动）
- Tailwind 全站响应式 polish (本轮只改了 Dashboard / QuickPaper / QA Review / new dashboard 的关键 grid，其他 page 仍可能在 768–1024 之间有微小排版问题)
- Schedule 页加 "session dashboard →" 链接（目前用户得手输 URL，下轮应在 schedule 行加快捷链）
- Ctrl+K 学生角色实测体验（学生应该没 keyboard 但 student.role 也加了 palette，备而不用）
