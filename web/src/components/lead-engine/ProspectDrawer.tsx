import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Prospect, ScoreBreakdownItem } from '../../lib/lead-engine-types';

type Props = {
  prospectId: string | null;
  onClose: () => void;
  onImported: () => void;
};

export function ProspectDrawer({ prospectId, onClose, onImported }: Props) {
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [suppressing, setSuppressing] = useState(false);

  useEffect(() => {
    if (!prospectId) { setProspect(null); return; }
    setLoading(true);
    setError('');
    setImportError('');
    api<Prospect>(`/leadengine/prospects/${prospectId}`)
      .then(setProspect)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [prospectId]);

  if (!prospectId) return null;

  async function importToPipeline() {
    if (!prospect) return;
    setImporting(true);
    setImportError('');
    try {
      const result = await api<{ leadId: string }>(`/leadengine/prospects/${prospect.id}/import`, { method: 'POST' });
      setProspect((p) => p ? { ...p, status: 'IMPORTED', importedLeadId: result.leadId } : p);
      onImported();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  async function suppress() {
    if (!prospect) return;
    if (!confirm(`Add "${prospect.companyName}" to the suppression list?`)) return;
    setSuppressing(true);
    try {
      await api('/leadengine/suppression', {
        method: 'POST',
        body: { companyName: prospect.companyName, domain: prospect.website ? extractDomain(prospect.website) : undefined, reason: 'Suppressed from prospect drawer' },
      });
      await api(`/leadengine/prospects/${prospect.id}/status`, { method: 'PATCH', body: { status: 'SUPPRESSED' } });
      setProspect((p) => p ? { ...p, status: 'SUPPRESSED' } : p);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to suppress');
    } finally {
      setSuppressing(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="drawer drawer-wide" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btn-secondary drawer-close" onClick={onClose}>
          Close
        </button>

        {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {prospect && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{prospect.companyName}</h2>
                {prospect.tier && <TierBadge tier={prospect.tier} />}
                <StatusChip status={prospect.status} />
              </div>
              {prospect.industry && (
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{prospect.industry}</p>
              )}
            </div>

            {/* Action buttons */}
            {importError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{importError}</div>}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {prospect.status === 'IMPORTED' ? (
                <span className="badge badge-success">✓ Imported to pipeline</span>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => { void importToPipeline(); }}
                  disabled={importing || prospect.status === 'SUPPRESSED'}
                >
                  {importing ? 'Importing…' : '→ Import to Pipeline'}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={suppress}
                disabled={suppressing || prospect.status === 'SUPPRESSED'}
                style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
              >
                {suppressing ? 'Suppressing…' : 'Suppress'}
              </button>
            </div>

            {/* Company info */}
            <h3 className="drawer-section-label">Company</h3>
            <div className="detail-grid">
              {prospect.address && <><dt>Address</dt><dd>{prospect.address}</dd></>}
              {prospect.phone && (
                <><dt>Phone</dt><dd><a href={`tel:${prospect.phone}`} style={{ color: 'var(--primary)' }}>{prospect.phone}</a></dd></>
              )}
              {prospect.website && (
                <><dt>Website</dt>
                <dd>
                  <a href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
                    target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                    {displayDomain(prospect.website)}
                  </a>
                </dd></>
              )}
              {prospect.lat && prospect.lng && (
                <><dt>Map</dt>
                <dd>
                  <a href={`https://maps.google.com/?q=${prospect.lat},${prospect.lng}`}
                    target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                    View on Google Maps ↗
                  </a>
                </dd></>
              )}
              <dt>Source</dt><dd style={{ textTransform: 'capitalize' }}>{prospect.source.replace(/_/g, ' ')}</dd>
            </div>

            {/* Score breakdown */}
            <h3 className="drawer-section-label">Score — {prospect.score} pts</h3>
            {prospect.scoreBreakdown?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {prospect.scoreBreakdown.map((s: ScoreBreakdownItem) => (
                  <div key={s.key} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 8, background: s.detected ? 'var(--primary-soft)' : '#f8fafc',
                    opacity: s.detected ? 1 : 0.5,
                  }}>
                    <span style={{ fontSize: '1rem', width: 18, textAlign: 'center' }}>
                      {s.detected ? '✓' : '○'}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.85rem', color: s.detected ? 'var(--text)' : 'var(--text-muted)' }}>
                      {s.label}
                    </span>
                    <span style={{
                      fontSize: '0.8rem', fontWeight: 700,
                      color: s.detected ? (s.points > 0 ? 'var(--success)' : 'var(--error)') : 'var(--text-muted)',
                    }}>
                      {s.points > 0 ? `+${s.points}` : s.points}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No score breakdown available.</p>
            )}

            {/* Contacts */}
            <h3 className="drawer-section-label">Contacts</h3>
            {prospect.contacts && prospect.contacts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {prospect.contacts.map((c) => (
                  <div key={c.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.fullName ?? 'Unknown'}</div>
                    {c.role && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.role}</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {c.email && (
                        <span style={{ fontSize: '0.8rem' }}>
                          <a href={`mailto:${c.email}`} style={{ color: 'var(--primary)' }}>{c.email}</a>
                          {' '}
                          <EmailStatusBadge status={c.emailStatus} />
                        </span>
                      )}
                      {c.phone && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.phone}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No contacts yet. Run enrichment to find decision-makers.
              </p>
            )}

            {/* Enrichment */}
            {prospect.enrichment && (
              <>
                <h3 className="drawer-section-label">Enrichment</h3>
                <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8 }}>
                  {prospect.enrichment.websiteSummary && (
                    <p style={{ margin: '0 0 10px', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {prospect.enrichment.websiteSummary}
                    </p>
                  )}
                  <div className="detail-grid">
                    {prospect.enrichment.employeeEstimate && (
                      <><dt>Staff est.</dt><dd>~{prospect.enrichment.employeeEstimate}</dd></>
                    )}
                    <dt>ERP detected</dt>
                    <dd style={{ color: prospect.enrichment.existingErpDetected ? 'var(--warn)' : 'var(--success)' }}>
                      {prospect.enrichment.existingErpDetected ? 'Yes — may have existing ERP' : 'No'}
                    </dd>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );

}

// ── Small helpers ──────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const cls = tier === 'A' ? 'badge badge-success' : tier === 'B' ? 'badge badge-warn' : 'badge badge-info';
  return <span className={cls}>Tier {tier}</span>;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    NEW: 'badge badge-neutral', QUALIFIED: 'badge badge-info', ENRICHED: 'badge badge-info',
    EMAILED: 'badge badge-warn', REPLIED: 'badge badge-success', IMPORTED: 'badge badge-success',
    REJECTED: 'badge badge-neutral', SUPPRESSED: 'badge badge-neutral',
  };
  return <span className={map[status] ?? 'badge badge-neutral'}>{status}</span>;
}

function EmailStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    valid: 'badge badge-success', guessed: 'badge badge-warn',
    invalid: 'badge badge-neutral', unverified: 'badge badge-neutral', catch_all: 'badge badge-warn',
  };
  return <span className={map[status] ?? 'badge badge-neutral'} style={{ fontSize: '0.7rem' }}>{status}</span>;
}

function extractDomain(url: string): string {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function displayDomain(url: string): string {
  return extractDomain(url);
}
