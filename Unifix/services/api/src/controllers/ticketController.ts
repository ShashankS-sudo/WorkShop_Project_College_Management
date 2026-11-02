// Ticket Controller - Unifix
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { emitToCampus, emitToTicket, emitToUser } from '../lib/socket';
import { SocketEvent } from '@unifix/shared-types';

/**
 * Helper to check caller's role for a specific campus
 */
function getCallerCampusRole(req: Request, campusId: string): string | null {
  const user = (req as any).user;
  if (!user) return null;

  // Supermanagement has global access
  if (user.roles?.includes('SUPERMANAGEMENT')) {
    return 'SUPERMANAGEMENT';
  }

  const campusIndex = user.campusIds?.indexOf(campusId);
  if (campusIndex !== -1 && campusIndex !== undefined) {
    return user.roles[campusIndex] || 'REPORTER';
  }

  return null;
}

/**
 * Helper to serialize ticket with field-level privacy
 * If isAnonymous = true:
 * - Management & Supermanagement CAN see real reporter (MasterPrompt Section 18)
 * - Ordinary users see "Anonymous Reporter"
 */
function serializeTicket(ticket: any, callerRole: string | null, callerUserId: string | null) {
  const isReporterSelf = callerUserId && ticket.reporterId === callerUserId;
  const isManagement = callerRole === 'MANAGEMENT' || callerRole === 'SUPERMANAGEMENT';
  const shouldRevealIdentity = isManagement || isReporterSelf || !ticket.isAnonymous;

  return {
    ...ticket,
    reporter: shouldRevealIdentity
      ? ticket.reporter
      : {
          id: null,
          displayName: 'Anonymous Reporter',
          isAnonymous: true,
        },
  };
}

/**
 * Create a new ticket (Report)
 */
export async function createTicket(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const {
      campusId,
      title,
      description,
      locationId,
      locationText,
      locationDetails,
      categoryId,
      departmentId,
      ticketType = 'ISSUE',
      severity = 'MODERATE',
      impact = 'INDIVIDUAL',
      urgency = 'NORMAL',
      isCritical = false,
      isAnonymous = false,
      attachments = [],
    } = req.body;

    if (!campusId || !title || !description) {
      return res.status(400).json({ error: 'campusId, title, and description are required' });
    }

    // Enforce campus boundary
    const callerRole = getCallerCampusRole(req, campusId);
    if (!callerRole) {
      return res.status(403).json({ error: 'Access denied for this campus' });
    }

    // Determine initial priority based on category/severity/isCritical
    let initialPriority = 'MEDIUM';
    if (isCritical || severity === 'CRITICAL' || urgency === 'URGENT') {
      initialPriority = 'CRITICAL';
    } else if (severity === 'MAJOR' || urgency === 'HIGH') {
      initialPriority = 'HIGH';
    } else if (severity === 'MINOR' && urgency === 'LOW') {
      initialPriority = 'LOW';
    }

    // Critical tickets have tighter stage timers (e.g. 48h vs 504h for normal)
    const stageDuration = isCritical ? 48 : 504; // hours

    // Transactionally create ticket, initial status history, and attachments
    const newTicket = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          campusId,
          reporterId: userId || null,
          title,
          description,
          locationId: locationId || null,
          locationText: locationText || locationDetails || null,
          categoryId: categoryId || null,
          departmentId: departmentId || null,
          ticketType,
          severity,
          impact,
          urgency,
          suggestedPriority: initialPriority,
          priority: initialPriority,
          status: 'OPEN',
          isCritical: Boolean(isCritical),
          isAnonymous: Boolean(isAnonymous),
          currentStage: 'REPORTED',
          stageStartTime: new Date(),
          stageDuration,
          lastProgressAt: new Date(),
          statusHistories: {
            create: {
              status: 'OPEN',
              previousStatus: null,
              changedById: userId,
              notes: isAnonymous ? 'Report submitted anonymously' : 'Initial ticket submission',
            },
          },
          attachments: attachments?.length
            ? {
                create: attachments.map((att: any) => ({
                  userId,
                  filename: att.filename,
                  filepath: att.filepath,
                  mimeType: att.mimeType,
                  size: att.size,
                  uploadedBy: userId,
                  isApproved: true,
                })),
              }
            : undefined,
        },
        include: {
          campus: { select: { id: true, name: true, code: true } },
          category: true,
          location: true,
          department: true,
          reporter: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
          attachments: true,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          campusId,
          userId,
          action: 'TICKET_CREATED',
          entityType: 'Ticket',
          entityId: ticket.id,
          details: { title: ticket.title, isAnonymous: ticket.isAnonymous, priority: ticket.priority },
        },
      });

      return ticket;
    });

    const serializedTicket = serializeTicket(newTicket, callerRole, userId);

    // Emit real-time event to campus
    emitToCampus(campusId, SocketEvent.TICKET_CREATED, {
      campusId,
      ticketId: newTicket.id,
      ticket: serializedTicket,
      action: 'CREATED',
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
      data: serializedTicket,
    });
  } catch (error: any) {
    logger.error('Error creating ticket', { error: error.message });
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
}

/**
 * List tickets with filtering, pagination, and campus isolation
 */
export async function listTickets(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const user = (req as any).user;
    const {
      campusId,
      status,
      category,
      department,
      priority,
      severity,
      isCritical,
      overdue,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Campus isolation:
    // If campusId provided, caller must belong to it (or supermanagement)
    // If not provided, filter by caller's assigned campuses
    let allowedCampusIds: string[] = user?.campusIds || [];
    const isSuper = user?.roles?.includes('SUPERMANAGEMENT');

    if (campusId) {
      if (!isSuper && !allowedCampusIds.includes(String(campusId))) {
        return res.status(403).json({ error: 'Access denied for requested campus' });
      }
      allowedCampusIds = [String(campusId)];
    }

    const where: Prisma.TicketWhereInput = {
      campusId: { in: allowedCampusIds },
    };

    if (status) {
      where.status = String(status);
    }

    if (category) {
      where.categoryId = String(category);
    }

    if (department) {
      where.departmentId = String(department);
    }

    if (priority) {
      where.priority = String(priority);
    }

    if (severity) {
      where.severity = String(severity);
    }

    if (isCritical !== undefined) {
      where.isCritical = isCritical === 'true';
    }

    // Overdue filter: stage duration exceeded
    if (overdue === 'true') {
      where.status = { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] };
      // Stage timer exceeded: stageStartTime + stageDuration hours < now
      const now = new Date();
      where.stageStartTime = {
        lt: new Date(now.getTime() - 21 * 24 * 3600 * 1000), // Default 21-day escalation window
      };
    }

    if (search) {
      const searchStr = String(search).trim();
      where.OR = [
        { title: { contains: searchStr, mode: 'insensitive' } },
        { description: { contains: searchStr, mode: 'insensitive' } },
        { locationText: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [String(sortBy)]: String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: {
          campus: { select: { id: true, name: true, code: true } },
          category: { select: { id: true, name: true, icon: true } },
          location: { select: { id: true, name: true, floor: true, room: true } },
          department: { select: { id: true, name: true, code: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
          reporter: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          _count: {
            select: {
              endorsements: true,
              comments: true,
              attachments: true,
            },
          },
        },
      }),
    ]);

    const callerRole = isSuper ? 'SUPERMANAGEMENT' : (user?.roles?.[0] || 'REPORTER');

    const serialized = tickets.map((t) => serializeTicket(t, callerRole, userId));

    return res.json({
      data: serialized,
      metadata: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    logger.error('Error listing tickets', { error: error.message });
    return res.status(500).json({ error: 'Failed to list tickets' });
  }
}

/**
 * Get ticket details by ID with role-aware privacy
 */
export async function getTicketDetails(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { ticketId } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        campus: true,
        category: true,
        location: true,
        department: true,
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        reporter: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        attachments: true,
        statusHistories: {
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        priorityHistories: {
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        progressEvents: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        escalationEvents: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { endorsements: true },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const callerRole = getCallerCampusRole(req, ticket.campusId);
    if (!callerRole) {
      return res.status(403).json({ error: 'Access denied for this campus ticket' });
    }

    // Filter internal comments if caller is ordinary reporter
    let filteredComments = ticket.comments;
    if (callerRole === 'REPORTER') {
      filteredComments = ticket.comments.filter((c) => !c.isInternal);
    }

    const serialized = serializeTicket(
      { ...ticket, comments: filteredComments },
      callerRole,
      userId
    );

    return res.json({ data: serialized });
  } catch (error: any) {
    logger.error('Error fetching ticket details', { error: error.message });
    return res.status(500).json({ error: 'Failed to retrieve ticket' });
  }
}

/**
 * Endorse a ticket ("I have this issue too")
 * Ensures 1 endorsement per user per ticket
 */
export async function endorseTicket(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { ticketId } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { campusId: true, isCritical: true, priority: true },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const callerRole = getCallerCampusRole(req, ticket.campusId);
    if (!callerRole) {
      return res.status(403).json({ error: 'Access denied for this campus' });
    }

    // Check if user already endorsed
    const existing = await prisma.endorsement.findUnique({
      where: {
        ticketId_endorserId: {
          ticketId,
          endorserId: userId,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Already endorsed',
        message: 'You have already indicated that you are affected by this issue.',
      });
    }

    await prisma.endorsement.create({
      data: {
        ticketId,
        endorserId: userId,
      },
    });

    const totalEndorsements = await prisma.endorsement.count({
      where: { ticketId },
    });

    emitToCampus(ticket.campusId, SocketEvent.TICKET_ENDORSED, {
      campusId: ticket.campusId,
      ticketId,
      totalEndorsements,
      timestamp: new Date().toISOString(),
    });
    emitToTicket(ticketId, SocketEvent.TICKET_ENDORSED, {
      campusId: ticket.campusId,
      ticketId,
      totalEndorsements,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      data: {
        message: 'Endorsement recorded',
        ticketId,
        totalEndorsements,
      },
    });
  } catch (error: any) {
    logger.error('Error endorsing ticket', { error: error.message });
    return res.status(500).json({ error: 'Failed to record endorsement' });
  }
}

/**
 * Add a comment to a ticket
 */
export async function addComment(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { ticketId } = req.params;
    const { content, isInternal = false } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { reporter: true },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const callerRole = getCallerCampusRole(req, ticket.campusId);
    if (!callerRole) {
      return res.status(403).json({ error: 'Access denied for this campus' });
    }

    // Only management can post internal comments
    const canMakeInternal = callerRole === 'MANAGEMENT' || callerRole === 'SUPERMANAGEMENT';
    const internalFlag = Boolean(isInternal && canMakeInternal);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    let authorName = `${user?.firstName || 'Campus'} ${user?.lastName || 'User'}`.trim();
    if (user?.isAnonymous || (ticket.isAnonymous && ticket.reporterId === userId)) {
      authorName = 'Anonymous';
    }

    const comment = await prisma.comment.create({
      data: {
        ticketId,
        userId,
        content: content.trim(),
        isInternal: internalFlag,
        authorName,
      },
    });

    emitToTicket(ticketId, SocketEvent.COMMENT_ADDED, {
      ticketId,
      comment,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ data: comment });
  } catch (error: any) {
    logger.error('Error adding comment', { error: error.message });
    return res.status(500).json({ error: 'Failed to add comment' });
  }
}

/**
 * Acknowledge a ticket (Management)
 * Transitions status to ACKNOWLEDGED, sets acknowledgedAt, starts new 21-day stage timer
 */
export async function acknowledgeTicket(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { ticketId } = req.params;
    const { notes, priority } = req.body;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const callerRole = getCallerCampusRole(req, ticket.campusId);
    if (callerRole !== 'MANAGEMENT' && callerRole !== 'SUPERMANAGEMENT') {
      return res.status(403).json({ error: 'Only management can acknowledge tickets' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'ACKNOWLEDGED',
          currentStage: 'ACKNOWLEDGED',
          acknowledgedAt: new Date(),
          stageStartTime: new Date(), // Restarts 21-day stage timer!
          lastProgressAt: new Date(),
          priority: priority || ticket.priority,
        },
      });

      await tx.statusHistory.create({
        data: {
          ticketId,
          status: 'ACKNOWLEDGED',
          previousStatus: ticket.status,
          changedById: userId,
          notes: notes || 'Ticket acknowledged by campus management',
        },
      });

      await tx.ticketProgressEvent.create({
        data: {
          ticketId,
          eventType: 'ACKNOWLEDGEMENT',
          title: 'Management Acknowledgement',
          details: notes || 'Ticket acknowledged and queued for maintenance action',
          actorId: userId,
          resetsStageTimer: true,
        },
      });

      return result;
    });

    emitToCampus(ticket.campusId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'ACKNOWLEDGED',
      timestamp: new Date().toISOString(),
    });
    emitToTicket(ticketId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'ACKNOWLEDGED',
      timestamp: new Date().toISOString(),
    });

    return res.json({ data: updated });
  } catch (error: any) {
    logger.error('Error acknowledging ticket', { error: error.message });
    return res.status(500).json({ error: 'Failed to acknowledge ticket' });
  }
}

/**
 * Assign a ticket to a staff member or department (Management)
 */
export async function assignTicket(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { ticketId } = req.params;
    const { assigneeId, departmentId, notes } = req.body;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const callerRole = getCallerCampusRole(req, ticket.campusId);
    if (callerRole !== 'MANAGEMENT' && callerRole !== 'SUPERMANAGEMENT') {
      return res.status(403).json({ error: 'Only management can assign tickets' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          assigneeId: assigneeId || ticket.assigneeId,
          departmentId: departmentId || ticket.departmentId,
          status: 'IN_PROGRESS',
          currentStage: 'ACTIVE',
          startedAt: ticket.startedAt || new Date(),
          stageStartTime: new Date(), // Restarts stage timer!
          lastProgressAt: new Date(),
        },
      });

      await tx.ticketAssignment.create({
        data: {
          ticketId,
          assignedById: userId,
          assigneeId: assigneeId || null,
          departmentId: departmentId || null,
          notes: notes || 'Assignment updated',
        },
      });

      await tx.ticketProgressEvent.create({
        data: {
          ticketId,
          eventType: 'ASSIGNMENT',
          title: 'Staff / Department Assignment',
          details: notes || `Ticket assigned to active work queue`,
          actorId: userId,
          resetsStageTimer: true,
        },
      });

      await tx.statusHistory.create({
        data: {
          ticketId,
          status: 'IN_PROGRESS',
          previousStatus: ticket.status,
          changedById: userId,
          notes: notes || 'Ticket assigned and moved to in-progress',
        },
      });

      return result;
    });

    emitToCampus(ticket.campusId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'ASSIGNED',
      timestamp: new Date().toISOString(),
    });
    emitToTicket(ticketId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'ASSIGNED',
      timestamp: new Date().toISOString(),
    });

    if (assigneeId) {
      emitToUser(assigneeId, SocketEvent.NOTIFICATION_NEW, {
        userId: assigneeId,
        notification: {
          title: 'Ticket Assigned',
          message: `You were assigned to ticket "${ticket.title}"`,
          type: 'TICKET_ASSIGNED',
          relatedTicketId: ticketId,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({ data: updated });
  } catch (error: any) {
    logger.error('Error assigning ticket', { error: error.message });
    return res.status(500).json({ error: 'Failed to assign ticket' });
  }
}

/**
 * Record a meaningful progress event (Management)
 * Resets stage timer only if explicitly marked as meaningful progress
 */
export async function recordProgress(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { ticketId } = req.params;
    const { eventType, title, details, resetsStageTimer = false } = req.body;

    if (!title || !details || !eventType) {
      return res.status(400).json({ error: 'eventType, title, and details are required' });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const callerRole = getCallerCampusRole(req, ticket.campusId);
    if (callerRole !== 'MANAGEMENT' && callerRole !== 'SUPERMANAGEMENT') {
      return res.status(403).json({ error: 'Only management can record progress updates' });
    }

    const progressEvent = await prisma.$transaction(async (tx) => {
      const event = await tx.ticketProgressEvent.create({
        data: {
          ticketId,
          eventType,
          title,
          details,
          actorId: userId,
          resetsStageTimer: Boolean(resetsStageTimer),
        },
      });

      const updateData: Prisma.TicketUpdateInput = {
        lastProgressAt: new Date(),
      };

      if (resetsStageTimer) {
        updateData.stageStartTime = new Date();
      }

      await tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });

      return event;
    });

    emitToTicket(ticketId, SocketEvent.PROGRESS_RECORDED, {
      ticketId,
      progressEvent,
      timestamp: new Date().toISOString(),
    });
    emitToCampus(ticket.campusId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      action: 'PROGRESS_RECORDED',
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ data: progressEvent });
  } catch (error: any) {
    logger.error('Error recording progress', { error: error.message });
    return res.status(500).json({ error: 'Failed to record progress' });
  }
}

/**
 * Override official priority with audit reason (Management)
 */
export async function overridePriority(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { ticketId } = req.params;
    const { priority, reason } = req.body;

    if (!priority || !reason) {
      return res.status(400).json({ error: 'priority and reason are required' });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const callerRole = getCallerCampusRole(req, ticket.campusId);
    if (callerRole !== 'MANAGEMENT' && callerRole !== 'SUPERMANAGEMENT') {
      return res.status(403).json({ error: 'Only management can override priority' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          priority,
          isCritical: priority === 'CRITICAL',
        },
      });

      await tx.priorityHistory.create({
        data: {
          ticketId,
          priority,
          previousPriority: ticket.priority as any,
          changedById: userId,
          reason,
        },
      });

      return result;
    });

    emitToCampus(ticket.campusId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'PRIORITY_OVERRIDDEN',
      timestamp: new Date().toISOString(),
    });
    emitToTicket(ticketId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'PRIORITY_OVERRIDDEN',
      timestamp: new Date().toISOString(),
    });

    return res.json({ data: updated });
  } catch (error: any) {
    logger.error('Error overriding priority', { error: error.message });
    return res.status(500).json({ error: 'Failed to override priority' });
  }
}

/**
 * Resolve a ticket (Management)
 */
export async function resolveTicket(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { ticketId } = req.params;
    const { resolutionSummary } = req.body;

    if (!resolutionSummary || resolutionSummary.trim().length < 10) {
      return res.status(400).json({ error: 'A resolution summary of at least 10 characters is required' });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const callerRole = getCallerCampusRole(req, ticket.campusId);
    if (callerRole !== 'MANAGEMENT' && callerRole !== 'SUPERMANAGEMENT') {
      return res.status(403).json({ error: 'Only management can resolve tickets' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'RESOLVED',
          currentStage: 'COMPLETED',
          resolvedAt: new Date(),
          resolutionSummary: resolutionSummary.trim(),
        },
      });

      await tx.statusHistory.create({
        data: {
          ticketId,
          status: 'RESOLVED',
          previousStatus: ticket.status,
          changedById: userId,
          notes: `Resolved: ${resolutionSummary.trim()}`,
        },
      });

      // Notify reporter if exists
      if (ticket.reporterId) {
        await tx.notification.create({
          data: {
            userId: ticket.reporterId,
            title: 'Your issue has been resolved',
            message: `Ticket "${ticket.title}" was marked resolved: ${resolutionSummary.trim()}`,
            type: 'TICKET_RESOLVED',
            relatedTicketId: ticket.id,
          },
        });
      }

      return result;
    });

    emitToCampus(ticket.campusId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'RESOLVED',
      timestamp: new Date().toISOString(),
    });
    emitToTicket(ticketId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'RESOLVED',
      timestamp: new Date().toISOString(),
    });

    if (ticket.reporterId) {
      emitToUser(ticket.reporterId, SocketEvent.NOTIFICATION_NEW, {
        userId: ticket.reporterId,
        notification: {
          title: `Ticket Resolved: ${ticket.title.slice(0, 40)}`,
          message: `Ticket "${ticket.title}" was marked resolved: ${resolutionSummary.trim()}`,
          type: 'TICKET_RESOLVED',
          relatedTicketId: ticket.id,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({ data: updated });
  } catch (error: any) {
    logger.error('Error resolving ticket', { error: error.message });
    return res.status(500).json({ error: 'Failed to resolve ticket' });
  }
}

/**
 * Reopen a ticket (Reporter or Management)
 * Restores ticket to active workflow with reason and restarts escalation clock
 */
export async function reopenTicket(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { ticketId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Reopening reason of at least 10 characters is required' });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const callerRole = getCallerCampusRole(req, ticket.campusId);
    const isReporter = ticket.reporterId === userId;

    if (!isReporter && callerRole !== 'MANAGEMENT' && callerRole !== 'SUPERMANAGEMENT') {
      return res.status(403).json({ error: 'Only the original reporter or campus management can reopen this ticket' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'OPEN',
          currentStage: 'REPORTED',
          stageStartTime: new Date(), // Restarts escalation clock!
          lastProgressAt: new Date(),
          reopenCount: ticket.reopenCount + 1,
          reopenedAt: new Date(),
          reopenReason: reason.trim(),
        },
      });

      await tx.statusHistory.create({
        data: {
          ticketId,
          status: 'OPEN',
          previousStatus: ticket.status,
          changedById: userId,
          notes: `Reopened (Attempt #${ticket.reopenCount + 1}): ${reason.trim()}`,
        },
      });

      await tx.ticketProgressEvent.create({
        data: {
          ticketId,
          eventType: 'INVESTIGATION_UPDATE',
          title: 'Ticket Reopened',
          details: `Reopened by ${isReporter ? 'reporter' : 'management'}: ${reason.trim()}`,
          actorId: userId,
          resetsStageTimer: true,
        },
      });

      return result;
    });

    emitToCampus(ticket.campusId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'REOPENED',
      timestamp: new Date().toISOString(),
    });
    emitToTicket(ticketId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'REOPENED',
      timestamp: new Date().toISOString(),
    });

    return res.json({ data: updated });
  } catch (error: any) {
    logger.error('Error reopening ticket', { error: error.message });
    return res.status(500).json({ error: 'Failed to reopen ticket' });
  }
}

/**
 * Mark a ticket as a duplicate of a canonical ticket (Management)
 */
export async function markDuplicate(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { ticketId } = req.params;
    const { canonicalTicketId, reason } = req.body;

    if (!canonicalTicketId) {
      return res.status(400).json({ error: 'canonicalTicketId is required' });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const canonical = await prisma.ticket.findUnique({ where: { id: canonicalTicketId } });
    if (!canonical) return res.status(404).json({ error: 'Canonical ticket not found' });

    if (ticket.campusId !== canonical.campusId) {
      return res.status(400).json({ error: 'Cannot mark duplicate across different campuses' });
    }

    const callerRole = getCallerCampusRole(req, ticket.campusId);
    if (callerRole !== 'MANAGEMENT' && callerRole !== 'SUPERMANAGEMENT') {
      return res.status(403).json({ error: 'Only management can mark duplicate tickets' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'DUPLICATE',
          duplicateOfId: canonicalTicketId,
          currentStage: 'COMPLETED',
        },
      });

      await tx.statusHistory.create({
        data: {
          ticketId,
          status: 'DUPLICATE',
          previousStatus: ticket.status,
          changedById: userId,
          notes: `Marked as duplicate of ticket ${canonicalTicketId}. Reason: ${reason || 'Identified as duplicate issue'}`,
        },
      });

      return result;
    });

    emitToCampus(ticket.campusId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'DUPLICATE',
      timestamp: new Date().toISOString(),
    });
    emitToTicket(ticketId, SocketEvent.TICKET_UPDATED, {
      campusId: ticket.campusId,
      ticketId,
      ticket: updated,
      action: 'DUPLICATE',
      timestamp: new Date().toISOString(),
    });

    return res.json({ data: updated });
  } catch (error: any) {
    logger.error('Error marking duplicate', { error: error.message });
    return res.status(500).json({ error: 'Failed to mark duplicate' });
  }
}
