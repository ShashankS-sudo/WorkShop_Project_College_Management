import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting development seed...');

  // 1. Create Campuses
  const campusPSTC = await prisma.campus.upsert({
    where: { code: 'PSTC' },
    update: {},
    create: {
      code: 'PSTC',
      name: 'Pacific Science & Tech Campus',
      address: '100 Innovation Way, San Francisco, CA',
      timezone: 'America/Los_Angeles',
      latitude: 37.7749,
      longitude: -122.4194,
      isActive: true,
    },
  });

  const campusMADI = await prisma.campus.upsert({
    where: { code: 'MADI' },
    update: {},
    create: {
      code: 'MADI',
      name: 'Metropolitan Arts & Design Institute',
      address: '450 Creative Ave, New York, NY',
      timezone: 'America/New_York',
      latitude: 40.7128,
      longitude: -74.006,
      isActive: true,
    },
  });

  const campusHVU = await prisma.campus.upsert({
    where: { code: 'HVU' },
    update: {},
    create: {
      code: 'HVU',
      name: 'Highland Valley University',
      address: '750 Alpine Road, Denver, CO',
      timezone: 'America/Denver',
      latitude: 39.7392,
      longitude: -104.9903,
      isActive: true,
    },
  });

  console.log('✅ Campuses seeded');

  // 2. Create Departments for PSTC
  const deptsPSTC = [
    { name: 'Facilities & Maintenance', code: 'FAC' },
    { name: 'Electrical & Power Systems', code: 'ELEC' },
    { name: 'HVAC & Climate Control', code: 'HVAC' },
    { name: 'Campus Safety & Security', code: 'SAFE' },
    { name: 'IT Infrastructure & Wi-Fi', code: 'IT' },
    { name: 'Custodial & Sanitation', code: 'CUST' },
  ];

  for (const dept of deptsPSTC) {
    await prisma.department.upsert({
      where: { campusId_name: { campusId: campusPSTC.id, name: dept.name } },
      update: {},
      create: {
        campusId: campusPSTC.id,
        name: dept.name,
        code: dept.code,
        isActive: true,
      },
    });
  }

  // 3. Create Buildings & Locations for PSTC
  const buildingsPSTC = [
    { name: 'Main Science Hall', code: 'MSH' },
    { name: 'Turing Engineering Center', code: 'TEC' },
    { name: 'North Residence Quad', code: 'NRQ' },
    { name: 'Central Campus Library', code: 'CCL' },
    { name: 'Student Commons & Dining', code: 'SCD' },
  ];

  const buildingRecords: Record<string, any> = {};
  for (const b of buildingsPSTC) {
    const rec = await prisma.building.upsert({
      where: { campusId_name: { campusId: campusPSTC.id, name: b.name } },
      update: {},
      create: {
        campusId: campusPSTC.id,
        name: b.name,
        code: b.code,
        isActive: true,
      },
    });
    buildingRecords[b.code] = rec;
  }

  // Locations
  const locations = [
    {
      campusId: campusPSTC.id,
      buildingId: buildingRecords['CCL'].id,
      name: '2nd Floor Corridor West',
      floor: '2',
      room: 'Corridor 2W',
      description: 'Main corridor outside reading room 204',
    },
    {
      campusId: campusPSTC.id,
      buildingId: buildingRecords['MSH'].id,
      name: 'Chemistry Lab 301',
      floor: '3',
      room: '301',
      description: 'Advanced organic synthesis lab',
    },
    {
      campusId: campusPSTC.id,
      buildingId: buildingRecords['NRQ'].id,
      name: 'Dorm Block B - Laundry Room',
      floor: 'Basement',
      room: 'B-04',
      description: 'Shared student laundry facility',
    },
    {
      campusId: campusPSTC.id,
      buildingId: buildingRecords['TEC'].id,
      name: 'Robotics Workshop',
      floor: '1',
      room: '110',
      description: 'Heavy machinery and testing area',
    },
  ];

  for (const loc of locations) {
    const existing = await prisma.location.findFirst({
      where: { campusId: loc.campusId, name: loc.name },
    });
    if (!existing) {
      await prisma.location.create({ data: loc });
    }
  }

  console.log('✅ Buildings & Locations seeded');

  // 4. Categories (global / campus-wide)
  const categories = [
    { name: 'Lighting & Electrical', icon: 'zap', defaultPriority: 'MEDIUM' },
    { name: 'Plumbing & Water', icon: 'droplet', defaultPriority: 'HIGH' },
    { name: 'HVAC & Temperature', icon: 'thermometer', defaultPriority: 'MEDIUM' },
    { name: 'Safety Hazard & Emergency', icon: 'alert-triangle', defaultPriority: 'CRITICAL' },
    { name: 'Network & Connectivity', icon: 'wifi', defaultPriority: 'MEDIUM' },
    { name: 'Doors, Locks & Access', icon: 'key', defaultPriority: 'HIGH' },
    { name: 'Custodial & Cleaning', icon: 'trash-2', defaultPriority: 'LOW' },
  ];

  for (const cat of categories) {
    const existing = await prisma.category.findFirst({
      where: { campusId: null, name: cat.name },
    });
    if (!existing) {
      await prisma.category.create({
        data: {
          name: cat.name,
          icon: cat.icon,
          defaultPriority: cat.defaultPriority,
          isActive: true,
        },
      });
    }
  }

  console.log('✅ Categories seeded');

  // 5. Authorized Identity Registry (fictional development seed)
  const identities = [
    // PSTC identities
    {
      campusId: campusPSTC.id,
      email: 'student.alex@pstc.test',
      phone: '+15550100001',
      displayName: 'Alex Mercer (Student)',
      role: 'REPORTER',
      externalId: 'STU-2024-001',
      department: 'Undergraduate Computer Science',
    },
    {
      campusId: campusPSTC.id,
      email: 'prof.elena@pstc.test',
      phone: '+15550100002',
      displayName: 'Dr. Elena Rostova (Faculty)',
      role: 'REPORTER',
      externalId: 'FAC-1044',
      department: 'Physics & Astronomy',
    },
    {
      campusId: campusPSTC.id,
      email: 'manager.sarah@pstc.test',
      phone: '+15550100003',
      displayName: 'Sarah Jenkins (Facilities Lead)',
      role: 'MANAGEMENT',
      externalId: 'MGT-501',
      department: 'Facilities & Maintenance',
    },
    {
      campusId: campusPSTC.id,
      email: 'tech.marcus@pstc.test',
      phone: '+15550100004',
      displayName: 'Marcus Vance (Senior Electrician)',
      role: 'MANAGEMENT',
      externalId: 'MGT-502',
      department: 'Electrical & Power Systems',
    },
    // Global supermanagement identity
    {
      campusId: campusPSTC.id,
      email: 'director.kiran@unifix.global',
      phone: '+15550100099',
      displayName: 'Kiran Patel (Global Operations Director)',
      role: 'SUPERMANAGEMENT',
      externalId: 'EXEC-001',
      department: 'Global Campus Operations',
    },
    // MADI identities
    {
      campusId: campusMADI.id,
      email: 'student.chloe@madi.test',
      phone: '+15550200001',
      displayName: 'Chloe Dubois (Design Student)',
      role: 'REPORTER',
      externalId: 'STU-MADI-442',
      department: 'Industrial Design',
    },
    {
      campusId: campusMADI.id,
      email: 'manager.david@madi.test',
      phone: '+15550200002',
      displayName: 'David Morales (Campus Ops Manager)',
      role: 'MANAGEMENT',
      externalId: 'MGT-MADI-101',
      department: 'Campus Operations',
    },
  ];

  for (const idn of identities) {
    const existing = await prisma.campusAuthorizedIdentity.findFirst({
      where: { campusId: idn.campusId, email: idn.email },
    });
    if (!existing) {
      await prisma.campusAuthorizedIdentity.create({
        data: {
          campusId: idn.campusId,
          email: idn.email,
          phone: idn.phone,
          displayName: idn.displayName,
          role: idn.role,
          externalId: idn.externalId,
          department: idn.department,
          isActive: true,
          metadata: { note: 'Development seed identity' },
        },
      });
    }
  }

  console.log('✅ Campus Authorized Identities seeded');

  // 6. Seed Users and Memberships
  // Facilities Manager Sarah
  const managerUser = await prisma.user.upsert({
    where: { email: 'manager.sarah@pstc.test' },
    update: {},
    create: {
      email: 'manager.sarah@pstc.test',
      phone: '+15550100003',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      isActive: true,
      isAnonymous: false,
      emailVerified: new Date(),
      phoneVerified: new Date(),
    },
  });

  await prisma.campusMembership.upsert({
    where: { userId_campusId: { userId: managerUser.id, campusId: campusPSTC.id } },
    update: {},
    create: {
      userId: managerUser.id,
      campusId: campusPSTC.id,
      role: 'MANAGEMENT',
      isActive: true,
    },
  });

  // Maintenance Tech Marcus
  const techUser = await prisma.user.upsert({
    where: { email: 'tech.marcus@pstc.test' },
    update: {},
    create: {
      email: 'tech.marcus@pstc.test',
      phone: '+15550100004',
      firstName: 'Marcus',
      lastName: 'Vance',
      isActive: true,
      isAnonymous: false,
      emailVerified: new Date(),
      phoneVerified: new Date(),
    },
  });

  await prisma.campusMembership.upsert({
    where: { userId_campusId: { userId: techUser.id, campusId: campusPSTC.id } },
    update: {},
    create: {
      userId: techUser.id,
      campusId: campusPSTC.id,
      role: 'MANAGEMENT',
      isActive: true,
    },
  });

  // Student Alex
  const studentUser = await prisma.user.upsert({
    where: { email: 'student.alex@pstc.test' },
    update: {},
    create: {
      email: 'student.alex@pstc.test',
      phone: '+15550100001',
      firstName: 'Alex',
      lastName: 'Mercer',
      isActive: true,
      isAnonymous: false,
      emailVerified: new Date(),
      phoneVerified: new Date(),
    },
  });

  await prisma.campusMembership.upsert({
    where: { userId_campusId: { userId: studentUser.id, campusId: campusPSTC.id } },
    update: {},
    create: {
      userId: studentUser.id,
      campusId: campusPSTC.id,
      role: 'REPORTER',
      isActive: true,
    },
  });

  // Supermanagement Kiran
  const superUser = await prisma.user.upsert({
    where: { email: 'director.kiran@unifix.global' },
    update: {},
    create: {
      email: 'director.kiran@unifix.global',
      phone: '+15550100099',
      firstName: 'Kiran',
      lastName: 'Patel',
      isActive: true,
      isAnonymous: false,
      emailVerified: new Date(),
      phoneVerified: new Date(),
    },
  });

  await prisma.campusMembership.upsert({
    where: { userId_campusId: { userId: superUser.id, campusId: campusPSTC.id } },
    update: {},
    create: {
      userId: superUser.id,
      campusId: campusPSTC.id,
      role: 'SUPERMANAGEMENT',
      isActive: true,
    },
  });

  await prisma.campusMembership.upsert({
    where: { userId_campusId: { userId: superUser.id, campusId: campusMADI.id } },
    update: {},
    create: {
      userId: superUser.id,
      campusId: campusMADI.id,
      role: 'SUPERMANAGEMENT',
      isActive: true,
    },
  });

  console.log('✅ Seed Users and Memberships created');

  // 7. Seed Sample Tickets
  const catLighting = await prisma.category.findFirst({ where: { name: 'Lighting & Electrical' } });
  const catPlumbing = await prisma.category.findFirst({ where: { name: 'Plumbing & Water' } });
  const locLibrary = await prisma.location.findFirst({ where: { name: '2nd Floor Corridor West' } });
  const locChemLab = await prisma.location.findFirst({ where: { name: 'Chemistry Lab 301' } });
  const deptElec = await prisma.department.findFirst({ where: { campusId: campusPSTC.id, code: 'ELEC' } });

  // Ticket 1: 2nd floor library lighting issue (active, acknowledged)
  const existingTicket1 = await prisma.ticket.findFirst({
    where: { title: 'Corridor lights flickering and dead on 2nd floor west' },
  });

  if (!existingTicket1) {
    const ticket1 = await prisma.ticket.create({
      data: {
        campusId: campusPSTC.id,
        reporterId: studentUser.id,
        assigneeId: techUser.id,
        departmentId: deptElec?.id,
        categoryId: catLighting?.id,
        locationId: locLibrary?.id,
        ticketType: 'ISSUE',
        title: 'Corridor lights flickering and dead on 2nd floor west',
        description: 'The overhead fluorescent and LED panel lights along the west corridor outside study room 204 are flickering violently and several fixtures have gone completely dark since yesterday afternoon.',
        locationText: 'Central Library, 2nd floor, outside room 204',
        severity: 'MODERATE',
        impact: 'GROUP',
        urgency: 'NORMAL',
        suggestedPriority: 'MEDIUM',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        isCritical: false,
        isAnonymous: false,
        currentStage: 'ACTIVE',
        stageStartTime: new Date(),
        stageDuration: 504,
        acknowledgedAt: new Date(Date.now() - 24 * 3600 * 1000),
        startedAt: new Date(Date.now() - 12 * 3600 * 1000),
        statusHistories: {
          create: [
            {
              status: 'OPEN',
              previousStatus: null,
              changedById: studentUser.id,
              notes: 'Ticket created by reporter',
            },
            {
              status: 'ACKNOWLEDGED',
              previousStatus: 'OPEN',
              changedById: managerUser.id,
              notes: 'Acknowledged and queued for electrical inspection',
            },
            {
              status: 'IN_PROGRESS',
              previousStatus: 'ACKNOWLEDGED',
              changedById: managerUser.id,
              notes: 'Assigned to senior electrician Marcus Vance',
            },
          ],
        },
        progressEvents: {
          create: [
            {
              eventType: 'ACKNOWLEDGEMENT',
              title: 'Triage Acknowledgement',
              details: 'Reviewed and scheduled ballast replacement',
              actorId: managerUser.id,
              resetsStageTimer: true,
            },
            {
              eventType: 'MAINTENANCE_ACTION',
              title: 'Parts Ordered',
              details: 'Replacement ballast and ballast bypass LED tubes dispatched from central store',
              actorId: techUser.id,
              resetsStageTimer: false,
            },
          ],
        },
        comments: {
          create: [
            {
              userId: managerUser.id,
              content: 'Electrician Marcus will inspect today at 2 PM.',
              isInternal: false,
              authorName: 'Sarah Jenkins (Facilities Lead)',
            },
          ],
        },
      },
    });

    console.log(`✅ Sample Ticket 1 created (${ticket1.id})`);
  }

  // Ticket 2: Chemistry Lab emergency drain backup (Critical, open)
  const existingTicket2 = await prisma.ticket.findFirst({
    where: { title: 'Emergency eyewash station slow drain and chemical odor' },
  });

  if (!existingTicket2) {
    const ticket2 = await prisma.ticket.create({
      data: {
        campusId: campusPSTC.id,
        reporterId: studentUser.id,
        categoryId: catPlumbing?.id,
        locationId: locChemLab?.id,
        ticketType: 'ISSUE',
        title: 'Emergency eyewash station slow drain and chemical odor',
        description: 'The basin drain beneath eyewash station #2 is draining very slowly and backing up into the spill containment tray with an organic solvent smell.',
        locationText: 'Main Science Hall, 3rd Floor, Room 301',
        severity: 'CRITICAL',
        impact: 'BUILDING',
        urgency: 'URGENT',
        suggestedPriority: 'CRITICAL',
        priority: 'CRITICAL',
        status: 'OPEN',
        isCritical: true,
        isAnonymous: true, // Anonymous report demo
        currentStage: 'REPORTED',
        stageStartTime: new Date(),
        stageDuration: 48, // Critical tickets have tighter timers
        statusHistories: {
          create: [
            {
              status: 'OPEN',
              previousStatus: null,
              changedById: studentUser.id,
              notes: 'Critical issue reported anonymously',
            },
          ],
        },
      },
    });

    console.log(`✅ Sample Ticket 2 created (${ticket2.id})`);
  }

  console.log('🎉 Development seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
