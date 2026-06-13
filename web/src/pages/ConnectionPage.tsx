import { useEffect, useState } from 'react';
import { api, getApiBaseUrl } from '../lib/api';

type AdminHealth = {
  apiPublicUrl: string;
  webPublicUrl: string;
  aiEnabled: boolean;
};

export function ConnectionPage() {
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [copied, setCopied] = useState(false);
  const apiUrl = health?.apiPublicUrl ?? getApiBaseUrl();

  useEffect(() => {
    api<AdminHealth>('/admin/health').then(setHealth).catch(() => {});
  }, []);

  async function copyUrl() {
    try {
      // navigator.clipboard is unavailable on insecure (HTTP/LAN) origins —
      // exactly the dev scenario this page targets — so fall back to execCommand.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(apiUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = apiUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — leave the URL visible for manual copy.
    }
  }

  return (
    <>
      <h1>Mobile connection</h1>
      <p className="muted">Use this URL on the phone — no port :3000 for production HTTPS.</p>

      <div className="card">
        <h2>API URL for mobile app</h2>
        <p style={{ fontSize: '1.1rem', wordBreak: 'break-all' }}>{apiUrl}</p>
        <button type="button" className="btn-primary" onClick={() => void copyUrl()}>
          {copied ? 'Copied' : 'Copy URL'}
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          On the phone login screen: paste this URL → <strong>Save API URL</strong>, or rebuild the
          APK with <code>.\scripts\build-apk.ps1 -ApiUrl "{apiUrl}"</code>
        </p>
      </div>

      <div className="card">
        <h2>Web app</h2>
        <p>{health?.webPublicUrl ?? 'https://app.wizcrm.app'}</p>
        <p className="muted">Deploy this admin UI to that host when DNS is ready.</p>
      </div>
    </>
  );
}
