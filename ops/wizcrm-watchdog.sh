#!/usr/bin/env bash
#
# WizCRM watchdog — runs on the VPS every 5 minutes from cron.
#
# Checks the things that actually take WizCRM down, and emails once when the
# system starts failing and once when it recovers. It does NOT email every run:
# an alert that arrives 288 times a day is an alert nobody reads.
#
# Deliberate limitation: this runs ON the box it is watching, so it cannot tell
# you the box itself is down or unreachable from the internet. Pair it with an
# external uptime check against https://api.wizcrm.app/health.
#
# Install:
#   install -m 0700 ops/wizcrm-watchdog.sh /usr/local/bin/wizcrm-watchdog.sh
#   crontab -e  ->  */5 * * * * /usr/local/bin/wizcrm-watchdog.sh

set -uo pipefail

ENV_FILE=/opt/wizcrm/api/.env
STATE_FILE=/var/lib/wizcrm/watchdog.state
LOG_FILE=/var/log/wizcrm-watchdog.log
HEALTH_URL=${HEALTH_URL:-https://api.wizcrm.app/health}
BACKUP_DIR=/var/backups/wizcrm
DISK_LIMIT_PCT=85
BACKUP_MAX_AGE_H=26

mkdir -p "$(dirname "$STATE_FILE")"

log() { printf '%s %s\n' "$(date -Is)" "$*" >>"$LOG_FILE"; }

# Read a value from .env without executing it — the file holds secrets and
# arbitrary characters, and `source` on it would run whatever is inside.
env_get() {
  sed -n "s/^$1=//p" "$ENV_FILE" 2>/dev/null | head -1 | sed 's/^"//; s/"$//'
}

FAILURES=()

# 1. The API answers, reaches its database, and says so.
health_body=$(curl -sf --max-time 10 "$HEALTH_URL" 2>/dev/null)
if [[ $? -ne 0 || -z "$health_body" ]]; then
  FAILURES+=("API health check did not return success ($HEALTH_URL)")
elif [[ "$health_body" != *'"db":"up"'* ]]; then
  FAILURES+=("API is up but reports its database is unreachable")
fi

# 2. The Postgres container is actually running.
pg_state=$(docker inspect -f '{{.State.Status}}' wizcrm-postgres 2>/dev/null)
if [[ "$pg_state" != "running" ]]; then
  FAILURES+=("Postgres container is '${pg_state:-missing}', expected 'running'")
fi

# 3. The API service has not died in a way systemd could not restart.
if ! systemctl is-active --quiet wizcrm-api.service; then
  FAILURES+=("wizcrm-api.service is not active")
fi

# 4. Disk has room. A full disk corrupts Postgres and breaks backups.
disk_pct=$(df --output=pcent / | tail -1 | tr -dc '0-9')
if [[ -n "$disk_pct" && "$disk_pct" -ge "$DISK_LIMIT_PCT" ]]; then
  FAILURES+=("Disk is ${disk_pct}% full (limit ${DISK_LIMIT_PCT}%)")
fi

# 5. A backup was taken recently. A silently-broken backup is the worst failure
#    of all, because you only discover it on the day you need it.
newest_backup=$(find "$BACKUP_DIR" -name '*.dump' -type f -printf '%T@\n' 2>/dev/null | sort -rn | head -1)
if [[ -z "$newest_backup" ]]; then
  FAILURES+=("No database backup found in $BACKUP_DIR")
else
  age_h=$(( ( $(date +%s) - ${newest_backup%.*} ) / 3600 ))
  if [[ "$age_h" -gt "$BACKUP_MAX_AGE_H" ]]; then
    FAILURES+=("Newest database backup is ${age_h}h old (limit ${BACKUP_MAX_AGE_H}h)")
  fi
fi

# Brevo's SMTP password is the "xsmtpsib-" key. In this deployment that key is
# stored under BREVO_API_KEY while SMTP_PASS holds something else, so trusting
# the variable names gets you "Login denied". The API resolves the same mix-up
# at runtime in normalizeBrevoSecrets(); mirror that rule here: whichever
# variable actually carries the xsmtpsib- key is the SMTP password.
smtp_password() {
  local pass key
  pass=$(env_get SMTP_PASS)
  key=$(env_get BREVO_API_KEY)
  if [[ "$key" == xsmtpsib-* ]]; then
    printf '%s' "$key"
  else
    printf '%s' "$pass"
  fi
}

# Send over SMTP, the same channel the API itself uses. Brevo's REST endpoint
# would need an "xkeysib-" key, and no such key exists on this box.
send_email() {
  local subject="$1" body="$2"
  local host port user pass from to msg

  host=$(env_get SMTP_HOST)
  port=$(env_get SMTP_PORT); port=${port:-587}
  user=$(env_get SMTP_USER)
  pass=$(smtp_password)
  from=$(env_get MAIL_FROM)
  to=$(env_get WATCHDOG_ALERT_TO); to=${to:-$from}

  if [[ -z "$host" || -z "$user" || -z "$pass" || -z "$from" || -z "$to" ]]; then
    log "CANNOT ALERT: SMTP_HOST/SMTP_USER/SMTP_PASS/MAIL_FROM missing from $ENV_FILE"
    return 1
  fi

  msg=$(mktemp) || return 1
  chmod 600 "$msg"
  {
    printf 'From: WizCRM Watchdog <%s>\n' "$from"
    printf 'To: <%s>\n' "$to"
    printf 'Subject: %s\n' "$subject"
    printf 'Date: %s\n' "$(date -R)"
    printf 'Content-Type: text/plain; charset=utf-8\n\n'
    printf '%s\n' "$body"
  } >"$msg"

  # -sS so curl stays quiet on success but still explains itself on failure;
  # the password is scrubbed before anything reaches the log.
  local err rc
  err=$(curl -sS --max-time 25 --url "smtp://${host}:${port}" --ssl-reqd \
    --mail-from "$from" --mail-rcpt "$to" \
    --user "${user}:${pass}" --upload-file "$msg" 2>&1)
  rc=$?
  rm -f "$msg"

  if [[ $rc -eq 0 ]]; then
    log "alert email sent to $to"
  else
    log "ALERT EMAIL FAILED (curl $rc): $(printf '%s' "$err" | sed "s/${pass}/***/g" | head -c 300)"
  fi
}

prev_state=$(cat "$STATE_FILE" 2>/dev/null || echo healthy)

if [[ ${#FAILURES[@]} -gt 0 ]]; then
  summary=$(printf '  - %s\n' "${FAILURES[@]}")
  log "FAILING: ${#FAILURES[@]} check(s) failed"
  if [[ "$prev_state" != "failing" ]]; then
    send_email "[WizCRM] Production problem detected" \
"The WizCRM watchdog found ${#FAILURES[@]} problem(s) on $(hostname) at $(date -Is):

$summary

Checked: $HEALTH_URL
Log: $LOG_FILE

You will get one more email when this clears. No further emails until then."
  fi
  echo failing >"$STATE_FILE"
  exit 1
fi

log "ok"
if [[ "$prev_state" == "failing" ]]; then
  send_email "[WizCRM] Recovered" \
"All WizCRM checks are passing again on $(hostname) at $(date -Is).

Checked: $HEALTH_URL
Log: $LOG_FILE"
fi
echo healthy >"$STATE_FILE"
