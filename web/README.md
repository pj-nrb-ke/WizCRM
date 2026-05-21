# WizCRM Web

Admin console for WizCRM (Cluster A — settings & platform control).

## Local development

```powershell
cd c:\Users\pj\WizCRM
npm install
copy web\.env.example web\.env.local
# Edit web\.env.local — e.g. VITE_API_URL=http://127.0.0.1:3000
.\scripts\start-api.ps1
npm run web:dev
```

Open http://localhost:5173 — sign in as `admin@wizag.local` (full settings), `manager@wizag.local` (org/teams), or `rep@wizag.local`.

**Note:** After `npm run db:seed`, passwords are in `api/prisma/seed.ts` (e.g. `wizcrm123` for admin).

## Production build

```powershell
npm run web:build
```

Output: `web/dist/` — deploy to `app.wizcrm.app` (Caddy `file_server` + SPA fallback).

## Deploy on Contabo (with API)

1. DNS: **A** record `app` → server IP  
2. Build locally or on server: `npm run web:build`  
3. Copy `web/dist` to `/var/www/wizcrm-web`  
4. Caddyfile:

```text
app.wizcrm.app {
    root * /var/www/wizcrm-web
    encode gzip
    file_server
    try_files {path} /index.html
}
```

5. On server API: `npx prisma db push` (adds `Organization.settings`)  
6. `systemctl reload caddy`

## Pages (SRS-WEB)

| Route | ID | Role |
|-------|-----|------|
| `/` | Home | All logged-in |
| `/organization` | WEB-010 | Manager+ |
| `/users` | WEB-011 | Admin |
| `/teams` | WEB-012 | Manager+ |
| `/platform` | WEB-013 | Admin |
| `/connection` | WEB-014 | Admin |
| `/audit` | WEB-015 | Admin |
