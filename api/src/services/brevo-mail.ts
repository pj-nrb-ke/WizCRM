import nodemailer from 'nodemailer';
import { loadBrevoSecrets, getEmailSendMethod } from './brevo-config.js';

export type SendEmailParams = {
  toEmail: string;
  toName: string;
  subject: string;
  text: string;
  html?: string;
  /** e.g. task-<id>@reply.wizag.co.ke — routes a reply back into the task thread. */
  replyTo?: { email: string; name?: string };
};

export class EmailUnavailableError extends Error {
  statusCode = 503;
  constructor(message = 'EMAIL_UNAVAILABLE') {
    super(message);
    this.name = 'EmailUnavailableError';
  }
}

export async function sendTransactionalEmail(params: SendEmailParams): Promise<{ method: 'api' | 'smtp' }> {
  const secrets = loadBrevoSecrets();
  const method = getEmailSendMethod(secrets);

  if (!secrets.MAIL_FROM) {
    throw new EmailUnavailableError('MAIL_FROM is not configured');
  }
  if (method === 'none') {
    throw new EmailUnavailableError(
      'No Brevo credentials. Add docs/brevo.local.txt or config/secrets/brevo.local.txt',
    );
  }

  const html = params.html ?? textToHtml(params.text);
  const text = params.text;

  if (method === 'api') {
    await sendViaBrevoApi(secrets, params, html, text);
    return { method: 'api' };
  }

  await sendViaSmtp(secrets, params, html, text);
  return { method: 'smtp' };
}

async function sendViaBrevoApi(
  secrets: Record<string, string>,
  params: SendEmailParams,
  html: string,
  text: string,
) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': secrets.BREVO_API_KEY,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: secrets.MAIL_FROM_NAME || 'WizCRM',
        email: secrets.MAIL_FROM,
      },
      to: [{ email: params.toEmail, name: params.toName }],
      subject: params.subject,
      htmlContent: html,
      textContent: text,
      ...(params.replyTo ? { replyTo: { email: params.replyTo.email, name: params.replyTo.name } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function sendViaSmtp(
  secrets: Record<string, string>,
  params: SendEmailParams,
  html: string,
  text: string,
) {
  const port = Number(secrets.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: secrets.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: secrets.SMTP_USER,
      pass: secrets.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"${secrets.MAIL_FROM_NAME || 'WizCRM'}" <${secrets.MAIL_FROM}>`,
    to: `"${params.toName}" <${params.toEmail}>`,
    subject: params.subject,
    text,
    html,
    ...(params.replyTo ? { replyTo: `"${params.replyTo.name ?? ''}" <${params.replyTo.email}>` } : {}),
  });
}

function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre style="font-family:sans-serif;white-space:pre-wrap">${escaped}</pre>`;
}
