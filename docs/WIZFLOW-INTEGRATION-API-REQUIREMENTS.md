# WizCRM → WizFlow integration — API setup requirements

Copy this to the WizFlow side (owner or hosting agent). Confirms what WizCRM
needs configured in WizFlow before the VSM ("Wanjiru") can hand off non-sales
tasks as WizFlow requests instead of creating WizCRM Tasks — VSM-SPEC.md §8,
"optional WizFlow hand-off for non-sales tasks."

**Grounded against WizFlow's live OpenAPI** (`https://api.wizflow.biz/openapi.json`,
checked directly on the VPS, v0.6.0) — the endpoints below already exist; this
document is a configuration request, not a feature request.

---

## 1. Why this exists

VSM's rule layer (R1–R7) only ever produces sales follow-up tasks today. The
spec anticipates a second lane: when a pattern the VSM surfaces is really an
**operational/admin/compliance** matter — not something a sales rep should
own as a WizCRM Task — it should become a WizFlow approval request instead,
routed to whoever actually owns that process.

**Concrete triggers WizCRM will use to decide "this goes to WizFlow, not a Task":**
- A `STAFF_FLAGGED` escalation (VSM-SPEC §4.7 — someone hit "need management
  help" on a task) where the CEO/admin reviewing it in the Escalations inbox
  judges it as operational rather than sales — a manual "Send to WizFlow"
  action on that escalation, not automatic.
- Future rule-layer additions that are explicitly operational (not yet built;
  today's rules are sales-only).

This is a manual hand-off at first (admin clicks a button), not a fully
automatic classifier — keeps the initial integration small and auditable.

---

## 2. What WizCRM needs from WizFlow

| # | Item | WizFlow endpoint | Notes |
|---|------|-------------------|-------|
| 1 | A **service user** (no interactive login) to own the integration's API key | — (created like any WizFlow user, role scoped to submit-only) | `ApiKeyCreate` requires a `service_user_id` — WizFlow needs to create this user first. Suggested: `vsm-integration@wizag.biz`. |
| 2 | An **API key** for that service user | `POST /api/v1/admin/integrations/api-keys` | Returns `api_key` **once** — must be shared via secure channel, never in chat/email. See §5. |
| 3 | **Scopes** for that key | same endpoint, `scopes: []` field | WizFlow's scope taxonomy isn't in the OpenAPI schema — **please tell us the exact scope string(s)** that cover `POST /api/v1/external/requests` (submit) and `GET /api/v1/external/requests` (status polling, used as a fallback if a webhook delivery is missed). |
| 4 | One or more **Workflow Definitions** for the categories WizCRM will hand off | created in WizFlow's workflow builder | Proposed starting categories: **IT/Ops request**, **Compliance/Admin request**, **Facilities request**. Please return the `workflow_id` (UUID) for each once created — WizCRM will map its own category to the matching `workflow_id` in the `POST /api/v1/external/requests` call. |
| 5 | The **form field names** each workflow's `request_data` expects | — | `ExternalRequestSubmit.data` accepts an arbitrary JSON object (`additionalProperties: true`), but the actual fields a workflow's form validates against are workflow-specific. Please share the field schema for each workflow above so WizCRM sends matching keys instead of guessing. |
| 6 | A **webhook subscription** back to WizCRM | `POST /api/v1/admin/integrations/webhooks` | `url: https://api.wizcrm.app/webhooks/wizflow` (new endpoint, to be built once #2–#4 exist). Returns a `signing_secret` once — shared the same way as the API key (§5). |
| 7 | The **event type list** to subscribe to | `GET /api/v1/admin/integrations/webhook-events` | This is self-describing in WizFlow — please paste the output so WizCRM can pick the equivalents of "request approved," "request rejected," and "status changed" (exact event-name strings unknown from the OpenAPI alone). |

---

## 3. Payload contract WizCRM will send

`POST /api/v1/external/requests` with header `X-API-Key: <the key from §2>`:

```json
{
  "workflow_id": "<uuid from §2 item 4>",
  "data": {
    "external_reference": "wizcrm:escalation:<escalation-id>",
    "originator_name": "<CEO/admin who sent it>",
    "originator_email": "<their email>",
    "subject": "<escalation summary>",
    "description": "<full evidence text>",
    "priority": "WARNING | CRITICAL",
    "source_url": "https://app.wizcrm.app/settings/escalations"
  }
}
```

`external_reference` is WizCRM's own correlation key — **please confirm
whether `GET /api/v1/external/requests` can be filtered by an arbitrary field
inside `request_data`** (the current schema only shows `status` and `limit`
query params). If not, WizCRM will rely on the webhook exclusively and keep
its own request_id ↔ escalation_id mapping locally after the initial `POST`
response (`WorkflowInstanceOut.id`).

---

## 4. Idempotency

`ExternalRequestSubmit` has no idempotency-key field in the current schema.
WizCRM will store the returned `WorkflowInstanceOut.id` on its own escalation
row immediately after a successful `201`, and will not resubmit an escalation
that already has one — so a retry only matters if the first `POST` never
completed. **Is there a request-level idempotency key WizFlow can accept
(e.g. a client-supplied UUID), or should WizCRM handle retries purely by not
retrying past a successful `201`?**

---

## 5. Secrets handling (not in git)

Same convention as the rest of this integration (see `WizFlow.md` §4):

| Secret | Where it lives on WizCRM's side |
|--------|----------------------------------|
| WizFlow API key (§2) | `config/secrets/wizflow-api-key.local.txt`, `chmod 600`, VPS only |
| Webhook signing secret (§2 item 6) | same file or a sibling, verified via HMAC on inbound webhook — same pattern already used for the Brevo inbound webhook (`config.brevoWebhookSecret`) |

**Do not paste either value in chat.** Send via SCP to the VPS directly, or
drop the file in `config/secrets/` on the server during a coordinated
session — same as how the Brevo credentials were handled.

---

## 6. What WizCRM will build once §2 is answered

- `POST /webhooks/wizflow` — HMAC-verified (mirrors the existing
  `/webhooks/brevo` pattern in `api/src/app.ts`), updates the linked
  `VsmEscalation` row's evidence with the WizFlow request status.
- A **"Send to WizFlow"** action on the Escalations page (admin/CEO only,
  same `requireAdminOrCeo()` guard as the rest of VSM) that maps the chosen
  category to a `workflow_id` and calls `POST /api/v1/external/requests`.
- Status badge on the escalation card once linked ("In WizFlow — Pending
  approval / Approved / Rejected"), driven by the webhook.

---

## Items WizFlow must answer before build starts

- [ ] Scope string(s) for `POST`/`GET /api/v1/external/requests` (§2.3)
- [ ] `workflow_id` for each of: IT/Ops request, Compliance/Admin request,
      Facilities request (§2.4) — or a different starting set if these don't
      match WizFlow's existing workflow catalogue
- [ ] Form field schema (`request_data` keys) for each workflow above (§2.5)
- [ ] Output of `GET /api/v1/admin/integrations/webhook-events` (§2.7)
- [ ] Whether `GET /api/v1/external/requests` can filter by a custom
      `request_data` field, or WizCRM should rely on the webhook only (§3)
- [ ] Whether there's a client-supplied idempotency key for
      `POST /api/v1/external/requests` (§4)
- [ ] API key + webhook signing secret, delivered via SCP/VPS — not chat (§5)
