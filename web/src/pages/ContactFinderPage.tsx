import { useRef, useState, type ChangeEvent } from 'react';
import { ChevronDown, ChevronUp, Download, RefreshCw, Search, Upload, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { api } from '../lib/api';
import type { ClassifiedContact } from '../lib/lead-engine-types';

interface CompanyResult {
  company: string;
  contacts: ClassifiedContact[];
  providers: string[];
  totalFound: number;
  fromCache: boolean;
  cachedAt?: string;
}

interface FinderResponse {
  results: CompanyResult[];
  summary: {
    totalCompanies: number;
    totalContacts: number;
    coverage: number;
    fromCache: number;
    apiCalls: number;
  };
}

const PROVIDER_COLORS: Record<string, string> = {
  apollo: '#1A56DB',
  hunter: '#D97706',
  prospeo: '#059669',
  tomba: '#7C3AED',
  firecrawl: '#DC2626',
};

function ProviderBadge({ name }: { name: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: `${PROVIDER_COLORS[name] ?? '#64748b'}22`,
        color: PROVIDER_COLORS[name] ?? '#64748b',
        border: `1px solid ${PROVIDER_COLORS[name] ?? '#64748b'}44`,
        textTransform: 'capitalize',
      }}
    >
      {name}
    </span>
  );
}

function CacheBadge({ cachedAt }: { cachedAt: string }) {
  const daysAgo = Math.floor((Date.now() - new Date(cachedAt).getTime()) / (1000 * 60 * 60 * 24));
  const label = daysAgo === 0 ? 'Cached today' : daysAgo === 1 ? 'Cached 1 day ago' : `Cached ${daysAgo} days ago`;
  return (
    <span
      title="Results served from saved cache — no API credits used"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 7px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: '#d1fae522',
        color: '#059669',
        border: '1px solid #059669aa',
      }}
    >
      ✓ {label}
    </span>
  );
}

function ContactCard({ contact }: { contact: ClassifiedContact }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            {contact.name ?? '—'}
          </div>
          {contact.title && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{contact.title}</div>
          )}
        </div>
        <ProviderBadge name={contact.source} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none' }}
          >
            ✉ {contact.email}
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            ☎ {contact.phone}
          </a>
        )}
        {contact.linkedinUrl && (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.8rem', color: '#0A66C2', textDecoration: 'none' }}
          >
            in LinkedIn
          </a>
        )}
      </div>
    </div>
  );
}

function CompanyAccordion({
  result,
  onRefresh,
  refreshing,
}: {
  result: CompanyResult;
  onRefresh: (company: string) => void;
  refreshing: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        borderRadius: 10,
        border: '1px solid var(--border-strong)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--surface-raised)',
          border: 'none',
          cursor: 'pointer',
          gap: 12,
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', flexShrink: 0 }}>
            {result.company}
          </span>
          <span
            style={{
              padding: '1px 8px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
              background: result.totalFound > 0 ? '#1A56DB22' : '#94a3b822',
              color: result.totalFound > 0 ? '#1A56DB' : '#94a3b8',
            }}
          >
            {result.totalFound} contact{result.totalFound !== 1 ? 's' : ''}
          </span>
          {result.fromCache && result.cachedAt && <CacheBadge cachedAt={result.cachedAt} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {result.providers.map((p) => (
            <ProviderBadge key={p} name={p} />
          ))}
          {result.fromCache && (
            <button
              type="button"
              title="Force re-query from providers"
              onClick={(e) => { e.stopPropagation(); onRefresh(result.company); }}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                background: 'transparent',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 600,
                cursor: refreshing ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={11} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
              Refresh
            </button>
          )}
          {open ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
        </div>
      </button>

      {open && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {result.contacts.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '8px 0' }}>
              No contacts found. Try registering with more providers or check the company website.
            </div>
          ) : (
            result.contacts.map((c, i) => <ContactCard key={i} contact={c} />)
          )}
        </div>
      )}
    </div>
  );
}

function parseCompanyNames(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildCsv(results: CompanyResult[]): string {
  const rows: string[][] = [['Company', 'Name', 'Title', 'Email', 'Phone', 'LinkedIn', 'Source', 'From Cache']];
  for (const r of results) {
    if (r.contacts.length === 0) {
      rows.push([r.company, '', '', '', '', '', '', r.fromCache ? 'Yes' : 'No']);
    } else {
      for (const c of r.contacts) {
        rows.push([
          r.company,
          c.name ?? '',
          c.title ?? '',
          c.email ?? '',
          c.phone ?? '',
          c.linkedinUrl ?? '',
          c.source,
          r.fromCache ? 'Yes' : 'No',
        ]);
      }
    }
  }
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}

function downloadCsv(results: CompanyResult[]) {
  const csv = buildCsv(results);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ContactFinderPage() {
  const [companiesText, setCompaniesText] = useState('');
  const [position, setPosition] = useState('');
  const [threshold, setThreshold] = useState(3);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<FinderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshingCompany, setRefreshingCompany] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = (evt.target?.result as string) ?? '';
      setCompaniesText((prev) => (prev.trim() ? prev + '\n' + text.trim() : text.trim()));
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleSubmit(forceRefresh = false) {
    const names = parseCompanyNames(companiesText);
    if (names.length === 0) {
      setError('Enter at least one company name.');
      return;
    }
    if (names.length > 50) {
      setError('Maximum 50 companies per search.');
      return;
    }

    setLoading(true);
    setError(null);
    if (!forceRefresh) setResponse(null);

    try {
      const data = await api<FinderResponse>('/contacts/finder', {
        method: 'POST',
        body: {
          companies: names,
          position: position.trim() || undefined,
          threshold,
          forceRefresh,
        },
      });
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshCompany(companyName: string) {
    setRefreshingCompany(companyName);
    try {
      const data = await api<FinderResponse>('/contacts/finder', {
        method: 'POST',
        body: {
          companies: [companyName],
          position: position.trim() || undefined,
          threshold,
          forceRefresh: true,
        },
      });
      // Merge the refreshed result back into the existing response
      setResponse((prev) => {
        if (!prev) return data;
        return {
          ...prev,
          results: prev.results.map((r) =>
            r.company === companyName ? (data.results[0] ?? r) : r,
          ),
          summary: {
            ...prev.summary,
            totalContacts: prev.results
              .map((r) => (r.company === companyName ? (data.results[0]?.totalFound ?? r.totalFound) : r.totalFound))
              .reduce((a, b) => a + b, 0),
          },
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshingCompany(null);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader
        title="Contact Finder"
        subtitle="Find decision-maker contacts by company name using a multi-provider waterfall search."
      />

      {/* Input panel */}
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Companies input */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Company names
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'transparent',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Upload size={13} /> Upload .txt
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <textarea
              value={companiesText}
              onChange={(e) => setCompaniesText(e.target.value)}
              placeholder="Enter company names — one per line, or comma/semicolon separated&#10;e.g. Securex Kenya&#10;KCB Bank&#10;Safaricom"
              rows={6}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                resize: 'vertical',
                fontFamily: 'var(--font-mono)',
                boxSizing: 'border-box',
              }}
            />
            {companiesText && (
              <button
                type="button"
                onClick={() => setCompaniesText('')}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'var(--surface-raised)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  padding: 2,
                  color: 'var(--text-secondary)',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {companiesText && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {parseCompanyNames(companiesText).length} companies
            </div>
          )}
        </div>

        {/* Filters row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Position filter <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. IT Manager, Finance Director, CEO"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Stop at
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              >
                {[1, 2, 3, 5, 8, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>{n} contacts</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={loading || !companiesText.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 24px',
            background: loading || !companiesText.trim() ? '#94a3b8' : '#1A56DB',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: loading || !companiesText.trim() ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-start',
            transition: 'background 0.15s',
          }}
        >
          <Search size={16} />
          {loading ? 'Searching…' : 'Find Contacts'}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>Searching across providers…</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            Apollo → Hunter → Prospeo → Tomba → Firecrawl
          </div>
        </div>
      )}

      {/* Results */}
      {response && !loading && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>{response.summary.totalContacts}</strong> contacts found
                across <strong style={{ color: 'var(--text-primary)' }}>{response.summary.coverage}</strong> of {response.summary.totalCompanies} companies
              </div>
              {response.summary.fromCache > 0 && (
                <div style={{ fontSize: '0.78rem', color: '#059669' }}>
                  ✓ {response.summary.fromCache} from cache (no API credits used) · {response.summary.apiCalls} live API call{response.summary.apiCalls !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            {response.summary.totalContacts > 0 && (
              <button
                type="button"
                onClick={() => downloadCsv(response.results)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  background: 'transparent',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} /> Export CSV
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {response.results.map((r) => (
              <CompanyAccordion
                key={r.company}
                result={r}
                onRefresh={handleRefreshCompany}
                refreshing={refreshingCompany === r.company}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
