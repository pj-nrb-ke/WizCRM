export type CalendarViewMode = 'day' | 'week' | 'month';

export type CalendarEventLike = {
  startAt: string;
  endAt: string;
  allDay?: boolean;
};

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function formatDateInputLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function toLocalDateTimeInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

export function buildCalendarRange(view: CalendarViewMode, cursor: Date): {
  from: Date;
  to: Date;
  days: Date[];
} {
  if (view === 'day') {
    const from = startOfDay(cursor);
    const to = endOfDay(cursor);
    return { from, to, days: [from] };
  }

  if (view === 'month') {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
    const from = startOfDay(gridStart);
    const to = endOfDay(days[days.length - 1]);
    return { from, to, days };
  }

  const from = startOfWeek(cursor);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(from, i));
  const to = endOfDay(days[days.length - 1]);
  return { from, to, days };
}

export function shiftCalendarCursor(cursor: Date, view: CalendarViewMode, direction: -1 | 1): Date {
  if (view === 'month') return addMonths(cursor, direction);
  if (view === 'week') return addDays(cursor, 7 * direction);
  return addDays(cursor, direction);
}

export function getEventsOnDay<T extends CalendarEventLike>(events: T[], day: Date): T[] {
  const start = startOfDay(day);
  const end = endOfDay(day);
  const dayKey = formatDateInputLocal(day);

  return events.filter((e) => {
    // All-day events are date-based and should not shift across days by timezone conversion.
    if (e.allDay) {
      const startDay = e.startAt.slice(0, 10);
      const endDay = e.endAt.slice(0, 10);
      return startDay <= dayKey && dayKey <= endDay;
    }

    const es = new Date(e.startAt);
    const ee = new Date(e.endAt);
    return es <= end && ee >= start;
  });
}

export type ConflictEventLike = CalendarEventLike & { id: string };

/** Two timed events clash when they genuinely overlap. Back-to-back is fine. */
export function eventsOverlap(a: CalendarEventLike, b: CalendarEventLike): boolean {
  return (
    new Date(a.startAt) < new Date(b.endAt) && new Date(b.startAt) < new Date(a.endAt)
  );
}

/**
 * Ids of events that overlap at least one other event in the list.
 *
 * All-day events are skipped: an all-day expo is a backdrop to the day, not a
 * clash with every meeting inside it, and flagging them would make the warning
 * meaningless. Callers should pass only the events the person actually attends.
 */
export function findConflictingEventIds<T extends ConflictEventLike>(events: T[]): Set<string> {
  const timed = events.filter((e) => !e.allDay);
  const clashing = new Set<string>();
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      if (eventsOverlap(timed[i], timed[j])) {
        clashing.add(timed[i].id);
        clashing.add(timed[j].id);
      }
    }
  }
  return clashing;
}

export function buildEventIsoRange(
  startAtInput: string,
  endAtInput: string,
  allDay: boolean,
): { startAt: string; endAt: string } {
  if (!allDay) {
    return {
      startAt: new Date(startAtInput).toISOString(),
      endAt: new Date(endAtInput).toISOString(),
    };
  }

  const startDate = new Date(startAtInput);
  const endDate = new Date(endAtInput);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);
  return {
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
  };
}

export function allDayInputStart(iso: string): string {
  return `${iso.slice(0, 10)}T00:00`;
}

export function allDayInputEnd(iso: string): string {
  return `${iso.slice(0, 10)}T23:59`;
}

/** Deterministic color per organizer, so the same person always gets the same dot (matches the mobile app). */
const ORGANIZER_COLORS = ['#38bdf8', '#f472b6', '#a78bfa', '#fbbf24', '#4ade80', '#fb923c', '#22d3ee'];

export function colorForOrganizer(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return ORGANIZER_COLORS[hash % ORGANIZER_COLORS.length];
}

function localDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Remaining days a multi-day event can still be copied to (day after this event, up to and including recurrenceUntil). */
export function remainingSeriesDays(ev: {
  startAt: string;
  recurrence?: string;
  recurrenceUntil?: string | null;
}): string[] {
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
