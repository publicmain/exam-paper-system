/**
 * 学生 token 的失效处置（2026-08-25 复审 P0-2 的前端一半）。
 *
 * 后端现在会在三种情况下拒绝一张**语法上仍然有效**的学生 token：
 *
 *   · `token_revoked`      —— 教师重置了 PIN / 学生自己改了 PIN /
 *                             账号被停用，`studentAuthVersion` 已递增
 *   · `student_token_required` —— 这个写操作必须登录
 *   · `identity_mismatch`  —— token 的人和请求里写的名字不是同一个
 *
 * 前端如果只把它当成普通 500 弹一句红字，学生会看到「操作失败」然后
 * 一直重试 —— 而真正的出路是重新登录。`token_revoked` 尤其要**主动清掉
 * 本地 token**：这正是「抢注者被踢下线」的那一刻，留着只会让他继续撞墙。
 *
 * 返回值：处理了就返回给用户看的中文提示，没处理返回 null（调用方按
 * 原有逻辑走）。
 */

export const AUTH_TOKEN_KEY = 'auth_token';

/** 判读 403 响应体里的 code。响应体不是 JSON 时安静返回 null。 */
export async function readErrorCode(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    const code = body?.code ?? body?.message?.code;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

/**
 * 把错误 code 翻成给学生看的话。`token_revoked` 有副作用：清掉本地废票。
 * 同步函数，因为 api.ts 的错误分支已经把 body 解析好了。
 */
export function authErrorHint(code: unknown): string | null {
  if (code === 'token_revoked') {
    // 唯一一处主动清 token 的地方：这张凭证已经被服务端作废，
    // 留在 localStorage 里只会让后续每个请求都 403。
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return '登录已失效（PIN 被重置或账号有变动），请重新登录';
  }
  if (code === 'student_token_required') {
    return '这一步需要先登录：去「我的」页面用姓名 + PIN 登录';
  }
  if (code === 'identity_mismatch') {
    return '当前登录的账号与页面上的姓名不一致，请重新登录';
  }
  return null;
}

/**
 * 处置一个 403。**调用方要传 res.clone()** —— body 只能读一次，
 * 这里读掉了原来的错误处理就拿不到文本了。
 */
export async function onAuthError(res: Response): Promise<string | null> {
  return authErrorHint(await readErrorCode(res));
}
