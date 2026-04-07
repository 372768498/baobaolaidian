/**
 * Auth helpers — token persistence and decoding.
 * JWT is stored in expo-secure-store (device keychain) rather than
 * AsyncStorage, which is unencrypted on Android.
 */
import { STORAGE_KEYS } from './constants';
import { saveSecure, getSecure, deleteSecure } from './storage';

// Minimal JWT decode — extracts payload without verifying signature.
// Signature verification happens on the server for every API call.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await saveSecure(STORAGE_KEYS.ACCESS_TOKEN, token);
}

export async function getToken(): Promise<string | null> {
  return getSecure(STORAGE_KEYS.ACCESS_TOKEN);
}

export async function clearToken(): Promise<void> {
  await deleteSecure(STORAGE_KEYS.ACCESS_TOKEN);
  await deleteSecure(STORAGE_KEYS.USER_ID);
}

/** Returns true if stored token exists and is not expired. */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;

  const payload = decodeJwtPayload(token);
  if (!payload) return false;

  const exp = payload['exp'] as number | undefined;
  if (!exp) return false;

  // 60-second grace period to account for clock skew
  return Date.now() / 1000 < exp - 60;
}
