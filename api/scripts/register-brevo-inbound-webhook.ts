/**
 * One-off: register (or verify) Brevo's inbound-parse webhook via the REST
 * API — there is no dashboard UI for this webhook type.
 *
 * Requires BREVO_REST_API_KEY (a real v3 key, prefix xkeysib-, from Brevo >
 * SMTP & API > API Keys — distinct from BREVO_API_KEY, which stores the SMTP
 * password in this deployment) and BREVO_INBOUND_WEBHOOK_SECRET (any random
 * string; embedded in the callback URL since Brevo's inbound webhooks don't
 * support a custom auth header).
 *
 * Usage: npx tsx scripts/register-brevo-inbound-webhook.ts
 */
import { config } from '../src/config.js';

async function main() {
  if (!config.brevoRestApiKey) {
    console.error('FAIL: BREVO_REST_API_KEY is not set.');
    process.exit(1);
  }
  if (!config.brevoRestApiKey.startsWith('xkeysib-')) {
    console.warn('WARN: BREVO_REST_API_KEY should start with xkeysib- (this looks like an SMTP password, not a REST key).');
  }
  if (!config.brevoInboundWebhookSecret) {
    console.error('FAIL: BREVO_INBOUND_WEBHOOK_SECRET is not set.');
    process.exit(1);
  }

  const url = `${config.apiPublicUrl.replace(/\/$/, '')}/webhooks/brevo-inbound/${config.brevoInboundWebhookSecret}`;

  // Check for an existing inbound webhook on this domain first — the API
  // allows up to 20 webhooks total; re-running this script shouldn't create
  // duplicates. Quirk (confirmed live, not documented): GET /v3/webhooks
  // returns 400 "document_not_found" instead of an empty array when the
  // account has zero webhooks of the requested type — treat that as "none".
  const listRes = await fetch('https://api.brevo.com/v3/webhooks?type=inbound', {
    headers: { 'api-key': config.brevoRestApiKey, accept: 'application/json' },
  });
  let existingWebhooks: { id: number; domain?: string; url: string }[] = [];
  if (listRes.ok) {
    const body = (await listRes.json()) as { webhooks?: typeof existingWebhooks };
    existingWebhooks = body.webhooks ?? [];
  } else {
    const errBody = await listRes.json().catch(() => ({}) as { code?: string });
    if (listRes.status !== 400 || errBody.code !== 'document_not_found') {
      console.error(`FAIL: could not list existing webhooks (${listRes.status}): ${JSON.stringify(errBody)}`);
      process.exit(1);
    }
    // 400 document_not_found with zero webhooks of this type — fall through with an empty list.
  }
  const match = existingWebhooks.find((w) => w.domain === config.brevoInboundDomain);

  if (match) {
    if (match.url === url) {
      console.log(`OK: inbound webhook already registered for ${config.brevoInboundDomain} (id ${match.id}), URL matches.`);
      return;
    }
    console.log(`Found existing inbound webhook (id ${match.id}) for ${config.brevoInboundDomain} with a different URL — updating.`);
    const putRes = await fetch(`https://api.brevo.com/v3/webhooks/${match.id}`, {
      method: 'PUT',
      headers: {
        'api-key': config.brevoRestApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    if (!putRes.ok) {
      console.error(`FAIL: could not update webhook (${putRes.status}): ${await putRes.text()}`);
      process.exit(1);
    }
    console.log(`OK: updated inbound webhook (id ${match.id}) to point at ${url}`);
    return;
  }

  const createRes = await fetch('https://api.brevo.com/v3/webhooks', {
    method: 'POST',
    headers: {
      'api-key': config.brevoRestApiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      type: 'inbound',
      events: ['inboundEmailProcessed'],
      url,
      domain: config.brevoInboundDomain,
      description: 'WizCRM VSM two-way email',
    }),
  });
  if (!createRes.ok) {
    console.error(`FAIL: could not create webhook (${createRes.status}): ${await createRes.text()}`);
    process.exit(1);
  }
  const created = (await createRes.json()) as { id: number };
  console.log(`OK: created inbound webhook (id ${created.id}) for ${config.brevoInboundDomain} -> ${url}`);
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
