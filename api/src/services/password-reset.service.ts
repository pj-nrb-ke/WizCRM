import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Creates a single-use token and returns the raw (unhashed) value to email to the user. */
export async function createPasswordResetToken(userId: string, ttlMs: number): Promise<string> {
  const rawToken = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return rawToken;
}

export const FORGOT_PASSWORD_TTL_MS = 60 * 60 * 1000; // 1 hour
export const ACCOUNT_ACTIVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
