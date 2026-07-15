/** Local mirror of @wizcrm/shared expo constants (Metro does not bundle the workspace package). */
import type { ExpoRecommendation, ExpoTier } from '@wizcrm/shared';

export const EXPO_TIERS: ExpoTier[] = ['LOCAL_KENYA', 'EAST_AFRICA', 'MIDDLE_EAST_AFRICA', 'ASIA', 'INTERNATIONAL'];

export const EXPO_TIER_LABELS: Record<ExpoTier, string> = {
  LOCAL_KENYA: 'Local (Kenya)',
  EAST_AFRICA: 'East Africa',
  MIDDLE_EAST_AFRICA: 'Middle East & Africa',
  ASIA: 'Asia',
  INTERNATIONAL: 'International',
};

export const EXPO_RECOMMENDATION_LABELS: Record<ExpoRecommendation, string> = {
  BOOTH: 'Take a booth',
  PARTICIPANT: 'Attend as participant',
  SKIP: 'Skip this one',
};
