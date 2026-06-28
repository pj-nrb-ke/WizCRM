import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ChevronDown, Lock, Unlock } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin, isManager } from '../lib/roles';
import { NavIcon } from './NavIcon';
import { BoltGlyph } from './BrandMark';
import { LicenseBanner } from './LicenseBanner';

const W_COLLAPSED = 64;
const W_EXPANDED = 240;

function NavItem({
  to,
  end,
  icon,
  label,
  expanded,
}: {
  to: string;
  end?: boolean;
  icon: Parameters<typeof NavIcon>[0]['name'];
  label: string;
  expanded: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={!expanded ? label : undefined}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      style={{ justifyContent: expanded ? undefined : 'center', padding: expanded ? '5px 8px' : '5px 0' }}
    >
      {({ isActive }) => (
        <>
          {/* Amber left-border active indicator */}
          {isActive && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 2,
                height: 18,
                background: '#D97706',
                borderRadius: '0 2px 2px 0',
                flexShrink: 0,
              }}
            />
          )}
          <span
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: 30,
              height: 30,
              background: isActive ? 'rgba(26, 86, 219, 0.20)' : 'transparent',
              color: isActive ? '#93c5fd' : 'rgba(148,163,184,0.7)',
              transition: 'background 150ms, color 150ms',
            }}
          >
            <NavIcon name={icon} />
          </span>
          {expanded && (
            <span style={{ color: isActive ? '#e0e7ff' : '#7c8fa6', fontSize: 13, whiteSpace: 'nowrap' }}>
              {label}
            </span>
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
  expanded: sidebarExpanded,
  children,
}: {
  label: string;
  storageKey: string;
  defaultOpen?: boolean;
  expanded: boolean;
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

  if (!sidebarExpanded) {
    return <div style={{ marginTop: 8 }}>{children}</div>;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between transition-colors hover:opacity-80"
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
      {open && <div style={{ overflow: 'hidden' }}>{children}</div>}
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

  // Collapsing rail sidebar state
  const [locked, setLocked] = useState<boolean>(() => {
    try { return localStorage.getItem('wiz-sidebar-locked') === 'true'; } catch { return false; }
  });
  const [hovered, setHovered] = useState(false);
  const expanded = locked || hovered;
  const sidebarW = expanded ? W_EXPANDED : W_COLLAPSED;

  function toggleLock() {
    setLocked((v) => {
      const next = !v;
      try { localStorage.setItem('wiz-sidebar-locked', String(next)); } catch {}
      return next;
    });
  }

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
      {/* ── Collapsing rail sidebar ── */}
      <aside
        className="sidebar"
        style={{ width: sidebarW }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Brand mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: expanded ? '0 12px 14px' : '0 0 14px',
            marginBottom: 4,
            borderBottom: '1px solid rgba(255,255,255,0.055)',
            justifyContent: expanded ? 'flex-start' : 'center',
            transition: 'padding 200ms ease, justify-content 200ms ease',
            overflow: 'hidden',
          }}
        >
          <div
            className="flex flex-shrink-0 items-center justify-center rounded-xl relative overflow-hidden"
            style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #1A56DB 0%, #1245B8 50%, #0D3A9E 100%)',
              boxShadow: '0 3px 12px rgba(26, 86, 219, 0.45)',
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="w-full h-full object-cover" />
            ) : (
              <BoltGlyph size={18} />
            )}
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }}
            />
          </div>
          {expanded && (
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span
                className="font-700 text-sm leading-tight truncate"
                style={{ color: '#f1f5f9', letterSpacing: '-0.01em', fontFamily: 'var(--font-display)' }}
              >
                {brandName}
              </span>
              <span className="text-[11px]" style={{ color: '#3d4f63' }}>
                Enterprise CRM
              </span>
            </div>
          )}
          {/* Live status dot — only when expanded */}
          {expanded && (
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
          )}
        </div>

        {/* Nav */}
        <nav
          className="sidebar-nav"
          style={{
            flex: 1,
            overflow: 'hidden auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            padding: expanded ? '0 10px' : '0 8px',
          }}
        >
          <div style={{ marginTop: 8 }}>
            <NavItem to="/" end icon="home" label="Dashboard" expanded={expanded} />
          </div>

          {manager && (
            <CollapsibleNavGroup label="Sales" storageKey="sales" defaultOpen expanded={expanded}>
              <NavItem to="/manager" icon="dashboard" label="Manager view" expanded={expanded} />
              <NavItem to="/pipeline" icon="pipeline" label="Pipeline" expanded={expanded} />
              <NavItem to="/leads" icon="leads" label="Leads" expanded={expanded} />
              <NavItem to="/leads/import" icon="leads" label="Bulk import" expanded={expanded} />
              <NavItem to="/lead-generator" icon="ai" label="Lead Generator" expanded={expanded} />
              <NavItem to="/calendar" icon="calendar" label="Calendar" expanded={expanded} />
            </CollapsibleNavGroup>
          )}

          {manager && (
            <CollapsibleNavGroup label="Analytics" storageKey="analytics" defaultOpen expanded={expanded}>
              <NavItem to="/reports" icon="reports" label="Reports" expanded={expanded} />
              <NavItem to="/targets" icon="reports" label="Targets" expanded={expanded} />
              <NavItem to="/data-hygiene" icon="leads" label="Data hygiene" expanded={expanded} />
            </CollapsibleNavGroup>
          )}

          {manager && (
            <CollapsibleNavGroup label="Organisation" storageKey="organisation" defaultOpen={false} expanded={expanded}>
              <NavItem to="/organization" icon="org" label="Profile" expanded={expanded} />
              <NavItem to="/settings/crm" icon="org" label="CRM lists" expanded={expanded} />
              <NavItem to="/teams" icon="teams" label="Teams" expanded={expanded} />
              <NavItem to="/business" icon="org" label="Business checklist" expanded={expanded} />
            </CollapsibleNavGroup>
          )}

          {admin && (
            <CollapsibleNavGroup label="Admin" storageKey="admin" defaultOpen={false} expanded={expanded}>
              <NavItem to="/users" icon="users" label="Users" expanded={expanded} />
              <NavItem to="/settings/branding" icon="org" label="Branding" expanded={expanded} />
              <NavItem to="/platform" icon="ai" label="AI & platform" expanded={expanded} />
              <NavItem to="/connection" icon="mobile" label="Mobile connection" expanded={expanded} />
              <NavItem to="/integrations" icon="leads" label="Integrations" expanded={expanded} />
              <NavItem to="/audit" icon="audit" label="AI audit log" expanded={expanded} />
            </CollapsibleNavGroup>
          )}
        </nav>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.055)',
            paddingTop: 12,
            marginTop: 'auto',
            padding: expanded ? '12px 10px 0' : '12px 8px 0',
          }}
        >
          {/* User chip */}
          {expanded ? (
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1.5 rounded-xl transition-colors hover:bg-white/5 cursor-default">
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-700 text-xs text-white"
                style={{ background: 'linear-gradient(135deg, #374151, #1f2937)' }}
              >
                {(user?.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-600 leading-tight truncate" style={{ color: '#e2e8f0' }}>
                  {user?.name}
                </span>
                <span className="text-[10px]" style={{ color: '#3d4f63' }}>
                  {roleLabel}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-center mb-1.5 cursor-default"
              title={`${user?.name} — ${roleLabel}`}
              style={{ padding: '4px 0' }}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full font-700 text-xs text-white"
                style={{ background: 'linear-gradient(135deg, #374151, #1f2937)' }}
              >
                {(user?.name ?? '?').charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Lock / sign-out row */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {expanded && (
              <button
                type="button"
                className="btn-logout"
                onClick={logout}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  color: '#475569',
                  transition: 'all 0.15s',
                  fontSize: '0.78rem',
                  padding: '8px 10px',
                }}
              >
                <NavIcon name="logout" />
                Sign out
              </button>
            )}
            <button
              type="button"
              onClick={toggleLock}
              title={locked ? 'Unpin sidebar' : 'Pin sidebar open'}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                color: locked ? '#D97706' : '#475569',
                padding: 7,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s, border-color 0.15s',
                borderColor: locked ? 'rgba(217,119,6,0.4)' : 'rgba(255,255,255,0.06)',
              }}
            >
              {locked ? <Lock size={15} /> : <Unlock size={15} />}
            </button>
          </div>
        </div>
      </aside>

      <div className="workspace" style={{ marginLeft: sidebarW }}>
        <LicenseBanner entitlements={entitlements} />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
