import { describe, expect, it } from 'vitest';
import {
  buildCalendarRange,
  buildEventIsoRange,
  findConflictingEventIds,
  formatDateInputLocal,
  getEventsOnDay,
  shiftCalendarCursor,
} from './calendar';

describe('buildCalendarRange', () => {
  it('uses full month grid for month fetch range', () => {
    const cursor = new Date('2026-05-15T12:00:00');
    const range = buildCalendarRange('month', cursor);

    expect(range.days).toHaveLength(42);
    expect(formatDateInputLocal(range.from)).toBe('2026-04-26');
    expect(formatDateInputLocal(range.to)).toBe('2026-06-06');
  });
});

describe('shiftCalendarCursor', () => {
  it('moves month cursor by exact month, not 30 days', () => {
    const jan31 = new Date('2026-01-31T12:00:00');
    const next = shiftCalendarCursor(jan31, 'month', 1);

    expect(next.getMonth()).toBe(2);
  });
});

describe('getEventsOnDay', () => {
  it('matches all-day events by date keys', () => {
    const events = [
      {
        startAt: '2026-05-01T00:00:00.000Z',
        endAt: '2026-05-01T23:59:59.999Z',
        allDay: true,
      },
    ];

    const onMay1 = getEventsOnDay(events, new Date('2026-05-01T12:00:00'));
    const onApr30 = getEventsOnDay(events, new Date('2026-04-30T12:00:00'));

    expect(onMay1).toHaveLength(1);
    expect(onApr30).toHaveLength(0);
  });
});

describe('buildEventIsoRange', () => {
  it('normalizes all-day bounds to local day start/end', () => {
    const { startAt, endAt } = buildEventIsoRange('2026-05-05T14:20', '2026-05-05T15:20', true);
    const start = new Date(startAt);
    const end = new Date(endAt);

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

describe('findConflictingEventIds', () => {
  const ev = (id: string, startAt: string, endAt: string, allDay = false) => ({
    id,
    startAt,
    endAt,
    allDay,
  });

  it('flags both sides of an overlap', () => {
    const clashing = findConflictingEventIds([
      ev('a', '2026-05-05T09:00:00.000Z', '2026-05-05T10:00:00.000Z'),
      ev('b', '2026-05-05T09:30:00.000Z', '2026-05-05T10:30:00.000Z'),
    ]);

    expect([...clashing].sort()).toEqual(['a', 'b']);
  });

  it('treats back-to-back events as free', () => {
    const clashing = findConflictingEventIds([
      ev('a', '2026-05-05T09:00:00.000Z', '2026-05-05T10:00:00.000Z'),
      ev('b', '2026-05-05T10:00:00.000Z', '2026-05-05T11:00:00.000Z'),
    ]);

    expect(clashing.size).toBe(0);
  });

  it('flags an event fully contained inside another', () => {
    const clashing = findConflictingEventIds([
      ev('outer', '2026-05-05T09:00:00.000Z', '2026-05-05T12:00:00.000Z'),
      ev('inner', '2026-05-05T10:00:00.000Z', '2026-05-05T11:00:00.000Z'),
    ]);

    expect([...clashing].sort()).toEqual(['inner', 'outer']);
  });

  it('ignores all-day events so an expo does not clash with every meeting', () => {
    const clashing = findConflictingEventIds([
      ev('expo', '2026-05-05T00:00:00.000Z', '2026-05-05T23:59:59.000Z', true),
      ev('demo', '2026-05-05T10:00:00.000Z', '2026-05-05T11:00:00.000Z'),
    ]);

    expect(clashing.size).toBe(0);
  });

  it('finds every clash when one event overlaps two others', () => {
    const clashing = findConflictingEventIds([
      ev('long', '2026-05-05T09:00:00.000Z', '2026-05-05T12:00:00.000Z'),
      ev('early', '2026-05-05T08:30:00.000Z', '2026-05-05T09:30:00.000Z'),
      ev('late', '2026-05-05T11:30:00.000Z', '2026-05-05T13:00:00.000Z'),
      ev('clear', '2026-05-05T14:00:00.000Z', '2026-05-05T15:00:00.000Z'),
    ]);

    expect([...clashing].sort()).toEqual(['early', 'late', 'long']);
    expect(clashing.has('clear')).toBe(false);
  });
});
