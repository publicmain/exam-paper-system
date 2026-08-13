-- 贴墙二维码分身：记录学生扫的是哪一张。
--
-- 贴墙码固定不变，学生可以拍成照片带回家扫，考勤无从分辨。
-- 做法是同一班签发多张都能用的码、各带标签，换墙上那张时不通知学生；
-- 当天扫到旧标签的，用的必然是之前拍的照片。
ALTER TABLE "Attendance" ADD COLUMN "qrVariant" TEXT;
CREATE INDEX "Attendance_qrVariant_idx" ON "Attendance"("qrVariant");
