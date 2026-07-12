import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Same discovery pattern as brevo-config.ts — repo-root-relative, never
 * committed (see .gitignore: config/secrets/firebase-service-account.json). */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');

const CANDIDATES = [
  '/config/secrets/firebase-service-account.json',
  path.join(REPO_ROOT, 'config', 'secrets', 'firebase-service-account.json'),
  path.join(REPO_ROOT, 'secrets', 'firebase-service-account.json'),
];

export type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

let cache: FirebaseServiceAccount | null | undefined;

export function loadFirebaseServiceAccount(reload = false): FirebaseServiceAccount | null {
  if (cache !== undefined && !reload) return cache;

  for (const candidate of CANDIDATES) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as FirebaseServiceAccount;
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        cache = parsed;
        return cache;
      }
    } catch {
      continue;
    }
  }
  cache = null;
  return cache;
}

export function isPushConfigured(): boolean {
  return loadFirebaseServiceAccount() !== null;
}
