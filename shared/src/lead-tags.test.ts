import { describe, expect, it } from 'vitest';
import { normalizeLeadTags } from './lead-tags.js';

describe('normalizeLeadTags', () => {
  it('dedupes case-insensitively', () => {
    expect(normalizeLeadTags(['VIP', 'vip', ' Enterprise '])).toEqual(['VIP', 'Enterprise']);
  });

  it('caps at 20 tags', () => {
    const many = Array.from({ length: 25 }, (_, i) => `tag${i}`);
    expect(normalizeLeadTags(many)).toHaveLength(20);
  });
});
