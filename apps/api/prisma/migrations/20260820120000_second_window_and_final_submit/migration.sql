-- 第二作答窗（学校 2026-08-20 新政）
--
-- 16:00–17:30 从「补考窗」改成「第二个作答时间窗」：不再只服务早上
-- 缺席的学生，早上来了但没答完的一样能进，学生可任意选择在哪个窗
-- 作答，且可以修改早上写下的答案。
--
-- 这里的关键冲突：8/14 定的「交卷即公布答案」与「下午还能改答案」
-- 叠在一起就是开卷考 —— 早上交卷看到答案，下午照抄改满分。
--
-- 解法是把「交卷」拆成两个动作，用 finalSubmittedAt 区分：
--   · 暂存提交（finalSubmittedAt = NULL）
--       9:00 自动收卷走这条。保留下午回来改的权利，**看不到答案**。
--   · 最终提交（finalSubmittedAt 有值）
--       学生主动点「交卷并查看答案」，或 17:30 自动收尾。立刻公布
--       答案，同时放弃继续修改的权利。
--
-- 于是答案与分数变成两道独立的门：
--   答案可见 ⟸ finalSubmittedAt IS NOT NULL
--   分数可见 ⟸ status ∈ (marked, graded, returned, practice)   ← 不变
ALTER TABLE "StudentSubmission" ADD COLUMN "finalSubmittedAt" TIMESTAMP(3);

-- 回填：本迁移之前的历史答卷全部视为「最终提交」。它们的答案早就
-- 公布过了，不回填的话学生打开历史成绩会突然看不到答案。
UPDATE "StudentSubmission"
   SET "finalSubmittedAt" = COALESCE("submittedAt", "startedAt")
 WHERE "status" <> 'in_progress';

-- 第二窗内要把暂存提交的答卷退回 in_progress 让学生续答，按 (状态,
-- 最终提交时间) 找人，加个索引。
CREATE INDEX "StudentSubmission_status_finalSubmittedAt_idx"
  ON "StudentSubmission"("status", "finalSubmittedAt");
