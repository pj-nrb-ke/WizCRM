import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import type { UserReminderRow } from './reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationChannel() {
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync('meetings', {
    name: 'Meetings',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

export async function requestNotificationsPermission() {
  const perm = await Notifications.getPermissionsAsync();
  const granted = Boolean((perm as { granted?: boolean }).granted) || perm.status === 'granted';
  if (granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return Boolean((req as { granted?: boolean }).granted) || req.status === 'granted';
}

/**
 * Mobile push (VSM-SPEC §4.5 Phase 3) — the native FCM device token, not an
 * Expo push token: sends go direct to FCM's HTTP v1 API from the server
 * (see api/src/services/fcm-push.service.ts), never through Expo's push
 * service. Best-effort throughout — a device without Google Play Services,
 * or a build with no google-services.json yet, must never block sign-in.
 */
export async function registerPushToken(): Promise<void> {
  const ok = await requestNotificationsPermission();
  if (!ok) return;
  try {
    await ensureNotificationChannel();
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    await api('/push-tokens', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
  } catch {
    // best-effort
  }
}

export async function unregisterPushToken(): Promise<void> {
  try {
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    await api('/push-tokens', { method: 'DELETE', body: { token } });
  } catch {
    // best-effort — e.g. already signed out, or no token was ever issued
  }
}

async function cancelTrackedNotifications() {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
}

function scheduleAt(
  id: string,
  when: Date,
  content: { title: string; body: string },
): Promise<string | null> {
  const ms = when.getTime() - Date.now();
  if (ms < 1000) return Promise.resolve(null);
  if (ms > 60 * 24 * 60 * 60 * 1000) return Promise.resolve(null);
  return Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { ...content, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
    },
  });
}

export async function rescheduleLocalReminders(input: {
  tasks: {
    id: string;
    title: string;
    dueAt: string | null;
    completedAt?: string | null;
    lead?: { name?: string | null } | null;
  }[];
  events: {
    id: string;
    title: string;
    startAt: string;
    reminderMinutes?: number | null;
  }[];
  customReminders?: UserReminderRow[];
}) {
  await ensureNotificationChannel();
  const ok = await requestNotificationsPermission();
  if (!ok) return;

  await cancelTrackedNotifications();

  const now = Date.now();
  const dueCutoff = new Date();
  dueCutoff.setHours(23, 59, 59, 999);

  for (const t of input.tasks) {
    if (t.completedAt || !t.dueAt) continue;
    const dueMs = new Date(t.dueAt).getTime();
    if (Number.isNaN(dueMs) || dueMs > dueCutoff.getTime()) continue;
    const fireAt = new Date(Math.max(dueMs - 15 * 60 * 1000, now + 2000));
    await scheduleAt(`task-${t.id}`, fireAt, {
      title: 'Task due soon',
      body: t.lead?.name ? `${t.title} · ${t.lead.name}` : t.title,
    });
  }

  for (const ev of input.events) {
    const startMs = new Date(ev.startAt).getTime();
    if (Number.isNaN(startMs) || startMs <= now) continue;
    const mins = ev.reminderMinutes ?? 60;
    const reminderMs = startMs - mins * 60 * 1000;
    if (reminderMs <= now) continue;
    await scheduleAt(`event-${ev.id}`, new Date(reminderMs), {
      title: mins <= 5 ? 'Meeting starting now' : 'Meeting reminder',
      body: `${ev.title} · starts ${new Date(startMs).toLocaleString()}`,
    });
    if (mins >= 15) {
      const alarmMs = startMs - 5 * 60 * 1000;
      if (alarmMs > now) {
        await scheduleAt(`event-alarm-${ev.id}`, new Date(alarmMs), {
          title: 'Meeting in 5 minutes',
          body: ev.title,
        });
      }
    }
  }

  for (const r of input.customReminders ?? []) {
    const at = new Date(r.remindAt).getTime();
    if (Number.isNaN(at) || at <= now) continue;
    await scheduleAt(`reminder-${r.id}`, new Date(at), {
      title: r.title,
      body: r.notes ?? (r.lead?.name ? `Lead: ${r.lead.name}` : 'WizCRM reminder'),
    });
  }
}
