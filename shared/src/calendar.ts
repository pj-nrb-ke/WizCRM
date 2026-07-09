import { z } from 'zod';
import { leadTagsField } from './lead-tags.js';

export const CALENDAR_RECURRENCE = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] as const;

export const CALENDAR_EVENT_TYPES = [
  'MEETING', 'DEMO', 'EXPO', 'PRESENTATION', 'CONFERENCE_CALL', 'CALL', 'OTHER',
] as const;

export const MEETING_MODES = [
  'IN_PERSON', 'ZOOM', 'TEAMS', 'GOOGLE_MEET', 'PHONE', 'WHATSAPP', 'OTHER',
] as const;

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

export const calendarQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  view: z.enum(['day', 'week', 'month']).optional(),
});

export const teamActivityFeedQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  leadId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
});
