require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const identities = await prisma.campusAuthorizedIdentity.findMany({
    where: { isActive: true },
    select: {
      email: true,
      displayName: true,
      role: true,
      department: true,
    },
    orderBy: { role: 'asc' },
  });

  console.log('\n--- ACTIVE CAMPUS AUTHORIZED IDENTITIES IN SUPABASE ---');
  console.table(identities);

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          'admin@pstc.test',
          'student.alex@pstc.test',
          'student2@pstc.test',
          'student3@pstc.test',
          'student4@pstc.test',
          'student5@pstc.test',
        ],
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  });

  console.log('\n--- CONFIRMED USER PROFILES IN SUPABASE ---');
  console.table(users);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
