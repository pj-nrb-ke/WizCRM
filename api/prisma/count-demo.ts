import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const orgId = '00000000-0000-4000-8000-000000000001';

async function main() {
  const [leads, sample, acts, cal, opps, tasks] = await Promise.all([
    prisma.lead.count({ where: { organizationId: orgId } }),
    prisma.lead.count({ where: { email: { endsWith: '@sample.wizcrm.app' } } }),
    prisma.activity.count({ where: { lead: { organizationId: orgId } } }),
    prisma.calendarEvent.count({ where: { organizationId: orgId } }),
    prisma.salesOpportunity.count({ where: { organizationId: orgId } }),
    prisma.task.count({ where: { organizationId: orgId } }),
  ]);
  console.log(JSON.stringify({ leads, sample, acts, cal, opps, tasks }, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
