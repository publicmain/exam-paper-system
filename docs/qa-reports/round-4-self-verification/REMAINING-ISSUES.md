# Round-4 — 仍存在的 limitation

下面 4 项在 round-3 audit 中作为 High 列出，本 PR **没有完整修复**，但都不是当下的线上紧急风险。每条给出复现步骤、当前缓解、和未来真修复的 PR 框架。

---

## L1 — H4 多 tab / 多设备并发无版本

**Reproduction**:
1. 学生开 tab A → 给 Q3 答 "A"，autosave 600ms 后服务器存"A"
2. 学生开 tab B → 看到 Q3 已答"A"
3. tab A 改答 "B" → autosave 队列里
4. tab B 改答 "C" → autosave 队列里
5. 两个 PATCH 几乎同时到 → server upsert last-write-wins → "B" or "C" 全凭时序

**当前缓解**:
- H22: 任何 PATCH 失败都顶部红 banner（如 server 加 version 后 409）
- H6: submit 前 flush，至少 submit 那一刻是确定的
- 学生通常一次只开一个 tab，实际触发概率低

**完整修复 PR scope**:
1. `prisma/schema.prisma`: AnswerScript 加 `version Int @default(0)`
2. migration `prisma migrate dev --name add_answer_script_version`
3. `morning-quiz.service.saveAnswer`: 接收 `expectedVersion?: number`，upsert 用 `where: { id, version: expectedVersion }` + `data: { ..., version: { increment: 1 } }`
4. 冲突 → 409 + `{ currentValue, currentVersion }` payload
5. 前端 ExamProvider 跟踪 `lastSavedVersion`，409 时 merge 重发

估时: 半天（含 prod migration + rollout）

---

## L2 — H2 snapshotContent: any 类型逃生口

**Reproduction**: TypeScript 完全不知道 `q.snapshotContent.correctOption` 的类型 — typo / 拼错字段 / 加新字段都不会 fail tsc。

**当前缓解**:
- C1 redaction 白名单是运行时硬边界（API 边界外不会泄）
- `docs/UI-QUESTION-TYPES.md` 是契约文档（人工维护）
- 各组件用 `typeof` 守在读取处

**完整修复 PR scope**:
1. `types.ts` 改成 discriminated union：
```typescript
type ExamSnapshot =
  | { taskType: 'matching_headings'; passage: string; passageTitle: string; stem: string; headingsBank: ExamOption[] }
  | { uiKind: 'cloze'; passage: string }
  | { uiKind: 'vocab'; contextSentence: string; targetWord: string }
  | { uiKind: 'transformation'; original: string; starter?: string; maxWords?: number }
  | { stem: string; passage?: string; passageTitle?: string };
```
2. 6 个题型组件改用 narrowing：`if (sc.taskType === 'matching_headings') ...`
3. 后端 quick-paper.service.ts 生成时也用此类型
4. AI 生成器 prompt schema 同步

估时: 1-2 天（要触达每一个题型组件的字段访问点）

---

## L3 — H10 Highlighter offset 协议无版本

**Reproduction**:
1. 学生周一在 IELTS Reading Passage 高亮 "climate change" — 存 offset [120, 134]
2. 周二 reflowPassage 函数被改了 — \n\n 被折叠 → 同样原文映射成不同字符串
3. 周二学生再看那条高亮，[120, 134] 现在指向乱码

**当前缓解**:
- reflowPassage 在生产中已稳定 6+ 个月，没有变更计划
- 高亮纯学生本地辅助，丢失最多就是"白干"，不影响成绩
- iOS touchend timing 已修（H21）让新建高亮稳定

**完整修复 PR scope**:
1. Highlight 类型加 `bodyHashPrefix: string`（前 16 字符 SHA-256）
2. 写入时记录 hash; 读取时校验
3. 不匹配 → 静默丢弃 + 一次性 toast "上次的标记已失效"
4. localStorage migration 删旧 key

估时: 半天

---

## L4 — H12/H13 IELTS 渲染性能

**Reproduction**:
- IELTSReadingPassage 一次展开所有 group（task1/2/3/4 都渲染）
- renderHighlighted 没 useMemo — 每次 ExamProvider state change 整段 passage 重切

**当前缓解**:
- 题量上限 30，passage 长度上限 ~1500 字
- 实测 iPad Pro 渲染延迟 < 50ms（人眼 < 100ms 不感）
- H14 paper useMemo 已经把 props 稳定，passage 不会因 setAnswer 重切

**完整修复 PR scope**:
1. group 改成 `<details><summary>` 折叠（Examplify 风格），默认仅 task1 展开
2. renderHighlighted 拆成 `<HighlightedSegment key={i}>` + 内部 useMemo
3. 性能基线打点（vitals → /api/perf 上报）

估时: 1 天

---

## 风险评估

| ID  | 用户感知影响 | 数据丢失风险 | 修复优先级 |
| --- | ----------- | ----------- | --------- |
| L1  | 罕见（多 tab 学生少） | 中（覆盖一题） | P1 |
| L2  | 无（开发-time only） | 无 | P3 |
| L3  | 罕见（reflow 稳定） | 无（高亮丢失非数据丢失） | P3 |
| L4  | 无（性能 OK） | 无 | P4 |

建议: L1 单独开 hotfix-followup PR；其余进 backlog 评估。
