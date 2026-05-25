import { Link } from 'react-router-dom';

export type DrilldownLead = {
  id: string;
  name: string;
  company: string | null;
  stage: string;
  owner?: { name: string; team?: { name: string } | null } | null;
  lastActivityAt?: string | null;
};

export type DrilldownTask = {
  id: string;
  title: string;
  dueAt: string | null;
  owner: { name: string };
  lead: { id: string; name: string; company: string | null; stage: string } | null;
};

type Props = {
  title: string;
  subtitle?: string;
  leads: DrilldownLead[];
  tasks: DrilldownTask[];
  onClose: () => void;
  onSelectLead: (id: string) => void;
};

export function MetricDrilldown({
  title,
  subtitle,
  leads,
  tasks,
  onClose,
  onSelectLead,
}: Props) {
  return (
    <div className="drilldown-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <aside className="drilldown-panel" onClick={(e) => e.stopPropagation()}>
        <header className="drilldown-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </header>

        {tasks.length > 0 ? (
          <section className="drilldown-section">
            <h3>Overdue tasks ({tasks.length})</h3>
            <ul className="drilldown-list">
              {tasks.map((t) => (
                <li key={t.id} className="drilldown-row">
                  <div>
                    <strong>{t.title}</strong>
                    <span className="drilldown-meta">
                      {t.owner.name}
                      {t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ''}
                    </span>
                  </div>
                  {t.lead ? (
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => onSelectLead(t.lead!.id)}
                    >
                      {t.lead.name}
                    </button>
                  ) : (
                    <span className="muted">No lead</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {leads.length > 0 ? (
          <section className="drilldown-section">
            <h3>Leads ({leads.length})</h3>
            <ul className="drilldown-list">
              {leads.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className="drilldown-lead-card"
                    onClick={() => onSelectLead(l.id)}
                  >
                    <div className="drilldown-lead-top">
                      <strong>{l.name}</strong>
                      <span className="stage-badge">{l.stage}</span>
                    </div>
                    {l.company ? <span className="drilldown-meta">{l.company}</span> : null}
                    <span className="drilldown-meta">
                      {l.owner?.name ?? 'Unassigned'}
                      {l.owner?.team ? ` · ${l.owner.team.name}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {leads.length === 0 && tasks.length === 0 ? (
          <p className="muted drilldown-empty">No records for this metric.</p>
        ) : null}

        <footer className="drilldown-footer">
          <Link to="/leads" className="btn-secondary" onClick={onClose}>
            Open all leads
          </Link>
        </footer>
      </aside>
    </div>
  );
}
