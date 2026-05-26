import { z } from 'zod';
import { leadTagsField } from './lead-tags.js';

export const createUserReminderSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(5000).optional(),
  remindAt: z.string().datetime(),
  tags: leadTagsField,
  leadId: z.string().uuid().optional(),
  calendarEventId: z.string().uuid().optional(),
});

export const updateUserReminderSchema = createUserReminderSchema.partial();
