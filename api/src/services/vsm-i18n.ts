/**
 * Swahili touches (VSM-SPEC §4.2 "language (English default; Swahili phrases
 * optional later)" — Phase 3). Deliberately light: greeting/sign-off phrases
 * only, not a full translation layer. English stays the default in every
 * case where `language` isn't explicitly 'sw'.
 */

export type VsmLanguage = 'en' | 'sw';

export function morningGreeting(language: string, name: string): string {
  return language === 'sw' ? `Habari za asubuhi ${name}` : `Good morning ${name}`;
}

export function eodCheckIn(language: string): string {
  return language === 'sw' ? 'Kuna kinachokuzuia?' : 'Anything blocking you?';
}

export function signOff(language: string, personaName: string): string {
  return language === 'sw' ? `Imetumwa kiotomatiki na ${personaName}.` : `Sent automatically by ${personaName}.`;
}
