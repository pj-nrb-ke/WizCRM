import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { filterSearchParams } from '../lib/manager-query';
import { aggregateOrgStats } from '../lib/manager-home';
import type { TeamsResponse } from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { TeamActivityFeed } from '../components/TeamActivityFeed';
import { KpiCard } from '../components/KpiCard';
import {
  MetricDrilldown,
  type DrilldownLead,
  type DrilldownTask,
} from '../components/MetricDrilldown';
import { LeadDrawer } from '../components/LeadDrawer';
import type { LeadSummary } from '../lib/types';

type MetricKey = 'open' | 'stale' | 'won' | 'overdue';

type DrilldownState = {
  metric: MetricKey;
  title: string;
  subtitle: string;
  teamId?: string;
  ownerId?: string;
};

function formatActivity(iso: string | null) {
  if (!iso) return 'No activity yet';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Active today';
  if (days === 1) return 'Active yesterday';
  return `Last activity ${days}d ago`;
}

const METRIC_LABELS: Record<MetricKey, string> = {
  open: 'Open leads',
  stale: 'Stale leads',
  won: 'Won leads',
  overdue: 'Overdue tasks',
};

export function ManagerHomePage() {
  const { entitlements } = useAuth();
  const pro = entitlements?.features.advancedReports ?? false;
  const [data, setData] = useState<TeamsResponse | null>(null);
  const [brief, setBrief] = useState<{ bullets: string[]; aiSummary: string | null } | null>(
    null,
  );
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [drillLeads, setDrillLeads] = useState<DrilldownLead[]>([]);
  const [drillTasks, setDrillTasks] = useState<DrilldownTask[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    api<TeamsResponse>('/teams')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
    api<{ leads: LeadSummary[] }>('/leads')
      .then((d) => setLeads(d.leads ?? []))
      .catch(() => setLeads([]));
    if (pro) {
      api<{ bullets: string[]; aiSummary: string | null }>('/reports/manager-brief')
        .then(setBrief)
        .catch(() => setBrief(null));
    }
  }, [pro]);

  const orgStats = data ? aggregateOrgStats(data.teams) : null;

  async function openDrilldown(state: DrilldownState) {
    setDrilldown(state);
    setDrillLoading(true);
    setDrillLeads([]);
    setDrillTasks([]);
    try {
      const qs = new URLSearchParams();
      if (state.teamId) qs.set('teamId', state.teamId);
      if (state.ownerId) qs.set('ownerId', state.ownerId);
      const q = qs.toString();
      const res = await api<{
        leads: DrilldownLead[];
        tasks: DrilldownTask[];
        staleDays?: number;
      }>(`/teams/metrics/${state.metric}${q ? `?${q}` : ''}`);
      setDrillLeads(res.leads ?? []);
      setDrillTasks(res.tasks ?? []);
      if (res.staleDays != null && state.metric === 'stale') {
        setDrilldown((d) =>
          d ? { ...d, subtitle: `No activity in ${res.staleDays}+ days` } : d,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load records');
      setDrilldown(null);
    } finally {
      setDrillLoading(false);
    }
  }

  function openOrgMetric(metric: MetricKey) {
    void openDrilldown({
      metric,
      title: `Organization · ${METRIC_LABELS[metric]}`,
      subtitle: 'All teams',
    });
  }

  function openTeamMetric(metric: MetricKey, teamId: string, teamName: string) {
    void openDrilldown({
      metric,
      title: `${teamName} · ${METRIC_LABELS[metric]}`,
      subtitle: teamName,
      teamId,
    });
  }

  return (
    <div className="page-dashboard manager-home">
      <PageHeader
        title="Manager home"
        subtitle="Click a metric to see underlying leads and tasks. Track team performance at a glance."
      />
      {error ? <div className="alert alert-error">{error}</div> : null}

      {brief && brief.bullets.length > 0 ? (
        <section className="card manager-brief">
          <h2 className="section-title">Manager brief</h2>
          <ul>
            {brief.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {brief.aiSummary ? <p className="muted">{brief.aiSummary}</p> : null}
        </section>
      ) : null}

      {orgStats && (
        <section className="manager-hero card">
          <div className="manager-hero-text">
            <h2>Organization snapshot</h2>
            <p className="muted">
              Real-time counts across Field Sales and Inside Sales. Select a card to drill into
              records.
            </p>
          </div>
          <div className="kpi-grid">
            <KpiCard
              label="Open leads"
              value={orgStats.open}
              icon="◎"
              variant="default"
              active={drilldown?.metric === 'open' && !drilldown.teamId}
              onClick={() => openOrgMetric('open')}
            />
            <KpiCard
              label="Overdue tasks"
              value={orgStats.overdue}
              icon="⏱"
              variant="warn"
              active={drilldown?.metric === 'overdue' && !drilldown.teamId}
              onClick={() => openOrgMetric('overdue')}
            />
            <KpiCard
              label="Stale leads"
              value={orgStats.stale}
              hint="7+ days idle"
              icon="⚠"
              variant="warn"
              active={drilldown?.metric === 'stale' && !drilldown.teamId}
              onClick={() => openOrgMetric('stale')}
            />
            <KpiCard
              label="Won"
              value={orgStats.won}
              icon="✓"
              variant="success"
              active={drilldown?.metric === 'won' && !drilldown.teamId}
              onClick={() => openOrgMetric('won')}
            />
          </div>
          <div className="manager-quick-links">
            <Link to="/pipeline" className="quick-chip">
              Pipeline
            </Link>
            <Link to="/leads" className="quick-chip">
              All leads
            </Link>
            <Link to="/calendar" className="quick-chip">
              My calendar
            </Link>
            <Link to="/reports" className="quick-chip">
              Reports
            </Link>
          </div>
        </section>
      )}

      <div className="manager-teams-grid">
        {(data?.teams ?? []).map((team) => (
          <section key={team.id} className="team-panel card">
            <div className="team-panel-head">
              <div>
                <h2>{team.name}</h2>
                <p className="muted">
                  {team.memberCount} rep{team.memberCount === 1 ? '' : 's'} ·{' '}
                  {formatActivity(team.stats.lastActivityAt)}
                </p>
              </div>
              <div className="team-panel-actions">
                <Link
                  to={`/pipeline${filterSearchParams({ teamId: team.id, title: team.name })}`}
                  className="btn-secondary btn-sm"
                >
                  Pipeline
                </Link>
                <Link
                  to={`/leads${filterSearchParams({ teamId: team.id, title: team.name })}`}
                  className="btn-secondary btn-sm"
                >
                  Leads
                </Link>
              </div>
            </div>
            <div className="kpi-grid kpi-grid-compact">
              <KpiCard
                label="Open"
                value={team.stats.openLeads}
                onClick={() => openTeamMetric('open', team.id, team.name)}
              />
              <KpiCard
                label="Overdue"
                value={team.stats.overdueTasks}
                variant="warn"
                onClick={() => openTeamMetric('overdue', team.id, team.name)}
              />
              <KpiCard
                label="Stale"
                value={team.stats.staleLeads}
                variant="warn"
                onClick={() => openTeamMetric('stale', team.id, team.name)}
              />
              <KpiCard
                label="Won"
                value={team.stats.wonLeads}
                variant="success"
                onClick={() => openTeamMetric('won', team.id, team.name)}
              />
            </div>
            {team.members.length > 0 ? (
              <ul className="rep-list">
                {team.members.map((m) => (
                  <li key={m.id} className="rep-row">
                    <button
                      type="button"
                      className="rep-row-main"
                      onClick={() =>
                        void openDrilldown({
                          metric: 'open',
                          title: `${m.name} · open leads`,
                          subtitle: m.name,
                          ownerId: m.id,
                        })
                      }
                    >
                      <span className="rep-avatar" aria-hidden>
                        {m.name.charAt(0)}
                      </span>
                      <span className="rep-info">
                        <strong>{m.name}</strong>
                        <span className="muted">
                          {m.stats.openLeads} open · {m.stats.overdueTasks} overdue ·{' '}
                          {m.stats.staleLeads} stale
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No members assigned.</p>
            )}
          </section>
        ))}
      </div>

      {data && data.unassigned.length > 0 ? (
        <section className="card">
          <h2>Unassigned reps</h2>
          <ul className="rep-list">
            {data.unassigned.map((u) => (
              <li key={u.id} className="rep-row">
                <Link
                  to={`/leads${filterSearchParams({ ownerId: u.id, title: u.name })}`}
                  className="rep-row-main"
                >
                  <span className="rep-avatar">{u.name.charAt(0)}</span>
                  <span className="rep-info">
                    <strong>{u.name}</strong>
                    <span className="muted">
                      {u.stats.openLeads} open · {u.stats.overdueTasks} overdue
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <TeamActivityFeed
        leads={leads.map((l) => ({ id: l.id, name: l.name, company: l.company }))}
      />

      {drilldown && !drillLoading ? (
        <MetricDrilldown
          title={drilldown.title}
          subtitle={drilldown.subtitle}
          leads={drillLeads}
          tasks={drillTasks}
          onClose={() => setDrilldown(null)}
          onSelectLead={(id) => {
            setSelectedLeadId(id);
            setDrilldown(null);
          }}
        />
      ) : null}

      {drilldown && drillLoading ? (
        <div className="drilldown-backdrop" role="presentation">
          <div className="drilldown-panel drilldown-loading">
            <p className="muted">Loading records…</p>
          </div>
        </div>
      ) : null}

      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onUpdated={() => {
          api<TeamsResponse>('/teams').then(setData).catch(() => {});
        }}
      />
    </div>
  );
}
