import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from '../lib/prisma.js';
import { loadFirebaseServiceAccount } from './fcm-config.js';

const APP_NAME = 'wizcrm-fcm';

/** Lazily initialized — never at import time, so tests and environments
 * without Firebase configured don't crash on module load. Sends go direct
 * to FCM's HTTP v1 API via firebase-admin; no Expo push service, no EAS. */
function getMessagingClient() {
  const serviceAccount = loadFirebaseServiceAccount();
  if (!serviceAccount) return null;

  const existing = getApps().find((a) => a.name === APP_NAME);
  const app =
    existing ??
    initializeApp(
      {
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
      },
      APP_NAME,
    );
  return getMessaging(app);
}

const STALE_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** Push to every device registered for a user. Best-effort — a missing
 * Firebase credential or a send failure never breaks the caller (same
 * contract as safeSend() for email throughout the VSM module). Prunes
 * tokens FCM reports as dead so the token table doesn't accumulate junk. */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; linkPath?: string },
): Promise<{ sent: number }> {
  const messaging = getMessagingClient();
  if (!messaging) return { sent: 0 };

  const tokens = await prisma.pushToken.findMany({ where: { userId }, select: { id: true, token: true } });
  if (tokens.length === 0) return { sent: 0 };

  try {
    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: payload.title, body: payload.body },
      data: payload.linkPath ? { linkPath: payload.linkPath } : undefined,
    });

    const staleIds: string[] = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error && STALE_TOKEN_ERROR_CODES.has(r.error.code)) {
        staleIds.push(tokens[i].id);
      }
    });
    if (staleIds.length > 0) {
      await prisma.pushToken.deleteMany({ where: { id: { in: staleIds } } });
    }

    return { sent: response.successCount };
  } catch {
    return { sent: 0 };
  }
}
