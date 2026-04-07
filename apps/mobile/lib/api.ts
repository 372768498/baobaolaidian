/**
 * Axios API client with automatic JWT injection and 401 auto-logout.
 *
 * All response shapes mirror the FastAPI backend Pydantic schemas.
 */
import axios from 'axios';
import { API_BASE_URL, WS_BASE_URL, STORAGE_KEYS } from './constants';
import { getToken, clearToken } from './auth';
import { getSecure } from './storage';

// ─── Axios instance ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject Bearer token before every request
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — clear stored credentials so useAuth redirects to login
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await clearToken();
      // Navigation reset happens in useAuth hook when token becomes null
    }
    return Promise.reject(err);
  }
);

// ─── Type definitions (mirrors backend schemas) ───────────────────────────────

export interface UserOut {
  id: string;
  phone: string;
  nickname: string;
  avatar_emoji: string;
  birth_year: number | null;
  onboarding_done: boolean;
  preferred_persona_id: string | null;
  created_at: string;
}

export interface PersonaOut {
  id: string;
  name: string;
  avatar_emoji: string;
  short_bio: string;
  personality_tags: string[];
  voice_style: string;
}

export interface SessionOut {
  id: string;
  user_id: string;
  persona_id: string;
  trigger_type: 'scheduled' | 'emergency' | 'manual';
  status: 'pending' | 'active' | 'completed' | 'failed';
  phase: string;
  started_at: string | null;
  ended_at: string | null;
  duration_secs: number | null;
}

export interface RecapOut {
  id: string;
  session_id: string;
  summary_text: string;
  micro_action: string | null;
  followup_point: string | null;
  created_at: string;
}

export interface MemoryItemOut {
  id: string;
  category: string;
  content: string;
  confidence: number;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ─── Auth endpoints ───────────────────────────────────────────────────────────

export const authApi = {
  register: (data: {
    phone: string;
    password: string;
    nickname: string;
    birth_year: number;
  }) => api.post<TokenResponse>('/auth/register', data),

  login: (phone: string, password: string) =>
    api.post<TokenResponse>('/auth/login', { phone, password }),
};

// ─── User endpoints ───────────────────────────────────────────────────────────

export const userApi = {
  me: () => api.get<UserOut>('/users/me'),

  updateOnboarding: (data: {
    nickname?: string;
    avatar_emoji?: string;
    preferred_persona_id?: string;
    call_time_start?: string;
    call_time_end?: string;
    onboarding_done?: boolean;
  }) => api.put<UserOut>('/users/onboarding', data),

  personas: () => api.get<PersonaOut[]>('/users/personas'),
};

// ─── Call endpoints ───────────────────────────────────────────────────────────

export const callApi = {
  triggerEmergency: () =>
    api.post<SessionOut>('/calls/emergency'),

  sessions: (skip = 0, limit = 20) =>
    api.get<SessionOut[]>('/calls/sessions', { params: { skip, limit } }),

  session: (id: string) =>
    api.get<SessionOut>(`/calls/sessions/${id}`),

  recap: (sessionId: string) =>
    api.get<RecapOut>(`/recap/${sessionId}`),
};

// ─── Memory endpoints ─────────────────────────────────────────────────────────

export const memoryApi = {
  list: () => api.get<MemoryItemOut[]>('/memory'),
  delete: (id: string) => api.delete(`/memory/${id}`),
};

// ─── WebSocket URL builder ────────────────────────────────────────────────────

/** Returns the full WS URL with JWT in query string.
 *  WS protocol doesn't support Authorization header, so token is in QS.
 */
export async function buildWsUrl(sessionId: string): Promise<string> {
  const token = await getToken();
  return `${WS_BASE_URL}/ws/call/${sessionId}?token=${token}`;
}
