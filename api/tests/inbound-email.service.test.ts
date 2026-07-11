import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  taskFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  taskUpdateCreate: vi.fn(),
  inboundEmailCreate: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    task: { findUnique: prismaMocks.taskFindUnique },
    user: { findUnique: prismaMocks.userFindUnique },
    taskUpdate: { create: prismaMocks.taskUpdateCreate },
    inboundEmail: { create: prismaMocks.inboundEmailCreate },
  },
}));

vi.mock('../src/config.js', () => ({
  config: { brevoInboundDomain: 'reply.wizag.co.ke' },
}));

import { processBrevoInboundPayload } from '../src/services/inbound-email.service.js';

const TASK_ID = '11111111-1111-1111-1111-111111111111';

describe('inbound-email.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.taskUpdateCreate.mockResolvedValue({ id: 'update-1' });
    prismaMocks.inboundEmailCreate.mockResolvedValue({ id: 'inbound-1' });
  });

  it('creates a TaskUpdate when the reply address matches a task and the sender is a known user in the same org', async () => {
    prismaMocks.taskFindUnique.mockResolvedValue({ id: TASK_ID, organizationId: 'org-1' });
    prismaMocks.userFindUnique.mockResolvedValue({ id: 'user-1', organizationId: 'org-1', email: 'amina@wizag.co.ke' });

    const result = await processBrevoInboundPayload({
      items: [
        {
          From: { Address: 'amina@wizag.co.ke', Name: 'Amina' },
          Recipients: [`task-${TASK_ID}@reply.wizag.co.ke`],
          Subject: 'Re: Follow up',
          ExtractedMarkdownMessage: 'Called them, quote sent.',
        },
      ],
    });

    expect(result).toEqual({ processed: 1, matched: 1 });
    expect(prismaMocks.taskUpdateCreate).toHaveBeenCalledWith({
      data: { taskId: TASK_ID, userId: 'user-1', body: 'Called them, quote sent.' },
    });
    const inboundData = prismaMocks.inboundEmailCreate.mock.calls[0][0].data;
    expect(inboundData.matchedTaskId).toBe(TASK_ID);
    expect(inboundData.matchedUserId).toBe('user-1');
    expect(inboundData.createdUpdateId).toBe('update-1');
  });

  it('logs unmatched when the sender is from a different organization than the task', async () => {
    prismaMocks.taskFindUnique.mockResolvedValue({ id: TASK_ID, organizationId: 'org-1' });
    prismaMocks.userFindUnique.mockResolvedValue({ id: 'user-2', organizationId: 'org-2', email: 'stranger@example.com' });

    const result = await processBrevoInboundPayload({
      items: [
        {
          From: { Address: 'stranger@example.com' },
          Recipients: [`task-${TASK_ID}@reply.wizag.co.ke`],
          ExtractedMarkdownMessage: 'hi',
        },
      ],
    });

    expect(result).toEqual({ processed: 1, matched: 0 });
    expect(prismaMocks.taskUpdateCreate).not.toHaveBeenCalled();
    expect(prismaMocks.inboundEmailCreate.mock.calls[0][0].data.matchedTaskId).toBeNull();
  });

  it('logs unmatched when the address has no task- prefix', async () => {
    const result = await processBrevoInboundPayload({
      items: [
        {
          From: { Address: 'someone@example.com' },
          Recipients: ['info@reply.wizag.co.ke'],
          Subject: 'General inquiry',
          RawTextBody: 'hello',
        },
      ],
    });

    expect(result).toEqual({ processed: 1, matched: 0 });
    expect(prismaMocks.taskFindUnique).not.toHaveBeenCalled();
    const inboundData = prismaMocks.inboundEmailCreate.mock.calls[0][0].data;
    expect(inboundData.matchedTaskId).toBeNull();
    expect(inboundData.bodyText).toBe('hello');
    expect(inboundData.toEmail).toBe('info@reply.wizag.co.ke');
  });

  it('handles an empty items array', async () => {
    const result = await processBrevoInboundPayload({ items: [] });
    expect(result).toEqual({ processed: 0, matched: 0 });
    expect(prismaMocks.inboundEmailCreate).not.toHaveBeenCalled();
  });
});
