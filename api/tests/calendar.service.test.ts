import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  calendarEventFindMany: vi.fn(),
  calendarEventFindFirst: vi.fn(),
  calendarEventFindUnique: vi.fn(),
  calendarEventCreate: vi.fn(),
  calendarEventUpdate: vi.fn(),
  calendarEventDelete: vi.fn(),
  leadFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  attendeeFindFirst: vi.fn(),
  attendeeFindMany: vi.fn(),
  attendeeUpdate: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    calendarEvent: {
      findMany: prismaMocks.calendarEventFindMany,
      findFirst: prismaMocks.calendarEventFindFirst,
      findUnique: prismaMocks.calendarEventFindUnique,
      create: prismaMocks.calendarEventCreate,
      update: prismaMocks.calendarEventUpdate,
      delete: prismaMocks.calendarEventDelete,
    },
    calendarEventAttendee: {
      findFirst: prismaMocks.attendeeFindFirst,
      findMany: prismaMocks.attendeeFindMany,
      update: prismaMocks.attendeeUpdate,
    },
    user: {
      findMany: prismaMocks.userFindMany,
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
  createCalendarEvent,
  deleteCalendarEvent,
  getTeamAvailability,
  listCalendarEvents,
  rsvpCalendarEvent,
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
    prismaMocks.calendarEventCreate.mockResolvedValue({ id: 'evt-1' });
    prismaMocks.calendarEventFindUnique.mockResolvedValue({ id: 'evt-1' });
    prismaMocks.attendeeFindMany.mockResolvedValue([]);
    prismaMocks.userFindMany.mockResolvedValue([]);
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
    // A sales user sees the events they organise plus the ones they are invited to.
    expect(where.OR).toEqual([
      { userId: 'user-1' },
      { attendees: { some: { userId: 'user-1' } } },
    ]);
  });

  it('invites only real org colleagues and never the organiser', async () => {
    // 'outsider' belongs to another org, so the lookup does not return it.
    prismaMocks.userFindMany.mockResolvedValueOnce([{ id: 'user-2' }]);

    await createCalendarEvent('org-1', 'user-1', {
      title: 'Expo prep',
      startAt: '2026-03-01T09:00:00.000Z',
      endAt: '2026-03-01T10:00:00.000Z',
      attendeeIds: ['user-2', 'user-1', 'outsider'],
    });

    // The organiser is dropped before the org lookup even happens.
    expect(prismaMocks.userFindMany.mock.calls[0][0].where.id.in).toEqual(['user-2', 'outsider']);
    const created = prismaMocks.calendarEventCreate.mock.calls[0][0].data;
    expect(created.attendees.create).toEqual([{ userId: 'user-2' }]);
  });

  it('refuses an RSVP from someone who was not invited', async () => {
    prismaMocks.attendeeFindFirst.mockResolvedValueOnce(null);

    const result = await rsvpCalendarEvent('evt-1', 'org-1', 'gatecrasher', 'ACCEPTED');

    expect(result).toBeNull();
    expect(prismaMocks.attendeeUpdate).not.toHaveBeenCalled();
  });

  it('records an RSVP against the invite of the replying user', async () => {
    prismaMocks.attendeeFindFirst.mockResolvedValueOnce({ id: 'inv-1' });

    await rsvpCalendarEvent('evt-1', 'org-1', 'user-2', 'DECLINED');

    expect(prismaMocks.attendeeFindFirst.mock.calls[0][0].where).toEqual({
      eventId: 'evt-1',
      userId: 'user-2',
      event: { organizationId: 'org-1' },
    });
    const update = prismaMocks.attendeeUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'inv-1' });
    expect(update.data.status).toBe('DECLINED');
    expect(update.data.respondedAt).toBeInstanceOf(Date);
  });

  describe('getTeamAvailability', () => {
    const from = new Date('2026-03-02T09:00:00.000Z');
    const to = new Date('2026-03-02T10:00:00.000Z');
    const people = [
      { id: 'user-1', name: 'Organiser' },
      { id: 'user-2', name: 'Invitee' },
      { id: 'user-3', name: 'Decliner' },
    ];

    it('counts the organiser and non-declining invitees as busy', async () => {
      prismaMocks.userFindMany.mockResolvedValueOnce(people);
      prismaMocks.calendarEventFindMany.mockResolvedValueOnce([
        {
          id: 'evt-9',
          title: 'Board demo',
          startAt: from,
          endAt: to,
          allDay: false,
          userId: 'user-1',
          attendees: [
            { userId: 'user-2', status: 'ACCEPTED' },
            { userId: 'user-3', status: 'DECLINED' },
          ],
        },
      ]);

      const rows = await getTeamAvailability('org-1', 'user-1', 'SALES', { from, to });
      const busyFor = (id: string) => rows.find((r) => r.userId === id)!.busy;

      expect(busyFor('user-1')).toHaveLength(1);
      expect(busyFor('user-2')).toHaveLength(1);
      // Turning an invite down frees the slot back up.
      expect(busyFor('user-3')).toEqual([]);
    });

    it('hides the title of an event the viewer has nothing to do with', async () => {
      prismaMocks.userFindMany.mockResolvedValueOnce(people);
      prismaMocks.calendarEventFindMany.mockResolvedValueOnce([
        {
          id: 'evt-9',
          title: 'Salary review',
          startAt: from,
          endAt: to,
          allDay: false,
          userId: 'user-1',
          attendees: [],
        },
      ]);

      const rows = await getTeamAvailability('org-1', 'user-3', 'SALES', { from, to });

      expect(rows.find((r) => r.userId === 'user-1')!.busy[0].title).toBe('Busy');
    });

    it('shows the title to a manager and to the organiser', async () => {
      const event = {
        id: 'evt-9',
        title: 'Salary review',
        startAt: from,
        endAt: to,
        allDay: false,
        userId: 'user-1',
        attendees: [],
      };
      prismaMocks.userFindMany.mockResolvedValueOnce(people);
      prismaMocks.calendarEventFindMany.mockResolvedValueOnce([event]);
      const asManager = await getTeamAvailability('org-1', 'user-3', 'MANAGER', { from, to });
      expect(asManager.find((r) => r.userId === 'user-1')!.busy[0].title).toBe('Salary review');

      prismaMocks.userFindMany.mockResolvedValueOnce(people);
      prismaMocks.calendarEventFindMany.mockResolvedValueOnce([event]);
      const asOrganiser = await getTeamAvailability('org-1', 'user-1', 'SALES', { from, to });
      expect(asOrganiser.find((r) => r.userId === 'user-1')!.busy[0].title).toBe('Salary review');
    });

    it('uses a strict overlap and excludes the event being rescheduled', async () => {
      prismaMocks.userFindMany.mockResolvedValueOnce(people);
      prismaMocks.calendarEventFindMany.mockResolvedValueOnce([]);

      await getTeamAvailability('org-1', 'user-1', 'SALES', { from, to, excludeEventId: 'evt-9' });

      const where = prismaMocks.calendarEventFindMany.mock.calls[0][0].where;
      // Back-to-back meetings must not be reported as a clash.
      expect(where.startAt).toEqual({ lt: to });
      expect(where.endAt).toEqual({ gt: from });
      expect(where.id).toEqual({ not: 'evt-9' });
    });
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
