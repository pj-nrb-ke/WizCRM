# DPA checklist (MGT-010)

- [ ] Identify data controller (customer) vs processor (WizCRM operator)
- [ ] Subprocessors: hosting (Contabo), email (Brevo), AI (OpenAI if enabled), ScaleGate
- [ ] Data residency: [define]
- [ ] Security measures: HTTPS, tenant isolation, JWT auth
- [ ] Breach notification procedure
- [ ] GDPR export/delete: `POST /auth/gdpr-export-request` (Phase 3 stub)
