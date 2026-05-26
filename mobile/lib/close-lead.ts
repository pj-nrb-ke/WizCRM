/** Local mirror of @wizcrm/shared close-lead (Metro does not bundle the workspace package). */

export const DEFAULT_LOSS_REASONS = [
  { code: 'PRICE', label: 'Price / budget' },
  { code: 'TIMING', label: 'Bad timing' },
  { code: 'COMPETITOR', label: 'Chose competitor' },
  { code: 'FIT', label: 'Not a fit' },
  { code: 'NO_BUDGET', label: 'No budget' },
  { code: 'NO_RESPONSE', label: 'No response / ghosted' },
  { code: 'OTHER', label: 'Other' },
] as const;

const LOSS_REASON_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_LOSS_REASONS.map((r) => [r.code, r.label]),
);

export function lossReasonLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return LOSS_REASON_LABELS[code] ?? code;
}
