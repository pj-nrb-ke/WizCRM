import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('UT-INF-005 AI orchestrator', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 when OPENAI_API_KEY missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
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
  });
});

describe('UT-LITE-006 lead summary', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws AI_UNAVAILABLE without API key (regen path gated on client)', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { generateLeadSummary } = await import('../src/services/ai/orchestrator.js');
    const lead = {
      id: '1',
      organizationId: 'org',
      name: 'Sum Lead',
      company: 'Co',
      email: 'a@test.local',
      phone: null,
      source: null,
      stage: 'CONTACTED' as const,
      ownerId: 'u',
      emailNormalized: 'a@test.local',
      phoneNormalized: null,
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      activities: [{ id: 'act1', type: 'NOTE', body: 'Called', createdAt: new Date() }],
      tasks: [],
    };
    await expect(generateLeadSummary(lead, 'u')).rejects.toMatchObject({
      message: 'AI_UNAVAILABLE',
    });
  });
});
