-- 学生 PIN 登录（2026-08-25，docs/PRD/student-auth-and-home.md）
-- 纯增量：4 个 nullable/默认值列，不碰既有行
ALTER TABLE "User" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "User" ADD COLUMN "pinSetAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "pinFailedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "pinLockedUntil" TIMESTAMP(3);
