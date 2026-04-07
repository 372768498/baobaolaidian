// ─── App-wide constants ───────────────────────────────────────────────────────

/** Base URL for backend REST API and WebSocket.
 *  Android emulator: 10.0.2.2 → host machine (localhost won't work inside emulator)
 *  Physical device: change to your LAN IP, e.g. "http://192.168.1.100:8000"
 */
export const API_BASE_URL = __DEV__
  ? 'http://192.168.2.6:8000'   // LAN IP — physical device reaches host machine
  : 'https://api.baobaolaidan.com';

export const WS_BASE_URL = __DEV__
  ? 'ws://192.168.2.6:8000'
  : 'wss://api.baobaolaidan.com';

// SecureStore keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'baobao_access_token',
  USER_ID: 'baobao_user_id',
  ONBOARDING_DONE: 'baobao_onboarding_done',
} as const;

// App design tokens
export const COLORS = {
  // Primary warm palette — calming, not clinical
  primary: '#FF8C69',       // warm salmon
  primaryLight: '#FFB89A',
  primaryDark: '#E06B4A',
  background: '#FFF5F0',    // warm off-white
  surface: '#FFFFFF',
  surfaceAlt: '#FFF0EA',

  // Text
  textPrimary: '#2D2D2D',
  textSecondary: '#8A8A8A',
  textLight: '#BCBCBC',

  // Semantic
  success: '#4CAF50',
  danger: '#E53935',
  warning: '#FB8C00',
  info: '#1E88E5',

  // Persona accent colors
  personaGentle: '#F8BBD0',   // 小暖 — soft pink
  personaEnergetic: '#B3E5FC', // 阿晴 — sky blue
  personaCalm: '#C8E6C9',     // 静澜 — mint green
} as const;

export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  display: 34,
} as const;

export const RADIUS = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Call phase labels displayed in UI
export const CALL_PHASE_LABELS: Record<string, string> = {
  OPENING: '接通中...',
  EMPATHY: '在听你说',
  EXPRESSION: '聊一聊',
  SUMMARY: '整理一下',
  MICRO_ACTION: '小小行动',
  CLOSING: '道晚安',
};

// Safety hotline
export const SAFETY_HOTLINE = '400-161-9995'; // 北京心理危机研究与干预中心
