import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

  const passwordHash = await bcrypt.hash('wizcrm123', 10);

  await prisma.user.upsert({
    where: { email: 'rep@wizag.local' },
    update: { passwordHash, name: 'Sales Rep', role: UserRole.SALES },
    create: {
      email: 'rep@wizag.local',
      passwordHash,
      name: 'Sales Rep',
      role: UserRole.SALES,
      organizationId: org.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager@wizag.local' },
    update: { passwordHash, name: 'Sales Manager', role: UserRole.MANAGER },
    create: {
      email: 'manager@wizag.local',
      passwordHash,
      name: 'Sales Manager',
      role: UserRole.MANAGER,
      organizationId: org.id,
    },
  });

  console.log('Seed complete: rep@wizag.local / manager@wizag.local (password: wizcrm123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
