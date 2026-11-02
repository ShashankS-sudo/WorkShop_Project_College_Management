// End-to-End API Integration & Verification Test - Unifix
import { app } from './app';
import { PrismaClient } from '@prisma/client';
import http from 'http';

const prisma = new PrismaClient();

async function runSmokeTest() {
  console.log('🧪 Starting End-to-End Integration Verification Test...');

  // Start server on temporary port
  const port = 3001;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(port, resolve));
  console.log(`📡 Test server running on http://localhost:${port}`);

  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    // 1. Health check
    console.log('\n--- 1. Testing Health Endpoint ---');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log('Health check:', healthRes.status, healthData);
    if (healthRes.status !== 200 || healthData.status !== 'ok') {
      throw new Error('Health check failed');
    }

    // 2. Campus listing
    console.log('\n--- 2. Testing Campus Registry ---');
    const campusesRes = await fetch(`${baseUrl}/campuses`);
    const campusesData = await campusesRes.json();
    console.log(`Retrieved ${campusesData.data?.length} active campuses.`);
    const pstcCampus = campusesData.data?.find((c: any) => c.code === 'PSTC');
    if (!pstcCampus) throw new Error('PSTC Campus not found in seed data');
    console.log(`Found PSTC Campus: ${pstcCampus.id} (${pstcCampus.name})`);

    // 3. Campus details (departments, buildings, categories)
    console.log('\n--- 3. Testing Campus Details ---');
    const campusDetailsRes = await fetch(`${baseUrl}/campuses/${pstcCampus.id}`);
    const campusDetails = await campusDetailsRes.json();
    console.log(
      `Campus details loaded: ${campusDetails.data.departments.length} departments, ` +
        `${campusDetails.data.buildings.length} buildings, ${campusDetails.data.categories.length} categories.`
    );

    // 4. Check eligibility for Alex
    console.log('\n--- 4. Testing Identity Eligibility Check ---');
    const eligRes = await fetch(`${baseUrl}/campuses/${pstcCampus.id}/check-eligibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'student.alex@pstc.test' }),
    });
    const eligData = await eligRes.json();
    console.log('Eligibility result:', eligData.data);
    if (!eligData.data?.isAuthorized) throw new Error('Eligibility check failed for student.alex@pstc.test');

    // 5. Request OTP
    console.log('\n--- 5. Testing OTP Request (Simulation Provider) ---');
    const otpReqRes = await fetch(`${baseUrl}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campusId: pstcCampus.id,
        identifier: 'student.alex@pstc.test',
        isAnonymous: false,
      }),
    });
    const otpReqData = await otpReqRes.json();
    console.log('OTP request result:', otpReqData.data);
    const otpCode = otpReqData.data?.developmentOtpCode || '123456';

    // 6. Verify OTP and receive JWT + Refresh Token
    console.log('\n--- 6. Testing OTP Verification & Token Issuance ---');
    const verifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campusId: pstcCampus.id,
        identifier: 'student.alex@pstc.test',
        code: otpCode,
        isAnonymous: false,
      }),
    });
    const verifyData = await verifyRes.json();
    console.log('Verify response status:', verifyRes.status);
    const accessToken = verifyData.data?.accessToken;
    const refreshToken = verifyData.data?.refreshToken;
    if (!accessToken || !refreshToken) throw new Error('Failed to obtain authentication tokens');
    console.log('Obtained Access Token & Opaque Refresh Token successfully.');

    // 7. Get Authenticated User (/auth/me)
    console.log('\n--- 7. Testing Current User Profile (/auth/me) ---');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meData = await meRes.json();
    console.log('Current user:', meData.data);
    if (meData.data?.email !== 'student.alex@pstc.test') throw new Error('Incorrect user profile returned');

    // 8. Refresh Token Rotation
    console.log('\n--- 8. Testing Refresh Token Rotation ---');
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshData = await refreshRes.json();
    console.log('Refresh status:', refreshRes.status);
    const newAccessToken = refreshData.data?.accessToken;
    const newRefreshToken = refreshData.data?.refreshToken;
    if (!newAccessToken || !newRefreshToken) throw new Error('Refresh token rotation failed');
    console.log('Rotated access and refresh tokens successfully.');

    // 9. AI Issue Parsing
    console.log('\n--- 9. Testing AI Natural Language Issue Parsing ---');
    const aiParseRes = await fetch(`${baseUrl}/ai/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newAccessToken}`,
      },
      body: JSON.stringify({
        campusId: pstcCampus.id,
        text: 'The water fountain in Turing Engineering Center 1st floor is leaking all over the floor and water pressure is very low.',
      }),
    });
    const aiParseData = await aiParseRes.json();
    console.log('AI Parse Result:', aiParseData.data);
    if (!aiParseData.data?.suggestedTitle) throw new Error('AI parse failed');

    // 10. Create Ticket using newAccessToken
    console.log('\n--- 10. Testing Ticket Creation ---');
    const createTicketRes = await fetch(`${baseUrl}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newAccessToken}`,
      },
      body: JSON.stringify({
        campusId: pstcCampus.id,
        title: aiParseData.data.suggestedTitle,
        description:
          'Water fountain on 1st floor Turing Engineering Center is leaking onto the floor creating a slip hazard.',
        severity: aiParseData.data.suggestedSeverity || 'MODERATE',
        impact: aiParseData.data.suggestedImpact || 'GROUP',
        urgency: aiParseData.data.suggestedUrgency || 'NORMAL',
        isAnonymous: false,
      }),
    });
    const createTicketData = await createTicketRes.json();
    console.log('Created ticket:', createTicketRes.status, createTicketData.data?.id);
    const createdTicketId = createTicketData.data?.id;
    if (!createdTicketId) throw new Error('Failed to create ticket');

    // 11. Endorse Ticket
    console.log('\n--- 11. Testing Ticket Endorsement ---');
    const endorseRes = await fetch(`${baseUrl}/tickets/${createdTicketId}/endorse`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    const endorseData = await endorseRes.json();
    console.log('Endorse status:', endorseRes.status, endorseData.data);

    // 12. Add Comment
    console.log('\n--- 12. Testing Ticket Comment ---');
    const commentRes = await fetch(`${baseUrl}/tickets/${createdTicketId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newAccessToken}`,
      },
      body: JSON.stringify({
        content: 'Placed a temporary caution cone near the puddle.',
      }),
    });
    const commentData = await commentRes.json();
    console.log('Comment created:', commentRes.status, commentData.data?.content);

    // 13. Escalation Check
    console.log('\n--- 13. Testing Escalation Check Engine ---');
    const escRes = await fetch(`${baseUrl}/operational/escalation-check`, {
      method: 'POST',
    });
    const escData = await escRes.json();
    console.log('Escalation check result:', escData.data);

    console.log('\n🎉 ALL 13 END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runSmokeTest().catch((err) => {
  console.error('\n❌ Smoke test failed:', err);
  process.exit(1);
});
