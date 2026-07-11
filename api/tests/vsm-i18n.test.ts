import { describe, expect, it } from 'vitest';
import { eodCheckIn, morningGreeting, signOff } from '../src/services/vsm-i18n.js';

describe('vsm-i18n', () => {
  it('defaults to English for any non-"sw" language, including unset', () => {
    expect(morningGreeting('en', 'Amina')).toBe('Good morning Amina');
    expect(morningGreeting('fr', 'Amina')).toBe('Good morning Amina');
    expect(eodCheckIn('en')).toBe('Anything blocking you?');
    expect(signOff('en', 'Wanjiru')).toBe('Sent automatically by Wanjiru.');
  });

  it('uses Swahili phrases when language is "sw"', () => {
    expect(morningGreeting('sw', 'Amina')).toBe('Habari za asubuhi Amina');
    expect(eodCheckIn('sw')).toBe('Kuna kinachokuzuia?');
    expect(signOff('sw', 'Wanjiru')).toBe('Imetumwa kiotomatiki na Wanjiru.');
  });
});
