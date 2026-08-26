-- P6：正式单词测试的成绩实体。
--
-- 纯新增一张表，零存量影响 —— 不动 StudentSubmission（阅读成绩）、
-- 不动 StudentWord / WordReviewLog（复习调度与熟练度）。
--
-- 唯一约束 (studentId, date) 是「同一任务只能有一份有效正式测试」的
-- 执行者：创建走 upsert，双击 / 网络重试撞上它就是幂等 no-op，不可能
-- 产生两份成绩。
--
-- items 是逐题快照（题干/选项/正确答案/学生作答），**创建时冻结**。
-- 之后改词库、改释义、改例句，历史成绩一个数字都不会变。
--
-- 回滚：DROP TABLE "VocabQuizAttempt";
-- 该表不含任何原有数据，删除不影响阅读成绩 / 复习流水 / FSRS 调度。
CREATE TABLE "VocabQuizAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dailyLessonCompletionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "total" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VocabQuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VocabQuizAttempt_studentId_date_key" ON "VocabQuizAttempt"("studentId", "date");
CREATE INDEX "VocabQuizAttempt_studentId_submittedAt_idx" ON "VocabQuizAttempt"("studentId", "submittedAt");

ALTER TABLE "VocabQuizAttempt" ADD CONSTRAINT "VocabQuizAttempt_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabQuizAttempt" ADD CONSTRAINT "VocabQuizAttempt_dailyLessonCompletionId_fkey"
  FOREIGN KEY ("dailyLessonCompletionId") REFERENCES "DailyLessonCompletion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
