# 整改台账 · 词汇后端（audit/vocab，2026-09-11）

范围：审计提示词 §5.3 VOC01–VOC15，外加 UI01（改档不重算历史）、T01（教师统计排除已取消场次）、UI03 后端（生词本分页）、S08 配合（词汇 GET 真正只读）、首页三项任务状态（UI13/UI14 的后端事实）。

- 分支 / worktree：`audit/vocab` @ `.local/wt/vocab`，基线 `6f85e6d`，本台账对应 HEAD 见文末。
- **全部为本地实现，未 push、未部署、未对任何真实库执行迁移或写入。** 零 Anthropic API 调用；翻译供应商只用 mock。
- 验证方式：每条先写回归（内存假 Prisma，`apps/api/src/vocab-v2/testing/memory-prisma.ts`，近似 Postgres READ COMMITTED + 行锁 + 唯一键等待；并发用交错 Promise 模拟），确认红，再修，确认绿。
- **限制（适用于所有条目）**：事务原子性、行锁排队、`ON CONFLICT` 行为只在假库里近似，未做隔离 Postgres 集成验证（§8.3 第 3 条）；未做真实数据验证；前端未改（契约变化见文末）。

状态口径：已修复待验证 = 代码已改、本地回归与构建通过，尚待隔离库集成 / 前端接入 / 部署后核对。

---

## VOC01 · 学完操作不幂等，并发最后两词可能不结束

- 状态：已修复待验证（上一位工作者提交 `08bf592`，本轮复核仍绿）。
- 原症状：`actOnLearningItem` 用事务外的 `session.items` 算剩余；两个标签页同时点最后两张卡都看见对方未完成 → 会话不结束、正式卷不生成；重试重复加 reps。
- 修复位置：`vocabulary-v2.service.ts` `actOnLearningItem` / `settleLearningSession` / `learningActionResult` / `startFormalTest`（P2002 回读）。卡片 pending→completed/skipped 条件更新；学习量与事件只在真正转换时写；cursor 只前进；事务提交后再数剩余并条件结束会话。
- 新增测试：`voc01-learning-completion.spec.ts`（6）、`testing/memory-prisma.spec.ts`（7，假库自检）。
- 实测：本轮全量绿。
- 剩余依赖：隔离 Postgres 并发集成验证。

## VOC02 · 换词跨词义重复与候选池耗尽

- 状态：已修复待验证（`7d48d87`）。
- 原症状：候选排除只按 senseId（同拼写另一词义、personal 词照样入选）；只看游标后 100 个候选；老师词表那天报 `v2_replacement_source_unavailable`；重试会把刚换上的新词再标会；两张卡同时换撞同一新词 → P2002 500。
- 修复位置：`vocabulary-v2.service.ts` `replaceDailyItem`、`nextReplacementCandidate`；`createTeacherDailySession` 记 `settings.forcedSeen`。
  - 排除 = 学生名下全部归属行的**规范化拼写** + 本会话已有拼写；
  - 候选顺序：会话冻结的官方表 → 档位主表 → 备用表，每表从游标起分批（200）找到表尾；老师词表那天也从档位词表补；只挑库里已有可发布内容的词；
  - 卡片改词为条件更新；可选 `expectedSenseId`（屏幕上那张卡）→ 重试原样返回 `replayed:true`；新词撞唯一键换下一个候选重来；
  - 耗尽：原词原样留着，不写事件，503 `v2_replacement_exhausted` 带 `kept:true`、`options:['learn','later']`；
  - 换词记录写进卡片 `response.replacedFrom`；`known_replaced` 事件带 `studentSenseId`；新词补 `daily_pushed`。
  - 强制布置例外的标记：老师 `force` 且学生见过的词记在会话 `settings.forcedSeen`（与 `skippedSeen` 分开）。
- 新增测试：`voc02-replace.spec.ts`（8）：跨词义、>100 候选、老师词表、成功事实（位置/总数/原词标会/游标）、耗尽不删、重试幂等、同卡与两卡并发、forcedSeen。修前 8/8 红。
- 剩余依赖：前端换词请求带 `expectedSenseId`（见契约）。

## VOC03 · 选项有两个相同正确释义

- 状态：已修复待验证（上一位工作者 `d8c2cf3`，本轮复核仍绿）。
- 修复位置：`formal-test.ts` / `adaptive-test.ts` 的 `glossKey/meaningsOverlap/distinctDistractors`，凑不够退回拼写题；`choiceIsCorrect` 对旧快照双正确都判对。
- 测试：`voc03-distinct-options.spec.ts`（10）。
- 限制：线上当时重复选项数 0，不把模拟案例说成真实错判。

## VOC04 · 正式拼写题通过 audioText 送出答案

- 状态：已修复待验证（`d8c2cf3`，本轮复核仍绿；VOC10 改动后自助练习的进行中题面仍走白名单）。
- 修复位置：`publicFormalQuestion` / `publicAdaptiveQuestion` 白名单；拼写快照不存 `cue.audioText`；听写题只在有 WordAudio 时出，音频走 `GET /vocab-v2/test/audio?sessionId&itemId`（no-store，URL 不含单词）。
- 测试：`voc04-answer-leak.spec.ts`（7）。
- 剩余依赖：前端听写题改为带令牌取 blob 播放。

## VOC05 · 普通学生输入可写入共享 ready 教学上下文

- 状态：已修复待验证（`88e8316`；上一位工作者做到一半，本轮补完：收紧文章授权、我的单词显示个人例句、补测试）。
- 原症状：`collect` 把客户端句子/译文写成全局 `VocabularyContext`（article_original、ready）；每次收词用词典/机翻覆盖共享 sense 释义并改回 ready；`lookup_only` 也建共享词条、写事件。
- 修复位置：`vocabulary-v2.service.ts` `collect` / `existingSenseForCollect` / `draftSenseForCollect` / `verifiedArticleFor`；`collect-context.ts`（`focusedSentence` 3–40 词含目标词的那一句、`parseSourceRef`、`sentenceInPassages`）。
  - `lookup_only` 零写入；已有共享 sense 不改；只在库里没有时按服务端词典/词表建；
  - 学生句子只截那一句，挂在他自己的收词事件（`contextText` + `metadata.personalContextTranslation`）；
  - 写共享例句必须：`assignment:<id>`/`session:<id>` 是他所在班、未取消，**他有答卷或就是他这一档今天及以前那一场**，句子逐字出现在正文；译文由服务端出，`provider=article_verified`；
  - `senseId` 与拼写不符 → 400 `sense_headword_mismatch`（配合 UI02）；
  - 我的单词：无共享例句时显示个人那一句（`personal:true`）。
- 新增测试：`voc05-collect-isolation.spec.ts`（13）：伪译文/整段垃圾、他班 ID、同班别档未打开、有答卷的别档、未来日期、改写句、覆盖共享释义、lookup 零写、个人上下文、senseId 错配。修前全红。
- 剩余依赖：阅读页收词请求要带 `sourceRef`（格式见契约）；历史已被污染的共享例句见 dry-run D5。

## VOC06 · 正式卷 13 题，多个页面仍显示 10

- 状态：已修复待验证（`8b0cc26`）。
- 原症状：首页待测 `total`、教师 `pendingTestWords` 用当天学完的新词数推算，卷子实际是新词 + 最多 3 个旧词。
- 修复位置：`formalTestFact`（生成后读冻结卷 target / newWords / reviewWords；未生成 `total:null` + `expectedNewWords` + `reviewWordsMax:3`），`overview.pendingTests`、`overview.home.test`、`reviewDailySession`、`dailyHistory` 共用；教师 `pendingTestWords` 已生成按冻结 target，新增 `todayTestQuestions`、`pendingTestsNotGenerated`。`REVIEW_SAMPLE_SIZE = 3` 与 `sampleReviewItems` 未改。已开始/已交的卷不重建（`startFormalTest` 读已有）。
- 新增测试：`voc06-home-status.spec.ts` 中旧词 0/1/2/3 个四组（学完提示、试卷、首页、教师一致）、未生成、不重建（共 6）。修前红。
- 剩余依赖：前端改读冻结字段，`total:null` 时显示「预计 N 个新词 + 最多 3 个旧词」。本项覆盖 T03 的后端部分。

## VOC07 · 延后词多天重复生成

- 状态：已修复待验证（`43ac833`）。
- 原症状：延后词捞回时只看 skipped/completed；周一延后 → 周二已安排未做 → 周三再安排；两天任务并发生成各塞一份。
- 修复位置：`unified-vocabulary-rules.ts` `activeDeferredSenseIds` / `DEFERRAL_ENDING_ACTIONS`；`startDailySession`、`createTeacherDailySession`、`lockStudentVocabulary`、`takenSinceSnapshot`。
  - 已挂在某一天待学里的延后词不再安排；最后一次「稍后」之后有明确决定（移出/会了/换掉/重新加入）的不再回来；先后只比同一张事件表的时间；
  - 同一学生的每日任务生成串行化（事务内写他的设置行取行锁），拿锁后按最新提交重看，被另一天刚安排走的新词/延后词剔掉再规划；游标只前进。
- 新增测试：`voc07-deferral.spec.ts`（5）：三天连续、再次延后按新状态迁移、两天并发生成、跨周、移出后不回。修前「周三再安排」「并发各一份」红。
- 剩余依赖：隔离 Postgres 并发验证；历史重复待学见 dry-run D4。

## VOC08 · 全延后被标为学完，教师却等一份不存在的考试

- 状态：已修复待验证（`43ac833`）。
- 修复位置：`sessionView` / `learningCounts`：`learned`、`deferred`、`replaced`、`pending`、`processed`、`testNeeded`、`learningPhase`（旧 `completed` 字段保留，= processed）；教师 `todayTest` 学完 0 个 → `not_needed`，新增 `todayLearned`、`todayDeferred`；首页 `home.test` 同口径（`nothing_learned`）。0 个学完不生成卷、不进待测（原规则，加回归）。
- 新增测试：`voc08-counts.spec.ts`（4）：全延后、部分延后、全换词、部分完成。修前红。
- 剩余依赖：前端不再用 `completed` 说「已学 N 个」，改用 `learned` / `deferred`。

## VOC09 · 来源标签能显示，来源筛选却查不到

- 状态：已修复待验证（`494f64c`；写入侧的 `studentSenseId` 在 `43ac833`/`7d48d87`）。
- 原症状：标签读 `sense.events where studentId`，筛选读 `owned.events`（靠 `studentSenseId`）；`daily_pushed` 没写 `studentSenseId` → 显示「每日」、筛选 0；老师词表的词没有事件，被默认标成 level_gap（编造来源）。
- 修复位置：`vocabularyCenter` 重写：来源 = 该生该词义的全部证据（事件按 studentId+senseId，不依赖 studentSenseId；+ 每日学习会话里那张卡的 source）；`sources`（按先后）+ `source`（最早）；筛选 = 交集，支持逗号组合与 `unknown`；无证据 `source:null`；按文章筛走同一证据。写入侧：每日推送、换词、老师词表推送事件都带 `studentSenseId`，老师词表补 `teacher_list` 事件。
- 新增测试：`voc09-ui03-center.spec.ts` 中 VOC09 4 例（原 daily1/过滤0 样例、单独与组合筛选与标签一致、无证据不编造、新会话事件带归属行）。修前 3/4 红。
- 剩余依赖：历史事件补 `studentSenseId` 只给 dry-run（D1），读路径已不依赖它。

## VOC10 · 自助练习临时状态缺生命周期

- 状态：已修复待验证（`b801078`）。
- 原症状：开始即建 custom_test 会话，退出不清；多次开始留多份；交卷立即删除，刷新 404、响应丢失无法恢复。
- 修复位置：`PRACTICE_TTL`（进行中 6 小时、结果 2 小时，到期时间写在会话 `settingsSnapshot`）；`startCustomTest` 只留一份进行中的（`replacedPrevious`）并清掉该生过期的；`cancelCustomTest`；`submitTest` 不再删，结果保留期内可重读、重复交卷幂等；过期 → 410 `v2_practice_expired`（GET 不删）；`purgeExpiredCustomTests` + cron 每小时（`daily-task.cron.ts` `purgePractice`）。不写成绩/掌握度/教师完成度/历史（原有，加回归）。
- 新增测试：`voc10-practice-lifecycle.spec.ts`（5）。修前 4/5 红（「不进正式记录」原本就对）。
- 剩余依赖：前端退出时调 cancel、结果页刷新改为 `GET test`、处理 410。

## VOC11 · 造句判分把 apple apple apple 当正确

- 状态：已修复待验证（`d8c2cf3`，本轮复核仍绿）。
- 修复位置：`adaptive-test.ts` `checkActiveUse`（完整单词 + 常见/不规则词形 + 至少两个别的词）；结果永远 `sentenceQuality: not_evaluated`，回顾给「检测到目标词，未评估句子质量」。未启用任何付费 AI。
- 测试：`voc11-active-use.spec.ts`（7）。

## VOC12 · 背一背完成后缺稳定回看入口（后端）

- 状态：已修复待验证（`b801078`）。
- 修复位置：`reviewDailySession`（`GET /vocab-v2/daily/review?date=`）：那天冻结的卡，`recite` 只列学完的（有点难在前），`deferredWords`/`pendingWords` 标去向，正式卷有就给指针、没有也不生成；`dailyHistory`（`GET /vocab-v2/daily/history?limit=`）。
- 新增测试：`voc12-review.spec.ts`（3）：次日回看、反复打开零写库不建卷、无任务/未来日期。修前红。
- 剩余依赖：前端 `VocabularyCoachLearn` 已完成会话不再重定向首页，改走 review 接口。

## VOC13 · 「重新学习」实际只恢复成员关系

- 状态：已修复待验证（`43ac833`）。
- 修复位置：`restoreToNotebook` + `POST /vocab-v2/notebook/restore`；旧 `notebook/relearn` 保留为别名，行为相同；事件 `restored`；返回 `action:'restored'`、`startsLearning:false`、`countsAsNewWord:false`。reps / 累计学词 / 历史不动；不会被当成延后词塞回每日任务（VOC07 的决定规则）。
- 新增测试：`voc13-restore.spec.ts`（3）。修前红。
- 剩余依赖：前端按钮改名「重新加入」，改调 `notebook/restore`。

## VOC14 · 内容生成 running 任务没有失效恢复

- 状态：已修复待验证（`ff8e899`）。
- 原症状：worker 只领 queued/failed；中途崩溃的 running 永久卡住（前轮线上见 1 条自 09-02 起）；领取非原子，多实例双跑双付费。
- 修复位置：`content-producer.ts` `CONTENT_JOB_POLICY`（maxAttempts 3 含回收、leaseMs 15 分钟、backoffMs [0, 10 分钟, 60 分钟]）、`claimableContentJobsWhere`、`runVocabularyContentBatch`：条件领取；租约过期回收（`lease_expired_reclaimed`）；次数用完定格 failed（`lease_expired_attempts_exhausted`，不再调用生成）；失败按退避重试；发布事务先用本次领取做栅栏、再以 `contentVersion < requestedVersion` 更新词义（同一版本只发布一次，被接手的慢 worker 整事务回滚）；拒绝/失败写入也带栅栏；enqueue 不让已有未发布任务的词义占名额；批次结果在发生时附 `reclaimed/exhausted/superseded/skipped`，cron 记日志/告警。生成函数可注入（测试零网络）。
- 新增测试：`voc14-content-lease.spec.ts`（7）：崩溃回收、租约内不动与次数用完、超时失败+退避+上限、两 worker 竞争、慢 worker 被栅栏挡、损坏内容不标 ready、同版本不覆盖。修前 7/7 红（旧实现无法注入生成，红检时 fetch 全部 stub 为失败）。原 `content-producer.spec.ts` 6 例未改、仍绿。
- 剩余依赖：生产那条卡住的任务先只读核对（D2）；部署后 worker 会自动回收。

## VOC15 · Azure 失败时的降级与说明不一致

- 状态：已修复待验证（`88e8316`；上一位工作者做到一半，本轮补收词侧测试并提交）。
- 修复位置：`vocab/realtime-translation.service.ts` `translateDetailed`（ok/cached/rate_limited/cooling_down/provider_error/timeout/no_chinese/network_error + retryable/retryAfterSec）；配了 Azure 只用 Azure，不静默换供应商；429 按 Retry-After 冷却（≤60 秒）；失败不缓存；无汉字不当翻译；`translate()` 兼容旧调用。收词：无可靠中文 → 503 `translation_unavailable` 带 `reason/retryable/retryAfterSec/message`；只缺例句译文 → 词照常加入，例句 `translation:null` + `translationStatus`，共享例句 `needs_translation`。
- 新增测试：`vocab/realtime-translation.degradation.spec.ts`（6）、`voc15-collect-translation.spec.ts`（4）。修前全红。
- 剩余依赖：阅读页查词（`vocab/vocab.service.ts` `lookup`，不在本边界）仍用 `translate()` 拿 null，建议改用 `translateDetailed` 给同样的诚实状态。

---

## UI01 · 改当前难度重算历史欠阅读（含 T06）

- 状态：已修复待验证（`8b0cc26`）。
- 原症状：学生 `readingBacklog` 与教师 `teacherClassProgress` 都拿**现在的** `englishLevel` 匹配过去场次：A 档欠账一改 B 就消失、冒出当时没分配的 B 档欠账。
- 修复位置：
  - 新表 `StudentLevelChange`（只增不改）；`student-auth.service.ts` `setEnglishLevel` 真的换档时追加 `student_self` 记录（先改档后记录，记录失败不挡改档）；
  - 兜底：`observeStudentLevels` + cron 每 10 分钟（`daily-task.cron.ts` `observeLevels`，周末也跑）：无记录写 `baseline`，记录与现档不一致写 `observed`（覆盖教师花名册改档、首次落定）；
  - `level-timeline.ts`：有答卷 = 事实（那天那班只认有答卷的）；没答卷按**那天结束时**的档位；今天按现档；入班前不算；学生首页与教师统计共用 `assignedReadingFor`；每行带 `level` / `levelBasis`。
  - 老师词表会话也记下开始时的 `level`。
- 守卫测试的改动（需要注意）：`lesson/level-switch.spec.ts` S12O「唯一的写是 user.update」改为精确清单 `['.update(', '.create(']` + 断言新增的写只能是 `this.prisma.studentLevelChange.create(` 且无 update/upsert/delete；其余（不碰历史表、不删、不动令牌、user.update 只写 englishLevel）原样保留。`student-auth/self-register.spec.ts` 假库加 `studentLevelChange` 存储，新增 2 例（换档记录、被拒不记录），原 51 例未改。
- 新增测试：`ui01-t01-history.spec.ts`（UI01 4 例：未做/做一半/已完成改档后事实不变且教师=学生；改档当天未开始的那份次日按新档、此前按旧档；入班前不算且无记录时标 `current`；别档有答卷认答卷）、`ui01-level-observe.spec.ts`（4）、`level-timeline.spec.ts`（7）。修前红。
- **历史限制（必须写明）**：记录从本次上线起才有。上线前从没改过档的学生不受影响；上线前改过档、又有上线前没开始的日子的，那些日子只能按「上线时的档位」算（与旧口径相同，`levelBasis=before_first_record`/`current`）——**不猜当时档位，不往库里补造记录**。可审查的只读清单见 D3。
- 剩余依赖：教师花名册改档（`users/users.service.ts` `setEnglishLevel`，不在本边界）应在同一事务写 `StudentLevelChange{source:'teacher'}`；接入前靠 cron 兜底（时间 = 发现时刻，≤10 分钟误差）。阅读侧 `lesson/lesson.service.ts` 今日课程仍按现档 `pickTodaySession`（今天的口径一致，未改）。

## T01 · 已取消阅读仍计入教师欠交

- 状态：已修复待验证（`8b0cc26`）。
- 修复位置：`assignedReadingFor`：取消场次没最终交过的不算任务；取消前已交的留档算完成、不算欠（教师 `cancelledArchived`）；教师 `overdue` 改为「今天以前还欠着的份数」，与学生 `readingBacklog` 同口径，新增 `overdueDates`；practice 答卷两端都排除。
- 新增测试：`ui01-t01-history.spec.ts` T01 1 例（取消未做、取消前已交、两端欠账数相同）。修前红（原 assigned 4、overdue 含取消）。
- 剩余依赖：`analytics/`（T02，旧班级统计）不在本边界。

## UI03（后端）· 生词本只有前 30 项

- 状态：已修复待验证（`494f64c`）。
- 修复位置：`vocabularyCenter`：排序键固定 (firstSeenAt desc, id desc)；页码返回 `pageCount/hasMore`，越界钳到最后一个非空页（`requestedPage` + `clamped`）；加载更多用 `cursor`/`nextCursor`（keyset），中途移出不跳不重；`total` 为筛选后总数；筛选选项按当前阶段算。
- 新增测试：`voc09-ui03-center.spec.ts` UI03 6 例：31/65/500 词、并列排序页码与游标一致、移出末页唯一项不困空页、游标中途移出不跳不重、筛选总数与选项。修前红。
- 剩余依赖：前端「加载更多」用 `nextCursor`（页码翻页在中途移出时会错位一格，这是页码分页的固有性质）。

## S08 配合 · 词汇 GET 隐式写库

- 状态：已修复待验证（`620a59b`，后续新增 GET 一并纳入）。
- 原症状：`GET /vocab-v2/profile`、`GET /vocab-v2/overview` 都会 upsert `StudentVocabularyProfile`。
- 修复位置：`profile()` 改为只读（没存过按 schema 默认值返回，`persisted:false`）；建行只在 `POST /vocab-v2/profile`（以及生成每日任务时取学生锁）。守卫/装饰器未改。
- 新增测试：`s08-readonly-gets.spec.ts`（2）：在已有学词/正式卷/自助练习/阅读状态下调用每个 GET 背后的服务方法，写日志必须为空；教师 GET 同样。
- 剩余依赖：S08 所有者分离「读取身份」与「本人写入」并放开下表的 GET。

## 首页三项任务状态（UI13 / UI14 的后端事实）

- 状态：已实现待前端接入（`8b0cc26`）。
- 修复位置：`overview.home.{reading,words,test}` + `allDone`，`backlogByDate` / `backlogTotals`（见契约）。阅读事实在 vocab 服务里按 `assignedReadingFor` 只读计算，**未改 `lesson.service.ts`**。
- 新增测试：`voc06-home-status.spec.ts` 首页 6 例：周末全不适用、开门时未生成（阅读原因 / 词的生成条件 / 测试学完后生成）、阅读待批+学词完成+测试待完成≠全完成、全延后测试不适用、测试进行中→完成、按日期旧待办。
- 建议接口（阅读侧，不在本边界）：`lesson.service.ts` 的今日/欠账也改用 `level-timeline.ts` 的 `assignedReadingFor`，或由 overview 作为首页唯一事实源，前端不再同时拼 `lessonStart` 与 overview。

---

## 测试 / 类型 / 构建（本台账 HEAD `3861d99`）

| 命令（worktree 内） | 退出码 | 结果 |
| --- | --- | --- |
| `cd apps/api && npx vitest run` | 0 | 155 个文件 / 3157 个用例全部通过（15.9s） |
| `npm run typecheck -w @app/api`（worktree 根） | 0 | 无错误 |
| `npm run build -w @app/api`（worktree 根） | 0 | nest build 通过 |
| `npx prisma generate --schema apps/api/prisma/schema.prisma` | 0 | 生成到共享 node_modules（只增一个模型） |

本轮新增 / 改动的词汇回归文件（203 例，含 student-auth / level-switch 相关）：voc01 6、voc02 8、voc03 10、voc04 7、voc05 13、voc06 12、voc07 5、voc08 4、voc09+UI03 10、voc10 5、voc11 7、voc12 3、voc13 3、voc14 7、voc15 4、translation degradation 6、s08 2、ui01-t01 5、ui01-observe 4、level-timeline 7、memory-prisma 7；`self-register.spec.ts` 53（+2）、`level-switch.spec.ts` 15（1 例改为精确新清单）。新增的内存假库用例文件放宽单测超时到 30s（`vi.setConfig`），不改断言。

## 提交列表（6f85e6d..HEAD）

```
08bf592 VOC01 学完操作幂等（上一位）
d8c2cf3 VOC03/VOC04/VOC11（上一位）
88e8316 VOC05 收词不写共享教材、VOC15 翻译失败如实反馈
620a59b S08 词汇 GET 真正只读
7d48d87 VOC02 换词按拼写全局去重、候选池可继续补足、耗尽不虚报
43ac833 VOC07 延后词唯一待学、VOC08 计数不混、VOC13 重新加入语义
494f64c VOC09 来源标签与筛选同一关系、UI03 生词本分页契约
8b0cc26 UI01 / T01 / VOC06 / 首页三项任务状态（含 schema + 迁移）
b801078 VOC10 自助练习生命周期、VOC12 按日期只读回看
ff8e899 VOC14 内容生成任务租约 / 回收 / 退避 / 幂等发布
3861d99 内存假库重用例放宽超时
```

---

## API 契约变化（前端要跟着改）

以下均为**加字段 / 新接口**为主；真正的破坏性变化用 ⚠ 标出。

### 1. `GET /vocab-v2/overview`

```jsonc
{
  "dailyTarget": 10,
  "today": { /* 每日学习会话视图，见 §2 */ },
  "readingBacklog": [
    { "assignmentId": "…", "sessionId": "…", "submissionId": null, "date": "2026-09-08", "title": "…",
      "status": "not_started" /* | in_progress */,
      "level": "olevel",                       // 新：按那天事实推出的档位
      "levelBasis": "submission" /* | level_log | before_first_record | current */ }
  ],
  "learningBacklog": [
    { "sessionId": "…", "date": "2026-09-08", "completed": 3 /* = processed */, "learned": 2, "deferred": 1, "pending": 7, "target": 10, "status": "in_progress" }
  ],
  "pendingTests": [
    { "dailySessionId": "…", "date": "2026-09-10", "testSessionId": "…", "generated": true, "status": "in_progress",
      "total": 13, "newWords": 10, "reviewWords": 3, "answered": 0 },
    // ⚠ 未生成时 total/newWords/reviewWords 为 null：
    { "dailySessionId": "…", "date": "2026-09-09", "testSessionId": null, "generated": false, "status": "not_started",
      "total": null, "newWords": null, "reviewWords": null, "answered": 0, "expectedNewWords": 8, "reviewWordsMax": 3 }
  ],
  "home": {
    "date": "2026-09-11", "teachingDay": true,
    "reading": { "state": "pending", "assignmentId": "…", "sessionId": "…", "submissionId": null, "title": "…", "level": "olevel" },
    //  state: pending | in_progress | completed | awaiting_marking | auto_closed
    //       | not_applicable(reason: weekend | no_class | no_level | cancelled)
    //       | not_generated(reason: no_session_published)
    "words": { "state": "in_progress", "sessionId": "…", "target": 10, "learned": 3, "deferred": 1, "replaced": 0, "pending": 6 },
    //  state: pending | in_progress | completed | not_applicable(reason: weekend)
    //       | not_generated(generation: { condition, trigger })
    "test": { "state": "pending", "dailySessionId": "…", "testSessionId": "…", "total": 13, "newWords": 10, "reviewWords": 3, "answered": 0 },
    //  state: pending | in_progress | completed
    //       | not_generated(reason: no_word_task_yet | learning_unfinished | ready_to_generate[, expectedNewWords, reviewWordsMax])
    //       | not_applicable(reason: weekend | nothing_learned)
    "allDone": false           // 三项都 completed / awaiting_marking / not_applicable 才为 true
  },
  "backlogByDate": [ { "date": "2026-09-08", "reading": 1, "words": 1, "test": 0 } ],   // 今天以前
  "backlogTotals": { "reading": 1, "words": 1, "test": 0 }
}
```

### 2. 每日学习会话视图（`GET daily`、`POST daily/start`、`POST daily/item`、`POST daily/replace`、`overview.today`）

- 新增：`learned`（已有）、`deferred`、`replaced`、`pending`、`processed`、`testNeeded`、`learningPhase`（not_started | in_progress | finished）；`items[].senseId`。
- ⚠ 语义说明：`completed` 保持旧含义 = processed（学完 + 稍后再学），**不能**再用它显示「已学 N 个」。
- `settings.forcedSeen`（老师强制重学的见过词）、老师词表会话 `settings.level`、档位会话 `settings.deferredReturned`。

### 3. `POST /vocab-v2/daily/replace`

- 请求新增可选 `expectedSenseId`（传屏幕上那张卡的 `items[].senseId`）。
- 响应新增 `replayed: boolean`（true = 这张卡已经换过，原样返回）。
- 错误：503 `v2_replacement_exhausted` → `{ code, kept: true, options: ['learn','later'], message }`；409 `v2_item_changed`；409 `v2_replacement_busy`。⚠ 不再返回 `v2_replacement_source_unavailable`。

### 4. 生词本 `GET /vocab-v2/center`

- 查询新增 `cursor`；`source` 支持逗号组合（`level_gap,reading_lookup`）与 `unknown`。
- 响应新增 `pageCount`、`requestedPage`、`clamped`、`hasMore`、`nextCursor`；`items[].sources: string[]`。
- ⚠ `items[].source` 可能为 `null`（没有来源证据，不再默认 level_gap）；⚠ 排序改为 firstSeenAt 倒序（原 updatedAt）。
- `items[].context`：共享例句带 `personal:false`；个人例句 `{ sentence, translation, personal: true }`。
- 错误：400 `v2_bad_cursor`。

```jsonc
{ "total": 65, "page": 1, "pageSize": 30, "pageCount": 3, "requestedPage": 1, "clamped": false,
  "hasMore": true, "nextCursor": "MTc…", "items": [ { "source": "level_gap", "sources": ["level_gap","reading_lookup"], … } ] }
```

### 5. 我的单词成员关系

- 新增 `POST /vocab-v2/notebook/restore { senseId }` →
  `{ ok, action: 'restored', senseId, headword, inNotebook: true, removedAt: null, startsLearning: false, countsAsNewWord: false, alreadyInNotebook }`。
- `POST notebook/relearn` 保留为别名（同响应）；`POST notebook/remove` 响应新增 `action: 'removed'`。前端按钮改名「重新加入」。

### 6. 自助练习

- `POST /vocab-v2/custom-test/start` 响应新增 `practiceOnly: true`、`replacedPrevious`、`expiresAt`。
- 新增 `POST /vocab-v2/custom-test/cancel { sessionId }` → `{ ok: true, cancelled: boolean }`。
- `POST test/submit`（自助）→ `{ …, practiceOnly: true, retry: null, resultExpiresAt }`；⚠ 会话不再立即删除，2 小时内 `GET /vocab-v2/test?sessionId` 可重读。
- 过期：410 `v2_practice_expired`（读、答、交都会给）。

### 7. 按日期回看（新）

- `GET /vocab-v2/daily/review?date=YYYY-MM-DD` →
  `{ readOnly: true, date, sessionId, status, mode, learningPhase, target, learned, deferred, replaced, pending, recite: [{ id, position, action, card }], deferredWords: string[], pendingWords: string[], test: { testSessionId, generated, status, total, newWords, reviewWords, answered, expectedNewWords?, reviewWordsMax? } } | null`
- `GET /vocab-v2/daily/history?limit=30` → `{ days: [{ date, sessionId, status, target, learned, deferred, pending, replaced, processed, test: { … } }] }`

### 8. 收词 `POST /vocab-v2/collect`

- 请求新增可选 `senseId`（显示中的那条词义）；`sourceRef` 只有 `assignment:<paperAssignmentId>` / `session:<morningQuizSessionId>` 能让文章原句进共享例句。
- 响应新增 `context: { sentence, scope: 'personal' | 'shared_verified', translation, translationStatus?, retryable? } | null`；`lookup_only` 的 `sense.id` 可能为 null（库里没有这个词时不再建）。
- 错误：503 `translation_unavailable` → `{ code, reason, retryable, retryAfterSec?, message }`；400 `sense_headword_mismatch`。

### 9. 其他

- `GET /vocab-v2/profile`：新增 `persisted: boolean`；没存过时没有 `createdAt/updatedAt`。
- `GET /vocab-v2/test/audio?sessionId&itemId`（`d8c2cf3`）：听写题音频。
- 教师 `GET /vocab-v2/teacher/class/:classId/progress`：
  - `reading`：新增 `overdueDates`、`cancelledArchived`；⚠ `overdue` 改为今天以前还欠着的份数（原来含今天），与学生首页同口径；
  - `vocabulary`：新增 `pendingTestsNotGenerated`、`todayTestQuestions`、`todayLearned`、`todayDeferred`；`todayTest` 新值 `not_needed`；`pendingTestWords` 已生成的按冻结卷 target。

---

## schema 变化与迁移

- `apps/api/prisma/schema.prisma`：新增 `model StudentLevelChange { id, studentId → User (Cascade), fromLevel EnglishLevel?, toLevel EnglishLevel, source String @default("student_self"), changedAt DateTime @default(now()), @@index([studentId, changedAt]) }`；`User` 加反向关系 `levelChanges`（不产生列）。
- 迁移：`apps/api/prisma/migrations/20260911120000_student_level_change/migration.sql` —— 仅 `CREATE TABLE` + `CREATE INDEX` + `ADD FOREIGN KEY`，**不动任何已有表/列**；SQL 由 `prisma migrate diff`（schema 对 schema，离线）生成。
- 已在 worktree 根跑 `npx prisma generate --schema apps/api/prisma/schema.prisma`（共享客户端只多一个模型）。
- **未对任何真实库执行 migrate。** 部署时 `railway.json` / Dockerfile 的启动命令会跑 `prisma migrate deploy` → 这是一次生产迁移，需要当前会话明确授权；代码依赖这张表（overview / 教师进度读它），**代码和迁移必须一起上**。
- 回滚：表只增不改，回滚代码时可保留表；若需删除：`DROP TABLE "StudentLevelChange";`（仅在确认不再需要改档记录后）。

## 已零写库、可放开教师只读的 GET

均由 `s08-readonly-gets.spec.ts` 在已有状态下验证写日志为空（守卫/装饰器未改，放开由 S08 所有者做）：

| GET | 服务方法 |
| --- | --- |
| `/vocab-v2/source-meta` | `sourceMeta`（不查库） |
| `/vocab-v2/profile` | `profile` |
| `/vocab-v2/search` | `search` |
| `/vocab-v2/center` | `vocabularyCenter` |
| `/vocab-v2/daily` | `dailySession` |
| `/vocab-v2/daily/review`（新） | `reviewDailySession` |
| `/vocab-v2/daily/history`（新） | `dailyHistory` |
| `/vocab-v2/overview` | `overview` |
| `/vocab-v2/tests` | `listFormalTests` |
| `/vocab-v2/test` | `testSession`（自助练习过期只报 410，不删） |
| `/vocab-v2/test/audio` | `testItemAudio` |
| `/vocab-v2/teacher/class/:id/assignments`、`/progress` | `teacherAssignments`、`teacherClassProgress`（教师接口本就只读） |

所有 POST 仍是写入：`profile`、`collect`、`notebook/remove|restore|relearn`、`daily/start|item|replace`、`test/start|answer|submit`、`custom-test/start|cancel`。

## 需要真实数据修复的 dry-run 方案（均未执行，执行前需授权 + 备份）

先只读、聚合；每条先跑 `SELECT` 看范围，再决定。

**D1（VOC09）事件缺 `studentSenseId`** —— 读路径已不依赖它，修不修都不影响显示/筛选；为统计一致可补：
```sql
-- 范围
SELECT count(*) FROM "VocabularyCollectionEvent" e
JOIN "StudentVocabularySense" s ON s."studentId" = e."studentId" AND s."senseId" = e."senseId"
WHERE e."studentSenseId" IS NULL;
-- 修复（授权后，事务内，先备份该表）
-- UPDATE "VocabularyCollectionEvent" e SET "studentSenseId" = s.id
-- FROM "StudentVocabularySense" s
-- WHERE e."studentSenseId" IS NULL AND s."studentId" = e."studentId" AND s."senseId" = e."senseId";
```
不给老师词表历史词伪造事件：读路径已用会话卡片的 `source='teacher_list'` 作证据。

**D2（VOC14）卡住的 running 任务**：
```sql
SELECT id, "senseId", attempts, "startedAt", "errorCode" FROM "VocabularyContentJob"
WHERE status = 'running' AND "startedAt" < now() - interval '15 minutes' ORDER BY "startedAt";
```
部署后 worker 会自动回收（attempts+1；已满 3 次的直接定格 failed，不再付费）。若不想再花一次调用，可在部署前手工：`UPDATE … SET status='failed', "errorCode"='manual_lease_expired', "completedAt"=now() WHERE id IN (…)`（授权后）。

**D3（UI01）上线前的档位历史** —— 不补造记录。给老师人工核对的只读清单（上线前、学生没打开过、而且他的 V2 每日词任务快照档位与现档不同的日子）：
```sql
SELECT s."studentId", s.date, s."settingsSnapshot"->>'level' AS snapshot_level, u."englishLevel" AS current_level
FROM "VocabularyV2Session" s JOIN "User" u ON u.id = s."studentId"
WHERE s."sessionType" = 'daily_learning'
  AND s."settingsSnapshot" ? 'level'
  AND s."settingsSnapshot"->>'level' <> u."englishLevel"::text
ORDER BY s."studentId", s.date;
```
注意：旧的档位会话在学生档位为空时写的是默认 `olevel`，这份清单只供人工判断，不能直接当事实导入。

**D4（VOC07）同一延后词挂在多天待学里**：
```sql
SELECT sess."studentId", i."senseId", count(*) AS pending_days, array_agg(sess.date ORDER BY sess.date)
FROM "VocabularyV2SessionItem" i JOIN "VocabularyV2Session" sess ON sess.id = i."sessionId"
WHERE sess."sessionType" = 'daily_learning' AND i.status = 'pending'
GROUP BY sess."studentId", i."senseId" HAVING count(*) > 1;
```
不自动改：删卡会改动已冻结会话的 target / 位置。若确有，建议逐个与老师确认后保留最早一天、较晚那天的卡由学生自行「稍后再学」处理。

**D5（VOC05）历史上由学生输入写入的共享例句**：
```sql
SELECT c.id, c."senseId", c.sentence, c."sourceRef", c."createdAt"
FROM "VocabularyContext" c
WHERE c.kind = 'article_original' AND coalesce(c.provider, '') <> 'article_verified'
ORDER BY c."createdAt";
```
人工抽查后，对确认不是文章原句的，建议 `UPDATE … SET "qualityStatus" = 'needs_review'`（不删除，保留审计）。被收词覆盖过的共享 sense 释义没有历史版本，无法自动恢复，只能按词表/词典人工复核。

**D6（VOC10）旧的孤儿自助练习会话**：
```sql
SELECT count(*), min("startedAt") FROM "VocabularyV2Session" WHERE "sessionType" = 'custom_test';
```
部署后清理 cron 按 `startedAt + 6h` / `completedAt + 2h` 自动删除，无需手工。

## 仍需外部配合 / 未完成

1. 前端（student-web / web）按上面的契约改：换词带 `expectedSenseId`、生词本用 `nextCursor`、按钮「重新加入」、自助练习退出调 cancel 与 410 处理、待测 `total:null` 的展示、首页用 `home` 三项状态、`VocabularyCoachLearn` 已完成会话走 `daily/review`。
2. `users/users.service.ts` 教师改档写 `StudentLevelChange{source:'teacher'}`（接入前靠 cron 兜底）。
3. 阅读页查词 `vocab/vocab.service.ts` 改用 `translateDetailed`（VOC15 同口径）。
4. S08 所有者放开上表 GET 的教师只读视角。
5. 隔离 Postgres 集成验证：VOC01/02/07 的并发与行锁、VOC14 的条件更新（`update` 带非唯一字段过滤依赖 Prisma 5 extendedWhereUnique）、迁移 dry-run。
6. 生产迁移、部署、D1–D6 的任何写操作都需要当前会话明确授权。
