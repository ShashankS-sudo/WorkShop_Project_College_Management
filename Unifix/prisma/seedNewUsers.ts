import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding cleaned user table: 1 Admin and 5 Students...');

  const campusPSTC = await prisma.campus.findUnique({
    where: { code: 'PSTC' },
  });

  if (!campusPSTC) {
    throw new Error('PSTC Campus not found');
  }

  const campusId = campusPSTC.id;

  // 1. The 1 Admin & 5 Students definitions
  const targetIdentities = [
    {
      campusId,
      email: 'admin@pstc.test',
      phone: '+15550100000',
      displayName: 'System Admin (Facilities Lead)',
      role: 'MANAGEMENT',
      externalId: 'ADM-001',
      department: 'Facilities & Maintenance',
    },
    {
      campusId,
      email: 'manager.sarah@pstc.test',
      phone: '+15550100003',
      displayName: 'System Admin (Sarah Jenkins)',
      role: 'MANAGEMENT',
      externalId: 'MGT-501',
      department: 'Facilities & Maintenance',
    },
    {
      campusId,
      email: 'student.alex@pstc.test',
      phone: '+15550100001',
      displayName: 'Alex Mercer (Student 1)',
      role: 'REPORTER',
      externalId: 'STU-001',
      department: 'Computer Science',
    },
    {
      campusId,
      email: 'student2@pstc.test',
      phone: '+15550100002',
      displayName: 'Emma Watson (Student 2)',
      role: 'REPORTER',
      externalId: 'STU-002',
      department: 'Electrical Engineering',
    },
    {
      campusId,
      email: 'student3@pstc.test',
      phone: '+15550100003',
      displayName: 'Liam Chen (Student 3)',
      role: 'REPORTER',
      externalId: 'STU-003',
      department: 'Mechanical Engineering',
    },
    {
      campusId,
      email: 'student4@pstc.test',
      phone: '+15550100004',
      displayName: 'Sophia Rodriguez (Student 4)',
      role: 'REPORTER',
      externalId: 'STU-004',
      department: 'Civil Engineering',
    },
    {
      campusId,
      email: 'student5@pstc.test',
      phone: '+15550100005',
      displayName: 'Noah Kim (Student 5)',
      role: 'REPORTER',
      externalId: 'STU-005',
      department: 'Biomedical Sciences',
    },
  ];

  const allowedEmails = targetIdentities.map((t) => t.email);

  // Deactivate any old confusing test identities for PSTC
  await prisma.campusAuthorizedIdentity.updateMany({
    where: {
      campusId,
      email: { notIn: allowedEmails },
    },
    data: { isActive: false },
  });

  // Upsert the authorized identities
  for (const idn of targetIdentities) {
    const existing = await prisma.campusAuthorizedIdentity.findFirst({
      where: { campusId: idn.campusId, email: idn.email },
    });
    if (existing) {
      await prisma.campusAuthorizedIdentity.update({
        where: { id: existing.id },
        data: {
          displayName: idn.displayName,
          role: idn.role as any,
          phone: idn.phone,
          department: idn.department,
          externalId: idn.externalId,
          isActive: true,
        },
      });
    } else {
      await prisma.campusAuthorizedIdentity.create({
        data: {
          campusId: idn.campusId,
          email: idn.email,
          phone: idn.phone,
          displayName: idn.displayName,
          role: idn.role as any,
          externalId: idn.externalId,
          department: idn.department,
          isActive: true,
        },
      });
    }
  }

  // Safe user upsert avoiding unique collision on phone
  async function ensureUser(email: string, phone: string, firstName: string, lastName: string, role: 'MANAGEMENT' | 'REPORTER') {
    // Clear phone from other records to satisfy unique index
    await prisma.user.updateMany({
      where: { phone, email: { not: email } },
      data: { phone: null },
    });

    let user = await prisma.user.findFirst({
      where: { email },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          phone,
          firstName,
          lastName,
          isActive: true,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          phone,
          firstName,
          lastName,
          isActive: true,
          isAnonymous: false,
          emailVerified: new Date(),
          phoneVerified: new Date(),
        },
      });
    }

    await prisma.campusMembership.upsert({
      where: { userId_campusId: { userId: user.id, campusId } },
      update: { role, isActive: true },
      create: {
        userId: user.id,
        campusId,
        role,
        isActive: true,
      },
    });

    return user;
  }

  // 1 Admin
  const adminUser = await ensureUser('admin@pstc.test', '+15550100000', 'System', 'Admin', 'MANAGEMENT');
  await ensureUser('manager.sarah@pstc.test', '+15550100099', 'Sarah', 'Jenkins', 'MANAGEMENT');

  // 5 Students
  await ensureUser('student.alex@pstc.test', '+15550100001', 'Alex', 'Mercer', 'REPORTER');
  await ensureUser('student2@pstc.test', '+15550100002', 'Emma', 'Watson', 'REPORTER');
  await ensureUser('student3@pstc.test', '+15550100003', 'Liam', 'Chen', 'REPORTER');
  await ensureUser('student4@pstc.test', '+15550100004', 'Sophia', 'Rodriguez', 'REPORTER');
  await ensureUser('student5@pstc.test', '+15550100005', 'Noah', 'Kim', 'REPORTER');

  // 3. Ensure sample tickets have an image attachment for the admin to inspect validity
  const sampleTicket = await prisma.ticket.findFirst({
    where: { campusId },
    include: { attachments: true },
  });

  if (sampleTicket && sampleTicket.attachments.length === 0) {
    await prisma.attachment.create({
      data: {
        ticketId: sampleTicket.id,
        userId: adminUser.id,
        filename: 'fountain_leak_evidence.jpg',
        filepath: 'tickets/sample_evidence.jpg',
        mimeType: 'image/jpeg',
        size: 245600,
        isApproved: true,
        uploadedBy: adminUser.id,
      },
    });
    console.log(`📸 Attached sample demonstration image to Ticket #${sampleTicket.id.slice(0, 8)}`);
  }

  console.log('🎉 Successfully configured 1 Admin and 5 Students in live database!');
}

main()
  .catch((e) => {
    console.error('Error seeding users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
