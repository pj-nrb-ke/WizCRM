import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedDemoData } from './seed-demo.js';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'WIZAG Internal',
    },
  });

  const passwordHash = await bcrypt.hash('wizcrm123', 12);

  const fieldTeam = await prisma.team.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: 'Field Sales',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Field Sales',
    },
  });

  const insideTeam = await prisma.team.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: 'Inside Sales',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Inside Sales',
    },
  });

  await prisma.user.upsert({
    where: { email: 'rep@wizag.local' },
    update: {
      passwordHash,
      name: 'Sales Rep',
      role: UserRole.SALES,
      teamId: fieldTeam.id,
    },
    create: {
      email: 'rep@wizag.local',
      passwordHash,
      name: 'Sales Rep',
      role: UserRole.SALES,
      organizationId: org.id,
      teamId: fieldTeam.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'rep2@wizag.local' },
    update: {
      passwordHash,
      name: 'Jordan Lee',
      role: UserRole.SALES,
      teamId: insideTeam.id,
    },
    create: {
      email: 'rep2@wizag.local',
      passwordHash,
      name: 'Jordan Lee',
      role: UserRole.SALES,
      organizationId: org.id,
      teamId: insideTeam.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager@wizag.local' },
    update: { passwordHash, name: 'Sales Manager', role: UserRole.MANAGER, teamId: null },
    create: {
      email: 'manager@wizag.local',
      passwordHash,
      name: 'Sales Manager',
      role: UserRole.MANAGER,
      organizationId: org.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@wizag.local' },
    update: { passwordHash, name: 'WizCRM Admin', role: UserRole.ADMIN, teamId: null },
    create: {
      email: 'admin@wizag.local',
      passwordHash,
      name: 'WizCRM Admin',
      role: UserRole.ADMIN,
      organizationId: org.id,
    },
  });

  await seedDemoData(prisma, org.id);

  console.log('Seed complete:');
  console.log('  rep@wizag.local / rep2@wizag.local / manager@wizag.local / admin@wizag.local');
  console.log('  password: wizcrm123');
  console.log('  Teams: Field Sales, Inside Sales');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
