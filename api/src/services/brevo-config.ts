import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type BrevoSecrets = Record<string, string>;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');

const CANDIDATES = [
  '/config/secrets/brevo.local.txt',
  path.join(REPO_ROOT, 'docs', 'brevo.local.txt'),
  path.join(REPO_ROOT, 'config', 'secrets', 'brevo.local.txt'),
  path.join(REPO_ROOT, 'secrets', 'brevo.local.txt'),
];

let cache: BrevoSecrets | null = null;
let cachePath: string | null = null;

function parseIni(content: string): BrevoSecrets {
  const out: BrevoSecrets = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [rawKey, ...rest] = trimmed.split('=');
    const key = rawKey.trim().toUpperCase();
    let value = rest.join('=').trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Swap keys if pasted into wrong fields (see email-integration.md). */
export function normalizeBrevoSecrets(secrets: BrevoSecrets): BrevoSecrets {
  const out = { ...secrets };
  const api = out.BREVO_API_KEY ?? '';
  const smtp = out.SMTP_PASS ?? '';
  if (api.startsWith('xsmtpsib-')) {
    out.SMTP_PASS = api;
    out.BREVO_API_KEY = smtp.startsWith('xkeysib-') ? smtp : '';
  } else if (smtp.startsWith('xkeysib-')) {
    out.BREVO_API_KEY = smtp;
    out.SMTP_PASS = api.startsWith('xsmtpsib-') ? api : '';
  }
  return out;
}

export function loadBrevoSecrets(reload = false): BrevoSecrets {
  if (cache && !reload) return cache;

  for (const candidate of CANDIDATES) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const parsed = parseIni(fs.readFileSync(candidate, 'utf8'));
      if (Object.keys(parsed).length === 0) continue;
      cache = normalizeBrevoSecrets(applyEnvFallback(parsed));
      cachePath = candidate;
      return cache;
    } catch {
      continue;
    }
  }

  cache = applyEnvFallback({});
  cachePath = null;
  return cache;
}

function applyEnvFallback(secrets: BrevoSecrets): BrevoSecrets {
  return {
    ...secrets,
    SMTP_HOST: secrets.SMTP_HOST || process.env.SMTP_HOST || '',
    SMTP_PORT: secrets.SMTP_PORT || process.env.SMTP_PORT || '587',
    SMTP_USER: secrets.SMTP_USER || process.env.SMTP_USER || '',
    SMTP_PASS: secrets.SMTP_PASS || process.env.SMTP_PASS || '',
    MAIL_FROM: secrets.MAIL_FROM || process.env.MAIL_FROM || '',
    MAIL_FROM_NAME: secrets.MAIL_FROM_NAME || process.env.MAIL_FROM_NAME || 'WizCRM',
    BREVO_API_KEY: secrets.BREVO_API_KEY || process.env.BREVO_API_KEY || '',
  };
}

export type EmailSendMethod = 'api' | 'smtp' | 'none';

export function getEmailSendMethod(secrets = loadBrevoSecrets()): EmailSendMethod {
  if (secrets.BREVO_API_KEY?.startsWith('xkeysib-')) return 'api';
  if (secrets.SMTP_HOST && secrets.SMTP_USER && secrets.SMTP_PASS) return 'smtp';
  return 'none';
}

export function isEmailConfigured(): boolean {
  return getEmailSendMethod() !== 'none';
}

export function getBrevoConfigPath(): string | null {
  loadBrevoSecrets();
  return cachePath;
}

export function getBrevoStatus() {
  const secrets = loadBrevoSecrets();
  const method = getEmailSendMethod(secrets);
  return {
    configured: method !== 'none',
    method,
    configPath: getBrevoConfigPath(),
    mailFrom: secrets.MAIL_FROM || null,
    mailFromName: secrets.MAIL_FROM_NAME || 'WizCRM',
    apiKeyPrefix: secrets.BREVO_API_KEY
      ? `${secrets.BREVO_API_KEY.slice(0, 12)}…`
      : null,
    smtpHost: secrets.SMTP_HOST || null,
  };
}
