import { create } from 'zustand';
import type { User } from '@/types/user';
import {
  getString,
  setString,
  deleteKey,
  getObject,
  setObject,
  StorageKeys,
} from '@/services/storage/mmkv';
import {
  setCredentials,
  getCredentials,
  clearCredentials,
} from '@/services/storage/secureStore';
import { configureAuth } from '@/services/api/client';
import { refreshToken as refreshTokenApi } from '@/services/api/auth';

// ─── State & Actions ────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  /** Hydrate from persisted storage on app launch. */
  init: () => Promise<void>;

  /** Set tokens + user after a successful login/register. */
  login: (user: User, token: string, refreshToken: string) => Promise<void>;

  /** Clear all auth state and storage. */
  logout: () => Promise<void>;

  /** Update the in-memory user object (e.g. after profile edit). */
  setUser: (user: User) => void;

  /** Replace token after a successful refresh. */
  setToken: (token: string) => Promise<void>;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => {
  // Wire up the API client so it can access tokens without circular imports.
  configureAuth({
    getToken: () => get().token,
    getRefreshToken: () => get().refreshToken,
    onRefreshSuccess: async (rt: string) => {
      const res = await refreshTokenApi(rt);
      if (res.success && res.data) {
        const newToken = res.data.accessToken;
        const newRefresh = res.data.refreshToken;
        await get().setToken(newToken);
        // Persist the new refresh token too
        set({ refreshToken: newRefresh });
        setString(StorageKeys.AUTH_REFRESH_TOKEN, newRefresh);
        await setCredentials(newToken, newRefresh);
        return newToken;
      }
      return null;
    },
    onLogout: () => {
      get().logout();
    },
  });

  return {
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    isInitialized: false,

    init: async () => {
      try {
        set({ isLoading: true });

        // Try secure store first, fall back to MMKV
        const creds = await getCredentials();
        const token = creds?.token ?? getString(StorageKeys.AUTH_TOKEN) ?? null;
        const rt =
          creds?.refreshToken ??
          getString(StorageKeys.AUTH_REFRESH_TOKEN) ??
          null;
        const user = getObject<User>(StorageKeys.AUTH_USER) ?? null;

        if (token && user) {
          set({
            user,
            token,
            refreshToken: rt,
            isAuthenticated: true,
          });
        }
      } catch {
        // Storage read failed — start fresh
      } finally {
        set({ isLoading: false, isInitialized: true });
      }
    },

    login: async (user, token, rt) => {
      set({
        user,
        token,
        refreshToken: rt,
        isAuthenticated: true,
      });

      // Persist to both MMKV (fast reads) and Keychain (secure)
      setString(StorageKeys.AUTH_TOKEN, token);
      setString(StorageKeys.AUTH_REFRESH_TOKEN, rt);
      setObject(StorageKeys.AUTH_USER, user);
      await setCredentials(token, rt);
    },

    logout: async () => {
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
      });

      deleteKey(StorageKeys.AUTH_TOKEN);
      deleteKey(StorageKeys.AUTH_REFRESH_TOKEN);
      deleteKey(StorageKeys.AUTH_USER);
      await clearCredentials();
    },

    setUser: (user) => {
      set({ user });
      setObject(StorageKeys.AUTH_USER, user);
    },

    setToken: async (token) => {
      set({ token });
      setString(StorageKeys.AUTH_TOKEN, token);
    },
  };
});
