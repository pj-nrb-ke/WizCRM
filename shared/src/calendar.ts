import { z } from 'zod';
import { leadTagsField } from './lead-tags.js';

export const CALENDAR_RECURRENCE = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] as const;

export const CALENDAR_EVENT_TYPES = [
  'MEETING', 'DEMO', 'EXPO', 'PRESENTATION', 'CONFERENCE_CALL', 'CALL', 'OTHER',
] as const;

export const MEETING_MODES = [
  'IN_PERSON', 'ZOOM', 'TEAMS', 'GOOGLE_MEET', 'PHONE', 'WHATSAPP', 'OTHER',
] as const;

/** Stored on an invite. INVITED means the person has not answered yet. */
export const RSVP_STATUSES = ['INVITED', 'ACCEPTED', 'DECLINED', 'TENTATIVE'] as const;
/** What an attendee may set on their own invite. */
export const RSVP_REPLIES = ['ACCEPTED', 'DECLINED', 'TENTATIVE'] as const;

export const MAX_EVENT_ATTENDEES = 50;

export const calendarRsvpSchema = z.object({
  status: z.enum(RSVP_REPLIES),
});

const calendarEventFieldsSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(5000).optional(),
  leadId: z.string().uuid().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().optional(),
  recurrence: z.enum(CALENDAR_RECURRENCE).optional(),
  recurrenceIntervalDays: z.number().int().min(1).max(365).optional(),
  recurrenceUntil: z.string().datetime().optional(),
  reminderMinutes: z.number().int().min(0).max(10080).optional(),
  tags: leadTagsField,
  meetingAddress: z.string().max(500).optional(),
  meetingLat: z.number().min(-90).max(90).optional(),
  meetingLng: z.number().min(-180).max(180).optional(),
  eventType: z.enum(CALENDAR_EVENT_TYPES).optional(),
  meetingMode: z.enum(MEETING_MODES).optional(),
  meetingUrl: z.string().max(1000).optional(),
  /** Colleagues invited to this event (user ids). The organiser is implicit. */
  attendeeIds: z.array(z.string().uuid()).max(MAX_EVENT_ATTENDEES).optional(),
});

export const ATTENDANCE_STATUSES = ['ON_TIME', 'LATE', 'NO_SHOW', 'PARTIAL'] as const;

export const calendarCheckInSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  attendanceStatus: z.enum(ATTENDANCE_STATUSES).optional(),
  /** Manager-only: allow check-in outside geofence. */
  geofenceOverride: z.boolean().optional(),
});

export const calendarCheckOutSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  attendanceStatus: z.enum(ATTENDANCE_STATUSES).optional(),
});

export const createCalendarEventSchema = calendarEventFieldsSchema.refine(
  (d) => new Date(d.endAt) >= new Date(d.startAt),
  { message: 'End must be after start', path: ['endAt'] },
);

export const updateCalendarEventSchema = calendarEventFieldsSchema.partial();

/** Copy a recurring-capped event (recurrence + recurrenceUntil set) to another day within its range. */
export const duplicateCalendarEventSchema = z.object({
  date: z.string().min(8).max(10), // ISO date, e.g. "2026-08-21"
});

export const calendarQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  view: z.enum(['day', 'week', 'month']).optional(),
});

/** "Who is busy between these two times?" — backs the free/busy check when scheduling. */
export const calendarAvailabilityQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  /** Comma-separated user ids. Omit for the whole org. */
  userIds: z.string().optional(),
  /** The event being rescheduled — it should not clash with itself. */
  excludeEventId: z.string().uuid().optional(),
});

export const teamActivityFeedQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  leadId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
});
