export function isManagerRole(role: string | undefined): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}
