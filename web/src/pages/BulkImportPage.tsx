import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import type { CrmConfig } from '../components/CloseLeadModal';
import type { Campaign } from '../lib/lead-engine-types';

type LeadRow = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  source?: string;
  tags?: string[];
  priority?: 'HOT' | 'WARM' | 'COLD';
};

type ProspectContactRow = {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
};

type ProspectRow = {
  companyName: string;
  industry?: string;
  address?: string;
  website?: string;
  source?: string;
  contacts: ProspectContactRow[];
  duplicate?: { type: 'lead' | 'prospect' | 'batch'; label: string; leadId?: string; prospectId?: string };
};

type AssignableUser = { id: string; name: string; email: string };
type Destination = 'leads' | 'prospects';

const ACCEPTED_EXT = '.xlsx,.xls,.csv,.json,.txt';
const NEW_LIST_VALUE = '__new__';

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function textToBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

export function BulkImportPage() {
  const [destination, setDestination] = useState<Destination>('prospects');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [config, setConfig] = useState<CrmConfig | null>(null);
  const [research, setResearch] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [newListName, setNewListName] = useState('');

  const [leadPreview, setLeadPreview] = useState<LeadRow[]>([]);
  const [prospectPreview, setProspectPreview] = useState<ProspectRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [researchedCount, setResearchedCount] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    failed: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ users: AssignableUser[] }>('/teams/assignable-users')
      .then((d) => setUsers(d.users))
      .catch(() => setUsers([]));
    api<CrmConfig>('/leads/crm-config')
      .then(setConfig)
      .catch(() => setConfig(null));
    api<Campaign[]>('/leadengine/campaigns')
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, []);

  function resetPreview() {
    setError('');
    setResult(null);
    setWarnings([]);
    setTruncated(false);
    setResearchedCount(0);
    setLeadPreview([]);
    setProspectPreview([]);
  }

  async function readSource(): Promise<{ fileName: string; mimeType: string; dataBase64: string } | null> {
    if (file) {
      return { fileName: file.name, mimeType: file.type || 'application/octet-stream', dataBase64: await fileToBase64(file) };
    }
    if (pastedText.trim()) {
      return { fileName: 'pasted-text.txt', mimeType: 'text/plain', dataBase64: textToBase64(pastedText) };
    }
    return null;
  }

  async function onExtract() {
    resetPreview();
    let source;
    try {
      source = await readSource();
    } catch {
      setError('Could not read the file.');
      return;
    }
    if (!source) {
      setError('Upload a file or paste some text first.');
      return;
    }

    setExtracting(true);
    try {
      if (destination === 'leads') {
        const data = await api<{ candidates: LeadRow[]; warnings: string[]; truncated: boolean }>(
          '/leads/import/extract',
          { method: 'POST', body: source },
        );
        if (data.candidates.length === 0) setError('No usable leads found in this file.');
        setLeadPreview(data.candidates);
        setWarnings(data.warnings ?? []);
        setTruncated(data.truncated);
      } else {
        const data = await api<{
          candidates: ProspectRow[];
          warnings: string[];
          truncated: boolean;
          researchedCount: number;
        }>('/leadengine/prospects/import/extract', { method: 'POST', body: { ...source, research } });
        if (data.candidates.length === 0) setError('No usable companies found in this file.');
        setProspectPreview(data.candidates);
        setWarnings(data.warnings ?? []);
        setTruncated(data.truncated);
        setResearchedCount(data.researchedCount ?? 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed.');
    } finally {
      setExtracting(false);
    }
  }

  function removeLeadRow(index: number) {
    setLeadPreview((prev) => prev.filter((_, i) => i !== index));
  }

  function removeProspectRow(index: number) {
    setProspectPreview((prev) => prev.filter((_, i) => i !== index));
  }

  async function onImport() {
    setSaving(true);
    setError('');
    try {
      if (destination === 'leads') {
        if (leadPreview.length === 0) {
          setError('Extract leads from a file first.');
          return;
        }
        const d = await api<{ imported: number; failed: number; errors: { row: number; message: string }[] }>(
          '/leads/import',
          { method: 'POST', body: { rows: leadPreview, ownerId: ownerId || undefined } },
        );
        setResult({ imported: d.imported, failed: d.failed, errors: d.errors });
      } else {
        if (prospectPreview.length === 0) {
          setError('Extract companies from a file first.');
          return;
        }
        let targetCampaignId = campaignId;
        if (targetCampaignId === NEW_LIST_VALUE) {
          if (!newListName.trim()) {
            setError('Name your new list first.');
            return;
          }
          const created = await api<Campaign>('/leadengine/campaigns', {
            method: 'POST',
            body: { name: newListName.trim() },
          });
          targetCampaignId = created.id;
          setCampaigns((prev) => [created, ...prev]);
          setCampaignId(created.id);
        }
        if (!targetCampaignId) {
          setError('Pick or create a list for these prospects first.');
          return;
        }
        const d = await api<{ imported: number; skipped: number; errors: { row: number; message: string }[] }>(
          `/leadengine/campaigns/${targetCampaignId}/prospects/import`,
          { method: 'POST', body: { rows: prospectPreview } },
        );
        setResult({ imported: d.imported, failed: d.skipped, errors: d.errors });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setSaving(false);
    }
  }

  const previewCount = destination === 'leads' ? leadPreview.length : prospectPreview.length;

  return (
    <div className="page-wide">
      <PageHeader
        title={destination === 'leads' ? 'Bulk import leads' : 'Bulk import prospect list'}
        subtitle={
          destination === 'leads'
            ? 'Upload an Excel, CSV, JSON, or text file — AI reads it, merges multi-sheet data by company, and maps it to leads. Up to 500 leads.'
            : "Upload a cold contact list — AI reads it, merges multi-sheet data by company, and files it as a separate list your team hasn't contacted yet. Promote each one to a real lead once someone makes contact."
        }
      />

      <div className="card bulk-import-card">
        <div className="toolbar" style={{ marginBottom: 4 }}>
          <button
            type="button"
            className={destination === 'prospects' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            onClick={() => {
              setDestination('prospects');
              resetPreview();
            }}
          >
            New / uncontacted (Prospect list)
          </button>
          <button
            type="button"
            className={destination === 'leads' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            onClick={() => {
              setDestination('leads');
              resetPreview();
            }}
          >
            Already ready to work (Leads)
          </button>
        </div>

        {destination === 'leads' ? (
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
        ) : (
          <>
            <label>
              List
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                <option value="">Choose a list…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NEW_LIST_VALUE}>+ New list…</option>
              </select>
            </label>
            {campaignId === NEW_LIST_VALUE ? (
              <label>
                New list name
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. WETO — July 2026"
                />
              </label>
            ) : null}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
              <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} style={{ width: 'auto' }} />
              <span>
                Research missing contacts with AI (uses your connected Apollo/Hunter/Tavily — capped at 50 companies per
                import)
              </span>
            </label>
          </>
        )}

        {config?.leadSources?.length ? (
          <p className="muted">Known sources: {config.leadSources.join(', ')}</p>
        ) : null}

        <label>
          File (Excel, CSV, JSON, or text)
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXT}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPastedText('');
            }}
          />
        </label>
        {file ? (
          <p className="muted">
            {file.name} ({Math.round(file.size / 1024)} KB){' '}
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              Remove
            </button>
          </p>
        ) : (
          <label>
            Or paste raw text (CSV, JSON, or freeform notes)
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={'Paste a prospect list, CSV data, or notes here…'}
            />
          </label>
        )}

        <div className="toolbar">
          <button
            type="button"
            className="btn-secondary"
            disabled={extracting || (!file && !pastedText.trim())}
            onClick={() => void onExtract()}
          >
            {extracting ? 'Reading file…' : destination === 'leads' ? 'Extract leads' : 'Extract companies'}
          </button>
          <button type="button" className="btn-primary" disabled={saving || previewCount === 0} onClick={() => void onImport()}>
            {saving
              ? 'Importing…'
              : destination === 'leads'
              ? `Import ${previewCount} lead${previewCount === 1 ? '' : 's'}`
              : `Import ${previewCount} compan${previewCount === 1 ? 'y' : 'ies'}`}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {truncated ? (
          <p className="muted">The file had more rows than fit in one import — showing the first {previewCount}.</p>
        ) : null}
        {researchedCount > 0 ? (
          <p className="muted">Researched {researchedCount} compan{researchedCount === 1 ? 'y' : 'ies'} with AI.</p>
        ) : null}
        {warnings.length > 0 ? (
          <ul className="import-errors">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
        {result ? (
          <p className="success">
            Imported {result.imported}, skipped/failed {result.failed}.
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

      {destination === 'leads' && leadPreview.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Priority</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leadPreview.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.company ?? '—'}</td>
                  <td>{r.email ?? '—'}</td>
                  <td>{r.phone ?? '—'}</td>
                  <td>{r.priority ?? '—'}</td>
                  <td>{r.source ?? '—'}</td>
                  <td>
                    <button type="button" className="btn-link" onClick={() => removeLeadRow(i)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leadPreview.length > 100 ? (
            <p className="muted" style={{ padding: 12 }}>
              Showing first 100 of {leadPreview.length} rows.
            </p>
          ) : null}
        </div>
      ) : null}

      {destination === 'prospects' && prospectPreview.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Contacts</th>
                <th>Industry</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prospectPreview.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td>
                    <strong>{r.companyName}</strong>
                    {r.address ? <div className="muted">{r.address}</div> : null}
                  </td>
                  <td>
                    {r.contacts.length === 0 ? (
                      <span className="muted">No contact found</span>
                    ) : (
                      r.contacts.map((c, ci) => (
                        <div key={ci} style={{ marginBottom: r.contacts.length > 1 ? 4 : 0 }}>
                          {c.name ?? '—'}
                          {c.title ? ` · ${c.title}` : ''}
                          <div className="muted">
                            {c.email ?? '—'}
                            {c.phone ? ` · ${c.phone}` : ''}
                          </div>
                        </div>
                      ))
                    )}
                  </td>
                  <td>{r.industry ?? '—'}</td>
                  <td>
                    {r.duplicate ? (
                      <span className="tag-chip-inline" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                        {r.duplicate.label}
                      </span>
                    ) : (
                      <span className="muted">New</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="btn-link" onClick={() => removeProspectRow(i)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {prospectPreview.length > 100 ? (
            <p className="muted" style={{ padding: 12 }}>
              Showing first 100 of {prospectPreview.length} rows.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
