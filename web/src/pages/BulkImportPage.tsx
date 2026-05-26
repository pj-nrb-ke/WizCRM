import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import type { CrmConfig } from '../components/CloseLeadModal';

type ImportRow = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
};

type AssignableUser = { id: string; name: string; email: string };

function parseCsv(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0]!.toLowerCase();
  const hasHeader = header.includes('name');
  const start = hasHeader ? 1 : 0;
  const cols = hasHeader
    ? lines[0]!.split(',').map((c) => c.trim().toLowerCase())
    : ['name', 'company', 'email', 'phone', 'source'];

  const idx = (key: string) => cols.indexOf(key);

  return lines.slice(start).map((line) => {
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    const pick = (key: string) => {
      const i = idx(key);
      return i >= 0 ? parts[i]?.trim() : undefined;
    };
    return {
      name: pick('name') ?? parts[0] ?? '',
      company: pick('company'),
      email: pick('email'),
      phone: pick('phone'),
      source: pick('source'),
    };
  }).filter((r) => r.name.length > 0);
}

export function BulkImportPage() {
  const [csv, setCsv] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [config, setConfig] = useState<CrmConfig | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<{
    imported: number;
    failed: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ users: AssignableUser[] }>('/teams/assignable-users')
      .then((d) => setUsers(d.users))
      .catch(() => setUsers([]));
    api<CrmConfig>('/leads/crm-config')
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  function onParse() {
    setError('');
    setResult(null);
    try {
      const rows = parseCsv(csv);
      if (rows.length === 0) {
        setError('No rows found. Use columns: name, company, email, phone, source');
        setPreview([]);
        return;
      }
      if (rows.length > 500) {
        setError('Maximum 500 rows per import.');
        setPreview(rows.slice(0, 500));
        return;
      }
      setPreview(rows);
    } catch {
      setError('Could not parse CSV.');
      setPreview([]);
    }
  }

  async function onImport() {
    if (preview.length === 0) {
      setError('Parse CSV first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const d = await api<{
        imported: number;
        failed: number;
        errors: { row: number; message: string }[];
      }>('/leads/import', {
        method: 'POST',
        body: { rows: preview, ownerId: ownerId || undefined },
      });
      setResult({ imported: d.imported, failed: d.failed, errors: d.errors });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="Bulk import leads"
        subtitle="Paste CSV with header row: name, company, email, phone, source. Up to 500 rows."
      />

      <div className="card bulk-import-card">
        <label>
          Default owner (optional)
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Me (current user)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </label>
        {config?.leadSources?.length ? (
          <p className="muted">
            Known sources: {config.leadSources.join(', ')}
          </p>
        ) : null}
        <label>
          CSV data
          <textarea
            rows={12}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={'name,company,email,phone,source\nAcme Co,Acme,a@acme.com,+15551234,Website'}
          />
        </label>
        <div className="toolbar">
          <button type="button" className="btn-secondary" onClick={onParse}>
            Preview rows
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving || preview.length === 0}
            onClick={() => void onImport()}
          >
            {saving ? 'Importing…' : `Import ${preview.length} lead${preview.length === 1 ? '' : 's'}`}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {result ? (
          <p className="success">
            Imported {result.imported}, failed {result.failed}.
            {result.errors.length > 0 ? (
              <ul className="import-errors">
                {result.errors.map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </p>
        ) : null}
      </div>

      {preview.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 50).map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.company ?? '—'}</td>
                  <td>{r.email ?? '—'}</td>
                  <td>{r.phone ?? '—'}</td>
                  <td>{r.source ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length > 50 ? (
            <p className="muted" style={{ padding: 12 }}>
              Showing first 50 of {preview.length} rows.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
