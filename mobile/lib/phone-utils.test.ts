import { describe, expect, it } from 'vitest';
import { digitsOnly, telUri, whatsAppUri } from './phone-utils';

describe('UT-LITE-014 phone utils', () => {
  it('strips non-digits for WhatsApp', () => {
    expect(digitsOnly('+27 (82) 123-4567')).toBe('27821234567');
  });

  it('keeps plus in tel URI for international dial', () => {
    expect(telUri('+27 82 123 4567')).toBe('tel:+27821234567');
    expect(telUri('0821234567')).toBe('tel:0821234567');
  });

  it('builds WhatsApp native and web URLs', () => {
    expect(whatsAppUri('+27821234567', true)).toBe('whatsapp://send?phone=27821234567');
    expect(whatsAppUri('+27821234567', false)).toBe('https://wa.me/27821234567');
  });
});
