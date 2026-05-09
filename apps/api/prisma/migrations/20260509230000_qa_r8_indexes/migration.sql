-- Round-8 H15 / H17: composite indexes the marker queue + morning-quiz
-- schedule lookup need.  Both are read-only additions; if you re-run the
-- migration after applying it manually the IF NOT EXISTS guards keep it
-- idempotent.

-- StudentSubmission(assignmentId, status) — MarkerService.listQueue.
CREATE INDEX IF NOT EXISTS "StudentSubmission_assignmentId_status_idx"
  ON "StudentSubmission"("assignmentId", "status");

-- MorningQuizSession(classId, date) — schedule UI's "next session for
-- this class" lookup.  The unique key is (date, classId), wrong column
-- order for that filter shape.
CREATE INDEX IF NOT EXISTS "MorningQuizSession_classId_date_idx"
  ON "MorningQuizSession"("classId", "date");
