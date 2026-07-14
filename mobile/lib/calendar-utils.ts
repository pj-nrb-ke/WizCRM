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
  user: { id: string; name: string } | null;
  /** Set when this event is one day of a multi-day series (e.g. an exhibition) — see calendar/[id].tsx "Copy to another day". */
  recurrence?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  recurrenceUntil?: string | null;
};

function localDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Remaining days a multi-day event can still be copied to (day after this event, up to and including recurrenceUntil). */
export function remainingSeriesDays(ev: Pick<CalendarEventRow, 'startAt' | 'recurrence' | 'recurrenceUntil'>): string[] {
  if (!ev.recurrence || ev.recurrence === 'NONE' || !ev.recurrenceUntil) return [];
  const days: string[] = [];
  const start = new Date(ev.startAt.slice(0, 10) + 'T00:00:00');
  const until = new Date(ev.recurrenceUntil.slice(0, 10) + 'T00:00:00');
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= until) {
    // Local date components, not toISOString — that converts to UTC and rolls
    // local midnight back a day in any positive-UTC-offset timezone (e.g. EAT).
    days.push(localDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Deterministic color per organizer, so the same person always gets the same dot. */
const ORGANIZER_COLORS = ['#38bdf8', '#f472b6', '#a78bfa', '#fbbf24', '#4ade80', '#fb923c', '#22d3ee'];

export function colorForOrganizer(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return ORGANIZER_COLORS[hash % ORGANIZER_COLORS.length];
}

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
