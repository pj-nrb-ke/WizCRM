import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  calendarEventFindMany: vi.fn(),
  calendarEventFindFirst: vi.fn(),
  calendarEventUpdate: vi.fn(),
  calendarEventDelete: vi.fn(),
  leadFindFirst: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    calendarEvent: {
      findMany: prismaMocks.calendarEventFindMany,
      findFirst: prismaMocks.calendarEventFindFirst,
      update: prismaMocks.calendarEventUpdate,
      delete: prismaMocks.calendarEventDelete,
    },
    lead: {
      findFirst: prismaMocks.leadFindFirst,
    },
    activity: {
      create: vi.fn(),
    },
  },
}));

import {
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '../src/services/calendar.service.js';

describe('calendar.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.calendarEventFindMany.mockResolvedValue([]);
    prismaMocks.calendarEventFindFirst.mockResolvedValue({ id: 'evt-1', organizationId: 'org-1' });
    prismaMocks.calendarEventUpdate.mockResolvedValue({ id: 'evt-1', title: 'Updated' });
    prismaMocks.calendarEventDelete.mockResolvedValue({ id: 'evt-1' });
    prismaMocks.leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: 'org-1' });
  });

  it('normalizes month-style from/to to full-day boundaries', async () => {
    await listCalendarEvents('org-1', 'user-1', 'SALES', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(prismaMocks.calendarEventFindMany).toHaveBeenCalledTimes(1);
    const where = prismaMocks.calendarEventFindMany.mock.calls[0][0].where;
    const start = where.endAt.gte as Date;
    const end = where.startAt.lte as Date;
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(2);
    expect(end.getDate()).toBe(31);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(where.userId).toBe('user-1');
  });

  it('prevents sales user from updating another users event', async () => {
    prismaMocks.calendarEventFindFirst.mockResolvedValueOnce(null);

    const updated = await updateCalendarEvent('evt-1', 'org-1', 'sales-user', 'SALES', {
      title: 'Nope',
    });

    expect(updated).toBeNull();
    expect(prismaMocks.calendarEventFindFirst).toHaveBeenCalledWith({
      where: { id: 'evt-1', organizationId: 'org-1', userId: 'sales-user' },
    });
    expect(prismaMocks.calendarEventUpdate).not.toHaveBeenCalled();
  });

  it('allows manager update and blocks cross-org lead links', async () => {
    prismaMocks.leadFindFirst.mockResolvedValueOnce(null);

    const updated = await updateCalendarEvent('evt-1', 'org-1', 'manager-1', 'MANAGER', {
      leadId: 'foreign-lead',
      title: 'Updated by manager',
    });

    expect(prismaMocks.calendarEventFindFirst).toHaveBeenCalledWith({
      where: { id: 'evt-1', organizationId: 'org-1' },
    });
    expect(updated).toBeNull();
    expect(prismaMocks.calendarEventUpdate).not.toHaveBeenCalled();
  });

  it('enforces owner/manager scope on delete', async () => {
    prismaMocks.calendarEventFindFirst.mockResolvedValueOnce(null);
    const denied = await deleteCalendarEvent('evt-1', 'org-1', 'sales-user', 'SALES');
    expect(denied).toBe(false);
    expect(prismaMocks.calendarEventDelete).not.toHaveBeenCalled();

    prismaMocks.calendarEventFindFirst.mockResolvedValueOnce({ id: 'evt-1', organizationId: 'org-1' });
    const ok = await deleteCalendarEvent('evt-1', 'org-1', 'manager-1', 'ADMIN');
    expect(ok).toBe(true);
    expect(prismaMocks.calendarEventFindFirst).toHaveBeenLastCalledWith({
      where: { id: 'evt-1', organizationId: 'org-1' },
    });
    expect(prismaMocks.calendarEventDelete).toHaveBeenCalledWith({ where: { id: 'evt-1' } });
  });
});
