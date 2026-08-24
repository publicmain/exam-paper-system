import { describe, expect, it, beforeEach, vi } from 'vitest';

/**
 * JWT payload 的 UTF-8 解码。
 *
 * 2026-08-24 用浏览器实测第二作答窗时撞出来的 bug：跨设备接力的
 * handoff token 里带着学生姓名，前端用 `JSON.parse(atob(...))` 解，
 * atob 吐的是 Latin-1 字节串，中文名直接变乱码 ——「二窗验证同学」
 * 解成「äºçªéªè¯åå­¦」。后果不是显示难看而已：成绩页
 * 靠姓名匹配放行，名字对不上 → 学生看不到自己刚交的卷子。
 *
 * 普通 scanToken 不走这条路（它通过 /auth/me 从服务端取姓名），所以
 * 这个 bug 只在 AirDrop 到另一台设备的场景下触发，藏了很久。
 */

/** 复刻服务端签 token 时的 base64url 编码（只造 payload 段，签名无关） */
function makeToken(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${b64}.signature`;
}

async function loadAuth() {
  vi.resetModules();
  return import('../auth');
}

describe('handoff token 的姓名解码', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/morning-quiz/sess1');
  });

  it('中文姓名不再乱码 —— 姓名匹配是成绩页的放行条件', async () => {
    const token = makeToken({
      id: 'u1',
      email: 'a@b.local',
      name: '二窗验证同学',
      role: 'student',
      scope: 'mq_handoff',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    window.history.replaceState({}, '', `/morning-quiz/sess1#h=${token}`);
    const { useAuth } = await loadAuth();
    await useAuth.getState().init();
    expect(useAuth.getState().user?.name).toBe('二窗验证同学');
  });

  it('ASCII 姓名照旧', async () => {
    const token = makeToken({
      id: 'u2',
      email: 'c@d.local',
      name: 'HEIN HTET NAING',
      role: 'student',
      scope: 'mq_handoff',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    window.history.replaceState({}, '', `/morning-quiz/sess1#h=${token}`);
    const { useAuth } = await loadAuth();
    await useAuth.getState().init();
    expect(useAuth.getState().user?.name).toBe('HEIN HTET NAING');
  });

  it('过期的 handoff token 被丢弃，不留下半个登录态', async () => {
    const token = makeToken({
      id: 'u3',
      email: 'e@f.local',
      name: '过期同学',
      role: 'student',
      scope: 'mq_handoff',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    window.history.replaceState({}, '', `/morning-quiz/sess1#h=${token}`);
    const { useAuth } = await loadAuth();
    await useAuth.getState().init();
    expect(useAuth.getState().user).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('采纳后把 token 从地址栏抹掉，避免被截图/收藏/转发', async () => {
    const token = makeToken({
      id: 'u4',
      email: 'g@h.local',
      name: '张三',
      role: 'student',
      scope: 'mq_handoff',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    window.history.replaceState({}, '', `/morning-quiz/sess1#h=${token}`);
    const { useAuth } = await loadAuth();
    await useAuth.getState().init();
    expect(window.location.hash).toBe('');
  });
});
