import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Props = {
  leadId: string;
  leadEmail?: string | null;
  leadPhone?: string | null;
};

type EmailStatus = { configured: boolean; method: string };

export function CommunicationDraftPanel({ leadId, leadEmail, leadPhone }: Props) {
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [tone, setTone] = useState<'friendly' | 'formal'>('friendly');
  const [subject, setSubject] = useState('');
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);

  useEffect(() => {
    api<EmailStatus>('/email/status')
      .then(setEmailStatus)
      .catch(() => setEmailStatus({ configured: false, method: 'none' }));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ channel, tone });
    api<{ draft: string; note?: string }>(`/ai/leads/${leadId}/draft-message?${qs}`)
      .then((d) => {
        setDraft(d.draft);
        setNote(d.note ?? '');
        if (channel === 'email' && !subject) {
          setSubject(`Follow up`);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load draft'))
      .finally(() => setLoading(false));
  }, [leadId, channel, tone]);

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard');
    }
  }

  async function sendViaBrevo() {
    if (!leadEmail?.trim()) {
      setError('Lead has no email address');
      return;
    }
    if (!draft.trim()) {
      setError('Draft is empty');
      return;
    }
    setSending(true);
    setError('');
    try {
      await api(`/email/leads/${leadId}/send`, {
        method: 'POST',
        body: {
          subject: subject.trim() || `Follow up`,
          body: draft.trim(),
        },
      });
      setDraft('');
      setNote('Email sent via Brevo and logged on the timeline.');
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 503) {
        setError('Brevo is not configured on the server (docs/brevo.local.txt).');
      } else {
        setError(err.message || 'Send failed');
      }
    } finally {
      setSending(false);
    }
  }

  const mailto =
    leadEmail && channel === 'email'
      ? `mailto:${encodeURIComponent(leadEmail)}?body=${encodeURIComponent(draft)}`
      : null;
  const wa =
    leadPhone && channel === 'whatsapp'
      ? `https://wa.me/${leadPhone.replace(/\D/g, '')}?text=${encodeURIComponent(draft)}`
      : null;

  return (
    <section className="communication-draft-panel">
      <h3 className="section-title">Communication draft</h3>
      <p className="muted">Approve before sending — copy, send via Brevo, or open your mail/WhatsApp app.</p>
      <div className="toolbar">
        <select value={channel} onChange={(e) => setChannel(e.target.value as 'email' | 'whatsapp')}>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select value={tone} onChange={(e) => setTone(e.target.value as 'friendly' | 'formal')}>
          <option value="friendly">Friendly</option>
          <option value="formal">Formal</option>
        </select>
      </div>
      {loading ? <p className="muted">Generating draft…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {channel === 'email' ? (
        <label className="field">
          Subject
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Follow up"
          />
        </label>
      ) : null}
      <textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} readOnly={loading} />
      {note ? <p className="muted">{note}</p> : null}
      <div className="toolbar">
        <button type="button" className="btn-secondary btn-sm" onClick={() => void copyDraft()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        {channel === 'email' && leadEmail ? (
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={sending || loading || !emailStatus?.configured}
            title={
              emailStatus?.configured
                ? 'Send via Brevo'
                : 'Configure Brevo on the API server first'
            }
            onClick={() => void sendViaBrevo()}
          >
            {sending ? 'Sending…' : 'Send via Brevo'}
          </button>
        ) : null}
        {mailto ? (
          <a className="btn-secondary btn-sm" href={mailto}>
            Open in mail app
          </a>
        ) : null}
        {wa ? (
          <a className="btn-secondary btn-sm" href={wa} target="_blank" rel="noreferrer">
            Open WhatsApp
          </a>
        ) : null}
      </div>
    </section>
  );
}
