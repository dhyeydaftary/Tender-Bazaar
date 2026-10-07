/**
 * TenderBazaar -- Push Notification Service
 *
 * Handles:
 * - FCM token registration and refresh
 * - Notification permission requests
 * - Foreground notification display
 * - Background/quit notification handling
 * - Deep linking from notification taps
 * - Badge count management
 */

import { Platform, PermissionsAndroid } from 'react-native';
import { setString, getString, StorageKeys } from '../storage/mmkv';
import * as notificationApi from '../api/notifications';
import type { RootStackParamList } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'TENDER_ALERT'
  | 'DEADLINE_REMINDER'
  | 'SUBSCRIPTION_EXPIRY'
  | 'NEW_CORRIGENDUM'
  | 'TENDER_RESULT'
  | 'ELIGIBILITY_RESULT'
  | 'SYSTEM';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: {
    type: NotificationType;
    tenderId?: string;
    alertId?: string;
    url?: string;
  };
}

export interface NavigationAction {
  screen: keyof RootStackParamList;
  params?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Firebase module -- lazy, crash-safe loading
// ---------------------------------------------------------------------------

let messaging: any = null;
try {
  messaging = require('@react-native-firebase/messaging').default;
} catch {
  console.warn('[PushService] Firebase messaging not available');
}

// ---------------------------------------------------------------------------
// requestPermission
// ---------------------------------------------------------------------------

/**
 * Request notification permission from the user.
 *
 * On iOS this triggers the system permission dialog via Firebase.
 * On Android 13+ (API 33) this requests the POST_NOTIFICATIONS runtime
 * permission. Older Android versions return true immediately.
 *
 * @returns `true` if permission was granted, `false` otherwise.
 */
export async function requestPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      if (!messaging) return false;
      const authStatus = await messaging().requestPermission();
      // AuthorizationStatus: AUTHORIZED = 1, PROVISIONAL = 2
      return authStatus === 1 || authStatus === 2;
    }

    // Android 13+ (API level 33) requires POST_NOTIFICATIONS
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        'android.permission.POST_NOTIFICATIONS' as any,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }

    // Older Android versions don't require runtime permission
    return true;
  } catch (error) {
    console.error('[PushService] requestPermission error:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// getToken
// ---------------------------------------------------------------------------

/**
 * Retrieve the current FCM registration token.
 *
 * The token is cached in MMKV. If a cached token exists and matches the
 * current FCM token, the backend registration call is skipped. When the
 * token changes (or is fetched for the first time), it is persisted locally
 * and sent to the backend via `registerDevice`.
 *
 * @returns The FCM token string, or `null` if unavailable.
 */
export async function getToken(): Promise<string | null> {
  try {
    if (!messaging) return null;

    const token: string = await messaging().getToken();
    if (!token) return null;

    const cachedToken = getString(StorageKeys.FCM_TOKEN);

    if (cachedToken !== token) {
      // Token is new or has changed -- persist and register with backend
      setString(StorageKeys.FCM_TOKEN, token);

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      await notificationApi.registerDevice(token, platform);
    }

    return token;
  } catch (error) {
    console.error('[PushService] getToken error:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// onTokenRefresh
// ---------------------------------------------------------------------------

/**
 * Subscribe to FCM token refresh events.
 *
 * When Firebase rotates the device token, the new token is persisted in
 * MMKV and re-registered with the backend.
 *
 * @param callback Optional callback invoked with the new token.
 * @returns An unsubscribe function, or a no-op if Firebase is unavailable.
 */
export function onTokenRefresh(
  callback?: (token: string) => void,
): () => void {
  try {
    if (!messaging) return () => {};

    const unsubscribe = messaging().onTokenRefresh(async (token: string) => {
      try {
        setString(StorageKeys.FCM_TOKEN, token);

        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        await notificationApi.registerDevice(token, platform);

        callback?.(token);
      } catch (error) {
        console.error('[PushService] onTokenRefresh handler error:', error);
      }
    });

    return unsubscribe;
  } catch (error) {
    console.error('[PushService] onTokenRefresh setup error:', error);
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// setupForegroundHandler
// ---------------------------------------------------------------------------

/**
 * Register a handler for notifications received while the app is in the
 * foreground.
 *
 * Firebase suppresses notification display by default when the app is
 * foregrounded. This handler receives the remote message so the app can
 * show an in-app banner or update state.
 *
 * @param onNotification Callback invoked with the parsed notification payload.
 * @returns An unsubscribe function.
 */
export function setupForegroundHandler(
  onNotification: (payload: NotificationPayload) => void,
): () => void {
  try {
    if (!messaging) return () => {};

    const unsubscribe = messaging().onMessage(
      async (remoteMessage: any) => {
        const payload = parseRemoteMessage(remoteMessage);
        if (payload) {
          onNotification(payload);
        }
      },
    );

    return unsubscribe;
  } catch (error) {
    console.error('[PushService] setupForegroundHandler error:', error);
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// setupBackgroundHandler
// ---------------------------------------------------------------------------

/**
 * Register the background/quit-state message handler.
 *
 * This must be called at the module level (outside of any component) so
 * that React Native can invoke the handler even when the JS bundle is
 * loaded in a headless context.
 *
 * The handler does not receive a callback because UI interactions are not
 * possible in the background. It is typically used for data-only messages
 * or to update badge counts silently.
 */
export function setupBackgroundHandler(): void {
  try {
    if (!messaging) return;

    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      // Background handler -- keep lightweight.
      // Badge count and notification storage are managed by the OS / FCM.
      console.log(
        '[PushService] Background message received:',
        remoteMessage.messageId,
      );
    });
  } catch (error) {
    console.error('[PushService] setupBackgroundHandler error:', error);
  }
}

// ---------------------------------------------------------------------------
// getInitialNotification
// ---------------------------------------------------------------------------

/**
 * Check whether the app was launched by a user tapping a notification
 * while the app was in a killed state.
 *
 * Should be called once during app initialisation. If a notification
 * caused the launch, the returned payload can be used to navigate the
 * user to the appropriate screen.
 *
 * @returns The notification payload that launched the app, or `null`.
 */
export async function getInitialNotification(): Promise<NotificationPayload | null> {
  try {
    if (!messaging) return null;

    const remoteMessage = await messaging().getInitialNotification();
    if (!remoteMessage) return null;

    return parseRemoteMessage(remoteMessage);
  } catch (error) {
    console.error('[PushService] getInitialNotification error:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notification-opened handler (background -> foreground)
// ---------------------------------------------------------------------------

/**
 * Register a handler for when the user taps a notification while the app
 * is in the background (but not killed).
 *
 * @param onOpen Callback invoked with the parsed notification payload.
 * @returns An unsubscribe function.
 */
export function onNotificationOpened(
  onOpen: (payload: NotificationPayload) => void,
): () => void {
  try {
    if (!messaging) return () => {};

    const unsubscribe = messaging().onNotificationOpenedApp(
      (remoteMessage: any) => {
        const payload = parseRemoteMessage(remoteMessage);
        if (payload) {
          onOpen(payload);
        }
      },
    );

    return unsubscribe;
  } catch (error) {
    console.error('[PushService] onNotificationOpened error:', error);
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// parseNotificationAction
// ---------------------------------------------------------------------------

/**
 * Determine which screen to navigate to based on a notification payload.
 *
 * Mapping:
 * - TENDER_ALERT        -> TenderDetail { id }
 * - DEADLINE_REMINDER   -> TenderDetail { id }
 * - TENDER_RESULT       -> TenderDetail { id }
 * - NEW_CORRIGENDUM     -> TenderDetail { id }
 * - ELIGIBILITY_RESULT  -> EligibilityResult { tenderId }
 * - SUBSCRIPTION_EXPIRY -> Plans
 * - SYSTEM              -> Notifications
 *
 * @returns A `NavigationAction` or `null` if no meaningful action can be derived.
 */
export function parseNotificationAction(
  payload: NotificationPayload,
): NavigationAction | null {
  const data = payload.data;
  if (!data?.type) return null;

  switch (data.type) {
    case 'TENDER_ALERT':
    case 'DEADLINE_REMINDER':
    case 'TENDER_RESULT':
    case 'NEW_CORRIGENDUM':
      if (data.tenderId) {
        return { screen: 'TenderDetail', params: { id: data.tenderId } };
      }
      return { screen: 'Notifications' };

    case 'ELIGIBILITY_RESULT':
      if (data.tenderId) {
        return {
          screen: 'EligibilityResult',
          params: { tenderId: data.tenderId, score: 0 },
        };
      }
      return { screen: 'Notifications' };

    case 'SUBSCRIPTION_EXPIRY':
      return { screen: 'Plans' };

    case 'SYSTEM':
      return { screen: 'Notifications' };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Badge management
// ---------------------------------------------------------------------------

/**
 * Set the app badge count on iOS. No-op on Android.
 *
 * @param count The number to display on the app icon badge.
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    if (Platform.OS !== 'ios' || !messaging) return;

    // Firebase messaging exposes badge management on iOS
    await messaging().setAPNSToken; // ensure APNS is initialized
    const notifee = tryRequireNotifee();
    if (notifee) {
      await notifee.setBadgeCount(count);
    }
  } catch (error) {
    console.error('[PushService] setBadgeCount error:', error);
  }
}

/**
 * Clear the app badge count on iOS. No-op on Android.
 */
export async function clearBadge(): Promise<void> {
  await setBadgeCount(0);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Firebase RemoteMessage into our internal NotificationPayload
 * structure.
 */
function parseRemoteMessage(remoteMessage: any): NotificationPayload | null {
  if (!remoteMessage) return null;

  const notification = remoteMessage.notification;
  const data = remoteMessage.data;

  return {
    title: notification?.title ?? data?.title ?? '',
    body: notification?.body ?? data?.body ?? '',
    data: data
      ? {
          type: data.type as NotificationType,
          tenderId: data.tenderId,
          alertId: data.alertId,
          url: data.url,
        }
      : undefined,
  };
}

/**
 * Try to require @notifee/react-native for badge management.
 * Returns null if the package is not installed.
 */
function tryRequireNotifee(): any {
  try {
    return require('@notifee/react-native').default;
  } catch {
    return null;
  }
}
