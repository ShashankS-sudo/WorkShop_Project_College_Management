// Authentication controller - Unifix
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getConfig } from '@unifix/shared-config';
import { TokenPayload } from '@unifix/shared-types';
import logger from '../lib/logger';

// In-memory store for pending OTP requests (development / simulation)
interface PendingOTP {
  code: string;
  campusId: string;
  identifier: string;
  isAnonymous: boolean;
  expiresAt: number;
  attempts: number;
  role: 'REPORTER' | 'MANAGEMENT' | 'SUPERMANAGEMENT';
  displayName?: string;
}

const pendingOTPs = new Map<string, PendingOTP>();

async function resolveCampus(campusIdOrCode: string) {
  if (!campusIdOrCode) return null;
  // Try direct ID lookup first
  let campus = await prisma.campus.findUnique({
    where: { id: campusIdOrCode },
  });
  if (!campus) {
    const codeMatch = campusIdOrCode.toUpperCase().includes('PSTC')
      ? 'PSTC'
      : campusIdOrCode.toUpperCase().includes('MADI')
      ? 'MADI'
      : campusIdOrCode.toUpperCase().includes('HVU')
      ? 'HVU'
      : campusIdOrCode.toUpperCase();
    campus = await prisma.campus.findFirst({
      where: {
        OR: [
          { code: codeMatch },
          { code: campusIdOrCode.toUpperCase() },
        ],
        isActive: true,
      },
    });
  }
  return campus;
}

function hashToken(token: string): string {
  const config = getConfig();
  return crypto
    .createHmac('sha256', config.jwt.refreshSecret + (config.jwt.refreshTokenPepper || 'unifix-pepper'))
    .update(token)
    .digest('hex');
}

/**
 * Step 1: Request OTP (Simulated Provider)
 * Validates eligibility against CampusAuthorizedIdentity registry before issuing OTP
 */
export async function requestOTP(req: Request, res: Response) {
  try {
    const { identifier, campusId, isAnonymous } = req.body;

    if (!campusId || !identifier) {
      return res.status(400).json({ error: 'Campus ID and identifier (email or phone) are required' });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();

    // Check campus exists & active (supporting canonical UUID or code/slug)
    const campus = await resolveCampus(campusId);

    if (!campus || !campus.isActive) {
      return res.status(404).json({ error: 'Campus not found or inactive' });
    }

    const resolvedCampusId = campus.id;

    let role: 'REPORTER' | 'MANAGEMENT' | 'SUPERMANAGEMENT' = 'REPORTER';
    let displayName: string = isAnonymous ? 'Anonymous Reporter' : 'Campus User';

    // Verify against CampusAuthorizedIdentity unless anonymous
    if (!isAnonymous) {
      const authorizedIdentity = await prisma.campusAuthorizedIdentity.findFirst({
        where: {
          campusId: resolvedCampusId,
          isActive: true,
          OR: [
            { email: { equals: cleanIdentifier, mode: 'insensitive' } },
            { phone: cleanIdentifier },
          ],
        },
      });

      if (!authorizedIdentity) {
        return res.status(403).json({
          error: 'Identity not authorized',
          message: 'This email/phone is not registered in this campus directory. Please contact campus administration.',
        });
      }

      role = authorizedIdentity.role as any;
      displayName = authorizedIdentity.displayName;
    }

    // In development mode, use predictable OTP '123456' for seamless automated testing, or random in production
    const config = getConfig();
    const otpCode = config.nodeEnv === 'production' 
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : '123456';

    const otpData = {
      code: otpCode,
      campusId: resolvedCampusId,
      identifier: cleanIdentifier,
      isAnonymous: Boolean(isAnonymous),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      attempts: 0,
      role,
      displayName,
    };

    pendingOTPs.set(`${resolvedCampusId}:${cleanIdentifier}`, otpData);
    if (campusId !== resolvedCampusId) {
      pendingOTPs.set(`${campusId}:${cleanIdentifier}`, otpData);
    }

    logger.info(`Simulated OTP generated for ${cleanIdentifier} on campus ${campus.code}: ${otpCode}`);

    return res.json({
      data: {
        message: 'Verification code generated (development simulated delivery)',
        identifier: cleanIdentifier,
        campusId: resolvedCampusId,
        expiresInSeconds: 300,
        // In development mode, return code to facilitate testing without SMS/Email gateway
        developmentOtpCode: config.nodeEnv !== 'production' ? otpCode : undefined,
      },
    });
  } catch (error: any) {
    logger.error('Error requesting OTP', { error: error.message });
    return res.status(500).json({ error: 'Failed to process OTP request' });
  }
}

/**
 * Step 2: Verify OTP and issue access & refresh tokens
 */
export async function verifyOTP(req: Request, res: Response) {
  try {
    const { identifier, code, campusId, isAnonymous, displayName } = req.body;

    if (!identifier || !code || !campusId) {
      return res.status(400).json({ error: 'identifier, code, and campusId are required' });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();

    // Check campus exists & active (supporting canonical UUID or code/slug)
    const campus = await resolveCampus(campusId);
    if (!campus || !campus.isActive) {
      return res.status(404).json({ error: 'Campus not found or inactive' });
    }
    const resolvedCampusId = campus.id;

    const otpKey = `${resolvedCampusId}:${cleanIdentifier}`;
    const fallbackOtpKey = `${campusId}:${cleanIdentifier}`;
    const pending = pendingOTPs.get(otpKey) || pendingOTPs.get(fallbackOtpKey);

    // Verify OTP - only allow master dev code when explicitly outside production
    const config = getConfig();
    const isMasterDevCode = config.nodeEnv !== 'production' && code === '123456';
    if (!pending && !isMasterDevCode) {
      return res.status(401).json({ error: 'No active OTP request found or code expired' });
    }

    if (pending) {
      if (pending.expiresAt < Date.now()) {
        pendingOTPs.delete(otpKey);
        pendingOTPs.delete(fallbackOtpKey);
        return res.status(401).json({ error: 'OTP has expired. Please request a new code.' });
      }

      if (pending.attempts >= 5) {
        pendingOTPs.delete(otpKey);
        pendingOTPs.delete(fallbackOtpKey);
        return res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
      }

      if (pending.code !== code && !isMasterDevCode) {
        pending.attempts += 1;
        return res.status(401).json({ error: 'Invalid verification code', attemptsRemaining: 5 - pending.attempts });
      }

      // Consumed OTP
      pendingOTPs.delete(otpKey);
      pendingOTPs.delete(fallbackOtpKey);
    }

    const isEmail = cleanIdentifier.includes('@');
    const userRole = pending?.role || 'REPORTER';
    const userDisplayName = displayName || pending?.displayName || (isAnonymous ? 'Anonymous' : 'Campus User');

    // Find or create User
    let user = await prisma.user.findFirst({
      where: isEmail ? { email: cleanIdentifier } : { phone: cleanIdentifier },
    });

    if (!user) {
      const nameParts = userDisplayName.split(' ');
      user = await prisma.user.create({
        data: {
          email: isEmail ? cleanIdentifier : undefined,
          phone: isEmail ? undefined : cleanIdentifier,
          firstName: nameParts[0] || 'User',
          lastName: nameParts.slice(1).join(' ') || '',
          isAnonymous: Boolean(isAnonymous),
          emailVerified: isEmail ? new Date() : undefined,
          phoneVerified: !isEmail ? new Date() : undefined,
          lastLogin: new Date(),
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
    }

    // Upsert CampusMembership with canonical resolved campus ID
    const membership = await prisma.campusMembership.upsert({
      where: {
        userId_campusId: {
          userId: user.id,
          campusId: resolvedCampusId,
        },
      },
      update: {
        isActive: true,
      },
      create: {
        userId: user.id,
        campusId: resolvedCampusId,
        role: userRole,
        isActive: true,
      },
    });

    // Query all active memberships
    const allMemberships = await prisma.campusMembership.findMany({
      where: { userId: user.id, isActive: true },
      include: { campus: true },
    });

    // Generate JWT access token
    const tokenPayload: TokenPayload = {
      userId: user.id,
      campusIds: allMemberships.map((m) => m.campusId),
      roles: allMemberships.map((m) => m.role as any),
      isAnonymous: user.isAnonymous,
    };

    const accessToken = jwt.sign(tokenPayload, config.jwt.accessSecret, {
      expiresIn: '15m',
    });

    // Generate opaque refresh token and store in RefreshSession table
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: req.get('User-Agent') || null,
        ipAddress: req.ip || null,
      },
    });

    return res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          isAnonymous: user.isAnonymous,
        },
        campuses: allMemberships.map((m) => ({
          id: m.campus.id,
          name: m.campus.name,
          code: m.campus.code,
          role: m.role,
        })),
        accessToken,
        refreshToken: rawRefreshToken,
        tokenType: 'Bearer',
        expiresIn: 900, // 15 mins in seconds
      },
    });
  } catch (error: any) {
    logger.error('Error verifying OTP', { error: error.message });
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
}

/**
 * Step 3: Refresh access token with rotation and session reuse detection
 */
export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken: rawRefreshToken } = req.body;

    if (!rawRefreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const tokenHash = hashToken(rawRefreshToken);

    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            campusMemberships: {
              where: { isActive: true },
              include: { campus: true },
            },
          },
        },
      },
    });

    // Session reuse detection: if token is already revoked, revoke all sessions for this user!
    if (session && session.isRevoked) {
      logger.warn(`Suspicious refresh token reuse detected for user ${session.userId}. Revoking all sessions.`);
      await prisma.refreshSession.updateMany({
        where: { userId: session.userId },
        data: { isRevoked: true },
      });
      return res.status(401).json({ error: 'Invalid session. Please sign in again.' });
    }

    if (!session || session.expiresAt.getTime() < Date.now()) {
      return res.status(401).json({ error: 'Refresh token invalid or expired' });
    }

    // Revoke old session (Rotation!)
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    const user = session.user;
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User inactive or not found' });
    }

    const config = getConfig();

    // Issue new access token
    const tokenPayload: TokenPayload = {
      userId: user.id,
      campusIds: user.campusMemberships.map((m) => m.campusId),
      roles: user.campusMemberships.map((m) => m.role as any),
      isAnonymous: user.isAnonymous,
    };

    const newAccessToken = jwt.sign(tokenPayload, config.jwt.accessSecret, {
      expiresIn: '15m',
    });

    // Issue new rotated refresh token
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        userAgent: req.get('User-Agent') || null,
        ipAddress: req.ip || null,
      },
    });

    return res.json({
      data: {
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    });
  } catch (error: any) {
    logger.error('Error refreshing token', { error: error.message });
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
}

/**
 * Step 4: Logout (revokes current refresh token)
 */
export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken: rawRefreshToken } = req.body;

    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await prisma.refreshSession.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    }

    return res.json({ data: { message: 'Logged out successfully' } });
  } catch (error: any) {
    logger.error('Error logging out', { error: error.message });
    return res.status(500).json({ error: 'Failed to logout' });
  }
}

/**
 * Step 5: Get current authenticated user details
 */
export async function getCurrentUser(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        campusMemberships: {
          where: { isActive: true },
          include: {
            campus: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
        isAnonymous: user.isAnonymous,
        campuses: user.campusMemberships.map((m) => ({
          id: m.campus.id,
          name: m.campus.name,
          code: m.campus.code,
          role: m.role,
        })),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching current user', { error: error.message });
    return res.status(500).json({ error: 'Failed to get current user' });
  }
}
