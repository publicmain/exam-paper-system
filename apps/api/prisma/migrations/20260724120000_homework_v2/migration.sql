-- AlterTable
ALTER TABLE "HomeworkSubmission" ADD COLUMN     "history" JSONB;

-- AlterTable
ALTER TABLE "HomeworkQuestion" ADD COLUMN     "items" JSONB,
ADD COLUMN     "regions" JSONB,
ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "HomeworkGrade" ADD COLUMN     "appliedItems" JSONB;

-- AlterTable
ALTER TABLE "HomeworkPage" ADD COLUMN     "teacherInk" JSONB;

-- CreateTable
CREATE TABLE "RegradeRequest" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reply" TEXT,
    "repliedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegradeRequest_submissionId_idx" ON "RegradeRequest"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RegradeRequest_submissionId_questionId_key" ON "RegradeRequest"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RegradeRequest" ADD CONSTRAINT "RegradeRequest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegradeRequest" ADD CONSTRAINT "RegradeRequest_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "HomeworkQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegradeRequest" ADD CONSTRAINT "RegradeRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegradeRequest" ADD CONSTRAINT "RegradeRequest_repliedById_fkey" FOREIGN KEY ("repliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

