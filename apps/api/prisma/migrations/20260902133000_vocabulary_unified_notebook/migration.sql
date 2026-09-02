ALTER TABLE "StudentVocabularySense"
ADD COLUMN "inNotebook" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "removedAt" TIMESTAMP(3);

CREATE INDEX "StudentVocabularySense_studentId_inNotebook_idx"
ON "StudentVocabularySense"("studentId", "inNotebook");
