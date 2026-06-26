# Lead Generator — Setup & Operations Guide

The Lead Generator is a B2B prospecting module built into WizCRM.  
It discovers prospects via Google Places, scores them, sends email outreach via Brevo, and tracks engagement via webhooks.

---

## Prerequisites

| Service | Required for | Where to get it |
|---------|-------------|-----------------|
| Google Places API | Prospect discovery | Google Cloud Console → APIs → Places API (New) |
| Brevo transactional API | Email sending | Brevo dashboard → SMTP & API → API Keys |
| Brevo webhook secret | Engagement tracking | You choose; set in Brevo dashboard |

---

## Environment variables

Add these to `api/.env` (or `/opt/wizcrm/api/.env` on the VPS):

```env
# Lead Generator — discovery
GOOGLE_PLACES_API_KEY=AIza...

# Email sending (shared with main email)
BREVO_API_KEY=xkeysib-...
MAIL_FROM=crm@yourcompany.com
MAIL_FROM_NAME=Your Name
APP_URL=https://app.wizcrm.app        # used in unsubscribe links

# Engagement tracking (Phase 7)
BREVO_WEBHOOK_SECRET=choose-a-strong-secret
```

> `APP_URL` must be the public URL of your web app — it is injected into every outbound email's unsubscribe footer.

---

## Database setup

The Lead Generator adds 9 new Prisma models.  
On first deploy, run:

```bash
cd /opt/wizcrm/api
npx prisma db push
```

Or let the deploy script handle it — `scripts/deploy-vps.sh` runs `prisma db push` automatically.

---

## Brevo webhook configuration (Phase 7)

To enable open/click/reply/unsubscribe tracking:

1. Log in to Brevo → **Transactional** → **Settings** → **Webhooks**
2. Click **Add a new webhook**
3. Set the URL to: `https://api.wizcrm.app/webhooks/brevo`
4. Tick events: **Opened**, **Clicked**, **Replied**, **Unsubscribed**, **Hard bounce**, **Soft bounce**, **Spam**
5. Under **Custom headers**, add:
   - Header name: `X-WizCRM-Webhook-Key`
   - Value: the same string you set as `BREVO_WEBHOOK_SECRET`
6. Save and click **Test** to verify the endpoint is reachable

---

## Creating your first campaign

1. Log in as a Manager or Admin
2. Go to **Lead Generator** in the sidebar (under SALES)
3. Click **+ New Campaign** — fill in:
   - **Name** — e.g. "ERP prospects Nairobi Q3"
   - **Industry keywords** — e.g. `manufacturing`, `logistics`, `distribution`
   - **Locations** — e.g. `Nairobi`, `Mombasa`
4. Click **Create** → you land on the Campaign Detail page

---

## Discovery

On the **Prospects** tab:

1. Click **Run Discovery** — triggers Google Places text search for each keyword × location combination
2. A progress banner polls every 3 seconds; disappears when complete
3. Discovered prospects are auto-scored and assigned a tier (A / B / C)
4. Click any row to open the **Prospect Drawer** for score breakdown and actions

---

## Email outreach (3-step sequence)

On the **Email Outreach** tab:

1. Create up to 3 email templates — use merge fields:
   - `{{company_name}}` `{{contact_name}}` `{{sender_name}}` `{{campaign_name}}` `{{unsubscribe_link}}`
2. Assign each template to a sequence step (Day 0 / Day 5 / Day 10)
3. Click **✉ Send now** on the step you want to trigger
4. Each send shows an eligible-count preview ("X ready · Y sent · Z no email") before you click
5. A DPA-compliant unsubscribe footer is appended to every email automatically

> **Rate limit:** sends are spaced 200 ms apart to stay within Brevo's free-tier limits.  
> **Discovery** is rate-limited to 5 runs/minute per IP.  
> **Send** is rate-limited to 3 sends/minute per IP.

---

## Pipeline import

- **Single import:** click a prospect row → Prospect Drawer → **→ Import to Pipeline**
- **Bulk import:** tick checkboxes in the Prospects tab → **Import selected**
- Imported leads appear in the **Leads** list with source "Lead Generator" and a link back to the campaign
- Prospects that reply to an email are automatically imported (Phase 7 webhook)

---

## Kenya Data Protection Act 2019 — compliance notes

| Requirement | How it is met |
|-------------|---------------|
| Unsubscribe mechanism | HMAC-signed link in every email footer; one click suppresses the prospect |
| Data deletion on request | `DELETE /leadengine/prospects/:id` hard-deletes PII (contacts, enrichment, email history) |
| Suppression list | `SuppressionList` table; checked before every discovery run and email send |
| No re-contact after unsubscribe | `SUPPRESSED` status blocks all future sends; suppression list blocks re-discovery |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| "GOOGLE_PLACES_API_KEY is not configured" | Missing env var | Add key to `.env`, restart API |
| Discovery run stuck at RUNNING | Google Places quota exceeded | Check Google Cloud Console → Quotas |
| Emails show 0 opens/clicks | Brevo webhook not configured | Follow webhook setup above |
| "Email not configured" on send | BREVO_API_KEY or MAIL_FROM missing | Add to `.env`, restart API |
| Unsubscribe link returns "Invalid" | APP_URL mismatch or JWT_SECRET changed | Ensure APP_URL and JWT_SECRET match production values |
