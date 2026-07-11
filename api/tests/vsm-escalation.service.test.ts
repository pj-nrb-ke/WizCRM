import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  teamMemberProfileFindUnique: vi.fn(),
  teamMemberProfileUpdateMany: vi.fn(),
  vsmEscalationFindFirst: vi.fn(),
  vsmEscalationCreate: vi.fn(),
  vsmEscalationUpdate: vi.fn(),
  leadFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  userFindUnique: vi.fn(),
}));

const mailMocks = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
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
    notification: { create: prismaMocks.notificationCreate },
    user: { findUnique: prismaMocks.userFindUnique },
  },
}));

vi.mock('../src/services/brevo-mail.js', async () => {
  const actual = await vi.importActual('../src/services/brevo-mail.js');
  return { ...actual, sendTransactionalEmail: mailMocks.sendTransactionalEmail };
});

import { checkHighValueStalled, flagTaskForHelp, updateSilenceStreak } from '../src/services/vsm-escalation.service.js';

const PERSONA = { name: 'Wanjiru' };

describe('vsm-escalation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.teamMemberProfileUpdateMany.mockResolvedValue({ count: 1 });
    prismaMocks.vsmEscalationCreate.mockResolvedValue({ id: 'esc-new' });
    prismaMocks.vsmEscalationUpdate.mockResolvedValue({ id: 'esc-existing' });
    prismaMocks.notificationCreate.mockResolvedValue({ id: 'notif-1' });
    prismaMocks.userFindUnique.mockResolvedValue({ email: 'amina@wizag.biz', name: 'Amina' });
    mailMocks.sendTransactionalEmail.mockResolvedValue({ method: 'smtp' });
  });

  describe('updateSilenceStreak', () => {
    it('resets the streak to 0 and does not escalate when there was movement today', async () => {
      prismaMocks.teamMemberProfileFindUnique.mockResolvedValue({ silentStreak: 3 });

      const result = await updateSilenceStreak('org-1', 'user-1', 'Amina', true, PERSONA);

      expect(result).toEqual({ streak: 0, nudged: false, escalated: false });
      expect(prismaMocks.teamMemberProfileUpdateMany).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { silentStreak: 0 } });
      expect(prismaMocks.vsmEscalationCreate).not.toHaveBeenCalled();
    });

    it('does not nudge or escalate on day 1 of silence', async () => {
      prismaMocks.teamMemberProfileFindUnique.mockResolvedValue({ silentStreak: 0 });

      const result = await updateSilenceStreak('org-1', 'user-1', 'Amina', false, PERSONA);

      expect(result).toEqual({ streak: 1, nudged: false, escalated: false });
      expect(prismaMocks.vsmEscalationCreate).not.toHaveBeenCalled();
      expect(prismaMocks.notificationCreate).not.toHaveBeenCalled();
    });

    it('sends a gentle named nudge on day 2 of silence, no escalation yet', async () => {
      prismaMocks.teamMemberProfileFindUnique.mockResolvedValue({ silentStreak: 1 });

      const result = await updateSilenceStreak('org-1', 'user-1', 'Amina', false, PERSONA);

      expect(result).toEqual({ streak: 2, nudged: true, escalated: false });
      expect(prismaMocks.vsmEscalationCreate).not.toHaveBeenCalled();
      expect(prismaMocks.notificationCreate).toHaveBeenCalledTimes(1);
      expect(prismaMocks.notificationCreate.mock.calls[0][0].data).toMatchObject({ userId: 'user-1', kind: 'vsm_silence_nudge' });
      expect(mailMocks.sendTransactionalEmail).toHaveBeenCalledTimes(1);
    });

    it('escalates once the streak reaches the threshold (3 consecutive silent days)', async () => {
      prismaMocks.teamMemberProfileFindUnique.mockResolvedValue({ silentStreak: 2 });
      prismaMocks.vsmEscalationFindFirst.mockResolvedValue(null); // no existing OPEN escalation

      const result = await updateSilenceStreak('org-1', 'user-1', 'Amina', false, PERSONA);

      expect(result).toEqual({ streak: 3, nudged: false, escalated: true });
      expect(prismaMocks.vsmEscalationCreate).toHaveBeenCalledTimes(1);
      expect(prismaMocks.vsmEscalationCreate.mock.calls[0][0].data).toMatchObject({
        kind: 'REP_UNRESPONSIVE',
        subjectUserId: 'user-1',
      });
    });

    it('de-duplicates — updates the existing OPEN escalation instead of creating a second one', async () => {
      prismaMocks.teamMemberProfileFindUnique.mockResolvedValue({ silentStreak: 3 });
      prismaMocks.vsmEscalationFindFirst.mockResolvedValue({ id: 'esc-existing' }); // already OPEN

      await updateSilenceStreak('org-1', 'user-1', 'Amina', false, PERSONA);

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
