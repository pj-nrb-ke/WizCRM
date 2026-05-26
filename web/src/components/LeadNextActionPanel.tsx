import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Props = {
  leadId: string;
};

export function LeadNextActionPanel({ leadId }: Props) {
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setError('');
    api<{ action: string; reason: string; dismissed?: boolean }>(`/ai/leads/${leadId}/next-action`)
      .then((d) => {
        if (d.dismissed || !d.action) {
          setAction('');
          setReason('');
        } else {
          setAction(d.action);
          setReason(d.reason);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [leadId]);

  async function createTask() {
    if (!action) return;
    setBusy(true);
    setMessage('');
    try {
      await api(`/ai/leads/${leadId}/next-action/create-task`, {
        method: 'POST',
        body: { action },
      });
      setMessage('Follow-up task created.');
      setAction('');
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!action) return null;

  return (
    <section className="lead-next-action-panel">
      <h3 className="section-title">Suggested next action</h3>
      <p>
        <strong>{action}</strong>
      </p>
      {reason ? <p className="muted">{reason}</p> : null}
      <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => void createTask()}>
        {busy ? 'Creating…' : 'Create follow-up task'}
      </button>
      {message ? <p className="success">{message}</p> : null}
    </section>
  );
}
