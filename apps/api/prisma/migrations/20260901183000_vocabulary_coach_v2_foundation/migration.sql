-- Vocabulary Coach V2 is deliberately additive. The legacy StudentWord and
-- DailyLessonCompletion tables remain untouched during the one-class rollout.

CREATE TABLE "VocabularyLexeme" (
  "id" TEXT NOT NULL,
  "listName" TEXT NOT NULL,
  "listVersion" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "headword" TEXT NOT NULL,
  "phonetic" TEXT,
  "attribution" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VocabularyLexeme_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VocabularyLexeme_listName_listVersion_headword_key" ON "VocabularyLexeme"("listName", "listVersion", "headword");
CREATE INDEX "VocabularyLexeme_listName_listVersion_rank_idx" ON "VocabularyLexeme"("listName", "listVersion", "rank");
CREATE INDEX "VocabularyLexeme_headword_idx" ON "VocabularyLexeme"("headword");

CREATE TABLE "VocabularySense" (
  "id" TEXT NOT NULL,
  "lexemeId" TEXT NOT NULL,
  "senseKey" TEXT NOT NULL,
  "pos" TEXT NOT NULL,
  "definition" TEXT NOT NULL,
  "translation" TEXT NOT NULL,
  "collocations" JSONB,
  "wordFamily" JSONB,
  "confusionWords" JSONB,
  "memoryHint" TEXT,
  "imageUrl" TEXT,
  "contentVersion" INTEGER NOT NULL DEFAULT 1,
  "qualityStatus" TEXT NOT NULL DEFAULT 'ready',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VocabularySense_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VocabularySense_lexemeId_senseKey_key" ON "VocabularySense"("lexemeId", "senseKey");
CREATE INDEX "VocabularySense_qualityStatus_idx" ON "VocabularySense"("qualityStatus");

CREATE TABLE "VocabularyContext" (
  "id" TEXT NOT NULL,
  "senseId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 1,
  "sentence" TEXT NOT NULL,
  "translation" TEXT NOT NULL,
  "topic" TEXT,
  "difficulty" INTEGER NOT NULL DEFAULT 1,
  "sourceTitle" TEXT,
  "sourceRef" TEXT,
  "qualityStatus" TEXT NOT NULL DEFAULT 'ready',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VocabularyContext_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VocabularyContext_senseId_kind_position_key" ON "VocabularyContext"("senseId", "kind", "position");
CREATE INDEX "VocabularyContext_senseId_difficulty_idx" ON "VocabularyContext"("senseId", "difficulty");

CREATE TABLE "StudentVocabularyProfile" (
  "studentId" TEXT NOT NULL,
  "dailyTarget" INTEGER NOT NULL DEFAULT 10,
  "taskMinutes" INTEGER NOT NULL DEFAULT 8,
  "mode" TEXT NOT NULL DEFAULT 'adaptive_coach',
  "audioAccent" TEXT NOT NULL DEFAULT 'en-GB',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentVocabularyProfile_pkey" PRIMARY KEY ("studentId")
);

CREATE TABLE "StudentVocabularyCursor" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "listName" TEXT NOT NULL,
  "listVersion" TEXT NOT NULL,
  "nextRank" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentVocabularyCursor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentVocabularyCursor_studentId_listName_listVersion_key" ON "StudentVocabularyCursor"("studentId", "listName", "listVersion");

CREATE TABLE "StudentVocabularySense" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "senseId" TEXT NOT NULL,
  "masteryStage" INTEGER NOT NULL DEFAULT 1,
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "recognition" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contextSkill" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "recallSkill" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "spellingSkill" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "listeningSkill" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "speakingSkill" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "usageSkill" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "elapsedDays" INTEGER NOT NULL DEFAULT 0,
  "scheduledDays" INTEGER NOT NULL DEFAULT 0,
  "reps" INTEGER NOT NULL DEFAULT 0,
  "lapses" INTEGER NOT NULL DEFAULT 0,
  "lastReview" TIMESTAMP(3),
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "masteredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentVocabularySense_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentVocabularySense_studentId_senseId_key" ON "StudentVocabularySense"("studentId", "senseId");
CREATE INDEX "StudentVocabularySense_studentId_due_idx" ON "StudentVocabularySense"("studentId", "due");
CREATE INDEX "StudentVocabularySense_studentId_masteryStage_idx" ON "StudentVocabularySense"("studentId", "masteryStage");

CREATE TABLE "VocabularyCollectionEvent" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "senseId" TEXT NOT NULL,
  "studentSenseId" TEXT,
  "source" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "sourceTitle" TEXT,
  "sourceRef" TEXT,
  "contextText" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VocabularyCollectionEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VocabularyCollectionEvent_studentId_createdAt_idx" ON "VocabularyCollectionEvent"("studentId", "createdAt");
CREATE INDEX "VocabularyCollectionEvent_studentId_source_idx" ON "VocabularyCollectionEvent"("studentId", "source");

CREATE TABLE "VocabularyV2Session" (
  "id" TEXT NOT NULL,
  "sessionKey" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "sessionType" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "version" TEXT NOT NULL,
  "target" INTEGER NOT NULL,
  "cursor" INTEGER NOT NULL DEFAULT 0,
  "deferredUntil" DATE,
  "settingsSnapshot" JSONB NOT NULL,
  "sourceSummary" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VocabularyV2Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VocabularyV2Session_sessionKey_key" ON "VocabularyV2Session"("sessionKey");
CREATE INDEX "VocabularyV2Session_studentId_date_idx" ON "VocabularyV2Session"("studentId", "date");
CREATE INDEX "VocabularyV2Session_studentId_status_idx" ON "VocabularyV2Session"("studentId", "status");

CREATE TABLE "VocabularyV2SessionItem" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "senseId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "contextId" TEXT,
  "masteryBefore" INTEGER NOT NULL,
  "contentVersion" INTEGER NOT NULL,
  "contentSnapshot" JSONB NOT NULL,
  "questionSnapshot" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "response" JSONB,
  "isCorrect" BOOLEAN,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "responseMs" INTEGER,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VocabularyV2SessionItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VocabularyV2SessionItem_sessionId_position_key" ON "VocabularyV2SessionItem"("sessionId", "position");
CREATE INDEX "VocabularyV2SessionItem_sessionId_status_idx" ON "VocabularyV2SessionItem"("sessionId", "status");
CREATE INDEX "VocabularyV2SessionItem_senseId_idx" ON "VocabularyV2SessionItem"("senseId");

ALTER TABLE "VocabularySense" ADD CONSTRAINT "VocabularySense_lexemeId_fkey" FOREIGN KEY ("lexemeId") REFERENCES "VocabularyLexeme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabularyContext" ADD CONSTRAINT "VocabularyContext_senseId_fkey" FOREIGN KEY ("senseId") REFERENCES "VocabularySense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentVocabularyProfile" ADD CONSTRAINT "StudentVocabularyProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentVocabularyCursor" ADD CONSTRAINT "StudentVocabularyCursor_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentVocabularySense" ADD CONSTRAINT "StudentVocabularySense_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentVocabularySense" ADD CONSTRAINT "StudentVocabularySense_senseId_fkey" FOREIGN KEY ("senseId") REFERENCES "VocabularySense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabularyCollectionEvent" ADD CONSTRAINT "VocabularyCollectionEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabularyCollectionEvent" ADD CONSTRAINT "VocabularyCollectionEvent_senseId_fkey" FOREIGN KEY ("senseId") REFERENCES "VocabularySense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabularyCollectionEvent" ADD CONSTRAINT "VocabularyCollectionEvent_studentSenseId_fkey" FOREIGN KEY ("studentSenseId") REFERENCES "StudentVocabularySense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VocabularyV2Session" ADD CONSTRAINT "VocabularyV2Session_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabularyV2SessionItem" ADD CONSTRAINT "VocabularyV2SessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VocabularyV2Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabularyV2SessionItem" ADD CONSTRAINT "VocabularyV2SessionItem_senseId_fkey" FOREIGN KEY ("senseId") REFERENCES "VocabularySense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VocabularyV2SessionItem" ADD CONSTRAINT "VocabularyV2SessionItem_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "VocabularyContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;
