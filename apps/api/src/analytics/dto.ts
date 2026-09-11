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
  //
  // 2026-09-11 审计 T02：classOverview 重写为按学生实际分配的那一份算，
  // 补了下面这两个字段 —— `missing` 里含 `autoCollected` 的部分（不是
  // 额外加的缺交，只是单列出来方便老师区分"系统自动收卷"和"完全没碰"）；
  // `awaitingPublish` 是已交但还没发布的部分，不进 meanTotalScorePct。
  totals: {
    expectedSubmissions: number;
    submitted: number;
    marked: number;
    inProgress: number;
    missing: number;
    awaitingPublish: number;
    autoCollected: number;
  };
  meanAutoScorePct: number | null;
  meanTotalScorePct: number | null;
  perPaper: Array<{
    paperId: string;
    paperName: string;
    assignmentId: string;
    /** 早测才有场次日期/难度；普通布置作业为 null。 */
    date: string | null;
    level: string | null;
    /** 场次已取消（studentsExpected 会是 0，除非已有学生交过）。 */
    cancelled: boolean;
    studentsExpected: number;
    submitted: number;
    marked: number;
    missing: number;
    inProgress: number;
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
