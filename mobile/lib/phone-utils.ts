/** Digits only — for WhatsApp wa.me (no +). */
export function digitsOnly(phone: string) {
  return phone.replace(/\D/g, '');
}

/** tel: URI keeps leading + for international dialling. */
export function telUri(phone: string) {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = digitsOnly(trimmed);
  if (!digits) return 'tel:';
  return hasPlus ? `tel:+${digits}` : `tel:${digits}`;
}

export function whatsAppUri(phone: string, native: boolean) {
  const digits = digitsOnly(phone);
  if (native) return `whatsapp://send?phone=${digits}`;
  return `https://wa.me/${digits}`;
}
