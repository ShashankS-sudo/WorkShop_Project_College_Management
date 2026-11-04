import 'dotenv/config';
import http from 'http';
import { app } from './app';
import { getConfig } from '@unifix/shared-config';
import prisma from './lib/prisma';
import { escalationScheduler } from './lib/scheduler';
import { initSocketServer, getIO } from './lib/socket';

const config = getConfig();
const port = config.port || 3000;

// Connect to database and start server
prisma
  .$connect()
  .then(() => {
    console.log('✅ PostgreSQL database connected successfully');

    // Start background automated SLA escalation worker
    escalationScheduler.start();

    // Create HTTP server wrapping Express application
    const httpServer = http.createServer(app);

    // Initialize Socket.io real-time server
    initSocketServer(httpServer);

    httpServer.listen(port, () => {
      console.log(`🚀 Unifix API Server listening on port ${port} (http://localhost:${port}/api/v1)`);
      console.log(`⚡ Real-time WebSocket server active on port ${port}`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
      escalationScheduler.stop();

      const io = getIO();
      if (io) {
        io.close();
      }

      httpServer.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Database disconnected and HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })
  .catch((err) => {
    console.error('❌ Database connection failed', err);
    process.exit(1);
  });

process.on('uncaughtException', (err: Error) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('❌ Unhandled Rejection:', reason);
});
