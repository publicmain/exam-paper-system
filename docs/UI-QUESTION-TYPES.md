# Exam Shell · 题型 UI 指南

> 学生答题界面的题型组件家族。每种题型一个独立组件，由 `QuestionTypeRegistry` 自动调度。

## 整体结构

```
apps/web/src/components/exam/
├── types.ts                      # ExamPaper / ExamQuestion / ExamMode 等共享类型
├── ExamContext.tsx               # 顶层 Provider:答案缓存 / 字号 / 标记 / 离线
├── QuestionTypeRegistry.tsx      # 调度器:根据 paper 数据挑选 renderer
│
├── shared/                       # 跨题型可复用的基础组件
│   ├── Timer.tsx                 # 倒计时(最后5分钟变红)
│   ├── FontSizeAdjuster.tsx      # A− / A+ 字号调节
│   ├── QuestionFlag.tsx          # 单题"标记复习"按钮
│   ├── QuestionNavBar.tsx        # 题号导航条 (done/skip/flag 三态)
│   ├── Highlighter.tsx           # 选中文字加 yellow highlight
│   ├── StickyNote.tsx            # 便签条
│   ├── DraggableSplit.tsx        # 可拖动分隔条
│   ├── InlineGapInput.tsx        # 内联填空 input
│   ├── OfflineBadge.tsx          # 网络断开提示
│   └── textUtils.ts              # PDF 提取文本清洗
│
└── questions/                    # 每种题型一个文件
    ├── IELTSReadingPassage.tsx           # 雅思机考分屏 + 题组
    ├── OLevelComprehension.tsx           # 阅读理解(50/50 不可拖)
    ├── OLevelCloze.tsx                   # 完形填空(行内输入)
    ├── OLevelVocabInContext.tsx          # 语境词汇 MCQ(卡片式)
    ├── OLevelSentenceTransformation.tsx  # 句型转换(原句→改写)
    └── OLevelMcqList.tsx                 # 通用 MCQ(逐题翻页)
```

## 渲染调度

`QuestionTypeRegistry.pickRenderer(paper)` 按以下优先级选择 renderer：

1. **IELTS Reading 系列** — 当 `paper.paperMode === 'passage_pick'` 或者第一题的 `snapshotContent.taskType` 是 IELTS 任务类型(matching_*, true_false_not_given, *_completion 等)。
2. **显式 uiKind 提示** — `snapshotContent.uiKind` 为 `cloze` / `vocab` / `transformation`，路由到对应 O-Level 组件。
3. **长 passage 启发式** — 第一题的 `snapshotContent.passage` 长度 > 200 且题量 > 1 时，视为阅读理解。
4. **回退** — 通用 `OLevelMcqList`(逐题翻页 MCQ)。

调度完全由数据驱动 — `level` 字段只是后端自动填的提示，不是开关。

## 共享数据契约

每个题型组件接收同一个 `ExamPaper`：

```ts
interface ExamPaper {
  sessionId: string;
  quizEnd: string;                          // ISO 时间戳
  level: 'ielts_authentic' | 'ielts_hard' | 'olevel';
  paperMode: 'passage_pick' | 'standard' | null;
  questions: ExamQuestion[];
}

interface ExamQuestion {
  id: string;
  sortOrder: number;
  marks: number;
  questionType: 'mcq' | 'short_answer' | 'structured' | 'essay';
  snapshotContent: any;                     // 题型自定义字段
  snapshotOptions: ExamOption[] | null;
}
```

每个题型组件**只读** `snapshotContent` 中它关心的字段；其他字段透传。

## 各题型 snapshotContent 期望字段

### IELTSReadingPassage
- `passageTitle: string`
- `passage: string`              — 共享原文（仅第一题需要，其它题忽略）
- `taskType: TaskType`           — 决定子题如何渲染
- `stem: string`                 — 包含 `instruction` + 单题项，按最后一个空行切分
- `headingsBank: ExamOption[]`   — Matching Headings 的题库(可选)
- `wordBank: ExamOption[]`       — Summary Completion 的词库(可选)
- `correctOption: string`        — 练习模式判分用(可选)
- `explanation: string`          — 错题反馈(可选)

### OLevelComprehension
- 同 IELTS 但忽略 `taskType`
- `passage: string`              — 第一题共享
- `passageTitle: string`
- `stem: string`
- `correctOption: string`        — 练习反馈
- `explanation: string`

### OLevelCloze
- 第一题: `passage: string` 含 `[BLANK]` 标记，第 N 个 [BLANK] 对应第 N 题
- 每题: `correctAnswer: string` — 练习模式判分(大小写不敏感)

### OLevelVocabInContext
- `contextSentence: string`      — 含目标词的句子
- `targetWord: string`           — 重点词,会加粗+下划线
- `correctOption: string`
- 4 个 `snapshotOptions`

### OLevelSentenceTransformation
- `original: string`             — 原句
- `starter: string` (可选)        — 改写需以此开头
- `maxWords: number` (可选)       — 软限制,超出红色提示
- `exampleAnswer: string` (可选)  — 练习模式可展开查看

### OLevelMcqList
- `stem: string`
- `correctOption: string`
- `explanation: string`(可选)
- 普通 `snapshotOptions`

## 训练 vs 测验模式

URL 参数 `?mode=practice|test` 切换。默认 `test`。

| 模式 | 主题色 | 反馈 | 复盘 |
|---|---|---|---|
| **test** | 蓝(中性灰底) | 提交后才出分 | 严格计时,无重做 |
| **practice** | 绿(emerald) | 选完即时显示对/错 | 可来回调整,显示解析 |

判分逻辑在每个题型组件内独立处理 — 看 `mode === 'practice' && correctKey && answer.selectedOption`，匹配则绿色边框+对勾，否则红色边框+正确答案+解析。

## 自动保存 + 离线

`ExamProvider` 内部维护:

- **答案缓存** — 每次 `setAnswer` 立即写 `localStorage` (key=`mq:answers:<sessionId>`)
- **服务端保存** — 600ms debounce 后调用 `onPersistAnswer`,失败不抛错
- **页面刷新恢复** — Provider 启动时合并 localStorage + initialAnswers
- **离线提示** — 监听 `navigator.online/offline`,顶部弹"离线 · Offline"小条
- **字号偏好** — 跨 session 持久化(`mq:fontScale`)
- **标记复习** — 每 session 持久化(`mq:flags:<sessionId>`)

## 移动端

- IELTS 分屏在 < 1024px 折叠为上下切换 tab(原文 / 题目)
- O-Level 已经是逐题翻页,天然适配
- 所有按钮 ≥ 44×44 触摸区
- iPad 安全区: header `padding-top: env(safe-area-inset-top)`,footer 同理 bottom

## 加新题型 6 步

1. 在 `apps/web/src/components/exam/questions/` 新建 `<NewType>.tsx`,export 一个接收 `paper: ExamPaper` 的 React 组件
2. 在 `types.ts` 的 `QuestionRenderKind` 加新枚举值(可选,文档作用)
3. 在 `QuestionTypeRegistry.tsx` `pickRenderer()` 加路由分支
4. 决定 `snapshotContent` 的字段并在本文档补充契约
5. 在 `__tests__/registry.test.ts` 加该 uiKind 的路由测试
6. (可选)在 `__tests__/<NewType>.test.tsx` 写组件交互测试

## 测试

```bash
npm run --workspace @app/web test
```

当前覆盖:`textUtils`(纯函数)、`registry`(分支调度)、`ExamProvider`(state + 持久化 + debounce)、`OLevelMcqList`(渲染 + 翻页 + 反馈)、`OLevelSentenceTransformation`(字数限制)。共 26 用例。

## 后端契约

`GET /morning-quiz/sessions/:id` 返回新增字段:

```ts
{
  ...
  level: 'ielts_authentic' | 'ielts_hard' | 'olevel',
  paperMode: 'passage_pick' | 'standard' | null,
  paperQuestions: [...]
}
```

`level` 优先取 `ClassEnglishLevel`，缺失时根据 `paper.config.mode` 推断(`passage_pick` → `ielts_authentic`，否则 `olevel`)。前端不必依赖 `level`，仅作展示提示。
