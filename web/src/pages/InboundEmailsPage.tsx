import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface InboundEmailRow {
  id: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string | null;
  bodyText: string | null;
  matchedTaskId: string | null;
  matchedUser: { name: string; email: string } | null;
  receivedAt: string;
}

type Filter = 'all' | 'matched' | 'unmatched';

export function InboundEmailsPage() {
  const [emails, setEmails] = useState<InboundEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs = filter === 'all' ? '' : `?filter=${filter}`;
    api<{ emails: InboundEmailRow[] }>(`/vsm/inbound-emails${qs}`)
      .then((data) => setEmails(data.emails))
      .catch(() => setError('Failed to load inbound emails.'))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
            Inbound Email
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
            Every email sent to an address on <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>reply.wizag.co.ke</code> lands here.
            Matched replies also appear on their task's thread; unmatched ones only live here.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'matched', 'unmatched'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${filter === f ? '#1A56DB' : '#e2e8f0'}`,
              background: filter === f ? '#eff6ff' : '#fff',
              color: filter === f ? '#1A56DB' : '#64748b',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading…</div>
      ) : emails.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: 14 }}>No inbound emails yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {emails.map((e) => {
            const isOpen = openId === e.id;
            return (
              <div key={e.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : e.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.subject || '(no subject)'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.fromName ? `${e.fromName} <${e.fromEmail}>` : e.fromEmail} → {e.toEmail}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {e.matchedTaskId ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: '#f0fdf4', color: '#15803d', borderRadius: 20, border: '1px solid #bbf7d0' }}>
                        Matched{e.matchedUser ? ` · ${e.matchedUser.name}` : ''}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: '#fffbeb', color: '#b45309', borderRadius: 20, border: '1px solid #fde68a' }}>
                        Unmatched
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(e.receivedAt).toLocaleString()}</span>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9' }}>
                    <pre style={{
                      marginTop: 12, fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      fontFamily: 'inherit', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 8, padding: 12,
                    }}>
                      {e.bodyText || '(no body extracted)'}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
