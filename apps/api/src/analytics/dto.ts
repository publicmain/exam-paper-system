/**
 * Analytics DTOs — read-only shapes for class statistics + wrong-answer
 * dashboard.  No Zod schemas needed: every endpoint is GET-only and receives
 * params via the URL, validated as plain strings by the controller.
 */

export interface ClassOverviewDto {
  classId: string;
  className: string;
  classCode: string;
  studentCount: number;
  paperCount: number;
  // Aggregates across every (student, assignment) cell.
  totals: {
    expectedSubmissions: number;
    submitted: number;
    marked: number;
    inProgress: number;
    missing: number;
  };
  meanAutoScorePct: number | null;
  meanTotalScorePct: number | null;
  perPaper: Array<{
    paperId: string;
    paperName: string;
    assignmentId: string;
    studentsExpected: number;
    submitted: number;
    marked: number;
    missing: number;
    meanAutoScore: number | null;
    meanTotalScore: number | null;
    maxScore: number;
  }>;
}

export interface WrongAnswerRowDto {
  paperQuestionId: string;
  questionId: string;
  sortOrder: number;
  questionType: string;
  marks: number;
  stemSnippet: string;
  totalSubmissions: number;
  answered: number;
  unanswered: number;
  // For MCQ only — null for structured (no auto-grade).
  correct: number | null;
  pctCorrect: number | null;
  topDistractor: { key: string; count: number; text: string | null } | null;
  // For structured items — fraction of scripts where awardedMarks > 0.
  // Surfaced only when manual marking has happened (else null).
  pctMarkedNonZero: number | null;
}

export interface WrongAnswerDashboardDto {
  paperId: string;
  paperName: string;
  totalSubmissions: number;
  rows: WrongAnswerRowDto[];
}

export interface TopicMasteryDto {
  classId: string;
  paperId: string | null;
  topics: Array<{
    topicId: string | null;
    topicCode: string | null;
    topicName: string;
    questionCount: number;
    mcqAttempts: number;
    mcqCorrect: number;
    pctCorrect: number | null;
  }>;
}

export interface StudentHistoryDto {
  studentId: string;
  studentName: string;
  studentEmail: string;
  submissions: Array<{
    submissionId: string;
    assignmentId: string;
    paperId: string;
    paperName: string;
    className: string;
    classId: string;
    status: string;
    submittedAt: Date | null;
    autoScore: number | null;
    manualScore: number | null;
    totalScore: number | null;
    maxScore: number;
  }>;
}
