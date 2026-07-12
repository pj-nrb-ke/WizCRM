import { prisma } from '../lib/prisma.js';
import { sendPushToUser } from './fcm-push.service.js';

/** Creates the in-app Notification row and fires a best-effort push to
 * every device the user has registered — the two channels named in
 * VSM-SPEC §4.5 ("lightweight notification feed" + "mobile push"). Push
 * failure never blocks the in-app notification from being created. */
export async function notifyUser(params: {
  organizationId: string;
  userId: string;
  kind: string;
  title: string;
  body?: string;
  linkPath?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      kind: params.kind,
      title: params.title,
      body: params.body ?? null,
      linkPath: params.linkPath ?? null,
    },
  });

  // sendPushToUser is itself best-effort (never throws) — see fcm-push.service.ts.
  await sendPushToUser(params.userId, {
    title: params.title,
    body: params.body ?? '',
    linkPath: params.linkPath,
  });

  return notification;
}
