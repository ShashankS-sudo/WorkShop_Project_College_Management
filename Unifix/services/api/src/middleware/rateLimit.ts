// Sliding-Window HTTP Rate Limiting Middleware - Unifix
import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests allowed per window
  message?: string;
  statusCode?: number;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitRecord {
  timestamps: number[];
}

/**
 * Creates a sliding-window in-memory rate limiter
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests. Please try again later.',
    statusCode = 429,
    keyGenerator = (req: Request) => {
      const forwarded = req.headers['x-forwarded-for'];
      const ip =
        typeof forwarded === 'string'
          ? forwarded.split(',')[0].trim()
          : req.socket.remoteAddress || req.ip || 'unknown';
      return ip;
    },
  } = options;

  const hits = new Map<string, RateLimitRecord>();

  // Periodically clean up stale client entries to prevent memory leaks
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      record.timestamps = record.timestamps.filter((t) => t > now - windowMs);
      if (record.timestamps.length === 0) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = hits.get(key);
    if (!record) {
      record = { timestamps: [] };
      hits.set(key, record);
    }

    // Filter out timestamps older than the sliding window
    record.timestamps = record.timestamps.filter((t) => t > windowStart);

    const currentCount = record.timestamps.length;
    const remaining = Math.max(0, max - currentCount - 1);
    const oldestTimestamp = record.timestamps[0] || now;
    const resetTimeEpochSeconds = Math.ceil((oldestTimestamp + windowMs) / 1000);
    const retryAfterSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    // Attach standard rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeEpochSeconds);

    if (currentCount >= max) {
      res.setHeader('Retry-After', retryAfterSeconds);
      logger.warn(`Rate limit exceeded for key [${key}]`, {
        ip: req.ip,
        path: req.originalUrl,
        hits: currentCount,
        max,
        retryAfter: retryAfterSeconds,
      });

      return res.status(statusCode).json({
        error: message,
        retryAfter: retryAfterSeconds,
        statusCode,
      });
    }

    // Record the current hit
    record.timestamps.push(now);
    next();
  };
}

/**
 * Extracts client IP safely
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || req.ip || 'unknown';
}

/**
 * OTP Request Rate Limiter:
 * Allows max 5 OTP requests per 15-minute sliding window per IP + identifier
 */
export const otpRequestRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many OTP requests for this account. Please wait 15 minutes before requesting a new code.',
  keyGenerator: (req: Request) => {
    const ip = getClientIp(req);
    const identifier = req.body?.identifier ? String(req.body.identifier).toLowerCase().trim() : '';
    return identifier ? `otp_req:${ip}:${identifier}` : `otp_req:${ip}`;
  },
});

/**
 * OTP Verification Rate Limiter:
 * Allows max 5 verification attempts per 5-minute sliding window per IP + identifier
 * Protects against brute-force attacks on the 6-digit code.
 */
export const otpVerifyRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: 'Too many failed verification attempts. Please wait 5 minutes before trying again.',
  keyGenerator: (req: Request) => {
    const ip = getClientIp(req);
    const identifier = req.body?.identifier ? String(req.body.identifier).toLowerCase().trim() : '';
    return identifier ? `otp_ver:${ip}:${identifier}` : `otp_ver:${ip}`;
  },
});

/**
 * General Auth Endpoint Rate Limiter:
 * Max 60 requests per 15 minutes per IP
 */
export const authGeneralRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many authentication requests from this IP. Please try again later.',
  keyGenerator: (req: Request) => `auth_gen:${getClientIp(req)}`,
});
