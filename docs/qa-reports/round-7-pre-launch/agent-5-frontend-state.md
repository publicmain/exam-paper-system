# Round 7 上线前 audit · Agent 5 · Frontend State & Null Safety

**审查范围**:`apps/web/src/components/exam/**`、`apps/web/src/pages/MorningQuiz*.tsx`、`ExamContext.tsx`、`apps/web/src/lib/auth.ts`、`apps/web/src/App.tsx`、scan/take/QA review 页面。
**审查方式**:逐文件读取源码,基于真实代码而非推测。

---

## 严重度图例
- **P0**:上线前必须修;能直接 crash、丢分、漏数据或绕过 auth。
- **P1**:上线前应修;边界场景下用户体验显著恶化或导致数据不一致。
- **P2**:上线后跟进;轻量 polish / nice-to-have。

---

## P0-1 · 双击 / 重复点击交卷可能触发两次 POST `/submit`

**位置**:`apps/web/src/pages/MorningQuizTake.tsx:90-104, 197-202, 387-399`

**现象**:
`SubmitButton` 的 `disabled={submitted}` 仅依赖 React state。点击事件 → `onSubmitClick` 先 `await flushPendingSaves()`(在差网络下要 200ms-2s),flush 期间按钮 **仍然 enabled**(因为 `submitted` state 还没被改写)。

```ts
// MorningQuizTake.tsx:197
const onSubmitClick = useCallback(async () => {
  try {
    await flushPendingSaves();  // <-- here button still enabled
  } catch { /* … */ }
  onSubmit();                    // <-- only here setSubmitted(true) fires
}, [flushPendingSaves, onSubmit]);

// MorningQuizTake.tsx:90 (handleSubmit, prop onSubmit 的真身)
async function handleSubmit() {
  if (!sessionId || submitted) return;   // closure-captured `submitted`
  setSubmitted(true);
  ...
}
```

**复现步骤**:
1. 学生在 9:05 网络拥塞时点 "交卷"。
2. flushPendingSaves 因为 saveAnswer 有 dirty 排队,需要等 800ms 以上。
3. 学生焦急二次点击。两次 click 都通过 `disabled={submitted}` 检查(state 还是 false)。
4. 两次 `flushPendingSaves` 串行 settle,接着两次 `handleSubmit()` 在同一个 closure 下都看见 `submitted=false`。
5. 两次 `api.morningQuizSubmit(sessionId)` 并发 POST。

**结果**:两次 submit 抢锁,后端如果未严格幂等(基于 submissionId 且 status 检查),可能产生 `submission_locked` 报错或重复打分。即便后端幂等,前端会在 navigate 前后短暂闪烁 error。

**修复**:

```ts
// 1. 在 click handler 一进入就同步 setSubmitted(true),并用 ref 兜底
const submitInFlightRef = useRef(false);
const onSubmitClick = useCallback(async () => {
  if (submitInFlightRef.current) return;
  submitInFlightRef.current = true;
  setSubmitted(true);                  // <-- 立即 disable UI
  try {
    await flushPendingSaves();
  } catch { /* surfaced via saveError */ }
  try {
    await onSubmit();                  // 把 handleSubmit 改成 async 并把 setSubmitted 移走
  } finally {
    submitInFlightRef.current = false;
  }
}, [flushPendingSaves, onSubmit]);
```

或更简单:`onClick={(e)=>{ e.currentTarget.disabled = true; onSubmitClick(); }}`。后者不优雅但直接堵住竞态。

---

## P0-2 · `OLevelComprehension` / `OLevelCloze` 早 return 在 `useMemo` 之前 → Rules of Hooks 违反

**位置**:
- `apps/web/src/components/exam/questions/OLevelComprehension.tsx:30-43`
- `apps/web/src/components/exam/questions/OLevelCloze.tsx:32-47`

**现象**:
两个组件都在条件早 return 之后才调用 `useMemo`。

```tsx
// OLevelComprehension.tsx:26-43
export function OLevelComprehension({ paper }: { paper: ExamPaper }) {
  const { fontScale } = useExam();         // Hook 1
  const [idx, setIdx] = useState(0);       // Hook 2
  const total = paper?.questions?.length ?? 0;
  if (!total) {                            // 条件 early return
    return <div>该卷尚未出题…</div>;
  }
  const q = paper.questions[Math.min(idx, total - 1)];
  const passageContent = paper.questions[0]?.snapshotContent ?? {};
  const passageTitle = clean(passageContent.passageTitle ?? 'Passage');
  const passageBody = useMemo(() => …, [passageContent.passage]);  // Hook 3 — 顺序不固定!
```

如果一次渲染走 empty 分支(early return),后续渲染又拿到非空 paper → Hook 数从 2 变成 3,React 触发 "Rendered more hooks than during the previous render" 红屏。实战触发路径:
1. 学生进 take 页面,fetch 还没回 → `view` null → 组件未挂载。
2. fetch 回来一个空卷(QA 流程中卷子在生成中),挂载组件,early return,Hook 数 2。
3. 老师在另一个 tab 把卷子补全;某个 polling / 重连场景触发 paper 字段更新 → 现在 questions 非空,组件再渲染走完 Hook 链 → 直接 crash。

**复现步骤**:
1. mock `paper.questions = []` → 渲染 OLevelComprehension。
2. 在父组件改 paper.questions 为有数据 → 同一组件实例的下一次 render 报 Hook order violation。

**修复**:把 `useMemo` 提到 early return 之前,或把空态拆成独立组件。

```tsx
export function OLevelComprehension({ paper }: { paper: ExamPaper }) {
  const { fontScale } = useExam();
  const [idx, setIdx] = useState(0);
  const total = paper?.questions?.length ?? 0;
  const passageContent = paper?.questions?.[0]?.snapshotContent ?? {};
  const passageBody = useMemo(
    () => reflowPassage(clean(passageContent.passage ?? '')),
    [passageContent.passage],
  );
  if (!total) return <div>…</div>;
  …
}
```

`OLevelCloze.tsx:44-47` 同样问题(`useMemo` 在 if 之后)。注:`OLevelMcqList`、`OLevelVocabInContext`、`OLevelSentenceTransformation` 用 useState / setState 但没用 useMemo 在 if 之后,所以 hook 数不变,**不受影响**。

---

## P0-3 · `IELTSReadingPassage` 早 return 也在 `useMemo` 之前

**位置**:`apps/web/src/components/exam/questions/IELTSReadingPassage.tsx:93-110`

**现象**:同上。`useExam`、`useState` 之后,line 100 early return,但 line 109-110 的 `useMemo`(`passageBody`、`groups`)在 return 之后,以及 `useStoredHighlights`、`useStoredNotes`(line 113-115)。

```tsx
if (!paper?.questions?.length) {
  return <div>该卷尚未出题…</div>;
}
const passageContent = paper.questions[0]?.snapshotContent ?? {};
…
const passageBody = useMemo(…);   // ← 在 early return 之后
const groups = useMemo(…);
const [highlights, setHighlights] = useStoredHighlights(hlKey);
const [notes, addNote, editNote, removeNote] = useStoredNotes(noteKey);
```

**修复**:把 hooks 全部提到 early return 之前,空 questions 时把 hooks 喂默认值。

---

## P1-4 · 重新打开同一份未提交的早测,localStorage 没了就丢全部答案

**位置**:`apps/web/src/components/exam/ExamContext.tsx:93-100`、`apps/web/src/pages/MorningQuizTake.tsx:124`(没传 `initialAnswers`)、`apps/api/src/morning-quiz/morning-quiz.service.ts:806-826`(`getStudentView` 不返回 `existingAnswers`)。

**现象**:
- `ExamProvider` 的 answers 状态是 `localStorage cache` 与 `initialAnswers` 合并:`{ ...cached, ...(initialAnswers ?? {}) }`。
- `MorningQuizTake.tsx` 调用 `<ExamProvider>` 时**从不传 `initialAnswers`**。
- 后端 `getStudentView` 也**没返回任何 existingAnswers/Scripts**。
- 结果:学生切换设备 / 清缓存 / 隐私模式 → 回到 take 页时 `localStorage` 是空的,**已经在服务端持久化的答案不会回填到 UI**。学生看到全空白以为系统出错,可能反复点选导致重复 PATCH 覆盖原答案。

**复现步骤**:
1. 学生 A 在自己手机上答了 8 题,debounce 已 flush 到服务端。
2. A 借同班同学 B 的手机扫同一节早测的 QR(签到 deviceUuid 拒了,姑且假设老师人工补登并把 A 的 token 给了 A 的另一台设备)。
3. 新设备打开 `/morning-quiz/:sessionId` → 8 题全空,palette 数字格子全灰。
4. A 误以为答案丢了,重新作答,debounce PATCH 把已存在答案覆盖成空选 / 不同选项。

**修复**:
1. 后端 `getStudentView` 同时 join `Script` 表,返回 `existingAnswers: Record<paperQuestionId, { selectedOption?, textAnswer? }>`。
2. 前端 `MorningQuizTake.tsx` 把它喂给 `ExamProvider initialAnswers={view.existingAnswers}`。
3. cache 与服务端冲突时仍以 server 优先(已经实现了正确的 spread 顺序)。

---

## P1-5 · 提交成功后 stale 本地数据(flags / 高亮 / 便笺 / 分栏比例)不清理

**位置**:`apps/web/src/pages/MorningQuizTake.tsx:84-87`

```ts
await api.morningQuizSubmit(sessionId);
try {
  localStorage.removeItem(`mq:answers:${sessionId}`);
} catch {}
navigate('/student', { replace: true });
```

**现象**:只清了 `mq:answers:${sid}`,但 `mq:flags:${sid}`、`mq:hl:${sid}`、`mq:nt:${sid}`、`mq:split:${sid}` 全部留在 localStorage。早测一天一节,40 周累计 200+ session 的垃圾数据,每个学生 localStorage 容量(各浏览器 5-10MB)迟早溢出,后续 `setItem` 进入 `try/catch` 静默失败 → 答案不再持久化。

**复现步骤**:连续完成 50 节早测后,Chrome devtools → Application → Local Storage 看 200+ 条 `mq:*:<uuid>`。

**修复**:把所有 `mq:*:${sid}` 都清,或重命名为命名空间 prefix `mq:s:${sid}:answers` / `mq:s:${sid}:flags` 等便于一次清理:

```ts
function purgeSessionLocal(sid: string) {
  for (const k of [`mq:answers:${sid}`,`mq:flags:${sid}`,`mq:hl:${sid}`,`mq:nt:${sid}`,`mq:split:${sid}`]) {
    try { localStorage.removeItem(k); } catch {}
  }
}
```

并加个全局清扫:每次 init 时遍历 `mq:*` key,如果 sessionId 对应的 attendance 已经是 7 天前,删掉。

---

## P1-6 · `useStoredHighlights` / `useStoredNotes` 的 setter 不是 stable reference,且 key 变化时不会重新 hydrate

**位置**:
- `apps/web/src/components/exam/shared/Highlighter.tsx:148-164`
- `apps/web/src/components/exam/shared/StickyNote.tsx:20-43`

**现象**:
```ts
export function useStoredHighlights(storageKey: string): [...] {
  const [hs, setHs] = useState<Highlight[]>(() => {  // 仅初始化时读 localStorage
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]'); }
    catch { return []; }
  });
  const set = (next) => {                            // 每次 render 重建函数
    setHs(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };
  return [hs, set];
}
```

两个问题:
1. `set` 不是 `useCallback` 包装,每次 render 是新引用 → `Highlighter` 内部 `onChange` deps 变化触发不必要的副作用(虽然当前实现没有 deps 数组使用 onChange,但脆弱)。
2. 如果父组件改了 `storageKey`(比如 `paper.sessionId` 变化,虽然不太可能),hook 不会读新 key 的值,继续显示旧 session 的高亮。

`StickyNote` 的 `add/edit/remove` 也是每次 render 新引用,且 `add` 闭包捕获的是当前 `notes`,在快速连续点 "+ Add" 时可能丢失中间写入(实测 prompt 阻塞 UI,这个角点踩到概率低,但仍是潜在 race)。

**修复**:用 useCallback,且监听 storageKey 变化重新 hydrate:

```ts
const [hs, setHs] = useState<Highlight[]>(...);
useEffect(() => {
  try { setHs(JSON.parse(localStorage.getItem(storageKey) ?? '[]')); }
  catch { setHs([]); }
}, [storageKey]);
const set = useCallback((next: Highlight[]) => {
  setHs(next);
  try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
}, [storageKey]);
```

---

## P1-7 · `MorningQuizTake.tsx` 初始 fetch 没有 AbortController,且没有 unmount guard

**位置**:`apps/web/src/pages/MorningQuizTake.tsx:62-68`

```ts
useEffect(() => {
  if (!sessionId) return;
  api
    .morningQuizSession(sessionId)
    .then((v: SessionView) => setView(v))
    .catch((e: any) => setError(e.message ?? String(e)));
}, [sessionId]);
```

**现象**:
- 没有 `cancelled` flag 也没有 AbortController。学生在 1.5s 内连点 navigate 到不同 sessionId(罕见但路由层不阻止),旧 promise resolve 时仍会 setState,React 18 dev mode 输出 "Can't perform a React state update on an unmounted component"。
- 离开 take 页(navigate 到 student home)如果 fetch 还在飞,resolve 时也会调用 setState on unmounted。React 18 已经 silent ignore 但仍是反模式。

**对比**:`MorningQuizScan.tsx:60-81` 用了 `cancelled` flag,做对了。其他 page(`StudentHome.tsx:14-16`、`MorningQuizQaReview.tsx:111-113`、`MorningQuizSchedule.tsx:60-63`、`Practice.tsx`)同样无 unmount guard。

**修复**:统一加 cancelled 模式:

```ts
useEffect(() => {
  if (!sessionId) return;
  let cancelled = false;
  api.morningQuizSession(sessionId)
    .then((v) => { if (!cancelled) setView(v); })
    .catch((e) => { if (!cancelled) setError(...); });
  return () => { cancelled = true; };
}, [sessionId]);
```

更彻底:`api.ts` 的 `request` 接受 AbortSignal。

---

## P1-8 · QA Review 页面用 `prompt()` 收驳回原因 → iPad 上很糟,且无法取消

**位置**:`apps/web/src/pages/MorningQuizQaReview.tsx:131`

```ts
async function teacherReject(paperId: string) {
  const reason = prompt('请输入驳回原因(可选)') ?? undefined;
  …
}
```

**现象**:
- `prompt()` 在 iPad Safari 弹原生对话框,字段窄,粘贴/输入中文常出问题。
- 用户按 ESC / 点 "取消" 时 `prompt` 返回 `null`,代码 `?? undefined` 把它转 undefined → 仍然继续 reject API 调用,**没有真正的取消机制**。教师误点 "驳回" 之后无法收回。

**修复**:用一个内联模态,带 "确认 / 取消" 两个按钮。如果用户取消必须 `return` 不发 API。`StickyNote.tsx:74-91` 也用 `prompt()`,iPad 体验同样差,但是低频路径。

---

## P1-9 · QA Review 页面没有 loading 三态,选中卷子后立即清 detail 但 fetch 失败时永远停留 "加载中…"

**位置**:`apps/web/src/pages/MorningQuizQaReview.tsx:100-109, 228`

```ts
async function loadDetail(paperId: string) {
  setSelected(paperId);
  setDetail(null);                  // 进入 "加载中…"
  try {
    const r = await api.qaReviewDetail(paperId);
    setDetail(r);
  } catch (e: any) {
    setError(e.message ?? String(e));   // <-- detail 仍然是 null
  }
}

// line 228:
{selected && !detail && <div className="text-gray-500 text-sm">加载中…</div>}
```

**现象**:`qaReviewDetail` 失败时,顶部 banner 显示错误信息,但右侧详情卡片一直显示 "加载中…"。教师不知该卷为何不出来,以为还在转圈。

**修复**:在 catch 里 `setSelected(null)` 或新增一个 detailError state,UI 渲染优先级 `selected && !detail && !detailError ? 加载中 : detailError ? 错误 : detail ? … : 提示`。

---

## P1-10 · `MorningQuizSchedule.tsx` 的 `to={`/morning-quiz/dashboard/${s.id}`}` 是死链

**位置**:`apps/web/src/pages/MorningQuizSchedule.tsx:301`、`apps/web/src/App.tsx:241-271`(无 `/morning-quiz/dashboard/:id` 路由)

**现象**:本周已排课表里 "Dashboard →" 链接指向 `/morning-quiz/dashboard/:id`,但 App.tsx 没有这个 route,`<Route path="*" element={<Navigate to="/" replace />} />` 把它打回首页。教师点了以为打开 dashboard,结果跳回 Dashboard 页。

**修复**:要么补 `<Route path="/morning-quiz/dashboard/:sessionId" element={<MorningQuizDashboardPage/>} />`(并实现页面),要么把链接改成现有可用路径(例如 `/morning-quiz/qa-review` 已经有,或者直接干掉这个按钮,等 dashboard 页做出来再加)。

`api.morningQuizDashboard` 这个后端接口存在(`api.ts:278`),但前端没有页面消费,显然是半截功能,应在上线前删除或补全。

---

## P1-11 · Take 页面的 `handleSubmit` 在 Time-Up 自动提交时不 flush autosave

**位置**:`apps/web/src/pages/MorningQuizTake.tsx:300`、`90-104`

```tsx
<Timer endsAt={paper.quizEnd} onTimeUp={onSubmit} />
```

`onSubmit` 是父组件的 `handleSubmit`,**直接** `submitToServer` 不经过 `flushPendingSaves`。代码注释自己也承认了:

> 但 the local cache + reconnect replay covers the remaining loss window

**现象**:学生 9:00:00 还在敲一道短答题,debounce 计时器 600ms 还没到,Timer 一到 0 就 onTimeUp → submit。后端在 submit 后会把 submission 锁住,后续 saveAnswer 报 `submission_locked` → autosave 永远到不了。学生最后 600ms 的输入丢失。

**修复**:`Timer` 的 `onTimeUp` 走 `onSubmitClick`(同样先 flush 再 submit)。fire-once 仍然由 `fired` ref 保证。

```tsx
<Timer endsAt={paper.quizEnd} onTimeUp={onSubmitClick} />
```

不过这要把 `onSubmitClick` 从 `ExamShellChrome` 提到能给 Timer 用的位置,或者由 `useExam().flushPendingSaves` 让 Timer 自己 flush。

---

## P1-12 · `setAnswer` 局部 state(`LetterInput`/`DebouncedTextarea`/`BlankAwareInput`)只在 onBlur commit,Time-Up auto-submit 不触发 blur

**位置**:`apps/web/src/components/exam/questions/IELTSReadingPassage.tsx:409-454, 457-495`(LetterInput, DebouncedTextarea, BlankAwareInput)

**现象**:
```tsx
function LetterInput(...) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onChange(local); }}
      ...
    />
  );
}
```

只有 blur 才 commit,Timer 强制 submit 时不会触发 blur,本地 state 直接丢。`InlineGapInput` 已经修复(`H20`,onChange 也 schedule commit),但 `IELTSReadingPassage` 里这三个孪生组件没修。

**复现步骤**:
1. 学生在 `LetterInput` 中输 "C" 准备答 matching_information。
2. 9:00:00 整 timer fire onTimeUp → 父组件 setSubmitted(true) → submit。
3. 学生输入仅在该 input 的本地 state,**从未 commit 到 ExamProvider**,就更没 PATCH 到服务端。
4. 提交后丢分。

**修复**:把这三个组件改成同 `InlineGapInput` 的 schedule commit 模式,或在 onTimeUp 之前显式 `(document.activeElement as HTMLElement)?.blur()` 强制冲所有 input。后者更便宜:

```ts
const onTimeUp = useCallback(() => {
  // 让所有受控 input 触发 blur,提交本地 state
  (document.activeElement as HTMLElement | null)?.blur();
  // 然后再走 flush + submit
  onSubmitClick();
}, [onSubmitClick]);
```

---

## P2-13 · `Highlighter` 的 `mergeHighlight` 用 `id: merged.id` 但合并多段时丢老 id

**位置**:`apps/web/src/components/exam/shared/Highlighter.tsx:39-55`

**现象**:相邻区域用新 id 替换原 id,移除被合并的 id。点击 mark 删除时按 `id` 移除,新 id 是合并后的新 id 没问题。**但**:如果学生先选了 A 高亮,再用 trackpad 框选了与 A 部分重叠的 B,合并后高亮的 id = B 的 id,A 的 id 被丢弃。如果其他地方(以后)用 highlight.id 做 reference,会断。**当前没用到,所以暂列 P2**。

---

## P2-14 · `Timer` 在 tab 切到后台时 setInterval 被节流,显示时间偏慢

**位置**:`apps/web/src/components/exam/shared/Timer.tsx:16-19`

**现象**:`setInterval(() => setNow(Date.now()), 1000)` 在 background tab 节流到 1s+,但 `now = Date.now()` 始终是 wall clock,所以 remainingMs 仍然准确。Timer fires once 也是基于 remainingMs===0 + fired flag,**实际不影响**。但学生切回 tab 看到时钟从 03:21 跳到 03:00,会觉得不连续。属于 UX nit。

---

## P2-15 · `ExamProvider` 的 `hasPendingSaves` 不是 reactive,timersRef.current.size 改变时不会重新 render

**位置**:`apps/web/src/components/exam/ExamContext.tsx:264`

```ts
const hasPendingSaves = !!savingId || timersRef.current.size > 0 || dirtyRef.current.size > 0;
```

`timersRef.current.size` 是 ref 引用,变化不触发 re-render。`hasPendingSaves` 在 `useMemo` 里依赖了 `savingId` 和上面这两个 size 表达式,但 size 变化不会 invalidate(因为 dep 数组里没 size,只有 savingId 等)。结果 `hasPendingSaves` 实际只反映 `savingId` 的变化,UI 上的 "系统将自动重试" 提示偶发滞后。

**修复**:把 dirty count 提升为 useState,每次 setAnswer 时增,persistOne 成功时减。或在每次 timer 启动 / dirty 变更时强制 setSavingId 触发 re-render(已经做了)。

---

## P2-16 · `App.tsx` 教师角色没有 `/morning-quiz/:sessionId` 路由 → 教师扫码或被分享链接打开会跳首页

**位置**:`apps/web/src/App.tsx:108-273`(教师/admin 分支)、`apps/web/src/App.tsx:100`(student 才有)

**现象**:teacher 想自己点开早测看长什么样,直接访问 `/morning-quiz/<sid>` → 没匹配 → `Navigate to="/"` 回 dashboard,看不到 take 页。需要先注销 / 切换学生角色才能看。
**修复**:把 `/morning-quiz/:sessionId` 路由也加到教师 layout(以预览模式呈现,不写答案),或在 schedule 页提供 "preview" 链接。

---

## P2-17 · `MorningQuizTake.tsx` 的 error 状态只能让用户回首页,无 "重试" 按钮

**位置**:`apps/web/src/pages/MorningQuizTake.tsx:106-115`

```tsx
if (error) {
  return (
    <div>
      <div>⚠️ {error}</div>
      <button onClick={() => navigate('/student')}>返回首页</button>
    </div>
  );
}
```

**现象**:加载 session 失败(网络抖动)只能放弃,没有 "重试" 按钮。学生可能因为短暂网络问题就丢了整节早测。

**修复**:加 "重新加载" 按钮,clear error + 重 fire fetch。或者干脆 `window.location.reload()`。

---

## P2-18 · QA Review 不轮询 / 不实时刷新,新生成的 needs_review 卷子不出现

**位置**:`apps/web/src/pages/MorningQuizQaReview.tsx:111-113`

`useEffect(refresh, [])` 只首次 fetch。教师手动刷新页面才能看到新进队列的卷子。批量生成的 batchSchedule 流程会在后台异步产出新 needs_review,教师停在这个页面 5 分钟看不到任何新东西,以为系统出错。

**修复**:`setInterval(refresh, 30_000)` 简单足够,在 unmount 时 clear。

---

## 不属于本次 audit 但顺便观察到的事项(供其他 agent 接力)

1. `apps/web/src/lib/auth.ts:20-44` — `useAuth.token` 字段在 store 初始化时读 `localStorage` 并存,但 `login` / `logout` 都没用 token 字段,只设 user。如果 SDK 版本切换,`token` 在 store 里的真实性可疑(虽然 api.ts 直接读 localStorage,所以不影响功能)。
2. `apps/web/src/components/exam/questions/IELTSReadingPassage.tsx:286` — `QuestionItem` 解构出来的 `setAnswer` 在 default 分支里通过 `DebouncedTextarea` 的 onChange 间接触发,但实际链路对应 `onChange` callback 里又调 `setAnswer`,逻辑是对的。这里只是 lint 上 setAnswer / answers 作用混在一起,可读性差。
3. `apps/web/src/pages/MorningQuizSchedule.tsx:60-63` 的 `// eslint-disable-next-line react-hooks/exhaustive-deps` 是有意的(refresh 闭包 capture),但应该用 useCallback 把 refresh 提出来,deps 包含 weekStart,代码更安全。

---

## 总结

**P0 阻断上线**:3 处
- 双击 / 重复点击 submit → 重复 POST(MorningQuizTake.tsx)
- `OLevelComprehension`、`OLevelCloze`、`IELTSReadingPassage` 把 useMemo 放在 early return 之后违反 Hook 规则

**P1 应在上线前修**:8 处
- existingAnswers 不回填 → 跨设备 / 清缓存丢答(API+UI 协作)
- 提交后只清 answers,不清 flags / hl / nt / split → localStorage 越积越多
- `useStoredHighlights` / `useStoredNotes` setter 非 stable ref + key 变化不 hydrate
- `MorningQuizTake.tsx` 等多个页面 fetch 无 unmount guard
- QA review 用 prompt() 收驳回原因 + 取消不生效
- QA review fetch 失败永远 "加载中…"
- `/morning-quiz/dashboard/:id` 死链
- Time-Up onTimeUp 不 flush + IELTS 三个 input 组件只在 blur commit → 最后 600ms 输入丢失

**P2 跟进**:6 处(代码注释已说明)

最高 ROI 修复顺序:**P0-1(double-submit)** → **P0-2/P0-3(Hook 顺序)** → **P1-11/P1-12(Time-Up flush + blur)** → **P1-4(existingAnswers 回填)**。前 4 项修完早测主流程在边界条件下就稳定了。

---

*Generated by Agent 5 · Frontend State & Null Safety · Round 7 pre-launch audit*
