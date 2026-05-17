import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('UT-INF-005 AI orchestrator', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns 503 when OPENAI_API_KEY missing', async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
    const { generateLeadSummary } = await import('../src/services/ai/orchestrator.js');
    const fakeLead = {
      id: '1',
      organizationId: 'org',
      name: 'A',
      company: null,
      email: null,
      phone: null,
      source: null,
      stage: 'NEW' as const,
      ownerId: 'u',
      emailNormalized: null,
      phoneNormalized: null,
      lastActivityAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      activities: [],
      tasks: [],
    };
    await expect(generateLeadSummary(fakeLead, 'u')).rejects.toMatchObject({
      message: 'AI_UNAVAILABLE',
    });
    if (prev) process.env.OPENAI_API_KEY = prev;
  });
});
