import { describe, expect, it } from 'vitest';
import { isNextActionSuppressed, shouldApplySuggestedStage } from './ai-rules.js';

describe('UT-LITE-004 AI stage apply gate', () => {
  it('does not apply without applyStage flag', () => {
    expect(shouldApplySuggestedStage(false, 'NEW', 'CONTACTED')).toBe(false);
    expect(shouldApplySuggestedStage(undefined, 'NEW', 'CONTACTED')).toBe(false);
  });

  it('does not apply invalid or backward transitions', () => {
    expect(shouldApplySuggestedStage(true, 'WON', 'NEGOTIATION')).toBe(false);
    expect(shouldApplySuggestedStage(true, 'NEW', 'NOT_A_STAGE')).toBe(false);
  });

  it('applies when user confirms and transition is allowed', () => {
    expect(shouldApplySuggestedStage(true, 'NEW', 'CONTACTED')).toBe(true);
    expect(shouldApplySuggestedStage(true, 'PROPOSAL', 'LOST')).toBe(true);
  });

  it('does not apply when suggested equals current', () => {
    expect(shouldApplySuggestedStage(true, 'QUALIFIED', 'QUALIFIED')).toBe(false);
  });
});

describe('UT-LITE-007 next action dismiss', () => {
  it('suppresses when dismiss is newer than last activity', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const lastActivity = new Date('2026-01-10T00:00:00Z');
    const dismissed = new Date('2026-01-11T00:00:00Z');
    expect(isNextActionSuppressed(dismissed, lastActivity, created)).toBe(true);
  });

  it('does not suppress when activity happened after dismiss', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const dismissed = new Date('2026-01-05T00:00:00Z');
    const lastActivity = new Date('2026-01-10T00:00:00Z');
    expect(isNextActionSuppressed(dismissed, lastActivity, created)).toBe(false);
  });

  it('uses createdAt when lastActivityAt is null', () => {
    const created = new Date('2026-01-10T00:00:00Z');
    const dismissed = new Date('2026-01-11T00:00:00Z');
    expect(isNextActionSuppressed(dismissed, null, created)).toBe(true);
  });
});
