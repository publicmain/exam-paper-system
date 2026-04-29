const BASE = (import.meta as any).env?.VITE_API_URL || '';

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
    const text = await res.text();
    throw new Error(text || `${method} ${path} failed: ${res.status}`);
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
  questionAssetUrl: (rel: string) =>
    rel.startsWith('http') ? rel : `${BASE}${rel}`,

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

  // review queue (admin / head_teacher)
  listReviewItems: (params: any = {}) => request('GET', `/review/items${qs(params)}`),
  getReviewItem: (id: string) => request('GET', `/review/items/${id}`),
  updateReviewItem: (id: string, data: any) => request('PATCH', `/review/items/${id}`, data),
  approveReviewItem: (id: string) => request('POST', `/review/items/${id}/approve`),
  rejectReviewItem: (id: string, reason?: string) =>
    request('POST', `/review/items/${id}/reject`, { reason }),
  pageImageUrl: (sourceFileId: string, pageNo: number) =>
    `${BASE}/api/source-files/${sourceFileId}/pages/${pageNo}.png`,
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
