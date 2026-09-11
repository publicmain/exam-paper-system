-- UI01（2026-09-11）：学生难度变更记录。只新建一张表，不动任何已有表 / 列。
-- 过去每一天分配给学生哪一档，按「那一天结束时他在哪档」算；上线前的历史不补造。

-- CreateTable
CREATE TABLE "StudentLevelChange" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromLevel" "EnglishLevel",
    "toLevel" "EnglishLevel" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'student_self',
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentLevelChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentLevelChange_studentId_changedAt_idx" ON "StudentLevelChange"("studentId", "changedAt");

-- AddForeignKey
ALTER TABLE "StudentLevelChange" ADD CONSTRAINT "StudentLevelChange_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

