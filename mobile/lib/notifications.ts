import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationChannel() {
  // Android: required for sound/vibrate control.
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestNotificationsPermission() {
  const perm = await Notifications.getPermissionsAsync();
  const granted = Boolean((perm as any).granted) || (perm as any).status === 'granted';
  if (granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return Boolean((req as any).granted) || (req as any).status === 'granted';
}

export async function rescheduleLocalReminders(input: {
  tasks: {
    id: string;
    title: string;
    dueAt: string | null;
    completedAt?: string | null;
    lead?: { name?: string | null } | null;
  }[];
  events: { id: string; title: string; startAt: string }[];
}) {
  await ensureNotificationChannel();
  const ok = await requestNotificationsPermission();
  if (!ok) return;

  // Keep it simple: clear and re-schedule from current snapshot.
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = Date.now();
  const dueCutoff = new Date();
  dueCutoff.setHours(23, 59, 59, 999);

  for (const t of input.tasks) {
    if (t.completedAt) continue;
    if (!t.dueAt) continue;
    const dueMs = new Date(t.dueAt).getTime();
    if (Number.isNaN(dueMs) || dueMs > dueCutoff.getTime()) continue;
    if (dueMs < now - 24 * 60 * 60 * 1000) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Task due today',
        body: t.lead?.name ? `${t.title} · ${t.lead.name}` : t.title,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
    });
  }

  for (const ev of input.events) {
    const startMs = new Date(ev.startAt).getTime();
    if (Number.isNaN(startMs)) continue;
    const reminderMs = startMs - 60 * 60 * 1000; // 1h before
    if (reminderMs <= now) continue;
    if (reminderMs > now + 7 * 24 * 60 * 60 * 1000) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Meeting reminder',
        body: ev.title,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round((reminderMs - now) / 1000),
      },
    });
  }
}

