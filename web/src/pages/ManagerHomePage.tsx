import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { filterSearchParams } from '../lib/manager-query';
import type { TeamsResponse } from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { TeamActivityFeed } from '../components/TeamActivityFeed';
import type { LeadSummary } from '../lib/types';

function StatPill({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`stat-pill${warn && value > 0 ? ' stat-pill-warn' : ''}`}>
      <span className="stat-pill-value">{value}</span>
      <span className="stat-pill-label">{label}</span>
    </div>
  );
}

function formatActivity(iso: string | null) {
  if (!iso) return 'No activity yet';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Active today';
  if (days === 1) return 'Active yesterday';
  return `Last activity ${days}d ago`;
}

export function ManagerHomePage() {
  const [data, setData] = useState<TeamsResponse | null>(null);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<TeamsResponse>('/teams')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
    api<{ leads: LeadSummary[] }>('/leads')
      .then((d) => setLeads(d.leads ?? []))
      .catch(() => setLeads([]));
  }, []);

  const orgStats = data?.teams.reduce(
    (acc, t) => ({
      open: acc.open + t.stats.openLeads,
      overdue: acc.overdue + t.stats.overdueTasks,
      stale: acc.stale + t.stats.staleLeads,
      won: acc.won + t.stats.wonLeads,
    }),
    { open: 0, overdue: 0, stale: 0, won: 0 },
  );

  return (
    <>
      <PageHeader
        title="Manager home"
        subtitle="Team overview — open the pipeline or leads list for a team or rep."
      />
      {error ? <div className="alert alert-error">{error}</div> : null}

      <TeamActivityFeed
        leads={leads.map((l) => ({ id: l.id, name: l.name, company: l.company }))}
      />

      {orgStats && (
        <div className="card">
          <h2>Organization</h2>
          <div className="stat-row">
            <StatPill label="Open leads" value={orgStats.open} />
            <StatPill label="Overdue tasks" value={orgStats.overdue} warn />
            <StatPill label="Stale leads" value={orgStats.stale} warn />
            <StatPill label="Won (all teams)" value={orgStats.won} />
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            <Link to="/pipeline">Pipeline board</Link> · <Link to="/leads">All leads</Link> ·{' '}
            <Link to="/reports">Reports & CSV</Link> · <Link to="/calendar">My calendar</Link>
          </p>
        </div>
      )}

      {(data?.teams ?? []).map((team) => (
        <div key={team.id} className="card">
          <h2>
            {team.name}
            <span className="muted"> · {team.memberCount} reps</span>
          </h2>
          <div className="stat-row">
            <StatPill label="Open" value={team.stats.openLeads} />
            <StatPill label="Overdue" value={team.stats.overdueTasks} warn />
            <StatPill label="Stale" value={team.stats.staleLeads} warn />
            <StatPill label="Won" value={team.stats.wonLeads} />
          </div>
          <p className="muted">{formatActivity(team.stats.lastActivityAt)}</p>
          <p>
            <Link to={`/pipeline${filterSearchParams({ teamId: team.id, title: team.name })}`}>
              Team pipeline
            </Link>
            {' · '}
            <Link to={`/leads${filterSearchParams({ teamId: team.id, title: team.name })}`}>
              Team leads
            </Link>
          </p>
          {team.members.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Rep</th>
                  <th>Open</th>
                  <th>Overdue</th>
                  <th>Stale</th>
                </tr>
              </thead>
              <tbody>
                {team.members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link
                        to={`/leads${filterSearchParams({
                          ownerId: m.id,
                          title: m.name,
                        })}`}
                      >
                        {m.name}
                      </Link>
                    </td>
                    <td>{m.stats.openLeads}</td>
                    <td>{m.stats.overdueTasks}</td>
                    <td>{m.stats.staleLeads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No members assigned.</p>
          )}
        </div>
      ))}

      {data && data.unassigned.length > 0 ? (
        <div className="card">
          <h2>Unassigned reps</h2>
          <ul className="link-list-plain">
            {data.unassigned.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/leads${filterSearchParams({ ownerId: u.id, title: u.name })}`}
                >
                  {u.name}
                </Link>
                <span className="muted">
                  {' '}
                  — {u.stats.openLeads} open, {u.stats.overdueTasks} overdue
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
