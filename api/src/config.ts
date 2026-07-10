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
  // Optional — unauthenticated OpenCorporates works (100 req/day free); add key for 500 req/day
  openCorporatesApiKey: process.env.OPENCORPORATES_API_KEY ?? '',
  // Registry Lookup — 5,000 free calls/month; register at registry-lookup.com
  registryLookupApiKey: process.env.REGISTRY_LOOKUP_API_KEY ?? '',

  // Contact Finder — waterfall providers
  hunterApiKey: process.env.HUNTER_API_KEY ?? '',
  prospeoApiKey: process.env.PROSPEO_API_KEY ?? '',
  tombaApiKey: process.env.TOMBA_API_KEY ?? '',
  tombaApiSecret: process.env.TOMBA_API_SECRET ?? '',

  // ICP Pipeline — enrichment + discovery
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? '',
  apifyToken: process.env.APIFY_TOKEN ?? '',
  /** Apify actor for Google Maps — override with APIFY_ACTOR_ID env var */
  apifyActorId: process.env.APIFY_ACTOR_ID ?? 'compass~crawler-google-places',

  // Kenya Data Protection Act — 'gate' strips personal identifiers; 'block' excludes entirely
  kdpaMode: (process.env.KDPA_PERSONAL_DATA ?? 'gate') as 'block' | 'gate',

  // Africa's Talking — Voice IVR spike (AI BDR). Call origination uses these creds;
  // the public voice callback endpoint needs only apiPublicUrl (no secret on the server).
  atUsername: process.env.AT_USERNAME ?? '',
  atApiKey: process.env.AT_API_KEY ?? '',
  atVoiceNumber: process.env.AT_VOICE_NUMBER ?? '',
  atVoiceEnabled: Boolean(process.env.AT_API_KEY && process.env.AT_USERNAME && process.env.AT_VOICE_NUMBER),
  /** Optional shared secret; if set, the voice callback requires ?k=<secret>. */
  atVoiceCallbackSecret: process.env.AT_VOICE_CALLBACK_SECRET ?? '',
  /**
   * How Jane's speech reaches the caller.
   *   say   — Africa's Talking own TTS. Robotic, but proven to work.
   *   play  — our synthesised voice, served as an 8 kHz mono mp3.
   *   probe — Play for the greeting, Say for the rest. NOT a safe fallback: a
   *           <Play> that fails to decode aborts the remaining actions in the
   *           same response, so the <Say> after it never speaks either. Useful
   *           only to answer "does this audio format play at all?".
   * Defaults to the safe option: a robotic Jane beats a silent one.
   */
  voiceTts: (process.env.VOICE_TTS ?? 'say') as 'say' | 'play' | 'probe',
  /**
   * Call flow.
   *   dtmf  — press-1-to-book menu. Needs no recordings, so it works while
   *           AT's recordingUrl is broken. The proven default.
   *   convo — conversational Jane. Requires AT to serve call recordings,
   *           which currently 404 (see docs/africastalking-recording-404.md).
   */
  voiceMode: (process.env.VOICE_MODE ?? 'dtmf') as 'dtmf' | 'convo',
  /** Log the full Africa's Talking callback payload. Off by default: it carries caller numbers. */
  voiceDebug: process.env.VOICE_DEBUG === '1',
  /**
   * Container for Jane's speech. Both are 8 kHz mono.
   *   mp3 — plays, but 8 kHz mp3 is MPEG-2.5 and decoders render it with artefacts.
   *   wav — uncompressed PCM, nothing to decode badly.
   */
  voiceAudioFormat: (process.env.VOICE_AUDIO_FORMAT ?? 'mp3') as 'mp3' | 'wav',
  /** Public base URL of THIS api, used to build the AT voice callback URL. */
  apiPublicUrl: process.env.API_PUBLIC_URL ?? 'https://api.wizcrm.app',
};
