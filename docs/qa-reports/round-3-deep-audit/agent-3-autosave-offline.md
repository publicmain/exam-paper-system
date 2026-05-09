# Round-3 Agent 3 · 自动保存 / 离线弹性 / 并发 切片

审查范围：`a3398dc^..5bb3a04`（分支 `claude/youthful-volhard-f60797`）。
重点文件：

- `apps/web/src/components/exam/ExamContext.tsx`（新增 193 行）
- `apps/web/src/components/exam/shared/OfflineBadge.tsx`（新增 19 行）
- `apps/web/src/pages/MorningQuizTake.tsx`（重写为薄壳 ~270 行）
- `apps/api/src/morning-quiz/morning-quiz.service.ts` `saveAnswer()`（用于交叉确认服务端契约）

---

## Finding 1 · 跨 session 切换不会清掉已交卷的本地缓存（除当前 session 外）

- 严重度：**Medium**
- 位置：`apps/web/src/pages/MorningQuizTake.tsx:74` `handleSubmit()` 只 `localStorage.removeItem('mq:answers:<sessionId>')`；`apps/web/src/components/exam/ExamContext.tsx:62` 的 key schema 仅包含 `sessionId`
- 影响：
  - **同设备多账号场景**：A 同学交卷后切到 B 同学登录，两人的 `sessionId` 不同 → 不会冲突。OK。
  - **历史会话残留**：`mq:answers:<oldSessionId>` 永远不会被清，因为 `handleSubmit` 只删当前 session 那条。每周 5 天 ×N 周 → 每名学生 localStorage 持续累积 ~10–50 KB / 周（IELTS 阅读多题型 + 长答案）。常见浏览器 5–10 MB 配额不至于爆，但越用越脏。
  - **flags / fontScale**：`mq:flags:<sessionId>` 完全不清；`mq:fontScale` 是全局 key，没问题（设计如此）。
- 重现步骤：
  1. 学生连续完成 5 个早测（5 个 sessionId）
  2. DevTools → Application → Local Storage → 看到 5 条 `mq:answers:*` + 5 条 `mq:flags:*`
- 建议修复：交卷成功后顺手把 `mq:flags:<sessionId>` 一并删除；考虑给所有 `mq:*` key 写一个超过 7 天就清理的启动期一次性 GC（在 ExamProvider 第一次 mount 时跑一次 `Object.keys(localStorage).filter(k => k.startsWith('mq:answers:') && ageOf(k) > 7d)`）。

---

## Finding 2 · 不同浏览器 tab / 设备同时答同一份卷 — 服务器无版本检查，最后一写覆盖

- 严重度：**High**
- 位置：`apps/api/src/morning-quiz/morning-quiz.service.ts:737` `prisma.answerScript.upsert(...)`；前端 `ExamContext.tsx:139` 也无 version/etag 字段
- 影响：
  - 学生在 iPad + 手机上同时打开同一个 session（同一 studentId，submission 状态都还是 `in_progress`），iPad 答 Q1 = "A"，手机答 Q1 = "B"，最后写入的赢。两个 tab 的 localStorage 互不通信（没监听 `storage` 事件），界面会一直显示自己输入过的那个值，但服务器侧已被覆盖。学生走出考场刷新 → 看到的是另一边的答案 → 会向老师抱怨"我明明选了 A"。
  - `saveAnswer` 没有 `If-Match` / `updatedAt` 比较，没有任何乐观锁。
  - 服务端`submission.status !== 'in_progress'` 的检查仅能拦"已交卷再答"，不能拦多 tab。
- 重现步骤：
  1. Tab A：选 Q1 = A，等 600ms debounce 把 "A" 落库
  2. Tab B（同账号）：选 Q1 = B，又落库；A 被覆盖
  3. Tab A 上 Q1 仍显示 "A"（local state 未变）
- 建议修复：服务端 `AnswerScript` 加 `version` 字段，client 在 `setAnswer` 时带上读到的 version；冲突时 409 让前端拉一次最新值；或更轻量：返回服务端最终落库的 `selectedOption/textAnswer`，UI 用之 reconcile 本地 state。这个对早测影响有限（学生通常一台设备），但对未来 Practice 模式（PR 已有 `?mode=practice`）很关键。

---

## Finding 3 · 离线时积压的修改不会重传 — 仅靠用户后续的 setAnswer 触发

- 严重度：**High**
- 位置：`apps/web/src/components/exam/ExamContext.tsx:140-151` debounce timer 的 `onPersistAnswer` 被 catch 静默吞掉；`shared/OfflineBadge.tsx` 仅渲染指示，无重传逻辑；`ExamContext.tsx:118-127` 的 `online` 事件只切 `isOffline=false`，不 flush
- 影响：
  - 学生离线写了 30 题答案 → 网络恢复后，**只有学生再触发一次 setAnswer 才会推一题**。其他 29 题永远卡在本地。
  - 如果学生在断网期间继续答题，每次 setAnswer 都会跑一次 debounce → 600ms 后 fetch → 异常 → silently 丢；本地 state OK，但服务器永远没收到。
  - OfflineBadge 文案是 *"answers saved locally, will sync on reconnect"* — 这是**虚假承诺**。重连后没有任何 sync 动作。
  - 极端剧本：学生 8:30 上车连不上，30 分钟一直答题，09:00 quizEnd 触发自动 submit；submit 时 `mq:answers:<sid>` 里有完整答案，但服务器只有 0 条 AnswerScript → 评分为 0。
- 重现步骤：
  1. DevTools → Network → Offline
  2. 答 5 题
  3. Network → Online；不要再点任何题
  4. 后端查 AnswerScript → 0 条
- 建议修复：
  - `online` 事件触发时遍历 `answers` 全量重发（带乐观锁见 Finding 2）；或单独维护一个 `pendingDirty: Set<qid>` 跟踪 saveTimer 失败 / 没起来的题。
  - `handleSubmit` 之前应当 flush 所有 pending writes（先 `Promise.all` debounce 队列，再调 submit，见 Finding 5）。
  - 改文案：在没实现重传前不要写 "will sync on reconnect"，避免学生信任后丢分。

---

## Finding 4 · debounce timer 在卸载时不取消，可能在已 unmount 的 Provider 上 setState

- 严重度：**Medium**
- 位置：`apps/web/src/components/exam/ExamContext.tsx:130 `const timersRef = useMemo(() => new Map(...))`；整个 Provider 没有 useEffect cleanup 来 `clearTimeout` 所有 pending timers
- 影响：
  - 用户在 timer pending 时点 "交卷" → `handleSubmit()` `navigate('/student')` → Provider 卸载；但 timer 仍会 fire 一次，调用 `onPersistAnswer` 然后 `setSavingId(null)`。`onPersistAnswer` 闭包了 `sessionId` + `api`，正常返回；但 `setSavingId` 在 unmount 后调用 → React 18 不会崩，但会留 act() warning，并且这个 race window 里的请求**正好是 Finding 5**：在 submit 之后再发一次 saveAnswer，可能 quiz_window_closed 报错（无害）也可能在 `submission.status === 'submitted'` 时 400。
  - 用 `useMemo` 而不是 `useRef` 持有 Map 也略奇怪：useMemo 没有依赖项就能稳，但语义上 ref 更合适。
- 重现步骤：
  1. 答 Q1（启动 600ms timer）
  2. 200ms 内点 "交卷"
  3. 看 Network panel：会先后看到 saveAnswer 和 submit；saveAnswer 可能在 submit 之后到达
- 建议修复：`useEffect(() => () => { for (const t of timersRef.values()) clearTimeout(t); }, [])`；并在 `timersRef.delete(qid)` 后再发请求，避免 race。

---

## Finding 5 · submit 与 autosave 竞态 — 提交后 autosave 仍可能再发一次

- 严重度：**High**
- 位置：`apps/web/src/pages/MorningQuizTake.tsx:71-83` `handleSubmit()` 直接 `api.morningQuizSubmit`，不等 pending debounce 落地；`ExamContext.tsx:139-150` debounce 不感知 submit
- 影响：
  - 时序 A（autosave 还在等 600ms）：用户改 Q1 → 立即点交卷。submit 立刻请求服务器；**Q1 的修改没被发出去**。submit 在服务端把 submission 切到 `submitted`。然后 600ms 后 timer 醒了，发 saveAnswer → 服务端 `submission.status !== 'in_progress'` → 400 `submission_locked`。前端 catch 吞掉，**Q1 的最后一笔修改永久丢失**。
  - 时序 B（autosave 已经 in-flight）：saveAnswer 还在路上，submit 已发出。submit 在服务器先到达 → submission lock；saveAnswer 后到达 → 400。同样丢最后修改。
  - 时序 C（autosave 写库后才 submit）：safe。
  - 综合看是个 **probabilistic 答案丢失 bug**，对用户来说是 "我明明改了 / 答了 Q5，结果没记"。
- 重现步骤：
  1. 答到 Q15（任意题）
  2. 改 Q15 选项；不要 onBlur，不要等待
  3. 立刻点 "交卷"
  4. 后端查 Q15 的 AnswerScript → 是改之前的值（或没有）
- 建议修复：`handleSubmit` 第一步先 `await flushPendingSaves()`（在 ExamContext 暴露一个 flush 方法，用 `Promise.all` 把每个 pending timer 立即触发并 await）；然后再调 submit。

---

## Finding 6 · stale closure：debounce 中的 ans 来自调用瞬间，但 onPersistAnswer 是闭包

- 严重度：**Low**
- 位置：`apps/web/src/components/exam/ExamContext.tsx:144-149`
- 影响：
  - `setAnswer(qid, ans)` → `setTimeout(() => onPersistAnswer(qid, { selectedOption: ans.selectedOption, ... }))`。`ans` 是参数，所以总是最新的那一笔（因为每次 setAnswer 都 clearTimeout 旧 timer 重新建）— 这是对的。
  - 但 `onPersistAnswer` 是 `useCallback(..., [sessionId])` 闭包了 `sessionId`，OK。
  - **真正的小问题**：连续两次 setAnswer，第一次写入"A"，250ms 后第二次 clearTimeout 改成 "B"。timer 内读的 `ans` 来自第二次的参数 = "B"。OK。
  - 但 `setAnswers((prev) => { localStorage.setItem(...) })` 在 setState updater 里同步写 localStorage — 这个**是**对的写法（拿到最新 prev）。
  - 总体：debounce + 自更新参数没有 stale closure 风险。**这条是 false alarm**。保留方便后续 reviewer 不再 raise。
- 重现步骤：—
- 建议修复：—

---

## Finding 7 · localStorage quota exceeded 时静默吞错，用户不知情

- 严重度：**Low（在合理使用下不会触发）**
- 位置：`apps/web/src/components/exam/ExamContext.tsx:135-138`、`162-164`、`109` 全部 `try { localStorage.setItem(...) } catch { /* ignore */ }`
- 影响：
  - 写满了就静默丢；用户没有任何提示。后续刷新 → 拿不到本地缓存 → 必须依赖服务器返回的 initialAnswers。但目前 `initialAnswers` 在 `MorningQuizTake.tsx` 没传（构造 ExamProvider 时没有读 session.answers），所以 quota 满 + 网络抖 = 刷新后所有答案归零。
  - 单 session ~30 题、每题 100 char 文本答案 = ~3 KB；正常不会满。但跨周累计（见 Finding 1）+ Highlights / Notes 大段长字串 + 老用户多年累积，可能撑到 5 MB。
- 重现步骤：人为塞满（DevTools `localStorage.setItem('junk', 'x'.repeat(5_000_000))`）→ 在 take 页面答题 → catch 吞掉 → 刷新 → 全没。
- 建议修复：catch 时至少 `console.warn`；考虑写满时弹一次 toast；并补做 Finding 1 的 GC。

---

## Finding 8 · 服务器没返回学生既有答案，前端 `initialAnswers` 永远是空

- 严重度：**Medium**
- 位置：`apps/web/src/pages/MorningQuizTake.tsx:113` `<ExamProvider sessionId={view.sessionId} mode={mode} onPersistAnswer={persistAnswer}>`（没传 `initialAnswers`）；`apps/api/src/morning-quiz/morning-quiz.service.ts` `findActiveSession` / 相邻 endpoint 也没把 `submission.answerScripts` 包进 `paperQuestions`
- 影响：
  - **新设备 / 隐私模式 / 清过缓存的情况下**：学生在设备 A 答了一半，去设备 B 登录，B 的 localStorage 是空的 → `initialAnswers` 也是空的 → 看到的是空白卷 → 但他以为自己白答了。其实服务器有数据，只是没下发。
  - 这是 "本地缓存 + 服务器持久化" 设计 **不闭环** 的一处 — 文档（UI-QUESTION-TYPES.md）里写了 *"刷新恢复 — Provider 启动时合并 localStorage + initialAnswers"*，但调用方就根本没传 initialAnswers。
- 重现步骤：
  1. 设备 A 答 Q1=A，等 debounce 落库
  2. 设备 B 登录同账号、打开同 sessionId
  3. Q1 显示空
- 建议修复：`session` API 返回里加 `answers: [{ paperQuestionId, selectedOption, textAnswer }]`；`MorningQuizTake.tsx` 把它转成 `Record<qid, ExamAnswer>` 传给 ExamProvider。

---

## Finding 9 · 老版本（a3398dc^）在每次输入都同步发请求 — 重写后 debounce 是巨大改进，但损失了 saving 反馈

- 严重度：**Info / Trade-off**
- 位置：旧 `apps/web/src/pages/MorningQuizTake.tsx:285` `saveAnswer()` 同步 setSavingId、立即 fetch；新 `ExamContext.tsx:142-150` debounce 600ms 后才 setSavingId
- 影响：
  - 用户输入文本时，旧版每输一次都 "saving…"（脏但实诚）；新版要 600ms 安静期才转 saving 态。用户在 0–600ms 这段时间看不到任何 indicator，可能误以为没保存就关页面。
  - 这不是 bug，是 trade-off。但配合 Finding 5（submit 抢跑），用户感知风险更高。
- 建议修复：在 `setAnswer` 同步设一个 `dirty: Set<qid>` UI 态，让 UI 显示 "正在保存…"；timer 落地后清。

---

## Finding 10 · OfflineBadge 仅依赖 navigator.online — 假阴性

- 严重度：**Low**
- 位置：`apps/web/src/components/exam/ExamContext.tsx:96-99`、`118-127`
- 影响：
  - `navigator.onLine === true` 不代表能连后端；学校 WiFi 接得上但 captive portal、DNS 故障、后端宕机 → onLine 仍是 true，OfflineBadge 不显，但 saveAnswer 全部 503/网络错被静默 catch（见 Finding 3）。学生看不到任何异常，以为在保存。
- 建议修复：用真实保存失败率作为信号源（连续 N 次 saveAnswer reject 就视作"离线"），或增加心跳 ping。短期至少把 saveAnswer 失败的 toast 露出来。

---

## 整体结论

ExamContext 的引入相比旧版（每键一发请求、无 localStorage 镜像）整体是大幅改进，单设备正常网络下用起来稳。但**离线弹性是名义上而非实质上的**：OfflineBadge 文案承诺会同步，代码没写重传逻辑（Finding 3），重连只是把指示器藏起来。**submit / autosave 竞态会概率性吞掉最后一笔答案**（Finding 5），加上 timer 没 cleanup（Finding 4），是当前最值得优先修的。多 tab / 多设备并发缺乏服务器版本控制（Finding 2），新设备登录读不到既有答案（Finding 8）— 这两条在早测单机场景下不致命，但 Practice 模式上线后会更明显。建议下一轮把 flush-on-submit + reconnect-resync + initialAnswers 闭环作为一个三件套一起做掉。
