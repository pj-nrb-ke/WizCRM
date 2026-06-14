/** Structured loss reasons for close-as-lost (Phase 1). */
export const DEFAULT_LOSS_REASONS = [
  { code: 'PRICE', label: 'Price / budget' },
  { code: 'TIMING', label: 'Bad timing' },
  { code: 'COMPETITOR', label: 'Chose competitor' },
  { code: 'FIT', label: 'Not a fit' },
  { code: 'NO_BUDGET', label: 'No budget' },
  { code: 'NO_RESPONSE', label: 'No response / ghosted' },
  { code: 'OTHER', label: 'Other' },
] as const;

export type LossReasonCode = (typeof DEFAULT_LOSS_REASONS)[number]['code'];

export const LOSS_REASON_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_LOSS_REASONS.map((r) => [r.code, r.label]),
);

export const DEFAULT_LEAD_SOURCES = [
  'Website',
  'Referral',
  'Cold call',
  'Trade show',
  'LinkedIn',
  'Partner',
  'Inbound email',
  'Other',
] as const;

export function lossReasonLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return LOSS_REASON_LABELS[code] ?? code;
}

export function isValidLossReasonCode(
  code: string,
  allowed: { code: string }[],
): boolean {
  return allowed.some((r) => r.code === code);
}
