/** User-facing message when fetch fails (production vs dev API). */
export function formatNetworkError(apiUrl: string): string {
  if (/wizcrm\.app/i.test(apiUrl) || apiUrl.startsWith('https://')) {
    return `Cannot reach ${apiUrl}. Check Wi‑Fi or mobile data and try again.`;
  }
  return `Cannot reach ${apiUrl}. On your PC run scripts\\start-api.ps1, or change API URL on the login screen.`;
}
