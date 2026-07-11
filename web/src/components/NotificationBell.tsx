import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 60_000;

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  function load() {
    api<{ notifications: Notification[]; unreadCount: number }>('/notifications')
      .then((d) => {
        setNotifications(d.notifications);
        setUnreadCount(d.unreadCount);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function onOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      try {
        await api('/notifications/read-all', { method: 'POST' });
      } catch {
        // best-effort
      }
    }
  }

  function onSelect(n: Notification) {
    setOpen(false);
    if (n.linkPath) navigate(n.linkPath);
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => void onOpen()}
        title="Notifications"
        style={{
          position: 'relative',
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '1px solid rgba(148,163,184,0.25)',
          borderRadius: 8,
          color: '#475569',
          cursor: 'pointer',
        }}
      >
        <Bell size={16} strokeWidth={2} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: '0 3px',
              borderRadius: 8,
              background: '#dc2626',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 0,
            width: 340,
            maxHeight: 420,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 8px 30px rgba(15,23,42,0.14)',
            zIndex: 50,
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Nothing yet.</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelect(n)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  background: n.readAt ? 'transparent' : '#eff6ff',
                  border: 'none',
                  borderBottom: '1px solid #f8fafc',
                  cursor: n.linkPath ? 'pointer' : 'default',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{n.body}</div>}
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{timeAgo(n.createdAt)}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
