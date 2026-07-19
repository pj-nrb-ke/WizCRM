import type { FastifyPluginAsync } from 'fastify';
import {
  createCommissionPayoutSchema,
  createCustomerPaymentSchema,
  updateOrgCommissionSettingsSchema,
  updateUserCommissionSettingsSchema,
} from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings, mergeOrgSettings } from '../services/org-settings.service.js';
import {
  createCommissionPayout,
  createCustomerPayment,
  getMyPendingCommission,
  getOpportunityCommissionView,
  getOrgCommissionLiability,
  listCommissionPayouts,
  listCustomerPayments,
} from '../services/commission.service.js';

function isManagerRole(role: string) {
  return role === 'MANAGER' || role === 'ADMIN';
}

export const commissionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // ─── Settings (Manager+) ──────────────────────────────────────────────────

  app.get('/commission/settings', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) return reply.status(403).send({ error: 'Managers only' });
    const settings = await getOrgSettings(organizationId);
    const users = await prisma.user.findMany({
      where: { organizationId, isVirtual: false },
      select: { id: true, name: true, email: true, role: true, isActive: true, commissionEnabled: true, commissionRatePct: true },
      orderBy: { name: 'asc' },
    });
    return {
      commissionEnabled: settings.commissionEnabled ?? true,
      commissionDefaultRatePct: settings.commissionDefaultRatePct ?? 0,
      users,
    };
  });

  app.patch('/commission/settings', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) return reply.status(403).send({ error: 'Managers only' });
    const parsed = updateOrgCommissionSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const settings = await mergeOrgSettings(organizationId, parsed.data);
    return {
      commissionEnabled: settings.commissionEnabled ?? true,
      commissionDefaultRatePct: settings.commissionDefaultRatePct ?? 0,
    };
  });

  app.patch('/commission/settings/users/:userId', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) return reply.status(403).send({ error: 'Managers only' });
    const { userId } = request.params as { userId: string };
    const parsed = updateUserCommissionSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const target = await prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!target) return reply.status(404).send({ error: 'User not found' });
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        commissionEnabled: parsed.data.commissionEnabled,
        commissionRatePct: parsed.data.commissionRatePct === undefined ? undefined : parsed.data.commissionRatePct,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, commissionEnabled: true, commissionRatePct: true },
    });
    return { user };
  });

  // ─── Salesperson dashboard number ─────────────────────────────────────────

  app.get('/commission/my-pending', async (request) => {
    const { organizationId, sub: userId } = request.user;
    return getMyPendingCommission(userId, organizationId);
  });

  // ─── Org liability (Manager+) ─────────────────────────────────────────────

  app.get('/commission/liability', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) return reply.status(403).send({ error: 'Managers only' });
    return getOrgCommissionLiability(organizationId);
  });

  // ─── Per-opportunity view + payments/payouts (owner + Manager+) ──────────

  async function assertMoneyView(organizationId: string, opportunityId: string, userId: string, role: string) {
    const opp = await prisma.salesOpportunity.findFirst({ where: { id: opportunityId, organizationId } });
    if (!opp) return { ok: false as const, status: 404, error: 'Opportunity not found' };
    if (opp.ownerId !== userId && !isManagerRole(role)) {
      return { ok: false as const, status: 403, error: 'Not your opportunity' };
    }
    return { ok: true as const };
  }

  app.get('/opportunities/:id/commission', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const guard = await assertMoneyView(organizationId, id, userId, role);
    if (!guard.ok) return reply.status(guard.status).send({ error: guard.error });
    const view = await getOpportunityCommissionView(id, organizationId);
    return { commission: view };
  });

  app.get('/opportunities/:id/customer-payments', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const guard = await assertMoneyView(organizationId, id, userId, role);
    if (!guard.ok) return reply.status(guard.status).send({ error: guard.error });
    const payments = await listCustomerPayments(id, organizationId);
    return { payments };
  });

  app.post('/opportunities/:id/customer-payments', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    if (!isManagerRole(role)) return reply.status(403).send({ error: 'Managers only' });
    const { id } = request.params as { id: string };
    const parsed = createCustomerPaymentSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const payment = await createCustomerPayment(id, organizationId, userId, parsed.data);
    if (!payment) return reply.status(404).send({ error: 'Opportunity not found' });
    return reply.status(201).send({ payment });
  });

  app.get('/opportunities/:id/payouts', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const guard = await assertMoneyView(organizationId, id, userId, role);
    if (!guard.ok) return reply.status(guard.status).send({ error: guard.error });
    const payouts = await listCommissionPayouts(id, organizationId);
    return { payouts };
  });

  app.post('/opportunities/:id/payouts', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    if (!isManagerRole(role)) return reply.status(403).send({ error: 'Managers only' });
    const { id } = request.params as { id: string };
    const parsed = createCommissionPayoutSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const result = await createCommissionPayout(id, organizationId, userId, parsed.data);
    if (!result) return reply.status(404).send({ error: 'Opportunity not found' });
    if ('error' in result) {
      if (result.error === 'COMMISSION_HIDDEN') {
        return reply.status(400).send({ error: 'Commission is currently disabled for this opportunity' });
      }
      return reply
        .status(400)
        .send({ error: `Payout exceeds what's currently collectible (${result.pendingPayout})` });
    }
    return reply.status(201).send({ payout: result.payout });
  });
};
