import { describe, expect, it } from 'vitest';
import { buildLeadInsights } from '../src/services/lead-insights.service.js';

describe('lead insights (PRO-003 / PRO-008)', () => {
  it('flags missing contact and stale leads', () => {
    const insights = buildLeadInsights({
      id: '1',
      organizationId: 'o',
      ownerId: 'u',
      name: 'Test',
      company: null,
      email: null,
      phone: null,
      source: null,
      priority: 'HOT',
      stage: 'NEW',
      lastActivityAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      emailNormalized: null,
      phoneNormalized: null,
      tasks: [],
    });
    expect(insights.hygiene.some((h) => h.includes('Missing'))).toBe(true);
    expect(insights.scores.urgency).toBeGreaterThan(50);
  });
});
