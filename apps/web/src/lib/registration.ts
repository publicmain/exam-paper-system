/**
 * 网站式注册的触发判定（2026-08-26，docs/PRD/student-registration.md）。
 *
 * 打开 app（/my-lesson、/my-history、/me）时：本机已知姓名且服务端说
 * 该生未注册 → 弹全屏注册卡，**不可跳过**（教师定案，无「稍后再说」）。
 *
 * ## 缓存
 *
 * 「已注册」是单向状态（只有教师重置能翻回去），本机记住后不再每次
 * 打接口 —— 学生每天打开 app 数次，不必每次都问一遍。教师重置后该生
 * 登录会 401/token_revoked，走登录卡路径，不受这个缓存影响。
 */
import { BASE } from './api';
import { teacherViewToken } from './teacher-view';

const DONE_KEY = 'reg:done'; // 值 = studentId 或 '1'

export interface RegStatus {
  show: boolean;
  name: string;
  studentId?: string;
  candidates?: { studentId: string; name: string; classes: string[] }[];
}

export function markRegistered(studentId?: string) {
  try {
    localStorage.setItem(DONE_KEY, studentId || '1');
  } catch {
    /* ignore */
  }
}

/** 要不要弹注册卡。查不出来（网络/接口异常）一律不弹 —— 绝不挡学习。 */
export async function checkRegistration(): Promise<RegStatus | null> {
  let name = '';
  let studentId = '';
  try {
    // 教师「学生视角」下绝不弹 —— 那是教师在看，不是学生在用
    if (teacherViewToken()) return null;
    if (localStorage.getItem(DONE_KEY)) return null;
    name = (localStorage.getItem('mq:history:name') ?? '').trim();
    studentId = localStorage.getItem('mq:history:studentId') ?? '';
  } catch {
    return null;
  }
  if (!name) return null;

  try {
    const qs = `name=${encodeURIComponent(name)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`;
    const r = await fetch(`${BASE}/api/student-auth/registration-status?${qs}`);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.found) return null;
    if (j.needDisambiguation) {
      return { show: true, name, candidates: j.candidates };
    }
    if (j.registered) {
      markRegistered(studentId || undefined);
      return null;
    }
    return { show: true, name, studentId: studentId || undefined };
  } catch {
    return null;
  }
}
