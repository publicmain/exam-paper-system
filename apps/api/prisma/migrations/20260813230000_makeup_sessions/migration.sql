-- 补考窗口（学校 2026-08 新政：早上无故缺席 → 中午补考）
--
-- 2026-08-13 首次执行补考时用的是 debug-activate，它原地改写了正式
-- 场次的时间窗（08:30/08:40/09:00 → 13:21/13:42/13:52），并删掉了
-- 早上已生成的缺席行。结果三名补考学生被记成「准时出勤」，早上的
-- 无故缺席在系统里没有任何痕迹。
--
-- 修法：正式窗口永不改动，补考另开一对窗口字段。这样
--   · 早上的 08:30/08:40/09:00 与缺席记录不受影响
--   · 补考扫码落在 lateCutoff 之后 → 自然记为 absent（早上确实没来）
--   · makeupAt 记录补考发生时间，面板/导出可显示「缺席 · 已补考」

ALTER TABLE "MorningQuizSession" ADD COLUMN "makeupStart" TIMESTAMP(3);
ALTER TABLE "MorningQuizSession" ADD COLUMN "makeupEnd" TIMESTAMP(3);
ALTER TABLE "MorningQuizSession" ADD COLUMN "makeupOpenedById" TEXT;

ALTER TABLE "MorningQuizSession"
  ADD CONSTRAINT "MorningQuizSession_makeupOpenedById_fkey"
  FOREIGN KEY ("makeupOpenedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MorningQuizSession_makeupEnd_idx" ON "MorningQuizSession"("makeupEnd");

-- 补考时间盖在考勤行上；status 保持 absent，Seiue 照实报缺席。
ALTER TABLE "Attendance" ADD COLUMN "makeupAt" TIMESTAMP(3);
