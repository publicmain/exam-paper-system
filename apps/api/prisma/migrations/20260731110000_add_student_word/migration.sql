-- 生词本 P2：学生生词本 + 复习流水。纯新增。
CREATE TYPE "VocabSource" AS ENUM ('click', 'wrong_answer', 'teacher_push');
CREATE TYPE "VocabState" AS ENUM ('new', 'learning', 'review', 'known');
CREATE TYPE "VocabRating" AS ENUM ('again', 'hard', 'good', 'easy');

CREATE TABLE "StudentWord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "headword" TEXT NOT NULL,
    "surfaceForm" TEXT NOT NULL,
    "sourceType" "VocabSource" NOT NULL DEFAULT 'click',
    "sourcePaperQuestionId" TEXT,
    "sourcePassageTitle" TEXT,
    "contextSentence" TEXT NOT NULL DEFAULT '',
    "state" "VocabState" NOT NULL DEFAULT 'new',
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elapsedDays" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastReview" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentWord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WordReviewLog" (
    "id" TEXT NOT NULL,
    "studentWordId" TEXT NOT NULL,
    "rating" "VocabRating" NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "elapsedMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WordReviewLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentWord_studentId_headword_key" ON "StudentWord"("studentId", "headword");
CREATE INDEX "StudentWord_studentId_due_idx" ON "StudentWord"("studentId", "due");
CREATE INDEX "StudentWord_studentId_state_idx" ON "StudentWord"("studentId", "state");
CREATE INDEX "WordReviewLog_studentWordId_idx" ON "WordReviewLog"("studentWordId");

ALTER TABLE "StudentWord" ADD CONSTRAINT "StudentWord_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordReviewLog" ADD CONSTRAINT "WordReviewLog_studentWordId_fkey"
  FOREIGN KEY ("studentWordId") REFERENCES "StudentWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
