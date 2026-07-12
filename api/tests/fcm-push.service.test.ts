import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  pushTokenFindMany: vi.fn(),
  pushTokenDeleteMany: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { pushToken: { findMany: prismaMocks.pushTokenFindMany, deleteMany: prismaMocks.pushTokenDeleteMany } },
}));

const configMocks = vi.hoisted(() => ({ loadFirebaseServiceAccount: vi.fn() }));
vi.mock('../src/services/fcm-config.js', () => ({ loadFirebaseServiceAccount: configMocks.loadFirebaseServiceAccount }));

const sendEachForMulticastMock = vi.fn();
const appMocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'wizcrm-fcm' })),
  getApps: vi.fn(() => []),
  cert: vi.fn((c: unknown) => c),
}));
vi.mock('firebase-admin/app', () => ({
  initializeApp: appMocks.initializeApp,
  getApps: appMocks.getApps,
  cert: appMocks.cert,
}));
vi.mock('firebase-admin/messaging', () => ({
  getMessaging: vi.fn(() => ({ sendEachForMulticast: sendEachForMulticastMock })),
}));

import { sendPushToUser } from '../src/services/fcm-push.service.js';

const SERVICE_ACCOUNT = { project_id: 'wizcrm-e784c', client_email: 'sa@wizcrm-e784c.iam.gserviceaccount.com', private_key: 'fake-key' };

describe('sendPushToUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMocks.loadFirebaseServiceAccount.mockReturnValue(SERVICE_ACCOUNT);
    appMocks.getApps.mockReturnValue([]);
  });

  it('does nothing when Firebase is not configured', async () => {
    configMocks.loadFirebaseServiceAccount.mockReturnValue(null);
    const result = await sendPushToUser('user-1', { title: 'Hi', body: 'Body' });
    expect(result).toEqual({ sent: 0 });
    expect(prismaMocks.pushTokenFindMany).not.toHaveBeenCalled();
  });

  it('does nothing when the user has no registered devices', async () => {
    prismaMocks.pushTokenFindMany.mockResolvedValue([]);
    const result = await sendPushToUser('user-1', { title: 'Hi', body: 'Body' });
    expect(result).toEqual({ sent: 0 });
    expect(sendEachForMulticastMock).not.toHaveBeenCalled();
  });

  it('sends to every registered token and returns the success count', async () => {
    prismaMocks.pushTokenFindMany.mockResolvedValue([
      { id: 'pt-1', token: 'tok-1' },
      { id: 'pt-2', token: 'tok-2' },
    ]);
    sendEachForMulticastMock.mockResolvedValue({
      successCount: 2,
      responses: [{ success: true }, { success: true }],
    });
    const result = await sendPushToUser('user-1', { title: 'Hi', body: 'Body', linkPath: '/tasks/1' });
    expect(result).toEqual({ sent: 2 });
    expect(sendEachForMulticastMock).toHaveBeenCalledWith({
      tokens: ['tok-1', 'tok-2'],
      notification: { title: 'Hi', body: 'Body' },
      data: { linkPath: '/tasks/1' },
    });
    expect(prismaMocks.pushTokenDeleteMany).not.toHaveBeenCalled();
  });

  it('prunes tokens FCM reports as dead', async () => {
    prismaMocks.pushTokenFindMany.mockResolvedValue([
      { id: 'pt-1', token: 'tok-1' },
      { id: 'pt-2', token: 'tok-2' },
    ]);
    sendEachForMulticastMock.mockResolvedValue({
      successCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    });
    const result = await sendPushToUser('user-1', { title: 'Hi', body: 'Body' });
    expect(result).toEqual({ sent: 1 });
    expect(prismaMocks.pushTokenDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['pt-2'] } } });
  });

  it('is best-effort — returns sent:0 instead of throwing when FCM send fails', async () => {
    prismaMocks.pushTokenFindMany.mockResolvedValue([{ id: 'pt-1', token: 'tok-1' }]);
    sendEachForMulticastMock.mockRejectedValue(new Error('network error'));
    const result = await sendPushToUser('user-1', { title: 'Hi', body: 'Body' });
    expect(result).toEqual({ sent: 0 });
  });
});
