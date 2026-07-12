import { useEffect, useRef, useState } from 'react';
import { LogOut, KeyRound, ChevronDown } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { isAdmin, isManager } from '../lib/roles';
import { ChangePasswordModal } from './ChangePasswordModal';

export function UserMenu() {
  const { user, logout } = useAuth();
  const admin = isAdmin(user?.role);
  const manager = isManager(user?.role);
  const roleLabel = admin ? 'Administrator' : manager ? 'Manager' : 'User';

  const [open, setOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px 4px 4px',
          background: 'transparent',
          border: '1px solid rgba(148,163,184,0.25)',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-700 text-xs text-white"
          style={{ background: 'linear-gradient(135deg, #374151, #1f2937)' }}
        >
          {(user?.name ?? '?').charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{user?.name}</span>
        <ChevronDown size={14} strokeWidth={2.5} style={{ color: '#94a3b8' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 0,
            width: 220,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 8px 30px rgba(15,23,42,0.14)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{roleLabel}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setShowChangePw(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #f8fafc',
              cursor: 'pointer',
              fontSize: 13,
              color: '#334155',
            }}
          >
            <KeyRound size={14} strokeWidth={2} />
            Change password
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#dc2626',
            }}
          >
            <LogOut size={14} strokeWidth={2} />
            Sign out
          </button>
        </div>
      )}

      <ChangePasswordModal open={showChangePw} onClose={() => setShowChangePw(false)} />
    </div>
  );
}
