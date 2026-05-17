import { describe, expect, it } from 'vitest';
import { isAllowedStageTransition } from './stages.js';

describe('UT-LITE-004 stage transitions', () => {
  it('allows forward progression', () => {
    expect(isAllowedStageTransition('NEW', 'CONTACTED')).toBe(true);
    expect(isAllowedStageTransition('CONTACTED', 'QUALIFIED')).toBe(true);
  });

  it('allows lost from any non-won stage', () => {
    expect(isAllowedStageTransition('PROPOSAL', 'LOST')).toBe(true);
  });

  it('blocks won to earlier sales stages', () => {
    expect(isAllowedStageTransition('WON', 'NEGOTIATION')).toBe(false);
  });

  it('allows reopen from lost', () => {
    expect(isAllowedStageTransition('LOST', 'CONTACTED')).toBe(true);
  });
});
