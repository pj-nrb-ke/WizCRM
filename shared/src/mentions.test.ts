import { describe, expect, it } from 'vitest';
import { extractMentionIdsFromBody, mergeMentionIds } from './mentions.js';

describe('mentions', () => {
  it('extracts uuid from @[Name](id) tokens', () => {
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    expect(extractMentionIdsFromBody(`Hi @[Pat](${id})`)).toEqual([id]);
  });

  it('merges token and @email mentions', () => {
    const users = [
      { id: 'u1', name: 'Pat Smith', email: 'pat@acme.com' },
      { id: 'u2', name: 'Sam Lee', email: 'sam@acme.com' },
    ];
    const ids = mergeMentionIds('Please review @pat', users);
    expect(ids).toContain('u1');
  });
});
