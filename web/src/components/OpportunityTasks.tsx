import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

type TaskRow = {
  id: string;
  title: string;
  dueAt: string | null;
  completedAt: string | null;
};

type Props = {
  opportunityId: string;
};

export function OpportunityTasks({ opportunityId }: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api<{ tasks: TaskRow[] }>(`/tasks?opportunityId=${opportunityId}`);
      setTasks(res.tasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tasks');
    }
  }, [opportunityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    try {
      await api('/tasks', {
        method: 'POST',
        body: {
          title: trimmed,
          opportunityId,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        },
      });
      setTitle('');
      setDueAt('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add task');
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task: TaskRow) {
    try {
      await api(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: { completed: !task.completedAt },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update task');
    }
  }

  return (
    <section className="opportunity-tasks">
      <h4>Tasks</h4>
      {error ? <p className="error">{error}</p> : null}
      {tasks.length === 0 ? (
        <p className="muted">No tasks on this opportunity yet.</p>
      ) : (
        <ul className="mini-list">
          {tasks.map((t) => (
            <li key={t.id}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={!!t.completedAt} onChange={() => void toggleDone(t)} />
                <span style={{ textDecoration: t.completedAt ? 'line-through' : 'none' }}>{t.title}</span>
                {t.dueAt ? <span className="muted"> · due {new Date(t.dueAt).toLocaleDateString()}</span> : null}
              </label>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => void addTask(e)} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          type="text"
          placeholder="e.g. Finalize the quote today"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1 }}
        />
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        <button type="submit" className="btn-secondary btn-sm" disabled={saving || !title.trim()}>
          {saving ? 'Adding…' : 'Add reminder'}
        </button>
      </form>
    </section>
  );
}
