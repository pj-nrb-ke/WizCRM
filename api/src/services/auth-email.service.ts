import { sendTransactionalEmail } from './brevo-mail.js';

const APP_URL = (process.env.APP_URL ?? 'https://app.wizcrm.app').replace(/\/$/, '');

/** Fire-and-forget — never blocks or fails the caller's request. */
export function sendWelcomeEmail(input: {
  toEmail: string;
  toName: string;
  tempPassword: string;
}): void {
  void sendTransactionalEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: 'Your WizCRM account is ready',
    text: [
      `Hi ${input.toName},`,
      '',
      `An account has been created for you on WizCRM: ${APP_URL}`,
      '',
      `Email: ${input.toEmail}`,
      `Temporary password: ${input.tempPassword}`,
      '',
      'Sign in and change your password from the menu in the top-right corner.',
      `Forgot it later? Use "Forgot password?" on the sign-in page: ${APP_URL}/login`,
    ].join('\n'),
  }).catch((e) => {
    console.warn('[sendWelcomeEmail]', input.toEmail, e instanceof Error ? e.message : e);
  });
}

/** Fire-and-forget — never blocks or fails the caller's request. */
export function sendPasswordResetEmail(input: {
  toEmail: string;
  toName: string;
  rawToken: string;
}): void {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(input.rawToken)}`;
  void sendTransactionalEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: 'Reset your WizCRM password',
    text: [
      `Hi ${input.toName},`,
      '',
      'We received a request to reset your WizCRM password. This link expires in 1 hour:',
      link,
      '',
      "If you didn't request this, you can ignore this email — your password won't change.",
    ].join('\n'),
  }).catch((e) => {
    console.warn('[sendPasswordResetEmail]', input.toEmail, e instanceof Error ? e.message : e);
  });
}
