-- 2026-11-05 完整化第 2 期：早读默写回填。只加表。
CREATE TABLE "DictationSheet" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "learnedDate" DATE NOT NULL,
    "heldOn" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DictationSheet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DictationSheet_classId_learnedDate_key" ON "DictationSheet"("classId", "learnedDate");
CREATE INDEX "DictationSheet_heldOn_idx" ON "DictationSheet"("heldOn");

CREATE TABLE "DictationSheetRow" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "senseIds" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "wrongSenseIds" JSONB,
    "enteredById" TEXT,
    "enteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DictationSheetRow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DictationSheetRow_sheetId_studentId_key" ON "DictationSheetRow"("sheetId", "studentId");
CREATE INDEX "DictationSheetRow_studentId_idx" ON "DictationSheetRow"("studentId");
ALTER TABLE "DictationSheetRow" ADD CONSTRAINT "DictationSheetRow_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "DictationSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
