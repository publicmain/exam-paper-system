-- P3 任务阶段实体化与退出恢复（docs/refactor-plan.md P3）
--
-- 纯 ADD COLUMN 带默认值：不改不删任何现有列或行。存量行默认
-- stage='reading'，首次被 today() 读到时由 deriveStage 按三段事实重算并
-- 写回（昨天已完成三段的旧记录会被正确修正为 done，不会倒退）。
--
-- 回滚：代码回退即可（三列留着无人读、无害）；彻底回滚 =
--   ALTER TABLE "DailyLessonCompletion" DROP COLUMN "stage", DROP COLUMN "stageAt", DROP COLUMN "vocabCursor";
-- 这三列不含任何原有数据。
ALTER TABLE "DailyLessonCompletion" ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'reading';
ALTER TABLE "DailyLessonCompletion" ADD COLUMN "stageAt" TIMESTAMP(3);
ALTER TABLE "DailyLessonCompletion" ADD COLUMN "vocabCursor" INTEGER NOT NULL DEFAULT 0;
