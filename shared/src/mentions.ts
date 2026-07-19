/** Extract user IDs from `@[Name](uuid)` tokens (composer format). */
export function extractMentionIdsFromBody(body: string): string[] {
  const ids = new Set<string>();
  const re = /@\[[^\]]+\]\(([0-9a-f-]{36})\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    ids.add(m[1]!);
  }
  return [...ids];
}

export type MentionableUser = { id: string; name: string; email: string };

/** Fallback: match @email or @FirstName against org users (case-insensitive). */
export function resolveMentionIdsFromText(
  body: string,
  users: MentionableUser[],
  already: string[] = [],
): string[] {
  const ids = new Set(already);
  const lower = body.toLowerCase();
  for (const u of users) {
    if (ids.has(u.id)) continue;
    const emailLocal = u.email.split('@')[0]?.toLowerCase();
    if (emailLocal && lower.includes(`@${emailLocal}`)) {
      ids.add(u.id);
      continue;
    }
    const first = u.name.trim().split(/\s+/)[0]?.toLowerCase();
    if (first && first.length >= 2 && lower.includes(`@${first}`)) {
      ids.add(u.id);
    }
  }
  return [...ids];
}

export function mergeMentionIds(body: string, users: MentionableUser[]): string[] {
  const fromTokens = extractMentionIdsFromBody(body);
  return resolveMentionIdsFromText(body, users, fromTokens);
}

/** Renders `@[Name](uuid)` composer tokens as plain `@Name` for notifications and previews. */
export function stripMentionMarkup(body: string): string {
  return body.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi, '@$1');
}
