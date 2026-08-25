-- 集体注册窗口（2026-08-25）。PIN 认领从「永远开着」改成「教师开窗才能领」。
--
-- 默认全部为 NULL = 窗口关闭。这意味着**上线后没有教师开窗，谁都设不了
-- PIN** —— 这是刻意的：生产 407 名在册学生此刻只有 1 个测试账号设了 PIN，
-- 真实分发尚未开始，正好在窗口打开之前把门装上。
ALTER TABLE "Class" ADD COLUMN "pinClaimOpenUntil" TIMESTAMP(3);
ALTER TABLE "Class" ADD COLUMN "pinClaimOpenedBy" TEXT;

-- 个别补注册窗口（请假 / 换设备 / 被抢注后重来）。
ALTER TABLE "User" ADD COLUMN "pinClaimOpenUntil" TIMESTAMP(3);
