import { config } from '../config';
import {
  describePushCredential,
  resolveFirebaseCredential,
  type PushCredentialStatus,
} from './firebase-credentials';

// Lazy-initialized firebase admin
let firebaseApp: FirebaseApp | null = null;
let messaging: FirebaseMessaging | null = null;

// Type aliases for firebase-admin internals
type FirebaseApp = import('firebase-admin').app.App;
type FirebaseMessaging = import('firebase-admin').messaging.Messaging;

/** Last resolved credential state, for honest health reporting. */
let credentialStatus: PushCredentialStatus | null = null;

/**
 * Current push-channel status, resolved on first use and cached.
 *
 * Exposed so health reporting can say "disabled" or "misconfigured" instead of
 * implying push works. Never returns a credential value.
 */
export function getPushStatus(): PushCredentialStatus {
  if (!credentialStatus) {
    credentialStatus = resolveFirebaseCredential({
      serviceAccountPath: config.firebase.serviceAccountPath,
      projectId: config.firebase.projectId,
    }).status;
  }
  return credentialStatus;
}

/** Test-only: drop the cached credential and app so config is re-read. */
export function resetPushProviderForTests(): void {
  credentialStatus = null;
  firebaseApp = null;
  messaging = null;
}

async function getMessaging(): Promise<FirebaseMessaging | null> {
  if (messaging) return messaging;

  // Resolve a REAL service-account credential.
  //
  // This previously called initializeApp({ projectId }) with no credential, so
  // Firebase Admin silently fell back to Application Default Credentials that
  // do not exist here: initialization "succeeded" and every send failed.
  const resolved = resolveFirebaseCredential({
    serviceAccountPath: config.firebase.serviceAccountPath,
    projectId: config.firebase.projectId,
  });
  credentialStatus = resolved.status;

  if (resolved.status.state !== 'configured' || !resolved.serviceAccount) {
    console.warn(`[Push] ${describePushCredential(resolved.status)}`);
    return null;
  }

  try {
    const admin = await import('firebase-admin');

    // Only initialize if no apps exist yet
    if (admin.apps.length === 0) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: resolved.serviceAccount.projectId,
          clientEmail: resolved.serviceAccount.clientEmail,
          privateKey: resolved.serviceAccount.privateKey,
        }),
        projectId: resolved.serviceAccount.projectId,
      });
    } else {
      firebaseApp = admin.apps[0]!;
    }

    messaging = admin.messaging(firebaseApp);
    console.log(
      `[Push] Firebase Admin initialized (project=${resolved.serviceAccount.projectId})`,
    );
    return messaging;
  } catch (error) {
    // An initialization failure is a misconfiguration, not a disabled feature,
    // so it is recorded as such. The message is logged without the credential.
    credentialStatus = {
      state: 'error',
      reason: `Firebase Admin initialization failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    };
    console.error(`[Push] ${describePushCredential(credentialStatus)}`);
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
