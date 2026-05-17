import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: required('DATABASE_URL', 'postgresql://wizcrm:wizcrm_dev@127.0.0.1:5434/wizcrm'),
  jwtSecret: required('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  aiPromptVersion: 'v1',
  /** When false and no API key, AI routes return 503 with fallback hints. */
  aiEnabled: Boolean(process.env.OPENAI_API_KEY),
};
