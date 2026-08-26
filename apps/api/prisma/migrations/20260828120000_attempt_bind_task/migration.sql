-- P6 收尾：把正式测试绑定到**具体任务**，而不是只绑「学生 + 今天」。
--
-- 为什么要改：
--   · (studentId, date) 是「学生 + 日历日」。日历日与任务今天恰好一一对应
--     （DailyLessonCompletion 自己也是 (studentId, date) 唯一），但那是巧合
--     不是契约 —— 一旦以后一天出现第二个任务，两份测试就会互相占用同一把锁。
--   · 更现实的风险是 SGT 午夜前后的口径漂移：attempt 服务和 lesson 服务各算
--     一次「今天」，任何一处算法微调都会让测试挂到另一天的任务上。
--   · 完成条件也一样：原来数的是「这个学生今天有没有交过某一份测试」，
--     绑定到 DLC 之后数的是「这次任务自己的那一份」。
--
-- 主约束放在 dailyLessonCompletionId 上（partial unique —— Prisma 表达不了
-- WHERE 子句，所以写在这里）。DLC 行的 id 唯一属于一个学生的某一天，它就是
-- 「这次任务」本身。
--
-- 历史兼容：**不删任何成绩**。
--   · 已有的 attempt 行按 (studentId, date) 回填 DLC id
--   · 回填不上的（当天没有 DLC 行）保持 NULL，仍受 (studentId, date) 唯一
--     约束保护，可以正常读取和展示；partial index 的 WHERE 子句放过 NULL
--   · 新建的 attempt 一律带 DLC（服务端没有任务时直接 409 no_task）
--
-- 回滚：
--   DROP INDEX "VocabQuizAttempt_dlc_key";
--   （dailyLessonCompletionId 列可以留着，没有约束时它只是个可空外键）

-- 回填：把已有成绩挂到它那一天的任务上
UPDATE "VocabQuizAttempt" a
   SET "dailyLessonCompletionId" = d.id
  FROM "DailyLessonCompletion" d
 WHERE a."dailyLessonCompletionId" IS NULL
   AND d."studentId" = a."studentId"
   AND d."date" = a."date";

-- 一个任务只能有一份正式测试
CREATE UNIQUE INDEX "VocabQuizAttempt_dlc_key"
    ON "VocabQuizAttempt"("dailyLessonCompletionId")
 WHERE "dailyLessonCompletionId" IS NOT NULL;
