/**
 * Global auth + user state via Zustand.
 *
 * Kept in a single slice so every screen reading `useAuthStore()` stays in sync
 * without prop drilling or multiple Context providers.
 */
import { create } from 'zustand';
import { UserOut, PersonaOut, authApi, userApi } from '@/lib/api';
import { saveToken, clearToken, isAuthenticated } from '@/lib/auth';

interface AuthState {
  user: UserOut | null;
  personas: PersonaOut[];
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: {
    phone: string;
    password: string;
    nickname: string;
    birth_year: number;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loadPersonas: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  personas: [],
  isLoading: true,
  error: null,

  /** Called once on app startup — checks for valid stored token */
  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const authed = await isAuthenticated();
      if (authed) {
        const res = await userApi.me();
        set({ user: res.data });
      }
    } catch {
      // Token might be invalid — clear it
      await clearToken();
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (phone, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.login(phone, password);
      await saveToken(res.data.access_token);
      const me = await userApi.me();
      set({ user: me.data, isLoading: false });
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? '登录失败，请检查手机号和密码';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.register(data);
      await saveToken(res.data.access_token);
      const me = await userApi.me();
      set({ user: me.data, isLoading: false });
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? '注册失败，请稍后再试';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await clearToken();
    set({ user: null, personas: [] });
  },

  refreshUser: async () => {
    try {
      const res = await userApi.me();
      set({ user: res.data });
    } catch {
      // Silently fail — user data will be stale but app still works
    }
  },

  loadPersonas: async () => {
    try {
      const res = await userApi.personas();
      set({ personas: res.data });
    } catch {
      // Non-critical — personas will be empty
    }
  },

  clearError: () => set({ error: null }),
}));
