import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/**
 * Like `required`, but the dev fallback is ONLY allowed outside production.
 * In production the env var must be set explicitly — no weak default — or the
 * process refuses to start (prevents shipping a guessable JWT secret).
 */
function requiredSecret(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isProduction) {
    throw new Error(`Missing required env in production: ${name}`);
  }
  return devFallback;
}

const defaultCorsOrigins = [
  'https://app.wizcrm.app',
  'http://localhost:5180',
  'http://localhost:5173',
];

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: required('DATABASE_URL', 'postgresql://wizcrm:wizcrm_dev@127.0.0.1:5434/wizcrm'),
  jwtSecret: requiredSecret('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
  /** Allowed browser origins. Override with CORS_ORIGINS (comma-separated). */
  corsOrigins: (process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean)) ?? defaultCorsOrigins,
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  aiPromptVersion: 'v1',
  /** When false and no API key, AI routes return 503 with fallback hints. */
  aiEnabled: Boolean(process.env.OPENAI_API_KEY),
  /**
   * Sales Desk uses rules-only (fast) unless WIZCRM_DESK_USE_AI=1.
   * LLM desk can take 10–30s on each tab open.
   */
  deskUseAi: process.env.WIZCRM_DESK_USE_AI === '1',

  // Lead Generator
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? '',
  leadEngineEnabled: Boolean(process.env.GOOGLE_PLACES_API_KEY),

  // Brevo webhook shared secret — set in Brevo dashboard as custom header X-WizCRM-Webhook-Key
  brevoWebhookSecret: process.env.BREVO_WEBHOOK_SECRET ?? '',

  // Heat Map signal discovery
  googleCustomSearchKey: process.env.GOOGLE_CUSTOM_SEARCH_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? '',
  googleCustomSearchEngineId: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID ?? '',
  tavilyApiKey: process.env.TAVILY_API_KEY ?? '',
  apolloApiKey: process.env.APOLLO_API_KEY ?? '',
};
