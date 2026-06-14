export type CalendarEventRow = {
  id: string;
  title: string;
  notes: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  meetingAddress: string | null;
  meetingLat: number | null;
  meetingLng: number | null;
  checkInAt: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  geofenceOverride?: boolean | null;
  checkOutAt: string | null;
  attendanceStatus: string | null;
  reminderMinutes?: number | null;
  tags?: string[];
  lead: { id: string; name: string; company: string | null } | null;
};

export function formatEventWhen(ev: Pick<CalendarEventRow, 'startAt' | 'endAt' | 'allDay'>) {
  const start = new Date(ev.startAt);
  const end = new Date(ev.endAt);
  if (ev.allDay) {
    return start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const t1 = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const t2 = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${t1}–${t2}`;
}

export function defaultNewEventTimes() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

export function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseLocalDatetimeInput(value: string) {
  return new Date(value).toISOString();
}

export function monthRange(year: number, month: number) {
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function listRangeDays(daysAhead = 14) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + daysAhead);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function openMapsForEvent(ev: Pick<CalendarEventRow, 'meetingAddress' | 'meetingLat' | 'meetingLng'>) {
  if (ev.meetingLat != null && ev.meetingLng != null) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${ev.meetingLat},${ev.meetingLng}`)}`;
  }
  if (ev.meetingAddress?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.meetingAddress.trim())}`;
  }
  return null;
}
