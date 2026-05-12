-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Paper" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GradeAppeal" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "paperQuestionId" TEXT,
    "studentMessage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reviewerId" TEXT,
    "reviewerNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTransferLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromClassId" TEXT,
    "toClassId" TEXT,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTransferLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentLink" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "parentLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "lastAccessAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ParentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionRetraction" (
    "id" TEXT NOT NULL,
    "paperQuestionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "awardAllStudents" BOOLEAN NOT NULL DEFAULT true,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionRetraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeAppeal_submissionId_idx" ON "GradeAppeal"("submissionId");

-- CreateIndex
CREATE INDEX "GradeAppeal_status_createdAt_idx" ON "GradeAppeal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClassTransferLog_userId_createdAt_idx" ON "ClassTransferLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentLink_token_key" ON "ParentLink"("token");

-- CreateIndex
CREATE INDEX "ParentLink_studentId_revokedAt_idx" ON "ParentLink"("studentId", "revokedAt");

-- CreateIndex
CREATE INDEX "ParentLink_token_idx" ON "ParentLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionRetraction_paperQuestionId_key" ON "QuestionRetraction"("paperQuestionId");

-- AddForeignKey
ALTER TABLE "GradeAppeal" ADD CONSTRAINT "GradeAppeal_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "StudentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAppeal" ADD CONSTRAINT "GradeAppeal_paperQuestionId_fkey" FOREIGN KEY ("paperQuestionId") REFERENCES "PaperQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAppeal" ADD CONSTRAINT "GradeAppeal_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTransferLog" ADD CONSTRAINT "ClassTransferLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTransferLog" ADD CONSTRAINT "ClassTransferLog_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTransferLog" ADD CONSTRAINT "ClassTransferLog_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTransferLog" ADD CONSTRAINT "ClassTransferLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentLink" ADD CONSTRAINT "ParentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentLink" ADD CONSTRAINT "ParentLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRetraction" ADD CONSTRAINT "QuestionRetraction_paperQuestionId_fkey" FOREIGN KEY ("paperQuestionId") REFERENCES "PaperQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRetraction" ADD CONSTRAINT "QuestionRetraction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

