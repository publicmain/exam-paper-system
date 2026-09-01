-- 学习卡的例句中文。默认空串让历史/手动收录词保持兼容；本周课程内容会完整回填。
ALTER TABLE "StudentWord"
ADD COLUMN "contextTranslation" TEXT NOT NULL DEFAULT '';
