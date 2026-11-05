-- 2026-11-05 完整化第 2 期：错题收录时的冻结快照。只加可空列。
ALTER TABLE "MistakeEntry" ADD COLUMN "redoSnapshot" JSONB;
