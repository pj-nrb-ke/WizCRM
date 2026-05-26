import { LEAD_STAGES, type LeadStage } from './stages.js';

/** Open pipeline stages used for funnel (excludes terminal). */
export const FUNNEL_STAGES = LEAD_STAGES.filter(
  (s) => s !== 'WON' && s !== 'LOST',
) as LeadStage[];

export function stageIndex(stage: string): number {
  const idx = LEAD_STAGES.indexOf(stage as LeadStage);
  return idx >= 0 ? idx : 0;
}

/** Highest pipeline stage index a lead has reached (current stage or via history). */
export function maxStageIndexReached(currentStage: string, toStages: string[]): number {
  let max = stageIndex(currentStage);
  for (const s of toStages) {
    max = Math.max(max, stageIndex(s));
  }
  return max;
}
