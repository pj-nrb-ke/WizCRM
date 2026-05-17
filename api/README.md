# WizCRM API

Node + Fastify + Prisma + PostgreSQL + OpenAI.

## Setup

```bash
# From repo root
npm install
npm run db:up
cp api/.env.example api/.env
# Set OPENAI_API_KEY in api/.env

cd api
npm run db:push
npm run db:seed
npm run dev
```

Health: `GET http://localhost:3000/health`

**Postgres port:** `5434` on the host (avoids conflict with local PostgreSQL on 5432/5433). Use `127.0.0.1`, not `localhost`, if you have multiple listeners.

## Tests

```bash
npm run test -w shared
npm run test -w api
RUN_INTEGRATION_TESTS=1 npm run test -w api   # needs DB + seed
```

Seed users: `rep@wizag.local` / `wizcrm123`, `manager@wizag.local` / `wizcrm123`
