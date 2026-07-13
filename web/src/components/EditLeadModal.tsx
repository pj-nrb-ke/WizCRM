import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CrmConfig } from './CloseLeadModal';
import { ContactListField } from './ContactListField';

export type EditableLead = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  extraPhones?: unknown;
  extraEmails?: unknown;
  address?: string | null;
  source?: string | null;
};

type Props = {
  open: boolean;
  lead: EditableLead | null;
  config: CrmConfig | null;
  onClose: () => void;
  onSaved: (lead: unknown) => void;
};

export function EditLeadModal({ open, lead, config, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !lead) return;
    setName(lead.name ?? '');
    setCompany(lead.company ?? '');
    setEmail(lead.email ?? '');
    setPhone(lead.phone ?? '');
    setExtraPhones(Array.isArray(lead.extraPhones) ? (lead.extraPhones as string[]) : []);
    setExtraEmails(Array.isArray(lead.extraEmails) ? (lead.extraEmails as string[]) : []);
    setAddress(lead.address ?? '');
    setSource(lead.source ?? '');
    setError('');
  }, [open, lead]);

  if (!open || !lead) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const cleanExtraPhones = extraPhones.map((p) => p.trim()).filter((p) => p.length >= 5);
    const cleanExtraEmails = extraEmails.map((em) => em.trim()).filter((em) => em.includes('@'));
    if (!email.trim() && !phone.trim() && cleanExtraPhones.length === 0 && cleanExtraEmails.length === 0) {
      setError('At least one phone or email is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api<{ lead: unknown }>(`/leads/${lead!.id}`, {
        method: 'PATCH',
        body: {
          name: name.trim(),
          company: company.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          extraPhones: cleanExtraPhones,
          extraEmails: cleanExtraEmails,
          address: address.trim() || null,
          source: source.trim() || null,
        },
      });
      onSaved(res.lead);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Edit lead</h2>
        <p className="muted">Update client details — only name and one contact method are required.</p>

        <form onSubmit={(e) => void submit(e)}>
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
          <ContactListField
            label="Phone"
            type="tel"
            values={extraPhones}
            onChange={setExtraPhones}
            placeholder={() => 'e.g. reception line'}
          />
          <ContactListField
            label="Email"
            type="email"
            values={extraEmails}
            onChange={setExtraEmails}
          />
          <label>
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
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
          {error ? <p className="error">{error}</p> : null}
          <div className="form-actions calendar-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
