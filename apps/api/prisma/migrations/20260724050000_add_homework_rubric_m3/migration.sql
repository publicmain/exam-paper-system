-- CreateTable
CREATE TABLE "HomeworkQuestion" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "maxMarks" INTEGER NOT NULL,
    "criteria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkGrade" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "awardedMarks" DOUBLE PRECISION,
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'teacher',
    "confidence" DOUBLE PRECISION,
    "rationale" TEXT,
    "gradedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkQuestion_homeworkId_idx" ON "HomeworkQuestion"("homeworkId");

-- CreateIndex
CREATE INDEX "HomeworkGrade_submissionId_idx" ON "HomeworkGrade"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkGrade_submissionId_questionId_key" ON "HomeworkGrade"("submissionId", "questionId");

-- AddForeignKey
ALTER TABLE "HomeworkQuestion" ADD CONSTRAINT "HomeworkQuestion_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkGrade" ADD CONSTRAINT "HomeworkGrade_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkGrade" ADD CONSTRAINT "HomeworkGrade_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "HomeworkQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkGrade" ADD CONSTRAINT "HomeworkGrade_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

