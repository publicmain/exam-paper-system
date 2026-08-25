-- 学生长期 token 的撤销机制（2026-08-25 复审 P0-2）
-- 无状态 JWT 无法主动作废；用版本号做逐次比对，重置/改 PIN/停用时递增。
ALTER TABLE "User" ADD COLUMN "studentAuthVersion" INTEGER NOT NULL DEFAULT 0;
