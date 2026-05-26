import { describe, expect, it } from 'vitest';
import { buildPersonalMetrics } from './personal-dashboard';

describe('buildPersonalMetrics', () => {
  const now = new Date('2026-05-20T12:00:00Z');

  it('counts open and stale leads', () => {
    const metrics = buildPersonalMetrics(
      [
        { stage: 'NEW', updatedAt: '2026-05-01T00:00:00Z', lastActivityAt: null },
        { stage: 'WON', updatedAt: '2026-05-19T00:00:00Z' },
      ],
      [],
      [],
      now,
    );
    expect(metrics.openLeads).toBe(1);
    expect(metrics.staleLeads).toBe(1);
  });

  it('counts due tasks and upcoming events', () => {
    const metrics = buildPersonalMetrics(
      [],
      [{ dueAt: '2026-05-20T18:00:00Z', completedAt: null }],
      [{ startAt: '2026-05-21T10:00:00Z' }],
      now,
    );
    expect(metrics.tasksDue).toBe(1);
    expect(metrics.upcomingEvents).toBe(1);
  });
});
