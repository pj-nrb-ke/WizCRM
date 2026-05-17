# WizCRM — Product features

**WizCRM** is a lead-lifecycle CRM for sales and field teams, from Wise & Agile Solutions Ltd. It tracks every prospect from first contact through qualification, proposals, and win/loss—on **web** and **mobile**—with optional proof-of-visit and ERP sync for growing businesses.

Use this list for brochures, websites, and sales sheets. Technical detail: [SRS.md](./SRS.md).

---

## Core CRM

| Feature | Description |
|---------|-------------|
| **Lead management** | Create and maintain leads with contact details, company, source, owner, tags, and custom fields. |
| **Lead search and filters** | Find leads quickly by name, company, stage, owner, source, dates, and stale status. |
| **Lead detail view** | Single screen for full record, current stage, next action, and activity history. |
| **Duplicate detection** | Warns when a new lead matches an existing email or phone number to keep data clean. |
| **Assignment and handoff** | Assign or reassign leads to sales reps or teams with a clear ownership history. |
| **Audit trail** | Records who changed what on leads, stages, and settings for accountability. |

---

## Lead lifecycle and pipeline

| Feature | Description |
|---------|-------------|
| **Lifecycle stages** | Structured path: New → Contacted → Qualified → Proposal → Negotiation → Won or Lost. |
| **Visual pipeline** | Kanban or list views grouped by stage so managers see funnel health at a glance. |
| **Stage history** | Every stage change is logged with user, time, and optional note—nothing happens in silence. |
| **Close as Won** | Mark deals won with value, start date, and products or services; ready for handoff to accounts. |
| **Close as Lost** | Close lost deals with structured reasons (price, timing, competitor, fit, etc.) for analytics. |
| **Reopen leads** | Return a lost lead to an earlier stage when opportunity returns, with full audit. |
| **Stale lead alerts** | Highlights leads with no recent activity so reps follow up before opportunities go cold. |
| **Configurable stages** | Admins can tailor stage names and workflow to match how your business sells. |

---

## Activities and timeline

| Feature | Description |
|---------|-------------|
| **Unified timeline** | One chronological feed per lead: calls, emails, meetings, tasks, notes, and system events. |
| **Call logging** | Log calls with outcome, duration, and notes—manual or prompted after a phone call on mobile. |
| **Email logging** | Record email touchpoints with subject, summary, and direction (inbound/outbound). |
| **Meetings** | Schedule meetings linked to leads, with location, time, and attendees. |
| **Tasks and reminders** | Set follow-ups with due dates; get notified so nothing slips through the cracks. |
| **Internal notes** | Private notes on leads for team context without exposing them to the customer. |
| **Next action** | Optional “what’s next” and date on each lead, surfaced on dashboards and lists. |

---

## Field sales (mobile-first)

| Feature | Description |
|---------|-------------|
| **Mobile app (iOS & Android)** | Full CRM access on the road via a native mobile experience built with modern cross-platform technology. |
| **Post-call lead prompt** | After a sales call ends, the app prompts you to attach the call to the right lead and log outcome in seconds. |
| **Tap-to-call and email** | Start a call or email from the lead record without copying numbers or addresses. |
| **Add leads on the go** | Capture new prospects immediately after events, visits, or calls. |
| **Push notifications** | Alerts for due tasks, new assignments, and important lead updates. |
| **Offline-friendly mobile** | Recently viewed leads and drafts available when signal is weak; sync when back online. |
| **Compact mobile pipeline** | Review and update pipeline stages from a phone-optimized layout. |

---

## Meeting location and attendance

| Feature | Description |
|---------|-------------|
| **Meeting destination on map** | Set meeting location by address or map pin before the visit. |
| **Navigate to meeting** | Open turn-by-turn directions in Google Maps or Apple Maps from the app. |
| **Geofence check-in** | Automatic arrival time when the rep enters a radius around the meeting site. |
| **Geofence check-out** | Automatic departure time when the rep leaves the area—on-site duration calculated. |
| **Attendance status** | On-time, late, no-show, or partial visit based on scheduled vs actual times. |
| **Manager override** | Managers can correct arrival or departure with reason when GPS or edge cases require it. |
| **Meeting attendance reports** | See who attended which meetings and for how long—ideal for field team oversight. |

---

## Quotations and ERP integration

| Feature | Description |
|---------|-------------|
| **Quotations in WizCRM** | Build quotes with line items, quantities, prices, discounts, and tax linked to the lead. |
| **Sync quotes to ERP** | Push approved quotations into your accounting or ERP system as draft quotes or sales documents. |
| **Customer sync with ERP** | Keep clients aligned between WizCRM and ERP—create or update customers in either direction per your rules. |
| **Supported ERP platforms** | Integration framework for **SAGE Evolution 200**, **SAP Business One**, **QuickBooks**, and **Tally** (enabled per plan). |
| **Field mapping** | Configure how names, addresses, tax IDs, and other fields map between WizCRM and each ERP. |
| **Scheduled and manual sync** | Automatic sync on a schedule plus on-demand sync for admins. |
| **Sync audit log** | Full history of what synced, when, and whether it succeeded—for support and compliance. |
| **ERP product catalog (optional)** | Pull item lists and prices from ERP for faster, accurate quote lines. |

---

## Dashboards and reporting

| Feature | Description |
|---------|-------------|
| **Personal dashboard** | Your open leads, tasks due today, stale leads, and upcoming meetings in one place. |
| **Manager dashboard** | Team pipeline snapshot, attendance exceptions, and unlinked calls for coaching. |
| **Conversion analytics** | See conversion rates by stage, source, owner, and time period. |
| **Time in stage** | Identify bottlenecks by measuring how long leads stay in each stage. |
| **Win/loss analysis** | Understand why deals are won or lost with reason breakdowns. |
| **Export to CSV** | Export leads and activities for spreadsheets and external reporting. |
| **Saved views** | Save favorite filters (e.g. “My qualified leads this month”) for one-click access. |

---

## Web administration and bulk tools

| Feature | Description |
|---------|-------------|
| **Bulk import** | Import leads from CSV for campaigns, events, or migrations. |
| **Bulk updates** | Mass assign owners or move stages for manager efficiency. |
| **User and team management** | Invite users, define teams, and control who sees what. |
| **Sources and loss reasons** | Configure lead sources and lost-deal reason lists to match your business. |
| **Custom fields** | Add industry-specific fields without code changes. |
| **System settings** | Defaults for stale days, geofence size, call prompts, and org-wide behaviour. |

---

## Multi-tenant SaaS platform

| Feature | Description |
|---------|-------------|
| **Cloud multi-tenant** | One WizCRM platform serves many customer organizations with strict data separation. |
| **Organization workspaces** | Each client company has its own leads, users, settings, and branding. |
| **Subdomain or tenant login** | Users access their organization’s workspace securely (e.g. by company subdomain). |
| **Per-organization branding** | Logo and colours so each tenant’s team sees their identity. |
| **Roles per organization** | Sales, Manager, and Admin permissions scoped to each tenant. |
| **Multi-organization users** | Consultants or admins can switch between organizations they belong to. |
| **Seat-based licensing** | User invites respect licensed seat limits from your subscription plan. |
| **Data export and offboarding** | Tenant admins can export their data; platform supports deletion workflows. |

---

## Commercial licensing (ScaleGate)

| Feature | Description |
|---------|-------------|
| **ScaleGate license integration** | Subscriptions and entitlements managed in **ScaleGate**; WizCRM enforces access from your commercial system. |
| **Plan-based features** | Unlock geofence, ERP sync, call prompts, and more based on the customer’s plan. |
| **License status in app** | Admins see plan name, renewal date, and link to manage subscription. |
| **Graceful renewal handling** | Grace period and read-only mode when a license expires or payment lapses. |

---

## Integrations and automation

| Feature | Description |
|---------|-------------|
| **Web lead capture** | Incoming web forms can create leads in WizCRM automatically. |
| **Calendar sync (planned)** | Connect Google or Microsoft calendar for meetings and tasks. |
| **Email integration (planned)** | Optional sync with mailbox for richer email history. |
| **Webhooks** | Notify external systems when leads or stages change. |
| **Automation rules** | Auto-assign by source, reminders for stale leads, and similar workflow helpers. |
| **Slack / Teams alerts (planned)** | Team notifications for new leads, wins, or exceptions. |

---

## Post-sale and accounts

| Feature | Description |
|---------|-------------|
| **Convert to customer account** | Turn a won lead into a customer record for post-sale relationship management. |
| **Account timeline** | Continue logging activities after the sale for renewals and support handoff. |
| **Renewal and upsell tracking** | Track expansion opportunities on existing customers. |

---

## Security, privacy, and compliance

| Feature | Description |
|---------|-------------|
| **Secure sign-in** | Industry-standard authentication; optional SSO and two-factor for enterprise plans. |
| **Encrypted credentials** | ERP and integration passwords stored securely, never exposed in the app. |
| **GDPR-ready tooling** | Export and delete contact data to support privacy requests. |
| **Location transparency** | Clear consent and policies when meeting geofence features are used. |

---

## Optional enhancements (roadmap)

Premium or future capabilities that can differentiate higher tiers or later releases:

| Feature | Description |
|---------|-------------|
| **Dark and light themes** | Comfortable viewing in any environment. |
| **Customizable home screen** | Arrange widgets for tasks, pipeline, and priorities. |
| **Pinned leads and recent search** | Faster access to what you work on most. |
| **Team chat on a lead** | Internal discussion thread per opportunity. |
| **@mentions in notes** | Notify colleagues from within a note. |
| **Document attachments** | Store proposals, contracts, and photos on the lead. |
| **Document templates** | Generate proposals from lead data automatically. |
| **E-signature** | Connect to DocuSign or similar to close faster. |
| **Business card scan** | Create leads from a photographed business card. |
| **Email templates** | Merge lead fields into consistent outbound emails. |
| **AI timeline summary** | Short summary of recent activity on a lead. |
| **AI suggested next action** | Smart recommendations for what to do next. |
| **Lead scoring** | Prioritize leads by fit and engagement. |
| **Snooze lead** | Hide a lead until a future date. |
| **Report builder** | Custom charts and tables for power users. |
| **Quotas and forecasts** | Targets per rep and weighted pipeline forecast. |
| **Leaderboards and badges** | Optional gamification for motivated teams. |
| **Home screen widget** | Tasks due today on the phone home screen. |
| **Biometric app unlock** | Fingerprint or face unlock on mobile. |
| **Arrival photo** | Optional photo proof when checking in at a meeting site. |

---

## Platforms

| Platform | Description |
|----------|-------------|
| **Web application** | Full CRM, administration, reporting, and ERP configuration in the browser. |
| **Mobile application** | Android and iOS apps for field sales, calls, meetings, and geofence attendance. |

---

## Wise & Agile Solutions Ltd

WizCRM is designed for teams that need **visibility across the full lead lifecycle**, **proof of field activity**, and **alignment with accounting systems**—without juggling spreadsheets and disconnected tools.

For implementation status, see [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md). For technical requirements, see [SRS.md](./SRS.md).
