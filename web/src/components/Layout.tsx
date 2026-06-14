import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin, isManager } from '../lib/roles';
import { NavIcon } from './NavIcon';
import { BoltGlyph } from './BrandMark';
import { LicenseBanner } from './LicenseBanner';

function NavItem({ to, end, icon, children }: {
  to: string;
  end?: boolean;
  icon: Parameters<typeof NavIcon>[0]['name'];
  children: ReactNode;
}) {
  return (
    <NavLink to={to} end={end} className="nav-item">
      {({ isActive }) => (
        <>
          <span
            className="flex items-center justify-center rounded-lg transition-all duration-150 flex-shrink-0"
            style={{
              width: 30,
              height: 30,
              background: isActive ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: isActive ? '#a5b4fc' : 'rgba(148,163,184,0.7)',
            }}
          >
            <NavIcon name={icon} />
          </span>
          <span style={{ color: isActive ? '#e0e7ff' : '#7c8fa6', fontSize: 13 }}>{children}</span>
          {isActive && (
            <span
              className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ background: '#a5b4fc' }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}

function CollapsibleNavGroup({
  label,
  storageKey,
  defaultOpen = true,
  children,
}: {
  label: string;
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(`nav-${storageKey}`);
      return stored !== null ? stored === 'true' : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  function toggle() {
    setOpen((v) => {
      const next = !v;
      try { localStorage.setItem(`nav-${storageKey}`, String(next)); } catch {}
      return next;
    });
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-3 pb-1.5 transition-colors hover:opacity-80"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 10px 6px' }}
      >
        <span
          className="text-[10px] font-700 uppercase tracking-widest"
          style={{ color: '#334155', letterSpacing: '0.09em' }}
        >
          {label}
        </span>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          style={{
            color: '#475569',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
      {open && (
        <div style={{ overflow: 'hidden' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { user, entitlements, logout } = useAuth();
  const manager = isManager(user?.role);
  const admin = isAdmin(user?.role);
  const roleLabel = admin ? 'Administrator' : manager ? 'Manager' : 'User';
  const [brandName, setBrandName] = useState('WizCRM');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{
      branding?: { displayName?: string | null; primaryColorHex?: string | null; logoUrl?: string | null };
    }>('/leads/crm-config')
      .then((d) => {
        if (d.branding?.displayName) setBrandName(d.branding.displayName);
        if (d.branding?.logoUrl) setLogoUrl(d.branding.logoUrl);
        if (d.branding?.primaryColorHex) {
          document.documentElement.style.setProperty('--accent', d.branding.primaryColorHex);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  return (
    <div className="app-shell">
      {/* ── Premium dark sidebar ── */}
      <aside
        className="sidebar"
        style={{
          background: 'linear-gradient(180deg, #080d18 0%, #0d1117 40%, #0f1923 100%)',
          borderRight: '1px solid rgba(255,255,255,0.045)',
          padding: '14px 10px',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 rounded-xl px-2 py-2.5 mb-1"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.055)', paddingBottom: 14, marginBottom: 4 }}
        >
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl font-700 text-white text-sm relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%)',
              boxShadow: '0 3px 12px rgba(99, 102, 241, 0.45)',
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="w-full h-full object-cover" />
            ) : (
              <BoltGlyph size={20} />
            )}
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span
              className="font-700 text-sm leading-tight truncate"
              style={{ color: '#f1f5f9', letterSpacing: '-0.01em' }}
            >
              {brandName}
            </span>
            <span className="text-[11px]" style={{ color: '#3d4f63' }}>
              Enterprise CRM
            </span>
          </div>
          {/* live status dot */}
          <div className="ml-auto flex-shrink-0 relative">
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: '#10b981', opacity: 0.35 }}
            />
            <div
              className="relative h-2 w-2 rounded-full"
              style={{ background: '#10b981', boxShadow: '0 0 5px rgba(16,185,129,0.6)' }}
              title="System operational"
            />
          </div>
        </div>

        {/* Nav */}
        <nav
          className="sidebar-nav"
          style={{ flex: 1, overflow: 'hidden auto', display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <div style={{ marginTop: 8 }}>
            <NavItem to="/" end icon="home">
              Dashboard
            </NavItem>
          </div>

          {manager && (
            <CollapsibleNavGroup label="Sales" storageKey="sales" defaultOpen>
              <NavItem to="/manager" icon="dashboard">
                Manager view
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
                Calendar
              </NavItem>
            </CollapsibleNavGroup>
          )}

          {manager && (
            <CollapsibleNavGroup label="Analytics" storageKey="analytics" defaultOpen>
              <NavItem to="/reports" icon="reports">
                Reports
              </NavItem>
              <NavItem to="/targets" icon="reports">
                Targets
              </NavItem>
              <NavItem to="/data-hygiene" icon="leads">
                Data hygiene
              </NavItem>
            </CollapsibleNavGroup>
          )}

          {manager && (
            <CollapsibleNavGroup label="Organisation" storageKey="organisation" defaultOpen={false}>
              <NavItem to="/organization" icon="org">
                Profile
              </NavItem>
              <NavItem to="/settings/crm" icon="org">
                CRM lists
              </NavItem>
              <NavItem to="/teams" icon="teams">
                Teams
              </NavItem>
              <NavItem to="/business" icon="org">
                Business checklist
              </NavItem>
            </CollapsibleNavGroup>
          )}

          {admin && (
            <CollapsibleNavGroup label="Admin" storageKey="admin" defaultOpen={false}>
              <NavItem to="/users" icon="users">
                Users
              </NavItem>
              <NavItem to="/settings/branding" icon="org">
                Branding
              </NavItem>
              <NavItem to="/platform" icon="ai">
                AI & platform
              </NavItem>
              <NavItem to="/connection" icon="mobile">
                Mobile connection
              </NavItem>
              <NavItem to="/integrations" icon="leads">
                Integrations
              </NavItem>
              <NavItem to="/audit" icon="audit">
                AI audit log
              </NavItem>
            </CollapsibleNavGroup>
          )}
        </nav>

        {/* Footer */}
        <div
          style={{ borderTop: '1px solid rgba(255,255,255,0.055)', paddingTop: 12, marginTop: 'auto' }}
        >
          {/* User chip */}
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1.5 rounded-xl transition-colors hover:bg-white/5 cursor-default">
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-700 text-xs text-white"
              style={{ background: 'linear-gradient(135deg, #374151, #1f2937)' }}
            >
              {(user?.name ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="text-xs font-600 leading-tight truncate"
                style={{ color: '#e2e8f0' }}
              >
                {user?.name}
              </span>
              <span className="text-[10px]" style={{ color: '#3d4f63' }}>
                {roleLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn-logout"
            onClick={logout}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              color: '#475569',
              transition: 'all 0.15s',
            }}
          >
            <NavIcon name="logout" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="workspace">
        <LicenseBanner entitlements={entitlements} />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
