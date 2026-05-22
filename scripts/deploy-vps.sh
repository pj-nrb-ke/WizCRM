#!/usr/bin/env bash
# Run on Contabo VPS as root (or via: ssh contabo-wizcrm 'bash -s' < scripts/deploy-vps.sh)
set -euo pipefail
cd /opt/wizcrm
git fetch origin development
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
echo "Deploy OK — API $(curl -sS https://api.wizcrm.app/health | head -c 80)"
