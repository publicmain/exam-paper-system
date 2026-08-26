-- P1 答卷唯一性防线（docs/refactor-plan.md，审计 §二.3）
--
-- R14 为练习模式共存拆掉了 @@unique([assignmentId, studentId])，唯一性
-- 从此只靠三处 findFirst+create 的 service 约定维持 —— 双设备同时扫码
-- 可各自 findFirst 落空、双双 create，产生同学生同卷两条真实答卷，
-- 而判分队列 / 完成度 / 历史页全部假定单条。
--
-- 防线 = partial unique（practice 行不在索引内，练习模式不受影响）。
-- Prisma schema 无法表达 partial unique，只能 raw SQL —— schema.prisma
-- 里有对应注释指回本文件。
--
-- 回滚：DROP INDEX "StudentSubmission_real_unique";（代码侧的撞墙重查
-- 分支无害可留）

-- ① 对账降级存量重复（2026-08-26 生产实测为 0 组，此段为防御性保留：
--    迁移可能晚于新的并发事故执行）。保留规则：finalSubmittedAt 非空者
--    优先，其次 submittedAt 最新，再次 startedAt 最新；其余降级为
--    practice（**不删除任何数据**）并写 AuditLog。
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "assignmentId", "studentId"
           ORDER BY ("finalSubmittedAt" IS NOT NULL) DESC,
                    "submittedAt" DESC NULLS LAST,
                    "startedAt" DESC
         ) AS rn
  FROM "StudentSubmission"
  WHERE status <> 'practice'
),
demoted AS (
  UPDATE "StudentSubmission" s
     SET status = 'practice'
    FROM ranked r
   WHERE s.id = r.id AND r.rn > 1
  RETURNING s.id
)
INSERT INTO "AuditLog"
  (id, "actorId", "actorRole", action, "entityType", "entityId", metadata, "createdAt")
SELECT 'dedup' || substr(md5(random()::text || id), 1, 20),
       'system', 'system', 'submission.dedup_demote', 'StudentSubmission', id,
       jsonb_build_object('reason', 'P1 partial-unique backfill: duplicate real submission demoted to practice'),
       now()
  FROM demoted;

-- ② 防线本体
CREATE UNIQUE INDEX "StudentSubmission_real_unique"
  ON "StudentSubmission"("assignmentId", "studentId")
  WHERE status <> 'practice';
