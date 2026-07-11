import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  reason: string | null;
  source: 'USER' | 'VSM';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  lead: { id: string; name: string; company: string | null } | null;
  user: { id: string; name: string };
};

type TaskUpdateRow = {
  id: string;
  body: string;
  isVsm: boolean;
  createdAt: string;
  user: { id: string; name: string } | null;
};

type Props = {
  taskId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function TaskDrawer({ taskId, onClose, onUpdated }: Props) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [updates, setUpdates] = useState<TaskUpdateRow[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagNote, setFlagNote] = useState('');
  const [flagSent, setFlagSent] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setUpdates([]);
      setFlagOpen(false);
      setFlagSent(false);
      return;
    }
    setError('');
    Promise.all([
      api<{ task: TaskDetail }>(`/tasks/${taskId}`),
      api<{ updates: TaskUpdateRow[] }>(`/tasks/${taskId}/updates`),
    ])
      .then(([t, u]) => {
        setTask(t.task);
        setUpdates(u.updates);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load task'));
  }, [taskId]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId || !body.trim()) return;
    setSending(true);
    setError('');
    try {
      await api(`/tasks/${taskId}/updates`, { method: 'POST', body: { body: body.trim() } });
      setBody('');
      const { updates: u } = await api<{ updates: TaskUpdateRow[] }>(`/tasks/${taskId}/updates`);
      setUpdates(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  async function markComplete() {
    if (!taskId) return;
    setCompleting(true);
    setError('');
    try {
      const { task: updated } = await api<{ task: TaskDetail }>(`/tasks/${taskId}`, { method: 'PATCH', body: { completed: true } });
      setTask(updated);
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark complete');
    } finally {
      setCompleting(false);
    }
  }

  async function sendFlag() {
    if (!taskId) return;
    setError('');
    try {
      await api(`/tasks/${taskId}/flag`, { method: 'POST', body: { note: flagNote.trim() || undefined } });
      setFlagSent(true);
      setFlagOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to flag task');
    }
  }

  if (!taskId) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="drawer-close btn-secondary" onClick={onClose}>
          Close
        </button>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {!task ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <h2>{task.title}</h2>
            {task.lead && (
              <p className="muted">
                {task.lead.name}
                {task.lead.company ? ` (${task.lead.company})` : ''}
              </p>
            )}
            {task.source === 'VSM' && (
              <span className="badge badge-info" style={{ display: 'inline-block', marginBottom: 8 }}>
                Assigned by Wanjiru
              </span>
            )}
            {task.reason && <p className="muted">{task.reason}</p>}
            {task.description && task.description !== task.reason && <p>{task.description}</p>}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
              {task.completedAt ? (
                <span className="muted">Completed {new Date(task.completedAt).toLocaleString()}</span>
              ) : (
                <button type="button" className="btn-primary btn-sm" onClick={() => void markComplete()} disabled={completing}>
                  {completing ? 'Saving…' : 'Mark complete'}
                </button>
              )}
              {!flagSent ? (
                <button type="button" className="btn-secondary btn-sm" onClick={() => setFlagOpen((v) => !v)}>
                  Need help with this?
                </button>
              ) : (
                <span className="muted">Flagged for management — Wanjiru will let the CEO know.</span>
              )}
            </div>

            {flagOpen && (
              <div style={{ marginBottom: 16 }}>
                <textarea
                  rows={2}
                  value={flagNote}
                  placeholder="Optional — what's blocking you?"
                  onChange={(e) => setFlagNote(e.target.value)}
                  style={{ width: '100%' }}
                />
                <div className="toolbar">
                  <button type="button" className="btn-primary btn-sm" onClick={() => void sendFlag()}>
                    Flag for management
                  </button>
                </div>
              </div>
            )}

            <section>
              <h3 className="section-title">Thread</h3>
              <div className="lead-team-chat-messages">
                {updates.length === 0 ? (
                  <p className="muted">No replies yet.</p>
                ) : (
                  updates.map((u) => (
                    <article key={u.id} className="lead-team-chat-msg">
                      <header>
                        <strong>{u.isVsm ? 'Wanjiru' : (u.user?.name ?? 'Unknown')}</strong>
                        <span className="muted">{new Date(u.createdAt).toLocaleString()}</span>
                      </header>
                      <p>{u.body}</p>
                    </article>
                  ))
                )}
              </div>
              <form className="lead-team-chat-compose" onSubmit={(e) => void sendReply(e)}>
                <textarea
                  rows={3}
                  value={body}
                  placeholder="Reply on this task…"
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="toolbar">
                  <button type="submit" className="btn-primary btn-sm" disabled={sending || !body.trim()}>
                    {sending ? 'Sending…' : 'Reply'}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
