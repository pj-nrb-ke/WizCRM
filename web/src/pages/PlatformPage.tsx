import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type SettingsResponse = {
  deskUseAi: boolean;
  deskUseAiEnvDefault: boolean;
  aiEnabled: boolean;
  openaiKeyConfigured: boolean;
  openaiModel: string;
};

export function PlatformPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [deskUseAi, setDeskUseAi] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    return api<SettingsResponse & { settings: object }>('/admin/settings').then((d) => {
      setData(d);
      setDeskUseAi(d.deskUseAi);
    });
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  async function onSave() {
    setMessage('');
    setError('');
    try {
      const d = await api<{ deskUseAi: boolean }>('/admin/settings', {
        method: 'PATCH',
        body: { deskUseAi },
      });
      setDeskUseAi(d.deskUseAi);
      setMessage('Settings saved. Desk tab will use the new mode on next load.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <>
      <h1>AI & platform</h1>
      <p className="muted">Control how the mobile Sales Desk behaves. OpenAI API key stays on the server only.</p>

      <div className="card">
        <h2>Status</h2>
        {data && (
          <ul className="status-list">
            <li>OpenAI key on server: {data.openaiKeyConfigured ? 'Configured' : 'Not set'}</li>
            <li>Model: {data.openaiModel || 'gpt-4o-mini'}</li>
            <li>Env default (LLM desk): {data.deskUseAiEnvDefault ? 'On' : 'Off'}</li>
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Sales Desk mode</h2>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={deskUseAi}
            onChange={(e) => setDeskUseAi(e.target.checked)}
            disabled={!data?.aiEnabled}
          />
          <span>Use AI-ranked desk (slower, needs OpenAI)</span>
        </label>
        <p className="muted" style={{ marginTop: 8 }}>
          Unchecked = fast rules-based priorities (recommended). Checked = ChatGPT picks top 5 leads
          (~10–30s per load).
        </p>
        {!data?.aiEnabled && (
          <p className="error">Enable OPENAI_API_KEY on the server before turning on AI desk.</p>
        )}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        <button
          type="button"
          className="btn-primary"
          style={{ marginTop: 12 }}
          onClick={() => void onSave()}
          disabled={!data?.aiEnabled}
        >
          Save desk mode
        </button>
      </div>
      <style>{`
        .status-list { margin: 0; padding-left: 20px; }
        .checkbox-row { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .checkbox-row input { width: auto; }
      `}</style>
    </>
  );
}
