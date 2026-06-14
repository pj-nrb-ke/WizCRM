import { describe, expect, it } from 'vitest';
import {
  defaultPipelineStages,
  isPipelineDragTransition,
  mergePipelineStages,
} from './pipeline-stages.js';

describe('pipeline stages', () => {
  it('merges custom labels', () => {
    const merged = mergePipelineStages([
      { stage: 'NEW', label: 'Inbound', order: 0, inPipeline: true },
      { stage: 'CONTACTED', label: 'Contacted', order: 1, inPipeline: true },
      { stage: 'QUALIFIED', label: 'Qualified', order: 2, inPipeline: true },
      { stage: 'PROPOSAL', label: 'Proposal', order: 3, inPipeline: true },
      { stage: 'NEGOTIATION', label: 'Closing', order: 4, inPipeline: true },
    ]);
    expect(merged[0].label).toBe('Inbound');
    expect(merged[4].label).toBe('Closing');
  });

  it('allows drag between open stages', () => {
    expect(isPipelineDragTransition('NEGOTIATION', 'NEW')).toBe(true);
    expect(isPipelineDragTransition('WON', 'NEW')).toBe(false);
  });

  it('defaults to five columns', () => {
    expect(defaultPipelineStages()).toHaveLength(5);
  });
});
