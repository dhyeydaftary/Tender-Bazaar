import { create } from 'zustand';
import {
  getString,
  setString,
  getObject,
  setObject,
  StorageKeys,
} from '@/services/storage/mmkv';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system';

export interface NotificationPrefs {
  email: boolean;
  push: boolean;
  whatsapp: boolean;
  sms: boolean;
}

interface SettingsState {
  theme: ThemeMode;
  language: string;
  notificationPrefs: NotificationPrefs;
  biometricEnabled: boolean;

  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: string) => void;
  setNotificationPrefs: (prefs: Partial<NotificationPrefs>) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  init: () => void;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  email: true,
  push: true,
  whatsapp: false,
  sms: false,
};

// ─── Store ──────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'system',
  language: 'en',
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
  biometricEnabled: false,

  init: () => {
    const theme =
      (getString(StorageKeys.APP_THEME) as ThemeMode | undefined) ?? 'system';
    const language = getString('settings.language') ?? 'en';
    const notificationPrefs =
      getObject<NotificationPrefs>('settings.notificationPrefs') ??
      DEFAULT_NOTIFICATION_PREFS;
    const biometricEnabled =
      getObject<boolean>('settings.biometricEnabled') ?? false;

    set({ theme, language, notificationPrefs, biometricEnabled });
  },

  setTheme: (theme) => {
    set({ theme });
    setString(StorageKeys.APP_THEME, theme);
  },

  setLanguage: (language) => {
    set({ language });
    setString('settings.language', language);
  },

  setNotificationPrefs: (prefs) => {
    const current = get().notificationPrefs;
    const merged = { ...current, ...prefs };
    set({ notificationPrefs: merged });
    setObject('settings.notificationPrefs', merged);
  },

  setBiometricEnabled: (enabled) => {
    set({ biometricEnabled: enabled });
    setObject('settings.biometricEnabled', enabled);
  },
}));
