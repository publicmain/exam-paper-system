import { create } from 'zustand';
import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'head_teacher' | 'admin' | 'student';
}

interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  scope?: 'mq_handoff';
  mqs?: string;
  exp?: number;
}

/** Decode a JWT payload client-side (no verification — the server still
 *  enforces the signature on every request). Returns null on any malformed
 *  input so callers can fall back safely. */
function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    return JSON.parse(atob(b64 + pad));
  } catch {
    return null;
  }
}

/**
 * Cross-device handoff: a student scans on their phone, then AirDrops the
 * quiz link to a MacBook to answer on the bigger screen. AirDrop carries
 * only the URL, so the second device has no token — the SPA used to bounce
 * it to /my-history. The scan flow now embeds a narrow, session-scoped
 * handoff token in the quiz URL's hash (`#h=<jwt>`). Adopt it here, BEFORE
 * the App-level auth gate runs, so `user` is populated and the student
 * lands on the answering page.
 *
 * Only adopts when there's no existing token (never clobbers the phone's
 * own scanToken or a logged-in teacher). Always strips the token from the
 * address bar so it isn't re-shared, bookmarked, or screenshotted.
 */
function adoptHandoffFromHash(): void {
  try {
    const m = (window.location.hash || '').match(/[#&]h=([^&]+)/);
    if (!m) return;
    const token = decodeURIComponent(m[1]);
    if (!localStorage.getItem('auth_token')) {
      localStorage.setItem('auth_token', token);
    }
    const clean = window.location.pathname + window.location.search;
    window.history.replaceState(window.history.state, '', clean);
  } catch {
    /* ignore — malformed hash just means no handoff to adopt */
  }
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  loading: true,
  async init() {
    // Adopt an AirDropped handoff token (no-op if there's already a token
    // or no #h= in the URL) before anything reads auth state.
    adoptHandoffFromHash();
    const t = localStorage.getItem('auth_token');
    if (!t) { set({ loading: false }); return; }
    const payload = decodeJwt(t);
    if (payload?.scope === 'mq_handoff') {
      // Narrow, session-scoped token: /auth/me is intentionally out of its
      // reach (the AuthGuard 403s it everywhere except the quiz routes), so
      // validating via api.me() would falsely log the student out. Trust
      // the signed payload for the display identity instead — every actual
      // request is still scope-checked server-side.
      if (payload.exp && payload.exp * 1000 <= Date.now()) {
        localStorage.removeItem('auth_token');
        set({ loading: false });
        return;
      }
      set({
        user: { id: payload.id, email: payload.email, name: payload.name, role: payload.role },
        token: t,
        loading: false,
      });
      return;
    }
    try {
      const me = await api.me();
      set({ user: me, token: t, loading: false });
    } catch {
      localStorage.removeItem('auth_token');
      set({ loading: false });
    }
  },
  async login(email, password) {
    const { token, user } = await api.login(email, password) as any;
    localStorage.setItem('auth_token', token);
    set({ token, user });
  },
  logout() {
    localStorage.removeItem('auth_token');
    set({ token: null, user: null });
  },
}));
