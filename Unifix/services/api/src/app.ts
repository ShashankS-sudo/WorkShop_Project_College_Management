import 'dotenv/config';
import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { getConfig } from '@unifix/shared-config';
import logger, { requestLogger, errorLogger } from './lib/logger';
import router from './routes';

// Initialize Express application
const app: Application = express();

// Load configuration
const config = getConfig();

// Core Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Serve uploaded files statically with cross-origin access
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Request logging
app.use(requestLogger);

// CORS configuration - Support Web Management Portal (5173), Mobile Expo Web (8081/19006), and localhost dev
const configuredOrigins = config.webOrigin ? [config.webOrigin] : [];
const devAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8081',
  ...configuredOrigins,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (mobile native, curl, postman, server-to-server)
      if (!origin) return callback(null, true);

      if (
        config.nodeEnv !== 'production' ||
        devAllowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: true,
  })
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'unifix-api' });
});

// Mount API v1 router
app.use('/api/v1', router);

// Error logging middleware
app.use(errorLogger);

// Error handling middleware
export function errorHandler(
  err: Error,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  logger.error('Unhandled API error', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
  res.status(500).json({ error: 'Internal Server Error' });
}

app.use(errorHandler);

// 404 catch-all handler (placed last!)
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint Not Found' });
});

export { app };
