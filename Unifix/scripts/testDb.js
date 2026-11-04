require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.$connect()
  .then(() => {
    console.log('✅ Connected to database successfully!');
    return p.campus.count();
  })
  .then((count) => {
    console.log(`Found ${count} campuses.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Connection error:', e);
    process.exit(1);
  });
