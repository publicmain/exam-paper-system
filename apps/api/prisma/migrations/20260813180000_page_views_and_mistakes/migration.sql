-- 学生自助页访问埋点 + 错题本（2026-08-13）
CREATE TYPE "PageViewKind" AS ENUM ('history', 'submission_detail', 'vocab', 'vocab_practice', 'mistakes');
CREATE TYPE "MistakeReason" AS ENUM ('repeated_tasktype', 'vocabulary', 'long_answer');

CREATE TABLE "StudentPageView" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" "PageViewKind" NOT NULL,
    "day" TEXT NOT NULL,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentPageView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentPageView_studentId_kind_day_key" ON "StudentPageView"("studentId", "kind", "day");
CREATE INDEX "StudentPageView_day_kind_idx" ON "StudentPageView"("day", "kind");
ALTER TABLE "StudentPageView" ADD CONSTRAINT "StudentPageView_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MistakeEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submissionId" TEXT,
    "paperQuestionId" TEXT,
    "taskType" TEXT NOT NULL,
    "passageTitle" TEXT NOT NULL DEFAULT '',
    "stem" TEXT NOT NULL,
    "studentAnswer" TEXT NOT NULL DEFAULT '',
    "correctAnswer" TEXT NOT NULL DEFAULT '',
    "markerComment" TEXT NOT NULL DEFAULT '',
    "awarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxMarks" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "vocabWord" TEXT NOT NULL DEFAULT '',
    "reason" "MistakeReason" NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "quizDay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MistakeEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MistakeEntry_studentId_submissionId_paperQuestionId_key" ON "MistakeEntry"("studentId", "submissionId", "paperQuestionId");
CREATE INDEX "MistakeEntry_studentId_resolved_idx" ON "MistakeEntry"("studentId", "resolved");
CREATE INDEX "MistakeEntry_quizDay_idx" ON "MistakeEntry"("quizDay");
ALTER TABLE "MistakeEntry" ADD CONSTRAINT "MistakeEntry_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
