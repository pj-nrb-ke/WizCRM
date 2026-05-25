#!/usr/bin/env bash
# Run on Contabo VPS as root (or: Get-Content scripts/deploy-vps.sh -Raw | ssh ... 'bash -s')
set -eu
cd /opt/wizcrm

# Ensure Postgres is up before prisma / API (container may stop after reboot if never enabled).
if [[ ! -f docker/.env.db ]]; then
  PW="$(grep '^DATABASE_URL=' api/.env | sed -n 's|postgresql://wizcrm:\([^@]*\)@.*|\1|p' || true)"
  if [[ -z "${PW}" ]]; then
    echo "Missing docker/.env.db and cannot parse DATABASE_URL from api/.env" >&2
    exit 1
  fi
  echo "POSTGRES_PASSWORD=${PW}" > docker/.env.db
  chmod 600 docker/.env.db
fi
DC="$(command -v docker-compose 2>/dev/null || echo "docker compose")"
${DC} -f docker/docker-compose.prod.yml --env-file docker/.env.db up -d --no-recreate 2>/dev/null || \
  ${DC} -f docker/docker-compose.prod.yml --env-file docker/.env.db up -d
for _ in $(seq 1 30); do
  if docker inspect -f '{{.State.Health.Status}}' wizcrm-postgres 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 1
done

git fetch origin development
git stash push -u -m "pre-deploy-$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
git pull origin development
npm install
npm run build -w shared
cd api
npx prisma db push
npm run build
cd ..
VITE_API_URL=https://api.wizcrm.app npm run web:build
mkdir -p /var/www/wizcrm-web
rm -rf /var/www/wizcrm-web/*
cp -r web/dist/* /var/www/wizcrm-web/
systemctl restart wizcrm-api
systemctl reload caddy 2>/dev/null || true
systemctl is-active wizcrm-api
curl -sS https://api.wizcrm.app/health | head -c 120
echo ""
echo "Deploy OK"
