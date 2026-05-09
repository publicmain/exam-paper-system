-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('teacher', 'head_teacher', 'admin', 'student');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('mcq', 'short_answer', 'structured', 'essay');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('original_school', 'ai_generated', 'past_paper_reference', 'textbook');

-- CreateEnum
CREATE TYPE "PaperStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "RepoType" AS ENUM ('with_pdfs', 'notes_only', 'downloader_script', 'topic_page', 'official', 'school_upload', 'ai_generator');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('idle', 'running', 'ok', 'failed');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('pending_review', 'approved_internal', 'restricted_internal', 'blocked', 'expired');

-- CreateEnum
CREATE TYPE "AllowedUsage" AS ENUM ('free_use', 'internal_classroom_only', 'metadata_reference_only', 'none');

-- CreateEnum
CREATE TYPE "RetentionPolicy" AS ENUM ('keep_indefinite', 'delete_after_review', 'delete_when_blocked', 'school_license_term');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('question_paper', 'mark_scheme', 'examiner_report', 'insert', 'syllabus_doc', 'other');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('pending', 'processing', 'processed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending_review', 'needs_human_review', 'approved', 'rejected', 'on_hold');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('figure', 'diagram', 'graph', 'chemical_structure', 'equation_image', 'table', 'other');

-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('ai', 'filename', 'heuristic', 'teacher');

-- CreateEnum
CREATE TYPE "QuestionItemSource" AS ENUM ('past_paper', 'ai_generated', 'manual');

-- CreateEnum
CREATE TYPE "QuestionQualitySignalType" AS ENUM ('approved', 'rejected', 'edited', 'answered_correct', 'answered_wrong', 'skipped');

-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('paper_assigned', 'paper_marked', 'low_score', 'morning_quiz_cron_failed', 'consecutive_absent', 'teacher_daily_digest', 'morning_quiz_review_gate', 'morning_quiz_auto_released');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('wechat_work', 'dingtalk', 'email');

-- CreateEnum
CREATE TYPE "TutorRole" AS ENUM ('student', 'assistant');

-- CreateEnum
CREATE TYPE "MorningQuizStatus" AS ENUM ('scheduled', 'active', 'locked', 'cancelled');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('on_time', 'late', 'absent');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('qr_scan', 'manual_correction');

-- CreateEnum
CREATE TYPE "EnglishLevel" AS ENUM ('ielts_authentic', 'ielts_hard', 'olevel');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'teacher',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "weeklyFocus" TEXT,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassEnrollment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'student',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperAssignment" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "durationMin" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "PaperAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "autoScore" DOUBLE PRECISION,
    "manualScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "maxScore" INTEGER NOT NULL,

    CONSTRAINT "StudentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerScript" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "paperQuestionId" TEXT NOT NULL,
    "selectedOption" TEXT,
    "textAnswer" TEXT,
    "awardedMarks" DOUBLE PRECISION,
    "markerComment" TEXT,
    "markedById" TEXT,
    "markedAt" TIMESTAMP(3),
    "autoCorrect" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamBoard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ExamBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "examBoardId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusComponent" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SyllabusComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "parentTopicId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "componentId" TEXT,
    "primaryTopicId" TEXT,
    "questionType" "QuestionType" NOT NULL,
    "marks" INTEGER NOT NULL,
    "estimatedTimeMin" DOUBLE PRECISION NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'original_school',
    "sourceRef" TEXT,
    "content" JSONB NOT NULL,
    "answerContent" JSONB NOT NULL,
    "options" JSONB,
    "markScheme" JSONB,
    "status" "QuestionStatus" NOT NULL DEFAULT 'draft',
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'approved_internal',
    "allowedUsage" "AllowedUsage" NOT NULL DEFAULT 'free_use',
    "provenanceTag" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTopic" (
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "QuestionTopic_pkey" PRIMARY KEY ("questionId","topicId")
);

-- CreateTable
CREATE TABLE "QuestionAsset" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "aiPrompt" TEXT,
    "aiCostUsd" DOUBLE PRECISION,
    "aiCreatedBy" TEXT,

    CONSTRAINT "QuestionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionVersion" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeNote" TEXT,

    CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperTemplate" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "componentId" TEXT,
    "durationMin" INTEGER NOT NULL,
    "totalMarks" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "isSchoolDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "classLabel" TEXT,
    "subjectId" TEXT NOT NULL,
    "componentId" TEXT,
    "examDate" TIMESTAMP(3),
    "durationMin" INTEGER NOT NULL,
    "totalMarksTarget" INTEGER NOT NULL,
    "totalMarksActual" INTEGER NOT NULL,
    "status" "PaperStatus" NOT NULL DEFAULT 'draft',
    "generatedSeed" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "qaReviewVerdict" TEXT DEFAULT 'pending',
    "qaReviewSummary" TEXT,
    "qaReviewIssues" JSONB,
    "qaReviewedAt" TIMESTAMP(3),
    "qaReviewModel" TEXT,
    "qaReviewTokens" INTEGER,
    "qaReviewCostUsd" DOUBLE PRECISION,
    "qaReviewRetries" INTEGER NOT NULL DEFAULT 0,
    "qaTeacherAction" TEXT,
    "qaTeacherActionAt" TIMESTAMP(3),
    "qaTeacherActionBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperQuestion" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "snapshotContent" JSONB NOT NULL,
    "snapshotAnswer" JSONB NOT NULL,
    "snapshotOptions" JSONB,
    "overrideContent" JSONB,
    "overrideAnswer" JSONB,
    "marks" INTEGER NOT NULL,

    CONSTRAINT "PaperQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperVersion" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeNote" TEXT,

    CONSTRAINT "PaperVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionUsageLog" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "classLabel" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "diff" JSONB,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRepository" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "repoType" "RepoType" NOT NULL,
    "licenseDetected" TEXT,
    "licenseTextUrl" TEXT,
    "examBoardHint" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'idle',
    "syncError" TEXT,
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'pending_review',
    "syllabusAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearAllowlist" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "copyrightOwner" TEXT,
    "allowedUsage" "AllowedUsage" NOT NULL DEFAULT 'none',
    "retentionPolicy" "RetentionPolicy" NOT NULL DEFAULT 'delete_when_blocked',
    "notesForTeachers" TEXT,
    "addedById" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedReason" TEXT,
    "blockedAt" TIMESTAMP(3),

    CONSTRAINT "SourceRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "rawFilename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "fileKind" "FileKind" NOT NULL DEFAULT 'other',
    "syllabusCode" TEXT,
    "examYear" INTEGER,
    "examSeason" TEXT,
    "paperVariant" TEXT,
    "paperNumber" TEXT,
    "parsedFromName" JSONB,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processStatus" "ProcessStatus" NOT NULL DEFAULT 'pending',
    "processError" TEXT,
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'pending_review',

    CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfPage" (
    "id" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "pageNo" INTEGER NOT NULL,
    "rawText" TEXT,
    "layoutJson" JSONB,
    "imageUrl" TEXT,
    "imageBytes" BYTEA,
    "ocrUsed" BOOLEAN NOT NULL DEFAULT false,
    "ocrConfidence" DOUBLE PRECISION,

    CONSTRAINT "PdfPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionItem" (
    "id" TEXT NOT NULL,
    "source" "QuestionItemSource" NOT NULL DEFAULT 'past_paper',
    "sourceFileId" TEXT,
    "questionId" TEXT,
    "aiModel" TEXT,
    "aiPrompt" TEXT,
    "aiCostUsd" DOUBLE PRECISION,
    "aiCreatedById" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "cropBboxJson" JSONB,
    "cropImageUrl" TEXT,
    "rawExtractedText" TEXT,
    "extractedLatex" TEXT,
    "questionNumber" TEXT,
    "suggestedSubjectCode" TEXT,
    "suggestedTopicCode" TEXT,
    "suggestedType" "QuestionType",
    "suggestedMarks" INTEGER,
    "suggestedDifficulty" INTEGER,
    "suggestedMetadata" JSONB,
    "confidenceSplit" DOUBLE PRECISION,
    "confidenceMarks" DOUBLE PRECISION,
    "confidenceMs" DOUBLE PRECISION,
    "confidenceTopic" DOUBLE PRECISION,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'pending_review',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'pending_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionPart" (
    "id" TEXT NOT NULL,
    "questionItemId" TEXT NOT NULL,
    "partLabel" TEXT NOT NULL,
    "parentPartId" TEXT,
    "marks" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "latexText" TEXT,
    "cropBboxJson" JSONB,
    "cropImageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuestionPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestedAsset" (
    "id" TEXT NOT NULL,
    "questionItemId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "pageNo" INTEGER,
    "bboxJson" JSONB,
    "altText" TEXT,
    "ocrText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IngestedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkSchemeItem" (
    "id" TEXT NOT NULL,
    "questionItemId" TEXT NOT NULL,
    "partLabel" TEXT,
    "pointText" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "notesForExaminer" TEXT,
    "cropImageUrl" TEXT,
    "matchConfidence" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MarkSchemeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionItemTopic" (
    "questionItemId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "taggedBy" "TagSource" NOT NULL DEFAULT 'ai',

    CONSTRAINT "QuestionItemTopic_pkey" PRIMARY KEY ("questionItemId","topicId")
);

-- CreateTable
CREATE TABLE "TeacherReview" (
    "id" TEXT NOT NULL,
    "questionItemId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reasonCode" TEXT,
    "notes" TEXT,
    "metadataDiff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkerAssignment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "markerId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "MarkerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionQualitySignal" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "signalType" "QuestionQualitySignalType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meta" JSONB,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionQualitySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperVariantAssignment" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "questionOrder" JSONB NOT NULL,
    "optionShuffles" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperVariantAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationConfig" (
    "id" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "target" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "configId" TEXT,
    "event" "NotificationEvent" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "payload" JSONB NOT NULL,
    "httpStatus" INTEGER NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeQuestionTestCase" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "stdin" TEXT NOT NULL DEFAULT '',
    "expectedStdout" TEXT NOT NULL,
    "marksPerCase" INTEGER NOT NULL DEFAULT 1,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeQuestionTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeSubmissionResult" (
    "id" TEXT NOT NULL,
    "answerScriptId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "stdout" TEXT,
    "stderr" TEXT,
    "runtimeMs" INTEGER NOT NULL DEFAULT 0,
    "passedCases" INTEGER NOT NULL DEFAULT 0,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "awardedMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meta" JSONB,
    "judgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeSubmissionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submissionId" TEXT,
    "paperQuestionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "TutorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "TutorRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "costUsd" DOUBLE PRECISION,

    CONSTRAINT "TutorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatermarkToken" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "WatermarkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MorningQuizSession" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "classId" TEXT NOT NULL,
    "paperAssignmentId" TEXT NOT NULL,
    "attendanceStart" TIMESTAMP(3) NOT NULL,
    "attendanceEnd" TIMESTAMP(3) NOT NULL,
    "lateCutoff" TIMESTAMP(3) NOT NULL,
    "quizStart" TIMESTAMP(3) NOT NULL,
    "quizEnd" TIMESTAMP(3) NOT NULL,
    "qrSecret" TEXT NOT NULL,
    "qrRotationSeconds" INTEGER NOT NULL DEFAULT 15,
    "status" "MorningQuizStatus" NOT NULL DEFAULT 'scheduled',
    "scheduledById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MorningQuizSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "scanTime" TIMESTAMP(3),
    "sourceIp" TEXT,
    "deviceUuid" TEXT,
    "userAgent" TEXT,
    "source" "AttendanceSource" NOT NULL,
    "correctedById" TEXT,
    "correctedNote" TEXT,
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassEnglishLevel" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "level" "EnglishLevel" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassEnglishLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionShuffleMap" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "questionOrder" INTEGER[],
    "optionOrders" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionShuffleMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Class_classCode_key" ON "Class"("classCode");

-- CreateIndex
CREATE INDEX "ClassEnrollment_userId_idx" ON "ClassEnrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassEnrollment_classId_userId_key" ON "ClassEnrollment"("classId", "userId");

-- CreateIndex
CREATE INDEX "PaperAssignment_classId_idx" ON "PaperAssignment"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAssignment_paperId_classId_key" ON "PaperAssignment"("paperId", "classId");

-- CreateIndex
CREATE INDEX "StudentSubmission_studentId_idx" ON "StudentSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubmission_assignmentId_studentId_key" ON "StudentSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "AnswerScript_submissionId_idx" ON "AnswerScript"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerScript_submissionId_paperQuestionId_key" ON "AnswerScript"("submissionId", "paperQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamBoard_code_key" ON "ExamBoard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_examBoardId_code_level_key" ON "Subject"("examBoardId", "code", "level");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusComponent_subjectId_code_key" ON "SyllabusComponent"("subjectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_componentId_code_key" ON "Topic"("componentId", "code");

-- CreateIndex
CREATE INDEX "Question_subjectId_componentId_status_idx" ON "Question"("subjectId", "componentId", "status");

-- CreateIndex
CREATE INDEX "Question_primaryTopicId_idx" ON "Question"("primaryTopicId");

-- CreateIndex
CREATE INDEX "Question_complianceStatus_status_idx" ON "Question"("complianceStatus", "status");

-- CreateIndex
CREATE INDEX "Question_provenanceTag_idx" ON "Question"("provenanceTag");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVersion_questionId_versionNumber_key" ON "QuestionVersion"("questionId", "versionNumber");

-- CreateIndex
CREATE INDEX "Paper_qaReviewVerdict_qaTeacherAction_idx" ON "Paper"("qaReviewVerdict", "qaTeacherAction");

-- CreateIndex
CREATE INDEX "Paper_ownerId_status_idx" ON "Paper"("ownerId", "status");

-- CreateIndex
CREATE INDEX "PaperQuestion_paperId_sortOrder_idx" ON "PaperQuestion"("paperId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PaperVersion_paperId_versionNumber_key" ON "PaperVersion"("paperId", "versionNumber");

-- CreateIndex
CREATE INDEX "QuestionUsageLog_questionId_usedAt_idx" ON "QuestionUsageLog"("questionId", "usedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceRepository_url_key" ON "SourceRepository"("url");

-- CreateIndex
CREATE INDEX "SourceRepository_complianceStatus_idx" ON "SourceRepository"("complianceStatus");

-- CreateIndex
CREATE INDEX "SourceRepository_syncStatus_idx" ON "SourceRepository"("syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SourceFile_sha256_key" ON "SourceFile"("sha256");

-- CreateIndex
CREATE INDEX "SourceFile_repoId_fileKind_idx" ON "SourceFile"("repoId", "fileKind");

-- CreateIndex
CREATE INDEX "SourceFile_syllabusCode_examYear_examSeason_idx" ON "SourceFile"("syllabusCode", "examYear", "examSeason");

-- CreateIndex
CREATE INDEX "SourceFile_complianceStatus_processStatus_idx" ON "SourceFile"("complianceStatus", "processStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PdfPage_sourceFileId_pageNo_key" ON "PdfPage"("sourceFileId", "pageNo");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionItem_questionId_key" ON "QuestionItem"("questionId");

-- CreateIndex
CREATE INDEX "QuestionItem_reviewStatus_complianceStatus_idx" ON "QuestionItem"("reviewStatus", "complianceStatus");

-- CreateIndex
CREATE INDEX "QuestionItem_sourceFileId_idx" ON "QuestionItem"("sourceFileId");

-- CreateIndex
CREATE INDEX "TeacherReview_questionItemId_createdAt_idx" ON "TeacherReview"("questionItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarkerAssignment_submissionId_key" ON "MarkerAssignment"("submissionId");

-- CreateIndex
CREATE INDEX "MarkerAssignment_markerId_status_idx" ON "MarkerAssignment"("markerId", "status");

-- CreateIndex
CREATE INDEX "MarkerAssignment_submissionId_status_idx" ON "MarkerAssignment"("submissionId", "status");

-- CreateIndex
CREATE INDEX "QuestionQualitySignal_questionId_recordedAt_idx" ON "QuestionQualitySignal"("questionId", "recordedAt");

-- CreateIndex
CREATE INDEX "QuestionQualitySignal_signalType_recordedAt_idx" ON "QuestionQualitySignal"("signalType", "recordedAt");

-- CreateIndex
CREATE INDEX "PaperVariantAssignment_assignmentId_idx" ON "PaperVariantAssignment"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperVariantAssignment_assignmentId_studentId_key" ON "PaperVariantAssignment"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "NotificationConfig_event_channel_enabled_idx" ON "NotificationConfig"("event", "channel", "enabled");

-- CreateIndex
CREATE INDEX "NotificationLog_event_sentAt_idx" ON "NotificationLog"("event", "sentAt");

-- CreateIndex
CREATE INDEX "NotificationLog_configId_sentAt_idx" ON "NotificationLog"("configId", "sentAt");

-- CreateIndex
CREATE INDEX "CodeQuestionTestCase_questionId_sortOrder_idx" ON "CodeQuestionTestCase"("questionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CodeSubmissionResult_answerScriptId_key" ON "CodeSubmissionResult"("answerScriptId");

-- CreateIndex
CREATE INDEX "CodeSubmissionResult_judgedAt_idx" ON "CodeSubmissionResult"("judgedAt");

-- CreateIndex
CREATE INDEX "TutorSession_studentId_startedAt_idx" ON "TutorSession"("studentId", "startedAt");

-- CreateIndex
CREATE INDEX "TutorSession_submissionId_idx" ON "TutorSession"("submissionId");

-- CreateIndex
CREATE INDEX "TutorSession_paperQuestionId_idx" ON "TutorSession"("paperQuestionId");

-- CreateIndex
CREATE INDEX "TutorMessage_sessionId_createdAt_idx" ON "TutorMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatermarkToken_token_key" ON "WatermarkToken"("token");

-- CreateIndex
CREATE INDEX "WatermarkToken_studentId_idx" ON "WatermarkToken"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "WatermarkToken_paperId_studentId_key" ON "WatermarkToken"("paperId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MorningQuizSession_paperAssignmentId_key" ON "MorningQuizSession"("paperAssignmentId");

-- CreateIndex
CREATE INDEX "MorningQuizSession_date_status_idx" ON "MorningQuizSession"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MorningQuizSession_date_classId_key" ON "MorningQuizSession"("date", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_submissionId_key" ON "Attendance"("submissionId");

-- CreateIndex
CREATE INDEX "Attendance_studentId_status_idx" ON "Attendance"("studentId", "status");

-- CreateIndex
CREATE INDEX "Attendance_sessionId_deviceUuid_idx" ON "Attendance"("sessionId", "deviceUuid");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_studentId_key" ON "Attendance"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassEnglishLevel_classId_key" ON "ClassEnglishLevel"("classId");

-- CreateIndex
CREATE INDEX "QuestionShuffleMap_paperId_idx" ON "QuestionShuffleMap"("paperId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionShuffleMap_studentId_paperId_key" ON "QuestionShuffleMap"("studentId", "paperId");

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperAssignment" ADD CONSTRAINT "PaperAssignment_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperAssignment" ADD CONSTRAINT "PaperAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperAssignment" ADD CONSTRAINT "PaperAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubmission" ADD CONSTRAINT "StudentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PaperAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubmission" ADD CONSTRAINT "StudentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerScript" ADD CONSTRAINT "AnswerScript_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "StudentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerScript" ADD CONSTRAINT "AnswerScript_paperQuestionId_fkey" FOREIGN KEY ("paperQuestionId") REFERENCES "PaperQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_examBoardId_fkey" FOREIGN KEY ("examBoardId") REFERENCES "ExamBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusComponent" ADD CONSTRAINT "SyllabusComponent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SyllabusComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_parentTopicId_fkey" FOREIGN KEY ("parentTopicId") REFERENCES "Topic"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SyllabusComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_primaryTopicId_fkey" FOREIGN KEY ("primaryTopicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTopic" ADD CONSTRAINT "QuestionTopic_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTopic" ADD CONSTRAINT "QuestionTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAsset" ADD CONSTRAINT "QuestionAsset_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTemplate" ADD CONSTRAINT "PaperTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTemplate" ADD CONSTRAINT "PaperTemplate_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTemplate" ADD CONSTRAINT "PaperTemplate_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SyllabusComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PaperTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SyllabusComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperQuestion" ADD CONSTRAINT "PaperQuestion_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperQuestion" ADD CONSTRAINT "PaperQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperVersion" ADD CONSTRAINT "PaperVersion_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperVersion" ADD CONSTRAINT "PaperVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionUsageLog" ADD CONSTRAINT "QuestionUsageLog_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionUsageLog" ADD CONSTRAINT "QuestionUsageLog_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRepository" ADD CONSTRAINT "SourceRepository_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "SourceRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfPage" ADD CONSTRAINT "PdfPage_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionItem" ADD CONSTRAINT "QuestionItem_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionItem" ADD CONSTRAINT "QuestionItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionItem" ADD CONSTRAINT "QuestionItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPart" ADD CONSTRAINT "QuestionPart_questionItemId_fkey" FOREIGN KEY ("questionItemId") REFERENCES "QuestionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPart" ADD CONSTRAINT "QuestionPart_parentPartId_fkey" FOREIGN KEY ("parentPartId") REFERENCES "QuestionPart"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "IngestedAsset" ADD CONSTRAINT "IngestedAsset_questionItemId_fkey" FOREIGN KEY ("questionItemId") REFERENCES "QuestionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSchemeItem" ADD CONSTRAINT "MarkSchemeItem_questionItemId_fkey" FOREIGN KEY ("questionItemId") REFERENCES "QuestionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionItemTopic" ADD CONSTRAINT "QuestionItemTopic_questionItemId_fkey" FOREIGN KEY ("questionItemId") REFERENCES "QuestionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionItemTopic" ADD CONSTRAINT "QuestionItemTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReview" ADD CONSTRAINT "TeacherReview_questionItemId_fkey" FOREIGN KEY ("questionItemId") REFERENCES "QuestionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReview" ADD CONSTRAINT "TeacherReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkerAssignment" ADD CONSTRAINT "MarkerAssignment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "StudentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkerAssignment" ADD CONSTRAINT "MarkerAssignment_markerId_fkey" FOREIGN KEY ("markerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionQualitySignal" ADD CONSTRAINT "QuestionQualitySignal_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperVariantAssignment" ADD CONSTRAINT "PaperVariantAssignment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PaperAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperVariantAssignment" ADD CONSTRAINT "PaperVariantAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeQuestionTestCase" ADD CONSTRAINT "CodeQuestionTestCase_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSubmissionResult" ADD CONSTRAINT "CodeSubmissionResult_answerScriptId_fkey" FOREIGN KEY ("answerScriptId") REFERENCES "AnswerScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorSession" ADD CONSTRAINT "TutorSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorSession" ADD CONSTRAINT "TutorSession_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "StudentSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorSession" ADD CONSTRAINT "TutorSession_paperQuestionId_fkey" FOREIGN KEY ("paperQuestionId") REFERENCES "PaperQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorMessage" ADD CONSTRAINT "TutorMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TutorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatermarkToken" ADD CONSTRAINT "WatermarkToken_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatermarkToken" ADD CONSTRAINT "WatermarkToken_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatermarkToken" ADD CONSTRAINT "WatermarkToken_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PaperAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MorningQuizSession" ADD CONSTRAINT "MorningQuizSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MorningQuizSession" ADD CONSTRAINT "MorningQuizSession_paperAssignmentId_fkey" FOREIGN KEY ("paperAssignmentId") REFERENCES "PaperAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MorningQuizSession" ADD CONSTRAINT "MorningQuizSession_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MorningQuizSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "StudentSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnglishLevel" ADD CONSTRAINT "ClassEnglishLevel_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionShuffleMap" ADD CONSTRAINT "QuestionShuffleMap_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionShuffleMap" ADD CONSTRAINT "QuestionShuffleMap_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

