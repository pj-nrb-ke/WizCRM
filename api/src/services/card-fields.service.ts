/** Maps LLM/OCR JSON keys to lead fields (UT-LITE-003). */
export function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

export function normalizeCardFields(parsed: Record<string, unknown>) {
  return {
    name: pickString(parsed, ['name', 'fullName', 'full_name', 'contactName', 'contact_name']),
    company: pickString(parsed, [
      'company',
      'organization',
      'org',
      'employer',
      'business',
      'companyName',
      'company_name',
    ]),
    email: pickString(parsed, ['email', 'emailAddress', 'email_address']),
    phone: pickString(parsed, ['phone', 'phoneNumber', 'phone_number', 'mobile', 'telephone', 'tel']),
  };
}
