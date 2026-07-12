import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({ notificationCreate: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: { notification: { create: prismaMocks.notificationCreate } } }));

const pushMocks = vi.hoisted(() => ({ sendPushToUser: vi.fn() }));
vi.mock('../src/services/fcm-push.service.js', () => ({ sendPushToUser: pushMocks.sendPushToUser }));

import { notifyUser } from '../src/services/notification.service.js';

describe('notifyUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.notificationCreate.mockResolvedValue({ id: 'notif-1' });
    pushMocks.sendPushToUser.mockResolvedValue({ sent: 1 });
  });

  it('creates the in-app notification row', async () => {
    await notifyUser({ organizationId: 'org-1', userId: 'user-1', kind: 'vsm_test', title: 'Title', body: 'Body', linkPath: '/tasks/1' });
    expect(prismaMocks.notificationCreate).toHaveBeenCalledWith({
      data: { organizationId: 'org-1', userId: 'user-1', kind: 'vsm_test', title: 'Title', body: 'Body', linkPath: '/tasks/1' },
    });
  });

  it('also fires a push to the same user', async () => {
    await notifyUser({ organizationId: 'org-1', userId: 'user-1', kind: 'vsm_test', title: 'Title', body: 'Body' });
    expect(pushMocks.sendPushToUser).toHaveBeenCalledWith('user-1', { title: 'Title', body: 'Body', linkPath: undefined });
  });

  it('returns the created notification even when push sends fail (best-effort)', async () => {
    pushMocks.sendPushToUser.mockResolvedValue({ sent: 0 });
    const result = await notifyUser({ organizationId: 'org-1', userId: 'user-1', kind: 'vsm_test', title: 'Title' });
    expect(result).toEqual({ id: 'notif-1' });
  });
});
