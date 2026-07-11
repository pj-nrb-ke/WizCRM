import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  vsmConfigFindUnique: vi.fn(),
  vsmRunFindUnique: vi.fn(),
  vsmRunCreate: vi.fn(),
  vsmRunUpdate: vi.fn(),
  vsmRunFindUniqueEod: vi.fn(),
  taskCreate: vi.fn(),
  taskCount: vi.fn(),
  taskFindMany: vi.fn(),
  taskUpdateCount: vi.fn(),
  notificationCreate: vi.fn(),
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    vsmConfig: { findUnique: prismaMocks.vsmConfigFindUnique },
    vsmRun: {
      findUnique: prismaMocks.vsmRunFindUnique,
      create: prismaMocks.vsmRunCreate,
      update: prismaMocks.vsmRunUpdate,
    },
    task: {
      create: prismaMocks.taskCreate,
      count: prismaMocks.taskCount,
      findMany: prismaMocks.taskFindMany,
    },
    taskUpdate: { count: prismaMocks.taskUpdateCount },
    notification: { create: prismaMocks.notificationCreate },
    user: { findUnique: prismaMocks.userFindUnique, findMany: prismaMocks.userFindMany },
  },
}));

const sendMock = vi.fn();
vi.mock('../src/services/brevo-mail.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/brevo-mail.js')>('../src/services/brevo-mail.js');
  return {
    ...actual,
    sendTransactionalEmail: (...args: unknown[]) => sendMock(...args),
  };
});

const generateMorningPlanMock = vi.fn();
vi.mock('../src/services/vsm-planning.service.js', () => ({
  generateMorningPlan: (...args: unknown[]) => generateMorningPlanMock(...args),
}));

import { getOrCreateMorningRun, sendMorningRun } from '../src/services/vsm-execution.service.js';

const VSM_CONFIG = {
  id: 'cfg-1',
  organizationId: 'org-1',
  autonomy: 'DRAFT',
  enabled: true,
  personaName: 'Wanjiru',
  ceoUserIds: [],
  taskCapPerDay: 5,
};

const SAMPLE_PLAN = {
  generatedAt: new Date().toISOString(),
  taskCapPerDay: 5,
  people: [
    {
      userId: 'user-1',
      userName: 'Amina',
      items: [
        {
          rule: 'R1_STALE_LEAD',
          createsTask: true,
          title: 'Follow up: Acme',
          reason: 'quiet 9 days',
          evidence: { leadId: 'lead-1' },
          included: true,
        },
      ],
      carryover: [],
    },
  ],
};

describe('vsm-execution.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue({ method: 'smtp' });
    prismaMocks.vsmConfigFindUnique.mockResolvedValue(VSM_CONFIG);
    prismaMocks.taskCreate.mockResolvedValue({ id: 'new-task-1' });
    prismaMocks.notificationCreate.mockResolvedValue({});
    prismaMocks.userFindUnique.mockResolvedValue({ email: 'amina@wizag.co.ke', name: 'Amina' });
  });

  describe('getOrCreateMorningRun', () => {
    it('is idempotent — a second call for the same day returns the existing run without regenerating the plan', async () => {
      const existingRun = { id: 'run-1', status: 'DRAFT' };
      prismaMocks.vsmRunFindUnique.mockResolvedValue(existingRun);

      const run = await getOrCreateMorningRun('org-1');

      expect(run).toBe(existingRun);
      expect(generateMorningPlanMock).not.toHaveBeenCalled();
      expect(prismaMocks.vsmRunCreate).not.toHaveBeenCalled();
    });

    it('generates and stores a new DRAFT run when none exists for today', async () => {
      prismaMocks.vsmRunFindUnique.mockResolvedValue(null);
      generateMorningPlanMock.mockResolvedValue(SAMPLE_PLAN);
      prismaMocks.vsmRunCreate.mockResolvedValue({ id: 'run-2', status: 'DRAFT', planJson: SAMPLE_PLAN });

      const run = await getOrCreateMorningRun('org-1');

      expect(generateMorningPlanMock).toHaveBeenCalledWith('org-1', VSM_CONFIG);
      expect(prismaMocks.vsmRunCreate).toHaveBeenCalledTimes(1);
      expect(run).toEqual({ id: 'run-2', status: 'DRAFT', planJson: SAMPLE_PLAN });
    });

    it('throws VSM_NOT_ENABLED when the org has not turned VSM on', async () => {
      prismaMocks.vsmConfigFindUnique.mockResolvedValue({ ...VSM_CONFIG, enabled: false });
      await expect(getOrCreateMorningRun('org-1')).rejects.toThrow('VSM_NOT_ENABLED');
    });
  });

  describe('sendMorningRun', () => {
    it('creates one Task per included item, sends one email per person with the first task as Reply-To, and marks the run SENT', async () => {
      prismaMocks.vsmRunFindUnique.mockResolvedValue({
        id: 'run-3',
        status: 'DRAFT',
        organizationId: 'org-1',
        planJson: SAMPLE_PLAN,
      });
      prismaMocks.vsmRunUpdate.mockResolvedValue({ id: 'run-3', status: 'SENT' });

      await sendMorningRun('run-3', 'ceo-user-1');

      expect(prismaMocks.taskCreate).toHaveBeenCalledTimes(1);
      expect(prismaMocks.taskCreate.mock.calls[0][0].data).toMatchObject({
        organizationId: 'org-1',
        userId: 'user-1',
        title: 'Follow up: Acme',
        source: 'VSM',
      });
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock.mock.calls[0][0].replyTo.email).toBe('task-new-task-1@reply.wizag.co.ke');
      expect(prismaMocks.vsmRunUpdate).toHaveBeenCalledWith({
        where: { id: 'run-3' },
        data: expect.objectContaining({ status: 'SENT', approvedBy: 'ceo-user-1' }),
      });
    });

    it('is idempotent — calling it again on an already-SENT run does nothing further', async () => {
      prismaMocks.vsmRunFindUnique.mockResolvedValue({ id: 'run-4', status: 'SENT', organizationId: 'org-1', planJson: SAMPLE_PLAN });

      const result = await sendMorningRun('run-4', 'ceo-user-1');

      expect(result).toEqual({ id: 'run-4', status: 'SENT', organizationId: 'org-1', planJson: SAMPLE_PLAN });
      expect(prismaMocks.taskCreate).not.toHaveBeenCalled();
      expect(sendMock).not.toHaveBeenCalled();
    });
  });
});
