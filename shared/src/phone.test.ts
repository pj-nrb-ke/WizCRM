import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone.js';

describe('UT-LITE-002 phone normalize', () => {
  it('strips formatting', () => {
    expect(normalizePhone('+27 (82) 123-4567')).toBe('+27821234567');
  });

  it('keeps digits only without plus', () => {
    expect(normalizePhone('082 123 4567')).toBe('0821234567');
  });
});
