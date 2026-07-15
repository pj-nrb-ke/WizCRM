import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// ─── Provider registry (static metadata) ────────────────────────────────────

type Category = 'Discovery' | 'Enrichment' | 'Contacts';

interface ProviderMeta {
  id: string;
  name: string;
  logoInitials: string;
  logoColor: string;
  category: Category;
  description: string;
  costHint: string;
  envVar: string;
  implemented: boolean;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'apify',
    name: 'Apify — Google Maps',
    logoInitials: 'AP',
    logoColor: '#00B064',
    category: 'Discovery',
    description: 'Crawls Google Maps to find companies matching your keywords and locations. Primary discovery source for Kenya-based searches.',
    costHint: '~$0.005 per company found',
    envVar: 'apifyToken',
    implemented: true,
  },
  {
    id: 'tavily',
    name: 'Tavily AI Search',
    logoInitials: 'TV',
    logoColor: '#6366F1',
    category: 'Discovery',
    description: 'AI-powered web search that surfaces buyer intent signals — tender notices, hiring posts, and discussions about ERP pain points.',
    costHint: 'Free up to 1,000 searches/month',
    envVar: 'tavilyApiKey',
    implemented: true,
  },
  {
    id: 'opencorporates',
    name: 'OpenCorporates',
    logoInitials: 'OC',
    logoColor: '#0EA5E9',
    category: 'Discovery',
    description: 'Newly incorporated companies sourced from Kenya company registries. Good for early-stage pipeline before competitors find them.',
    costHint: 'Free tier available',
    envVar: 'openCorporatesApiKey',
    implemented: true,
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    logoInitials: 'FC',
    logoColor: '#F97316',
    category: 'Enrichment',
    description: 'Scrapes company websites using AI extraction to detect sector, employee count, ERP/accounting software in use, and services offered.',
    costHint: 'Free up to 500 pages/month',
    envVar: 'firecrawlApiKey',
    implemented: true,
  },
  {
    id: 'apollo',
    name: 'Apollo.io',
    logoInitials: 'AO',
    logoColor: '#7C3AED',
    category: 'Contacts',
    description: 'Finds decision-maker contacts (CEO, CFO, Finance Director) at target companies. Capped at 3 credits per company.',
    costHint: '1 credit per contact retrieved',
    envVar: 'apolloApiKey',
    implemented: true,
  },
  {
    id: 'hunter',
    name: 'Hunter.io',
    logoInitials: 'HT',
    logoColor: '#F59E0B',
    category: 'Contacts',
    description: 'Email finder used as fallback when Apollo returns no results. Verifies email deliverability before storing.',
    costHint: 'Free up to 25 searches/month',
    envVar: 'hunterApiKey',
    implemented: true,
  },
];

const CATEGORIES: { key: Category; label: string; description: string; color: string }[] = [
  {
    key: 'Discovery',
    label: 'Discovery',
    description: 'Finds companies that match your ICP criteria',
    color: '#1A56DB',
  },
  {
    key: 'Enrichment',
    label: 'Enrichment',
    description: 'Adds firmographic data and ERP signals to found companies',
    color: '#D97706',
  },
  {
    key: 'Contacts',
    label: 'Contacts',
    description: 'Locates decision-maker contacts at enriched companies',
    color: '#059669',
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProviderState {
  enabled: boolean;
  configured: boolean;
}

interface SettingsPayload {
  providers: Record<string, ProviderState>;
  globalLimit: number;
  apiKeys: Record<string, string>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeadEngineSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Record<string, ProviderState>>({});
  const [globalLimit, setGlobalLimit] = useState(20);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    api<SettingsPayload>('/admin/settings/lead-engine')
      .then((data) => {
        setProviders(data.providers);
        setGlobalLimit(data.globalLimit);
        setApiKeys(data.apiKeys ?? {});
      })
      .catch(() => setError('Failed to load data source settings.'))
      .finally(() => setLoading(false));
  }, []);

  function toggleProvider(id: string) {
    setProviders((prev) => ({
      ...prev,
      [id]: { ...prev[id], enabled: !prev[id].enabled },
    }));
    setSaved(false);
  }

  function setKey(envVar: string, value: string) {
    setApiKeys((prev) => ({ ...prev, [envVar]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const data = await api<SettingsPayload>('/admin/settings/lead-engine', {
        method: 'PUT',
        body: { providers, globalLimit, apiKeys },
      });
      setProviders(data.providers);
      setApiKeys(data.apiKeys ?? {});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const providersByCategory = (cat: Category) =>
    PROVIDERS.filter((p) => p.category === cat);

  const enabledCount = Object.values(providers).filter((p) => p.enabled).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading data source settings…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
            Data Sources
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
            Control which external APIs are used during lead discovery and enrichment runs.
            Disabling a source skips that stage — it does not affect previously found leads.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {enabledCount} of {PROVIDERS.length} sources active
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 20px',
              background: saving ? '#94a3b8' : '#1A56DB',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      {/* Global limit */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: '16px 20px', marginBottom: 28, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
            Max companies per ICP run
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Caps how many companies are processed in a single "Run ICP" click. Lower = cheaper.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <input
            type="number"
            min={1}
            max={100}
            value={globalLimit}
            onChange={(e) => { setGlobalLimit(Number(e.target.value)); setSaved(false); }}
            style={{
              width: 70,
              padding: '6px 10px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              color: '#0f172a',
              textAlign: 'center',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 13, color: '#64748b' }}>companies</span>
        </div>
      </div>

      {/* Category sections */}
      {CATEGORIES.map((cat) => (
        <div key={cat.key} style={{ marginBottom: 28 }}>
          {/* Category header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 10px',
                background: `${cat.color}18`,
                color: cat.color,
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {cat.label}
            </span>
            <span style={{ fontSize: 13, color: '#64748b' }}>{cat.description}</span>
          </div>

          {/* Provider cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {providersByCategory(cat.key).map((provider) => {
              const state = providers[provider.id] ?? { enabled: false, configured: false };
              const isConfigured = state.configured;
              const isEnabled = state.enabled;

              return (
                <div
                  key={provider.id}
                  style={{
                    background: '#fff',
                    border: `1px solid ${isEnabled ? '#bfdbfe' : '#e2e8f0'}`,
                    borderRadius: 10,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxShadow: isEnabled ? '0 0 0 1px #bfdbfe20' : 'none',
                    opacity: provider.implemented ? 1 : 0.6,
                  }}
                >
                  {/* Provider logo */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: `${provider.logoColor}18`,
                      border: `1px solid ${provider.logoColor}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: 11,
                      color: provider.logoColor,
                      flexShrink: 0,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {provider.logoInitials}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                        {provider.name}
                      </span>
                      {!provider.implemented && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px',
                          background: '#f1f5f9', color: '#94a3b8', borderRadius: 4,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                          Coming soon
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.45, marginBottom: 6 }}>
                      {provider.description}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        💰 {provider.costHint}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={apiKeys[provider.envVar] ?? ''}
                      onChange={(e) => setKey(provider.envVar, e.target.value)}
                      placeholder={`Your organization's own ${provider.name} API key`}
                      autoComplete="off"
                      style={{
                        width: '100%',
                        maxWidth: 380,
                        padding: '6px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        fontSize: 13,
                        fontFamily: 'var(--font-mono)',
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Right side: status + toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {/* Connection status badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 9px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: isConfigured ? '#f0fdf4' : '#f8fafc',
                        color: isConfigured ? '#15803d' : '#94a3b8',
                        border: `1px solid ${isConfigured ? '#bbf7d0' : '#e2e8f0'}`,
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: isConfigured ? '#22c55e' : '#cbd5e1',
                        display: 'inline-block',
                      }} />
                      {isConfigured ? 'Connected' : 'Not configured'}
                    </span>

                    {/* Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      disabled={!isConfigured || !provider.implemented}
                      onClick={() => toggleProvider(provider.id)}
                      title={
                        !provider.implemented
                          ? 'Not yet available'
                          : !isConfigured
                          ? 'Enter your API key above, save, then enable'
                          : isEnabled
                          ? 'Click to disable'
                          : 'Click to enable'
                      }
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        border: 'none',
                        background: isEnabled ? '#1A56DB' : '#e2e8f0',
                        cursor: isConfigured && provider.implemented ? 'pointer' : 'not-allowed',
                        position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                        opacity: isConfigured && provider.implemented ? 1 : 0.5,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: isEnabled ? 22 : 2,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#fff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                          transition: 'left 0.2s',
                        }}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer note */}
      <div style={{
        padding: '12px 16px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        fontSize: 13,
        color: '#64748b',
        lineHeight: 1.5,
      }}>
        <strong style={{ color: '#374151' }}>Each organization uses its own provider accounts.</strong> Enter your
        own API key for a provider, save, then enable it — your key is never shared with any other organization.
        The "Connected" badge confirms a key is saved for your org. Disabling a source reduces cost but
        may reduce lead quality.
      </div>
    </div>
  );
}
