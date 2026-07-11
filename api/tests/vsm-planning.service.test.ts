import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  leadFindMany: vi.fn(),
  taskFindMany: vi.fn(),
  taskFindFirst: vi.fn(),
  calendarEventFindMany: vi.fn(),
  userFindMany: vi.fn(),
  aiAuditLogCreate: vi.fn(),
  organizationFindUnique: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    lead: { findMany: prismaMocks.leadFindMany },
    task: { findMany: prismaMocks.taskFindMany, findFirst: prismaMocks.taskFindFirst },
    calendarEvent: { findMany: prismaMocks.calendarEventFindMany },
    user: { findMany: prismaMocks.userFindMany },
    aiAuditLog: { create: prismaMocks.aiAuditLogCreate },
    organization: { findUnique: prismaMocks.organizationFindUnique },
  },
}));

// No OpenAI client configured — exercises the deterministic fallback path.
vi.mock('../src/services/ai/openai.provider.js', () => ({
  createOpenAIClient: () => null,
  chatJson: vi.fn(),
}));

import { generateCandidates, generateMorningPlan } from '../src/services/vsm-planning.service.js';

describe('vsm-planning.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.organizationFindUnique.mockResolvedValue({ settings: {} });
    prismaMocks.leadFindMany.mockResolvedValue([]);
    prismaMocks.taskFindMany.mockResolvedValue([]);
    prismaMocks.calendarEventFindMany.mockResolvedValue([]);
    prismaMocks.taskFindFirst.mockResolvedValue(null);
    prismaMocks.aiAuditLogCreate.mockResolvedValue({});
  });

  describe('generateCandidates', () => {
    it('skips a stale lead that already has an open VSM task (dedup)', async () => {
      prismaMocks.leadFindMany.mockImplementation((args: { where?: { activities?: unknown } }) => {
        // First call in the service is staleLeads, third is unworkedLeads (has activities:none filter)
        if (args?.where?.activities) return Promise.resolve([]);
        return Promise.resolve([
          { id: 'lead-1', name: 'Acme', company: null, stage: 'CONTACTED', ownerId: 'user-1', lastActivityAt: null },
        ]);
      });
      prismaMocks.taskFindFirst.mockResolvedValue({ id: 'existing-task' }); // dedup hit

      const candidates = await generateCandidates('org-1');
      expect(candidates.filter((c) => c.rule === 'R1_STALE_LEAD')).toHaveLength(0);
    });

    it('includes a stale lead with no existing open VSM task', async () => {
      prismaMocks.leadFindMany.mockImplementation((args: { where?: { activities?: unknown } }) => {
        if (args?.where?.activities) return Promise.resolve([]);
        return Promise.resolve([
          { id: 'lead-2', name: 'Beta Ltd', company: null, stage: 'NEW', ownerId: 'user-1', lastActivityAt: null, createdAt: new Date('2026-01-01'), priority: null },
        ]);
      });
      prismaMocks.taskFindFirst.mockResolvedValue(null); // no dedup hit

      const candidates = await generateCandidates('org-1');
      const r1 = candidates.filter((c) => c.rule === 'R1_STALE_LEAD');
      expect(r1).toHaveLength(1);
      expect(r1[0].createsTask).toBe(true);
      expect(r1[0].evidence.leadId).toBe('lead-2');
    });

    it('marks overdue tasks as carryover (does not create a new task)', async () => {
      prismaMocks.taskFindMany.mockResolvedValue([
        { id: 'task-1', title: 'Call Jane', userId: 'user-1', dueAt: new Date('2020-01-01'), leadId: 'lead-x' },
      ]);
      const candidates = await generateCandidates('org-1');
      const r2 = candidates.filter((c) => c.rule === 'R2_OVERDUE_TASK');
      expect(r2).toHaveLength(1);
      expect(r2[0].createsTask).toBe(false);
    });
  });

  describe('generateMorningPlan', () => {
    it('falls back to deterministic cap-truncation when no LLM client is configured', async () => {
      prismaMocks.leadFindMany.mockImplementation((args: { where?: { activities?: unknown } }) => {
        if (args?.where?.activities) return Promise.resolve([]);
        return Promise.resolve([
          { id: 'lead-1', name: 'A', company: null, stage: 'NEW', ownerId: 'user-1', lastActivityAt: null, createdAt: new Date('2026-01-01'), priority: null },
          { id: 'lead-2', name: 'B', company: null, stage: 'NEW', ownerId: 'user-1', lastActivityAt: null, createdAt: new Date('2026-01-01'), priority: null },
          { id: 'lead-3', name: 'C', company: null, stage: 'NEW', ownerId: 'user-1', lastActivityAt: null, createdAt: new Date('2026-01-01'), priority: null },
        ]);
      });
      prismaMocks.userFindMany.mockResolvedValue([
        { id: 'user-1', name: 'Amina', teamMemberProfile: { responsibilities: 'Nairobi CBD', managedByVsm: true } },
      ]);

      const plan = await generateMorningPlan('org-1', {
        dailyFocusCap: 10,
        taskCapPerDay: 2,
        tone: 'professional',
        vsmUserId: null,
      } as never);

      expect(plan.people).toHaveLength(1);
      expect(plan.people[0].items).toHaveLength(2); // capped at 2, not 3
      expect(plan.people[0].items.every((i) => i.included)).toBe(true);
    });

    it('excludes staff whose profile has managedByVsm=false', async () => {
      prismaMocks.leadFindMany.mockResolvedValue([]);
      prismaMocks.userFindMany.mockResolvedValue([
        { id: 'user-2', name: 'Jordan', teamMemberProfile: { responsibilities: null, managedByVsm: false } },
      ]);

      const plan = await generateMorningPlan('org-1', { dailyFocusCap: 10, taskCapPerDay: 5, tone: 'professional', vsmUserId: null } as never);
      expect(plan.people).toHaveLength(0);
    });

    it('caps total selected items org-wide at dailyFocusCap and prefers HOT leads over COLD ones', async () => {
      // 3 people, 3 stale leads each (9 total) — far more than a focus cap of 2.
      // Each person's leads are COLD, COLD, HOT (in that order) so only the
      // scoring (not array order) can explain a HOT lead making the cut.
      prismaMocks.leadFindMany.mockImplementation((args: { where?: { activities?: unknown } }) => {
        if (args?.where?.activities) return Promise.resolve([]);
        const leads = [];
        for (const owner of ['user-1', 'user-2', 'user-3']) {
          leads.push(
            { id: `${owner}-cold-1`, name: 'Cold A', company: null, stage: 'NEW', ownerId: owner, lastActivityAt: null, createdAt: new Date('2026-01-01'), priority: 'COLD' },
            { id: `${owner}-cold-2`, name: 'Cold B', company: null, stage: 'NEW', ownerId: owner, lastActivityAt: null, createdAt: new Date('2026-01-01'), priority: 'COLD' },
            { id: `${owner}-hot`, name: 'Hot Lead', company: null, stage: 'NEW', ownerId: owner, lastActivityAt: null, createdAt: new Date('2026-01-01'), priority: 'HOT' },
          );
        }
        return Promise.resolve(leads);
      });
      prismaMocks.userFindMany.mockResolvedValue([
        { id: 'user-1', name: 'Amina', teamMemberProfile: { responsibilities: null, managedByVsm: true } },
        { id: 'user-2', name: 'Brian', teamMemberProfile: { responsibilities: null, managedByVsm: true } },
        { id: 'user-3', name: 'Chao', teamMemberProfile: { responsibilities: null, managedByVsm: true } },
      ]);

      const plan = await generateMorningPlan('org-1', { dailyFocusCap: 2, taskCapPerDay: 5, tone: 'professional', vsmUserId: null } as never);

      const allItems = plan.people.flatMap((p) => p.items);
      expect(allItems).toHaveLength(2); // org-wide cap, not 2-per-person
      expect(allItems.every((i) => i.leadPriority === 'HOT')).toBe(true);
    });
  });
});
