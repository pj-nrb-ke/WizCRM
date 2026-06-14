import { describe, expect, it } from 'vitest';
import { normalizePipelineStages, reorderLeadIds } from './pipeline-board';

describe('pipeline-board', () => {
  it('uses default open stages when config empty', () => {
    const stages = normalizePipelineStages([]);
    expect(stages.map((s) => s.stage)).toEqual([
      'NEW',
      'CONTACTED',
      'QUALIFIED',
      'PROPOSAL',
      'NEGOTIATION',
    ]);
  });

  it('reorders lead ids within column', () => {
    const ids = ['a', 'b', 'c'];
    expect(reorderLeadIds(ids, 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(reorderLeadIds(ids, 'b', 'down')).toEqual(['a', 'c', 'b']);
  });
});
