import { z } from 'zod';
import { hasContactMethod, sanitizeStringList } from './contact.js';
import { LEAD_PRIORITIES } from './priorities.js';
import { pipelineStageConfigSchema } from './pipeline-stages.js';
import { LEAD_STAGES } from './stages.js';

const phoneField = z.string().min(5).max(30);
const emailField = z.string().email();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createLeadSchema = z
  .object({
    name: z.string().min(1).max(200),
    company: z.string().max(200).optional(),
    email: emailField.optional(),
    phone: phoneField.optional(),
    extraPhones: z.array(phoneField).max(5).optional(),
    extraEmails: z.array(emailField).max(5).optional(),
    address: z.string().max(500).optional(),
    googleMapsUrl: z.string().url().max(2000).optional(),
    source: z.string().max(100).optional(),
    priority: z.enum(LEAD_PRIORITIES).optional(),
  })
  .superRefine((d, ctx) => {
    const extraPhones = sanitizeStringList(d.extraPhones);
    const extraEmails = sanitizeStringList(d.extraEmails);
    if (!hasContactMethod({ phone: d.phone, email: d.email, extraPhones, extraEmails })) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one phone or email is required',
        path: ['email'],
      });
    }
    for (const p of extraPhones) {
      if (p.length < 5) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid extra phone', path: ['extraPhones'] });
      }
    }
  });

export const updateLeadSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  company: z.string().max(200).nullable().optional(),
  email: emailField.nullable().optional(),
  phone: phoneField.nullable().optional(),
  extraPhones: z.array(phoneField).max(5).nullable().optional(),
  extraEmails: z.array(emailField).max(5).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  googleMapsUrl: z.string().url().max(2000).nullable().optional(),
  source: z.string().max(100).nullable().optional(),
  priority: z.enum(LEAD_PRIORITIES).nullable().optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  stageNote: z.string().max(500).optional(),
  confirmStageSuggestion: z.boolean().optional(),
  /** Manager pipeline drag-drop: relaxed stage transition rules */
  pipelineMove: z.boolean().optional(),
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

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

export const assignTeamMembersSchema = z.object({
  userIds: z.array(z.string().uuid()),
});

export const transcribeAudioSchema = z.object({
  audioBase64: z.string().min(10),
  mimeType: z
    .enum(['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/webm'])
    .optional(),
});

export const nextActionFeedbackSchema = z.object({
  action: z.string().min(1).max(500),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
});

export const orgSettingsSchema = z.object({
  deskUseAi: z.boolean().optional(),
  pipelineStages: z.array(pipelineStageConfigSchema).optional(),
});

export const createAdminUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  password: z.string().min(6).max(100),
  role: z.enum(['SALES', 'MANAGER', 'ADMIN']),
  teamId: z.string().uuid().nullable().optional(),
});

export const updateAdminUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(['SALES', 'MANAGER', 'ADMIN']).optional(),
  teamId: z.string().uuid().nullable().optional(),
});

export const sendLeadEmailSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  html: z.string().max(50000).optional(),
});

export type OrgSettings = z.infer<typeof orgSettingsSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
