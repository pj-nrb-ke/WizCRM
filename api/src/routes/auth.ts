import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import zxcvbn from 'zxcvbn';
import { config } from '../config.js';
import { loginSchema, resolvePermissions } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrganizationEntitlements } from '../services/entitlements.service.js';
import { requestGdprExport } from '../services/erp-sync.service.js';
import { sendPasswordResetEmail } from '../services/auth-email.service.js';
import { createPasswordResetToken, hashResetToken, FORGOT_PASSWORD_TTL_MS } from '../services/password-reset.service.js';
import { getOrgSettings } from '../services/org-settings.service.js';

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

    if (!user.isActive) {
      return reply.status(403).send({ error: 'This account has been deactivated. Contact your admin.' });
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

    const [entitlements, settings] = await Promise.all([
      getOrganizationEntitlements(user.organizationId),
      getOrgSettings(user.organizationId),
    ]);
    const permissions = resolvePermissions(user.role, settings.rolePermissions);

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
      permissions,
    };
  });

  app.get('/me', { onRequest: [app.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });
    if (!user) return { user: null };
    const [entitlements, settings] = await Promise.all([
      getOrganizationEntitlements(user.organizationId),
      getOrgSettings(user.organizationId),
    ]);
    const permissions = resolvePermissions(user.role, settings.rolePermissions);
    return { user, entitlements, permissions };
  });

  app.post('/change-password', { onRequest: [app.authenticate] }, async (request, reply) => {
    const body = (request.body ?? {}) as { currentPassword?: string; newPassword?: string };
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (newPassword.length < 12) {
      return reply.status(400).send({ error: 'New password must be at least 12 characters.' });
    }
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentOk) return reply.status(401).send({ error: 'Current password is incorrect.' });
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return reply.status(400).send({ error: 'New password must be different from your current one.' });
    }

    const strength = zxcvbn(newPassword, [user.email, user.name, 'wizcrm']);
    if (strength.score < 3) {
      return reply.status(400).send({
        error:
          strength.feedback.warning ||
          'Password is too weak or common. Use a longer, less predictable passphrase.',
        suggestions: strength.feedback.suggestions,
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginCount: 0, lockoutUntil: null },
    });
    return { ok: true };
  });

  app.post('/gdpr-export-request', { onRequest: [app.authenticate] }, async (request) => {
    return requestGdprExport(request.user.organizationId);
  });

  app.post('/forgot-password', {
    // Same throttling rationale as /login — this also does a DB lookup by email.
    config: { rateLimit: { max: config.isProduction ? 10 : 1000, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = (request.body ?? {}) as { email?: string };
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    // Always return the same generic response — don't leak whether the email exists.
    const genericReply = { ok: true, message: 'If that email has an account, a reset link is on its way.' };
    if (!email) return genericReply;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return genericReply;

    const rawToken = await createPasswordResetToken(user.id, FORGOT_PASSWORD_TTL_MS);
    sendPasswordResetEmail({ toEmail: user.email, toName: user.name, rawToken });
    return reply.send(genericReply);
  });

  app.post('/reset-password', {
    config: { rateLimit: { max: config.isProduction ? 10 : 1000, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = (request.body ?? {}) as { token?: string; newPassword?: string };
    const rawToken = typeof body.token === 'string' ? body.token : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!rawToken) return reply.status(400).send({ error: 'Missing reset token.' });
    if (newPassword.length < 12) {
      return reply.status(400).send({ error: 'New password must be at least 12 characters.' });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(rawToken) },
      include: { user: true },
    });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return reply.status(400).send({ error: 'This reset link is invalid or has expired.' });
    }

    const strength = zxcvbn(newPassword, [resetToken.user.email, resetToken.user.name, 'wizcrm']);
    if (strength.score < 3) {
      return reply.status(400).send({
        error:
          strength.feedback.warning ||
          'Password is too weak or common. Use a longer, less predictable passphrase.',
        suggestions: strength.feedback.suggestions,
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, failedLoginCount: 0, lockoutUntil: null },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  });
};
