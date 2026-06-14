import { api } from './api';

export type UserReminderRow = {
  id: string;
  title: string;
  notes: string | null;
  remindAt: string;
  tags: string[];
  leadId: string | null;
  calendarEventId: string | null;
  lead?: { id: string; name: string } | null;
};

export async function fetchReminders(from?: string, to?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const q = qs.toString();
  return api<{ reminders: UserReminderRow[] }>(`/reminders${q ? `?${q}` : ''}`);
}

export async function createReminder(body: {
  title: string;
  notes?: string;
  remindAt: string;
  tags?: string[];
  leadId?: string;
  calendarEventId?: string;
}) {
  return api<{ reminder: UserReminderRow }>('/reminders', { method: 'POST', body });
}

export async function deleteReminder(id: string) {
  return api<{ ok: boolean }>(`/reminders/${id}`, { method: 'DELETE' });
}
