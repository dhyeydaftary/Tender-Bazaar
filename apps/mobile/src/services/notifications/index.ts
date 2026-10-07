/**
 * TenderBazaar -- Notification Services
 *
 * Re-exports all push notification utilities and provides a singleton
 * `NotificationManager` that wires everything together.
 *
 * Usage:
 *   import { NotificationManager } from '@/services/notifications';
 *
 *   // In App.tsx after auth bootstrap:
 *   const manager = NotificationManager.getInstance();
 *   manager.setNavigationRef(navigationRef);
 *   await manager.initialize();
 */

export {
  requestPermission,
  getToken,
  onTokenRefresh,
  setupForegroundHandler,
  setupBackgroundHandler,
  getInitialNotification,
  onNotificationOpened,
  parseNotificationAction,
  setBadgeCount,
  clearBadge,
} from './pushService';

export type {
  NotificationPayload,
  NotificationType,
  NavigationAction,
} from './pushService';

import {
  requestPermission,
  getToken,
  onTokenRefresh,
  setupForegroundHandler,
  setupBackgroundHandler,
  getInitialNotification,
  onNotificationOpened,
  parseNotificationAction,
  setBadgeCount,
} from './pushService';

import type { NotificationPayload } from './pushService';
import { useNotificationStore } from '../../stores/notificationStore';
import * as notificationApi from '../api/notifications';

// ---------------------------------------------------------------------------
// NotificationManager -- singleton
// ---------------------------------------------------------------------------

/**
 * Singleton that initialises all notification handling.
 * Call `NotificationManager.getInstance().initialize()` from App.tsx
 * after auth is confirmed.
 */
export class NotificationManager {
  private static instance: NotificationManager;

  private initialized = false;
  private navigationRef: any = null;

  /** Listener teardown functions accumulated during `initialize`. */
  private unsubscribers: Array<() => void> = [];

  // -----------------------------------------------------------------------
  // Singleton access
  // -----------------------------------------------------------------------

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  // Prevent external instantiation
  private constructor() {}

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Store the React Navigation ref so notification taps can trigger
   * programmatic navigation.
   */
  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
  }

  /**
   * Full initialisation sequence. Safe to call multiple times -- subsequent
   * calls are no-ops.
   *
   * 1. Request notification permission
   * 2. Retrieve and register the FCM token
   * 3. Set up foreground notification handler
   * 4. Set up background notification handler
   * 5. Set up notification-opened (background) handler
   * 6. Check if the app was cold-launched from a notification tap
   * 7. Sync initial unread count from the backend
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 1. Request permission
      const granted = await requestPermission();
      if (!granted) {
        console.warn(
          '[NotificationManager] Notification permission not granted',
        );
        // Continue -- we can still fetch unread count even without push
      }

      // 2. Get and register FCM token
      await getToken();

      // 3. Token refresh listener
      const unsubTokenRefresh = onTokenRefresh();
      this.unsubscribers.push(unsubTokenRefresh);

      // 4. Foreground handler
      const unsubForeground = setupForegroundHandler(
        (payload: NotificationPayload) => {
          // Increment the unread badge in the Zustand store
          useNotificationStore.getState().incrementUnread();
        },
      );
      this.unsubscribers.push(unsubForeground);

      // 5. Background handler (module-level registration)
      setupBackgroundHandler();

      // 6. Notification opened from background
      const unsubOpened = onNotificationOpened(
        (payload: NotificationPayload) => {
          this.handleNotificationTap(payload);
        },
      );
      this.unsubscribers.push(unsubOpened);

      // 7. Cold-launch from notification
      const initialPayload = await getInitialNotification();
      if (initialPayload) {
        this.handleNotificationTap(initialPayload);
      }

      // 8. Sync unread count from backend
      await this.syncUnreadCount();

      this.initialized = true;
    } catch (error) {
      console.error('[NotificationManager] initialize error:', error);
    }
  }

  /**
   * Parse a notification payload and navigate to the appropriate screen.
   */
  async handleNotificationTap(payload: NotificationPayload): Promise<void> {
    try {
      const action = parseNotificationAction(payload);
      if (!action) return;

      if (!this.navigationRef?.isReady?.()) {
        // Navigation container is not yet mounted -- wait briefly
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }

      if (this.navigationRef?.isReady?.()) {
        this.navigationRef.navigate(action.screen, action.params);
      } else {
        console.warn(
          '[NotificationManager] Navigation ref not ready, cannot navigate to',
          action.screen,
        );
      }
    } catch (error) {
      console.error('[NotificationManager] handleNotificationTap error:', error);
    }
  }

  /**
   * Tear down all listeners. Call on app unmount or logout.
   */
  destroy(): void {
    for (const unsub of this.unsubscribers) {
      try {
        unsub();
      } catch {
        // Ignore teardown errors
      }
    }
    this.unsubscribers = [];
    this.initialized = false;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Fetch the current unread notification count from the API and update
   * the Zustand store.
   */
  private async syncUnreadCount(): Promise<void> {
    try {
      const response = await notificationApi.getUnreadCount();
      if (response.success && response.data) {
        useNotificationStore.getState().setUnreadCount(response.data.count);
        await setBadgeCount(response.data.count);
      }
    } catch (error) {
      console.error('[NotificationManager] syncUnreadCount error:', error);
    }
  }
}
