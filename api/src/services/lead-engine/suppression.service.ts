import { prisma } from '../../lib/prisma.js';

export async function isSuppressed(
  organizationId: string,
  companyName: string,
  website?: string,
): Promise<boolean> {
  const domain = website ? extractDomain(website) : null;

  const entry = await prisma.suppressionList.findFirst({
    where: {
      organizationId,
      OR: [
        { companyName: { equals: companyName, mode: 'insensitive' } },
        ...(domain ? [{ domain }] : []),
      ],
    },
  });

  return Boolean(entry);
}

export async function addSuppression(
  organizationId: string,
  addedById: string,
  data: { companyName?: string; domain?: string; email?: string; reason?: string },
) {
  return prisma.suppressionList.create({
    data: { organizationId, addedById, ...data },
  });
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^www\./, '').split('/')[0];
  }
}
