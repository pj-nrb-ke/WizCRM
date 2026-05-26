import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LEAD_STAGES } from '../lib/stages';
import { api } from '../lib/api';
import { leadsQueryPath, readManagerFilter } from '../lib/manager-query';
import type { LeadSummary } from '../lib/types';
import { TeamFilterBar } from '../components/TeamFilterBar';
import { LeadDrawer } from '../components/LeadDrawer';
import { CreateLeadModal } from '../components/CreateLeadModal';
import type { CrmConfig } from '../components/CloseLeadModal';
import { PageHeader } from '../components/PageHeader';

export function LeadsPage() {
  const [search] = useSearchParams();
  const filter = readManagerFilter(search);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [crmConfig, setCrmConfig] = useState<CrmConfig | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const extra: Record<string, string> = {};
    if (stageFilter) extra.stage = stageFilter;
    if (tagFilter.trim()) extra.tag = tagFilter.trim();
    const path = leadsQueryPath(filter, Object.keys(extra).length ? extra : undefined);
    api<{ leads: LeadSummary[] }>(path)
      .then((d) => setLeads(d.leads))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [search.toString(), stageFilter, tagFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<CrmConfig>('/leads/crm-config')
      .then(setCrmConfig)
      .catch(() => setCrmConfig(null));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((l) => {
      const hay = [
        l.name,
        l.company,
        l.email,
        l.phone,
        l.owner?.name,
        l.owner?.team?.name,
        ...(l.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [leads, q]);

  const title = filter.title ? `Leads: ${filter.title}` : 'All leads';

  return (
    <div className="page-wide">
      <PageHeader
        title={title}
        subtitle="Search, filter, and open any lead for full details."
      />
      <TeamFilterBar basePath="/leads" />
      {error ? <p className="error">{error}</p> : null}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name, company, email, owner…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search leads"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          aria-label="Filter by stage"
        >
          <option value="">All stages</option>
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by tag"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          aria-label="Filter by tag"
          list="lead-tag-suggestions"
        />
        <datalist id="lead-tag-suggestions">
          {(crmConfig?.leadTags ?? []).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
          New lead
        </button>
        <button type="button" className="btn-secondary" onClick={() => load()}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <p className="muted">
          {filtered.length} lead{filtered.length === 1 ? '' : 's'}
          {q.trim() ? ` matching “${q.trim()}”` : ''}
        </p>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Stage</th>
              <th>Owner</th>
              <th>Source</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="row-clickable" onClick={() => setSelectedId(l.id)}>
                <td>
                  <strong>{l.name}</strong>
                  {l.company ? <div className="muted">{l.company}</div> : null}
                  {l.tags && l.tags.length > 0 ? (
                    <div className="lead-row-tags">
                      {l.tags.slice(0, 3).map((t) => (
                        <span key={t} className="tag-chip-inline">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td>{l.stage}</td>
                <td>
                  {l.owner?.name ?? '—'}
                  {l.owner?.team ? <div className="muted">{l.owner.team.name}</div> : null}
                </td>
                <td>{l.source ?? '—'}</td>
                <td className="muted">
                  {l.updatedAt ? new Date(l.updatedAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            No leads found.
          </p>
        ) : null}
      </div>

      <LeadDrawer
        leadId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={load}
      />
      <CreateLeadModal
        open={showCreate}
        config={crmConfig}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          load();
          setSelectedId(id);
        }}
      />
    </div>
  );
}
