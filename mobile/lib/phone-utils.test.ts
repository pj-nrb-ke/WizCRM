import { describe, expect, it } from 'vitest';
import { digitsOnly } from './phone-utils';

describe('UT-LITE-014 phone utils', () => {
  it('strips non-digits for tel/wa links', () => {
    expect(digitsOnly('+27 (82) 123-4567')).toBe('27821234567');
  });
});
