import { describe, expect, it } from 'vitest';
import { buildRulesDesk } from '../src/services/desk-rules.service.js';

describe('UT-LITE-005 desk rules fallback', () => {
  it('suggests first contact for new leads', () => {
    const items = buildRulesDesk([
      {
        id: '1',
        name: 'Acme',
        stage: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: null,
        organizationId: 'o',
        ownerId: 'u',
        company: null,
        email: null,
        phone: null,
        emailNormalized: null,
        phoneNormalized: null,
        source: null,
        activities: [],
        tasks: [],
      } as never,
    ]);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].leadId).toBe('1');
  });
});
