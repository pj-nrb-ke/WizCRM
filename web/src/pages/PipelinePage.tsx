import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { pipelineQueryPath, readManagerFilter } from '../lib/manager-query';
import type { LeadSummary } from '../lib/types';
import { TeamFilterBar } from '../components/TeamFilterBar';
import { LeadDrawer } from '../components/LeadDrawer';

import { PIPELINE_STAGES } from '../lib/stages';

export function PipelinePage() {
  const [search] = useSearchParams();
  const filter = readManagerFilter(search);
  const [pipeline, setPipeline] = useState<Record<string, LeadSummary[]>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api<{ pipeline: Record<string, LeadSummary[]> }>(pipelineQueryPath(filter))
      .then((d) => setPipeline(d.pipeline ?? {}))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [search.toString()]);

  useEffect(() => {
    load();
  }, [load]);

  const total = PIPELINE_STAGES.reduce((n, s) => n + (pipeline[s]?.length ?? 0), 0);

  return (
    <div className="page-wide">
      <h1>Pipeline</h1>
      <p className="muted">Open leads by stage (excludes Won/Lost). Click a card for details.</p>
      <TeamFilterBar basePath="/pipeline" />
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && filter.teamId && total === 0 && !error ? (
        <p className="muted">No open leads for this filter.</p>
      ) : null}

      <div className="kanban">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage} className="kanban-col">
            <h3 className="kanban-title">
              {stage} <span className="muted">({(pipeline[stage] ?? []).length})</span>
            </h3>
            <div className="kanban-cards">
              {(pipeline[stage] ?? []).map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className="kanban-card"
                  onClick={() => setSelectedId(lead.id)}
                >
                  <strong>{lead.name}</strong>
                  {lead.company ? <span className="muted block">{lead.company}</span> : null}
                  {lead.owner ? (
                    <span className="muted block">
                      {lead.owner.name}
                      {lead.owner.team ? ` · ${lead.owner.team.name}` : ''}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <LeadDrawer
        leadId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={load}
      />
    </div>
  );
}
