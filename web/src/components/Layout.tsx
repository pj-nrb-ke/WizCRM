import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isAdmin, isManager } from '../lib/roles';

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <strong>WizCRM</strong>
          <span className="muted">{isManager(user?.role) ? 'Manager' : 'Settings'}</span>
        </div>
        <nav>
          <NavLink to="/" end>
            Home
          </NavLink>
          {isManager(user?.role) && (
            <>
              <NavLink to="/manager">Manager home</NavLink>
              <NavLink to="/pipeline">Pipeline</NavLink>
              <NavLink to="/leads">Leads</NavLink>
              <NavLink to="/reports">Reports</NavLink>
            </>
          )}
          {isManager(user?.role) && (
            <NavLink to="/organization">Organization</NavLink>
          )}
          {isAdmin(user?.role) && (
            <>
              <NavLink to="/users">Users</NavLink>
              <NavLink to="/platform">AI & platform</NavLink>
              <NavLink to="/connection">Mobile connection</NavLink>
              <NavLink to="/audit">AI audit log</NavLink>
            </>
          )}
          {isManager(user?.role) && <NavLink to="/teams">Teams</NavLink>}
        </nav>
        <div className="sidebar-footer">
          <p className="muted">{user?.name}</p>
          <p className="muted">{user?.role}</p>
          <button type="button" className="btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
      <style>{`
        .layout { display: flex; min-height: 100vh; }
        .sidebar {
          width: 240px;
          background: #1e293b;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #334155;
        }
        .brand { margin-bottom: 24px; display: flex; flex-direction: column; gap: 4px; }
        nav { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        nav a {
          padding: 8px 10px;
          border-radius: 8px;
          color: #cbd5e1;
          text-decoration: none;
        }
        nav a.active { background: #334155; color: #38bdf8; }
        .sidebar-footer { margin-top: auto; padding-top: 16px; }
        .sidebar-footer button { width: 100%; margin-top: 8px; }
        .main { flex: 1; padding: 28px 32px; max-width: 1200px; }
        .main:has(.page-wide) { max-width: none; }
        h1 { margin: 0 0 8px; font-size: 1.75rem; }
        h2 { margin: 0 0 12px; font-size: 1.1rem; color: #94a3b8; }
      `}</style>
    </div>
  );
}
