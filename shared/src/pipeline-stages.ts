import { z } from 'zod';
import { LEAD_STAGES, type LeadStage } from './stages.js';

export const pipelineStageConfigSchema = z.object({
  stage: z.enum(LEAD_STAGES),
  label: z.string().min(1).max(80),
  order: z.number().int().min(0).max(99),
  inPipeline: z.boolean(),
});

export type PipelineStageConfig = z.infer<typeof pipelineStageConfigSchema>;

export const pipelineStagesPatchSchema = z.object({
  stages: z.array(pipelineStageConfigSchema).min(1).max(20),
});

const DEFAULT_LABELS: Record<LeadStage, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

/** Default open pipeline columns (excludes Won/Lost). */
export function defaultPipelineStages(): PipelineStageConfig[] {
  const open: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];
  return open.map((stage, order) => ({
    stage,
    label: DEFAULT_LABELS[stage],
    order,
    inPipeline: true,
  }));
}

export function mergePipelineStages(
  saved: PipelineStageConfig[] | undefined,
): PipelineStageConfig[] {
  const defaults = defaultPipelineStages();
  if (!saved?.length) return defaults;

  const byStage = new Map(saved.map((s) => [s.stage, s]));
  const merged = LEAD_STAGES.flatMap((stage) => {
    const row = byStage.get(stage);
    if (!row) return [];
    return [row];
  });

  const pipelineRows = merged
    .filter((s) => s.inPipeline && s.stage !== 'WON' && s.stage !== 'LOST')
    .sort((a, b) => a.order - b.order);

  if (pipelineRows.length === 0) return defaults;
  return pipelineRows;
}

export function pipelineStageIds(stages: PipelineStageConfig[]): LeadStage[] {
  return stages.map((s) => s.stage);
}

/** Persist full stage list when saving from the editor. */
export function normalizePipelineStagesForSave(
  stages: PipelineStageConfig[],
): PipelineStageConfig[] {
  const byStage = new Map(stages.map((s) => [s.stage, s]));
  return LEAD_STAGES.map((stage, order) => {
    const row = byStage.get(stage);
    return (
      row ?? {
        stage,
        label: DEFAULT_LABELS[stage],
        order,
        inPipeline: stage !== 'WON' && stage !== 'LOST',
      }
    );
  });
}

/** Drag-drop on pipeline board: any move among visible open stages; Won is terminal. */
export function isPipelineDragTransition(from: LeadStage, to: LeadStage): boolean {
  if (from === to) return true;
  if (from === 'WON') return false;
  if (to === 'WON' || to === 'LOST') return true;
  if (from === 'LOST') return true;
  const open: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];
  return open.includes(from) && open.includes(to);
}
