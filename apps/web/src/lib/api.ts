import { authErrorHint } from './student-token';
import { teacherViewToken } from './teacher-view';

export const BASE = (import.meta as any).env?.VITE_API_URL || '';

/** 英语等级。与后端 prisma enum + level-registry.ts 一一对应。
 *  加等级时改这一处即可 —— 原来四个签名各写一遍三值联合，
 *  2026-08-24 加两层时全部漏改，靠 tsc 才发现。 */
export type EnglishLevel =
  | 'ielts_authentic'
  | 'ielts_light'
  | 'olevel'
  | 'olevel_intermediate'
  | 'ielts_simplified';

function token(): string | null {
  // 教师的「学生视角」令牌优先，且只在**开着它的那个标签页**里生效
  // （sessionStorage 每标签页独立）。教师原来的管理标签页不受影响，
  // 不会被自己挤下线。详见 lib/teacher-view.ts。
  const view = teacherViewToken();
  if (view) return view;
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
    let parsedBody: any = null;
    try {
      const parsed = JSON.parse(text);
      parsedBody = parsed;
      if (parsed && typeof parsed.message === 'string') friendly = parsed.message;
      else if (Array.isArray(parsed?.message)) friendly = parsed.message.join('; ');
    } catch {
      /* not JSON, fall through to raw text */
    }
    // 学生 token 被作废/缺失/对不上号 —— 给一句「去重新登录」而不是
    // 让学生对着 Forbidden 反复重试（2026-08-25 复审 P0-2）。
    // token_revoked 还会顺手清掉本地那张废票。
    if (res.status === 403 && parsedBody) {
      const hint = authErrorHint(parsedBody?.code ?? parsedBody?.message?.code);
      if (hint) friendly = hint;
    }
    // 结构化错误体挂在 err.body 上 —— student_not_found 的相近姓名建议
    // （suggestions）之类的字段要能到达页面，只给 message 会把它们丢掉。
    const err: any = new Error(friendly || `${method} ${path} failed: ${res.status}`);
    err.body = parsedBody;
    err.status = res.status;
    throw err;
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
  chatPaper: (data: { syllabusCode: string; message: string; classLabel?: string }) =>
    request('POST', '/ai/chat-paper', data),

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
    request('GET', `/qr/current${qs(params)}&_=${Date.now()}`),
  /** Permanent printable QR token for a class — print once, no laptop. */
  qrStatic: (classId: string, variant?: string) =>
    request<{ classId: string; className: string; token: string }>(
      'GET',
      `/qr/static?classId=${encodeURIComponent(classId)}` +
        (variant ? `&variant=${encodeURIComponent(variant)}` : ''),
    ),
  /** Public roster fetch — gated by a valid QR token. The `_` cache-buster
   *  makes every request URL unique so a 410 (session_not_active) cached
   *  before the window opened can never be replayed from the browser /
   *  service-worker cache against the static v2 QR (r15-followup-31). */
  attendanceScanRoster: (qrToken: string) =>
    request('GET', `/attendance/scan-roster?qrToken=${encodeURIComponent(qrToken)}&_=${Date.now()}`),
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
  // final=false 是「暂存提交」：下午 16:00-17:30 还能回来改，在此之前
  // 看不到答案。省略 = 最终提交（公布答案、放弃续答）。
  morningQuizSubmit: (sessionId: string, opts?: { final?: boolean }) =>
    request('POST', `/morning-quiz/sessions/${sessionId}/submit`, {
      final: opts?.final !== false,
    }),
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
  // 2.0 技能诊断 —— 按题型看班级失分点
  morningQuizClassSkillProfile: (classId: string, days = 30) =>
    request('GET', `/morning-quiz/classes/${classId}/skill-profile?days=${days}`),
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
  /** 生词本 P1 — 点词查义。本地词典，零 AI 调用。查不到返回 {found:false}。 */
  vocabLookup: (word: string) =>
    request('GET', `/vocab/lookup?word=${encodeURIComponent(word)}`),
  /** 生词本 P2 — 我的生词本 */
  vocabList: (p: { name: string; studentId?: string }) =>
    request(
      'GET',
      `/vocab/words?name=${encodeURIComponent(p.name)}${p.studentId ? `&studentId=${encodeURIComponent(p.studentId)}` : ''}`,
    ),
  vocabAdd: (body: {
    studentName: string;
    studentId?: string;
    word: string;
    contextSentence?: string;
    sourcePaperQuestionId?: string;
    sourcePassageTitle?: string;
  }) => request('POST', '/vocab/words', body),
  vocabRemove: (body: { studentName: string; studentId?: string; headword: string }) =>
    request('POST', '/vocab/words/remove', body),
  /** 生词本 P3 — 今日待复习卡片 */
  vocabDue: (p: { name: string; studentId?: string; limit?: number }) =>
    request(
      'GET',
      '/vocab/due?name=' +
        encodeURIComponent(p.name) +
        (p.studentId ? '&studentId=' + encodeURIComponent(p.studentId) : '') +
        (p.limit ? '&limit=' + p.limit : ''),
    ),
  /** 生词本 P3 — 提交复习评分，服务端用 FSRS 重新调度 */
  vocabReview: (body: {
    studentName: string;
    studentId?: string;
    headword: string;
    rating: string;
    elapsedMs?: number;
    /** 弱网重发去重用；由 lib/reviewQueue 生成 */
    requestId?: string;
  }) => request('POST', '/vocab/review', body),
  /** 学生 PIN 登录（2026-08-25，docs/PRD/student-auth-and-home.md） */
  studentLogin: (body: { name: string; studentId?: string; pin: string }) =>
    request('POST', '/student-auth/login', body),
  /** 网站式注册（2026-08-26）：首次设密码即注册即登录 */
  studentRegister: (body: {
    name: string;
    studentId?: string;
    password: string;
    nickname?: string;
    avatar?: string;
  }) => request('POST', '/student-auth/register', body),
  studentChangePin: (body: { oldPin: string; newPin: string }) =>
    request('POST', '/student-auth/change-pin', body),
  studentAuthMe: () => request('GET', '/student-auth/me'),
  // ── 4.0 每日一课（阶段 A，影子运行）──
  /** 学生：今天的课。**这个调用会冻结当日目标**（首次） */
  /**
   * P8 —— **命令**：开始或恢复今天的课。
   *
   * 只有课程页调它。它会创建当日任务行、把进度与阶段对齐、把新到期的词
   * 并进任务队列。成绩页、总结页、教师看板一律用下面的 lessonToday（纯读）。
   */
  lessonStart: (name: string, studentId?: string) =>
    request('POST', '/lesson/start', { name, ...(studentId ? { studentId } : {}) }),
  /** **查询**：今天的课。纯读取，不写任何东西。 */
  lessonToday: (name: string, studentId?: string) =>
    request(
      'GET',
      `/lesson/today?name=${encodeURIComponent(name)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`,
    ),
  /** 学生：上报翻卡断点（P3 退出恢复） */
  lessonVocabCursor: (name: string, cursor: number, studentId?: string) =>
    request('POST', '/lesson/vocab-cursor', { name, cursor, studentId }),
  /** 教师：班级完成度看板（不冻结目标） */
  lessonBoard: (classId: string, date?: string) =>
    request(
      'GET',
      `/lesson/class?classId=${encodeURIComponent(classId)}${date ? `&date=${date}` : ''}`,
    ),

  /** 教师端：改学生英语难度（P4 —— 唯一能改写已落定难度的路径）。
   *  level=null 清空，退回「下次扫码现选」。只影响后续内容选择，
   *  历史答卷 / 成绩 / 已建场次一律不动。 */
  setStudentEnglishLevel: (studentId: string, level: string | null) =>
    request('PATCH', `/admin/users/${encodeURIComponent(studentId)}/english-level`, { level }),

  /** 教师端：重置学生 PIN（忘记时的恢复通道） */
  adminResetStudentPin: (studentId: string) =>
    request('POST', '/student-auth/admin/reset-pin', { studentId }),

  // ── 教师端：集体注册窗口（2026-08-25）──
  /** 花名册：谁领了 PIN、谁没领、窗口开着没 */
  claimStatus: (
    classId: string,
  ): Promise<{
    classId: string;
    className: string;
    windowOpen: boolean;
    windowOpenUntil: string | null;
    total: number;
    claimed: number;
    unclaimed: number;
    students: {
      id: string;
      name: string;
      claimed: boolean;
      claimedAt: string | null;
      locked: boolean;
      personalWindowOpen: boolean;
    }[];
  }> => request('GET', `/student-auth/admin/claim-status?classId=${encodeURIComponent(classId)}`),
  /** 教师端：签发「以学生视角查看」的只读令牌（15 分钟） */
  studentViewToken: (
    studentId: string,
  ): Promise<{
    token: string;
    student: { id: string; name: string };
    expiresInSec: number;
    readOnly: true;
  }> => request('POST', '/student-auth/admin/view-token', { studentId }),

  /** 生词本 — 撤销该词最近一次评分（10 分钟内，误触防线） */
  /**
   * P5 收尾 —— 教学卡「下一个」：**一次调用**，服务端在事务里标记
   * 「教过」+ 单调推进断点，返回真实 cursor 与 stage。
   *
   * 取代原来分别打 first-taught 与 vocab-cursor 的两步 —— 那两步之间有
   * 「cursor 前进了但 firstTaughtAt 没写上」的窗口，会把 stage 永久锁死。
   */
  lessonVocabTaught: (body: {
    studentName: string;
    studentId?: string;
    headword: string;
    cursor: number;
  }): Promise<{ ok: true; cursor: number; stage: string; alreadyTaught: boolean }> =>
    request('POST', '/lesson/vocab-taught', {
      name: body.studentName,
      ...(body.studentId ? { studentId: body.studentId } : {}),
      headword: body.headword,
      cursor: body.cursor,
    }),

  // ── P6 · 正式单词测试（有成绩）──
  //
  // 与自测的区别不在页面，在于它有一份 VocabQuizAttempt：一个任务日
  // 一份、题目创建时快照冻结、提交后落分。四个端点都要学生令牌。
  /** 开始或恢复当日正式测试。幂等 —— 已有就原样返回。 */
  vocabQuizStart: (body: { studentName: string; studentId?: string }) =>
    request('POST', '/vocab/quiz/attempt/start', {
      name: body.studentName,
      ...(body.studentId ? { studentId: body.studentId } : {}),
    }),
  /** 回读当日测试（刷新 / 重新登录后恢复）。 */
  vocabQuizCurrent: (name: string, studentId?: string) =>
    request(
      'GET',
      `/vocab/quiz/attempt/current?name=${encodeURIComponent(name)}` +
        (studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''),
    ),
  /** 记一题的作答。第一次作答为准，重复提交 no-op。**不写 FSRS**。 */
  vocabQuizAnswer: (body: {
    studentName: string;
    studentId?: string;
    index: number;
    optionIndex?: number;
    text?: string;
  }) =>
    request('POST', '/vocab/quiz/attempt/answer', {
      name: body.studentName,
      ...(body.studentId ? { studentId: body.studentId } : {}),
      index: body.index,
      ...(body.optionIndex !== undefined ? { optionIndex: body.optionIndex } : {}),
      ...(body.text !== undefined ? { text: body.text } : {}),
    }),
  /** 提交。幂等 —— 双击 / 重试只有一份成绩。 */
  vocabQuizSubmit: (body: { studentName: string; studentId?: string }) =>
    request('POST', '/vocab/quiz/attempt/submit', {
      name: body.studentName,
      ...(body.studentId ? { studentId: body.studentId } : {}),
    }),
  /** 历史成绩（只读）。 */
  vocabQuizAttempts: (name: string, studentId?: string) =>
    request(
      'GET',
      `/vocab/quiz/attempts?name=${encodeURIComponent(name)}` +
        (studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''),
    ),

  vocabReviewUndo: (body: { studentName: string; studentId?: string; headword: string }) =>
    request('POST', '/vocab/review/undo', body),
  /** 错题本 P6 — 我的错题（收录门槛在服务端，不是每道错题都进） */
  mistakeList: (p: { name: string; studentId?: string; includeResolved?: boolean }) =>
    request('GET', '/vocab/mistakes?name=' + encodeURIComponent(p.name) +
      (p.studentId ? '&studentId=' + encodeURIComponent(p.studentId) : '') +
      (p.includeResolved ? '&includeResolved=1' : '')),
  /** 错题本 P6 — 标记已弄懂 / 撤销 */
  mistakeResolve: (body: { studentName: string; studentId?: string; id: string; resolved: boolean }) =>
    request('POST', '/vocab/mistakes/resolve', body),
  /** 错题重练 — 今日队列（带原文和选项，最多 10 道） */
  mistakePracticeQueue: (p: { name: string; studentId?: string }) =>
    request('GET', '/vocab/mistakes/practice-queue?name=' + encodeURIComponent(p.name) +
      (p.studentId ? '&studentId=' + encodeURIComponent(p.studentId) : '')),
  /** 错题重练 — 上报一次结果（隔天两次做对自动销账） */
  mistakePracticeResult: (body: { studentName: string; studentId?: string; id: string; correct: boolean }) =>
    request('POST', '/vocab/mistakes/practice-result', body),
  /** P6 埋点 — 记录学生打开了哪类自助页（失败静默，绝不阻断） */
  recordPageView: (body: { studentName: string; studentId?: string; kind: string }) =>
    request('POST', '/vocab/page-view', body).catch(() => null),
  /** 生词本 P5 — 自测出题（百词斩式选择题，出题纯本地计算） */
  vocabQuiz: (p: { name: string; studentId?: string; limit?: number }) =>
    request(
      'GET',
      '/vocab/quiz?name=' +
        encodeURIComponent(p.name) +
        (p.studentId ? '&studentId=' + encodeURIComponent(p.studentId) : '') +
        (p.limit ? '&limit=' + p.limit : ''),
    ),
  /** 生词本 P4 教师端 — 班级高频生词 / 推词 / 班级统计 */
  vocabClassTop: (classId: string, p?: { days?: number; limit?: number }) =>
    request(
      'GET',
      '/vocab/class/' + encodeURIComponent(classId) + '/top' +
        (p?.days ? '?days=' + p.days : '?days=30') +
        (p?.limit ? '&limit=' + p.limit : ''),
    ),
  vocabClassStats: (classId: string) =>
    request('GET', '/vocab/class/' + encodeURIComponent(classId) + '/stats'),
  vocabPush: (body: { classId: string; words: string[]; contextSentence?: string }) =>
    request('POST', '/vocab/push', body),
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
    level: EnglishLevel,
  ) => request('PATCH', `/morning-quiz/classes/${classId}/english-level`, { level }),
  // 题库健康度 — per-(class, level) totalBank / usedRecent (累计已用, kept name
  // for API back-compat) / remaining counts,
  // used by the schedule UI to flag depletion before generation.
  morningQuizBankStats: (classId: string): Promise<{
    classId: string;
    stats: Array<{
      level: EnglishLevel;
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
    level: EnglishLevel,
  ) => request('DELETE', `/morning-quiz/classes/${classId}/english-level/${level}`),
  /** Round-4 attendance Excel export. Returns a Blob the caller saves
   *  via URL.createObjectURL.
   *
   *  R15-followup-14 — was hitting `/api/morning-quiz/export/attendance`
   *  RELATIVE TO THE FRONTEND ORIGIN. In dev that worked because Vite's
   *  proxy forwarded /api/* to the local Nest server. In prod the
   *  frontend is on `nurturing-radiance-production.up.railway.app`
   *  and the API is on `exam-paper-system-production.up.railway.app` —
   *  there is no /api/* proxy on the frontend host. The fetch resolved
   *  to the SPA index.html (200 OK, content-type text/html), the code
   *  blindly handed it to URL.createObjectURL + a.download with the
   *  .xlsx extension, and Excel rejected the HTML body as a corrupt
   *  workbook ("file format or file extension is not valid").
   *
   *  Fix: prepend ${BASE} so the URL points at the API host in prod,
   *  matching every other api.* helper in this file. ALSO content-type
   *  check the response so a future "200 OK but body is HTML" regression
   *  doesn't silently return a corrupt file again — surface as a clear
   *  error the caller can show. */
  morningQuizExportAttendance: async (params: {
    from: string;
    to: string;
    classId?: string;
  }) => {
    const url = `${BASE}/api/morning-quiz/export/attendance${qs(params)}`;
    const resp = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: token() ? { Authorization: `Bearer ${token()}` } : {},
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`export failed (${resp.status}): ${txt.slice(0, 200)}`);
    }
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('spreadsheet') && !ct.includes('octet-stream')) {
      const txt = await resp.text();
      throw new Error(
        `export returned wrong content-type (${ct || 'none'}). ` +
          `Body head: ${txt.slice(0, 120)}`,
      );
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

  // ============================================================
  // ROUND 14 — Feature 6, 7, 8, 9, 10, 12, 13, 15, 18 wrappers
  // (admin/teacher/marker side) + student-side wrappers used by
  // FE-Student's pages, imported from this same api.ts so both
  // sub-teams share one client surface.
  // ============================================================

  // ROUND 14 — Feature 9 (cancel + one-off sessions) — keep aliases
  // matching the contract names so admin pages can stay terse, while
  // existing callers using `morningQuizCancelSession` / `morningQuizCreateSession`
  // continue to work above.
  cancelMorningQuizSession: (sessionId: string, reason?: string) =>
    request('PATCH', `/morning-quiz/sessions/${sessionId}/cancel`, { reason }),
  createMorningQuizSession: (body: {
    classId: string;
    date: string;
    level?: EnglishLevel;
    paperId?: string;
  }) => request('POST', '/morning-quiz/sessions', body),

  // ROUND 14 — Feature 6 (soft-delete restore)
  restoreClass: (id: string) => request('POST', `/classes/${id}/restore`),
  restorePaper: (id: string) => request('POST', `/papers/${id}/restore`),
  listArchivedClasses: () => request('GET', '/classes?archived=true'),
  listArchivedPapers: () => request('GET', '/papers?archived=true'),

  // ROUND 14 — Feature 7 (bulk attendance correction)
  attendanceCorrectBulk: (body: {
    sessionId: string;
    studentIds: string[];
    status: 'on_time' | 'late' | 'absent';
    note: string;
  }): Promise<{ corrected: number; errors: Array<{ studentId: string; reason: string }> }> =>
    request('POST', '/attendance/correct-bulk', body),

  // ROUND 14 — Feature 8 (audit log viewer)
  auditList: (params: {
    action?: string;
    actorId?: string;
    entityType?: string;
    entityId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: any[]; total: number; page: number; pageSize: number }> =>
    request('GET', `/audit${qs(params)}`),

  // ROUND 14 — Feature 10 (appeal review — marker side)
  morningQuizListAppeals: (params: { status?: string; classId?: string } = {}) =>
    request('GET', `/morning-quiz/appeals${qs(params)}`),
  morningQuizResolveAppeal: (
    appealId: string,
    body: {
      accept: boolean;
      note?: string;
      scoreOverride?: number;
      paperQuestionId?: string;
    },
  ) => request('POST', `/morning-quiz/appeals/${appealId}/resolve`, body),

  // ROUND 14 — Feature 10 (appeal submit — student side, used by FE-Student)
  morningQuizSubmitAppeal: (body: {
    submissionId: string;
    paperQuestionId?: string;
    message: string;
    studentName: string;
    studentId?: string;
  }) => request('POST', '/morning-quiz/appeals', body),

  // ROUND 14 — Feature 12 (transfer / archive students)
  classTransferStudent: (body: {
    userId: string;
    fromClassId: string;
    toClassId: string;
    reason?: string;
  }) => request('POST', '/classes/transfer-student', body),
  userArchive: (userId: string, body: { reason: string }) =>
    request('POST', `/admin/users/${userId}/archive`, body),
  userUnarchive: (userId: string) =>
    request('POST', `/admin/users/${userId}/unarchive`),

  // ROUND 14 — Feature 13 (roster search). Calls the morning-quiz controller's
  // student search which substring-matches name+email (case-insensitive)
  // and filters out archived users. Unwraps {items} into a flat array.
  classEnrollmentsSearch: async (classId: string, q: string): Promise<any[]> => {
    const res: any = await request(
      'GET',
      `/morning-quiz/classes/${classId}/students/search?q=${encodeURIComponent(q)}`,
    );
    return Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
  },

  // ROUND 14 — Feature 15 (question retraction)
  paperRetractQuestion: (
    paperId: string,
    body: {
      paperQuestionId: string;
      reason: string;
      awardAllStudents: boolean;
    },
  ) => request('POST', `/morning-quiz/papers/${paperId}/retract-question`, body),

  // ROUND 14 — Feature 18 (wrong-rate display)
  paperWrongRate: (paperId: string): Promise<{
    items: Array<{
      paperQuestionId: string;
      questionOrder: number;
      stemPreview: string;
      attempted: number;
      wrong: number;
      wrongRate: number;
    }>;
  }> => request('GET', `/papers/${paperId}/wrong-rate`),

  // ROUND 14 — student-side wrappers consumed by FE-Student pages
  morningQuizUpcomingForName: (params: {
    name: string;
    studentId?: string;
  }): Promise<
    | { student: any; upcoming: any[] }
    | { needDisambiguation: true; candidates: any[] }
  > => request('GET', `/morning-quiz/upcoming-for-name${qs(params)}`),
  morningQuizPracticeClone: (
    submissionId: string,
    body: { studentName: string; studentId?: string },
  ): Promise<{ practiceSubmissionId: string; paperId: string }> =>
    request('POST', `/morning-quiz/practice/clone/${submissionId}`, body),
  morningQuizGetPractice: (
    practiceSubmissionId: string,
    params: { studentName: string; studentId?: string },
  ): Promise<{ paper: any; existingAnswers: any[] }> =>
    request(
      'GET',
      `/morning-quiz/practice/${practiceSubmissionId}${qs(params)}`,
    ),
  morningQuizSubmitPractice: (
    practiceSubmissionId: string,
    body: {
      studentName: string;
      studentId?: string;
      answers: Array<{
        paperQuestionId: string;
        selectedOption?: string | null;
        textAnswer?: string | null;
      }>;
    },
  ): Promise<{ autoScore: number; maxScore: number; perQuestion: any[] }> =>
    request('POST', `/morning-quiz/practice/${practiceSubmissionId}/submit`, body),
  morningQuizHistoryTrend: (params: {
    name: string;
    studentId?: string;
    weeks: number;
  }): Promise<{ weeks: any[] }> =>
    request('GET', `/morning-quiz/history-trend${qs(params)}`),

  // ROUND 14 — parent-link wrappers (admin creates link, parent visits URL)
  parentLinkCreate: (body: { studentId: string; parentLabel?: string }) =>
    request('POST', '/parent-links', body),
  parentLinkList: (params: { studentId?: string; includeRevoked?: boolean } = {}) =>
    request('GET', `/parent-links${qs(params)}`),
  parentLinkRevoke: (id: string) =>
    request('POST', `/parent-links/${id}/revoke`),
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
