import { describe, expect, it } from 'vitest';
import { normalizeBrevoSecrets } from '../src/services/brevo-config.js';

describe('brevo config', () => {
  it('swaps API and SMTP keys when pasted into wrong fields', () => {
    const normalized = normalizeBrevoSecrets({
      BREVO_API_KEY: 'xsmtpsib-abc123',
      SMTP_PASS: 'xkeysib-xyz789',
      MAIL_FROM: 'test@example.com',
    });
    expect(normalized.SMTP_PASS).toBe('xsmtpsib-abc123');
    expect(normalized.BREVO_API_KEY).toBe('xkeysib-xyz789');
  });
});
