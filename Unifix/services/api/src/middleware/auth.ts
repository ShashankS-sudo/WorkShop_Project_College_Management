// Authentication middleware
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '@unifix/shared-config';
import { TokenPayload } from '@unifix/shared-types';

/**
 * Authenticate user using JWT
 * Finds the token in: headers, query params, or body
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let token: string | undefined;

  // Check for token in headers
  if (req.headers.authorization) {
    token = req.headers.authorization.split(' ')[1]; // Bearer TOKEN
  }
  // Check for token in query params
  else if (req.query.token) {
    token = req.query.token as string;
  }
  // Check for token in body
  else if (req.body.token) {
    token = req.body.token as string;
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  try {
    const config = getConfig();
    const payload = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;

    // Attach user to request
    (req as any).user = payload;
    (req as any).campusIds = payload.campusIds;
    (req as any).userId = payload.userId;

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
}

/**
 * Check if user has specific role
 * Renders access to routes for specific roles
 */
export function authorize(roles: string[]) {
  return function (
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const userRoles = (req as any).user?.roles || [];

    const hasRole = roles.some(role =>
      userRoles.includes(role))

    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden'
      });
    }

    next();
  };
}

/**
 * Ensure user is accessing their own campus resources
 * Prevents cross-campus access
 */
export function ensureCampusAccess(campusId?: string) {
  return function (
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const userCampusIds = (req as any).campusIds || [];
    const requestedCampusId = campusId || (req.params.campusId as string);

    // If user has NO campus access or not accessing their own campus, deny
    if (!userCampusIds.includes(requestedCampusId)) {
      return res.status(403).json({
        error: 'Access denied for campus'
      });
    }

    next();
  };
}

/**
 * Extract campus ID from request
 * This middleware extracts campusId from:
 * - route parameter (campusId)
 * - query parameter (campus)
 * - header (X-Campus-Id)
 */
export function extractCampusId() {
  return function (
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    let campusId: string | undefined;

    // From route parameter
    if (req.params.campusId) {
      campusId = req.params.campusId;
    }
    // From query parameter
    else if (req.query.campus) {
      campusId = req.query.campus as string;
    }
    // From header
    else if (req.headers['x-campus-id']) {
      campusId = req.headers['x-campus-id'] as string;
    }

    if (!campusId) {
      return res.status(400).json({
        error: 'Campus ID is required'
      });
    }

    (req as any).campusId = campusId;
    next();
  };
}

/**
 * Check if user is anonymous
 */
export function allowAnonymous(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const isAnonymous = (req as any).user?.isAnonymous;

  if (isAnonymous) {
    next();
  } else {
    return res.status(403).json({
      error: 'Anonymous users only'
    });
  }
}

/**
 * Check if user is not anonymous
 */
export function requireAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const isAnonymous = (req as any).user?.isAnonymous;

  if (isAnonymous === false) {
    next();
  } else {
    return res.status(403).json({
      error: 'Authentication required'
    });
  }
}
