import { config } from '../config';

// Lazy-initialized firebase admin
let firebaseApp: FirebaseApp | null = null;
let messaging: FirebaseMessaging | null = null;

// Type aliases for firebase-admin internals
type FirebaseApp = import('firebase-admin').app.App;
type FirebaseMessaging = import('firebase-admin').messaging.Messaging;

async function getMessaging(): Promise<FirebaseMessaging | null> {
  if (messaging) return messaging;

  if (!config.firebase.projectId) {
    console.log('[Push] Firebase project ID not configured, skipping initialization');
    return null;
  }

  try {
    const admin = await import('firebase-admin');

    // Only initialize if no apps exist yet
    if (admin.apps.length === 0) {
      firebaseApp = admin.initializeApp({
        projectId: config.firebase.projectId,
      });
    } else {
      firebaseApp = admin.apps[0]!;
    }

    messaging = admin.messaging(firebaseApp);
    console.log('[Push] Firebase Admin initialized');
    return messaging;
  } catch (error) {
    console.error('[Push] Failed to initialize Firebase Admin:', error);
    return null;
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushNotification(
  fcmToken: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (config.isDev) {
    console.log('[Push] Dev mode - notification would be sent:');
    console.log(`  Token: ${fcmToken.substring(0, 20)}...`);
    console.log(`  Title: ${payload.title}`);
    console.log(`  Body: ${payload.body}`);
    if (payload.data) {
      console.log(`  Data:`, JSON.stringify(payload.data));
    }
    return true;
  }

  const msg = await getMessaging();
  if (!msg) {
    console.warn('[Push] Messaging not available, skipping notification');
    return false;
  }

  try {
    const messageId = await msg.send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'tenderbazaar_default',
          color: '#FF6B35',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
    });
    console.log(`[Push] Sent to token ${fcmToken.substring(0, 20)}... - ID: ${messageId}`);
    return true;
  } catch (error: unknown) {
    const errObj = error as { code?: string; message?: string };
    // Handle invalid/expired tokens gracefully
    if (
      errObj.code === 'messaging/invalid-registration-token' ||
      errObj.code === 'messaging/registration-token-not-registered'
    ) {
      console.warn(
        `[Push] Token invalid or expired: ${fcmToken.substring(0, 20)}... - should be removed from DB`
      );
      return false;
    }
    console.error(`[Push] Failed to send to ${fcmToken.substring(0, 20)}...:`, error);
    throw error;
  }
}

export async function sendMultiplePushNotifications(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
  if (config.isDev) {
    console.log('[Push] Dev mode - batch notification would be sent:');
    console.log(`  Tokens: ${tokens.length}`);
    console.log(`  Title: ${payload.title}`);
    console.log(`  Body: ${payload.body}`);
    return { successCount: tokens.length, failureCount: 0, invalidTokens: [] };
  }

  const msg = await getMessaging();
  if (!msg) {
    console.warn('[Push] Messaging not available, skipping batch notification');
    return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
  }

  try {
    const response = await msg.sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'tenderbazaar_default',
          color: '#FF6B35',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    console.log(
      `[Push] Batch sent: ${response.successCount} success, ${response.failureCount} failed, ${invalidTokens.length} invalid tokens`
    );

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  } catch (error) {
    console.error('[Push] Batch send failed:', error);
    throw error;
  }
}
