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
import { integrationRoutes } from './routes/integrations.js';
import { quotationRoutes } from './routes/quotations.js';
import { leadThreadRoutes } from './routes/lead-thread.js';
import { reminderRoutes } from './routes/reminders.js';
import { leadEngineRoutes, handleUnsubscribe } from './routes/lead-engine.js';
import { contactFinderRoutes } from './routes/contact-finder.js';
import { africasTalkingVoiceRoutes } from './routes/africastalking-voice.js';
import { handleBrevoEvent } from './services/lead-engine/webhook.service.js';
import { EmailUnavailableError } from './services/brevo-mail.js';

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
  await app.register(taskRoutes, { prefix: '/tasks' });
  await app.register(aiRoutes, { prefix: '/ai' });
  await app.register(teamRoutes, { prefix: '/teams' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(reportRoutes, { prefix: '/reports' });
  await app.register(emailRoutes, { prefix: '/email' });
  await app.register(opportunityRoutes, { prefix: '/opportunities' });
  await app.register(calendarRoutes, { prefix: '/calendar' });
  await app.register(reminderRoutes, { prefix: '/reminders' });
  await app.register(integrationRoutes, { prefix: '/integrations' });
  await app.register(quotationRoutes, { prefix: '/quotations' });
  await app.register(documentRoutes, { prefix: '/documents' });
  await app.register(leadEngineRoutes, { prefix: '/leadengine' });
  await app.register(contactFinderRoutes, { prefix: '/contacts/finder' });

  // Africa's Talking Voice IVR (AI BDR spike) — public, AT posts urlencoded here
  await app.register(africasTalkingVoiceRoutes);

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

  app.setErrorHandler((error, _request, reply) => {
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
    // Don't leak internal error details on 5xx; 4xx messages are intentional and
    // client-facing (validation, not-found, conflict, etc.).
    return reply.status(status).send({
      error: status >= 500 ? 'Internal Server Error' : err.message ?? 'Error',
    });
  });

  return app;
}
