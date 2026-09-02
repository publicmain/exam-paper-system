CREATE TABLE "VocabularyContentJob" (
    "id" TEXT NOT NULL,
    "senseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT NOT NULL,
    "requestedVersion" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "candidate" JSONB,
    "validation" JSONB,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VocabularyContentJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VocabularyContentJob_senseId_requestedVersion_key"
ON "VocabularyContentJob"("senseId", "requestedVersion");
CREATE INDEX "VocabularyContentJob_status_createdAt_idx"
ON "VocabularyContentJob"("status", "createdAt");
ALTER TABLE "VocabularyContentJob"
ADD CONSTRAINT "VocabularyContentJob_senseId_fkey"
FOREIGN KEY ("senseId") REFERENCES "VocabularySense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
