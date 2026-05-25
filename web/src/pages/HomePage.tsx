import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin, isManager } from '../lib/roles';
import { PageHeader } from '../components/PageHeader';

type AdminHealth = {
  status: string;
  aiEnabled: boolean;
  deskUseAi: boolean;
  apiPublicUrl: string;
  webPublicUrl: string;
};

type QuickLink = {
  to: string;
  title: string;
  description: string;
  accent: 'indigo' | 'emerald' | 'amber' | 'sky';
};

export function HomePage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isManager(user?.role)) return;
    api<AdminHealth>('/admin/health')
      .then(setHealth)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [user?.role]);

  const quickLinks: QuickLink[] = [];
  if (isManager(user?.role)) {
    quickLinks.push(
      {
        to: '/manager',
        title: 'Manager home',
        description: 'Team stats, overdue tasks, and rep performance',
        accent: 'indigo',
      },
      {
        to: '/pipeline',
        title: 'Pipeline',
        description: 'Kanban view of leads by stage',
        accent: 'sky',
      },
      {
        to: '/leads',
        title: 'Leads',
        description: 'Search, filter, and open lead details',
        accent: 'emerald',
      },
      {
        to: '/reports',
        title: 'Reports',
        description: 'Export CSV summaries for your org',
        accent: 'amber',
      },
      {
        to: '/organization',
        title: 'Organization',
        description: 'Company profile and branding',
        accent: 'indigo',
      },
      {
        to: '/teams',
        title: 'Teams',
        description: 'Create teams and assign reps',
        accent: 'sky',
      },
    );
  }
  if (isAdmin(user?.role)) {
    quickLinks.push(
      {
        to: '/users',
        title: 'Users',
        description: 'Accounts, roles, and team assignment',
        accent: 'indigo',
      },
      {
        to: '/platform',
        title: 'AI & platform',
        description: 'Desk mode, AI health, and model settings',
        accent: 'amber',
      },
      {
        to: '/connection',
        title: 'Mobile connection',
        description: 'API URL for the field sales app',
        accent: 'emerald',
      },
      {
        to: '/audit',
        title: 'AI audit log',
        description: 'Review AI suggestions and usage',
        accent: 'sky',
      },
    );
  }

  const firstName = user?.name?.split(/\s+/)[0] ?? 'there';

  return (
    <div className="page-dashboard">
      <PageHeader
        title={`Good ${hourGreeting()}, ${firstName}`}
        subtitle="Web console for managers and admins. Reps work primarily in the mobile app."
      />

      {error ? <div className="alert alert-error">{error}</div> : null}

      {health && (
        <section className="status-grid" aria-label="System status">
          <div className="status-card">
            <span className="status-label">API</span>
            <span className={`badge ${health.status === 'ok' ? 'badge-success' : 'badge-warn'}`}>
              {health.status === 'ok' ? 'Operational' : health.status}
            </span>
          </div>
          <div className="status-card">
            <span className="status-label">AI services</span>
            <span className={`badge ${health.aiEnabled ? 'badge-success' : 'badge-neutral'}`}>
              {health.aiEnabled ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <div className="status-card">
            <span className="status-label">Sales desk</span>
            <span className="badge badge-info">
              {health.deskUseAi ? 'AI-ranked' : 'Rules (fast)'}
            </span>
          </div>
          <div className="status-card status-card-wide">
            <span className="status-label">Endpoints</span>
            <span className="status-endpoints">
              <a href={health.apiPublicUrl} target="_blank" rel="noreferrer">
                API
              </a>
              <span className="sep">·</span>
              <a href={health.webPublicUrl} target="_blank" rel="noreferrer">
                Web
              </a>
            </span>
          </div>
        </section>
      )}

      <section className="dashboard-section">
        <h2 className="section-title">Quick actions</h2>
        <div className="quick-grid">
          {quickLinks.map((item) => (
            <Link key={item.to} to={item.to} className={`quick-tile accent-${item.accent}`}>
              <span className="quick-tile-title">{item.title}</span>
              <span className="quick-tile-desc">{item.description}</span>
              <span className="quick-tile-arrow" aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="card card-tip">
        <h2 className="section-title">Mobile-first sales</h2>
        <p className="muted">
          WizCRM Lite runs on Android for reps: leads, desk, calls, notes, and card scan. This
          web app is for oversight, configuration, and reporting.
        </p>
      </div>
    </div>
  );
}

function hourGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
