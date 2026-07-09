import { z } from 'zod';

/** Reach of an expo, from a Nairobi vantage point. */
export const EXPO_TIERS = [
  'LOCAL_KENYA',
  'EAST_AFRICA',
  'MIDDLE_EAST_AFRICA',
  'ASIA',
  'INTERNATIONAL',
] as const;

export type ExpoTier = (typeof EXPO_TIERS)[number];

export const EXPO_TIER_LABELS: Record<ExpoTier, string> = {
  LOCAL_KENYA: 'Local (Kenya)',
  EAST_AFRICA: 'East Africa',
  MIDDLE_EAST_AFRICA: 'Middle East & Africa',
  ASIA: 'Asia',
  INTERNATIONAL: 'International',
};

export const EXPO_RECOMMENDATIONS = ['BOOTH', 'PARTICIPANT', 'SKIP'] as const;
export type ExpoRecommendation = (typeof EXPO_RECOMMENDATIONS)[number];

export const EXPO_RECOMMENDATION_LABELS: Record<ExpoRecommendation, string> = {
  BOOTH: 'Take a booth',
  PARTICIPANT: 'Attend as participant',
  SKIP: 'Skip this one',
};

export const expoDiscoverSchema = z.object({
  /** Limit the sweep to one tier. Omit to search them all. */
  tier: z.enum(EXPO_TIERS).optional(),
});

export const expoListQuerySchema = z.object({
  tier: z.enum(EXPO_TIERS).optional(),
  /** Past expos are hidden by default — you cannot attend them. */
  includePast: z.coerce.boolean().optional(),
  includeDismissed: z.coerce.boolean().optional(),
});

export const expoAddToCalendarSchema = z.object({
  /** Colleagues to invite to the expo event. */
  attendeeIds: z.array(z.string().uuid()).max(50).optional(),
});
