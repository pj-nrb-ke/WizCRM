/** Mirror of shared pipeline stage config (no @wizcrm/shared in APK bundle). */
export type PipelineStageConfig = {
  stage: string;
  label: string;
  order: number;
  inPipeline: boolean;
};

const DEFAULT_OPEN: PipelineStageConfig[] = [
  { stage: 'NEW', label: 'New', order: 0, inPipeline: true },
  { stage: 'CONTACTED', label: 'Contacted', order: 1, inPipeline: true },
  { stage: 'QUALIFIED', label: 'Qualified', order: 2, inPipeline: true },
  { stage: 'PROPOSAL', label: 'Proposal', order: 3, inPipeline: true },
  { stage: 'NEGOTIATION', label: 'Negotiation', order: 4, inPipeline: true },
];

export function normalizePipelineStages(stages?: PipelineStageConfig[]): PipelineStageConfig[] {
  if (!stages?.length) return DEFAULT_OPEN;
  const open = stages
    .filter((s) => s.inPipeline && s.stage !== 'WON' && s.stage !== 'LOST')
    .sort((a, b) => a.order - b.order);
  return open.length > 0 ? open : DEFAULT_OPEN;
}

export function reorderLeadIds(ids: string[], leadId: string, direction: 'up' | 'down'): string[] {
  const i = ids.indexOf(leadId);
  if (i < 0) return ids;
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  const tmp = next[i]!;
  next[i] = next[j]!;
  next[j] = tmp;
  return next;
}
