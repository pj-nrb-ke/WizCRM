import { z } from 'zod';
import { LEAD_STAGES } from './stages.js';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createLeadSchema = z
  .object({
    name: z.string().min(1).max(200),
    company: z.string().max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(5).max(30).optional(),
    source: z.string().max(100).optional(),
  })
  .refine((d) => Boolean(d.email || d.phone), {
    message: 'Either email or phone is required',
    path: ['email'],
  });

export const updateLeadSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  company: z.string().max(200).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(5).max(30).nullable().optional(),
  source: z.string().max(100).nullable().optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  stageNote: z.string().max(500).optional(),
  confirmStageSuggestion: z.boolean().optional(),
});

export const createActivitySchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE']),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(10000),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  dueAt: z.string().datetime().optional(),
  leadId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  completed: z.boolean().optional(),
});

export const cardParseSchema = z.object({
  imageBase64: z.string().min(10).optional(),
  imageMimeType: z
    .enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    .optional(),
  ocrText: z.string().min(1).optional(),
}).refine((d) => d.imageBase64 || d.ocrText, {
  message: 'imageBase64 or ocrText required',
});

export const postCallSchema = z.object({
  leadId: z.string().uuid(),
  roughNote: z.string().min(1).max(10000),
  callDurationSec: z.number().int().positive().optional(),
});

export const voiceNoteSchema = z.object({
  leadId: z.string().uuid(),
  transcript: z.string().min(1).max(10000),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
