import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { leadRoutes } from './routes/leads.js';
import { activityRoutes } from './routes/activities.js';
import { documentRoutes } from './routes/documents.js';
import { taskRoutes } from './routes/tasks.js';
import { aiRoutes } from './routes/ai.js';
import { healthRoutes } from './routes/health.js';
import { teamRoutes } from './routes/teams.js';
import { adminRoutes } from './routes/admin.js';
import { reportRoutes } from './routes/reports.js';
import { emailRoutes } from './routes/email.js';
import { opportunityRoutes } from './routes/opportunities.js';
import { calendarRoutes } from './routes/calendar.js';
import { expoRoutes } from './routes/expos.js';
import { elevenLabsVoiceRoutes } from './routes/elevenlabs-voice.js';
import { integrationRoutes } from './routes/integrations.js';
import { quotationRoutes } from './routes/quotations.js';
import { leadThreadRoutes } from './routes/lead-thread.js';
import { reminderRoutes } from './routes/reminders.js';
import { leadEngineRoutes, handleUnsubscribe } from './routes/lead-engine.js';
import { contactFinderRoutes } from './routes/contact-finder.js';
import { leadDecisionMakerRoutes } from './routes/lead-decision-makers.js';
import { africasTalkingVoiceRoutes } from './routes/africastalking-voice.js';
import { vsmRoutes } from './routes/vsm.js';
import { handleBrevoEvent } from './services/lead-engine/webhook.service.js';
import { processBrevoInboundPayload } from './services/inbound-email.service.js';
import { getOrCreateEodRun, getOrCreateMorningRun } from './services/vsm-execution.service.js';
import { prisma } from './lib/prisma.js';
import { EmailUnavailableError } from './services/brevo-mail.js';
import { recordServerError } from './lib/error-recorder.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
    // Business card photos are sent as base64 from the mobile app.
    bodyLimit: 15 * 1024 * 1024,
  });

  // Africa's Talking posts voice callbacks as application/x-www-form-urlencoded.
  // Parse it into a plain object (no extra dependency; JSON routes are unaffected).
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, Object.fromEntries(new URLSearchParams(body as string)));
      } catch (err) {
        done(err as Error);
      }
    },
  );

  await app.register(cors, {
    // Restrict browser origins to the known web app + local dev. Requests with
    // no Origin header (native mobile app, curl, server-to-server) are allowed —
    // CORS only governs browsers, and the mobile client sends no Origin.
    origin(origin, cb) {
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    // Default is GET,HEAD,POST only — browser blocks PATCH (pipeline drag-drop, settings).
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-WizCRM-Webhook-Key'],
  });

  // Global safety net (200/min/IP); auth routes set a much tighter per-route limit.
  await app.register(rateLimit, { global: false, max: 200, timeWindow: '1 minute' });

  await app.register(jwt, {
    secret: config.jwtSecret,
    // Bound the lifetime of a leaked/stolen token, and pin the algorithm so a
    // forged header can't downgrade verification (e.g. alg:none).
    sign: { expiresIn: '7d', algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(leadRoutes, { prefix: '/leads' });
  await app.register(leadThreadRoutes, { prefix: '/leads' });
  await app.register(activityRoutes, { prefix: '/leads' });
  await app.register(leadDecisionMakerRoutes, { prefix: '/leads' });
  await app.register(taskRoutes, { prefix: '/tasks' });
  await app.register(aiRoutes, { prefix: '/ai' });
  await app.register(teamRoutes, { prefix: '/teams' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(reportRoutes, { prefix: '/reports' });
  await app.register(emailRoutes, { prefix: '/email' });
  await app.register(opportunityRoutes, { prefix: '/opportunities' });
  await app.register(calendarRoutes, { prefix: '/calendar' });
  await app.register(expoRoutes, { prefix: '/expos' });
  await app.register(reminderRoutes, { prefix: '/reminders' });
  await app.register(integrationRoutes, { prefix: '/integrations' });
  await app.register(quotationRoutes, { prefix: '/quotations' });
  await app.register(documentRoutes, { prefix: '/documents' });
  await app.register(leadEngineRoutes, { prefix: '/leadengine' });
  await app.register(contactFinderRoutes, { prefix: '/contacts/finder' });
  await app.register(vsmRoutes, { prefix: '/vsm' });

  // Africa's Talking Voice IVR (AI BDR spike) — public, AT posts urlencoded here
  await app.register(africasTalkingVoiceRoutes);
  await app.register(elevenLabsVoiceRoutes);

  // Brevo transactional webhooks — no JWT, secured by shared secret header
  app.post('/webhooks/brevo', async (request, reply) => {
    const secret = config.brevoWebhookSecret;
    if (secret) {
      const provided = request.headers['x-wizcrm-webhook-key'];
      if (provided !== secret) {
        return reply.status(401).send({ error: 'Invalid webhook key' });
      }
    }
    const result = await handleBrevoEvent(request.body as import('./services/lead-engine/webhook.service.js').BrevoWebhookEvent);
    return reply.send(result);
  });

  // Brevo inbound email (two-way channel on reply.wizag.co.ke) — no JWT.
  // Brevo's inbound webhooks don't support a custom auth header, so the
  // secret lives in the path instead; unknown/missing secret is a 404, not a
  // 401, so the real path isn't distinguishable from a random guess.
  app.post('/webhooks/brevo-inbound/:secret', async (request, reply) => {
    const { secret } = request.params as { secret: string };
    if (!config.brevoInboundWebhookSecret || secret !== config.brevoInboundWebhookSecret) {
      return reply.status(404).send();
    }
    const result = await processBrevoInboundPayload(
      request.body as import('./services/inbound-email.service.js').BrevoInboundPayload,
    );
    return reply.send(result);
  });

  // VSM scheduler — VPS crontab hits this per org config that has VSM enabled.
  // No JWT (cron isn't a logged-in user); secret lives in the path like the
  // inbound-email webhook, for the same reason (no custom-header caller).
  app.post('/internal/vsm/cron/:job/:secret', async (request, reply) => {
    const { job, secret } = request.params as { job: string; secret: string };
    if (!config.vsmCronSecret || secret !== config.vsmCronSecret) {
      return reply.status(404).send();
    }
    if (job !== 'morning' && job !== 'eod') {
      return reply.status(400).send({ error: 'job must be "morning" or "eod"' });
    }
    const enabledConfigs = await prisma.vsmConfig.findMany({ where: { enabled: true }, select: { organizationId: true } });
    const results = [];
    for (const cfg of enabledConfigs) {
      try {
        const run =
          job === 'morning'
            ? await getOrCreateMorningRun(cfg.organizationId, { fromCron: true })
            : await getOrCreateEodRun(cfg.organizationId, { fromCron: true });
        if (!run) {
          results.push({ organizationId: cfg.organizationId, skipped: 'not yet scheduled time' });
        } else {
          results.push({ organizationId: cfg.organizationId, runId: run.id, status: run.status });
        }
      } catch (err) {
        results.push({ organizationId: cfg.organizationId, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return reply.send({ job, ranFor: results.length, results });
  });

  // Public unsubscribe — no auth required, verified by HMAC token
  app.get('/unsubscribe', async (request, reply) => {
    const { p, t } = request.query as { p?: string; t?: string };
    if (!p || !t) return reply.status(400).send('Missing parameters.');
    const result = await handleUnsubscribe(p, t);
    const style = 'font-family:sans-serif;max-width:400px;margin:80px auto;text-align:center;';
    const icon = result.ok ? '✅' : '❌';
    return reply.type('text/html').send(
      `<div style="${style}"><p style="font-size:2rem">${icon}</p><p>${result.message}</p></div>`,
    );
  });

  app.setErrorHandler((error, request, reply) => {
    const err = error as Error & { statusCode?: number };
    if (err.message === 'AI_UNAVAILABLE') {
      return reply.status(503).send({
        error: 'AI_UNAVAILABLE',
        message: 'Set OPENAI_API_KEY to enable AI features',
      });
    }
    if (err instanceof EmailUnavailableError || err.message === 'EMAIL_UNAVAILABLE') {
      return reply.status(503).send({
        error: 'EMAIL_UNAVAILABLE',
        message: err.message,
      });
    }
    const status = err.statusCode ?? 500;
    app.log.error(error);
    // Keep the real message for triage in-process; the client still gets nothing.
    if (status >= 500) {
      recordServerError({
        method: request.method,
        url: request.url,
        statusCode: status,
        message: err.message || 'Unknown error',
      });
    }
    // Don't leak internal error details on 5xx; 4xx messages are intentional and
    // client-facing (validation, not-found, conflict, etc.).
    return reply.status(status).send({
      error: status >= 500 ? 'Internal Server Error' : err.message ?? 'Error',
    });
  });

  return app;
}
