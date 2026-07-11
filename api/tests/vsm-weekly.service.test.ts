import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  vsmConfigFindUnique: vi.fn(),
  vsmRunFindUnique: vi.fn(),
  vsmRunCreate: vi.fn(),
  userFindMany: vi.fn(),
  taskCount: vi.fn(),
  activityCount: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    vsmConfig: { findUnique: prismaMocks.vsmConfigFindUnique },
    vsmRun: { findUnique: prismaMocks.vsmRunFindUnique, create: prismaMocks.vsmRunCreate },
    user: { findMany: prismaMocks.userFindMany },
    task: { count: prismaMocks.taskCount },
    activity: { count: prismaMocks.activityCount },
  },
}));

const sendMock = vi.fn();
vi.mock('../src/services/brevo-mail.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/brevo-mail.js')>('../src/services/brevo-mail.js');
  return { ...actual, sendTransactionalEmail: (...args: unknown[]) => sendMock(...args) };
});

const loadSalesPacingMock = vi.fn();
vi.mock('../src/services/sales-targets.service.js', () => ({
  loadSalesPacing: (...args: unknown[]) => loadSalesPacingMock(...args),
}));

const createOpenAIClientMock = vi.fn();
const chatJsonMock = vi.fn();
vi.mock('../src/services/ai/openai.provider.js', () => ({
  createOpenAIClient: (...args: unknown[]) => createOpenAIClientMock(...args),
  chatJson: (...args: unknown[]) => chatJsonMock(...args),
}));

import { getOrCreateWeeklyRun } from '../src/services/vsm-weekly.service.js';

const VSM_CONFIG = {
  id: 'cfg-1',
  organizationId: 'org-1',
  enabled: true,
  personaName: 'Wanjiru',
  tone: 'warm',
  timezone: 'Africa/Nairobi',
  runWeeklyAt: '16:00',
  workingDays: [1, 2, 3, 4, 5],
  ceoUserIds: ['ceo-1'],
};

describe('getOrCreateWeeklyRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.vsmConfigFindUnique.mockResolvedValue(VSM_CONFIG);
    prismaMocks.vsmRunFindUnique.mockResolvedValue(null);
    prismaMocks.vsmRunCreate.mockImplementation(async ({ data }: { data: unknown }) => ({ id: 'run-1', ...(data as object) }));
    prismaMocks.userFindMany.mockResolvedValue([{ id: 'user-1', name: 'Amina' }]);
    prismaMocks.taskCount.mockResolvedValue(0);
    prismaMocks.activityCount.mockResolvedValue(0);
    loadSalesPacingMock.mockResolvedValue({ reps: [{ userId: 'user-1', pacingLabel: 'On track', achievementPct: 55 }] });
    createOpenAIClientMock.mockReturnValue(null); // deterministic fallback path by default
    sendMock.mockResolvedValue({ method: 'smtp' });
  });

  it('throws when VSM is not enabled', async () => {
    prismaMocks.vsmConfigFindUnique.mockResolvedValue({ ...VSM_CONFIG, enabled: false });
    await expect(getOrCreateWeeklyRun('org-1')).rejects.toThrow('VSM_NOT_ENABLED');
  });

  it('is idempotent — returns the existing run for the day without recomputing', async () => {
    prismaMocks.vsmRunFindUnique.mockResolvedValue({ id: 'existing-run' });
    const run = await getOrCreateWeeklyRun('org-1');
    expect(run).toEqual({ id: 'existing-run' });
    expect(prismaMocks.vsmRunCreate).not.toHaveBeenCalled();
  });

  it('creates a WEEKLY run with per-rep trend + pacing, and emails CEOs', async () => {
    prismaMocks.taskCount.mockResolvedValueOnce(5).mockResolvedValueOnce(2); // this week, last week
    prismaMocks.activityCount.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

    const run = await getOrCreateWeeklyRun('org-1');

    expect(prismaMocks.vsmRunCreate).toHaveBeenCalledTimes(1);
    const created = prismaMocks.vsmRunCreate.mock.calls[0][0].data;
    expect(created.kind).toBe('WEEKLY');
    expect(created.status).toBe('SENT');
    expect(created.planJson.reps[0]).toMatchObject({
      userId: 'user-1',
      tasksCompletedThisWeek: 5,
      tasksCompletedLastWeek: 2,
      trend: 'up',
      pacingLabel: 'On track',
      achievementPct: 55,
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect((run as { kind: string }).kind).toBe('WEEKLY');
  });

  it('does not email CEOs when no ceoUserIds are configured', async () => {
    prismaMocks.vsmConfigFindUnique.mockResolvedValue({ ...VSM_CONFIG, ceoUserIds: [] });
    await getOrCreateWeeklyRun('org-1');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('uses the LLM-grounded coaching observation when a client is available', async () => {
    createOpenAIClientMock.mockReturnValue({});
    chatJsonMock.mockResolvedValue({ observations: [{ userId: 'user-1', note: 'Strong week, on pace.' }] });
    await getOrCreateWeeklyRun('org-1');
    const created = prismaMocks.vsmRunCreate.mock.calls[0][0].data;
    expect(created.planJson.reps[0].observation).toBe('Strong week, on pace.');
  });

  it('fromCron skips on a non-Friday even past 16:00', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T16:30:00Z')); // Thursday
    const run = await getOrCreateWeeklyRun('org-1', { fromCron: true });
    vi.useRealTimers();
    expect(run).toBeNull();
    expect(prismaMocks.vsmRunCreate).not.toHaveBeenCalled();
  });

  it('fromCron runs on Friday at/after 16:00', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T16:05:00Z')); // Friday, EAT = UTC+3 so ~19:05 local — still Friday
    const run = await getOrCreateWeeklyRun('org-1', { fromCron: true });
    vi.useRealTimers();
    expect(run).not.toBeNull();
    expect(prismaMocks.vsmRunCreate).toHaveBeenCalledTimes(1);
  });
});
