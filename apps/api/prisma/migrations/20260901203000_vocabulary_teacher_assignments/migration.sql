CREATE TABLE "VocabularyV2Assignment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VocabularyV2Assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VocabularyV2AssignmentItem" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "senseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabularyV2AssignmentItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VocabularyV2Assignment_classId_date_key" ON "VocabularyV2Assignment"("classId", "date");
CREATE INDEX "VocabularyV2Assignment_assignedById_date_idx" ON "VocabularyV2Assignment"("assignedById", "date");
CREATE UNIQUE INDEX "VocabularyV2AssignmentItem_assignmentId_position_key" ON "VocabularyV2AssignmentItem"("assignmentId", "position");
CREATE UNIQUE INDEX "VocabularyV2AssignmentItem_assignmentId_senseId_key" ON "VocabularyV2AssignmentItem"("assignmentId", "senseId");
CREATE INDEX "VocabularyV2AssignmentItem_senseId_idx" ON "VocabularyV2AssignmentItem"("senseId");

ALTER TABLE "VocabularyV2Assignment" ADD CONSTRAINT "VocabularyV2Assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabularyV2Assignment" ADD CONSTRAINT "VocabularyV2Assignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VocabularyV2AssignmentItem" ADD CONSTRAINT "VocabularyV2AssignmentItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "VocabularyV2Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabularyV2AssignmentItem" ADD CONSTRAINT "VocabularyV2AssignmentItem_senseId_fkey" FOREIGN KEY ("senseId") REFERENCES "VocabularySense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
