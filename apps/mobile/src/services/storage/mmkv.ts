import { createMMKV } from 'react-native-mmkv';

/**
 * Shared MMKV storage instance for the app.
 * Uses a dedicated ID so data is scoped to TenderBazaar.
 */
export const storage = createMMKV({
  id: 'tenderbazaar-storage',
});

// ─── Storage Keys ────────────────────────────────────────────────────────────

export const StorageKeys = {
  AUTH_TOKEN: 'auth.token',
  AUTH_REFRESH_TOKEN: 'auth.refreshToken',
  AUTH_USER: 'auth.user',
  APP_ONBOARDED: 'app.onboarded',
  APP_THEME: 'app.theme',
  SEARCH_RECENT: 'search.recent',
  FCM_TOKEN: 'fcm.token',
} as const;

// ─── Typed Helpers ───────────────────────────────────────────────────────────

export function getString(key: string): string | undefined {
  return storage.getString(key);
}

export function setString(key: string, value: string): void {
  storage.set(key, value);
}

export function getBoolean(key: string): boolean | undefined {
  return storage.getBoolean(key);
}

export function setBoolean(key: string, value: boolean): void {
  storage.set(key, value);
}

export function getObject<T>(key: string): T | undefined {
  const raw = storage.getString(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function setObject<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function deleteKey(key: string): void {
  storage.remove(key);
}

export function clearAll(): void {
  storage.clearAll();
}
