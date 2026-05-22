#!/usr/bin/env bash
# Run on Contabo VPS as root (or: Get-Content scripts/deploy-vps.sh -Raw | ssh ... 'bash -s')
set -eu
cd /opt/wizcrm
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
