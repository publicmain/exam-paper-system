/**
 * Student-side API wrappers.
 *
 * Why a separate file: lib/api.ts is owned by FE-Admin in the Wave-2 split.
 * The student-side public endpoints (no JWT, IP-gated, name-matched) bolt
 * on cleanly without touching that file. Reuses BASE from api.ts so the
 * dev / prod URL switch stays single-sourced.
 *
 * Every helper here calls a public endpoint (no Authorization header).
 * Graceful degradation: on 404 (endpoint not deployed yet) the helper
 * returns null so the UI can hide the affordance instead of crashing.
 */
import { BASE } from './api';

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  // 404 — endpoint not deployed yet. Return null so the caller can hide
  // the new affordance gracefully without crashing the page.
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    let friendly = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.message === 'string') friendly = parsed.message;
      else if (Array.isArray(parsed?.message)) friendly = parsed.message.join('; ');
    } catch {
      /* not JSON */
    }
    throw new Error(friendly || `${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json() as Promise<T>;
  return (await res.text()) as any;
}

function qs(obj: Record<string, any>): string {
  const entries = Object.entries(obj).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

// ─────────────────────────────────────────────────────────────────────
// Upcoming sessions for a student name (F2)
// ─────────────────────────────────────────────────────────────────────
export interface UpcomingSession {
  sessionId: string;
  classId: string;
  className: string;
  level: string | null;
  attendanceStart: string;
  quizStart: string;
  quizEnd: string;
  paperName: string;
  status: string;
}

export interface UpcomingForNameResponse {
  student: { name: string };
  upcoming: UpcomingSession[];
}

export interface UpcomingDisambigResponse {
  needDisambiguation: true;
  candidates: Array<{
    studentId: string;
    name: string;
    classes: Array<{ id: string; name: string; classCode: string }>;
  }>;
}

export type UpcomingResponse = UpcomingForNameResponse | UpcomingDisambigResponse;

export async function fetchUpcomingForName(params: {
  name: string;
  studentId?: string;
}): Promise<UpcomingResponse | null> {
  return publicFetch<UpcomingResponse>(
    `/api/morning-quiz/upcoming-for-name${qs(params)}`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// Appeals (F10)
// ─────────────────────────────────────────────────────────────────────
export interface AppealBody {
  submissionId: string;
  /** Omit for whole-paper appeals. */
  paperQuestionId?: string;
  message: string;
  studentName: string;
  studentId?: string;
}

export async function submitAppeal(body: AppealBody): Promise<{ id?: string } | null> {
  return publicFetch<{ id?: string }>('/api/morning-quiz/appeals', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ─────────────────────────────────────────────────────────────────────
// Practice mode (F16)
// ─────────────────────────────────────────────────────────────────────
export interface PracticeCreateResponse {
  practiceSubmissionId: string;
  paperId: string;
}

export async function createPracticeClone(
  submissionId: string,
  body: { studentName: string; studentId?: string },
): Promise<PracticeCreateResponse | null> {
  return publicFetch<PracticeCreateResponse>(
    `/api/morning-quiz/practice/${encodeURIComponent(submissionId)}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export interface PracticeSubmissionView {
  practiceSubmissionId: string;
  paperId: string;
  paperName: string;
  level: 'ielts_authentic' | 'ielts_simplified' | 'olevel' | null;
  paperMode: 'passage_pick' | 'standard' | null;
  quizEnd?: string | null;
  paperQuestions: Array<{
    id: string;
    sortOrder: number;
    marks: number;
    questionType: 'mcq' | 'short_answer' | 'structured' | 'essay';
    snapshotContent: any;
    snapshotOptions: Array<{ key: string; text: string }> | null;
  }>;
  existingAnswers?: Record<
    string,
    { content?: string; selectedOption?: string; textAnswer?: string; flagged?: boolean }
  >;
  /** R15-followup-7: present when the student already submitted this
   *  practice. The PracticeResultView is rendered directly so they can
   *  review without re-submitting. */
  alreadySubmitted?: boolean;
  autoScore?: number | null;
  maxScore?: number | null;
  perQuestion?: PracticeSubmitResult['perQuestion'] | null;
}

export async function fetchPracticeSubmission(
  practiceSubmissionId: string,
  params: { studentName: string; studentId?: string },
): Promise<PracticeSubmissionView | null> {
  // R15-followup — the GET practice endpoint reads `?name=` (matches
  // history-by-name's param convention). Rename the FE query field so
  // it lines up. Previously sent `?studentName=` → 400 name_required.
  const queryParams: Record<string, string | undefined> = {
    name: params.studentName,
    studentId: params.studentId,
  };
  return publicFetch<PracticeSubmissionView>(
    `/api/morning-quiz/practice/${encodeURIComponent(practiceSubmissionId)}${qs(queryParams)}`,
  );
}

export interface PracticeSubmitResult {
  autoScore: number;
  maxScore: number;
  perQuestion: Array<{
    paperQuestionId: string;
    sortOrder?: number;
    isCorrect: boolean | null;
    awardedMarks: number | null;
    marks: number;
    studentAnswer: string | null;
    correctAnswer: string | null;
    explanation?: string | null;
  }>;
}

/**
 * R15-followup — server expects:
 *   { studentName, studentId?, answers: Array<{paperQuestionId, selectedOption?, textAnswer?}> }
 *
 * The old shape `{ answers: Record<qid, {…}> }` produced
 * `400 {"answers":["Expected array, received object"], "studentName":["Required"]}`
 * caught while doing the OLEVEL multi-passage E2E student walkthrough.
 */
export async function submitPractice(
  practiceSubmissionId: string,
  body: {
    studentName: string;
    studentId?: string;
    answers: Record<string, { selectedOption?: string | null; textAnswer?: string | null }>;
  },
): Promise<PracticeSubmitResult | null> {
  const payload = {
    studentName: body.studentName,
    studentId: body.studentId,
    answers: Object.entries(body.answers).map(([paperQuestionId, a]) => ({
      paperQuestionId,
      selectedOption: a.selectedOption ?? null,
      textAnswer: a.textAnswer ?? null,
    })),
  };
  return publicFetch<PracticeSubmitResult>(
    `/api/morning-quiz/practice/${encodeURIComponent(practiceSubmissionId)}/submit`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

// ─────────────────────────────────────────────────────────────────────
// Score trend (F17)
// ─────────────────────────────────────────────────────────────────────
export interface TrendWeek {
  weekStart: string;
  level: string;
  avgPct: number;
  submissionCount: number;
}

export interface TrendResponse {
  weeks: TrendWeek[];
}

export async function fetchTrend(params: {
  name: string;
  studentId?: string;
  weeks?: number;
}): Promise<TrendResponse | null> {
  return publicFetch<TrendResponse>(
    `/api/morning-quiz/history-by-name/trend${qs(params)}`,
  );
}
