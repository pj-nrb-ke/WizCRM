import { describe, expect, it } from 'vitest';
import { buildExtendedDesk, buildRulesDesk } from '../src/services/desk-rules.service.js';

const baseLead = {
  id: '1',
  name: 'Acme',
  stage: 'NEW' as const,
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
  priority: null,
  activities: [],
  tasks: [],
};

describe('UT-LITE-005 desk rules fallback', () => {
  it('suggests first contact for new leads', () => {
    const items = buildRulesDesk([baseLead as never]);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].leadId).toBe('1');
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it('extended desk includes hot priority up to 8 items', () => {
    const items = buildExtendedDesk([
      { ...baseLead, priority: 'HOT', name: 'Hot Co' } as never,
      {
        ...baseLead,
        id: '2',
        name: 'Stale Co',
        lastActivityAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        stage: 'CONTACTED',
      } as never,
    ]);
    expect(items.some((i) => i.title.includes('Hot'))).toBe(true);
    expect(items.length).toBeLessThanOrEqual(8);
  });
});
