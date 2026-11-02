// Management & Supermanagement Dashboard Controller - Unifix
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

/**
 * Campus Management Dashboard Statistics
 */
export async function getCampusDashboardStats(req: Request, res: Response) {
  try {
    const { campusId } = req.params;

    const [
      totalTickets,
      openTickets,
      acknowledgedTickets,
      inProgressTickets,
      waitingTickets,
      resolvedTickets,
      closedTickets,
      criticalTickets,
      recentActivity,
      overdueTickets,
    ] = await Promise.all([
      prisma.ticket.count({ where: { campusId } }),
      prisma.ticket.count({ where: { campusId, status: 'OPEN' } }),
      prisma.ticket.count({ where: { campusId, status: 'ACKNOWLEDGED' } }),
      prisma.ticket.count({ where: { campusId, status: 'IN_PROGRESS' } }),
      prisma.ticket.count({ where: { campusId, status: 'WAITING' } }),
      prisma.ticket.count({ where: { campusId, status: 'RESOLVED' } }),
      prisma.ticket.count({ where: { campusId, status: 'CLOSED' } }),
      prisma.ticket.count({
        where: { campusId, isCritical: true, status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] } },
      }),
      prisma.ticket.findMany({
        where: { campusId },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          isCritical: true,
          currentStage: true,
          updatedAt: true,
          category: { select: { name: true } },
        },
      }),
      // Tickets exceeding 21 days in their current stage
      prisma.ticket.findMany({
        where: {
          campusId,
          status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
          stageStartTime: { lt: new Date(Date.now() - 21 * 24 * 3600 * 1000) },
        },
        select: {
          id: true,
          title: true,
          status: true,
          currentStage: true,
          stageStartTime: true,
          escalationCount: true,
        },
      }),
    ]);

    return res.json({
      data: {
        counts: {
          total: totalTickets,
          open: openTickets,
          acknowledged: acknowledgedTickets,
          inProgress: inProgressTickets,
          waiting: waitingTickets,
          resolved: resolvedTickets,
          closed: closedTickets,
          critical: criticalTickets,
          overdue: overdueTickets.length,
        },
        overdueQueue: overdueTickets,
        recentActivity,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching campus dashboard stats', { error: error.message });
    return res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
}

/**
 * Supermanagement Global Overview & Cross-Campus Comparison
 */
export async function getGlobalOverview(req: Request, res: Response) {
  try {
    const [campuses, totalTickets, activeTickets, criticalTickets, globalOverdue] = await Promise.all([
      prisma.campus.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          _count: {
            select: {
              tickets: true,
              memberships: true,
            },
          },
        },
      }),
      prisma.ticket.count(),
      prisma.ticket.count({
        where: { status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] } },
      }),
      prisma.ticket.count({
        where: { isCritical: true, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      }),
      prisma.ticket.count({
        where: {
          status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
          stageStartTime: { lt: new Date(Date.now() - 21 * 24 * 3600 * 1000) },
        },
      }),
    ]);

    // Campus breakdown
    const campusBreakdown = await Promise.all(
      campuses.map(async (c) => {
        const active = await prisma.ticket.count({
          where: { campusId: c.id, status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] } },
        });
        const overdue = await prisma.ticket.count({
          where: {
            campusId: c.id,
            status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
            stageStartTime: { lt: new Date(Date.now() - 21 * 24 * 3600 * 1000) },
          },
        });
        return {
          id: c.id,
          name: c.name,
          code: c.code,
          totalTickets: c._count.tickets,
          activeTickets: active,
          overdueTickets: overdue,
          registeredUsers: c._count.memberships,
        };
      })
    );

    return res.json({
      data: {
        summary: {
          totalCampuses: campuses.length,
          totalTickets,
          activeTickets,
          criticalTickets,
          overdueTickets: globalOverdue,
        },
        campusComparison: campusBreakdown,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching global overview', { error: error.message });
    return res.status(500).json({ error: 'Failed to retrieve global overview' });
  }
}
