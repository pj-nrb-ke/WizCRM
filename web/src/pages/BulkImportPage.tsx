import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import type { CrmConfig } from '../components/CloseLeadModal';

type ImportRow = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  source?: string;
  tags?: string[];
  priority?: 'HOT' | 'WARM' | 'COLD';
};

type AssignableUser = { id: string; name: string; email: string };

const ACCEPTED_EXT = '.xlsx,.xls,.csv,.json,.txt';

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
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [config, setConfig] = useState<CrmConfig | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
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
  }, []);

  async function onExtract() {
    setError('');
    setResult(null);
    setWarnings([]);
    setTruncated(false);
    setPreview([]);

    let fileName: string;
    let mimeType: string;
    let dataBase64: string;
    try {
      if (file) {
        fileName = file.name;
        mimeType = file.type || 'application/octet-stream';
        dataBase64 = await fileToBase64(file);
      } else if (pastedText.trim()) {
        fileName = 'pasted-text.txt';
        mimeType = 'text/plain';
        dataBase64 = textToBase64(pastedText);
      } else {
        setError('Upload a file or paste some text first.');
        return;
      }
    } catch {
      setError('Could not read the file.');
      return;
    }

    setExtracting(true);
    try {
      const data = await api<{ candidates: ImportRow[]; warnings: string[]; truncated: boolean }>(
        '/leads/import/extract',
        { method: 'POST', body: { fileName, mimeType, dataBase64 } },
      );
      if (data.candidates.length === 0) {
        setError('No usable leads found in this file.');
      }
      setPreview(data.candidates);
      setWarnings(data.warnings ?? []);
      setTruncated(data.truncated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed.');
    } finally {
      setExtracting(false);
    }
  }

  function removeRow(index: number) {
    setPreview((prev) => prev.filter((_, i) => i !== index));
  }

  async function onImport() {
    if (preview.length === 0) {
      setError('Extract leads from a file first.');
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
        subtitle="Upload an Excel, CSV, JSON, or text file — AI reads it, merges multi-sheet data by company, and maps it to leads. Up to 500 leads."
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
            {extracting ? 'Reading file…' : 'Extract leads'}
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
        {truncated ? (
          <p className="muted">The file had more rows than fit in one import — showing the first {preview.length}.</p>
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
                <th>Priority</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.company ?? '—'}</td>
                  <td>{r.email ?? '—'}</td>
                  <td>{r.phone ?? '—'}</td>
                  <td>{r.priority ?? '—'}</td>
                  <td>{r.source ?? '—'}</td>
                  <td>
                    <button type="button" className="btn-link" onClick={() => removeRow(i)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length > 100 ? (
            <p className="muted" style={{ padding: 12 }}>
              Showing first 100 of {preview.length} rows.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
