export const BASE = (import.meta as any).env?.VITE_API_URL || '';

function token(): string | null {
  return localStorage.getItem('auth_token');
}

async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    // Fix #7 (global): Nest returns
    //   {"message": "...", "error": "...", "statusCode": N}
    // — show just the human message to callers, never the raw JSON.
    const text = await res.text();
    let friendly = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.message === 'string') friendly = parsed.message;
      else if (Array.isArray(parsed?.message)) friendly = parsed.message.join('; ');
    } catch {
      /* not JSON, fall through to raw text */
    }
    throw new Error(friendly || `${method} ${path} failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json() as Promise<T>;
  return (await res.text()) as any;
}

export const api = {
  // auth
  login: (email: string, password: string) => request('POST', '/auth/login', { email, password }),
  me: () => request('GET', '/auth/me'),

  // reference
  examBoards: () => request('GET', '/exam-boards'),
  subjects: (boardId?: string, level?: string) =>
    request('GET', `/subjects${qs({ boardId, level })}`),
  components: (subjectId: string) => request('GET', `/components?subjectId=${subjectId}`),
  topics: (componentId: string) => request('GET', `/topics?componentId=${componentId}`),

  // questions
  listQuestions: (params: any = {}) => request('GET', `/questions${qs(params)}`),
  getQuestion: (id: string) => request('GET', `/questions/${id}`),
  createQuestion: (data: any) => request('POST', '/questions', data),
  updateQuestion: (id: string, data: any) => request('PATCH', `/questions/${id}`, data),
  deleteQuestion: (id: string) => request('DELETE', `/questions/${id}`),
  deleteQuestionAsset: (questionId: string, assetId: string) =>
    request('DELETE', `/questions/${questionId}/assets/${assetId}`),

  // templates
  listTemplates: () => request('GET', '/templates'),
  getTemplate: (id: string) => request('GET', `/templates/${id}`),
  createTemplate: (data: any) => request('POST', '/templates', data),
  updateTemplate: (id: string, data: any) => request('PATCH', `/templates/${id}`, data),
  deleteTemplate: (id: string) => request('DELETE', `/templates/${id}`),

  // papers
  listPapers: () => request('GET', '/papers'),
  getPaper: (id: string) => request('GET', `/papers/${id}`),
  generatePaper: (data: any) => request('POST', '/papers/generate', data),
  updatePaper: (id: string, data: any) => request('PATCH', `/papers/${id}`, data),
  updatePaperQuestion: (id: string, pqId: string, data: any) =>
    request('PATCH', `/papers/${id}/questions/${pqId}`, data),
  findReplacements: (id: string, pqId: string) =>
    request('GET', `/papers/${id}/questions/${pqId}/replacements`),
  validatePaper: (id: string) => request('GET', `/papers/${id}/validate`),
  saveVersion: (id: string, note?: string) =>
    request('POST', `/papers/${id}/versions`, { note }),
  listVersions: (id: string) => request('GET', `/papers/${id}/versions`),
  exportUrl: (id: string, type: 'paper' | 'answer_key' = 'paper') =>
    `${BASE}/api/papers/${id}/export?type=${type}`,

  // ai
  suggestLabels: (data: any) => request('POST', '/ai/suggest-labels', data),
  generateDiagram: (data: any) => request('POST', '/ai/generate-diagram', data),
  imageBudget: () => request('GET', '/ai/image-budget'),
  generateAiQuestions: (data: any) => request('POST', '/ai/generate-questions', data),
  questionBudget: () => request('GET', '/ai/question-budget'),
  quickPaper: (data: any) => request('POST', '/ai/quick-paper', data),

  // sources (admin only)
  listSources: () => request('GET', '/sources'),
  getSource: (id: string) => request('GET', `/sources/${id}`),
  createSource: (data: any) => request('POST', '/sources', data),
  updateSourceCompliance: (id: string, data: any) => request('PUT', `/sources/${id}/compliance`, data),
  blockSource: (id: string, reason: string) => request('POST', `/sources/${id}/block`, { reason }),
  deleteSource: (id: string, force: boolean = false) =>
    request('DELETE', `/sources/${id}${force ? '?force=true' : ''}`),
  syncSource: (id: string) => request('POST', `/sources/${id}/sync`),
  processSource: (id: string) => request('POST', `/sources/${id}/process`),
  tagSource: (id: string, limit?: number) =>
    request('POST', `/sources/${id}/tag${limit ? `?limit=${limit}` : ''}`),

  // classes (teachers + admin)
  listClasses: () => request('GET', '/classes'),
  getClass: (id: string) => request('GET', `/classes/${id}`),
  createClass: (data: any) => request('POST', '/classes', data),
  enrollClass: (id: string, data: any) => request('POST', `/classes/${id}/enrollments`, data),
  rosterClass: (id: string, students: any[]) => request('POST', `/classes/${id}/roster`, { students }),
  unenrollClass: (id: string, userId: string) => request('DELETE', `/classes/${id}/enrollments/${userId}`),
  updateClass: (id: string, data: { weeklyFocus?: string | null }) => request('PATCH', `/classes/${id}`, data),
  // Permanent class delete. Cascades to enrollments, paper assignments,
  // morning-quiz sessions, english-level row. Admin/head-only on backend.
  deleteClass: (id: string) => request('DELETE', `/classes/${id}`),
  // R10 followup — rename a student in-place from the Classes UI.
  updateUser: (id: string, data: { name?: string; email?: string }) =>
    request('PATCH', `/admin/users/${id}`, data),

  // student
  studentAssignments: () => request('GET', '/student/assignments'),
  openStudentSubmission: (assignmentId: string) =>
    request('POST', '/student/submissions', { assignmentId }),
  saveStudentScript: (submissionId: string, data: any) =>
    request('PATCH', `/student/submissions/${submissionId}/scripts`, data),
  finalSubmitStudent: (submissionId: string) =>
    request('POST', `/student/submissions/${submissionId}/submit`),
  getStudentSubmission: (id: string) => request('GET', `/student/submissions/${id}`),
  assignPaperToClass: (paperId: string, data: any) => request('POST', `/papers/${paperId}/assign`, data),

  // review queue (admin / head_teacher)
  listReviewItems: (params: any = {}) => request('GET', `/review/items${qs(params)}`),
  getReviewItem: (id: string) => request('GET', `/review/items/${id}`),
  updateReviewItem: (id: string, data: any) => request('PATCH', `/review/items/${id}`, data),
  approveReviewItem: (id: string) => request('POST', `/review/items/${id}/approve`),
  rejectReviewItem: (id: string, reason?: string) =>
    request('POST', `/review/items/${id}/reject`, { reason }),
  pageImageUrl: (sourceFileId: string, pageNo: number) =>
    `${BASE}/api/source-files/${sourceFileId}/pages/${pageNo}.png`,

  // ============================================================
  // Path-B endpoints
  // ============================================================

  // marker workflow (admin / head_teacher / teacher)
  markerQueue: (params: any = {}) => request('GET', `/marker/queue${qs(params)}`),
  markerSubmission: (id: string) => request('GET', `/marker/submissions/${id}`),
  markerClaim: (submissionId: string) => request('POST', '/marker/claim', { submissionId }),
  markerRelease: (submissionId: string) => request('POST', '/marker/release', { submissionId }),
  markerScoreScript: (scriptId: string, data: { awardedMarks: number; markerComment?: string | null }) =>
    request('PATCH', `/marker/scripts/${scriptId}`, data),
  markerFinalize: (submissionId: string) => request('POST', `/marker/finalize/${submissionId}`),

  // analytics (teacher / admin)
  classOverview: (classId: string) => request('GET', `/analytics/class/${classId}/overview`),
  paperWrongAnswers: (paperId: string) => request('GET', `/analytics/paper/${paperId}/wrong-answers`),
  classTopicMastery: (classId: string, paperId?: string) =>
    request('GET', `/analytics/class/${classId}/topic-mastery${paperId ? `?paperId=${encodeURIComponent(paperId)}` : ''}`),
  studentHistory: (studentId: string) => request('GET', `/analytics/student/${studentId}/history`),

  // quality feedback (admin / teacher)
  qualityLogSignal: (questionId: string, data: { signalType: string; meta?: any }) =>
    request('POST', `/quality/question/${questionId}/signal`, data),
  qualityQuestionScore: (questionId: string) => request('GET', `/quality/question/${questionId}/score`),
  qualityTopicLeaderboard: (topicId: string, limit?: number) =>
    request('GET', `/quality/topic/${topicId}/leaderboard${limit ? `?limit=${limit}` : ''}`),
  qualityAiPromptSuggestions: (topicId: string) =>
    request('GET', `/quality/ai-prompt-suggestions?topicId=${encodeURIComponent(topicId)}`),

  // perf-routing (teacher / admin)
  perfWeakTopics: (classId: string, subjectId?: string, limit?: number) =>
    request('GET', `/perf-routing/class/${classId}/weak-topics${qs({ subjectId, limit })}`),
  perfPreviewPrompt: (data: { classId: string; subjectId?: string; basePrompt: string; limit?: number }) =>
    request('POST', '/perf-routing/preview-prompt', data),

  // admin syllabus (admin only)
  adminCreateExamBoard: (data: { code: string; name: string }) =>
    request('POST', '/admin-syllabus/exam-boards', data),
  adminCreateSubject: (data: { examBoardId: string; code: string; name: string; level: string }) =>
    request('POST', '/admin-syllabus/subjects', data),
  adminCreateComponent: (data: { subjectId: string; code: string; name: string }) =>
    request('POST', '/admin-syllabus/components', data),
  adminCreateTopic: (data: any) => request('POST', '/admin-syllabus/topics', data),
  adminUpdateTopic: (id: string, data: any) => request('PATCH', `/admin-syllabus/topics/${id}`, data),
  adminDeleteTopic: (id: string) => request('DELETE', `/admin-syllabus/topics/${id}`),
  adminImportSyllabus: (data: any) => request('POST', '/admin-syllabus/import', data),
  // Fix #15: full CRUD for board / subject / component
  adminUpdateExamBoard: (id: string, data: any) => request('PATCH', `/admin-syllabus/exam-boards/${id}`, data),
  adminDeleteExamBoard: (id: string) => request('DELETE', `/admin-syllabus/exam-boards/${id}`),
  adminUpdateSubject: (id: string, data: any) => request('PATCH', `/admin-syllabus/subjects/${id}`, data),
  adminDeleteSubject: (id: string) => request('DELETE', `/admin-syllabus/subjects/${id}`),
  adminUpdateComponent: (id: string, data: any) => request('PATCH', `/admin-syllabus/components/${id}`, data),
  adminDeleteComponent: (id: string) => request('DELETE', `/admin-syllabus/components/${id}`),

  // admin cleanup (admin only) — Fix #2 + #5
  adminFixReplacementChars: () => request('POST', '/admin-cleanup/fix-replacement-chars'),
  adminPurgeTestData: (dryRun: boolean) => request('POST', '/admin-cleanup/purge-test-data', { dryRun }),

  // admin cost dashboard (admin only)
  costSummary: (from?: string, to?: string) => request('GET', `/admin-cost/summary${qs({ from, to })}`),
  costByUser: (from?: string, to?: string) => request('GET', `/admin-cost/by-user${qs({ from, to })}`),
  costByDay: (days?: number) => request('GET', `/admin-cost/by-day${qs({ days })}`),

  // admin RBAC (admin only)
  listAdminUsers: (params: any = {}) => request('GET', `/admin-rbac/users${qs(params)}`),
  updateAdminUser: (id: string, data: any) => request('PATCH', `/admin-rbac/users/${id}`, data),
  resetUserPassword: (id: string, newPassword: string) =>
    request('POST', `/admin-rbac/users/${id}/reset-password`, { newPassword }),

  // paper variants
  generatePaperVariants: (data: { assignmentId: string; mode: 'shuffle_options' | 'shuffle_questions' | 'both' }) =>
    request('POST', '/paper-variants/generate-for-class', data),
  listPaperVariantsForAssignment: (assignmentId: string) =>
    request('GET', `/paper-variants/assignment/${assignmentId}`),
  getPaperVariantForStudent: (studentId: string, assignmentId: string) =>
    request('GET', `/paper-variants/student/${studentId}/assignment/${assignmentId}`),

  // wechat-notify (admin only)
  listNotifyConfigs: () => request('GET', '/wechat-notify/configs'),
  createNotifyConfig: (data: any) => request('POST', '/wechat-notify/configs', data),
  updateNotifyConfig: (id: string, data: any) => request('PATCH', `/wechat-notify/configs/${id}`, data),
  testNotifyConfig: (configId: string) => request('POST', `/wechat-notify/test/${configId}`),
  listNotifyLogs: (params: { event?: string; since?: string; limit?: number } = {}) =>
    request('GET', `/wechat-notify/logs${qs(params)}`),

  // codegrader
  listCodeTestCases: (questionId: string) => request('GET', `/codegrader/questions/${questionId}/test-cases`),
  addCodeTestCase: (questionId: string, data: any) =>
    request('POST', `/codegrader/questions/${questionId}/test-cases`, data),
  deleteCodeTestCase: (id: string) => request('DELETE', `/codegrader/test-cases/${id}`),
  submitCode: (data: { paperQuestionId: string; language: string; sourceCode: string }) =>
    request('POST', '/codegrader/submit', data),
  getCodeResult: (scriptId: string) => request('GET', `/codegrader/result/${scriptId}`),

  // ai tutor (B9 — student/admin)
  createTutorSession: (data: { submissionId?: string; paperQuestionId?: string }) =>
    request('POST', '/ai-tutor/sessions', data),
  getTutorSession: (id: string) => request('GET', `/ai-tutor/sessions/${id}`),
  sendTutorMessage: (sessionId: string, content: string) =>
    request('POST', `/ai-tutor/sessions/${sessionId}/messages`, { content }),
  tutorUsage: (params: { from?: string; to?: string } = {}) =>
    request('GET', `/ai-tutor/usage${qs(params)}`),

  // watermark (teacher to issue + download; admin to lookup/revoke)
  watermarkIssue: (paperId: string, studentId: string) =>
    request('POST', `/watermark/papers/${paperId}/student/${studentId}/token`),
  watermarkLookup: (token: string) => request('GET', `/watermark/lookup?token=${encodeURIComponent(token)}`),
  watermarkRevoke: (tokenId: string) => request('POST', `/watermark/tokens/${tokenId}/revoke`),
  watermarkDownloadUrl: (token: string) => `${BASE}/api/watermark/download?token=${encodeURIComponent(token)}`,

  // practice browser (past-paper drill page)
  practiceTopics: (syllabusCode = '9618') =>
    request('GET', `/practice/topics?syllabusCode=${syllabusCode}`),
  practiceQuestions: (params: any = {}) => request('GET', `/practice/questions${qs(params)}`),
  practiceUpdateTopic: (id: string, topicCode: string | null) =>
    request('PATCH', `/practice/questions/${id}/topic`, { topicCode }),
  sourcePageImageUrl: (sourceFileId: string, pageNo: number) =>
    `${BASE}/api/source-files/${sourceFileId}/pages/${pageNo}.png`,

  // ── Morning attendance + quiz ──
  qrCurrent: (params: { classId?: string; sessionId?: string }) =>
    request('GET', `/qr/current${qs(params)}`),
  /** Public roster fetch — gated by school WiFi + valid QR token. */
  attendanceScanRoster: (qrToken: string) =>
    request('GET', `/attendance/scan-roster?qrToken=${encodeURIComponent(qrToken)}`),
  // deviceUuid is required by the backend schema (Round 1 critical fix —
  // without it a single device can sign in 30 students). Type signature
  // tightened so a future caller can't silently drop the field and fail
  // at runtime with a 400.
  // R10 multi-level: optional `sessionIdOverride` lets the scan page
  // pick which (class+day+level) sibling session the student wants when
  // the projector shows ONE QR for the whole class. Server validates
  // the override is in the same (classId, date) family before honouring.
  attendanceScan: (
    qrToken: string,
    studentName: string,
    deviceUuid: string,
    sessionIdOverride?: string,
  ) =>
    request('POST', '/attendance/scan', {
      qrToken,
      studentName,
      deviceUuid,
      ...(sessionIdOverride ? { sessionIdOverride } : {}),
    }),
  attendanceCorrect: (body: {
    sessionId: string;
    studentId: string;
    status: 'on_time' | 'late' | 'absent';
    note?: string;
  }) => request('POST', '/attendance/correct', body),
  attendanceHistory: (params: { classId: string; from?: string; to?: string }) =>
    request('GET', `/attendance/history${qs(params)}`),
  morningQuizSession: (sessionId: string) =>
    request('GET', `/morning-quiz/sessions/${sessionId}`),
  morningQuizSaveAnswer: (
    sessionId: string,
    body: { paperQuestionId: string; selectedOption?: string | null; textAnswer?: string | null },
  ) => request('PATCH', `/morning-quiz/sessions/${sessionId}/answer`, body),
  morningQuizSubmit: (sessionId: string) =>
    request('POST', `/morning-quiz/sessions/${sessionId}/submit`),
  // F3 — student result page payload. Server enforces "submitted-or-window-
  // closed" gate; pre-submit calls return 403 result_locked_until_submit.
  morningQuizStudentResult: (sessionId: string) =>
    request('GET', `/morning-quiz/student-result/${sessionId}`),
  // F1 — teacher today/digest payload.
  teacherTodoToday: (format?: 'json' | 'digest') =>
    request('GET', `/teacher/todo/today${format === 'digest' ? '?format=digest' : ''}`),
  // F4 — per-student weakness profile (last 30 days, by Question.tag).
  studentWeaknessProfile: (studentId: string) =>
    request('GET', `/students/${studentId}/weakness-profile`),
  // F5 — set or clear per-class weeklyFocus.
  classUpdate: (id: string, body: { weeklyFocus?: string | null }) =>
    request('PATCH', `/classes/${id}`, body),
  morningQuizDashboard: (sessionId: string) =>
    request('GET', `/morning-quiz/sessions/${sessionId}/dashboard`),
  /** Re-run auto-grading on a session — used to recover scores when the
   *  grader was broken at lock time. Returns counts of submissions /
   *  scripts updated and net autoScore delta. */
  morningQuizRegradeSession: (sessionId: string) =>
    request('POST', `/morning-quiz/sessions/${sessionId}/regrade`),
  /** Admin: delete all sessions/papers based on retired content banks
   *  (cambridge_0510). Cleans up old test-period pollution. */
  morningQuizCleanupRetired: () =>
    request('POST', '/morning-quiz/admin/cleanup-retired-content'),
  /** Admin: delete sessions scheduled on non-school days (Mon/Sat/Sun).
   *  Use after updating the generator to skip these weekdays. */
  morningQuizCleanupNonSchoolDays: () =>
    request('POST', '/morning-quiz/admin/cleanup-non-school-days'),
  /** Aggregated (classId, date) dashboard — merges 1–N level sessions
   *  into a single roster. Each row carries its source sessionId + level
   *  so per-student delete still targets the correct session. */
  morningQuizClassDayDashboard: (classId: string, date: string) =>
    request('GET', `/morning-quiz/classes/${classId}/date/${date}/dashboard`),
  morningQuizScheduled: (weekStart: string) =>
    request('GET', `/morning-quiz/scheduled?weekStart=${encodeURIComponent(weekStart)}`),
  morningQuizCreateSession: (body: { date: string; classId: string; paperId: string }) =>
    request('POST', '/morning-quiz/sessions', body),
  morningQuizCancelSession: (sessionId: string, reason?: string) =>
    request('PATCH', `/morning-quiz/sessions/${sessionId}/cancel`, { reason }),
  /** DEV ONLY: requires MORNING_QUIZ_DEBUG=true on server. Forces a session
   *  into currently-active state for off-hours testing. Returns 404 when
   *  the env flag is unset, so the frontend button can stay visible without
   *  exposing a real attack surface in production. */
  morningQuizDebugActivate: (sessionId: string) =>
    request('PATCH', `/morning-quiz/sessions/${sessionId}/debug-activate`),
  /** Inverse of debug-activate — recompute 08:30 windows + status →
   *  scheduled. Used to undo a dry-run before the real morning. */
  morningQuizRevertToScheduled: (sessionId: string) =>
    request('PATCH', `/morning-quiz/sessions/${sessionId}/revert-to-scheduled`),
  /** Wipe one student's attendance + submission + scripts on one session.
   *  Used after a teacher-led dry-run with a single test student. */
  morningQuizClearStudentTestData: (sessionId: string, studentId: string) =>
    request('DELETE', `/morning-quiz/sessions/${sessionId}/student/${studentId}/test-data`),
  /** Per-submission detail for /my-history drill-in. Public, IP-gated,
   *  name-matched. */
  morningQuizHistoryDetail: (params: { submissionId: string; name: string }) =>
    request(
      'GET',
      `/morning-quiz/history-detail?submissionId=${encodeURIComponent(params.submissionId)}&name=${encodeURIComponent(params.name)}`,
    ),
  morningQuizBatchSchedule: (items: Array<{ date: string; classId: string; paperId: string }>) =>
    request('POST', '/morning-quiz/batch', { items }),
  morningQuizBatchGenerate: (body: {
    weekStart: string;
    classIds?: string[];
    questionsPerPaper?: number;
    // When true, API wipes existing sessions+papers in (weekStart..+5d) before
    // regenerating. Used after content-bank update; destructive (student
    // submissions in the window are deleted via FK cascade).
    force?: boolean;
  }) => request('POST', '/morning-quiz/batch-generate', body),
  /** Bug 2 — preview destructive impact of force-regenerate before
   *  showing the confirm() so the operator sees actual counts. */
  morningQuizBatchGenerateImpact: (params: { weekStart: string; classIds?: string[] }) =>
    request(
      'GET',
      `/morning-quiz/batch-generate/impact?weekStart=${encodeURIComponent(params.weekStart)}${
        params.classIds && params.classIds.length > 0
          ? '&classIds=' + encodeURIComponent(params.classIds.join(','))
          : ''
      }`,
    ),
  setClassEnglishLevel: (
    classId: string,
    level: 'ielts_authentic' | 'ielts_simplified' | 'olevel',
  ) => request('PATCH', `/morning-quiz/classes/${classId}/english-level`, { level }),
  // 题库健康度 — per-(class, level) totalBank / usedRecent (累计已用, kept name
  // for API back-compat) / remaining counts,
  // used by the schedule UI to flag depletion before generation.
  morningQuizBankStats: (classId: string): Promise<{
    classId: string;
    stats: Array<{
      level: 'ielts_authentic' | 'ielts_simplified' | 'olevel';
      totalBank: number;
      usedRecent: number;
      remaining: number;
      depleted: boolean;
    }>;
  }> => request('GET', `/morning-quiz/bank-stats?classId=${encodeURIComponent(classId)}`),
  // R10 multi-level: drop a band from a class. Existing sessions for
  // that band are NOT deleted (history preserved); only future
  // batch-generate runs stop creating new ones.
  removeClassEnglishLevel: (
    classId: string,
    level: 'ielts_authentic' | 'ielts_simplified' | 'olevel',
  ) => request('DELETE', `/morning-quiz/classes/${classId}/english-level/${level}`),
  /** Round-4 attendance Excel export. Returns a Blob the caller saves
   *  via URL.createObjectURL. */
  morningQuizExportAttendance: async (params: {
    from: string;
    to: string;
    classId?: string;
  }) => {
    const url = `/api/morning-quiz/export/attendance${qs(params)}`;
    const resp = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: token() ? { Authorization: `Bearer ${token()}` } : {},
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`export failed (${resp.status}): ${txt.slice(0, 200)}`);
    }
    return resp.blob();
  },
  /** Round-4 server-authoritative practice-mode check — only resolves
   *  with correctness data once the submission is locked. */
  morningQuizCheck: (
    sessionId: string,
    body: { paperQuestionId: string; selectedOption?: string | null; textAnswer?: string | null },
  ) => request('POST', `/morning-quiz/sessions/${sessionId}/check`, body),
  morningQuizAbsenceAlertsCurrent: () =>
    request('GET', '/morning-quiz/absence-alerts/current'),
  morningQuizAiGradeShortAnswer: (body: {
    stem: string;
    studentAnswer: string;
    markScheme: string;
    maxMarks: number;
  }) => request('POST', '/morning-quiz/ai-grade/short-answer', body),

  // ── AI QA review (morning-quiz IELTS papers) ──────────────────────
  qaReviewPending: () => request('GET', '/morning-quiz-qa/pending'),
  qaReviewDetail: (paperId: string) =>
    request('GET', `/morning-quiz-qa/papers/${paperId}`),
  qaReviewRerun: (paperId: string, strict = false) =>
    request('POST', `/morning-quiz-qa/papers/${paperId}/review`, { strict }),
  qaReviewApprove: (paperId: string) =>
    request('POST', `/morning-quiz-qa/papers/${paperId}/approve`),
  qaReviewTeacherReject: (paperId: string, reason?: string) =>
    request('POST', `/morning-quiz-qa/papers/${paperId}/teacher-reject`, { reason }),
  // U6 — batch action across multiple papers in one transaction.
  qaReviewBatch: (
    action: 'approve' | 'reject' | 'rerun',
    paperIds: string[],
    reason?: string,
    strict?: boolean,
  ) =>
    request('POST', '/morning-quiz-qa/batch', { action, paperIds, reason, strict }),
};

function qs(obj: Record<string, any>) {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

export function downloadPdf(url: string, filename: string) {
  fetch(url, {
    headers: token() ? { Authorization: `Bearer ${token()}` } : undefined,
  })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    });
}
