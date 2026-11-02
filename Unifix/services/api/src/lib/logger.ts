// Logger utility using Winston
import winston from 'winston';
import { getConfig } from '@unifix/shared-config';

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Request logging middleware
export function requestLogger(req: any, res: any, next: any) {
  const { method, originalUrl } = req;
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const config = getConfig();
    const isProduction = config.nodeEnv === 'production';
    
    const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const message = `${method} ${originalUrl} ${status} ${duration}ms`;
    
    if (!isProduction || logLevel !== 'info') {
      logger.log(logLevel, message, {
        method,
        url: originalUrl,
        status,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body
      });
    } else {
      logger.log(logLevel, message, {
        method,
        url: originalUrl,
        status,
        duration
      });
    }
  });
  
  next();
}

// Error logging middleware
export function errorLogger(err: Error, req: any, res: any, next: any) {
  logger.error('Request error', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    params: req.params,
    query: req.query
  });
  next(err);
}

export default logger;
