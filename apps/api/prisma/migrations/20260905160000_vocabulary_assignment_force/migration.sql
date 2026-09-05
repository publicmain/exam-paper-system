-- 老师词表按拼写去重：见过的学生跳过，除非老师给这个词打了 force。
ALTER TABLE "VocabularyV2AssignmentItem"
ADD COLUMN "force" BOOLEAN NOT NULL DEFAULT false;
