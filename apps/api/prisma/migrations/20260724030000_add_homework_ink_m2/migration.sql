-- AlterTable
ALTER TABLE "HomeworkPage" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'upload';

-- CreateTable
CREATE TABLE "HomeworkInkPage" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "strokes" JSONB NOT NULL DEFAULT '[]',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "backgroundFileId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkInkPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkInkPage_submissionId_idx" ON "HomeworkInkPage"("submissionId");

-- AddForeignKey
ALTER TABLE "HomeworkInkPage" ADD CONSTRAINT "HomeworkInkPage_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

