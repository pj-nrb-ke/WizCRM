import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { pipelineQueryPath, readManagerFilter } from '../lib/manager-query';
import type { LeadSummary } from '../lib/types';
import { TeamFilterBar } from '../components/TeamFilterBar';
import { LeadDrawer } from '../components/LeadDrawer';
import { PageHeader } from '../components/PageHeader';
import {
  PipelineStagesModal,
  type PipelineStageConfig,
} from '../components/PipelineStagesModal';

const DRAG_MIME = 'application/x-wizcrm-lead-id';

function findLeadStage(
  pipeline: Record<string, LeadSummary[]>,
  leadId: string,
): string | undefined {
  for (const [stage, leads] of Object.entries(pipeline)) {
    if (leads.some((l) => l.id === leadId)) return stage;
  }
  return undefined;
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

  async function moveLeadToStage(leadId: string, fromStage: string, toStage: string) {
    if (fromStage === toStage || moving) return;
    setMoving(true);
    setError('');
    const prev = pipeline;
    const lead = prev[fromStage]?.find((l) => l.id === leadId);
    if (!lead) {
      setMoving(false);
      return;
    }
    const optimistic: Record<string, LeadSummary[]> = {};
    for (const col of stages) {
      const list = [...(prev[col.stage] ?? [])];
      if (col.stage === fromStage) {
        optimistic[col.stage] = list.filter((l) => l.id !== leadId);
      } else if (col.stage === toStage) {
        optimistic[col.stage] = [{ ...lead }, ...list];
      } else {
        optimistic[col.stage] = list;
      }
    }
    setPipeline(optimistic);

    try {
      await api(`/leads/${leadId}`, {
        method: 'PATCH',
        body: { stage: toStage, pipelineMove: true },
      });
      load();
    } catch (e) {
      setPipeline(prev);
      setError(e instanceof Error ? e.message : 'Could not move lead');
    } finally {
      setMoving(false);
      setDropStage(null);
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

  function handleDropColumn(stage: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDropStage(null);
    const leadId =
      e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    if (!leadId || moving) return;
    const fromStage = findLeadStage(pipeline, leadId);
    if (!fromStage || fromStage === stage) return;
    skipClickRef.current = true;
    void moveLeadToStage(leadId, fromStage, stage);
  }

  function columnDropProps(stage: string) {
    return {
      onDragOver: (e: React.DragEvent) => handleDragOverColumn(stage, e),
      onDrop: (e: React.DragEvent) => handleDropColumn(stage, e),
    };
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="Pipeline"
        subtitle="Drag cards between stages to update lead status. Click a card for details."
        actions={
          <button type="button" className="btn-secondary" onClick={() => setCustomizeOpen(true)}>
            Customize stages
          </button>
        }
      />
      <TeamFilterBar basePath="/pipeline" />
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {moving ? <p className="muted pipeline-moving">Updating stage…</p> : null}
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
              {(pipeline[col.stage] ?? []).map((lead) => (
                <div
                  key={lead.id}
                  role="button"
                  tabIndex={0}
                  draggable
                  className="kanban-card"
                  onDragStart={(e) => handleDragStart(lead.id, e)}
                  onDragEnd={() => setDropStage(null)}
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
                  {lead.company ? <span className="kanban-card-meta">{lead.company}</span> : null}
                  {lead.owner ? (
                    <span className="kanban-card-meta">
                      {lead.owner.name}
                      {lead.owner.team ? ` · ${lead.owner.team.name}` : ''}
                    </span>
                  ) : null}
                </div>
              ))}
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
