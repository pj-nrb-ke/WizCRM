import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Props = {
  leadId: string;
  leadEmail?: string | null;
  leadPhone?: string | null;
};

export function CommunicationDraftPanel({ leadId, leadEmail, leadPhone }: Props) {
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [tone, setTone] = useState<'friendly' | 'formal'>('friendly');
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ channel, tone });
    api<{ draft: string; note?: string }>(`/ai/leads/${leadId}/draft-message?${qs}`)
      .then((d) => {
        setDraft(d.draft);
        setNote(d.note ?? '');
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
      <p className="muted">Approve before sending — copy or open your mail/WhatsApp app.</p>
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
      <textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} readOnly={loading} />
      {note ? <p className="muted">{note}</p> : null}
      <div className="toolbar">
        <button type="button" className="btn-secondary btn-sm" onClick={() => void copyDraft()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        {mailto ? (
          <a className="btn-secondary btn-sm" href={mailto}>
            Open email
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
