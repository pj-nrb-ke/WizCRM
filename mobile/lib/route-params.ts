/** Expo Router may pass params as string or string[]. */
export function oneParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed || undefined;
}
