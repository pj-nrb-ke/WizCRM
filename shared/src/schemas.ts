import { z } from 'zod';
import { hasContactMethod, sanitizeStringList } from './contact.js';
import { LEAD_PRIORITIES } from './priorities.js';
import { pipelineStageConfigSchema } from './pipeline-stages.js';
import { LEAD_STAGES } from './stages.js';
import { DEFAULT_LOSS_REASONS } from './close-lead.js';
import { leadTagsField } from './lead-tags.js';

const lossReasonCodes = DEFAULT_LOSS_REASONS.map((r) => r.code) as [string, ...string[]];

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
    tags: leadTagsField,
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

export const lossReasonOptionSchema = z.object({
  code: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
});

export const updateLeadSchema = z
  .object({
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
    wonValue: z.number().nonnegative().max(999_999_999).optional(),
    wonStartAt: z.string().datetime().optional(),
    wonProducts: z.string().max(2000).optional(),
    lossReason: z.enum(lossReasonCodes).optional(),
    ownerId: z.string().uuid().optional(),
    tags: leadTagsField,
  })
  .superRefine((d, ctx) => {
    if (d.stage === 'WON') {
      if (d.wonValue === undefined || Number.isNaN(d.wonValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Deal value is required when marking as Won',
          path: ['wonValue'],
        });
      }
    }
    if (d.stage === 'LOST') {
      if (!d.lossReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Loss reason is required when marking as Lost',
          path: ['lossReason'],
        });
      }
    }
  });

export const bulkImportLeadsSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        company: z.string().max(200).optional(),
        email: emailField.optional(),
        phone: phoneField.optional(),
        source: z.string().max(100).optional(),
      }),
    )
    .min(1)
    .max(500),
  ownerId: z.string().uuid().optional(),
});

/** Reorder cards within one pipeline column (manager board). */
export const pipelineReorderSchema = z.object({
  stage: z.enum(LEAD_STAGES),
  leadIds: z.array(z.string().uuid()).min(1).max(200),
});

export const createActivitySchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE', 'SALES_OPPORTUNITY', 'CALENDAR_EVENT']),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(10000),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  dueAt: z.string().datetime().optional(),
  leadId: z.string().uuid().optional(),
  tags: leadTagsField,
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  completed: z.boolean().optional(),
  tags: leadTagsField,
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

/**
 * AI Visit Capture: a rep's raw post-visit voice transcript that AI turns into
 * a structured Visit Report draft (the "self-writing CRM"). leadId is in the path.
 */
export const visitCaptureSchema = z.object({
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
  leadSources: z.array(z.string().min(1).max(100)).max(50).optional(),
  leadTags: z.array(z.string().min(1).max(40)).max(50).optional(),
  lossReasons: z.array(lossReasonOptionSchema).max(30).optional(),
  /** Phase 2: inbound web lead capture */
  webhookSecret: z.string().min(16).max(128).optional(),
  webhookEnabled: z.boolean().optional(),
  /** Meeting check-in geofence radius in meters (default 150). */
  checkInRadiusMeters: z.number().int().min(25).max(2000).optional(),
  /** Phase 3: commercial plan (ScaleGate placeholder). */
  plan: z.enum(['lite', 'pro', 'enterprise']).optional(),
  licenseStatus: z.enum(['active', 'grace', 'expired', 'read_only']).optional(),
  licenseExpiresAt: z.string().datetime().optional(),
  /** Phase 3: ERP connector (stub until real SDK). */
  erpConnectorEnabled: z.boolean().optional(),
  erpConnectorType: z.enum(['stub', 'sage', 'sapb1', 'quickbooks', 'tally']).optional(),
  /** Phase 3: last GDPR export request timestamp (audit). */
  gdprExportRequestedAt: z.string().datetime().optional(),
  /** Open leads with no activity for this many days count as stale (default 7). */
  staleLeadDays: z.number().int().min(1).max(90).optional(),
  /** PRO-010: default monthly revenue target (currency units) for reps without an override. */
  orgMonthlyRevenueTarget: z.number().min(0).max(1_000_000_000).optional(),
  /** PRO-010: per-user monthly revenue targets (userId → amount). */
  userMonthlyTargets: z.record(z.string().uuid(), z.number().min(0).max(1_000_000_000)).optional(),
  /** PRO-013: tenant branding (web console). */
  brandDisplayName: z.string().max(120).optional(),
  logoUrl: z.string().url().max(2000).optional(),
  primaryColorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  /** MGT-021: shown on help / business page */
  supportEmail: z.string().email().optional(),
  /** MGT-023: minutes after meeting start before check-in counts as late */
  meetingGraceMinutes: z.number().int().min(0).max(120).optional(),
  /** Default days after SENT before quote follow-up if followUpAt not set (PRO-011) */
  quoteFollowUpDays: z.number().int().min(1).max(90).optional(),
});

export const suggestLeadCaptureSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
});

export const nextActionTaskSchema = z.object({
  action: z.string().min(1).max(500),
  dueAt: z.string().datetime().optional(),
});

export const bulkUpdateLeadsSchema = z
  .object({
    leadIds: z.array(z.string().uuid()).min(1).max(100),
    ownerId: z.string().uuid().optional(),
    stage: z.enum(LEAD_STAGES).optional(),
    pipelineMove: z.boolean().optional(),
  })
  .refine((d) => d.ownerId !== undefined || d.stage !== undefined, {
    message: 'Provide ownerId and/or stage',
  })
  .refine((d) => !d.stage || !['WON', 'LOST'].includes(d.stage), {
    message: 'Bulk stage change does not support WON or LOST — close leads individually',
    path: ['stage'],
  });

export const createAdminUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
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

export const createLeadMessageSchema = z.object({
  body: z.string().min(1).max(10000),
});

export const createLeadAttachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  /** Base64 payload (no data: prefix). Max ~5MB decoded enforced server-side. */
  dataBase64: z.string().min(1).max(7_000_000),
  messageId: z.string().uuid().optional(),
});

export type OrgSettings = z.infer<typeof orgSettingsSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type BulkUpdateLeadsInput = z.infer<typeof bulkUpdateLeadsSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type VisitCaptureInput = z.infer<typeof visitCaptureSchema>;
