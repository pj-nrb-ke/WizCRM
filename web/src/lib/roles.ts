export function isAdmin(role: string | undefined): boolean {
  return role === 'ADMIN';
}

export function isManager(role: string | undefined): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}
