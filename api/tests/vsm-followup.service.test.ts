import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  vsmConfigFindUnique: vi.fn(),
  taskFindFirst: vi.fn(),
  taskUpdateFindFirst: vi.fn(),
  taskUpdateCreate: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    vsmConfig: { findUnique: prismaMocks.vsmConfigFindUnique },
    task: { findFirst: prismaMocks.taskFindFirst },
    taskUpdate: { findFirst: prismaMocks.taskUpdateFindFirst, create: prismaMocks.taskUpdateCreate },
  },
}));

const aiMocks = vi.hoisted(() => ({
  createOpenAIClient: vi.fn(),
  chatJson: vi.fn(),
}));

vi.mock('../src/services/ai/openai.provider.js', () => ({
  createOpenAIClient: aiMocks.createOpenAIClient,
  chatJson: aiMocks.chatJson,
}));

const notificationMocks = vi.hoisted(() => ({
  notifyUser: vi.fn(),
}));

vi.mock('../src/services/notification.service.js', () => ({
  notifyUser: notificationMocks.notifyUser,
}));

import { maybeAskFollowUp } from '../src/services/vsm-followup.service.js';

const VSM_CONFIG = { enabled: true, personaName: 'Wanjiru', tone: 'warm' };
const VSM_TASK = { id: 'task-1', organizationId: 'org-1', userId: 'user-1', source: 'VSM', title: 'Chase Acme', reason: 'Stale 8 days' };

describe('maybeAskFollowUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.vsmConfigFindUnique.mockResolvedValue(VSM_CONFIG);
    prismaMocks.taskFindFirst.mockResolvedValue(VSM_TASK);
    prismaMocks.taskUpdateFindFirst.mockResolvedValue(null);
    aiMocks.createOpenAIClient.mockReturnValue({});
    prismaMocks.taskUpdateCreate.mockResolvedValue({ id: 'update-vsm-1' });
    notificationMocks.notifyUser.mockResolvedValue({});
  });

  it('does nothing when VSM is disabled', async () => {
    prismaMocks.vsmConfigFindUnique.mockResolvedValue({ ...VSM_CONFIG, enabled: false });
    const result = await maybeAskFollowUp('org-1', 'task-1', 'called them, will send a quote');
    expect(result).toEqual({ asked: false });
    expect(aiMocks.chatJson).not.toHaveBeenCalled();
  });

  it('does nothing on a USER-sourced task (not VSM-assigned)', async () => {
    prismaMocks.taskFindFirst.mockResolvedValue({ ...VSM_TASK, source: 'USER' });
    const result = await maybeAskFollowUp('org-1', 'task-1', 'done');
    expect(result).toEqual({ asked: false });
    expect(aiMocks.chatJson).not.toHaveBeenCalled();
  });

  it('respects the one-question-per-task-per-day cap', async () => {
    prismaMocks.taskUpdateFindFirst.mockResolvedValue({ id: 'already-asked-today' });
    const result = await maybeAskFollowUp('org-1', 'task-1', 'vague reply');
    expect(result).toEqual({ asked: false });
    expect(aiMocks.chatJson).not.toHaveBeenCalled();
  });

  it('does nothing when no OpenAI client is configured', async () => {
    aiMocks.createOpenAIClient.mockReturnValue(null);
    const result = await maybeAskFollowUp('org-1', 'task-1', 'vague reply');
    expect(result).toEqual({ asked: false });
  });

  it('posts a grounded VSM question when the LLM decides the reply is unclear', async () => {
    aiMocks.chatJson.mockResolvedValue({ shouldAsk: true, question: 'What date did you agree the quote would go out?' });
    const result = await maybeAskFollowUp('org-1', 'task-1', 'spoke to them, seems interested');
    expect(result).toEqual({ asked: true, question: 'What date did you agree the quote would go out?' });
    expect(prismaMocks.taskUpdateCreate).toHaveBeenCalledWith({
      data: { taskId: 'task-1', userId: null, isVsm: true, body: 'What date did you agree the quote would go out?' },
    });
    expect(notificationMocks.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', kind: 'vsm_followup_question' }),
    );
  });

  it('does not post anything when the LLM decides the reply is already clear', async () => {
    aiMocks.chatJson.mockResolvedValue({ shouldAsk: false, question: null });
    const result = await maybeAskFollowUp('org-1', 'task-1', 'called, quote sent, following up Friday');
    expect(result).toEqual({ asked: false });
    expect(prismaMocks.taskUpdateCreate).not.toHaveBeenCalled();
  });
});
