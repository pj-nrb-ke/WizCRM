import { useEffect, useRef, useState } from 'react';
import { api, downloadAuthenticated, openAuthenticatedBlobUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isManager } from '../lib/roles';
import { PageHeader } from '../components/PageHeader';

/** Types the browser can render natively in an <iframe>/<img> — anything else falls back to download. */
function isInlineViewable(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [viewer, setViewer] = useState<{ doc: ProductDocument; url: string } | null>(null);
  const [viewerLoadingId, setViewerLoadingId] = useState<string | null>(null);

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
    setSelectedIds((prev) => {
      const ids = new Set(documents.map((d) => d.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [documents]);

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

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === documents.length ? new Set() : new Set(documents.map((d) => d.id)),
    );
  }

  async function onBulkDelete() {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!window.confirm(`Remove ${count} document${count === 1 ? '' : 's'} from the library? Reps will no longer see them.`)) {
      return;
    }
    setBulkDeleting(true);
    setError('');
    setMessage('');
    try {
      const results = await Promise.allSettled(
        [...selectedIds].map((id) => api(`/documents/${id}`, { method: 'DELETE' })),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      setSelectedIds(new Set());
      await load();
      if (failed > 0) {
        setError(`${failed} of ${count} document${count === 1 ? '' : 's'} could not be removed.`);
      } else {
        setMessage(`Removed ${count} document${count === 1 ? '' : 's'}.`);
      }
    } finally {
      setBulkDeleting(false);
    }
  }

  function closeViewer() {
    if (viewer) URL.revokeObjectURL(viewer.url);
    setViewer(null);
  }

  async function onView(doc: ProductDocument) {
    setError('');
    if (!isInlineViewable(doc.mimeType)) {
      try {
        await downloadAuthenticated(`/documents/${doc.id}/file`, doc.fileName);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not open the file');
      }
      return;
    }
    setViewerLoadingId(doc.id);
    try {
      const url = await openAuthenticatedBlobUrl(`/documents/${doc.id}/file`);
      setViewer({ doc, url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the file');
    } finally {
      setViewerLoadingId(null);
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

        {canManage && selectedIds.size > 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '8px 12px',
              marginBottom: 12,
              borderRadius: 8,
              background: 'var(--accent-bg, rgba(37,99,235,0.08))',
            }}
          >
            <span style={{ fontSize: 13 }}>{selectedIds.size} selected</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-secondary" onClick={() => setSelectedIds(new Set())}>
                Clear
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={bulkDeleting}
                onClick={() => void onBulkDelete()}
              >
                {bulkDeleting ? 'Removing…' : `Remove ${selectedIds.size}`}
              </button>
            </div>
          </div>
        ) : null}

        {!canManage && error ? <p className="error">{error}</p> : null}
        {canManage && error ? <p className="error">{error}</p> : null}
        {canManage && message ? <p className="success">{message}</p> : null}

        {loading ? (
          <p className="muted">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="muted">No documents yet. Upload your first catalog above.</p>
        ) : (
          <div>
            {canManage ? (
              <label
                className="muted"
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0 8px' }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.size === documents.length}
                  onChange={toggleSelectAll}
                />
                Select all
              </label>
            ) : null}
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
                {canManage ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(doc.id)}
                    onChange={() => toggleSelected(doc.id)}
                    style={{ flexShrink: 0 }}
                  />
                ) : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button
                    type="button"
                    className="link-btn"
                    disabled={viewerLoadingId === doc.id}
                    onClick={() => void onView(doc)}
                  >
                    {doc.title}
                  </button>
                  {viewerLoadingId === doc.id ? (
                    <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                      Opening…
                    </span>
                  ) : null}
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {(doc.category ?? 'Uncategorised')} · {formatSize(doc.sizeBytes)}
                    {doc.version > 1 ? ` · v${doc.version}` : ''}
                    {doc.uploadedBy?.name ? ` · ${doc.uploadedBy.name}` : ''}
                    {doc.isActive ? '' : ' · inactive'}
                    {!isInlineViewable(doc.mimeType) ? ' · downloads to view' : ''}
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

      {viewer ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeViewer}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card-bg, #fff)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 960,
              height: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: rowBorder,
                gap: 12,
              }}
            >
              <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {viewer.doc.title}
              </strong>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void downloadAuthenticated(`/documents/${viewer.doc.id}/file`, viewer.doc.fileName)}
                >
                  Download
                </button>
                <button type="button" className="btn-secondary" onClick={closeViewer}>
                  Close
                </button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {viewer.doc.mimeType.startsWith('image/') ? (
                <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={viewer.url} alt={viewer.doc.title} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                </div>
              ) : (
                <iframe src={viewer.url} title={viewer.doc.title} style={{ width: '100%', height: '100%', border: 'none' }} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
