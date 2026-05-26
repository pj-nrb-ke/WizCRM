import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';

type WebhookStatus = {
  enabled: boolean;
  hasSecret: boolean;
  endpoint: string;
};

type EnableResponse = WebhookStatus & { secret: string };

export function IntegrationsPage() {
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'url' | 'key' | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api<WebhookStatus>('/admin/integrations/webhook')
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function enableWebhook() {
    setBusy(true);
    setError('');
    try {
      const res = await api<EnableResponse>('/admin/integrations/webhook/enable', { method: 'POST' });
      setStatus(res);
      setRevealedSecret(res.secret);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enable failed');
    } finally {
      setBusy(false);
    }
  }

  async function disableWebhook() {
    if (!window.confirm('Disable webhook lead capture? Existing keys will stop working.')) return;
    setBusy(true);
    setError('');
    try {
      await api('/admin/integrations/webhook/disable', { method: 'POST' });
      setRevealedSecret(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disable failed');
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, which: 'url' | 'key') {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  const samplePayload = `{
  "name": "Jane Doe",
  "company": "Acme Ltd",
  "email": "jane@acme.example",
  "phone": "+27123456789",
  "source": "Website",
  "ownerEmail": "rep@yourorg.example"
}`;

  return (
    <div className="page-wide">
      <PageHeader
        title="Integrations"
        subtitle="Inbound web lead capture for forms and marketing tools (Product Phase 2)."
      />
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="card">
          <h2>Webhook — create leads</h2>
          <p className="muted">
            POST JSON to the endpoint with header <code>X-WizCRM-Webhook-Key</code> (or{' '}
            <code>?key=</code> query). Leads are created in your organization with duplicate checks on
            email/phone.
          </p>

          <dl className="detail-grid" style={{ marginTop: 16 }}>
            <dt>Status</dt>
            <dd>{status?.enabled ? 'Enabled' : 'Disabled'}</dd>
            <dt>Endpoint</dt>
            <dd style={{ wordBreak: 'break-all' }}>{status?.endpoint ?? '—'}</dd>
          </dl>

          <div className="form-actions" style={{ marginTop: 16 }}>
            {!status?.enabled ? (
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void enableWebhook()}>
                {busy ? 'Enabling…' : 'Enable & generate key'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void enableWebhook()}
                >
                  {busy ? 'Working…' : 'Rotate key'}
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy}
                  onClick={() => void disableWebhook()}
                >
                  Disable webhook
                </button>
              </>
            )}
            {status?.endpoint ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void copyText(status.endpoint, 'url')}
              >
                {copied === 'url' ? 'Copied URL' : 'Copy endpoint URL'}
              </button>
            ) : null}
          </div>

          {revealedSecret ? (
            <div className="alert" style={{ marginTop: 16 }}>
              <strong>Webhook key (copy now — shown once after enable/rotate):</strong>
              <p style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{revealedSecret}</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void copyText(revealedSecret, 'key')}
              >
                {copied === 'key' ? 'Copied key' : 'Copy key'}
              </button>
            </div>
          ) : status?.hasSecret && status.enabled ? (
            <p className="muted" style={{ marginTop: 12 }}>
              A key is configured. Use <strong>Rotate key</strong> to issue a new one.
            </p>
          ) : null}

          <h3 style={{ marginTop: 24 }}>Sample request</h3>
          <pre className="code-block">{`POST ${status?.endpoint ?? 'https://api.wizcrm.app/integrations/webhook/leads'}
X-WizCRM-Webhook-Key: <your-secret>
Content-Type: application/json

${samplePayload}`}</pre>
        </div>
      )}
    </div>
  );
}
