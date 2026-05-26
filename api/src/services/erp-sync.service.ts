import type { ErpSyncStatus } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrganizationEntitlements } from './entitlements.service.js';
import { getOrgSettings, mergeOrgSettings } from './org-settings.service.js';

export type ErpConnectorStatus = {
  enabled: boolean;
  connectorType: string;
  lastSyncAt: string | null;
  recentLogs: {
    id: string;
    action: string;
    status: ErpSyncStatus;
    message: string | null;
    createdAt: string;
    quotationId: string | null;
  }[];
};

export async function getErpConnectorStatus(organizationId: string): Promise<ErpConnectorStatus> {
  const settings = await getOrgSettings(organizationId);
  const entitlements = await getOrganizationEntitlements(organizationId);
  const logs = await prisma.erpSyncLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const lastSynced = await prisma.quotation.findFirst({
    where: { organizationId, erpSyncedAt: { not: null } },
    orderBy: { erpSyncedAt: 'desc' },
    select: { erpSyncedAt: true },
  });

  return {
    enabled: entitlements.features.erpSync,
    connectorType: settings.erpConnectorType ?? 'stub',
    lastSyncAt: lastSynced?.erpSyncedAt?.toISOString() ?? null,
    recentLogs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      status: l.status,
      message: l.message,
      createdAt: l.createdAt.toISOString(),
      quotationId: l.quotationId,
    })),
  };
}

/** Stub ERP push — records audit log and marks quotation synced (real connectors in ENT-*). */
export async function syncQuotationToErp(quotationId: string, organizationId: string) {
  const entitlements = await getOrganizationEntitlements(organizationId);
  if (!entitlements.features.erpSync) {
    const err = new Error('ERP sync is not enabled on your plan') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }

  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, organizationId },
  });
  if (!quotation) return null;
  if (quotation.status === 'DRAFT') {
    const err = new Error('Send the quotation before syncing to ERP') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  await prisma.quotation.update({
    where: { id: quotationId },
    data: { erpSyncStatus: 'PENDING', erpLastError: null },
  });

  await prisma.erpSyncLog.create({
    data: {
      organizationId,
      quotationId,
      action: 'QUOTATION_PUSH',
      status: 'PENDING',
      message: 'Queued for ERP',
    },
  });

  const settings = await getOrgSettings(organizationId);
  const connector = settings.erpConnectorType ?? 'stub';
  const erpReference = `${connector.toUpperCase()}-${quotation.referenceNumber}`;

  const updated = await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      erpSyncStatus: 'SYNCED',
      erpReference,
      erpSyncedAt: new Date(),
      erpLastError: null,
    },
    include: { owner: { select: { id: true, name: true } } },
  });

  await prisma.erpSyncLog.create({
    data: {
      organizationId,
      quotationId,
      action: 'QUOTATION_PUSH',
      status: 'SYNCED',
      message: `Stub sync OK → ${erpReference}`,
    },
  });

  return updated;
}

export async function requestGdprExport(organizationId: string) {
  const now = new Date();
  await mergeOrgSettings(organizationId, { gdprExportRequestedAt: now.toISOString() });
  return {
    requestedAt: now.toISOString(),
    message: 'Export request recorded. Your administrator will follow up.',
  };
}
