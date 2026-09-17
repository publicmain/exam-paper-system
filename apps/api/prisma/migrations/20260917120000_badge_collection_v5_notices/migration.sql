-- Additive V5 metadata only. Existing awards, users, and learning history are preserved.
ALTER TABLE "StudentAchievement"
  ADD COLUMN "noticeKind" VARCHAR(16),
  ADD COLUMN "notificationClaimedAt" TIMESTAMP(3),
  ADD COLUMN "viewedAt" TIMESTAMP(3);

CREATE INDEX "StudentAchievement_notice_pending_idx"
  ON "StudentAchievement"("studentId", "noticeKind", "notificationClaimedAt");

CREATE TABLE "StudentAchievementCollection" (
  "studentId" TEXT NOT NULL,
  "rulesVersion" INTEGER NOT NULL,
  "initializedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentAchievementCollection_pkey" PRIMARY KEY ("studentId", "rulesVersion"),
  CONSTRAINT "StudentAchievementCollection_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
