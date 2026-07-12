import { sendTransactionalEmail } from './brevo-mail.js';

const APP_URL = (process.env.APP_URL ?? 'https://app.wizcrm.app').replace(/\/$/, '');
const LOGO_URL = `${APP_URL}/logo.png`;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Table-based layout with inline styles — the only markup subset that
 * renders consistently across Gmail/Outlook/Apple Mail. Mirrors the app's
 * brand-blue gradient (see BrandMark.tsx) so transactional mail looks like
 * it came from the same product as the login screen.
 */
function renderBrandedEmail(input: {
  heading: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  footerNote: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#1A56DB 0%,#1245B8 50%,#0D3A9E 100%);padding:28px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px;">
                      <img src="${LOGO_URL}" width="32" height="32" alt="WizCRM" style="display:block;border-radius:8px;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.01em;">WizCRM</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:19px;color:#0f172a;">${escapeHtml(input.heading)}</h1>
                <div style="font-size:14px;line-height:1.6;color:#334155;">${input.bodyHtml}</div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
                  <tr>
                    <td style="border-radius:8px;background:#1A56DB;">
                      <a href="${input.ctaUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                        ${escapeHtml(input.ctaText)}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="font-size:12px;color:#94a3b8;word-break:break-all;">
                  Or paste this link into your browser:<br />${input.ctaUrl}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">${escapeHtml(input.footerNote)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Fire-and-forget — never blocks or fails the caller's request. */
export function sendAccountActivationEmail(input: { toEmail: string; toName: string; rawToken: string }): void {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(input.rawToken)}`;
  const html = renderBrandedEmail({
    heading: `Welcome, ${input.toName}`,
    bodyHtml: `
      <p style="margin:0 0 12px;">An account has been created for you on WizCRM. Set your password to get started — this link expires in 7 days.</p>
      <p style="margin:0;">Email: <strong>${escapeHtml(input.toEmail)}</strong></p>
    `,
    ctaText: 'Set your password',
    ctaUrl: link,
    footerNote: "Didn't expect this? You can safely ignore this email.",
  });
  void sendTransactionalEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: 'Your WizCRM account is ready',
    text: `Hi ${input.toName},\n\nAn account has been created for you on WizCRM.\nSet your password (link expires in 7 days): ${link}`,
    html,
  }).catch((e) => {
    console.warn('[sendAccountActivationEmail]', input.toEmail, e instanceof Error ? e.message : e);
  });
}

/** Fire-and-forget — never blocks or fails the caller's request. */
export function sendPasswordResetEmail(input: { toEmail: string; toName: string; rawToken: string }): void {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(input.rawToken)}`;
  const html = renderBrandedEmail({
    heading: 'Reset your password',
    bodyHtml: `<p style="margin:0;">We received a request to reset your WizCRM password. This link expires in 1 hour.</p>`,
    ctaText: 'Choose a new password',
    ctaUrl: link,
    footerNote: "Didn't request this? Your password won't change — you can ignore this email.",
  });
  void sendTransactionalEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: 'Reset your WizCRM password',
    text: `Hi ${input.toName},\n\nWe received a request to reset your WizCRM password (link expires in 1 hour): ${link}\n\nIf you didn't request this, ignore this email.`,
    html,
  }).catch((e) => {
    console.warn('[sendPasswordResetEmail]', input.toEmail, e instanceof Error ? e.message : e);
  });
}
