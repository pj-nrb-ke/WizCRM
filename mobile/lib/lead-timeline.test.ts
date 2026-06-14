import { describe, expect, it } from 'vitest';
import { mergeLeadTimeline } from './lead-timeline';

describe('mergeLeadTimeline', () => {
  it('sorts activities and stage changes newest first', () => {
    const items = mergeLeadTimeline(
      [
        {
          id: 'a1',
          type: 'NOTE',
          body: 'Note',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
      ],
      [
        {
          id: 's1',
          fromStage: 'NEW',
          toStage: 'CONTACTED',
          note: null,
          createdAt: '2026-01-02T10:00:00.000Z',
          userName: 'Pat',
        },
      ],
    );
    expect(items).toHaveLength(2);
    expect(items[0]?.kind).toBe('stage');
    expect(items[1]?.kind).toBe('activity');
  });
});
