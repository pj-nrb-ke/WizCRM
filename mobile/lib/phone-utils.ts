export function digitsOnly(phone: string) {
  return phone.replace(/\D/g, '');
}
