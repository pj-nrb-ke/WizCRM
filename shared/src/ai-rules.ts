import { isAllowedStageTransition, isLeadStage, type LeadStage } from './stages.js';

/** Post-call / AI stage: only apply when user explicitly opts in and transition is valid. */
export function shouldApplySuggestedStage(
  applyStage: boolean | undefined,
  currentStage: LeadStage,
  suggestedStage?: string,
): boolean {
  if (!applyStage || !suggestedStage || suggestedStage === currentStage) {
    return false;
  }
  if (!isLeadStage(suggestedStage)) return false;
  return isAllowedStageTransition(currentStage, suggestedStage);
}

/** Suppress next-action when dismissed after the lead's last activity anchor. */
export function isNextActionSuppressed(
  dismissedAt: Date | null | undefined,
  leadLastActivityAt: Date | null | undefined,
  leadCreatedAt: Date,
): boolean {
  if (!dismissedAt) return false;
  const anchor = leadLastActivityAt ?? leadCreatedAt;
  return dismissedAt >= anchor;
}
