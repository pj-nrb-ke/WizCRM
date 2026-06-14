# Hosting a web app on an online server (agent playbook)

Reusable guide for **agents and automation** deploying Node/API + static web apps to a VPS (Ubuntu). WizCRM uses this pattern on Contabo; swap values per project.

**WizCRM-specific steps (Caddy, systemd, paths):** [website-hosting-notes.md](./website-hosting-notes.md)

**Related secrets files:**

| File | Purpose |
|------|---------|
| **`docs/hosting.local.txt`** | VPS SSH + deploy paths (**this doc**) |
| `docs/brevo.local.txt` | Email (Brevo) — [email-integration.md](./email-integration.md) |
| `api/.env` on server only | Runtime API secrets (DB, JWT, OpenAI) — never commit |

---

## 1. Goals

- Host **HTTPS API** + **static SPA** on one VPS.
- Keep **server login and deploy targets** in a **local text file** (gitignored), not in chat, commits, or CI logs.
- Let any agent load the same file from known paths and run deploy over SSH.

---

## 2. Local credentials file: `hosting.local.txt`

### 2.1 Create the file

```powershell
Copy-Item docs\hosting.local.example.txt docs\hosting.local.txt
# Edit docs\hosting.local.txt with real VPS IP, SSH user, key path, app paths
```

**Committed template:** `docs/hosting.local.example.txt`  
**Real file (gitignored):** one of:

1. `docs/hosting.local.txt` — **default for this repo**
2. `config/secrets/hosting.local.txt`
3. `secrets/hosting.local.txt` at repo root

Agents must **read the file from disk**; never ask the user to paste passwords or SSH keys into chat.

### 2.2 Format rules

Same convention as `brevo.local.txt` and `api/.env`:

- One `KEY=value` per line.
- Keys are case-insensitive; loaders normalize to uppercase.
- Lines starting with `#` are comments.
- Optional quotes around values (`"..."` or `'...'`) are stripped.
- `SSH_IDENTITY_FILE` may use `%USERPROFILE%\.ssh\keyname` on Windows or `~/.ssh/keyname`.

### 2.3 Standard keys

| Key | Required | Meaning |
|-----|----------|---------|
| `SSH_HOST` | Yes | VPS public IP or hostname |
| `SSH_USER` | Yes | SSH login (`root` or deploy user with sudo) |
| `SSH_PORT` | No | Default `22` |
| `SSH_IDENTITY_FILE` | Yes* | Path to **private** key file (not `.pub`) |
| `APP_ROOT` | Yes | App directory on server (e.g. `/opt/wizcrm`) |
| `GIT_BRANCH` | Yes | Branch to pull (e.g. `development`) |
| `GIT_REMOTE` | No | Default `origin` |
| `API_PUBLIC_URL` | Yes | Public API base for builds/smoke tests (e.g. `https://api.example.com`) |
| `WEB_PUBLIC_URL` | Yes | Public web URL (e.g. `https://app.example.com`) |
| `WEB_STATIC_DIR` | Yes | Directory Caddy serves for SPA (e.g. `/var/www/myapp-web`) |
| `HOSTING_PANEL_URL` | No | Provider web panel only — **not** used for SSH deploy |
| `HOSTING_PANEL_USER` | No | Panel login (optional reference for humans) |
| `HOSTING_PANEL_PASS` | No | Panel password — **never commit** |

\* Prefer SSH keys. If only password auth exists, document it only in `hosting.local.txt` and use `ssh` with appropriate options; do not commit.

### 2.4 Example (filled)

```ini
SSH_HOST=203.0.113.50
SSH_USER=root
SSH_PORT=22
SSH_IDENTITY_FILE=%USERPROFILE%\.ssh\myapp_vps

APP_ROOT=/opt/myapp
GIT_BRANCH=main
API_PUBLIC_URL=https://api.myapp.com
WEB_PUBLIC_URL=https://app.myapp.com
WEB_STATIC_DIR=/var/www/myapp-web
```

### 2.5 How agents should load the file

**PowerShell (WizCRM):**

```powershell
. .\scripts\Read-HostingConfig.ps1
$cfg = Get-HostingConfig  # function exported by dot-sourcing; or:
$cfg = & { . .\scripts\Read-HostingConfig.ps1; Get-HostingConfig }

ssh -o BatchMode=yes -p $cfg.SSH_PORT -i $cfg.SSH_IDENTITY_FILE "$($cfg.SSH_USER)@$($cfg.SSH_HOST)" "hostname"
```

`scripts/deploy-vps.ps1` uses this loader automatically when `docs/hosting.local.txt` exists.

**Manual / other languages:**

1. Resolve path: try `docs/hosting.local.txt`, then `config/secrets/hosting.local.txt`, then `secrets/hosting.local.txt`.
2. Parse line by line (`KEY=value`, skip `#` comments).
3. Expand `%USERPROFILE%` or `~` in `SSH_IDENTITY_FILE`.
4. Use values for SSH and deploy; **do not print** `HOSTING_PANEL_PASS` or key file contents.

**Python sketch:**

```python
from pathlib import Path

def load_hosting_config(repo_root: Path) -> dict[str, str]:
    for rel in ("docs/hosting.local.txt", "config/secrets/hosting.local.txt", "secrets/hosting.local.txt"):
        path = repo_root / rel
        if path.is_file():
            cfg = {}
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                k, _, v = line.partition("=")
                cfg[k.strip().upper()] = v.strip().strip("\"'")
            return cfg
    raise FileNotFoundError("hosting.local.txt missing — copy hosting.local.example.txt")
```

---

## 3. Architecture (typical VPS)

```text
Internet
   │
   ▼
Reverse proxy (Caddy or nginx) :443  TLS (Let's Encrypt)
   ├── api.<domain>   → 127.0.0.1:3000   (Node API, systemd)
   └── app.<domain>   → /var/www/<app>-web   (static files, SPA)

127.0.0.1:5432  →  PostgreSQL (Docker, not public)
```

| Layer | Role |
|-------|------|
| DNS | A records `api`, `app` → `SSH_HOST` |
| Caddy/nginx | HTTPS, `reverse_proxy` to API, `file_server` + `try_files` for SPA |
| systemd | Keeps API process running after deploy |
| Docker | Postgres (or use managed DB) bound to localhost only |
| `APP_ROOT` | Git clone, `npm install`, builds |
| `WEB_STATIC_DIR` | Copied output of `npm run web:build` |

---

## 4. Phase A — One-time server setup

Run on the VPS (via SSH using values from `hosting.local.txt`).

1. **OS packages:** `git`, `curl`, `ufw`, `docker.io`, Caddy (or nginx), Node.js LTS (e.g. 22).
2. **Firewall:** allow 22, 80, 443; deny public DB port.
3. **SSH key:** developer public key in `~/.ssh/authorized_keys` for `SSH_USER`.
4. **Clone app:** `git clone -b <GIT_BRANCH> <repo-url> <APP_ROOT>`.
5. **Database:** Docker Compose prod file, `127.0.0.1:5432` only; password in `docker/.env.db` (`chmod 600`).
6. **API env on server:** `<APP_ROOT>/api/.env` with `DATABASE_URL`, `JWT_SECRET`, etc. (`chmod 600`) — separate from `hosting.local.txt`.
7. **Build order:** monorepo `shared` → `api`; `npx prisma db push`; seed if needed.
8. **systemd unit** for API listening on `127.0.0.1:3000`.
9. **Caddy** vhost for `API_PUBLIC_URL` host → reverse_proxy.
10. **Web build** with `VITE_API_URL=<API_PUBLIC_URL>`; copy `dist/` to `WEB_STATIC_DIR`.
11. **Caddy** vhost for `WEB_PUBLIC_URL` → `file_server` + `try_files {path} /index.html`.

WizCRM concrete commands: [website-hosting-notes.md](./website-hosting-notes.md) Phase 1–2.

---

## 5. Phase B — Every deploy (agent workflow)

### 5.1 Preconditions

- [ ] `docs/hosting.local.txt` exists and `SSH_*` / `APP_*` are correct.
- [ ] Code pushed to `GIT_BRANCH` (user does not run deploy scripts per [PARALLEL-AGENT-NOTE.md](./PARALLEL-AGENT-NOTE.md)).
- [ ] DNS points to `SSH_HOST`.
- [ ] App-specific secrets on server (`api/.env`, `docs/brevo.local.txt`, etc.) already copied if needed.

### 5.2 Load config (agent)

```powershell
$cfg = & { . "$PSScriptRoot\Read-HostingConfig.ps1"; Get-HostingConfig }
# Use: $cfg.SSH_HOST, $cfg.SSH_IDENTITY_FILE, $cfg.API_PUBLIC_URL, ...
```

### 5.3 Push code (git)

```powershell
git push origin development   # or $cfg.GIT_BRANCH
```

### 5.4 Run remote deploy (SSH)

Pipe a bash script with **LF** line endings (Windows CRLF breaks `bash`):

```powershell
$cfg = & { . .\scripts\Read-HostingConfig.ps1; Get-HostingConfig }
$script = Get-Content .\scripts\deploy-vps.sh -Raw
$script = $script -replace "`r`n", "`n" -replace "`r", "`n"
$script | ssh -o BatchMode=yes -p $cfg.SSH_PORT -i $cfg.SSH_IDENTITY_FILE "$($cfg.SSH_USER)@$($cfg.SSH_HOST)" "bash -s"
```

Or: `.\scripts\deploy-vps.ps1` (reads `hosting.local.txt` when present).

### 5.5 Remote steps (what deploy script should do)

Inside `APP_ROOT`:

1. `git pull` (stash local dirt on server if needed).
2. `npm install` (include dev deps if web build needs `@types/*`).
3. Build API stack (`shared` → `api`, `prisma db push`, `api` build).
4. `VITE_API_URL=<API_PUBLIC_URL> npm run web:build`.
5. Copy `web/dist/*` → `WEB_STATIC_DIR`.
6. `systemctl restart <api-service>`.
7. Reload reverse proxy.
8. Smoke: `curl -sS <API_PUBLIC_URL>/health`.

### 5.6 Copy app-specific secret files to server

Example (WizCRM email):

```powershell
$cfg = & { . .\scripts\Read-HostingConfig.ps1; Get-HostingConfig }
scp -i $cfg.SSH_IDENTITY_FILE docs\brevo.local.txt "$($cfg.SSH_USER)@$($cfg.SSH_HOST):$($cfg.APP_ROOT)/docs/brevo.local.txt"
ssh -i $cfg.SSH_IDENTITY_FILE "$($cfg.SSH_USER)@$($cfg.SSH_HOST)" "systemctl restart wizcrm-api"
```

Rule: **local gitignored file** → **same relative path under `APP_ROOT`** on VPS.

---

## 6. Adapting to another app (checklist)

Replace placeholders in `hosting.local.example.txt` → `hosting.local.txt`:

| Placeholder | Your app |
|-------------|----------|
| `SSH_HOST` | New VPS IP |
| `SSH_IDENTITY_FILE` | New SSH key path |
| `APP_ROOT` | e.g. `/opt/crm-acme` |
| `API_PUBLIC_URL` | `https://api.acme.com` |
| `WEB_PUBLIC_URL` | `https://app.acme.com` |
| `WEB_STATIC_DIR` | e.g. `/var/www/acme-web` |
| systemd unit name | e.g. `acme-api.service` |
| Caddy hostnames | Match API/WEB public URLs |

Copy deploy script pattern from `scripts/deploy-vps.sh`; parameterize `APP_ROOT`, URLs, and service names from `hosting.local.txt`.

---

## 7. Security rules for agents

| Do | Don't |
|----|--------|
| Read `hosting.local.txt` from disk | Paste VPS passwords in chat or commits |
| Commit only `hosting.local.example.txt` | Commit `hosting.local.txt` |
| Use `SSH_IDENTITY_FILE` + `BatchMode=yes` | Log full file contents in CI |
| `chmod 600` for `.env` on server | Put DB/JWT in `hosting.local.txt` (use server `api/.env`) |
| Confirm smoke URL after deploy | Reuse WizCRM keys for a different VPS |

---

## 8. Troubleshooting

| Symptom | Check |
|---------|--------|
| `No hosting.local.txt found` | Copy `docs/hosting.local.example.txt` → `docs/hosting.local.txt` |
| `Permission denied (publickey)` | `SSH_IDENTITY_FILE` path, key added to VPS `authorized_keys` |
| `bash: pipefail` / `$'\r'` errors | CRLF in script piped from Windows — normalize to LF |
| Web build fails locally | `npm config get omit` — if `dev`, run `npm install --include=dev` |
| API 502 | `systemctl status <api-service>`, `journalctl -u <api-service> -n 50` |
| SPA 404 on refresh | Caddy/nginx `try_files` → `/index.html` |
| HTTPS cert fails | DNS must resolve to `SSH_HOST` before Caddy obtains cert |

---

## 9. WizCRM reference map

| Item | Value |
|------|--------|
| Template | `docs/hosting.local.example.txt` |
| Loader | `scripts/Read-HostingConfig.ps1` |
| Deploy | `scripts/deploy-vps.ps1`, `scripts/deploy-vps.sh` |
| Bootstrap | `scripts/server-setup-contabo.sh` |
| Deep dive | `docs/website-hosting-notes.md` |
| API on server | `/opt/wizcrm/api/.env` |
| Email on server | `/opt/wizcrm/docs/brevo.local.txt` |

---

## 10. `.gitignore` entries (all apps)

```gitignore
docs/hosting.local.txt
config/secrets/hosting.local.txt
secrets/hosting.local.txt
```

Commit **only** `docs/hosting.local.example.txt` (and this doc), never the real `hosting.local.txt`.
