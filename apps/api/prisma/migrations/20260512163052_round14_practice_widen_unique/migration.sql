-- Round 14 Feature 16 (practice mode) — drop @@unique([assignmentId, studentId])
-- so a student can have BOTH a real `submitted` submission AND a `practice`
-- submission against the same paper. Non-practice uniqueness is now enforced
-- at the service layer (student.service.finalSubmit + assignPaper flows).

DROP INDEX "StudentSubmission_assignmentId_studentId_key";

CREATE INDEX "StudentSubmission_assignmentId_studentId_idx" ON "StudentSubmission"("assignmentId", "studentId");
