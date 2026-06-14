import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LEAD_STAGES } from '../lib/stages';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isManager } from '../lib/roles';
import { leadsQueryPath, readManagerFilter } from '../lib/manager-query';
import type { LeadSummary } from '../lib/types';
import { TeamFilterBar } from '../components/TeamFilterBar';
import { LeadDrawer } from '../components/LeadDrawer';
import { CreateLeadModal } from '../components/CreateLeadModal';
import type { CrmConfig } from '../components/CloseLeadModal';
import { PageHeader } from '../components/PageHeader';

type AssignableUser = { id: string; name: string; email: string; role: string };

const OPEN_STAGES = LEAD_STAGES.filter((s) => s !== 'WON' && s !== 'LOST');

export function LeadsPage() {
  const { user } = useAuth();
  const manager = isManager(user?.role);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [bulkOwnerId, setBulkOwnerId] = useState('');
  const [bulkStage, setBulkStage] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');

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

  useEffect(() => {
    if (!manager) return;
    api<{ users: AssignableUser[] }>('/teams/assignable-users')
      .then((d) => setAssignableUsers(d.users))
      .catch(() => setAssignableUsers([]));
  }, [manager]);

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkMessage('');
  }, [search.toString(), stageFilter, tagFilter, q]);

  const [sortBy, setSortBy] = useState<'name' | 'stage' | 'updated' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortBy === 'updated') {
        av = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        bv = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      } else {
        av = (a[sortBy] ?? '').toString().toLowerCase();
        bv = (b[sortBy] ?? '').toString().toLowerCase();
      }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  }, [filtered, sortBy, sortDir]);

  function toggleSort(col: 'name' | 'stage' | 'updated') {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  }

  const sortArrow = (col: 'name' | 'stage' | 'updated') =>
    sortBy === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  }

  async function runBulkUpdate() {
    if (selectedIds.size === 0) return;
    if (!bulkOwnerId && !bulkStage) {
      setBulkMessage('Choose an owner and/or stage to apply.');
      return;
    }
    setBulkBusy(true);
    setBulkMessage('');
    try {
      const body: {
        leadIds: string[];
        ownerId?: string;
        stage?: string;
        pipelineMove?: boolean;
      } = { leadIds: [...selectedIds] };
      if (bulkOwnerId) body.ownerId = bulkOwnerId;
      if (bulkStage) {
        body.stage = bulkStage;
        body.pipelineMove = true;
      }
      const result = await api<{ updated: number; failed: number }>('/leads/bulk-update', {
        method: 'POST',
        body,
      });
      setBulkMessage(`Updated ${result.updated} lead${result.updated === 1 ? '' : 's'}.`);
      if (result.failed > 0) {
        setBulkMessage((m) => `${m} ${result.failed} could not be updated.`);
      }
      setSelectedIds(new Set());
      setBulkOwnerId('');
      setBulkStage('');
      load();
    } catch (e) {
      setBulkMessage(e instanceof Error ? e.message : 'Bulk update failed');
    } finally {
      setBulkBusy(false);
    }
  }

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

      {manager && selectedIds.size > 0 ? (
        <div className="leads-bulk-bar card">
          <span>
            {selectedIds.size} selected
          </span>
          <select
            value={bulkOwnerId}
            onChange={(e) => setBulkOwnerId(e.target.value)}
            aria-label="Bulk assign owner"
          >
            <option value="">Assign owner…</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            value={bulkStage}
            onChange={(e) => setBulkStage(e.target.value)}
            aria-label="Bulk change stage"
          >
            <option value="">Change stage…</option>
            {OPEN_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={bulkBusy || (!bulkOwnerId && !bulkStage)}
            onClick={() => void runBulkUpdate()}
          >
            {bulkBusy ? 'Applying…' : 'Apply'}
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>
          {bulkMessage ? <span className="muted">{bulkMessage}</span> : null}
        </div>
      ) : null}

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
              {manager ? (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all visible leads"
                  />
                </th>
              ) : null}
              <th
                className="th-sortable"
                onClick={() => toggleSort('name')}
                title="Sort by name"
              >
                Name{sortArrow('name')}
              </th>
              <th
                className="th-sortable"
                onClick={() => toggleSort('stage')}
                title="Sort by stage"
              >
                Stage{sortArrow('stage')}
              </th>
              <th>Owner</th>
              <th>Source</th>
              <th
                className="th-sortable"
                onClick={() => toggleSort('updated')}
                title="Sort by last updated"
              >
                Updated{sortArrow('updated')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => (
              <tr key={l.id} className="row-clickable">
                {manager ? (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(l.id)}
                      onChange={() => toggleSelect(l.id)}
                      aria-label={`Select ${l.name}`}
                    />
                  </td>
                ) : null}
                <td onClick={() => setSelectedId(l.id)}>
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
                <td onClick={() => setSelectedId(l.id)}>{l.stage}</td>
                <td onClick={() => setSelectedId(l.id)}>
                  {l.owner?.name ?? '—'}
                  {l.owner?.team ? <div className="muted">{l.owner.team.name}</div> : null}
                </td>
                <td onClick={() => setSelectedId(l.id)}>{l.source ?? '—'}</td>
                <td className="muted" onClick={() => setSelectedId(l.id)}>
                  {l.updatedAt ? new Date(l.updatedAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 32, textAlign: 'center' }}>
            <p className="muted" style={{ marginBottom: 12 }}>
              {q.trim() || stageFilter || tagFilter
                ? 'No leads match these filters.'
                : 'No leads yet. Add your first lead to get started.'}
            </p>
            {!q.trim() && !stageFilter && !tagFilter ? (
              <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
                New lead
              </button>
            ) : null}
          </div>
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
