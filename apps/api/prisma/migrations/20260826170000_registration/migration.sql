-- 网站式注册（2026-08-26，docs/PRD/student-registration.md）
-- 密码复用 pinHash 等既有列；只新增展示字段。
ALTER TABLE "User" ADD COLUMN "nickname" TEXT;
ALTER TABLE "User" ADD COLUMN "avatar" TEXT;
