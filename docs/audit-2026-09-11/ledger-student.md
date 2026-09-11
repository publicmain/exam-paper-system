# 整改台账 · 学生端与设计系统（主分支 `audit-ios-rebuild-2026-09-11`）

范围：IOS-01–IOS-09、IOS-11、IOS-12，UI02、UI04、UI05、UI07（前端）、UI08–UI15，各 VOC 条目的前端部分，
以及合并各组分支时的收尾（S06 / S08 / UI01 / S02 / VOC05 的前后端衔接）。

证据约定：「修前红」= 同一份新用例跑修改前的代码（`git show HEAD:<文件>` 换回旧页面）的结果；
测试都在 `apps/student-web/src/__tests__/`（API 的在 `apps/api/src/**`）。截图是 **Chromium 视口模拟**，
不是 Safari / iPad 真机（见 IOS-12）。

## 状态总览

| ID | 状态 | 主要提交 | 测试 / 证据 |
|---|---|---|---|
| IOS-01 统一外壳与导航 | 已验证 | 413d2cf 101fe6a | design-system.test（63）；外壳截图 320–1366 |
| IOS-02 视觉 token 与层级 | 已验证 | 413d2cf | design-system.test 对比度 / token 检查；浅深两套截图 |
| IOS-03 字体、触控与可访问性 | 已验证（机器可量部分） | 413d2cf 35c2049 3637347 | 截图量尺：小于 44px 的可点元素计数（见 IOS-12）；读屏名中文化 |
| IOS-04 首页按学生任务重排 | 已验证 | 3e498bc 0739c91 | today.test（37，修前 33 红 4 绿） |
| IOS-05 阅读 / 结果 / 历史同一工作区 | 已验证 | 0195397 3637347 73df750 | draggable-split（9）、reading-page（43）、reading-result（50） |
| IOS-06 查词面板 | 已验证 | 7069916 4a978b2 | word-sheet-ios（5）、exam-word-sheet（56） |
| IOS-07 学词 / 背一背 / 正式词测 | 已验证 | 42272a6 | vocabulary-coach-v2（16）、vocab-recite（11） |
| IOS-08 我的单词与自助抽查 | 已验证 | 42272a6 | vocab-center（18）、vocab-book（6） |
| IOS-09 账号与学习记录 | 已验证 | f534e83 0195397 73df750 | auth（19）、scores（30）、push-account（6） |
| IOS-10 教师工作台 | 已验证（判分组四页 + 本轮进度表） | 见 ledger-marker；9fae1c2 | VocabClass（13，本轮新增 3 例修前 3 红） |
| IOS-11 加载 / 错误 / 空态 / 对话框 | 已验证 | 413d2cf 0195397 | dialog（5）；各页「局部失败」用例 |
| IOS-12 响应式与性能验收 | 部分完成：视口矩阵与构建体积已测；**真机待验** | 本台账 §IOS-12 | `.local/audit/screens/matrix/`（metrics.json） |
| UI02 查词按钮操作了另一个词 | 已验证 | 42272a6 | vocab-center UI02 组 4 例 |
| UI04 搜索导致整页卸载失焦 | 已验证 | 42272a6 | vocab-center UI04 组 4 例 |
| UI05 概览失败被吞成「没有待办」 | 已验证 | 3e498bc | today.test UI05 组 7 例 |
| UI07 共用设备推送归属（前端） | 已验证 | f534e83 dd75d35 | push-account（6） |
| UI08 iPad 拖动取消后仍在拖动 | 已验证 | 0195397 | draggable-split（9） |
| UI09 保存偶发失败后无法交卷 | 已验证 | 0195397 | reading-state UI09 4 例（3 例修前红） |
| UI10 今日总结与旧课程状态冲突 | 已验证 | be7473b bbdd915 | lesson-summary（27，修前 15 红 12 绿）；s12i 总结块 |
| UI11 跨午夜交卷打开了新一天 | 已验证 | 0195397 | reading-result UI11 用例 |
| UI12 提交错误在弹窗背后 | 已验证 | 0195397 | reading-page UI12、dialog（5） |
| UI13 「学词」仍强迫先开阅读 | 已验证 | 3e498bc | today.test UI13 组 6 例 |
| UI14 「2/2」漏算正式词测 | 已验证（前后端） | 3e498bc；e5d20d7（allDone 口径） | today.test UI14 组 6 例；voc06-home-status 新增 2 例（旧口径下 2 红） |
| UI15 临时网络失败导致重登清草稿 | 已验证 | f534e83 | auth.test、reading-storage |
| VOC 前端部分（04 08 10 11 12 13，06 展示） | 已验证 | 42272a6 3e498bc 9fae1c2 | 见 IOS-07 / IOS-08 / VocabClass |
| VOC05 前端（阅读收词带出处） | 已验证 | 16f6c3c | exam-word-sheet 两例断言 `sourceRef: session:<id>` |

---

## IOS-04 / UI05 / UI13 / UI14 · 今日

**修复位置**：`apps/student-web/src/pages/Today.tsx`（整页重写）；服务端 `vocabulary-v2.service.ts` overview 的 `allDone`。

- 三张任务卡（今日阅读 / 每日新词 / 正式单词测试），各自状态、真实进度和**只启动自己**的动作。
  学词直接进学习页、不调 `lesson/start`；阅读没发布也能学词、开测试；「开始阅读」只发
  `lesson/start {begin:true}`（`lesson.service` 的 begin 只建阅读答卷），start 后服务端说进不去就留在今日。
- 完成度 = 适用项里完成的 / 适用项数。待老师批、系统收卷算完成；全部延后时测试「不需要」
  不进分母；阅读没发布不进分母；学词做完但测试没交不是全部完成。**服务端 `home.allDone` 同步改为同一口径**
  （`auto_closed` 算结束、阅读 `not_generated` 不挡；voc06 新增两例，旧口径下两例都红）。
- `/lesson/today` 与 `/vocab-v2/overview` 分开加载、分开报错、分开重试；失败处写「没加载出来，
  不代表今天没有任务」，完成度「先不算」。
- 旧待办放在三项之后，按日期分组、写清欠几项，默认展开最早两天，「查看全部待办」展开其余。
- 页头：日期、连续天数、身份与今天阅读难度（点开去账号）。错题不占今天的一席。
- **测试**：today.test 37 例（新规则 + 保留请求卫生、`{begin:true}`、双击一次、忽略 href、认证失败、路由兜底）。
  修前 33 红 4 绿（绿的是旧页面本来就对的路由兜底）。
- **截图**：`today-{fresh,midday,backlog,test-pending,no-reading,all-deferred,done,weekend,overview-fail,offline}`。

## UI10 · 今日总结

**修复位置**：`pages/LessonSummary.tsx`（重写）。与首页同一套纯函数、同样三个 GET（`/lesson/today`、
`/vocab-v2/overview`、`/vocab-v2/tests`）；不再按旧 `nextAction/allDone/completed===total` 回跳首页。
三项都做完才写「今天的三项都做完了」，没做完写「还有 N 项没做完」并列出已做的部分；词测照冻结卷
「答对 c / t」，不重算百分比；只读零写。

**测试**：lesson-summary 27 例，修前 15 红（含「旧字段不同意也不回跳」「没做完能看已做部分」）12 绿；
s12i「总结页只在做完时渲染」块按 UI10 改写（原规则正是循环根源）。

## IOS-07 / IOS-08 / UI02 / UI04 · 词汇三页

**修复位置**：`pages/VocabularyCoach.tsx`、`VocabularyCoachLearn.tsx`、`VocabularyCoachTest.tsx`（重写）；
`lib/api.ts`（新契约类型、`notebook/restore`、`custom-test/cancel`、`daily/review`、`daily/history`、
`test/audio` Blob 取法）；`lib/speak.ts`（`playBlob`）。

- 我的单词：生词列表 / 测试待办 / 已移出三段，条件写在网址里；搜索框不卸载、250ms 防抖、输入法组合中
  不查、旧请求作废（UI04）；游标「加载更多」，跨批去重，移空当前批就重取（UI03，31/65/500 词走到底）；
  移出就地 + 撤销；已移出写「重新加入」走 restore（VOC13）；查词动作只作用于卡上的词（headword + senseId），
  输入改了先停用，慢查询晚回不串词（UI02）；抽查小表单写能抽上限、明说不记正式成绩。
- 学词：一屏教清一个词，扩展内容收在「更多」；三个动作各有一句写明数量变化的反馈；进度把学完 / 延后 /
  还剩分开写（VOC08）；换词带屏幕上这张卡的 senseId，双击只发一次。
- 背一背 / 回看（VOC12）：学完的那天再进来 = 只读回看原来那批词，不送回首页、不重建卷子；回看接口取不到
  就用手上的会话。全部延后说清这些词去哪了。
- 测试：页头写日期、新词 + 旧词抽查、共几题（VOC06）；选项题写明「点选即作答」；听写凭 sessionId + itemId
  取音频、放不出来不念答案（VOC04）；造句题照服务端检查结果说，永远不说「句子正确」（VOC11）；自助抽查
  退出确认后 `custom-test/cancel`，410 过期明说（VOC10）。
- **测试**：vocab-center 18、vocabulary-coach-v2 16、vocab-recite 11、vocab-book 6（改写：移出不再二次确认、
  重新加入）；三份新用例跑修改前三页 **43 红 2 绿**。

## IOS-10（本轮部分）· 教师词汇进度表

`apps/web/src/pages/VocabClass.tsx`：欠阅读只算今天以前并列出日期、已取消另注「不算欠」（T01）；新增「今日测试」
列（学完才有 / 不需要 / 待完成 N 题 / 已完成，VOC08）；「今日新词」写学完 / 延后；测试待办按题数、没生成的
份数单独说（VOC06）。VocabClass 新增 3 例，修前 3 红。判分队列、逐题判分、班级统计、词表五档见 `ledger-marker.md`。

## 合并收尾（跨组）

| 事项 | 提交 | 证据 |
|---|---|---|
| S08：词汇 profile / overview / daily/review / daily/history 放开教师只读 | e5d20d7 | student-access.spec「服务层证据」由「会写」改断言「零写」；guard-chain.e2e 清单同步 |
| S08：答题页 `GET /morning-quiz/sessions/:id` 不再隐式写库（`shuffle.peek`） | 0ff5411 | shuffle-peek.spec 4 例；旧代码同一用例记到 2 次 `questionShuffleMap.upsert` |
| S06：词汇组新接口 `custom-test/cancel`、`test/audio` 按学生限流 | 303fa0a | rate-limit-scope.spec（合并后当场抓到 2 处 `ip`） |
| S06：`PATCH me/english-level` 改按学生限流 | 0ff5411 | rate-limit-scope.spec |
| UI01：花名册改档也写 `StudentLevelChange` | 8c751e7 | english-level.spec 精确写入清单 + 2 例 |
| S02：score_ready 通知链接不再是 `/my-history?name=` | 8c751e7 | student-links.spec（源码级守卫） |
| VOC05：阅读收词带 `sourceRef: session:<id>` | 16f6c3c | exam-word-sheet 2 例 |

## IOS-12 · 响应式与性能

- 视口矩阵：`dev-fixtures/shoot.mjs`，页面 × 场景 × 10 个宽度（320 / 390 / 430 / 640 / 744 / 768 / 820 / 1024 / 1180 / 1366）
  × 浅深两套；每张记录横向溢出与小于 44px 的可点元素。结果与汇总见本文末「最终验证」。
- **真机待验**：iPhone Safari / PWA 安全区、iPad 分屏 / 横竖切换、软键盘弹出、放大字体、后台恢复、Android Chrome —
  本机没有真机，Chromium 视口模拟不能代替，未宣称通过。
- 固定测试数据：长文章（第三周原创文章）、500 词生词本（`words=500`）、多周待办（`backlog`）、长姓名（`account-longname`）。

## 已知剩余 / 不在本轮

- `pages/LessonTest.tsx`、`LessonVocab.tsx`、`VocabBook.tsx`、`VocabPractice.tsx`、`VocabSelfTest.tsx`：**没有任何路由引用**
  （`App.tsx` 里旧地址一律重定向到新页面），只有旧测试还 import 它们；里面仍有符号图标与英文标签。学生到不了这些页面；
  清理（连同它们的旧测试）作为单独任务。
- O-Level 分页渲染器（`lesson/questions/OLevel*.tsx`）里仍有符号字符；每日英语 App 的内容由 `scripts/pilot/prepare-pilot-week.js` 发布，
  写死 `rendererKey: 'ielts_reading'`（第 949 行），五档当前都走已重做的 IELTS 阅读工作区，这几个渲染器只服务旧题库卷。
- 真机验收（见 IOS-12）。
