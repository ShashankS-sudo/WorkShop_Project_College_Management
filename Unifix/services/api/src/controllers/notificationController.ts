// Notification Controller - Unifix
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

/**
 * List notifications for the authenticated user
 */
export async function listNotifications(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { unreadOnly, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [total, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return res.json({
      data: notifications,
      metadata: {
        total,
        unreadCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching notifications', { error: error.message });
    return res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
}

/**
 * Mark a notification as read
 */
export async function markAsRead(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { notificationId } = req.params;

    const notif = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notif || notif.userId !== userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    return res.json({ data: updated });
  } catch (error: any) {
    logger.error('Error marking notification as read', { error: error.message });
    return res.status(500).json({ error: 'Failed to update notification' });
  }
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllAsRead(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return res.json({ data: { message: 'All notifications marked as read' } });
  } catch (error: any) {
    logger.error('Error marking all notifications as read', { error: error.message });
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
}
