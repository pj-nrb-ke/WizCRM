import { describe, expect, it } from 'vitest';
import { JANE_GREETING, JANE_INSTRUCTIONS } from './jane.js';

describe('Jane persona', () => {
  it('forbids inventing prices, discounts or promises she cannot keep', () => {
    expect(JANE_INSTRUCTIONS).toMatch(/never invent prices/i);
    expect(JANE_INSTRUCTIONS).toMatch(/cannot book anything, send anything/i);
    expect(JANE_INSTRUCTIONS).toMatch(/never say "i will schedule"/i);
  });

  it('requires disclosing she is an automated assistant if asked', () => {
    expect(JANE_INSTRUCTIONS).toMatch(/never claim to be human/i);
  });

  it('greeting discloses recording and automation up front (KDPA)', () => {
    expect(JANE_GREETING).toMatch(/automated assistant/i);
    expect(JANE_GREETING).toMatch(/recorded/i);
  });
});
