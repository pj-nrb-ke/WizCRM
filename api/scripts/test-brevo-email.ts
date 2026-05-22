/**
 * Send one test email. Usage:
 *   npx tsx scripts/test-brevo-email.ts you@example.com
 */
import { sendTransactionalEmail } from '../src/services/brevo-mail.js';
import { loadBrevoSecrets } from '../src/services/brevo-config.js';

const to = process.argv[2];
if (!to) {
  console.error('Usage: npx tsx scripts/test-brevo-email.ts <recipient@email.com>');
  process.exit(1);
}

loadBrevoSecrets(true);

try {
  const result = await sendTransactionalEmail({
    toEmail: to,
    toName: 'WizCRM Test',
    subject: 'WizCRM Brevo test',
    text: 'If you received this, Brevo integration is working.',
  });
  console.log('SUCCESS via', result.method, '→', to);
} catch (e) {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
}
