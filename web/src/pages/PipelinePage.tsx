import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { pipelineQueryPath, readManagerFilter } from '../lib/manager-query';
import {
  moveLeadToEnd,
  reorderLeadList,
  type DropPlace,
} from '../lib/pipeline-order';
import type { LeadSummary } from '../lib/types';
import { TeamFilterBar } from '../components/TeamFilterBar';
import { LeadDrawer } from '../components/LeadDrawer';
import { PageHeader } from '../components/PageHeader';
import {
  PipelineStagesModal,
  type PipelineStageConfig,
} from '../components/PipelineStagesModal';

const DRAG_MIME = 'application/x-wizcrm-lead-id';

type DropHint = {
  stage: string;
  leadId: string;
  place: DropPlace;
};

function findLeadStage(
  pipeline: Record<string, LeadSummary[]>,
  leadId: string,
): string | undefined {
  for (const [stage, leads] of Object.entries(pipeline)) {
    if (leads.some((l) => l.id === leadId)) return stage;
  }
  return undefined;
}

function readDragLeadId(e: React.DragEvent): string {
  return e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
}

export function PipelinePage() {
  const [search] = useSearchParams();
  const filter = readManagerFilter(search);
  const [stages, setStages] = useState<PipelineStageConfig[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, LeadSummary[]>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [moving, setMoving] = useState(false);
  const skipClickRef = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api<{ stages: PipelineStageConfig[]; pipeline: Record<string, LeadSummary[]> }>(
      pipelineQueryPath(filter),
    )
      .then((d) => {
        setStages(d.stages ?? []);
        setPipeline(d.pipeline ?? {});
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [search.toString()]);

  useEffect(() => {
    load();
  }, [load]);

  const total = stages.reduce((n, s) => n + (pipeline[s.stage]?.length ?? 0), 0);

  async function persistColumnOrder(stage: string, ordered: LeadSummary[]) {
    setMoving(true);
    setError('');
    const prev = pipeline;
    setPipeline({ ...prev, [stage]: ordered });
    try {
      await api('/leads/pipeline/reorder', {
        method: 'PATCH',
        body: { stage, leadIds: ordered.map((l) => l.id) },
      });
    } catch (e) {
      setPipeline(prev);
      setError(e instanceof Error ? e.message : 'Could not reorder cards');
      throw e;
    } finally {
      setMoving(false);
      setDropStage(null);
      setDropHint(null);
    }
  }

  async function reorderWithinStage(
    stage: string,
    dragId: string,
    targetId: string,
    place: DropPlace,
  ) {
    const list = pipeline[stage] ?? [];
    const next = reorderLeadList(list, dragId, targetId, place);
    if (next.map((l) => l.id).join() === list.map((l) => l.id).join()) return;
    await persistColumnOrder(stage, next);
  }

  async function moveLeadToStage(
    leadId: string,
    fromStage: string,
    toStage: string,
    insert?: { targetId: string; place: DropPlace },
  ) {
    if (fromStage === toStage || moving) return;
    setMoving(true);
    setError('');
    const prev = pipeline;
    const lead = prev[fromStage]?.find((l) => l.id === leadId);
    if (!lead) {
      setMoving(false);
      return;
    }

    const toList = prev[toStage] ?? [];
    const optimisticTo = insert
      ? reorderLeadList([...toList, { ...lead }], leadId, insert.targetId, insert.place)
      : [{ ...lead }, ...toList];

    const optimistic: Record<string, LeadSummary[]> = { ...prev };
    optimistic[fromStage] = (prev[fromStage] ?? []).filter((l) => l.id !== leadId);
    optimistic[toStage] = optimisticTo;
    setPipeline(optimistic);

    try {
      await api(`/leads/${leadId}`, {
        method: 'PATCH',
        body: { stage: toStage, pipelineMove: true },
      });
      await api('/leads/pipeline/reorder', {
        method: 'PATCH',
        body: { stage: toStage, leadIds: optimisticTo.map((l) => l.id) },
      });
      load();
    } catch (e) {
      setPipeline(prev);
      setError(e instanceof Error ? e.message : 'Could not move lead');
    } finally {
      setMoving(false);
      setDropStage(null);
      setDropHint(null);
    }
  }

  function handleDragStart(leadId: string, e: React.DragEvent) {
    skipClickRef.current = false;
    e.dataTransfer.setData(DRAG_MIME, leadId);
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOverColumn(stage: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropStage(stage);
  }

  async function handleDropColumn(stage: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDropStage(null);
    setDropHint(null);
    const leadId = readDragLeadId(e);
    if (!leadId || moving) return;
    const fromStage = findLeadStage(pipeline, leadId);
    if (!fromStage) return;
    skipClickRef.current = true;
    if (fromStage === stage) {
      const next = moveLeadToEnd(pipeline[stage] ?? [], leadId);
      await persistColumnOrder(stage, next);
      return;
    }
    void moveLeadToStage(leadId, fromStage, stage);
  }

  async function handleDropOnCard(
    colStage: string,
    targetLeadId: string,
    e: React.DragEvent,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const leadId = readDragLeadId(e);
    if (!leadId || moving || leadId === targetLeadId) return;
    const fromStage = findLeadStage(pipeline, leadId);
    if (!fromStage) return;
    const place: DropPlace =
      dropHint?.leadId === targetLeadId && dropHint.stage === colStage
        ? dropHint.place
        : 'before';
    skipClickRef.current = true;
    setDropStage(null);
    setDropHint(null);
    if (fromStage === colStage) {
      await reorderWithinStage(colStage, leadId, targetLeadId, place);
      return;
    }
    void moveLeadToStage(leadId, fromStage, colStage, { targetId: targetLeadId, place });
  }

  function handleDragOverCard(colStage: string, targetLeadId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const place: DropPlace = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropStage(colStage);
    setDropHint({ stage: colStage, leadId: targetLeadId, place });
  }

  function columnDropProps(stage: string) {
    return {
      onDragOver: (e: React.DragEvent) => handleDragOverColumn(stage, e),
      onDrop: (e: React.DragEvent) => void handleDropColumn(stage, e),
    };
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="Pipeline"
        subtitle="Drag cards between columns to change stage, or up/down within a column to sort."
        actions={
          <button type="button" className="btn-secondary" onClick={() => setCustomizeOpen(true)}>
            Customize stages
          </button>
        }
      />
      <TeamFilterBar basePath="/pipeline" />
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {moving ? <p className="muted pipeline-moving">Saving order…</p> : null}
      {!loading && filter.teamId && total === 0 && !error ? (
        <p className="muted">No open leads for this filter.</p>
      ) : null}

      <div className="kanban">
        {stages.map((col) => (
          <div
            key={col.stage}
            className={`kanban-col${dropStage === col.stage ? ' kanban-col-drop' : ''}`}
            {...columnDropProps(col.stage)}
          >
            <h3 className="kanban-title">
              {col.label}
              <span className="kanban-count">{(pipeline[col.stage] ?? []).length}</span>
            </h3>
            <div className="kanban-cards kanban-drop-zone" {...columnDropProps(col.stage)}>
              {(pipeline[col.stage] ?? []).map((lead) => {
                const hintBefore =
                  dropHint?.stage === col.stage &&
                  dropHint.leadId === lead.id &&
                  dropHint.place === 'before';
                const hintAfter =
                  dropHint?.stage === col.stage &&
                  dropHint.leadId === lead.id &&
                  dropHint.place === 'after';
                return (
                  <div key={lead.id} className="kanban-card-wrap">
                    {hintBefore ? <div className="kanban-drop-line" aria-hidden /> : null}
                    <div
                      role="button"
                      tabIndex={0}
                      draggable
                      className="kanban-card"
                      onDragStart={(e) => handleDragStart(lead.id, e)}
                      onDragEnd={() => {
                        setDropStage(null);
                        setDropHint(null);
                      }}
                      onDragOver={(e) => handleDragOverCard(col.stage, lead.id, e)}
                      onDrop={(e) => void handleDropOnCard(col.stage, lead.id, e)}
                      onClick={() => {
                        if (skipClickRef.current) {
                          skipClickRef.current = false;
                          return;
                        }
                        setSelectedId(lead.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(lead.id);
                        }
                      }}
                    >
                      <strong>{lead.name}</strong>
                      {lead.company ? (
                        <span className="kanban-card-meta">{lead.company}</span>
                      ) : null}
                      {lead.owner ? (
                        <span className="kanban-card-meta">
                          {lead.owner.name}
                          {lead.owner.team ? ` · ${lead.owner.team.name}` : ''}
                        </span>
                      ) : null}
                    </div>
                    {hintAfter ? <div className="kanban-drop-line" aria-hidden /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <LeadDrawer leadId={selectedId} onClose={() => setSelectedId(null)} onUpdated={load} />

      <PipelineStagesModal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        onSaved={(next) => {
          setStages(next);
          load();
        }}
      />
    </div>
  );
}
