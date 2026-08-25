-- 4.0 每日一课 A0：完成度语义（docs/PRD/morning-quiz-4.0-daily-lesson.md §5.2b）

-- ① 显式提交与系统收尾必须是两种东西 —— 否则「开卷读了标题就走」的学生
--    会被 23:59 的收尾 cron 代交，第二天课程页显示 ✅（幽灵完成）。
ALTER TABLE "StudentSubmission" ADD COLUMN "submitSource" TEXT;
ALTER TABLE "StudentSubmission" ADD COLUMN "autoFinalizeReason" TEXT;

-- 存量数据的口径：已最终提交的历史卷子一律记为 student。
-- 这些是第二作答窗时代的记录，当时 17:30 自动收尾确实存在，但无法从
-- 现有列区分谁是自己交的 —— 与其瞎猜，不如统一标成 student 并靠
-- rulesVersion 说明「这批数据的口径与新数据不同」。
UPDATE "StudentSubmission" SET "submitSource" = 'student' WHERE "finalSubmittedAt" IS NOT NULL;

-- ② 渲染器不再由第一题推断
ALTER TABLE "Paper" ADD COLUMN "rendererKey" TEXT;

-- ③ 每日完成度
CREATE TABLE "DailyLessonCompletion" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "readTarget" INTEGER NOT NULL DEFAULT 1,
    "readProgress" INTEGER NOT NULL DEFAULT 0,
    "readDoneAt" TIMESTAMP(3),
    "readSource" TEXT,
    "vocabTarget" INTEGER NOT NULL DEFAULT 0,
    "vocabProgress" INTEGER NOT NULL DEFAULT 0,
    "vocabDoneAt" TIMESTAMP(3),
    "drillTarget" INTEGER NOT NULL DEFAULT 0,
    "drillProgress" INTEGER NOT NULL DEFAULT 0,
    "drillDoneAt" TIMESTAMP(3),
    "targetsFrozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rulesVersion" INTEGER NOT NULL DEFAULT 1,
    "autoFinalizeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyLessonCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyLessonCompletion_studentId_date_key"
    ON "DailyLessonCompletion"("studentId", "date");
CREATE INDEX "DailyLessonCompletion_date_idx" ON "DailyLessonCompletion"("date");

ALTER TABLE "DailyLessonCompletion"
    ADD CONSTRAINT "DailyLessonCompletion_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
