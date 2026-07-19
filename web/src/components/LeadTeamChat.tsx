import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getApiBaseUrl, getStoredToken } from '../lib/api';

type OrgUser = { id: string; name: string; email: string };

type Message = {
  id: string;
  body: string;
  createdAt: string;
  mentionedUserIds: string[];
  user: { id: string; name: string; email: string };
  attachments: { id: string; fileName: string; mimeType: string; sizeBytes: number }[];
};

type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  documentType?: string;
  amount?: number | string | null;
  user: { name: string };
};

const DOC_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General file',
  QUOTATION: 'Quotation',
  PROFORMA_INVOICE: 'Proforma invoice',
  INVOICE: 'Invoice',
  LPO: 'LPO (customer order)',
};

type Props = {
  leadId: string;
  leadName: string;
  /** Scope the thread + documents to one Sales Opportunity instead of the whole lead. */
  opportunityId?: string;
  /** Show the document-type tag picker on upload — only meaningful for an opportunity thread. */
  showDocumentTypeTag?: boolean;
  /** Called after a file finishes uploading — lets a parent refresh cost summaries fed by document totals. */
  onAttachmentUploaded?: () => void;
};

export function LeadTeamChat({
  leadId,
  leadName,
  opportunityId,
  showDocumentTypeTag,
  onAttachmentUploaded,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('GENERAL');
  const [docAmount, setDocAmount] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const amountEligible = ['QUOTATION', 'PROFORMA_INVOICE', 'INVOICE'].includes(docType);

  const scopeQuery = opportunityId ? `?opportunityId=${opportunityId}` : '';

  const load = useCallback(async () => {
    setError('');
    try {
      const [msgRes, attRes, userRes] = await Promise.all([
        api<{ messages: Message[] }>(`/leads/${leadId}/messages${scopeQuery}`),
        api<{ attachments: AttachmentRow[] }>(`/leads/${leadId}/attachments${scopeQuery}`),
        api<{ users: OrgUser[] }>('/teams/org-members'),
      ]);
      setMessages(msgRes.messages);
      setAttachments(attRes.attachments);
      setUsers(userRes.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load team chat');
    }
  }, [leadId, scopeQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  function insertMention(u: OrgUser) {
    const token = `@[${u.name}](${u.id}) `;
    setBody((b) => `${b}${token}`);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError('');
    try {
      await api(`/leads/${leadId}/messages`, {
        method: 'POST',
        body: { body: text, opportunityId },
      });
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  async function onFileChange(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be 5MB or smaller');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const dataBase64 = await fileToBase64(file);
      await api(`/leads/${leadId}/attachments`, {
        method: 'POST',
        body: {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64,
          opportunityId,
          documentType: opportunityId ? docType : undefined,
          amount: opportunityId && amountEligible && docAmount ? Number(docAmount) : undefined,
        },
      });
      if (fileRef.current) fileRef.current.value = '';
      setDocType('GENERAL');
      setDocAmount('');
      await load();
      onAttachmentUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const mentionFilter = body.match(/@(\w*)$/)?.[1]?.toLowerCase() ?? '';
  const mentionSuggestions =
    mentionFilter.length >= 1
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(mentionFilter) ||
            u.email.toLowerCase().includes(mentionFilter),
        ).slice(0, 6)
      : [];

  return (
    <section className="lead-team-chat">
      <h3 className="section-title">{opportunityId ? 'Opportunity notes' : 'Team chat'}</h3>
      <p className="muted">
        {opportunityId
          ? `Notes and documents for this opportunity on ${leadName} — @mention teammates (they get a push notification + email).`
          : `Internal thread for ${leadName} — @mention teammates (they get a push notification + email).`}
      </p>
      {error ? <p className="error">{error}</p> : null}

      <div className="lead-team-chat-messages">
        {messages.length === 0 ? (
          <p className="muted">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <article key={m.id} className="lead-team-chat-msg">
              <header>
                <strong>{m.user.name}</strong>
                <span className="muted">{new Date(m.createdAt).toLocaleString()}</span>
              </header>
              <p>{m.body}</p>
              {m.attachments.length > 0 ? (
                <ul className="lead-team-chat-files">
                  {m.attachments.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => void downloadAttachment(leadId, a.id, a.fileName)}
                      >
                        {a.fileName}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        )}
      </div>

      {attachments.length > 0 ? (
        <div className="lead-team-chat-attachments">
          <h4>{opportunityId ? 'Documents on this opportunity' : 'Files on lead'}</h4>
          <ul>
            {attachments.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => void downloadAttachment(leadId, a.id, a.fileName)}
                >
                  {a.fileName}
                </button>{' '}
                {a.documentType && a.documentType !== 'GENERAL' ? (
                  <span className={`badge badge-${a.documentType === 'LPO' ? 'success' : 'info'}`}>
                    {DOC_TYPE_LABELS[a.documentType] ?? a.documentType}
                    {a.amount != null ? ` · ${Number(a.amount).toLocaleString()}` : ''}
                  </span>
                ) : null}{' '}
                <span className="muted">
                  ({Math.round(a.sizeBytes / 1024)} KB · {a.user.name})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form className="lead-team-chat-compose" onSubmit={(e) => void sendMessage(e)}>
        <textarea
          rows={3}
          value={body}
          placeholder="Message the team… use @ to mention"
          onChange={(e) => setBody(e.target.value)}
        />
        {mentionSuggestions.length > 0 ? (
          <ul className="mention-suggestions" role="listbox">
            {mentionSuggestions.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => insertMention(u)}>
                  {u.name} <span className="muted">{u.email}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="toolbar">
          <button type="submit" className="btn-primary btn-sm" disabled={sending || !body.trim()}>
            {sending ? 'Sending…' : 'Post'}
          </button>
          {showDocumentTypeTag ? (
            <>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                disabled={uploading}
                aria-label="Document type"
              >
                {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {amountEligible ? (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Document total"
                  value={docAmount}
                  onChange={(e) => setDocAmount(e.target.value)}
                  disabled={uploading}
                  aria-label="Document total"
                  style={{ width: 120 }}
                />
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Attach file'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            hidden
            onChange={(e) => void onFileChange(e.target.files?.[0])}
          />
        </div>
      </form>
    </section>
  );
}

async function downloadAttachment(leadId: string, attachmentId: string, fileName: string) {
  const token = getStoredToken();
  const res = await fetch(
    `${getApiBaseUrl()}/leads/${leadId}/attachments/${attachmentId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
