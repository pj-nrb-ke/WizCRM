import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  teamMemberProfileFindUnique: vi.fn(),
  teamMemberProfileUpdateMany: vi.fn(),
  vsmEscalationFindFirst: vi.fn(),
  vsmEscalationCreate: vi.fn(),
  vsmEscalationUpdate: vi.fn(),
  leadFindMany: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    teamMemberProfile: {
      findUnique: prismaMocks.teamMemberProfileFindUnique,
      updateMany: prismaMocks.teamMemberProfileUpdateMany,
    },
    vsmEscalation: {
      findFirst: prismaMocks.vsmEscalationFindFirst,
      create: prismaMocks.vsmEscalationCreate,
      update: prismaMocks.vsmEscalationUpdate,
    },
    lead: { findMany: prismaMocks.leadFindMany },
  },
}));

import { checkHighValueStalled, flagTaskForHelp, updateSilenceStreak } from '../src/services/vsm-escalation.service.js';

describe('vsm-escalation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.teamMemberProfileUpdateMany.mockResolvedValue({ count: 1 });
    prismaMocks.vsmEscalationCreate.mockResolvedValue({ id: 'esc-new' });
    prismaMocks.vsmEscalationUpdate.mockResolvedValue({ id: 'esc-existing' });
  });

  describe('updateSilenceStreak', () => {
    it('resets the streak to 0 and does not escalate when there was movement today', async () => {
      prismaMocks.teamMemberProfileFindUnique.mockResolvedValue({ silentStreak: 3 });

      const result = await updateSilenceStreak('org-1', 'user-1', 'Amina', true);

      expect(result).toEqual({ streak: 0, escalated: false });
      expect(prismaMocks.teamMemberProfileUpdateMany).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { silentStreak: 0 } });
      expect(prismaMocks.vsmEscalationCreate).not.toHaveBeenCalled();
    });

    it('does not escalate on day 1 of silence', async () => {
      prismaMocks.teamMemberProfileFindUnique.mockResolvedValue({ silentStreak: 0 });

      const result = await updateSilenceStreak('org-1', 'user-1', 'Amina', false);

      expect(result).toEqual({ streak: 1, escalated: false });
      expect(prismaMocks.vsmEscalationCreate).not.toHaveBeenCalled();
    });

    it('escalates once the streak reaches the threshold (2 consecutive silent days)', async () => {
      prismaMocks.teamMemberProfileFindUnique.mockResolvedValue({ silentStreak: 1 });
      prismaMocks.vsmEscalationFindFirst.mockResolvedValue(null); // no existing OPEN escalation

      const result = await updateSilenceStreak('org-1', 'user-1', 'Amina', false);

      expect(result).toEqual({ streak: 2, escalated: true });
      expect(prismaMocks.vsmEscalationCreate).toHaveBeenCalledTimes(1);
      expect(prismaMocks.vsmEscalationCreate.mock.calls[0][0].data).toMatchObject({
        kind: 'REP_UNRESPONSIVE',
        subjectUserId: 'user-1',
      });
    });

    it('de-duplicates — updates the existing OPEN escalation instead of creating a second one', async () => {
      prismaMocks.teamMemberProfileFindUnique.mockResolvedValue({ silentStreak: 2 });
      prismaMocks.vsmEscalationFindFirst.mockResolvedValue({ id: 'esc-existing' }); // already OPEN

      await updateSilenceStreak('org-1', 'user-1', 'Amina', false);

      expect(prismaMocks.vsmEscalationCreate).not.toHaveBeenCalled();
      expect(prismaMocks.vsmEscalationUpdate).toHaveBeenCalledTimes(1);
      expect(prismaMocks.vsmEscalationUpdate.mock.calls[0][0].where).toEqual({ id: 'esc-existing' });
    });
  });

  describe('checkHighValueStalled', () => {
    it('raises a CRITICAL escalation per stalled HOT lead', async () => {
      prismaMocks.leadFindMany.mockResolvedValue([
        { id: 'lead-1', name: 'Acme', company: null, ownerId: 'user-1', owner: { name: 'Amina' }, lastActivityAt: null },
      ]);
      prismaMocks.vsmEscalationFindFirst.mockResolvedValue(null);

      const count = await checkHighValueStalled('org-1', 7);

      expect(count).toBe(1);
      expect(prismaMocks.vsmEscalationCreate.mock.calls[0][0].data).toMatchObject({
        kind: 'HIGH_VALUE_STALLED',
        severity: 'CRITICAL',
        subjectUserId: 'user-1',
      });
    });

    it('does nothing when there are no stalled HOT leads', async () => {
      prismaMocks.leadFindMany.mockResolvedValue([]);
      const count = await checkHighValueStalled('org-1', 7);
      expect(count).toBe(0);
      expect(prismaMocks.vsmEscalationCreate).not.toHaveBeenCalled();
    });
  });

  describe('flagTaskForHelp', () => {
    it('creates a STAFF_FLAGGED escalation carrying the task and note', async () => {
      prismaMocks.vsmEscalationFindFirst.mockResolvedValue(null);

      await flagTaskForHelp('org-1', 'task-1', 'user-1', 'Amina', 'Follow up: Acme', 'Client not responding to calls');

      expect(prismaMocks.vsmEscalationCreate.mock.calls[0][0].data).toMatchObject({
        kind: 'STAFF_FLAGGED',
        subjectUserId: 'user-1',
      });
      expect(prismaMocks.vsmEscalationCreate.mock.calls[0][0].data.evidence.note).toBe('Client not responding to calls');
    });
  });
});
