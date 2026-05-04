import { create } from 'zustand';
import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'head_teacher' | 'admin' | 'student';
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
    const t = localStorage.getItem('auth_token');
    if (!t) { set({ loading: false }); return; }
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
