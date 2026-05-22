import { describe, expect, it } from 'vitest';
import { isLastCallStale, parseLastCallLead } from './call-return-logic';

describe('UT-LITE-009 call return prompt logic', () => {
  it('parses stored call payload', () => {
    const raw = JSON.stringify({
      leadId: 'abc',
      leadName: 'Acme',
      at: new Date().toISOString(),
    });
    expect(parseLastCallLead(raw)?.leadId).toBe('abc');
  });

  it('expires stale call markers', () => {
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(isLastCallStale(old, Date.now(), 2 * 60 * 60 * 1000)).toBe(true);
  });
});
