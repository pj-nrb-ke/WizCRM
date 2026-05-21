/** Parse first non-comment line into http(s) origin (host + port). */
export function parseApiUrlFromFileContents(raw: string): string | null {
  const line = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#'));
  if (!line) return null;

  let s = line.trim();
  if (/^[\d.]+:\d+$/.test(s)) s = `http://${s}`;
  if (/^[\d.]+$/.test(s)) s = `http://${s}:3000`;
  if (!/^https?:\/\//i.test(s)) return null;

  try {
    const u = new URL(s);
    return u.origin;
  } catch {
    return null;
  }
}
