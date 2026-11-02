// Campus Controller - Unifix
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

/**
 * List active campuses
 * Public endpoint for campus selection during onboarding & mobile setup
 */
export async function listCampuses(req: Request, res: Response) {
  try {
    const campuses = await prisma.campus.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        timezone: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.json({ data: campuses });
  } catch (error: any) {
    logger.error('Error listing campuses', { error: error.message });
    return res.status(500).json({ error: 'Failed to retrieve campuses' });
  }
}

/**
 * Get campus details including departments, buildings, locations, and categories
 */
export async function getCampusDetails(req: Request, res: Response) {
  try {
    const { campusId } = req.params;

    const campus = await prisma.campus.findUnique({
      where: { id: campusId },
      include: {
        departments: {
          where: { isActive: true },
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        },
        buildings: {
          where: { isActive: true },
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        },
        locations: {
          where: { isActive: true },
          select: { id: true, buildingId: true, name: true, floor: true, room: true, description: true },
          orderBy: { name: 'asc' },
        },
        categories: {
          where: { isActive: true },
          select: { id: true, name: true, icon: true, defaultPriority: true, description: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!campus || !campus.isActive) {
      return res.status(404).json({ error: 'Campus not found' });
    }

    // Also fetch global categories (campusId is null)
    const globalCategories = await prisma.category.findMany({
      where: { campusId: null, isActive: true },
      select: { id: true, name: true, icon: true, defaultPriority: true, description: true },
      orderBy: { name: 'asc' },
    });

    const allCategories = [...campus.categories, ...globalCategories];

    return res.json({
      data: {
        id: campus.id,
        name: campus.name,
        code: campus.code,
        address: campus.address,
        timezone: campus.timezone,
        departments: campus.departments,
        buildings: campus.buildings,
        locations: campus.locations,
        categories: allCategories,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching campus details', { error: error.message });
    return res.status(500).json({ error: 'Failed to retrieve campus details' });
  }
}

/**
 * Check if an email or phone is authorized on a campus without leaking directory
 */
export async function checkEligibility(req: Request, res: Response) {
  try {
    const { campusId } = req.params;
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ error: 'Identifier is required' });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();

    const identity = await prisma.campusAuthorizedIdentity.findFirst({
      where: {
        campusId,
        isActive: true,
        OR: [
          { email: { equals: cleanIdentifier, mode: 'insensitive' } },
          { phone: cleanIdentifier },
        ],
      },
    });

    if (!identity) {
      return res.json({
        data: {
          isAuthorized: false,
          message: 'Identifier not recognized for this campus.',
        },
      });
    }

    return res.json({
      data: {
        isAuthorized: true,
        expectedRole: identity.role,
        department: identity.department,
        maskedIdentifier: cleanIdentifier.includes('@')
          ? cleanIdentifier.replace(/(.{2})(.*)(@.*)/, '$1***$3')
          : cleanIdentifier.slice(0, 4) + '****' + cleanIdentifier.slice(-2),
      },
    });
  } catch (error: any) {
    logger.error('Error checking identity eligibility', { error: error.message });
    return res.status(500).json({ error: 'Failed to check eligibility' });
  }
}

/**
 * Create a new campus (Supermanagement only)
 */
export async function createCampus(req: Request, res: Response) {
  try {
    const { name, code, address, timezone, latitude, longitude } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Campus name and code are required' });
    }

    const cleanCode = String(code).trim().toUpperCase();

    const existing = await prisma.campus.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      return res.status(409).json({ error: 'A campus with this code already exists' });
    }

    const campus = await prisma.campus.create({
      data: {
        name,
        code: cleanCode,
        address,
        timezone: timezone || 'UTC',
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        isActive: true,
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        campusId: campus.id,
        userId: (req as any).userId || null,
        action: 'CAMPUS_CREATED',
        entityType: 'Campus',
        entityId: campus.id,
        details: { code: campus.code, name: campus.name },
      },
    });

    return res.status(201).json({ data: campus });
  } catch (error: any) {
    logger.error('Error creating campus', { error: error.message });
    return res.status(500).json({ error: 'Failed to create campus' });
  }
}
