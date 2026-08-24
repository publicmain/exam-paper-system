-- 「撤销上一张」+ 弱网重发去重（2026-08-24 学生十问修复 #4/#10）
ALTER TABLE "WordReviewLog" ADD COLUMN "prevState" JSONB;
ALTER TABLE "WordReviewLog" ADD COLUMN "requestId" TEXT;
CREATE UNIQUE INDEX "WordReviewLog_requestId_key" ON "WordReviewLog"("requestId");
