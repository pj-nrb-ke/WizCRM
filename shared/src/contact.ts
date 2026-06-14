/** True if lead has at least one phone or email (primary or extra). */
export function hasContactMethod(data: {
  phone?: string | null;
  email?: string | null;
  extraPhones?: string[] | null;
  extraEmails?: string[] | null;
}): boolean {
  if (data.phone?.trim()) return true;
  if (data.email?.trim()) return true;
  if (data.extraPhones?.some((p) => p.trim().length >= 5)) return true;
  if (data.extraEmails?.some((e) => e.trim().length > 0)) return true;
  return false;
}

export function sanitizeStringList(values: string[] | undefined, max = 5): string[] {
  if (!values?.length) return [];
  return values.map((v) => v.trim()).filter(Boolean).slice(0, max);
}
