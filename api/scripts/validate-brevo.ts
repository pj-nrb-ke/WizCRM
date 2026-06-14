/**
 * Validate Brevo config without printing secrets.
 * Usage: npx tsx scripts/validate-brevo.ts
 */
import { getBrevoStatus, loadBrevoSecrets } from '../src/services/brevo-config.js';

loadBrevoSecrets(true);
const status = getBrevoStatus();
const secrets = loadBrevoSecrets();

console.log('Brevo config path:', status.configPath ?? '(env fallback only)');
console.log('Send method:', status.method);
console.log('MAIL_FROM:', status.mailFrom ?? '(missing)');
console.log('MAIL_FROM_NAME:', status.mailFromName);

if (!status.configured) {
  console.error('FAIL: No send method. Add docs/brevo.local.txt with BREVO_API_KEY or SMTP_* keys.');
  process.exit(1);
}

const api = secrets.BREVO_API_KEY ?? '';
const smtp = secrets.SMTP_PASS ?? '';
if (api && !api.startsWith('xkeysib-')) {
  console.warn('WARN: BREVO_API_KEY should start with xkeysib-');
}
if (smtp && !smtp.startsWith('xsmtpsib-')) {
  console.warn('WARN: SMTP_PASS should start with xsmtpsib-');
}

console.log('OK: Email is configured via', status.method);
