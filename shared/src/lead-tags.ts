import { z } from 'zod';

export const leadTagSchema = z.string().trim().min(1).max(40);

export const leadTagsField = z.array(leadTagSchema).max(20).optional();

/** Dedupe tags case-insensitively, preserve first casing. */
export function normalizeLeadTags(tags?: string[] | null): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}
