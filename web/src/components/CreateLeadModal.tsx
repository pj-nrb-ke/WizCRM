import { FormEvent, useEffect, useState } from 'react';
import { api, getApiBaseUrl, getStoredToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { CrmConfig } from './CloseLeadModal';

type Duplicate = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  stage: string;
};

type Props = {
  open: boolean;
  config: CrmConfig | null;
  onClose: () => void;
  onCreated: (leadId: string) => void;
};

export function CreateLeadModal({ open, config, onClose, onCreated }: Props) {
  const { entitlements } = useAuth();
  const proCapture = entitlements?.features.leadInsights ?? false;
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');
  const [priority, setPriority] = useState('');
  const [captureNotes, setCaptureNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [pendingForce, setPendingForce] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setCompany('');
      setEmail('');
      setPhone('');
      setSource('');
      setPriority('');
      setCaptureNotes('');
      setError('');
      setDuplicates([]);
      setPendingForce(false);
    }
  }, [open]);

  if (!open) return null;

  async function checkDuplicates(): Promise<Duplicate[]> {
    const params = new URLSearchParams();
    if (email.trim()) params.set('email', email.trim());
    if (phone.trim()) params.set('phone', phone.trim());
    if (!params.toString()) return [];
    const d = await api<{ duplicates: Duplicate[] }>(`/leads/check-duplicates?${params}`);
    return d.duplicates;
  }

  async function submit(e: FormEvent, force = false) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError('At least one of email or phone is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (!force && !pendingForce) {
        const dupes = await checkDuplicates();
        if (dupes.length > 0) {
          setDuplicates(dupes);
          setPendingForce(true);
          setSaving(false);
          return;
        }
      }
      const token = getStoredToken();
      const res = await fetch(`${getApiBaseUrl()}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          source: source.trim() || undefined,
          priority: priority || undefined,
          force: force || pendingForce,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ?? res.statusText ?? 'Could not create lead',
        );
      }
      const lead = (data as { lead: { id: string } }).lead;
      onCreated(lead.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function suggestCapture() {
    if (!proCapture || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const s = await api<{ source: string | null; priority: string | null; reason: string }>(
        '/ai/leads/suggest-capture',
        {
          method: 'POST',
          body: {
            name: name.trim(),
            company: company.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            notes: captureNotes.trim() || undefined,
          },
        },
      );
      if (s.source) setSource(s.source);
      if (s.priority) setPriority(s.priority);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suggest failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2>New lead</h2>
        <p className="muted">Creates a lead assigned to you. Duplicates are flagged before save.</p>

        {duplicates.length > 0 ? (
          <div className="duplicate-warning">
            <strong>Possible duplicate{duplicates.length > 1 ? 's' : ''}</strong>
            <ul>
              {duplicates.map((d) => (
                <li key={d.id}>
                  {d.name}
                  {d.email ? ` · ${d.email}` : ''}
                  {d.phone ? ` · ${d.phone}` : ''}
                  <span className="muted"> ({d.stage})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form onSubmit={(e) => void submit(e, pendingForce)}>
          <label>
            Name *
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Company
            <input value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            Source
            {config?.leadSources?.length ? (
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">—</option>
                {config.leadSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input value={source} onChange={(e) => setSource(e.target.value)} />
            )}
          </label>
          {proCapture ? (
            <>
              <label>
                Notes for AI suggest
                <input value={captureNotes} onChange={(e) => setCaptureNotes(e.target.value)} />
              </label>
              <label>
                Priority
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="">—</option>
                  <option value="HOT">HOT</option>
                  <option value="WARM">WARM</option>
                  <option value="COLD">COLD</option>
                </select>
              </label>
              <button type="button" className="btn-secondary btn-sm" onClick={() => void suggestCapture()}>
                Suggest source & priority
              </button>
            </>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          <div className="form-actions calendar-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving
                ? 'Saving…'
                : pendingForce
                  ? 'Create anyway'
                  : 'Create lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
