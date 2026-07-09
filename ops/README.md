# Operations

## Monitoring

Production runs on a single VPS. Three layers watch it, and they fail in
different ways on purpose.

### 1. `GET /health` — the liveness probe

Public, unauthenticated, returns JSON.

```
200  {"status":"ok","db":"up","uptimeSeconds":1234, ...}
503  {"status":"degraded","db":"down","uptimeSeconds":1234}
```

It **queries the database** before answering. An API that replies `ok` while
Postgres is unreachable reports healthy during exactly the outage you needed to
hear about. A non-2xx is returned on failure so a monitor need not parse the body.

### 2. `wizcrm-watchdog.sh` — the on-box watchdog

Runs from cron every 5 minutes. Checks:

| Check | Why it matters |
|---|---|
| `/health` returns 200 with `db:up` | the app is serving and can reach its data |
| Postgres container is `running` | catches a crashed or stopped container |
| `wizcrm-api.service` is active | catches a crash systemd could not restart |
| Disk below 85% | a full disk corrupts Postgres and silently breaks backups |
| Newest backup under 26h old | a silently-broken backup is only discovered on the day you need it |

It emails **once** when the system starts failing, and **once** when it recovers.
It does not email every run: an alert that arrives 288 times a day is an alert
nobody reads. State lives in `/var/lib/wizcrm/watchdog.state`.

**It cannot tell you the box is down.** It runs on the machine it is watching, so
a dead server, a full network outage, or an expired TLS certificate produce
silence, not an alert. Silence is indistinguishable from health. See layer 3.

### 3. External uptime check — *not yet configured*

Something off-box must poll `https://api.wizcrm.app/health` and alert on
non-2xx or timeout. Any of UptimeRobot (free tier), Better Stack, or a cron on a
second machine will do. This closes the hole in layer 2 and is the only layer
that survives the server disappearing.

### Triage: `GET /admin/errors`

Managers and admins only. Returns the last 50 server-side 5xx failures with
timestamp, method, path and message — enough to see *what* broke without SSHing
in to read `journalctl`. Query strings are stripped because they can carry tokens.

The buffer is in memory and is lost on restart. That is deliberate: if the
database is what broke, writing the error report to the database would fail too.

## Install / update the watchdog

```bash
install -m 0700 ops/wizcrm-watchdog.sh /usr/local/bin/wizcrm-watchdog.sh
# once:
( crontab -l 2>/dev/null; echo '*/5 * * * * /usr/local/bin/wizcrm-watchdog.sh' ) | crontab -
```

Requires `curl`, `jq`, `docker`, and in `/opt/wizcrm/api/.env`:

- `BREVO_API_KEY` — to send mail
- `MAIL_FROM` — a sender verified in Brevo
- `WATCHDOG_ALERT_TO` — who to wake up (defaults to `MAIL_FROM`)

Run it by hand to check wiring; it exits non-zero when a check fails:

```bash
/usr/local/bin/wizcrm-watchdog.sh; echo "exit=$?"
tail /var/log/wizcrm-watchdog.log
```

## Backups

`wizcrm-db-backup.sh` runs nightly at 02:30, writes `pg_dump -Fc` archives to
`/var/backups/wizcrm`, and keeps 14 days. The watchdog fails if the newest
archive is older than 26 hours.

Backups live on the same disk as the database. **An off-box copy is still
outstanding** — a disk or provider failure currently loses both.

## Restore drill

```bash
docker exec -i wizcrm-postgres pg_restore -U wizcrm -d wizcrm_restore_test --clean < backup.dump
```

Restore into a scratch database, never over the live one.
