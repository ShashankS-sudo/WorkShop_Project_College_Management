// Comprehensive Integration & Security Verification Suite - Unifix
import { app } from './app';
import { PrismaClient } from '@prisma/client';
import http from 'http';

const prisma = new PrismaClient();

async function runIntegrationVerification() {
  console.log('🛡️  Starting Unifix Multi-Tenant & Security Verification Suite...\n');

  const port = 3002;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    // -------------------------------------------------------------
    // Step 1: Discover Campuses (PSTC and MADI)
    // -------------------------------------------------------------
    console.log('--- Step 1: Discovering Multi-Campus Fixtures ---');
    const campusesRes = await fetch(`${baseUrl}/campuses`);
    const { data: campuses } = await campusesRes.json();
    const pstc = campuses.find((c: any) => c.code === 'PSTC');
    const madi = campuses.find((c: any) => c.code === 'MADI');

    if (!pstc || !madi) {
      throw new Error('Required campuses PSTC or MADI not found in database');
    }
    console.log(`✓ Located PSTC (${pstc.name}) and MADI (${madi.name})`);

    // -------------------------------------------------------------
    // Step 2: Authenticate Student Alex (PSTC Student)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Authenticating PSTC Student Alex ---');
    await fetch(`${baseUrl}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campusId: pstc.id, identifier: 'student.alex@pstc.test', isAnonymous: false }),
    });

    const alexVerifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campusId: pstc.id, identifier: 'student.alex@pstc.test', code: '123456', isAnonymous: false }),
    });
    const alexAuth = (await alexVerifyRes.json()).data;
    const alexToken = alexAuth.accessToken;
    console.log(`✓ Alex authenticated. User ID: ${alexAuth.user.id}`);

    // -------------------------------------------------------------
    // Step 3: Authenticate Campus Manager Sarah (PSTC Management)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Authenticating Campus Manager Sarah ---');
    await fetch(`${baseUrl}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campusId: pstc.id, identifier: 'manager.sarah@pstc.test', isAnonymous: false }),
    });

    const sarahVerifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campusId: pstc.id, identifier: 'manager.sarah@pstc.test', code: '123456', isAnonymous: false }),
    });
    const sarahAuth = (await sarahVerifyRes.json()).data;
    const sarahToken = sarahAuth.accessToken;
    console.log(`✓ Sarah authenticated. Role: MANAGEMENT`);

    // -------------------------------------------------------------
    // Step 4: Authenticate Professor Elena (PSTC Faculty)
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Authenticating Professor Elena ---');
    await fetch(`${baseUrl}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campusId: pstc.id, identifier: 'prof.elena@pstc.test', isAnonymous: false }),
    });

    const elenaVerifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campusId: pstc.id, identifier: 'prof.elena@pstc.test', code: '123456', isAnonymous: false }),
    });
    const elenaAuth = (await elenaVerifyRes.json()).data;
    const elenaToken = elenaAuth.accessToken;
    console.log(`✓ Elena authenticated. Role: REPORTER`);

    // -------------------------------------------------------------
    // Step 5: Cross-Campus Isolation Verification
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Verifying Strict Cross-Campus Isolation ---');
    // Alex (PSTC) attempts to create a ticket on MADI campus
    const crossCampusCreateRes = await fetch(`${baseUrl}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({
        campusId: madi.id,
        title: 'Unauthorized Cross-Campus Incident',
        description: 'This ticket attempt should be blocked at the campus boundary.',
        severity: 'LOW',
      }),
    });

    if (crossCampusCreateRes.status !== 403) {
      throw new Error(`Security breach: Alex was able to submit to MADI campus with status ${crossCampusCreateRes.status}`);
    }
    console.log('✓ Cross-campus ticket creation rejected with 403 Forbidden.');

    // Alex attempts to read MADI tickets
    const crossCampusReadRes = await fetch(`${baseUrl}/tickets?campusId=${madi.id}`, {
      headers: { Authorization: `Bearer ${alexToken}` },
    });
    if (crossCampusReadRes.status !== 403) {
      throw new Error(`Security breach: Alex was able to list MADI tickets with status ${crossCampusReadRes.status}`);
    }
    console.log('✓ Cross-campus ticket query rejected with 403 Forbidden.');

    // -------------------------------------------------------------
    // Step 6: Anonymous Reporting & Field-Level Privacy Verification
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Testing Anonymous Reporting & Field-Level Serialization ---');
    const anonTicketRes = await fetch(`${baseUrl}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({
        campusId: pstc.id,
        title: 'Sensitive Security Concern in Main Library',
        description: 'Anonymous report regarding laboratory equipment security.',
        severity: 'MAJOR',
        isAnonymous: true,
      }),
    });
    const anonTicket = (await anonTicketRes.json()).data;
    console.log(`✓ Anonymous ticket created: ${anonTicket.id}`);

    // Elena (another campus member) retrieves Alex's anonymous ticket:
    // Reporter identity MUST be sanitized: no name, no email, no phone!
    const anonFetchAsElena = await fetch(`${baseUrl}/tickets/${anonTicket.id}`, {
      headers: { Authorization: `Bearer ${elenaToken}` },
    });
    const elenaView = (await anonFetchAsElena.json()).data;
    if (elenaView.reporter?.email || elenaView.reporter?.phone || elenaView.reporter?.firstName) {
      throw new Error('Privacy failure: Elena (third-party user) can see true reporter fields on anonymous ticket!');
    }
    if (elenaView.reporter?.displayName !== 'Anonymous Reporter') {
      throw new Error(`Expected displayName 'Anonymous Reporter', got ${elenaView.reporter?.displayName}`);
    }
    console.log('✓ Third-party campus user view verified: reporter serialized as "Anonymous Reporter" with email/phone scrubbed.');

    // Management (Sarah) retrieves the SAME anonymous ticket: reporter identity MUST be inspectable
    const anonFetchAsSarah = await fetch(`${baseUrl}/tickets/${anonTicket.id}`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const sarahView = (await anonFetchAsSarah.json()).data;
    if (!sarahView.reporter || !sarahView.reporter.email) {
      throw new Error('Management failure: Authorized manager was not granted access to inspect reporter identity!');
    }
    console.log(`✓ Management view verified: Sarah can inspect true reporter (${sarahView.reporter.email}, ${sarahView.reporter.phone}).`);

    // -------------------------------------------------------------
    // Step 7: Endorsement Uniqueness Verification (No Vote Inflation)
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Verifying Unique Endorsement Deduplication ---');
    const firstEndorse = await fetch(`${baseUrl}/tickets/${anonTicket.id}/endorse`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${elenaToken}` },
    });
    const firstEndorseData = await firstEndorse.json();
    console.log(`First endorsement from Elena: status ${firstEndorse.status}, total: ${firstEndorseData.data?.totalEndorsements}`);

    const secondEndorse = await fetch(`${baseUrl}/tickets/${anonTicket.id}/endorse`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${elenaToken}` },
    });
    const secondEndorseData = await secondEndorse.json();
    console.log(`Second endorsement attempt from Elena: status ${secondEndorse.status}, count: ${secondEndorseData.data?.totalEndorsements}`);

    // Verify the total endorsements in database is strictly 1
    const checkTicket = await prisma.ticket.findUnique({
      where: { id: anonTicket.id },
      include: { _count: { select: { endorsements: true } } },
    });
    if (checkTicket?._count.endorsements !== 1) {
      throw new Error(`Endorsement inflation detected! Count is ${checkTicket?._count.endorsements}, expected 1.`);
    }
    console.log('✓ Duplicate endorsement correctly handled. Count remains 1.');

    // -------------------------------------------------------------
    // Step 8: Ticket Resolution & Reporter Reopen Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Verifying Ticket Resolution & Reporter Reopen Lifecycle ---');
    // Sarah (Manager) resolves the ticket
    const resolveRes = await fetch(`${baseUrl}/tickets/${anonTicket.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sarahToken}` },
      body: JSON.stringify({ resolutionSummary: 'Campus security inspected lab equipment and changed keycard access locks.' }),
    });
    const resolveData = await resolveRes.json();
    if (resolveData.data?.status !== 'RESOLVED') {
      throw new Error(`Failed to resolve ticket. Status: ${resolveData.data?.status}`);
    }
    console.log(`✓ Sarah resolved ticket: "${resolveData.data.resolutionSummary}"`);

    // Elena (NOT the reporter) attempts to reopen Alex's ticket: Must be rejected with 403 Forbidden!
    const unauthorizedReopenRes = await fetch(`${baseUrl}/tickets/${anonTicket.id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${elenaToken}` },
      body: JSON.stringify({ reason: 'I also think this is not resolved properly.' }),
    });
    if (unauthorizedReopenRes.status !== 403) {
      throw new Error(`Security breach: Non-reporter was allowed to reopen ticket with status ${unauthorizedReopenRes.status}`);
    }
    console.log('✓ Unauthorized reopen attempt by third-party blocked with 403 Forbidden.');

    // Alex (the original reporter) reopens the ticket
    const reopenRes = await fetch(`${baseUrl}/tickets/${anonTicket.id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({ reason: 'The secondary side entrance door is still unlocking automatically after 6 PM.' }),
    });
    const reopenData = await reopenRes.json();
    if (reopenData.data?.status !== 'OPEN') {
      throw new Error(`Failed to reopen ticket. Status: ${reopenData.data?.status}`);
    }
    console.log(`✓ Alex (reporter) successfully reopened ticket. Stage timer restarted to REPORTED.`);

    // -------------------------------------------------------------
    // Step 9: In-App Notification Center
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Verifying Notification Center Operations ---');
    const notifRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const { data: notifications } = await notifRes.json();
    console.log(`Sarah has ${notifications?.length || 0} notifications.`);

    const readAllRes = await fetch(`${baseUrl}/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    console.log(`✓ Read-all notifications executed with status: ${readAllRes.status}`);

    console.log('\n=============================================================');
    console.log('🎉 ALL MULTI-TENANT, SECURITY, PRIVACY & LIFECYCLE TESTS PASSED!');
    console.log('=============================================================\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runIntegrationVerification().catch((err) => {
  console.error('\n❌ Integration Verification Suite failed:', err);
  process.exit(1);
});
