import { useEffect, useRef, useState } from 'react';
import { api, downloadAuthenticated } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isManager } from '../lib/roles';
import { PageHeader } from '../components/PageHeader';

type ProductDocument = {
  id: string;
  title: string;
  category: string | null;
  productTags: string[];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { id: string; name: string } | null;
};

const CATEGORY_OPTIONS = ['Catalog', 'Brochure', 'Price list', 'Spec sheet'];
const MAX_BYTES = 25 * 1024 * 1024;

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProductDocumentsPage() {
  const { user } = useAuth();
  const canManage = isManager(user?.role);

  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setError('');
    try {
      const res = await api<{ documents: ProductDocument[] }>(
        `/documents${includeInactive ? '?includeInactive=true' : ''}`,
      );
      setDocuments(res.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File is larger than the 25 MB limit.');
      return;
    }
    setUploading(true);
    try {
      const dataBase64 = await fileToBase64(file);
      await api('/documents', {
        method: 'POST',
        body: {
          title: title.trim(),
          category: category.trim() || undefined,
          productTags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64,
        },
      });
      setMessage(`Uploaded "${title.trim()}".`);
      setTitle('');
      setCategory('');
      setTags('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function onToggleActive(doc: ProductDocument) {
    setBusyId(doc.id);
    setError('');
    setMessage('');
    try {
      await api(`/documents/${doc.id}`, { method: 'PATCH', body: { isActive: !doc.isActive } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(doc: ProductDocument) {
    if (!window.confirm(`Remove "${doc.title}" from the library? Reps will no longer see it.`)) return;
    setBusyId(doc.id);
    setError('');
    setMessage('');
    try {
      await api(`/documents/${doc.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onView(doc: ProductDocument) {
    setError('');
    try {
      await downloadAuthenticated(`/documents/${doc.id}/file`, doc.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the file');
    }
  }

  const rowBorder = '1px solid rgba(148,163,184,0.22)';

  return (
    <div className="page-wide">
      <PageHeader
        title="Product documents"
        subtitle="Catalogs, brochures, and price lists your reps carry in the mobile app (R7)."
      />

      {canManage ? (
        <form
          className="card"
          onSubmit={onUpload}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <h3 style={{ margin: 0 }}>Upload a document</h3>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 2026 Pump Catalog"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Category
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Catalog / Brochure / Price list…"
              list="doc-categories"
            />
            <datalist id="doc-categories">
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Product tags (comma-separated)
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="pumps, irrigation" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            File (PDF, Office, or image — max 25 MB)
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="success">{message}</p> : null}
          <button type="submit" className="btn-primary" disabled={uploading} style={{ alignSelf: 'flex-start' }}>
            {uploading ? 'Uploading…' : 'Upload document'}
          </button>
        </form>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h3 style={{ margin: 0 }}>Library ({documents.length})</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} className="muted">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>

        {!canManage && error ? <p className="error">{error}</p> : null}

        {loading ? (
          <p className="muted">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="muted">No documents yet. Upload your first catalog above.</p>
        ) : (
          <div>
            {documents.map((doc, i) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderTop: i === 0 ? 'none' : rowBorder,
                  opacity: doc.isActive ? 1 : 0.55,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button type="button" className="link-btn" onClick={() => onView(doc)}>
                    {doc.title}
                  </button>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {(doc.category ?? 'Uncategorised')} · {formatSize(doc.sizeBytes)}
                    {doc.version > 1 ? ` · v${doc.version}` : ''}
                    {doc.uploadedBy?.name ? ` · ${doc.uploadedBy.name}` : ''}
                    {doc.isActive ? '' : ' · inactive'}
                  </div>
                  {doc.productTags.length > 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--accent, #2563eb)', marginTop: 2 }}>
                      {doc.productTags.join(' · ')}
                    </div>
                  ) : null}
                </div>
                {canManage ? (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busyId === doc.id}
                      onClick={() => onToggleActive(doc)}
                    >
                      {doc.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busyId === doc.id}
                      onClick={() => onDelete(doc)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
