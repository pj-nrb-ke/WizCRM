import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  taskFindMany: vi.fn(),
  taskUpdateFindMany: vi.fn(),
  leadFindMany: vi.fn(),
  vsmRunFindFirst: vi.fn(),
  vsmRunFindMany: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    task: { findMany: prismaMocks.taskFindMany },
    taskUpdate: { findMany: prismaMocks.taskUpdateFindMany },
    lead: { findMany: prismaMocks.leadFindMany },
    vsmRun: { findFirst: prismaMocks.vsmRunFindFirst, findMany: prismaMocks.vsmRunFindMany },
  },
}));

vi.mock('../src/services/stale-lead.service.js', () => ({
  resolveStaleLeadDays: vi.fn().mockResolvedValue(7),
  isStaleLead: (lastActivityAt: Date | null, createdAt: Date, days: number, now = new Date()) => {
    const ref = lastActivityAt ?? createdAt;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    return ref < cutoff;
  },
}));

import { computeAutoModeEligibility, computeVsmPerformance } from '../src/services/vsm-performance.service.js';

describe('computeVsmPerformance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.leadFindMany.mockResolvedValue([]);
    prismaMocks.vsmRunFindFirst.mockResolvedValue(null);
    prismaMocks.vsmRunFindMany.mockResolvedValue([]);
    prismaMocks.taskUpdateFindMany.mockResolvedValue([]);
  });

  it('returns nulls when there is no VSM task or run history yet', async () => {
    prismaMocks.taskFindMany.mockResolvedValue([]);
    const result = await computeVsmPerformance('org-1');
    expect(result.taskCompletionRatePct).toBeNull();
    expect(result.medianResponseHours).toBeNull();
    expect(result.staleLeadReductionPct).toBeNull();
    expect(result.planEditRatePct).toBeNull();
    expect(result.currentStaleLeadCount).toBe(0);
  });

  it('computes task completion rate from VSM-sourced tasks', async () => {
    prismaMocks.taskFindMany.mockResolvedValue([
      { id: 't1', createdAt: new Date(), completedAt: new Date() },
      { id: 't2', createdAt: new Date(), completedAt: new Date() },
      { id: 't3', createdAt: new Date(), completedAt: null },
      { id: 't4', createdAt: new Date(), completedAt: null },
    ]);
    const result = await computeVsmPerformance('org-1');
    expect(result.taskCompletionRatePct).toBe(50);
  });

  it('computes median response time from the first human reply per task', async () => {
    const base = new Date('2026-01-01T00:00:00Z');
    prismaMocks.taskFindMany.mockResolvedValue([
      { id: 't1', createdAt: base, completedAt: null },
      { id: 't2', createdAt: base, completedAt: null },
      { id: 't3', createdAt: base, completedAt: null },
    ]);
    prismaMocks.taskUpdateFindMany.mockResolvedValue([
      { taskId: 't1', createdAt: new Date(base.getTime() + 2 * 3_600_000) }, // 2h
      { taskId: 't2', createdAt: new Date(base.getTime() + 4 * 3_600_000) }, // 4h
      { taskId: 't3', createdAt: new Date(base.getTime() + 6 * 3_600_000) }, // 6h
    ]);
    const result = await computeVsmPerformance('org-1');
    expect(result.medianResponseHours).toBe(4);
  });

  it('computes stale-lead reduction against the oldest EOD baseline in the window', async () => {
    prismaMocks.taskFindMany.mockResolvedValue([]);
    prismaMocks.leadFindMany.mockResolvedValue([{ lastActivityAt: null, createdAt: new Date('2020-01-01') }]); // 1 stale lead now
    prismaMocks.vsmRunFindFirst.mockResolvedValue({ contextSnapshot: { staleLeadCount: 4 } });
    const result = await computeVsmPerformance('org-1');
    expect(result.currentStaleLeadCount).toBe(1);
    expect(result.staleLeadReductionPct).toBe(75); // (4-1)/4
  });

  it('computes plan-edit rate from contextSnapshot.edited across approved/sent morning runs', async () => {
    prismaMocks.taskFindMany.mockResolvedValue([]);
    prismaMocks.vsmRunFindMany.mockResolvedValue([
      { contextSnapshot: { edited: true } },
      { contextSnapshot: { edited: false } },
      { contextSnapshot: {} },
      { contextSnapshot: { edited: true } },
    ]);
    const result = await computeVsmPerformance('org-1');
    expect(result.planEditRatePct).toBe(50);
  });
});

describe('computeAutoModeEligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is not eligible with fewer than the minimum sample of runs', async () => {
    prismaMocks.vsmRunFindMany.mockResolvedValue([{ contextSnapshot: {} }, { contextSnapshot: {} }]);
    const result = await computeAutoModeEligibility('org-1');
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/at least/);
  });

  it('is not eligible when any recent run was edited', async () => {
    prismaMocks.vsmRunFindMany.mockResolvedValue([
      { contextSnapshot: {} },
      { contextSnapshot: {} },
      { contextSnapshot: {} },
      { contextSnapshot: {} },
      { contextSnapshot: { edited: true } },
    ]);
    const result = await computeAutoModeEligibility('org-1');
    expect(result.eligible).toBe(false);
    expect(result.uneditedCount).toBe(4);
    expect(result.totalCount).toBe(5);
  });

  it('is eligible when the full sample is unedited', async () => {
    prismaMocks.vsmRunFindMany.mockResolvedValue(Array.from({ length: 5 }, () => ({ contextSnapshot: {} })));
    const result = await computeAutoModeEligibility('org-1');
    expect(result.eligible).toBe(true);
    expect(result.uneditedCount).toBe(5);
  });
});
