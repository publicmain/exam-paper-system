-- 2026-11-05 完整化设计：首答字段 + 学习证据 + 停课日。只加列、加表，不改旧数据。
ALTER TABLE "VocabularyV2SessionItem" ADD COLUMN "firstResponse" JSONB;
ALTER TABLE "VocabularyV2SessionItem" ADD COLUMN "firstIsCorrect" BOOLEAN;
ALTER TABLE "VocabularyV2SessionItem" ADD COLUMN "firstAnsweredAt" TIMESTAMP(3);
ALTER TABLE "VocabularyV2SessionItem" ADD COLUMN "hintLevel" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "LearningEvidence" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "senseId" TEXT,
    "paperQuestionId" TEXT,
    "sessionItemId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "hinted" BOOLEAN NOT NULL DEFAULT false,
    "detail" JSONB,
    "schoolDate" DATE NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LearningEvidence_sourceKey_key" ON "LearningEvidence"("sourceKey");
CREATE INDEX "LearningEvidence_studentId_schoolDate_idx" ON "LearningEvidence"("studentId", "schoolDate");
CREATE INDEX "LearningEvidence_studentId_senseId_kind_idx" ON "LearningEvidence"("studentId", "senseId", "kind");
CREATE INDEX "LearningEvidence_studentId_paperQuestionId_kind_idx" ON "LearningEvidence"("studentId", "paperQuestionId", "kind");

CREATE TABLE "ClassNoSchoolDay" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassNoSchoolDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassNoSchoolDay_classId_date_key" ON "ClassNoSchoolDay"("classId", "date");
CREATE INDEX "ClassNoSchoolDay_date_idx" ON "ClassNoSchoolDay"("date");
