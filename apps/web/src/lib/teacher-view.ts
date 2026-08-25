/**
 * 「以学生视角查看」的令牌保管（2026-08-25）。
 *
 * ## 为什么用 sessionStorage 而不是 localStorage
 *
 * 教师的登录票据放在 `localStorage.auth_token`。如果把学生视角令牌也写
 * 进那里，教师**自己就被挤下线了** —— 看完一个学生回到管理界面，发现
 * 要重新登录。
 *
 * `sessionStorage` 是**每个标签页独立**的：学生视角在新标签页里打开，
 * 那个标签页用视角令牌，教师原来的标签页照旧用自己的票。互不干扰，
 * 关掉标签页即失效。
 *
 * ## 令牌是只读的
 *
 * 服务端签的是 `scope: 'teacher_view'`，任何写接口都会 403
 * `teacher_view_is_read_only`（见 StudentIdentityGuard）。前端这边只需
 * 保证「看得到」，不需要也不应该去模拟写。
 */

const KEY = 'teacher_view_token';
const NAME_KEY = 'teacher_view_name';

export function setTeacherView(token: string, studentName: string) {
  sessionStorage.setItem(KEY, token);
  sessionStorage.setItem(NAME_KEY, studentName);
}

export function teacherViewToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    // 隐私模式下 sessionStorage 可能抛异常 —— 当作没有
    return null;
  }
}

export function teacherViewName(): string | null {
  try {
    return sessionStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function clearTeacherView() {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(NAME_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 从 URL 里接收视角令牌并**立刻从地址栏抹掉**。
 *
 * 令牌留在 URL 里会进浏览器历史、进 Referer、被截图分享出去 —— 虽然
 * 只有 15 分钟且只读，也没有理由留着。
 *
 * 返回是否接收到了新令牌。
 */
export function adoptTeacherViewFromUrl(): boolean {
  const url = new URL(window.location.href);
  const tok = url.searchParams.get('viewToken');
  if (!tok) return false;
  const name = url.searchParams.get('viewName') ?? '';
  setTeacherView(tok, name);
  url.searchParams.delete('viewToken');
  url.searchParams.delete('viewName');
  window.history.replaceState({}, '', url.toString());
  return true;
}
