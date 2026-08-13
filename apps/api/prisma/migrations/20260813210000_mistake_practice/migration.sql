-- 错题重练闭环（2026-08-13 v2）
-- MistakeEntry 加练习状态；PageViewKind 加 mistake_practice。

ALTER TABLE "MistakeEntry" ADD COLUMN "practiceCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MistakeEntry" ADD COLUMN "correctStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MistakeEntry" ADD COLUMN "lastPracticedAt" TIMESTAMP(3);

ALTER TYPE "PageViewKind" ADD VALUE IF NOT EXISTS 'mistake_practice';
