import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const chatJson = vi.fn();
const aiSuggestionCreate = vi.fn();
const aiAuditCreate = vi.fn();

vi.mock('../src/services/ai/openai.provider.js', () => ({
  createOpenAIClient: () => ({}),
  chatJson: (...args: unknown[]) => chatJson(...args),
  transcribeAudio: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    aiSuggestion: { create: (...args: unknown[]) => aiSuggestionCreate(...args) },
    aiAuditLog: { create: (...args: unknown[]) => aiAuditCreate(...args) },
  },
}));

describe('UT-LITE-004 suggestStage does not auto-apply invalid stage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    chatJson.mockReset();
    aiSuggestionCreate.mockReset();
    aiAuditCreate.mockResolvedValue({});
    aiSuggestionCreate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('clamps illegal AI suggestion to current stage', async () => {
    chatJson.mockResolvedValue({
      suggestedStage: 'NEGOTIATION',
      reason: 'Reopen deal',
    });
    const { suggestStage } = await import('../src/services/ai/orchestrator.js');
    const lead = {
      id: 'lead-1',
      organizationId: 'org',
      name: 'Test',
      company: null,
      email: null,
      phone: null,
      source: null,
      stage: 'WON' as const,
      ownerId: 'u',
      emailNormalized: null,
      phoneNormalized: null,
      lastActivityAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      activities: [],
      tasks: [],
    };
    const result = await suggestStage(lead, 'u');
    expect(result.suggestedStage).toBe('WON');
    expect(aiSuggestionCreate).toHaveBeenCalled();
  });
});
