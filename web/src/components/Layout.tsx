import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isAdmin, isManager } from '../lib/roles';
import { NavIcon } from './NavIcon';

function NavItem({ to, end, icon, children }: {
  to: string;
  end?: boolean;
  icon: Parameters<typeof NavIcon>[0]['name'];
  children: ReactNode;
}) {
  return (
    <NavLink to={to} end={end} className="nav-item">
      <NavIcon name={icon} />
      <span>{children}</span>
    </NavLink>
  );
}

function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="nav-section">
      <span className="nav-section-label">{label}</span>
      {children}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const manager = isManager(user?.role);
  const admin = isAdmin(user?.role);
  const roleLabel = admin ? 'Administrator' : manager ? 'Manager' : 'User';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden>
            W
          </div>
          <div className="brand-text">
            <strong>WizCRM</strong>
            <span>Web console</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavItem to="/" end icon="home">
            Overview
          </NavItem>

          {manager && (
            <NavSection label="Sales workspace">
              <NavItem to="/manager" icon="dashboard">
                Manager home
              </NavItem>
              <NavItem to="/pipeline" icon="pipeline">
                Pipeline
              </NavItem>
              <NavItem to="/leads" icon="leads">
                Leads
              </NavItem>
              <NavItem to="/leads/import" icon="leads">
                Bulk import
              </NavItem>
              <NavItem to="/calendar" icon="calendar">
                My calendar
              </NavItem>
              <NavItem to="/reports" icon="reports">
                Reports
              </NavItem>
            </NavSection>
          )}

          {manager && (
            <NavSection label="Organization">
              <NavItem to="/organization" icon="org">
                Profile
              </NavItem>
              <NavItem to="/settings/crm" icon="org">
                CRM lists
              </NavItem>
              <NavItem to="/teams" icon="teams">
                Teams
              </NavItem>
            </NavSection>
          )}

          {admin && (
            <NavSection label="Administration">
              <NavItem to="/users" icon="users">
                Users
              </NavItem>
              <NavItem to="/platform" icon="ai">
                AI & platform
              </NavItem>
              <NavItem to="/connection" icon="mobile">
                Mobile connection
              </NavItem>
              <NavItem to="/audit" icon="audit">
                AI audit log
              </NavItem>
            </NavSection>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar" aria-hidden>
              {(user?.name ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="user-meta">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{roleLabel}</span>
            </div>
          </div>
          <button type="button" className="btn-logout" onClick={logout}>
            <NavIcon name="logout" />
            Log out
          </button>
        </div>
      </aside>

      <div className="workspace">
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
