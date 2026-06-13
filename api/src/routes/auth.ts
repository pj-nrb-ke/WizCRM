import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { loginSchema } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrganizationEntitlements } from '../services/entitlements.service.js';
import { requestGdprExport } from '../services/erp-sync.service.js';

// A valid bcrypt hash (of a random string) used as a constant-time decoy when
// the email doesn't match any user, to equalize login response timing.
const DUMMY_BCRYPT_HASH = '$2b$12$nYbnqQyj4e.YyOUUb.ID7e5VroZs6PAT4.kK7uJQyCFD6hHnrhkY.';

// Temporary account lockout after repeated failures (defence-in-depth alongside
// the per-IP rate limit). The window is short and auto-expiring so it can't be
// used to permanently lock a victim out (DoS).
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', {
    // Throttle credential brute-forcing: 10 attempts/min/IP in production.
    // Relaxed outside production so integration tests / local dev aren't throttled.
    config: { rateLimit: { max: config.isProduction ? 10 : 1000, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid credentials payload' });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    const now = new Date();

    // Reject early if the account is in an active lockout window.
    if (user?.lockoutUntil && user.lockoutUntil > now) {
      return reply.status(429).send({
        error: 'Account temporarily locked after repeated failed attempts. Try again later.',
      });
    }

    // Always run a bcrypt comparison — even when the user doesn't exist — so the
    // response time can't be used to enumerate valid accounts (user enumeration).
    const hash = user?.passwordHash ?? DUMMY_BCRYPT_HASH;
    const passwordOk = await bcrypt.compare(parsed.data.password, hash);
    if (!user || !passwordOk) {
      if (user) {
        const nextCount = user.failedLoginCount + 1;
        const locked = nextCount >= MAX_FAILED_ATTEMPTS;
        await prisma.user.update({
          where: { id: user.id },
          // On lockout, reset the counter and stamp the window; otherwise just bump.
          data: locked
            ? { failedLoginCount: 0, lockoutUntil: new Date(now.getTime() + LOCKOUT_MS) }
            : { failedLoginCount: nextCount },
        });
      }
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    // Successful login — clear any accumulated failure state.
    if (user.failedLoginCount > 0 || user.lockoutUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockoutUntil: null },
      });
    }

    const token = await reply.jwtSign({
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    });

    const entitlements = await getOrganizationEntitlements(user.organizationId);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
      entitlements,
    };
  });

  app.get('/me', { onRequest: [app.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });
    if (!user) return { user: null };
    const entitlements = await getOrganizationEntitlements(user.organizationId);
    return { user, entitlements };
  });

  app.post('/gdpr-export-request', { onRequest: [app.authenticate] }, async (request) => {
    return requestGdprExport(request.user.organizationId);
  });
};
