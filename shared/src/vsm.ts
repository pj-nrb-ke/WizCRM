import { z } from 'zod';

const timeOfDayField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:MM');

const workingDaysField = z.array(z.number().int().min(0).max(6)).max(7);

export const upsertTeamMemberProfileSchema = z.object({
  position: z.string().max(200).optional(),
  responsibilities: z.string().max(2000).optional(),
  workingDays: workingDaysField.optional(),
  workStart: timeOfDayField.optional(),
  workEnd: timeOfDayField.optional(),
  pushOptIn: z.boolean().optional(),
  managedByVsm: z.boolean().optional(),
});
export type UpsertTeamMemberProfile = z.infer<typeof upsertTeamMemberProfileSchema>;

export const vsmKpiTargetsSchema = z.object({
  taskCompletionRatePct: z.number().min(0).max(100).optional(),
  medianResponseHours: z.number().min(0).max(168).optional(),
  staleLeadReductionPct: z.number().min(0).max(100).optional(),
  planEditRateCeilingPct: z.number().min(0).max(100).optional(),
});
export type VsmKpiTargets = z.infer<typeof vsmKpiTargetsSchema>;

export const updateVsmConfigSchema = z.object({
  personaName: z.string().min(1).max(100).optional(),
  personaEmail: z.string().email().optional(),
  tone: z.enum(['professional', 'warm', 'direct']).optional(),
  language: z.enum(['en', 'sw']).optional(),
  timezone: z.string().max(100).optional(),
  workingDays: workingDaysField.optional(),
  runMorningAt: timeOfDayField.optional(),
  middayNudgeEnabled: z.boolean().optional(),
  runMiddayAt: timeOfDayField.optional(),
  runEveningAt: timeOfDayField.optional(),
  runDigestAt: timeOfDayField.optional(),
  autonomy: z.enum(['DRAFT', 'AUTO']).optional(),
  dailyFocusCap: z.number().int().min(1).max(50).optional(),
  taskCapPerDay: z.number().int().min(1).max(20).optional(),
  nudgeCapPerDay: z.number().int().min(0).max(5).optional(),
  ceoUserIds: z.array(z.string().uuid()).max(10).optional(),
  kpiTargets: vsmKpiTargetsSchema.optional(),
  enabled: z.boolean().optional(),
});
export type UpdateVsmConfig = z.infer<typeof updateVsmConfigSchema>;

export const createTaskUpdateSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type CreateTaskUpdate = z.infer<typeof createTaskUpdateSchema>;
