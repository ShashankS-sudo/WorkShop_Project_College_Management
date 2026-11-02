// Attachment & Image Upload Controller - Unifix
import { Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { storageService } from '../lib/storage';
import { emitToTicket, emitToCampus } from '../lib/socket';
import { SocketEvent } from '@unifix/shared-types';
import logger from '../lib/logger';

// 1. Configure Multer with Memory Storage & Validation
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP, GIF, HEIC, PDF`));
    }
  },
}).single('file');

/**
 * Handle multipart file upload to Supabase Storage (with local fallback)
 * POST /api/v1/tickets/attachments/upload
 */
export async function uploadAttachment(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided in form field "file"' });
    }

    const folder = (req.body.folder as string) || 'tickets';

    const result = await storageService.uploadFile({
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      folder,
    });

    return res.status(201).json({
      data: result,
      message: 'File uploaded successfully',
    });
  } catch (err: any) {
    logger.error('Failed to upload attachment', { error: err.message });
    return res.status(500).json({ error: err.message || 'File upload failed' });
  }
}

/**
 * Generate a pre-signed direct upload URL for client-side uploads
 * POST /api/v1/tickets/attachments/presign
 */
export async function getPresignedUploadUrl(req: Request, res: Response) {
  try {
    const { filename, mimeType, folder = 'tickets' } = req.body;

    if (!filename || !mimeType) {
      return res.status(400).json({ error: 'filename and mimeType are required' });
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      return res.status(400).json({
        error: `Invalid mimeType: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      });
    }

    const presigned = await storageService.createSignedUploadUrl({
      originalFilename: filename,
      mimeType,
      folder,
    });

    return res.json({ data: presigned });
  } catch (err: any) {
    logger.error('Failed to generate presigned upload URL', { error: err.message });
    return res.status(500).json({ error: 'Could not generate upload URL' });
  }
}

/**
 * Attach an uploaded file record to an existing ticket
 * POST /api/v1/tickets/:ticketId/attachments
 */
export async function attachToTicket(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const campusIds: string[] = (req as any).campusIds || [];
    const { ticketId } = req.params;
    const { filename, filepath, mimeType, size } = req.body;

    if (!filename || !filepath || !mimeType || !size) {
      return res.status(400).json({
        error: 'filename, filepath, mimeType, and size are required to attach to ticket',
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, campusId: true, status: true },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!campusIds.includes(ticket.campusId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this campus' });
    }

    if (ticket.status === 'CLOSED') {
      return res.status(400).json({ error: 'Cannot add attachments to a closed ticket' });
    }

    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        userId,
        filename,
        filepath,
        mimeType,
        size,
        uploadedBy: userId,
        isApproved: true,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Notify ticket room & campus room via Socket.io
    emitToTicket(ticketId, SocketEvent.TICKET_UPDATED, {
      ticketId,
      action: 'attachment_added',
      attachment,
    });

    emitToCampus(ticket.campusId, SocketEvent.TICKET_UPDATED, {
      ticketId,
      action: 'attachment_added',
    });

    return res.status(201).json({
      data: attachment,
      message: 'Attachment linked to ticket successfully',
    });
  } catch (err: any) {
    logger.error('Failed to link attachment to ticket', { error: err.message });
    return res.status(500).json({ error: 'Could not link attachment to ticket' });
  }
}

/**
 * Get all attachments for a ticket
 * GET /api/v1/tickets/:ticketId/attachments
 */
export async function listTicketAttachments(req: Request, res: Response) {
  try {
    const campusIds: string[] = (req as any).campusIds || [];
    const { ticketId } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { campusId: true },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!campusIds.includes(ticket.campusId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this campus' });
    }

    const attachments = await prisma.attachment.findMany({
      where: { ticketId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ data: attachments });
  } catch (err: any) {
    logger.error('Failed to fetch ticket attachments', { error: err.message });
    return res.status(500).json({ error: 'Could not fetch attachments' });
  }
}

/**
 * Delete an attachment from a ticket and remote storage
 * DELETE /api/v1/tickets/:ticketId/attachments/:attachmentId
 */
export async function deleteAttachment(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const roles: string[] = (req as any).roles || [];
    const campusIds: string[] = (req as any).campusIds || [];
    const { ticketId, attachmentId } = req.params;

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        ticket: { select: { id: true, campusId: true } },
      },
    });

    if (!attachment || attachment.ticketId !== ticketId) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    if (!campusIds.includes(attachment.ticket.campusId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this campus' });
    }

    // Must be either the original uploader or MANAGEMENT/SUPERMANAGEMENT
    const isOwner = attachment.userId === userId || attachment.uploadedBy === userId;
    const isManagement = roles.includes('MANAGEMENT') || roles.includes('SUPERMANAGEMENT');

    if (!isOwner && !isManagement) {
      return res.status(403).json({ error: 'Forbidden: You cannot delete this attachment' });
    }

    // 1. Delete from storage
    await storageService.deleteFile(attachment.filepath);

    // 2. Delete from database
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // Notify ticket room
    emitToTicket(ticketId, SocketEvent.TICKET_UPDATED, {
      ticketId,
      action: 'attachment_deleted',
      attachmentId,
    });

    return res.json({
      message: 'Attachment deleted successfully',
      data: { id: attachmentId },
    });
  } catch (err: any) {
    logger.error('Failed to delete attachment', { error: err.message });
    return res.status(500).json({ error: 'Could not delete attachment' });
  }
}
