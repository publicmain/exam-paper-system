/**
 * Homework M1 API wrappers — JWT-authenticated, separate file so the
 * FE-Admin-owned lib/api.ts stays untouched (same pattern as
 * api-student.ts). Includes the multipart helpers JSON `request` can't do.
 */
import { BASE } from './api';

function token(): string | null {
  return localStorage.getItem('auth_token');
}

async function req<T = any>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await friendlyError(res, `${method} ${path}`));
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Multipart upload. NOTE: no Content-Type header — the browser sets the
 *  boundary itself; forcing it breaks the request. */
async function upload<T = any>(path: string, field: string, files: File[]): Promise<T> {
  const fd = new FormData();
  for (const f of files) fd.append(field, f, f.name);
  const res = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
    body: fd,
  });
  if (!res.ok) throw new Error(await friendlyError(res, `upload ${path}`));
  return res.json();
}

async function friendlyError(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message)) return parsed.message.join('; ');
  } catch {
    /* not JSON */
  }
  return text || `${fallback} failed: ${res.status}`;
}

export const hwApi = {
  // teacher — courses
  listCourses: () => req('GET', '/courses'),
  createCourse: (data: { name: string; subjectId?: string }) => req('POST', '/courses', data),
  updateCourse: (id: string, data: any) => req('PATCH', `/courses/${id}`, data),

  // teacher — homework
  listHomework: (courseId: string) => req('GET', `/homework?courseId=${courseId}`),
  getHomework: (id: string) => req('GET', `/homework/${id}`),
  createHomework: (data: { courseId: string; title: string; instructions?: string; totalMarks?: number }) =>
    req('POST', '/homework', data),
  updateHomework: (id: string, data: any) => req('PATCH', `/homework/${id}`, data),
  uploadHomeworkFiles: (id: string, files: File[]) => upload(`/homework/${id}/files`, 'files', files),
  deleteHomeworkFile: (fileId: string) => req('DELETE', `/homework-files/${fileId}`),

  // teacher — assignments
  assign: (homeworkId: string, data: { classId: string; startAt?: string; dueAt?: string; allowLate?: boolean }) =>
    req('POST', `/homework/${homeworkId}/assign`, data),
  updateAssignment: (id: string, data: any) => req('PATCH', `/homework-assignments/${id}`, data),
  dashboard: (assignmentId: string) => req('GET', `/homework-assignments/${assignmentId}/dashboard`),
  getSubmission: (id: string) => req('GET', `/homework-submissions/${id}`),
  returnSubmission: (id: string, data: { teacherScore?: number; teacherComment?: string }) =>
    req('POST', `/homework-submissions/${id}/return`, data),

  // M3 — rubric + per-question grading
  setRubric: (homeworkId: string, questions: { label: string; maxMarks: number; criteria?: string }[]) =>
    req('PUT', `/homework/${homeworkId}/rubric`, { questions }),
  saveGrades: (submissionId: string, grades: { questionId: string; awardedMarks: number | null; comment?: string; appliedItems?: string[] }[]) =>
    req('PUT', `/homework-submissions/${submissionId}/grades`, { grades }),
  saveAiGrades: (submissionId: string, grades: any[]) =>
    req('PUT', `/homework-submissions/${submissionId}/ai-grades`, { grades }),
  publishGrades: (submissionId: string, teacherComment?: string) =>
    req('POST', `/homework-submissions/${submissionId}/publish`, { teacherComment }),

  // student
  myHomework: () => req('GET', '/student/homework'),
  myHomeworkDetail: (assignmentId: string) => req('GET', `/student/homework/${assignmentId}`),
  uploadPages: (assignmentId: string, files: File[]) =>
    upload(`/student/homework/${assignmentId}/pages`, 'pages', files),
  deletePage: (pageId: string) => req('DELETE', `/student/homework/pages/${pageId}`),
  reorderPages: (assignmentId: string, pageIds: string[]) =>
    req('PATCH', `/student/homework/${assignmentId}/pages/reorder`, { pageIds }),
  submitHomework: (assignmentId: string) => req('POST', `/student/homework/${assignmentId}/submit`),
  withdrawHomework: (assignmentId: string) => req('POST', `/student/homework/${assignmentId}/withdraw`),
  publishAll: (assignmentId: string) => req('POST', `/homework-assignments/${assignmentId}/publish-all`),

  // ---- v2: regions / items / annotations / vertical grading ----
  updateQuestionMeta: (questionId: string, data: any) => req('PATCH', `/homework-questions/${questionId}`, data),
  updateItemDelta: (questionId: string, itemId: string, delta: number) =>
    req('PATCH', `/homework-questions/${questionId}/items/${itemId}`, { delta }),
  saveAnnotations: (pageId: string, strokes: any[]) =>
    req('PUT', `/homework-pages/${pageId}/annotations`, { strokes }),
  byQuestion: (assignmentId: string, questionId: string) =>
    req('GET', `/homework-assignments/${assignmentId}/by-question/${questionId}`),

  // ---- v2: regrades / analytics / notifications / mistakes ----
  listRegrades: (assignmentId: string) => req('GET', `/homework-assignments/${assignmentId}/regrades`),
  replyRegrade: (requestId: string, reply: string) => req('POST', `/regrade-requests/${requestId}/reply`, { reply }),
  analytics: (assignmentId: string) => req('GET', `/homework-assignments/${assignmentId}/analytics`),
  notifications: () => req('GET', `/notifications`),
  markNotificationsRead: (ids?: string[]) => req('POST', `/notifications/read`, { ids }),
  fileRegrade: (assignmentId: string, questionId: string, message: string) =>
    req('POST', `/student/homework/${assignmentId}/regrade`, { questionId, message }),
  myRegrades: (assignmentId: string) => req('GET', `/student/homework/${assignmentId}/regrades`),
  myMistakes: () => req('GET', `/student/homework/mistakes`),

  // student — M2 handwriting (ink)
  listInk: (assignmentId: string) => req('GET', `/student/homework/${assignmentId}/ink`),
  createInkPage: (
    assignmentId: string,
    data: { width: number; height: number; backgroundFileId?: string; backgroundPage?: number },
  ) => req('POST', `/student/homework/${assignmentId}/ink`, data),
  saveInk: (pageId: string, strokes: any) => req('PUT', `/student/homework/ink/${pageId}`, { strokes }),
  deleteInkPage: (pageId: string) => req('DELETE', `/student/homework/ink/${pageId}`),
  // Flatten upload: mark the resulting HomeworkPage as source=ink.
  uploadInkFlattened: (assignmentId: string, files: File[]) =>
    upload(`/student/homework/${assignmentId}/pages?source=ink`, 'pages', files),
};

/** Authorized CSV download (JWT header, so a plain <a href> won't do). */
export async function downloadHomeworkCsv(assignmentId: string, filename: string) {
  const token = localStorage.getItem('auth_token');
  const base = (import.meta as any).env?.VITE_API_URL || '';
  const res = await fetch(`${base}/api/homework-assignments/${assignmentId}/export.csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`导出失败: ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Path helpers for AuthImage / blob viewing. */
export const hwFileContentPath = (fileId: string) => `/api/homework-files/${fileId}/content`;
export const hwPageContentPath = (pageId: string) => `/api/homework-pages/${pageId}/content`;
