import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
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
app.use(helmet());

// Request logging
app.use(requestLogger);

// CORS configuration
const allowedOrigins = config.webOrigin ? [config.webOrigin] : ['*'];
app.use(
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
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
