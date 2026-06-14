#!/bin/bash
# WizCRM production bootstrap for Ubuntu 24.04 (Contabo).
# Run on the server as root: bash server-setup-contabo.sh
set -euo pipefail

DOMAIN="${WIZCRM_DOMAIN:-api.wizcrm.app}"
REPO="${WIZCRM_REPO:-https://github.com/pj-nrb-ke/WizCRM.git}"
APP_DIR="${WIZCRM_APP_DIR:-/opt/wizcrm}"

echo "==> WizCRM setup for ${DOMAIN}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw docker.io caddy
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif apt-get install -y -qq docker-compose-v2 2>/dev/null && docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
else
  apt-get install -y -qq docker-compose
  DOCKER_COMPOSE="docker-compose"
fi

systemctl enable docker caddy
systemctl start docker

ufw --force reset || true
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

mkdir -p "${APP_DIR}"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone -b development "${REPO}" "${APP_DIR}"
else
  cd "${APP_DIR}" && git pull
fi

if [[ -f /root/docker-compose.prod.yml ]]; then
  cp /root/docker-compose.prod.yml "${APP_DIR}/docker/docker-compose.prod.yml"
fi

cd "${APP_DIR}"

if [[ ! -f docker/.env.db ]]; then
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" > docker/.env.db
  chmod 600 docker/.env.db
fi
set -a
source docker/.env.db
set +a

${DOCKER_COMPOSE} -f docker/docker-compose.prod.yml --env-file docker/.env.db up -d

cd "${APP_DIR}"
npm install
npm run build -w shared
cd api
npm run build

if [[ ! -f .env ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  cat > .env <<EOF
DATABASE_URL=postgresql://wizcrm:${POSTGRES_PASSWORD}@127.0.0.1:5432/wizcrm
PORT=3000
HOST=127.0.0.1
JWT_SECRET=${JWT_SECRET}
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=production
EOF
  chmod 600 .env
  echo "Created api/.env — add OPENAI_API_KEY on the server for AI features."
fi

set -a
source .env
set +a
npx prisma db push
npm run db:seed

cat > /etc/systemd/system/wizcrm-api.service <<EOF
[Unit]
Description=WizCRM API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/api
EnvironmentFile=${APP_DIR}/api/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable wizcrm-api
systemctl restart wizcrm-api

cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
    reverse_proxy 127.0.0.1:3000
}
EOF

systemctl reload caddy

sleep 2
curl -sf "http://127.0.0.1:3000/health" | head -c 200
echo ""
echo "==> Done. Public: https://${DOMAIN}/health"
